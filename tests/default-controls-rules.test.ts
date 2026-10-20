// Pure rules behind the default controls (src/server/defaultControls.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_REMOVAL_GRACE_MS,
  PAUSE_VOTE_WINDOW_MS,
  buildPauseVote,
  coverShareUsd,
  defaultingUserIds,
  removalDue,
  resolvePauseVote,
  tallyPauseVote,
  buildReplacementVote,
  resolveReplacementVote,
  tallyReplacementVote,
} from '../src/server/defaultControls';
import type { DepositDefault, Pod, PodPauseVote } from '../src/types';

const now = new Date('2026-10-22T12:00:00Z');

function dflt(over: Partial<DepositDefault>): DepositDefault {
  return {
    id: 'dflt_x', podId: 'pod_1', podName: 'Pod', userId: 'u_x', userName: 'X', cycleWeek: 2, depositTierUsd: 20,
    trigger: 'THURSDAY_SWEEP', bufferCoveredUsd: 0, escrowCoveredUsd: 0, potShortfallUsd: 20, remainingObligationUsd: 0,
    owedUsd: 20, recoveredUsd: 0, reserveUsd: 0, recoveries: [], status: 'OPEN', memberRemoved: false, payoutReceivedUsd: 0,
    createdAt: now.toISOString(), updatedAt: now.toISOString(), ...over,
  };
}
function pod(memberIds: string[]): Pod {
  return {
    id: 'pod_1', name: 'Pod', description: '', category: '', podType: 'TRUSTED_CIRCLE', inviteWindowDays: 7, autoOpenOnExpire: false,
    inviteCode: 'X', invitedContacts: [], sizeTier: 20, depositTier: 20, status: 'ACTIVE', currentCycleWeek: 2, totalCycles: 5,
    agreementVersion: '1', holdingFinAccountId: '', createdBy: memberIds[0], creatorName: 'C', createdAt: now.toISOString(),
    members: memberIds.map((id, i) => ({ id: `m_${id}`, podId: 'pod_1', userId: id, displayName: id, platform: 'DoorDash', rotationIndex: i, hasReceivedPayout: false, delinquencyStatus: 'CLEAN', joinedAt: now.toISOString() })),
    weeklyPoolTarget: 100, currentWeeklyCollected: 0,
  } as unknown as Pod;
}
function vote(eligible: string[], votes: Record<string, 'PAUSE' | 'COVER'>, openedAt = now): PodPauseVote {
  return {
    id: 'v', openedAt: openedAt.toISOString(), closesAt: new Date(openedAt.getTime() + PAUSE_VOTE_WINDOW_MS).toISOString(),
    defaultIds: [], defaulterUserIds: [], eligibleVoterIds: eligible, votes, status: 'OPEN',
  };
}

test('defaulting members are counted per pod across open and collecting defaults, removed or not', () => {
  const defaults = [
    dflt({ id: '1', userId: 'a' }),
    dflt({ id: '2', userId: 'a', cycleWeek: 3 }),
    dflt({ id: '3', userId: 'b', status: 'COLLECTING', memberRemoved: true }),
    dflt({ id: '4', userId: 'c', status: 'RECOVERED' }),
    dflt({ id: '5', userId: 'd', podId: 'pod_2' }),
  ];
  assert.deepEqual(defaultingUserIds('pod_1', defaults).sort(), ['a', 'b']);
});

test('a pause vote is open to active members who are not in default, with a window', () => {
  const defaults = [dflt({ userId: 'a' }), dflt({ id: '2', userId: 'b' })];
  const v = buildPauseVote({ id: 'v', pod: pod(['c', 'a', 'b', 'h']), defaults, now });
  assert.deepEqual(v.defaulterUserIds.sort(), ['a', 'b']);
  assert.deepEqual(v.eligibleVoterIds.sort(), ['c', 'h']);
  assert.equal(new Date(v.closesAt).getTime() - now.getTime(), PAUSE_VOTE_WINDOW_MS);
});

