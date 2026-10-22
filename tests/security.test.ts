// Security regression tests. Run against a server WITHOUT DEMO_MODE:
//   npm run test:security
import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

const spoofHeaders = {
  'content-type': 'application/json',
  'x-user-id': 'usr_chris_admin',
  'x-user-email': 'chrisbitoy@gmail.com',
  'x-user-role': 'Admin',
  'x-user-kyc-status': 'VERIFIED',
};

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, body, headers: res.headers };
}

test('identity headers and query params are ignored', async () => {
  assert.equal((await call('/api/users/current', { headers: spoofHeaders })).status, 401);
  assert.equal((await call('/api/users/current?userId=usr_chris_admin')).status, 401);
  assert.equal((await call('/api/users', { headers: spoofHeaders })).status, 401);
  assert.equal((await call('/api/chats/threads?userId=usr_verified_101', { headers: spoofHeaders })).status, 401);
});

test('demo and forged bearer tokens are rejected', async () => {
  for (const token of ['usr_chris_admin', 'demo_token_usr_chris_admin', 'not-a-jwt']) {
    const res = await call('/api/users/current', { headers: { authorization: `Bearer ${token}` } });
    assert.equal(res.status, 401, `token ${token} should be rejected`);
  }
});

test('admin endpoints cannot be reached by spoofing', async () => {
  assert.equal((await call('/api/admin/perks/pending?email=chrisbitoy@gmail.com', { headers: spoofHeaders })).status, 403);
  assert.equal((await call('/api/campaigns/advertiser-inquiries', { headers: spoofHeaders })).status, 403);
  assert.equal((await call('/api/fourthwall/designs/any/approve', { method: 'POST', headers: spoofHeaders, body: '{}' })).status, 403);
  assert.equal((await call('/api/fourthwall/designs/any/reject', { method: 'POST', headers: spoofHeaders, body: '{}' })).status, 403);
  assert.equal((await call('/api/admin/defaults', { headers: spoofHeaders })).status, 403);
  assert.equal((await call('/api/admin/defaults/any/collect', { method: 'POST', headers: spoofHeaders, body: '{}' })).status, 403);
  assert.equal((await call('/api/admin/defaults/any/write-off', { method: 'POST', headers: spoofHeaders, body: '{}' })).status, 403);
  assert.equal((await call('/api/admin/reviews', { headers: spoofHeaders })).status, 403);
  assert.equal((await call('/api/admin/withdrawals/any/resolve', { method: 'POST', headers: spoofHeaders, body: '{}' })).status, 403);
  assert.equal((await call('/api/admin/collections/any/resolve', { method: 'POST', headers: spoofHeaders, body: '{}' })).status, 403);
  assert.equal((await call('/api/admin/users/any/clear-hold', { method: 'POST', headers: spoofHeaders, body: '{}' })).status, 403);
  assert.equal((await call('/api/admin/campaigns/any/status', { method: 'POST', headers: spoofHeaders, body: '{}' })).status, 403);
});

test('simulated money and KYC endpoints are unavailable outside demo mode', async () => {
  for (const path of ['/api/users/treasury/topup', '/api/users/kyc/verify', '/api/users/bank/link', '/api/users/debit-mandate/accept', '/api/users/login', '/api/users/register', '/api/users/switch', '/api/campaigns/shifts/verify-payout']) {
    const res = await call(path, { method: 'POST', headers: spoofHeaders, body: JSON.stringify({ amount: 1000, email: 'a@b.c' }) });
    assert.equal(res.status, 404, `${path} should not exist outside demo mode`);
  }
});

test('scheduled payout jobs require admin or the cron secret', async () => {
  const body = JSON.stringify({ sweepType: 'FRIDAY_PAYOUTS' });
  assert.equal((await call('/api/platform/schedule/sweep', { method: 'POST', headers: spoofHeaders, body })).status, 403);
  assert.equal((await call('/api/pods/pod_x/cycle/process', { method: 'POST', headers: spoofHeaders, body: '{}' })).status, 403);
  assert.equal((await call('/api/pods/pod_x/system-deposit', { method: 'POST', headers: spoofHeaders, body: '{}' })).status, 403);
  // The cron secret only unlocks the sweeps, never manual payouts or escrow injection.
  const cron = { 'content-type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' };
  assert.equal((await call('/api/pods/pod_x/cycle/process', { method: 'POST', headers: cron, body: '{}' })).status, 403);
  assert.equal((await call('/api/pods/pod_x/system-deposit', { method: 'POST', headers: cron, body: '{}' })).status, 403);
  assert.equal((await call('/api/platform/schedule/sweep', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cron-secret': 'wrong-secret' },
    body,
  })).status, 403);

  const ok = await call('/api/platform/schedule/sweep', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cron-secret': CRON_SECRET },
    body,
  });
  assert.equal(ok.status, 200);
});

