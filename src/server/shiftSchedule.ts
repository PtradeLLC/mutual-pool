// Randomized gear spot-check schedule for a brand-campaign shift.
//
// When a courier starts a shift the server draws a secret schedule: the first
// check lands 20–60 minutes in, later ones every 60–150 minutes, for the
// expected length of the shift. If the shift runs longer, more checks are
// added at the same random spacing. Times are never sent to the client; the
// app only learns about a check when it becomes due, and the courier then has
// RESPONSE_WINDOW_SECONDS to send a live selfie for AI verification.

export interface ScheduledCheck {
  id: string;
  dueAt: number;           // epoch ms
  windowSeconds: number;   // time allowed to respond once due
}

export interface ScheduleOptions {
  startedAt: number;
  expectedDurationMs?: number;
  random?: () => number;   // injectable for tests
}

const MINUTE = 60_000;
export const FIRST_CHECK_MIN_MS = 20 * MINUTE;
export const FIRST_CHECK_MAX_MS = 60 * MINUTE;
export const GAP_MIN_MS = 60 * MINUTE;
export const GAP_MAX_MS = 150 * MINUTE;
export const RESPONSE_WINDOW_SECONDS = 300;
export const DEFAULT_EXPECTED_DURATION_MS = 6 * 60 * MINUTE;
export const MIN_CHECKS = 2;
export const MAX_CHECKS = 6;
// Hard ceiling per shift including checks added for long shifts.
export const MAX_CHECKS_PER_SHIFT = 12;
// Extra time, after the response window, before an unanswered check counts as missed
// (covers app polling latency).
export const MISSED_GRACE_MS = 2 * MINUTE;

function between(random: () => number, minMs: number, maxMs: number): number {
  return minMs + Math.floor(random() * (maxMs - minMs + 1));
}

function makeCheck(dueAt: number, random: () => number): ScheduledCheck {
  return { id: `spot_${dueAt}_${Math.floor(random() * 1e6).toString(36)}`, dueAt, windowSeconds: RESPONSE_WINDOW_SECONDS };
}

export function generateSpotCheckSchedule(opts: ScheduleOptions): ScheduledCheck[] {
  const random = opts.random ?? Math.random;
  const expected = opts.expectedDurationMs ?? DEFAULT_EXPECTED_DURATION_MS;
  const checks: ScheduledCheck[] = [];
  let t = opts.startedAt + between(random, FIRST_CHECK_MIN_MS, FIRST_CHECK_MAX_MS);
  while (checks.length < MAX_CHECKS && (checks.length < MIN_CHECKS || t <= opts.startedAt + expected)) {
    checks.push(makeCheck(t, random));
    t += between(random, GAP_MIN_MS, GAP_MAX_MS);
  }
  return checks;
}

// For shifts that outlast their schedule: one more check at a random gap from `after`.
export function nextCheckAfter(after: number, random: () => number = Math.random): ScheduledCheck {
  return makeCheck(after + between(random, GAP_MIN_MS, GAP_MAX_MS), random);
}
