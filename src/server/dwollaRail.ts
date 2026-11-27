// MutualPool's payment rail on Dwolla.
//
// Money model (agreed 2026-11-27):
// - Each member is a Dwolla "Personal Verified" customer with a linked, verified
//   bank account and a Dwolla Balance held by Dwolla's partner bank.
// - Weekly contributions are debited from each member's bank straight into that
//   week's recipient's Dwolla Balance; MutualPool never holds a pooled balance.
// - MutualPool's fees (5% non-refundable reserve fee + 10% platform fee) are
//   Dwolla facilitator fees credited to MutualPool's own Dwolla account
//   (see src/lib/contributionFees.ts).
// - Every debit relies on an on-demand authorization the member accepted when
//   linking their bank; the exact text, time, IP and browser are kept (2+ years).
//
// Off unless DWOLLA_API_KEY/SECRET are set; in production also needs
// DWOLLA_ENABLED=true, so adding keys alone never switches the live app over.

import crypto from 'crypto';
import type { User, DwollaMemberState, DwollaCustomerStatus, DwollaBankStatus, DebitAuthorization, DwollaTransferRecord, DwollaTransferStatus } from '../types';
import * as dwolla from '../services/dwolla';
import { contributionAmounts } from '../lib/contributionFees';

export function railEnabled(): boolean {
  if (!dwolla.dwollaConfigured()) return false;
  if (process.env.NODE_ENV === 'production') return process.env.DWOLLA_ENABLED === 'true';
  return true;
}

export function railStatus() {
  return { enabled: railEnabled(), env: dwolla.dwollaEnv() };
}

// --- State (persisted by server.ts through registerCollection) -------------------
let authorizations: DebitAuthorization[] = [];
let transfers: DwollaTransferRecord[] = [];
let processedEventIds: string[] = [];
const MAX_EVENT_IDS = 5000;

export const railCollections = {
  authorizations: { get: () => authorizations, set: (docs: DebitAuthorization[]) => { authorizations = docs; } },
  transfers: { get: () => transfers, set: (docs: DwollaTransferRecord[]) => { transfers = docs; } },
  events: { get: () => processedEventIds.map(id => ({ id })), set: (docs: Array<{ id: string }>) => { processedEventIds = docs.map(d => d.id).filter(Boolean); } },
};

export interface RailDeps {
  users: () => User[];
  /** Called after any change to users, authorizations, transfers or events. */
  persist: () => void;
  audit: (userId: string, userName: string, action: string, message: string, meta?: Record<string, unknown>) => void;
  /** A contribution failed (e.g. R01): cover the recipient from the reserve, mark the payer. */
  onContributionFailed?: (record: DwollaTransferRecord) => void | Promise<void>;
}

let deps: RailDeps | null = null;
export function initRail(d: RailDeps): void { deps = d; }
function need(): RailDeps {
  if (!deps) throw new Error('dwollaRail not initialised');
  return deps;
}

export class RailError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const nowIso = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

function fail(err: unknown): never {
  if (err instanceof RailError) throw err;
  if (err instanceof dwolla.DwollaError) {
    const detail = err.details?.map(d => d.message).filter(Boolean).join(' ');
    throw new RailError(err.status >= 400 && err.status < 500 ? 400 : 502, 'DWOLLA_' + (err.code || 'ERROR').toUpperCase(), detail || err.message);
  }
  throw err;
}

// --- Member enrollment (Personal Verified customer) -------------------------------
export interface EnrollInput {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  dateOfBirth: string;
  ssnLast4: string;
}

const US_STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR'.split(' '));

