import React, { useState } from 'react';
import { Pod, User, PodMembership, ReprioritizationRequest, AuditLogEntry, Deposit } from '../types';
import { FDICNoticeBanner } from './FDICNoticeBanner';
import { TrustedCircleInviter } from './TrustedCircleInviter';
import { 
  X, ShieldCheck, FileText, Lock, Users, ArrowRightLeft, DollarSign, 
  Vote, CheckCircle2, AlertTriangle, Activity, Calendar, Award, RefreshCw, Send, ChevronRight, Share2, Clock
} from 'lucide-react';

interface PodDetailModalProps {
  pod: Pod;
  currentUser: User;
  allUsers: User[];
  onClose: () => void;
  onRefreshPod: () => void;
  onOpenAgreementModal: () => void;
  onOpenKYCGate: () => void;
}

export const PodDetailModal: React.FC<PodDetailModalProps> = ({
  pod,
  currentUser,
  allUsers,
  onClose,
  onRefreshPod,
  onOpenAgreementModal,
  onOpenKYCGate,
}) => {
  const [activeTab, setActiveTab] = useState<'rotation' | 'circle' | 'deposits' | 'reprioritize' | 'audit'>('rotation');
  const [depositing, setDepositing] = useState(false);
  const [processingPayout, setProcessingPayout] = useState(false);
  const [reasonInput, setReasonInput] = useState('');
  const [submittingReason, setSubmittingReason] = useState(false);
  const [swapTargetUserId, setSwapTargetUserId] = useState('');
  const [swapping, setSwapping] = useState(false);
  const [convertingOpen, setConvertingOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const userMembership = pod.members.find(m => m.userId === currentUser.id);
  const isMember = !!userMembership;
  const isCreator = pod.createdBy === currentUser.id;
  const isFull = pod.members.length >= pod.sizeTier;
  const currentRecipientIndex = pod.currentCycleWeek - 1;
  const currentRecipientMember = pod.members.find(m => m.rotationIndex === currentRecipientIndex);

  // Handle adding contacts to Trusted Circle
  const handleAddContacts = async (newContacts: { name: string; emailOrPhone: string }[]) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/pods/${pod.id}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ contacts: newContacts }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add contacts');

      setActionSuccess(`Successfully invited ${data.addedContacts.length} contacts to your Trusted Circle!`);
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Adding contacts failed');
    }
  };

  // Convert Trusted Circle to Open Pod
  const handleConvertOpen = async () => {
    setConvertingOpen(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/pods/${pod.id}/convert-open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to convert pod');

      setActionSuccess('Pod converted to Open Pod! Remaining spots are now open to all verified members.');
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setConvertingOpen(false);
    }
  };

  // Lock Pod Action (if all agreements signed and pod is full or ready)
  const handleLockPod = async () => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/pods/${pod.id}/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to lock rotation order');

      setActionSuccess('Pod successfully locked! Fixed rotation order generated via crypto-secure shuffle.');
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Locking failed');
    }
  };

  // Deposit Action
  const handleDeposit = async () => {
    if (currentUser.kycStatus !== 'VERIFIED') {
      onOpenKYCGate();
      return;
    }

    setDepositing(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/pods/${pod.id}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Deposit failed');

      setActionSuccess(`Deposited $${pod.depositTier}.00 into Treasury holding account ${pod.holdingFinAccountId}.`);
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setDepositing(false);
    }
  };

  // Cycle Payout Action
  const handleProcessPayout = async () => {
    setProcessingPayout(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/pods/${pod.id}/cycle/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payout failed');

      setActionSuccess(`Week ${pod.currentCycleWeek} Payout of $${data.payoutAmount}.00 executed via Stripe Treasury transfer (${data.stripeTransferId}) to ${data.recipientName}!`);
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Payout execution failed');
    } finally {
      setProcessingPayout(false);
    }
  };

  // Submit Reprioritization Request
  const handleSubmitReprioritize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonInput) return;

    setSubmittingReason(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/pods/${pod.id}/reprioritize/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ reason: reasonInput }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Reprioritization request failed');

      setActionSuccess('Submitted emergency reprioritization request to pod members.');
      setReasonInput('');
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmittingReason(false);
    }
  };

  // Cast Vote on Request
  const handleVote = async (requestId: string, vote: 'FOR' | 'AGAINST') => {
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/pods/${pod.id}/reprioritize/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ requestId, vote }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Voting failed');

      setActionSuccess(`Vote cast (${vote}) on reprioritization request.`);
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Vote failed');
    }
  };

  // Execute Slot Swap
  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapTargetUserId) return;

    setSwapping(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/pods/${pod.id}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ targetMemberUserId: swapTargetUserId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Swap failed');

      setActionSuccess('Voluntary slot swap executed and recorded in audit log.');
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Swap failed');
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl relative my-6 max-h-[92vh] flex flex-col text-[#111827]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header & Status */}
        <div className="mb-4 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#005FB8] block">
                  {pod.category} • Treasury Account {pod.holdingFinAccountId}
                </span>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                  pod.podType === 'TRUSTED_CIRCLE' 
                    ? 'bg-blue-50 text-[#005FB8] border-blue-200' 
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {pod.podType === 'TRUSTED_CIRCLE' ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3 text-[#005FB8]" />}
                  <span>{pod.podType === 'TRUSTED_CIRCLE' ? 'Trusted Circle' : 'Open Pod'}</span>
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-[#111827]">
                {pod.name}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenAgreementModal}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <FileText className="w-3.5 h-3.5 text-[#005FB8]" />
                <span>Pod Agreement v2.0</span>
              </button>

              {pod.status === 'FORMING' && pod.members.length >= 2 && (
                <button
                  onClick={handleLockPod}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock Rotation Order</span>
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-[#6B7280] leading-relaxed max-w-3xl mb-2">
            {pod.description}
          </p>

          {/* Trusted Circle Creator Banner & Conversion Controls */}
          {pod.podType === 'TRUSTED_CIRCLE' && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#005FB8] shrink-0" />
                <div>
                  <span className="font-bold block text-[#111827]">
                    Trusted Circle Pod • Private Invite Code: <code className="font-mono text-[#005FB8] bg-white px-1.5 py-0.5 rounded border border-blue-300">{pod.inviteCode || 'BAY2026'}</code>
                  </span>
                  <span className="text-[11px] text-[#4B5563]">
                    Invite Window: {pod.inviteWindowDays || 7} Days • {pod.invitedContacts?.length || 0} Contacts Invited • {pod.autoOpenOnExpire ? 'Auto-opens to Open Pod members after window expires' : 'Stays invite-only'}
                  </span>
                </div>
              </div>

              {isCreator && (
                <button
                  onClick={handleConvertOpen}
                  disabled={convertingOpen}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-[#005FB8] border border-blue-300 font-bold text-[11px] shrink-0 transition-colors shadow-2xs flex items-center gap-1"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{convertingOpen ? 'Converting...' : 'Open Remaining Spots to Public'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* FDIC Disclosure Banner */}
        <div className="mb-4 shrink-0">
          <FDICNoticeBanner />
        </div>

        {/* Key Metrics Dashboard Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 shrink-0">
          <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] text-xs">
            <span className="text-[#6B7280] text-[10px] uppercase font-bold block">Weekly Pool Payout</span>
            <span className="font-mono font-bold text-[#005FB8] text-base">
              ${pod.weeklyPoolTarget.toLocaleString()}
            </span>
          </div>

          <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] text-xs">
            <span className="text-[#6B7280] text-[10px] uppercase font-bold block">This Week Collected</span>
            <span className="font-mono font-bold text-emerald-600 text-base">
              ${pod.currentWeeklyCollected} / ${pod.weeklyPoolTarget}
            </span>
          </div>

          <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] text-xs">
            <span className="text-[#6B7280] text-[10px] uppercase font-bold block">Current Turn Recipient</span>
            <span className="font-semibold text-[#111827] text-xs truncate block">
              {currentRecipientMember ? currentRecipientMember.displayName : 'Awaiting Lock'}
            </span>
          </div>

          <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] text-xs">
            <span className="text-[#6B7280] text-[10px] uppercase font-bold block">Cycle Status</span>
            <span className="font-bold text-amber-700 text-xs uppercase font-mono">
              {pod.status}
            </span>
          </div>
        </div>

        {/* Feedback Message Banners */}
        {actionError && (
          <div className="mb-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{actionError}</span>
          </div>
        )}
        {actionSuccess && (
          <div className="mb-3 p-3 rounded-lg bg-green-50 border border-green-200 text-green-900 text-xs flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#DDE1E6] pb-2 mb-4 shrink-0 flex-wrap">
          <button
            onClick={() => setActiveTab('rotation')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors ${
              activeTab === 'rotation'
                ? 'bg-[#005FB8] text-white shadow-xs'
                : 'text-[#4B5563] hover:bg-gray-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Fixed Rotation ({pod.members.length}/{pod.sizeTier})</span>
          </button>

          {pod.podType === 'TRUSTED_CIRCLE' && (
            <button
              onClick={() => setActiveTab('circle')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors ${
                activeTab === 'circle'
                  ? 'bg-[#005FB8] text-white shadow-xs'
                  : 'text-[#4B5563] hover:bg-gray-100'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Trusted Circle Invites ({pod.invitedContacts?.length || 0})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('deposits')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors ${
              activeTab === 'deposits'
                ? 'bg-[#005FB8] text-white shadow-xs'
                : 'text-[#4B5563] hover:bg-gray-100'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Deposit & Payout Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('reprioritize')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors ${
              activeTab === 'reprioritize'
                ? 'bg-[#005FB8] text-white shadow-xs'
                : 'text-[#4B5563] hover:bg-gray-100'
            }`}
          >
            <Vote className="w-3.5 h-3.5" />
            <span>Emergency Swaps & Votes</span>
          </button>
        </div>

        {/* TAB 1: FIXED ROTATION LIST */}
        {activeTab === 'rotation' && (
          <div className="overflow-y-auto space-y-2 flex-1 pr-1">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-[#4B5563] flex items-center justify-between mb-2">
              <span className="text-[#111827]">
                <strong>Permanent Fixed Order:</strong> Set once at pod lock via cryptographic shuffle. Re-randomization is strictly forbidden.
              </span>
              {pod.status === 'ACTIVE' && isMember && (
                <button
                  onClick={handleDeposit}
                  disabled={depositing}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shrink-0 flex items-center gap-1 shadow-xs"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Deposit ${pod.depositTier} This Week</span>
                </button>
              )}
            </div>

            {pod.members.map((member) => {
              const isCurrentTurn = pod.status === 'ACTIVE' && member.rotationIndex === currentRecipientIndex;
              const isCurrentUserMember = member.userId === currentUser.id;

              return (
                <div
                  key={member.id}
                  className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-3 text-xs ${
                    isCurrentTurn
                      ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                      : isCurrentUserMember
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                      isCurrentTurn ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}>
                      #{member.rotationIndex}
                    </span>

                    <img
                      src={member.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                      alt={member.displayName}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-300 shrink-0"
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#111827] text-sm">{member.displayName}</span>
                        {isCurrentUserMember && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#005FB8] text-[10px] font-semibold">
                            YOU
                          </span>
                        )}
                        {isCurrentTurn && (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-bold animate-pulse">
                            THIS WEEK'S RECIPIENT
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#6B7280]">
                        {member.platform} • Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {member.agreementSignedAt ? (
                      <span className="px-2 py-1 rounded bg-green-50 text-green-700 text-[10px] font-mono border border-green-200 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        Signed
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded bg-amber-50 text-amber-700 text-[10px] font-mono border border-amber-200">
                        Unsigned
                      </span>
                    )}

                    {member.hasReceivedPayout ? (
                      <span className="px-2.5 py-1 rounded bg-blue-50 text-[#005FB8] font-bold text-[10px] border border-blue-200">
                        Paid Out Wk {member.payoutCycleWeek}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded bg-gray-100 text-gray-600 font-mono text-[10px] border border-gray-200">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 1b: TRUSTED CIRCLE MANAGEMENT */}
        {activeTab === 'circle' && (
          <div className="overflow-y-auto space-y-4 flex-1 pr-1">
            <TrustedCircleInviter
              invitedContacts={pod.invitedContacts || []}
              inviteCode={pod.inviteCode || 'BAY2026'}
              podName={pod.name}
              onAddContacts={handleAddContacts}
              currentUser={currentUser}
            />
          </div>
        )}
        {activeTab === 'deposits' && (
          <div className="overflow-y-auto space-y-4 flex-1 pr-1 text-xs">
            <div className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#111827] text-sm">Week {pod.currentCycleWeek} Cycle Payout Processor</h4>
                  <p className="text-[#6B7280] text-xs">Stripe Treasury OutboundTransfer to current recipient</p>
                </div>

                <button
                  onClick={handleProcessPayout}
                  disabled={processingPayout || pod.status !== 'ACTIVE'}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs"
                >
                  {processingPayout ? (
                    <span>Executing Treasury Transfer...</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Execute Week {pod.currentCycleWeek} Payout (${pod.weeklyPoolTarget})</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2 border-t border-gray-200 text-[#6B7280]">
                <span>Target Recipient: </span>
                <strong className="text-[#005FB8]">
                  {currentRecipientMember ? currentRecipientMember.displayName : 'N/A'}
                </strong>
                <span> (Rotation #{currentRecipientIndex})</span>
              </div>
            </div>

            <div className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0]">
              <h4 className="font-bold text-[#111827] text-xs mb-3">Treasury Deposit Instructions</h4>
              <p className="text-[#6B7280] text-xs mb-3">
                Deposits move funds directly from your linked external bank account into this pod's Treasury Holding Account <code className="text-[#005FB8] font-mono bg-blue-50 px-1 py-0.5 rounded">{pod.holdingFinAccountId}</code>.
              </p>
              {isMember && (
                <button
                  onClick={handleDeposit}
                  disabled={depositing}
                  className="px-4 py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Submit ${pod.depositTier}.00 Deposit</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: EMERGENCY REPRIORITIZATION & VOLUNTARY SWAPS */}
        {activeTab === 'reprioritize' && (
          <div className="overflow-y-auto space-y-5 flex-1 pr-1 text-xs">
            
            {/* Voluntary Slot Swap Box */}
            {isMember && userMembership && !userMembership.hasReceivedPayout && (
              <div className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0] space-y-3">
                <div className="flex items-center gap-2 text-[#005FB8] font-bold">
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Voluntary Rotation Slot Swap</span>
                </div>
                <p className="text-[#6B7280]">
                  Swap rotation queue positions with another consenting pod member. Both positions will update instantly and be recorded in the audit log.
                </p>

                <form onSubmit={handleSwap} className="flex items-center gap-2">
                  <select
                    value={swapTargetUserId}
                    onChange={(e) => setSwapTargetUserId(e.target.value)}
                    className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-[#111827] flex-1 focus:outline-none focus:border-[#005FB8]"
                  >
                    <option value="">Select Member to Swap With...</option>
                    {pod.members
                      .filter(m => m.userId !== currentUser.id && !m.hasReceivedPayout)
                      .map(m => (
                        <option key={m.userId} value={m.userId}>
                          {m.displayName} (Rotation #{m.rotationIndex})
                        </option>
                      ))}
                  </select>

                  <button
                    type="submit"
                    disabled={swapping || !swapTargetUserId}
                    className="px-4 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-xs transition-colors shrink-0 shadow-xs"
                  >
                    Execute Swap
                  </button>
                </form>
              </div>
            )}

            {/* Submit Emergency Reprioritization Request */}
            {isMember && (
              <div className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0] space-y-3">
                <div className="flex items-center gap-2 text-amber-700 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Submit Emergency Reprioritization Request</span>
                </div>
                <p className="text-[#6B7280]">
                  Experiencing hardship (e.g. vehicle repair)? Request early advancement. Requires a pod vote meeting 50%+1 quorum ({Math.floor(pod.members.length / 2) + 1} votes).
                </p>

                <form onSubmit={handleSubmitReprioritize} className="space-y-3">
                  <textarea
                    rows={2}
                    required
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8]"
                    placeholder="State reason for emergency reprioritization request..."
                  />

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingReason || !reasonInput}
                      className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs"
                    >
                      Submit Hardship Request
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
