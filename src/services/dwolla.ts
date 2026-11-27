// Dwolla (dwolla.com) API client.
//
// Dwolla moves money over ACH (and RTP/FedNow) between its customers' bank
// accounts and Dwolla Balances. Balances are held by Dwolla's financial
// institution partner(s), not by Dwolla or by MutualPool.
//
// Configuration (all server-side; never sent to the browser):
//   DWOLLA_API_KEY / DWOLLA_API_SECRET   application credentials
//   DWOLLA_ENV                           'sandbox' (default) or 'production'
//   DWOLLA_WEBHOOK_SECRET                secret of our webhook subscription
//
// Only src/server/dwollaRail.ts should call this module.
import crypto from 'crypto';

const HOSTS = {
  sandbox: 'https://api-sandbox.dwolla.com',
  production: 'https://api.dwolla.com',
} as const;
const HAL = 'application/vnd.dwolla.v1.hal+json';
const REQUEST_TIMEOUT_MS = 20_000;

export type DwollaEnv = keyof typeof HOSTS;

export function dwollaEnv(): DwollaEnv {
  return (process.env.DWOLLA_ENV || '').trim().toLowerCase() === 'production' ? 'production' : 'sandbox';
}

export function dwollaConfigured(): boolean {
  return Boolean((process.env.DWOLLA_API_KEY || '').trim() && (process.env.DWOLLA_API_SECRET || '').trim());
}

export function dwollaBaseUrl(): string {
  return HOSTS[dwollaEnv()];
}

export class DwollaError extends Error {
  status: number;
  code?: string;
  /** Field-level errors from Dwolla's ValidationError responses. */
  details?: Array<{ code?: string; message?: string; path?: string }>;
  constructor(status: number, message: string, code?: string, details?: DwollaError['details']) {
    super(message);
    this.name = 'DwollaError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface DwollaResponse<T> {
  status: number;
  /** Location header: URL of a created resource. */
  location?: string;
  body: T;
}

// Requests to the Dwolla API. Injectable so unit tests run against a fake
// Dwolla (see tests/dwolla.test.ts).
export type DwollaTransport = <T>(method: 'GET' | 'POST', url: string, body?: unknown, opts?: { idempotencyKey?: string }) => Promise<DwollaResponse<T>>;

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const key = (process.env.DWOLLA_API_KEY || '').trim();
  const secret = (process.env.DWOLLA_API_SECRET || '').trim();
  if (!key || !secret) throw new DwollaError(0, 'Dwolla is not configured.', 'not_configured');
  const res = await fetchWithTimeout(dwollaBaseUrl() + '/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new DwollaError(res.status, json.error_description || json.message || 'Dwolla authentication failed.', json.error || 'auth_failed');
  }
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 };
  return cachedToken.value;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    const e = err as Error;
    throw new DwollaError(0, e.name === 'AbortError' ? 'Dwolla request timed out.' : `Dwolla unreachable: ${e.message}`, 'network');
  } finally {
    clearTimeout(timer);
  }
}

const httpTransport: DwollaTransport = async <T>(method: 'GET' | 'POST', url: string, body?: unknown, opts: { idempotencyKey?: string } = {}) => {
  const full = url.startsWith('http') ? url : dwollaBaseUrl() + url;
  // Only ever send our token to Dwolla's own API host.
  if (!full.startsWith(dwollaBaseUrl() + '/')) throw new DwollaError(0, 'Refusing to call a non-Dwolla URL.', 'bad_url');
  const send = async (token: string) => {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: HAL };
    if (body !== undefined) headers['Content-Type'] = HAL;
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    return fetchWithTimeout(full, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  };
  let res = await send(await accessToken());
  if (res.status === 401) {
    // Expired or revoked token: get a fresh one and retry once.
    cachedToken = null;
    res = await send(await accessToken());
  }
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { message: text.slice(0, 300) }; }
  if (!res.ok) {
    const details = Array.isArray(json?._embedded?.errors) ? json._embedded.errors.map((e: any) => ({ code: e.code, message: e.message, path: e.path })) : undefined;
    throw new DwollaError(res.status, json?.message || `Dwolla API ${res.status}`, json?.code, details);
  }
  return { status: res.status, location: res.headers.get('Location') || undefined, body: json as T };
};

let transport: DwollaTransport = httpTransport;
export function setDwollaTransport(t: DwollaTransport | null): void {
  transport = t || httpTransport;
  cachedToken = null;
  cachedAccountBalance = null;
}