test('a majority decides at once; otherwise the vote waits for everyone or the window', () => {
  const later = new Date(now.getTime() + 60_000);
  assert.equal(resolvePauseVote(vote(['a', 'b', 'c'], { a: 'PAUSE' }), later), null);
  assert.equal(resolvePauseVote(vote(['a', 'b', 'c'], { a: 'PAUSE', b: 'PAUSE' }), later), 'PAUSE');
  assert.equal(resolvePauseVote(vote(['a', 'b', 'c'], { a: 'COVER', b: 'COVER' }), later), 'COVER');
  // All voted, split 2-1 for cover.
  assert.equal(resolvePauseVote(vote(['a', 'b', 'c'], { a: 'COVER', b: 'COVER', c: 'PAUSE' }), later), 'COVER');
  // All voted, tie: pause.
  assert.equal(resolvePauseVote(vote(['a', 'b'], { a: 'COVER', b: 'PAUSE' }), later), 'PAUSE');
  // Window closed with a single cover vote: cover wins; closed with nothing: pause.
  const closed = new Date(now.getTime() + PAUSE_VOTE_WINDOW_MS + 1);
  assert.equal(resolvePauseVote(vote(['a', 'b', 'c'], { a: 'COVER' }), closed), 'COVER');
  assert.equal(resolvePauseVote(vote(['a', 'b', 'c'], {}), closed), 'PAUSE');
  // Nobody eligible: pause.
  assert.equal(resolvePauseVote(vote([], {}), later), 'PAUSE');
  // Votes from non-eligible ids are ignored.
  assert.deepEqual(tallyPauseVote(vote(['a'], { a: 'PAUSE', z: 'COVER' })), { pause: 1, cover: 0, cast: 1, eligible: 1 });
});

test('a replacement vote needs a majority to list the pod publicly; ties and silence keep it private', () => {
  const later = new Date(now.getTime() + 60_000);
  const closed = new Date(now.getTime() + PAUSE_VOTE_WINDOW_MS + 1);
  const rv = (eligible: string[], votes: Record<string, 'OPEN' | 'KEEP'>) => ({
    id: 'r', openedAt: now.toISOString(), closesAt: new Date(now.getTime() + PAUSE_VOTE_WINDOW_MS).toISOString(),
    removedUserId: 'x', removedUserName: 'X', eligibleVoterIds: eligible, votes, status: 'OPEN' as const,
  });
  assert.equal(resolveReplacementVote(rv(['a', 'b', 'c'], { a: 'OPEN' }), later), null);
  assert.equal(resolveReplacementVote(rv(['a', 'b', 'c'], { a: 'OPEN', b: 'OPEN' }), later), 'OPEN');
  assert.equal(resolveReplacementVote(rv(['a', 'b', 'c'], { a: 'KEEP', b: 'KEEP' }), later), 'KEEP');
  assert.equal(resolveReplacementVote(rv(['a', 'b'], { a: 'OPEN', b: 'KEEP' }), later), 'KEEP', 'tie keeps it private');
  assert.equal(resolveReplacementVote(rv(['a', 'b', 'c'], { a: 'OPEN' }), closed), 'OPEN', 'closed with only open votes opens');
  assert.equal(resolveReplacementVote(rv(['a', 'b', 'c'], {}), closed), 'KEEP', 'silence keeps it private');
  const built = buildReplacementVote({ id: 'r', pod: pod(['c', 'a', 'h']), defaults: [dflt({ userId: 'a' })], removedUserId: 'a', removedUserName: 'A', now });
  assert.deepEqual(built.eligibleVoterIds.sort(), ['c', 'h']);
  assert.deepEqual(tallyReplacementVote({ ...built, votes: { c: 'OPEN', zz: 'KEEP' } }), { open: 1, keep: 0, cast: 1, eligible: 2 });
});

test('cover shares round up to whole cents and removal falls due after the grace window', () => {
  assert.equal(coverShareUsd(40, 3), 13.34);
  assert.equal(coverShareUsd(0, 3), 0);
  assert.equal(coverShareUsd(40, 0), 0);
  const due = new Date(now.getTime() + DEFAULT_REMOVAL_GRACE_MS);
  const d = dflt({ removalDueAt: due.toISOString() });
  assert.equal(removalDue(d, new Date(due.getTime() - 1)), false);
  assert.equal(removalDue(d, due), true);
  assert.equal(removalDue(dflt({ removalDueAt: due.toISOString(), status: 'RECOVERED' }), due), false);
  assert.equal(removalDue(dflt({ removalDueAt: due.toISOString(), autoRemovedAt: now.toISOString() }), due), false);
  assert.equal(removalDue(dflt({}), due), false);
});
