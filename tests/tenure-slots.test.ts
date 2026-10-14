// Join-cap ladder and trust-ordered early slots, end to end. Runs against a
// DEMO_MODE server (npm run test:integration) with EARLY_SLOT_TENURE_DAYS=90.
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

type Tier = 'COMPLETED' | 'TENURED' | 'NEW';
let seq = 0;
function makeUser(prefix: string, tier: Tier) {
  const nonce = `${Date.now()}_${++seq}_${Math.floor(Math.random() * 1e6)}`;
  return { id: `usr_ts_${prefix}_${nonce}`, name: `TS ${prefix} ${seq}`, tier };
}
type TestUser = ReturnType<typeof makeUser>;

function headers(u: TestUser, extra: Record<string, string> = {}) {
  return {
    'content-type': 'application/json',
    'x-user-id': u.id,
    'x-user-name': u.name,
    'x-user-email': `${u.id}@example.test`,
    'x-user-kyc-status': 'VERIFIED',
    'x-user-account-age-days': u.tier === 'NEW' ? '5' : '400',
    'x-user-completed-pods-count': u.tier === 'COMPLETED' ? '1' : '0',
    ...extra,
  };
}

async function api(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function prepare(u: TestUser, amount = 1000) {
  assert.equal((await api('/api/users/treasury/topup', { method: 'POST', headers: headers(u), body: JSON.stringify({ amount }) })).status, 200);
  assert.equal((await api('/api/users/debit-mandate/accept', { method: 'POST', headers: headers(u), body: '{}' })).status, 200);
}

async function createPod(creator: TestUser, sizeTier: number, depositTier: number) {
  const created = await api('/api/pods', {
    method: 'POST',
    headers: headers(creator, { 'x-user-completed-pods-count': '3' }), // creators may build any tier here
    body: JSON.stringify({ name: `TS Pod ${Date.now()}_${seq}`, sizeTier, depositTier, activationPolicy: 'FLEXIBLE_EARLY' }),
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  return created.body;
}

async function join(pod: any, u: TestUser) {
  return api(`/api/pods/${pod.id}/join`, { method: 'POST', headers: headers(u), body: JSON.stringify({ inviteCode: pod.inviteCode }) });
}

async function formPod(creator: TestUser, members: TestUser[], sizeTier = 20, depositTier = 20) {
  const pod = await createPod(creator, sizeTier, depositTier);
  for (const m of members) {
    const joined = await join(pod, m);
    assert.equal(joined.status, 200, JSON.stringify(joined.body));
  }
  for (const u of [creator, ...members]) {
    await api(`/api/pods/${pod.id}/agreement/sign`, { method: 'POST', headers: headers(u), body: JSON.stringify({ signatureName: u.name }) });
  }
  return pod;
}

async function lock(creator: TestUser, podId: string) {
  return api(`/api/pods/${podId}/lock`, { method: 'POST', headers: headers(creator, { 'x-user-completed-pods-count': '3' }), body: JSON.stringify({ forceEarly: true }) });
}

test('join cap ladder: pot size a member may join grows with completed pods', async () => {
  const creator = makeUser('creator', 'COMPLETED');
  const fresh = makeUser('fresh', 'NEW');
  const tenured = makeUser('tenured', 'TENURED');
  const oneDone = makeUser('onedone', 'COMPLETED');
  for (const u of [creator, fresh, tenured, oneDone]) await prepare(u, 2000);

  // 20 × $100 = $2,000 pot: too big for anyone without a completed pod (tenure alone doesn't help).
  const big = await createPod(creator, 20, 100);
  for (const u of [fresh, tenured]) {
    const r = await join(big, u);
    assert.equal(r.status, 403, JSON.stringify(r.body));
    assert.equal(r.body.error, 'POT_CAP');
    assert.equal(r.body.capUsd, 1000);
    assert.equal(r.body.potUsd, 2000);
    assert.match(r.body.message, /\$2,500/);
  }
  // One completed pod unlocks $2,500.
  assert.equal((await join(big, oneDone)).status, 200);

  // 100 × $50 = $5,000: beyond one completed pod.
  const bigger = await createPod(creator, 100, 50);
  const r = await join(bigger, oneDone);
  assert.equal(r.status, 403);
  assert.equal(r.body.capUsd, 2500);

  // 20 × $50 = $1,000 is exactly the first cap: fine for a brand-new member.
  const small = await createPod(creator, 20, 50);
  assert.equal((await join(small, fresh)).status, 200);
});

test('small pot: lock always succeeds and orders the early half by trust', async () => {
  const creator = makeUser('creator', 'COMPLETED');
  const done = makeUser('done', 'COMPLETED');
  const tenured = [makeUser('t1', 'TENURED'), makeUser('t2', 'TENURED')];
  const fresh = [makeUser('n1', 'NEW'), makeUser('n2', 'NEW')];
  for (const u of [creator, done, ...tenured, ...fresh]) await prepare(u);

  const pod = await formPod(creator, [...fresh, ...tenured, done]); // join order: least trusted first
  const locked = await lock(creator, pod.id);
  assert.equal(locked.status, 200, JSON.stringify(locked.body));

  const members: any[] = locked.body.members;
  assert.equal(locked.body.earlySlotCount, 3); // 6 members
  assert.equal(locked.body.potAtLockUsd, 120);
  const bySlot = [...members].sort((a, b) => a.rotationIndex - b.rotationIndex);
  assert.equal(bySlot[0].userId, done.id, 'completed pod first');
  assert.deepEqual(new Set(bySlot.slice(1, 3).map(m => m.userId)), new Set(tenured.map(u => u.id)));
  assert.deepEqual(new Set(bySlot.slice(3, 5).map(m => m.userId)), new Set(fresh.map(u => u.id)));
  assert.equal(bySlot[5].userId, creator.id, 'creator stays last');
  assert.equal(bySlot[0].trustAtLock, 'COMPLETED_POD');
  assert.equal(bySlot[1].trustAtLock, 'TENURED');
  assert.equal(bySlot[3].trustAtLock, 'NEW_WITH_MANDATE');
});

test('small pot of only new members still locks (launch day works)', async () => {
  const creator = makeUser('creator', 'NEW');
  const fresh = [makeUser('n1', 'NEW'), makeUser('n2', 'NEW'), makeUser('n3', 'NEW')];
  for (const u of [creator, ...fresh]) await prepare(u);
  const pod = await formPod(creator, fresh, 20, 20);
  const locked = await api(`/api/pods/${pod.id}/lock`, { method: 'POST', headers: headers(creator), body: JSON.stringify({ forceEarly: true }) });
  assert.equal(locked.status, 200, JSON.stringify(locked.body));
  assert.equal(locked.body.status, 'ACTIVE');
  assert.equal(locked.body.members.find((m: any) => m.userId === creator.id).rotationIndex, 3);
});

test('a mutual swap cannot move a less established member ahead in the early half', async () => {
  const creator = makeUser('creator', 'COMPLETED');
  const t1 = makeUser('t1', 'TENURED');
  const n1 = makeUser('n1', 'NEW');
  for (const u of [creator, t1, n1]) await prepare(u);

  const pod = await formPod(creator, [t1, n1]); // 3 members -> 1 early slot (t1), n1 slot 2, creator slot 3
  const locked = await lock(creator, pod.id);
  assert.equal(locked.status, 200, JSON.stringify(locked.body));
  const slotOf = (id: string) => locked.body.members.find((m: any) => m.userId === id).rotationIndex;
  assert.equal(slotOf(t1.id), 0);
  assert.equal(slotOf(n1.id), 1);

  const req = await api(`/api/pods/${pod.id}/swap-request`, { method: 'POST', headers: headers(n1), body: JSON.stringify({ targetUserId: t1.id }) });
  assert.equal(req.status, 200, JSON.stringify(req.body));
  const accept = await api(`/api/pods/${pod.id}/swap-request/${req.body.swapRequest.id}/respond`, { method: 'POST', headers: headers(t1), body: JSON.stringify({ action: 'ACCEPT' }) });
  assert.equal(accept.status, 200, JSON.stringify(accept.body));

  const swap = await api(`/api/pods/${pod.id}/swap`, { method: 'POST', headers: headers(n1), body: JSON.stringify({ targetUserId: t1.id }) });
  assert.equal(swap.status, 403, JSON.stringify(swap.body));
  assert.equal(swap.body.error, 'EARLY_SLOT_TENURE');

  const after = (await api(`/api/pods/${pod.id}`, { headers: headers(creator) })).body;
  assert.equal(after.members.find((m: any) => m.userId === t1.id).rotationIndex, 0, 'order unchanged');
});

test('a reprioritization vote cannot move a less established member into the next-up early slot', async () => {
  const creator = makeUser('creator', 'COMPLETED');
  const t1 = makeUser('t1', 'TENURED');
  const n1 = makeUser('n1', 'NEW');
  for (const u of [creator, t1, n1]) await prepare(u);

  const pod = await formPod(creator, [t1, n1]);
  assert.equal((await lock(creator, pod.id)).status, 200);

  const req = await api(`/api/pods/${pod.id}/reprioritize/request`, { method: 'POST', headers: headers(n1), body: JSON.stringify({ reason: 'Emergency' }) });
  assert.equal(req.status, 403, JSON.stringify(req.body));
  assert.equal(req.body.error, 'EARLY_SLOT_TENURE');

  // The creator (completed pod) outranks the tenured slot-1 holder: allowed.
  const creatorReq = await api(`/api/pods/${pod.id}/reprioritize/request`, { method: 'POST', headers: headers(creator), body: JSON.stringify({ reason: 'Emergency' }) });
  assert.equal(creatorReq.status, 200, JSON.stringify(creatorReq.body));
});
