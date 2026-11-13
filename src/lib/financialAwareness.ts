// Financial Awareness and Savings Range: the rules shared by the server and
// the app. Pure functions, no I/O. All money here is integer cents.
//
// A member's financial profile (goal, take-home pay, bills) gives an estimate
// of what is left after bills. The member then confirms a weekly savings
// commitment, and that commitment (not the goal) places them in a Savings
// Range, which is how MutualPool-hosted pods are matched.

export type PayFrequency = 'WEEKLY' | 'BIWEEKLY' | 'TWICE_MONTHLY' | 'MONTHLY';
export const PAY_FREQUENCIES: PayFrequency[] = ['WEEKLY', 'BIWEEKLY', 'TWICE_MONTHLY', 'MONTHLY'];

// A month is four weeks (weekly pay x 4), the product's original calculation.
export const WEEKS_PER_MONTH = 4;
export const PERIODS_PER_MONTH: Record<PayFrequency, number> = {
  WEEKLY: 4,
  BIWEEKLY: 2,
  TWICE_MONTHLY: 2,
  MONTHLY: 1,
};

export const MAX_AMOUNT_CENTS = 100_000_000; // $1,000,000
export const MAX_EXPENSES = 50;
export const MAX_EXPENSE_NAME = 80;
export const MAX_PURPOSE_TEXT = 120;

// Predefined savings purposes; CUSTOM carries the member's own text.
export const SAVINGS_PURPOSES = [
  'EMERGENCY_FUND', 'VEHICLE', 'HOUSING', 'PHONE_EQUIPMENT', 'DEBT', 'EDUCATION', 'FAMILY', 'TRAVEL', 'BUSINESS', 'CUSTOM',
] as const;
export type SavingsPurposeId = typeof SAVINGS_PURPOSES[number];

export interface ExpenseRecord {
  id: string;
  userId: string;
  name: string;
  amountCents: number;
  frequency: PayFrequency;
  monthlyEquivalentCents: number;
  createdAt: string;
  updatedAt: string;
}

export type ProfileCompletionStatus = 'INCOMPLETE' | 'COMPLETE';

// One per member, private to that member. id === userId.
export interface FinancialProfile {
  id: string;
  userId: string;
  targetSavingsCents: number;
  savingsPurpose: SavingsPurposeId;
  savingsPurposeText?: string;
  takeHomePayCents: number;
  incomeFrequency: PayFrequency;
  expenses: ExpenseRecord[];
  monthlyIncomeCents: number;
  totalMonthlyExpensesCents: number;
  // Income minus the bills entered. May be negative. Not disposable income.
  estimatedRemainingIncomeCents: number;
  confirmedWeeklyCommitmentCents: number;
  savingsRangeId: string | null;
  completionStatus: ProfileCompletionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsRangeCriteria {
  // Purposes this range's hosted pods are meant for; empty means any.
  purposes?: SavingsPurposeId[];
  // Hosted pods opened for this range.
  podDepositTier: number; // dollars a week: one of the existing deposit tiers
  podSize: number;
  // Open a hosted pod for this range when a matching member finds none forming.
  autoProvision: boolean;
}

export interface SavingsRange {
  id: string;
  name: string;
  minWeeklyCents: number;
  maxWeeklyCents: number | null; // null: no upper limit
  matchingCriteria: SavingsRangeCriteria;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const HOSTED_POD_DEPOSIT_TIERS = [5, 10, 20, 50, 100] as const;

// What the API returns to the member about their own profile.
export interface SavingsRangeView {
  id: string;
  name: string;
  minWeeklyCents: number;
  maxWeeklyCents: number | null;
  podDepositTier: number;
  podSize: number;
}
export interface SavingsProgress {
  totalContributedCents: number;
  completedContributions: number;
  missedContributions: number;
  weeklyObligationCents: number;
  activePodCount: number;
  completedCycles: number;
  payoutsReceivedCents: number;
  goalProgressPct: number | null;
}
export interface FinancialProfileView {
  profile: FinancialProfile | null;
  estimate: Estimate | null;
  savingsRange: SavingsRangeView | null;
  commitmentExceedsEstimate: boolean;
  weeksToGoal: number | null;
  missing: string[];
  progress: SavingsProgress;
}

// Starting ranges, one per existing deposit tier. Administrators edit these in
// Admin Ops; they are data, not rules.
export function defaultSavingsRanges(nowIso: string): SavingsRange[] {
  const mk = (id: string, name: string, min: number, max: number | null, tier: number): SavingsRange => ({
    id, name, minWeeklyCents: min, maxWeeklyCents: max,
    matchingCriteria: { purposes: [], podDepositTier: tier, podSize: 10, autoProvision: true },
    active: true, createdAt: nowIso, updatedAt: nowIso,
  });
  return [
    mk('range_starter', 'Starter', 500, 999, 5),
    mk('range_steady', 'Steady', 1000, 1999, 10),
    mk('range_builder', 'Builder', 2000, 4999, 20),
    mk('range_accelerator', 'Accelerator', 5000, 9999, 50),
    mk('range_summit', 'Summit', 10000, null, 100),
  ];
}

// --- Money ---

// Dollars typed by a person ("1,000", "12.5", 700) to cents. Null if it is not
// a plain non-negative amount with at most two decimals.
export function dollarsToCents(input: unknown): number | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null;
    input = String(input);
  }
  if (typeof input !== 'string') return null;
  const cleaned = input.replace(/[$,\s]/g, '');
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0') || 0);
}

