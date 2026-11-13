// Financial Awareness, Savings Range and payout fee split: pure rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dollarsToCents, formatCents, monthlyEquivalentCents, computeEstimate, validateProfileInput, profileIsComplete,
  findSavingsRange, savingsRangeProblem, defaultSavingsRanges, rankHostedPods, weeksToGoal,
} from '../src/lib/financialAwareness';
import { payoutFeeSplit, platformFeeRateFor, hostTypeOf } from '../src/server/payoutFees';
import { FEES } from '../src/lib/legal';

const NOW = '2026-11-12T00:00:00.000Z';
const LIMITS = { minPodSize: 2, maxPodSize: 20 };

test('dollars are parsed to integer cents without float drift', () => {
  assert.equal(dollarsToCents('1,000'), 100000);
  assert.equal(dollarsToCents('$12.5'), 1250);
  assert.equal(dollarsToCents('0.29'), 29);
  assert.equal(dollarsToCents(700), 70000);
  assert.equal(dollarsToCents('19.99'), 1999);
  assert.equal(dollarsToCents('-5'), null);
  assert.equal(dollarsToCents('1.234'), null);
  assert.equal(dollarsToCents('abc'), null);
  assert.equal(formatCents(130000), '$1,300');
  assert.equal(formatCents(-2550), '-$25.50');
});

test('weekly, biweekly, twice-monthly and monthly amounts convert to a four-week month', () => {
  assert.equal(monthlyEquivalentCents(10000, 'WEEKLY'), 40000);
  assert.equal(monthlyEquivalentCents(10000, 'BIWEEKLY'), 20000);
  assert.equal(monthlyEquivalentCents(10000, 'TWICE_MONTHLY'), 20000);
  assert.equal(monthlyEquivalentCents(10000, 'MONTHLY'), 10000);
});

test('the spec example: $700 a week, $1,500 of monthly bills leaves $1,300', () => {
  const e = computeEstimate({ takeHomePayCents: 70000, incomeFrequency: 'WEEKLY', expenses: [{ amountCents: 150000, frequency: 'MONTHLY' }] });
  assert.equal(e.monthlyIncomeCents, 280000);
  assert.equal(e.totalMonthlyExpensesCents, 150000);
  assert.equal(e.estimatedRemainingIncomeCents, 130000);
  assert.equal(e.proposedMonthlySavingsCents, 130000);
  assert.equal(e.proposedWeeklySavingsCents, 32500);
  assert.equal(e.expensesExceedIncome, false);
  assert.equal(e.incomplete, false);
});

test('mixed-frequency bills add up to one monthly total', () => {
  const e = computeEstimate({
    takeHomePayCents: 70000,
    incomeFrequency: 'WEEKLY',
    expenses: [
      { amountCents: 100000, frequency: 'MONTHLY' },
      { amountCents: 10000, frequency: 'MONTHLY' },
      { amountCents: 6000, frequency: 'MONTHLY' },
      { amountCents: 8000, frequency: 'MONTHLY' },
      { amountCents: 10000, frequency: 'WEEKLY' },
      { amountCents: 5000, frequency: 'BIWEEKLY' },
    ],
  });
  assert.equal(e.totalMonthlyExpensesCents, 174000);
  assert.equal(e.estimatedRemainingIncomeCents, 106000);
});

test('bills above income: a warning, and never a positive savings amount', () => {
  const e = computeEstimate({ takeHomePayCents: 30000, incomeFrequency: 'WEEKLY', expenses: [{ amountCents: 150000, frequency: 'MONTHLY' }] });
  assert.equal(e.estimatedRemainingIncomeCents, -30000);
  assert.equal(e.expensesExceedIncome, true);
  assert.equal(e.proposedMonthlySavingsCents, 0);
  assert.equal(e.proposedWeeklySavingsCents, 0);
});

test('an estimate without income or without bills is flagged incomplete', () => {
  const noBills = computeEstimate({ takeHomePayCents: 70000, incomeFrequency: 'WEEKLY', expenses: [] });
  assert.equal(noBills.incomplete, true);
  assert.equal(noBills.missingExpenses, true);
  const noIncome = computeEstimate({ takeHomePayCents: 0, incomeFrequency: 'WEEKLY', expenses: [{ amountCents: 1000, frequency: 'MONTHLY' }] });
  assert.equal(noIncome.incomplete, true);
  assert.equal(noIncome.missingIncome, true);
  assert.equal(noIncome.expensesExceedIncome, false);
  assert.equal(noIncome.proposedMonthlySavingsCents, 0);
});

