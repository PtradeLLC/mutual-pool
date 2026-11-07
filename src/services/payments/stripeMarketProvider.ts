import Stripe from 'stripe';
import { IPaymentProvider, PaymentIntentParams, PaymentIntentResult, PayoutDisbursementParams, PayoutDisbursementResult } from './types';

// Stripe for a market outside the US (UK, Mexico). Each market is a separate
// Stripe account in that country, because local methods (Bacs Direct Debit,
// OXXO, SPEI) are only offered to accounts based there; so each has its own
// secret key and webhook secret.
//
// Deposits go through a Stripe Checkout page (createDepositIntent returns its
// URL). Which methods it offers (card, Bacs Direct Debit, OXXO, SPEI...) is set
// in each account's payment method settings in the Stripe dashboard; this API
// version no longer takes a list per session. Payouts are transfers to the member's Stripe Connect account in that
// country, which pays out to their bank on its own schedule, the same model as
// US withdrawals.

export interface StripeMarketOptions {
  providerId: string;
  currency: string;
  secretKeyEnv: string;
  webhookSecretEnv: string;
  // Bank transfers into the customer's Stripe balance (SPEI in Mexico). Needs a Customer.
  bankTransferType?: Stripe.Checkout.SessionCreateParams.PaymentMethodOptions.CustomerBalance.BankTransfer.Type;
}

const appUrl = () => (process.env.APP_URL || 'https://themutualpool.com').replace(/\/+$/, '');

export class StripeMarketProvider implements IPaymentProvider {
  readonly providerId: string;
  readonly supportedCurrency: string;
  private client: Stripe | null = null;

  constructor(private readonly opts: StripeMarketOptions) {
    this.providerId = opts.providerId;
    this.supportedCurrency = opts.currency;
  }

  private stripe(): Stripe {
    if (!this.client) {
      const key = process.env[this.opts.secretKeyEnv];
      if (!key) throw new Error(`${this.opts.secretKeyEnv} is not set.`);
      this.client = new Stripe(key, { typescript: true, timeout: 20_000, maxNetworkRetries: 2 });
    }
    return this.client;
  }

  async createDepositIntent(params: PaymentIntentParams): Promise<PaymentIntentResult> {
    const base = { provider: this.providerId, currency: this.supportedCurrency, amountMinorUnits: params.amountMinorUnits, feeMinorUnits: 0, totalMinorUnits: params.amountMinorUnits };
    try {
      const stripe = this.stripe();
      const metadata: Record<string, string> = { userId: params.userId, market: this.providerId, ...(params.podId ? { podId: params.podId } : {}), ...(params.metadata || {}) };
      // One retry-safe key per attempt: the same user and amount within a minute reuse the session.
      const idempotencyKey = `dep_${this.providerId}_${params.userId}_${params.amountMinorUnits}_${Math.floor(Date.now() / 60_000)}`;
      const customer = this.opts.bankTransferType
        ? (await stripe.customers.create({ email: params.userEmail, metadata: { userId: params.userId } }, { idempotencyKey: `cus_${idempotencyKey}` })).id
        : undefined;
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer,
        customer_email: customer ? undefined : params.userEmail,
        client_reference_id: params.userId,
        payment_method_options: this.opts.bankTransferType
          ? { customer_balance: { funding_type: 'bank_transfer', bank_transfer: { type: this.opts.bankTransferType } } }
          : undefined,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: this.supportedCurrency.toLowerCase(),
            unit_amount: params.amountMinorUnits,
            product_data: { name: params.description || 'MutualPool deposit' },
          },
        }],
        metadata,
        payment_intent_data: { metadata },
        success_url: `${appUrl()}/?deposit=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl()}/?deposit=cancelled`,
      }, { idempotencyKey });
      return { ...base, success: true, paymentIntentId: session.id, redirectUrl: session.url || undefined, status: 'requires_action' };
    } catch (err) {
      return { ...base, success: false, paymentIntentId: '', status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
  }

  async processDisbursement(params: PayoutDisbursementParams): Promise<PayoutDisbursementResult> {
    try {
      if (!params.destinationAccountId.startsWith('acct_')) throw new Error('The destination must be the member\'s Stripe Connect account (acct_...).');
      const transfer = await this.stripe().transfers.create({
        amount: params.amountMinorUnits,
        currency: this.supportedCurrency.toLowerCase(),
        destination: params.destinationAccountId,
        description: params.narration.slice(0, 350),
        metadata: { userId: params.userId, market: this.providerId },
      }, { idempotencyKey: params.reference ? `tr_${this.providerId}_${params.reference}` : undefined });
      return { success: true, provider: this.providerId, transferId: transfer.id, status: 'SUCCESS' };
    } catch (err) {
      return { success: false, provider: this.providerId, transferId: '', status: 'FAILED', error: err instanceof Error ? err.message : String(err) };
    }
  }

  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    const secret = process.env[this.opts.webhookSecretEnv];
    if (!secret || !signature) return false;
    try {
      Stripe.webhooks.constructEvent(payload, signature, secret);
      return true;
    } catch {
      return false;
    }
  }
}
