import React, { useState } from 'react';
import {
  ArrowLeft, ArrowRight, Link2, Users, BadgeCheck, Wallet, ShieldCheck, Shuffle, PiggyBank, BellRing,
  CheckCircle2, AlertCircle, Send, Megaphone, Calculator, Clapperboard,
} from 'lucide-react';
import { Logo } from './Logo';
import { LanguageSelector } from './LanguageSelector';
import { useTranslation, type TranslationKey } from '../i18n';
import { FEES } from '../lib/legal';

interface CreatorsPageProps {
  onBack: () => void;
}

// Creator Pools (see CREATOR_POOLS_SPEC.md): pods of 20, $10–$60 a week in a
// creator's first pool, a 20-week cycle, 3% of each weekly pot to the creator.
const POD_SIZE = 20;
const FIRST_POOL_DEPOSITS = [10, 20, 30, 40, 50, 60] as const;
const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'other'] as const;

const usd = (n: number, cents = false) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0 }).format(n);

export const CreatorsPage: React.FC<CreatorsPageProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const k = (key: string, params?: Record<string, string | number>) => t(key as TranslationKey, params);

  // Earnings estimate
  const [followers, setFollowers] = useState('1000');
  const [deposit, setDeposit] = useState<number>(50);
  const joined = Math.max(0, Math.min(Math.floor(Number(followers) || 0), 10_000_000));
  const fullPods = Math.floor(joined / POD_SIZE);
  const weekly = fullPods * POD_SIZE * deposit * FEES.hostRewardRate;
  const perCycle = weekly * POD_SIZE;
  const perPodWeekly = POD_SIZE * deposit * FEES.hostRewardRate;

  // Early-access form
  const [form, setForm] = useState({
    name: '', email: '', handle: '', platforms: ['instagram'] as string[], followers: '', niche: '', inUS: true, notes: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <F extends keyof typeof form>(field: F, value: (typeof form)[F]) => setForm(f => ({ ...f, [field]: value }));
  const togglePlatform = (p: string) =>
    set('platforms', form.platforms.includes(p) ? form.platforms.filter(x => x !== p) : [...form.platforms, p]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setError(null);
    try {
      const res = await fetch('/api/creators/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, followers: Number(form.followers) || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || data.message || 'failed');
      setSent(true);
    } catch {
      setError(k('creators.form.error'));
    } finally {
      setSending(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-[#DDE1E6] bg-white text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#005FB8]/30 focus:border-[#005FB8]';
  const labelCls = 'block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1';

  const steps = [
    { n: 1, icon: BadgeCheck },
    { n: 2, icon: Link2 },
    { n: 3, icon: Users },
    { n: 4, icon: Wallet },
  ];
  const protections = [
    { n: 1, icon: Shuffle, color: 'text-[#005FB8] bg-blue-50' },
    { n: 2, icon: PiggyBank, color: 'text-emerald-700 bg-emerald-50' },
    { n: 3, icon: BellRing, color: 'text-amber-700 bg-amber-50' },
    { n: 4, icon: ShieldCheck, color: 'text-purple-700 bg-purple-50' },
  ];

  return (
    <div className="min-h-screen bg-white text-[#111827]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#DDE1E6]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button type="button" onClick={onBack} className="flex items-center gap-3 group" aria-label={k('creators.backToSite')}>
            <Logo size="md" />
          </button>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button type="button" onClick={onBack} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DDE1E6] hover:bg-gray-50 text-xs font-semibold">
              <ArrowLeft className="w-3.5 h-3.5" /> {k('creators.backToSite')}
            </button>
            <a href="#creator-form" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white text-xs font-bold">
              {k('creators.applyCta')} <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50/70 to-white border-b border-[#DDE1E6]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-blue-200 text-[#005FB8] text-[11px] font-bold uppercase tracking-wider">
            <Clapperboard className="w-3.5 h-3.5" /> {k('creators.badge')}
          </span>
          <h1 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight max-w-3xl mx-auto">{k('creators.heroTitle')}</h1>
          <p className="mt-5 text-base sm:text-lg text-[#4B5563] max-w-2xl mx-auto leading-relaxed">{k('creators.heroSubtitle')}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="#creator-form" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-sm shadow-sm">
              {k('creators.applyCta')} <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#creator-earnings" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#DDE1E6] bg-white hover:bg-gray-50 font-semibold text-sm">
              <Calculator className="w-4 h-4 text-[#005FB8]" /> {k('creators.heroSecondary')}
            </a>
          </div>
          <p className="mt-4 text-xs text-[#6B7280]">{k('creators.heroNote')}</p>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="text-2xl font-extrabold text-center">{k('creators.howTitle')}</h2>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map(({ n, icon: Icon }) => (
            <div key={n} className="p-5 rounded-2xl border border-[#DDE1E6] bg-white shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[#005FB8] bg-blue-50"><Icon className="w-5 h-5" /></div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#005FB8]">{k('creators.stepLabel', { n })}</span>
              </div>
              <h3 className="mt-3 font-bold text-sm">{k(`creators.how${n}Title`)}</h3>
              <p className="mt-1.5 text-xs text-[#4B5563] leading-relaxed">{k(`creators.how${n}Desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Earnings estimate */}
      <section id="creator-earnings" className="bg-[#F8FAFC] border-y border-[#DDE1E6] scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-extrabold">{k('creators.earnTitle')}</h2>
            <p className="mt-2 text-sm text-[#4B5563] leading-relaxed">{k('creators.earnDesc')}</p>
            <p className="mt-3 text-sm font-semibold text-[#111827]">
              {k('creators.earnPerPod', { deposit: usd(deposit), pot: usd(POD_SIZE * deposit), earn: usd(perPodWeekly, true) })}
            </p>
          </div>
          <div className="lg:col-span-3 p-5 sm:p-6 rounded-2xl bg-white border border-[#DDE1E6] shadow-xs space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls} htmlFor="creator-calc-followers">{k('creators.calc.followers')}</label>
                <input
                  id="creator-calc-followers"
                  type="number" min={0} step={20} inputMode="numeric"
                  className={inputCls}
                  value={followers}
                  onChange={e => setFollowers(e.target.value)}
                />
              </div>
              <div>
                <span className={labelCls}>{k('creators.calc.deposit')}</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {FIRST_POOL_DEPOSITS.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDeposit(d)}
                      className={`py-2 rounded-lg border text-xs font-bold transition-colors ${deposit === d ? 'border-[#005FB8] bg-blue-50 text-[#005FB8]' : 'border-[#DDE1E6] bg-white text-slate-700 hover:border-slate-300'}`}
                    >
                      {usd(d)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="p-2.5 sm:p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">{k('creators.calc.pods')}</div>
                <div className="mt-1 text-base sm:text-2xl font-extrabold tabular-nums">{fullPods.toLocaleString('en-US')}</div>
              </div>
              <div className="p-2.5 sm:p-4 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#005FB8]">{k('creators.calc.weekly')}</div>
                <div className="mt-1 text-base sm:text-2xl font-extrabold tabular-nums text-[#005FB8]">{usd(weekly)}</div>
              </div>
              <div className="p-2.5 sm:p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">{k('creators.calc.cycle')}</div>
                <div className="mt-1 text-base sm:text-2xl font-extrabold tabular-nums">{usd(perCycle)}</div>
              </div>
            </div>
            <p className="text-[11px] text-[#6B7280] leading-relaxed">{k('creators.calc.disclaimer')}</p>
          </div>
        </div>
      </section>

      {/* Protections for followers */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="text-2xl font-extrabold text-center">{k('creators.protectTitle')}</h2>
        <p className="mt-2 text-sm text-[#6B7280] text-center max-w-2xl mx-auto">{k('creators.protectSubtitle')}</p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {protections.map(({ n, icon: Icon, color }) => (
            <div key={n} className="p-5 rounded-2xl border border-[#DDE1E6] bg-white shadow-xs">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-5 h-5" /></div>
              <h3 className="mt-3 font-bold text-sm">{k(`creators.protect${n}Title`)}</h3>
              <p className="mt-1.5 text-xs text-[#4B5563] leading-relaxed">{k(`creators.protect${n}Desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Creator commitments */}
      <section className="bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            <div className="flex items-center gap-2 text-blue-300 text-[11px] font-bold uppercase tracking-wider"><Megaphone className="w-4 h-4" /> {k('creators.rulesTitle')}</div>
            <p className="mt-3 text-lg font-semibold leading-relaxed">{k('creators.rulesDesc')}</p>
          </div>
          <ul className="space-y-2">
            {[1, 2, 3, 4].map(n => (
              <li key={n} className="flex items-start gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> {k(`creators.rule${n}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ + form */}
      <section id="creator-form" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 lg:grid-cols-5 gap-10 scroll-mt-16">
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-extrabold">{k('creators.formTitle')}</h2>
          <p className="mt-2 text-sm text-[#6B7280]">{k('creators.formSubtitle')}</p>
          <h3 className="mt-8 text-sm font-bold uppercase tracking-wider text-slate-500">{k('creators.faqTitle')}</h3>
          <dl className="mt-3 space-y-3">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="p-3.5 rounded-xl border border-[#DDE1E6] bg-[#F8FAFC]">
                <dt className="font-bold text-sm">{k(`creators.faq${n}Q`)}</dt>
                <dd className="mt-1 text-xs text-[#4B5563] leading-relaxed">{k(`creators.faq${n}A`)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <form onSubmit={submit} className="lg:col-span-3 p-5 sm:p-6 rounded-2xl border border-[#DDE1E6] bg-white shadow-xs space-y-4 self-start">
          {sent ? (
            <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold">{k('creators.form.success')}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} htmlFor="cf-name">{k('creators.form.name')}</label>
                  <input id="cf-name" required maxLength={120} className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="cf-email">{k('creators.form.email')}</label>
                  <input id="cf-email" required type="email" maxLength={200} className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="cf-handle">{k('creators.form.handle')}</label>
                  <input id="cf-handle" required maxLength={120} placeholder="@yourhandle" className={inputCls} value={form.handle} onChange={e => set('handle', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="cf-followers">{k('creators.form.followers')}</label>
                  <input id="cf-followers" type="number" min={0} inputMode="numeric" className={inputCls} value={form.followers} onChange={e => set('followers', e.target.value)} />
                </div>
              </div>
              <div>
                <span className={labelCls}>{k('creators.form.platforms')}</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PLATFORMS.map(p => (
                    <label key={p} className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium cursor-pointer ${form.platforms.includes(p) ? 'border-[#005FB8] bg-blue-50 text-[#005FB8]' : 'border-[#DDE1E6] bg-white text-slate-700'}`}>
                      <input type="checkbox" className="accent-[#005FB8]" checked={form.platforms.includes(p)} onChange={() => togglePlatform(p)} />
                      {k(`creators.platform.${p}`)}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="cf-niche">{k('creators.form.niche')}</label>
                <input id="cf-niche" maxLength={120} className={inputCls} value={form.niche} onChange={e => set('niche', e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="cf-notes">{k('creators.form.notes')}</label>
                <textarea id="cf-notes" rows={3} maxLength={3000} className={inputCls} value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                <input type="checkbox" className="accent-[#005FB8] mt-0.5" checked={form.inUS} onChange={e => set('inUS', e.target.checked)} />
                {k('creators.form.inUS')}
              </label>
              {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
              <button type="submit" disabled={sending} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-60 text-white font-bold text-sm">
                <Send className="w-4 h-4" /> {sending ? k('creators.form.submitting') : k('creators.form.submit')}
              </button>
            </>
          )}
        </form>
      </section>

      <footer className="border-t border-[#DDE1E6] py-6 text-center text-xs text-[#6B7280]">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 hover:text-[#005FB8] font-medium">
          <ArrowLeft className="w-3.5 h-3.5" /> {k('creators.backToSite')}
        </button>
      </footer>
    </div>
  );
};
