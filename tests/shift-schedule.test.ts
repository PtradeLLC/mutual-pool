import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSpotCheckSchedule, nextCheckAfter,
  FIRST_CHECK_MIN_MS, FIRST_CHECK_MAX_MS, GAP_MIN_MS, GAP_MAX_MS, MIN_CHECKS, MAX_CHECKS, RESPONSE_WINDOW_SECONDS,
} from '../src/server/shiftSchedule';

// Deterministic PRNG so the tests are repeatable.
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const START = Date.UTC(2026, 9, 13, 14, 0, 0);
const HOUR = 3_600_000;

test('every schedule respects the first-check and spacing windows', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const checks = generateSpotCheckSchedule({ startedAt: START, random: seeded(seed) });
    assert.ok(checks.length >= MIN_CHECKS && checks.length <= MAX_CHECKS, `seed ${seed}: ${checks.length} checks`);
    const first = checks[0].dueAt - START;
    assert.ok(first >= FIRST_CHECK_MIN_MS && first <= FIRST_CHECK_MAX_MS, `seed ${seed}: first check at ${first / 60000} min`);
    for (let i = 1; i < checks.length; i++) {
      const gap = checks[i].dueAt - checks[i - 1].dueAt;
      assert.ok(gap >= GAP_MIN_MS && gap <= GAP_MAX_MS, `seed ${seed}: gap ${gap / 60000} min`);
    }
    assert.ok(checks.every(c => c.windowSeconds === RESPONSE_WINDOW_SECONDS));
    assert.equal(new Set(checks.map(c => c.id)).size, checks.length, 'ids are unique');
  }
});

test('times vary from shift to shift', () => {
  const a = generateSpotCheckSchedule({ startedAt: START, random: seeded(7) }).map(c => c.dueAt);
  const b = generateSpotCheckSchedule({ startedAt: START, random: seeded(8) }).map(c => c.dueAt);
  assert.notDeepEqual(a, b);
});

test('a 6-hour shift gets several checks spread across the day; short shifts still get the minimum', () => {
  const sixHour = generateSpotCheckSchedule({ startedAt: START, expectedDurationMs: 6 * HOUR, random: seeded(3) });
  assert.ok(sixHour.length >= 3, `expected 3+ checks in 6h, got ${sixHour.length}`);
  assert.ok(sixHour[sixHour.length - 1].dueAt <= START + 6 * HOUR + GAP_MAX_MS);

  const short = generateSpotCheckSchedule({ startedAt: START, expectedDurationMs: 30 * 60_000, random: seeded(3) });
  assert.equal(short.length, MIN_CHECKS);
});

test('long shifts can be extended one random check at a time', () => {
  const last = START + 7 * HOUR;
  const next = nextCheckAfter(last, seeded(11));
  assert.ok(next.dueAt - last >= GAP_MIN_MS && next.dueAt - last <= GAP_MAX_MS);
});
