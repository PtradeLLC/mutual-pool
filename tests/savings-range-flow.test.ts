// Financial Awareness, Savings Range matching and MutualPool-hosted pods end to
// end, against a DEMO_MODE server. Runs in its own server (npm run
// test:savings) because it drives the weekly sweeps, which touch every active pod.
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const CRON_HEADERS = { 'content-type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' };

let seq = 0;
function makeUser(prefix: string, extra: Record<string, string> = {}) {
  const nonce = `${Date.now()}_${++seq}_${Math.floor(Math.random() * 1e6)}`;
  return { id: `usr_fa_${prefix}_${nonce}`, name: `FA ${prefix} ${seq}`, extra };
}
type TestUser = ReturnType<typeof makeUser>;

function headers(u: TestUser) {
  return {
    'content-type': 'application/json',
    'x-user-id': u.id,
    'x-user-name': u.name,
    'x-user-email': `${u.id}@example.test`,
    'x-user-kyc-status': 'VERIFIED',
    'x-user-account-age-days': '180',
    'x-user-completed-pods-count': '2',
    ...u.extra,
  };
}
const admin = makeUser('admin', { 'x-user-role': 'Admin' });

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, body };
}
const send = (method: string) => (u: TestUser, path: string, body: unknown = {}) =>
  api(path, { method, headers: headers(u), body: JSON.stringify(body) });
const post = send('POST');
const put = send('PUT');
const get = (u: TestUser | null, path: string) => api(path, u ? { headers: headers(u) } : {});

