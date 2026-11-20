import React, { useEffect, useRef, useState } from 'react';
import { Megaphone, RefreshCw, Search, Sparkles, ImageIcon, Check, X, Pause, Play, Archive, Save, AlertTriangle, ShieldAlert, ExternalLink, Settings2, Eye, EyeOff, Star, Pencil } from 'lucide-react';
import {
  DEFAULT_MONTHLY_DAYS, HERO_CATEGORIES, HERO_CATEGORY_LABELS, HERO_CTA_DESTINATIONS, HERO_CTA_LABELS, HERO_SERVICE_LABELS, LIMITS, wordCount, evaluateCampaignPolicy,
} from '../lib/heroCampaigns';
import type { HeroCampaign, HeroTrend, HeroSettings, HeroCategory, CampaignContent, LiveState, PerformanceCounts, HeroCtaDestination, PolicyResult, FactCheck } from '../lib/heroCampaigns';

type AdminImage = { url: string; width: number; height: number; bytes: number; mimeType: string; model: string; prompt: string; createdAt: string };
interface AdminSlide {
  index: number;
  lead: boolean;
  hidden: boolean;
  content: CampaignContent;
  imageUrl: string | null;
  image: AdminImage | null;
  imageError: string | null;
  factCheck: FactCheck | null;
  policy: PolicyResult;
  // On the landing page while the campaign is live.
  onHero: boolean;
}
type AdminCampaign = HeroCampaign & {
  state: LiveState;
  imageUrl: string | null;
  image: AdminImage | null;
  slides: AdminSlide[];
  performance: PerformanceCounts & { clickThroughRate: number; engagementScore: number };
};
interface CampaignEdit { contents: Record<number, CampaignContent>; startAt: string; endAt: string; priority: number }
interface Run { id: string; at: string; kind: string; trigger: string; ok: boolean; summary: string; error?: string }
interface AdminData {
  settings: HeroSettings;
  ai: { provider: string; configured: boolean; discovery: boolean; textModel: string; imageModel: string };
  busy: { kind: string; label: string; startedAt: string } | null;
  runs: Run[];
  nextRefreshAt: string | null;
  activeCampaignId: string | null;
  trends: HeroTrend[];
  campaigns: AdminCampaign[];
  categoryPerformance: Array<PerformanceCounts & { category: HeroCategory; campaigns: number; clickThroughRate: number; engagementScore: number }>;
  engagementWeights: { click: number; registration: number; podCreation: number };
}

const STATE_STYLE: Record<LiveState, string> = {
  DRAFT: 'bg-slate-200 text-slate-700',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  LIVE: 'bg-emerald-600 text-white',
  PAUSED: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-rose-100 text-rose-700',
  RETIRED: 'bg-slate-100 text-slate-500',
  EXPIRED: 'bg-slate-100 text-slate-500',
};

const field = 'px-2 py-1.5 rounded-lg border border-[#DDE1E6] text-xs bg-white w-full';
const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50';
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
// <input type="datetime-local"> works in local time.
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : '');

