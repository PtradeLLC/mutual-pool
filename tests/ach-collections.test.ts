// Deposit defaults are reported to admins and recovered by ACH debit under the
// member's mandate. Runs against a DEMO_MODE server (npm run test:integration).
import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const CRON_HEADERS = { 'content-type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' };

let seq = 0;
function makeUser(prefix: string) {
  const nonce = `${Date.now()}_${++seq}_${Math.floor(Math.random() * 1e6)}`;
  return { id: `usr_ach_${prefix}_${nonce}`, name: `ACH ${prefix} ${seq}` };
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

// Demo top-up, with the demo sweep's auto-refill switched off so a member can
// actually miss a deposit.
async function fund(u: TestUser, amount: number) {
  assert.equal((await api('/api/users/treasury/topup', { method: 'POST', headers: headers(u), body: JSON.stringify({ amount, autoFund: false }) })).status, 200);
}
// Withdraw everything (a member "walking away" with the pot).
async function drain(u: TestUser) {
  const bal = (await api('/api/users/current', { headers: headers(u) })).body.treasury.balanceUsd;
  if (bal > 0) {
    const r = await api('/api/treasury/payouts/withdraw', { method: 'POST', headers: headers(u), body: JSON.stringify({ amount: bal }) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
}
async function acceptMandate(u: TestUser) {
  assert.equal((await api('/api/users/debit-mandate/accept', { method: 'POST', headers: headers(u), body: JSON.stringify({ last4: '4242', bankName: 'Test Bank' }) })).status, 200);
}

// Creator + members, locked (week-1 deposits charged at create/join).
async function activePod(creator: TestUser, members: TestUser[]) {
  const created = await api('/api/pods', {
    method: 'POST',
    headers: headers(creator),
    body: JSON.stringify({ name: `ACH Pod ${Date.now()}_${seq}`, sizeTier: 20, depositTier: 20, activationPolicy: 'FLEXIBLE_EARLY' }),
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

test('joining without a bank debit mandate is refused', async () => {
  const creator = makeUser('creator');
  const noMandate = makeUser('nomandate');
  await fund(creator, 500); await acceptMandate(creator);
  await fund(noMandate, 500);
  const created = await api('/api/pods', { method: 'POST', headers: headers(creator), body: JSON.stringify({ name: `ACH Gate ${Date.now()}`, sizeTier: 20, depositTier: 20 }) });
  assert.equal(created.status, 200);
  const joined = await api(`/api/pods/${created.body.id}/join`, { method: 'POST', headers: headers(noMandate), body: JSON.stringify({ inviteCode: created.body.inviteCode }) });
  assert.equal(joined.status, 403);
  assert.equal(joined.body.error, 'DEBIT_MANDATE_REQUIRED');
  await acceptMandate(noMandate);
  const current = (await api('/api/users/current', { headers: headers(noMandate) })).body;
  assert.equal(current.debitMandate?.status, 'ACTIVE');
  assert.equal(current.debitMandate?.last4, '4242');
  assert.equal((await api(`/api/pods/${created.body.id}/join`, { method: 'POST', headers: headers(noMandate), body: JSON.stringify({ inviteCode: created.body.inviteCode }) })).status, 200);
});

test('a member who takes the pot and misses the next deposit is reported to admins and collected by ACH', async () => {
  // Make sure the admin exists before the default is recorded so they get the notification.
  await api('/api/users/current', { headers: adminHeaders });

  const creator = makeUser('creator');
  const walker = makeUser('walker'); // will receive week 1 and then stop
  const honest = makeUser('honest');
  // Everyone can afford every week; only whoever takes the week-1 pot will walk away.
  for (const u of [creator, walker, honest]) { await fund(u, 500); await acceptMandate(u); }

  const pod = await activePod(creator, [walker, honest]);
  const members: any[] = pod.members;
  // Slot 1 is held by a seasoned member chosen at random; find whoever holds it and
  // make the test about them if it is the walker, otherwise drain the slot-1 holder.
  const slot1 = members.find(m => m.rotationIndex === 0);
  const defaulter = slot1.userId === walker.id ? walker : slot1.userId === honest.id ? honest : creator;
  assert.notEqual(defaulter.id, creator.id, 'creator is never in slot 1');

  // Week 1 payout goes to the slot-1 holder; then they withdraw it all (walk away).
  await sweep('FRIDAY_PAYOUTS');
  const paidPod = await getPod(pod.id);
  const paidMember = paidPod.members.find((m: any) => m.userId === defaulter.id);
  assert.equal(paidMember.hasReceivedPayout, true);
  assert.ok((await api('/api/users/current', { headers: headers(defaulter) })).body.treasury.balanceUsd > 0);
  await drain(defaulter);

  // Week 2 Thursday sweep: their debit fails. The welcome match buffer ($20) bridges it.
  const result = await sweep('THURSDAY_DEPOSITS');
  assert.ok(result.failedCount >= 1, JSON.stringify(result.details));

  const { defaults, summary } = await adminDefaults();
  const d = defaults.find((x: any) => x.podId === pod.id && x.userId === defaulter.id);
  assert.ok(d, 'default recorded for the member who missed the deposit');
  assert.equal(d.status, 'OPEN');
  assert.ok(d.cycleWeek >= 2);
  assert.equal(d.trigger, 'THURSDAY_SWEEP');
  assert.equal(d.bufferCoveredUsd, 20, 'welcome match bridged the pot');
  assert.equal(d.owedUsd, 20);
  assert.equal(d.remainingUsd, 20);
  assert.ok(d.payoutReceivedUsd > 0, 'flagged as a default after taking the payout');
  assert.equal(d.memberMandate.status, 'ACTIVE');
  assert.ok(summary.openCount >= 1);
  assert.ok(summary.payoutThenDefaultCount >= 1);

  const afterSweep = await getPod(pod.id);
  assert.equal(afterSweep.members.find((m: any) => m.userId === defaulter.id).delinquencyStatus, 'GRACE_PERIOD');
  assert.equal(afterSweep.contingencyBufferUsd, 5, 'welcome match $20 + $5 of contributions, minus the $20 bridge');

  // Admins were notified in-app.
  const notes = (await api('/api/notifications', { headers: adminHeaders })).body;
  const list: any[] = Array.isArray(notes) ? notes : notes.notifications || [];
  assert.ok(list.some(n => n.metadata?.defaultId === d.id), 'admin notification carries the default id');

  // Non-admins can't see or act on defaults.
  assert.equal((await api('/api/admin/defaults', { headers: headers(honest) })).status, 403);
  assert.equal((await api(`/api/admin/defaults/${d.id}/collect`, { method: 'POST', headers: headers(honest), body: '{}' })).status, 403);

  // Admin collects the full remaining amount by ACH.
  const tooMuch = await api(`/api/admin/defaults/${d.id}/collect`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ amountUsd: 25 }) });
  assert.equal(tooMuch.status, 400);
  const collect = await api(`/api/admin/defaults/${d.id}/collect`, { method: 'POST', headers: adminHeaders, body: '{}' });
  assert.equal(collect.status, 200, JSON.stringify(collect.body));
  assert.equal(collect.body.collection.status, 'PROCESSING');
  assert.equal(collect.body.collection.amountUsd, 20);
  assert.equal(collect.body.default.status, 'COLLECTING');
  const piId = collect.body.collection.stripePaymentIntentId;
  assert.ok(piId.startsWith('pi_'));

  // Only one debit in flight at a time.
  assert.equal((await api(`/api/admin/defaults/${d.id}/collect`, { method: 'POST', headers: adminHeaders, body: '{}' })).status, 409);

  // Member was told.
  const memberNotes = (await api('/api/notifications', { headers: headers(defaulter) })).body;
  const memberList: any[] = Array.isArray(memberNotes) ? memberNotes : memberNotes.notifications || [];
  assert.ok(memberList.some(n => n.metadata?.collectionId === collect.body.collection.id));

  // Stripe settles the debit (signed webhook, idempotent on redelivery).
  for (let i = 0; i < 2; i++) {
    assert.equal(await stripeEvent('payment_intent.succeeded', { id: piId, object: 'payment_intent', amount: 2000, metadata: { kind: 'ach_default_collection', collectionId: collect.body.collection.id, defaultId: d.id } }), 200);
  }

  const settled = (await adminDefaults()).defaults.find((x: any) => x.id === d.id);
  assert.equal(settled.status, 'RECOVERED');
  assert.equal(settled.recoveredUsd, 20);
  assert.equal(settled.remainingUsd, 0);
  assert.equal(settled.collections[0].status, 'SUCCEEDED');
  const restored = await getPod(pod.id);
  assert.equal(restored.contingencyBufferUsd, 25, 'the recovered money restored the buffer');
  assert.ok((restored.auditLogs || []).some((l: any) => l.action === 'ACH_COLLECTION_SETTLED'));
  assert.equal(restored.members.find((m: any) => m.userId === defaulter.id).delinquencyStatus, 'CLEAN');
});

test('a failed ACH debit reopens the default; write-off closes it', async () => {
  const creator = makeUser('creator');
  const member = makeUser('member');
  await fund(creator, 500); await acceptMandate(creator);
  await fund(member, 21); await acceptMandate(member);
  const pod = await activePod(creator, [member]);

  await sweep('FRIDAY_PAYOUTS'); // week 1 paid to the member (slot 1)
  await drain(member); // ...who walks away with it
  await sweep('THURSDAY_DEPOSITS'); // week 2: member (no balance) misses
  const d = (await adminDefaults()).defaults.find((x: any) => x.podId === pod.id && x.userId === member.id);
  assert.ok(d);

  const collect = await api(`/api/admin/defaults/${d.id}/collect`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ amountUsd: 10 }) });
  assert.equal(collect.status, 200, JSON.stringify(collect.body));
  const piId = collect.body.collection.stripePaymentIntentId;
  assert.equal(await stripeEvent('payment_intent.payment_failed', { id: piId, object: 'payment_intent', metadata: { kind: 'ach_default_collection' }, last_payment_error: { message: 'Insufficient funds (R01)' } }), 200);

  let current = (await adminDefaults()).defaults.find((x: any) => x.id === d.id);
  assert.equal(current.status, 'OPEN');
  assert.equal(current.recoveredUsd, 0);
  assert.equal(current.collections[0].status, 'FAILED');
  assert.match(current.collections[0].failureReason, /R01/);

  const wo = await api(`/api/admin/defaults/${d.id}/write-off`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ reason: 'Uncollectible' }) });
  assert.equal(wo.status, 200);
  current = (await adminDefaults()).defaults.find((x: any) => x.id === d.id);
  assert.equal(current.status, 'WRITTEN_OFF');
  assert.equal((await api(`/api/admin/defaults/${d.id}/collect`, { method: 'POST', headers: adminHeaders, body: '{}' })).status, 400);
});

