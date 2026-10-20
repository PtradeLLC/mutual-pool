// Exercise the Column integration against the real sandbox:
//
//   npm run column:smoke
//
// Creates (once) the platform entity and accounts, opens a test member's
// account, funds it with a simulated incoming ACH credit, moves a deposit into
// a pod account and a payout back, then starts and settles an ACH withdrawal.
// Needs COLUMN_API_KEY (test_...) in .env. Never run with a live key.
import 'dotenv/config';
import * as column from '../src/services/column';
import * as custody from '../src/server/custody';
import type { CustodyMovement, CustodySettings, Pod, User } from '../src/types';

if (column.columnMode() !== 'sandbox') {
  console.error(`Refusing to run: COLUMN_API_KEY is ${column.columnMode()} (need a test_ key).`);
  process.exit(1);
}
process.env.CUSTODY_PROVIDER = 'column';

const users: User[] = [];
const pods: Pod[] = [];
let movements: CustodyMovement[] = [];
let settings: CustodySettings | null = null;
custody.initCustody({
  getUsers: () => users, getPods: () => pods,
  getMovements: () => movements, setMovements: d => { movements = d; },
  getSettings: () => settings, setSettings: d => { settings = d; },
  onChange: () => {},
  audit: (_p, action, detail) => console.log(`  [audit] ${action}: ${detail}`),
  incident: (sev, kind, message) => console.log(`  [incident:${sev}] ${kind}: ${message}`),
  creditLedger: (u, a) => { u.treasury.balanceUsd += a; },
  debitLedger: (u, a) => { u.treasury.balanceUsd -= a; return true; },
  notify: (_u, title, message) => console.log(`  [notify] ${title}: ${message}`),
});

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
async function balance(accountId: string): Promise<number> {
  const a = await column.getBankAccount(accountId);
  return a.balances?.available_amount || 0;
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('1. Platform accounts');
  const s = await custody.ensurePlatformAccounts();
  console.log(`   entity ${s.entityId}; operating ${s.operatingAccountId}; escrow ${s.escrowAccountId}; revenue ${s.revenueAccountId}`);

  console.log('2. Member account');
  const nonce = Date.now().toString(36);
  const member = { id: `smoke_${nonce}`, email: `smoke_${nonce}@example.test`, displayName: 'Smoke Tester', platform: 'DoorDash', role: 'Member', kycStatus: 'VERIFIED', completedPodsCount: 0,
    treasury: { stripeAccountId: '', stripeFinAccountId: '', balanceUsd: 0, pendingInboundUsd: 0, totalPayoutsReceivedUsd: 0, fdicPassThroughEligible: false, status: 'ACTIVE' } } as unknown as User;
  users.push(member);
  const c = await custody.provisionMemberAccount(member, { firstName: 'Smoke', lastName: 'Tester', dateOfBirth: '1990-05-05', ssn: '123456789', address: { line1: '100 Market St', city: 'San Francisco', state: 'CA', postalCode: '94105' } });
  console.log(`   entity ${c.entityId} (${c.status}); account ${c.bankAccountId} ••••${c.accountNumberLast4} routing ${c.routingNumber}`);

  console.log('3. Fund the member account with a simulated incoming ACH credit of $100');
  await column.simulateReceiveAchCredit({ destinationAccountNumberId: c.accountNumberId, amountCents: 10_000 });
  // Incoming ACH follows the Fed schedule even in the sandbox (status SCHEDULED
  // with an effective date); find it and settle it now instead of waiting.
  let incoming: column.ColumnAchTransfer | undefined;
  for (let i = 0; i < 120 && !incoming; i++) { // the sandbox can take several minutes to materialise it
    await sleep(3000);
    incoming = (await column.listAchTransfers({ bankAccountId: c.bankAccountId, limit: 10 })).find(t => t.is_incoming && t.type === 'CREDIT' && t.amount === 10_000);
  }
  if (!incoming) throw new Error('simulated credit never appeared in the ACH list');
  console.log(`   incoming ${incoming.id} ${incoming.status}; settling in sandbox`);
  await column.simulateSettleAch(incoming.id);
  let bal = 0;
  for (let i = 0; i < 20 && bal < 10_000; i++) { await sleep(2000); bal = await balance(c.bankAccountId); }
  console.log(`   member available: ${usd(bal)}`);
  if (bal < 10_000) throw new Error('simulated credit did not arrive in time');

  console.log('4. Deposit $20 + $1 fee into a pod account, then pay $18 back out');
  const pod = { id: `smokepod_${nonce}`, name: `Smoke Pod ${nonce}`, members: [], status: 'ACTIVE', depositTier: 20, sizeTier: 20, currentCycleWeek: 1, totalCycles: 2, createdBy: member.id, creatorName: member.displayName, weeklyPoolTarget: 40, currentWeeklyCollected: 0 } as unknown as Pod;
  pods.push(pod);
  custody.recordMovement({ from: { kind: 'member', userId: member.id }, to: { kind: 'pod', podId: pod.id }, amountUsd: 20, purpose: 'DEPOSIT', description: 'smoke week 1', refs: { podId: pod.id, userId: member.id, cycleWeek: 1 } });
  custody.recordMovement({ from: { kind: 'member', userId: member.id }, to: { kind: 'platform', account: 'revenue' }, amountUsd: 1, purpose: 'DEPOSIT_FEE', description: 'smoke fee', refs: { podId: pod.id, userId: member.id } });
  console.log('   settle:', JSON.stringify(await custody.settlePendingMovements()));
  custody.recordMovement({ from: { kind: 'pod', podId: pod.id }, to: { kind: 'member', userId: member.id }, amountUsd: 18, purpose: 'PAYOUT', description: 'smoke payout', refs: { podId: pod.id, userId: member.id, cycleWeek: 1 } });
  custody.recordMovement({ from: { kind: 'pod', podId: pod.id }, to: { kind: 'platform', account: 'revenue' }, amountUsd: 2, purpose: 'PAYOUT_FEE', description: 'smoke payout fee', refs: { podId: pod.id } });
  console.log('   settle:', JSON.stringify(await custody.settlePendingMovements()));
  console.log(`   member ${usd(await balance(c.bankAccountId))}; pod ${usd(await balance(pod.custody!.bankAccountId))}; revenue ${usd(await balance(s.revenueAccountId))}`);
  for (const m of movements.slice().reverse()) console.log(`   ${m.purpose.padEnd(12)} $${m.amountUsd.toFixed(2).padStart(7)} ${m.status.padEnd(8)} ${m.columnTransferId || ''}`);

  console.log('5. Link an external bank and withdraw $25 by ACH credit, then settle it in the sandbox');
  await custody.linkExternalBank(member, { accountNumber: '000111222333', routingNumber: '021000021', name: 'Smoke Tester' });
  member.treasury.balanceUsd = 97;
  const wd = await custody.withdrawToBank(member, 25, `smokewd_${nonce}`);
  console.log(`   ach ${wd.columnTransferId} created; settling...`);
  await column.simulateSettleAch(wd.columnTransferId!); // returns an empty body
  const settled = await column.getAchTransfer(wd.columnTransferId!);
  console.log(`   ach status now ${settled.status}; member available ${usd(await balance(c.bankAccountId))}`);
  // What the ach.outgoing_transfer.settled webhook would deliver:
  await custody.handleColumnEvent({ id: `evt_smoke_${nonce}`, type: 'ach.outgoing_transfer.settled', created_at: new Date().toISOString(), data: settled });
  console.log(`   movement ${wd.status}`);

  console.log('6. Webhook endpoints registered at Column (set COLUMN_WEBHOOK_SECRET from the dashboard secret):');
  const hooks = await column.listWebhookEndpoints();
  if (hooks.length === 0) console.log('   none yet. Create one in the Column dashboard pointing at https://<your-domain>/api/webhooks/column with events ach.*, book.*, identity.*');
  for (const h of hooks) console.log(`   ${h.id} ${h.url} [${h.enabled_events.join(', ')}] ${h.is_disabled ? 'DISABLED' : 'enabled'}`);
  console.log('\nSmoke run complete.');
}

main().catch(err => { console.error('Smoke run failed:', err?.body ? JSON.stringify(err.body) : err); process.exit(1); });
