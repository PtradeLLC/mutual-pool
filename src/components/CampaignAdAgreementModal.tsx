import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, ShieldCheck, Shirt, DollarSign, 
  Sparkles, FileText, AlertCircle, Check, ArrowRight
} from 'lucide-react';
import { Pod, User, PodCampaignAgreement } from '../types';
import { Logo } from './Logo';

interface CampaignAdAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  pod: Pod;
  currentUser: User;
  onConfirmOptIn: (agreementData: {
    firstName: string;
    lastName: string;
    acknowledgedTerms: boolean;
  }) => Promise<void>;
  onConfirmOptOut: (agreementData: {
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export const CampaignAdAgreementModal: React.FC<CampaignAdAgreementModalProps> = ({
  isOpen,
  onClose,
  pod,
  currentUser,
  onConfirmOptIn,
  onConfirmOptOut,
  isSubmitting = false,
}) => {
  // Pre-fill First and Last Name from currentUser.displayName
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false);

  useEffect(() => {
    if (currentUser?.displayName) {
      const parts = currentUser.displayName.trim().split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
    } else {
      setFirstName('');
      setLastName('');
    }
    setAcknowledged(false);
    setErrorMsg(null);
    setShowOptOutConfirm(false);
  }, [currentUser, isOpen]);

  // Lock body scroll and handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
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
  }, [isOpen, onClose, isSubmitting]);

  if (!isOpen) return null;

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const isValidSignature = firstName.trim().length > 0 && lastName.trim().length > 0;
  const canOptIn = isValidSignature && acknowledged && !isSubmitting;

  const handleOptInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidSignature) {
      setErrorMsg('Please ensure both first and last names are entered for your signature.');
      return;
    }
    if (!acknowledged) {
      setErrorMsg('Please click the checkbox to acknowledge the partner campaign services and expectations.');
      return;
    }
    setErrorMsg(null);
    try {
      await onConfirmOptIn({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        acknowledgedTerms: true,
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to record agreement.');
    }
  };

  const handleOptOutSubmit = async () => {
    setErrorMsg(null);
    try {
      await onConfirmOptOut({
        firstName: firstName.trim() || 'Pod',
        lastName: lastName.trim() || 'Creator',
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to record opt-out.');
    }
  };

  return (
    <div
      id="campaign-ad-agreement-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        id="campaign-ad-agreement-modal-dialog"
        className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative text-slate-900 my-auto max-h-[92vh] flex flex-col"
      >
        {/* Close Button */}
        <button
          id="campaign-agreement-close-btn"
          type="button"
          disabled={isSubmitting}
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="shrink-0 space-y-2 border-b border-slate-100 pb-4 pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            <Logo size="sm" />
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Pod Creator Action Required
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-mono">
              Contract v1.0-2026
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
            Partner Advertising & Campaign Gear Agreement
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Pod <strong className="text-slate-900 font-semibold">"{pod.name}"</strong> is ready for activation! As the Pod Creator, choose whether to enroll your Pod in the Partner Brand Ambassador program to earn extra daily wages on delivery routes.
          </p>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto py-4 space-y-5 flex-1 pr-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium">{errorMsg}</div>
            </div>
          )}

          {/* Service Terms Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-[#005FB8]" />
              <span>Summary of Services & Member Expectations</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Shirt className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs text-slate-900">1. Free Partner Drip</div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Complimentary promotional tees, hoodies & gear delivered to all active members at no cost.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-[#005FB8] flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs text-slate-900">2. Rep While Delivering</div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Wear the campaign gear during regular gig routes (DoorDash, Uber Eats, Grubhub, etc.).
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs text-slate-900">3. Daily Wage Payouts</div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Earn automated daily sponsor ad payouts for each verified route completed in campaign gear.
                </p>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 bg-white/60 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
              <strong>Agreement Scope:</strong> No upfront payment or inventory purchase required. Couriers maintain full independence. Standard mutual savings rotation and 0% interest lump-sum distributions operate normally regardless of choice.
            </div>
          </div>

          {/* Form for Electronic Signature */}
          <form id="campaign-agreement-form" onSubmit={handleOptInSubmit} className="space-y-4">
            <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-[#005FB8] uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Electronic Signature Details</span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Pre-filled from account
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="signer-first-name" className="block text-xs font-bold text-slate-700 mb-1">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="signer-first-name"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="signer-last-name" className="block text-xs font-bold text-slate-700 mb-1">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="signer-last-name"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Signature Preview */}
              {isValidSignature && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs">
                  <span className="text-slate-500">Legal Signature Preview:</span>
                  <span className="font-serif italic font-bold text-slate-900 text-sm">
                    /s/ {fullName}
                  </span>
                </div>
              )}

              {/* Acknowledgment Checkbox */}
              <div className="pt-2 border-t border-blue-200/60">
                <label 
                  htmlFor="campaign-terms-acknowledge" 
                  className="flex items-start gap-3 cursor-pointer group select-none"
                >
                  <div className="relative flex items-center justify-center mt-0.5">
                    <input
                      id="campaign-terms-acknowledge"
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                      disabled={isSubmitting}
                      className="w-5 h-5 rounded-md border-2 border-blue-400 text-[#005FB8] focus:ring-blue-500 focus:ring-offset-0 transition-colors cursor-pointer accent-[#005FB8]"
                    />
                  </div>
                  <div className="text-xs sm:text-sm text-slate-800 leading-snug">
                    <strong className="text-slate-950 font-semibold">I acknowledge and agree</strong> to the partner campaign service details, delivery apparel guidelines, and expectations on behalf of this Pod.
                  </div>
                </label>
              </div>
            </div>
          </form>

          {/* Opt Out Confirmation Dialog if toggled */}
          {showOptOutConfirm && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-700" />
                <span>Confirm Opting Out of Partner Ad Service?</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                By opting out, this Pod will activate strictly as a standard mutual savings Pod. Members will not receive sponsored brand gear or daily advertising wage payouts.
              </p>
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  id="confirm-opt-out-action-btn"
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleOptOutSubmit}
                  className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Yes, Activate Without Ad Service'}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowOptOutConfirm(false)}
                  className="px-3.5 py-2 rounded-xl bg-white border border-amber-300 text-amber-900 font-semibold text-xs hover:bg-amber-100/50 transition-colors cursor-pointer"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="shrink-0 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            id="campaign-opt-out-btn"
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              if (!showOptOutConfirm) {
                setShowOptOutConfirm(true);
              } else {
                handleOptOutSubmit();
              }
            }}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer order-2 sm:order-1 text-center"
          >
            <span>Opt Out</span>
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto order-1 sm:order-2">
            <button
              id="campaign-opt-in-submit-btn"
              type="button"
              disabled={!canOptIn}
              onClick={handleOptInSubmit}
              className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                canOptIn
                  ? 'bg-[#005FB8] hover:bg-[#004C93] text-white hover:shadow-blue-500/25'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Opt me in & Activate Pod</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
