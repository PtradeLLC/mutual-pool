// Custody layer against a fake Column bank: movements, settlement, ACH in/out,
// webhooks and signatures. No network.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

process.env.CUSTODY_PROVIDER = 'column';
process.env.COLUMN_API_KEY = 'test_fake_key_for_unit_tests';

const custody = await import('../src/server/custody');
const column = await import('../src/services/column');
import type { CustodyMovement, CustodySettings, Pod, User } from '../src/types';

// ---- fake bank ------------------------------------------------------------
type FakeAccount = { id: string; entity_id: string; description: string; default_account_number: string; default_account_number_id: string; routing_number: string; balance: number };
const bank = {
  entities: new Map<string, any>(),
  accounts: new Map<string, FakeAccount>(),
  counterparties: new Map<string, any>(),
  books: [] as any[],
  achs: new Map<string, any>(),
  seen: new Map<string, any>(), // idempotency
  failNextBookWith: null as null | { status: number; message: string },
  rejectNextBook: false,
  rejectNextRealtime: false,
};
let seq = 0;
const fakeTransport: column.ColumnTransport = async (method, path, body: any, opts) => {
  const key = opts?.idempotencyKey ? `${method} ${path} ${opts.idempotencyKey}` : '';
  if (key && bank.seen.has(key)) return bank.seen.get(key);
  const remember = (v: any) => { if (key) bank.seen.set(key, v); return v; };
  if (method === 'POST' && path === '/entities/person') {
    const id = `enti_${++seq}`;
    const status = body.last_name === 'Review' ? 'manual_review' : body.last_name === 'Denied' ? 'denied' : 'verified';
    const e = { id, type: 'PERSON', verification_status: status, person_details: { first_name: body.first_name, last_name: body.last_name } };
    bank.entities.set(id, e); return remember(e);
  }
  if (method === 'POST' && path === '/entities/business') {
    const id = `enti_biz_${++seq}`; const e = { id, type: 'BUSINESS', verification_status: 'verified', name: body.business_name };
    bank.entities.set(id, e); return remember(e);
  }
  if (method === 'POST' && path === '/bank-accounts') {
    const id = `bacc_${++seq}`;
    const a: FakeAccount = { id, entity_id: body.entity_id, description: body.description, default_account_number: `12345${seq}`.padStart(10, '0'), default_account_number_id: `acno_${seq}`, routing_number: '121145349', balance: 0 };
    bank.accounts.set(id, a); return remember({ ...a, balances: { available_amount: 0, pending_amount: 0, holding_amount: 0, locked_amount: 0 } });
  }
  if (method === 'GET' && path.startsWith('/bank-accounts/')) {
    const a = bank.accounts.get(decodeURIComponent(path.split('/')[2]));
    if (!a) throw new column.ColumnError(404, 'not found', 'not_found');
    return { ...a, balances: { available_amount: a.balance, pending_amount: 0, holding_amount: 0, locked_amount: 0 } };
  }
  if (method === 'POST' && path === '/counterparties') {
    const id = `cpty_${++seq}`; const c = { id, account_number: body.account_number, routing_number: body.routing_number, name: body.name };
    bank.counterparties.set(id, c); return remember(c);
  }
  if (method === 'POST' && path === '/transfers/book') {
    if (bank.failNextBookWith) { const f = bank.failNextBookWith; bank.failNextBookWith = null; throw new column.ColumnError(f.status, f.message); }
    const s = bank.accounts.get(body.sender_bank_account_id); const r = bank.accounts.get(body.receiver_bank_account_id);
    if (!s || !r) throw new column.ColumnError(404, 'account not found');
    if (bank.rejectNextBook) { bank.rejectNextBook = false; return remember({ id: `book_${++seq}`, status: 'REJECTED', amount: body.amount }); }
    if (s.balance < body.amount && !body.allow_overdraft) throw new column.ColumnError(400, 'insufficient funds', 'insufficient_funds');
    s.balance -= body.amount; r.balance += body.amount;
    const t = { id: `book_${++seq}`, status: 'COMPLETED', amount: body.amount, sender_bank_account_id: s.id, receiver_bank_account_id: r.id, idempotency_key: opts?.idempotencyKey };
    bank.books.push(t); return remember(t);
  }
  if (method === 'GET' && path.startsWith('/institutions/')) {
    const rn = path.split('/')[2];
    return { routing_number: rn, short_name: rn === '021000021' ? 'JPMORGAN CHASE' : 'SMALL BANK', ach_eligible: true, realtime_eligible: rn === '021000021' };
  }
  if (method === 'POST' && path === '/transfers/realtime') {
    const id = `rttr_${++seq}`; const t = { id, amount: body.amount, status: bank.rejectNextRealtime ? 'rejected' : 'completed', rejection_code: bank.rejectNextRealtime ? 'AC01' : undefined };
    if (bank.rejectNextRealtime) { bank.rejectNextRealtime = false; throw new column.ColumnError(400, 'AC01 invalid account', 'rejected'); }
    return remember(t);
  }
  if (method === 'POST' && path === '/transfers/ach') {
    const id = `acht_${++seq}`; const t = { id, type: body.type, amount: body.amount, status: 'INITIATED', bank_account_id: body.bank_account_id, counterparty_id: body.counterparty_id, idempotency_key: opts?.idempotencyKey };
    bank.achs.set(id, t); return remember(t);
  }
  throw new column.ColumnError(500, `fake bank: unhandled ${method} ${path}`);
};
column.setColumnTransport(fakeTransport);

