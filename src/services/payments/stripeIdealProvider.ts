import { IPaymentProvider, PaymentIntentParams, PaymentIntentResult, PayoutDisbursementParams, PayoutDisbursementResult } from './types';

export class StripeIdealProvider implements IPaymentProvider {
  readonly providerId = 'stripe_ideal';
  readonly supportedCurrency = 'EUR';

  async createDepositIntent(params: PaymentIntentParams): Promise<PaymentIntentResult> {
    const feeMinor = Math.round(params.amountMinorUnits * 0.035); // 3.5% platform fee
    const totalMinor = params.amountMinorUnits + feeMinor;
    const id = `pi_nl_ideal_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    return {
      success: true,
      provider: this.providerId,
      paymentIntentId: id,
      clientSecret: `${id}_secret_nl_test`,
      currency: this.supportedCurrency,
      amountMinorUnits: params.amountMinorUnits,
      feeMinorUnits: feeMinor,
      totalMinorUnits: totalMinor,
      status: 'requires_action',
    };
  }

  async processDisbursement(params: PayoutDisbursementParams): Promise<PayoutDisbursementResult> {
    const transferId = `tr_sepa_instant_nl_${Date.now()}`;
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
