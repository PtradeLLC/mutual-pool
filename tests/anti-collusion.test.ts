// Anti-collusion rules, end to end. Runs against a DEMO_MODE server
// (npm run test:integration), where x-user-* headers stand in for sign-in.
import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const CRON_HEADERS = { 'content-type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' };

let seq = 0;
function makeUser(prefix: string) {
  const nonce = `${Date.now()}_${++seq}_${Math.floor(Math.random() * 1e6)}`;
  return { id: `usr_ac_${prefix}_${nonce}`, name: `AC ${prefix} ${seq}`, account: `acct_ac_${prefix}_${nonce}` };
}
type TestUser = ReturnType<typeof makeUser>;

function headers(u: TestUser, extra: Record<string, string> = {}) {
  return {
    'content-type': 'application/json',
    'x-user-id': u.id,
    'x-user-name': u.name,
    'x-user-email': `${u.id}@example.test`,
    'x-user-kyc-status': 'VERIFIED',
    'x-user-account-age-days': '400',
    'x-user-completed-pods-count': '2',
    'x-user-treasury-stripe-account-id': u.account,
    ...extra,
  };
}
const admin = makeUser('admin');
const adminHeaders = headers(admin, { 'x-user-role': 'Admin' });

async function api(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function fund(u: TestUser, amount = 1000) {
  const r = await api('/api/users/treasury/topup', { method: 'POST', headers: headers(u), body: JSON.stringify({ amount }) });
  assert.equal(r.status, 200);
  // Every member authorizes bank debits before creating or joining a pod.
  const m = await api('/api/users/debit-mandate/accept', { method: 'POST', headers: headers(u), body: '{}' });
  assert.equal(m.status, 200);
}

// Simulate Stripe Connect onboarding finishing with a given payout bank account.
async function completeConnect(u: TestUser, bankFingerprint: string) {
  await api('/api/users/current', { headers: headers(u) }); // ensure the user exists
  const payload = JSON.stringify({
    id: `evt_${u.id}`,
    object: 'event',
    type: 'account.updated',
    data: {
      object: {
        id: u.account,
        object: 'account',
        details_submitted: true,
        payouts_enabled: true,
        capabilities: { transfers: 'active' },
        external_accounts: { data: [{ object: 'bank_account', bank_name: 'Test Bank', last4: '6789', fingerprint: bankFingerprint }] },
      },
    },
  });
  const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) },
    body: payload,
  });
  assert.equal(res.status, 200);
}

