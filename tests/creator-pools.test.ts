// Creator Pools rules (src/server/creatorPools.ts), tax ID encryption and the
// social-account connection helpers. Pure functions; no server.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedDeposits, completedMembersOnly, followerPodLimit, chooseSeat, canHoldSlot, heldSlotReleaseDue, collapseSlot,
  isStalled, addBusinessDays, heldBalanceUsd, creatorReadiness, isCreatorReady, handleProblem, normalizeHandle,
  JoinQueue, activeCreatorPodCount, poolClosedReason, creatorEarnsCommission, totalFollowers, followerCountsFresh,
  creatorPoolAgreementText, CREATOR_TERMS_VERSION,
} from '../src/server/creatorPools';
import { planRotation, creatorTrustRank, CREATOR_TRUST, creatorTrustLabel } from '../src/server/rotation';
import { encryptTaxId, decryptTaxId, normalizeTaxId, csvCell } from '../src/server/taxIdCrypto';
import { signState, verifyState, exchangeAndReadProfile, authorizeUrl } from '../src/server/creatorSocial';
import type { CreatorPool, Pod, PodMembership } from '../src/types';

const DAY = 86_400_000;
const member = (userId: string, rotationIndex: number, extra: Partial<PodMembership> = {}): PodMembership => ({
  id: `pm_${userId}`, podId: 'p', userId, displayName: userId, platform: 'DoorDash', rotationIndex,
  hasReceivedPayout: false, delinquencyStatus: 'CLEAN', joinedAt: new Date().toISOString(), ...extra,
});
const pod = (over: Partial<Pod>): Pod => ({
  id: 'pod', name: 'Pod', description: '', category: 'Creator Pool', podType: 'TRUSTED_CIRCLE', inviteWindowDays: 0,
  autoOpenOnExpire: false, inviteCode: '', invitedContacts: [], sizeTier: 20, depositTier: 50, status: 'FORMING',
  currentCycleWeek: 1, totalCycles: 20, agreementVersion: 'x', holdingFinAccountId: '', createdBy: 'pool:x',
  creatorName: 'C', createdAt: new Date().toISOString(), members: [], weeklyPoolTarget: 1000, currentWeeklyCollected: 0,
  creatorPoolId: 'cp1', creatorId: 'creator', ...over,
});

