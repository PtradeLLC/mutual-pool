export interface PaymentIntentParams {
  amountMinorUnits: number;
  currency: string;
  userId: string;
  userEmail?: string;
  podId?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  success: boolean;
  provider: string;
  paymentIntentId: string;
  clientSecret?: string;
  redirectUrl?: string;
  currency: string;
  amountMinorUnits: number;
  feeMinorUnits: number;
  totalMinorUnits: number;
  status: 'requires_action' | 'processing' | 'succeeded' | 'failed';
  error?: string;
}

export interface PayoutDisbursementParams {
  amountMinorUnits: number;
  currency: string;
  destinationAccountId: string;
  destinationBankRouting?: string;
  userId: string;
  narration: string;
}

export interface PayoutDisbursementResult {
  success: boolean;
  provider: string;
  transferId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  remainingBalanceMinorUnits?: number;
  error?: string;
}

export interface IPaymentProvider {
  readonly providerId: string;
  readonly supportedCurrency: string;

  createDepositIntent(params: PaymentIntentParams): Promise<PaymentIntentResult>;
  processDisbursement(params: PayoutDisbursementParams): Promise<PayoutDisbursementResult>;
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean;
}
