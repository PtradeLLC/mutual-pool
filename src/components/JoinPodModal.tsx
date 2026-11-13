import React, { useEffect, useState } from 'react';
import { X, Users, ShieldCheck, AlertTriangle, Sparkles, Compass, Target, RefreshCw } from 'lucide-react';
import { Pod } from '../types';
import { useTranslation } from '../i18n';
import { formatCents } from '../lib/financialAwareness';
import type { SavingsRangeView } from '../lib/financialAwareness';
import { savingsRangeLabel } from './FinancialAwarenessModal';

interface PodMatch {
  pod: Pod;
  purposeMatch: boolean;
  seatsLeft: number;
  eligible: boolean;
  ineligibleReason: string | null;
  firstChargeUsd: number;
  potUsd: number;
  netPayoutUsd: number;
}

interface MatchResponse {
  status: 'PROFILE_REQUIRED' | 'NO_RANGE' | 'NO_PODS' | 'MATCHED';
  savingsRange: SavingsRangeView | null;
  lowestWeeklyCents?: number | null;
  pods: PodMatch[];
  memberOf: Pod[];
  bestPodId: string | null;
}

interface JoinPodModalProps {
  isOpen: boolean;
  onClose: () => void;
  // The existing join flow (KYC, funds, bank authorization and agreement prompts).
  onJoinPod: (pod: Pod) => void | Promise<void>;
  joiningPodIds?: Set<string>;
  onOpenFinancialAwareness: () => void;
  onExplorePods: () => void;
}

const usd = (n: number) => formatCents(Math.round(n * 100));

/** Join a Pod: MutualPool-hosted pods in the member's Savings Range. */
export const JoinPodModal: React.FC<JoinPodModalProps> = ({ isOpen, onClose, onJoinPod, joiningPodIds, onOpenFinancialAwareness, onExplorePods }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingPodId, setConfirmingPodId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/savings-range/matches', { headers: { Accept: 'application/json' } });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.status) throw new Error('load');
      setData(body);
    } catch {
      setError(t('sr.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setConfirmingPodId(null);
    setData(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const emptyState = (title: string, body: string, primary?: { label: string; onClick: () => void }) => (
    <div className="p-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-3">
      <div className="text-sm font-black text-slate-900">{title}</div>
      <p className="text-xs text-slate-600 max-w-md mx-auto">{body}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {primary && (
          <button type="button" onClick={primary.onClick} className="px-4 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004A94] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer">
            <Target className="w-3.5 h-3.5" /> {primary.label}
          </button>
        )}
        <button type="button" onClick={onExplorePods} className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer">
          <Compass className="w-3.5 h-3.5" /> {t('sr.explore')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-labelledby="sr-title">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto">
        <button onClick={onClose} aria-label="Close" className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1 pr-10">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-[#005FB8]">{t('principle.accountability')}</span>
          <h2 id="sr-title" className="text-xl font-black text-slate-950">{t('sr.title')}</h2>
          <p className="text-xs text-slate-500">{t('sr.intro')}</p>
        </div>

        <div className="mt-4 space-y-4">
          {loading && <div className="py-12 text-center text-xs text-slate-500">{t('sr.loading')}</div>}

          {!loading && error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-2" role="alert">
              <span className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</span>
              <button type="button" onClick={load} aria-label="Retry" className="p-1.5 rounded-lg hover:bg-rose-100 cursor-pointer"><RefreshCw className="w-4 h-4" /></button>
            </div>
          )}

          {!loading && data?.savingsRange && (
            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-[#005FB8]">{t('sr.yourRange')}</div>
                <div className="text-sm font-black text-slate-950">{savingsRangeLabel(t, data.savingsRange)}</div>
              </div>
              <button type="button" onClick={onOpenFinancialAwareness} className="text-[11px] font-bold text-[#005FB8] hover:underline cursor-pointer shrink-0">{t('sr.updateProfile')}</button>
            </div>
          )}

          {!loading && data && data.memberOf.length > 0 && (
            <p className="text-[11px] text-slate-600">{t('sr.alreadyIn', { names: data.memberOf.map(p => p.name).join(', ') })}</p>
          )}

          {!loading && data?.status === 'PROFILE_REQUIRED' && emptyState(t('sr.needProfileTitle'), t('sr.needProfileDesc'), { label: t('journey.startBtn'), onClick: onOpenFinancialAwareness })}
          {!loading && data?.status === 'NO_RANGE' && emptyState(
            t('sr.noRangeTitle'),
            t('sr.noRangeDesc', { amount: data.lowestWeeklyCents ? formatCents(data.lowestWeeklyCents) : '$5' }),
            { label: t('sr.updateProfile'), onClick: onOpenFinancialAwareness },
          )}
          {!loading && data?.status === 'NO_PODS' && data.pods.length === 0 && emptyState(t('sr.noPodsTitle'), t('sr.noPodsDesc'))}

          {!loading && data && data.pods.map(match => {
            const { pod } = match;
            const joining = Boolean(joiningPodIds?.has(pod.id));
            const confirming = confirmingPodId === pod.id;
            const taken = pod.members?.length || 0;
            return (
              <div key={pod.id} className={`p-4 rounded-2xl border space-y-3 ${match.eligible ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-80'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#005FB8] text-white flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> {t('sr.hostedBy')}
                      </span>
                      {data.bestPodId === pod.id && data.pods.length > 1 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 flex items-center gap-1"><Sparkles className="w-3 h-3" /> {t('sr.bestMatch')}</span>
                      )}
                      {match.purposeMatch && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800">{t('sr.purposeMatch')}</span>
                      )}
                    </div>
                    <div className="text-sm font-black text-slate-950 mt-1.5 truncate">{pod.name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-black font-mono text-slate-950">{usd(pod.depositTier)}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">{t('fa.freq.WEEKLY')}</div>
                  </div>
                </div>

                <div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                    <div className="h-full bg-[#005FB8]" style={{ width: `${Math.min(100, (taken / pod.sizeTier) * 100)}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600">
                    <Users className="w-3.5 h-3.5" /> {t('sr.seats', { taken, size: pod.sizeTier })}
                  </div>
                </div>

                <ul className="text-[11px] text-slate-600 space-y-0.5">
                  <li>{t('sr.pot', { amount: usd(match.potUsd) })}</li>
                  <li>{t('sr.payout', { amount: usd(match.netPayoutUsd) })}</li>
                  <li>{t('sr.startsWhenFull')}</li>
                </ul>

                {!match.eligible ? (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                    <strong>{t('sr.ineligible')}.</strong> {match.ineligibleReason}
                  </div>
                ) : confirming ? (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2.5">
                    <p className="text-xs text-slate-800 font-semibold">{t('sr.confirmNote', { amount: usd(pod.depositTier), weeks: pod.sizeTier })}</p>
                    <p className="text-[11px] text-slate-600">{t('sr.firstCharge', { amount: usd(match.firstChargeUsd) })}</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirmingPodId(null)} disabled={joining} className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer">{t('sr.cancel')}</button>
                      <button
                        type="button"
                        disabled={joining}
                        onClick={async () => {
                          await onJoinPod(pod);
                          setConfirmingPodId(null);
                          onClose();
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs cursor-pointer"
                      >
                        {t('sr.confirm')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmingPodId(pod.id)} className="w-full py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004A94] text-white font-black text-xs cursor-pointer">
                    {t('sr.join')}
                  </button>
                )}
              </div>
            );
          })}

          {!loading && data && data.pods.length > 0 && (
            <button type="button" onClick={onExplorePods} className="w-full py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer">
              <Compass className="w-3.5 h-3.5" /> {t('sr.explore')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