/** Validates enrollment fields. Returns a cleaned copy or a member-facing message. */
export function validateEnrollInput(raw: any): { ok: true; value: EnrollInput } | { ok: false; message: string } {
  const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const firstName = s(raw?.firstName, 50);
  const lastName = s(raw?.lastName, 50);
  const address1 = s(raw?.address1, 50);
  const address2 = s(raw?.address2, 50);
  const city = s(raw?.city, 50);
  const state = s(raw?.state, 2).toUpperCase();
  const postalCode = s(raw?.postalCode, 10);
  const dateOfBirth = s(raw?.dateOfBirth, 10);
  const ssnLast4 = s(raw?.ssnLast4, 4);
  if (!firstName || !lastName) return { ok: false, message: 'Enter your legal first and last name.' };
  if (!address1 || !city) return { ok: false, message: 'Enter your street address and city.' };
  if (/\b(p\.?\s*o\.?\s*box)\b/i.test(address1)) return { ok: false, message: 'Use a residential address, not a PO box.' };
  if (!US_STATES.has(state)) return { ok: false, message: 'Choose your US state.' };
  if (!/^\d{5}(-\d{4})?$/.test(postalCode)) return { ok: false, message: 'Enter a 5-digit ZIP code.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(Date.parse(dateOfBirth))) return { ok: false, message: 'Enter your date of birth.' };
  const dob = new Date(dateOfBirth + 'T00:00:00Z');
  const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age < 18) return { ok: false, message: 'You must be 18 or older.' };
  if (age > 125) return { ok: false, message: 'Check your date of birth.' };
  if (!/^\d{4}$/.test(ssnLast4)) return { ok: false, message: 'Enter the last 4 digits of your Social Security number.' };
  return { ok: true, value: { firstName, lastName, address1, address2: address2 || undefined, city, state, postalCode, dateOfBirth, ssnLast4 } };
}

function asCustomerStatus(v: string | undefined): DwollaCustomerStatus {
  const allowed: DwollaCustomerStatus[] = ['unverified', 'verified', 'retry', 'document', 'suspended', 'deactivated'];
  return (allowed as string[]).includes(String(v)) ? (v as DwollaCustomerStatus) : 'unverified';
}

/** Creates the member's Dwolla customer (or returns the existing one). */
export async function enrollMember(user: User, input: EnrollInput): Promise<DwollaMemberState> {
  const d = need();
  // One Dwolla customer per member. "retry"/"document" statuses are resolved on
  // that customer (full SSN or ID upload), never by creating a second one.
  if (user.dwolla?.customerUrl) return refreshMember(user);
  if (!user.email) throw new RailError(400, 'EMAIL_REQUIRED', 'Add an email address to your account first.');
  try {
    // The idempotency key changes when the details change, so resubmitting
    // corrected details is a new request while a double-click is not.
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ ...input, ssnLast4: undefined })).digest('hex').slice(0, 16);
    const customerUrl = await dwolla.createPersonalVerifiedCustomer({
      ...input,
      email: user.email,
      correlationId: user.id,
    }, `mp-customer-${user.id}-${fingerprint}`);
    const customer = await dwolla.getCustomer(customerUrl);
    user.dwolla = { ...(user.dwolla || {}), customerUrl, customerStatus: asCustomerStatus(customer.status), updatedAt: nowIso() };
    await attachBalance(user);
    d.audit(user.id, user.displayName, 'DWOLLA_CUSTOMER_CREATED', `Payment account created with Dwolla (status: ${user.dwolla.customerStatus}).`, { status: user.dwolla.customerStatus });
    d.persist();
    return user.dwolla;
  } catch (err) {
    fail(err);
  }
}

async function attachBalance(user: User): Promise<void> {
  if (!user.dwolla || user.dwolla.customerStatus !== 'verified' || user.dwolla.balanceFundingSourceUrl) return;
  const sources = await dwolla.listFundingSources(user.dwolla.customerUrl);
  const balance = sources.find(s => s.type === 'balance' && !s.removed);
  if (balance) user.dwolla.balanceFundingSourceUrl = balance.url;
}

