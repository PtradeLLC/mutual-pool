import React, { useState, useEffect } from 'react';
import { Pod, User, PodMembership, ReprioritizationRequest, AuditLogEntry, Deposit, HardshipFundRequest } from '../types';
import { FDICNoticeBanner } from './FDICNoticeBanner';
import { TrustedCircleInviter } from './TrustedCircleInviter';
import { CampaignAdAgreementModal } from './CampaignAdAgreementModal';
import { subscribeToAuditLogs } from '../lib/firestoreService';
import { useChat } from '../context/ChatContext';
import { useTranslation, TranslationKey } from '../i18n';
import { 
  X, ShieldCheck, FileText, Lock, Users, ArrowRightLeft, DollarSign, Sparkles,
  Vote, CheckCircle2, AlertTriangle, Activity, Calendar, Award, RefreshCw, Send, ChevronRight, Share2, Clock, Zap, HeartHandshake, AlertCircle, Shirt, MessageSquare
} from 'lucide-react';

interface PodDetailModalProps {
  pod: Pod;
  initialTab?: 'rotation' | 'circle' | 'deposits' | 'reprioritize' | 'audit' | 'hardship';
  currentUser: User;
  allUsers: User[];
  onClose: () => void;
  onRefreshPod: () => void;
  onOpenAgreementModal: () => void;
}

