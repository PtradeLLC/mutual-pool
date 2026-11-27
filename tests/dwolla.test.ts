// Dwolla payment rail against a fake Dwolla (no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

process.env.DWOLLA_API_KEY = 'test-key';
process.env.DWOLLA_API_SECRET = 'test-secret';
process.env.DWOLLA_ENV = 'sandbox';

import * as dwolla from '../src/services/dwolla';
import * as rail from '../src/server/dwollaRail';
import { contributionAmounts } from '../src/lib/contributionFees';
import type { User } from '../src/types';

const BASE = 'https://api-sandbox.dwolla.com';

// --- Fake Dwolla -------------------------------------------------------------------
type Call = { method: string; url: string; body?: any; idempotencyKey?: string };
const calls: Call[] = [];
let seq = 0;
const customers = new Map<string, { status: string }>();
const transfersStatus = new Map<string, string>();
const seenIdempotency = new Map<string, string>();

dwolla.setDwollaTransport(async (method, url, body, opts) => {
  const full = url.startsWith('http') ? url : BASE + url;
  calls.push({ method, url: full, body, idempotencyKey: opts?.idempotencyKey });
  const replay = opts?.idempotencyKey && seenIdempotency.get(opts.idempotencyKey);
  if (replay) return { status: 201, location: replay, body: null as any };
  const make = (kind: string) => {
    const loc = `${BASE}/${kind}/${++seq}`;
    if (opts?.idempotencyKey) seenIdempotency.set(opts.idempotencyKey, loc);
    return loc;
  };
  if (method === 'POST' && full === `${BASE}/customers`) {
    const loc = make('customers');
    customers.set(loc, { status: 'verified' });
    return { status: 201, location: loc, body: null as any };
  }
  if (method === 'GET' && customers.has(full)) return { status: 200, body: customers.get(full) as any };
  if (method === 'GET' && /\/customers\/\d+\/funding-sources$/.test(full)) {
    return { status: 200, body: { _embedded: { 'funding-sources': [{ type: 'balance', status: 'verified', name: 'Balance', _links: { self: { href: full.replace('/funding-sources', '') + '/balance-fs' } } }] } } as any };
  }
  if (method === 'POST' && full === `${BASE}/on-demand-authorizations`) {
    return { status: 200, body: { bodyText: 'I agree that all future payments ...', buttonText: 'Agree & Continue', _links: { self: { href: `${BASE}/on-demand-authorizations/${++seq}` } } } as any };
  }
  if (method === 'POST' && /\/customers\/\d+\/funding-sources$/.test(full)) return { status: 201, location: make('funding-sources'), body: null as any };
  if (/\/funding-sources\/\d+\/micro-deposits$/.test(full)) return { status: method === 'POST' && body ? 200 : 201, body: {} as any };
  if (method === 'GET' && /\/funding-sources\/\d+$/.test(full)) return { status: 200, body: { type: 'bank', status: 'verified', bankName: 'SANDBOX TEST BANK', name: 'Checking' } as any };
  if (method === 'POST' && full === `${BASE}/transfers`) {
    const loc = make('transfers');
    transfersStatus.set(loc, 'pending');
    return { status: 201, location: loc, body: null as any };
  }
  if (method === 'GET' && /\/transfers\/\d+\/failure$/.test(full)) return { status: 200, body: { code: 'R01', description: 'Insufficient Funds' } as any };
  if (method === 'GET' && transfersStatus.has(full)) return { status: 200, body: { status: transfersStatus.get(full), amount: { value: '21.00' } } as any };
  throw new dwolla.DwollaError(404, `fake dwolla: no route for ${method} ${full}`);
});

// --- Fake app state -------------------------------------------------------------
const users: User[] = [];
const audits: string[] = [];
rail.initRail({ users: () => users, persist: () => {}, audit: (_u, _n, action) => { audits.push(action); } });

function makeUser(id: string, name: string): User {
  const u = { id, displayName: name, email: `${id}@example.test` } as unknown as User;
  users.push(u);
  return u;
}
const goodInput = { firstName: 'Ada', lastName: 'Lovelace', address1: '1 Main St', city: 'Austin', state: 'tx', postalCode: '78701', dateOfBirth: '1990-05-01', ssnLast4: '1234' };

