// Column (column.com) bank API client.
//
// Column is a chartered bank with an API: entities own bank accounts, book
// transfers move money between Column accounts instantly, and ACH transfers
// move money to or from external banks. Sandbox and production share the host;
// the API key prefix selects the environment (test_ / live_).
//
// Only src/server/custody.ts should call this module.
import crypto from 'crypto';

const BASE_URL = (process.env.COLUMN_API_BASE || 'https://api.column.com').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 20_000;

function apiKey(): string {
  return (process.env.COLUMN_API_KEY || '').trim();
}

export function columnMode(): 'off' | 'sandbox' | 'live' {
  const key = apiKey();
  if (!key) return 'off';
  return key.startsWith('live_') ? 'live' : 'sandbox';
}

export class ColumnError extends Error {
  status: number;
  code?: string;
  body?: unknown;
  constructor(status: number, message: string, code?: string, body?: unknown) {
    super(message);
    this.name = 'ColumnError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

// Requests to the Column API. The transport is injectable so unit tests can
// run the custody layer against a fake bank (see tests/custody.test.ts).
export type ColumnTransport = <T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, opts?: { idempotencyKey?: string }) => Promise<T>;

async function httpTransport<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, opts: { idempotencyKey?: string } = {}): Promise<T> {
  const key = apiKey();
  if (!key) throw new ColumnError(0, 'COLUMN_API_KEY is not set', 'not_configured');
  const headers: Record<string, string> = {
    Authorization: 'Basic ' + Buffer.from(':' + key).toString('base64'),
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(BASE_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 500) }; }
    if (!res.ok) {
      const message = (json && (json.message || json.error?.message || json.error)) || `Column API ${res.status}`;
      throw new ColumnError(res.status, String(message), json?.code || json?.type, json);
    }
    return json as T;
  } catch (err) {
    if (err instanceof ColumnError) throw err;
    const e = err as Error;
    throw new ColumnError(0, e.name === 'AbortError' ? 'Column API request timed out' : `Column API unreachable: ${e.message}`, 'network');
  } finally {
    clearTimeout(timer);
  }
}

let transport: ColumnTransport = httpTransport;
export function setColumnTransport(t: ColumnTransport | null): void {
  transport = t || httpTransport;
}

// --- Objects (the fields we use) ------------------------------------------
export interface ColumnEntity {
  id: string;
  type: 'PERSON' | 'BUSINESS' | string;
  name?: string;
  verification_status: 'verified' | 'manual_review' | 'denied' | 'pending' | 'unverified' | string;
  is_root?: boolean;
  review_reasons?: string[];
  person_details?: { first_name?: string; last_name?: string; email?: string };
}
export interface ColumnBalances { available_amount: number; holding_amount: number; locked_amount: number; pending_amount: number }
export interface ColumnBankAccount {
  id: string;
  description?: string;
  display_name?: string;
  default_account_number: string;
  default_account_number_id: string;
  routing_number: string;
  status: 'open' | 'closed' | 'frozen' | string;
  type?: string;
  owners?: string[];
  balances?: ColumnBalances;
  currency_code?: string;
}
export interface ColumnCounterparty { id: string; account_number: string; routing_number: string; name?: string; account_type?: string; is_column_account?: boolean }
export type AchStatus = 'INITIATED' | 'PRE_REVIEW' | 'HOLD' | 'PENDING_SUBMISSION' | 'SUBMITTED' | 'SETTLED' | 'RETURNED' | 'COMPLETED' | 'CANCELED' | 'SCHEDULED' | 'PENDING_RETURN' | 'RETURN_DISHONORED' | 'RETURN_CONTESTED' | 'MANUAL_REVIEW' | 'NSF' | string;
export interface ColumnAchTransfer {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  status: AchStatus;
  bank_account_id?: string;
  counterparty_id?: string;
  description?: string;
  is_incoming?: boolean;
  idempotency_key?: string;
  settled_at?: string | null;
  completed_at?: string | null;
  returned_at?: string | null;
  return_details?: Array<{ return_code?: string; description?: string }>;
  created_at?: string;
}
export interface ColumnBookTransfer {
  id: string;
  amount: number;
  status: 'COMPLETED' | 'REJECTED' | 'HOLD' | 'CANCELED' | string;
  sender_bank_account_id?: string;
  receiver_bank_account_id?: string;
  description?: string;
  idempotency_key?: string;
  created_at?: string;
}
export interface ColumnEvent { id: string; type: string; created_at: string; data: any }
export interface ColumnWebhookEndpoint { id: string; url: string; description?: string; enabled_events: string[]; secret?: string; is_disabled?: boolean }

