// Creator Pools: rules shared by the server and the unit tests. See
// CREATOR_POOLS_SPEC.md for the product decisions behind each one.
//
// A creator opens a pool with one permanent link. Followers who finish every
// joining step are seated into pods of 20; a new pod is created when one fills
// and each pod starts on its own when full. The creator earns 3% of every
// weekly pot. Pure functions only: no I/O, no server state.

import type { CreatorPool, CreatorProfile, CreatorSocialAccount, DepositTier, HeldSlot, Pod } from '../types';

const env: Record<string, string | undefined> = typeof process !== 'undefined' && process.env ? process.env : {};
const num = (name: string, fallback: number): number => {
  const n = Number(env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const CREATOR_POD_SIZE = 20;
export const CREATOR_MIN_FOLLOWERS = num('CREATOR_MIN_FOLLOWERS', 1000);
// A creator's first pool keeps pots at or under $1,200; later pools may go to
// $100 a week but only accept followers with a completed pod.
export const CREATOR_FIRST_POOL_DEPOSITS: readonly DepositTier[] = [10, 20, 30, 40, 50, 60];
export const CREATOR_LATER_POOL_DEPOSITS: readonly DepositTier[] = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
export const CREATOR_COMPLETED_ONLY_MIN_DEPOSIT = 70;
export const CREATOR_ENROLLMENT_DAYS = num('CREATOR_ENROLLMENT_DAYS', 56); // 8 weeks
export const CREATOR_STALL_DAYS = num('CREATOR_STALL_DAYS', 14);
// Pilot: followers seated per pool before enrollment closes on its own.
export const CREATOR_POOL_FOLLOWER_CAP = num('CREATOR_POOL_FOLLOWER_CAP', 5000);
// Follower counts must have been read from the platforms recently to open a pool.
export const CREATOR_FOLLOWER_REFRESH_DAYS = num('CREATOR_FOLLOWER_REFRESH_DAYS', 30);
export const FOLLOWER_POD_LIMIT_NEW = 1;
export const FOLLOWER_POD_LIMIT_COMPLETED = 3;
export const FIRST_PAYOUT_HOLD_BUSINESS_DAYS = 3;
export const CREATOR_TERMS_VERSION = 'creator-terms-2026-11';
export const CREATOR_POOL_AGREEMENT_VERSION = 'creator-pool-agreement-2026-11';

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Creators
// ---------------------------------------------------------------------------

export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;
const RESERVED_HANDLES = new Set(['admin', 'api', 'app', 'creators', 'creator', 'mutualpool', 'support', 'help', 'login', 'join', 'pods', 'partners', 'about']);

export function normalizeHandle(raw: unknown): string {
  return String(raw ?? '').trim().replace(/^@/, '').toLowerCase();
}

export function handleProblem(handle: string): string | null {
  if (!HANDLE_PATTERN.test(handle)) return 'Use 3 to 30 lowercase letters, numbers or underscores.';
  if (RESERVED_HANDLES.has(handle)) return 'That link name is reserved.';
  return null;
}

export function totalFollowers(accounts: readonly CreatorSocialAccount[]): number {
  return accounts.reduce((sum, a) => sum + Math.max(0, Math.floor(Number(a.followers) || 0)), 0);
}

export function followerCountsFresh(accounts: readonly CreatorSocialAccount[], now: Date): boolean {
  if (accounts.length === 0) return false;
  const newest = Math.max(...accounts.map(a => new Date(a.refreshedAt).getTime() || 0));
  return now.getTime() - newest <= CREATOR_FOLLOWER_REFRESH_DAYS * DAY_MS;
}

export interface CreatorReadiness {
  followers: boolean;
  identity: boolean;
  bank: boolean;
  terms: boolean;
}

export function creatorReadiness(input: {
  accounts: readonly CreatorSocialAccount[];
  kycVerified: boolean;
  hasDebitMandate: boolean;
  termsAcceptedVersion?: string;
}): CreatorReadiness {
  return {
    followers: totalFollowers(input.accounts) >= CREATOR_MIN_FOLLOWERS,
    identity: input.kycVerified,
    bank: input.hasDebitMandate,
    terms: input.termsAcceptedVersion === CREATOR_TERMS_VERSION,
  };
}

export function isCreatorReady(r: CreatorReadiness): boolean {
  return r.followers && r.identity && r.bank && r.terms;
}

// ---------------------------------------------------------------------------
// Pools
// ---------------------------------------------------------------------------

export function allowedDeposits(isFirstPool: boolean): readonly DepositTier[] {
  return isFirstPool ? CREATOR_FIRST_POOL_DEPOSITS : CREATOR_LATER_POOL_DEPOSITS;
}

export function completedMembersOnly(depositTier: number): boolean {
  return depositTier >= CREATOR_COMPLETED_ONLY_MIN_DEPOSIT;
}

export function enrollmentEndsAt(openedAt: Date): Date {
  return new Date(openedAt.getTime() + CREATOR_ENROLLMENT_DAYS * DAY_MS);
}

// Why the pool can't take another follower right now, or null.
export function poolClosedReason(pool: CreatorPool, now: Date): 'NOT_OPEN' | 'ENROLLMENT_PERIOD_ENDED' | 'FOLLOWER_CAP' | null {
  if (pool.status !== 'OPEN') return 'NOT_OPEN';
  if (now.getTime() >= new Date(pool.enrollmentEndsAt).getTime()) return 'ENROLLMENT_PERIOD_ENDED';
  if (pool.seatedCount >= pool.followerCap) return 'FOLLOWER_CAP';
  return null;
}

// ---------------------------------------------------------------------------
// Followers
// ---------------------------------------------------------------------------

export function followerPodLimit(cleanCompletedPods: number): number {
  return cleanCompletedPods >= 1 ? FOLLOWER_POD_LIMIT_COMPLETED : FOLLOWER_POD_LIMIT_NEW;
}

// Creator-pool pods the member is in right now (forming or running). The
// creator's own seat in Pod 1 of their pool does not count.
export function activeCreatorPodCount(pods: readonly Pod[], userId: string): number {
  return pods.filter(p =>
    p && p.creatorPoolId && p.status !== 'COMPLETED'
    && p.creatorId !== userId
    && (p.members || []).some(m => m && m.userId === userId),
  ).length;
}

// ---------------------------------------------------------------------------
// Seating
// ---------------------------------------------------------------------------

export type SeatChoice =
  | { kind: 'HELD'; pod: Pod; slot: HeldSlot }
  | { kind: 'FORMING'; pod: Pod }
  | { kind: 'NEW_POD' };

// Where the next follower sits: a held slot in a running pod first (earliest
// payout week first), then the pool's forming pod, else a new pod. Pods the
// follower is already in are skipped.
export function chooseSeat(poolPods: readonly Pod[], userId: string): SeatChoice {
  const notIn = (p: Pod) => !(p.members || []).some(m => m && m.userId === userId);
  const held = poolPods
    .filter(p => p.status === 'ACTIVE' && notIn(p) && (p.heldSlots || []).length > 0)
    .flatMap(p => (p.heldSlots || []).map(slot => ({ pod: p, slot })))
    .sort((a, b) => a.slot.rotationIndex - b.slot.rotationIndex);
  if (held.length > 0) return { kind: 'HELD', pod: held[0].pod, slot: held[0].slot };
  const forming = poolPods
    .filter(p => p.status === 'FORMING' && notIn(p) && (p.members || []).length < CREATOR_POD_SIZE)
    .sort((a, b) => (a.poolSequence || 0) - (b.poolSequence || 0));
  if (forming.length > 0) return { kind: 'FORMING', pod: forming[0] };
  return { kind: 'NEW_POD' };
}

// ---------------------------------------------------------------------------
// Held slots (members removed before being paid)
// ---------------------------------------------------------------------------

// Slot i pays out in week i + 1. A slot is held for a new follower until the
// week before its payout; from then on it is deleted instead.
export function canHoldSlot(currentCycleWeek: number, rotationIndex: number): boolean {
  return currentCycleWeek < rotationIndex;
}

export function heldSlotReleaseDue(currentCycleWeek: number, slot: HeldSlot): boolean {
  return !canHoldSlot(currentCycleWeek, slot.rotationIndex);
}

// Delete an empty slot: everyone after it moves up a week and the pod ends a
// week earlier. Mutates the pod.
export function collapseSlot(pod: Pod, rotationIndex: number): void {
  for (const m of pod.members || []) {
    if (m && m.rotationIndex > rotationIndex) m.rotationIndex -= 1;
  }
  pod.heldSlots = (pod.heldSlots || [])
    .filter(s => s.rotationIndex !== rotationIndex)
    .map(s => (s.rotationIndex > rotationIndex ? { ...s, rotationIndex: s.rotationIndex - 1 } : s));
  pod.totalCycles = Math.max(0, (pod.totalCycles || 0) - 1);
}

// ---------------------------------------------------------------------------
// Pods that stop filling
// ---------------------------------------------------------------------------

export function isStalled(pod: Pod, pool: Pick<CreatorPool, 'status'>, now: Date): boolean {
  if (pod.status !== 'FORMING' || (pod.members || []).length >= CREATOR_POD_SIZE) return false;
  if (pool.status !== 'OPEN') return true;
  const last = new Date(pod.lastJoinAt || pod.createdAt).getTime();
  return now.getTime() - last >= CREATOR_STALL_DAYS * DAY_MS;
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) added += 1;
  }
  return d;
}