// ---- server-side state the custody layer needs ------------------------------
const users: User[] = [];
const pods: Pod[] = [];
let movements: CustodyMovement[] = [];
let settings: CustodySettings | null = null;
const audits: any[] = [];
const incidents: any[] = [];
const notices: any[] = [];
const withdrawalEvents: any[] = [];
function user(id: string, balance = 0): User {
  const u = { id, email: `${id}@example.test`, displayName: id, platform: 'DoorDash', role: 'Member', kycStatus: 'VERIFIED', completedPodsCount: 0, treasury: { stripeAccountId: '', stripeFinAccountId: '', balanceUsd: balance, pendingInboundUsd: 0, totalPayoutsReceivedUsd: 0, fdicPassThroughEligible: false, status: 'ACTIVE' } } as unknown as User;
  users.push(u); return u;
}
function pod(id: string): Pod {
  const p = { id, name: `Pod ${id}`, members: [], status: 'ACTIVE', depositTier: 20, sizeTier: 20, currentCycleWeek: 1, totalCycles: 3, createdBy: 'c', creatorName: 'c', weeklyPoolTarget: 60, currentWeeklyCollected: 0 } as unknown as Pod;
  pods.push(p); return p;
}
custody.initCustody({
  getUsers: () => users, getPods: () => pods,
  getMovements: () => movements, setMovements: d => { movements = d; },
  getSettings: () => settings, setSettings: d => { settings = d; },
  onChange: () => {},
  audit: (podId, action, detail, metadata) => audits.push({ podId, action, detail, metadata }),
  incident: (severity, kind, message) => incidents.push({ severity, kind, message }),
  creditLedger: (u, a) => { u.treasury.balanceUsd = Math.round((u.treasury.balanceUsd + a) * 100) / 100; },
  debitLedger: (u, a) => { u.treasury.balanceUsd = Math.round((u.treasury.balanceUsd - a) * 100) / 100; return true; },
  notify: (userId, title, message) => notices.push({ userId, title, message }),
  onWithdrawalSettled: id => withdrawalEvents.push({ id, settled: true }),
  onWithdrawalReturned: (id, reason) => withdrawalEvents.push({ id, returned: reason }),
});
const ident = (first: string, last: string) => ({ firstName: first, lastName: last, dateOfBirth: '1990-01-01', ssn: '123456789', address: { line1: '1 Main St', city: 'Austin', state: 'TX', postalCode: '78701' } });

test('platform accounts bootstrap once in the sandbox and member/pod accounts are opened on demand', async () => {
  assert.equal(custody.custodyMode(), 'column');
  const s1 = await custody.ensurePlatformAccounts();
  const s2 = await custody.ensurePlatformAccounts();
  assert.equal(s1.operatingAccountId, s2.operatingAccountId);
  assert.ok(bank.accounts.has(s1.escrowAccountId) && bank.accounts.has(s1.revenueAccountId));
  const alice = user('alice', 50);
  const c = await custody.provisionMemberAccount(alice, ident('Alice', 'Smith'));
  assert.equal(c.status, 'VERIFIED');
  assert.equal(c.accountNumberLast4.length, 4);
  assert.equal((await custody.provisionMemberAccount(alice, ident('Alice', 'Smith'))).bankAccountId, c.bankAccountId, 'idempotent');
  assert.ok(audits.some(a => a.action === 'CUSTODY_ACCOUNT_OPENED'));
  const bob = user('bob', 0);
  assert.equal((await custody.provisionMemberAccount(bob, ident('Bob', 'Review'))).status, 'MANUAL_REVIEW');
});

