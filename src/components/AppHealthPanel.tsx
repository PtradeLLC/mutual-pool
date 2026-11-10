import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ThumbsUp, ThumbsDown, Bug } from 'lucide-react';

// Admin Ops: App health and usage insight (src/server/telemetry.ts).
// Errors users hit by screen, journey drop-off funnels, screen views, and
// member feedback. In-house data only.

interface ErrorRow {
  id: string; kind: 'crash' | 'error' | 'api' | 'ui'; message: string; method?: string; path?: string; status?: number; code?: string;
  count: number; users: number; sessions: number; screens: Record<string, number>; firstSeen: string; lastSeen: string; lastAppVersion?: string; state: 'OPEN' | 'RESOLVED';
}
interface FunnelStep { step: string; label: string; users: number; fromPrevious: number | null; fromStart: number | null; medianMinutesFromPrevious: number | null }
interface Funnel { id: string; title: string; started: number; steps: FunnelStep[] }
interface ScreenRow { screen: string; views: number; errors: number; errorRate: number | null }
interface FeedbackEntry { id: string; at: string; kind: 'easy' | 'hard' | 'problem'; step?: string; comment: string; screen: string; userId?: string; lastError?: string; breadcrumbs: string[]; browser: string; os: string; device: string; state: 'NEW' | 'DONE' }
interface Health { days: number; sessions: number; errors: ErrorRow[]; funnels: Funnel[]; screens: ScreenRow[]; feedback: { byStep: Record<string, { easy: number; hard: number }>; entries: FeedbackEntry[] } }
interface ErrorDetail extends ErrorRow { samples: Array<{ at: string; screen: string; breadcrumbs: string[]; stack?: string; browser: string; os: string; device: string; appVersion?: string; language?: string; country?: string; userId?: string }> }

