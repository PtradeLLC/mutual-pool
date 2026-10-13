// Server-owned campaign shifts with randomized AI spot checks. Runs against the
// DEMO_MODE test server, where `sampleTag` stands in for the vision model.
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
let seq = 0;
function makeUser(prefix: string) {
  const id = `usr_shift_${prefix}_${Date.now()}_${++seq}`;
  return {
    id,
    headers: {
      'content-type': 'application/json',
      'x-user-id': id,
      'x-user-email': `${id}@example.test`,
      'x-user-name': `Shift ${prefix}`,
      'x-user-kyc-status': 'VERIFIED',
    },
  };
}
type TestUser = ReturnType<typeof makeUser>;

const CAMPAIGN = { id: 'camp_test_1', title: 'Test Brand Fleet', brandName: 'TestBrand', gearRequired: ['Branded Hoodie', 'Hi-Vis Vest'], dailyPayout: 65, targetMetro: 'Austin' };

async function api(path: string, u: TestUser, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { method: init.method || 'GET', headers: u.headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function startShift(u: TestUser) {
  const r = await api('/api/campaigns/shifts/start', u, { method: 'POST', body: { campaign: CAMPAIGN, platform: 'DoorDash', neighborhood: 'Downtown', sampleTag: 'MATCH_ACTIVE_CAMPAIGN' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.shift;
}

async function balance(u: TestUser) {
  return (await api('/api/users/current', u)).body.treasury.balanceUsd as number;
}

test('a shift starts with a verified selfie and a secret randomized schedule', async () => {
  const u = makeUser('start');
  const shift = await startShift(u);
  assert.equal(shift.status, 'ACTIVE');
  assert.equal(shift.activePrompt, null, 'no check is due the moment the shift starts');
  assert.ok(shift.checksRemaining >= 2, `expected 2+ scheduled checks, got ${shift.checksRemaining}`);
  assert.ok(!JSON.stringify(shift).includes('dueAt'), 'future check times must not be exposed to the client');

  const again = await api('/api/campaigns/shifts/start', u, { method: 'POST', body: { campaign: CAMPAIGN, sampleTag: 'MATCH_ACTIVE_CAMPAIGN' } });
  assert.equal(again.status, 409, 'only one active shift per courier');

  const active = await api('/api/campaigns/shifts/active', u);
  assert.equal(active.body.shift.id, shift.id);
});

test('a shift cannot start when the start selfie fails the AI check', async () => {
  const u = makeUser('nogear');
  const r = await api('/api/campaigns/shifts/start', u, { method: 'POST', body: { campaign: CAMPAIGN, sampleTag: 'UNBRANDED' } });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'GEAR_NOT_VERIFIED');
});

test('spot checks surface only when due, are AI-verified, and decide the payout', async () => {
  const u = makeUser('checks');
  const shift = await startShift(u);

  // Nothing to answer yet.
  const early = await api(`/api/campaigns/shifts/${shift.id}/spot-check`, u, { method: 'POST', body: { sampleTag: 'MATCH_ACTIVE_CAMPAIGN' } });
  assert.equal(early.status, 409);
  assert.equal(early.body.error, 'NO_PROMPT');

  // Make the next scheduled check due now (demo/admin only) and answer it with matching gear.
  const forced = await api(`/api/campaigns/shifts/${shift.id}/force-prompt`, u, { method: 'POST' });
  assert.equal(forced.status, 200);
  assert.equal(forced.body.shift.activePrompt?.status, 'PENDING');
  assert.equal(forced.body.shift.activePrompt.responseWindowSeconds, 300);

  const ok = await api(`/api/campaigns/shifts/${shift.id}/spot-check`, u, { method: 'POST', body: { sampleTag: 'MATCH_ACTIVE_CAMPAIGN' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.check.status, 'VERIFIED');
  assert.equal(ok.body.shift.activePrompt, null);
  assert.equal(ok.body.shift.spotChecks.length, 1);

  // Another check, answered with the wrong campaign's gear.
  await api(`/api/campaigns/shifts/${shift.id}/force-prompt`, u, { method: 'POST' });
  const bad = await api(`/api/campaigns/shifts/${shift.id}/spot-check`, u, { method: 'POST', body: { sampleTag: 'MISMATCH_EXPIRED_CAMPAIGN' } });
  assert.equal(bad.status, 200);
  assert.equal(bad.body.check.status, 'REJECTED');

  // Nobody else can answer this courier's checks.
  const stranger = makeUser('stranger');
  const forbidden = await api(`/api/campaigns/shifts/${shift.id}/spot-check`, stranger, { method: 'POST', body: { sampleTag: 'MATCH_ACTIVE_CAMPAIGN' } });
  assert.equal(forbidden.status, 404);

  // Final check passes, but a rejected spot check withholds the payout.
  const before = await balance(u);
  const done = await api(`/api/campaigns/shifts/${shift.id}/complete`, u, { method: 'POST', body: { checkedGear: { 'Branded Hoodie': true, 'Hi-Vis Vest': true }, sampleTag: 'MATCH_ACTIVE_CAMPAIGN' } });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.shift.payoutStatus, 'WITHHELD');
  assert.equal(done.body.shift.complianceScore, 50);
  assert.equal(done.body.shift.spotChecksCount, 2);
  assert.equal(done.body.shift.spotChecksVerified, 1);
  assert.equal(done.body.shift.courierPayoutEarned, 0);
  assert.equal(await balance(u), before, 'no payout for a withheld shift');
  assert.equal((await api('/api/campaigns/shifts/active', u)).body.shift, null);
});

test('a fully compliant shift is paid (demo credits the balance)', async () => {
  const u = makeUser('clean');
  const shift = await startShift(u);
  for (let i = 0; i < 2; i++) {
    await api(`/api/campaigns/shifts/${shift.id}/force-prompt`, u, { method: 'POST' });
    const r = await api(`/api/campaigns/shifts/${shift.id}/spot-check`, u, { method: 'POST', body: { sampleTag: 'MATCH_ACTIVE_CAMPAIGN' } });
    assert.equal(r.body.check.status, 'VERIFIED');
  }
  const before = await balance(u);
  const done = await api(`/api/campaigns/shifts/${shift.id}/complete`, u, { method: 'POST', body: { checkedGear: { 'Branded Hoodie': true, 'Hi-Vis Vest': true }, sampleTag: 'MATCH_ACTIVE_CAMPAIGN' } });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.shift.payoutStatus, 'PAID');
  assert.equal(done.body.shift.complianceScore, 100);
  assert.equal(done.body.shift.courierPayoutEarned, 65);
  assert.equal(await balance(u), before + 65);
});

test('a failed final gear check does not end the shift; the courier can retake the photo', async () => {
  const u = makeUser('retake');
  const shift = await startShift(u);
  const bad = await api(`/api/campaigns/shifts/${shift.id}/complete`, u, { method: 'POST', body: { checkedGear: { 'Branded Hoodie': true, 'Hi-Vis Vest': true }, sampleTag: 'UNBRANDED' } });
  assert.equal(bad.status, 409);
  assert.equal(bad.body.error, 'GEAR_NOT_VERIFIED');
  assert.equal((await api('/api/campaigns/shifts/active', u)).body.shift.status, 'ACTIVE');
});
