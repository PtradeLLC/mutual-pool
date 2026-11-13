import React from 'react';
import { Eye, Repeat, Handshake, Users, TrendingUp, Target, PlusCircle } from 'lucide-react';
import { useTranslation, TranslationKey } from '../i18n';
import { formatCents } from '../lib/financialAwareness';
import type { FinancialProfileView } from '../lib/financialAwareness';
import { savingsRangeLabel } from './FinancialAwarenessModal';

interface SavingsJourneyCardProps {
  // The member's own profile view from GET /api/financial-profile; null while loading.
  view: FinancialProfileView | null;
  onOpenFinancialAwareness: () => void;
  onJoinPod: () => void;
  onCreatePod: () => void;
}

const PRINCIPLES: Array<{ key: 'awareness' | 'discipline' | 'commitment' | 'accountability' | 'progress'; Icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'awareness', Icon: Eye },
  { key: 'discipline', Icon: Repeat },
  { key: 'commitment', Icon: Handshake },
  { key: 'accountability', Icon: Users },
  { key: 'progress', Icon: TrendingUp },
];

/** Dashboard: the five principles, with the member's own numbers behind each. */
export const SavingsJourneyCard: React.FC<SavingsJourneyCardProps> = ({ view, onOpenFinancialAwareness, onJoinPod, onCreatePod }) => {
  const { t } = useTranslation();
  const profile = view?.profile || null;
  const progress = view?.progress || null;
  const complete = profile?.completionStatus === 'COMPLETE';
  const pct = progress?.goalProgressPct ?? 0;

  // What each principle shows once there is something real to show.
  const detail: Record<string, string | null> = {
    awareness: complete
      ? `${t('journey.goal')}: ${formatCents(profile!.targetSavingsCents)}`
      : null,
    discipline: progress && progress.completedContributions > 0
      ? `${t('journey.completed')}: ${progress.completedContributions}${progress.missedContributions > 0 ? ` · ${t('journey.missed', { count: progress.missedContributions })}` : ''}`
      : null,
    commitment: complete
      ? t('fa.perWeek', { amount: formatCents(profile!.confirmedWeeklyCommitmentCents) })
      : null,
    accountability: progress && progress.activePodCount > 0
      ? t('journey.inPods', { amount: formatCents(progress.weeklyObligationCents), count: progress.activePodCount })
      : view?.savingsRange ? `${t('journey.range')}: ${view.savingsRange.name}` : null,
    progress: progress && progress.completedCycles > 0
      ? `${t('journey.cycles')}: ${progress.completedCycles}`
      : null,
  };

  return (
    <section className="bg-white border border-[#DDE1E6] rounded-2xl p-5 shadow-xs space-y-4" aria-labelledby="journey-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="journey-title" className="font-extrabold text-sm text-[#111827] flex items-center gap-2">
            <Target className="w-4 h-4 text-[#005FB8]" /> {t('journey.title')}
          </h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            {complete && view?.savingsRange
              ? `${t('journey.range')}: ${savingsRangeLabel(t, view.savingsRange)}`
              : profile ? t('journey.finish') : t('journey.start')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onOpenFinancialAwareness} className="px-3.5 py-2 rounded-lg bg-white hover:bg-gray-50 text-[#005FB8] border border-blue-200 font-bold text-xs cursor-pointer">
            {complete ? t('journey.editBtn') : t('journey.startBtn')}
          </button>
          <button type="button" onClick={onJoinPod} className="px-3.5 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer">
            <Users className="w-4 h-4" /> {t('fa.joinPod')}
          </button>
          <button type="button" onClick={onCreatePod} className="px-3.5 py-2 rounded-lg bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-bold text-xs flex items-center gap-1.5 cursor-pointer">
            <PlusCircle className="w-4 h-4 text-[#005FB8]" /> {t('fa.createPod')}
          </button>
        </div>
      </div>

      {complete && progress && (
        <div>
          <div className="flex items-end justify-between gap-3 text-xs">
            <span className="text-[#6B7280]">{t('journey.contributed')}</span>
            <span className="font-extrabold font-mono text-[#111827]">
              {formatCents(progress.totalContributedCents)}
              <span className="font-semibold text-[#6B7280] ml-1.5">{t('journey.ofTarget', { pct, target: formatCents(profile!.targetSavingsCents) })}</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('journey.contributed')}>
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2" aria-label={t('principles.title')}>
        {PRINCIPLES.map(({ key, Icon }, idx) => (
          <li key={key} className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="flex items-center gap-1.5 text-[#005FB8]">
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[11px] font-extrabold text-[#111827]">{idx + 1}. {t(`principle.${key}` as TranslationKey)}</span>
            </div>
            <p className="text-[11px] text-[#6B7280] mt-1 leading-snug">{t(`principle.${key}Desc` as TranslationKey)}</p>
            {detail[key] && <p className="text-[11px] font-bold text-emerald-700 mt-1.5">{detail[key]}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
};
