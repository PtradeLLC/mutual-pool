// The client poller: slow intervals, paused while hidden, refreshed on demand.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser globals for the helper.
const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as 'visible' | 'hidden' });
(globalThis as any).document = doc;
(globalThis as any).window = new EventTarget();
const { pollWhileVisible, dispatchRefresh } = await import('../src/utils/visiblePoll');

const setVisibility = (v: 'visible' | 'hidden') => {
  doc.visibilityState = v;
  doc.dispatchEvent(new Event('visibilitychange'));
};

test('runs now, then on the interval', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let n = 0;
    const stop = pollWhileVisible(() => n++, () => 30_000);
    assert.equal(n, 1, 'first tick is immediate');
    mock.timers.tick(29_999);
    assert.equal(n, 1);
    mock.timers.tick(1);
    assert.equal(n, 2);
    mock.timers.tick(30_000);
    assert.equal(n, 3);
    stop();
    mock.timers.tick(120_000);
    assert.equal(n, 3, 'nothing after stop');
  } finally {
    mock.timers.reset();
  }
});

test('skips ticks while hidden and catches up when visible again', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let n = 0;
    const stop = pollWhileVisible(() => n++, () => 10_000);
    setVisibility('hidden');
    mock.timers.tick(60_000);
    assert.equal(n, 1, 'no requests from a hidden tab');
    setVisibility('visible');
    assert.equal(n, 2, 'refreshes as soon as the tab is visible');
    mock.timers.tick(10_000);
    assert.equal(n, 3);
    stop();
  } finally {
    setVisibility('visible');
    mock.timers.reset();
  }
});

test('the interval is re-read before each wait', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let n = 0;
    let socketLive = false;
    const stop = pollWhileVisible(() => n++, () => (socketLive ? 60_000 : 4_000));
    mock.timers.tick(4_000);
    assert.equal(n, 2, 'fast while the socket is down');
    socketLive = true;
    mock.timers.tick(4_000);
    assert.equal(n, 3, 'this wait was already scheduled at the fast rate');
    mock.timers.tick(59_999);
    assert.equal(n, 3, 'then slow while the socket is live');
    mock.timers.tick(1);
    assert.equal(n, 4);
    stop();
  } finally {
    mock.timers.reset();
  }
});

test('a server refresh for the matching scope runs a tick at once', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let notifications = 0;
    let pods = 0;
    const stopA = pollWhileVisible(() => notifications++, () => 30_000, { refreshOn: 'notifications' });
    const stopB = pollWhileVisible(() => pods++, () => 30_000);
    dispatchRefresh('notifications');
    assert.equal(notifications, 2);
    assert.equal(pods, 1, 'pollers without the scope ignore it');
    // The refresh restarts the wait, so there is no double request right after.
    mock.timers.tick(29_999);
    assert.equal(notifications, 2);
    mock.timers.tick(1);
    assert.equal(notifications, 3);
    stopA();
    stopB();
    dispatchRefresh('notifications');
    assert.equal(notifications, 3, 'stopped pollers stop listening');
  } finally {
    mock.timers.reset();
  }
});
