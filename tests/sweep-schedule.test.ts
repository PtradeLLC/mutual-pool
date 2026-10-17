// Sweep scheduling with catch-up (src/server/sweepSchedule.ts): pure unit tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { currentWeekThursday, dueSweeps, runId, weekKeyFor, SweepRun } from '../src/server/sweepSchedule';

// 2026-10-15 is a Thursday.
const thu = (h = 0, m = 0) => new Date(2026, 9, 15, h, m);
const wed = (h = 12) => new Date(2026, 9, 14, h);
const fri = (h = 0, m = 0) => new Date(2026, 9, 16, h, m);
const sun = () => new Date(2026, 9, 18, 15);

function run(type: SweepRun['type'], weekKey: string, success = true): SweepRun {
  return { id: runId(type, weekKey), type, weekKey, startedAt: 'x', completedAt: 'y', success, trigger: 'SCHEDULER' };
}

test('the settlement week starts on Thursday 00:00 local time', () => {
  assert.equal(weekKeyFor(thu()), '2026-10-15');
  assert.equal(weekKeyFor(sun()), '2026-10-15');
  assert.equal(weekKeyFor(wed()), '2026-10-08', 'Wednesday still belongs to the previous week');
  assert.equal(currentWeekThursday(fri(23, 59)).getDay(), 4);
});

test('Thursday sweep is due from Thursday midnight until it has run', () => {
  assert.deepEqual(dueSweeps(thu(0, 0), []), [{ type: 'THURSDAY_DEPOSITS', weekKey: '2026-10-15' }]);
  assert.deepEqual(dueSweeps(thu(17, 30), []), [{ type: 'THURSDAY_DEPOSITS', weekKey: '2026-10-15' }], 'missed window: still due later that day');
  assert.deepEqual(dueSweeps(thu(17, 30), [run('THURSDAY_DEPOSITS', '2026-10-15')]), []);
});

test('Friday sweep is due from Friday midnight, after Thursday, and catches up over the weekend', () => {
  assert.deepEqual(dueSweeps(fri(0, 0), [run('THURSDAY_DEPOSITS', '2026-10-15')]), [{ type: 'FRIDAY_PAYOUTS', weekKey: '2026-10-15' }]);
  // Process was down Thursday and Friday: both run, Thursday first.
  assert.deepEqual(dueSweeps(sun(), []), [
    { type: 'THURSDAY_DEPOSITS', weekKey: '2026-10-15' },
    { type: 'FRIDAY_PAYOUTS', weekKey: '2026-10-15' },
  ]);
  assert.deepEqual(dueSweeps(sun(), [run('THURSDAY_DEPOSITS', '2026-10-15'), run('FRIDAY_PAYOUTS', '2026-10-15')]), []);
});

test('a failed run does not count and is retried', () => {
  assert.deepEqual(dueSweeps(thu(1), [run('THURSDAY_DEPOSITS', '2026-10-15', false)]), [{ type: 'THURSDAY_DEPOSITS', weekKey: '2026-10-15' }]);
});

test('last week\'s runs do not satisfy this week', () => {
  assert.deepEqual(dueSweeps(thu(1), [run('THURSDAY_DEPOSITS', '2026-10-08'), run('FRIDAY_PAYOUTS', '2026-10-08')]), [{ type: 'THURSDAY_DEPOSITS', weekKey: '2026-10-15' }]);
});
