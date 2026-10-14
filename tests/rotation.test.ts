// Join-cap ladder and early-slot trust rules (src/server/rotation.ts): pure unit tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRUST, earlySlotCount, earlySlotsNeedSeasoned, findEarlySlotViolation, planRotation, potCapUsd, trustTier, RotationCandidate,
} from '../src/server/rotation';

const noShuffle = (_n: number) => 0;
const c = (userId: string, trust: number): RotationCandidate => ({ userId, trust });

test('the join cap grows with cleanly completed pods and disappears after three', () => {
  assert.equal(potCapUsd(0), 1000);
  assert.equal(potCapUsd(1), 2500);
  assert.equal(potCapUsd(2), 5000);
  assert.equal(potCapUsd(3), Infinity);
  assert.equal(potCapUsd(10), Infinity);
  assert.equal(potCapUsd(-1), 1000);
});

test('trust tiers: completed pod, then tenure, then a new member with a mandate', () => {
  assert.equal(trustTier({ cleanCompletedPods: 1, accountAgeDays: 2, hasDebitMandate: false }, 90), TRUST.COMPLETED_POD);
  assert.equal(trustTier({ cleanCompletedPods: 0, accountAgeDays: 90, hasDebitMandate: false }, 90), TRUST.TENURED);
  assert.equal(trustTier({ cleanCompletedPods: 0, accountAgeDays: 89, hasDebitMandate: true }, 90), TRUST.NEW_WITH_MANDATE);
  assert.equal(trustTier({ cleanCompletedPods: 0, accountAgeDays: 1, hasDebitMandate: false }, 90), TRUST.NEW);
});

test('early slots are the first half of the rotation, rounded down', () => {
  assert.equal(earlySlotCount(2), 1);
  assert.equal(earlySlotCount(5), 2);
  assert.equal(earlySlotCount(20), 10);
  assert.equal(earlySlotsNeedSeasoned(1000), false);
  assert.equal(earlySlotsNeedSeasoned(1000.01), true);
});

test('small pot: always locks, ordered by trust, random within a tier', () => {
  const plan = planRotation(
    [c('new1', TRUST.NEW_WITH_MANDATE), c('ten1', TRUST.TENURED), c('done1', TRUST.COMPLETED_POD), c('new2', TRUST.NEW_WITH_MANDATE), c('ten2', TRUST.TENURED)],
    { totalMembers: 6, potUsd: 120, randomInt: noShuffle },
  );
  assert.ok('order' in plan, JSON.stringify(plan));
  assert.equal(plan.earlyCount, 3);
  assert.equal(plan.order[0], 'done1');
  assert.deepEqual(new Set(plan.order.slice(1, 3)), new Set(['ten1', 'ten2']));
  assert.deepEqual(new Set(plan.order.slice(3)), new Set(['new1', 'new2']));
  assert.deepEqual(plan.unseasonedEarly, []);
});

test('small pot with only new members still locks and reports the unseasoned early holders', () => {
  const plan = planRotation([c('n1', TRUST.NEW_WITH_MANDATE), c('n2', TRUST.NEW_WITH_MANDATE), c('n3', TRUST.NEW)], { totalMembers: 4, potUsd: 80, randomInt: noShuffle });
  assert.ok('order' in plan);
  assert.equal(plan.order[2], 'n3', 'a member without a mandate goes last');
  assert.equal(plan.unseasonedEarly.length, 2);
});

test('large pot: refuses to lock until every early slot can be seasoned', () => {
  const short = planRotation([c('ten1', TRUST.TENURED), c('n1', TRUST.NEW_WITH_MANDATE), c('n2', TRUST.NEW_WITH_MANDATE)], { totalMembers: 4, potUsd: 4000, randomInt: noShuffle });
  assert.ok('error' in short);
  assert.equal(short.error, 'TENURE_SLOTS_UNFILLED');
  assert.equal(short.earlyCount, 2);
  assert.equal(short.seasonedCount, 1);
  assert.equal(short.shortfall, 1);

  const ok = planRotation([c('ten1', TRUST.TENURED), c('done1', TRUST.COMPLETED_POD), c('n1', TRUST.NEW_WITH_MANDATE)], { totalMembers: 4, potUsd: 4000, randomInt: noShuffle });
  assert.ok('order' in ok);
  assert.deepEqual(ok.order, ['done1', 'ten1', 'n1']);
});

test('the plan is always a permutation of the candidates', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const plan = planRotation(ids.map((id, i) => c(id, i % 4)), { totalMembers: 8, potUsd: 160, randomInt: n => Math.floor(Math.random() * n) });
  assert.ok('order' in plan);
  assert.deepEqual([...plan.order].sort(), ids);
});

test('a less trusted member may not sit ahead of a more trusted one in the early half', () => {
  const members = [
    { userId: 'new1', displayName: 'New', rotationIndex: 0, trust: TRUST.NEW_WITH_MANDATE },
    { userId: 'ten1', displayName: 'Tenured', rotationIndex: 1, trust: TRUST.TENURED },
    { userId: 'new2', displayName: 'New 2', rotationIndex: 2, trust: TRUST.NEW_WITH_MANDATE },
    { userId: 'creator', displayName: 'Creator', rotationIndex: 3, trust: TRUST.COMPLETED_POD },
  ];
  const v = findEarlySlotViolation(members, 80);
  assert.ok(v);
  assert.equal(v.member.userId, 'new1');
  assert.equal(v.reason, 'LESS_TRUSTED_AHEAD');
  assert.equal(v.earlyCount, 2);
});

test('equal trust may trade freely; in a large pot a new early holder is a violation on its own', () => {
  assert.equal(findEarlySlotViolation([
    { userId: 'n1', displayName: 'n1', rotationIndex: 0, trust: TRUST.NEW_WITH_MANDATE },
    { userId: 'n2', displayName: 'n2', rotationIndex: 1, trust: TRUST.NEW_WITH_MANDATE },
  ], 40), null);
  assert.equal(findEarlySlotViolation([
    { userId: 't1', displayName: 't1', rotationIndex: 0, trust: TRUST.TENURED },
    { userId: 'd1', displayName: 'd1', rotationIndex: 1, trust: TRUST.COMPLETED_POD },
    { userId: 'n1', displayName: 'n1', rotationIndex: 2, trust: TRUST.NEW_WITH_MANDATE },
    { userId: 'n2', displayName: 'n2', rotationIndex: 3, trust: TRUST.NEW_WITH_MANDATE },
  ], 80)?.member.userId, 't1', 'tenured ahead of completed in the early half');
  const large = findEarlySlotViolation([
    { userId: 'n1', displayName: 'n1', rotationIndex: 0, trust: TRUST.NEW_WITH_MANDATE },
    { userId: 'n2', displayName: 'n2', rotationIndex: 1, trust: TRUST.NEW_WITH_MANDATE },
  ], 4000);
  assert.equal(large?.reason, 'LARGE_POT_NEEDS_SEASONED');
});