// Create a 2+ member pod and lock it (week 1 deposits are charged at create/join).
async function activePod(creator: TestUser, members: TestUser[]) {
  const created = await api('/api/pods', {
    method: 'POST',
    headers: headers(creator),
    body: JSON.stringify({ name: `AC Pod ${Date.now()}_${seq}`, sizeTier: 20, depositTier: 20, activationPolicy: 'FLEXIBLE_EARLY' }),
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const pod = created.body;
  for (const m of members) {
    const joined = await api(`/api/pods/${pod.id}/join`, { method: 'POST', headers: headers(m), body: JSON.stringify({ inviteCode: pod.inviteCode }) });
    assert.equal(joined.status, 200, JSON.stringify(joined.body));
  }
  for (const u of [creator, ...members]) {
    await api(`/api/pods/${pod.id}/agreement/sign`, { method: 'POST', headers: headers(u), body: JSON.stringify({ signatureName: u.name }) });
  }
  const locked = await api(`/api/pods/${pod.id}/lock`, { method: 'POST', headers: headers(creator), body: JSON.stringify({ forceEarly: true }) });
  assert.equal(locked.status, 200);
  return pod;
}

async function sweep(type: 'THURSDAY_DEPOSITS' | 'FRIDAY_PAYOUTS') {
  const r = await api('/api/platform/schedule/sweep', { method: 'POST', headers: CRON_HEADERS, body: JSON.stringify({ sweepType: type }) });
  assert.equal(r.status, 200);
}

async function getPod(id: string) {
  return (await api(`/api/pods/${id}`, { headers: adminHeaders })).body;
}

test('welcome match is granted once per verified person, not once per account', async () => {
  const personA1 = makeUser('wm_a1');
  const personA2 = makeUser('wm_a2'); // same person, second account (same payout bank)
  const fingerprint = `fp_same_person_${Date.now()}`;
  for (const u of [personA1, personA2]) {
    await fund(u);
    await completeConnect(u, fingerprint);
  }

  const first = await api('/api/pods', { method: 'POST', headers: headers(personA1), body: JSON.stringify({ name: `WM1 ${Date.now()}`, sizeTier: 20, depositTier: 20 }) });
  assert.equal(first.status, 200);
  assert.equal(first.body.welcomeMatchGranted, true);
  assert.equal(first.body.contingencyBufferUsd, 20);

  const second = await api('/api/pods', { method: 'POST', headers: headers(personA2), body: JSON.stringify({ name: `WM2 ${Date.now()}`, sizeTier: 20, depositTier: 20 }) });
  assert.equal(second.status, 200);
  assert.equal(second.body.welcomeMatchGranted, false, 'second account of the same person must not get another match');
  assert.equal(second.body.contingencyBufferUsd, 0);
});

test('unused welcome match cushion returns to the platform when the pod completes', async () => {
  const creator = makeUser('wm_creator');
  const member = makeUser('wm_member');
  for (const u of [creator, member]) await fund(u);
  const pod = await activePod(creator, [member]);
  assert.equal((await getPod(pod.id)).contingencyBufferUsd, 20);

  // Week 1 payout, then week 2 deposits + payout completes the 2-member pod.
  await sweep('FRIDAY_PAYOUTS');
  await sweep('THURSDAY_DEPOSITS');
  await sweep('FRIDAY_PAYOUTS');

  const done = await getPod(pod.id);
  assert.equal(done.status, 'COMPLETED');
  assert.equal(done.contingencyBufferUsd, 0, 'cushion is not left on the pod');
  assert.ok((done.auditLogs || []).some((l: any) => l.action === 'WELCOME_MATCH_RELEASED' && l.metadata?.returnedUsd === 20));

  // And it was never credited to anyone's balance as a bonus.
  const creatorUser = (await api('/api/users/current', { headers: headers(creator) })).body;
  assert.ok(creatorUser.treasury.balanceUsd < 1000, 'creator balance only reflects their own deposits/payouts');
});

test('host reward applies with one genuine member, but not for the creator\'s own second account', async () => {
  const fingerprintGenuine = `fp_genuine_${Date.now()}`;
  const creator = makeUser('hr_creator');
  const genuine = makeUser('hr_genuine');
  await fund(creator); await fund(genuine);
  await completeConnect(creator, `fp_creator_${Date.now()}`);
  await completeConnect(genuine, fingerprintGenuine);
  const goodPod = await activePod(creator, [genuine]);

  const fingerprintFarm = `fp_farm_${Date.now()}`;
  const farmer = makeUser('hr_farmer');
  const puppet = makeUser('hr_puppet');
  await fund(farmer); await fund(puppet);
  await completeConnect(farmer, fingerprintFarm);
  await completeConnect(puppet, fingerprintFarm); // same bank: same person
  const farmPod = await activePod(farmer, [puppet]);

  await sweep('FRIDAY_PAYOUTS');

  assert.ok((await getPod(goodPod.id)).creatorStewardshipEarningsUsd > 0, 'creator + 1 genuine member earns the 3%');
  assert.ok(!((await getPod(farmPod.id)).creatorStewardshipEarningsUsd > 0), 'creator + own second account earns nothing');
});

test('hardship requests need admin approval and are capped per pod per week', async () => {
  const creator = makeUser('hs_creator');
  const m1 = makeUser('hs_m1');
  const m2 = makeUser('hs_m2');
  for (const u of [creator, m1, m2]) await fund(u);
  const pod = await activePod(creator, [m1, m2]);

  // Move to week 2, where nobody has deposited yet.
  await sweep('FRIDAY_PAYOUTS');
  assert.equal((await getPod(pod.id)).currentCycleWeek, 2);

  const req1 = await api('/api/hardship/request', { method: 'POST', headers: headers(m1), body: JSON.stringify({ podId: pod.id, reason: 'car repair', bypassTenureCheck: true }) });
  assert.equal(req1.status, 200, JSON.stringify(req1.body));
  const req2 = await api('/api/hardship/request', { method: 'POST', headers: headers(m2), body: JSON.stringify({ podId: pod.id, reason: 'medical', bypassTenureCheck: true }) });
  assert.equal(req2.status, 200);

  // Members and creators see their requests, but not the risk assessment.
  const memberView = await api('/api/hardship/requests', { headers: headers(m1) });
  assert.equal(memberView.body.find((r: any) => r.id === req1.body.id).riskScore, undefined);

  // The creator can no longer approve.
  const byCreator = await api('/api/hardship/approve', { method: 'POST', headers: headers(creator), body: JSON.stringify({ requestId: req1.body.id }) });
  assert.equal(byCreator.status, 403);

  // Admin sees risk and approves the first.
  const adminView = await api('/api/hardship/requests', { headers: adminHeaders });
  const pending = adminView.body.find((r: any) => r.id === req1.body.id);
  assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(pending.riskLevel));
  const approved = await api('/api/hardship/approve', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ requestId: req1.body.id }) });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));

  // Cap: a second approval in the same pod and week is refused.
  const second = await api('/api/hardship/approve', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ requestId: req2.body.id }) });
  assert.equal(second.status, 400);
  assert.equal(second.body.error, 'HARDSHIP_CAP_REACHED');

  // Admin can reject instead; the member is notified and not put on cooldown.
  const rejected = await api('/api/hardship/reject', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ requestId: req2.body.id, reason: 'Weekly limit reached' }) });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.request.status, 'REJECTED');
  const rejectByMember = await api('/api/hardship/reject', { method: 'POST', headers: headers(m2), body: JSON.stringify({ requestId: req2.body.id }) });
  assert.equal(rejectByMember.status, 403);
});