async function readyMember(id: string, name: string): Promise<User> {
  const u = makeUser(id, name);
  const v = rail.validateEnrollInput(goodInput);
  assert.ok(v.ok);
  await rail.enrollMember(u, (v as any).value);
  const auth = await rail.startDebitAuthorization(u);
  await rail.linkBank(u, { authorizationId: auth.id, routingNumber: '222222226', accountNumber: '123456789' }, { ip: '203.0.113.9', userAgent: 'test-agent' });
  return u;
}

// --- Tests ------------------------------------------------------------------------
test('contribution amounts: 5% non-refundable reserve fee on top, 10% platform fee off the payout', () => {
  assert.deepEqual(contributionAmounts(20), { depositUsd: 20, reserveFeeUsd: 1, platformFeeUsd: 2, debitUsd: 21, recipientNetUsd: 18, mutualPoolUsd: 3 });
  assert.deepEqual(contributionAmounts(5), { depositUsd: 5, reserveFeeUsd: 0.25, platformFeeUsd: 0.5, debitUsd: 5.25, recipientNetUsd: 4.5, mutualPoolUsd: 0.75 });
  assert.throws(() => contributionAmounts(0));
});

test('enrollment input is validated', () => {
  assert.equal(rail.validateEnrollInput(goodInput).ok, true);
  assert.equal((rail.validateEnrollInput(goodInput) as any).value.state, 'TX');
  assert.equal(rail.validateEnrollInput({ ...goodInput, dateOfBirth: '2015-01-01' }).ok, false, 'under 18');
  assert.equal(rail.validateEnrollInput({ ...goodInput, address1: 'PO Box 12' }).ok, false, 'PO box');
  assert.equal(rail.validateEnrollInput({ ...goodInput, state: 'ZZ' }).ok, false, 'state');
  assert.equal(rail.validateEnrollInput({ ...goodInput, ssnLast4: '12' }).ok, false, 'ssn');
  assert.equal(rail.validateEnrollInput({ ...goodInput, postalCode: '7870' }).ok, false, 'zip');
});

test('enrolling, authorizing and linking a bank records the authorization and never stores the SSN', async () => {
  const u = await readyMember('usr_payer', 'Payer');
  assert.equal(u.dwolla?.customerStatus, 'verified');
  assert.ok(u.dwolla?.balanceFundingSourceUrl, 'balance attached');
  assert.equal(u.dwolla?.bankStatus, 'verified');
  assert.equal(rail.canContribute(u), true);
  assert.ok(!JSON.stringify(u).includes('1234'), 'SSN last four not kept on the user');

  const create = calls.find(c => c.method === 'POST' && c.url === `${BASE}/customers`)!;
  assert.equal(create.body.ssn, '1234', 'SSN goes to Dwolla');
  assert.equal(create.body.type, 'personal');

  const auth = rail.railCollections.authorizations.get().find(a => a.userId === 'usr_payer')!;
  assert.ok(auth.acceptedAt);
  assert.equal(auth.acceptedIp, '203.0.113.9');
  assert.equal(auth.acceptedUserAgent, 'test-agent');
  assert.match(auth.bodyText, /I agree/);
  const bankCall = calls.find(c => c.method === 'POST' && /\/customers\/\d+\/funding-sources$/.test(c.url))!;
  assert.equal(bankCall.body._links['on-demand-authorization'].href, auth.authorizationUrl, 'bank linked with the authorization');

  // A used authorization cannot be reused.
  await assert.rejects(rail.linkBank(u, { authorizationId: auth.id, routingNumber: '222222226', accountNumber: '1' }, {}), (e: any) => e.code === 'AUTHORIZATION_USED');
  // Enrolling again returns the same customer.
  const before = calls.filter(c => c.url === `${BASE}/customers`).length;
  await rail.enrollMember(u, (rail.validateEnrollInput(goodInput) as any).value);
  assert.equal(calls.filter(c => c.url === `${BASE}/customers`).length, before);
});

