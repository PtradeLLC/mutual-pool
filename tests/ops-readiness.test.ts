// Production-readiness fixes, end to end: campaign catalog, contact form,
// card top-up reversals and account holds, sweep run records, review queue.
// Runs against a DEMO_MODE server (npm run test:integration).
import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const CRON_HEADERS = { 'content-type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' };

let seq = 0;
function makeUser(prefix: string) {
  const nonce = `${Date.now()}_${++seq}_${Math.floor(Math.random() * 1e6)}`;
  return { id: `usr_ops_${prefix}_${nonce}`, name: `Ops ${prefix} ${seq}` };
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
  return { status: res.status, body: await res.json().catch(() => ({})) };
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

test('campaigns come from a server catalog: advertisers submit, admins approve, couriers see only approved ones', async () => {
  const advertiser = makeUser('adv');
  const courier = makeUser('courier');
  const submitted = await api('/api/campaigns', { method: 'POST', headers: headers(advertiser), body: JSON.stringify({ title: 'Ops Brand', brandName: 'OpsCo', dailyPayout: 80, gearRequired: ['Vest'], targetMetro: 'Austin' }) });
  assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
  const id = submitted.body.campaign.id;
  assert.equal(submitted.body.campaign.status, 'pending');

  // Daily payout is validated and capped server-side.
  const tooMuch = await api('/api/campaigns', { method: 'POST', headers: headers(advertiser), body: JSON.stringify({ title: 'X', brandName: 'Y', dailyPayout: 5000 }) });
  assert.equal(tooMuch.status, 400);

  // Courier can't see or start a pending campaign.
  const courierList = (await api('/api/campaigns', { headers: headers(courier) })).body.campaigns;
  assert.ok(!courierList.some((c: any) => c.id === id));
  const start = await api('/api/campaigns/shifts/start', { method: 'POST', headers: headers(courier), body: JSON.stringify({ campaignId: id, sampleTag: 'MATCH_ACTIVE_CAMPAIGN' }) });
  assert.equal(start.status, 400);
  assert.equal(start.body.error, 'INVALID_CAMPAIGN');
  // ...and can't smuggle a campaign object with its own pay rate.
  const smuggled = await api('/api/campaigns/shifts/start', { method: 'POST', headers: headers(courier), body: JSON.stringify({ campaign: { id: 'x', brandName: 'Me', dailyPayout: 1000 }, sampleTag: 'MATCH_ACTIVE_CAMPAIGN' }) });
  assert.equal(smuggled.status, 400);

  // The advertiser sees their own pending campaign; the admin approves it.
  assert.ok((await api('/api/campaigns', { headers: headers(advertiser) })).body.campaigns.some((c: any) => c.id === id));
  const approved = await api(`/api/admin/campaigns/${id}/status`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ status: 'recruiting' }) });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.ok((await api('/api/campaigns', { headers: headers(courier) })).body.campaigns.some((c: any) => c.id === id && c.dailyPayout === 80));

  // Advertiser can pause their approved campaign; strangers cannot.
  assert.equal((await api(`/api/campaigns/${id}/status`, { method: 'POST', headers: headers(courier), body: JSON.stringify({ status: 'paused' }) })).status, 403);
  assert.equal((await api(`/api/campaigns/${id}/status`, { method: 'POST', headers: headers(advertiser), body: JSON.stringify({ status: 'paused' }) })).status, 200);
});

test('the contact form stores the message and reaches the admin review queue', async () => {
  const r = await fetch(`${BASE_URL}/api/support/contact`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Visitor', email: 'visitor@example.test', message: `Hello ${Date.now()}` }) });
  assert.equal(r.status, 200);
  assert.equal((await fetch(`${BASE_URL}/api/support/contact`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'not-an-email', message: 'x' }) })).status, 400);
  const reviews = await api('/api/admin/reviews', { headers: adminHeaders });
  assert.equal(reviews.status, 200);
  assert.ok(reviews.body.supportMessages.some((m: any) => m.email === 'visitor@example.test'));
});

