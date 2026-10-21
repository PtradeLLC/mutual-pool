// Trusted Circle invitations, end to end against a DEMO_MODE server
// (npm run test:integration). The invite code is assigned by the server at
// creation; invited contacts must be real emails or phone numbers.
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
let seq = 0;
function makeUser(prefix: string) {
  const nonce = `${Date.now()}_${++seq}_${Math.floor(Math.random() * 1e6)}`;
  return { id: `usr_tc_${prefix}_${nonce}`, name: `TC ${prefix} ${seq}`, account: `acct_tc_${prefix}_${nonce}` };
}
type TestUser = ReturnType<typeof makeUser>;
function headers(u: TestUser) {
  return {
    'content-type': 'application/json',
    'x-user-id': u.id,
    'x-user-name': u.name,
    'x-user-email': `${u.id}@example.test`,
    'x-user-kyc-status': 'VERIFIED',
    'x-user-account-age-days': '400',
    'x-user-completed-pods-count': '2',
    'x-user-treasury-stripe-account-id': u.account,
  };
}
async function api(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}
async function fund(u: TestUser, amount = 500) {
  const r = await api('/api/users/treasury/topup', { method: 'POST', headers: headers(u), body: JSON.stringify({ amount }) });
  assert.equal(r.status, 200);
  const m = await api('/api/users/debit-mandate/accept', { method: 'POST', headers: headers(u), body: '{}' });
  assert.equal(m.status, 200);
}
async function balance(u: TestUser) {
  const r = await api('/api/users/current', { headers: headers(u) });
  return Number(r.body?.treasury?.balanceUsd);
}
const circle = (name: string, invitedContacts: unknown) => JSON.stringify({ name, podType: 'TRUSTED_CIRCLE', sizeTier: 20, depositTier: 20, activationPolicy: 'FLEXIBLE_EARLY', invitedContacts });

test('an invalid contact is rejected before anything is charged', async () => {
  const creator = makeUser('bad');
  await fund(creator);
  const before = await balance(creator);
  const r = await api('/api/pods', { method: 'POST', headers: headers(creator), body: circle(`TC bad ${Date.now()}`, [{ name: 'Jon', emailOrPhone: 'jon@' }]) });
  assert.equal(r.status, 400, JSON.stringify(r.body));
  assert.equal(r.body.error, 'INVALID_CONTACT');
  assert.equal(await balance(creator), before, 'nothing charged');
});

test('contacts are normalised, deduped, and the creator gets the real invite code and link', async () => {
  const creator = makeUser('ok');
  const friend = makeUser('friend');
  await fund(creator);
  await api('/api/users/current', { headers: headers(friend) }); // registered user, invited by email
  const r = await api('/api/pods', {
    method: 'POST',
    headers: headers(creator),
    body: circle(`TC ok ${Date.now()}`, [
      { name: 'Carlos', emailOrPhone: ' Carlos@Driver.com ' },
      { name: 'Carlos again', emailOrPhone: 'carlos@driver.com' },
      { name: 'Dee', emailOrPhone: '(415) 555-0192' },
      { name: 'Friend', emailOrPhone: `${friend.id}@example.test` },
      { name: 'Me', emailOrPhone: `${creator.id}@example.test` },
    ]),
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const pod = r.body;
  assert.match(pod.inviteCode, /^[A-Z0-9]{6}$/, 'server-assigned code is returned to the creator');
  const values = pod.invitedContacts.map((c: any) => c.emailOrPhone).sort();
  assert.deepEqual(values, ['+14155550192', 'carlos@driver.com', `${friend.id}@example.test`].sort());
  const f = pod.invitedContacts.find((c: any) => c.emailOrPhone === `${friend.id}@example.test`);
  assert.equal(f.isExistingMember, true);
  assert.equal(f.memberUserId, friend.id);

  // A stranger with a made-up code is refused and gets in only with the real one;
  // the invited friend needs no code at all.
  const stranger = makeUser('stranger');
  await fund(stranger);
  const wrong = await api(`/api/pods/${pod.id}/join`, { method: 'POST', headers: headers(stranger), body: JSON.stringify({ inviteCode: 'NOPE00' }) });
  assert.equal(wrong.status, 403, JSON.stringify(wrong.body));
  const withCode = await api(`/api/pods/${pod.id}/join`, { method: 'POST', headers: headers(stranger), body: JSON.stringify({ inviteCode: pod.inviteCode }) });
  assert.equal(withCode.status, 200, JSON.stringify(withCode.body));
  await fund(friend);
  const joined = await api(`/api/pods/${pod.id}/join`, { method: 'POST', headers: headers(friend), body: '{}' });
  assert.equal(joined.status, 200, JSON.stringify(joined.body));
  const contact = joined.body.pod.invitedContacts.find((c: any) => c.emailOrPhone === `${friend.id}@example.test`);
  assert.equal(contact.status, 'JOINED');
});

test('adding contacts after creation validates the same way and reports what was skipped', async () => {
  const creator = makeUser('later');
  await fund(creator);
  const r = await api('/api/pods', { method: 'POST', headers: headers(creator), body: circle(`TC later ${Date.now()}`, []) });
  assert.equal(r.status, 200);
  const add = await api(`/api/pods/${r.body.id}/contacts`, {
    method: 'POST', headers: headers(creator),
    body: JSON.stringify({ contacts: [{ name: 'A', emailOrPhone: 'a@b.co' }, { name: 'B', emailOrPhone: 'not-a-contact' }, { name: 'C', emailOrPhone: '415555' }] }),
  });
  assert.equal(add.status, 200, JSON.stringify(add.body));
  assert.equal(add.body.addedContacts.length, 1);
  assert.deepEqual(add.body.rejected, ['not-a-contact', '415555']);
});
