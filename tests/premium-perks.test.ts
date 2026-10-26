// Premium perks unlock only for members whose earnings land in their MutualPool
// account. Runs against the DEMO_MODE test server (see scripts/run-server-tests.ts).
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const stamp = Date.now().toString(36);
const member = { id: `usr_premium_${stamp}`, name: 'Premium Tester' };
const headers = {
  'content-type': 'application/json',
  'x-user-id': member.id,
  'x-user-name': member.name,
  'x-user-email': `${member.id}@example.test`,
  'x-user-kyc-status': 'VERIFIED',
  'x-user-account-age-days': '400',
  'x-user-completed-pods-count': '2',
};

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> || {}) } });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

test('premium perks are locked until an earnings deposit arrives, then unlock', async () => {
  const list = await api('/api/perks');
  assert.equal(list.status, 200);
  const premium = list.body.find((p: any) => p.tier === 'PREMIUM');
  const standard = list.body.find((p: any) => p.tier !== 'PREMIUM');
  assert.ok(premium, 'seed data has at least one premium perk');
  assert.ok(standard, 'seed data has at least one standard perk');
  assert.equal(premium.locked, true);
  assert.equal(standard.locked, false);
  assert.equal(('redemptionData' in premium), false, 'codes are never listed');

  const me = await api('/api/users/current');
  assert.equal(me.status, 200);
  assert.equal(me.body.premium?.active, false);
  assert.equal(me.body.premium?.windowDays, 35);

  const denied = await api('/api/perks/redeem', { method: 'POST', body: JSON.stringify({ perkId: premium.id }) });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error, 'PREMIUM_REQUIRED');

  const ok = await api('/api/perks/redeem', { method: 'POST', body: JSON.stringify({ perkId: standard.id }) });
  assert.equal(ok.status, 200, 'standard perks stay open to every member');

  const deposit = await api('/api/platform/demo/earnings-deposit', { method: 'POST', body: JSON.stringify({ amount: 150, source: 'Demo Delivery Co' }) });
  assert.equal(deposit.status, 200);
  assert.equal(deposit.body.user.premium.active, true);
  assert.equal(deposit.body.user.earningsDeposit.count, 1);

  const after = await api('/api/users/current');
  assert.equal(after.body.premium.active, true);
  assert.ok(new Date(after.body.premium.until).getTime() > Date.now());
  assert.ok(after.body.treasury.balanceUsd >= 150, 'the deposit is spendable balance');

  const unlocked = (await api('/api/perks')).body.find((p: any) => p.id === premium.id);
  assert.equal(unlocked.locked, false);

  const redeemed = await api('/api/perks/redeem', { method: 'POST', body: JSON.stringify({ perkId: premium.id }) });
  assert.equal(redeemed.status, 200);
  assert.ok(redeemed.body.redemption?.codeOrLink, 'the code is revealed once unlocked');
});

test('the demo earnings-deposit endpoint validates its input', async () => {
  assert.equal((await api('/api/platform/demo/earnings-deposit', { method: 'POST', body: JSON.stringify({ amount: 0 }) })).status, 400);
  assert.equal((await api('/api/platform/demo/earnings-deposit', { method: 'POST', body: JSON.stringify({ amount: 50 }), headers: { 'x-user-id': '' } })).status, 401);
});