// --- Helpers -------------------------------------------------------------------
const money = (usd: number) => ({ currency: 'USD', value: (Math.round(usd * 100) / 100).toFixed(2) });
const link = (body: any, rel: string): string | undefined => body?._links?.[rel]?.href;
function created(res: DwollaResponse<unknown>, what: string): string {
  if (!res.location) throw new DwollaError(res.status, `Dwolla did not return the new ${what}.`, 'no_location');
  return res.location;
}

// --- Account -------------------------------------------------------------------
/** MutualPool's own Dwolla account (receives facilitator fees). */
export async function getAccountUrl(): Promise<string> {
  const root = await transport<any>('GET', '/');
  const href = link(root.body, 'account');
  if (!href) throw new DwollaError(root.status, 'Dwolla account link missing.', 'no_account');
  return href;
}

let cachedAccountBalance: string | null = null;
/**
 * MutualPool's own Dwolla Balance: receives the facilitator fees (reserve +
 * platform) and pays a recipient when a member's contribution fails.
 */
export async function getAccountBalanceFundingSource(): Promise<string> {
  if (cachedAccountBalance) return cachedAccountBalance;
  const account = await getAccountUrl();
  const res = await transport<any>('GET', `${account}/funding-sources`);
  const list: any[] = res.body?._embedded?.['funding-sources'] || [];
  const balance = list.find(fs => fs.type === 'balance' && !fs.removed);
  const href = link(balance, 'self');
  if (!href) throw new DwollaError(res.status, 'MutualPool Dwolla balance not found.', 'no_balance');
  cachedAccountBalance = href;
  return href;
}

// --- Customers -----------------------------------------------------------------
export interface PersonalCustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  /** Last four digits of the SSN. Passed through to Dwolla, never stored by us. */
  ssnLast4: string;
  /** Our user id, so Dwolla records can be matched back. */
  correlationId: string;
}

export async function createPersonalVerifiedCustomer(input: PersonalCustomerInput, idempotencyKey: string): Promise<string> {
  const res = await transport('POST', '/customers', {
    type: 'personal',
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    address1: input.address1,
    ...(input.address2 ? { address2: input.address2 } : {}),
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    dateOfBirth: input.dateOfBirth,
    ssn: input.ssnLast4,
    correlationId: input.correlationId,
  }, { idempotencyKey });
  return created(res, 'customer');
}

