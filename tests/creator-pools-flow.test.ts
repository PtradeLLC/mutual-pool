// Creator Pools end to end (CREATOR_POOLS_SPEC.md) against a DEMO_MODE server.
// Runs in its own server (npm run test:creators) because it drives the weekly
// sweeps and the clock, which touch every active pod.
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const CRON_HEADERS = { 'content-type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' };
const DAY = 86_400_000;

let seq = 0;
function makeUser(prefix: string, extra: Record<string, string> = {}) {
  const nonce = `${Date.now()}_${++seq}_${Math.floor(Math.random() * 1e6)}`;
  return { id: `usr_cp_${prefix}_${nonce}`, name: `CP ${prefix} ${seq}`, extra };
}
type TestUser = ReturnType<typeof makeUser>;

function headers(u: TestUser, extra: Record<string, string> = {}) {
  return {
    'content-type': 'application/json',
    'x-user-id': u.id,
    'x-user-name': u.name,
    'x-user-email': `${u.id}@example.test`,
    'x-user-kyc-status': 'VERIFIED',
    'x-user-account-age-days': '5',
    'x-user-completed-pods-count': '0',
    ...u.extra,
    ...extra,
  };
}
const admin = makeUser('admin', { 'x-user-role': 'Admin' });

async function api(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* CSV */ }
  return { status: res.status, body, headers: res.headers };
}
const post = (u: TestUser, path: string, body: unknown = {}, extra: Record<string, string> = {}) =>
  api(path, { method: 'POST', headers: headers(u, extra), body: JSON.stringify(body) });
const get = (u: TestUser | null, path: string) => api(path, u ? { headers: headers(u) } : {});