test('deposit options: $10-$60 for a first pool, up to $100 later; $70+ is for completed members', () => {
  assert.deepEqual([...allowedDeposits(true)], [10, 20, 30, 40, 50, 60]);
  assert.deepEqual([...allowedDeposits(false)], [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  assert.equal(completedMembersOnly(60), false);
  assert.equal(completedMembersOnly(70), true);
});

test('followers: one creator pod until a clean completion, then three; the creator\'s own seat does not count', () => {
  assert.equal(followerPodLimit(0), 1);
  assert.equal(followerPodLimit(1), 3);
  const pods = [
    pod({ id: 'a', members: [member('f', 0)] }),
    pod({ id: 'b', status: 'COMPLETED', members: [member('f', 0)] }),
    pod({ id: 'c', creatorId: 'f', members: [member('f', 19)] }),
    pod({ id: 'd', creatorPoolId: undefined, members: [member('f', 0)] }),
  ];
  assert.equal(activeCreatorPodCount(pods, 'f'), 1);
});

test('seating: held slots first (earliest payout), then the forming pod, else a new pod', () => {
  const running = pod({ id: 'run', status: 'ACTIVE', poolSequence: 1, members: [member('a', 0)], heldSlots: [
    { rotationIndex: 9, heldSince: '', vacatedByUserId: 'x', vacatedByName: 'X' },
    { rotationIndex: 4, heldSince: '', vacatedByUserId: 'y', vacatedByName: 'Y' },
  ] });
  const forming2 = pod({ id: 'f2', poolSequence: 3, members: [member('b', 0)] });
  const forming1 = pod({ id: 'f1', poolSequence: 2, members: [member('c', 0)] });
  const held = chooseSeat([forming2, running, forming1], 'new');
  assert.equal(held.kind, 'HELD');
  assert.equal(held.kind === 'HELD' && held.slot.rotationIndex, 4);
  // Someone already in the running pod can't take its slot.
  assert.deepEqual(chooseSeat([forming2, running, forming1], 'a'), { kind: 'FORMING', pod: forming1 });
  const full = pod({ id: 'full', members: Array.from({ length: 20 }, (_, i) => member(`m${i}`, i)) });
  assert.deepEqual(chooseSeat([full], 'new'), { kind: 'NEW_POD' });
});

test('held slots are kept until the week before their payout, then removed and everyone behind moves up', () => {
  assert.equal(canHoldSlot(3, 5), true);  // slot 6 pays in week 6; it's week 3
  assert.equal(canHoldSlot(5, 5), false); // payout is next week: remove instead
  assert.equal(heldSlotReleaseDue(4, { rotationIndex: 5, heldSince: '', vacatedByUserId: '', vacatedByName: '' }), false);
  assert.equal(heldSlotReleaseDue(5, { rotationIndex: 5, heldSince: '', vacatedByUserId: '', vacatedByName: '' }), true);

  const p = pod({ status: 'ACTIVE', totalCycles: 20, members: [member('a', 3), member('b', 6), member('c', 9)], heldSlots: [
    { rotationIndex: 5, heldSince: '', vacatedByUserId: 'x', vacatedByName: 'X' },
    { rotationIndex: 8, heldSince: '', vacatedByUserId: 'y', vacatedByName: 'Y' },
  ] });
  collapseSlot(p, 5);
  assert.deepEqual(p.members.map(m => m.rotationIndex), [3, 5, 8]);
  assert.deepEqual(p.heldSlots!.map(s => s.rotationIndex), [7]);
  assert.equal(p.totalCycles, 19);
});

test('a forming pod is stalled after 14 days without a join, or as soon as enrollment closes', () => {
  const now = new Date();
  const p = (days: number, n = 13) => pod({ members: Array.from({ length: n }, (_, i) => member(`m${i}`, i)), lastJoinAt: new Date(now.getTime() - days * DAY).toISOString() });
  assert.equal(isStalled(p(15), { status: 'OPEN' }, now), true);
  assert.equal(isStalled(p(13), { status: 'OPEN' }, now), false);
  assert.equal(isStalled(p(1), { status: 'CLOSED' }, now), true);
  assert.equal(isStalled(p(30, 20), { status: 'OPEN' }, now), false);
});

test('pool enrollment closes after its period or at the follower cap', () => {
  const now = new Date();
  const pool = { status: 'OPEN', enrollmentEndsAt: new Date(now.getTime() + DAY).toISOString(), seatedCount: 10, followerCap: 1000 } as CreatorPool;
  assert.equal(poolClosedReason(pool, now), null);
  assert.equal(poolClosedReason({ ...pool, enrollmentEndsAt: new Date(now.getTime() - 1).toISOString() }, now), 'ENROLLMENT_PERIOD_ENDED');
  assert.equal(poolClosedReason({ ...pool, seatedCount: 1000 }, now), 'FOLLOWER_CAP');
  assert.equal(poolClosedReason({ ...pool, status: 'CLOSED' }, now), 'NOT_OPEN');
});

test('first-payout hold is 3 business days; held money and unreported creator earnings are not withdrawable', () => {
  const friday = new Date('2026-11-06T12:00:00Z');
  assert.equal(addBusinessDays(friday, 3).toISOString().slice(0, 10), '2026-11-11'); // Wednesday
  const now = new Date('2026-11-08T00:00:00Z');
  const holds = [{ amountUsd: 900, releaseAt: '2026-11-11T12:00:00Z' }, { amountUsd: 50, releaseAt: '2026-11-01T00:00:00Z' }];
  assert.equal(heldBalanceUsd({ payoutHolds: holds, now, creatorEarningsUsd: 30, hasTaxForm: false }), 930);
  assert.equal(heldBalanceUsd({ payoutHolds: holds, now, creatorEarningsUsd: 30, hasTaxForm: true }), 900);
});

test('commission goes to the creator only while approved and their account exists', () => {
  assert.equal(creatorEarnsCommission({ status: 'APPROVED' }, true), true);
  assert.equal(creatorEarnsCommission({ status: 'SUSPENDED' }, true), false);
  assert.equal(creatorEarnsCommission({ status: 'APPROVED' }, false), false);
  assert.equal(creatorEarnsCommission(undefined, true), false);
});

test('creator approval needs 1,000 followers, identity, a bank authorization and the terms', () => {
  const now = new Date();
  const accounts = [
    { platform: 'tiktok' as const, externalId: '1', handle: 't', followers: 600, connectedAt: now.toISOString(), refreshedAt: now.toISOString(), verifiedBy: 'OAUTH' as const },
    { platform: 'youtube' as const, externalId: '2', handle: 'y', followers: 400, connectedAt: now.toISOString(), refreshedAt: now.toISOString(), verifiedBy: 'OAUTH' as const },
  ];
  assert.equal(totalFollowers(accounts), 1000);
  const ready = creatorReadiness({ accounts, kycVerified: true, hasDebitMandate: true, termsAcceptedVersion: CREATOR_TERMS_VERSION });
  assert.equal(isCreatorReady(ready), true);
  assert.equal(isCreatorReady(creatorReadiness({ accounts: accounts.slice(0, 1), kycVerified: true, hasDebitMandate: true, termsAcceptedVersion: CREATOR_TERMS_VERSION })), false);
  assert.equal(isCreatorReady(creatorReadiness({ accounts, kycVerified: true, hasDebitMandate: true, termsAcceptedVersion: 'old' })), false);
  assert.equal(followerCountsFresh(accounts, now), true);
  assert.equal(followerCountsFresh(accounts, new Date(now.getTime() + 31 * DAY)), false);
});

test('link names', () => {
  assert.equal(normalizeHandle(' @Rae_Saves '), 'rae_saves');
  assert.equal(handleProblem('rae_saves'), null);
  assert.ok(handleProblem('ab'));
  assert.ok(handleProblem('admin'));
  assert.ok(handleProblem('has space'));
});

test('join queue admits a steady rate and keeps each ticket\'s place', () => {
  const t0 = 1_000_000;
  const q = new JoinQueue(2, t0);
  assert.equal(q.admit(undefined, t0), null);
  assert.equal(q.admit(undefined, t0), null);
  const third = q.admit(undefined, t0);
  assert.deepEqual(third, { ticket: 3, position: 1 });
  const fourth = q.admit(undefined, t0);
  assert.deepEqual(fourth, { ticket: 4, position: 2 });
  assert.deepEqual(q.admit(4, t0 + 1000), { ticket: 4, position: 2 }, 'still waiting');
  assert.equal(q.admit(3, t0 + 30_000), null, 'admitted after half a minute at 2/min');
  assert.equal(q.admit(4, t0 + 60_000), null);
});

test('creator pods: payout order by trust (completed, direct deposit, tenure, new) and never blocked by pot size', () => {
  const r = (over: Partial<{ cleanCompletedPods: number; accountAgeDays: number; hasDebitMandate: boolean; hasEarningsDeposit: boolean }>) =>
    creatorTrustRank({ cleanCompletedPods: 0, accountAgeDays: 5, hasDebitMandate: true, hasEarningsDeposit: false, ...over }, 90);
  assert.equal(r({ cleanCompletedPods: 1 }), CREATOR_TRUST.COMPLETED_POD);
  assert.equal(r({ hasEarningsDeposit: true, accountAgeDays: 400 }), CREATOR_TRUST.EARNINGS_DEPOSIT);
  assert.equal(r({ accountAgeDays: 400 }), CREATOR_TRUST.TENURED);
  assert.equal(r({}), CREATOR_TRUST.NEW_WITH_MANDATE);
  assert.equal(creatorTrustLabel(CREATOR_TRUST.EARNINGS_DEPOSIT), 'EARNINGS_DEPOSIT');

  const candidates = [
    { userId: 'new', trust: CREATOR_TRUST.NEW_WITH_MANDATE },
    { userId: 'dd', trust: CREATOR_TRUST.EARNINGS_DEPOSIT },
    { userId: 'done', trust: CREATOR_TRUST.COMPLETED_POD },
    { userId: 'ten', trust: CREATOR_TRUST.TENURED },
  ];
  const allNew = [1, 2, 3, 4].map(i => ({ userId: `n${i}`, trust: CREATOR_TRUST.NEW_WITH_MANDATE }));
  assert.ok('error' in planRotation(allNew, { totalMembers: 4, potUsd: 2000, randomInt: () => 0 }), 'gig pods keep the rule');
  assert.ok(!('error' in planRotation(allNew, { totalMembers: 4, potUsd: 2000, randomInt: () => 0, requireSeasonedEarly: false })), 'creator pods never refuse');
  const plan = planRotation(candidates, { totalMembers: 4, potUsd: 2000, randomInt: () => 0, requireSeasonedEarly: false });
  assert.ok(!('error' in plan));
  assert.deepEqual(!('error' in plan) && plan.order, ['done', 'dd', 'ten', 'new']);
});

test('the agreement text names the creator, the deposit and the rules', () => {
  const text = creatorPoolAgreementText({ creatorName: 'Rae', depositTier: 50 });
  assert.match(text, /hosted by Rae/);
  assert.match(text, /\$50\.00 plus a \$2\.50 buffer contribution/);
  assert.match(text, /3% of the pot goes to Rae/);
  assert.match(text, /3 business days/);
});

test('tax IDs: encrypted with AES-GCM, tamper-evident, never in clear', () => {
  const key = Buffer.alloc(32, 7);
  const enc = encryptTaxId('123456789', key);
  assert.ok(!enc.includes('123456789'));
  assert.equal(decryptTaxId(enc, key), '123456789');
  assert.notEqual(encryptTaxId('123456789', key), enc, 'random IV');
  const parts = enc.split(':');
  parts[3] = Buffer.from('000000000').toString('base64');
  assert.throws(() => decryptTaxId(parts.join(':'), key));
  assert.throws(() => decryptTaxId(enc, Buffer.alloc(32, 8)));
  assert.equal(normalizeTaxId('123-45-6789'), '123456789');
  assert.equal(normalizeTaxId('12-3456789'), '123456789');
  assert.equal(normalizeTaxId('12345'), null);
  assert.equal(csvCell('=SUM(A1)'), `"'=SUM(A1)"`);
  assert.equal(csvCell('O"Neil'), '"O""Neil"');
});

test('social connect: signed state ties the callback to the creator and platform', () => {
  const env = { CREATOR_OAUTH_STATE_SECRET: 'test-secret' };
  const now = Date.now();
  const state = signState('usr_1', 'tiktok', now, env);
  assert.equal(verifyState(state, 'tiktok', now + 1000, env), 'usr_1');
  assert.equal(verifyState(state, 'youtube', now + 1000, env), null, 'other platform');
  assert.equal(verifyState(state, 'tiktok', now + 16 * 60_000, env), null, 'expired');
  assert.equal(verifyState(state.replace(/.$/, c => (c === 'A' ? 'B' : 'A')), 'tiktok', now, env), null, 'tampered');
  const url = new URL(authorizeUrl('instagram', state, 'https://themutualpool.com', { INSTAGRAM_APP_ID: 'app1' }));
  assert.equal(url.searchParams.get('redirect_uri'), 'https://themutualpool.com/api/creator/connect/instagram/callback');
  assert.equal(url.searchParams.get('client_id'), 'app1');
});

test('social connect: reads the follower count from each platform', async () => {
  const replies: Record<string, any> = {
    'https://api.instagram.com/oauth/access_token': { access_token: 'ig', user_id: 17 },
    'https://graph.instagram.com': { user_id: '17', username: 'rae', followers_count: 1200 },
    'https://open.tiktokapis.com/v2/oauth/token/': { access_token: 'tt', open_id: 'oid' },
    'https://open.tiktokapis.com/v2/user/info/': { data: { user: { open_id: 'oid', display_name: 'Rae', follower_count: 5400 } } },
    'https://oauth2.googleapis.com/token': { access_token: 'yt' },
    'https://www.googleapis.com/youtube/v3/channels': { items: [{ id: 'UC1', snippet: { customUrl: '@rae' }, statistics: { subscriberCount: '880', hiddenSubscriberCount: false } }] },
  };
  const fakeFetch = async (url: string) => {
    const key = Object.keys(replies).find(k => url.startsWith(k));
    return { ok: Boolean(key), status: key ? 200 : 404, json: async () => (key ? replies[key] : {}) };
  };
  assert.deepEqual(await exchangeAndReadProfile('instagram', 'c', 'https://x.test', fakeFetch, {}), { externalId: '17', handle: 'rae', followers: 1200 });
  assert.deepEqual(await exchangeAndReadProfile('tiktok', 'c', 'https://x.test', fakeFetch, {}), { externalId: 'oid', handle: 'Rae', followers: 5400 });
  assert.deepEqual(await exchangeAndReadProfile('youtube', 'c', 'https://x.test', fakeFetch, {}), { externalId: 'UC1', handle: '@rae', followers: 880 });
});

test('bank owner names: same person despite middle names, initials or order; different people fail', async () => {
  const { namesLikelyMatch } = await import('../src/server/creatorPools');
  assert.equal(namesLikelyMatch('Maria Lopez', 'MARIA E LOPEZ'), true);
  assert.equal(namesLikelyMatch('Maria Lopez', 'Lopez, Maria'), true);
  assert.equal(namesLikelyMatch('Maria Lopez', 'M Lopez'), true);
  assert.equal(namesLikelyMatch('José Núñez', 'Jose Nunez'), true);
  assert.equal(namesLikelyMatch('Maria Lopez', 'Maria Lopez and Carlos Ruiz'), true, 'joint account');
  assert.equal(namesLikelyMatch('Maria Lopez', 'John Doe'), false);
  assert.equal(namesLikelyMatch('Maria Lopez', 'Carlos Lopez'), false, 'same family, different person');
});

test('withdrawal bank checks: same account, no recent bank change, owner name or admin review', async () => {
  const { withdrawalBankProblem, bankAccountKey, BANK_CHANGE_HOLD_HOURS } = await import('../src/server/creatorPools');
  const now = new Date('2026-11-09T12:00:00Z');
  const mandate = { last4: '4242', routingNumber: '021000021', accountHolderName: 'Maria Lopez' };
  assert.equal(withdrawalBankProblem({ mandate, bank: { last4: '4242', routingNumber: '021000021' }, legalName: 'Maria Lopez', now }), null);
  assert.equal(withdrawalBankProblem({ mandate, bank: { last4: '9999' }, now })?.code, 'BANK_MISMATCH');
  assert.equal(withdrawalBankProblem({ mandate, bank: { last4: '4242', routingNumber: '111000025' }, now })?.code, 'BANK_MISMATCH', 'same last 4 at another bank');
  const changed = withdrawalBankProblem({ mandate, bank: { last4: '4242', changedAt: new Date(now.getTime() - 3_600_000).toISOString() }, now });
  assert.equal(changed?.code, 'BANK_RECENTLY_CHANGED');
  assert.equal(withdrawalBankProblem({ mandate, bank: { last4: '4242', changedAt: new Date(now.getTime() - (BANK_CHANGE_HOLD_HOURS + 1) * 3_600_000).toISOString() }, now }), null);
  const other = { ...mandate, accountHolderName: 'John Doe' };
  assert.equal(withdrawalBankProblem({ mandate: other, legalName: 'Maria Lopez', now })?.code, 'NAME_REVIEW');
  assert.equal(withdrawalBankProblem({ mandate: other, legalName: 'Maria Lopez', nameReviewedFor: bankAccountKey('021000021', '4242'), now }), null, 'admin confirmed this account');
  assert.equal(withdrawalBankProblem({ mandate: { ...other, last4: '5555' }, legalName: 'Maria Lopez', nameReviewedFor: bankAccountKey('021000021', '4242'), now })?.code, 'NAME_REVIEW', 'approval does not carry to another account');
});

test('Lainie recognizes Creator Pools questions without taking over ordinary pod-creator questions', async () => {
  const { isCreatorPoolsQuestion, creatorPoolsAnswer, CREATOR_POOLS_BRIEF } = await import('../src/lib/creatorPoolsKnowledge');
  for (const q of ['What is a creator pool?', 'Can my TikTok followers join?', "I'm an influencer", 'How do I open the creator dashboard', '¿Pueden unirse mis seguidores?', 'Je suis créateur de contenu']) {
    assert.equal(isCreatorPoolsQuestion(q), true, q);
  }
  for (const q of ['How does the creator 3% host reward work?', 'Can the pod creator swap spots?', 'What is a ROSCA?']) {
    assert.equal(isCreatorPoolsQuestion(q), false, q);
  }
  for (const lang of ['en', 'es', 'fr']) {
    const a = creatorPoolsAnswer(lang);
    assert.equal(a.navigationAction?.target, 'CREATORS');
    assert.match(a.displayText, /3 ?%/);
    assert.match(a.displayText, /5[,  ]000/);
  }
  assert.match(CREATOR_POOLS_BRIEF, /1,000 followers/);
  assert.match(CREATOR_POOLS_BRIEF, /W-9/);
});
