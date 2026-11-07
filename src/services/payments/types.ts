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
  // Stripe: the member's Connect account (acct_...). Paystack: the bank account
  // number, or the M-Pesa phone number in Kenya.
  destinationAccountId: string;
  // Paystack bank code (e.g. "058" in Nigeria, "MPESA" in Kenya).
  destinationBankRouting?: string;
  // Name on the destination account (Paystack requires it).
  accountName?: string;
  userId: string;
  narration: string;
  // Stable id for this payout (e.g. the withdrawal id), so a retry never pays twice.
  reference?: string;
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