test('profile validation rejects non-integer, negative and oversized amounts', () => {
  const base = { targetSavingsCents: 200000, savingsPurpose: 'PHONE_EQUIPMENT', takeHomePayCents: 70000, incomeFrequency: 'WEEKLY', expenses: [], confirmedWeeklyCommitmentCents: 2000 };
  assert.equal(validateProfileInput(base).ok, true);
  assert.equal(validateProfileInput({ ...base, takeHomePayCents: 700.5 }).ok, false);
  assert.equal(validateProfileInput({ ...base, targetSavingsCents: -1 }).ok, false);
  assert.equal(validateProfileInput({ ...base, confirmedWeeklyCommitmentCents: 100_000_001 }).ok, false);
  assert.equal(validateProfileInput({ ...base, incomeFrequency: 'DAILY' }).ok, false);
  assert.equal(validateProfileInput({ ...base, savingsPurpose: 'LOTTERY' }).ok, false);
  assert.equal(validateProfileInput({ ...base, expenses: [{ name: '', amountCents: 100, frequency: 'MONTHLY' }] }).ok, false);
  assert.equal(validateProfileInput({ ...base, expenses: [{ name: 'Rent', amountCents: 0, frequency: 'MONTHLY' }] }).ok, false);
  assert.equal(validateProfileInput({ ...base, expenses: [{ name: 'Rent', amountCents: 100, frequency: 'YEARLY' }] }).ok, false);
  assert.equal(validateProfileInput({ ...base, expenses: new Array(51).fill({ name: 'x', amountCents: 100, frequency: 'MONTHLY' }) }).ok, false);
});

test('a profile is complete once goal, purpose, pay and commitment are set', () => {
  const p = { targetSavingsCents: 200000, savingsPurpose: 'CUSTOM' as const, savingsPurposeText: 'A new phone', takeHomePayCents: 70000, confirmedWeeklyCommitmentCents: 2000 };
  assert.equal(profileIsComplete(p), true);
  assert.equal(profileIsComplete({ ...p, savingsPurposeText: undefined }), false);
  assert.equal(profileIsComplete({ ...p, confirmedWeeklyCommitmentCents: 0 }), false);
  assert.equal(profileIsComplete({ ...p, targetSavingsCents: 0 }), false);
  assert.equal(weeksToGoal(200000, 2000), 100);
  assert.equal(weeksToGoal(200000, 0), null);
});

test('the savings range comes from the weekly commitment, not the goal', () => {
  const ranges = defaultSavingsRanges(NOW);
  assert.equal(findSavingsRange(ranges, 500)?.id, 'range_starter');
  assert.equal(findSavingsRange(ranges, 999)?.id, 'range_starter');
  assert.equal(findSavingsRange(ranges, 1000)?.id, 'range_steady');
  assert.equal(findSavingsRange(ranges, 2500)?.id, 'range_builder');
  assert.equal(findSavingsRange(ranges, 9999)?.id, 'range_accelerator');
  assert.equal(findSavingsRange(ranges, 50000)?.id, 'range_summit');
  assert.equal(findSavingsRange(ranges, 499), null, 'below the smallest pod contribution');
  assert.equal(findSavingsRange(ranges, 0), null);
  const off = ranges.map(r => (r.id === 'range_builder' ? { ...r, active: false } : r));
  assert.equal(findSavingsRange(off, 2500), null, 'inactive ranges never match');
});

test('range thresholds are validated: no overlap, deposit never above the range minimum', () => {
  const ranges = defaultSavingsRanges(NOW);
  const ok = { name: 'Mid', minWeeklyCents: 2000, maxWeeklyCents: 2999, active: true, matchingCriteria: { purposes: [], podDepositTier: 20, podSize: 10, autoProvision: false } };
  const others = ranges.filter(r => r.id !== 'range_builder');
  assert.equal(savingsRangeProblem(ok, others, LIMITS), null);
  assert.match(savingsRangeProblem(ok, ranges, LIMITS) || '', /overlaps/);
  assert.equal(savingsRangeProblem({ ...ok, active: false }, ranges, LIMITS), null, 'an inactive range may overlap');
  assert.match(savingsRangeProblem({ ...ok, matchingCriteria: { ...ok.matchingCriteria, podDepositTier: 50 } }, others, LIMITS) || '', /range minimum/);
  assert.match(savingsRangeProblem({ ...ok, matchingCriteria: { ...ok.matchingCriteria, podDepositTier: 25 } }, others, LIMITS) || '', /deposit must be one of/);
  assert.match(savingsRangeProblem({ ...ok, maxWeeklyCents: 1000 }, others, LIMITS) || '', /Maximum/);
  assert.match(savingsRangeProblem({ ...ok, matchingCriteria: { ...ok.matchingCriteria, podSize: 40 } }, others, LIMITS) || '', /size/);
  assert.match(savingsRangeProblem({ ...ok, minWeeklyCents: 20.5 }, others, LIMITS) || '', /Minimum/);
});