test('movements between Column accounts settle as book transfers; missing accounts wait, bank rejections fail', async () => {
  const alice = users.find(u => u.id === 'alice')!;
  bank.accounts.get(alice.custody!.bankAccountId)!.balance = 10_000; // $100 at the bank
  const p = pod('p1');
  const dep = custody.recordMovement({ from: { kind: 'member', userId: 'alice' }, to: { kind: 'pod', podId: 'p1' }, amountUsd: 20, purpose: 'DEPOSIT', description: 'week 1', refs: { podId: 'p1', userId: 'alice', cycleWeek: 1 } })!;
  const fee = custody.recordMovement({ from: { kind: 'member', userId: 'alice' }, to: { kind: 'platform', account: 'revenue' }, amountUsd: 1, purpose: 'DEPOSIT_FEE', description: 'fee' })!;
  assert.equal(dep.status, 'PENDING');
  assert.equal(dep.provider, 'column');
  // A member without a Column account: the movement waits, nothing moves.
  user('carol', 30);
  const waitingMv = custody.recordMovement({ from: { kind: 'member', userId: 'carol' }, to: { kind: 'pod', podId: 'p1' }, amountUsd: 20, purpose: 'DEPOSIT', description: 'week 1' })!;
  const r1 = await custody.settlePendingMovements();
  assert.equal(r1.settled, 2, JSON.stringify(r1));
  assert.equal(r1.waiting, 1);
  assert.equal(dep.status, 'SETTLED');
  assert.ok(dep.columnTransferId?.startsWith('book_'));
  assert.equal(waitingMv.status, 'PENDING');
  assert.match(waitingMv.lastError || '', /MEMBER_ACCOUNT_MISSING/);
  assert.ok(p.custody?.bankAccountId, 'pod account created on demand');
  assert.equal(bank.accounts.get(p.custody!.bankAccountId)!.balance, 2000);
  assert.equal(bank.accounts.get(alice.custody!.bankAccountId)!.balance, 10_000 - 2100);
  assert.equal(bank.accounts.get(settings!.revenueAccountId)!.balance, 100);
  // Settling again does not re-run completed movements.
  const r2 = await custody.settlePendingMovements();
  assert.equal(r2.settled, 0);
  assert.equal(bank.books.length, 2);
  // A definite rejection fails the movement and raises an incident.
  const bad = custody.recordMovement({ from: { kind: 'pod', podId: 'p1' }, to: { kind: 'member', userId: 'alice' }, amountUsd: 5, purpose: 'PAYOUT', description: 'x' })!;
  bank.rejectNextBook = true;
  const r3 = await custody.settlePendingMovements();
  assert.equal(r3.failed, 1);
  assert.equal(bad.status, 'FAILED');
  assert.ok(incidents.some(i => i.kind === 'custody_movement_failed'));
  // A transient error leaves it pending and retries later.
  const retry = custody.recordMovement({ from: { kind: 'pod', podId: 'p1' }, to: { kind: 'member', userId: 'alice' }, amountUsd: 5, purpose: 'PAYOUT', description: 'y' })!;
  bank.failNextBookWith = { status: 503, message: 'bank busy' };
  await custody.settlePendingMovements();
  assert.equal(retry.status, 'PENDING');
  assert.equal(retry.attempts, 1);
  await custody.settlePendingMovements();
  assert.equal(retry.status, 'SETTLED');
  // External legs are bookkeeping only.
  const topup = custody.recordMovement({ from: { kind: 'external', label: 'stripe' }, to: { kind: 'member', userId: 'alice' }, amountUsd: 25, purpose: 'TOPUP', description: 'card' })!;
  assert.equal(topup.status, 'SETTLED');
  assert.equal(topup.provider, 'ledger');
});