export const toCents = (usd: number): number => Math.round((Number(usd) || 0) * 100);
export const fromCents = (cents: number): number => Math.round(Number(cents) || 0) / 100;

// --- Entities -------------------------------------------------------------
export interface PersonEntityInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string; // YYYY-MM-DD
  ssn: string;         // digits only
  email?: string;
  phone?: string;      // E.164
  address: { line1: string; line2?: string; city: string; state: string; postalCode: string; countryCode?: string };
}
export async function createPersonEntity(input: PersonEntityInput, idempotencyKey?: string): Promise<ColumnEntity> {
  return transport<ColumnEntity>('POST', '/entities/person', {
    first_name: input.firstName,
    last_name: input.lastName,
    middle_name: input.middleName || undefined,
    date_of_birth: input.dateOfBirth,
    ssn: input.ssn.replace(/\D/g, ''),
    email: input.email || undefined,
    phone_number: input.phone || undefined,
    address: {
      line_1: input.address.line1,
      line_2: input.address.line2 || undefined,
      city: input.address.city,
      state: input.address.state,
      postal_code: input.address.postalCode,
      country_code: input.address.countryCode || 'US',
    },
  }, { idempotencyKey });
}
export interface BusinessEntityInput {
  businessName: string;
  ein?: string;
  website?: string;
  legalType?: string;
  address: { line1: string; city: string; state: string; postalCode: string; countryCode?: string };
  description?: string;
}
export async function createBusinessEntity(input: BusinessEntityInput, idempotencyKey?: string): Promise<ColumnEntity> {
  return transport<ColumnEntity>('POST', '/entities/business', {
    business_name: input.businessName,
    ein: input.ein || undefined,
    ein_pending: !input.ein,
    website: input.website || undefined,
    legal_type: input.legalType || 'llc',
    description: input.description || undefined,
    address: {
      line_1: input.address.line1,
      city: input.address.city,
      state: input.address.state,
      postal_code: input.address.postalCode,
      country_code: input.address.countryCode || 'US',
    },
  }, { idempotencyKey });
}
export async function getEntity(entityId: string): Promise<ColumnEntity> {
  return transport<ColumnEntity>('GET', `/entities/${encodeURIComponent(entityId)}`);
}
export async function listEntities(limit = 100): Promise<ColumnEntity[]> {
  const r = await transport<{ entities: ColumnEntity[] }>('GET', `/entities?limit=${limit}`);
  return r.entities || [];
}

// --- Bank accounts --------------------------------------------------------
export async function createBankAccount(input: { entityId: string; description: string; displayName?: string }, idempotencyKey?: string): Promise<ColumnBankAccount> {
  return transport<ColumnBankAccount>('POST', '/bank-accounts', {
    entity_id: input.entityId,
    description: input.description.slice(0, 120),
    display_name: input.displayName ? input.displayName.slice(0, 120) : undefined,
  }, { idempotencyKey });
}
export async function getBankAccount(bankAccountId: string): Promise<ColumnBankAccount> {
  return transport<ColumnBankAccount>('GET', `/bank-accounts/${encodeURIComponent(bankAccountId)}`);
}
export async function listBankAccounts(params: { entityId?: string; limit?: number } = {}): Promise<ColumnBankAccount[]> {
  const q = new URLSearchParams();
  if (params.entityId) q.set('entity_id', params.entityId);
  q.set('limit', String(params.limit || 100));
  const r = await transport<{ bank_accounts: ColumnBankAccount[] }>('GET', `/bank-accounts?${q.toString()}`);
  return r.bank_accounts || [];
}

