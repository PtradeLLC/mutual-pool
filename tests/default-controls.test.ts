// Default controls: pod-wide notice, 24-hour removal + account restriction,
// automatic ACH collection, restoration on full repayment, second-default
// notice and the pod pause vote. Runs against a DEMO_MODE server
// (npm run test:integration).
import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const CRON_HEADERS = { 'content-type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' };

let seq = 0;
function makeUser(prefix: string) {
  const nonce = `${Date.now()}_${++seq}_${Math.floor(Math.random() * 1e6)}`;
  return { id: `usr_dc_${prefix}_${nonce}`, name: `DC ${prefix} ${seq}` };
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
async function fund(u: TestUser, amount: number) {
  assert.equal((await api('/api/users/treasury/topup', { method: 'POST', headers: headers(u), body: JSON.stringify({ amount, autoFund: false }) })).status, 200);
}
// Withdraw everything, so a member who happened to receive the week-1 payout
// has nothing left for the week-2 deposit.
async function drain(u: TestUser) {
  const bal = (await api('/api/users/current', { headers: headers(u) })).body.treasury?.balanceUsd || 0;
  if (bal > 0) {
    const r = await api('/api/treasury/payouts/withdraw', { method: 'POST', headers: headers(u), body: JSON.stringify({ amount: bal }) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
}
async function acceptMandate(u: TestUser) {
  assert.equal((await api('/api/users/debit-mandate/accept', { method: 'POST', headers: headers(u), body: JSON.stringify({ last4: '4242', bankName: 'Test Bank' }) })).status, 200);
}
async function activePod(creator: TestUser, members: TestUser[]) {
  const created = await api('/api/pods', {
    method: 'POST',
    headers: headers(creator),
    body: JSON.stringify({ name: `DC Pod ${Date.now()}_${seq}`, sizeTier: 20, depositTier: 20, activationPolicy: 'FLEXIBLE_EARLY' }),
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
  assert.equal(locked.status, 200, JSON.stringify(locked.body));
  return locked.body;
}
async function sweep(type: 'THURSDAY_DEPOSITS' | 'FRIDAY_PAYOUTS') {
  const r = await api('/api/platform/schedule/sweep', { method: 'POST', headers: CRON_HEADERS, body: JSON.stringify({ sweepType: type }) });
  assert.equal(r.status, 200);
  return r.body.result;
}
async function tick(now: Date) {
  const r = await api('/api/platform/schedule/delinquency-tick', { method: 'POST', headers: CRON_HEADERS, body: JSON.stringify({ now: now.toISOString() }) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body as { removed: number; collectionsStarted: number; votesResolved: number };
}
async function stripeEvent(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({ id: `evt_${Date.now()}_${++seq}`, object: 'event', type, data: { object } });
  const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) },
    body: payload,
  });
  return res.status;
}
async function adminDefaults() {
  const r = await api('/api/admin/defaults', { headers: adminHeaders });
  assert.equal(r.status, 200);
  return r.body as { defaults: any[]; summary: any };
}
async function getPod(id: string) {
  return (await api(`/api/pods/${id}`, { headers: adminHeaders })).body;
}
async function notificationsFor(u: TestUser): Promise<any[]> {
  const notes = (await api('/api/notifications', { headers: headers(u) })).body;
  return Array.isArray(notes) ? notes : notes.notifications || [];
}
async function currentUser(u: TestUser) {
  return (await api('/api/users/current', { headers: headers(u) })).body;
}
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000);

test('a missed deposit tells the whole pod, and 24 hours later removes and restricts the member, who is restored once paid in full', async () => {
  await api('/api/users/current', { headers: adminHeaders });
  const creator = makeUser('creator');
  const walker = makeUser('walker');
  const honest = makeUser('honest');
  for (const u of [creator, honest]) { await fund(u, 500); await acceptMandate(u); }
  await fund(walker, 21); await acceptMandate(walker); // week 1 only

  const pod = await activePod(creator, [walker, honest]);
  await sweep('FRIDAY_PAYOUTS');
  await drain(walker);
  const result = await sweep('THURSDAY_DEPOSITS');
  assert.ok(result.failedCount >= 1, JSON.stringify(result.details));

  const d = (await adminDefaults()).defaults.find((x: any) => x.podId === pod.id && x.userId === walker.id);
  assert.ok(d, 'default recorded');
  assert.ok(d.removalDueAt, 'the 24-hour clock is set');
  assert.ok(d.podNotifiedAt, 'the pod was told');

  // Step 1: every other member is told, in-app; the defaulter gets the deadline.
  for (const u of [creator, honest]) {
    const notes = await notificationsFor(u);
    assert.ok(notes.some(n => n.type === 'POD_MEMBER_DEFAULT' && n.metadata?.defaultId === d.id), `${u.name} was told about the default`);
  }
  assert.ok((await notificationsFor(walker)).some(n => n.type === 'PAYMENT_FAILED' && /24 hours/.test(n.message)), 'defaulter sees the 24-hour deadline');

  // Not yet due: nothing happens.
  const early = await tick(hoursFromNow(1));
  assert.equal(early.removed, 0);
  assert.ok((await getPod(pod.id)).members.some((m: any) => m.userId === walker.id), 'still in the pod before the deadline');
  assert.equal((await currentUser(walker)).accountRestriction, undefined);

  // Step 2 + 3: past the deadline, out of the pod, restricted, collection started.
  const late = await tick(hoursFromNow(25));
  assert.ok(late.removed >= 1, JSON.stringify(late));
  const after = await getPod(pod.id);
  assert.ok(!after.members.some((m: any) => m.userId === walker.id), 'removed from the pod');
  assert.ok((after.auditLogs || []).some((l: any) => l.action === 'MEMBER_AUTO_REMOVED'));
  // A private pod is not listed publicly by itself: the remaining members vote on it.
  assert.equal(after.podType, 'TRUSTED_CIRCLE');
  assert.ok(!after.isPrioritizedForReplacement);
  assert.equal(after.replacementVote?.status, 'OPEN');
  assert.equal(after.replacementVote.removedUserId, walker.id);
  assert.deepEqual([...after.replacementVote.eligibleVoterIds].sort(), [creator.id, honest.id].sort());
  assert.ok((await notificationsFor(honest)).some(n => n.type === 'POD_REPLACEMENT_VOTE'));
  assert.equal((await api(`/api/pods/${pod.id}/replacement-vote`, { method: 'POST', headers: headers(walker), body: JSON.stringify({ choice: 'OPEN' }) })).status, 403, 'the removed member cannot vote');
  assert.equal((await api(`/api/pods/${pod.id}/replacement-vote`, { method: 'POST', headers: headers(honest), body: JSON.stringify({ choice: 'OPEN' }) })).body.podType, 'TRUSTED_CIRCLE', 'one of two is not a majority');
  const opened = await api(`/api/pods/${pod.id}/replacement-vote`, { method: 'POST', headers: headers(creator), body: JSON.stringify({ choice: 'OPEN' }) });
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  assert.equal(opened.body.podType, 'OPEN_POD');
  const listed = await getPod(pod.id);
  assert.equal(listed.isPrioritizedForReplacement, true, 'pod listed for a replacement after the vote');
  assert.equal(listed.replacementVote.outcome, 'OPEN');
  assert.ok((listed.auditLogs || []).some((l: any) => l.action === 'POD_OPENED_TO_PUBLIC'));
  const restricted = await currentUser(walker);
  assert.equal(restricted.accountRestriction?.status, 'RESTRICTED');
  assert.ok(restricted.accountRestriction.owedUsd >= 20);
  assert.ok((await notificationsFor(honest)).some(n => n.type === 'STATUS_CHANGE' && /removed/i.test(n.title)), 'pod told about the removal');
  assert.ok((await notificationsFor(walker)).some(n => n.type === 'ACCOUNT_RESTRICTED'));

  // Restricted: cannot create or join; the mandate and KYC are still fine.
  const create = await api('/api/pods', { method: 'POST', headers: headers(walker), body: JSON.stringify({ name: `DC Blocked ${Date.now()}`, sizeTier: 20, depositTier: 20 }) });
  assert.equal(create.status, 403);
  assert.equal(create.body.error, 'ACCOUNT_RESTRICTED');
  const other = await api('/api/pods', { method: 'POST', headers: headers(honest), body: JSON.stringify({ name: `DC Other ${Date.now()}`, sizeTier: 20, depositTier: 20 }) });
  assert.equal(other.status, 200);
  const join = await api(`/api/pods/${other.body.id}/join`, { method: 'POST', headers: headers(walker), body: JSON.stringify({ inviteCode: other.body.inviteCode }) });
  assert.equal(join.status, 403);
  assert.equal(join.body.error, 'ACCOUNT_RESTRICTED');

  // Collection started automatically under the mandate (demo Stripe).
  const collecting = (await adminDefaults()).defaults.find((x: any) => x.id === d.id);
  assert.equal(collecting.status, 'COLLECTING');
  assert.ok(collecting.collectionStartedAt);
  const collection = collecting.collections[0];
  assert.equal(collection.status, 'PROCESSING');
  assert.ok(collection.stripePaymentIntentId.startsWith('pi_'));
  assert.equal(collection.amountUsd, collecting.remainingUsd, 'collects everything still owed');

  // Paid in full (the debit settles): account restored automatically.
  assert.equal(await stripeEvent('payment_intent.succeeded', { id: collection.stripePaymentIntentId, object: 'payment_intent', amount: Math.round(collection.amountUsd * 100), metadata: { kind: 'ach_default_collection', collectionId: collection.id, defaultId: d.id } }), 200);
  const settled = (await adminDefaults()).defaults.find((x: any) => x.id === d.id);
  assert.equal(settled.status, 'RECOVERED');
  const restoredUser = await currentUser(walker);
  assert.equal(restoredUser.accountRestriction, undefined, 'restriction lifted');
  assert.ok((await notificationsFor(walker)).some(n => n.type === 'ACCOUNT_RESTORED'));
  await fund(walker, 25); // a first deposit is charged on join
  const rejoin = await api(`/api/pods/${other.body.id}/join`, { method: 'POST', headers: headers(walker), body: JSON.stringify({ inviteCode: other.body.inviteCode }) });
  assert.equal(rejoin.status, 200, 'can join again: ' + JSON.stringify(rejoin.body));
});

test('a second default in the same pod notifies that member and opens a pause vote; a majority pauses the pod', async () => {
  const creator = makeUser('creator');
  const a = makeUser('walkerA');
  const b = makeUser('walkerB');
  const h1 = makeUser('honest1');
  const h2 = makeUser('honest2');
  for (const u of [creator, h1, h2]) { await fund(u, 500); await acceptMandate(u); }
  for (const u of [a, b]) { await fund(u, 21); await acceptMandate(u); }

  const pod = await activePod(creator, [a, b, h1, h2]);
  await sweep('FRIDAY_PAYOUTS');
  await drain(a); await drain(b);
  await sweep('THURSDAY_DEPOSITS');

  const { defaults } = await adminDefaults();
  const dA = defaults.find((x: any) => x.podId === pod.id && x.userId === a.id);
  const dB = defaults.find((x: any) => x.podId === pod.id && x.userId === b.id);
  assert.ok(dA && dB, 'both walkers defaulted');
  const second = [dA, dB].find((x: any) => x.secondDefaultNoticeAt);
  assert.ok(second, 'the second defaulter was given the second-default notice');
  const secondUser = second.userId === a.id ? a : b;
  assert.ok((await notificationsFor(secondUser)).some(n => /second default/i.test(n.title)));

  // Step 5: pause vote open for the members not in default.
  let p = await getPod(pod.id);
  assert.equal(p.status, 'ACTIVE');
  assert.equal(p.pauseVote?.status, 'OPEN');
  assert.deepEqual([...p.pauseVote.defaulterUserIds].sort(), [a.id, b.id].sort());
  assert.deepEqual([...p.pauseVote.eligibleVoterIds].sort(), [creator.id, h1.id, h2.id].sort());
  for (const u of [creator, h1, h2]) {
    assert.ok((await notificationsFor(u)).some(n => n.type === 'POD_PAUSE_VOTE'), `${u.name} got the pause notice`);
  }
  // Defaulters cannot vote.
  assert.equal((await api(`/api/pods/${pod.id}/pause-vote`, { method: 'POST', headers: headers(a), body: JSON.stringify({ choice: 'COVER' }) })).status, 403);

  // One vote is not a majority of three.
  const v1 = await api(`/api/pods/${pod.id}/pause-vote`, { method: 'POST', headers: headers(h1), body: JSON.stringify({ choice: 'PAUSE' }) });
  assert.equal(v1.status, 200, JSON.stringify(v1.body));
  assert.equal(v1.body.podStatus, 'ACTIVE');
  // Two of three: paused.
  const v2 = await api(`/api/pods/${pod.id}/pause-vote`, { method: 'POST', headers: headers(h2), body: JSON.stringify({ choice: 'PAUSE' }) });
  assert.equal(v2.status, 200);
  assert.equal(v2.body.podStatus, 'PAUSED');
  p = await getPod(pod.id);
  assert.equal(p.status, 'PAUSED');
  assert.equal(p.pauseVote.outcome, 'PAUSE');
  assert.ok((p.auditLogs || []).some((l: any) => l.action === 'POD_PAUSED'));
  for (const u of [creator, h1, h2]) {
    assert.ok((await notificationsFor(u)).some(n => n.type === 'POD_PAUSED'));
  }
  // Paused pods are skipped by the sweeps.
  const weekBefore = p.currentCycleWeek;
  await sweep('THURSDAY_DEPOSITS');
  await sweep('FRIDAY_PAYOUTS');
  assert.equal((await getPod(pod.id)).currentCycleWeek, weekBefore, 'no cycle advanced while paused');

  // Admin resumes (forced, the defaults are still open).
  assert.equal((await api(`/api/admin/pods/${pod.id}/resume`, { method: 'POST', headers: adminHeaders, body: '{}' })).status, 409);
  const resumed = await api(`/api/admin/pods/${pod.id}/resume`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ force: true }) });
  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.pod.status, 'ACTIVE');
});

