// Rules that limit the payout-then-default attack: a member who takes an early
// pot and stops depositing walks away with the whole pot for a single deposit.
//
// Two rules, sharing one line ($1,000, NEW_MEMBER_POT_CAP_USD):
//
// 1. Join cap ladder. How big a pot a member may join grows with the pods they
//    have completed cleanly (no default on record): $1,000 before the first,
//    then $2,500, $5,000, and no cap from the third.
//
// 2. Early slots by trust. The first half of a rotation goes to the most
//    trusted members: completed pods first, then 90+ days of tenure, then new
//    members who have authorized bank debits. Random within a tier, creator
//    last. Small pots (at or under the line) always lock. Larger pots refuse to
//    lock until the early slots can all be held by seasoned members.
//
// Pure functions, shared by the lock / join / swap / reprioritization routes
// and the unit tests. No I/O, no server state.

export const NEW_MEMBER_POT_CAP_USD = 1000;
// Largest pot a member may join, by clean completed pods. Beyond the last
// entry there is no cap.
export const POT_CAP_LADDER_USD: readonly number[] = [1000, 2500, 5000];

export function potCapUsd(cleanCompletedPods: number): number {
  const n = Math.max(0, Math.floor(cleanCompletedPods));
  return n < POT_CAP_LADDER_USD.length ? POT_CAP_LADDER_USD[n] : Infinity;
}

// Trust tiers, highest first. "Seasoned" = COMPLETED_POD or TENURED.
export const TRUST = {
  COMPLETED_POD: 3,
  TENURED: 2,
  NEW_WITH_MANDATE: 1,
  NEW: 0,
} as const;
export type TrustTier = (typeof TRUST)[keyof typeof TRUST];
export type TrustLabel = keyof typeof TRUST;

export interface TrustInput {
  cleanCompletedPods: number;
  accountAgeDays: number;
  hasDebitMandate: boolean;
}

export function trustTier(input: TrustInput, tenureDays: number): TrustTier {
  if (input.cleanCompletedPods >= 1) return TRUST.COMPLETED_POD;
  if (input.accountAgeDays >= tenureDays) return TRUST.TENURED;
  return input.hasDebitMandate ? TRUST.NEW_WITH_MANDATE : TRUST.NEW;
}

export function trustLabel(tier: number): TrustLabel {
  return (Object.keys(TRUST) as TrustLabel[]).find(k => TRUST[k] === tier) || 'NEW';
}

export function isSeasonedTier(tier: number): boolean {
  return tier >= TRUST.TENURED;
}

// The first half of the rotation (rounded down) is "early". A 2-member pod has
// one early slot; a 20-member pod has ten.
export function earlySlotCount(memberCount: number): number {
  return Math.floor(Math.max(0, memberCount) / 2);
}

// Pots above the line need seasoned members in every early slot.
export function earlySlotsNeedSeasoned(potUsd: number): boolean {
  return potUsd > NEW_MEMBER_POT_CAP_USD;
}

export interface RotationCandidate {
  userId: string;
  trust: number;
}

export interface RotationPlan {
  // Non-creator user ids in rotation order (slot 0 first).
  order: string[];
  earlyCount: number;
  // Early-slot holders who are not seasoned (only possible in small pots).
  unseasonedEarly: string[];
}

export interface RotationShortage {
  error: 'TENURE_SLOTS_UNFILLED';
  earlyCount: number;
  seasonedCount: number;
  shortfall: number;
}

function shuffle<T>(items: T[], randomInt: (n: number) => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Order the non-creator members: most trusted first, random within a tier.
// The creator is not a candidate: the caller appends them in the final slot.
// `totalMembers` includes the creator, because the early half is measured on
// the whole rotation; `potUsd` is the pot at lock (members × deposit).
export function planRotation(
  candidates: RotationCandidate[],
  opts: { totalMembers: number; potUsd: number; randomInt: (n: number) => number },
): RotationPlan | RotationShortage {
  const earlyCount = earlySlotCount(opts.totalMembers);
  const tiers = Array.from(new Set(candidates.map(c => c.trust))).sort((a, b) => b - a);
  const order: RotationCandidate[] = [];
  for (const tier of tiers) {
    order.push(...shuffle(candidates.filter(c => c.trust === tier), opts.randomInt));
  }

  const seasonedCount = candidates.filter(c => isSeasonedTier(c.trust)).length;
  if (earlySlotsNeedSeasoned(opts.potUsd) && seasonedCount < earlyCount) {
    return { error: 'TENURE_SLOTS_UNFILLED', earlyCount, seasonedCount, shortfall: earlyCount - seasonedCount };
  }

  return {
    order: order.map(c => c.userId),
    earlyCount,
    unseasonedEarly: order.slice(0, earlyCount).filter(c => !isSeasonedTier(c.trust)).map(c => c.userId),
  };
}

export interface SlotHolder {
  userId: string;
  displayName: string;
  rotationIndex: number;
  trust: number;
}

export type EarlySlotViolation =
  | { member: SlotHolder; earlyCount: number; reason: 'LESS_TRUSTED_AHEAD'; behind: SlotHolder }
  | { member: SlotHolder; earlyCount: number; reason: 'LARGE_POT_NEEDS_SEASONED' };

// The invariant every swap or vote must keep: in the early half, nobody sits
// ahead of a more trusted member, and in large pots every early slot is
// seasoned. Returns the member who would break it, or null.
export function findEarlySlotViolation(members: SlotHolder[], potUsd: number): EarlySlotViolation | null {
  const earlyCount = earlySlotCount(members.length);
  const needSeasoned = earlySlotsNeedSeasoned(potUsd);
  for (const m of [...members].sort((a, b) => a.rotationIndex - b.rotationIndex)) {
    if (m.rotationIndex >= earlyCount) break;
    if (needSeasoned && !isSeasonedTier(m.trust)) {
      return { member: m, earlyCount, reason: 'LARGE_POT_NEEDS_SEASONED' };
    }
    const behind = members.find(other => other.trust > m.trust && other.rotationIndex > m.rotationIndex);
    if (behind) return { member: m, earlyCount, reason: 'LESS_TRUSTED_AHEAD', behind };
  }
  return null;
}