async function ready(u: TestUser, amount = 600) {
  assert.equal((await post(u, '/api/users/treasury/topup', { amount })).status, 200);
  assert.equal((await post(u, '/api/users/debit-mandate/accept', {})).status, 200);
}
async function balance(u: TestUser): Promise<number> {
  return (await get(u, '/api/users/current')).body.treasury?.balanceUsd || 0;
}
async function sweep(type: 'THURSDAY_DEPOSITS' | 'FRIDAY_PAYOUTS') {
  const r = await api('/api/platform/schedule/sweep', { method: 'POST', headers: CRON_HEADERS, body: JSON.stringify({ sweepType: type }) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
}

const PROFILE = {
  targetSavingsCents: 200000,
  savingsPurpose: 'PHONE_EQUIPMENT',
  takeHomePayCents: 70000,
  incomeFrequency: 'WEEKLY',
  expenses: [
    { name: 'Rent', amountCents: 100000, frequency: 'MONTHLY' },
    { name: 'Electricity', amountCents: 10000, frequency: 'MONTHLY' },
    { name: 'Internet', amountCents: 6000, frequency: 'MONTHLY' },
    { name: 'Phone', amountCents: 8000, frequency: 'MONTHLY' },
    { name: 'Transportation', amountCents: 10000, frequency: 'WEEKLY' },
    { name: 'Car insurance', amountCents: 5000, frequency: 'BIWEEKLY' },
  ],
  confirmedWeeklyCommitmentCents: 2000,
};
const profileWith = (weeklyCents: number, extra: Record<string, unknown> = {}) => ({ ...PROFILE, confirmedWeeklyCommitmentCents: weeklyCents, ...extra });

test('1. A member completes Financial Awareness and gets totals, an estimate and a Savings Range', async () => {
  const u = makeUser('profile');
  const empty = await get(u, '/api/financial-profile');
  assert.equal(empty.status, 200);
  assert.equal(empty.body.profile, null);
  assert.equal(empty.body.savingsRange, null);

  const saved = await put(u, '/api/financial-profile', PROFILE);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const { profile, estimate, savingsRange } = saved.body;
  assert.equal(profile.userId, u.id);
  assert.equal(profile.completionStatus, 'COMPLETE');
  assert.equal(profile.monthlyIncomeCents, 280000, 'weekly pay x 4');
  assert.equal(profile.totalMonthlyExpensesCents, 174000, 'weekly x4, biweekly x2, monthly x1');
  assert.equal(profile.estimatedRemainingIncomeCents, 106000);
  assert.equal(estimate.proposedMonthlySavingsCents, 106000);
  assert.equal(estimate.expensesExceedIncome, false);
  assert.equal(profile.expenses.length, 6);
  assert.equal(profile.expenses.find((e: any) => e.name === 'Transportation').monthlyEquivalentCents, 40000);
  assert.equal(profile.expenses.find((e: any) => e.name === 'Car insurance').monthlyEquivalentCents, 10000);
  assert.equal(savingsRange.id, 'range_builder', '$20 a week');
  assert.equal(profile.savingsRangeId, 'range_builder');
  assert.equal(saved.body.weeksToGoal, 100);

  const again = await get(u, '/api/financial-profile');
  assert.equal(again.body.profile.targetSavingsCents, 200000, 'the profile persists');
});

test('2. Editing and removing expenses updates the totals; expense ids are kept', async () => {
  const u = makeUser('edit');
  const first = (await put(u, '/api/financial-profile', PROFILE)).body.profile;
  const rent = first.expenses.find((e: any) => e.name === 'Rent');
  const kept = first.expenses
    .filter((e: any) => e.name !== 'Internet')
    .map((e: any) => (e.id === rent.id ? { ...e, amountCents: 120000 } : e));
  const second = await put(u, '/api/financial-profile', { ...PROFILE, expenses: kept });
  assert.equal(second.status, 200);
  const p = second.body.profile;
  assert.equal(p.expenses.length, 5);
  assert.equal(p.totalMonthlyExpensesCents, 174000 - 6000 + 20000);
  assert.equal(p.expenses.find((e: any) => e.name === 'Rent').id, rent.id);
  assert.equal(p.expenses.find((e: any) => e.name === 'Rent').createdAt, rent.createdAt);
  assert.equal(p.createdAt, first.createdAt);
});

test('3. Expenses above income: a warning, a negative remainder, never a positive savings amount', async () => {
  const u = makeUser('over');
  const r = await put(u, '/api/financial-profile', profileWith(2000, { takeHomePayCents: 30000 }));
  assert.equal(r.status, 200);
  assert.equal(r.body.profile.estimatedRemainingIncomeCents, 120000 - 174000);
  assert.equal(r.body.estimate.expensesExceedIncome, true);
  assert.equal(r.body.estimate.proposedMonthlySavingsCents, 0);
  assert.equal(r.body.commitmentExceedsEstimate, true);
});

test('4. Changing the goal or the commitment updates the profile and the Savings Range', async () => {
  const u = makeUser('goal');
  await put(u, '/api/financial-profile', PROFILE);
  const r = await put(u, '/api/financial-profile', profileWith(5000, { targetSavingsCents: 500000, savingsPurpose: 'CUSTOM', savingsPurposeText: 'Truck down payment' }));
  assert.equal(r.body.profile.targetSavingsCents, 500000);
  assert.equal(r.body.profile.savingsPurposeText, 'Truck down payment');
  assert.equal(r.body.savingsRange.id, 'range_accelerator');

  const draft = await put(u, '/api/financial-profile', profileWith(0));
  assert.equal(draft.body.profile.completionStatus, 'INCOMPLETE');
  assert.equal(draft.body.savingsRange, null);
  assert.deepEqual(draft.body.missing, ['confirmedWeeklyCommitmentCents']);
});

test('5. Money is validated on the server', async () => {
  const u = makeUser('invalid');
  for (const bad of [
    { ...PROFILE, takeHomePayCents: 700.55 },
    { ...PROFILE, targetSavingsCents: -100 },
    { ...PROFILE, confirmedWeeklyCommitmentCents: '2000' },
    { ...PROFILE, expenses: [{ name: 'Rent', amountCents: -5, frequency: 'MONTHLY' }] },
    { ...PROFILE, expenses: [{ name: 'Rent', amountCents: 100, frequency: 'DAILY' }] },
    { ...PROFILE, incomeFrequency: 'HOURLY' },
  ]) {
    const r = await put(u, '/api/financial-profile', bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.equal(r.body.error, 'INVALID_INPUT');
  }
  assert.equal((await get(u, '/api/financial-profile')).body.profile, null, 'nothing was saved');
  assert.equal((await get(null, '/api/financial-profile')).status, 401);
});

test('6. Financial profiles are private, and only administrators manage ranges and hosted pods', async () => {
  const owner = makeUser('private_owner');
  const other = makeUser('private_other');
  await put(owner, '/api/financial-profile', profileWith(2000, { targetSavingsCents: 987600 }));
  assert.equal((await get(other, '/api/financial-profile')).body.profile, null, "another member sees only their own (empty) profile");
  // A body naming someone else's account still writes the caller's own profile.
  const spoof = await put(other, '/api/financial-profile', { ...profileWith(1000), userId: owner.id, id: owner.id });
  assert.equal(spoof.body.profile.userId, other.id);
  assert.equal((await get(owner, '/api/financial-profile')).body.profile.targetSavingsCents, 987600);

  assert.equal((await get(other, '/api/admin/savings-ranges')).status, 403);
  assert.equal((await post(other, '/api/admin/savings-ranges', {})).status, 403);
  assert.equal((await put(other, '/api/admin/savings-ranges/range_builder', { minWeeklyCents: 1 })).status, 403);
  assert.equal((await post(other, '/api/admin/hosted-pods', { savingsRangeId: 'range_builder' })).status, 403);

  // Administrators see counts, never a member's numbers.
  const adminView = await get(admin, '/api/admin/savings-ranges');
  assert.equal(adminView.status, 200);
  assert.ok(!JSON.stringify(adminView.body).includes('987600'));
  assert.ok(adminView.body.ranges.find((r: any) => r.id === 'range_builder').memberCount >= 1);
  assert.equal(adminView.body.fees.userPodPlatformRate, 0.07);
  assert.equal(adminView.body.fees.hostedPodPlatformRate, 0.1);
  // Other users and the pod list carry no financial data.
  const usersList = await get(other, '/api/users');
  assert.ok(!JSON.stringify(usersList.body).includes('987600'));
});

test('7. Join a Pod matches a member to a MutualPool-hosted pod in their range, without duplicates', async () => {
  const a = makeUser('match_a');
  const b = makeUser('match_b');
  const none = await get(a, '/api/savings-range/matches');
  assert.equal(none.body.status, 'PROFILE_REQUIRED');

  await put(a, '/api/financial-profile', profileWith(5500));
  await put(b, '/api/financial-profile', profileWith(7000, { savingsPurpose: 'TRAVEL' }));
  const first = await get(a, '/api/savings-range/matches');
  assert.equal(first.status, 200);
  assert.equal(first.body.status, 'MATCHED');
  assert.equal(first.body.savingsRange.id, 'range_accelerator');
  assert.equal(first.body.pods.length, 1);
  const match = first.body.pods[0];
  assert.equal(match.pod.hostType, 'MUTUALPOOL');
  assert.equal(match.pod.creatorName, 'MutualPool');
  assert.equal(match.pod.depositTier, 50);
  assert.equal(match.pod.savingsRangeId, 'range_accelerator');
  assert.equal(match.pod.applicableFeeRate, 0.1);
  assert.equal(match.pod.members.length, 0, 'matching never enrolls anyone');
  assert.equal(match.firstChargeUsd, 52.5);
  assert.equal(first.body.bestPodId, match.pod.id);

  // The same forming pod is reused for the next member in the range.
  const second = await get(b, '/api/savings-range/matches');
  assert.equal(second.body.pods.length, 1);
  assert.equal(second.body.pods[0].pod.id, match.pod.id);

  // Below the smallest range: no pod, and a clear reason.
  const low = makeUser('match_low');
  await put(low, '/api/financial-profile', profileWith(300));
  const lowMatch = await get(low, '/api/savings-range/matches');
  assert.equal(lowMatch.body.status, 'NO_RANGE');
  assert.equal(lowMatch.body.lowestWeeklyCents, 500);
});

let hostedPodId = '';
const m1 = makeUser('hosted_m1');
const m2 = makeUser('hosted_m2');

test('8. An administrator opens a hosted pod; members in the range join it, others cannot', async () => {
  const created = await post(admin, '/api/admin/hosted-pods', { savingsRangeId: 'range_starter', sizeTier: 2, name: 'Starter Test Pod', allowDuplicate: true });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const pod = created.body.pod;
  hostedPodId = pod.id;
  assert.equal(pod.hostType, 'MUTUALPOOL');
  assert.equal(pod.hostId, 'mutualpool');
  assert.equal(pod.depositTier, 5);
  assert.equal(pod.status, 'FORMING');

  // A second identical pod is refused while this one has seats.
  const dup = await post(admin, '/api/admin/hosted-pods', { savingsRangeId: 'range_starter', sizeTier: 2 });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error, 'HOSTED_POD_EXISTS');
  // Deposit above the range minimum is refused.
  assert.equal((await post(admin, '/api/admin/hosted-pods', { savingsRangeId: 'range_starter', depositTier: 20, allowDuplicate: true })).status, 400);

  await ready(m1);
  await ready(m2);
  const noProfile = await post(m1, `/api/pods/${hostedPodId}/join`);
  assert.equal(noProfile.status, 403);
  assert.equal(noProfile.body.error, 'FINANCIAL_PROFILE_REQUIRED');

  await put(m1, '/api/financial-profile', profileWith(2000));
  const wrongRange = await post(m1, `/api/pods/${hostedPodId}/join`);
  assert.equal(wrongRange.status, 403);
  assert.equal(wrongRange.body.error, 'SAVINGS_RANGE_MISMATCH');

  await put(m1, '/api/financial-profile', profileWith(700));
  await put(m2, '/api/financial-profile', profileWith(900));
  const before = await balance(m1);
  const joined = await post(m1, `/api/pods/${hostedPodId}/join`);
  assert.equal(joined.status, 200, JSON.stringify(joined.body));
  assert.equal(joined.body.charged.totalChargedAmount, 5.25, 'the usual deposit + 5% buffer');
  assert.equal(Math.round((before - (await balance(m1))) * 100), 525);
  // The joining member's financial profile is not written into the pod.
  assert.ok(!JSON.stringify(joined.body.pod).includes('confirmedWeeklyCommitmentCents'));

  const twice = await post(m1, `/api/pods/${hostedPodId}/join`);
  assert.equal(twice.status, 400, 'no duplicate membership');
  assert.equal(Math.round((before - (await balance(m1))) * 100), 525, 'and no second charge');

  assert.equal((await post(m2, `/api/pods/${hostedPodId}/join`)).status, 200);
});

test('9. A full hosted pod stops accepting members and starts once everyone has signed', async () => {
  const late = makeUser('hosted_late');
  await ready(late);
  await put(late, '/api/financial-profile', profileWith(800));
  const full = await post(late, `/api/pods/${hostedPodId}/join`);
  assert.equal(full.status, 400);
  assert.match(JSON.stringify(full.body), /maximum size|no longer accepting/i);
  assert.equal(Math.round((await balance(late)) * 100), 60000, 'nothing was charged');

  // Members cannot lock or run a hosted pod themselves.
  assert.equal((await post(m1, `/api/pods/${hostedPodId}/lock`)).status, 403);

  assert.equal((await post(m1, `/api/pods/${hostedPodId}/agreement/sign`, { signatureName: m1.name })).status, 200);
  let pod = (await get(m1, `/api/pods/${hostedPodId}`)).body;
  assert.equal(pod.status, 'FORMING', 'waits for every signature');
  assert.equal((await post(m2, `/api/pods/${hostedPodId}/agreement/sign`, { signatureName: m2.name })).status, 200);
  pod = (await get(m1, `/api/pods/${hostedPodId}`)).body;
  assert.equal(pod.status, 'ACTIVE');
  assert.equal(pod.totalCycles, 2);
  assert.deepEqual(pod.members.map((m: any) => m.rotationIndex).sort(), [0, 1]);
  assert.equal(pod.hostRewardRecipientUserId, undefined, 'no member host');

  // It no longer shows up as a match, and is not offered again to its members.
  const matches = await get(late, '/api/savings-range/matches');
  assert.ok(!matches.body.pods.some((p: any) => p.pod.id === hostedPodId));
});

test('10. Hosted pod payouts: the 10% fee goes entirely to MutualPool, charged once', async () => {
  let pod = (await get(m1, `/api/pods/${hostedPodId}`)).body;
  const first = pod.members.find((m: any) => m.rotationIndex === 0);
  const firstUser = first.userId === m1.id ? m1 : m2;
  const secondUser = first.userId === m1.id ? m2 : m1;
  const before = await balance(firstUser);
  const otherBefore = await balance(secondUser);

  assert.equal((await post(m1, `/api/pods/${hostedPodId}/cycle/process`)).status, 403, 'members cannot trigger payouts');
  const paid = await post(admin, `/api/pods/${hostedPodId}/cycle/process`);
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(paid.body.grossPayoutAmount, 10);
  assert.equal(paid.body.payoutFee, 1, '10% of the pot');
  assert.equal(paid.body.creatorHostReward, 0, 'no host reward');
  assert.equal(paid.body.platformFeeRetained, 1, 'all of it to MutualPool');
  assert.equal(paid.body.payoutAmount, 9);
  assert.equal(paid.body.hostType, 'MUTUALPOOL');
  assert.equal(paid.body.platformFeeRate, 0.1);
  assert.equal(Math.round(((await balance(firstUser)) - before) * 100), 900);
  assert.equal(Math.round(((await balance(secondUser)) - otherBefore) * 100), 0, 'nobody else is credited a reward');

  const again = await post(admin, `/api/pods/${hostedPodId}/cycle/process`);
  assert.notEqual(again.status, 200, 'week 2 has no deposits yet; week 1 is not paid twice');

  // The split is stored with the payout record and the audit log.
  pod = (await get(m1, `/api/pods/${hostedPodId}`)).body;
  const paidMember = pod.members.find((m: any) => m.userId === firstUser.id);
  assert.deepEqual(
    { ...paidMember.payoutFee },
    { hostType: 'MUTUALPOOL', grossUsd: 10, totalFeeRate: 0.1, totalFeeUsd: 1, hostRewardRate: 0, hostRewardUsd: 0, platformFeeRate: 0.1, platformFeeUsd: 1, netPayoutUsd: 9 },
  );
  const log = pod.auditLogs.find((l: any) => l.action === 'PAYOUT_EXECUTED');
  assert.equal(log.metadata.hostType, 'MUTUALPOOL');
  assert.equal(log.metadata.platformFeeRate, 0.1);
  assert.equal(log.metadata.hostRewardRate, 0);

  // Week 2 through the scheduled sweeps: the same split, and the pod completes.
  await sweep('THURSDAY_DEPOSITS');
  const secondBefore = await balance(secondUser);
  await sweep('FRIDAY_PAYOUTS');
  pod = (await get(m1, `/api/pods/${hostedPodId}`)).body;
  assert.equal(pod.status, 'COMPLETED');
  assert.equal(pod.renewalDecision, 'CLOSED');
  const second = pod.members.find((m: any) => m.userId === secondUser.id);
  assert.equal(second.payoutFee.hostType, 'MUTUALPOOL');
  assert.equal(second.payoutFee.hostRewardUsd, 0);
  assert.equal(second.payoutFee.platformFeeUsd, 1);
  assert.equal(second.payoutFee.netPayoutUsd, 9);
  assert.ok((await balance(secondUser)) - secondBefore >= 9, 'payout (plus any unused buffer refund)');
  assert.ok(!pod.auditLogs.some((l: any) => l.action === 'CREATOR_HOST_REWARD_DISBURSED'));

  // Progress on the member's own profile view.
  const progress = (await get(secondUser, '/api/financial-profile')).body.progress;
  assert.equal(progress.totalContributedCents, 1000);
  assert.equal(progress.completedContributions, 2);
  assert.equal(progress.missedContributions, 0);
  assert.ok(progress.completedCycles >= 1);
});

test('11. Member-created pods keep the 3% host reward and 7% MutualPool split', async () => {
  const creator = makeUser('user_creator');
  const member = makeUser('user_member');
  await ready(creator);
  await ready(member);
  const created = await post(creator, '/api/pods', { name: `User Pod ${Date.now()}`, sizeTier: 2, depositTier: 20 });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const pod = created.body;
  assert.equal(pod.hostType, undefined, 'member-created pods are unchanged');
  assert.equal(pod.createdBy, creator.id);
  assert.equal(pod.members.length, 1);

  // No financial profile is needed for a member-created pod.
  assert.equal((await post(member, `/api/pods/${pod.id}/join`, { inviteCode: pod.inviteCode })).status, 200);
  assert.equal((await post(creator, `/api/pods/${pod.id}/agreement/sign`, { signatureName: creator.name })).status, 200);
  assert.equal((await post(member, `/api/pods/${pod.id}/agreement/sign`, { signatureName: member.name })).status, 200);
  assert.equal((await get(creator, `/api/pods/${pod.id}`)).body.status, 'FORMING', 'member pods still wait for their creator to lock');
  assert.equal((await post(creator, `/api/pods/${pod.id}/lock`)).status, 200);

  const creatorBefore = await balance(creator);
  const memberBefore = await balance(member);
  const paid = await post(admin, `/api/pods/${pod.id}/cycle/process`);
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(paid.body.grossPayoutAmount, 40);
  assert.equal(paid.body.payoutFee, 4);
  assert.equal(paid.body.creatorHostReward, 1.2, '3% to the host');
  assert.equal(paid.body.platformFeeRetained, 2.8, '7% to MutualPool');
  assert.equal(paid.body.payoutAmount, 36);
  assert.equal(paid.body.hostType, 'USER');
  assert.equal(paid.body.platformFeeRate, 0.07);
  assert.equal(Math.round(((await balance(member)) - memberBefore) * 100), 3600);
  assert.equal(Math.round(((await balance(creator)) - creatorBefore) * 100), 120);
});

test('12. A member can leave a hosted pod that has not started and is refunded in full', async () => {
  const u = makeUser('leaver');
  await ready(u);
  await put(u, '/api/financial-profile', profileWith(1200));
  const matches = await get(u, '/api/savings-range/matches');
  assert.equal(matches.body.status, 'MATCHED');
  const podId = matches.body.bestPodId;
  const before = await balance(u);
  assert.equal((await post(u, `/api/pods/${podId}/join`)).status, 200);
  assert.equal(Math.round((before - (await balance(u))) * 100), 1050);
  const left = await post(u, `/api/pods/${podId}/leave`);
  assert.equal(left.status, 200, JSON.stringify(left.body));
  assert.equal(left.body.refunded, true);
  assert.equal(Math.round((await balance(u)) * 100), Math.round(before * 100));
  const pod = (await get(admin, `/api/pods/${podId}`)).body;
  assert.ok(!pod.members.some((m: any) => m.userId === u.id));
});

test('13. Administrators adjust range thresholds; overlaps are refused and members are re-placed', async () => {
  const u = makeUser('rerange');
  await put(u, '/api/financial-profile', profileWith(1900));
  assert.equal((await get(u, '/api/financial-profile')).body.savingsRange.id, 'range_steady');

  const overlap = await put(admin, '/api/admin/savings-ranges/range_steady', { maxWeeklyCents: 2500 });
  assert.equal(overlap.status, 400);
  assert.equal(overlap.body.error, 'INVALID_RANGE');

  // Move the Steady/Builder boundary from $20 to $18.
  assert.equal((await put(admin, '/api/admin/savings-ranges/range_steady', { maxWeeklyCents: 1799 })).status, 200);
  const moved = await put(admin, '/api/admin/savings-ranges/range_builder', { minWeeklyCents: 1800, matchingCriteria: { podDepositTier: 10 } });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.equal((await get(u, '/api/financial-profile')).body.savingsRange.id, 'range_builder');

  const made = await post(admin, '/api/admin/savings-ranges', { name: 'Paused tier', minWeeklyCents: 1800, maxWeeklyCents: 1900, active: false, matchingCriteria: { podDepositTier: 10, podSize: 5, autoProvision: false } });
  assert.equal(made.status, 200, JSON.stringify(made.body));
  assert.equal((await get(u, '/api/savings-ranges')).body.ranges.some((r: any) => r.id === made.body.range.id), false, 'inactive ranges are not offered');

  // Put the defaults back.
  assert.equal((await put(admin, '/api/admin/savings-ranges/range_builder', { minWeeklyCents: 2000, matchingCriteria: { podDepositTier: 20 } })).status, 200);
  assert.equal((await put(admin, '/api/admin/savings-ranges/range_steady', { maxWeeklyCents: 1999 })).status, 200);
});
