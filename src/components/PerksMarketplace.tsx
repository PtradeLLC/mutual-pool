import React, { useState, useEffect } from 'react';
import { User, Perk, PerkCategory } from '../types';
import { 
  Gift, Search, Filter, ExternalLink, Copy, Check, PlusCircle, 
  ShieldCheck, HeartPulse, ShieldAlert, Car, Calculator, Smile, Zap, Sparkles, X 
} from 'lucide-react';

interface PerksMarketplaceProps {
  currentUser: User;
  onOpenKYCGate: () => void;
}

const CATEGORIES: (PerkCategory | 'All')[] = [
  'All',
  'Healthcare',
  'Dental',
  'Vision',
  'Legal Assistance',
  'Mental Health',
  'Financial Services',
  'Discounts',
  'Emergency Assistance',
  'Insurance Programs',
  'Retirement',
  'Training',
  'Entertainment',
  'Restaurants',
  'Hotels',
  'Retail Savings',
  'Scholarships',
  'Family Benefits'
];

export const PerksMarketplace: React.FC<PerksMarketplaceProps> = ({ currentUser, onOpenKYCGate }) => {
  const [perks, setPerks] = useState<Perk[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<PerkCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerkForRedeem, setSelectedPerkForRedeem] = useState<Perk | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showAdminTab, setShowAdminTab] = useState(false);
  const [pendingPerks, setPendingPerks] = useState<Perk[]>([]);

  // Form State for Submit
  const [submitTitle, setSubmitTitle] = useState('');
  const [submitCategory, setSubmitCategory] = useState<PerkCategory>('Healthcare');
  const [submitProvider, setSubmitProvider] = useState('');
  const [submitDesc, setSubmitDesc] = useState('');
  const [submitBadge, setSubmitBadge] = useState('15% OFF');
  const [submitRedeemType, setSubmitRedeemType] = useState<'CODE' | 'LINK' | 'VOUCHER'>('CODE');
  const [submitRedeemData, setSubmitRedeemData] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fetchPerks = async () => {
    try {
      const url = new URL('/api/perks', window.location.origin);
      if (selectedCategory !== 'All') url.searchParams.append('category', selectedCategory);
      if (searchQuery) url.searchParams.append('search', searchQuery);

      const res = await fetch(url.toString());
      const data = await res.json();
      setPerks(data);
    } catch (err) {
      console.error('Failed to fetch perks:', err);
    }
  };

  const fetchPending = async () => {
    try {
      const res = await fetch('/api/admin/perks/pending');
      const data = await res.json();
      setPendingPerks(data);
    } catch (err) {
      console.error('Failed to fetch pending perks:', err);
    }
  };

  useEffect(() => {
    fetchPerks();
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    if (showAdminTab) fetchPending();
  }, [showAdminTab]);

  const handleRedeem = async (perk: Perk) => {
    if (currentUser.kycStatus !== 'VERIFIED') {
      onOpenKYCGate();
      return;
    }

    try {
      const res = await fetch('/api/perks/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ perkId: perk.id }),
      });

      const data = await res.json();
      setSelectedPerkForRedeem(data.perk);
    } catch (err) {
      console.error('Redemption failed:', err);
    }
  };

  const handleSubmitPerk = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      const res = await fetch('/api/perks/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          title: submitTitle,
          category: submitCategory,
          provider: submitProvider,
          description: submitDesc,
          valueBadge: submitBadge,
          redemptionType: submitRedeemType,
          redemptionData: submitRedeemData,
        }),
      });

      if (res.ok) {
        setSubmitSuccess(true);
        setTimeout(() => {
          setShowSubmitModal(false);
          setSubmitSuccess(false);
          setSubmitTitle('');
          setSubmitDesc('');
          setSubmitRedeemData('');
        }, 1500);
      }
    } catch (err) {
      console.error('Submit perk error:', err);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleApprovePerk = async (perkId: string) => {
    try {
      const res = await fetch(`/api/admin/perks/${perkId}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchPending();
        fetchPerks();
      }
    } catch (err) {
      console.error('Approve perk error:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Title & Banner */}
      <div className="bg-white border border-[#DDE1E6] rounded-xl p-6 relative overflow-hidden shadow-xs">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-6 h-6 text-[#005FB8]" />
              <h2 className="text-2xl font-bold text-[#111827]">
                Perks & Benefits Marketplace
              </h2>
            </div>
            <p className="text-xs text-[#6B7280] max-w-2xl leading-relaxed">
              Curated healthcare, legal aid, vehicle repair discounts, and tax automation built exclusively for food delivery riders & rideshare drivers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {currentUser.role === 'SUPER_ADMIN' && (
              <button
                onClick={() => setShowAdminTab(!showAdminTab)}
                className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs ${
                  showAdminTab ? 'bg-amber-500 text-white' : 'bg-white text-amber-800 border border-amber-300'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Admin CMS Approvals</span>
              </button>
            )}

            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-4 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Submit Partner Perk</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin CMS Panel */}
      {showAdminTab && (
        <div className="bg-white border border-amber-300 rounded-xl p-5 space-y-3 shadow-xs">
          <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>Admin CMS Pending Perk Submissions ({pendingPerks.length})</span>
          </h3>

          {pendingPerks.length === 0 ? (
            <p className="text-xs text-[#6B7280]">No pending partner perk submissions awaiting approval.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingPerks.map((p) => (
                <div key={p.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#111827]">{p.title}</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono font-semibold">
                      {p.category}
                    </span>
                  </div>
                  <p className="text-[#6B7280]">{p.description}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="text-[10px] text-gray-500">Submitted by {p.submittedBy}</span>
                    <button
                      onClick={() => handleApprovePerk(p.id)}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs"
                    >
                      Approve Perk
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search healthcare, legal aid, oil changes..."
            className="w-full bg-white border border-[#DDE1E6] rounded-lg pl-10 pr-4 py-2.5 text-xs text-[#111827] placeholder-gray-400 focus:outline-none focus:border-[#005FB8] shadow-xs"
          />
        </div>

        {/* Category Scroll Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#005FB8] text-white shadow-xs'
                  : 'bg-white text-[#4B5563] border border-[#DDE1E6] hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Perk Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {perks.map((perk) => (
          <div
            key={perk.id}
            className="bg-white border border-[#DDE1E6] rounded-xl p-5 hover:border-[#005FB8] transition-all flex flex-col justify-between shadow-xs relative"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="px-2.5 py-0.5 rounded bg-blue-50 text-[#005FB8] text-[10px] font-bold border border-blue-200">
                  {perk.category}
                </span>

                <span className="px-2.5 py-0.5 rounded bg-green-50 text-green-700 text-[10px] font-bold border border-green-200">
                  {perk.valueBadge}
                </span>
              </div>

              <h3 className="text-base font-bold text-[#111827] mb-1">
                {perk.title}
              </h3>
              <p className="text-[11px] font-semibold text-[#6B7280] mb-2">
                Provided by {perk.provider}
              </p>
              <p className="text-xs text-[#4B5563] leading-relaxed line-clamp-3 mb-4">
                {perk.description}
              </p>
            </div>

            <div className="pt-3 border-t border-[#DDE1E6] flex items-center justify-between gap-2">
              <span className="text-[10px] text-[#6B7280]">
                {perk.redeemedCount} redeemed
              </span>

              <button
                onClick={() => handleRedeem(perk)}
                className="px-3.5 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors shadow-xs"
              >
                Redeem Benefit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Redemption Modal */}
      {selectedPerkForRedeem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-md w-full p-6 shadow-2xl relative text-[#111827]">
            <button
              onClick={() => setSelectedPerkForRedeem(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-green-50 text-green-700">
                <Gift className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#111827]">Benefit Redeemed!</h3>
                <p className="text-xs text-[#6B7280]">{selectedPerkForRedeem.title}</p>
              </div>
            </div>

            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] text-center space-y-3 mb-5">
              <span className="text-xs text-[#6B7280] block">Your Exclusive Redemption Voucher / Code:</span>

              {selectedPerkForRedeem.redemptionType === 'CODE' && (
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-xl font-bold text-[#005FB8] tracking-wider bg-white px-4 py-2 rounded-lg border border-gray-300 shadow-xs">
                    {selectedPerkForRedeem.redemptionData}
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedPerkForRedeem.redemptionData)}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    {copiedCode ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              )}

              {selectedPerkForRedeem.redemptionType === 'LINK' && (
                <a
                  href={selectedPerkForRedeem.redemptionData}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors shadow-xs"
                >
                  <span>Open Partner Link</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {selectedPerkForRedeem.redemptionType === 'VOUCHER' && (
                <div className="p-3 bg-gray-100 text-slate-950 rounded-lg font-mono text-xs font-bold tracking-widest border border-gray-300">
                  BARCODE: {selectedPerkForRedeem.redemptionData}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedPerkForRedeem(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#111827] font-semibold text-xs border border-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partner Perk Submission Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-lg w-full p-6 shadow-2xl relative text-[#111827]">
            <button
              onClick={() => setShowSubmitModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-[#111827] mb-4">Submit Partner Benefit / Discount</h3>

            {submitSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-900 rounded-lg text-xs mb-4 font-medium">
                Perk submitted successfully! Sent to Admin CMS for approval.
              </div>
            )}

            <form onSubmit={handleSubmitPerk} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#111827] font-semibold mb-1">Perk Title</label>
                <input
                  type="text"
                  required
                  value={submitTitle}
                  onChange={(e) => setSubmitTitle(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  placeholder="e.g. 20% Off Brake Services"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Category</label>
                  <select
                    value={submitCategory}
                    onChange={(e) => setSubmitCategory(e.target.value as PerkCategory)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Provider Name</label>
                  <input
                    type="text"
                    required
                    value={submitProvider}
                    onChange={(e) => setSubmitProvider(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                    placeholder="e.g. Meineke Car Care"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#111827] font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  required
                  value={submitDesc}
                  onChange={(e) => setSubmitDesc(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                />
              </div>

              <div>
                <label className="block text-[#111827] font-semibold mb-1">Redemption Data (Code or Link)</label>
                <input
                  type="text"
                  required
                  value={submitRedeemData}
                  onChange={(e) => setSubmitRedeemData(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  placeholder="e.g. CODE20 or URL"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#111827] font-semibold border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-4 py-2 rounded-lg bg-[#005FB8] text-white font-bold hover:bg-[#004C93] transition-colors shadow-xs"
                >
                  Submit for Admin Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
