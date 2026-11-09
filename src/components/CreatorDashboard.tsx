import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, BadgeCheck, CheckCircle2, Circle, Copy, Landmark, Loader2, Megaphone, MessageSquare, Send,
  Users, Wallet, AlertCircle, FileText, Link2, Lock, X, ChevronRight, ShieldAlert, PlayCircle,
} from 'lucide-react';
import { Logo } from './Logo';
import { LanguageSelector } from './LanguageSelector';
import { useTranslation, type TranslationKey } from '../i18n';
import { useChat } from '../context/ChatContext';
import type { User, CreatorProfile, CreatorPool } from '../types';

// The creator's side of Creator Pools (CREATOR_POOLS_SPEC.md sections 2, 3, 9
// and 11): profile and approval checklist, the permanent link, opening and
// closing pools, pods with missed-deposit names, announcements, earnings and
// the W-9.

interface CreatorDashboardProps {
  currentUser: User;
  onBack: () => void;
  onOpenKyc: () => void;
  onOpenBank: () => void;
  onOpenAddFunds: () => void;
}

type PoolSummary = CreatorPool & {
  link: string;
  podCounts: { forming: number; active: number; paused: number; completed: number; total: number };
  membersNow: number; openSlots: number; missedThisWeek: number; onTimeRateThisWeek: number | null;
  earningsUsd: number; enrollmentDaysLeft: number;
};

interface CreatorMe {
  profile: CreatorProfile | null;
  readiness: { followers: boolean; identity: boolean; bank: boolean; terms: boolean };
  ready: boolean;
  totalFollowers: number;
  followerCountsFresh: boolean;
  minFollowers: number;
  platforms: Record<string, boolean>;
  demoConnect: boolean;
  depositOptions: number[];
  isFirstPool: boolean;
  completedOnlyFromUsd: number;
  enrollmentDays: number;
  followerCap: number;
  pools: PoolSummary[];
  openPoolId: string | null;
  link: string | null;
  earningsUsd: number;
  taxForm: null | { legalName: string; tinType: string; tinLast4: string; signedAt: string; tinMatch: string };
  withdrawalHoldUsd: number;
  waitlistCount: number;
}

interface PodRow { id: string; name: string; poolSequence: number; status: string; members: number; currentCycleWeek: number; totalCycles: number; openSlots: number; missedThisWeek: number; pauseVoteOpen: boolean; earningsUsd: number }
interface PodDetail {
  id: string; name: string; status: string; currentCycleWeek: number; totalCycles: number; potUsd: number; earningsUsd: number;
  pauseVote: null | { status: string; closesAt: string };
  members: { userId: string; displayName: string; avatarUrl: string; slot: number | null; paid: boolean; missedDeposit: boolean; isCreator: boolean }[];
  openSlots: { slot: number }[];
  missed: { userId: string; displayName: string; cycleWeek: number; removed: boolean }[];
}

const PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const;
const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);