test('hosted pods are ranked: same purpose, then fullest, then oldest', () => {
  const mk = (id: string, memberCount: number, createdAt: string, savingsPurpose?: any) => ({ id, memberCount, sizeTier: 10, createdAt, savingsPurpose });
  const ranked = rankHostedPods([
    mk('empty_old', 0, '2026-01-01'),
    mk('half', 5, '2026-03-01'),
    mk('other_purpose', 9, '2026-01-01', 'TRAVEL'),
    mk('same_purpose', 1, '2026-04-01', 'VEHICLE'),
    mk('half_older', 5, '2026-02-01'),
  ], 'VEHICLE');
  assert.deepEqual(ranked.map(p => p.id), ['same_purpose', 'half_older', 'half', 'empty_old', 'other_purpose']);
});

// --- Payout fee split ---

test('member-created pod: 10% fee, 3% to the host and 7% to MutualPool', () => {
  const s = payoutFeeSplit({ grossUsd: 400, hostType: 'USER', hostRewardApplies: true });
  assert.equal(s.totalFeeUsd, 40);
  assert.equal(s.hostRewardUsd, 12);
  assert.equal(s.platformFeeUsd, 28);
  assert.equal(s.platformFeeRate, 0.07);
  assert.equal(s.netPayoutUsd, 360);
});

test('MutualPool-hosted pod: the same 10% fee, all of it to MutualPool', () => {
  const s = payoutFeeSplit({ grossUsd: 400, hostType: 'MUTUALPOOL', hostRewardApplies: true });
  assert.equal(s.totalFeeUsd, 40);
  assert.equal(s.hostRewardUsd, 0, 'no host reward, even if a caller says one applies');
  assert.equal(s.platformFeeUsd, 40);
  assert.equal(s.platformFeeRate, 0.10);
  assert.equal(s.netPayoutUsd, 360, 'members receive exactly what they would in any other pod');
});

test('the fee is charged once: net + host reward + platform fee always equals the pot', () => {
  for (const hostType of ['USER', 'MUTUALPOOL'] as const) {
    for (const hostRewardApplies of [true, false]) {
      for (const gross of [10, 40, 95, 100, 333, 400, 1000, 2000, 33.33, 0]) {
        const s = payoutFeeSplit({ grossUsd: gross, hostType, hostRewardApplies });
        const sum = Math.round((s.netPayoutUsd + s.hostRewardUsd + s.platformFeeUsd) * 100);
        assert.equal(sum, Math.round(gross * 100), `${hostType} ${gross}`);
        assert.equal(Math.round((s.hostRewardUsd + s.platformFeeUsd) * 100), Math.round(s.totalFeeUsd * 100));
        assert.ok(s.totalFeeUsd <= gross * FEES.payoutFeeRate + 0.005, 'never more than 10% of the pot');
      }
    }
  }
});

test('a member-created pod without a qualifying host keeps the existing behaviour (MutualPool retains the fee)', () => {
  const s = payoutFeeSplit({ grossUsd: 400, hostType: 'USER', hostRewardApplies: false });
  assert.equal(s.hostRewardUsd, 0);
  assert.equal(s.platformFeeUsd, 40);
});

test('host type defaults to USER for every existing pod', () => {
  assert.equal(hostTypeOf({}), 'USER');
  assert.equal(hostTypeOf(null), 'USER');
  assert.equal(hostTypeOf({ hostType: 'MUTUALPOOL' }), 'MUTUALPOOL');
  assert.equal(platformFeeRateFor('USER'), 0.07);
  assert.equal(platformFeeRateFor('MUTUALPOOL'), 0.10);
});
