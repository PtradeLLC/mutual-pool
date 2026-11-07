// Partners page pilot requests: public submit with validation, admin-only listing.
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const json = { 'content-type': 'application/json' };
const admin = { ...json, 'x-user-id': 'usr_partner_admin', 'x-user-email': 'padmin@example.test', 'x-user-role': 'Admin' };
const member = { ...json, 'x-user-id': 'usr_partner_member', 'x-user-email': 'pmember@example.test' };

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('a partner can request a pilot without an account and admins can read it', async () => {
  const org = `Metro Fleet ${Date.now().toString(36)}`;
  const ok = await api('/api/partners/inquiry', { method: 'POST', headers: json, body: JSON.stringify({
    orgName: org, orgType: 'fleet', contactName: 'Dana Ops', contactEmail: 'dana@metrofleet.test', contactPhone: '555-0100',
    workforceSize: 120, metro: 'Houston', payCadence: 'weekly', interests: ['pods', 'payroll', 'bogus'], notes: 'Two stations.',
  }) });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.inquiry?.id);

  const bad = await api('/api/partners/inquiry', { method: 'POST', headers: json, body: JSON.stringify({ orgName: 'No Email Co', contactName: 'X', contactEmail: 'nope' }) });
  assert.equal(bad.status, 400);

  const denied = await api('/api/admin/partner-inquiries', { headers: member });
  assert.equal(denied.status, 403);

  const list = await api('/api/admin/partner-inquiries', { headers: admin });
  assert.equal(list.status, 200);
  const mine = list.body.inquiries.find((q: any) => q.orgName === org);
  assert.ok(mine, 'inquiry is listed for admins');
  assert.deepEqual(mine.interests, ['pods', 'payroll'], 'unknown interests are dropped');
  assert.equal(mine.workforceSize, 120);
  assert.equal(mine.status, 'NEW');
});

test('a new notification pushes a refresh to the member\'s open app over the chat socket', async () => {
  const { default: WebSocket } = await import('ws');
  // Make sure the admin exists before the notification is created.
  assert.equal((await api('/api/admin/partner-inquiries', { headers: admin })).status, 200);

  const ws = new WebSocket(`${BASE_URL.replace(/^http/, 'ws')}/ws`);
  const received: any[] = [];
  ws.on('message', (m) => received.push(JSON.parse(String(m))));
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => ws.send(JSON.stringify({ type: 'AUTH', token: `demo_token_${admin['x-user-id']}` })));
    ws.once('error', reject);
    const t = setInterval(() => { if (received.some(m => m.type === 'AUTH_SUCCESS')) { clearInterval(t); resolve(); } }, 20);
  });

  const ok = await api('/api/partners/inquiry', { method: 'POST', headers: json, body: JSON.stringify({
    orgName: `Refresh Check ${Date.now().toString(36)}`, orgType: 'fleet', contactName: 'Pat', contactEmail: 'pat@example.test',
  }) });
  assert.equal(ok.status, 200);

  const deadline = Date.now() + 3000;
  while (Date.now() < deadline && !received.some(m => m.type === 'REFRESH')) await new Promise(r => setTimeout(r, 20));
  ws.close();
  assert.deepEqual(received.find(m => m.type === 'REFRESH'), { type: 'REFRESH', scope: 'notifications' });
});