test('Stripe webhook requires a valid signature over the raw body', async () => {
  const payload = JSON.stringify({
    id: 'evt_test_1',
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_1', payment_status: 'paid', metadata: { kind: 'treasury_topup', userId: 'nobody', depositAmountUsd: '50.00' } } },
  });

  const unsigned = await call('/api/webhooks/stripe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload });
  assert.equal(unsigned.status, 400);

  const forged = await call('/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
    body: payload,
  });
  assert.equal(forged.status, 400);

  // Correctly signed, but for a user this server does not know: not acknowledged,
  // so Stripe retries instead of the payment being silently dropped.
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const signedUnknownUser = await call('/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': header },
    body: payload,
  });
  assert.equal(signedUnknownUser.status, 500);
  assert.equal(signedUnknownUser.body.error, 'WEBHOOK_NOT_APPLIED');

  // Correctly signed event we have nothing to do for: acknowledged.
  const noopPayload = JSON.stringify({ id: 'evt_test_2', object: 'event', type: 'account.updated', data: { object: { id: 'acct_unknown', object: 'account' } } });
  const noop = await call('/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': Stripe.webhooks.generateTestHeaderString({ payload: noopPayload, secret: WEBHOOK_SECRET }) },
    body: noopPayload,
  });
  assert.equal(noop.status, 200);
});

test('Fourthwall webhook requires a valid signature', async () => {
  const res = await call('/api/fourthwall/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'ORDER_UPDATED', order_id: 'x', status: 'SHIPPED' }),
  });
  assert.equal(res.status, 401);
});

test('private data and paid AI endpoints require sign-in', async () => {
  for (const path of ['/api/audit-logs', '/api/pods', '/api/fourthwall/designs', '/api/perks/my-offers', '/api/platform/schedule', '/api/chats/messages?threadId=thread_pod_x']) {
    assert.equal((await call(path, { headers: spoofHeaders })).status, 401, `${path} should require sign-in`);
  }
  for (const path of ['/api/ai/tts', '/api/campaigns/gear-verify', '/api/chats/send']) {
    assert.equal((await call(path, { method: 'POST', headers: spoofHeaders, body: JSON.stringify({ query: 'hi', text: 'hi', threadId: 'x', content: 'x' }) })).status, 401, `${path} should require sign-in`);
  }
});

test('the voice guide answers visitors without a session (public product knowledge only)', async () => {
  const res = await call('/api/ai/voice-guide', { method: 'POST', headers: spoofHeaders, body: JSON.stringify({ query: 'What is MutualPool?', currentContext: { language: 'en' } }) });
  assert.equal(res.status, 200, JSON.stringify(res.body).slice(0, 200));
  assert.ok(String(res.body.spokenText || res.body.displayText || '').length > 20);
});

test('terms acceptance needs a signed-in member', async () => {
  const res = await call('/api/users/accept-terms', { method: 'POST', headers: spoofHeaders, body: JSON.stringify({ version: '2026-10-13' }) });
  assert.equal(res.status, 401);
});

test('public perk listing hides redemption codes', async () => {
  const res = await call('/api/perks');
  assert.equal(res.status, 200);
  for (const perk of res.body) {
    assert.equal(perk.redemptionData, undefined);
    assert.equal(perk.partnerEmail, undefined);
  }
});

test('guest perk submissions are always pending and never touch accounts', async () => {
  const res = await call('/api/perks/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Test perk', category: 'Fuel', partnerEmail: 'partner@example.com', status: 'APPROVED', createAccount: true }),
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.perk.status, 'PENDING');
  assert.equal(res.body.user, undefined);
  assert.equal(res.body.createdAccount, false);
});

test('CORS does not allow arbitrary origins', async () => {
  const res = await call('/api/perks', { headers: { origin: 'https://evil.example' } });
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('health check does not expose configuration to anonymous callers', async () => {
  const res = await call('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body).sort(), ['status', 'timestamp']);
});
