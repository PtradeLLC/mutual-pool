import React, { useState } from 'react';
import {
  ArrowLeft, ArrowRight, Truck, Warehouse, Users, Smartphone, ShieldCheck, Wallet, Scale, Handshake,
  CheckCircle2, BarChart3, Send, AlertCircle, PlayCircle,
} from 'lucide-react';
import { Logo } from './Logo';
import { LanguageSelector } from './LanguageSelector';
import { useTranslation, type TranslationKey } from '../i18n';

interface PartnersPageProps {
  onBack: () => void;
  onOpenAuth?: (mode?: 'LOGIN' | 'REGISTER' | 'PHONE' | 'GOOGLE') => void;
  onWatchVideo?: () => void;
}

type PartnerType = 'fleet' | 'warehouse' | 'union' | 'platform' | 'other';

const SEGMENTS: Array<{ key: Exclude<PartnerType, 'other'>; icon: React.ElementType; accent: string }> = [
  { key: 'fleet', icon: Truck, accent: 'text-[#005FB8] bg-blue-50 border-blue-200' },
  { key: 'warehouse', icon: Warehouse, accent: 'text-amber-700 bg-amber-50 border-amber-200' },
  { key: 'union', icon: Users, accent: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { key: 'platform', icon: Smartphone, accent: 'text-purple-700 bg-purple-50 border-purple-200' },
];

const INTERESTS = ['pods', 'payroll', 'apparel', 'cobrand'] as const;

export const PartnersPage: React.FC<PartnersPageProps> = ({ onBack, onWatchVideo }) => {
  const { t } = useTranslation();
  const k = (key: string) => t(key as TranslationKey);
  const [activeSegment, setActiveSegment] = useState<Exclude<PartnerType, 'other'>>('fleet');

  const [form, setForm] = useState({
    orgName: '', orgType: 'fleet' as PartnerType, contactName: '', contactEmail: '', contactPhone: '',
    workforceSize: '', metro: '', payCadence: 'weekly', interests: ['pods'] as string[], notes: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof form, value: string | string[]) => setForm(f => ({ ...f, [field]: value }));
  const toggleInterest = (key: string) =>
    set('interests', form.interests.includes(key) ? form.interests.filter(i => i !== key) : [...form.interests, key]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setError(null);
    try {
      const res = await fetch('/api/partners/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, workforceSize: Number(form.workforceSize) || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || data.message || 'failed');
      setSent(true);
    } catch {
      setError(k('partners.form.error'));
    } finally {
      setSending(false);
    }
  };

  const seg = SEGMENTS.find(s => s.key === activeSegment)!;
  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-[#DDE1E6] bg-white text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#005FB8]/30 focus:border-[#005FB8]';
  const labelCls = 'block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1';

  return (
    <div className="min-h-screen bg-white text-[#111827]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#DDE1E6]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button type="button" onClick={onBack} className="flex items-center gap-3 group">
            <Logo size="md" />
          </button>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button type="button" onClick={onBack} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DDE1E6] hover:bg-gray-50 text-xs font-semibold">
              <ArrowLeft className="w-3.5 h-3.5" /> {k('partners.backToSite')}
            </button>
            <a href="#partner-form" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white text-xs font-bold">
              {k('partners.heroCta')} <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50/70 to-white border-b border-[#DDE1E6]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-blue-200 text-[#005FB8] text-[11px] font-bold uppercase tracking-wider">
            <Handshake className="w-3.5 h-3.5" /> {k('partners.badge')}
          </span>
          <h1 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight max-w-3xl mx-auto">{k('partners.heroTitle')}</h1>
          <p className="mt-5 text-base sm:text-lg text-[#4B5563] max-w-2xl mx-auto leading-relaxed">{k('partners.heroSubtitle')}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="#partner-form" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-sm shadow-sm">
              {k('partners.heroCta')} <ArrowRight className="w-4 h-4" />
            </a>
            {onWatchVideo && (
              <button type="button" onClick={onWatchVideo} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#DDE1E6] bg-white hover:bg-gray-50 font-semibold text-sm">
                <PlayCircle className="w-4 h-4 text-[#005FB8]" /> {k('partners.heroSecondary')}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="text-2xl font-extrabold text-center">{k('partners.whyTitle')}</h2>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { n: 1, icon: Truck, color: 'text-[#005FB8] bg-blue-50' },
            { n: 2, icon: Wallet, color: 'text-emerald-700 bg-emerald-50' },
            { n: 3, icon: ShieldCheck, color: 'text-amber-700 bg-amber-50' },
            { n: 4, icon: Users, color: 'text-purple-700 bg-purple-50' },
          ].map(({ n, icon: Icon, color }) => (
            <div key={n} className="p-5 rounded-2xl border border-[#DDE1E6] bg-white shadow-xs">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-5 h-5" /></div>
              <h3 className="mt-3 font-bold text-sm">{k(`partners.why${n}Title`)}</h3>
              <p className="mt-1.5 text-xs text-[#4B5563] leading-relaxed">{k(`partners.why${n}Desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#F8FAFC] border-y border-[#DDE1E6]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-2xl font-extrabold text-center">{k('partners.howTitle')}</h2>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(n => (
              <div key={n} className="p-5 rounded-2xl bg-white border border-[#DDE1E6]">
                <h3 className="font-bold text-sm text-[#005FB8]">{k(`partners.how${n}Title`)}</h3>
                <p className="mt-2 text-xs text-[#4B5563] leading-relaxed">{k(`partners.how${n}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Segments */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="text-2xl font-extrabold text-center">{k('partners.segmentsTitle')}</h2>
        <p className="mt-2 text-sm text-[#6B7280] text-center max-w-2xl mx-auto">{k('partners.segmentsSubtitle')}</p>
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {SEGMENTS.map(({ key, icon: Icon, accent }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setActiveSegment(key); set('orgType', key); }}
              className={`p-3 sm:p-4 rounded-2xl border text-left transition-all ${activeSegment === key ? 'border-[#005FB8] ring-2 ring-[#005FB8]/20 bg-white shadow-md' : 'border-[#DDE1E6] bg-white hover:border-slate-300'}`}
            >
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${accent}`}><Icon className="w-4.5 h-4.5" /></div>
              <div className="mt-2 font-bold text-xs sm:text-sm leading-snug">{k(`partners.${key}.title`)}</div>
            </button>
          ))}
        </div>
        <div className="mt-5 p-5 sm:p-6 rounded-2xl border border-[#DDE1E6] bg-white shadow-xs">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${seg.accent}`}><seg.icon className="w-5 h-5" /></div>
            <h3 className="text-lg font-extrabold">{k(`partners.${activeSegment}.title`)}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['problem', 'proposal', 'ask', 'get'] as const).map(part => (
              <div key={part} className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#005FB8]">
                  {k(`partners.label${part === 'problem' ? 'Problem' : part === 'proposal' ? 'Proposal' : part === 'ask' ? 'Ask' : 'Get'}`)}
                </div>
                <p className="mt-1.5 text-sm text-[#374151] leading-relaxed">{k(`partners.${activeSegment}.${part}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pilot + what we handle */}
      <section className="bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            <div className="flex items-center gap-2 text-blue-300 text-[11px] font-bold uppercase tracking-wider"><BarChart3 className="w-4 h-4" /> {k('partners.pilotTitle')}</div>
            <p className="mt-3 text-lg font-semibold leading-relaxed">{k('partners.pilotDesc')}</p>
            <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[1, 2, 3, 4].map(n => (
                <li key={n} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> {k(`partners.pilotMetric${n}`)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 text-blue-300 text-[11px] font-bold uppercase tracking-wider"><Scale className="w-4 h-4" /> {k('partners.weHandleTitle')}</div>
            <ul className="mt-3 space-y-2">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <li key={n} className="flex items-start gap-2 text-sm text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" /> {k(`partners.weHandle${n}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Form */}
      <section id="partner-form" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-extrabold">{k('partners.formTitle')}</h2>
          <p className="mt-2 text-sm text-[#6B7280]">{k('partners.formSubtitle')}</p>
          <h3 className="mt-8 text-sm font-bold uppercase tracking-wider text-slate-500">{k('partners.faqTitle')}</h3>
          <dl className="mt-3 space-y-3">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="p-3.5 rounded-xl border border-[#DDE1E6] bg-[#F8FAFC]">
                <dt className="font-bold text-sm">{k(`partners.faq${n}Q`)}</dt>
                <dd className="mt-1 text-xs text-[#4B5563] leading-relaxed">{k(`partners.faq${n}A`)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <form onSubmit={submit} className="lg:col-span-3 p-5 sm:p-6 rounded-2xl border border-[#DDE1E6] bg-white shadow-xs space-y-4">
          {sent ? (
            <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold">{k('partners.form.success')}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{k('partners.form.orgName')}</label>
                  <input required maxLength={120} className={inputCls} value={form.orgName} onChange={e => set('orgName', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>{k('partners.form.orgType')}</label>
                  <select className={inputCls} value={form.orgType} onChange={e => set('orgType', e.target.value)}>
                    {(['fleet', 'warehouse', 'union', 'platform', 'other'] as PartnerType[]).map(v => <option key={v} value={v}>{k(`partners.type.${v}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{k('partners.form.contactName')}</label>
                  <input required maxLength={120} className={inputCls} value={form.contactName} onChange={e => set('contactName', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>{k('partners.form.email')}</label>
                  <input required type="email" maxLength={200} className={inputCls} value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>{k('partners.form.phone')}</label>
                  <input type="tel" maxLength={40} className={inputCls} value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>{k('partners.form.workforceSize')}</label>
                  <input type="number" min={1} max={1000000} className={inputCls} value={form.workforceSize} onChange={e => set('workforceSize', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>{k('partners.form.metro')}</label>
                  <input maxLength={120} className={inputCls} value={form.metro} onChange={e => set('metro', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>{k('partners.form.payCadence')}</label>
                  <select className={inputCls} value={form.payCadence} onChange={e => set('payCadence', e.target.value)}>
                    {['weekly', 'biweekly', 'daily', 'other'].map(v => <option key={v} value={v}>{k(`partners.cadence.${v}`)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>{k('partners.form.interests')}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {INTERESTS.map(key => (
                    <label key={key} className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium cursor-pointer ${form.interests.includes(key) ? 'border-[#005FB8] bg-blue-50 text-[#005FB8]' : 'border-[#DDE1E6] bg-white text-slate-700'}`}>
                      <input type="checkbox" className="accent-[#005FB8]" checked={form.interests.includes(key)} onChange={() => toggleInterest(key)} />
                      {k(`partners.interest.${key}`)}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>{k('partners.form.notes')}</label>
                <textarea rows={4} maxLength={3000} className={inputCls} value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
              {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
              <button type="submit" disabled={sending} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-60 text-white font-bold text-sm">
                <Send className="w-4 h-4" /> {sending ? k('partners.form.submitting') : k('partners.form.submit')}
              </button>
            </>
          )}
        </form>
      </section>

      <footer className="border-t border-[#DDE1E6] py-6 text-center text-xs text-[#6B7280]">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 hover:text-[#005FB8] font-medium">
          <ArrowLeft className="w-3.5 h-3.5" /> {k('partners.backToSite')}
        </button>
      </footer>
    </div>
  );
};
