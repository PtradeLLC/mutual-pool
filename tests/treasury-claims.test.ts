import test from 'node:test';
import assert from 'node:assert/strict';
import { stripTreasuryClaims, memberHasInsuredTreasury, TREASURY_PROGRAM_ENABLED } from '../src/lib/treasuryClaims';

test('flag is off unless explicitly enabled', () => {
  assert.equal(TREASURY_PROGRAM_ENABLED, false);
  assert.equal(memberHasInsuredTreasury({ treasury: { fdicPassThroughEligible: true, stripeFinAccountId: 'fa_123' } }), false);
});

test('drops bullet lines that carry the claim and keeps the others', () => {
  const text = '🏦 Stripe Treasury & FDIC Pass-Through\n\n• Dedicated holding account for weekly pool deposits.\n• Pass-through FDIC insurance eligibility up to $250,000.\n• Instant payouts to your linked external checking account or debit card.';
  const out = stripTreasuryClaims(text);
  assert.ok(!/fdic|pass-through/i.test(out), out);
  assert.ok(out.includes('Dedicated holding account'));
  assert.ok(out.includes('Instant payouts'));
  assert.ok(out.startsWith('🏦 Stripe Treasury'), out.split('\n')[0]);
});

test('removes only the sentence containing the claim from prose', () => {
  const text = 'MutualPool is a modernized ROSCA for gig workers with 0% interest. Your funds are FDIC pass-through insured up to $250,000. Members take turns receiving the pot.';
  const out = stripTreasuryClaims(text);
  assert.equal(out, 'MutualPool is a modernized ROSCA for gig workers with 0% interest. Members take turns receiving the pot.');
});

test('trims the claim from headings in each language', () => {
  assert.equal(stripTreasuryClaims('🏦 Stripe Treasury y Seguro FDIC'), '🏦 Stripe Treasury');
  assert.equal(stripTreasuryClaims('🏦 Stripe Treasury & Garantie FDIC'), '🏦 Stripe Treasury');
  assert.equal(stripTreasuryClaims('FDIC Security & Stripe Treasury'), 'Stripe Treasury');
  assert.equal(stripTreasuryClaims('• Stripe Treasury & FDIC Pass-Through\n• Spot Swaps'), '• Spot Swaps');
});

test('leaves text without claims untouched', () => {
  const text = 'Treasury balance: $20.00\n• Add funds with Stripe Checkout';
  assert.equal(stripTreasuryClaims(text), text);
});
