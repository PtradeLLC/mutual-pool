import React, { useEffect } from 'react';
import { X, ArrowRight, Sparkles, Users, Shirt, DollarSign, CheckCircle2 } from 'lucide-react';
import { Logo } from './Logo';

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
              Courier Campaign Guide
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            How It Works
          </h1>

          <h3 className="text-lg sm:text-xl font-bold text-[#005FB8]">
            Turn Your Everyday Deliveries Into Daily Earnings.
          </h3>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Getting started is simple. Build your Pod to activate this service, get equipped with campaign gear from our brand partners, and earn by wearing it while you make the deliveries you already make.
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
                01 — Start Your Pod
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded-full">
              Step 1
            </span>
          </div>

          <p className="text-sm font-bold text-slate-900">
            Build your crew. Start for free.
          </p>

          <p className="text-sm text-slate-600 leading-relaxed">
            Create a Pod at no cost and invite your friends, family, and fellow couriers to join. Once your Pod reaches its required maximum size and is activated, you're ready for the next step.
          </p>

          <div className="pt-1">
            <button
              id="step-1-start-pod-cta"
              type="button"
              onClick={handleStartPodClick}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#005FB8] hover:text-[#004C93] hover:underline cursor-pointer group"
            >
              <span>Start a Pod</span>
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
                02 — Select Campaigns &amp; Get Gear
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
              Step 2
            </span>
          </div>

          <p className="text-sm font-bold text-slate-900">
            Your Pod fills. You choose campaigns.
          </p>

          <p className="text-sm text-slate-600 leading-relaxed">
            Once your Pod reaches its required maximum size and is activated, you can select which brand partner campaigns you'd like to participate in. We'll send you custom campaign apparel and promotional gear from our brand partners with zero upfront cost.
          </p>

          <div className="pt-1 flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200/70 w-fit">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Pod activated. Campaigns unlocked.</span>
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
                03 — Wear It. Ride. Get Paid.
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full">
              Step 3
            </span>
          </div>

          <p className="text-sm font-bold text-slate-900">
            Turn your route into a paycheck.
          </p>

          <p className="text-sm text-slate-600 leading-relaxed">
            Wear the campaign clothing while you're out making your regular delivery routes. As you wear the gear and complete your qualifying delivery days, you earn a daily payout.
          </p>

          <div className="pt-1 p-3 rounded-xl bg-amber-50/80 border border-amber-200/80">
            <p className="text-xs sm:text-sm font-bold text-amber-950">
              No extra stops. No extra effort. Just get paid for the routes you're already running.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200" />

        {/* Bottom Conclusion & Main Action Button */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-6 sm:p-7 space-y-4 shadow-xl">
          <div className="space-y-1.5">
            <h3 className="text-lg sm:text-xl font-extrabold text-white">
              Your Route. Your Gear. Your Earnings.
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Start a Pod today, rally your crew, and turn the miles you're already riding into another way to earn.
            </p>
          </div>

          <button
            id="campaign-modal-start-pod-cta-btn"
            type="button"
            onClick={handleStartPodClick}
            className="w-full py-3.5 px-6 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-sm sm:text-base transition-all shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{isAuthUser ? 'Go to Create Pod →' : 'Start a Pod for Free →'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
