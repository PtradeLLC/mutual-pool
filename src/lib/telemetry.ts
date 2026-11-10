// App health and usage insight, browser side (server: src/server/telemetry.ts).
// Sends errors users hit (with the screen and their last few taps), screens
// viewed and journey steps to our own server in small batches. Nothing goes
// to third parties. Typed values (form fields) are never read; emails and
// long numbers are masked before anything leaves the device.
//
// Members can turn this off (Edit profile); visitors' choice is kept on the
// device.

const OPT_OUT_KEY = 'mp_usage_data_off';
const VISITOR_KEY = 'mp_vid';
const SESSION_KEY = 'mp_sid';
const FLUSH_MS = 15_000;
const MAX_ERRORS_PER_SESSION = 60;
const REPEAT_WINDOW_MS = 60_000;

type Item =
  | { t: 'screen'; screen: string }
  | { t: 'step'; step: string }
  | { t: 'error'; kind: 'crash' | 'error' | 'api' | 'ui'; message: string; stack?: string; method?: string; path?: string; status?: number; code?: string; screen: string; breadcrumbs: string[] };

let screen = 'start';
let breadcrumbs: string[] = [];
let queue: Item[] = [];
let errorsSent = 0;
let installed = false;
let lastError: { message: string; screen: string; at: number } | null = null;
const recentErrors = new Map<string, number>();
const stepsSent = new Set<string>();

const safeStorage = (kind: 'local' | 'session') => {
  try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch { return null; }
};
const randomId = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);

function storedId(kind: 'local' | 'session', key: string): string {
  const store = safeStorage(kind);
  let id = store?.getItem(key) || '';
  if (!/^[a-z0-9]{8,40}$/i.test(id)) {
    id = randomId();
    try { store?.setItem(key, id); } catch { /* private mode */ }
  }
  return id;
}

export function mask(text: unknown, max = 200): string {
  return String(text ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\d[\d\s-]{3,}\d/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function isUsageDataOff(): boolean {
  return safeStorage('local')?.getItem(OPT_OUT_KEY) === '1';
}

export function setUsageDataOff(off: boolean): void {
  try { safeStorage('local')?.setItem(OPT_OUT_KEY, off ? '1' : '0'); } catch { /* ignore */ }
  if (off) queue = [];
}

function appVersion(): string {
  try { return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'; } catch { return 'dev'; }
}

function language(): string {
  try { return safeStorage('local')?.getItem('mutualpool_user_lang') || navigator.language?.slice(0, 2) || 'en'; } catch { return 'en'; }
}

export function crumb(text: string): void {
  breadcrumbs = [...breadcrumbs, mask(text, 80)].slice(-10);
}

export function setScreen(name: string): void {
  const clean = mask(name, 60);
  if (!clean || clean === screen) return;
  screen = clean;
  crumb(`screen ${clean}`);
  enqueue({ t: 'screen', screen: clean });
}

export function currentScreen(): string {
  return screen;
}

// A journey step only the app can see (first time per session is enough;
// the server keeps the first time per person).
export function step(name: string): void {
  if (stepsSent.has(name)) return;
  stepsSent.add(name);
  enqueue({ t: 'step', step: name });
}

function enqueue(item: Item): void {
  if (isUsageDataOff()) return;
  queue.push(item);
  if (queue.length >= 30) void flush();
}

export function reportError(kind: 'crash' | 'error' | 'api' | 'ui', message: string, extra: { stack?: string; method?: string; path?: string; status?: number; code?: string } = {}): void {
  const msg = mask(message, 300);
  if (!msg) return;
  const key = `${kind}|${msg}|${extra.path || ''}|${extra.status || ''}`;
  const now = Date.now();
  if ((recentErrors.get(key) || 0) > now - REPEAT_WINDOW_MS) return;
  recentErrors.set(key, now);
  lastError = { message: msg, screen, at: now };
  if (errorsSent >= MAX_ERRORS_PER_SESSION) return;
  errorsSent += 1;
  enqueue({ t: 'error', kind, message: msg, screen, breadcrumbs: [...breadcrumbs], ...extra, stack: extra.stack?.slice(0, 6000) });
  if (kind === 'crash') void flush();
}

// The last error shown or hit, for "Report a problem".
export function lastErrorSummary(): string | undefined {
  if (!lastError || Date.now() - lastError.at > 30 * 60_000) return undefined;
  return `${lastError.message} (on ${lastError.screen})`;
}

export function recentBreadcrumbs(): string[] {
  return [...breadcrumbs];
}

export function appContext() {
  return { screen, appVersion: appVersion(), breadcrumbs: [...breadcrumbs] };
}

export async function flush(): Promise<void> {
  if (!queue.length || isUsageDataOff()) return;
  const items = queue.splice(0, 40);
  try {
    await fetch('/api/telemetry', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: storedId('local', VISITOR_KEY),
        sessionId: storedId('session', SESSION_KEY),
        appVersion: appVersion(),
        language: language(),
        items,
      }),
    });
  } catch {
    // Offline: drop rather than pile up.
  }
}

// Failed server requests the member saw. Called by the fetch interceptor.
const IGNORED_API = /^\/api\/(telemetry|feedback|health)/;
export function noteApiResponse(method: string, url: string, res: Response): void {
  if (res.ok || isUsageDataOff()) return;
  let path = url;
  try { path = new URL(url, window.location.origin).pathname; } catch { /* keep */ }
  if (!path.startsWith('/api/') || IGNORED_API.test(path)) return;
  if (res.status === 401 || res.status === 429) return; // signed out, or waiting in line: expected
  const status = res.status;
  res.clone().json()
    .then((body: any) => reportError('api', body?.message || body?.error || `HTTP ${status}`, { method, path, status, code: typeof body?.error === 'string' ? body.error : undefined }))
    .catch(() => reportError('api', `HTTP ${status}`, { method, path, status }));
}

export function noteNetworkFailure(method: string, url: string): void {
  let path = url;
  try { path = new URL(url, window.location.origin).pathname; } catch { /* keep */ }
  if (!path.startsWith('/api/') || IGNORED_API.test(path)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  reportError('api', 'Network request failed', { method, path, status: 0, code: 'NETWORK' });
}

function labelOf(el: Element): string {
  const aria = el.getAttribute('aria-label') || el.getAttribute('title');
  const text = aria || (el as HTMLElement).innerText || el.textContent || '';
  return mask(text, 50);
}

export function installTelemetry(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) => {
    if (event.defaultPrevented) return;
    const err = event.error;
    const message = err?.message || event.message || 'Script error';
    if (/ResizeObserver loop/.test(message)) return;
    reportError('error', message, { stack: err?.stack });
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (event.defaultPrevented) return;
    const r = event.reason;
    reportError('error', r?.message || (typeof r === 'string' ? r : 'Unhandled promise rejection'), { stack: r?.stack });
  });
  // Taps: the button or link label only (never typed values).
  document.addEventListener('click', (event) => {
    const el = (event.target as Element | null)?.closest?.('button, a, [role="button"]');
    if (el) crumb(`tap ${labelOf(el)}`);
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
  window.setInterval(() => { void flush(); }, FLUSH_MS);
}

// "Was this easy?" after key moments (FeedbackPrompt listens for this).
export const ASK_FEEDBACK_EVENT = 'mutualpool:ask-feedback';
export const REPORT_PROBLEM_EVENT = 'mutualpool:report-problem';
export function askFeedback(stepName: string): void {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => window.dispatchEvent(new CustomEvent(ASK_FEEDBACK_EVENT, { detail: { step: stepName } })), 1500);
}
export function openReportProblem(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REPORT_PROBLEM_EVENT));
}
