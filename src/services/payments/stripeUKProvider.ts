import { IPaymentProvider, PaymentIntentParams, PaymentIntentResult, PayoutDisbursementParams, PayoutDisbursementResult } from './types';

export class StripeUKProvider implements IPaymentProvider {
  readonly providerId = 'stripe_uk';
  readonly supportedCurrency = 'GBP';

  async createDepositIntent(params: PaymentIntentParams): Promise<PaymentIntentResult> {
    const feeMinor = Math.round(params.amountMinorUnits * 0.04); // 4% platform fee
    const totalMinor = params.amountMinorUnits + feeMinor;
    const id = `pi_uk_bacs_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    return {
      success: true,
      provider: this.providerId,
      paymentIntentId: id,
      clientSecret: `${id}_secret_uk_test`,
      currency: this.supportedCurrency,
      amountMinorUnits: params.amountMinorUnits,
      feeMinorUnits: feeMinor,
      totalMinorUnits: totalMinor,
      status: 'requires_action',
    };
  }

  async processDisbursement(params: PayoutDisbursementParams): Promise<PayoutDisbursementResult> {
    const transferId = `tr_faster_payments_uk_${Date.now()}`;
    return {
      success: true,
      provider: this.providerId,
      transferId,
      status: 'SUCCESS',
    };
  }

  verifyWebhookSignature(_payload: string | Buffer, signature: string): boolean {
    return Boolean(signature && signature.length > 5);
  }
}
