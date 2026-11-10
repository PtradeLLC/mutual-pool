// App health rules (src/server/telemetry.ts) and the browser-side masking.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanText, pathTemplate, simplifyUserAgent, errorFingerprint, recordError, markStep, mergeJourneys, computeFunnel,
  symbolicateStack, FUNNELS, ERROR_ALERT_USERS, type UserJourney,
} from '../src/server/telemetry';
import { mask } from '../src/lib/telemetry';

test('personal data is masked before it is stored', () => {
  assert.equal(cleanText('Card 4242 4242 4242 4242 failed for maria@example.com'), 'Card # failed for [email]');
  assert.equal(cleanText('SSN 123-45-6789'), 'SSN #');
  assert.equal(cleanText('Pay $52.50 by Friday'), 'Pay $52.50 by Friday', 'short amounts stay readable');
  assert.equal(mask('Account 000123456789 for a@b.co'), 'Account # for [email]');
  assert.equal(cleanText('word '.repeat(100)).length, 300);
  assert.equal(cleanText('token ' + 'a1'.repeat(30)), 'token [id]', 'long ids are masked');
});

test('server request paths are grouped without ids', () => {
  assert.equal(pathTemplate('/api/pods/pod_cp_ab12_3_f00/join?x=1'), '/api/pods/:id/join');
  assert.equal(pathTemplate('/api/c/raesaves/join'), '/api/c/raesaves/join');
  assert.equal(pathTemplate('/api/admin/creators/usr_123abc/suspend'), '/api/admin/creators/:id/suspend');
});

test('browser, system and device are reduced to families', () => {
  assert.deepEqual(simplifyUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17.0 Mobile/15E148 Safari/604.1'), { browser: 'Safari', os: 'iOS', device: 'mobile' });
  assert.deepEqual(simplifyUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36'), { browser: 'Chrome', os: 'Windows', device: 'desktop' });
});

test('the same problem groups together; different problems do not', () => {
  const a = errorFingerprint({ kind: 'api', message: 'x', method: 'POST', path: '/api/pods/pod_1abcdef/join', status: 402, code: 'INSUFFICIENT_FUNDS' });
  const b = errorFingerprint({ kind: 'api', message: 'y', method: 'POST', path: '/api/pods/pod_9zzzzzz/join', status: 402, code: 'INSUFFICIENT_FUNDS' });
  const c = errorFingerprint({ kind: 'api', message: 'x', method: 'POST', path: '/api/pods/pod_1abcdef/join', status: 403, code: 'KYC_REQUIRED' });
  assert.equal(a, b);
  assert.notEqual(a, c);
  const e1 = errorFingerprint({ kind: 'error', message: 'Cannot read properties of undefined (reading 12)', stack: 'at f (/assets/index-AbCdEf12.js:1:200)' });
  const e2 = errorFingerprint({ kind: 'error', message: 'Cannot read properties of undefined (reading 99)', stack: 'at f (/assets/index-ZzYyXx98.js:1:200)' });
  assert.equal(e1, e2, 'numbers and build hashes do not split a group');
});

test('error groups count people and screens, alert once at the threshold, and reopen when they come back', () => {
  const now = new Date('2026-11-09T12:00:00Z');
  const report = { kind: 'ui' as const, message: 'Could not join pod', screen: 'dashboard/explore-pods', breadcrumbs: ['tap Join'] };
  let group: any;
  let alerts = 0;
  for (let i = 0; i < ERROR_ALERT_USERS + 2; i++) {
    const r = recordError(group, { ...report, screen: i % 2 ? 'pod detail' : report.screen }, { fingerprint: 'err_x', now, userKey: `u${i}`, ua: '', newSession: true });
    group = r.group;
    if (r.shouldAlert) alerts += 1;
  }
  assert.equal(group.count, ERROR_ALERT_USERS + 2);
  assert.equal(group.userIds.length, ERROR_ALERT_USERS + 2);
  assert.equal(alerts, 1, 'one alert per problem');
  assert.ok(group.screens['dashboard/explore-pods'] > 0 && group.screens['pod detail'] > 0);
  assert.ok(group.samples.length <= 5);
  group.state = 'RESOLVED';
  const again = recordError(group, report, { fingerprint: 'err_x', now, userKey: 'u1', ua: '', newSession: false });
  assert.equal(again.reopened, true);
  assert.equal(again.group.state, 'OPEN');
});

test('funnels count people step by step, in order, with median time between steps', () => {
  const t = (h: number) => new Date(Date.UTC(2026, 10, 1, h)).toISOString();
  const journeys: UserJourney[] = [
    { id: 'a', steps: { account_created: t(0), identity_started: t(1), identity_verified: t(2), bank_started: t(3), bank_authorized: t(4), funds_added: t(5), pod_joined: t(6), first_payout: t(30) }, updatedAt: '' },
    { id: 'b', steps: { account_created: t(0), identity_started: t(3), identity_verified: t(5) }, updatedAt: '' },
    { id: 'c', steps: { account_created: t(0) }, updatedAt: '' },
    { id: 'd', steps: { account_created: t(0), identity_verified: t(1) }, updatedAt: '' }, // skipped a step: not counted further
  ];
  const f = computeFunnel(FUNNELS.find(x => x.id === 'member')!, journeys);
  assert.equal(f.started, 4);
  assert.deepEqual(f.steps.map(s => s.users), [4, 2, 2, 1, 1, 1, 1, 1]);
  assert.equal(f.steps[1].fromPrevious, 50);
  assert.equal(f.steps[2].medianMinutesFromPrevious, 90, 'median of 1h and 2h');
  assert.equal(f.steps[6].label, 'Created or joined a pod');
  const late = computeFunnel(FUNNELS[0], journeys, new Date(Date.UTC(2026, 10, 2)));
  assert.equal(late.started, 0, 'the window filters on the first step');
});

test('steps keep the first time, and a visitor’s steps carry over at sign-in', () => {
  const j: UserJourney = { id: 'u', steps: {}, updatedAt: '' };
  assert.equal(markStep(j, 'creator_link_opened', new Date('2026-11-02T00:00:00Z')), true);
  assert.equal(markStep(j, 'creator_link_opened', new Date('2026-11-03T00:00:00Z')), false);
  const visitor: UserJourney = { id: 'v:x', steps: { creator_link_opened: '2026-11-01T00:00:00.000Z', creator_page_viewed: '2026-11-01T00:00:00.000Z' }, updatedAt: '' };
  mergeJourneys(j, visitor);
  assert.equal(j.steps.creator_link_opened, '2026-11-01T00:00:00.000Z');
  assert.ok(j.steps.creator_page_viewed);
});

test('minified stack lines are translated with the private source maps', () => {
  const stack = 'TypeError: x is undefined\n    at a (https://themutualpool.com/assets/index-AbC12345.js:1:500)\n    at b (native)';
  const out = symbolicateStack(stack, file => (file === 'assets/index-AbC12345.js'
    ? { originalPositionFor: () => ({ source: '../../src/components/CreatePodModal.tsx', line: 88, column: 4, name: 'handleSubmit' }) }
    : null));
  assert.match(out, /at handleSubmit \(src\/components\/CreatePodModal\.tsx:88:4\)/);
  assert.match(out, /at b \(native\)/);
});