test('a repeat creator-member hardship pair is flagged to the reviewer', async () => {
  const creator = makeUser('rp_creator');
  const friend = makeUser('rp_friend');
  for (const u of [creator, friend]) await fund(u);

  // First pod: friend gets a hardship approved, then repays.
  const pod1 = await activePod(creator, [friend]);
  await sweep('FRIDAY_PAYOUTS');
  const r1 = await api('/api/hardship/request', { method: 'POST', headers: headers(friend), body: JSON.stringify({ podId: pod1.id, bypassTenureCheck: true }) });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.equal((await api('/api/hardship/approve', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ requestId: r1.body.id }) })).status, 200);
  assert.equal((await api('/api/hardship/repay', { method: 'POST', headers: headers(friend), body: JSON.stringify({ requestId: r1.body.id }) })).status, 200);

  // Second pod by the same creator: the same friend asks again.
  const pod2 = await activePod(creator, [friend]);
  await sweep('FRIDAY_PAYOUTS');
  const r2 = await api('/api/hardship/request', { method: 'POST', headers: headers(friend), body: JSON.stringify({ podId: pod2.id, bypassTenureCheck: true }) });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));

  const view = (await api('/api/hardship/requests', { headers: adminHeaders })).body.find((r: any) => r.id === r2.body.id);
  assert.ok(view.riskReasons.some((x: string) => x.startsWith('Repeat pair')), JSON.stringify(view.riskReasons));
  assert.ok(view.riskScore >= 40);
});

// --- Rotation order: the creator is paid last, and the 3% follows the final slot ---

function slotOf(pod: any, u: TestUser): number {
  return pod.members.find((m: any) => m.userId === u.id).rotationIndex;
}

