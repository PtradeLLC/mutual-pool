// App health end to end: errors by screen, funnels, screens, feedback,
// opt-out and admin-only access. DEMO_MODE server (npm run test:integration).
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const json = { 'content-type': 'application/json' };
const nonce = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const userHeaders = (id: string, extra: Record<string, string> = {}) => ({ ...json, 'x-user-id': id, 'x-user-email': `${id}@example.test`, 'x-user-name': id, ...extra });
const admin = userHeaders(`usr_ah_admin_${nonce()}`, { 'x-user-role': 'Admin' });

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}
const send = (headers: Record<string, string>, payload: unknown) => api('/api/telemetry', { method: 'POST', headers, body: JSON.stringify(payload) });

test('errors from different people group together, by screen, with personal data masked', async () => {
  const code = `TEST_${nonce().toUpperCase()}`;
  for (let i = 0; i < 3; i++) {
    const r = await send(json, {
      visitorId: nonce(), sessionId: nonce(), appVersion: 'test', language: 'en',
      items: [
        { t: 'screen', screen: 'dashboard/explore-pods' },
        { t: 'error', kind: 'api', message: `Add funds first, maria${i}@example.com`, method: 'POST', path: `/api/pods/pod_abc12${i}9/join`, status: 402, code, screen: i ? 'pod detail' : 'dashboard/explore-pods', breadcrumbs: ['tap Join pod', 'tap 4242 4242 4242 4242'] },
      ],
    });
    assert.equal(r.status, 204);
  }
  const health = await api('/api/admin/app-health?days=7', { headers: admin });
  assert.equal(health.status, 200);
  const group = health.body.errors.find((e: any) => e.code === code);
  assert.ok(group, 'grouped');
  assert.equal(group.users, 3);
  assert.equal(group.path, '/api/pods/:id/join');
  assert.equal(group.screens['pod detail'], 2);
  assert.ok(!JSON.stringify(group).includes('@example.com'), 'email masked');
  const detail = await api(`/api/admin/app-health/errors/${group.id}`, { headers: admin });
  assert.equal(detail.status, 200);
  assert.ok(detail.body.samples[0].breadcrumbs.includes('tap #'), 'card-like numbers masked');
  assert.equal(detail.body.userIds, undefined, 'raw user list not exposed');
  assert.equal((await api(`/api/admin/app-health/errors/${group.id}/resolve`, { method: 'POST', headers: admin })).status, 200);
  const after = await api('/api/admin/app-health?days=7', { headers: admin });
  assert.equal(after.body.errors.find((e: any) => e.id === group.id).state, 'RESOLVED');
});

test('screens are counted and members can only report, not read', async () => {
  const member = userHeaders(`usr_ah_member_${nonce()}`);
  assert.equal((await send(member, { sessionId: nonce(), items: [{ t: 'screen', screen: 'creators page' }, { t: 'screen', screen: 'creators page' }] })).status, 204);
  assert.equal((await api('/api/admin/app-health', { headers: member })).status, 403);
  const health = await api('/api/admin/app-health?days=7', { headers: admin });
  assert.ok(health.body.screens.find((s: any) => s.screen === 'creators page').views >= 2);
});

test('funnels combine app steps (including before sign-in) with what the server records', async () => {
  const visitorId = nonce();
  const id = `usr_ah_follow_${nonce()}`;
  await send(json, { visitorId, sessionId: nonce(), items: [{ t: 'step', step: 'creator_link_opened' }] });
  // Signs in on the same device: the visitor step moves to the account.
  await send(userHeaders(id), { visitorId, sessionId: nonce(), items: [{ t: 'step', step: 'creator_link_signed_in' }, { t: 'step', step: 'not_a_real_step' }] });
  const health = await api('/api/admin/app-health?days=7', { headers: admin });
  const follower = health.body.funnels.find((f: any) => f.id === 'follower');
  assert.ok(follower.steps[0].users >= 1);
  assert.ok(follower.steps[1].users >= 1);
  const member = health.body.funnels.find((f: any) => f.id === 'member');
  assert.ok(member.steps[0].users >= 1, 'accounts come from server records');
});

test('people who turn off usage data are not recorded', async () => {
  const id = `usr_ah_off_${nonce()}`;
  const h = userHeaders(id);
  assert.equal((await api('/api/telemetry/preference', { method: 'POST', headers: h, body: JSON.stringify({ optOut: true }) })).body.usageDataOptOut, true);
  const code = `OFF_${nonce().toUpperCase()}`;
  await send(h, { sessionId: nonce(), items: [{ t: 'error', kind: 'api', message: 'x', method: 'GET', path: '/api/x', status: 500, code, screen: 's', breadcrumbs: [] }] });
  const health = await api('/api/admin/app-health?days=7', { headers: admin });
  assert.ok(!health.body.errors.some((e: any) => e.code === code));
});

test('feedback and problem reports reach admins', async () => {
  const id = `usr_ah_fb_${nonce()}`;
  assert.equal((await api('/api/feedback', { method: 'POST', headers: userHeaders(id), body: JSON.stringify({ kind: 'hard', step: 'pod_joined', comment: 'Took me a while to find the Join button', screen: 'dashboard/explore-pods' }) })).status, 200);
  assert.equal((await api('/api/feedback', { method: 'POST', headers: json, body: JSON.stringify({ kind: 'problem', comment: 'Page froze after I tapped Join, call 555 123 4567', screen: 'creator link', lastError: 'Network request failed' }) })).status, 200);
  assert.equal((await api('/api/feedback', { method: 'POST', headers: json, body: JSON.stringify({ kind: 'problem', comment: '' }) })).status, 400);
  const health = await api('/api/admin/app-health?days=7', { headers: admin });
  assert.ok(health.body.feedback.byStep.pod_joined.hard >= 1);
  const report = health.body.feedback.entries.find((f: any) => f.kind === 'problem' && f.comment.startsWith('Page froze'));
  assert.ok(report);
  assert.ok(report.comment.endsWith('call #'), 'phone-like numbers masked');
  assert.equal((await api(`/api/admin/app-health/feedback/${report.id}/done`, { method: 'POST', headers: admin })).status, 200);
});
