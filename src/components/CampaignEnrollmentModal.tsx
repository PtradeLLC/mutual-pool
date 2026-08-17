import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  Shirt,
  DollarSign,
  Truck,
  Sparkles,
  ArrowRight,
  MapPin,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { AdCampaign, User, CourierCampaignParticipation } from '../types';

interface CampaignEnrollmentModalProps {
  campaign: AdCampaign;
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onApplySuccess: (participation: CourierCampaignParticipation) => void;
}

export const CampaignEnrollmentModal: React.FC<CampaignEnrollmentModalProps> = ({
  campaign,
  currentUser,
  isOpen,
  onClose,
  onApplySuccess,
}) => {
  const [step, setStep] = useState<'agreement' | 'shipping' | 'success'>('agreement');
  
  // Agreement terms
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedGps, setAgreedGps] = useState(false);
  const [agreedAuthenticity, setAgreedAuthenticity] = useState(false);

  // Sizing & Shipping Details
  const [jacketSize, setJacketSize] = useState('L');
  const [shirtSize, setShirtSize] = useState('L');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState(currentUser.city || 'Chicago');
  const [state, setState] = useState('IL');
  const [zipCode, setZipCode] = useState('');
  const [phone, setPhone] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleNextToShipping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedTerms || !agreedGps || !agreedAuthenticity) {
      setErrorMsg('Please review and check all compliance requirements to proceed.');
      return;
    }
    setErrorMsg(null);
    setStep('shipping');
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!streetAddress || !city || !state || !zipCode) {
      setErrorMsg('Please provide a complete shipping address for your free gear kit delivery.');
      return;
    }

    setErrorMsg(null);

    const newParticipation: CourierCampaignParticipation = {
      id: `part_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.displayName || currentUser.name || 'Verified Courier',
      userEmail: currentUser.email,
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      brandName: campaign.brandName,
      dailyRate: campaign.dailyPayout,
      totalEarningsAccumulated: 0,
      status: 'active',
      apparelDeliveryStatus: 'processing',
      apparelShipmentTracking: `1Z9999999${Math.floor(10000000 + Math.random() * 90000000)}`,
      gearDeliveryAddress: {
        street: streetAddress,
        city,
        state,
        zipCode,
      },
      gearSizes: {
        jacketSize,
        shirtSize,
      },
      enrolledAt: new Date().toISOString().split('T')[0],
    };

    onApplySuccess(newParticipation);
    setStep('success');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="bg-[#F8FAFC] border-b border-slate-200 px-6 py-5 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Brand Ambassador Program
            </span>
            <h2 className="text-xl font-black text-slate-950 mt-1">{campaign.title}</h2>
            <p className="text-xs text-slate-500 font-semibold">{campaign.brandName} • {campaign.targetMetro}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center gap-2 text-xs">
          <span className={`font-bold px-2 py-0.5 rounded-md ${step === 'agreement' ? 'bg-[#005FB8] text-white' : 'bg-emerald-100 text-emerald-800'}`}>
            1. Sponsor Terms
          </span>
          <span className="text-slate-300">→</span>
          <span className={`font-bold px-2 py-0.5 rounded-md ${step === 'shipping' ? 'bg-[#005FB8] text-white' : 'bg-slate-100 text-slate-600'}`}>
            2. Free Apparel Sizing & Shipping
          </span>
          <span className="text-slate-300">→</span>
          <span className={`font-bold px-2 py-0.5 rounded-md ${step === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
            3. Confirmation
          </span>
        </div>

        {/* STEP 1: AGREEMENT & TERMS */}
        {step === 'agreement' && (
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            
            {/* Payout Callout */}
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs text-emerald-800 font-bold uppercase tracking-wider">
                  Daily Supplemental Ambassador Payout
                </div>
                <div className="text-2xl font-black text-emerald-700 font-mono mt-0.5">
                  ${campaign.dailyPayout}.00 <span className="text-xs font-sans text-emerald-900">/ active shift</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Estimated Weekly</div>
                <div className="text-base font-bold text-slate-900 font-mono">
                  ~${campaign.weeklyEstimatedEarnings}.00/wk
                </div>
              </div>
            </div>

            {/* Campaign Rules & Requirements */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Brand Ambassador Commitments
              </h3>
              <div className="space-y-2 text-xs text-slate-600">
                {campaign.requirements.map((req, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{req}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Turnkey Apparel Included */}
            <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-200 space-y-2">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#005FB8]" />
                <span>Turnkey Campaign Apparel Shipped to Your Doorstep:</span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {campaign.gearRequired.map((gear, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 font-bold">
                    ✓ {gear}
                  </span>
                ))}
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={e => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#005FB8] focus:ring-[#005FB8]"
                />
                <span className="text-slate-700">
                  I agree to wear the provided brand apparel and insulated bag during all active delivery shifts for the {campaign.durationWeeks}-week campaign duration.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedGps}
                  onChange={e => setAgreedGps(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#005FB8] focus:ring-[#005FB8]"
                />
                <span className="text-slate-700">
                  I agree to shift verification via delivery route check-ins and standard GPS location confirmation to validate active brand impressions.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedAuthenticity}
                  onChange={e => setAgreedAuthenticity(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#005FB8] focus:ring-[#005FB8]"
                />
                <span className="text-slate-700">
                  I acknowledge that daily earnings ($55–$75/day) are disbursed directly via Stripe Treasury settlement upon daily shift completion.
                </span>
              </label>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNextToShipping}
                className="px-6 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Sizing & Shipping</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        )}

        {/* STEP 2: SIZING & SHIPPING */}
        {step === 'shipping' && (
          <form onSubmit={handleFinalSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1. Select Custom Apparel Sizes
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Thermal Jacket Size
                  </label>
                  <select
                    value={jacketSize}
                    onChange={e => setJacketSize(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#005FB8]"
                  >
                    <option value="S">Small (S)</option>
                    <option value="M">Medium (M)</option>
                    <option value="L">Large (L)</option>
                    <option value="XL">Extra Large (XL)</option>
                    <option value="2XL">2XL</option>
                    <option value="3XL">3XL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jersey / Shirt Size
                  </label>
                  <select
                    value={shirtSize}
                    onChange={e => setShirtSize(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#005FB8]"
                  >
                    <option value="S">Small (S)</option>
                    <option value="M">Medium (M)</option>
                    <option value="L">Large (L)</option>
                    <option value="XL">Extra Large (XL)</option>
                    <option value="2XL">2XL</option>
                    <option value="3XL">3XL</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  2. Free Home Delivery Address
                </h3>
                <span className="text-[10px] text-emerald-600 font-bold">100% Free Shipping</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Street Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1420 N Milwaukee Ave, Apt 3B"
                  value={streetAddress}
                  onChange={e => setStreetAddress(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-[#005FB8]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-[#005FB8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={e => setState(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-[#005FB8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Zip Code</label>
                  <input
                    type="text"
                    required
                    placeholder="60622"
                    value={zipCode}
                    onChange={e => setZipCode(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-[#005FB8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Delivery Alert Phone (SMS tracking)
                </label>
                <input
                  type="tel"
                  placeholder="(312) 555-0199"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-[#005FB8]"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep('agreement')}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Back to Terms
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Enrollment & Ship Gear</span>
              </button>
            </div>

          </form>
        )}

        {/* STEP 3: SUCCESS */}
        {step === 'success' && (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-950">You're Enrolled as an Ambassador!</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Your custom <strong>{campaign.brandName}</strong> apparel and gear kit are being processed for priority delivery to <strong>{streetAddress}, {city}</strong>.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-w-md mx-auto text-left space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Daily Wage Supplement:</span>
                <strong className="text-emerald-600 font-mono font-bold">${campaign.dailyPayout}/day</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Gear Delivery Status:</span>
                <strong className="text-blue-600 font-bold">Processing & Pack</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Verification:</span>
                <strong className="text-slate-800 font-bold">GPS + Delivery Check-in</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Return to Campaign Hub
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