const KIND_LABEL: Record<string, string> = { crash: 'Crash', error: 'Script error', api: 'Server request', ui: 'Error shown' };
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
const duration = (min: number | null) => min === null ? '—' : min < 60 ? `${min} min` : min < 1440 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} days`;
const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold';

export const AppHealthPanel: React.FC = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'errors' | 'funnels' | 'screens' | 'feedback'>('errors');
  const [showResolved, setShowResolved] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<ErrorDetail | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/app-health?days=${days}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleError = async (id: string) => {
    if (open === id) { setOpen(null); setDetail(null); return; }
    setOpen(id);
    setDetail(null);
    const res = await fetch(`/api/admin/app-health/errors/${id}`);
    if (res.ok) setDetail(await res.json());
  };
  const post = async (path: string) => {
    await fetch(path, { method: 'POST' });
    await load();
  };

  const errors = (data?.errors || []).filter(e => showResolved || e.state === 'OPEN');
  const openCount = (data?.errors || []).filter(e => e.state === 'OPEN').length;
  const newFeedback = (data?.feedback.entries || []).filter(f => f.state === 'NEW').length;

  return (
    <div className="bg-white border border-[#DDE1E6] rounded-2xl p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="font-extrabold text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-[#005FB8]" /> App health</h3>
        <div className="flex items-center gap-2">
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="px-2 py-1 rounded-lg border border-[#DDE1E6] text-[11px] font-semibold">
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last year</option>
          </select>
          <button type="button" onClick={load} className={`${btn} border-[#DDE1E6] hover:bg-gray-50`}><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 mb-3">{data ? `${data.sessions.toLocaleString()} app sessions in this period. Members who turned off usage data aren't included.` : 'Loading…'}</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {([
          ['errors', `Errors (${openCount} open)`],
          ['funnels', 'Drop-off funnels'],
          ['screens', 'Screens'],
          ['feedback', `Feedback (${newFeedback} new)`],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === key ? 'bg-[#005FB8] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>
        ))}
      </div>

      {tab === 'errors' && data && (
        <>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 mb-2"><input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} /> Show resolved</label>
          {errors.length === 0 ? <p className="text-xs text-slate-500">No errors in this period. 🎉</p> : (
            <ul className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-xl overflow-hidden">
              {errors.map(e => {
                const topScreens = Object.entries(e.screens).sort((a, b) => b[1] - a[1]).slice(0, 3);
                return (
                  <li key={e.id} className="text-xs">
                    <button type="button" onClick={() => toggleError(e.id)} className="w-full text-left px-3 py-2.5 hover:bg-[#F8FAFC] flex items-start gap-2">
                      {open === e.id ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${e.kind === 'crash' ? 'bg-rose-100 text-rose-800' : e.kind === 'api' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{KIND_LABEL[e.kind]}</span>
                          {e.state === 'RESOLVED' && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Resolved</span>}
                          <span className="font-semibold text-[#111827] break-words">{e.kind === 'api' ? `${e.method} ${e.path} → ${e.status}${e.code ? ` ${e.code}` : ''}` : e.message}</span>
                        </div>
                        {e.kind === 'api' && <div className="text-slate-600 mt-0.5 break-words">{e.message}</div>}
                        <div className="text-slate-500 mt-0.5">On: {topScreens.map(([s, n]) => `${s} (${n})`).join(' · ')}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold">{e.users} {e.users === 1 ? 'person' : 'people'}</div>
                        <div className="text-slate-500">{e.count}× · {ago(e.lastSeen)}</div>
                      </div>
                    </button>
                    {open === e.id && (
                      <div className="px-3 pb-3 pl-9 space-y-2 bg-[#F8FAFC]">
                        <div className="text-slate-600">First seen {new Date(e.firstSeen).toLocaleString()} · last {new Date(e.lastSeen).toLocaleString()} · app version {e.lastAppVersion || '?'}</div>
                        <div className="text-slate-600">All screens: {Object.entries(e.screens).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} (${n})`).join(' · ')}</div>
                        {!detail && <p className="text-slate-500">Loading examples…</p>}
                        {detail?.samples.map((s, i) => (
                          <div key={i} className="p-2 rounded-lg bg-white border border-[#E2E8F0] space-y-1">
                            <div className="text-slate-600">{new Date(s.at).toLocaleString()} · {s.screen} · {s.browser} on {s.os} ({s.device}) · {s.language || '?'} · {s.country || '?'} · v{s.appVersion || '?'}{s.userId ? ` · user ${s.userId}` : ' · visitor'}</div>
                            {s.breadcrumbs.length > 0 && <div className="text-slate-500">Before it happened: {s.breadcrumbs.join(' → ')}</div>}
                            {s.stack && <pre className="text-[10px] leading-snug whitespace-pre-wrap break-words max-h-48 overflow-y-auto bg-slate-900 text-slate-100 p-2 rounded">{s.stack}</pre>}
                          </div>
                        ))}
                        {e.state === 'OPEN'
                          ? <button type="button" onClick={() => post(`/api/admin/app-health/errors/${e.id}/resolve`)} className={`${btn} border-emerald-300 text-emerald-800 hover:bg-emerald-50`}><CheckCircle2 className="w-3 h-3" /> Mark resolved (reopens if it happens again)</button>
                          : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === 'funnels' && data && (
        <div className="space-y-5">
          <p className="text-[11px] text-slate-500">People who reached the first step in this period, and how many went on to each next step. A big drop or a long median time marks a bottleneck.</p>
          {data.funnels.map(f => {
            const worst = f.steps.slice(1).filter(s => s.fromPrevious !== null).sort((a, b) => (a.fromPrevious! - b.fromPrevious!))[0];
            return (
              <div key={f.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-sm font-bold">{f.title}</h4>
                  <span className="text-[11px] text-slate-500">{f.started.toLocaleString()} started</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {f.steps.map((s, i) => (
                    <div key={s.step} className="text-xs">
                      <div className="flex justify-between gap-2">
                        <span className={worst && worst.step === s.step && f.started > 0 ? 'font-bold text-rose-700' : ''}>{i + 1}. {s.label}{worst && worst.step === s.step && f.started > 0 ? ' ← biggest drop' : ''}</span>
                        <span className="text-slate-600 tabular-nums shrink-0">
                          {s.users.toLocaleString()} {i > 0 && s.fromPrevious !== null ? `· ${s.fromPrevious}% of previous · median ${duration(s.medianMinutesFromPrevious)}` : ''}
                        </span>
                      </div>
                      <div className="mt-0.5 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-[#005FB8]" style={{ width: `${s.fromStart ?? 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'screens' && data && (
        data.screens.length === 0 ? <p className="text-xs text-slate-500">No screen views yet.</p> : (
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="py-1">Screen</th><th className="py-1 text-right">Views</th><th className="py-1 text-right">Errors</th><th className="py-1 text-right">Errors per 100 views</th></tr></thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {data.screens.map(s => (
                <tr key={s.screen}>
                  <td className="py-1.5 pr-2">{s.screen}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.views.toLocaleString()}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.errors.toLocaleString()}</td>
                  <td className={`py-1.5 text-right tabular-nums ${s.errorRate !== null && s.errorRate >= 5 ? 'text-rose-700 font-bold' : ''}`}>{s.errorRate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === 'feedback' && data && (
        <div className="space-y-4">
          {Object.keys(data.feedback.byStep).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(data.feedback.byStep).map(([s, v]) => {
                const total = v.easy + v.hard;
                return (
                  <div key={s} className="p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs flex items-center justify-between">
                    <span className="font-semibold">{s.replace(/_/g, ' ')}</span>
                    <span className="flex items-center gap-2"><ThumbsUp className="w-3.5 h-3.5 text-emerald-600" /> {v.easy} <ThumbsDown className="w-3.5 h-3.5 text-rose-600" /> {v.hard} <span className="text-slate-500">({total ? Math.round((v.easy / total) * 100) : 0}% easy)</span></span>
                  </div>
                );
              })}
            </div>
          )}
          {data.feedback.entries.filter(f => f.comment || f.kind === 'problem').length === 0 ? <p className="text-xs text-slate-500">No comments or problem reports yet.</p> : (
            <ul className="divide-y divide-[#E2E8F0]">
              {data.feedback.entries.filter(f => f.comment || f.kind === 'problem').map(f => (
                <li key={f.id} className={`py-2.5 text-xs ${f.state === 'DONE' ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-semibold">
                      {f.kind === 'problem' ? <Bug className="w-3.5 h-3.5 text-rose-600" /> : f.kind === 'hard' ? <ThumbsDown className="w-3.5 h-3.5 text-rose-600" /> : <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />}
                      {f.kind === 'problem' ? 'Problem report' : `"${f.step?.replace(/_/g, ' ')}" was ${f.kind}`} · {f.screen}
                    </span>
                    <span className="text-slate-500">{ago(f.at)} · {f.browser}/{f.os}{f.userId ? ` · user ${f.userId}` : ''}</span>
                  </div>
                  {f.comment && <p className="mt-1 text-slate-800 whitespace-pre-wrap">{f.comment}</p>}
                  {f.lastError && <p className="mt-1 text-amber-800 flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Last error: {f.lastError}</p>}
                  {f.breadcrumbs.length > 0 && <p className="mt-1 text-slate-500">Before: {f.breadcrumbs.join(' → ')}</p>}
                  {f.state === 'NEW' && <button type="button" onClick={() => post(`/api/admin/app-health/feedback/${f.id}/done`)} className={`${btn} mt-1.5 border-[#DDE1E6] hover:bg-gray-50`}><CheckCircle2 className="w-3 h-3" /> Mark handled</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
