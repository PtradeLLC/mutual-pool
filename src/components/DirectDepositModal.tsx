import React, { useEffect, useState } from 'react';
import { X, Landmark, Copy, Check, Eye, RefreshCw, CheckCircle2, Clock, Briefcase, AlertCircle, Sparkles } from 'lucide-react';
import type { User } from '../types';
import { useTranslation } from '../i18n';

// Guides a member through pointing their gig-platform payouts (or paycheck) at
// their MutualPool account: show the account and routing numbers, explain where
// to enter them in each app, then confirm once the first deposit arrives. The
// server recognises earnings deposits from the bank's webhook (see
// src/server/earnings.ts); premium perks unlock on the first one.

interface CustodySummary {
  mode: 'ledger' | 'column';
  account: { status: 'PENDING' | 'VERIFIED' | 'MANUAL_REVIEW' | 'DENIED' | 'FROZEN'; accountNumberLast4: string; routingNumber: string } | null;
  directDeposit: { routingNumber: string; accountNumber: string } | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  // Opens the Add Funds flow, where the member opens their MutualPool account.
  onOpenAccount?: () => void;
}

const PLATFORMS = ['Uber', 'Uber Eats', 'Lyft', 'DoorDash', 'Instacart', 'Amazon Flex', 'Grubhub', 'Spark', 'Shipt'];

const readJson = async (res: Response) => { const t = await res.text().catch(() => ''); try { return t ? JSON.parse(t) : {}; } catch { return {}; } };