async function ready(u: TestUser, amount = 600, autoFund = true) {
  assert.equal((await post(u, '/api/users/treasury/topup', { amount, autoFund })).status, 200);
  assert.equal((await post(u, '/api/users/debit-mandate/accept', { last4: '4242', bankName: 'Test Bank' })).status, 200);
}
async function balance(u: TestUser): Promise<number> {
  return (await get(u, '/api/users/current')).body.treasury?.balanceUsd || 0;
}
async function sweep(type: 'THURSDAY_DEPOSITS' | 'FRIDAY_PAYOUTS') {
  const r = await api('/api/platform/schedule/sweep', { method: 'POST', headers: CRON_HEADERS, body: JSON.stringify({ sweepType: type }) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
}
async function tick(now: Date) {
  const r = await api('/api/platform/schedule/delinquency-tick', { method: 'POST', headers: CRON_HEADERS, body: JSON.stringify({ now: now.toISOString() }) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
const sign = (u: TestUser) => ({ agreementAccepted: true, signatureName: u.name });

const creator = makeUser('creator');
const handle = `rae_${Date.now().toString(36)}`;
let poolId = '';
const followers: TestUser[] = [];
let pod1 = '';
let late: TestUser;

test('a creator is approved with 1,000+ followers, identity, a bank authorization and the terms', async () => {
  let me = await post(creator, '/api/creator/profile', { handle, displayName: 'Rae Saves', acceptTerms: true });
  assert.equal(me.status, 200, JSON.stringify(me.body));
  assert.equal(me.body.profile.status, 'PENDING');
  me = await post(creator, '/api/creator/connect/tiktok/demo', { handle: 'raesaves', followers: 600 });
  assert.equal(me.body.profile.status, 'PENDING', 'not enough followers yet');
  me = await post(creator, '/api/creator/connect/youtube/demo', { handle: 'raesaves', followers: 500 });
  assert.equal(me.body.totalFollowers, 1100);
  assert.equal(me.body.readiness.bank, false);
  assert.equal(me.body.profile.status, 'PENDING', 'no bank authorization yet');
  await ready(creator, 100);
  me = await get(creator, '/api/creator/me');
  assert.equal(me.body.profile.status, 'APPROVED');
  assert.equal(me.body.link.endsWith(`/c/${handle}`), true);

  const other = makeUser('copycat');
  const taken = await post(other, '/api/creator/profile', { handle });
  assert.equal(taken.status, 409);
});

test('pool rules: $10-$60 for a first pool, one open pool at a time, public page without signing in', async () => {
  const tooBig = await post(creator, '/api/creator/pools', { name: 'Rae Savers', depositTier: 70 });
  assert.equal(tooBig.status, 400);
  const opened = await post(creator, '/api/creator/pools', { name: 'Rae Savers', description: 'Saving with my community', depositTier: 50 });
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  poolId = opened.body.openPoolId;
  assert.ok(poolId);
  assert.equal((await post(creator, '/api/creator/pools', { name: 'Second', depositTier: 20 })).status, 409);

  const page = await get(null, `/api/c/${handle.toUpperCase()}`);
  assert.equal(page.status, 200);
  assert.equal(page.body.pool.depositTier, 50);
  assert.equal(page.body.pool.potUsd, 1000);
  assert.equal(page.body.pool.creatorCommissionUsd, 30);
  assert.match(page.body.pool.agreementText, /hosted by Rae Saves/);
  assert.equal(page.body.viewer.signedIn, false);
});

test('joining: US only, bank authorization and a signed agreement required', async () => {
  const f = makeUser('checks');
  await ready(f);
  assert.equal((await post(f, `/api/c/${handle}/join`, sign(f), { 'x-country-override': 'MX' })).body.error, 'US_ONLY');
  assert.equal((await post(f, `/api/c/${handle}/join`, {})).body.error, 'AGREEMENT_REQUIRED');
  const noMandate = makeUser('nomandate');
  assert.equal((await post(noMandate, '/api/users/treasury/topup', { amount: 100 })).status, 200);
  assert.equal((await post(noMandate, `/api/c/${handle}/join`, sign(noMandate))).body.error, 'DEBIT_MANDATE_REQUIRED');
  assert.equal((await post(creator, `/api/c/${handle}/join`, sign(creator))).body.error, 'OWN_POOL');
});

test('20 followers taking seats at once fill exactly one pod, which starts on its own; the 21st opens Pod 2', async () => {
  for (let i = 0; i < 20; i++) followers.push(makeUser(`f${i}`));
  await Promise.all(followers.map(f => ready(f, 600)));
  const results = await Promise.all(followers.map(f => post(f, `/api/c/${handle}/join`, sign(f))));
  for (const r of results) assert.equal(r.status, 200, JSON.stringify(r.body));
  const podIds = new Set(results.map(r => r.body.pod.id));
  assert.equal(podIds.size, 1, 'all in one pod');
  pod1 = [...podIds][0];

  late = makeUser('late');
  await ready(late, 600);
  const r21 = await post(late, `/api/c/${handle}/join`, sign(late));
  assert.equal(r21.status, 200);
  assert.notEqual(r21.body.pod.id, pod1);

  const detail = await get(creator, `/api/creator/pools/${poolId}`);
  assert.equal(detail.status, 200);
  const [p1, p2] = detail.body.pods;
  assert.equal(p1.status, 'ACTIVE');
  assert.equal(p1.members, 20);
  assert.equal(p2.status, 'FORMING');
  assert.equal(p2.members, 1);
  assert.equal(detail.body.pool.seatedCount, 21);

  const pod = await get(creator, `/api/creator/pods/${pod1}`);
  const slots = pod.body.members.map((m: any) => m.slot).sort((a: number, b: number) => a - b);
  assert.deepEqual(slots, Array.from({ length: 20 }, (_, i) => i + 1), 'payout order drawn');
  assert.ok(results.every(r => r.body.user.treasury.balanceUsd === 547.5), 'first deposit + 5% taken');
});

test('a member can leave a pod that has not started and gets their deposit back', async () => {
  const before = await balance(late);
  const detail = await get(creator, `/api/creator/pools/${poolId}`);
  const pod2 = detail.body.pods[1].id;
  const out = await post(late, `/api/pods/${pod2}/leave`);
  assert.equal(out.status, 200, JSON.stringify(out.body));
  assert.equal(out.body.refunded, true);
  assert.equal(Math.round((await balance(late) - before) * 100) / 100, 52.5);
  assert.equal((await get(creator, `/api/creator/pools/${poolId}`)).body.pool.seatedCount, 20);
  // Take the seat again for the tests that follow.
  assert.equal((await post(late, `/api/c/${handle}/join`, sign(late))).status, 200);
  assert.equal((await get(creator, `/api/creator/pools/${poolId}`)).body.pool.seatedCount, 21);
  // Leaving a running pod is still locked until everyone is paid.
  assert.equal((await post(followers[0], `/api/pods/${pod1}/leave`)).body.error, 'LEAVE_LOCKED');
});

test('members see the creator-pool agreement they signed; outsiders cannot', async () => {
  const mine = await get(followers[0], `/api/pods/${pod1}/creator-agreement`);
  assert.equal(mine.status, 200);
  assert.match(mine.body.text, /hosted by Rae Saves/);
  assert.equal(mine.body.signature.signatureName, followers[0].name);
  assert.equal(mine.body.signature.matchesSignedText, true);
  assert.equal(mine.body.signature.mandateLast4, '4242');
  const outsider = makeUser('peek');
  assert.equal((await get(outsider, `/api/pods/${pod1}/creator-agreement`)).status, 403);
});

test('a new follower can be in one creator pod; creator pods are joined only through the link', async () => {
  const again = await post(followers[0], `/api/c/${handle}/join`, sign(followers[0]));
  assert.equal(again.body.error, 'CREATOR_POD_LIMIT');
  const outsider = makeUser('outsider');
  await ready(outsider);
  assert.equal((await post(outsider, `/api/pods/${pod1}/join`, {})).body.error, 'CREATOR_POOL_POD');
  assert.equal((await post(creator, `/api/pods/${pod1}/lock`, {})).body.error, 'CREATOR_POOL_POD');
  const outsiderList = await get(outsider, '/api/pods');
  assert.ok(!outsiderList.body.some((p: any) => p.id === pod1), 'hidden from people outside the pod');
  const memberList = await get(followers[0], '/api/pods');
  assert.ok(memberList.body.some((p: any) => p.id === pod1));
});

test('weekly payout: the creator earns 3% of the pot; a new member\'s first payout is held 3 business days', async () => {
  const before = await balance(creator);
  await sweep('FRIDAY_PAYOUTS');
  const me = await get(creator, '/api/creator/me');
  assert.equal(me.body.earningsUsd, 30);
  assert.equal(Math.round((await balance(creator) - before) * 100) / 100, 30);

  const pod = await get(creator, `/api/creator/pods/${pod1}`);
  const paid = pod.body.members.find((m: any) => m.paid);
  assert.equal(paid.slot, 1);
  const recipient = followers.find(f => f.id === paid.userId)!;
  const all = await balance(recipient);
  const w = await post(recipient, '/api/treasury/payouts/withdraw', { amount: all });
  assert.equal(w.status, 403);
  assert.equal(w.body.error, 'FUNDS_ON_HOLD');
  assert.equal(w.body.onHoldUsd, 900);
  assert.equal(w.body.withdrawableUsd, Math.round((all - 900) * 100) / 100);
  // What isn't held can still be withdrawn (no amount = everything that isn't held).
  const rest = await post(recipient, '/api/treasury/payouts/withdraw', {});
  assert.equal(rest.status, 200, JSON.stringify(rest.body));
  assert.equal(await balance(recipient), 900);
});

test('creator earnings can be withdrawn once a W-9 is on file; the year-end export decrypts the tax ID for admins only', async () => {
  const blocked = await post(creator, '/api/treasury/payouts/withdraw', { amount: await balance(creator) });
  assert.equal(blocked.body.error, 'FUNDS_ON_HOLD');
  assert.equal(blocked.body.onHoldUsd, 30, 'creator earnings wait for the W-9');
  const bad = await post(creator, '/api/creator/tax-form', { legalName: 'Rae Saves', taxClassification: 'INDIVIDUAL', tin: '123', certify: true });
  assert.equal(bad.status, 400);
  const w9 = await post(creator, '/api/creator/tax-form', {
    legalName: 'Rae Saves', taxClassification: 'INDIVIDUAL', tinType: 'SSN', tin: '123-45-6789',
    address: { line1: '1 Main St', city: 'Austin', state: 'tx', postalCode: '78701' }, signatureName: 'Rae Saves', certify: true,
  });
  assert.equal(w9.status, 200, JSON.stringify(w9.body));
  assert.equal(w9.body.taxForm.tinLast4, '6789');
  assert.ok(!JSON.stringify(w9.body).includes('123456789'));
  assert.equal((await post(creator, '/api/treasury/payouts/withdraw', { amount: await balance(creator) })).status, 200);
  // Keep enough for the next pool's deposit if needed later.
  assert.equal((await post(creator, '/api/users/treasury/topup', { amount: 100 })).status, 200);

  const year = new Date().getUTCFullYear();
  assert.equal((await get(creator, `/api/admin/creators/tax-export?year=${year}&all=1`)).status, 403);
  const csv = await get(admin, `/api/admin/creators/tax-export?year=${year}&all=1`);
  assert.equal(csv.status, 200);
  assert.match(String(csv.body), /"123456789"/);
  assert.match(String(csv.body), new RegExp(handle));
  assert.match(String(csv.body), /"30\.00"/);
});

test('a member removed before being paid leaves a held slot that the next follower takes', async () => {
  // Week 2 deposits. The target misses theirs: auto-funding off and balance drained.
  const pod = await get(creator, `/api/creator/pods/${pod1}`);
  const target = pod.body.members.find((m: any) => m.slot === 10);
  const user = followers.find(f => f.id === target.userId)!;
  assert.equal((await post(user, '/api/users/treasury/topup', { amount: 1, autoFund: false })).status, 200);
  const bal = await balance(user);
  assert.equal((await post(user, '/api/treasury/payouts/withdraw', { amount: bal })).status, 200);
  await sweep('THURSDAY_DEPOSITS');
  let detail = await get(creator, `/api/creator/pods/${pod1}`);
  assert.ok(detail.body.missed.some((m: any) => m.userId === user.id), 'creator sees the name inside the pod');
  assert.equal(detail.body.pauseVote, null, 'the buffer covered the week, so no vote');

  await tick(new Date(Date.now() + 25 * 3_600_000));
  detail = await get(creator, `/api/creator/pods/${pod1}`);
  assert.deepEqual(detail.body.openSlots, [{ slot: 10 }]);
  assert.equal(detail.body.members.length, 19);

  const next = makeUser('next');
  await ready(next, 600);
  const joined = await post(next, `/api/c/${handle}/join`, sign(next));
  assert.equal(joined.status, 200, JSON.stringify(joined.body));
  assert.equal(joined.body.kind, 'HELD');
  assert.equal(joined.body.pod.id, pod1);
  assert.equal(joined.body.payoutWeek, 10);
  detail = await get(creator, `/api/creator/pods/${pod1}`);
  assert.deepEqual(detail.body.openSlots, []);
  assert.equal(detail.body.members.length, 20);
});

test('closing enrollment returns seats in a pod that can\'t start; the next pool can go to $70 for completed members', async () => {
  const waiting = makeUser('waiting');
  assert.equal((await post(waiting, `/api/c/${handle}/waitlist`, {})).status, 200);
  const anon = await api(`/api/c/${handle}/waitlist`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'fan@example.test' }) });
  assert.equal(anon.status, 200);

  const before = await balance(late);
  const closed = await post(creator, `/api/creator/pools/${poolId}/close`);
  assert.equal(closed.status, 200);
  assert.equal(Math.round((await balance(late) - before) * 100) / 100, 52.5, 'deposit and buffer refunded');
  const detail = await get(creator, `/api/creator/pools/${poolId}`);
  assert.equal(detail.body.pool.status, 'CLOSED');
  assert.equal(detail.body.pods.length, 1, 'the empty pod is gone');
  assert.equal((await get(null, `/api/c/${handle}`)).body.pool, null);
  assert.equal((await get(creator, '/api/creator/me')).body.waitlistCount, 2);

  const next = await post(creator, '/api/creator/pools', { name: 'Rae Savers 2', depositTier: 70 });
  assert.equal(next.status, 200, JSON.stringify(next.body));
  assert.equal(next.body.waitlistCount, 0, 'the waiting list was notified');
  const page = await get(null, `/api/c/${handle}`);
  assert.equal(page.body.pool.completedMembersOnly, true);
  const newbie = makeUser('newbie');
  await ready(newbie, 600);
  assert.equal((await post(newbie, `/api/c/${handle}/join`, sign(newbie))).body.error, 'COMPLETED_POD_REQUIRED');
});

test('a pod that stops filling starts after 14 days with the members it has', async () => {
  const a = makeUser('vetA', { 'x-user-completed-pods-count': '1' });
  const b = makeUser('vetB', { 'x-user-completed-pods-count': '1' });
  await ready(a, 600);
  await ready(b, 600);
  assert.equal((await post(a, `/api/c/${handle}/join`, sign(a))).status, 200);
  const jb = await post(b, `/api/c/${handle}/join`, sign(b));
  assert.equal(jb.status, 200);
  assert.equal(jb.body.pod.status, 'FORMING');
  const me = await get(creator, '/api/creator/me');
  const pool2 = me.body.openPoolId;
  await tick(new Date(Date.now() + 15 * DAY));
  const detail = await get(creator, `/api/creator/pools/${pool2}`);
  assert.equal(detail.body.pods[0].status, 'ACTIVE');
  assert.equal(detail.body.pods[0].members, 2);
});

test('a suspended creator stops earning; their pods keep running and MutualPool keeps the 3%', async () => {
  assert.equal((await post(creator, `/api/admin/creators/${creator.id}/suspend`, { reason: 'test' })).status, 403);
  const s = await post(admin, `/api/admin/creators/${creator.id}/suspend`, { reason: 'Undisclosed promotion' });
  assert.equal(s.status, 200);
  const before = (await get(creator, '/api/creator/me')).body.earningsUsd;
  await sweep('THURSDAY_DEPOSITS');
  await sweep('FRIDAY_PAYOUTS');
  const after = await get(creator, '/api/creator/me');
  assert.equal(after.body.profile.status, 'SUSPENDED');
  assert.equal(after.body.earningsUsd, before);
  assert.equal((await get(null, `/api/c/${handle}`)).status, 410);
  const pod = await get(creator, `/api/creator/pods/${pod1}`);
  assert.equal(pod.body.status, 'ACTIVE');
  assert.equal(pod.body.members.filter((m: any) => m.paid).length, 2, 'payouts continue');
});

test('a member removed after being paid: their slot stays empty and the buffer covers it each week', async () => {
  let detail = await get(creator, `/api/creator/pods/${pod1}`);
  const paidFirst = detail.body.members.find((m: any) => m.slot === 1);
  const quitter = followers.find(f => f.id === paidFirst.userId)!;
  // Their payout hold was cleared by the clock jump above; empty the balance.
  assert.equal((await post(quitter, '/api/users/treasury/topup', { amount: 1, autoFund: false })).status, 200);
  const all = await balance(quitter);
  assert.equal((await post(quitter, '/api/treasury/payouts/withdraw', { amount: all })).status, 200, 'hold released');
  await sweep('THURSDAY_DEPOSITS'); // week 3: missed, the buffer covers it
  await tick(new Date(Date.now() + 30 * DAY)); // removed after 24 hours
  detail = await get(creator, `/api/creator/pods/${pod1}`);
  assert.equal(detail.body.members.length, 19);
  assert.deepEqual(detail.body.openSlots, [], 'a paid slot is not refilled');
  assert.ok(detail.body.missed.some((m: any) => m.userId === quitter.id && m.removed));
  await sweep('FRIDAY_PAYOUTS'); // week 3 paid

  // Week 4: 19 deposits plus $50 from the buffer for the empty slot.
  detail = await get(creator, `/api/creator/pods/${pod1}`);
  const slot4User = followers.find(f => f.id === detail.body.members.find((m: any) => m.slot === 4)?.userId);
  assert.ok(slot4User, 'slot 4 belongs to one of the first followers');
  const before = await balance(slot4User);
  await sweep('THURSDAY_DEPOSITS');
  await sweep('FRIDAY_PAYOUTS');
  // -$52.50 deposit, +$900 payout: the full $1,000 pot minus 10%.
  assert.equal(Math.round((await balance(slot4User) - before) * 100) / 100, 847.5, 'full pot despite the empty slot');
  detail = await get(creator, `/api/creator/pods/${pod1}`);
  assert.equal(detail.body.pauseVote, null, 'the buffer covered it: no vote');
});

test('withdrawals wait for an admin when the bank account holder name does not match the verified name', async () => {
  const m = followers[5];
  assert.equal((await post(m, '/api/users/debit-mandate/accept', { last4: '4242', bankName: 'Test Bank', routingNumber: '021000021', accountHolderName: 'John Doe', legalName: m.name })).status, 200);
  const w = await post(m, '/api/treasury/payouts/withdraw', { amount: 1 });
  assert.equal(w.status, 403);
  assert.equal(w.body.error, 'WITHDRAWAL_REVIEW_REQUIRED');
  assert.equal((await get(m, '/api/admin/bank-reviews')).status, 403, 'admins only');
  const list = await get(admin, '/api/admin/bank-reviews');
  const row = list.body.reviews.find((r: any) => r.userId === m.id);
  assert.ok(row, 'listed for review');
  assert.equal(row.accountHolderName, 'John Doe');
  assert.equal((await post(admin, `/api/admin/bank-reviews/${m.id}/approve`)).status, 200);
  assert.equal((await post(m, '/api/treasury/payouts/withdraw', { amount: 1 })).status, 200, 'open after review');
  assert.ok(!(await get(admin, '/api/admin/bank-reviews')).body.reviews.some((r: any) => r.userId === m.id));
});

test('an admin removing an unpaid member holds the slot for the next follower and never lists the pod', async () => {
  let detail = await get(creator, `/api/creator/pods/${pod1}`);
  const target = detail.body.members.find((x: any) => x.slot === 15);
  const r = await post(admin, '/api/admin/delinquency/handle', { podId: pod1, memberUserId: target.userId, actionChoice: 'REMOVE' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  detail = await get(creator, `/api/creator/pods/${pod1}`);
  assert.ok(detail.body.openSlots.some((o: any) => o.slot === 15), 'slot 15 held');
  const listed = await get(makeUser('browser'), '/api/pods');
  assert.ok(!listed.body.some((p: any) => p.id === pod1), 'never listed publicly');
});