test('members may instead vote to cover: the missing deposits are split among those not in default', async () => {
  const creator = makeUser('creator');
  const a = makeUser('walkerA');
  const b = makeUser('walkerB');
  const h1 = makeUser('honest1');
  for (const u of [creator, h1]) { await fund(u, 500); await acceptMandate(u); }
  for (const u of [a, b]) { await fund(u, 21); await acceptMandate(u); }

  const pod = await activePod(creator, [a, b, h1]);
  await sweep('FRIDAY_PAYOUTS');
  await drain(a); await drain(b);
  await sweep('THURSDAY_DEPOSITS');
  let p = await getPod(pod.id);
  assert.equal(p.pauseVote?.status, 'OPEN');
  assert.equal(p.pauseVote.eligibleVoterIds.length, 2);

  const before = (await currentUser(h1)).treasury.balanceUsd;
  // Two of two vote COVER: pod stays active and the shortfall is split now.
  assert.equal((await api(`/api/pods/${pod.id}/pause-vote`, { method: 'POST', headers: headers(h1), body: JSON.stringify({ choice: 'COVER' }) })).body.podStatus, 'ACTIVE');
  const v2 = await api(`/api/pods/${pod.id}/pause-vote`, { method: 'POST', headers: headers(creator), body: JSON.stringify({ choice: 'COVER' }) });
  assert.equal(v2.status, 200);
  p = await getPod(pod.id);
  assert.equal(p.status, 'ACTIVE');
  assert.equal(p.pauseVote.outcome, 'COVER');
  assert.equal(p.coverShareActive, true);
  const charged = (p.auditLogs || []).find((l: any) => l.action === 'COVER_SHARE_CHARGED');
  assert.ok(charged, 'cover share charged');
  assert.ok(charged.metadata.shareUsd > 0);
  const after = (await currentUser(h1)).treasury.balanceUsd;
  assert.ok(after < before, 'the covering member paid their share');
  assert.ok((await notificationsFor(h1)).some(n => /cover share/i.test(n.title)));

  // A vote window that expires with nobody deciding pauses the pod.
  const creator2 = makeUser('creator2');
  const c = makeUser('walkerC');
  const dd = makeUser('walkerD');
  const h3 = makeUser('honest3');
  for (const u of [creator2, h3]) { await fund(u, 500); await acceptMandate(u); }
  for (const u of [c, dd]) { await fund(u, 21); await acceptMandate(u); }
  const pod2 = await activePod(creator2, [c, dd, h3]);
  await sweep('FRIDAY_PAYOUTS');
  await drain(c); await drain(dd);
  await sweep('THURSDAY_DEPOSITS');
  assert.equal((await getPod(pod2.id)).pauseVote?.status, 'OPEN');
  const stillOpen = await tick(hoursFromNow(1));
  assert.equal((await getPod(pod2.id)).pauseVote?.status, 'OPEN', JSON.stringify(stillOpen));
  const expired = await tick(hoursFromNow(72));
  assert.ok(expired.votesResolved >= 1, JSON.stringify(expired));
  const paused = await getPod(pod2.id);
  assert.equal(paused.status, 'PAUSED');
  assert.equal(paused.pauseVote.outcome, 'PAUSE');
});

