// How the payout fee is split, by who hosts the pod.
//
// Every payout carries the same total fee (FEES.payoutFeeRate, 10% of the pot).
//   - Member-created pod: 3% of the pot goes to the host (the final-slot
//     holder) when they qualify, and MutualPool keeps the other 7%.
//   - MutualPool-hosted pod: there is no member host, so MutualPool keeps the
//     whole 10%. Members pay exactly what they pay in any other pod.
// The split is recorded with each payout so later rate changes never rewrite
// history.

import { FEES } from '../lib/legal';

export type PodHostType = 'USER' | 'MUTUALPOOL';

export const MUTUALPOOL_HOST_ID = 'mutualpool';
export const MUTUALPOOL_HOST_NAME = 'MutualPool';

export function hostTypeOf(pod: { hostType?: PodHostType } | null | undefined): PodHostType {
  return pod?.hostType === 'MUTUALPOOL' ? 'MUTUALPOOL' : 'USER';
}

// MutualPool's share of the pot when the host reward is paid.
export function platformFeeRateFor(hostType: PodHostType): number {
  return hostType === 'MUTUALPOOL'
    ? FEES.payoutFeeRate
    : Math.round((FEES.payoutFeeRate - FEES.hostRewardRate) * 10000) / 10000;
}

export interface PayoutFeeSplit {
  hostType: PodHostType;
  grossUsd: number;
  totalFeeRate: number;
  totalFeeUsd: number;
  hostRewardRate: number;
  hostRewardUsd: number;
  platformFeeRate: number;
  platformFeeUsd: number;
  netPayoutUsd: number;
}

const cents = (usd: number) => Math.round(usd * 100);

// `hostRewardApplies`: a member host exists and qualifies for the reward this
// week. Ignored for MutualPool-hosted pods, which never pay one.
export function payoutFeeSplit(input: { grossUsd: number; hostType: PodHostType; hostRewardApplies: boolean }): PayoutFeeSplit {
  const grossCents = Math.max(0, cents(input.grossUsd));
  const totalFeeCents = Math.round(grossCents * FEES.payoutFeeRate);
  const paysHost = input.hostType === 'USER' && input.hostRewardApplies;
  const hostRewardCents = paysHost ? Math.min(totalFeeCents, Math.round(grossCents * FEES.hostRewardRate)) : 0;
  const platformFeeCents = totalFeeCents - hostRewardCents;
  const hostRewardRate = paysHost ? FEES.hostRewardRate : 0;
  return {
    hostType: input.hostType,
    grossUsd: grossCents / 100,
    totalFeeRate: FEES.payoutFeeRate,
    totalFeeUsd: totalFeeCents / 100,
    hostRewardRate,
    hostRewardUsd: hostRewardCents / 100,
    platformFeeRate: Math.round((FEES.payoutFeeRate - hostRewardRate) * 10000) / 10000,
    platformFeeUsd: platformFeeCents / 100,
    netPayoutUsd: (grossCents - totalFeeCents) / 100,
  };
}