/** Re-reads the member's customer and bank status from Dwolla. */
export async function refreshMember(user: User): Promise<DwollaMemberState> {
  const d = need();
  if (!user.dwolla?.customerUrl) throw new RailError(400, 'NOT_ENROLLED', 'Set up your payment account first.');
  try {
    const customer = await dwolla.getCustomer(user.dwolla.customerUrl);
    user.dwolla.customerStatus = asCustomerStatus(customer.status);
    if (user.dwolla.bankFundingSourceUrl) {
      const bank = await dwolla.getFundingSource(user.dwolla.bankFundingSourceUrl);
      user.dwolla.bankStatus = bank.removed ? 'removed' : (bank.status === 'verified' ? 'verified' : 'unverified');
    }
    await attachBalance(user);
    user.dwolla.updatedAt = nowIso();
    d.persist();
    return user.dwolla;
  } catch (err) {
    fail(err);
  }
}

// --- Debit authorization + bank link ----------------------------------------------
/** Gets the authorization text from Dwolla and records that it was shown. */
export async function startDebitAuthorization(user: User): Promise<DebitAuthorization> {
  const d = need();
  if (user.dwolla?.customerStatus !== 'verified') throw new RailError(400, 'NOT_VERIFIED', 'Your payment account must be verified before you link a bank.');
  try {
    const auth = await dwolla.createOnDemandAuthorization();
    const record: DebitAuthorization = {
      id: newId('dauth'),
      userId: user.id,
      provider: 'dwolla',
      authorizationUrl: auth.url,
      bodyText: auth.bodyText,
      buttonText: auth.buttonText,
      createdAt: nowIso(),
    };
    authorizations.unshift(record);
    d.persist();
    return record;
  } catch (err) {
    fail(err);
  }
}

export interface LinkBankInput {
  authorizationId: string;
  /** Production: Plaid processor token. */
  plaidToken?: string;
  /** Sandbox only. */
  routingNumber?: string;
  accountNumber?: string;
  bankAccountType?: 'checking' | 'savings';
  name?: string;
}

export interface RequestMeta { ip?: string; userAgent?: string }

/**
 * Links the member's bank. Submitting this is the member pressing the
 * authorization button, so the authorization is recorded as accepted here.
 */
export async function linkBank(user: User, input: LinkBankInput, meta: RequestMeta): Promise<DwollaMemberState> {
  const d = need();
  if (!user.dwolla?.customerUrl || user.dwolla.customerStatus !== 'verified') throw new RailError(400, 'NOT_VERIFIED', 'Your payment account must be verified before you link a bank.');
  const auth = authorizations.find(a => a.id === input.authorizationId && a.userId === user.id);
  if (!auth) throw new RailError(400, 'AUTHORIZATION_REQUIRED', 'Please review and accept the debit authorization first.');
  if (auth.acceptedAt) throw new RailError(409, 'AUTHORIZATION_USED', 'That authorization was already used. Start again.');
  if (!input.plaidToken && dwolla.dwollaEnv() === 'production') throw new RailError(400, 'PLAID_REQUIRED', 'Link your bank through Plaid.');
  if (!input.plaidToken && (!/^\d{9}$/.test(input.routingNumber || '') || !/^\d{4,17}$/.test(input.accountNumber || ''))) {
    throw new RailError(400, 'INVALID_BANK', 'Enter a 9-digit routing number and your account number.');
  }
  try {
    const fundingSourceUrl = await dwolla.createBankFundingSource(user.dwolla.customerUrl, {
      name: (input.name || 'Bank account').slice(0, 50),
      authorizationUrl: auth.authorizationUrl,
      plaidToken: input.plaidToken,
      routingNumber: input.routingNumber,
      accountNumber: input.accountNumber,
      bankAccountType: input.bankAccountType,
    }, `mp-bank-${user.id}-${auth.id}`);
    auth.acceptedAt = nowIso();
    auth.acceptedIp = meta.ip?.slice(0, 64);
    auth.acceptedUserAgent = meta.userAgent?.slice(0, 300);
    auth.fundingSourceUrl = fundingSourceUrl;
    // A newly linked bank replaces the old one for future debits.
    if (user.dwolla.authorizationId && user.dwolla.authorizationId !== auth.id) {
      const previous = authorizations.find(a => a.id === user.dwolla!.authorizationId);
      if (previous && !previous.revokedAt) previous.revokedAt = nowIso();
    }
    if (!input.plaidToken && dwolla.dwollaEnv() === 'sandbox') await dwolla.sandboxVerifyMicroDeposits(fundingSourceUrl);
    const bank = await dwolla.getFundingSource(fundingSourceUrl);
    user.dwolla.bankFundingSourceUrl = fundingSourceUrl;
    user.dwolla.bankStatus = bank.status === 'verified' ? 'verified' : 'unverified';
    user.dwolla.bankName = bank.bankName || bank.name;
    user.dwolla.authorizationId = auth.id;
    user.dwolla.updatedAt = nowIso();
    d.audit(user.id, user.displayName, 'DWOLLA_BANK_LINKED', `Bank linked for weekly contributions (${user.dwolla.bankStatus}). Debit authorization accepted.`, { authorizationId: auth.id });
    d.persist();
    return user.dwolla;
  } catch (err) {
    fail(err);
  }
}

