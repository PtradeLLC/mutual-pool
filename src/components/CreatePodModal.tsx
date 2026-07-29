import React, { useState } from 'react';
import { User, PodSizeTier, DepositTier, PodType, InvitedContact, ActivationPolicy } from '../types';
import { TrustedCircleInviter } from './TrustedCircleInviter';
import { PlusCircle, Lock, ShieldCheck, AlertCircle, Sparkles, X, CheckCircle2, Users, Clock, Zap } from 'lucide-react';

interface CreatePodModalProps {
  user: User;
  onClose: () => void;
  onPodCreated: () => void;
}

export const CreatePodModal: React.FC<CreatePodModalProps> = ({ user, onClose, onPodCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food Delivery & Rideshare');
  const [podType, setPodType] = useState<PodType>('TRUSTED_CIRCLE');
  const [activationPolicy, setActivationPolicy] = useState<ActivationPolicy>('WHEN_FULL');
  const [inviteWindowDays, setInviteWindowDays] = useState<number>(7);
  const [autoOpenOnExpire, setAutoOpenOnExpire] = useState<boolean>(true);
  const [invitedContacts, setInvitedContacts] = useState<InvitedContact[]>([]);
  const [sizeTier, setSizeTier] = useState<PodSizeTier>(20);
  const [depositTier, setDepositTier] = useState<DepositTier>(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default invite code generator preview
  const [generatedInviteCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());

  const isSeasoned = user.accountAgeDays >= 90 || user.completedPodsCount >= 1;
  const canCreateOpenPod = user.completedPodsCount >= 1 || isSeasoned;

  const handleAddContacts = (newItems: { name: string; emailOrPhone: string }[]) => {
    const freshInvites: InvitedContact[] = newItems.map(item => ({
      id: `ic_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: item.name || item.emailOrPhone,
      emailOrPhone: item.emailOrPhone,
      isExistingMember: item.emailOrPhone.includes('gigmutual.app'),
      status: item.emailOrPhone.includes('gigmutual.app') ? 'PENDING_INVITE' : 'INVITED',
      invitedAt: new Date().toISOString(),
    }));

    setInvitedContacts(prev => [...prev, ...freshInvites]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (user.kycStatus !== 'VERIFIED') {
      setError('You must complete Stripe Identity KYC verification before creating a mutual savings pod.');
      return;
    }

    if (podType === 'OPEN_POD' && !canCreateOpenPod) {
      setError('Creating an Open Pod requires having completed at least 1 full Trusted Circle pod cycle with no missed payments.');
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
          podType,
          activationPolicy,
          inviteWindowDays,
          autoOpenOnExpire,
          invitedContacts,
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
      <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-2xl w-full p-6 shadow-2xl relative my-8 text-[#111827] max-h-[85vh] overflow-y-auto">
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

        <form onSubmit={handleCreate} className="space-y-5">
          
          {/* SECTION 1: POD TYPE SELECTION */}
          <div>
            <label className="block text-xs font-bold text-[#111827] mb-2">
              Select Pod Type & Access Rules
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              
              {/* TRUSTED CIRCLE CARD */}
              <div
                onClick={() => setPodType('TRUSTED_CIRCLE')}
                className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2 relative ${
                  podType === 'TRUSTED_CIRCLE'
                    ? 'bg-blue-50/70 border-[#005FB8] ring-2 ring-blue-500/20'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#005FB8] text-sm flex items-center gap-1.5">
                    <Lock className="w-4 h-4" />
                    <span>🔒 Trusted Circle</span>
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-[#005FB8]">Default</span>
                </div>
                <p className="text-[#374151] text-[11px] leading-relaxed">
                  Built from people you already know — contacts from your phone, email, or social invites. Only people you invite can join.
                </p>
                <div className="text-[10px] text-[#005FB8] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Includes Contact Picker & Private Code</span>
                </div>
              </div>

              {/* OPEN POD CARD */}
              <div
                onClick={() => canCreateOpenPod && setPodType('OPEN_POD')}
                className={`p-4 rounded-xl border transition-all space-y-2 relative ${
                  !canCreateOpenPod
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-75'
                    : podType === 'OPEN_POD'
                    ? 'bg-blue-50/70 border-[#005FB8] ring-2 ring-blue-500/20'
                    : 'bg-white border-gray-200 hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#111827] text-sm flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#005FB8]" />
                    <span>🌐 Open Pod</span>
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-[#374151]">Auto-Match</span>
                </div>
                <p className="text-[#374151] text-[11px] leading-relaxed">
                  Open to any verified member on the platform. Pod fills automatically based on availability.
                </p>
                {!canCreateOpenPod && (
                  <span className="text-[10px] text-amber-700 font-medium block">
                    ⚠️ Requires 1 completed Trusted Circle cycle first.
                  </span>
                )}
              </div>

            </div>
          </div>

          {/* SECTION: POD ACTIVATION POLICY SELECTION */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-[#111827]">
                Choose Pod Activation & Lock Timing Policy
              </label>
              <span className="text-[10px] text-[#005FB8] font-bold uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Pod Creator Setting
              </span>
            </div>

            <p className="text-[11px] text-[#6B7280] mb-2.5 leading-relaxed">
              Select when this Pod should lock its rotation order and begin active weekly savings cycles. Full capacity guarantees maximum lump-sum payouts, but flexible activation lets you start earlier.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              
              {/* OPTION A: ACTIVATE ONLY WHEN FULL */}
              <div
                onClick={() => setActivationPolicy('WHEN_FULL')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-2 relative ${
                  activationPolicy === 'WHEN_FULL'
                    ? 'bg-blue-50/70 border-[#005FB8] ring-2 ring-blue-500/20'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#111827] text-xs flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#005FB8]" />
                    <span>Activate Only When 100% Full</span>
                  </span>
                  <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Max Payout
                  </span>
                </div>

                <p className="text-[#374151] text-[11px] leading-relaxed">
                  Wait until all <strong>{sizeTier} member spots</strong> are filled before locking rotation. Guarantees maximum lump-sum payout target for every member.
                </p>

                <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-600 flex items-center justify-between font-mono">
                  <span>Target Payout Pool:</span>
                  <strong className="text-emerald-700 font-bold">${(sizeTier * depositTier).toLocaleString()}/wk</strong>
                </div>
              </div>

              {/* OPTION B: FLEXIBLE EARLY ACTIVATION */}
              <div
                onClick={() => setActivationPolicy('FLEXIBLE_EARLY')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-2 relative ${
                  activationPolicy === 'FLEXIBLE_EARLY'
                    ? 'bg-blue-50/70 border-[#005FB8] ring-2 ring-blue-500/20'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#111827] text-xs flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-600" />
                    <span>Flexible Early Activation</span>
                  </span>
                  <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    Start Before Max
                  </span>
                </div>

                <p className="text-[#374151] text-[11px] leading-relaxed">
                  Allows you (Pod Creator) to lock rotation and activate weekly cycles early as soon as <strong>2+ members</strong> join, without waiting for max capacity.
                </p>

                <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-600 flex items-center justify-between font-mono">
                  <span>Minimum Threshold:</span>
                  <strong className="text-amber-800 font-bold">2 Signed Members</strong>
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 2: TRUSTED CIRCLE INVITE WINDOW & ACCESS CONFIG (IF TRUSTED_CIRCLE) */}
          {podType === 'TRUSTED_CIRCLE' && (
            <div className="p-4 bg-white border border-[#DDE1E6] rounded-xl space-y-3.5 text-xs">
              <div className="flex items-center gap-2 text-sm font-bold text-[#111827]">
                <Clock className="w-4 h-4 text-[#005FB8]" />
                <span>Trusted Circle Invite Window & Expiration Action</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                <div>
                  <label className="block text-[11px] font-semibold text-[#111827] mb-1">
                    Set Invite Window Duration
                  </label>
                  <select
                    value={inviteWindowDays}
                    onChange={(e) => setInviteWindowDays(Number(e.target.value))}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  >
                    <option value={3}>3 Days Invite Window</option>
                    <option value={7}>7 Days Invite Window (Default)</option>
                    <option value={14}>14 Days Invite Window</option>
                    <option value={30}>30 Days Invite Window</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#111827] mb-1">
                    If Pod Isn't Full After Window Expires
                  </label>
                  <select
                    value={autoOpenOnExpire ? 'AUTO_OPEN' : 'KEEP_WAITING'}
                    onChange={(e) => setAutoOpenOnExpire(e.target.value === 'AUTO_OPEN')}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  >
                    <option value="AUTO_OPEN">Automatically open remaining spots to verified Open Pod members</option>
                    <option value="KEEP_WAITING">Keep waiting for private circle invites only</option>
                  </select>
                </div>

              </div>

              {/* EMBEDDED TRUSTED CIRCLE INVITER TOOL */}
              <TrustedCircleInviter
                invitedContacts={invitedContacts}
                inviteCode={generatedInviteCode}
                podName={name || 'My Trusted Circle Pod'}
                onAddContacts={handleAddContacts}
                currentUser={user}
              />
            </div>
          )}

          {/* SECTION 3: POD NAME & DETAILS */}
          <div className="space-y-3">
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
          <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="text-[#111827] font-bold block">Starting Active Pool (1 Member)</span>
                <span className="text-[11px] text-gray-500">Your initial deposit when pod is formed</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-[#005FB8] font-mono">
                  ${depositTier}.00 / wk
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-[#111827] font-bold block">Full Capacity Payout Target</span>
                <span className="text-[11px] text-gray-500">{sizeTier} members × ${depositTier}/wk</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-extrabold text-emerald-600 font-mono">
                  ${(sizeTier * depositTier).toLocaleString()}.00 / wk
                </span>
              </div>
            </div>

            <p className="text-[10.5px] text-[#6B7280] pt-1">
              💡 <strong>Dynamic Payout Scaling:</strong> Weekly payouts scale automatically as members join. For example, when 5 members join, weekly payout becomes ${5 * depositTier}/wk; when all {sizeTier} members join, payout reaches ${(sizeTier * depositTier).toLocaleString()}/wk.
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-3 border-t border-gray-200">
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
                  <span>Create {podType === 'TRUSTED_CIRCLE' ? 'Trusted Circle' : 'Open'} Pod</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
