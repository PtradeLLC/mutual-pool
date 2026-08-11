import React, { useState, useEffect } from 'react';
import { 
  HeartHandshake, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  DollarSign, 
  ChevronRight,
  Sparkles,
  HelpCircle,
  Building2,
  Calendar,
  ArrowLeftRight,
  Users,
  UserCheck,
  Repeat
} from 'lucide-react';
import { User, Pod, HardshipFundRequest, PodMembership } from '../types';

interface HardshipRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  myPods: Pod[];
  onRequestSubmitted: () => void;
}

export const HardshipRequestModal: React.FC<HardshipRequestModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  myPods,
  onRequestSubmitted,
}) => {
  const [activeTab, setActiveTab] = useState<'hardship' | 'trade'>('hardship');
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [demoBypassTenure, setDemoBypassTenure] = useState<boolean>(false);
  const [userRequests, setUserRequests] = useState<HardshipFundRequest[]>([]);

  // Spot Swap State
  const [targetMemberForSwap, setTargetMemberForSwap] = useState<PodMembership | null>(null);
  const [swapLoading, setSwapLoading] = useState<boolean>(false);
  const [swapErrorMsg, setSwapErrorMsg] = useState<string | null>(null);
  const [swapSuccessMsg, setSwapSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && myPods.length > 0 && !selectedPodId) {
      setSelectedPodId(myPods[0].id);
    }
    if (isOpen) {
      fetchUserRequests();
      setSwapErrorMsg(null);
      setSwapSuccessMsg(null);
      setTargetMemberForSwap(null);
    }
  }, [isOpen, myPods]);

  const fetchUserRequests = async () => {
    try {
      const res = await fetch('/api/hardship/requests', {
        headers: { 'x-user-id': currentUser.id },
      });
      if (res.ok) {
        const data = await res.json();
        setUserRequests(data);
      }
    } catch (err) {
      console.error('Error fetching hardship requests:', err);
    }
  };

  if (!isOpen) return null;

  const selectedPod = myPods.find((p) => p.id === selectedPodId) || myPods[0];

  // Calculate pod tenure days
  let tenureDays = 0;
  if (selectedPod) {
    const member = selectedPod.members.find((m) => m.userId === currentUser.id);
    const joinedAt = member?.joinedAt || selectedPod.createdAt;
    if (joinedAt) {
      const ms = Date.now() - new Date(joinedAt).getTime();
      tenureDays = Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)));
    }
  } else if (currentUser.accountAgeDays) {
    tenureDays = currentUser.accountAgeDays;
  }

  // Calculate 3-month eligibility
  const meets3MonthTenure = tenureDays >= 90 || demoBypassTenure;
  const tenureDaysNeeded = Math.max(0, 90 - tenureDays);

  // Check paid up status
  const isPaidUp = !currentUser.isHardshipInactive && (!currentUser.hardshipOwedUsd || currentUser.hardshipOwedUsd === 0);

  // Check 4-month cooldown
  let meets4MonthCooldown = true;
  let cooldownDaysRemaining = 0;
  if (currentUser.lastHardshipRequestedAt && !demoBypassTenure) {
    const lastTime = new Date(currentUser.lastHardshipRequestedAt).getTime();
    const fourMonthsMs = 120 * 24 * 60 * 60 * 1000;
    const timePassed = Date.now() - lastTime;
    if (timePassed < fourMonthsMs) {
      meets4MonthCooldown = false;
      cooldownDaysRemaining = Math.ceil((fourMonthsMs - timePassed) / (24 * 60 * 60 * 1000));
    }
  }

  // Pending request exists
  const pendingRequest = userRequests.find((r) => r.userId === currentUser.id && r.status === 'PENDING');

  // Overall eligibility
  const isEligible = meets3MonthTenure && isPaidUp && meets4MonthCooldown && !pendingRequest && myPods.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPod) {
      setErrorMsg('Please join or select an active pod to request hardship coverage.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/hardship/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          podId: selectedPod.id,
          reason: reason || 'Financial hardship covering weekly deposit tier',
          bypassTenureCheck: demoBypassTenure,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to submit hardship request.');
      }

      setSuccessMsg(`Your Financial Hardship Fund request for $${data.depositAmount}.00 was submitted! Request forwarded to Pool Creator (${selectedPod.creatorName}) for approval.`);
      setReason('');
      onRequestSubmitted();
      fetchUserRequests();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit hardship request.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSwap = async () => {
    if (!selectedPod || !targetMemberForSwap) return;

    setSwapLoading(true);
    setSwapErrorMsg(null);
    setSwapSuccessMsg(null);

    try {
      const res = await fetch(`/api/pods/${selectedPod.id}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          targetMemberUserId: targetMemberForSwap.userId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to execute spot swap.');
      }

      const currentUserMember = selectedPod.members.find(m => m.userId === currentUser.id);
      const newIndex1 = targetMemberForSwap.rotationIndex;
      const newIndex2 = currentUserMember ? currentUserMember.rotationIndex : '?';

      setSwapSuccessMsg(
        `Mutual spot swap successfully executed with ${targetMemberForSwap.displayName}! You are now in Slot #${newIndex1 + 1} (Week ${newIndex1 + 1}).`
      );
      setTargetMemberForSwap(null);
      onRequestSubmitted();
    } catch (err: unknown) {
      setSwapErrorMsg(err instanceof Error ? err.message : 'Failed to execute spot swap.');
    } finally {
      setSwapLoading(false);
    }
  };

  const depositTier = selectedPod ? selectedPod.depositTier : 20;
  const feeAmount = Math.round(depositTier * 0.07 * 100) / 100;
  const totalPayoff = Math.round((depositTier + feeAmount) * 100) / 100;

  const currentMember = selectedPod?.members?.find((m) => m.userId === currentUser.id);
  const sortedMembers = selectedPod?.members 
    ? [...selectedPod.members].sort((a, b) => (a.rotationIndex ?? 0) - (b.rotationIndex ?? 0))
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[88vh] sm:max-h-[85vh] flex flex-col overflow-hidden border border-[#DDE1E6] my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-[#005FB8] to-blue-800 text-white p-5 sm:p-6 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/15 rounded-xl backdrop-blur-md">
              {activeTab === 'hardship' ? (
                <HeartHandshake className="w-7 h-7 text-white" />
              ) : (
                <ArrowLeftRight className="w-7 h-7 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider bg-white/20 text-white px-2.5 py-0.5 rounded-full">
                  Emergency Mutual Safety Net & Spot Trading
                </span>
              </div>
              <h2 className="text-xl font-bold mt-1">
                {activeTab === 'hardship' ? 'Financial Hardship Fund' : 'Trade Payout Spots (Mutual Swap)'}
              </h2>
            </div>
          </div>
          <p className="text-xs text-blue-100 mt-2 leading-relaxed">
            {activeTab === 'hardship'
              ? "Request an emergency deposit advance when facing unexpected vehicle repairs or income gaps. The fund covers your weekly deposit into the pool so you don't default."
              : "Two pod members can agree to swap their payout order positions at any time. No committee review required — execution is instant upon mutual consent."}
          </p>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/20">
            <button
              type="button"
              onClick={() => setActiveTab('hardship')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'hardship'
                  ? 'bg-white text-[#005FB8] shadow-sm'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <HeartHandshake className="w-4 h-4" />
              <span>Financial Hardship Fund</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('trade')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'trade'
                  ? 'bg-white text-[#005FB8] shadow-sm'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Trade Spots (Swap Positions)</span>
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* TAB 1: FINANCIAL HARDSHIP FUND */}
          {activeTab === 'hardship' && (
            <>
              {/* Rules & Policy Rules Box */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-blue-950 space-y-2">
                <h4 className="font-bold text-sm text-[#005FB8] flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-[#005FB8]" />
                  Financial Hardship Policy & Eligibility Rules
                </h4>
                <ul className="space-y-1.5 text-blue-900 leading-relaxed list-disc list-inside pl-1">
                  <li>
                    <strong>3-Month Membership Requirement:</strong> Members are eligible to request hardship assistance after their first <strong>3 months (90 days)</strong> of participating in a pod.
                  </li>
                  <li>
                    <strong>4-Month Cooldown Window:</strong> Subsequent hardship requests can be submitted once every <strong>4 months (120 days)</strong>, provided your account is fully paid up.
                  </li>
                  <li>
                    <strong>Paid Up Requirement:</strong> Outstanding hardship balances must be paid off in full ($0.00 balance owed) before submitting a subsequent request.
                  </li>
                  <li>
                    <strong>Disbursement & 7% Service Fee:</strong> System disburses your weekly deposit tier directly into the pool. A 7% service fee applies to the payoff balance.
                  </li>
                </ul>
              </div>

              {/* Current Eligibility Status Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-[#4B5563] tracking-wider">Your Eligibility Status</h4>
                  
                  {/* Simulation Toggle for Easy Demo Testing */}
                  <button
                    type="button"
                    onClick={() => setDemoBypassTenure(!demoBypassTenure)}
                    className={`text-[11px] font-mono px-2.5 py-1 rounded-md border font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      demoBypassTenure
                        ? 'bg-purple-100 text-purple-800 border-purple-300'
                        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>{demoBypassTenure ? 'Demo Mode Active (90+ Days Simulated)' : 'Simulate 90+ Day Pod Tenure'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  
                  {/* Rule 1: 3-Month Tenure */}
                  <div className={`p-3.5 rounded-xl border ${meets3MonthTenure ? 'bg-emerald-50/80 border-emerald-200' : 'bg-amber-50/80 border-amber-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#374151] flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#005FB8]" />
                        Pod Tenure
                      </span>
                      {meets3MonthTenure ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-0.5 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 90+ Days
                        </span>
                      ) : (
                        <span className="text-amber-800 font-bold flex items-center gap-0.5 text-[11px]">
                          <Clock className="w-3.5 h-3.5" /> Ineligible
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-extrabold font-mono text-[#111827]">
                      {tenureDays} / 90 Days
                    </div>
                    <p className="text-[11px] text-gray-600 mt-1">
                      {meets3MonthTenure 
                        ? 'Meets 3-month pod membership requirement.' 
                        : `Needs ${tenureDaysNeeded} more days of membership.`}
                    </p>
                  </div>

                  {/* Rule 2: Account Paid Up */}
                  <div className={`p-3.5 rounded-xl border ${isPaidUp ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#374151] flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        Account Status
                      </span>
                      {isPaidUp ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-0.5 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Paid Up
                        </span>
                      ) : (
                        <span className="text-rose-700 font-bold flex items-center gap-0.5 text-[11px]">
                          <AlertCircle className="w-3.5 h-3.5" /> Balance Owed
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-extrabold font-mono text-[#111827]">
                      ${(currentUser.hardshipOwedUsd || 0).toFixed(2)} Owed
                    </div>
                    <p className="text-[11px] text-gray-600 mt-1">
                      {isPaidUp ? 'No outstanding hardship balance.' : 'Pay balance before submitting new request.'}
                    </p>
                  </div>

                  {/* Rule 3: 4-Month Cooldown */}
                  <div className={`p-3.5 rounded-xl border ${meets4MonthCooldown ? 'bg-emerald-50/80 border-emerald-200' : 'bg-amber-50/80 border-amber-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#374151] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#005FB8]" />
                        4-Mo Cooldown
                      </span>
                      {meets4MonthCooldown ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-0.5 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Eligible
                        </span>
                      ) : (
                        <span className="text-amber-800 font-bold flex items-center gap-0.5 text-[11px]">
                          <Clock className="w-3.5 h-3.5" /> Cooldown
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-extrabold font-mono text-[#111827]">
                      {meets4MonthCooldown ? 'Ready' : `${cooldownDaysRemaining} Days Left`}
                    </div>
                    <p className="text-[11px] text-gray-600 mt-1">
                      {meets4MonthCooldown ? 'Allowed every 4 months once paid up.' : 'Subsequent requests wait 120 days.'}
                    </p>
                  </div>

                </div>
              </div>

              {/* Warning / Ineligible Banner */}
              {!isEligible && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-900 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Request Currently Not Eligible</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-amber-800 pl-1">
                    {myPods.length === 0 && (
                      <li>You must join and participate in an active pod first.</li>
                    )}
                    {!meets3MonthTenure && (
                      <li>
                        Requires completing at least <strong>3 months (90 days)</strong> of pod membership. (Toggle "Simulate 90+ Day Pod Tenure" above for demo testing).
                      </li>
                    )}
                    {!isPaidUp && (
                      <li>Your account has an outstanding balance of <strong>${(currentUser.hardshipOwedUsd || 0).toFixed(2)}</strong> that must be paid up first.</li>
                    )}
                    {!meets4MonthCooldown && (
                      <li>Subsequent requests can only be submitted once every <strong>4 months (120 days)</strong>. You have {cooldownDaysRemaining} days remaining.</li>
                    )}
                    {pendingRequest && (
                      <li>You already have a pending hardship request submitted for pod <strong>"{pendingRequest.podName}"</strong>.</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Feedback messages */}
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="block font-bold">Request Submitted Successfully!</strong>
                    <p className="mt-0.5">{successMsg}</p>
                  </div>
                </div>
              )}

              {/* Request Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Select Pod */}
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">
                    Select Active Pod for Hardship Coverage
                  </label>
                  {myPods.length === 0 ? (
                    <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg text-xs text-gray-500">
                      No active pods joined yet. Join a pod first to unlock hardship fund eligibility.
                    </div>
                  ) : (
                    <select
                      value={selectedPodId}
                      onChange={(e) => setSelectedPodId(e.target.value)}
                      disabled={!isEligible}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#DDE1E6] rounded-xl text-xs font-medium text-[#111827] focus:ring-2 focus:ring-[#005FB8] focus:border-transparent outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {myPods.map((pod) => (
                        <option key={pod.id} value={pod.id}>
                          {pod.name} — Weekly Deposit Tier: ${pod.depositTier}.00 ({Math.max(pod.memberCount || 0, pod.members ? pod.members.length : 0, 1)} members)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Financial Breakdown Card */}
                {selectedPod && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-xs">
                    <h5 className="font-bold text-[#111827] flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-[#005FB8]" />
                      Disbursement & Payoff Terms
                    </h5>
                    <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                        <span className="text-[10px] text-gray-500 block uppercase">Weekly Deposit Tier</span>
                        <strong className="text-sm text-[#111827]">${depositTier}.00</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                        <span className="text-[10px] text-gray-500 block uppercase">7% Service Fee</span>
                        <strong className="text-sm text-amber-700">+${feeAmount.toFixed(2)}</strong>
                      </div>
                      <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                        <span className="text-[10px] text-emerald-800 block uppercase font-bold">Total Payoff Amount</span>
                        <strong className="text-sm text-emerald-900 font-extrabold">${totalPayoff.toFixed(2)}</strong>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 italic mt-1">
                      Upon Creator approval, ${depositTier}.00 is deposited directly into the pool. Your account is placed on hold until the total payoff of ${totalPayoff.toFixed(2)} is repaid.
                    </p>
                  </div>
                )}

                {/* Reason Textarea */}
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">
                    Reason for Emergency Hardship Request
                  </label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Unforeseen vehicle repair (alternator failure) requiring immediate funds..."
                    disabled={!isEligible}
                    className="w-full px-3.5 py-2 bg-white border border-[#DDE1E6] rounded-xl text-xs text-[#111827] focus:ring-2 focus:ring-[#005FB8] focus:border-transparent outline-none disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-[#DDE1E6] bg-white hover:bg-gray-50 text-[#374151] font-bold text-xs transition-colors cursor-pointer"
                  >
                    Close
                  </button>

                  <button
                    type="submit"
                    disabled={!isEligible || loading}
                    className="px-5 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <HeartHandshake className="w-4 h-4" />
                    <span>{loading ? 'Submitting Request...' : 'Submit Hardship Request'}</span>
                  </button>
                </div>

              </form>
            </>
          )}

          {/* TAB 2: TRADE PAYOUT SPOTS (MUTUAL SWAP) */}
          {activeTab === 'trade' && (
            <div className="space-y-5">
              
              {/* Mutual Consent Policy Banner */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-950 space-y-2">
                <h4 className="font-bold text-sm text-emerald-900 flex items-center gap-1.5">
                  <ArrowLeftRight className="w-4.5 h-4.5 text-emerald-700" />
                  Instant Spot Trading & Mutual Position Swap
                </h4>
                <p className="text-emerald-800 leading-relaxed">
                  Pod members can trade their payout schedule slots with any willing teammate in the order. 
                  <strong> No committee or admin review required</strong> — as long as both members mutually consent, position swaps execute instantly!
                </p>
              </div>

              {/* Select Pod dropdown */}
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1">
                  Select Pod to View & Trade Payout Positions
                </label>
                {myPods.length === 0 ? (
                  <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg text-xs text-gray-500">
                    You have not joined any pods yet. Join a pod to view and trade rotation order slots.
                  </div>
                ) : (
                  <select
                    value={selectedPodId}
                    onChange={(e) => {
                      setSelectedPodId(e.target.value);
                      setTargetMemberForSwap(null);
                      setSwapErrorMsg(null);
                      setSwapSuccessMsg(null);
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DDE1E6] rounded-xl text-xs font-medium text-[#111827] focus:ring-2 focus:ring-[#005FB8] focus:border-transparent outline-none"
                  >
                    {myPods.map((pod) => (
                      <option key={pod.id} value={pod.id}>
                        {pod.name} — ${pod.depositTier}/wk ({pod.members?.length || 0} Members)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Feedback messages */}
              {swapErrorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{swapErrorMsg}</span>
                </div>
              )}

              {swapSuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="block font-bold">Spot Swap Executed!</strong>
                    <p className="mt-0.5">{swapSuccessMsg}</p>
                  </div>
                </div>
              )}

              {/* Member Rotation Order Table / Cards */}
              {selectedPod && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase text-[#4B5563] tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[#005FB8]" />
                      Current Rotation Order Schedule for "{selectedPod.name}"
                    </h4>
                    {currentMember && (
                      <span className="text-xs font-semibold text-[#005FB8] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                        Your Slot: #{ (currentMember.rotationIndex ?? 0) + 1 } (Week { (currentMember.rotationIndex ?? 0) + 1 })
                      </span>
                    )}
                  </div>

                  <div className="border border-[#DDE1E6] rounded-xl overflow-hidden divide-y divide-[#E5E7EB] bg-white">
                    {sortedMembers.map((member, idx) => {
                      const isSelf = member.userId === currentUser.id;
                      const hasReceived = member.hasReceivedPayout;
                      const currentMemberHasReceived = currentMember?.hasReceivedPayout;
                      const isSwapDisabled = isSelf || hasReceived || currentMemberHasReceived;

                      return (
                        <div 
                          key={member.id || member.userId}
                          className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                            isSelf ? 'bg-blue-50/70' : 'hover:bg-gray-50/80'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${
                              isSelf ? 'bg-[#005FB8] text-white' : 'bg-gray-100 text-gray-700 border border-gray-300'
                            }`}>
                              #{idx + 1}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-[#111827]">
                                  {member.displayName}
                                </span>
                                {isSelf && (
                                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md">
                                    You
                                  </span>
                                )}
                                {hasReceived && (
                                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                    <CheckCircle2 className="w-3 h-3" /> Payout Received
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                                <span>Platform: {member.platform || 'Gig Provider'}</span>
                                <span>•</span>
                                <span>Scheduled Payout: Week {idx + 1}</span>
                              </div>
                            </div>
                          </div>

                          {/* Swap Action Button */}
                          {!isSelf && (
                            <div>
                              {hasReceived || currentMemberHasReceived ? (
                                <span className="text-[11px] text-gray-400 italic bg-gray-100 px-2.5 py-1 rounded-lg">
                                  Payout Processed
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetMemberForSwap(member);
                                    setSwapErrorMsg(null);
                                    setSwapSuccessMsg(null);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                                >
                                  <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Trade Spot</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Confirmation Dialog overlay when target member is selected */}
              {targetMemberForSwap && currentMember && (
                <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border-2 border-emerald-500/50 rounded-2xl p-5 space-y-4 shadow-md animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl">
                      <Repeat className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-[#111827]">
                        Confirm Spot Trade with {targetMemberForSwap.displayName}
                      </h4>
                      <p className="text-xs text-gray-600">
                        Mutual position swap — execution takes effect immediately upon confirmation.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-white p-3.5 rounded-xl border border-emerald-200">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase text-gray-400 font-sans block font-bold">Your Current Position</span>
                      <strong className="text-sm text-[#005FB8] block">Slot #{ (currentMember.rotationIndex ?? 0) + 1 } (Week { (currentMember.rotationIndex ?? 0) + 1 })</strong>
                      <span className="text-[11px] text-gray-500 block font-sans">New Slot after trade: #{ (targetMemberForSwap.rotationIndex ?? 0) + 1 }</span>
                    </div>

                    <div className="space-y-1 border-l border-gray-200 pl-3">
                      <span className="text-[10px] uppercase text-gray-400 font-sans block font-bold">{targetMemberForSwap.displayName}'s Position</span>
                      <strong className="text-sm text-emerald-700 block">Slot #{ (targetMemberForSwap.rotationIndex ?? 0) + 1 } (Week { (targetMemberForSwap.rotationIndex ?? 0) + 1 })</strong>
                      <span className="text-[11px] text-gray-500 block font-sans">New Slot after trade: #{ (currentMember.rotationIndex ?? 0) + 1 }</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setTargetMemberForSwap(null)}
                      disabled={swapLoading}
                      className="px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleExecuteSwap}
                      disabled={swapLoading}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      <span>{swapLoading ? 'Executing Trade...' : 'Execute Mutual Spot Swap'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom Close */}
              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-[#DDE1E6] bg-white hover:bg-gray-50 text-[#374151] font-bold text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