test('a refunded or disputed card top-up is reversed and puts the account on hold until an admin clears it', async () => {
  const member = makeUser('cardback');
  await api('/api/users/current', { headers: headers(member) });
  const piId = `pi_ops_${Date.now()}_${seq}`;
  // Stripe confirms a $100 card top-up via Checkout.
  assert.equal(await stripeEvent('checkout.session.completed', { id: `cs_ops_${seq}`, object: 'checkout.session', mode: 'payment', payment_status: 'paid', payment_intent: piId, metadata: { kind: 'treasury_topup', userId: member.id, depositAmountUsd: '100.00' } }), 200);
  let me = (await api('/api/users/current', { headers: headers(member) })).body;
  assert.equal(me.treasury.balanceUsd, 100);

  // They spend $30 (demo top-up negative isn't possible, so withdraw $30), then the cardholder disputes.
  assert.equal((await api('/api/treasury/payouts/withdraw', { method: 'POST', headers: headers(member), body: JSON.stringify({ amount: 30 }) })).status, 200);
  assert.equal(await stripeEvent('charge.dispute.created', { id: `dp_${seq}`, object: 'dispute', payment_intent: piId, amount: 10000, reason: 'fraudulent' }), 200);

  me = (await api('/api/users/current', { headers: headers(member) })).body;
  assert.equal(me.treasury.balanceUsd, 0, 'what was left of the top-up is taken back');
  assert.ok(me.riskHold, 'account is on hold');
  assert.equal(me.riskHold.amountUsd, 30, 'the part already withdrawn is still owed');

  // Hold blocks withdrawals and new pods.
  const blocked = await api('/api/treasury/payouts/withdraw', { method: 'POST', headers: headers(member), body: JSON.stringify({ amount: 1 }) });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error, 'ACCOUNT_ON_HOLD');

  // Redelivery of the same event changes nothing.
  assert.equal(await stripeEvent('charge.dispute.created', { id: `dp_${seq}`, object: 'dispute', payment_intent: piId, amount: 10000, reason: 'fraudulent' }), 200);
  assert.equal((await api('/api/users/current', { headers: headers(member) })).body.riskHold.amountUsd, 30);

  // Admin sees it in the review queue and clears it.
  const reviews = (await api('/api/admin/reviews', { headers: adminHeaders })).body;
  assert.ok(reviews.riskHolds.some((h: any) => h.userId === member.id));
  assert.equal((await api(`/api/admin/users/${member.id}/clear-hold`, { method: 'POST', headers: headers(member), body: '{}' })).status, 403);
  assert.equal((await api(`/api/admin/users/${member.id}/clear-hold`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ note: 'Member repaid by check' }) })).status, 200);
  assert.equal((await api('/api/users/current', { headers: headers(member) })).body.riskHold, undefined);
});

test('sweep runs are recorded per settlement week and visible to admins; the cron secret cannot pay out pods', async () => {
  const r = await api('/api/platform/schedule/sweep', { method: 'POST', headers: CRON_HEADERS, body: JSON.stringify({ sweepType: 'THURSDAY_DEPOSITS' }) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(typeof r.body.result.success, 'boolean');
  const health = (await api('/api/health', { headers: adminHeaders })).body;
  assert.ok(Array.isArray(health.sweeps));
  const run = health.sweeps.find((x: any) => x.type === 'THURSDAY_DEPOSITS');
  assert.ok(run, 'sweep run recorded');
  assert.ok(run.weekKey && run.completedAt && run.trigger === 'CRON');
  assert.ok(health.incidentsLast24h && typeof health.incidentsLast24h.total === 'number');
  assert.ok(health.mailer && typeof health.mailer.queued === 'number');

  assert.equal((await api('/api/pods/pod_x/cycle/process', { method: 'POST', headers: CRON_HEADERS, body: '{}' })).status, 403);
  assert.equal((await api('/api/pods/pod_x/system-deposit', { method: 'POST', headers: CRON_HEADERS, body: '{}' })).status, 403);
});

test('a join request cannot be processed twice at once', async () => {
  const creator = makeUser('creator');
  const joiner = makeUser('joiner');
  for (const u of [creator, joiner]) {
    assert.equal((await api('/api/users/treasury/topup', { method: 'POST', headers: headers(u), body: JSON.stringify({ amount: 500 }) })).status, 200);
    assert.equal((await api('/api/users/debit-mandate/accept', { method: 'POST', headers: headers(u), body: '{}' })).status, 200);
  }
  const pod = (await api('/api/pods', { method: 'POST', headers: headers(creator), body: JSON.stringify({ name: `Ops Pod ${Date.now()}`, sizeTier: 20, depositTier: 20 }) })).body;
  const [a, b] = await Promise.all([
    api(`/api/pods/${pod.id}/join`, { method: 'POST', headers: headers(joiner), body: JSON.stringify({ inviteCode: pod.inviteCode }) }),
    api(`/api/pods/${pod.id}/join`, { method: 'POST', headers: headers(joiner), body: JSON.stringify({ inviteCode: pod.inviteCode }) }),
  ]);
  const statuses = [a.status, b.status].sort();
  assert.ok(statuses[0] === 200 && (statuses[1] === 400 || statuses[1] === 409), `got ${statuses}`);
  const members = (await api(`/api/pods/${pod.id}`, { headers: adminHeaders })).body.members.filter((m: any) => m.userId === joiner.id);
  assert.equal(members.length, 1, 'joined exactly once');
  const balance = (await api('/api/users/current', { headers: headers(joiner) })).body.treasury.balanceUsd;
  assert.equal(balance, 479, 'charged exactly once');
});
