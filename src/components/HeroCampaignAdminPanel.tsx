import React, { useEffect, useRef, useState } from 'react';
import { Megaphone, RefreshCw, Search, Sparkles, ImageIcon, Check, X, Pause, Play, Archive, Save, AlertTriangle, ShieldAlert, ExternalLink, Settings2 } from 'lucide-react';
import {
  HERO_CATEGORIES, HERO_CATEGORY_LABELS, HERO_CTA_DESTINATIONS, HERO_CTA_LABELS, HERO_SERVICE_LABELS, LIMITS, wordCount,
} from '../lib/heroCampaigns';
import type { HeroCampaign, HeroTrend, HeroSettings, HeroCategory, CampaignContent, LiveState, PerformanceCounts, HeroCtaDestination } from '../lib/heroCampaigns';

type AdminCampaign = HeroCampaign & {
  state: LiveState;
  imageUrl: string | null;
  image: { width: number; height: number; bytes: number; mimeType: string; model: string; prompt: string; createdAt: string } | null;
  performance: PerformanceCounts & { clickThroughRate: number; engagementScore: number };
};
interface Run { id: string; at: string; kind: string; trigger: string; ok: boolean; summary: string; error?: string }
interface AdminData {
  settings: HeroSettings;
  ai: { provider: string; configured: boolean; textModel: string; imageModel: string };
  busy: { kind: string; label: string; startedAt: string } | null;
  runs: Run[];
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
  const [edits, setEdits] = useState<Record<string, { content: CampaignContent; startAt: string; endAt: string; priority: number }>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<HeroSettings | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const pollRef = useRef<number | null>(null);

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

  const editOf = (c: AdminCampaign) => edits[c.id] || { content: c.content, startAt: c.startAt, endAt: c.endAt, priority: c.priority };
  const setEdit = (c: AdminCampaign, patch: Partial<{ content: CampaignContent; startAt: string; endAt: string; priority: number }>) =>
    setEdits(prev => ({ ...prev, [c.id]: { ...editOf(c), ...patch } }));
  const clearEdit = (id: string) => setEdits(prev => { const next = { ...prev }; delete next[id]; return next; });

