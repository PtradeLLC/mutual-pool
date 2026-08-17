import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, ShieldCheck, Shirt, DollarSign, 
  Sparkles, FileText, AlertCircle, Check, ArrowRight, Calendar, Lock
} from 'lucide-react';
import { Pod, User } from '../types';
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

  const effectiveDateStr = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

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
      setErrorMsg('Please click the checkbox to acknowledge and agree to the Partner Brand Ambassador & Campaign Gear Agreement.');
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
        className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative text-slate-900 my-auto max-h-[92vh] flex flex-col"
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
              <Calendar className="w-3 h-3 text-slate-500 inline mr-0.5" />
              Effective Date: {effectiveDateStr}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
            Partner Brand Ambassador & Campaign Gear Agreement
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Pod <strong className="text-slate-900 font-semibold">"{pod.name}"</strong> is ready for activation! Please review the terms below to decide whether to opt in to receive partner campaign gear and daily route payments, or opt out to operate strictly as a mutual savings circle.
          </p>
        </div>

        {/* Scrollable Content Body with Full Legal Copy */}
        <div className="overflow-y-auto py-4 space-y-6 flex-1 pr-2 text-slate-800 text-xs sm:text-sm leading-relaxed">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium">{errorMsg}</div>
            </div>
          )}

          {/* Legal Text Document Container */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-6 shadow-inner text-slate-700">
            <div className="border-b border-slate-200 pb-3">
              <h1 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-wide">
                Partner Brand Ambassador & Campaign Gear Agreement
              </h1>
              <div className="text-xs font-semibold text-slate-600 mt-1">
                <strong>Effective Date:</strong> {effectiveDateStr}
              </div>
            </div>

            <p className="leading-relaxed">
              This Partner Brand Ambassador & Campaign Gear Agreement (“Agreement”) governs participation in the MutualPool Partner Brand Ambassador & Campaign Gear Program (“Program”).
            </p>

            <p className="leading-relaxed">
              This Agreement is entered into by and between <strong>MutualPool</strong> (“MutualPool,” “we,” “us,” or “our”) and the individual accepting and electronically signing this Agreement (“Participant,” “you,” or “your”).
            </p>

            <p className="leading-relaxed font-medium text-slate-900">
              By electronically signing this Agreement, you acknowledge that you have read, understood, and agreed to the terms below.
            </p>

            <hr className="border-slate-200 my-4" />

            {/* Section 1 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">1.</span> Purpose of the Program
              </h3>
              <p>
                The MutualPool Partner Brand Ambassador & Campaign Gear Program allows eligible MutualPool participants to receive campaign apparel and/or promotional gear supplied by participating brand partners (“Partner Gear”) and earn daily campaign payments for properly wearing and representing the Partner Gear during active campaign periods.
              </p>
              <p>
                The Program is intended to allow eligible gig workers and delivery couriers to earn additional income while performing delivery work they would ordinarily perform.
              </p>
              <p className="font-bold text-slate-900">
                Participation in this Program is <span className="underline">optional</span>.
              </p>
              <p>
                If you do not wish to participate, you may select <strong>Opt Out</strong> and continue using your Pod solely as a MutualPool savings circle, subject to the applicable Mutual Pod Savings Agreement and other applicable MutualPool terms.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">2.</span> Campaign Participation
              </h3>
              <p>
                By selecting <strong>Opt In</strong> and signing this Agreement, you agree to participate in eligible Partner campaigns made available through MutualPool.
              </p>
              <p>Each campaign may have its own:</p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700">
                <li>Campaign start and end dates;</li>
                <li>Active hours or active days;</li>
                <li>Required apparel or promotional gear;</li>
                <li>Geographic requirements;</li>
                <li>Delivery or route requirements;</li>
                <li>Daily payment amount;</li>
                <li>Verification requirements;</li>
                <li>Brand presentation requirements; and</li>
                <li>Additional campaign-specific terms.</li>
              </ul>
              <p>
                Campaign-specific requirements presented to you through the MutualPool platform are incorporated into this Agreement for the applicable campaign.
              </p>
              <p className="italic text-slate-600">
                You are not required to participate in campaigns that you have not accepted.
              </p>
            </section>

            {/* Section 3 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">3.</span> Campaign Activation
              </h3>
              <p>
                A campaign is considered <strong>Active</strong> only during the campaign period and times designated by MutualPool.
              </p>
              <p>
                MutualPool will communicate applicable campaign activation periods through the platform, application, email, SMS, or other approved communication method.
              </p>
              <p>
                You are responsible for reviewing the applicable campaign schedule before beginning your eligible delivery activity.
              </p>
              <p className="font-bold text-slate-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                No campaign payment is earned for periods before a campaign becomes Active or after the applicable campaign has ended.
              </p>
            </section>

            {/* Section 4 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">4.</span> Partner Gear
              </h3>
              <p>
                When a campaign requires physical apparel or promotional equipment, MutualPool or the applicable Partner may provide the required Partner Gear to you.
              </p>
              <p>Partner Gear may include, without limitation:</p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700">
                <li>Hoodies;</li>
                <li>T-shirts;</li>
                <li>Jackets;</li>
                <li>Hats;</li>
                <li>Bags;</li>
                <li>Reflective apparel;</li>
                <li>Promotional accessories; or</li>
                <li>Other campaign materials.</li>
              </ul>
              <p>
                Unless otherwise stated in the applicable campaign terms, Partner Gear supplied through the Program will be provided without an upfront purchase requirement.
              </p>
              <p>
                You agree to use the Partner Gear only for legitimate campaign participation and in accordance with the campaign requirements.
              </p>
            </section>

            {/* Section 5 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">5.</span> Delivery Address and Pickup Information
              </h3>
              <p>
                To participate in campaigns requiring physical Partner Gear, you must provide accurate information necessary for delivery or pickup.
              </p>
              <p>This may include:</p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700">
                <li>Full legal name;</li>
                <li>Physical delivery address;</li>
                <li>Apartment or unit number;</li>
                <li>City, state, and ZIP code;</li>
                <li>Phone number;</li>
                <li>Email address; and</li>
                <li>Approved pickup location, where applicable.</li>
              </ul>
              <p>
                You represent that the physical address or pickup information you provide is accurate and that you are authorized to receive Partner Gear at that location.
              </p>
              <p className="font-bold text-slate-900">
                P.O. boxes may not be accepted when a campaign requires physical delivery.
              </p>
              <p>
                You are responsible for promptly updating your delivery information through the MutualPool platform if your address changes before Partner Gear is shipped.
              </p>
              <p>
                MutualPool is not responsible for delays, failed deliveries, or lost shipments resulting from inaccurate or incomplete information provided by you.
              </p>
            </section>

            {/* Section 6 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">6.</span> Required Use of Partner Gear
              </h3>
              <p>
                When you accept a campaign, you agree to wear and properly display the required Partner Gear during the campaign's designated Active Period.
              </p>
              <p>
                If a campaign requires you to wear a particular item while performing delivery work, you must wear that item during the applicable campaign-active period in accordance with the campaign requirements.
              </p>
              <p>You agree not to:</p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700">
                <li>Intentionally conceal required campaign branding;</li>
                <li>Alter, remove, cover, or materially damage campaign branding;</li>
                <li>Wear competing or conflicting promotional apparel when prohibited by the applicable campaign;</li>
                <li>Represent yourself as an employee or official representative of the Partner unless expressly authorized;</li>
                <li>Use Partner trademarks outside the scope of the campaign; or</li>
                <li>Misrepresent your participation in the campaign.</li>
              </ul>
              <p>
                The Partner Gear must be worn in a reasonably visible and presentable manner consistent with the applicable campaign instructions.
              </p>
            </section>

            {/* Section 7 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">7.</span> Delivery Work and Personal Safety
              </h3>
              <p>
                Nothing in this Agreement requires you to perform delivery work that you would not otherwise choose to perform.
              </p>
              <p>
                You remain responsible for determining when, where, and how you perform your delivery work, subject to the requirements of the delivery platform or service you independently use.
              </p>
              <p>
                You must comply with all applicable traffic, transportation, safety, and other laws while performing delivery work.
              </p>
              <p className="font-bold text-rose-950 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                Safety takes priority over campaign participation.
              </p>
              <p>
                You should not wear or use Partner Gear in a manner that creates an unreasonable safety hazard, interferes with your ability to operate a bicycle, motorcycle, automobile, or other vehicle, or violates applicable law or the rules of a delivery platform.
              </p>
            </section>

            {/* Section 8 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">8.</span> Daily Campaign Payments
              </h3>
              <p>
                Eligible Participants may earn a daily campaign payment for each campaign-active day that the Participant:
              </p>
              <ol className="list-decimal list-inside space-y-1 pl-2 text-slate-700">
                <li>Has accepted the applicable campaign;</li>
                <li>Has the required Partner Gear;</li>
                <li>Wears the required Partner Gear during the applicable campaign-active period;</li>
                <li>Performs qualifying delivery activity during the applicable period; and</li>
                <li>Satisfies any applicable campaign verification requirements.</li>
              </ol>
              <p>
                The applicable daily payment amount will be displayed to the Participant before or when the Participant accepts the applicable campaign.
              </p>
              <p className="font-bold text-slate-900">
                Payment is earned based on qualifying campaign participation, not merely possession of Partner Gear.
              </p>
              <p>
                Campaign payments are calculated according to the applicable campaign's rules and may be subject to verification.
              </p>
            </section>

            {/* Section 9 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">9.</span> Campaign Verification
              </h3>
              <p>
                MutualPool may use reasonable verification methods to confirm that campaign requirements have been satisfied.
              </p>
              <p>Verification may include, where applicable:</p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700">
                <li>Campaign check-ins;</li>
                <li>Delivery activity records;</li>
                <li>Time and date information;</li>
                <li>Campaign participation confirmations;</li>
                <li>Photographic or other evidence;</li>
                <li>App-based activity;</li>
                <li>Partner verification;</li>
                <li>Geographic or route verification; or</li>
                <li>Other reasonable campaign verification methods disclosed to you.</li>
              </ul>
              <p>
                You agree to provide truthful and accurate information when completing campaign verification.
              </p>
              <p>
                You must not create false activity, submit fraudulent evidence, manipulate campaign records, or otherwise attempt to obtain payments for campaign activity that did not occur.
              </p>
            </section>

            {/* Section 10 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">10.</span> Payment Timing
              </h3>
              <p>
                Once qualifying campaign participation has been verified, the applicable daily campaign payment will be credited according to the payment schedule displayed for the campaign.
              </p>
              <p>
                Where the campaign specifies <strong>daily payment</strong>, eligible earnings will be processed for each qualifying campaign day.
              </p>
              <p>
                Payment processing may require reasonable processing time for verification, banking, or payment-network settlement.
              </p>
              <p>
                Payments may be subject to applicable tax reporting, withholding, payment-processing requirements, or other legally required deductions.
              </p>
            </section>

            {/* Section 11 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">11.</span> No Payment for Unfulfilled Campaign Requirements
              </h3>
              <p>
                A Participant does not earn a campaign payment for a day on which the Participant fails to satisfy the applicable campaign requirements.
              </p>
              <p>Examples may include:</p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700">
                <li>Failing to wear the required Partner Gear;</li>
                <li>Wearing the required gear outside the campaign-active period;</li>
                <li>Failing to perform the required qualifying activity;</li>
                <li>Intentionally concealing campaign branding;</li>
                <li>Failing required verification;</li>
                <li>Submitting inaccurate or fraudulent campaign information; or</li>
                <li>Participating outside the geographic or other requirements of the campaign.</li>
              </ul>
              <p>
                Where campaign rules permit partial participation, payment will be determined according to the applicable campaign terms.
              </p>
            </section>

            {/* Section 12 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">12.</span> Partner Gear Care and Responsibility
              </h3>
              <p>
                You agree to take reasonable care of all Partner Gear provided to you.
              </p>
              <p>
                You must not intentionally damage, modify, resell, transfer, or commercially exploit Partner Gear unless expressly authorized by MutualPool or the applicable Partner.
              </p>
              <p>
                If Partner Gear is lost, stolen, or damaged, you should report the incident through the MutualPool platform as soon as reasonably practicable.
              </p>
              <p>
                Certain campaigns may require Partner Gear to be returned, recycled, or retained after the campaign ends. Any such requirement will be disclosed in the applicable campaign instructions.
              </p>
            </section>

            {/* Section 13 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">13.</span> Brand Representation
              </h3>
              <p>
                While participating in a campaign, you agree to represent participating Partner brands professionally and lawfully.
              </p>
              <p>You may not:</p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700">
                <li>Make false or misleading claims about a Partner;</li>
                <li>Impersonate Partner employees;</li>
                <li>Make unauthorized statements on behalf of a Partner;</li>
                <li>Use Partner trademarks outside the campaign;</li>
                <li>Engage in unlawful conduct while representing the campaign; or</li>
                <li>Use campaign materials in a manner reasonably likely to damage the Partner's reputation.</li>
              </ul>
              <p>
                Nothing in this Agreement prevents you from expressing your own lawful opinions or engaging in lawful activity unrelated to the campaign.
              </p>
            </section>

            {/* Section 14 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">14.</span> Independent Participant Status
              </h3>
              <p>
                Participation in the Program does not, by itself, create an employment relationship, partnership, joint venture, agency relationship, or franchise relationship between you and MutualPool or any participating Partner.
              </p>
              <p>
                You are responsible for your own delivery work, equipment, transportation, insurance, taxes, licenses, permits, and other obligations applicable to your independent activities.
              </p>
              <p>
                MutualPool does not control the manner in which you perform your ordinary delivery work.
              </p>
              <p>
                Your participation in the Program does not guarantee any minimum number of delivery opportunities, delivery earnings, campaign opportunities, or future campaigns.
              </p>
            </section>

            {/* Section 15 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">15.</span> Campaign Availability
              </h3>
              <p>Campaigns are offered based on availability and may vary by:</p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700">
                <li>Partner;</li>
                <li>Geographic market;</li>
                <li>Campaign period;</li>
                <li>Participant eligibility;</li>
                <li>Available inventory;</li>
                <li>Pod participation;</li>
                <li>Campaign capacity; or</li>
                <li>Other applicable requirements.</li>
              </ul>
              <p>MutualPool does not guarantee that a campaign will always be available.</p>
              <p>
                MutualPool may introduce, modify, pause, or discontinue campaigns subject to applicable law and the terms communicated for the affected campaign.
              </p>
            </section>

            {/* Section 16 */}
            <section className="space-y-3 bg-blue-50/70 p-4 rounded-xl border border-blue-200">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">16.</span> Opt-In and Opt-Out
              </h3>
              <p>
                Participation in the Partner Brand Ambassador & Campaign Gear Program is voluntary.
              </p>
              <p>
                Before a Pod becomes <strong>ACTIVE</strong>, the Pod Creator will be presented with this Agreement and may choose:
              </p>
              <div className="space-y-2 pt-1">
                <div className="bg-white p-3 rounded-lg border border-blue-200">
                  <div className="font-black text-slate-900 text-xs uppercase tracking-wider text-emerald-700">OPT IN</div>
                  <p className="text-xs text-slate-700 mt-0.5">
                    By selecting <strong>Opt In</strong>, you agree to the requirements of this Agreement and become eligible to participate in applicable Partner campaigns.
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-blue-200">
                  <div className="font-black text-slate-900 text-xs uppercase tracking-wider text-slate-700">OPT OUT</div>
                  <p className="text-xs text-slate-700 mt-0.5">
                    By selecting <strong>Opt Out</strong>, you decline participation in the Partner Brand Ambassador & Campaign Gear Program. Opting out does not, by itself, prevent the Pod from continuing as a MutualPool savings circle, provided all requirements of the applicable Mutual Pod Savings Agreement are satisfied.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 17 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">17.</span> Electronic Signature
              </h3>
              <p>By selecting <strong>Sign & Opt In</strong>, you acknowledge that:</p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700">
                <li>You have read and understood this Agreement;</li>
                <li>You agree to be legally bound by its terms;</li>
                <li>The electronic signature displayed below is your electronic signature;</li>
                <li>You intend your electronic signature to have the same legal effect as a handwritten signature to the extent permitted by applicable law; and</li>
                <li>The name displayed below accurately identifies you as the person accepting this Agreement.</li>
              </ul>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs font-mono bg-slate-100/90 p-3 rounded-lg border border-slate-200">
                <div><strong>Participant First Name:</strong> {firstName || '[PRE-FILLED]'}</div>
                <div><strong>Participant Last Name:</strong> {lastName || '[PRE-FILLED]'}</div>
                <div><strong>Electronic Signature:</strong> {isValidSignature ? `/s/ ${fullName}` : '[PRE-FILLED / SIGN]'}</div>
                <div><strong>Date:</strong> {effectiveDateStr}</div>
              </div>
            </section>

            {/* Section 18 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">18.</span> Agreement Records
              </h3>
              <p>
                A copy of this Agreement and the Participant's acceptance record may be retained electronically by MutualPool.
              </p>
              <p>The electronic record may include:</p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700">
                <li>Agreement version;</li>
                <li>Participant identity;</li>
                <li>Signature;</li>
                <li>Date and time of acceptance;</li>
                <li>Campaign information;</li>
                <li>Opt-in status; and</li>
                <li>Other information reasonably necessary to establish the Participant's acceptance and participation.</li>
              </ul>
            </section>

            {/* Section 19 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">19.</span> Suspension or Termination of Campaign Participation
              </h3>
              <p>
                MutualPool may suspend or terminate a Participant's campaign participation if it reasonably determines that the Participant:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700">
                <li>Violated this Agreement;</li>
                <li>Failed to satisfy campaign requirements;</li>
                <li>Submitted fraudulent or materially inaccurate information;</li>
                <li>Attempted to manipulate campaign payments or verification;</li>
                <li>Misused Partner Gear;</li>
                <li>Engaged in conduct that materially harms a Partner or the Program; or</li>
                <li>Is otherwise no longer eligible for the applicable campaign.</li>
              </ul>
              <p>
                Termination or suspension of campaign participation does not automatically terminate the Participant's MutualPool Pod membership or savings-circle participation unless otherwise provided under the applicable agreement.
              </p>
              <p>
                Eligible campaign earnings properly earned before suspension or termination will be handled according to the applicable campaign payment terms and applicable law.
              </p>
            </section>

            {/* Section 20 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">20.</span> Changes to Campaign Terms
              </h3>
              <p>
                Campaign-specific terms may vary between campaigns.
              </p>
              <p>
                Before accepting a campaign, you will be provided with the material campaign terms applicable to that campaign, including the applicable payment amount and active period.
              </p>
              <p>
                A material change to an already accepted campaign will be communicated through the MutualPool platform or another appropriate communication method.
              </p>
            </section>

            {/* Section 21 */}
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">21.</span> Entire Agreement
              </h3>
              <p>
                This Agreement governs participation in the Partner Brand Ambassador & Campaign Gear Program.
              </p>
              <p>
                It does not replace or modify the <strong>Mutual Pod Savings Agreement</strong>, which separately governs the Participant's participation in the MutualPool savings circle.
              </p>
              <p>
                Where the two agreements address different subjects, each agreement applies to its respective subject matter.
              </p>
            </section>

            {/* Section 22 */}
            <section className="space-y-3 bg-slate-100 p-4 rounded-xl border border-slate-300">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span className="text-[#005FB8]">22.</span> Acknowledgment
              </h3>
              <p className="font-bold text-slate-900">
                By selecting <strong>Sign & Opt In</strong>, I confirm that:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2 font-medium text-slate-800 text-xs">
                <li>I understand that I must wear the required Partner Gear during the campaign's designated active periods in order to earn the applicable daily campaign payment.</li>
                <li>I understand that I must provide an accurate physical address or approved pickup information when Partner Gear must be delivered or collected.</li>
                <li>I understand that campaign payments are earned for qualifying campaign participation and are not automatically guaranteed merely because I receive Partner Gear.</li>
                <li>I agree to comply with the applicable campaign requirements and verification procedures.</li>
                <li>I understand that participation in the Partner Brand Ambassador & Campaign Gear Program is optional.</li>
              </ul>
            </section>
          </div>

          {/* Form for Electronic Signature & Participant Acceptance */}
          <form id="campaign-agreement-form" onSubmit={handleOptInSubmit} className="space-y-4">
            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-[#005FB8] uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Participant Acceptance & Signature</span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Pre-filled from account
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="signer-first-name" className="block text-xs font-bold text-slate-700 mb-1">
                    Participant First Name <span className="text-rose-500">*</span>
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
                    Participant Last Name <span className="text-rose-500">*</span>
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
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs">
                  <span className="text-slate-500 font-medium">Electronic Signature:</span>
                  <span className="font-serif italic font-bold text-slate-900 text-sm">
                    /s/ {fullName}
                  </span>
                </div>
              )}

              {/* Checkbox Participant Acceptance */}
              <div className="pt-2 border-t border-blue-200/80">
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
                  <div className="text-xs sm:text-sm text-slate-900 font-semibold leading-snug">
                    I have read and agree to the Partner Brand Ambassador & Campaign Gear Agreement.
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
                <span>Confirm Opting Out of Partner Ad Program?</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                By selecting <strong>Opt Out</strong>, you decline participation in the Partner Brand Ambassador & Campaign Gear Program. This Pod will continue strictly as a MutualPool savings circle, subject to the applicable Mutual Pod Savings Agreement.
              </p>
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  id="confirm-opt-out-action-btn"
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleOptOutSubmit}
                  className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Confirm Opt Out — Continue as Savings Circle Only'}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowOptOutConfirm(false)}
                  className="px-3.5 py-2 rounded-xl bg-white border border-amber-300 text-amber-900 font-semibold text-xs hover:bg-amber-100/50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions matching copy */}
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
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer order-2 sm:order-1 text-center"
          >
            <span>Opt Out — Continue as Savings Circle Only</span>
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
              <span>Sign & Opt In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
