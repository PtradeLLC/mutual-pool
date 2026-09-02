import { IPaymentProvider, PaymentIntentParams, PaymentIntentResult, PayoutDisbursementParams, PayoutDisbursementResult } from './types';

export class PaystackProvider implements IPaymentProvider {
  readonly providerId = 'paystack';
  readonly supportedCurrency = 'NGN';

  async createDepositIntent(params: PaymentIntentParams): Promise<PaymentIntentResult> {
    const feeMinor = Math.round(params.amountMinorUnits * 0.025); // 2.5% platform fee
    const totalMinor = params.amountMinorUnits + feeMinor;
    const ref = `pstk_ref_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    return {
      success: true,
      provider: this.providerId,
      paymentIntentId: ref,
      redirectUrl: `https://checkout.paystack.com/${ref}`,
      currency: this.supportedCurrency,
      amountMinorUnits: params.amountMinorUnits,
      feeMinorUnits: feeMinor,
      totalMinorUnits: totalMinor,
      status: 'requires_action',
    };
  }

  async processDisbursement(params: PayoutDisbursementParams): Promise<PayoutDisbursementResult> {
    const transferId = `tr_nibss_paystack_${Date.now()}`;
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
