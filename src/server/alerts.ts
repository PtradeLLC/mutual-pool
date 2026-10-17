// Operational incidents: things an operator must see even when nobody is
// watching the logs. Each incident is logged as one structured JSON line
// (easy to filter in Cloud Logging) and, when ALERT_WEBHOOK_URL is set, posted
// to that URL (Slack/Discord/PagerDuty-style incoming webhook). The last few
// hundred are kept in memory for the admin health view.

export type IncidentSeverity = 'warning' | 'error' | 'critical';

export interface Incident {
  id: string;
  at: string;
  severity: IncidentSeverity;
  kind: string;
  message: string;
  meta?: Record<string, unknown>;
}

const recent: Incident[] = [];
const MAX_RECENT = 300;
const WEBHOOK_TIMEOUT_MS = 5_000;

export function recentIncidents(limit = 50): Incident[] {
  return recent.slice(0, limit);
}

export function incidentCounts(sinceMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - sinceMs;
  const window = recent.filter(i => new Date(i.at).getTime() >= cutoff);
  return {
    total: window.length,
    critical: window.filter(i => i.severity === 'critical').length,
    error: window.filter(i => i.severity === 'error').length,
    warning: window.filter(i => i.severity === 'warning').length,
  };
}

function safeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  try {
    return JSON.parse(JSON.stringify(meta, (_k, v) => (v instanceof Error ? { message: v.message } : v)));
  } catch {
    return { note: 'meta not serializable' };
  }
}

// Never throws; never awaited by callers.
export function reportIncident(severity: IncidentSeverity, kind: string, message: string, meta?: Record<string, unknown>): Incident {
  const incident: Incident = {
    id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    severity,
    kind,
    message: message.slice(0, 1000),
    meta: safeMeta(meta),
  };
  recent.unshift(incident);
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;

  const line = JSON.stringify({ level: severity === 'warning' ? 'WARN' : 'ERROR', incident: true, ...incident });
  if (severity === 'warning') console.warn(line); else console.error(line);

  const url = process.env.ALERT_WEBHOOK_URL;
  if (url && severity !== 'warning') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `text` is understood by Slack and Discord-compatible webhooks; the rest is for anything else.
      body: JSON.stringify({ text: `[MutualPool ${severity.toUpperCase()}] ${kind}: ${incident.message}`, content: `[MutualPool ${severity.toUpperCase()}] ${kind}: ${incident.message}`, incident }),
      signal: controller.signal,
    }).catch(err => console.error('[alerts] webhook delivery failed:', String(err?.message || err)))
      .finally(() => clearTimeout(timer));
  }
  return incident;
}