// --- Transfers ---------------------------------------------------------------------
export interface ContributionRefs { podId: string; cycleWeek: number }

/** True when the member can pay a contribution (verified, bank verified, authorization in force). */
export function canContribute(user: User): boolean {
  const s = user.dwolla;
  if (!s || s.customerStatus !== 'verified' || s.bankStatus !== 'verified' || !s.bankFundingSourceUrl || !s.authorizationId) return false;
  const auth = authorizations.find(a => a.id === s.authorizationId);
  return Boolean(auth?.acceptedAt && !auth.revokedAt);
}

export function canReceive(user: User): boolean {
  return Boolean(user.dwolla?.customerStatus === 'verified' && user.dwolla.balanceFundingSourceUrl);
}

/**
 * One member's weekly contribution: their bank -> the recipient's Dwolla
 * Balance, with MutualPool's reserve and platform fees. Idempotent per pod,
 * week and payer, so a retried job never debits twice.
 */
export async function createContribution(payer: User, recipient: User, depositUsd: number, refs: ContributionRefs): Promise<DwollaTransferRecord> {
  const d = need();
  if (payer.id === recipient.id) throw new RailError(400, 'SAME_MEMBER', 'The recipient does not pay themselves.');
  if (!canContribute(payer)) throw new RailError(400, 'PAYER_NOT_READY', `${payer.displayName} has no verified bank with an active debit authorization.`);
  if (!canReceive(recipient)) throw new RailError(400, 'RECIPIENT_NOT_READY', `${recipient.displayName} cannot receive payouts yet.`);
  const existing = transfers.find(t => t.kind === 'CONTRIBUTION' && t.podId === refs.podId && t.cycleWeek === refs.cycleWeek && t.payerUserId === payer.id && t.status !== 'failed' && t.status !== 'cancelled');
  if (existing) return existing;
  const amounts = contributionAmounts(depositUsd);
  const attempt = transfers.filter(t => t.kind === 'CONTRIBUTION' && t.podId === refs.podId && t.cycleWeek === refs.cycleWeek && t.payerUserId === payer.id).length;
  try {
    const transferUrl = await dwolla.createTransfer({
      sourceUrl: payer.dwolla!.bankFundingSourceUrl!,
      destinationUrl: recipient.dwolla!.balanceFundingSourceUrl!,
      amountUsd: amounts.debitUsd,
      // Dwolla needs all fees charged to one party: both are taken from the
      // recipient's side; the payer still pays the reserve fee via debitUsd.
      fees: [
        { chargeToCustomerUrl: recipient.dwolla!.customerUrl, amountUsd: amounts.reserveFeeUsd },
        { chargeToCustomerUrl: recipient.dwolla!.customerUrl, amountUsd: amounts.platformFeeUsd },
      ].filter(f => f.amountUsd > 0),
      metadata: { kind: 'contribution', podId: refs.podId, cycleWeek: String(refs.cycleWeek), payer: payer.id, recipient: recipient.id },
      correlationId: `contrib-${refs.podId}-w${refs.cycleWeek}-${payer.id}`.slice(0, 255),
    }, `mp-contrib-${refs.podId}-w${refs.cycleWeek}-${payer.id}-a${attempt}`);
    const record: DwollaTransferRecord = {
      id: newId('dxfer'),
      kind: 'CONTRIBUTION',
      transferUrl,
      status: 'pending',
      amountUsd: amounts.debitUsd,
      reserveFeeUsd: amounts.reserveFeeUsd,
      platformFeeUsd: amounts.platformFeeUsd,
      payerUserId: payer.id,
      recipientUserId: recipient.id,
      podId: refs.podId,
      cycleWeek: refs.cycleWeek,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    transfers.unshift(record);
    d.audit(payer.id, payer.displayName, 'DWOLLA_CONTRIBUTION_STARTED', `Week ${refs.cycleWeek} contribution of $${amounts.depositUsd.toFixed(2)} (+$${amounts.reserveFeeUsd.toFixed(2)} reserve fee) started to ${recipient.displayName}.`, { podId: refs.podId, transferId: record.id });
    d.persist();
    return record;
  } catch (err) {
    fail(err);
  }
}

/** Moves money from the member's Dwolla Balance to their bank. */
export async function createWithdrawal(user: User, amountUsd: number, sameDay = false): Promise<DwollaTransferRecord> {
  const d = need();
  const s = user.dwolla;
  if (!s?.balanceFundingSourceUrl || s.bankStatus !== 'verified' || !s.bankFundingSourceUrl) throw new RailError(400, 'NOT_READY', 'Link and verify a bank account first.');
  if (!Number.isFinite(amountUsd) || amountUsd < 1) throw new RailError(400, 'INVALID_AMOUNT', 'Withdraw at least $1.00.');
  try {
    const { availableUsd } = await dwolla.getBalance(s.balanceFundingSourceUrl);
    if (availableUsd + 1e-9 < amountUsd) throw new RailError(402, 'INSUFFICIENT_FUNDS', `Your available balance is $${availableUsd.toFixed(2)}.`);
    const id = newId('dxfer');
    const transferUrl = await dwolla.createTransfer({
      sourceUrl: s.balanceFundingSourceUrl,
      destinationUrl: s.bankFundingSourceUrl,
      amountUsd,
      sameDay: sameDay ? { destination: true } : undefined,
      // Dwolla rejects metadata on balance -> bank transfers; the record links it.
      correlationId: `withdraw-${id}`,
    }, `mp-withdraw-${id}`);
    const record: DwollaTransferRecord = {
      id, kind: 'WITHDRAWAL', transferUrl, status: 'pending', amountUsd: Math.round(amountUsd * 100) / 100,
      reserveFeeUsd: 0, platformFeeUsd: 0, recipientUserId: user.id, createdAt: nowIso(), updatedAt: nowIso(),
    };
    transfers.unshift(record);
    d.audit(user.id, user.displayName, 'DWOLLA_WITHDRAWAL_STARTED', `Withdrawal of $${record.amountUsd.toFixed(2)} to bank started${sameDay ? ' (same-day)' : ''}.`, { transferId: id });
    d.persist();
    return record;
  } catch (err) {
    fail(err);
  }
}

function setTransferStatus(record: DwollaTransferRecord, status: DwollaTransferStatus, failure?: { code?: string; description?: string }): boolean {
  if (record.status === status) return false;
  record.status = status;
  if (failure?.code) record.failureCode = failure.code;
  if (failure?.description) record.failureReason = failure.description;
  record.updatedAt = nowIso();
  return true;
}

async function notifyFailed(record: DwollaTransferRecord): Promise<void> {
  const d = need();
  if (record.kind !== 'CONTRIBUTION' || record.status !== 'failed' || !d.onContributionFailed) return;
  try {
    await d.onContributionFailed(record);
  } catch (err) {
    console.error('[dwolla] handling a failed contribution:', err);
  }
}

/**
 * A member's contribution failed: MutualPool's reserve (its own Dwolla
 * Balance, funded by the 5% reserve fees) pays the recipient what they would
 * have received. Idempotent per failed contribution.
 */
export interface CoverInput {
  recipient: User;
  payerUserId: string;
  podId: string;
  cycleWeek: number;
  depositUsd: number;
  /** The failed contribution, when one was created. */
  failed?: DwollaTransferRecord;
}

export async function coverWithReserve(input: CoverInput): Promise<DwollaTransferRecord> {
  const d = need();
  const { recipient, payerUserId, podId, cycleWeek } = input;
  const existing = transfers.find(t => t.kind === 'RESERVE_COVER' && t.podId === podId && t.cycleWeek === cycleWeek && t.payerUserId === payerUserId && t.status !== 'failed' && t.status !== 'cancelled');
  if (existing) return existing;
  if (!canReceive(recipient)) throw new RailError(400, 'RECIPIENT_NOT_READY', `${recipient.displayName} cannot receive payouts.`);
  const { recipientNetUsd: net } = contributionAmounts(input.depositUsd);
  try {
    const source = await dwolla.getAccountBalanceFundingSource();
    const id = newId('dxfer');
    const transferUrl = await dwolla.createTransfer({
      sourceUrl: source,
      destinationUrl: recipient.dwolla!.balanceFundingSourceUrl!,
      amountUsd: net,
      correlationId: `cover-${podId}-w${cycleWeek}-${payerUserId}`.slice(0, 255),
    }, `mp-cover-${podId}-w${cycleWeek}-${payerUserId}`);
    const record: DwollaTransferRecord = {
      id, kind: 'RESERVE_COVER', transferUrl, status: 'pending', amountUsd: net, reserveFeeUsd: 0, platformFeeUsd: 0,
      recipientUserId: recipient.id, payerUserId, podId, cycleWeek,
      coversTransferId: input.failed?.id, createdAt: nowIso(), updatedAt: nowIso(),
    };
    transfers.unshift(record);
    if (input.failed) {
      input.failed.coveredByTransferId = id;
      input.failed.updatedAt = nowIso();
    }
    d.audit(recipient.id, recipient.displayName, 'DWOLLA_RESERVE_COVER', `MutualPool's reserve paid $${net.toFixed(2)} for a missed week ${cycleWeek} contribution.`, { podId, transferId: id, payerUserId });
    d.persist();
    return record;
  } catch (err) {
    fail(err);
  }
}

/** Dwolla transfers for a pod (newest first). */
export function podTransfers(podId: string): DwollaTransferRecord[] {
  return transfers.filter(t => t.podId === podId);
}

/** Polls Dwolla for transfers still pending (fallback for missed webhooks). */
export async function reconcilePendingTransfers(limit = 50): Promise<{ checked: number; changed: number }> {
  const d = need();
  let checked = 0;
  let changed = 0;
  for (const record of transfers.filter(t => t.status === 'pending').slice(0, limit)) {
    checked += 1;
    try {
      const t = await dwolla.getTransfer(record.transferUrl);
      const status = (['pending', 'processed', 'failed', 'cancelled'].includes(t.status) ? t.status : 'pending') as DwollaTransferStatus;
      const failure = status === 'failed' ? await dwolla.getTransferFailure(record.transferUrl) : undefined;
      if (setTransferStatus(record, status, failure)) {
        changed += 1;
        await notifyFailed(record);
      }
    } catch {
      // try again on the next run
    }
  }
  if (changed) d.persist();
  return { checked, changed };
}

// --- Webhooks ----------------------------------------------------------------------
export interface DwollaWebhookEvent {
  id: string;
  topic: string;
  resourceId?: string;
  timestamp?: string;
  _links?: { resource?: { href: string }; customer?: { href: string } };
}

const CUSTOMER_TOPICS: Record<string, DwollaCustomerStatus> = {
  customer_verified: 'verified',
  customer_reverification_needed: 'retry',
  customer_verification_document_needed: 'document',
  customer_suspended: 'suspended',
  customer_deactivated: 'deactivated',
};
const BANK_TOPICS: Record<string, DwollaBankStatus> = {
  customer_funding_source_verified: 'verified',
  customer_funding_source_unverified: 'unverified',
  customer_funding_source_removed: 'removed',
};

/** Applies one Dwolla webhook event. Duplicate deliveries are ignored. */
export async function handleWebhookEvent(event: DwollaWebhookEvent): Promise<{ applied: boolean; note: string }> {
  const d = need();
  if (!event?.id || !event.topic) return { applied: false, note: 'malformed event' };
  if (processedEventIds.includes(event.id)) return { applied: false, note: 'duplicate' };
  processedEventIds.unshift(event.id);
  if (processedEventIds.length > MAX_EVENT_IDS) processedEventIds.length = MAX_EVENT_IDS;

  const resource = event._links?.resource?.href;
  const customerUrl = event._links?.customer?.href;
  const user = customerUrl ? d.users().find(u => u.dwolla?.customerUrl === customerUrl) : undefined;
  let note = 'ignored';

  if (CUSTOMER_TOPICS[event.topic] && user?.dwolla) {
    user.dwolla.customerStatus = CUSTOMER_TOPICS[event.topic];
    user.dwolla.updatedAt = nowIso();
    if (user.dwolla.customerStatus === 'verified') {
      try { await attachBalance(user); } catch { /* picked up on the next refresh */ }
    }
    d.audit(user.id, user.displayName, 'DWOLLA_CUSTOMER_STATUS', `Payment account status: ${user.dwolla.customerStatus}.`, { topic: event.topic });
    note = `customer ${user.dwolla.customerStatus}`;
  } else if (BANK_TOPICS[event.topic] && user?.dwolla && resource && resource === user.dwolla.bankFundingSourceUrl) {
    user.dwolla.bankStatus = BANK_TOPICS[event.topic];
    user.dwolla.updatedAt = nowIso();
    d.audit(user.id, user.displayName, 'DWOLLA_BANK_STATUS', `Linked bank: ${user.dwolla.bankStatus}.`, { topic: event.topic });
    note = `bank ${user.dwolla.bankStatus}`;
  } else if (/transfer_(completed|failed|cancelled)$/.test(event.topic) && resource) {
    const record = transfers.find(t => t.transferUrl === resource);
    if (record) {
      const status: DwollaTransferStatus = event.topic.endsWith('completed') ? 'processed' : event.topic.endsWith('failed') ? 'failed' : 'cancelled';
      const failure = status === 'failed' ? await dwolla.getTransferFailure(resource) : undefined;
      if (setTransferStatus(record, status, failure)) {
        await notifyFailed(record);
        const who = d.users().find(u => u.id === (record.payerUserId || record.recipientUserId));
        d.audit(who?.id || 'SYSTEM', who?.displayName || 'Dwolla', 'DWOLLA_TRANSFER_' + status.toUpperCase(), `${record.kind === 'CONTRIBUTION' ? `Week ${record.cycleWeek} contribution` : 'Withdrawal'} ${status}${failure?.code ? ` (${failure.code})` : ''}.`, { transferId: record.id, podId: record.podId });
      }
      note = `transfer ${status}`;
    }
  }
  d.persist();
  return { applied: note !== 'ignored', note };
}

/** Admin summary. */
export function railReport() {
  return {
    ...railStatus(),
    authorizations: authorizations.length,
    transfers: {
      pending: transfers.filter(t => t.status === 'pending').length,
      failed: transfers.filter(t => t.status === 'failed').slice(0, 50),
      recent: transfers.slice(0, 50),
    },
  };
}