// --- Counterparties (external bank accounts) -------------------------------
export async function createCounterparty(input: { accountNumber: string; routingNumber: string; name?: string; accountType?: 'checking' | 'savings'; description?: string }, idempotencyKey?: string): Promise<ColumnCounterparty> {
  return transport<ColumnCounterparty>('POST', '/counterparties', {
    account_number: input.accountNumber.replace(/\s/g, ''),
    routing_number: input.routingNumber.replace(/\s/g, ''),
    routing_number_type: 'aba',
    account_type: input.accountType || 'checking',
    name: input.name ? input.name.slice(0, 127) : undefined,
    description: input.description ? input.description.slice(0, 120) : undefined,
  }, { idempotencyKey });
}

// --- Transfers ------------------------------------------------------------
export async function createBookTransfer(input: {
  senderBankAccountId: string;
  receiverBankAccountId: string;
  amountCents: number;
  description: string;
  idempotencyKey: string;
  allowOverdraft?: boolean;
}): Promise<ColumnBookTransfer> {
  return transport<ColumnBookTransfer>('POST', '/transfers/book', {
    sender_bank_account_id: input.senderBankAccountId,
    receiver_bank_account_id: input.receiverBankAccountId,
    amount: input.amountCents,
    currency_code: 'USD',
    description: input.description.slice(0, 120),
    allow_overdraft: input.allowOverdraft || false,
  }, { idempotencyKey: input.idempotencyKey });
}
export async function getBookTransfer(id: string): Promise<ColumnBookTransfer> {
  return transport<ColumnBookTransfer>('GET', `/transfers/book/${encodeURIComponent(id)}`);
}
export async function createAchTransfer(input: {
  bankAccountId: string;
  counterpartyId: string;
  type: 'CREDIT' | 'DEBIT';
  amountCents: number;
  description: string;
  idempotencyKey: string;
  entryClassCode?: 'PPD' | 'WEB' | 'CCD';
  companyName?: string;
  companyEntryDescription?: string;
  receiverName?: string;
  sameDay?: boolean;
}): Promise<ColumnAchTransfer> {
  return transport<ColumnAchTransfer>('POST', '/transfers/ach', {
    bank_account_id: input.bankAccountId,
    counterparty_id: input.counterpartyId,
    type: input.type,
    amount: input.amountCents,
    currency_code: 'USD',
    description: input.description.slice(0, 120),
    entry_class_code: input.entryClassCode || (input.type === 'DEBIT' ? 'WEB' : 'PPD'),
    company_name: (input.companyName || 'MutualPool').slice(0, 16),
    company_entry_description: (input.companyEntryDescription || (input.type === 'DEBIT' ? 'DEPOSIT' : 'PAYOUT')).slice(0, 10),
    receiver_name: input.receiverName ? input.receiverName.slice(0, 22) : undefined,
    same_day: input.sameDay || false,
  }, { idempotencyKey: input.idempotencyKey });
}
export async function getAchTransfer(id: string): Promise<ColumnAchTransfer> {
  return transport<ColumnAchTransfer>('GET', `/transfers/ach/${encodeURIComponent(id)}`);
}
export async function listAchTransfers(params: { bankAccountId?: string; limit?: number } = {}): Promise<ColumnAchTransfer[]> {
  const q = new URLSearchParams();
  if (params.bankAccountId) q.set('bank_account_id', params.bankAccountId);
  q.set('limit', String(params.limit || 20));
  const r = await transport<{ transfers?: ColumnAchTransfer[]; ach_transfers?: ColumnAchTransfer[] }>('GET', `/transfers/ach?${q.toString()}`);
  return r.transfers || r.ach_transfers || [];
}