// The part of a balance that can't be withdrawn yet.
export function heldBalanceUsd(input: {
  payoutHolds?: { amountUsd: number; releaseAt: string }[];
  now: Date;
  creatorEarningsUsd?: number;
  hasTaxForm: boolean;
}): number {
  const holds = (input.payoutHolds || [])
    .filter(h => new Date(h.releaseAt).getTime() > input.now.getTime())
    .reduce((s, h) => s + (Number(h.amountUsd) || 0), 0);
  const unreported = input.hasTaxForm ? 0 : Math.max(0, Number(input.creatorEarningsUsd) || 0);
  return Math.round((holds + unreported) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Withdrawal bank checks (creator-pool members and creators)
// ---------------------------------------------------------------------------

export const BANK_CHANGE_HOLD_HOURS = num('BANK_CHANGE_HOLD_HOURS', 72);

const nameTokens = (name: string): string[] =>
  name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s'-]/g, ' ')
    .split(/[\s'-]+/).filter(t => t.length > 0);

// The bank account holder looks like the verified person: same last name, and
// a first name or initial that matches. Tolerates middle names, initials and
// "Last, First" order; a joint account listing both names also passes.
export function namesLikelyMatch(legalName: string, holderName: string): boolean {
  const legal = nameTokens(legalName);
  const holder = nameTokens(holderName);
  if (legal.length < 2 || holder.length === 0) return false;
  const last = legal[legal.length - 1];
  const first = legal[0];
  if (!holder.includes(last)) return false;
  return holder.some(t => t !== last && (t === first || (t.length === 1 && t === first[0]) || (first.length === 1 && t[0] === first)));
}

export function bankAccountKey(routingNumber?: string, last4?: string): string {
  return `${routingNumber || '?'}:${last4 || '?'}`;
}

export type WithdrawalBankProblem =
  | { code: 'BANK_MISMATCH'; mandateLast4?: string; bankLast4?: string }
  | { code: 'BANK_RECENTLY_CHANGED'; availableAt: string }
  | { code: 'NAME_REVIEW'; legalName: string; holderName: string };

// Why money can't go to the linked bank yet, or null.
// 1. It must be the account that was authorized for debits (routing + last 4).
// 2. A bank that replaced an earlier one waits BANK_CHANGE_HOLD_HOURS
//    (protects against someone who took over the login changing the bank).
// 3. The account holder name given for the debit authorization must match the
//    verified legal name, or an admin must have confirmed it for this account.
export function withdrawalBankProblem(input: {
  mandate?: { last4?: string; routingNumber?: string; accountHolderName?: string };
  bank?: { last4?: string; routingNumber?: string; changedAt?: string };
  legalName?: string;
  nameReviewedFor?: string;
  now: Date;
}): WithdrawalBankProblem | null {
  const m = input.mandate || {};
  const b = input.bank || {};
  if (m.last4 && b.last4 && m.last4 !== b.last4) return { code: 'BANK_MISMATCH', mandateLast4: m.last4, bankLast4: b.last4 };
  if (m.routingNumber && b.routingNumber && m.routingNumber !== b.routingNumber) return { code: 'BANK_MISMATCH', mandateLast4: m.last4, bankLast4: b.last4 };
  if (b.changedAt) {
    const until = new Date(b.changedAt).getTime() + BANK_CHANGE_HOLD_HOURS * 3_600_000;
    if (until > input.now.getTime()) return { code: 'BANK_RECENTLY_CHANGED', availableAt: new Date(until).toISOString() };
  }
  if (input.legalName && m.accountHolderName && !namesLikelyMatch(input.legalName, m.accountHolderName)
    && input.nameReviewedFor !== bankAccountKey(m.routingNumber, m.last4)) {
    return { code: 'NAME_REVIEW', legalName: input.legalName, holderName: m.accountHolderName };
  }
  return null;
}

// Whether the creator should still be paid the 3% for a pod.
export function creatorEarnsCommission(profile: Pick<CreatorProfile, 'status'> | undefined, creatorExists: boolean): boolean {
  return Boolean(profile && creatorExists && profile.status === 'APPROVED');
}

// ---------------------------------------------------------------------------
// Join queue during surges
// ---------------------------------------------------------------------------

// Admits joins at a steady rate per pool. A request over the rate gets a
// numbered ticket and waits its turn; retrying with the ticket keeps its place.
export class JoinQueue {
  private nextTicket = 1;
  private served = 0;
  private lastRefill: number;
  constructor(private ratePerMinute: number, now = Date.now()) {
    this.lastRefill = now;
    // A burst of one minute's worth is admitted straight away.
    this.served = ratePerMinute;
  }
  private refill(now: number) {
    const elapsed = Math.max(0, now - this.lastRefill);
    const add = Math.floor((elapsed / 60_000) * this.ratePerMinute);
    if (add > 0) {
      this.served = Math.min(this.nextTicket - 1 + this.ratePerMinute, this.served + add);
      this.lastRefill = now;
    }
  }
  // Returns null when the request may proceed now, else its ticket and place.
  admit(ticket: number | undefined, now = Date.now()): { ticket: number; position: number } | null {
    this.refill(now);
    if (ticket && ticket > 0 && ticket < this.nextTicket) {
      return ticket <= this.served ? null : { ticket, position: ticket - this.served };
    }
    const t = this.nextTicket++;
    if (t <= this.served) return null;
    return { ticket: t, position: t - this.served };
  }
}

// ---------------------------------------------------------------------------
// The agreement a follower signs when taking a seat. Served to the join page
// and hashed into the member's authorization evidence, so what was shown is
// exactly what was signed.
// ---------------------------------------------------------------------------
export function creatorPoolAgreementText(input: { creatorName: string; depositTier: number }): string {
  const deposit = `$${input.depositTier.toFixed(2)}`;
  const buffer = `$${(input.depositTier * 0.05).toFixed(2)}`;
  return [
    `MutualPool Creator Pool Agreement (${CREATOR_POOL_AGREEMENT_VERSION})`,
    '',
    `1. I join a savings pod of up to ${CREATOR_POD_SIZE} members hosted by ${input.creatorName}. Each member deposits ${deposit} every week, and each week one member receives the pot.`,
    `2. My first deposit (${deposit} plus a ${buffer} buffer contribution) is taken from my MutualPool balance when I take my seat. After that, ${deposit} plus ${buffer} is taken every Thursday until the pod ends.`,
    "3. 5% of each deposit goes into the pod's buffer, which covers missed deposits. What is not used is refunded to members when the pod ends.",
    '4. The pod starts when it is full. The payout order is drawn when it starts: members with a completed pod first, then members with gig earnings arriving by direct deposit, then members with 90+ days on MutualPool, then everyone else. Order within each group is random.',
    `5. Each payout is the week's pot minus a 10% fee: 3% of the pot goes to ${input.creatorName} for hosting and 7% to MutualPool. ${input.creatorName} does not take a payout slot unless they joined the pod as a member.`,
    '6. If I miss a deposit I have 24 hours to pay. After that I am removed from the pod, my account is restricted until I have paid in full, and what I owe, including deposits still due after I received a payout, is collected from my bank under the authorization below.',
    '7. I authorize MutualPool to debit my linked bank account for missed deposits and for amounts I owe under this agreement.',
    `8. If this is my first payout and I have no completed pod or direct deposit, the payout reaches my MutualPool balance on time but can be withdrawn only after ${FIRST_PAYOUT_HOLD_BUSINESS_DAYS} business days.`,
    '9. Withdrawals go only to the bank account I authorized for debits.',
    '10. I can swap payout weeks with another member if they agree.',
  ].join('\n');
}
