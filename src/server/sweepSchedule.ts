// When the weekly settlement sweeps are due, with catch-up.
//
// The Thursday deposit sweep is due from Thursday 00:00 (server-local time)
// for the rest of that settlement week; the Friday payout sweep from Friday
// 00:00, and only once that week's Thursday sweep has run. A sweep that was
// missed because the process was down runs as soon as the process is back,
// instead of being skipped for the week. Each completed run is recorded by
// settlement week, so a restart never runs the same week twice.
//
// Pure: callers supply the clock and the recorded runs.

export type SweepType = 'THURSDAY_DEPOSITS' | 'FRIDAY_PAYOUTS';

export interface SweepRun {
  id: string;            // `${type}_${weekKey}`
  type: SweepType;
  weekKey: string;       // YYYY-MM-DD of that week's Thursday
  startedAt: string;
  completedAt?: string;
  success?: boolean;
  trigger: 'SCHEDULER' | 'MANUAL' | 'CRON';
  summary?: { transactions: number; volumeUsd: number; failed: number };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Midnight (local) of the most recent Thursday at or before `now`.
export function currentWeekThursday(now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceThursday = (start.getDay() - 4 + 7) % 7;
  return new Date(start.getTime() - daysSinceThursday * DAY_MS);
}

export function weekKeyFor(now: Date): string {
  return localDateKey(currentWeekThursday(now));
}

export function runId(type: SweepType, weekKey: string): string {
  return `${type}_${weekKey}`;
}

// Which sweeps should run right now, in order.
export function dueSweeps(now: Date, runs: SweepRun[]): Array<{ type: SweepType; weekKey: string }> {
  const thursday = currentWeekThursday(now);
  const weekKey = localDateKey(thursday);
  const done = (type: SweepType) => runs.some(r => r.type === type && r.weekKey === weekKey && r.completedAt && r.success !== false);
  const due: Array<{ type: SweepType; weekKey: string }> = [];
  if (!done('THURSDAY_DEPOSITS')) due.push({ type: 'THURSDAY_DEPOSITS', weekKey });
  const fridayMidnight = new Date(thursday.getTime() + DAY_MS);
  if (now.getTime() >= fridayMidnight.getTime() && !done('FRIDAY_PAYOUTS')) {
    // Friday only after Thursday (either already recorded, or about to run first in this call).
    due.push({ type: 'FRIDAY_PAYOUTS', weekKey });
  }
  return due;
}
