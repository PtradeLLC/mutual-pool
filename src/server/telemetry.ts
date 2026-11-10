// App health and usage insight (in-house; nothing is sent to third parties).
//
//   - Errors users hit, grouped by fingerprint with the screens they happen on.
//   - Journey funnels: the first time each user reaches each step, so we can
//     see where people drop off and how long each step takes.
//   - Screen views per day, and feedback ("was this easy?", problem reports).
//
// Privacy: no identity, bank, tax or balance data is recorded. Free text is
// cleaned (emails and long numbers masked) and truncated. Users are referred
// to by internal id only. Pure helpers here; storage and routes in server.ts.

import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Cleaning
// ---------------------------------------------------------------------------

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LONG_NUMBER = /\d[\d\s-]{3,}\d/g; // card, account, SSN, phone-like runs
const TOKENISH = /\b[A-Za-z0-9_-]{32,}\b/g;

export function cleanText(value: unknown, max = 300): string {
  return String(value ?? '')
    .replace(EMAIL, '[email]')
    .replace(LONG_NUMBER, '#')
    .replace(TOKENISH, '[id]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// "/api/pods/pod_cp_ab12_3_f00/join" -> "/api/pods/:id/join"
export function pathTemplate(path: string): string {
  return String(path || '')
    .split('?')[0]
    .split('/')
    .map(seg => (/\d/.test(seg) && seg.length >= 6) || /^(pod|usr|cpool|dep|pm|wd|req|msg|thread|dflt)_/.test(seg) ? ':id' : seg)
    .join('/')
    .slice(0, 120);
}

export function simplifyUserAgent(ua: string): { browser: string; os: string; device: 'mobile' | 'desktop' } {
  const s = String(ua || '');
  const os = /iPhone|iPad|iOS/.test(s) ? 'iOS' : /Android/.test(s) ? 'Android' : /Mac OS X|Macintosh/.test(s) ? 'macOS' : /Windows/.test(s) ? 'Windows' : /Linux/.test(s) ? 'Linux' : 'Other';
  const browser = /Edg\//.test(s) ? 'Edge' : /SamsungBrowser/.test(s) ? 'Samsung' : /CriOS|Chrome\//.test(s) ? 'Chrome' : /FxiOS|Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) ? 'Safari' : 'Other';
  const device = /Mobi|iPhone|Android/.test(s) ? 'mobile' : 'desktop';
  return { browser, os, device };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ClientErrorKind = 'crash' | 'error' | 'api' | 'ui';

export interface ClientErrorReport {
  kind: ClientErrorKind;
  message: string;
  stack?: string;
  // API failures
  method?: string;
  path?: string;
  status?: number;
  code?: string;
  screen: string;
  breadcrumbs: string[];
}

// Same problem, same group: numbers and ids in messages don't split groups.
export function errorFingerprint(r: Pick<ClientErrorReport, 'kind' | 'message' | 'stack' | 'method' | 'path' | 'status' | 'code'>): string {
  const msg = cleanText(r.message, 200).replace(/\d+(\.\d+)?/g, 'N');
  const basis = r.kind === 'api'
    ? `api|${(r.method || 'GET').toUpperCase()}|${pathTemplate(r.path || '')}|${r.status || 0}|${r.code || ''}`
    : `${r.kind}|${msg}|${firstFrame(r.stack)}`;
  return 'err_' + crypto.createHash('sha1').update(basis).digest('hex').slice(0, 16);
}

function firstFrame(stack?: string): string {
  const line = String(stack || '').split('\n').find(l => /:\d+:\d+/.test(l)) || '';
  return line.replace(/^\s*at\s+/, '').replace(/\?[^:)]*/, '').replace(/-[A-Za-z0-9_]{8}\.js/, '.js').trim().slice(0, 160);
}

export interface AppErrorGroup {
  id: string;
  kind: ClientErrorKind;
  message: string;
  method?: string;
  path?: string;
  status?: number;
  code?: string;
  count: number;
  userIds: string[];
  sessions: number;
  screens: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
  lastAppVersion?: string;
  state: 'OPEN' | 'RESOLVED';
  resolvedAt?: string;
  alertedAt?: string;
  samples: Array<{
    at: string;
    screen: string;
    breadcrumbs: string[];
    stack?: string;
    browser: string;
    os: string;
    device: string;
    appVersion?: string;
    language?: string;
    country?: string;
    userId?: string;
  }>;
}

const MAX_SAMPLES = 5;
const MAX_USER_IDS = 1000;
// A new problem worth an alert: this many different people hit it.
export const ERROR_ALERT_USERS = 3;

export function recordError(group: AppErrorGroup | undefined, r: ClientErrorReport, ctx: {
  fingerprint: string; now: Date; userKey: string; userId?: string; ua: string; appVersion?: string; language?: string; country?: string; newSession: boolean;
}): { group: AppErrorGroup; reopened: boolean; shouldAlert: boolean } {
  const nowIso = ctx.now.toISOString();
  const ua = simplifyUserAgent(ctx.ua);
  const g: AppErrorGroup = group || {
    id: ctx.fingerprint,
    kind: r.kind,
    message: cleanText(r.message, 300),
    method: r.method,
    path: r.path ? pathTemplate(r.path) : undefined,
    status: r.status,
    code: r.code ? cleanText(r.code, 60) : undefined,
    count: 0,
    userIds: [],
    sessions: 0,
    screens: {},
    firstSeen: nowIso,
    lastSeen: nowIso,
    state: 'OPEN',
    samples: [],
  };
  let reopened = false;
  if (g.state === 'RESOLVED') {
    g.state = 'OPEN';
    g.resolvedAt = undefined;
    g.alertedAt = undefined;
    reopened = true;
  }
  g.count += 1;
  if (ctx.newSession) g.sessions += 1;
  if (!g.userIds.includes(ctx.userKey) && g.userIds.length < MAX_USER_IDS) g.userIds.push(ctx.userKey);
  const screen = cleanText(r.screen, 60) || 'unknown';
  g.screens[screen] = (g.screens[screen] || 0) + 1;
  g.lastSeen = nowIso;
  g.lastAppVersion = ctx.appVersion || g.lastAppVersion;
  g.samples = [{
    at: nowIso,
    screen,
    breadcrumbs: (r.breadcrumbs || []).slice(-10).map(b => cleanText(b, 80)),
    stack: r.stack ? cleanText(r.stack, 4000) : undefined,
    browser: ua.browser,
    os: ua.os,
    device: ua.device,
    appVersion: ctx.appVersion,
    language: ctx.language,
    country: ctx.country,
    userId: ctx.userId,
  }, ...g.samples].slice(0, MAX_SAMPLES);
  const shouldAlert = !g.alertedAt && g.userIds.length >= ERROR_ALERT_USERS;
  if (shouldAlert) g.alertedAt = nowIso;
  return { group: g, reopened, shouldAlert };
}

// ---------------------------------------------------------------------------
// Journeys and funnels
// ---------------------------------------------------------------------------

// Steps the server records when they actually happen.
export const SERVER_STEPS = [
  'account_created', 'identity_verified', 'bank_authorized', 'funds_added', 'pod_created', 'pod_joined', 'first_payout',
  'creator_profile_created', 'creator_account_connected', 'creator_approved', 'creator_pool_opened', 'creator_first_follower',
  'follower_seated',
] as const;
// Steps only the app sees (screens opened, buttons tapped).
export const CLIENT_STEPS = [
  'identity_started', 'bank_started', 'add_funds_started', 'create_pod_started', 'join_pod_started',
  'creator_page_viewed', 'creator_dashboard_opened', 'creator_link_opened', 'creator_link_signed_in', 'follower_checklist_ready', 'follower_seat_attempted',
] as const;
export type JourneyStep = typeof SERVER_STEPS[number] | typeof CLIENT_STEPS[number];
export const ALL_STEPS: readonly string[] = [...SERVER_STEPS, ...CLIENT_STEPS];

export interface UserJourney {
  id: string;        // user id, or "v:<visitorId>" before sign-in
  steps: Record<string, string>; // step -> first time reached (ISO)
  updatedAt: string;
}

// Records the first time only. Returns true if this was new.
export function markStep(j: UserJourney, step: string, at: Date): boolean {
  if (j.steps[step]) return false;
  j.steps[step] = at.toISOString();
  j.updatedAt = at.toISOString();
  return true;
}

// Visitor steps carry over to the account they sign in to (earliest wins).
export function mergeJourneys(into: UserJourney, from: UserJourney): void {
  for (const [step, at] of Object.entries(from.steps)) {
    if (!into.steps[step] || at < into.steps[step]) into.steps[step] = at;
  }
  into.updatedAt = new Date().toISOString();
}

export interface FunnelDefinition {
  id: string;
  title: string;
  steps: Array<{ step: string; anyOf?: string[]; label: string }>;
}

export const FUNNELS: FunnelDefinition[] = [
  {
    id: 'member',
    title: 'Member: sign-up to first payout',
    steps: [
      { step: 'account_created', label: 'Created an account' },
      { step: 'identity_started', label: 'Started identity check' },
      { step: 'identity_verified', label: 'Identity verified' },
      { step: 'bank_started', label: 'Started bank authorization' },
      { step: 'bank_authorized', label: 'Bank debits authorized' },
      { step: 'funds_added', label: 'Added funds' },
      { step: 'in_a_pod', anyOf: ['pod_created', 'pod_joined', 'follower_seated'], label: 'Created or joined a pod' },
      { step: 'first_payout', label: 'Received a payout' },
    ],
  },
  {
    id: 'creator',
    title: 'Creator: interest to first follower',
    steps: [
      { step: 'creator_page_viewed', label: 'Viewed the /creators page' },
      { step: 'creator_dashboard_opened', label: 'Opened the Creator dashboard' },
      { step: 'creator_profile_created', label: 'Created a creator profile' },
      { step: 'creator_account_connected', label: 'Connected a social account' },
      { step: 'creator_approved', label: 'Approved' },
      { step: 'creator_pool_opened', label: 'Opened a pool' },
      { step: 'creator_first_follower', label: 'First follower seated' },
    ],
  },
  {
    id: 'follower',
    title: "Follower: creator's link to a seat",
    steps: [
      { step: 'creator_link_opened', label: "Opened a creator's link" },
      { step: 'creator_link_signed_in', label: 'Signed in on the link' },
      { step: 'follower_checklist_ready', label: 'Finished the checklist' },
      { step: 'follower_seat_attempted', label: 'Signed and tried to take a seat' },
      { step: 'follower_seated', label: 'Took a seat' },
    ],
  },
];

const stepTime = (j: UserJourney, s: { step: string; anyOf?: string[] }): string | undefined => {
  if (!s.anyOf) return j.steps[s.step];
  const times = s.anyOf.map(x => j.steps[x]).filter(Boolean).sort();
  return times[0];
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// People who started the funnel in the window, how many reached each step
// (in order: a step counts only if every earlier step was reached), and the
// median time from the previous step.
export function computeFunnel(def: FunnelDefinition, journeys: readonly UserJourney[], since?: Date) {
  const cohort = journeys.filter(j => {
    const start = stepTime(j, def.steps[0]);
    return start && (!since || new Date(start) >= since);
  });
  return {
    id: def.id,
    title: def.title,
    started: cohort.length,
    steps: def.steps.map((s, i) => {
      const reached = cohort.filter(j => def.steps.slice(0, i + 1).every(p => stepTime(j, p)));
      const prevReached = i === 0 ? cohort : cohort.filter(j => def.steps.slice(0, i).every(p => stepTime(j, p)));
      const durations = i === 0 ? [] : reached
        .map(j => new Date(stepTime(j, s)!).getTime() - new Date(stepTime(j, def.steps[i - 1])!).getTime())
        .filter(ms => ms >= 0);
      return {
        step: s.step,
        label: s.label,
        users: reached.length,
        fromPrevious: prevReached.length ? Math.round((reached.length / prevReached.length) * 1000) / 10 : null,
        fromStart: cohort.length ? Math.round((reached.length / cohort.length) * 1000) / 10 : null,
        medianMinutesFromPrevious: (() => { const m = median(durations); return m === null ? null : Math.round(m / 60000); })(),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Daily counters (screens, events, feedback)
// ---------------------------------------------------------------------------

export interface TelemetryDay {
  id: string; // day_YYYY-MM-DD
  date: string;
  screens: Record<string, number>;
  errorsByScreen: Record<string, number>;
  sessions: number;
  updatedAt: string;
}

export const dayId = (d: Date) => `day_${d.toISOString().slice(0, 10)}`;
export const TELEMETRY_DAYS_KEPT = 90;

// ---------------------------------------------------------------------------
// Readable stack traces from the private source maps of the client build
// ---------------------------------------------------------------------------

type Consumer = { originalPositionFor(pos: { line: number; column: number }): { source?: string | null; line?: number | null; column?: number | null; name?: string | null } };

export function symbolicateStack(stack: string, loadMap: (file: string) => Consumer | null): string {
  return String(stack || '').split('\n').map(line => {
    const m = line.match(/(\/assets\/[A-Za-z0-9_.-]+\.js):(\d+):(\d+)/);
    if (!m) return line;
    const consumer = loadMap(m[1].replace(/^\//, ''));
    if (!consumer) return line;
    const pos = consumer.originalPositionFor({ line: Number(m[2]), column: Number(m[3]) });
    if (!pos.source) return line;
    const where = `${pos.source.replace(/^(\.\.\/)+/, '')}:${pos.line}:${pos.column}`;
    return `${line.match(/^\s*/)?.[0] || ''}at ${pos.name ? `${pos.name} ` : ''}(${where})`;
  }).join('\n');
}
