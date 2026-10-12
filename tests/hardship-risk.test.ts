import test from 'node:test';
import assert from 'node:assert/strict';
import { assessHardshipRisk } from '../src/server/hardshipRisk';

const clean = {
  priorRequestsWithSameCreator: 0,
  priorRequestsTotal: 0,
  creatorRecentApprovals: 0,
  memberDepositsInPod: 6,
  accountAgeDays: 400,
  requesterIsCreator: false,
};

test('an established member with no history is low risk', () => {
  const r = assessHardshipRisk(clean);
  assert.equal(r.level, 'LOW');
  assert.equal(r.score, 0);
  assert.deepEqual(r.reasons, []);
});

test('a repeat creator-member pair is flagged high risk', () => {
  const r = assessHardshipRisk({ ...clean, priorRequestsWithSameCreator: 2, priorRequestsTotal: 2 });
  assert.equal(r.level, 'HIGH');
  assert.ok(r.reasons.some(x => x.startsWith('Repeat pair')));
});

test('a creator whose pods keep approving hardship raises the score', () => {
  const r = assessHardshipRisk({ ...clean, creatorRecentApprovals: 3 });
  assert.equal(r.score, 30);
  assert.equal(r.level, 'MEDIUM');
});

test('new members with no deposits and creators requesting for themselves are flagged', () => {
  const r = assessHardshipRisk({ ...clean, memberDepositsInPod: 0, accountAgeDays: 10, requesterIsCreator: true });
  assert.equal(r.score, 45);
  assert.equal(r.reasons.length, 3);
});

test('score is capped at 100', () => {
  const r = assessHardshipRisk({
    priorRequestsWithSameCreator: 5,
    priorRequestsTotal: 9,
    creatorRecentApprovals: 9,
    memberDepositsInPod: 0,
    accountAgeDays: 1,
    requesterIsCreator: true,
  });
  assert.equal(r.score, 100);
  assert.equal(r.level, 'HIGH');
});