export function isCents(value: unknown, max = MAX_AMOUNT_CENTS): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
}

export function formatCents(cents: number): string {
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  const rest = abs % 100;
  return `${cents < 0 ? '-' : ''}$${dollars}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}

export function centsToInput(cents: number): string {
  if (!cents) return '';
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export function monthlyEquivalentCents(amountCents: number, frequency: PayFrequency): number {
  return amountCents * (PERIODS_PER_MONTH[frequency] || 0);
}

// --- Estimate ---

export interface EstimateInput {
  takeHomePayCents: number;
  incomeFrequency: PayFrequency;
  expenses: Array<{ amountCents: number; frequency: PayFrequency }>;
}

export interface Estimate {
  monthlyIncomeCents: number;
  totalMonthlyExpensesCents: number;
  // Income minus bills; negative when bills are higher than income.
  estimatedRemainingIncomeCents: number;
  // Never negative: a shortfall is not a savings opportunity.
  proposedMonthlySavingsCents: number;
  proposedWeeklySavingsCents: number;
  expensesExceedIncome: boolean;
  // No income or no bills entered yet, so the number above is not a full picture.
  incomplete: boolean;
  missingIncome: boolean;
  missingExpenses: boolean;
}

export function computeEstimate(input: EstimateInput): Estimate {
  const monthlyIncomeCents = monthlyEquivalentCents(input.takeHomePayCents || 0, input.incomeFrequency);
  const totalMonthlyExpensesCents = (input.expenses || []).reduce((sum, e) => sum + monthlyEquivalentCents(e.amountCents || 0, e.frequency), 0);
  const remaining = monthlyIncomeCents - totalMonthlyExpensesCents;
  const missingIncome = monthlyIncomeCents <= 0;
  const missingExpenses = (input.expenses || []).length === 0;
  const proposedMonthly = Math.max(0, remaining);
  return {
    monthlyIncomeCents,
    totalMonthlyExpensesCents,
    estimatedRemainingIncomeCents: remaining,
    proposedMonthlySavingsCents: proposedMonthly,
    proposedWeeklySavingsCents: Math.floor(proposedMonthly / WEEKS_PER_MONTH),
    expensesExceedIncome: !missingIncome && remaining < 0,
    incomplete: missingIncome || missingExpenses,
    missingIncome,
    missingExpenses,
  };
}

// Weeks to reach the goal at the confirmed weekly amount, or null.
export function weeksToGoal(targetSavingsCents: number, weeklyCommitmentCents: number): number | null {
  if (!(targetSavingsCents > 0) || !(weeklyCommitmentCents > 0)) return null;
  return Math.ceil(targetSavingsCents / weeklyCommitmentCents);
}

// --- Validation ---

export interface ProfileInput {
  targetSavingsCents: number;
  savingsPurpose: SavingsPurposeId;
  savingsPurposeText?: string;
  takeHomePayCents: number;
  incomeFrequency: PayFrequency;
  expenses: Array<{ id?: string; name: string; amountCents: number; frequency: PayFrequency }>;
  confirmedWeeklyCommitmentCents: number;
}

export type ProfileValidation =
  | { ok: true; value: ProfileInput }
  | { ok: false; errors: Array<{ field: string; message: string }> };

function isFrequency(v: unknown): v is PayFrequency {
  return typeof v === 'string' && (PAY_FREQUENCIES as string[]).includes(v);
}

// Checks an untrusted profile. Amounts may be zero while the member is still
// filling it in; completeness is decided separately (profileIsComplete).
export function validateProfileInput(raw: any): ProfileValidation {
  const errors: Array<{ field: string; message: string }> = [];
  const body = raw && typeof raw === 'object' ? raw : {};
  const money = (field: string, label: string): number => {
    const v = body[field] ?? 0;
    if (!isCents(v)) {
      errors.push({ field, message: `${label} must be an amount between $0 and $1,000,000.` });
      return 0;
    }
    return v;
  };
  const targetSavingsCents = money('targetSavingsCents', 'Target savings amount');
  const takeHomePayCents = money('takeHomePayCents', 'Take-home pay');
  const confirmedWeeklyCommitmentCents = money('confirmedWeeklyCommitmentCents', 'Weekly savings commitment');

  const savingsPurpose: SavingsPurposeId = (SAVINGS_PURPOSES as readonly string[]).includes(body.savingsPurpose) ? body.savingsPurpose : 'CUSTOM';
  if (body.savingsPurpose !== undefined && body.savingsPurpose !== savingsPurpose) {
    errors.push({ field: 'savingsPurpose', message: 'Choose a savings purpose from the list or enter your own.' });
  }
  let savingsPurposeText: string | undefined;
  if (body.savingsPurposeText !== undefined && body.savingsPurposeText !== null) {
    if (typeof body.savingsPurposeText !== 'string' || body.savingsPurposeText.length > MAX_PURPOSE_TEXT) {
      errors.push({ field: 'savingsPurposeText', message: `Savings purpose must be at most ${MAX_PURPOSE_TEXT} characters.` });
    } else {
      savingsPurposeText = body.savingsPurposeText.trim() || undefined;
    }
  }
  if (savingsPurpose !== 'CUSTOM') savingsPurposeText = undefined;

  const incomeFrequency: PayFrequency = isFrequency(body.incomeFrequency) ? body.incomeFrequency : 'WEEKLY';
  if (body.incomeFrequency !== undefined && !isFrequency(body.incomeFrequency)) {
    errors.push({ field: 'incomeFrequency', message: 'Income frequency must be weekly, biweekly, twice monthly or monthly.' });
  }

  const rawExpenses = body.expenses === undefined ? [] : body.expenses;
  const expenses: ProfileInput['expenses'] = [];
  if (!Array.isArray(rawExpenses) || rawExpenses.length > MAX_EXPENSES) {
    errors.push({ field: 'expenses', message: `Add at most ${MAX_EXPENSES} bills and expenses.` });
  } else {
    rawExpenses.forEach((e: any, i: number) => {
      const name = typeof e?.name === 'string' ? e.name.trim() : '';
      if (!name || name.length > MAX_EXPENSE_NAME) {
        errors.push({ field: `expenses.${i}.name`, message: `Each expense needs a name of at most ${MAX_EXPENSE_NAME} characters.` });
      }
      if (!isCents(e?.amountCents) || e.amountCents <= 0) {
        errors.push({ field: `expenses.${i}.amountCents`, message: `Enter an amount above $0 for "${name || 'this expense'}".` });
      }
      if (!isFrequency(e?.frequency)) {
        errors.push({ field: `expenses.${i}.frequency`, message: `Choose how often "${name || 'this expense'}" is paid.` });
      }
      expenses.push({
        id: typeof e?.id === 'string' && e.id.length <= 80 ? e.id : undefined,
        name,
        amountCents: isCents(e?.amountCents) ? e.amountCents : 0,
        frequency: isFrequency(e?.frequency) ? e.frequency : 'MONTHLY',
      });
    });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { targetSavingsCents, savingsPurpose, savingsPurposeText, takeHomePayCents, incomeFrequency, expenses, confirmedWeeklyCommitmentCents } };
}

// What is still needed before the profile counts as complete.
export function missingForCompletion(p: Pick<ProfileInput, 'targetSavingsCents' | 'savingsPurpose' | 'savingsPurposeText' | 'takeHomePayCents' | 'confirmedWeeklyCommitmentCents'>): string[] {
  const missing: string[] = [];
  if (!(p.targetSavingsCents > 0)) missing.push('targetSavingsCents');
  if (p.savingsPurpose === 'CUSTOM' && !p.savingsPurposeText) missing.push('savingsPurpose');
  if (!(p.takeHomePayCents > 0)) missing.push('takeHomePayCents');
  if (!(p.confirmedWeeklyCommitmentCents > 0)) missing.push('confirmedWeeklyCommitmentCents');
  return missing;
}

export function profileIsComplete(p: Parameters<typeof missingForCompletion>[0]): boolean {
  return missingForCompletion(p).length === 0;
}

// --- Savings Range ---

export function rangeContains(range: Pick<SavingsRange, 'minWeeklyCents' | 'maxWeeklyCents'>, weeklyCents: number): boolean {
  return weeklyCents >= range.minWeeklyCents && (range.maxWeeklyCents === null || weeklyCents <= range.maxWeeklyCents);
}

// The active range holding this weekly commitment, or null (no commitment, or
// it falls outside every active range).
export function findSavingsRange<T extends SavingsRange>(ranges: T[], weeklyCommitmentCents: number): T | null {
  if (!(weeklyCommitmentCents > 0)) return null;
  const hits = ranges.filter(r => r && r.active && rangeContains(r, weeklyCommitmentCents));
  if (!hits.length) return null;
  return hits.sort((a, b) => a.minWeeklyCents - b.minWeeklyCents)[0];
}

export interface RangeInput {
  name: string;
  minWeeklyCents: number;
  maxWeeklyCents: number | null;
  matchingCriteria: SavingsRangeCriteria;
  active: boolean;
}

// Why a range is not valid next to the others, or null. `others` excludes the
// range being edited.
export function savingsRangeProblem(input: any, others: SavingsRange[], limits: { minPodSize: number; maxPodSize: number }): string | null {
  if (!input || typeof input !== 'object') return 'Range details are required.';
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 60) return 'Range name is required (at most 60 characters).';
  if (!isCents(input.minWeeklyCents) || input.minWeeklyCents <= 0) return 'Minimum weekly contribution must be above $0.';
  if (input.maxWeeklyCents !== null && (!isCents(input.maxWeeklyCents) || input.maxWeeklyCents < input.minWeeklyCents)) {
    return 'Maximum weekly contribution must be empty (no limit) or at least the minimum.';
  }
  if (typeof input.active !== 'boolean') return 'active must be true or false.';
  const c = input.matchingCriteria;
  if (!c || typeof c !== 'object') return 'Matching criteria are required.';
  if (!(HOSTED_POD_DEPOSIT_TIERS as readonly number[]).includes(c.podDepositTier)) return `Hosted pod deposit must be one of $${HOSTED_POD_DEPOSIT_TIERS.join(', $')}.`;
  // Nobody in the range is asked for more than they committed to.
  if (c.podDepositTier * 100 > input.minWeeklyCents) return 'The hosted pod deposit cannot be more than the range minimum.';
  if (!Number.isInteger(c.podSize) || c.podSize < limits.minPodSize || c.podSize > limits.maxPodSize) return `Hosted pod size must be ${limits.minPodSize} to ${limits.maxPodSize} members.`;
  if (typeof c.autoProvision !== 'boolean') return 'autoProvision must be true or false.';
  if (c.purposes !== undefined && (!Array.isArray(c.purposes) || c.purposes.some((p: unknown) => !(SAVINGS_PURPOSES as readonly unknown[]).includes(p)))) {
    return 'Purposes must come from the savings purpose list.';
  }
  if (input.active) {
    const hi = input.maxWeeklyCents === null ? Infinity : input.maxWeeklyCents;
    const clash = others.find(o => o.active && input.minWeeklyCents <= (o.maxWeeklyCents === null ? Infinity : o.maxWeeklyCents) && o.minWeeklyCents <= hi);
    if (clash) return `This range overlaps "${clash.name}". Active ranges cannot overlap.`;
  }
  return null;
}

// --- Matching ---

export interface MatchablePod {
  id: string;
  savingsRangeId?: string;
  savingsPurpose?: SavingsPurposeId;
  memberCount: number;
  sizeTier: number;
  createdAt: string;
}

// Hosted pods for a range, best first: same savings purpose, then the fullest
// (so pods start sooner and new ones are not opened needlessly), then the oldest.
export function rankHostedPods<T extends MatchablePod>(podsInRange: T[], purpose: SavingsPurposeId): T[] {
  const purposeScore = (p: T) => (p.savingsPurpose && p.savingsPurpose === purpose ? 0 : p.savingsPurpose ? 2 : 1);
  return [...podsInRange].sort((a, b) =>
    purposeScore(a) - purposeScore(b)
    || (b.memberCount / b.sizeTier) - (a.memberCount / a.sizeTier)
    || a.createdAt.localeCompare(b.createdAt));
}
