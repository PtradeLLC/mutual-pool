// Polling that respects the server's capacity.
//
// Every open app polls the server, so polling is most of the server's load
// (see the load test notes in fly.toml). This helper:
//   - runs `tick` now, then again after `intervalMs()` (read before each wait,
//     so callers can poll faster while, say, the chat socket is down)
//   - skips ticks while the page is hidden and runs one as soon as it is
//     visible again
//   - runs one immediately when the server signals a change over the chat
//     WebSocket (a `mutualpool:refresh` event with a matching scope), so slow
//     intervals don't delay what the member sees

export const REFRESH_EVENT = 'mutualpool:refresh';

export type RefreshScope = 'notifications';

export function dispatchRefresh(scope: RefreshScope): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT, { detail: { scope } }));
}

export function pollWhileVisible(
  tick: () => void,
  intervalMs: () => number,
  opts: { refreshOn?: RefreshScope } = {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

  const schedule = () => {
    if (!stopped) timer = setTimeout(run, intervalMs());
  };
  const run = () => {
    timer = null;
    if (stopped) return;
    if (!hidden()) tick();
    schedule();
  };
  const runNow = () => {
    if (stopped || hidden()) return;
    if (timer) clearTimeout(timer);
    run();
  };
  const onRefresh = (e: Event) => {
    if ((e as CustomEvent).detail?.scope === opts.refreshOn) runNow();
  };

  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', runNow);
  if (opts.refreshOn && typeof window !== 'undefined') window.addEventListener(REFRESH_EVENT, onRefresh);
  tick();
  schedule();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', runNow);
    if (opts.refreshOn && typeof window !== 'undefined') window.removeEventListener(REFRESH_EVENT, onRefresh);
  };
}