export const CreatorDashboard: React.FC<CreatorDashboardProps> = ({ currentUser, onBack, onOpenKyc, onOpenBank, onOpenAddFunds }) => {
  const { t } = useTranslation();
  const k = (key: string, params?: Record<string, string | number>) => t(key as TranslationKey, params);
  const { startDirectChat } = useChat();

  const [me, setMe] = useState<CreatorMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (path: string, body?: unknown, method = 'POST') => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === 'INSUFFICIENT_FUNDS') onOpenAddFunds();
        setError(data.message || k('creatorHub.requestFailed'));
        return null;
      }
      if (data && data.readiness) setMe(data);
      return data;
    } catch {
      setError(k('creatorHub.requestFailed'));
      return null;
    } finally {
      setBusy(false);
    }
  }, [onOpenAddFunds]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/creator/me');
      if (res.ok) setMe(await res.json());
    } catch { /* keep the last view */ }
  }, []);

  useEffect(() => { void load(); }, [load, currentUser.kycStatus, currentUser.debitMandate?.status]);
  useEffect(() => {
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('connected')) setNotice(k('creatorHub.connected', { platform: PLATFORM_LABEL[q.get('connected') || ''] || '' }));
    if (q.get('connect_error')) setError(k(q.get('connect_error') === 'account_in_use' ? 'creatorHub.connectInUse' : 'creatorHub.connectFailed'));
    if (q.get('connected') || q.get('connect_error')) window.history.replaceState({}, '', '/creator');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const card = 'rounded-2xl border border-[#DDE1E6] bg-white shadow-xs p-5 sm:p-6';
  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-[#DDE1E6] bg-white text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#005FB8]/30 focus:border-[#005FB8]';
  const labelCls = 'block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1';
  const btn = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-sm';
  const btnGhost = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#DDE1E6] bg-white hover:bg-gray-50 disabled:opacity-50 font-semibold text-sm';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827]">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#DDE1E6]">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} aria-label={k('creatorHub.back')}><Logo size="md" /></button>
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider text-[#005FB8]">{k('creatorHub.title')}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DDE1E6] hover:bg-gray-50 text-xs font-semibold">
              <ArrowLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{k('creatorHub.back')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-5">
        {notice && <Banner tone="ok" onClose={() => setNotice(null)}>{notice}</Banner>}
        {error && <Banner tone="error" onClose={() => setError(null)}>{error}</Banner>}
        {!me && <div className="flex justify-center py-24 text-[#005FB8]"><Loader2 className="w-6 h-6 animate-spin" /></div>}

        {me && !me.profile && <SetupProfile k={k} busy={busy} card={card} inputCls={inputCls} labelCls={labelCls} btn={btn} defaultName={currentUser.displayName}
          onSubmit={(body) => call('/api/creator/profile', body)} />}

        {me?.profile && me.profile.status === 'SUSPENDED' && (
          <Banner tone="error">{k('creatorHub.suspended', { reason: me.profile.suspendedReason || '' })}</Banner>
        )}

        {me?.profile && me.profile.status === 'PENDING' && (
          <Checklist k={k} me={me} busy={busy} card={card} inputCls={inputCls} btn={btn} btnGhost={btnGhost}
            onOpenKyc={onOpenKyc} onOpenBank={onOpenBank} call={call} setError={setError} />
        )}

        {me?.profile && me.profile.status !== 'PENDING' && (
          <>
            <LinkCard k={k} me={me} card={card} btnGhost={btnGhost} />
            <EarningsCard k={k} me={me} card={card} inputCls={inputCls} labelCls={labelCls} btn={btn} btnGhost={btnGhost} busy={busy} call={call} />
            {me.profile.status === 'APPROVED' && !me.openPoolId && (
              <OpenPool k={k} me={me} card={card} inputCls={inputCls} labelCls={labelCls} btn={btn} busy={busy} call={call} />
            )}
            {me.pools.map(pool => (
              <PoolCard key={pool.id} k={k} pool={pool} card={card} inputCls={inputCls} btn={btn} btnGhost={btnGhost} busy={busy} call={call}
                onMessage={(m) => startDirectChat({ id: m.userId, displayName: m.displayName, avatarUrl: m.avatarUrl })} />
            ))}
          </>
        )}
      </main>
    </div>
  );
};

type K = (key: string, params?: Record<string, string | number>) => string;
type Call = (path: string, body?: unknown, method?: string) => Promise<any>;

const Banner: React.FC<{ tone: 'ok' | 'error'; onClose?: () => void; children: React.ReactNode }> = ({ tone, onClose, children }) => (
  <div className={`p-3 rounded-xl border text-sm flex items-start gap-2 ${tone === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
    {tone === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
    <div className="flex-1">{children}</div>
    {onClose && <button type="button" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>}
  </div>
);

const SetupProfile: React.FC<{ k: K; busy: boolean; card: string; inputCls: string; labelCls: string; btn: string; defaultName: string; onSubmit: (b: unknown) => void }> = ({ k, busy, card, inputCls, labelCls, btn, defaultName, onSubmit }) => {
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState(defaultName && defaultName !== 'Verified Member' ? defaultName : '');
  const [bio, setBio] = useState('');
  return (
    <section className={card}>
      <h1 className="text-xl font-extrabold">{k('creatorHub.setupTitle')}</h1>
      <p className="mt-1 text-sm text-[#6B7280]">{k('creatorHub.setupDesc')}</p>
      <form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); onSubmit({ handle, displayName, bio }); }}>
        <div>
          <label className={labelCls} htmlFor="ch-handle">{k('creatorHub.handleLabel')}</label>
          <div className="flex items-center rounded-xl border border-[#DDE1E6] bg-white focus-within:ring-2 focus-within:ring-[#005FB8]/30 overflow-hidden">
            <span className="pl-3 text-sm text-[#6B7280] whitespace-nowrap">themutualpool.com/c/</span>
            <input id="ch-handle" required value={handle} onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} maxLength={30}
              className="flex-1 min-w-0 px-1 py-2.5 text-sm focus:outline-none" placeholder="yourname" />
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">{k('creatorHub.handleHelp')}</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="ch-name">{k('creatorHub.displayNameLabel')}</label>
          <input id="ch-name" required minLength={2} maxLength={60} value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="ch-bio">{k('creatorHub.bioLabel')}</label>
          <textarea id="ch-bio" rows={2} maxLength={300} value={bio} onChange={e => setBio(e.target.value)} className={inputCls} />
        </div>
        <button type="submit" disabled={busy || handle.length < 3 || displayName.trim().length < 2} className={btn}>{k('creatorHub.setupSubmit')}</button>
      </form>
    </section>
  );
};

const Checklist: React.FC<{ k: K; me: CreatorMe; busy: boolean; card: string; inputCls: string; btn: string; btnGhost: string; onOpenKyc: () => void; onOpenBank: () => void; call: Call; setError: (e: string | null) => void }> = ({ k, me, busy, card, inputCls, btn, btnGhost, onOpenKyc, onOpenBank, call, setError }) => {
  const [termsChecked, setTermsChecked] = useState(false);
  const [demo, setDemo] = useState<Record<string, { handle: string; followers: string }>>({});
  const connect = async (platform: string) => {
    const res = await fetch(`/api/creator/connect/${platform}/start`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) window.location.href = data.url;
    else setError(data.message || k('creatorHub.connectFailed'));
  };
  const Step: React.FC<{ ok: boolean; title: string; desc: string; children?: React.ReactNode }> = ({ ok, title, desc, children }) => (
    <li className={`p-4 rounded-xl border ${ok ? 'border-emerald-200 bg-emerald-50/50' : 'border-[#E2E8F0] bg-white'}`}>
      <div className="flex items-start gap-3">
        {ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">{title}</div>
          <div className="text-xs text-[#6B7280] mt-0.5">{desc}</div>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </li>
  );
  const p = me.profile!;
  return (
    <section className={card}>
      <h1 className="text-xl font-extrabold">{k('creatorHub.checklistTitle')}</h1>
      <p className="mt-1 text-sm text-[#6B7280]">{k('creatorHub.checklistDesc')}</p>
      <ul className="mt-5 space-y-3">
        <Step ok={me.readiness.followers} title={k('creatorHub.stepFollowers', { min: me.minFollowers.toLocaleString() })} desc={k('creatorHub.stepFollowersDesc', { total: me.totalFollowers.toLocaleString() })}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PLATFORMS.map(pl => {
              const acct = p.accounts.find(a => a.platform === pl);
              return (
                <div key={pl} className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                  <div className="text-xs font-bold">{PLATFORM_LABEL[pl]}</div>
                  {acct
                    ? <div className="text-xs text-emerald-700 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> @{acct.handle} · {acct.followers.toLocaleString()}</div>
                    : <div className="text-xs text-[#6B7280] mt-1">{k('creatorHub.notConnected')}</div>}
                  {me.platforms[pl] && (
                    <button type="button" onClick={() => connect(pl)} className={`${btnGhost} mt-2 w-full !py-1.5 !text-xs`}>{acct ? k('creatorHub.refresh') : k('creatorHub.connect')}</button>
                  )}
                  {!me.platforms[pl] && !me.demoConnect && <div className="text-[11px] text-[#6B7280] mt-2">{k('creatorHub.platformUnavailable')}</div>}
                  {me.demoConnect && !me.platforms[pl] && (
                    <div className="mt-2 space-y-1.5">
                      <input placeholder="@handle" value={demo[pl]?.handle || ''} onChange={e => setDemo(d => ({ ...d, [pl]: { ...d[pl], handle: e.target.value } }))} className={`${inputCls} !py-1.5 !text-xs`} />
                      <input placeholder={k('creatorHub.followersPlaceholder')} inputMode="numeric" value={demo[pl]?.followers || ''} onChange={e => setDemo(d => ({ ...d, [pl]: { ...d[pl], followers: e.target.value } }))} className={`${inputCls} !py-1.5 !text-xs`} />
                      <button type="button" disabled={busy} onClick={() => call(`/api/creator/connect/${pl}/demo`, { handle: demo[pl]?.handle, followers: Number(demo[pl]?.followers) || 0 })} className={`${btnGhost} w-full !py-1.5 !text-xs`}>{k('creatorHub.demoConnect')}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Step>
        <Step ok={me.readiness.identity} title={k('creatorHub.stepIdentity')} desc={k('creatorHub.stepIdentityDesc')}>
          {!me.readiness.identity && <button type="button" onClick={onOpenKyc} className={btn}><BadgeCheck className="w-4 h-4" /> {k('creatorHub.verifyIdentity')}</button>}
        </Step>
        <Step ok={me.readiness.bank} title={k('creatorHub.stepBank')} desc={k('creatorHub.stepBankDesc')}>
          {!me.readiness.bank && <button type="button" onClick={onOpenBank} className={btn}><Landmark className="w-4 h-4" /> {k('creatorHub.linkBank')}</button>}
        </Step>
        <Step ok={me.readiness.terms} title={k('creatorHub.stepTerms')} desc={k('creatorHub.stepTermsDesc')}>
          {!me.readiness.terms && (
            <>
              <ul className="space-y-1.5 text-sm text-[#374151] list-disc pl-5">
                {[1, 2, 3, 4, 5].map(n => <li key={n}>{k(`creatorHub.term${n}`)}</li>)}
              </ul>
              <label className="mt-3 flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="accent-[#005FB8] mt-1" checked={termsChecked} onChange={e => setTermsChecked(e.target.checked)} />
                <span>{k('creatorHub.acceptTerms')}</span>
              </label>
              <button type="button" disabled={busy || !termsChecked} onClick={() => call('/api/creator/profile', { acceptTerms: true })} className={`${btn} mt-3`}>{k('creatorHub.acceptTermsButton')}</button>
            </>
          )}
        </Step>
      </ul>
    </section>
  );
};

const copy = async (text: string, done: () => void) => {
  try { await navigator.clipboard.writeText(text); done(); } catch { /* clipboard unavailable */ }
};

const LinkCard: React.FC<{ k: K; me: CreatorMe; card: string; btnGhost: string }> = ({ k, me, card, btnGhost }) => {
  const [copied, setCopied] = useState<'link' | 'disclosure' | null>(null);
  const disclosure = k('creatorHub.disclosureText', { link: me.link || '' });
  const flash = (what: 'link' | 'disclosure') => { setCopied(what); window.setTimeout(() => setCopied(null), 1500); };
  return (
    <section className={card}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#005FB8]"><Link2 className="w-4 h-4" /> {k('creatorHub.linkTitle')}</div>
      <div className="mt-2 flex flex-col sm:flex-row gap-2">
        <code className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-semibold truncate">{me.link}</code>
        <button type="button" className={btnGhost} onClick={() => copy(me.link || '', () => flash('link'))}><Copy className="w-4 h-4" /> {copied === 'link' ? k('creatorHub.copied') : k('creatorHub.copyLink')}</button>
      </div>
      <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
        <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> {k('creatorHub.disclosureTitle')}</div>
        <p className="mt-1 text-xs text-amber-900">{k('creatorHub.disclosureDesc')}</p>
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <p className="flex-1 text-sm bg-white rounded-lg border border-amber-200 px-3 py-2">{disclosure}</p>
          <button type="button" className={btnGhost} onClick={() => copy(disclosure, () => flash('disclosure'))}><Copy className="w-4 h-4" /> {copied === 'disclosure' ? k('creatorHub.copied') : k('creatorHub.copy')}</button>
        </div>
      </div>
      {me.waitlistCount > 0 && <p className="mt-3 text-xs text-[#6B7280]">{k('creatorHub.waitlistCount', { count: me.waitlistCount })}</p>}
    </section>
  );
};

const EarningsCard: React.FC<{ k: K; me: CreatorMe; card: string; inputCls: string; labelCls: string; btn: string; btnGhost: string; busy: boolean; call: Call }> = ({ k, me, card, inputCls, labelCls, btn, btnGhost, busy, call }) => {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ legalName: '', businessName: '', taxClassification: 'INDIVIDUAL', tinType: 'SSN', tin: '', line1: '', line2: '', city: '', state: '', postalCode: '', signatureName: '', certify: false });
  const set = (key: keyof typeof f, value: string | boolean) => setF(prev => ({ ...prev, [key]: value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await call('/api/creator/tax-form', {
      legalName: f.legalName, businessName: f.businessName, taxClassification: f.taxClassification, tinType: f.tinType, tin: f.tin,
      address: { line1: f.line1, line2: f.line2, city: f.city, state: f.state, postalCode: f.postalCode },
      signatureName: f.signatureName, certify: f.certify,
    });
    if (r) { setOpen(false); setF(prev => ({ ...prev, tin: '' })); }
  };
  return (
    <section className={card}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#005FB8]"><Wallet className="w-4 h-4" /> {k('creatorHub.earningsTitle')}</div>
          <div className="mt-1 text-3xl font-extrabold tabular-nums">{usd(me.earningsUsd)}</div>
          <p className="text-xs text-[#6B7280]">{k('creatorHub.earningsDesc')}</p>
        </div>
        <div className="sm:text-right">
          {me.taxForm ? (
            <div className="text-sm">
              <div className="font-semibold text-emerald-700 flex sm:justify-end items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {k('creatorHub.w9OnFile')}</div>
              <div className="text-xs text-[#6B7280]">{me.taxForm.legalName} · {me.taxForm.tinType} ••• {me.taxForm.tinLast4}</div>
              {me.taxForm.tinMatch === 'MISMATCH' && <div className="text-xs text-rose-700">{k('creatorHub.w9Mismatch')}</div>}
            </div>
          ) : (
            <div className="text-sm text-amber-800 max-w-xs">{k('creatorHub.w9Needed')}</div>
          )}
          <button type="button" className={`${me.taxForm ? btnGhost : btn} mt-2`} onClick={() => setOpen(o => !o)}><FileText className="w-4 h-4" /> {me.taxForm ? k('creatorHub.w9Update') : k('creatorHub.w9Add')}</button>
        </div>
      </div>
      {open && (
        <form onSubmit={submit} className="mt-5 pt-5 border-t border-[#E2E8F0] space-y-4">
          <p className="text-xs text-[#6B7280] flex items-start gap-1.5"><Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {k('creatorHub.w9Privacy')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>{k('creatorHub.w9LegalName')}</label><input required value={f.legalName} onChange={e => set('legalName', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>{k('creatorHub.w9BusinessName')}</label><input value={f.businessName} onChange={e => set('businessName', e.target.value)} className={inputCls} /></div>
            <div>
              <label className={labelCls}>{k('creatorHub.w9Classification')}</label>
              <select value={f.taxClassification} onChange={e => set('taxClassification', e.target.value)} className={inputCls}>
                {['INDIVIDUAL', 'SOLE_PROPRIETOR', 'SINGLE_MEMBER_LLC', 'LLC', 'C_CORPORATION', 'S_CORPORATION', 'PARTNERSHIP', 'OTHER'].map(c => <option key={c} value={c}>{k(`creatorHub.class.${c}`)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{k('creatorHub.w9Tin')}</label>
              <div className="flex gap-2">
                <select value={f.tinType} onChange={e => set('tinType', e.target.value)} className={`${inputCls} !w-24`}><option value="SSN">SSN</option><option value="EIN">EIN</option></select>
                <input required inputMode="numeric" autoComplete="off" value={f.tin} onChange={e => set('tin', e.target.value)} className={inputCls} placeholder={f.tinType === 'SSN' ? '123-45-6789' : '12-3456789'} />
              </div>
            </div>
            <div className="sm:col-span-2"><label className={labelCls}>{k('creatorHub.w9Address')}</label><input required value={f.line1} onChange={e => set('line1', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>{k('creatorHub.w9City')}</label><input required value={f.city} onChange={e => set('city', e.target.value)} className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>{k('creatorHub.w9State')}</label><input required maxLength={2} value={f.state} onChange={e => set('state', e.target.value.toUpperCase())} className={inputCls} /></div>
              <div><label className={labelCls}>{k('creatorHub.w9Zip')}</label><input required value={f.postalCode} onChange={e => set('postalCode', e.target.value)} className={inputCls} /></div>
            </div>
          </div>
          <label className="flex items-start gap-2 text-xs text-[#374151] cursor-pointer">
            <input type="checkbox" className="accent-[#005FB8] mt-0.5" checked={f.certify} onChange={e => set('certify', e.target.checked)} />
            <span>{k('creatorHub.w9Certify')}</span>
          </label>
          <div><label className={labelCls}>{k('creatorHub.w9Signature')}</label><input required value={f.signatureName} onChange={e => set('signatureName', e.target.value)} className={inputCls} /></div>
          <button type="submit" disabled={busy || !f.certify} className={btn}>{k('creatorHub.w9Submit')}</button>
        </form>
      )}
    </section>
  );
};

const OpenPool: React.FC<{ k: K; me: CreatorMe; card: string; inputCls: string; labelCls: string; btn: string; busy: boolean; call: Call }> = ({ k, me, card, inputCls, labelCls, btn, busy, call }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deposit, setDeposit] = useState<number>(me.depositOptions.includes(50) ? 50 : me.depositOptions[0]);
  const [participates, setParticipates] = useState(false);
  const pot = deposit * 20;
  return (
    <section className={card}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#005FB8]"><PlayCircle className="w-4 h-4" /> {k('creatorHub.openTitle')}</div>
      <p className="mt-1 text-sm text-[#6B7280]">{k('creatorHub.openDesc', { weeks: Math.round(me.enrollmentDays / 7), cap: me.followerCap.toLocaleString() })}</p>
      {!me.followerCountsFresh && <div className="mt-3"><Banner tone="error">{k('creatorHub.followersStale')}</Banner></div>}
      <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); void call('/api/creator/pools', { name, description, depositTier: deposit, creatorParticipates: participates }); }}>
        <div><label className={labelCls}>{k('creatorHub.poolName')}</label><input required minLength={3} maxLength={60} value={name} onChange={e => setName(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>{k('creatorHub.poolDescription')}</label><textarea rows={2} maxLength={500} value={description} onChange={e => setDescription(e.target.value)} className={inputCls} /></div>
        <div>
          <span className={labelCls}>{k('creatorHub.weeklyDeposit')}</span>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {me.depositOptions.map(d => (
              <button key={d} type="button" onClick={() => setDeposit(d)}
                className={`py-2 rounded-lg border text-xs font-bold ${deposit === d ? 'border-[#005FB8] bg-blue-50 text-[#005FB8]' : 'border-[#DDE1E6] bg-white text-slate-700'}`}>${d}</button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#6B7280]">
            {k('creatorHub.depositSummary', { pot: usd(pot), earn: usd(pot * 0.03) })}
            {me.isFirstPool ? ` ${k('creatorHub.firstPoolNote')}` : deposit >= me.completedOnlyFromUsd ? ` ${k('creatorHub.completedOnlyNote')}` : ''}
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="accent-[#005FB8] mt-1" checked={participates} onChange={e => setParticipates(e.target.checked)} />
          <span>{k('creatorHub.participate', { amount: usd(deposit * 1.05) })}</span>
        </label>
        <button type="submit" disabled={busy || name.trim().length < 3 || !me.followerCountsFresh} className={btn}>{k('creatorHub.openButton')}</button>
      </form>
    </section>
  );
};

const PoolCard: React.FC<{ k: K; pool: PoolSummary; card: string; inputCls: string; btn: string; btnGhost: string; busy: boolean; call: Call; onMessage: (m: { userId: string; displayName: string; avatarUrl: string }) => void }> = ({ k, pool, card, inputCls, btn, btnGhost, busy, call, onMessage }) => {
  const [pods, setPods] = useState<PodRow[] | null>(null);
  const [expanded, setExpanded] = useState(pool.status === 'OPEN');
  const [detail, setDetail] = useState<PodDetail | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const loadPods = useCallback(async () => {
    const res = await fetch(`/api/creator/pools/${pool.id}`);
    if (res.ok) setPods((await res.json()).pods);
  }, [pool.id]);
  useEffect(() => { if (expanded) void loadPods(); }, [expanded, loadPods, pool.updatedAt]);

  const openPod = async (id: string) => {
    const res = await fetch(`/api/creator/pods/${id}`);
    if (res.ok) setDetail(await res.json());
  };
  const announce = async () => {
    const r = await call(`/api/creator/pools/${pool.id}/announce`, { message: announcement });
    if (r?.success) { setSent(k('creatorHub.announcementSent', { count: r.pods })); setAnnouncement(''); }
  };

  const stat = (label: string, value: string | number) => (
    <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">{label}</div>
      <div className="mt-0.5 text-lg font-extrabold tabular-nums">{value}</div>
    </div>
  );
  const statusTone = pool.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : pool.status === 'SUSPENDED' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700';

  return (
    <section className={card}>
      <button type="button" onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusTone}`}>{k(`creatorHub.status.${pool.status}`)}</span>
            <span className="text-xs text-[#6B7280]">{usd(pool.depositTier)}/{k('creatorHub.week')}</span>
          </div>
          <h2 className="mt-1 text-lg font-extrabold truncate">{pool.name}</h2>
        </div>
        <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stat(k('creatorHub.statSeated'), `${pool.seatedCount.toLocaleString()} / ${pool.followerCap.toLocaleString()}`)}
            {stat(k('creatorHub.statPods'), `${pool.podCounts.active} ${k('creatorHub.running')} · ${pool.podCounts.forming} ${k('creatorHub.forming')}`)}
            {stat(k('creatorHub.statOnTime'), pool.onTimeRateThisWeek === null ? '—' : `${pool.onTimeRateThisWeek}%`)}
            {stat(k('creatorHub.statEarned'), usd(pool.earningsUsd))}
          </div>
          <p className="text-xs text-[#6B7280]">
            {pool.status === 'OPEN' ? k('creatorHub.daysLeft', { days: pool.enrollmentDaysLeft }) : ''}
            {pool.missedThisWeek > 0 ? ` ${k('creatorHub.missedThisWeek', { count: pool.missedThisWeek })}` : ''}
            {pool.openSlots > 0 ? ` ${k('creatorHub.openSlotsCount', { count: pool.openSlots })}` : ''}
          </p>

          {pool.status !== 'COMPLETED' && pool.status !== 'SUSPENDED' && (
            <div className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="text-sm font-bold flex items-center gap-2"><Megaphone className="w-4 h-4 text-[#005FB8]" /> {k('creatorHub.announceTitle')}</div>
              <p className="text-xs text-[#6B7280] mt-0.5">{k('creatorHub.announceDesc')}</p>
              <textarea rows={2} maxLength={1000} value={announcement} onChange={e => setAnnouncement(e.target.value)} className={`${inputCls} mt-2`} />
              <div className="mt-2 flex items-center gap-3">
                <button type="button" disabled={busy || announcement.trim().length < 2} onClick={announce} className={btn}><Send className="w-4 h-4" /> {k('creatorHub.announceButton')}</button>
                {sent && <span className="text-xs text-emerald-700">{sent}</span>}
              </div>
            </div>
          )}

          <div>
            <div className="text-sm font-bold mb-2">{k('creatorHub.podsTitle')}</div>
            {!pods && <Loader2 className="w-4 h-4 animate-spin text-[#005FB8]" />}
            {pods && pods.length === 0 && <p className="text-sm text-[#6B7280]">{k('creatorHub.noPods')}</p>}
            {pods && pods.length > 0 && (
              <ul className="divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0] overflow-hidden">
                {pods.map(p => (
                  <li key={p.id}>
                    <button type="button" onClick={() => openPod(p.id)} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-white hover:bg-[#F8FAFC] text-left">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{k('creatorHub.podN', { n: p.poolSequence })}</div>
                        <div className="text-xs text-[#6B7280]">
                          {p.status === 'FORMING' ? k('creatorHub.podForming', { members: p.members }) : p.status === 'COMPLETED' ? k('creatorHub.podCompleted') : k('creatorHub.podWeek', { week: p.currentCycleWeek, total: p.totalCycles, members: p.members })}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.missedThisWeek > 0 && <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">{k('creatorHub.missedBadge', { count: p.missedThisWeek })}</span>}
                        {p.pauseVoteOpen && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">{k('creatorHub.voteBadge')}</span>}
                        {p.openSlots > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#005FB8] text-[10px] font-bold">{k('creatorHub.openSlotBadge', { count: p.openSlots })}</span>}
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {pool.status === 'OPEN' && (
            confirmClose ? (
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900">
                <p>{k('creatorHub.closeConfirm')}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={busy} onClick={() => call(`/api/creator/pools/${pool.id}/close`)} className={btn}>{k('creatorHub.closeYes')}</button>
                  <button type="button" onClick={() => setConfirmClose(false)} className={btnGhost}>{k('creatorHub.cancel')}</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmClose(true)} className={btnGhost}><Lock className="w-4 h-4" /> {k('creatorHub.closeEnrollment')}</button>
            )
          )}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setDetail(null)}>
          <div className="bg-white w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold">{detail.name}</h3>
                <p className="text-xs text-[#6B7280]">
                  {detail.status === 'FORMING' ? k('creatorHub.podForming', { members: detail.members.length }) : k('creatorHub.podWeek', { week: detail.currentCycleWeek, total: detail.totalCycles, members: detail.members.length })}
                  {' · '}{k('creatorHub.podEarned', { amount: usd(detail.earningsUsd) })}
                </p>
              </div>
              <button type="button" onClick={() => setDetail(null)} aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            {detail.pauseVote?.status === 'OPEN' && <div className="mt-3"><Banner tone="error">{k('creatorHub.voteOpen', { date: new Date(detail.pauseVote.closesAt).toLocaleString() })}</Banner></div>}
            {detail.missed.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-rose-700">{k('creatorHub.missedTitle')}</div>
                <ul className="mt-1 space-y-1">
                  {detail.missed.map(m => (
                    <li key={`${m.userId}_${m.cycleWeek}`} className="text-sm flex items-center justify-between gap-2">
                      <span>{m.displayName} · {k('creatorHub.missedWeek', { week: m.cycleWeek })}{m.removed ? ` · ${k('creatorHub.removed')}` : ''}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-[#6B7280]">{k('creatorHub.missedPrivacy')}</p>
              </div>
            )}
            <div className="mt-4 text-xs font-bold uppercase tracking-wider text-[#6B7280]">{k('creatorHub.membersTitle')}</div>
            <ul className="mt-1 divide-y divide-[#E2E8F0]">
              {detail.members.map(m => (
                <li key={m.userId} className="py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded bg-slate-100 text-slate-700 font-mono text-xs font-bold flex items-center justify-center shrink-0">{m.slot ? `#${m.slot}` : '—'}</span>
                    <span className="text-sm font-semibold truncate">{m.displayName}</span>
                    {m.paid && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#005FB8] text-[10px] font-bold">{k('creatorHub.paid')}</span>}
                    {m.missedDeposit && <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">{k('creatorHub.missed')}</span>}
                  </div>
                  {!m.isCreator && (
                    <button type="button" onClick={() => onMessage(m)} className="shrink-0 p-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 text-slate-600 hover:text-[#005FB8]" title={k('creatorHub.message')}>
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
              {detail.openSlots.map(s => (
                <li key={`open_${s.slot}`} className="py-2 flex items-center gap-2 text-sm text-[#6B7280]">
                  <span className="w-7 h-7 rounded bg-blue-50 text-[#005FB8] font-mono text-xs font-bold flex items-center justify-center">#{s.slot}</span>
                  {k('creatorHub.openSlot')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