async function swap(pod: any, requester: TestUser, target: TestUser) {
  const req = await api(`/api/pods/${pod.id}/swap-request`, { method: 'POST', headers: headers(requester), body: JSON.stringify({ targetUserId: target.id }) });
  assert.equal(req.status, 200, JSON.stringify(req.body));
  const accepted = await api(`/api/pods/${pod.id}/swap-request/${req.body.swapRequest.id}/respond`, { method: 'POST', headers: headers(target), body: JSON.stringify({ action: 'ACCEPT' }) });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  const done = await api(`/api/pods/${pod.id}/swap`, { method: 'POST', headers: headers(requester), body: JSON.stringify({ targetUserId: target.id, swapRequestId: req.body.swapRequest.id }) });
  assert.equal(done.status, 200, JSON.stringify(done.body));
}

test('locking a pod always puts the creator in the final slot', async () => {
  const creator = makeUser('rot_creator');
  const members = [makeUser('rot_a'), makeUser('rot_b'), makeUser('rot_c')];
  for (const u of [creator, ...members]) await fund(u);
  const pod = await getPod((await activePod(creator, members)).id);
  assert.equal(slotOf(pod, creator), 3, 'creator is last of 4');
  assert.equal(pod.hostRewardRecipientUserId, undefined, 'creator holds the reward');
});

test('the 3% host reward follows whoever holds the final slot through chained swaps', async () => {
  const creator = makeUser('chain_creator');
  const a = makeUser('chain_a');
  const b = makeUser('chain_b');
  for (const u of [creator, a, b]) await fund(u);
  const pod = await activePod(creator, [a, b]);

  // Creator gives up the last slot to A: A now holds the reward.
  await swap(pod, creator, a);
  let now = await getPod(pod.id);
  assert.equal(slotOf(now, a), 2);
  assert.equal(now.hostRewardRecipientUserId, a.id);

  // A later trades the last slot to B: the reward moves to B, not stuck with A.
  await swap(pod, a, b);
  now = await getPod(pod.id);
  assert.equal(slotOf(now, b), 2);
  assert.equal(now.hostRewardRecipientUserId, b.id);
});

test('removing a member keeps paid turns in place and the creator last', async () => {
  const creator = makeUser('rm_creator');
  const members = [makeUser('rm_a'), makeUser('rm_b'), makeUser('rm_c')];
  for (const u of [creator, ...members]) await fund(u);
  const pod = await activePod(creator, members);

  // Swap the first two members so list order no longer matches rotation order
  // (removals used to renumber by list position, which then broke the rotation).
  let now = await getPod(pod.id);
  const userAt = (slot: number) => members.find(u => u.id === now.members.find((m: any) => m.rotationIndex === slot).userId)!;
  await swap(pod, userAt(1), userAt(0));

  await sweep('FRIDAY_PAYOUTS'); // pays slot 0, moves to week 2
  now = await getPod(pod.id);
  const paid = now.members.find((m: any) => m.rotationIndex === 0);
  const current = now.members.find((m: any) => m.rotationIndex === 1);
  const future = now.members.find((m: any) => m.rotationIndex === 2);
  assert.equal(paid.hasReceivedPayout, true);

  // Remove the member waiting in a future slot.
  const removed = await api('/api/admin/delinquency/handle', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ podId: pod.id, memberUserId: future.userId, actionChoice: 'REMOVE' }),
  });
  assert.equal(removed.status, 200, JSON.stringify(removed.body));

  now = await getPod(pod.id);
  const byUser = (id: string) => now.members.find((m: any) => m.userId === id);
  assert.equal(byUser(paid.userId).rotationIndex, 0, 'already-paid member keeps their past slot');
  assert.equal(byUser(current.userId).rotationIndex, 1, "this week's recipient is unchanged");
  assert.equal(slotOf(now, creator), 2, 'creator moves up but is still last');
  assert.equal(now.totalCycles, 3);
});