test('when every member has been paid, the creator is offered a new round or closing; a new round links the pods and invites the members', async () => {
  const creator = makeUser('creator');
  const partner = makeUser('partner');
  for (const u of [creator, partner]) { await fund(u, 500); await acceptMandate(u); }
  const pod = await activePod(creator, [partner]); // 2 members: two weekly cycles
  await sweep('FRIDAY_PAYOUTS');   // week 1 paid
  await sweep('THURSDAY_DEPOSITS');
  await sweep('FRIDAY_PAYOUTS');   // week 2 paid: complete
  const done = await getPod(pod.id);
  assert.equal(done.status, 'COMPLETED', JSON.stringify({ status: done.status, week: done.currentCycleWeek, total: done.totalCycles }));
  assert.equal(done.renewalDecision, 'PENDING');
  assert.ok(done.completedAt);
  assert.ok((await notificationsFor(creator)).some(n => n.type === 'POD_COMPLETED' && n.metadata?.renewal === true), 'creator offered the choice');
  assert.ok((await notificationsFor(partner)).some(n => n.type === 'POD_COMPLETED'), 'member thanked');

  // Only the creator decides; a member cannot close it.
  assert.equal((await api(`/api/pods/${pod.id}/renewal`, { method: 'POST', headers: headers(partner), body: JSON.stringify({ decision: 'CLOSE' }) })).status, 403);

  // Start a new round: a pod created with renewedFromPodId links back and invites the previous members.
  const renewed = await api('/api/pods', {
    method: 'POST',
    headers: headers(creator),
    body: JSON.stringify({ name: `${done.name} · Round 2`, sizeTier: done.sizeTier, depositTier: done.depositTier, podType: done.podType, activationPolicy: 'FLEXIBLE_EARLY', renewedFromPodId: pod.id }),
  });
  assert.equal(renewed.status, 200, JSON.stringify(renewed.body));
  assert.equal(renewed.body.renewedFromPodId, pod.id);
  const old = await getPod(pod.id);
  assert.equal(old.renewalDecision, 'RENEWED');
  assert.equal(old.renewedToPodId, renewed.body.id);
  const invite = (await notificationsFor(partner)).find(n => n.metadata?.renewedFromPodId === pod.id);
  assert.ok(invite, 'previous member invited to the new round');
  assert.equal(invite.metadata.inviteCode, renewed.body.inviteCode);
  // Closing is no longer possible once renewed; a second renewal is ignored.
  assert.equal((await api(`/api/pods/${pod.id}/renewal`, { method: 'POST', headers: headers(creator), body: JSON.stringify({ decision: 'CLOSE' }) })).status, 409);

  // A different completed pod can simply be closed.
  const creator2 = makeUser('creator2');
  const partner2 = makeUser('partner2');
  for (const u of [creator2, partner2]) { await fund(u, 500); await acceptMandate(u); }
  const pod2 = await activePod(creator2, [partner2]);
  await sweep('FRIDAY_PAYOUTS'); await sweep('THURSDAY_DEPOSITS'); await sweep('FRIDAY_PAYOUTS');
  assert.equal((await getPod(pod2.id)).status, 'COMPLETED');
  const closed = await api(`/api/pods/${pod2.id}/renewal`, { method: 'POST', headers: headers(creator2), body: JSON.stringify({ decision: 'CLOSE' }) });
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  assert.equal(closed.body.pod.renewalDecision, 'CLOSED');
  assert.ok((await notificationsFor(partner2)).some(n => /closed/i.test(n.title)));
});