test('ACH funding credits the ledger on settlement and reverses on a late return; withdrawals return to the balance', async () => {
  const alice = users.find(u => u.id === 'alice')!;
  await custody.linkExternalBank(alice, { accountNumber: '000123456789', routingNumber: '021000021', name: 'Alice Smith' });
  assert.equal(alice.custody!.counterpartyLast4, '6789');
  const before = alice.treasury.balanceUsd;
  const fund = await custody.fundFromBank(alice, 40);
  assert.equal(fund.status, 'PENDING');
  assert.equal(alice.treasury.balanceUsd, before, 'not credited until settled');
  const evt = (type: string, data: any, id?: string) => ({ id: id || `evt_${++seq}`, type, created_at: new Date().toISOString(), data });
  assert.equal(await custody.handleColumnEvent(evt('ach.outgoing_transfer.settled', { id: fund.columnTransferId })), 'ach: TOPUP settled');
  assert.equal(alice.treasury.balanceUsd, before + 40);
  assert.equal(fund.status, 'SETTLED');
  // Duplicate settlement event is harmless.
  await custody.handleColumnEvent(evt('ach.outgoing_transfer.completed', { id: fund.columnTransferId }));
  assert.equal(alice.treasury.balanceUsd, before + 40);
  // 30 days later the member's bank returns it as unauthorized.
  await custody.handleColumnEvent(evt('ach.outgoing_transfer.returned', { id: fund.columnTransferId, return_details: [{ return_code: 'R29', description: 'unauthorized' }] }));
  assert.equal(fund.status, 'RETURNED');
  assert.equal(alice.treasury.balanceUsd, before);
  assert.ok(notices.some(n => /returned/i.test(n.title)));
  assert.ok(incidents.some(i => i.kind === 'custody_ach_returned'));

  // Withdrawal: Alice's bank (Chase) is on RTP, so it is instant and settles at once.
  assert.equal(alice.custody!.realtimeEligible, true);
  alice.treasury.balanceUsd = 100;
  const wd = await custody.withdrawToBank(alice, 30, 'wd_1');
  assert.equal(wd.purpose, 'WITHDRAWAL');
  assert.equal(wd.columnTransferKind, 'realtime');
  assert.equal(wd.status, 'SETTLED');
  assert.deepEqual(withdrawalEvents.at(-1), { id: 'wd_1', settled: true });
  // A rejected realtime leg falls back to ACH.
  bank.rejectNextRealtime = true;
  const wdFallback = await custody.withdrawToBank(alice, 5, 'wd_fallback');
  assert.equal(wdFallback.columnTransferKind, 'ach');
  assert.equal(wdFallback.status, 'PENDING');
  await custody.handleColumnEvent(evt('ach.outgoing_transfer.settled', { id: wdFallback.columnTransferId }));
  assert.equal(wdFallback.status, 'SETTLED');
  // A bank without realtime goes straight to ACH.
  await custody.linkExternalBank(alice, { accountNumber: '000999888777', routingNumber: '111000025', name: 'Alice Smith' });
  assert.equal(alice.custody!.realtimeEligible, false);
  const wd2 = await custody.withdrawToBank(alice, 10, 'wd_2');
  await custody.handleColumnEvent(evt('ach.outgoing_transfer.returned', { id: wd2.columnTransferId, return_details: [{ return_code: 'R02' }] }));
  assert.equal(alice.treasury.balanceUsd, 110);
  assert.equal(withdrawalEvents.at(-1)?.returned, 'R02');

  // Direct deposit arriving at the member's account from outside is credited once.
  const incoming = { id: 'acht_incoming_1', is_incoming: true, type: 'CREDIT', amount: 5550, bank_account_id: alice.custody!.bankAccountId, description: 'DOORDASH PAYOUT' };
  await custody.handleColumnEvent(evt('ach.incoming_transfer.completed', incoming));
  await custody.handleColumnEvent(evt('ach.incoming_transfer.completed', incoming));
  assert.equal(alice.treasury.balanceUsd, 165.5);

  // Identity webhook updates the member's account status.
  const bob = users.find(u => u.id === 'bob')!;
  await custody.handleColumnEvent(evt('identity.verification.verified', { id: bob.custody!.entityId, verification_status: 'verified' }));
  assert.equal(bob.custody!.status, 'VERIFIED');
  assert.ok(notices.some(n => n.userId === 'bob' && /ready/i.test(n.title)));
});

test('webhook events are remembered for idempotency and signatures verify in hex or base64', () => {
  assert.equal(custody.rememberEvent('evt_a'), true);
  assert.equal(custody.rememberEvent('evt_a'), false);
  const secret = 'whsec_test';
  const body = Buffer.from(JSON.stringify({ id: 'evt_1', type: 'book.transfer.completed', data: {} }));
  const mac = crypto.createHmac('sha256', secret).update(body).digest();
  assert.equal(column.verifyColumnSignature(body, mac.toString('hex'), secret), true);
  assert.equal(column.verifyColumnSignature(body, mac.toString('base64'), secret), true);
  assert.equal(column.verifyColumnSignature(body, 'deadbeef', secret), false);
  assert.equal(column.verifyColumnSignature(body, mac.toString('hex'), 'other'), false);
  assert.equal(column.verifyColumnSignature(Buffer.from('{}'), mac.toString('hex'), secret), false);
});

test('ledger mode records movements as settled without touching the bank', async () => {
  process.env.CUSTODY_PROVIDER = 'ledger';
  const before = bank.books.length;
  const m = custody.recordMovement({ from: { kind: 'member', userId: 'alice' }, to: { kind: 'pod', podId: 'p1' }, amountUsd: 20, purpose: 'DEPOSIT', description: 'ledger only' })!;
  assert.equal(m.status, 'SETTLED');
  assert.equal(m.provider, 'ledger');
  assert.deepEqual(await custody.settlePendingMovements(), { settled: 0, failed: 0, waiting: 0 });
  assert.equal(bank.books.length, before);
  assert.equal(custody.custodyStatus().mode, 'ledger');
  process.env.CUSTODY_PROVIDER = 'column';
});