test('a late member deposit repays the bridged default instead of counting twice', async () => {
  const creator = makeUser('creator');
  const member = makeUser('member');
  await fund(creator, 500); await acceptMandate(creator);
  await fund(member, 21); await acceptMandate(member);
  const pod = await activePod(creator, [member]);
  await sweep('FRIDAY_PAYOUTS');
  await drain(member);
  await sweep('THURSDAY_DEPOSITS'); // member misses; buffer bridges $20 into the pot
  let p = await getPod(pod.id);
  assert.equal(p.currentWeeklyCollected, 40, 'creator deposit + bridged deposit');
  assert.equal(p.contingencyBufferUsd, 3, '$20 welcome + $3 contributions, minus the $20 bridge');

  await fund(member, 100);
  const dep = await api(`/api/pods/${pod.id}/deposit`, { method: 'POST', headers: headers(member), body: '{}' });
  assert.equal(dep.status, 200, JSON.stringify(dep.body));
  p = await getPod(pod.id);
  assert.equal(p.currentWeeklyCollected, 40, 'pot not double counted');
  assert.equal(p.contingencyBufferUsd, 24, 'buffer restored by the late deposit plus its $1 contribution');
  const d = (await adminDefaults()).defaults.find((x: any) => x.podId === pod.id && x.userId === member.id);
  assert.equal(d.status, 'RECOVERED');
  assert.equal(d.recoveries[0].source, 'MEMBER_DEPOSIT');
});