export interface DwollaCustomer {
  status: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export async function getCustomer(customerUrl: string): Promise<DwollaCustomer> {
  return (await transport<DwollaCustomer>('GET', customerUrl)).body;
}

// --- Debit authorization -------------------------------------------------------
export interface OnDemandAuthorization {
  url: string;
  bodyText: string;
  buttonText: string;
}

/** Text the member must see and accept before we can debit their bank later. */
export async function createOnDemandAuthorization(): Promise<OnDemandAuthorization> {
  const res = await transport<any>('POST', '/on-demand-authorizations');
  const url = link(res.body, 'self');
  if (!url || !res.body?.bodyText) throw new DwollaError(res.status, 'Dwolla did not return an authorization.', 'no_authorization');
  return { url, bodyText: String(res.body.bodyText), buttonText: String(res.body.buttonText || 'Agree & Continue') };
}

// --- Funding sources -------------------------------------------------------------
export interface BankFundingSourceInput {
  name: string;
  authorizationUrl: string;
  /** Production: a Plaid processor token for Dwolla. */
  plaidToken?: string;
  /** Sandbox testing only: a test routing/account number. */
  routingNumber?: string;
  accountNumber?: string;
  bankAccountType?: 'checking' | 'savings';
}

export async function createBankFundingSource(customerUrl: string, input: BankFundingSourceInput, idempotencyKey: string): Promise<string> {
  const body: Record<string, unknown> = {
    name: input.name,
    _links: { 'on-demand-authorization': { href: input.authorizationUrl } },
  };
  if (input.plaidToken) {
    body.plaidToken = input.plaidToken;
  } else {
    if (dwollaEnv() === 'production') throw new DwollaError(0, 'Banks must be linked through Plaid.', 'plaid_required');
    body.routingNumber = input.routingNumber;
    body.accountNumber = input.accountNumber;
    body.bankAccountType = input.bankAccountType || 'checking';
  }
  const res = await transport('POST', `${customerUrl}/funding-sources`, body, { idempotencyKey });
  return created(res, 'bank account');
}

export interface DwollaFundingSource {
  url: string;
  type: 'bank' | 'balance' | string;
  status: string;
  name?: string;
  bankName?: string;
  removed?: boolean;
}

export async function getFundingSource(fundingSourceUrl: string): Promise<DwollaFundingSource> {
  const fs = (await transport<any>('GET', fundingSourceUrl)).body;
  return { url: fundingSourceUrl, type: fs.type, status: fs.status, name: fs.name, bankName: fs.bankName, removed: fs.removed };
}

export async function listFundingSources(customerUrl: string): Promise<DwollaFundingSource[]> {
  const res = await transport<any>('GET', `${customerUrl}/funding-sources`);
  const list: any[] = res.body?._embedded?.['funding-sources'] || [];
  return list.map(fs => ({ url: link(fs, 'self') || '', type: fs.type, status: fs.status, name: fs.name, bankName: fs.bankName, removed: fs.removed }));
}

/** Sandbox only: verify a test bank with Dwolla's fixed micro-deposit amounts. */
export async function sandboxVerifyMicroDeposits(fundingSourceUrl: string): Promise<void> {
  if (dwollaEnv() !== 'sandbox') throw new DwollaError(0, 'Micro-deposit shortcut is sandbox-only.', 'sandbox_only');
  await transport('POST', `${fundingSourceUrl}/micro-deposits`);
  await transport('POST', `${fundingSourceUrl}/micro-deposits`, { amount1: money(0.03), amount2: money(0.09) });
}

export async function getBalance(balanceFundingSourceUrl: string): Promise<{ availableUsd: number; totalUsd: number }> {
  const b = (await transport<any>('GET', `${balanceFundingSourceUrl}/balance`)).body;
  return { availableUsd: Number(b?.balance?.value) || 0, totalUsd: Number(b?.total?.value ?? b?.balance?.value) || 0 };
}

// --- Transfers -------------------------------------------------------------------
export interface TransferFee {
  /** Customer URL the fee is charged to. Dwolla requires one party for all fees. */
  chargeToCustomerUrl: string;
  amountUsd: number;
}

export interface TransferInput {
  sourceUrl: string;
  destinationUrl: string;
  amountUsd: number;
  fees?: TransferFee[];
  /** Same-day ACH on the debit ("source") and/or credit ("destination") leg. */
  sameDay?: { source?: boolean; destination?: boolean };
  metadata?: Record<string, string>;
  correlationId?: string;
}

export async function createTransfer(input: TransferInput, idempotencyKey: string): Promise<string> {
  const fees = input.fees || [];
  if (new Set(fees.map(f => f.chargeToCustomerUrl)).size > 1) {
    throw new DwollaError(0, 'All fees on a transfer must be charged to the same customer.', 'fee_party');
  }
  const body: Record<string, unknown> = {
    _links: { source: { href: input.sourceUrl }, destination: { href: input.destinationUrl } },
    amount: money(input.amountUsd),
  };
  if (fees.length) {
    body.fees = fees.map(f => ({ _links: { 'charge-to': { href: f.chargeToCustomerUrl } }, amount: money(f.amountUsd) }));
  }
  if (input.sameDay?.source || input.sameDay?.destination) {
    body.clearing = {
      ...(input.sameDay.source ? { source: 'next-available' } : {}),
      ...(input.sameDay.destination ? { destination: 'next-available' } : {}),
    };
  }
  if (input.metadata) body.metadata = input.metadata;
  if (input.correlationId) body.correlationId = input.correlationId;
  const res = await transport('POST', '/transfers', body, { idempotencyKey });
  return created(res, 'transfer');
}

export interface DwollaTransfer {
  status: 'pending' | 'processed' | 'failed' | 'cancelled' | string;
  amountUsd: number;
}

export async function getTransfer(transferUrl: string): Promise<DwollaTransfer> {
  const t = (await transport<any>('GET', transferUrl)).body;
  return { status: t.status, amountUsd: Number(t?.amount?.value) || 0 };
}

/** ACH return code and description for a failed transfer (e.g. R01 insufficient funds). */
export async function getTransferFailure(transferUrl: string): Promise<{ code?: string; description?: string }> {
  try {
    const f = (await transport<any>('GET', `${transferUrl}/failure`)).body;
    return { code: f?.code, description: f?.description };
  } catch {
    return {};
  }
}

/** Sandbox only: process pending bank transfers now. */
export async function sandboxProcessTransfers(): Promise<void> {
  if (dwollaEnv() !== 'sandbox') throw new DwollaError(0, 'Simulations are sandbox-only.', 'sandbox_only');
  await transport('POST', '/sandbox-simulations');
}

// --- Webhooks --------------------------------------------------------------------
/**
 * Dwolla signs each webhook with HMAC-SHA256 of the raw body, keyed with the
 * subscription secret, sent hex-encoded in X-Request-Signature-SHA-256.
 */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined, secret: string | undefined): boolean {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature.trim().toLowerCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
