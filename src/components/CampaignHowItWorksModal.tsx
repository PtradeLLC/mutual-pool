import React, { useEffect } from 'react';
import { X, ArrowRight, Sparkles, Users, Shirt, DollarSign, CheckCircle2 } from 'lucide-react';
import { Logo } from './Logo';
import { useTranslation } from '../i18n/LanguageContext';

interface CampaignHowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartPod: () => void;
  isAuthUser?: boolean;
}

export const CampaignHowItWorksModal: React.FC<CampaignHowItWorksModalProps> = ({
  isOpen,
  onClose,
  onStartPod,
  isAuthUser = false,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStartPodClick = () => {
    onClose();
    onStartPod();
  };

  return (
    <div
      id="campaign-how-it-works-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="campaign-how-it-works-modal-dialog"
        className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 sm:p-9 shadow-2xl relative text-slate-900 my-auto max-h-[90vh] overflow-y-auto space-y-6 sm:space-y-7"
      >
        {/* Close Button */}
        <button
          id="campaign-how-it-works-close-btn"
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 p-2.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Section */}
        <div className="space-y-3 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" />
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#005FB8] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#005FB8]" />
              {t('campaigns.howItWorks.badge')}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            {t('campaigns.howItWorks.title')}
          </h1>

          <h3 className="text-lg sm:text-xl font-bold text-[#005FB8]">
            {t('campaigns.howItWorks.subtitle')}
          </h3>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            {t('campaigns.howItWorks.intro')}
          </p>
        </div>

        {/* Step 01 */}
        <div className="space-y-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#005FB8] flex items-center justify-center font-black text-xs">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {t('campaigns.howItWorks.step1Title')}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded-full">
              {t('campaigns.howItWorks.step1Tag')}
            </span>
          </div>

          <p className="text-sm font-bold text-slate-900">
            {t('campaigns.howItWorks.step1Tagline')}
          </p>

          <p className="text-sm text-slate-600 leading-relaxed">
            {t('campaigns.howItWorks.step1Desc')}
          </p>

          <div className="pt-1">
            <button
              id="step-1-start-pod-cta"
              type="button"
              onClick={handleStartPodClick}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#005FB8] hover:text-[#004C93] hover:underline cursor-pointer group"
            >
              <span>{t('campaigns.howItWorks.step1Btn')}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        <div className="border-t border-slate-200" />

        {/* Step 02 */}
        <div className="space-y-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">
                <Shirt className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {t('campaigns.howItWorks.step2Title')}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
              {t('campaigns.howItWorks.step2Tag')}
            </span>
          </div>

          <p className="text-sm font-bold text-slate-900">
            {t('campaigns.howItWorks.step2Tagline')}
          </p>

          <p className="text-sm text-slate-600 leading-relaxed">
            {t('campaigns.howItWorks.step2Desc')}
          </p>

          <div className="pt-1 flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200/70 w-fit">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{t('campaigns.howItWorks.step2Badge')}</span>
          </div>
        </div>

        <div className="border-t border-slate-200" />

        {/* Step 03 */}
        <div className="space-y-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-black text-xs">
                <DollarSign className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {t('campaigns.howItWorks.step3Title')}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full">
              {t('campaigns.howItWorks.step3Tag')}
            </span>
          </div>

          <p className="text-sm font-bold text-slate-900">
            {t('campaigns.howItWorks.step3Tagline')}
          </p>

          <p className="text-sm text-slate-600 leading-relaxed">
            {t('campaigns.howItWorks.step3Desc')}
          </p>

          <div className="pt-1 p-3 rounded-xl bg-amber-50/80 border border-amber-200/80">
            <p className="text-xs sm:text-sm font-bold text-amber-950">
              {t('campaigns.howItWorks.step3Callout')}
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200" />

        {/* Bottom Conclusion & Main Action Button */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-6 sm:p-7 space-y-4 shadow-xl">
          <div className="space-y-1.5">
            <h3 className="text-lg sm:text-xl font-extrabold text-white">
              {t('campaigns.howItWorks.bottomTitle')}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t('campaigns.howItWorks.bottomDesc')}
            </p>
          </div>

          <button
            id="campaign-modal-start-pod-cta-btn"
            type="button"
            onClick={handleStartPodClick}
            className="w-full py-3.5 px-6 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-sm sm:text-base transition-all shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{isAuthUser ? t('campaigns.howItWorks.startPodAuth') : t('campaigns.howItWorks.startPodFree')}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
