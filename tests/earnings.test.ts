// Which incoming credits count as earnings (and so keep premium perks unlocked).
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIncomingCredit } from '../src/server/earnings';

test('gig-platform payouts are recognised by the originator name', () => {
  const cases: Array<[string, string]> = [
    ['UBER USA 6787', 'Uber'],
    ['UBER EATS', 'Uber Eats'],
    ['LYFT INC', 'Lyft'],
    ['DOORDASH, INC.', 'DoorDash'],
    ['MAPLEBEAR INC', 'Instacart'],
    ['INSTACART', 'Instacart'],
    ['AMAZON FLEX', 'Amazon Flex'],
    ['GRUBHUB HOLDING', 'Grubhub'],
    ['SHIPT INC', 'Shipt'],
  ];
  for (const [companyName, platform] of cases) {
    const c = classifyIncomingCredit({ companyName, companyEntryDescription: 'PAYMENT' });
    assert.equal(c.kind, 'GIG_PLATFORM', companyName);
    assert.equal(c.isEarnings, true, companyName);
    assert.equal(c.platform, platform, companyName);
  }
});

test('a platform name wins even when the description reads like a transfer', () => {
  const c = classifyIncomingCredit({ companyName: 'UBER USA', companyEntryDescription: 'TRANSFER' });
  assert.equal(c.platform, 'Uber');
  assert.equal(c.isEarnings, true);
});

test('the description is used when the bank sends no company name', () => {
  assert.equal(classifyIncomingCredit({ description: 'DOORDASH PAYOUT' }).platform, 'DoorDash');
});

test('payroll deposits count as earnings', () => {
  assert.equal(classifyIncomingCredit({ companyName: 'ACME PLUMBING', companyEntryDescription: 'PAYROLL' }).kind, 'PAYROLL');
  assert.equal(classifyIncomingCredit({ companyName: 'BOBS ELECTRIC', companyEntryDescription: 'DIR DEP' }).kind, 'PAYROLL');
  assert.equal(classifyIncomingCredit({ companyName: 'GUSTO', companyEntryDescription: 'NET PAY' }).kind, 'PAYROLL');
  assert.equal(classifyIncomingCredit({ companyName: 'ADP WAGE PAY', companyEntryDescription: 'WAGE PAY' }).isEarnings, true);
});

test("a member's own transfers are not earnings", () => {
  for (const input of [
    { companyName: 'CHASE', companyEntryDescription: 'TRANSFER' },
    { companyName: 'BANK OF AMERICA', companyEntryDescription: 'ONLINE XFER' },
    { companyName: 'VENMO', companyEntryDescription: 'CASHOUT' },
    { companyName: 'CASH APP', companyEntryDescription: 'CASH OUT' },
    { companyName: 'PAYPAL', companyEntryDescription: 'TRANSFER' },
    { companyName: 'ACME', companyEntryDescription: 'PAYROLL', description: 'Payroll reversal' },
  ]) {
    const c = classifyIncomingCredit(input);
    assert.equal(c.isEarnings, false, JSON.stringify(input));
    assert.equal(c.kind, 'TRANSFER', JSON.stringify(input));
  }
});

test('unrecognised credits add balance but are not earnings', () => {
  const c = classifyIncomingCredit({ companyName: 'SOME COMPANY', companyEntryDescription: 'MISC' });
  assert.equal(c.kind, 'OTHER');
  assert.equal(c.isEarnings, false);
  assert.equal(c.source, 'SOME COMPANY');
});
