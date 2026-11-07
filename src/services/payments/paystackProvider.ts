import crypto from 'crypto';
import { IPaymentProvider, PaymentIntentParams, PaymentIntentResult, PayoutDisbursementParams, PayoutDisbursementResult } from './types';

// Paystack (https://paystack.com/docs/api/) for Nigeria and Kenya. A Paystack
// business is registered in one country, so each market has its own secret key.
//
// Deposits: POST /transaction/initialize returns a hosted checkout URL (card,
// bank transfer and USSD in Nigeria; M-Pesa and card in Kenya).
// Payouts: create a transfer recipient (a Nigerian bank account, or an M-Pesa
// number in Kenya), then POST /transfer from the Paystack balance. API transfers
// need OTP confirmation turned off in the Paystack dashboard.
// Webhooks: x-paystack-signature is an HMAC-SHA512 of the raw body keyed with
// the secret key.

const PAYSTACK_API = 'https://api.paystack.co';

export interface PaystackOptions {
  providerId: string;
  currency: string;
  secretKeyEnv: string;
  channels: string[];
  recipientType: 'nuban' | 'mobile_money';
  // Used when the payout doesn't name a bank (Kenya: always M-Pesa).
  defaultBankCode?: string;
}

const appUrl = () => (process.env.APP_URL || 'https://themutualpool.com').replace(/\/+$/, '');

// Paystack references allow letters, digits, "-", "." and "=".
const reference = (prefix: string, id?: string) =>
  `${prefix}-${(id || `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`).toLowerCase().replace(/[^a-z0-9-]/g, '-')}`.slice(0, 50).padEnd(16, '0');

export class PaystackProvider implements IPaymentProvider {
  readonly providerId: string;
  readonly supportedCurrency: string;

  constructor(private readonly opts: PaystackOptions) {
    this.providerId = opts.providerId;
    this.supportedCurrency = opts.currency;
  }

  private async call<T = any>(path: string, body: unknown): Promise<T> {
    const key = process.env[this.opts.secretKeyEnv];
    if (!key) throw new Error(`${this.opts.secretKeyEnv} is not set.`);
    const res = await fetch(`${PAYSTACK_API}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json.status === false) throw new Error(json.message || `Paystack ${path} failed (HTTP ${res.status}).`);
    return json.data as T;
  }

  async createDepositIntent(params: PaymentIntentParams): Promise<PaymentIntentResult> {
    const base = { provider: this.providerId, currency: this.supportedCurrency, amountMinorUnits: params.amountMinorUnits, feeMinorUnits: 0, totalMinorUnits: params.amountMinorUnits };
    try {
      if (!params.userEmail) throw new Error('Paystack needs the member\'s email address.');
      const data = await this.call<{ authorization_url: string; reference: string }>('/transaction/initialize', {
        email: params.userEmail,
        amount: params.amountMinorUnits,
        currency: this.supportedCurrency,
        reference: reference('mp-dep'),
        channels: this.opts.channels,
        callback_url: `${appUrl()}/?deposit=success`,
        metadata: { userId: params.userId, podId: params.podId, market: this.providerId, description: params.description, ...(params.metadata || {}) },
      });
      return { ...base, success: true, paymentIntentId: data.reference, redirectUrl: data.authorization_url, status: 'requires_action' };
    } catch (err) {
      return { ...base, success: false, paymentIntentId: '', status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
  }

  async processDisbursement(params: PayoutDisbursementParams): Promise<PayoutDisbursementResult> {
    try {
      const bankCode = params.destinationBankRouting || this.opts.defaultBankCode;
      if (!bankCode) throw new Error('A bank code is required for this payout.');
      const recipient = await this.call<{ recipient_code: string }>('/transferrecipient', {
        type: this.opts.recipientType,
        name: params.accountName || params.userId,
        account_number: params.destinationAccountId,
        bank_code: bankCode,
        currency: this.supportedCurrency,
        metadata: { userId: params.userId },
      });
      const transfer = await this.call<{ transfer_code: string; status: string }>('/transfer', {
        source: 'balance',
        amount: params.amountMinorUnits,
        currency: this.supportedCurrency,
        recipient: recipient.recipient_code,
        reason: params.narration.slice(0, 100),
        reference: reference('mp-pay', params.reference),
      });
      const status = transfer.status === 'success' ? 'SUCCESS' : transfer.status === 'failed' || transfer.status === 'reversed' ? 'FAILED' : 'PENDING';
      return { success: status !== 'FAILED', provider: this.providerId, transferId: transfer.transfer_code, status };
    } catch (err) {
      return { success: false, provider: this.providerId, transferId: '', status: 'FAILED', error: err instanceof Error ? err.message : String(err) };
    }
  }

  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    const key = process.env[this.opts.secretKeyEnv];
    if (!key || !signature) return false;
    const expected = crypto.createHmac('sha512', key).update(payload).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(signature).trim().toLowerCase(), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}
