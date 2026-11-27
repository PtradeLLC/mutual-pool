// Amounts for one weekly contribution moved over Dwolla (member's bank -> that
// week's recipient's Dwolla Balance).
//
//   payer is debited    deposit + reserve fee      e.g. $20 + $1.00 = $21.00
//   recipient receives  deposit - platform fee     e.g. $20 - $2.00 = $18.00
//   MutualPool receives reserve fee + platform fee e.g. $1.00 + $2.00 = $3.00
//
// The reserve fee (5% of the deposit) is non-refundable and funds a
// MutualPool-owned reserve that covers missed or reversed contributions. The
// platform fee is the 10% payout fee, taken from each contribution as it lands.
// Dwolla requires every fee on a transfer to be charged to the same party, so
// both fee lines are charged to the recipient's side of the transfer; the payer
// still pays the reserve fee because it is added to the debit.

import { FEES } from './legal';

export interface ContributionAmounts {
  depositUsd: number;
  reserveFeeUsd: number;
  platformFeeUsd: number;
  /** Debited from the payer's bank. */
  debitUsd: number;
  /** Credited to the recipient's Dwolla Balance. */
  recipientNetUsd: number;
  /** Credited to MutualPool's Dwolla account. */
  mutualPoolUsd: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;

export function contributionAmounts(depositUsd: number): ContributionAmounts {
  if (!Number.isFinite(depositUsd) || depositUsd <= 0) throw new Error('Deposit must be a positive amount.');
  const deposit = cents(depositUsd);
  const reserveFeeUsd = cents(deposit * FEES.depositFeeRate);
  const platformFeeUsd = cents(deposit * FEES.payoutFeeRate);
  return {
    depositUsd: deposit,
    reserveFeeUsd,
    platformFeeUsd,
    debitUsd: cents(deposit + reserveFeeUsd),
    recipientNetUsd: cents(deposit - platformFeeUsd),
    mutualPoolUsd: cents(reserveFeeUsd + platformFeeUsd),
  };
}
