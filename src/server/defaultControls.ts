// What happens after a member misses a deposit, beyond recording the default:
//
//   1. The member and every other member of the pod are told at once (in-app
//      and by email). Pods police themselves only when everyone can see.
//   2. If nothing has been paid DEFAULT_REMOVAL_GRACE_MS later, the member is
//      removed from the pod, their account is restricted (no creating or
//      joining pods, no swaps, votes or hardship requests) and ACH collection
//      starts under their bank debit authorization.
//   3. Paying every default in full restores the account automatically.
//   4. When a second member of the same pod is in default, that member is told
//      and a pause vote opens: the members not in default choose to PAUSE the
//      pod or to COVER the missing deposits between them each week.
//
// Pure helpers live here (shared with the unit tests); the server wires them to
// its state. No I/O.

import type { DepositDefault, Pod, PodPauseVote, PodPauseVoteChoice, PodReplacementVote, PodReplacementVoteChoice } from '../types';

const env: Record<string, string | undefined> = typeof process !== 'undefined' && process.env ? process.env : {};
const hours = (name: string, fallback: number): number => {
  const n = Number(env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Time a member has to settle after the default notice before removal.
export const DEFAULT_REMOVAL_GRACE_MS = hours('DEFAULT_REMOVAL_GRACE_HOURS', 24) * 60 * 60 * 1000;
// How long a pause vote stays open before it resolves on the votes cast.
export const PAUSE_VOTE_WINDOW_MS = hours('POD_PAUSE_VOTE_HOURS', 48) * 60 * 60 * 1000;
// Distinct members in unsettled default that trigger the pause vote (the vote
// itself is what decides; this only opens it). Env: POD_PAUSE_VOTE_DEFAULTERS.
export const PAUSE_VOTE_DEFAULTERS = Math.max(2, Math.floor(Number(env.POD_PAUSE_VOTE_DEFAULTERS)) || 2);

export function isUnsettled(d: DepositDefault): boolean {
  return d.status === 'OPEN' || d.status === 'COLLECTING';
}

// Members of this pod with an unsettled default (removed members still count:
// their account is unsettled until they pay).
export function defaultingUserIds(podId: string, defaults: readonly DepositDefault[]): string[] {
  return Array.from(new Set(defaults.filter(d => d.podId === podId && isUnsettled(d)).map(d => d.userId)));
}

export function hasUnsettledDefault(userId: string, defaults: readonly DepositDefault[]): boolean {
  return defaults.some(d => d.userId === userId && isUnsettled(d));
}

// Who may vote: active members of the pod who are not themselves in default.
export function eligibleVoterIds(pod: Pod, defaulters: readonly string[]): string[] {
  const bad = new Set(defaulters);
  return pod.members.filter(m => m && m.userId && !bad.has(m.userId)).map(m => m.userId);
}

export function buildPauseVote(input: {
  id: string;
  pod: Pod;
  defaults: readonly DepositDefault[];
  now: Date;
}): PodPauseVote {
  const defaulters = defaultingUserIds(input.pod.id, input.defaults);
  return {
    id: input.id,
    openedAt: input.now.toISOString(),
    closesAt: new Date(input.now.getTime() + PAUSE_VOTE_WINDOW_MS).toISOString(),
    defaultIds: input.defaults.filter(d => d.podId === input.pod.id && isUnsettled(d)).map(d => d.id),
    defaulterUserIds: defaulters,
    eligibleVoterIds: eligibleVoterIds(input.pod, defaulters),
    votes: {},
    status: 'OPEN',
  };
}

export function tallyPauseVote(vote: PodPauseVote): { pause: number; cover: number; cast: number; eligible: number } {
  let pause = 0;
  let cover = 0;
  for (const id of vote.eligibleVoterIds) {
    const v = vote.votes[id];
    if (v === 'PAUSE') pause += 1;
    else if (v === 'COVER') cover += 1;
  }
  return { pause, cover, cast: pause + cover, eligible: vote.eligibleVoterIds.length };
}

// The outcome once the vote can be decided, or null while it is still open.
// It decides as soon as one side has a majority of the eligible voters, when
// everyone has voted, or when the window closes. Ties and silence resolve to
// PAUSE: continuing a pod with two unsettled defaults is the riskier default.
export function resolvePauseVote(vote: PodPauseVote, now: Date): PodPauseVoteChoice | null {
  if (vote.status !== 'OPEN') return vote.outcome ?? null;
  const { pause, cover, cast, eligible } = tallyPauseVote(vote);
  const majority = Math.floor(eligible / 2) + 1;
  if (eligible === 0) return 'PAUSE';
  if (pause >= majority) return 'PAUSE';
  if (cover >= majority) return 'COVER';
  const closed = now.getTime() >= new Date(vote.closesAt).getTime();
  if (cast >= eligible || closed) return cover > pause ? 'COVER' : 'PAUSE';
  return null;
}

// After a removal: should the pod be listed publicly to fill the slot? Open to
// the remaining members not in default. Majority decides at once; otherwise
// everyone voting or the window closing decides, and ties or silence KEEP the
// pod private (nobody's pod is exposed to strangers without a majority).
export function buildReplacementVote(input: {
  id: string;
  pod: Pod;
  defaults: readonly DepositDefault[];
  removedUserId: string;
  removedUserName: string;
  now: Date;
}): PodReplacementVote {
  const defaulters = defaultingUserIds(input.pod.id, input.defaults);
  return {
    id: input.id,
    openedAt: input.now.toISOString(),
    closesAt: new Date(input.now.getTime() + PAUSE_VOTE_WINDOW_MS).toISOString(),
    removedUserId: input.removedUserId,
    removedUserName: input.removedUserName,
    eligibleVoterIds: eligibleVoterIds(input.pod, defaulters).filter(id => id !== input.removedUserId),
    votes: {},
    status: 'OPEN',
  };
}

export function tallyReplacementVote(vote: PodReplacementVote): { open: number; keep: number; cast: number; eligible: number } {
  let open = 0;
  let keep = 0;
  for (const id of vote.eligibleVoterIds) {
    const v = vote.votes[id];
    if (v === 'OPEN') open += 1;
    else if (v === 'KEEP') keep += 1;
  }
  return { open, keep, cast: open + keep, eligible: vote.eligibleVoterIds.length };
}

export function resolveReplacementVote(vote: PodReplacementVote, now: Date): PodReplacementVoteChoice | null {
  if (vote.status !== 'OPEN') return vote.outcome ?? null;
  const { open, keep, cast, eligible } = tallyReplacementVote(vote);
  if (eligible === 0) return 'KEEP';
  const majority = Math.floor(eligible / 2) + 1;
  if (open >= majority) return 'OPEN';
  if (keep >= majority) return 'KEEP';
  const closed = now.getTime() >= new Date(vote.closesAt).getTime();
  if (cast >= eligible || closed) return open > keep ? 'OPEN' : 'KEEP';
  return null;
}

// Each covering member's share of a week's missing deposits, in whole cents.
export function coverShareUsd(shortfallUsd: number, coveringCount: number): number {
  if (coveringCount <= 0 || shortfallUsd <= 0) return 0;
  return Math.ceil((shortfallUsd / coveringCount) * 100) / 100;
}

export function removalDue(d: DepositDefault, now: Date): boolean {
  return Boolean(d.removalDueAt) && !d.autoRemovedAt && isUnsettled(d) && now.getTime() >= new Date(d.removalDueAt as string).getTime();
}
