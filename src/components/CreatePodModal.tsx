import React, { useState } from 'react';
import { User, PodSizeTier, DepositTier } from '../types';
import { PlusCircle, Lock, ShieldCheck, AlertCircle, Sparkles, X, CheckCircle2 } from 'lucide-react';

interface CreatePodModalProps {
  user: User;
  onClose: () => void;
  onPodCreated: () => void;
}

export const CreatePodModal: React.FC<CreatePodModalProps> = ({ user, onClose, onPodCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food Delivery & Rideshare');
  const [sizeTier, setSizeTier] = useState<PodSizeTier>(20);
  const [depositTier, setDepositTier] = useState<DepositTier>(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSeasoned = user.accountAgeDays >= 90 || user.completedPodsCount >= 1;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (user.kycStatus !== 'VERIFIED') {
      setError('You must complete Stripe Identity KYC verification before creating a mutual savings pod.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/pods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          name,
          description,
          category,
          sizeTier,
          depositTier,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create pod');
      }

      onPodCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Pod creation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-xl w-full p-6 shadow-2xl relative my-8 text-[#111827]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 rounded-xl bg-blue-50 text-[#005FB8]">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#111827]">Create New Mutual Savings Pod</h3>
            <p className="text-xs text-[#6B7280]">Fixed-Rotation Pod with Stripe Treasury Balance</p>
          </div>
        </div>

        {/* Tenure Rule Notice Banner */}
        <div className={`mb-5 p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
          isSeasoned 
            ? 'bg-green-50 border-green-200 text-green-900' 
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          {isSeasoned ? (
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
          ) : (
            <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          )}
          <div>
            <span className="font-bold block mb-0.5">
              {isSeasoned ? 'Tenure Unlocked: Seasoned Account' : '3-Month Tenure Tier Policy'}
            </span>
            <span>
              {isSeasoned
                ? `Account tenure of ${user.accountAgeDays} days unlocks all large pod member tiers (up to 10,000) and $50/$100 deposit tiers.`
                : `New accounts (<90 days tenure) can create 20 or 50 member pods at $5, $10, or $20 weekly tiers. Larger tiers unlock after 3 months of successful operation.`}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#111827] mb-1">Pod Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
              placeholder="e.g. SF East Bay DoorDash Drivers Circle"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111827] mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
            >
              <option value="Food Delivery & Rideshare">Food Delivery & Rideshare</option>
              <option value="Grocery & Cargo">Grocery & Cargo</option>
              <option value="General Gig Workers">General Gig Workers</option>
              <option value="High-Yield Reserve">High-Yield Reserve (Advanced)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111827] mb-1">Description & Purpose</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
              placeholder="Describe purpose (e.g., tax reserves, vehicle maintenance, emergency gear)..."
            />
          </div>

          {/* Member Size Tier Selection */}
          <div>
            <label className="block text-xs font-semibold text-[#111827] mb-1.5">
              Member Capacity Tier
            </label>
            <div className="grid grid-cols-4 gap-2">
              {([20, 50, 100, 500] as PodSizeTier[]).map((tier) => {
                const disabled = !isSeasoned && tier > 50;
                return (
                  <button
                    key={tier}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSizeTier(tier)}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
                      sizeTier === tier
                        ? 'bg-[#005FB8] border-[#005FB8] text-white shadow-xs'
                        : disabled
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{tier} Members</span>
                    {disabled && <span className="text-[9px] text-amber-700 font-mono">3-Mo Req</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Deposit Tier Selection */}
          <div>
            <label className="block text-xs font-semibold text-[#111827] mb-1.5">
              Weekly Deposit Tier
            </label>
            <div className="grid grid-cols-5 gap-2">
              {([5, 10, 20, 50, 100] as DepositTier[]).map((tier) => {
                const disabled = !isSeasoned && tier > 20;
                return (
                  <button
                    key={tier}
                    type="button"
                    disabled={disabled}
                    onClick={() => setDepositTier(tier)}
                    className={`py-2 px-2 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
                      depositTier === tier
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : disabled
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>${tier}/wk</span>
                    {disabled && <span className="text-[9px] text-amber-700 font-mono">Locked</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calculated Weekly Payout Preview */}
          <div className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0] flex items-center justify-between">
            <div>
              <span className="text-[#6B7280] text-xs block font-medium">Full Weekly Pool Payout</span>
              <span className="text-xs text-gray-500">{sizeTier} members × ${depositTier}/wk</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold text-emerald-600 font-mono">
                ${(sizeTier * depositTier).toLocaleString()}
              </span>
              <span className="text-[10px] text-[#6B7280] block">Payout to 1 member/week</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#111827] font-semibold text-xs border border-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs"
            >
              {loading ? (
                <span>Creating Pod & Treasury Account...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Create Pod & Provision Treasury</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