test('a contribution debits the payer bank into the recipient balance with both fees on one party', async () => {
  const payer = users.find(u => u.id === 'usr_payer')!;
  const recipient = await readyMember('usr_recipient', 'Recipient');
  const record = await rail.createContribution(payer, recipient, 20, { podId: 'pod_1', cycleWeek: 3 });
  assert.equal(record.status, 'pending');
  assert.equal(record.amountUsd, 21);
  assert.equal(record.reserveFeeUsd, 1);
  assert.equal(record.platformFeeUsd, 2);

  const t = calls.filter(c => c.method === 'POST' && c.url === `${BASE}/transfers`).at(-1)!;
  assert.equal(t.body._links.source.href, payer.dwolla!.bankFundingSourceUrl);
  assert.equal(t.body._links.destination.href, recipient.dwolla!.balanceFundingSourceUrl);
  assert.deepEqual(t.body.amount, { currency: 'USD', value: '21.00' });
  assert.equal(t.body.fees.length, 2);
  assert.ok(t.body.fees.every((f: any) => f._links['charge-to'].href === recipient.dwolla!.customerUrl), 'all fees charged to the recipient');
  assert.deepEqual(t.body.fees.map((f: any) => f.amount.value).sort(), ['1.00', '2.00']);
  assert.ok(t.idempotencyKey);

  // Running the weekly job twice does not debit twice.
  const again = await rail.createContribution(payer, recipient, 20, { podId: 'pod_1', cycleWeek: 3 });
  assert.equal(again.id, record.id);
  assert.equal(calls.filter(c => c.method === 'POST' && c.url === `${BASE}/transfers`).length, 1);

  await assert.rejects(rail.createContribution(payer, payer, 20, { podId: 'pod_1', cycleWeek: 4 }), (e: any) => e.code === 'SAME_MEMBER');
  await assert.rejects(dwolla.createTransfer({ sourceUrl: 'a', destinationUrl: 'b', amountUsd: 1, fees: [{ chargeToCustomerUrl: 'x', amountUsd: 0.1 }, { chargeToCustomerUrl: 'y', amountUsd: 0.1 }] }, 'k'), (e: any) => e.code === 'fee_party');
});

test('webhooks: signatures are checked; events update transfers and customers once', async () => {
  const secret = 'whsec_test';
  const raw = Buffer.from(JSON.stringify({ id: 'evt_1' }));
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  assert.equal(dwolla.verifyWebhookSignature(raw, sig, secret), true);
  assert.equal(dwolla.verifyWebhookSignature(raw, sig, 'other'), false);
  assert.equal(dwolla.verifyWebhookSignature(raw, undefined, secret), false);

  const record = rail.railCollections.transfers.get()[0];
  const recipient = users.find(u => u.id === 'usr_recipient')!;
  const done = await rail.handleWebhookEvent({ id: 'evt_t1', topic: 'customer_transfer_completed', _links: { resource: { href: record.transferUrl }, customer: { href: recipient.dwolla!.customerUrl } } });
  assert.equal(done.note, 'transfer processed');
  assert.equal(record.status, 'processed');
  const dup = await rail.handleWebhookEvent({ id: 'evt_t1', topic: 'customer_transfer_completed', _links: { resource: { href: record.transferUrl } } });
  assert.equal(dup.note, 'duplicate');

  await rail.handleWebhookEvent({ id: 'evt_c1', topic: 'customer_suspended', _links: { resource: { href: recipient.dwolla!.customerUrl }, customer: { href: recipient.dwolla!.customerUrl } } });
  assert.equal(recipient.dwolla!.customerStatus, 'suspended');
  assert.equal(rail.canReceive(recipient), false);
});

test('a failed transfer records the ACH return code', async () => {
  const payer = users.find(u => u.id === 'usr_payer')!;
  const other = await readyMember('usr_other', 'Other');
  const record = await rail.createContribution(payer, other, 10, { podId: 'pod_2', cycleWeek: 1 });
  transfersStatus.set(record.transferUrl, 'failed');
  const r = await rail.reconcilePendingTransfers();
  assert.ok(r.changed >= 1);
  assert.equal(record.status, 'failed');
  assert.equal(record.failureCode, 'R01');
});

test('the rail stays off in production unless DWOLLA_ENABLED=true', () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  delete process.env.DWOLLA_ENABLED;
  assert.equal(rail.railEnabled(), false);
  process.env.DWOLLA_ENABLED = 'true';
  assert.equal(rail.railEnabled(), true);
  delete process.env.DWOLLA_ENABLED;
  process.env.NODE_ENV = prev;
  assert.equal(rail.railEnabled(), true, 'on in development when keys are set');
});
