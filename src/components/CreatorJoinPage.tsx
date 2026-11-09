import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Bell, CheckCircle2, Circle, Landmark, Loader2, Lock, MapPin,
  ShieldCheck, Users, Wallet, AlertCircle, FileSignature, Info,
} from 'lucide-react';
import { Logo } from './Logo';
import { LanguageSelector } from './LanguageSelector';
import { useTranslation, type TranslationKey } from '../i18n';
import type { User } from '../types';

// Public page behind a creator's permanent link: themutualpool.com/c/<handle>.
// Shows the creator's open pool, walks a follower through every joining step
// (sign in, US, identity, bank authorization, balance, agreement) and takes
// their seat. See CREATOR_POOLS_SPEC.md sections 3-6.

interface CreatorJoinPageProps {
  handle: string;
  currentUser: User | null;
  onBack: () => void;
  onOpenAuth: (mode?: 'LOGIN' | 'REGISTER') => void;
  onOpenKyc: () => void;
  onOpenBank: () => void;
  onOpenAddFunds: () => void;
  onGoToMyPods: () => void;
  onUserUpdated?: (user: User) => void;
}

interface PublicView {
  creator: { handle: string; displayName: string; bio: string; avatarUrl: string; totalFollowers: number; accounts: { platform: string; handle: string; followers: number }[] };
  pool: null | {
    id: string; name: string; description: string; depositTier: number; podSize: number; potUsd: number; payoutUsd: number;
    creatorCommissionUsd: number; bufferContributionUsd: number; completedMembersOnly: boolean; creatorParticipates: boolean;
    enrollmentEndsAt: string; seatsTakenInCurrentPod: number; podsRunning: number; agreementVersion: string; agreementText: string;
  };
  viewer: {
    signedIn: boolean; isCreator?: boolean; inUS?: boolean; kycVerified?: boolean; hasDebitMandate?: boolean; restricted?: boolean;
    balanceUsd?: number; requiredUsd?: number; podLimit?: number; activeCreatorPods?: number; meetsCompletedRequirement?: boolean;
    onWaitlist?: boolean; myPods?: { id: string; name: string; status: string; members: number }[];
  };
}

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
const fmtCount = (n: number) => new Intl.NumberFormat('en-US', { notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);
const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };

