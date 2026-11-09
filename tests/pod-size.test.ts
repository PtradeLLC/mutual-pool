// Pod size cap: which sizes are allowed, and how pods created before the cap are treated.
import test from 'node:test';
import assert from 'node:assert/strict';
import { POD_SIZE_SUGGESTIONS, MIN_POD_SIZE, MAX_POD_SIZE, DEFAULT_POD_SIZE, isValidPodSize, capFormingPodSize } from '../src/types';

test('pods can have any whole number of members from 2 to 20, 10 by default', () => {
  assert.equal(MIN_POD_SIZE, 2);
  assert.equal(MAX_POD_SIZE, 20);
  assert.equal(DEFAULT_POD_SIZE, 10);
  assert.deepEqual([...POD_SIZE_SUGGESTIONS], [5, 10, 15, 20]);
  for (let n = 2; n <= 20; n++) assert.equal(isValidPodSize(n), true, String(n));
  for (const n of [0, 1, 21, 50, 100, 500, 10000, 2.5, -3, NaN, '20', null, undefined]) assert.equal(isValidPodSize(n), false, String(n));
});

const pod = (over: Partial<{ status: string; sizeTier: number; depositTier: number; members: unknown[]; totalCycles: number; weeklyPoolTarget: number }>) => ({
  status: 'FORMING', sizeTier: 500, depositTier: 20, members: [{}, {}, {}], totalCycles: 500, weeklyPoolTarget: 10_000, ...over,
});

test('a forming pod created larger than 20 is capped at 20', () => {
  const capped = capFormingPodSize(pod({}));
  assert.equal(capped.sizeTier, 20);
  assert.equal(capped.totalCycles, 20);
  assert.equal(capped.weeklyPoolTarget, 400);
  assert.equal(capped.members.length, 3, 'members are untouched');
});

test('active pods, pods within the cap, and forming pods already past 20 members keep their size', () => {
  const active = pod({ status: 'ACTIVE' });
  assert.equal(capFormingPodSize(active), active);
  const small = pod({ sizeTier: 20, totalCycles: 20, weeklyPoolTarget: 400 });
  assert.equal(capFormingPodSize(small), small);
  const crowded = pod({ members: Array.from({ length: 21 }, () => ({})) });
  assert.equal(capFormingPodSize(crowded), crowded, 'it can still lock early with the members it has');
});