export const DirectDepositModal: React.FC<Props> = ({ isOpen, onClose, user, onOpenAccount }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CustodySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const initialPlatform = PLATFORMS.find(p => p.replace(/\s/g, '').toLowerCase() === String(user.platform || '').replace(/\s/g, '').toLowerCase()) || PLATFORMS[0];
  const [platform, setPlatform] = useState(initialPlatform);

  const load = async (reveal = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/custody${reveal ? '?reveal=1' : ''}`);
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.message || t('directDeposit.loadError'));
      setStatus(data);
      if (reveal && !data.directDeposit) setError(t('directDeposit.revealError'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('directDeposit.loadError'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (isOpen) load(); }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  if (!isOpen) return null;

  const acct = status?.account;
  const earnings = user.earningsDeposit;
  const premium = user.premium;
  const numbers = status?.directDeposit;

  const row = (labelText: string, value: string, key?: string) => (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[11px] text-slate-500">{labelText}</span>
      <span className="flex items-center gap-2 font-mono text-sm text-slate-900">
        {value}
        {key && (
          <button type="button" onClick={() => copy(value, key)} className="text-[#005FB8] cursor-pointer" aria-label={t('directDeposit.copy')}>
            {copied === key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </span>
    </div>
  );

  const stepTitle = (n: number, text: string) => (
    <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
      <span className="w-5 h-5 rounded-full bg-[#005FB8] text-white text-[11px] flex items-center justify-center">{n}</span>
      {text}
    </div>
  );

  let body: React.ReactNode;
  if (loading && !status) {
    body = <div className="py-8 text-xs text-slate-500 flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> {t('directDeposit.loading')}</div>;
  } else if (!status || status.mode !== 'column') {
    // Bank-held member accounts are not live yet, so there are no numbers to give out.
    body = (
      <div className="p-4 rounded-xl border border-dashed border-slate-300 flex items-start gap-3">
        <Landmark className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-sm text-slate-900">{t('directDeposit.notAvailableTitle')}</div>
          <p className="text-xs text-slate-600 mt-1">{t('directDeposit.notAvailableBody')}</p>
        </div>
      </div>
    );
  } else if (!acct) {
    body = (
      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
        <div className="font-bold text-sm text-slate-900">{t('directDeposit.openAccountTitle')}</div>
        <p className="text-xs text-slate-600">{t('directDeposit.openAccountBody')}</p>
        {onOpenAccount && (
          <button type="button" onClick={() => { onClose(); onOpenAccount(); }} className="w-full py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs cursor-pointer">
            {t('directDeposit.openAccountCta')}
          </button>
        )}
      </div>
    );
  } else if (acct.status !== 'VERIFIED') {
    body = (
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-3">
        <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-900">{t('directDeposit.pendingBody', { status: acct.status.replace('_', ' ').toLowerCase() })}</p>
      </div>
    );
  } else {
    body = (
      <div className="space-y-5">
        {/* 1. The numbers */}
        <section className="space-y-2">
          {stepTitle(1, t('directDeposit.step1'))}
          <div className="p-3 rounded-xl border border-slate-200">
            {row(t('directDeposit.bankName'), 'Column, N.A.')}
            {row(t('directDeposit.routing'), numbers?.routingNumber || acct.routingNumber, 'routing')}
            {numbers
              ? row(t('directDeposit.account'), numbers.accountNumber, 'account')
              : (
                <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100">
                  <span className="text-[11px] text-slate-500">{t('directDeposit.account')}</span>
                  <button type="button" onClick={() => load(true)} disabled={loading} className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50">
                    <Eye className="w-3 h-3" /> {t('directDeposit.showNumbers')}
                  </button>
                </div>
              )}
            {row(t('directDeposit.accountType'), t('directDeposit.checking'))}
          </div>
        </section>

        {/* 2. Where to enter them */}
        <section className="space-y-2">
          {stepTitle(2, t('directDeposit.step2'))}
          <div className="text-[11px] font-bold text-slate-600">{t('directDeposit.pickPlatform')}</div>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map(p => (
              <button key={p} type="button" onClick={() => setPlatform(p)}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-bold cursor-pointer ${platform === p ? 'bg-[#005FB8] border-[#005FB8] text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                {p}{earnings?.platforms?.includes(p) ? ' ✓' : ''}
              </button>
            ))}
          </div>
          <ol className="list-decimal pl-5 space-y-1 text-xs text-slate-700">
            <li>{t('directDeposit.howTo1', { platform })}</li>
            <li>{t('directDeposit.howTo2')}</li>
            <li>{t('directDeposit.howTo3', { platform })}</li>
          </ol>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-2 text-[11px] text-slate-600">
            <Briefcase className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {t('directDeposit.employerTip')}
          </div>
        </section>

        {/* 3. Confirmation */}
        <section className="space-y-2">
          {stepTitle(3, t('directDeposit.step3'))}
          {earnings ? (
            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 space-y-1 text-xs text-emerald-900">
              <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="w-4 h-4" />
                {earnings.platforms?.length ? t('directDeposit.receivedFrom', { platforms: earnings.platforms.join(', ') }) : t('directDeposit.receivedPaycheck')}
              </div>
              <div>{t('directDeposit.lastDeposit', { amount: `$${earnings.lastAmountUsd.toFixed(2)}`, date: new Date(earnings.lastAt).toLocaleDateString() })}</div>
              {premium?.active && premium.until && (
                <div className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> {t('directDeposit.premiumActive', { until: new Date(premium.until).toLocaleDateString() })}</div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-2 text-xs text-slate-700">
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" /> {t('directDeposit.waiting')}
            </div>
          )}
          <p className="text-[11px] text-slate-500">{t('directDeposit.onlyEarnings')}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#DDE1E6] relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all" aria-label={t('directDeposit.close')}>
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Landmark className="w-5 h-5 text-[#005FB8]" /></div>
          <div>
            <h3 className="text-lg font-bold text-[#111827]">{t('directDeposit.title')}</h3>
            <p className="text-xs text-slate-600">{t('directDeposit.subtitle')}</p>
          </div>
        </div>
        {error && <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span></div>}
        {body}
        <button type="button" onClick={onClose} className="mt-5 w-full py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs cursor-pointer">
          {t('directDeposit.done')}
        </button>
      </div>
    </div>
  );
};