export const CreatorJoinPage: React.FC<CreatorJoinPageProps> = ({
  handle, currentUser, onBack, onOpenAuth, onOpenKyc, onOpenBank, onOpenAddFunds, onGoToMyPods, onUserUpdated,
}) => {
  const { t } = useTranslation();
  const k = (key: string, params?: Record<string, string | number>) => t(key as TranslationKey, params);

  const [data, setData] = useState<PublicView | null>(null);
  const [loadError, setLoadError] = useState<'NOT_FOUND' | 'UNAVAILABLE' | 'FAILED' | null>(null);
  const [signature, setSignature] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [joining, setJoining] = useState(false);
  const [queue, setQueue] = useState<{ ticket: number; position: number } | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ podName: string; payoutWeek: number | null; held: boolean } | null>(null);
  const [waitEmail, setWaitEmail] = useState('');
  const [waitDone, setWaitDone] = useState(false);
  const retryRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/c/${encodeURIComponent(handle)}`);
      if (res.status === 404) { setLoadError('NOT_FOUND'); return; }
      if (res.status === 410) { setLoadError('UNAVAILABLE'); return; }
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
      setLoadError(null);
    } catch {
      setLoadError('FAILED');
    }
  }, [handle]);

  useEffect(() => { void load(); }, [load, currentUser?.id, currentUser?.kycStatus, currentUser?.debitMandate?.status, currentUser?.treasury?.balanceUsd]);
  useEffect(() => {
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);
  useEffect(() => () => { if (retryRef.current) window.clearTimeout(retryRef.current); }, []);
  useEffect(() => {
    if (!signature && currentUser?.displayName && currentUser.displayName !== 'Verified Member') setSignature(currentUser.displayName);
  }, [currentUser?.displayName]); // eslint-disable-line react-hooks/exhaustive-deps

  const pool = data?.pool || null;
  const v = data?.viewer;
  const balanceOk = Boolean(v?.signedIn && (v.balanceUsd || 0) >= (v.requiredUsd || 0));
  const limitOk = Boolean(v?.signedIn && (v.activeCreatorPods || 0) < (v.podLimit || 1));
  const steps = v?.signedIn ? [
    { key: 'us', ok: Boolean(v.inUS), icon: MapPin },
    { key: 'identity', ok: Boolean(v.kycVerified), icon: BadgeCheck, action: onOpenKyc },
    { key: 'bank', ok: Boolean(v.hasDebitMandate), icon: Landmark, action: onOpenBank },
    { key: 'balance', ok: balanceOk, icon: Wallet, action: onOpenAddFunds },
  ] : [];
  const allReady = Boolean(v?.signedIn && !v.isCreator && !v.restricted && v.meetsCompletedRequirement && limitOk && steps.every(s => s.ok));
  const canSign = allReady && accepted && signature.trim().length >= 2 && !joining;

  const join = async (ticket?: number) => {
    if (!pool) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/c/${encodeURIComponent(handle)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementAccepted: true, signatureName: signature.trim(), agreementVersion: pool.agreementVersion, ticket }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429 && body.error === 'QUEUED') {
        setQueue({ ticket: body.ticket, position: body.position });
        retryRef.current = window.setTimeout(() => { void join(body.ticket); }, (body.retryAfterSeconds || 5) * 1000);
        return;
      }
      setQueue(null);
      if (!res.ok) {
        if (body.error === 'KYC_REQUIRED') onOpenKyc();
        else if (body.error === 'DEBIT_MANDATE_REQUIRED') onOpenBank();
        else if (body.error === 'INSUFFICIENT_FUNDS') onOpenAddFunds();
        else if (body.error === 'AGREEMENT_CHANGED') void load();
        setJoinError(body.message || k('creatorJoin.joinFailed'));
        return;
      }
      if (body.user && onUserUpdated) onUserUpdated(body.user);
      setJoined({ podName: body.pod?.name || '', payoutWeek: body.payoutWeek ?? null, held: body.kind === 'HELD' });
      void load();
    } catch {
      setJoinError(k('creatorJoin.joinFailed'));
    } finally {
      setJoining(false);
    }
  };

  const joinWaitlist = async () => {
    const res = await fetch(`/api/c/${encodeURIComponent(handle)}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentUser ? {} : { email: waitEmail.trim() }),
    });
    if (res.ok) setWaitDone(true);
  };

  const card = 'rounded-2xl border border-[#DDE1E6] bg-white shadow-xs';
  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-[#DDE1E6] bg-white text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#005FB8]/30 focus:border-[#005FB8]';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827]">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#DDE1E6]">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <button type="button" onClick={onBack} aria-label={k('creatorJoin.backHome')}><Logo size="md" /></button>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button type="button" onClick={onBack} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DDE1E6] hover:bg-gray-50 text-xs font-semibold">
              <ArrowLeft className="w-3.5 h-3.5" /> {k('creatorJoin.backHome')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {!data && !loadError && (
          <div className="flex items-center justify-center py-24 text-[#005FB8]"><Loader2 className="w-6 h-6 animate-spin" /></div>
        )}
        {loadError && (
          <div className={`${card} p-8 text-center`}>
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <h1 className="mt-3 text-lg font-extrabold">{k(loadError === 'NOT_FOUND' ? 'creatorJoin.notFoundTitle' : loadError === 'UNAVAILABLE' ? 'creatorJoin.unavailableTitle' : 'creatorJoin.loadFailed')}</h1>
            <button type="button" onClick={onBack} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#005FB8] text-white font-bold text-sm">{k('creatorJoin.backHome')}</button>
          </div>
        )}

        {data && (
          <>
            {/* Creator */}
            <section className={`${card} p-5 sm:p-6`}>
              <div className="flex items-center gap-4">
                {data.creator.avatarUrl
                  ? <img src={data.creator.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-100" />
                  : <div className="w-14 h-14 rounded-full bg-blue-50 text-[#005FB8] flex items-center justify-center text-xl font-extrabold">{data.creator.displayName.slice(0, 1).toUpperCase()}</div>}
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-extrabold leading-tight truncate">{data.creator.displayName}</h1>
                  <div className="text-xs text-[#6B7280]">@{data.creator.handle} · {k('creatorJoin.followers', { count: fmtCount(data.creator.totalFollowers) })}</div>
                </div>
              </div>
              {data.creator.bio && <p className="mt-4 text-sm text-[#374151] leading-relaxed">{data.creator.bio}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {data.creator.accounts.map(a => (
                  <span key={a.platform} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-semibold text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {PLATFORM_LABEL[a.platform] || a.platform} · {fmtCount(a.followers)}
                  </span>
                ))}
              </div>
            </section>

            {!pool && (
              <section className={`${card} p-6 text-center`}>
                <Bell className="w-7 h-7 text-[#005FB8] mx-auto" />
                <h2 className="mt-2 text-lg font-extrabold">{k('creatorJoin.closedTitle')}</h2>
                <p className="mt-1 text-sm text-[#6B7280]">{k('creatorJoin.closedDesc', { name: data.creator.displayName })}</p>
                {waitDone || v?.onWaitlist ? (
                  <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="w-4 h-4" /> {k('creatorJoin.waitlistDone')}</p>
                ) : (
                  <div className="mt-4 flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
                    {!currentUser && (
                      <input type="email" value={waitEmail} onChange={e => setWaitEmail(e.target.value)} placeholder={k('creatorJoin.emailPlaceholder')} className={inputCls} />
                    )}
                    <button type="button" onClick={joinWaitlist} disabled={!currentUser && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waitEmail.trim())}
                      className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-sm">
                      <Bell className="w-4 h-4" /> {k('creatorJoin.notifyMe')}
                    </button>
                  </div>
                )}
              </section>
            )}

            {pool && (
              <>
                {/* Pool */}
                <section className={`${card} p-5 sm:p-6`}>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#005FB8]">{k('creatorJoin.openPool')}</div>
                  <h2 className="mt-1 text-xl font-extrabold">{pool.name}</h2>
                  {pool.description && <p className="mt-1 text-sm text-[#4B5563]">{pool.description}</p>}
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: k('creatorJoin.weeklyDeposit'), value: usd(pool.depositTier) },
                      { label: k('creatorJoin.podSize'), value: String(pool.podSize) },
                      { label: k('creatorJoin.weeklyPot'), value: usd(pool.potUsd) },
                      { label: k('creatorJoin.yourPayout'), value: usd(pool.payoutUsd) },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">{s.label}</div>
                        <div className="mt-0.5 text-lg font-extrabold tabular-nums">{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-[#374151]">
                    <li className="flex gap-2"><Info className="w-4 h-4 text-[#005FB8] shrink-0 mt-0.5" /><span>{k('creatorJoin.commissionDisclosure', { name: data.creator.displayName, amount: usd(pool.creatorCommissionUsd) })}</span></li>
                    <li className="flex gap-2"><Users className="w-4 h-4 text-[#005FB8] shrink-0 mt-0.5" /><span>{k('creatorJoin.seatsTaken', { taken: pool.seatsTakenInCurrentPod, size: pool.podSize })} {k('creatorJoin.payoutDrawn')}</span></li>
                    <li className="flex gap-2"><ShieldCheck className="w-4 h-4 text-[#005FB8] shrink-0 mt-0.5" /><span>{k('creatorJoin.bufferNote', { amount: usd(pool.bufferContributionUsd) })}</span></li>
                    {pool.completedMembersOnly && (
                      <li className="flex gap-2"><Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /><span>{k('creatorJoin.completedOnly')}</span></li>
                    )}
                    <li className="flex gap-2 text-[#6B7280]"><Bell className="w-4 h-4 shrink-0 mt-0.5" /><span>{k('creatorJoin.enrollmentEnds', { date: new Date(pool.enrollmentEndsAt).toLocaleDateString() })}</span></li>
                  </ul>
                </section>

                {joined ? (
                  <section className={`${card} p-6 text-center border-emerald-200 bg-emerald-50`}>
                    <CheckCircle2 className="w-9 h-9 text-emerald-600 mx-auto" />
                    <h2 className="mt-2 text-lg font-extrabold text-emerald-900">{k('creatorJoin.joinedTitle')}</h2>
                    <p className="mt-1 text-sm text-emerald-900">
                      {joined.held && joined.payoutWeek
                        ? k('creatorJoin.joinedHeld', { pod: joined.podName, week: joined.payoutWeek })
                        : k('creatorJoin.joinedForming', { pod: joined.podName })}
                    </p>
                    <button type="button" onClick={onGoToMyPods} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-sm">
                      {k('creatorJoin.goToMyPods')} <ArrowRight className="w-4 h-4" />
                    </button>
                  </section>
                ) : !v?.signedIn ? (
                  <section className={`${card} p-6 text-center`}>
                    <h2 className="text-lg font-extrabold">{k('creatorJoin.signInTitle')}</h2>
                    <p className="mt-1 text-sm text-[#6B7280]">{k('creatorJoin.signInDesc')}</p>
                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
                      <button type="button" onClick={() => onOpenAuth('REGISTER')} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-sm">{k('creatorJoin.createAccount')} <ArrowRight className="w-4 h-4" /></button>
                      <button type="button" onClick={() => onOpenAuth('LOGIN')} className="px-5 py-2.5 rounded-xl border border-[#DDE1E6] bg-white hover:bg-gray-50 font-semibold text-sm">{k('creatorJoin.signIn')}</button>
                    </div>
                  </section>
                ) : v.isCreator ? (
                  <section className={`${card} p-5 text-sm text-[#374151]`}>{k('creatorJoin.youHost')}</section>
                ) : (
                  <section className={`${card} p-5 sm:p-6 space-y-5`}>
                    {(v.myPods || []).length > 0 && (
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-[#005FB8] flex items-center justify-between gap-3">
                        <span>{k('creatorJoin.alreadyIn', { pod: v.myPods![0].name })}</span>
                        <button type="button" onClick={onGoToMyPods} className="shrink-0 font-bold underline">{k('creatorJoin.goToMyPods')}</button>
                      </div>
                    )}
                    <div>
                      <h2 className="text-base font-extrabold">{k('creatorJoin.stepsTitle')}</h2>
                      <ul className="mt-3 space-y-2">
                        {steps.map(s => (
                          <li key={s.key} className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${s.ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-[#E2E8F0] bg-white'}`}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              {s.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
                              <div className="min-w-0">
                                <div className="text-sm font-semibold">{k(`creatorJoin.step.${s.key}`)}</div>
                                {!s.ok && <div className="text-xs text-[#6B7280]">{k(`creatorJoin.step.${s.key}Help`, { amount: usd(v.requiredUsd || 0), balance: usd(v.balanceUsd || 0) })}</div>}
                              </div>
                            </div>
                            {!s.ok && s.action && (
                              <button type="button" onClick={s.action} className="shrink-0 px-3 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white text-xs font-bold">{k(`creatorJoin.step.${s.key}Action`)}</button>
                            )}
                          </li>
                        ))}
                      </ul>
                      {v.restricted && <p className="mt-3 text-sm text-rose-700">{k('creatorJoin.restricted')}</p>}
                      {!v.meetsCompletedRequirement && <p className="mt-3 text-sm text-amber-800">{k('creatorJoin.completedOnly')}</p>}
                      {!limitOk && <p className="mt-3 text-sm text-amber-800">{k(v.podLimit === 1 ? 'creatorJoin.limitNew' : 'creatorJoin.limitFull')}</p>}
                    </div>

                    <div>
                      <h2 className="text-base font-extrabold flex items-center gap-2"><FileSignature className="w-4 h-4 text-[#005FB8]" /> {k('creatorJoin.agreementTitle')}</h2>
                      <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-[#374151] p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">{pool.agreementText}</pre>
                      <label className="mt-3 block text-[11px] font-bold text-slate-600 uppercase tracking-wider" htmlFor="cj-signature">{k('creatorJoin.signatureLabel')}</label>
                      <input id="cj-signature" value={signature} onChange={e => setSignature(e.target.value)} maxLength={120} className={`${inputCls} mt-1`} />
                      <label className="mt-3 flex items-start gap-2 text-sm text-[#374151] cursor-pointer">
                        <input type="checkbox" className="accent-[#005FB8] mt-1" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
                        <span>{k('creatorJoin.acceptLabel')}</span>
                      </label>
                    </div>

                    {queue && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> {k('creatorJoin.queued', { position: queue.position })}
                      </div>
                    )}
                    {joinError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {joinError}</div>}

                    <button type="button" onClick={() => join()} disabled={!canSign || Boolean(queue)}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-sm">
                      {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {k('creatorJoin.takeSeat', { amount: usd(v.requiredUsd || 0) })}
                    </button>
                    <p className="text-[11px] text-center text-[#6B7280]">{k('creatorJoin.safety', { name: data.creator.displayName })}</p>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};