// --- Realtime (RTP / FedNow): instant pushes to banks that support them -----
export interface ColumnFinancialInstitution { routing_number: string; full_name?: string; short_name?: string; ach_eligible?: boolean; realtime_eligible?: boolean; realtime_rfp_eligible?: boolean; wire_eligible?: boolean }
export async function getFinancialInstitution(routingNumber: string): Promise<ColumnFinancialInstitution> {
  return transport<ColumnFinancialInstitution>('GET', `/institutions/${encodeURIComponent(routingNumber.replace(/\D/g, ''))}`);
}
export type RealtimeStatus = 'pre_review' | 'hold' | 'canceled' | 'initiated' | 'pending' | 'accepted' | 'completed' | 'blocked' | 'rejected' | 'manual_review' | 'manual_review_approved' | 'manual_review_rejected' | string;
export interface ColumnRealtimeTransfer { id: string; amount: number; status: RealtimeStatus; counterparty_id?: string; bank_account_id?: string; description?: string; rejection_code?: string; rejection_code_description?: string; idempotency_key?: string; created_at?: string }
export async function createRealtimeTransfer(input: { bankAccountId: string; counterpartyId: string; amountCents: number; description: string; idempotencyKey: string; endToEndId?: string }): Promise<ColumnRealtimeTransfer> {
  // Realtime messages reject characters outside letters, digits, space and . , ? : / ( ) ' + -
  const clean = (s: string) => s.replace(/[^A-Za-z0-9 .,?:/()'+-]/g, ' ').slice(0, 120);
  return transport<ColumnRealtimeTransfer>('POST', '/transfers/realtime', {
    bank_account_id: input.bankAccountId,
    counterparty_id: input.counterpartyId,
    amount: input.amountCents,
    currency_code: 'USD',
    description: clean(input.description),
    end_to_end_id: (input.endToEndId || input.idempotencyKey).replace(/[^A-Za-z0-9]/g, '').slice(0, 35),
  }, { idempotencyKey: input.idempotencyKey });
}
export async function getRealtimeTransfer(id: string): Promise<ColumnRealtimeTransfer> {
  return transport<ColumnRealtimeTransfer>('GET', `/transfers/realtime/${encodeURIComponent(id)}`);
}

// --- Sandbox simulation (not available with live keys) ---------------------
// Returns an empty body; the incoming transfer appears in the account's ACH
// list shortly after, SCHEDULED for the next Fed window (settle it with
// simulateSettleAch to make the funds available immediately).
export async function simulateReceiveAchCredit(input: { destinationAccountNumberId: string; amountCents: number }): Promise<void> {
  await transport<unknown>('POST', '/simulate/receive-ach-credit', { destination_account_number_id: input.destinationAccountNumberId, amount: input.amountCents, currency_code: 'USD' });
}
export async function simulateSettleAch(achTransferId: string): Promise<ColumnAchTransfer> {
  return transport<ColumnAchTransfer>('POST', '/simulate/transfers/ach/settle', { ach_transfer_id: achTransferId });
}

// --- Webhooks -------------------------------------------------------------
export async function createWebhookEndpoint(input: { url: string; description: string; enabledEvents: string[] }): Promise<ColumnWebhookEndpoint> {
  return transport<ColumnWebhookEndpoint>('POST', '/webhook-endpoints', { url: input.url, description: input.description, enabled_events: input.enabledEvents });
}
export async function listWebhookEndpoints(): Promise<ColumnWebhookEndpoint[]> {
  const r = await transport<{ webhook_endpoints: ColumnWebhookEndpoint[] }>('GET', '/webhook-endpoints');
  return r.webhook_endpoints || [];
}
// Column signs the raw request body with HMAC-SHA256 using the endpoint's
// secret (header: Column-Signature). The docs do not pin the encoding, so both
// hex and base64 are accepted, compared in constant time.
export function verifyColumnSignature(rawBody: Buffer | string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const mac = crypto.createHmac('sha256', secret).update(body).digest();
  const provided = signatureHeader.trim().replace(/^(sha256=|v1=)/i, '');
  const candidates = [mac.toString('hex'), mac.toString('base64')];
  for (const c of candidates) {
    const a = Buffer.from(c);
    const b = Buffer.from(provided);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}