/** Admin Ops: AI hero campaigns (trends, drafts, approval, schedule, performance, settings). */
export const HeroCampaignAdminPanel: React.FC = () => {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, CampaignEdit>>({});
  // Which slide the editor shows, per campaign (the lead slide by default).
  const [editingSlide, setEditingSlide] = useState<Record<string, number>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<HeroSettings | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const pollRef = useRef<number | null>(null);
  const emptyTrend = { title: '', description: '', category: 'HOLIDAYS_SEASONAL' as HeroCategory, sourceUrl: '', eventDate: '', brands: '' };
  const [showAddTrend, setShowAddTrend] = useState(false);
  const [newTrend, setNewTrend] = useState(emptyTrend);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch('/api/admin/hero');
      const body = await res.json().catch(() => null);
      if (res.ok && body?.settings) {
        setData(body);
        setSettingsDraft(prev => prev || body.settings);
      }
      return body as AdminData | null;
    } finally {
      if (!quiet) setLoading(false);
    }
  };
  useEffect(() => { load(); return () => { if (pollRef.current) window.clearInterval(pollRef.current); }; }, []);

  // AI jobs run in the background: keep refreshing until the server is idle.
  const watchJob = () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      const body = await load(true);
      if (body && !body.busy) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        const last = body.runs[0];
        if (last) setMessage({ ok: last.ok, text: last.ok ? last.summary : `${last.summary} ${last.error || ''}` });
      }
    }, 2000);
  };

  const call = async (path: string, method: 'POST' | 'PUT', body: unknown, done?: string): Promise<boolean> => {
    setMessage(null);
    try {
      const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: out.message || out.error || `Request failed (HTTP ${res.status}).` });
        return false;
      }
      if (res.status === 202) { setMessage({ ok: true, text: 'Working on it. This can take a minute.' }); await load(true); watchJob(); return true; }
      if (done) setMessage({ ok: true, text: done });
      await load(true);
      return true;
    } catch {
      setMessage({ ok: false, text: 'Network error. Please try again.' });
      return false;
    }
  };

  const slidesOf = (c: AdminCampaign): AdminSlide[] => c.slides || [];
  const slideIndexOf = (c: AdminCampaign) => {
    const i = editingSlide[c.id];
    return Number.isInteger(i) && slidesOf(c)[i] ? i : c.selectedConcept;
  };
  const editOf = (c: AdminCampaign): CampaignEdit => edits[c.id] || { contents: {}, startAt: c.startAt, endAt: c.endAt, priority: c.priority };
  const contentOf = (c: AdminCampaign, i: number): CampaignContent => editOf(c).contents[i] || slidesOf(c)[i]?.content || c.content;
  const setEdit = (c: AdminCampaign, patch: Partial<Omit<CampaignEdit, 'contents'>>) =>
    setEdits(prev => ({ ...prev, [c.id]: { ...editOf(c), ...patch } }));
  const setSlideContent = (c: AdminCampaign, i: number, content: CampaignContent) =>
    setEdits(prev => { const e = prev[c.id] || editOf(c); return { ...prev, [c.id]: { ...e, contents: { ...e.contents, [i]: content } } }; });
  const clearEdit = (id: string) => setEdits(prev => { const next = { ...prev }; delete next[id]; return next; });

  // Saves every slide with unsaved copy, then the schedule. Stops at the first refusal.
  const saveEdits = async (c: AdminCampaign, withSchedule: boolean): Promise<boolean> => {
    const e = editOf(c);
    for (const [i, content] of Object.entries(e.contents)) {
      if (!(await call(`/api/admin/hero/campaigns/${c.id}`, 'PUT', { slide: Number(i), content }))) {
        setEditingSlide(prev => ({ ...prev, [c.id]: Number(i) }));
        return false;
      }
    }
    if (withSchedule && !(await call(`/api/admin/hero/campaigns/${c.id}`, 'PUT', { startAt: e.startAt, endAt: e.endAt, priority: e.priority }))) return false;
    return true;
  };
  const saveCampaign = async (c: AdminCampaign) => {
    if (await saveEdits(c, true)) { clearEdit(c.id); setMessage({ ok: true, text: 'Campaign saved.' }); }
  };
  const approve = async (c: AdminCampaign) => {
    const e = editOf(c);
    // Save any edits first so what is approved is what is on screen.
    if (Object.keys(e.contents).length && !(await saveEdits(c, false))) return;
    if (await call(`/api/admin/hero/campaigns/${c.id}/approve`, 'POST', { startAt: e.startAt, endAt: e.endAt, priority: e.priority }, 'Campaign approved.')) clearEdit(c.id);
  };
  const slideAction = (c: AdminCampaign, body: Record<string, unknown>, done: string) =>
    call(`/api/admin/hero/campaigns/${c.id}`, 'PUT', body, done);
  const act = (c: AdminCampaign, action: 'reject' | 'pause' | 'resume' | 'retire', done: string) => {
    const needsNote = action === 'reject' || action === 'retire';
    const note = needsNote ? window.prompt(action === 'reject' ? 'Why is this campaign rejected? (optional)' : 'Why is this campaign retired? (optional)') : undefined;
    if (needsNote && note === null) return;
    call(`/api/admin/hero/campaigns/${c.id}/${action}`, 'POST', { note: note || undefined }, done);
  };

  // The same checks the server makes, so a half-filled form never reaches it.
  const trendProblems = (() => {
    const problems: string[] = [];
    const title = newTrend.title.trim();
    const description = newTrend.description.trim();
    if (title.length < 3) problems.push('a title (at least 3 characters)');
    if (description.length < 10) problems.push('what is happening (at least 10 characters)');
    if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(newTrend.sourceUrl.trim())) problems.push('a source link starting with https://');
    return problems;
  })();

  const addTrend = async () => {
    if (trendProblems.length) return;
    const ok = await call('/api/admin/hero/trends', 'POST', {
      title: newTrend.title.trim(),
      description: newTrend.description.trim(),
      category: newTrend.category,
      sourceUrl: newTrend.sourceUrl.trim(),
      eventDate: newTrend.eventDate ? new Date(`${newTrend.eventDate}T12:00:00`).toISOString() : undefined,
      brandsMentioned: newTrend.brands.split(',').map(b => b.trim()).filter(Boolean),
    }, 'Trend added. Use "Draft a campaign" to write the copy and make the image.');
    if (ok) { setNewTrend(emptyTrend); setShowAddTrend(false); }
  };

  const saveSettings = async () => {
    if (!settingsDraft || !data) return;
    const turningAutoOn = settingsDraft.publishMode === 'AUTO' && data.settings.publishMode !== 'AUTO';
    if (turningAutoOn && !window.confirm('Turn on automatic publishing?\n\nCampaigns that pass every check will go live on the landing page without anyone reviewing them. Sensitive topics, campaigns that mention a brand, and anything uncertain will still wait for approval.')) return;
    const ok = await call('/api/admin/hero/settings', 'PUT', {
      publishMode: settingsDraft.publishMode,
      confirmAutoPublish: turningAutoOn ? true : undefined,
      discoveryEnabled: settingsDraft.discoveryEnabled,
      discoveryIntervalHours: Number(settingsDraft.discoveryIntervalHours),
      discoveryCadence: settingsDraft.discoveryCadence || 'INTERVAL',
      monthlyDays: (settingsDraft.monthlyDays || DEFAULT_MONTHLY_DAYS).map(Number),
      relevanceThreshold: Number(settingsDraft.relevanceThreshold),
      maxTrendsPerRun: Number(settingsDraft.maxTrendsPerRun),
      campaignsPerRun: Number(settingsDraft.campaignsPerRun),
      defaultPriority: Number(settingsDraft.defaultPriority),
      region: settingsDraft.region,
      categories: settingsDraft.categories,
      durationDays: settingsDraft.durationDays,
      blockedTerms: settingsDraft.blockedTerms,
    }, 'Settings saved.');
    if (ok) setSettingsDraft(null);
  };

  const busy = Boolean(data?.busy);
  const campaigns = (data?.campaigns || []).filter(c => showClosed || (c.status !== 'RETIRED' && c.status !== 'REJECTED'));
  const closedCount = (data?.campaigns || []).filter(c => c.status === 'RETIRED' || c.status === 'REJECTED').length;
  const openTrends = (data?.trends || []).filter(t => t.status === 'NEW');
  const s = settingsDraft || data?.settings || null;

  return (
    <div className="bg-white border border-[#DDE1E6] rounded-2xl p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h3 className="font-extrabold text-sm flex items-center gap-2"><Megaphone className="w-4 h-4 text-[#005FB8]" /> AI hero campaigns</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => call('/api/admin/hero/discover', 'POST', {})} disabled={busy || !data?.ai.discovery} title={data && !data.ai.discovery ? 'Finding trends needs Gemini web search. You can add a trend yourself below.' : ''} className={`${btn} bg-[#005FB8] hover:bg-[#004C93] text-white`}>
            <Search className="w-3 h-3" /> Find trends now
          </button>
          <button type="button" onClick={() => setShowSettings(v => !v)} className={`${btn} border border-[#DDE1E6] hover:bg-gray-50`}><Settings2 className="w-3 h-3" /> Settings</button>
          <button type="button" onClick={() => load()} className={`${btn} border border-[#DDE1E6] hover:bg-gray-50`}><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>
      </div>

      {data && (
        <p className="text-xs text-slate-500 mb-3">
          Publishing: <strong>{data.settings.publishMode === 'AUTO' ? 'automatic for low-risk campaigns' : 'manual approval'}</strong>
          {' · '}Scheduled refresh: <strong>{!data.settings.discoveryEnabled ? 'off' : data.settings.discoveryCadence === 'TWICE_MONTHLY' ? `twice a month (days ${(data.settings.monthlyDays || DEFAULT_MONTHLY_DAYS).join(' and ')})` : `every ${data.settings.discoveryIntervalHours} hours`}</strong>
          {data.nextRefreshAt && <>{' · '}Next: <strong>{new Date(data.nextRefreshAt).getTime() <= Date.now() + 60_000 ? 'within minutes' : new Date(data.nextRefreshAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong></>}
          {' · '}On the landing page now: <strong>{data.activeCampaignId ? data.campaigns.find(c => c.id === data.activeCampaignId)?.content.headline : 'the evergreen hero'}</strong>
        </p>
      )}

      {data && !data.ai.configured && (
        <div className="mb-3 p-2.5 rounded-lg text-xs border bg-amber-50 border-amber-200 text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Campaign copy and images cannot be generated: no AI provider is configured for both. Copy needs GEMINI_API_KEY or GROQ_API_KEY; images need GEMINI_API_KEY or RUNWAY_API_KEY.</span>
        </div>
      )}
      {busy && data?.busy && (
        <div role="status" className="mb-3 p-2.5 rounded-lg text-xs font-semibold border bg-blue-50 border-blue-200 text-[#005FB8] flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {data.busy.label}…
        </div>
      )}
      {message && (
        <div role="status" className={`mb-3 p-2.5 rounded-lg text-xs font-semibold border ${message.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>{message.text}</div>
      )}

      {/* Settings */}
      {showSettings && s && (
        <div className="mb-4 p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-3 text-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="font-bold text-slate-600 space-y-1 text-[10px]">Publishing
              <select className={field} value={s.publishMode} onChange={e => setSettingsDraft({ ...s, publishMode: e.target.value as HeroSettings['publishMode'] })}>
                <option value="MANUAL">Manual approval</option>
                <option value="AUTO">Automatic (low-risk only)</option>
              </select>
            </label>
            <label className="font-bold text-slate-600 space-y-1 text-[10px]">Scheduled refresh (new image and copy)
              <select
                className={field}
                value={!s.discoveryEnabled ? 'off' : s.discoveryCadence === 'TWICE_MONTHLY' ? 'twice' : 'interval'}
                onChange={e => setSettingsDraft({ ...s, discoveryEnabled: e.target.value !== 'off', discoveryCadence: e.target.value === 'twice' ? 'TWICE_MONTHLY' : e.target.value === 'interval' ? 'INTERVAL' : s.discoveryCadence })}
              >
                <option value="off">Off</option>
                <option value="twice">Twice a month</option>
                <option value="interval">Every few hours</option>
              </select>
            </label>
            {s.discoveryCadence === 'TWICE_MONTHLY' ? (
              <div className="font-bold text-slate-600 space-y-1 text-[10px]">Days of the month (1-28)
                <div className="flex gap-1.5">
                  {[0, 1].map(i => (
                    <input
                      key={i}
                      aria-label={i === 0 ? 'First refresh day' : 'Second refresh day'}
                      className={`${field} font-mono`}
                      type="number"
                      min={1}
                      max={28}
                      value={(s.monthlyDays || DEFAULT_MONTHLY_DAYS)[i]}
                      onChange={e => {
                        const days = [...(s.monthlyDays || DEFAULT_MONTHLY_DAYS)] as [number, number];
                        days[i] = Number(e.target.value);
                        setSettingsDraft({ ...s, monthlyDays: days });
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <label className="font-bold text-slate-600 space-y-1 text-[10px]">Every (hours)
                <input className={`${field} font-mono`} type="number" min={6} max={168} value={s.discoveryIntervalHours} onChange={e => setSettingsDraft({ ...s, discoveryIntervalHours: Number(e.target.value) })} />
              </label>
            )}
            <label className="font-bold text-slate-600 space-y-1 text-[10px]">Region
              <input className={field} value={s.region} maxLength={60} onChange={e => setSettingsDraft({ ...s, region: e.target.value })} />
            </label>
            <label className="font-bold text-slate-600 space-y-1 text-[10px]">Relevance threshold (0-100)
              <input className={`${field} font-mono`} type="number" min={0} max={100} value={s.relevanceThreshold} onChange={e => setSettingsDraft({ ...s, relevanceThreshold: Number(e.target.value) })} />
            </label>
            <label className="font-bold text-slate-600 space-y-1 text-[10px]">Trends per run
              <input className={`${field} font-mono`} type="number" min={1} max={12} value={s.maxTrendsPerRun} onChange={e => setSettingsDraft({ ...s, maxTrendsPerRun: Number(e.target.value) })} />
            </label>
            <label className="font-bold text-slate-600 space-y-1 text-[10px]">Campaign drafts per run
              <input className={`${field} font-mono`} type="number" min={0} max={4} value={s.campaignsPerRun} onChange={e => setSettingsDraft({ ...s, campaignsPerRun: Number(e.target.value) })} />
            </label>
            <label className="font-bold text-slate-600 space-y-1 text-[10px]">Default priority (1-10)
              <input className={`${field} font-mono`} type="number" min={1} max={10} value={s.defaultPriority} onChange={e => setSettingsDraft({ ...s, defaultPriority: Number(e.target.value) })} />
            </label>
          </div>
          <div>
            <div className="font-bold text-slate-600 text-[10px] mb-1">Trend categories and campaign length (days)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {HERO_CATEGORIES.map(c => (
                <div key={c} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white border border-[#E2E8F0]">
                  <label className="inline-flex items-center gap-1.5 min-w-0">
                    <input type="checkbox" checked={s.categories.includes(c)} onChange={e => setSettingsDraft({ ...s, categories: e.target.checked ? [...s.categories, c] : s.categories.filter(x => x !== c) })} />
                    <span className="truncate">{HERO_CATEGORY_LABELS[c]}</span>
                  </label>
                  <input aria-label={`${HERO_CATEGORY_LABELS[c]}: days`} className="w-14 px-1.5 py-1 rounded border border-[#DDE1E6] font-mono text-xs" type="number" min={1} max={30} value={s.durationDays[c]} onChange={e => setSettingsDraft({ ...s, durationDays: { ...s.durationDays, [c]: Number(e.target.value) } })} />
                </div>
              ))}
            </div>
          </div>
          <label className="block font-bold text-slate-600 space-y-1 text-[10px]">Blocked words and phrases (one per line). Campaigns using them cannot be published.
            <textarea className={`${field} font-normal`} rows={2} value={s.blockedTerms.join('\n')} onChange={e => setSettingsDraft({ ...s, blockedTerms: e.target.value.split('\n') })} />
          </label>
          {s.discoveryCadence === 'TWICE_MONTHLY' && s.discoveryEnabled && (
            <p className="text-[11px] text-slate-600">
              On each of those days at 6:00 AM (server time) the system finds current trends and drafts a new campaign: image, headline, copy and button. Each campaign runs until the next refresh day, or until its event has passed.
              {s.publishMode === 'AUTO'
                ? ' Low-risk campaigns go live on their own; sensitive or brand-related ones wait here for approval.'
                : ' With manual approval, each draft waits here until you approve it; the landing page changes only then.'}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">AI: {data?.ai.provider} · text {data?.ai.textModel} · image {data?.ai.imageModel}
              {data?.settings.autoPublishActivatedAt && ` · automatic publishing turned on by ${data.settings.autoPublishActivatedBy} on ${new Date(data.settings.autoPublishActivatedAt).toLocaleDateString()}`}
            </span>
            <button type="button" onClick={saveSettings} className={`${btn} bg-slate-800 hover:bg-slate-900 text-white`}><Save className="w-3 h-3" /> Save settings</button>
          </div>
        </div>
      )}

      {/* Campaigns */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-extrabold text-slate-800">Campaigns ({campaigns.length})</h4>
        {closedCount > 0 && (
          <button type="button" onClick={() => setShowClosed(v => !v)} className="text-[11px] font-semibold text-[#005FB8] hover:underline">
            {showClosed ? 'Hide' : 'Show'} retired and rejected ({closedCount})
          </button>
        )}
      </div>
      {campaigns.length === 0 ? (
        <p className="text-xs text-slate-500 mb-4">No campaigns yet. Use "Find trends now", then review the drafts here. Until one is approved the landing page shows the evergreen hero.</p>
      ) : (
        <ul className="space-y-3 mb-4">
          {campaigns.map(c => {
            const e = editOf(c);
            const open = openId === c.id;
            const closed = c.status === 'RETIRED' || c.status === 'REJECTED';
            const slides = slidesOf(c);
            const si = slideIndexOf(c);
            const sl = slides[si];
            const sc = contentOf(c, si);
            const words = wordCount(sc.headline);
            const missing = slides.filter(s => !s.imageUrl).length;
            const onHero = slides.filter(s => s.onHero).length;
            const unsaved = Object.keys(e.contents).length;
            return (
              <li key={c.id} className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                <button type="button" onClick={() => setOpenId(open ? null : c.id)} aria-expanded={open} className="w-full flex items-center gap-3 p-3 text-left bg-[#F8FAFC] hover:bg-slate-100">
                  {c.imageUrl
                    ? <img src={c.imageUrl} alt="" className="w-24 h-[54px] rounded-lg object-cover shrink-0 bg-slate-200" />
                    : <div className="w-24 h-[54px] rounded-lg bg-slate-200 shrink-0 flex items-center justify-center text-slate-400"><ImageIcon className="w-5 h-5" /></div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${STATE_STYLE[c.state]}`}>{c.state === 'LIVE' && data?.activeCampaignId !== c.id ? 'Live (outranked)' : c.state}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#005FB8]">{onHero} of {slides.length} slides ready</span>
                      {c.policy.requiresManualReview && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Needs review</span>}
                      {!c.policy.ok && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">Lead slide breaks a rule</span>}
                      {c.publishedBy === 'AUTO' && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">Auto-published</span>}
                    </div>
                    <div className="text-sm font-bold text-slate-900 truncate mt-0.5">{c.content.headline}</div>
                    <div className="text-[11px] text-slate-500 truncate">{HERO_CATEGORY_LABELS[c.category]} · {new Date(c.startAt).toLocaleDateString()} to {new Date(c.endAt).toLocaleDateString()} · priority {c.priority}</div>
                  </div>
                  <div className="hidden sm:block text-right text-[11px] text-slate-600 font-mono shrink-0">
                    <div>{c.performance.impressions} views · {c.performance.clicks} clicks</div>
                    <div>{c.performance.registrations} sign-ups · {c.performance.podCreations} pods</div>
                  </div>
                </button>

                {open && (
                  <div className="p-3 space-y-3 text-xs border-t border-[#E2E8F0]">
                    <p className="text-[11px] text-slate-600">
                      While this campaign is live, the landing page shows <strong>only its slides</strong> (lead slide first), each with its own image and copy. A slide joins the hero once it has an image and passes the copy rules; hidden slides stay off.
                    </p>

                    {/* Slides */}
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <div className="font-bold text-slate-700">Slides ({slides.length})</div>
                        <div className="flex flex-wrap gap-1.5">
                        {!closed && (
                          <button type="button" onClick={() => call(`/api/admin/hero/campaigns/${c.id}/fact-check`, 'POST', {})} disabled={busy} title="Check every slide's copy against what MutualPool actually offers" className={`${btn} border border-[#005FB8] text-[#005FB8] hover:bg-blue-50`}>
                            <ShieldAlert className="w-3 h-3" /> Check copy
                          </button>
                        )}
                        {!closed && missing > 0 && (
                          <button type="button" onClick={() => call(`/api/admin/hero/campaigns/${c.id}/regenerate-image`, 'POST', { missing: true })} disabled={busy} className={`${btn} bg-[#005FB8] hover:bg-[#004C93] text-white`}>
                            <ImageIcon className="w-3 h-3" /> Make missing images ({missing})
                          </button>
                        )}
                        </div>
                      </div>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {slides.map(s => {
                          const concept = c.concepts[s.index];
                          const content = contentOf(c, s.index);
                          return (
                            <li key={s.index} className={`rounded-lg border overflow-hidden ${s.index === si ? 'border-[#005FB8] ring-1 ring-[#005FB8]' : 'border-[#E2E8F0]'} ${s.hidden ? 'opacity-60' : ''}`}>
                              <button type="button" onClick={() => setEditingSlide(prev => ({ ...prev, [c.id]: s.index }))} className="block w-full text-left">
                                {s.imageUrl
                                  ? <img src={s.imageUrl} alt="" className="w-full aspect-video object-cover bg-slate-200" />
                                  : <div className="w-full aspect-video bg-slate-100 flex items-center justify-center text-slate-400 text-[10px] p-2 text-center"><span><ImageIcon className="w-4 h-4 mx-auto mb-1" />{s.imageError ? `Image failed: ${s.imageError}` : 'No image yet'}</span></div>}
                                <div className="p-2">
                                  <div className="flex flex-wrap gap-1 mb-1">
                                    {s.lead && <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#005FB8] text-white inline-flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> Lead</span>}
                                    {s.onHero && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">Ready for hero</span>}
                                    {s.hidden && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700">Hidden</span>}
                                    {!s.policy.ok && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700">Breaks a rule</span>}
                                    {editOf(c).contents[s.index] && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">Unsaved</span>}
                                    {s.factCheck?.status === 'PASSED' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Fact-checked</span>}
                                    {s.factCheck?.status === 'FAILED' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700">Claims we don't offer</span>}
                                    {s.factCheck?.status === 'EDITED' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">Edited by you</span>}
                                    {s.factCheck?.status === 'OVERRIDDEN' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Approved by you</span>}
                                    {(!s.factCheck || s.factCheck.status === 'UNCHECKED') && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Not fact-checked</span>}
                                  </div>
                                  <div className="font-bold text-slate-900 leading-snug">{content.headline}</div>
                                  {concept && <div className="text-[10px] text-slate-500 mt-0.5">{concept.targetAudience} · {HERO_SERVICE_LABELS[concept.service]}</div>}
                                </div>
                              </button>
                              {!closed && (
                                <div className="flex flex-wrap gap-1 px-2 pb-2">
                                  <button type="button" onClick={() => setEditingSlide(prev => ({ ...prev, [c.id]: s.index }))} className="text-[10px] font-bold text-[#005FB8] hover:underline inline-flex items-center gap-0.5"><Pencil className="w-2.5 h-2.5" /> Edit</button>
                                  {!s.lead && <button type="button" disabled={busy} onClick={() => slideAction(c, { selectedConcept: s.index }, `Slide ${s.index + 1} now leads the hero.`)} className="text-[10px] font-bold text-[#005FB8] hover:underline inline-flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> Make lead</button>}
                                  {!s.lead && <button type="button" disabled={busy} onClick={() => slideAction(c, { slide: s.index, hidden: !s.hidden }, s.hidden ? `Slide ${s.index + 1} is back on the hero.` : `Slide ${s.index + 1} is off the hero.`)} className="text-[10px] font-bold text-slate-600 hover:underline inline-flex items-center gap-0.5">{s.hidden ? <><Eye className="w-2.5 h-2.5" /> Show</> : <><EyeOff className="w-2.5 h-2.5" /> Hide</>}</button>}
                                  <button type="button" disabled={busy} onClick={() => call(`/api/admin/hero/campaigns/${c.id}/regenerate-image`, 'POST', { slide: s.index })} className="text-[10px] font-bold text-slate-600 hover:underline inline-flex items-center gap-0.5"><ImageIcon className="w-2.5 h-2.5" /> {s.imageUrl ? 'Remake image' : 'Make image'}</button>
                                  {s.factCheck?.status === 'FAILED' && !editOf(c).contents[s.index] && (
                                    <button type="button" disabled={busy} title={`Flagged: ${s.factCheck.claims.join('; ')}`} onClick={() => { if (window.confirm(`The AI check flagged this slide:\n\n- ${s.factCheck!.claims.join('\n- ') || 'describes something MutualPool does not offer'}\n\nApprove the copy as accurate and put the slide on the hero?`)) slideAction(c, { slide: s.index, approveCopy: true }, `Slide ${s.index + 1} approved. It joins the hero if it has an image.`); }} className="text-[10px] font-bold text-rose-700 hover:underline inline-flex items-center gap-0.5">
                                      <Check className="w-2.5 h-2.5" /> Publish anyway
                                    </button>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Editor for the selected slide, previewed as the hero shows it */}
                    <div className="font-bold text-slate-700">Editing slide {si + 1}{sl?.lead ? ' (lead)' : ''}</div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-[4/3] max-h-72">
                        {sl?.imageUrl
                          ? <img src={sl.imageUrl} alt={sc.imageAlt} className="absolute inset-0 w-full h-full object-cover" />
                          : <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs p-4 text-center">No image yet{sl?.imageError ? `: ${sl.imageError}` : ''}</div>}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
                        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                          {sc.label && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 border border-white/30 text-[10px] font-bold uppercase"><Sparkles className="w-3 h-3" /> {sc.label}</span>}
                          <p className="mt-1.5 text-lg font-extrabold leading-tight">{sc.headline}</p>
                          <p className="mt-1 text-[11px] text-white/90 leading-snug line-clamp-3">{sc.description}</p>
                          <span className="mt-2 inline-block px-3 py-1.5 rounded-lg bg-white text-[#005FB8] font-bold text-[11px]">{sc.ctaLabel}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-600 space-y-1">Headline ({words} words; best at 3 to 9)
                          <input className={field} disabled={closed} value={sc.headline} maxLength={LIMITS.headlineChars} onChange={ev => setSlideContent(c, si, { ...sc, headline: ev.target.value })} />
                        </label>
                        <label className="block text-[10px] font-bold text-slate-600 space-y-1">Supporting description ({sc.description.length}/{LIMITS.descriptionChars})
                          <textarea className={field} disabled={closed} rows={3} value={sc.description} maxLength={LIMITS.descriptionChars + 40} onChange={ev => setSlideContent(c, si, { ...sc, description: ev.target.value })} />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-[10px] font-bold text-slate-600 space-y-1">Button label
                            <input className={field} disabled={closed} value={sc.ctaLabel} maxLength={LIMITS.ctaChars} onChange={ev => setSlideContent(c, si, { ...sc, ctaLabel: ev.target.value })} />
                          </label>
                          <label className="block text-[10px] font-bold text-slate-600 space-y-1">Button goes to
                            <select className={field} disabled={closed} value={sc.ctaDestination} onChange={ev => setSlideContent(c, si, { ...sc, ctaDestination: ev.target.value as HeroCtaDestination })}>
                              {HERO_CTA_DESTINATIONS.map(d => <option key={d} value={d}>{HERO_CTA_LABELS[d]}</option>)}
                            </select>
                          </label>
                          <label className="block text-[10px] font-bold text-slate-600 space-y-1">Label (optional)
                            <input className={field} disabled={closed} value={sc.label} maxLength={LIMITS.labelChars} onChange={ev => setSlideContent(c, si, { ...sc, label: ev.target.value })} />
                          </label>
                          <label className="block text-[10px] font-bold text-slate-600 space-y-1">Campaign priority (1-10)
                            <input className={`${field} font-mono`} disabled={closed} type="number" min={1} max={10} value={e.priority} onChange={ev => setEdit(c, { priority: Number(ev.target.value) })} />
                          </label>
                          <label className="block text-[10px] font-bold text-slate-600 space-y-1">Campaign starts
                            <input className={field} disabled={closed} type="datetime-local" value={toLocalInput(e.startAt)} onChange={ev => setEdit(c, { startAt: fromLocalInput(ev.target.value) || e.startAt })} />
                          </label>
                          <label className="block text-[10px] font-bold text-slate-600 space-y-1">Campaign ends
                            <input className={field} disabled={closed} type="datetime-local" value={toLocalInput(e.endAt)} onChange={ev => setEdit(c, { endAt: fromLocalInput(ev.target.value) || e.endAt })} />
                          </label>
                        </div>
                        <label className="block text-[10px] font-bold text-slate-600 space-y-1">Image description (for screen readers)
                          <input className={field} disabled={closed} value={sc.imageAlt} maxLength={LIMITS.altChars} onChange={ev => setSlideContent(c, si, { ...sc, imageAlt: ev.target.value })} />
                        </label>
                      </div>
                    </div>

                    {/* Checks for the slide being edited: of the text on screen, so
                        unsaved edits are judged as typed (the server checks again on save). */}
                    {sl && (() => {
                      const unsavedHere = Boolean(editOf(c).contents[si]);
                      const policy = unsavedHere
                        ? evaluateCampaignPolicy(sc, {
                            sensitivity: c.sensitivity,
                            brandsMentioned: c.brandsMentioned,
                            trendText: `${c.trendTitle} ${c.trendDescription}`,
                            trendVerified: true,
                            blockedTerms: data?.settings.blockedTerms || [],
                            factCheck: { status: 'EDITED', claims: [], checkedAt: '' },
                          })
                        : sl.policy;
                      if (policy.issues.length) {
                        return (
                          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                            <strong>{unsavedHere ? 'Your edits cannot be saved to the hero until this is fixed:' : sl.lead ? 'The campaign cannot be published until this is fixed:' : 'This slide stays off the hero until this is fixed:'}</strong>
                            <ul className="list-disc pl-4 mt-1 space-y-0.5">{policy.issues.map(i => <li key={i}>{i}</li>)}</ul>
                            {!unsavedHere && !closed && sl.factCheck?.status === 'FAILED' && (
                              <div className="mt-2 pt-2 border-t border-rose-200 text-rose-900">
                                <p>The AI check can be stricter than needed. If this copy is accurate, approve it: the slide goes on the hero, and the flagged points stay in the review history.</p>
                                <button type="button" disabled={busy} onClick={() => slideAction(c, { slide: si, approveCopy: true }, `Slide ${si + 1} approved. It joins the hero if it has an image.`)} className={`${btn} mt-1.5 bg-rose-700 hover:bg-rose-800 text-white`}>
                                  <Check className="w-3 h-3" /> This copy is accurate: publish anyway
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return unsavedHere
                        ? <p className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">Your edits pass the copy rules. Press <strong>Save changes</strong> to update the slide.</p>
                        : null;
                    })()}
                    {c.policy.reviewReasons.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                        <strong>Needs a person to approve (never published automatically):</strong>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">{c.policy.reviewReasons.map(i => <li key={i}>{i}</li>)}</ul>
                        {c.brandsMentioned.length > 0 && <p className="mt-1">Check that the copy and images do not suggest MutualPool is affiliated with, sponsored by or endorsed by any of these, and that no image copies their artwork, logos or characters.</p>}
                      </div>
                    )}
                    {sl && sl.policy.warnings.length > 0 && <p className="text-amber-800">{sl.policy.warnings.join(' ')}</p>}
                    {sl?.imageError && <p className="text-rose-700">Last image attempt for this slide failed: {sl.imageError}</p>}
                    {sl?.factCheck?.status === 'EDITED' && <p className="text-slate-600">You edited this copy, so the earlier AI check no longer applies. Use "Check copy" to check it again.</p>}

                    {/* Trend and reasoning */}
                    <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <div><strong>Trend:</strong> {c.trendTitle}. {c.trendDescription}</div>
                      {c.trendSourceUrl && (
                        <a href={c.trendSourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#005FB8] font-semibold hover:underline">
                          <ExternalLink className="w-3 h-3" /> Source: {c.trendSourceName || 'open'}
                        </a>
                      )}
                      {c.analysis && (
                        <>
                          <div><strong>Why now:</strong> {c.analysis.whyRelevantNow}</div>
                          <div><strong>Audience:</strong> {c.analysis.audienceSegment}</div>
                          <div><strong>Link to MutualPool:</strong> {c.analysis.connectionToMutualPool} ({HERO_SERVICE_LABELS[c.analysis.service]})</div>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    {!closed && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button type="button" onClick={() => saveCampaign(c)} disabled={busy} className={`${btn} bg-slate-800 hover:bg-slate-900 text-white`}><Save className="w-3 h-3" /> Save changes{unsaved ? ` (${unsaved} slide${unsaved === 1 ? '' : 's'})` : ''}</button>
                        <button type="button" onClick={() => call(`/api/admin/hero/campaigns/${c.id}/regenerate-image`, 'POST', { slide: si })} disabled={busy} className={`${btn} border border-[#DDE1E6] hover:bg-gray-50`}><ImageIcon className="w-3 h-3" /> {sl?.imageUrl ? `Remake image for slide ${si + 1}` : `Make image for slide ${si + 1}`}</button>
                        {c.status === 'DRAFT' && (
                          <>
                            <button type="button" onClick={() => call(`/api/admin/hero/campaigns/${c.id}/regenerate-copy`, 'POST', {})} disabled={busy} className={`${btn} border border-[#DDE1E6] hover:bg-gray-50`}><Sparkles className="w-3 h-3" /> Regenerate all copy</button>
                            <button type="button" onClick={() => approve(c)} disabled={busy} className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}><Check className="w-3 h-3" /> Approve and schedule</button>
                            <button type="button" onClick={() => act(c, 'reject', 'Campaign rejected.')} disabled={busy} className={`${btn} border border-rose-200 text-rose-700 hover:bg-rose-50`}><X className="w-3 h-3" /> Reject</button>
                          </>
                        )}
                        {c.status === 'APPROVED' && <button type="button" onClick={() => act(c, 'pause', 'Campaign paused. The landing page shows the next campaign or the evergreen hero.')} className={`${btn} border border-amber-300 text-amber-800 hover:bg-amber-50`}><Pause className="w-3 h-3" /> Pause</button>}
                        {c.status === 'PAUSED' && <button type="button" onClick={() => act(c, 'resume', 'Campaign resumed.')} className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}><Play className="w-3 h-3" /> Resume</button>}
                        {c.status !== 'DRAFT' && <button type="button" onClick={() => act(c, 'retire', 'Campaign retired.')} className={`${btn} border border-[#DDE1E6] text-slate-700 hover:bg-gray-50`}><Archive className="w-3 h-3" /> Retire</button>}
                      </div>
                    )}

                    {/* History */}
                    <details className="text-[11px] text-slate-600">
                      <summary className="cursor-pointer font-semibold">Review history ({c.approvals.length})</summary>
                      <ul className="mt-1 space-y-0.5 font-mono">
                        {[...c.approvals].reverse().map((a, i) => <li key={i}>{new Date(a.at).toLocaleString()} · {a.action} · {a.byName}{a.note ? ` · ${a.note}` : ''}</li>)}
                      </ul>
                    </details>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Trends */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-extrabold text-slate-800">Trends without a campaign ({openTrends.length})</h4>
        <button type="button" onClick={() => setShowAddTrend(v => !v)} className="text-[11px] font-semibold text-[#005FB8] hover:underline">{showAddTrend ? 'Cancel' : 'Add a trend yourself'}</button>
      </div>
      {showAddTrend && (
        <div className="mb-3 p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-2 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="block text-[10px] font-bold text-slate-600 space-y-1">What is trending
              <input className={field} value={newTrend.title} maxLength={160} placeholder="Thanksgiving travel week" onChange={e => setNewTrend({ ...newTrend, title: e.target.value })} />
            </label>
            <label className="block text-[10px] font-bold text-slate-600 space-y-1">Category
              <select className={field} value={newTrend.category} onChange={e => setNewTrend({ ...newTrend, category: e.target.value as HeroCategory })}>
                {HERO_CATEGORIES.map(c => <option key={c} value={c}>{HERO_CATEGORY_LABELS[c]}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-[10px] font-bold text-slate-600 space-y-1">What is happening, and why now ({newTrend.description.length}/600)
            <textarea className={field} rows={2} value={newTrend.description} maxLength={600} onChange={e => setNewTrend({ ...newTrend, description: e.target.value })} />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="block text-[10px] font-bold text-slate-600 space-y-1">Source link (required)
              <input className={field} type="url" value={newTrend.sourceUrl} placeholder="https://..." onChange={e => setNewTrend({ ...newTrend, sourceUrl: e.target.value })} />
            </label>
            <label className="block text-[10px] font-bold text-slate-600 space-y-1">Event date (optional)
              <input className={field} type="date" value={newTrend.eventDate} onChange={e => setNewTrend({ ...newTrend, eventDate: e.target.value })} />
            </label>
            <label className="block text-[10px] font-bold text-slate-600 space-y-1">Brands or names involved (optional, comma-separated)
              <input className={field} value={newTrend.brands} onChange={e => setNewTrend({ ...newTrend, brands: e.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={addTrend} disabled={trendProblems.length > 0} className={`${btn} bg-slate-800 hover:bg-slate-900 text-white`}><Check className="w-3 h-3" /> Add trend</button>
            {trendProblems.length > 0 && <span className="text-[11px] text-slate-500">Still needed: {trendProblems.join(', ')}.</span>}
          </div>
        </div>
      )}
      {openTrends.length === 0 ? (
        <p className="text-xs text-slate-500 mb-4">Nothing waiting.</p>
      ) : (
        <ul className="divide-y divide-[#E2E8F0] mb-4">
          {openTrends.map(t => (
            <li key={t.id} className="py-2.5 text-xs flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900">
                  {t.title}
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-50 text-[#005FB8] text-[10px] font-bold">{HERO_CATEGORY_LABELS[t.category]}</span>
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold font-mono">fit {t.relevanceScore}</span>
                  {t.sensitivity !== 'LOW' && <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">{t.sensitivity.toLowerCase()} sensitivity</span>}
                  {!t.verified && <span className="ml-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">no verified source</span>}
                </div>
                <div className="text-slate-600 mt-0.5">{t.description}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {t.relevanceReason}
                  {t.eventDate && ` · event ${new Date(t.eventDate).toLocaleDateString()}`}
                  {t.popularity && ` · ${t.popularity}`}
                  {' · '}found {new Date(t.discoveredAt).toLocaleDateString()} · timely until {new Date(t.suggestedExpiresAt).toLocaleDateString()} · {t.region}
                  {t.sourceUrl && <> · <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#005FB8] font-semibold hover:underline">{t.sourceName || 'source'}</a></>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" disabled={busy || !t.verified || !data?.ai.configured} title={t.verified ? '' : 'A trend without a verified source cannot become a campaign'} onClick={() => call(`/api/admin/hero/trends/${t.id}/generate`, 'POST', {})} className={`${btn} border border-[#005FB8] text-[#005FB8] hover:bg-blue-50`}>
                  <Sparkles className="w-3 h-3" /> Draft a campaign
                </button>
                <button type="button" onClick={() => call(`/api/admin/hero/trends/${t.id}/dismiss`, 'POST', {}, 'Trend dismissed.')} className={`${btn} border border-[#DDE1E6] text-slate-600 hover:bg-gray-50`}>Dismiss</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Performance */}
      {data && data.categoryPerformance.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-extrabold text-slate-800 mb-1">Performance by category</h4>
          <p className="text-[11px] text-slate-500 mb-2">Engagement counts a click as {data.engagementWeights.click}, a sign-up as {data.engagementWeights.registration} and a pod created as {data.engagementWeights.podCreation}, per 100 views, so clicks alone do not win.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-left text-slate-500">
                <tr><th className="py-1 pr-3 font-semibold">Category</th><th className="pr-3 font-semibold">Campaigns</th><th className="pr-3 font-semibold">Views</th><th className="pr-3 font-semibold">Unique</th><th className="pr-3 font-semibold">Clicks</th><th className="pr-3 font-semibold">Click rate</th><th className="pr-3 font-semibold">Sign-ups</th><th className="pr-3 font-semibold">Pods</th><th className="font-semibold">Engagement</th></tr>
              </thead>
              <tbody className="font-mono">
                {[...data.categoryPerformance].sort((a, b) => b.engagementScore - a.engagementScore).map(r => (
                  <tr key={r.category} className="border-t border-[#E2E8F0]">
                    <td className="py-1 pr-3 font-sans">{HERO_CATEGORY_LABELS[r.category]}</td><td className="pr-3">{r.campaigns}</td><td className="pr-3">{r.impressions}</td><td className="pr-3">{r.uniqueImpressions}</td><td className="pr-3">{r.clicks}</td><td className="pr-3">{pct(r.clickThroughRate)}</td><td className="pr-3">{r.registrations}</td><td className="pr-3">{r.podCreations}</td><td>{r.engagementScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent jobs */}
      {data && data.runs.length > 0 && (
        <details className="text-[11px] text-slate-600">
          <summary className="cursor-pointer font-semibold">Recent AI jobs ({data.runs.length})</summary>
          <ul className="mt-1 space-y-0.5">
            {data.runs.map(r => (
              <li key={r.id} className={r.ok ? '' : 'text-rose-700'}>
                <span className="font-mono">{new Date(r.at).toLocaleString()}</span> · {r.kind.toLowerCase()} ({r.trigger.toLowerCase()}) · {r.summary}{r.error ? ` ${r.error}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