  const saveCampaign = async (c: AdminCampaign) => {
    const e = editOf(c);
    if (await call(`/api/admin/hero/campaigns/${c.id}`, 'PUT', { content: e.content, startAt: e.startAt, endAt: e.endAt, priority: e.priority }, 'Campaign saved.')) clearEdit(c.id);
  };
  const approve = async (c: AdminCampaign) => {
    const e = editOf(c);
    // Save any edits first so what is approved is what is on screen.
    if (edits[c.id] && !(await call(`/api/admin/hero/campaigns/${c.id}`, 'PUT', { content: e.content, priority: e.priority }))) return;
    if (await call(`/api/admin/hero/campaigns/${c.id}/approve`, 'POST', { startAt: e.startAt, endAt: e.endAt, priority: e.priority }, 'Campaign approved.')) clearEdit(c.id);
  };
  const act = (c: AdminCampaign, action: 'reject' | 'pause' | 'resume' | 'retire', done: string) => {
    const needsNote = action === 'reject' || action === 'retire';
    const note = needsNote ? window.prompt(action === 'reject' ? 'Why is this campaign rejected? (optional)' : 'Why is this campaign retired? (optional)') : undefined;
    if (needsNote && note === null) return;
    call(`/api/admin/hero/campaigns/${c.id}/${action}`, 'POST', { note: note || undefined }, done);
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
          <button type="button" onClick={() => call('/api/admin/hero/discover', 'POST', {})} disabled={busy || !data?.ai.configured} className={`${btn} bg-[#005FB8] hover:bg-[#004C93] text-white`}>
            <Search className="w-3 h-3" /> Find trends now
          </button>
          <button type="button" onClick={() => setShowSettings(v => !v)} className={`${btn} border border-[#DDE1E6] hover:bg-gray-50`}><Settings2 className="w-3 h-3" /> Settings</button>
          <button type="button" onClick={() => load()} className={`${btn} border border-[#DDE1E6] hover:bg-gray-50`}><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>
      </div>

      {data && (
        <p className="text-xs text-slate-500 mb-3">
          Publishing: <strong>{data.settings.publishMode === 'AUTO' ? 'automatic for low-risk campaigns' : 'manual approval'}</strong>
          {' · '}Scheduled discovery: <strong>{data.settings.discoveryEnabled ? `every ${data.settings.discoveryIntervalHours} hours` : 'off'}</strong>
          {' · '}On the landing page now: <strong>{data.activeCampaignId ? data.campaigns.find(c => c.id === data.activeCampaignId)?.content.headline : 'the evergreen hero'}</strong>
        </p>
      )}

      {data && !data.ai.configured && (
        <div className="mb-3 p-2.5 rounded-lg text-xs border bg-amber-50 border-amber-200 text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>No AI provider is configured, so trends and campaigns cannot be generated. Set GEMINI_API_KEY (a key with billing enabled: search grounding and image generation have no free quota).</span>
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
            <label className="font-bold text-slate-600 space-y-1 text-[10px]">Scheduled discovery
              <select className={field} value={s.discoveryEnabled ? 'on' : 'off'} onChange={e => setSettingsDraft({ ...s, discoveryEnabled: e.target.value === 'on' })}>
                <option value="off">Off</option>
                <option value="on">On</option>
              </select>
            </label>
            <label className="font-bold text-slate-600 space-y-1 text-[10px]">Every (hours)
              <input className={`${field} font-mono`} type="number" min={6} max={168} value={s.discoveryIntervalHours} onChange={e => setSettingsDraft({ ...s, discoveryIntervalHours: Number(e.target.value) })} />
            </label>
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
            const words = wordCount(e.content.headline);
            return (
              <li key={c.id} className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                <button type="button" onClick={() => setOpenId(open ? null : c.id)} aria-expanded={open} className="w-full flex items-center gap-3 p-3 text-left bg-[#F8FAFC] hover:bg-slate-100">
                  {c.imageUrl
                    ? <img src={c.imageUrl} alt="" className="w-24 h-[54px] rounded-lg object-cover shrink-0 bg-slate-200" />
                    : <div className="w-24 h-[54px] rounded-lg bg-slate-200 shrink-0 flex items-center justify-center text-slate-400"><ImageIcon className="w-5 h-5" /></div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${STATE_STYLE[c.state]}`}>{c.state === 'LIVE' && data?.activeCampaignId !== c.id ? 'Live (outranked)' : c.state}</span>
                      {c.policy.requiresManualReview && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Needs review</span>}
                      {!c.policy.ok && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">Breaks a rule</span>}
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
                    {/* Preview, as the hero shows it */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-[4/3] max-h-72">
                        {c.imageUrl
                          ? <img src={c.imageUrl} alt={e.content.imageAlt} className="absolute inset-0 w-full h-full object-cover" />
                          : <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs p-4 text-center">No image yet{c.imageError ? `: ${c.imageError}` : ''}</div>}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
                        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                          {e.content.label && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 border border-white/30 text-[10px] font-bold uppercase"><Sparkles className="w-3 h-3" /> {e.content.label}</span>}
                          <p className="mt-1.5 text-lg font-extrabold leading-tight">{e.content.headline}</p>
                          <p className="mt-1 text-[11px] text-white/90 leading-snug line-clamp-3">{e.content.description}</p>
                          <span className="mt-2 inline-block px-3 py-1.5 rounded-lg bg-white text-[#005FB8] font-bold text-[11px]">{e.content.ctaLabel}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-600 space-y-1">Headline ({words} words; best at 3 to 9)
                          <input className={field} disabled={closed} value={e.content.headline} maxLength={LIMITS.headlineChars} onChange={ev => setEdit(c, { content: { ...e.content, headline: ev.target.value } })} />
                        </label>
                        <label className="block text-[10px] font-bold text-slate-600 space-y-1">Supporting description ({e.content.description.length}/{LIMITS.descriptionChars})
                          <textarea className={field} disabled={closed} rows={3} value={e.content.description} maxLength={LIMITS.descriptionChars + 40} onChange={ev => setEdit(c, { content: { ...e.content, description: ev.target.value } })} />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-[10px] font-bold text-slate-600 space-y-1">Button label
                            <input className={field} disabled={closed} value={e.content.ctaLabel} maxLength={LIMITS.ctaChars} onChange={ev => setEdit(c, { content: { ...e.content, ctaLabel: ev.target.value } })} />
                          </label>
                          <label className="block text-[10px] font-bold text-slate-600 space-y-1">Button goes to
                            <select className={field} disabled={closed} value={e.content.ctaDestination} onChange={ev => setEdit(c, { content: { ...e.content, ctaDestination: ev.target.value as HeroCtaDestination } })}>
                              {HERO_CTA_DESTINATIONS.map(d => <option key={d} value={d}>{HERO_CTA_LABELS[d]}</option>)}
                            </select>
                          </label>
                          <label className="block text-[10px] font-bold text-slate-600 space-y-1">Label (optional)
                            <input className={field} disabled={closed} value={e.content.label} maxLength={LIMITS.labelChars} onChange={ev => setEdit(c, { content: { ...e.content, label: ev.target.value } })} />
                          </label>
                          <label className="block text-[10px] font-bold text-slate-600 space-y-1">Priority (1-10)
                            <input className={`${field} font-mono`} disabled={closed} type="number" min={1} max={10} value={e.priority} onChange={ev => setEdit(c, { priority: Number(ev.target.value) })} />
                          </label>
                          <label className="block text-[10px] font-bold text-slate-600 space-y-1">Starts
                            <input className={field} disabled={closed} type="datetime-local" value={toLocalInput(e.startAt)} onChange={ev => setEdit(c, { startAt: fromLocalInput(ev.target.value) || e.startAt })} />
                          </label>
                          <label className="block text-[10px] font-bold text-slate-600 space-y-1">Ends
                            <input className={field} disabled={closed} type="datetime-local" value={toLocalInput(e.endAt)} onChange={ev => setEdit(c, { endAt: fromLocalInput(ev.target.value) || e.endAt })} />
                          </label>
                        </div>
                        <label className="block text-[10px] font-bold text-slate-600 space-y-1">Image description (for screen readers)
                          <input className={field} disabled={closed} value={e.content.imageAlt} maxLength={LIMITS.altChars} onChange={ev => setEdit(c, { content: { ...e.content, imageAlt: ev.target.value } })} />
                        </label>
                      </div>
                    </div>

                    {/* Checks */}
                    {c.policy.issues.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                        <strong>Cannot be published until fixed:</strong>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">{c.policy.issues.map(i => <li key={i}>{i}</li>)}</ul>
                      </div>
                    )}
                    {c.policy.reviewReasons.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                        <strong>Needs a person to approve (never published automatically):</strong>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">{c.policy.reviewReasons.map(i => <li key={i}>{i}</li>)}</ul>
                        {c.brandsMentioned.length > 0 && <p className="mt-1">Check that the copy and image do not suggest MutualPool is affiliated with, sponsored by or endorsed by any of these, and that the image copies none of their artwork, logos or characters.</p>}
                      </div>
                    )}
                    {c.policy.warnings.length > 0 && <p className="text-amber-800">{c.policy.warnings.join(' ')}</p>}
                    {c.imageError && <p className="text-rose-700">Last image attempt failed: {c.imageError}</p>}

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

                    {/* Concepts */}
                    <div>
                      <div className="font-bold text-slate-700 mb-1">Concepts ({c.concepts.length})</div>
                      <ul className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {c.concepts.map((concept, idx) => (
                          <li key={idx} className={`p-2.5 rounded-lg border ${idx === c.selectedConcept ? 'border-[#005FB8] bg-blue-50/60' : 'border-[#E2E8F0]'}`}>
                            <div className="font-bold text-slate-900">{concept.headline}</div>
                            <div className="text-slate-600 mt-0.5">{concept.description}</div>
                            <div className="text-[10px] text-slate-500 mt-1">{concept.targetAudience} · {HERO_SERVICE_LABELS[concept.service]} · {concept.suggestedDurationDays} days</div>
                            <div className="text-[10px] text-slate-500 italic">{concept.marketingAngle}</div>
                            {c.status === 'DRAFT' && idx !== c.selectedConcept && (
                              <button type="button" onClick={async () => { if (await call(`/api/admin/hero/campaigns/${c.id}`, 'PUT', { selectedConcept: idx }, 'Concept selected. Regenerate the image if it should match the new concept.')) clearEdit(c.id); }} className="mt-1.5 text-[11px] font-bold text-[#005FB8] hover:underline">
                                Use this concept
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Actions */}
                    {!closed && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button type="button" onClick={() => saveCampaign(c)} disabled={busy} className={`${btn} bg-slate-800 hover:bg-slate-900 text-white`}><Save className="w-3 h-3" /> Save changes</button>
                        <button type="button" onClick={() => call(`/api/admin/hero/campaigns/${c.id}/regenerate-image`, 'POST', {})} disabled={busy} className={`${btn} border border-[#DDE1E6] hover:bg-gray-50`}><ImageIcon className="w-3 h-3" /> Regenerate image</button>
                        {c.status === 'DRAFT' && (
                          <>
                            <button type="button" onClick={() => call(`/api/admin/hero/campaigns/${c.id}/regenerate-copy`, 'POST', {})} disabled={busy} className={`${btn} border border-[#DDE1E6] hover:bg-gray-50`}><Sparkles className="w-3 h-3" /> Regenerate copy</button>
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
      <h4 className="text-xs font-extrabold text-slate-800 mb-2">Discovered trends without a campaign ({openTrends.length})</h4>
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