export const PodDetailModal: React.FC<PodDetailModalProps> = ({
  pod,
  initialTab = 'rotation',
  currentUser,
  allUsers,
  onClose,
  onRefreshPod,
  onOpenAgreementModal,
}) => {
  const { t, language } = useTranslation();
  const { openPodChat, startDirectChat } = useChat();
  const [activeTab, setActiveTab] = useState<'rotation' | 'circle' | 'deposits' | 'reprioritize' | 'audit' | 'hardship'>(initialTab);
  const [podLogs, setPodLogs] = useState<AuditLogEntry[]>([]);
  const [depositing, setDepositing] = useState(false);
  const [processingPayout, setProcessingPayout] = useState(false);
  const [reasonInput, setReasonInput] = useState('');
  const [submittingReason, setSubmittingReason] = useState(false);
  const [swapTargetUserId, setSwapTargetUserId] = useState('');
  const [swapping, setSwapping] = useState(false);
  const [convertingOpen, setConvertingOpen] = useState(false);
  const [withdrawingPayout, setWithdrawingPayout] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Financial Hardship Fund States
  const [hardshipRequests, setHardshipRequests] = useState<HardshipFundRequest[]>([]);
  const [showHardshipForm, setShowHardshipForm] = useState(false);
  const [hardshipReason, setHardshipReason] = useState('');
  const [submittingHardship, setSubmittingHardship] = useState(false);
  const [approvingHardship, setApprovingHardship] = useState(false);
  const [repayingHardship, setRepayingHardship] = useState(false);

  // Partner Ad Campaign Agreement Modal States (For Pod Creator right before Active status)
  const [showCampaignAgreementModal, setShowCampaignAgreementModal] = useState(false);
  const [submittingAgreement, setSubmittingAgreement] = useState(false);
  const [recoveringMemberId, setRecoveringMemberId] = useState<string | null>(null);

  const fetchHardshipRequests = async () => {
    try {
      const res = await fetch('/api/hardship/requests', {
        headers: { 'x-user-id': currentUser.id },
      });
      if (res.ok) {
        const data = await res.json();
        setHardshipRequests(data);
      }
    } catch (err) {
      console.error('Error fetching hardship requests:', err);
    }
  };

  useEffect(() => {
    fetchHardshipRequests();

    const fetchPodLogs = async () => {
      try {
        const res = await fetch('/api/audit-logs');
        if (res.ok) {
          const data: AuditLogEntry[] = await res.json();
          setPodLogs(data.filter(l => l.podId === pod.id));
        }
      } catch (err) {
        console.error('Failed to fetch pod audit logs:', err);
      }
    };
    fetchPodLogs();
    const unsubscribe = subscribeToAuditLogs((firestoreLogs) => {
      if (firestoreLogs && firestoreLogs.length > 0) {
        setPodLogs(firestoreLogs.filter(l => l.podId === pod.id));
      }
    });
    return () => unsubscribe();
  }, [pod.id, currentUser.id]);

  const handleRequestHardship = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingHardship(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch('/api/hardship/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          podId: pod.id,
          reason: hardshipReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Request failed');

      setActionSuccess(`Financial Hardship Fund requested ($${data.depositAmount}.00). Sent to Pool Creator (${pod.creatorName}) for approval.`);
      setShowHardshipForm(false);
      setHardshipReason('');
      fetchHardshipRequests();
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Hardship request failed');
    } finally {
      setSubmittingHardship(false);
    }
  };

  const handleApproveHardship = async (requestId: string) => {
    setApprovingHardship(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch('/api/hardship/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ requestId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Approval failed');

      setActionSuccess(`Financial Hardship Fund APPROVED! System disbursed $${data.request.depositAmount}.00 deposit into pool. User account placed on hold, and pool converted to OPEN to recruit replacement.`);
      fetchHardshipRequests();
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setApprovingHardship(false);
    }
  };

  const handleRepayHardship = async (requestId: string) => {
    setRepayingHardship(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch('/api/hardship/repay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ requestId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Repayment failed');

      setActionSuccess(`Hardship Fund paid off ($${data.request.totalPayoffAmount.toFixed(2)} including 7% fee)! Account reactivated for pool participation.`);
      fetchHardshipRequests();
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Repayment failed');
    } finally {
      setRepayingHardship(false);
    }
  };

  const activeId = currentUser?.id;
  const activeEmail = currentUser?.email?.trim().toLowerCase();
  const activeName = currentUser?.displayName?.trim().toLowerCase();

  const userMembership = pod.members?.find(m => {
    if (!m) return false;
    if (activeId && m.userId === activeId) return true;
    if (activeEmail && (m as any).email && (m as any).email.trim().toLowerCase() === activeEmail) return true;
    if (activeName && m.displayName && m.displayName.trim().toLowerCase() === activeName) return true;
    return false;
  });

  const isCreator = Boolean(
    (activeId && pod.createdBy === activeId) ||
    (activeName && pod.creatorName && pod.creatorName.trim().toLowerCase() === activeName)
  );

  const isStoredInLocal = typeof window !== 'undefined' && Boolean(
    (activeId && localStorage.getItem(`mutualpool_my_pod_${activeId}_${pod.id}`) === 'true') ||
    localStorage.getItem(`mutualpool_my_pod_${pod.id}`) === 'true'
  );

  const isMember = Boolean(userMembership || isCreator || isStoredInLocal);

  let effectiveMembers = [...(pod.members || [])];
  if (isMember && !userMembership) {
    effectiveMembers.push({
      id: `pm_synthetic_${activeId || 'active'}_${pod.id}`,
      podId: pod.id,
      userId: activeId || 'usr_active',
      displayName: currentUser?.displayName || 'Verified Member',
      avatarUrl: currentUser?.avatarUrl || '',
      platform: currentUser?.platform || 'DoorDash',
      rotationIndex: effectiveMembers.length,
      hasReceivedPayout: false,
      delinquencyStatus: 'CLEAN',
      joinedAt: new Date().toISOString(),
    });
  }

  const memberCount = Math.max(
    1,
    pod.memberCount || 0,
    effectiveMembers.length,
    pod.members ? pod.members.length : 0
  );
  const isFull = memberCount >= pod.sizeTier;
  const currentRecipientIndex = pod.currentCycleWeek - 1;
  const currentRecipientMember = effectiveMembers.find(m => m.rotationIndex === currentRecipientIndex);

  const currentActivePool = memberCount * pod.depositTier;
  const fullCapacityTarget = pod.sizeTier * pod.depositTier;

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

  // Initiate Lock / Activate Pod
  const handleLockPod = (forceEarly = false) => {
    // If the user is the creator and the partner campaign agreement hasn't been submitted/decided yet,
    // open the Partner Campaign Agreement modal first for First & Last Name signature and Opt-in / Opt-out!
    if (isCreator && (!pod.campaignAgreement || pod.campaignAgreement.status === 'PENDING_SIGNATURE')) {
      setShowCampaignAgreementModal(true);
      return;
    }
    handleExecuteLockPod(forceEarly);
  };

  // Lock Pod Action Execution
  const handleExecuteLockPod = async (
    forceEarly = false,
    campaignAgreementData?: {
      optedIn: boolean;
      firstName: string;
      lastName: string;
      acknowledgedTerms?: boolean;
    }
  ) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/pods/${pod.id}/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ 
          forceEarly,
          campaignAgreement: campaignAgreementData ? {
            optedIn: campaignAgreementData.optedIn,
            signerFirstName: campaignAgreementData.firstName,
            signerLastName: campaignAgreementData.lastName,
            acknowledgedTerms: campaignAgreementData.acknowledgedTerms,
          } : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requiresConfirmation) {
          if (window.confirm(`${data.message}\n\nDo you want to lock rotation order and activate early with ${pod.members.length} members now?`)) {
            handleExecuteLockPod(true, campaignAgreementData);
            return;
          }
        }
        throw new Error(data.message || 'Failed to lock rotation order');
      }

      if (campaignAgreementData?.optedIn) {
        setActionSuccess('Pod successfully activated! Partner Campaign Drip enrolled & daily route pay tracking enabled.');
      } else {
        setActionSuccess('Pod successfully locked! Fixed rotation order generated via crypto-secure shuffle.');
      }
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Locking failed');
    }
  };

  const handleConfirmCampaignOptIn = async (agr: { firstName: string; lastName: string; acknowledgedTerms: boolean }) => {
    setSubmittingAgreement(true);
    try {
      await handleExecuteLockPod(pod.activationPolicy === 'WHEN_FULL' && memberCount < pod.sizeTier, {
        optedIn: true,
        firstName: agr.firstName,
        lastName: agr.lastName,
        acknowledgedTerms: agr.acknowledgedTerms,
      });
      setShowCampaignAgreementModal(false);
    } finally {
      setSubmittingAgreement(false);
    }
  };

  const handleConfirmCampaignOptOut = async (agr: { firstName: string; lastName: string }) => {
    setSubmittingAgreement(true);
    try {
      await handleExecuteLockPod(pod.activationPolicy === 'WHEN_FULL' && memberCount < pod.sizeTier, {
        optedIn: false,
        firstName: agr.firstName,
        lastName: agr.lastName,
        acknowledgedTerms: false,
      });
      setShowCampaignAgreementModal(false);
    } finally {
      setSubmittingAgreement(false);
    }
  };

  // Deposit Action
  const handleDeposit = async () => {
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

      const gross = data.grossPayoutAmount || currentActivePool;
      const fee = data.payoutFee || gross * 0.10;
      const net = data.payoutAmount || (gross - fee);

      setActionSuccess(`Week ${pod.currentCycleWeek} Payout executed via Stripe Treasury transfer (${data.stripeTransferId}) to ${data.recipientName}! Gross Pool: $${gross.toFixed(2)} • 10% Payout Fee (-$${fee.toFixed(2)}) -> Net Paid: $${net.toFixed(2)}.`);
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Payout execution failed');
    } finally {
      setProcessingPayout(false);
    }
  };

  // Option A Earmarked Payout Withdrawal Action
  const handleWithdrawPayout = async () => {
    setWithdrawingPayout(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch('/api/treasury/payouts/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ podId: pod.id, amount: currentUser.treasury.balanceUsd }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Withdrawal failed');

      setActionSuccess(`Initiated $${data.amountWithdrawn.toFixed(2)} OutboundTransfer (${data.withdrawTransferId}) from Stripe Treasury to your linked bank account!`);
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Payout withdrawal failed');
    } finally {
      setWithdrawingPayout(false);
    }
  };

  // Recover Missed Deposit: Deduct from Account Balance & Welcome Match Fallback
  const handleRecoverMissedDeposit = async (memberUserId: string, memberName: string) => {
    setRecoveringMemberId(memberUserId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/pods/${pod.id}/recover-missed-deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          memberUserId,
          actionChoice: 'COVER_GAP',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Recovery failed');

      if (data.removedFromPod) {
        setActionSuccess(`⚠️ Insufficient Balance: $${(data.balanceDeducted || 0).toFixed(2)} deducted from balance, remainder $${(data.welcomeMatchUsed || 0).toFixed(2)} covered by Welcome Match Reserve. ${memberName} was removed from pod due to missed deposit default, and "${pod.name}" is now publicly listed as an Open Pod with replacement priority.`);
      } else {
        setActionSuccess(`💳 Full $${(data.balanceDeducted || pod.depositTier).toFixed(2)} deposit auto-deducted directly from ${memberName}'s account balance. Delinquency resolved and standing is now CLEAN.`);
      }
      onRefreshPod();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Missed deposit recovery failed');
    } finally {
      setRecoveringMemberId(null);
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white border border-[#DDE1E6] rounded-2xl max-w-4xl w-full shadow-2xl relative my-auto max-h-[90vh] flex flex-col text-[#111827] overflow-hidden">
        
        {/* Fixed Header */}
        <div className="p-4 sm:p-5 pb-3.5 border-b border-gray-200 shrink-0 bg-white relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors z-10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="pr-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-1.5">
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

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                    pod.activationPolicy === 'FLEXIBLE_EARLY'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}>
                    {pod.activationPolicy === 'FLEXIBLE_EARLY' ? (
                      <>
                        <Zap className="w-3 h-3 text-amber-600" />
                        <span>Early Start Allowed</span>
                      </>
                    ) : (
                      <>
                        <Users className="w-3 h-3 text-emerald-600" />
                        <span>Full Capacity Required</span>
                      </>
                    )}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-[#111827]">
                  {pod.name}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPodChat(pod)}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#005FB8] border border-blue-200 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  title="Open Real-Time Pod Group Chat"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Pod Chat</span>
                </button>

                <button
                  onClick={onOpenAgreementModal}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#005FB8]" />
                  <span>Pod Agreement v2.0</span>
                </button>

                {pod.status === 'FORMING' && memberCount >= 2 && (
                  <button
                    onClick={() => handleLockPod()}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Lock Rotation Order</span>
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-[#6B7280] leading-relaxed max-w-3xl line-clamp-2 sm:line-clamp-none">
              {pod.description}
            </p>
          </div>
        </div>

        {/* Fixed Sub-Navigation Tabs Bar */}
        <div className="px-4 sm:px-5 py-2.5 bg-gray-50 border-b border-gray-200 shrink-0 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('rotation')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'rotation'
                ? 'bg-[#005FB8] text-white shadow-xs'
                : 'text-[#4B5563] hover:bg-gray-200/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Fixed Rotation ({memberCount}/{pod.sizeTier})</span>
          </button>

          {pod.podType === 'TRUSTED_CIRCLE' && (
            <button
              onClick={() => setActiveTab('circle')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
                activeTab === 'circle'
                  ? 'bg-[#005FB8] text-white shadow-xs'
                  : 'text-[#4B5563] hover:bg-gray-200/60'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Trusted Circle Invites ({pod.invitedContacts?.length || 0})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('deposits')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'deposits'
                ? 'bg-[#005FB8] text-white shadow-xs'
                : 'text-[#4B5563] hover:bg-gray-200/60'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Deposit & Payout Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('reprioritize')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'reprioritize'
                ? 'bg-[#005FB8] text-white shadow-xs'
                : 'text-[#4B5563] hover:bg-gray-200/60'
            }`}
          >
            <Vote className="w-3.5 h-3.5" />
            <span>Emergency Swaps & Votes</span>
          </button>

          <button
            onClick={() => setActiveTab('hardship')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'hardship'
                ? 'bg-[#005FB8] text-white shadow-xs'
                : 'text-[#4B5563] hover:bg-gray-200/60'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Financial Hardship Fund</span>
            {hardshipRequests.filter(r => r.podId === pod.id && r.status === 'PENDING').length > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-bold rounded-full">
                {hardshipRequests.filter(r => r.podId === pod.id && r.status === 'PENDING').length}
              </span>
            )}
          </button>
        </div>

        {/* Scrollable Body Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* Feedback Message Banners */}
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{actionError}</span>
            </div>
          )}
          {actionSuccess && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-900 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Key Metrics Dashboard Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] text-xs">
              <span className="text-[#6B7280] text-[10px] uppercase font-bold block">Active Weekly Pool</span>
              <span className="font-mono font-bold text-[#005FB8] text-base">
                ${currentActivePool.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#6B7280] block font-mono">
                {memberCount} member{memberCount === 1 ? '' : 's'} × ${pod.depositTier}/wk
              </span>
            </div>

            <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] text-xs">
              <span className="text-[#6B7280] text-[10px] uppercase font-bold block">Full Capacity Target</span>
              <span className="font-mono font-bold text-slate-700 text-base">
                ${fullCapacityTarget.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#6B7280] block font-mono">
                At {pod.sizeTier} max capacity
              </span>
            </div>

            <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] text-xs">
              <span className="text-[#6B7280] text-[10px] uppercase font-bold block">This Week Collected</span>
              <span className="font-mono font-bold text-emerald-600 text-base">
                ${pod.currentWeeklyCollected} / ${currentActivePool}
              </span>
              <span className="text-[10px] text-[#6B7280] block">
                {Math.min(100, Math.round((pod.currentWeeklyCollected / (currentActivePool || 1)) * 100))}% deposited
              </span>
            </div>

            <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] text-xs">
              <span className="text-[#6B7280] text-[10px] uppercase font-bold block">Current Turn Recipient</span>
              <span className="font-semibold text-[#111827] text-xs truncate block">
                {currentRecipientMember ? currentRecipientMember.displayName : 'Awaiting Lock'}
              </span>
              <span className="text-[10px] font-bold text-amber-700 uppercase font-mono block">
                Status: {pod.status}
              </span>
            </div>
          </div>

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
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-[#005FB8] border border-blue-300 font-bold text-[11px] shrink-0 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{convertingOpen ? 'Converting...' : 'Open Remaining Spots to Public'}</span>
                </button>
              )}
            </div>
          )}

          {/* Pod Activation Policy Information Banner */}
          {pod.status === 'FORMING' && (
            <div className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              pod.activationPolicy === 'FLEXIBLE_EARLY'
                ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            }`}>
              <div className="flex items-center gap-2">
                {pod.activationPolicy === 'FLEXIBLE_EARLY' ? (
                  <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <div>
                  <span className="font-bold block text-[#111827]">
                    Activation Policy: {pod.activationPolicy === 'FLEXIBLE_EARLY' ? '⚡ Flexible Early Activation Allowed' : '🎯 Activate Only When 100% Full'}
                  </span>
                  <span className="text-[11px] text-gray-700">
                    {pod.activationPolicy === 'FLEXIBLE_EARLY'
                      ? `Pod creator (${pod.creatorName}) can lock rotation and start weekly cycles as soon as 2+ members join (${memberCount}/${pod.sizeTier} members current).`
                      : `Configured to auto-lock when all ${pod.sizeTier} member spots fill (${memberCount}/${pod.sizeTier} joined). Creator can also manually lock early if needed.`}
                  </span>
                </div>
              </div>

              {isCreator && memberCount >= 2 && (
                <button
                  onClick={() => handleLockPod(pod.activationPolicy === 'WHEN_FULL')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs shrink-0 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer ${
                    pod.activationPolicy === 'FLEXIBLE_EARLY'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{pod.activationPolicy === 'FLEXIBLE_EARLY' ? 'Lock & Start Early Now' : 'Lock & Activate Early'}</span>
                </button>
              )}
            </div>
          )}

          {/* FDIC Disclosure Banner */}
          <FDICNoticeBanner />

          {/* First-Cycle Contingency Buffer Banner */}
          {pod.contingencyBufferUsd !== undefined && (
            <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start sm:items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0 fill-emerald-600/20" />
                <div>
                  <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                    <span>First-Cycle Contingency Buffer: ${pod.contingencyBufferUsd.toFixed(2)} Active</span>
                    {pod.contingencyBufferUsd > 0 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-600 text-white uppercase tracking-wider">
                        Protected
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                        Fully Drawn
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                    100% Platform-Funded by Mutual Pool Welcome Match (${(pod.welcomeMatchAmountUsd || pod.contingencyBufferInitialUsd || pod.depositTier || 20).toFixed(2)}). Automatically covers member deposit gaps during Cycle 1 so rotation payout timeline stays on schedule.
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-semibold text-emerald-800 shrink-0 bg-white/80 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-emerald-200">
                Non-Withdrawable Pod Reserve
              </div>
            </div>
          )}

          {/* Partner Ad Campaign Status Banner */}
          {pod.campaignAgreement && (
            <div className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
              pod.campaignAgreement.optedIn
                ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-blue-200 text-blue-950'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-start sm:items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                  pod.campaignAgreement.optedIn ? 'bg-[#005FB8] text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  <Shirt className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-sm flex-wrap">
                    <span>
                      {pod.campaignAgreement.optedIn 
                        ? '🎯 Partner Brand Advertising Campaign: Active' 
                        : 'Standard Pod Savings (Partner Ad Campaign: Opted Out)'}
                    </span>
                    {pod.campaignAgreement.optedIn && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-600 text-white uppercase tracking-wider">
                        Free Drip & Daily Pay
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                    {pod.campaignAgreement.optedIn
                      ? `Signed by Pod Creator ${pod.campaignAgreement.signerFullName} on ${new Date(pod.campaignAgreement.signedAt).toLocaleDateString()}. Campaign shirts & gear dispatched to members for daily route earnings.`
                      : `Pod Creator opted out of brand partner campaign. Operating strictly as mutual savings circle.`}
                  </p>
                </div>
              </div>

              {isCreator && (
                <button
                  type="button"
                  onClick={() => setShowCampaignAgreementModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-bold shrink-0 cursor-pointer shadow-2xs self-start sm:self-auto"
                >
                  View Agreement Details
                </button>
              )}
            </div>
          )}

          {/* Capacity & Dynamic Payout Explanation Banner */}
          <div className="p-3 bg-blue-50/80 border border-blue-200/90 rounded-lg text-xs text-blue-950 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[#005FB8]">
              <Users className="w-4 h-4 text-[#005FB8]" />
              <span>How Member Capacity & Dynamic Weekly Payouts Work</span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-[#374151]">
              Weekly payouts in Mutual Savings Pods are directly funded by active participating members. Currently, <strong>{memberCount} participating member{memberCount === 1 ? '' : 's'}</strong> contribute <strong>${pod.depositTier}/wk</strong> each, making the active weekly payout pool <strong>${currentActivePool.toLocaleString()}</strong> per rotation turn. As new members join, weekly payouts automatically scale up to the maximum capacity target of <strong>${fullCapacityTarget.toLocaleString()}</strong> ({pod.sizeTier} members).
            </p>
          </div>

          {/* TAB 1: FIXED ROTATION LIST */}
          {activeTab === 'rotation' && (
            <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-[#4B5563] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
              <div>
                <span className="text-[#111827]">
                  <strong>Permanent Fixed Order:</strong> Set once at pod lock via cryptographic shuffle. Re-randomization is strictly forbidden.
                </span>
                <div className="text-[10px] text-[#005FB8] font-medium mt-1 flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-[#005FB8]" />
                  <span>
                    Network Lineage: Pod Creator ({pod.creatorName}) • {pod.members.filter(m => m.invitedByUserId && m.invitedByUserId !== pod.createdBy).length} Friends of Friends referrals joined
                  </span>
                </div>
              </div>
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
              const isPodCreator = member.userId === pod.createdBy;

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
                      #{member.rotationIndex + 1}
                    </span>

                    <img
                      src={member.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                      alt={member.displayName}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-300 shrink-0"
                    />

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#111827] text-sm">{member.displayName}</span>
                        {isPodCreator && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold border border-purple-200">
                            POD CREATOR
                          </span>
                        )}
                        {isCurrentUserMember && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#005FB8] text-[10px] font-semibold">
                            YOU
                          </span>
                        )}
                        {member.delinquencyStatus === 'DELINQUENT' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200 animate-pulse">
                            MISSED DEPOSIT ($+{pod.depositTier})
                          </span>
                        )}
                        {member.delinquencyStatus === 'GRACE_PERIOD' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                            GRACE PERIOD
                          </span>
                        )}
                        {isCurrentTurn && (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-bold animate-pulse">
                            THIS WEEK'S RECIPIENT
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                        <span>{member.platform} • Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                        {member.invitedByName && !isPodCreator && (
                          <span className="text-[10px] text-[#005FB8] font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            Invited by {member.invitedByName} {member.invitedByUserId === pod.createdBy ? '(1st Degree)' : '(Friend of Friend)'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(member.delinquencyStatus === 'DELINQUENT' || member.delinquencyStatus === 'GRACE_PERIOD') && (isCreator || isCurrentUserMember || currentUser.isAdmin || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'POD_ADMIN' || currentUser.role === 'Admin') && (
                      <button
                        type="button"
                        onClick={() => handleRecoverMissedDeposit(member.userId, member.displayName)}
                        disabled={recoveringMemberId === member.userId}
                        className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] shadow-2xs cursor-pointer flex items-center gap-1 transition-colors disabled:opacity-50"
                        title="Deduct deposit from member account balance. If balance is insufficient, Welcome Match covers remainder and member is removed & pod is publicly listed."
                      >
                        {recoveringMemberId === member.userId ? 'Deducting...' : '⚡ Auto-Deduct / WM Fallback'}
                      </button>
                    )}

                    {!isCurrentUserMember && (
                      <button
                        type="button"
                        onClick={() => startDirectChat({
                          id: member.userId,
                          displayName: member.displayName,
                          avatarUrl: member.avatarUrl,
                          platform: member.platform,
                        })}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#005FB8] border border-slate-200 hover:border-blue-300 transition-colors shadow-2xs cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                        title={`Send direct message to ${member.displayName}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Message</span>
                      </button>
                    )}

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
          <div className="space-y-4">
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
          <div className="space-y-4 text-xs">
            {/* Option A Rule Explanation Banner */}
            <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1.5 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-amber-400 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Automated Weekly Rotation Settlement Protocol (Option A)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                At the end of each weekly cycle, collected pool funds are automatically transferred directly into the rotation recipient's <strong>Stripe Treasury Account</strong>. Funds remain safely earmarked in Treasury until claimed. Members can withdraw funds to their linked bank account immediately or leave them earning yield. <strong>Subsequent rotation cycles never wait, pause, or block for delayed withdrawals.</strong>
              </p>
            </div>

            {/* Payout Earmarked Balance & Bank Withdrawal Control for Current Member */}
            {isMember && (
              <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                      Your Stripe Treasury Account Balance
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black font-mono text-emerald-900">
                        ${currentUser.treasury.balanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {userMembership?.hasReceivedPayout && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold text-[10px]">
                          Payout Earmarked
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-emerald-700 block">
                      Linked External Bank: {currentUser.externalBank?.bankName || 'Chase Checking'} (***{currentUser.externalBank?.last4 || '4821'})
                    </span>
                  </div>

                  <button
                    onClick={handleWithdrawPayout}
                    disabled={withdrawingPayout || currentUser.treasury.balanceUsd <= 0}
                    className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs shrink-0"
                  >
                    {withdrawingPayout ? (
                      <span>Executing Bank Transfer...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Withdraw ${currentUser.treasury.balanceUsd.toFixed(2)} to Linked Bank</span>
                      </>
                    )}
                  </button>
                </div>

                {userMembership?.payoutStripeTransferId && (
                  <div className="pt-2 border-t border-emerald-200/80 text-[11px] text-emerald-800 flex items-center justify-between font-mono">
                    <span>Stripe Treasury Transfer Ref:</span>
                    <span className="font-bold">{userMembership.payoutStripeTransferId}</span>
                  </div>
                )}
              </div>
            )}

            {/* Weekly Cycle Processor Box */}
            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="font-bold text-[#111827] text-sm">Week {pod.currentCycleWeek} Automated Cycle Settlement</h4>
                    <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                      10% Payout Fee Tagged
                    </span>
                  </div>
                  <p className="text-[#6B7280] text-xs">Transfers net pool funds to rotation recipient's Stripe Treasury account after 10% platform payout fee.</p>
                </div>

                <button
                  onClick={handleProcessPayout}
                  disabled={processingPayout || pod.status !== 'ACTIVE'}
                  className="px-4 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs shrink-0 cursor-pointer"
                >
                  {processingPayout ? (
                    <span>Processing Treasury OutboundTransfer...</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Execute Week {pod.currentCycleWeek} Payout (${(currentActivePool * 0.90).toFixed(2)} Net)</span>
                    </>
                  )}
                </button>
              </div>

              {/* 10% Payout Fee Calculation Breakdown */}
              <div className="p-3 bg-white border border-gray-200 rounded-lg text-xs space-y-1 font-mono">
                <div className="flex justify-between text-gray-700">
                  <span>Collective Pool Amount ({memberCount} Members × ${pod.depositTier}):</span>
                  <span>${currentActivePool}.00</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>10% Platform Payout Service Fee:</span>
                  <span>-${(currentActivePool * 0.10).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700 pt-1 border-t border-gray-100 text-sm">
                  <span>Net Total Paid to User ({currentRecipientMember?.displayName || 'Recipient'}):</span>
                  <span>${(currentActivePool * 0.90).toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 text-[#6B7280] flex items-center justify-between text-[11.5px]">
                <div>
                  <span>Current Recipient: </span>
                  <strong className="text-[#005FB8]">
                    {currentRecipientMember ? currentRecipientMember.displayName : 'N/A'}
                  </strong>
                  <span> (Lump-Sum Payout #{currentRecipientIndex + 1})</span>
                </div>
                <span className="font-mono text-emerald-600 font-bold">
                  Collected: ${pod.currentWeeklyCollected} / ${currentActivePool}
                </span>
              </div>
            </div>

            {/* Weekly Deposit Instructions Card */}
            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-[#111827] text-xs">Submit Weekly Contribution</h4>
                <span className="text-[10px] font-semibold text-[#005FB8] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  5% Platform Fee Tagged
                </span>
              </div>
              <p className="text-[#6B7280] text-xs">
                Contributions transfer directly from your linked external bank into this pod's Treasury Holding Account <code className="text-[#005FB8] font-mono bg-blue-50 px-1 py-0.5 rounded">{pod.holdingFinAccountId}</code>.
              </p>
              
              <div className="p-3 bg-white border border-gray-200 rounded-lg text-xs space-y-1 font-mono">
                <div className="flex justify-between text-gray-700">
                  <span>Base Contribution Deposit:</span>
                  <span>${pod.depositTier}.00</span>
                </div>
                <div className="flex justify-between text-[#005FB8]">
                  <span>5% Platform Service Fee:</span>
                  <span>+${(pod.depositTier * 0.05).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-[#111827] pt-1 border-t border-gray-100">
                  <span>Total Total Payment Charged:</span>
                  <span>${(pod.depositTier * 1.05).toFixed(2)}</span>
                </div>
              </div>

              {isMember && (
                <button
                  onClick={handleDeposit}
                  disabled={depositing}
                  className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Submit ${(pod.depositTier * 1.05).toFixed(2)} Weekly Contribution</span>
                </button>
              )}
            </div>

            {/* Pod Deposit & Payout Activity Ledger */}
            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#005FB8]" />
                  <h4 className="font-bold text-[#111827] text-xs">
                    {t('audit.podLedgerTitle', { count: podLogs.length })}
                  </h4>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">
                  {t('audit.podIdLabel')} {pod.id}
                </span>
              </div>

              {podLogs.length === 0 ? (
                <div className="p-4 bg-white border border-gray-200 rounded-lg text-center text-xs text-gray-500">
                  {t('audit.podLedgerEmpty')}
                </div>
              ) : (
                <div className="space-y-2">
                  {podLogs.map((log) => {
                    const actionKey = `audit.action.${log.action}` as TranslationKey;
                    const actionLabel = t(actionKey) !== (actionKey as string) ? t(actionKey) : log.action;
                    const locale = language === 'es' ? 'es-US' : language === 'fr' ? 'fr-FR' : 'en-US';

                    return (
                      <div key={log.id} className="p-3 bg-white border border-gray-200 rounded-lg text-xs space-y-1 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-blue-50 text-[#005FB8] border border-blue-200">
                            {actionLabel}
                          </span>
                          <span className="text-[10px] font-mono text-gray-500">
                            {new Date(log.createdAt).toLocaleString(locale)}
                          </span>
                        </div>
                        <p className="text-[#111827] font-medium leading-relaxed">
                          {log.detail}
                        </p>
                        <div className="text-[10px] text-gray-500 flex items-center justify-between pt-1 border-t border-gray-100">
                          <span>{t('audit.actor')} <strong>{log.actorName}</strong></span>
                          {Boolean(log.metadata?.stripeTransferId) && (
                            <span className="font-mono text-[#005FB8]">
                              {t('audit.refLabel')} {String(log.metadata?.stripeTransferId)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: EMERGENCY REPRIORITIZATION & VOLUNTARY SWAPS */}
        {activeTab === 'reprioritize' && (
          <div className="space-y-5 text-xs">
            
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
                          {m.displayName} (Lump-Sum Payout #{m.rotationIndex + 1})
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
                  Experiencing hardship (e.g. vehicle repair)? Request early advancement. Requires a pod vote meeting 50%+1 quorum ({Math.floor(memberCount / 2) + 1} votes).
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

        {/* TAB 4: FINANCIAL HARDSHIP FUND */}
        {activeTab === 'hardship' && (
          <div className="space-y-5 text-xs text-[#111827]">
            {/* Hardship Overview Header */}
            <div className="bg-gradient-to-r from-blue-900 to-[#005FB8] text-white p-4 sm:p-5 rounded-xl space-y-3 shadow-sm">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-blue-200" />
                <h4 className="font-bold text-sm">Financial Hardship Fund Assistance</h4>
              </div>
              <p className="text-blue-100 text-xs leading-relaxed">
                We understand gig workers can face unexpected vehicle repairs or financial strain. If you struggle to make your weekly deposit, you can request a <strong>Financial Hardship Fund</strong> disbursed on your behalf equal to your deposit tier (<strong>${pod.depositTier}.00</strong>).
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-[11px] font-mono border-t border-blue-400/40">
                <div className="bg-white/10 p-2 rounded border border-white/10">
                  <span className="text-blue-200 block text-[10px] uppercase">Disbursed Amount</span>
                  <span className="font-bold text-white">${pod.depositTier}.00 Covered</span>
                </div>
                <div className="bg-white/10 p-2 rounded border border-white/10">
                  <span className="text-blue-200 block text-[10px] uppercase">Service Fee Tagged</span>
                  <span className="font-bold text-amber-200">+7% (${(pod.depositTier * 0.07).toFixed(2)})</span>
                </div>
                <div className="bg-white/10 p-2 rounded border border-white/10">
                  <span className="text-blue-200 block text-[10px] uppercase">Frequency Limit</span>
                  <span className="font-bold text-emerald-300">1x Every 4 Months</span>
                </div>
              </div>
            </div>

            {/* Section 1: For Members - Request Button / Status */}
            {isMember && (
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-[#111827]">Submit Hardship Request</h5>
                  <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-mono font-bold">
                    Pool Creator Approval Required
                  </span>
                </div>

                {currentUser.isHardshipInactive ? (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Your Account is Currently INACTIVE / ON HOLD</span>
                    </div>
                    <p className="text-amber-800 text-[11.5px]">
                      A Financial Hardship Fund deposit was disbursed on your behalf. Your account is on hold and placed on pause for future pool participation.
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-amber-200 text-xs font-mono font-bold text-amber-950">
                      <span>Payoff Required (Deposit + 7% Fee):</span>
                      <span>${(currentUser.hardshipOwedUsd || (pod.depositTier * 1.07)).toFixed(2)}</span>
                    </div>
                    <button
                      onClick={() => {
                        const activeReq = hardshipRequests.find(r => r.userId === currentUser.id && r.status === 'APPROVED');
                        if (activeReq) handleRepayHardship(activeReq.id);
                      }}
                      disabled={repayingHardship}
                      className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>{repayingHardship ? 'Processing Repayment...' : `Pay $${(currentUser.hardshipOwedUsd || (pod.depositTier * 1.07)).toFixed(2)} & Reactivate Account`}</span>
                    </button>
                  </div>
                ) : showHardshipForm ? (
                  <form onSubmit={handleRequestHardship} className="space-y-3 bg-white p-3 rounded-lg border border-gray-200">
                    <div>
                      <label className="block font-bold text-xs text-gray-700 mb-1">
                        Reason for Financial Hardship Fund Request:
                      </label>
                      <textarea
                        value={hardshipReason}
                        onChange={(e) => setHardshipReason(e.target.value)}
                        placeholder="Brief description of unexpected expense or earnings dip (e.g. car repair, medical expense)..."
                        rows={2}
                        required
                        className="w-full p-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#005FB8]"
                      />
                    </div>
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900 space-y-1 font-mono">
                      <div>• Policy: Eligible after 3 months (90 days) of pod membership</div>
                      <div>• Frequency: Subsequent requests allowed every 4 months once account is paid up</div>
                      <div>• Deposit Funded: ${pod.depositTier}.00</div>
                      <div>• 7% Fee Added on Payoff: +${(pod.depositTier * 0.07).toFixed(2)} (${(pod.depositTier * 1.07).toFixed(2)} total)</div>
                      <div>• Account Status: Set to INACTIVE / HOLD upon Creator approval until paid off</div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowHardshipForm(false)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingHardship}
                        className="px-4 py-1.5 bg-[#005FB8] hover:bg-[#004C93] text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                      >
                        <HeartHandshake className="w-4 h-4" />
                        <span>{submittingHardship ? 'Submitting...' : 'Confirm & Request Hardship Fund'}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                    <div>
                      <span className="font-bold text-xs text-[#111827] block">
                        Need Help Covering This Week's ${pod.depositTier}.00 Deposit?
                      </span>
                      <span className="text-[11px] text-[#6B7280]">
                        Request a hardship fund. Creator approval disburses ${pod.depositTier}.00 to the pool. Payoff is ${(pod.depositTier * 1.07).toFixed(2)}.
                      </span>
                    </div>
                    <button
                      onClick={() => setShowHardshipForm(true)}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                    >
                      <HeartHandshake className="w-4 h-4" />
                      <span>Request Hardship Fund</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Section 2: Pool Creator Review Section */}
            {(isCreator || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'POD_ADMIN') && (
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-[#111827]">
                    Pending Creator Approval Requests ({hardshipRequests.filter(r => r.podId === pod.id && r.status === 'PENDING').length})
                  </h5>
                  <span className="text-[10px] text-[#005FB8] font-mono font-bold">Pool Creator Dashboard</span>
                </div>

                {hardshipRequests.filter(r => r.podId === pod.id && r.status === 'PENDING').length === 0 ? (
                  <div className="p-4 bg-white border border-gray-200 rounded-lg text-center text-xs text-gray-500">
                    No pending Financial Hardship Fund requests for this pod.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {hardshipRequests.filter(r => r.podId === pod.id && r.status === 'PENDING').map((req) => (
                      <div key={req.id} className="p-3 bg-white border border-rose-200 rounded-lg shadow-2xs space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-xs text-[#111827] flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-[#005FB8]" />
                            <span>{req.userName}</span>
                          </div>
                          <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-mono font-bold">
                            Requested ${req.depositAmount}.00 Deposit
                          </span>
                        </div>

                        <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded italic">
                          "{req.reason}"
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500 font-mono">
                          <span>Payoff with 7% fee: ${req.totalPayoffAmount.toFixed(2)}</span>
                          <span>Requested {new Date(req.requestedAt).toLocaleDateString()}</span>
                        </div>

                        <button
                          onClick={() => handleApproveHardship(req.id)}
                          disabled={approvingHardship}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{approvingHardship ? 'Approving...' : `Approve & Disburse $${req.depositAmount}.00 Deposit`}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Section 3: Hardship Request History for Pod */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
              <h5 className="font-bold text-xs text-[#111827]">Hardship Fund Activity Log for Pod</h5>
              {hardshipRequests.filter(r => r.podId === pod.id).length === 0 ? (
                <p className="text-xs text-gray-500">No hardship activity recorded for this pod yet.</p>
              ) : (
                <div className="space-y-2">
                  {hardshipRequests.filter(r => r.podId === pod.id).map((req) => (
                    <div key={req.id} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs flex items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-[#111827]">{req.userName}</span>
                        <span className="text-gray-500 text-[11px] ml-1">
                          — ${req.depositAmount}.00 deposit disbursed ({req.status})
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded font-mono ${
                        req.status === 'APPROVED' ? 'bg-amber-100 text-amber-800' :
                        req.status === 'PAID_OFF' ? 'bg-emerald-100 text-emerald-800' :
                        req.status === 'PENDING' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        </div>
      </div>

      {/* Partner Ad Campaign Agreement Modal for Creator */}
      {showCampaignAgreementModal && (
        <CampaignAdAgreementModal
          isOpen={showCampaignAgreementModal}
          onClose={() => setShowCampaignAgreementModal(false)}
          pod={pod}
          currentUser={currentUser}
          onConfirmOptIn={handleConfirmCampaignOptIn}
          onConfirmOptOut={handleConfirmCampaignOptOut}
          isSubmitting={submittingAgreement}
        />
      )}
    </div>
  );
};
