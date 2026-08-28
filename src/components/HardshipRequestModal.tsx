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
  Repeat,
  Send
} from 'lucide-react';
import { User, Pod, HardshipFundRequest, PodMembership, SwapRequest } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface HardshipRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  allUsers?: User[];
  myPods: Pod[];
  onRequestSubmitted: () => void;
  initialTab?: 'hardship' | 'trade';
}

export const HardshipRequestModal: React.FC<HardshipRequestModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers = [],
  myPods,
  onRequestSubmitted,
  initialTab = 'hardship',
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'hardship' | 'trade'>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
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
  const [notifyingUserId, setNotifyingUserId] = useState<string | null>(null);
  const [notifiedUserIds, setNotifiedUserIds] = useState<Record<string, boolean>>({});
  const [podSwapRequests, setPodSwapRequests] = useState<SwapRequest[]>([]);

  const fetchPodSwapRequests = async (podId: string) => {
    try {
      const res = await fetch(`/api/pods/${podId}/swap-requests`, {
        headers: {
          'x-user-id': currentUser.id,
          'x-user-email': currentUser.email || '',
          'x-user-name': currentUser.displayName || '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setPodSwapRequests(data.swapRequests || []);
      }
    } catch (err) {
      console.error('Error fetching pod swap requests:', err);
    }
  };

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

  useEffect(() => {
    if (isOpen && selectedPodId) {
      fetchPodSwapRequests(selectedPodId);
      const interval = setInterval(() => fetchPodSwapRequests(selectedPodId), 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, selectedPodId]);

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
      setErrorMsg(t('hardship.errorJoinPod'));
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
        throw new Error(data.message || data.error || t('hardship.errorGeneral'));
      }

      setSuccessMsg(t('hardship.successMsg', { amount: data.depositAmount, creator: selectedPod.creatorName }));
      setReason('');
      onRequestSubmitted();
      fetchUserRequests();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t('hardship.errorGeneral'));
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
      const targetId = targetMemberForSwap.userId || targetMemberForSwap.id || targetMemberForSwap.displayName;
      const activeSwapReq = podSwapRequests.find(
        (sr) => {
          const isReqCurrent = sr.requesterUserId === currentUser.id || sr.requesterUserId === currentUser.email || sr.requesterName === currentUser.displayName;
          const isTgtMember = sr.targetUserId === targetId || sr.targetUserId === targetMemberForSwap.userId || sr.targetUserId === targetMemberForSwap.id || sr.targetName === targetMemberForSwap.displayName;
          const isReqMember = sr.requesterUserId === targetId || sr.requesterUserId === targetMemberForSwap.userId || sr.requesterUserId === targetMemberForSwap.id || sr.requesterName === targetMemberForSwap.displayName;
          const isTgtCurrent = sr.targetUserId === currentUser.id || sr.targetUserId === currentUser.email || sr.targetName === currentUser.displayName;
          return (isReqCurrent && isTgtMember) || (isReqMember && isTgtCurrent);
        }
      );

      const res = await fetch(`/api/pods/${selectedPod.id}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-user-email': currentUser.email || '',
          'x-user-name': currentUser.displayName || '',
        },
        body: JSON.stringify({
          targetMemberUserId: targetId,
          swapRequestId: activeSwapReq?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to execute spot swap.');
      }

      const currentUserMember = selectedPod.members.find(m => m.userId === currentUser.id);
      const newIndex1 = targetMemberForSwap.rotationIndex;

      setSwapSuccessMsg(
        t('hardship.swapSuccessMsg', {
          name: targetMemberForSwap.displayName,
          slot: newIndex1 + 1,
          week: newIndex1 + 1,
        })
      );
      setTargetMemberForSwap(null);
      onRequestSubmitted();
      fetchPodSwapRequests(selectedPod.id);
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
                  {t('hardship.headerTag')}
                </span>
              </div>
              <h2 className="text-xl font-bold mt-1">
                {activeTab === 'hardship' ? t('hardship.title') : t('hardship.titleTrade')}
              </h2>
            </div>
          </div>
          <p className="text-xs text-blue-100 mt-2 leading-relaxed">
            {activeTab === 'hardship'
              ? t('hardship.descHardship')
              : t('hardship.descTrade')}
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
              <span>{t('hardship.tabHardship')}</span>
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
              <span>{t('hardship.tabTrade')}</span>
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
                  {t('hardship.policyTitle')}
                </h4>
                <ul className="space-y-1.5 text-blue-900 leading-relaxed list-disc list-inside pl-1">
                  <li>
                    <strong>{t('hardship.rule1Title')}</strong> {t('hardship.rule1Text')}
                  </li>
                  <li>
                    <strong>{t('hardship.rule2Title')}</strong> {t('hardship.rule2Text')}
                  </li>
                  <li>
                    <strong>{t('hardship.rule3Title')}</strong> {t('hardship.rule3Text')}
                  </li>
                  <li>
                    <strong>{t('hardship.rule4Title')}</strong> {t('hardship.rule4Text')}
                  </li>
                </ul>
              </div>

              {/* Current Eligibility Status Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-[#4B5563] tracking-wider">{t('hardship.eligibilityStatusTitle')}</h4>
                  
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
                    <span>{demoBypassTenure ? t('hardship.demoModeActive') : t('hardship.simulateTenure')}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  
                  {/* Rule 1: 3-Month Tenure */}
                  <div className={`p-3.5 rounded-xl border ${meets3MonthTenure ? 'bg-emerald-50/80 border-emerald-200' : 'bg-amber-50/80 border-amber-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#374151] flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#005FB8]" />
                        {t('hardship.podTenure')}
                      </span>
                      {meets3MonthTenure ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-0.5 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {t('hardship.days90Plus')}
                        </span>
                      ) : (
                        <span className="text-amber-800 font-bold flex items-center gap-0.5 text-[11px]">
                          <Clock className="w-3.5 h-3.5" /> {t('hardship.ineligible')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-extrabold font-mono text-[#111827]">
                      {t('hardship.daysCount', { days: tenureDays })}
                    </div>
                    <p className="text-[11px] text-gray-600 mt-1">
                      {meets3MonthTenure 
                        ? t('hardship.tenureMeets')
                        : t('hardship.tenureNeeds', { count: tenureDaysNeeded })}
                    </p>
                  </div>

                  {/* Rule 2: Account Paid Up */}
                  <div className={`p-3.5 rounded-xl border ${isPaidUp ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#374151] flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        {t('hardship.accountStatus')}
                      </span>
                      {isPaidUp ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-0.5 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {t('hardship.paidUp')}
                        </span>
                      ) : (
                        <span className="text-rose-700 font-bold flex items-center gap-0.5 text-[11px]">
                          <AlertCircle className="w-3.5 h-3.5" /> {t('hardship.balanceOwed')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-extrabold font-mono text-[#111827]">
                      {t('hardship.owedAmount', { amount: (currentUser.hardshipOwedUsd || 0).toFixed(2) })}
                    </div>
                    <p className="text-[11px] text-gray-600 mt-1">
                      {isPaidUp ? t('hardship.noBalance') : t('hardship.payBalanceMsg')}
                    </p>
                  </div>

                  {/* Rule 3: 4-Month Cooldown */}
                  <div className={`p-3.5 rounded-xl border ${meets4MonthCooldown ? 'bg-emerald-50/80 border-emerald-200' : 'bg-amber-50/80 border-amber-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#374151] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#005FB8]" />
                        {t('hardship.cooldownTitle')}
                      </span>
                      {meets4MonthCooldown ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-0.5 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {t('hardship.eligible')}
                        </span>
                      ) : (
                        <span className="text-amber-800 font-bold flex items-center gap-0.5 text-[11px]">
                          <Clock className="w-3.5 h-3.5" /> {t('hardship.inCooldown')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-extrabold font-mono text-[#111827]">
                      {meets4MonthCooldown ? t('hardship.ready') : t('hardship.daysLeft', { count: cooldownDaysRemaining })}
                    </div>
                    <p className="text-[11px] text-gray-600 mt-1">
                      {meets4MonthCooldown ? t('hardship.cooldownMsgReady') : t('hardship.cooldownMsgWait')}
                    </p>
                  </div>

                </div>
              </div>

              {/* Warning / Ineligible Banner */}
              {!isEligible && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-900 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{t('hardship.ineligibleBannerTitle')}</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-amber-800 pl-1">
                    {myPods.length === 0 && (
                      <li>{t('hardship.ineligibleJoinPod')}</li>
                    )}
                    {!meets3MonthTenure && (
                      <li>
                        {t('hardship.ineligibleTenureMsg')}
                      </li>
                    )}
                    {!isPaidUp && (
                      <li>{t('hardship.ineligibleBalanceMsg', { amount: (currentUser.hardshipOwedUsd || 0).toFixed(2) })}</li>
                    )}
                    {!meets4MonthCooldown && (
                      <li>{t('hardship.ineligibleCooldownMsg', { count: cooldownDaysRemaining })}</li>
                    )}
                    {pendingRequest && (
                      <li>{t('hardship.ineligiblePendingMsg', { podName: pendingRequest.podName })}</li>
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
                    <strong className="block font-bold">{t('hardship.successTitle')}</strong>
                    <p className="mt-0.5">{successMsg}</p>
                  </div>
                </div>
              )}

              {/* Request Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Select Pod */}
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">
                    {t('hardship.selectPodLabel')}
                  </label>
                  {myPods.length === 0 ? (
                    <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg text-xs text-gray-500">
                      {t('hardship.noPodsWarning')}
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
                          {t('hardship.podOption', {
                            name: pod.name,
                            tier: pod.depositTier,
                            members: Math.max(pod.memberCount || 0, pod.members ? pod.members.length : 0, 1),
                          })}
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
                      {t('hardship.breakdownTitle')}
                    </h5>
                    <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                        <span className="text-[10px] text-gray-500 block uppercase">{t('hardship.weeklyDepositTier')}</span>
                        <strong className="text-sm text-[#111827]">${depositTier}.00</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                        <span className="text-[10px] text-gray-500 block uppercase">{t('hardship.serviceFee7')}</span>
                        <strong className="text-sm text-amber-700">+${feeAmount.toFixed(2)}</strong>
                      </div>
                      <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                        <span className="text-[10px] text-emerald-800 block uppercase font-bold">{t('hardship.totalPayoffAmount')}</span>
                        <strong className="text-sm text-emerald-900 font-extrabold">${totalPayoff.toFixed(2)}</strong>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 italic mt-1">
                      {t('hardship.breakdownNote', { deposit: depositTier, payoff: totalPayoff.toFixed(2) })}
                    </p>
                  </div>
                )}

                {/* Reason Textarea */}
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">
                    {t('hardship.reasonLabel')}
                  </label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t('hardship.reasonPlaceholder')}
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
                    {t('hardship.closeBtn')}
                  </button>

                  <button
                    type="submit"
                    disabled={!isEligible || loading}
                    className="px-5 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <HeartHandshake className="w-4 h-4" />
                    <span>{loading ? t('hardship.submittingBtn') : t('hardship.submitBtn')}</span>
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
                  {t('hardship.tradePolicyTitle')}
                </h4>
                <p className="text-emerald-800 leading-relaxed">
                  {t('hardship.tradePolicyDesc')}
                </p>
              </div>

              {/* Select Pod dropdown */}
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1">
                  {t('hardship.selectPodTradeLabel')}
                </label>
                {myPods.length === 0 ? (
                  <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg text-xs text-gray-500">
                    {t('hardship.noPodsTradeWarning')}
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
                        {t('hardship.podOptionTrade', {
                          name: pod.name,
                          tier: pod.depositTier,
                          members: pod.members?.length || 0,
                        })}
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
                    <strong className="block font-bold">{t('hardship.swapSuccessTitle')}</strong>
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
                      {t('hardship.rotationScheduleTitle', { podName: selectedPod.name })}
                    </h4>
                    {currentMember && (
                      <span className="text-xs font-semibold text-[#005FB8] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                        {t('hardship.yourSlotBadge', {
                          slot: (currentMember.rotationIndex ?? 0) + 1,
                          week: (currentMember.rotationIndex ?? 0) + 1,
                        })}
                      </span>
                    )}
                  </div>

                  <div className="border border-[#DDE1E6] rounded-xl overflow-hidden divide-y divide-[#E5E7EB] bg-white">
                    {sortedMembers.map((member, idx) => {
                      const isSelf = member.userId === currentUser.id;
                      const hasReceived = member.hasReceivedPayout;
                      const currentMemberHasReceived = currentMember?.hasReceivedPayout;

                      // Single Source of Truth for Member Name and KYC Verification
                      const realUser = allUsers.find(u => u.id === member.userId) || (isSelf ? currentUser : null);
                      const rawName = isSelf ? currentUser.displayName : (realUser?.displayName || member.displayName);
                      const memberName = (rawName && rawName !== 'Verified Member' && rawName.trim() !== '') 
                        ? rawName 
                        : (realUser?.displayName || currentUser.displayName || 'Pod Member');

                      const isKycVerified = realUser 
                        ? realUser.kycStatus === 'VERIFIED' 
                        : (isSelf ? currentUser.kycStatus === 'VERIFIED' : Boolean((member as any).isKycVerified));

                      const isSelectedForTrade = targetMemberForSwap?.userId === member.userId;
                      const isNotifying = notifyingUserId === member.userId;
                      const isNotified = notifiedUserIds[member.userId];

                      return (
                        <React.Fragment key={member.id || member.userId || idx}>
                          <div 
                            className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                              isSelf ? 'bg-blue-50/70' : isSelectedForTrade ? 'bg-emerald-50/80 border-l-4 border-l-emerald-600' : 'hover:bg-gray-50/80'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${
                                isSelf ? 'bg-[#005FB8] text-white' : 'bg-gray-100 text-gray-700 border border-gray-300'
                              }`}>
                                #{idx + 1}
                              </div>

                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-[#111827]">
                                    {memberName}
                                  </span>

                                  {isSelf && (
                                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md">
                                      {t('hardship.youTag')}
                                    </span>
                                  )}

                                  {/* Single Source of Truth KYC Badge */}
                                  {isKycVerified ? (
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md flex items-center gap-0.5" title="Identity Verified via Stripe Identity">
                                      <UserCheck className="w-3 h-3 text-emerald-600" /> {t('hardship.kycVerified')}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-md flex items-center gap-0.5" title="Identity Verification Pending">
                                      <ShieldAlert className="w-3 h-3 text-amber-600" /> {t('hardship.kycPending')}
                                    </span>
                                  )}

                                  {hasReceived && (
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                      <CheckCircle2 className="w-3 h-3" /> {t('hardship.payoutReceived')}
                                    </span>
                                  )}

                                  {/* Swap Request Status Badge */}
                                  {!isSelf && (() => {
                                    const memberUserId = member.userId || member.id || member.displayName;
                                    const activeSwapReq = podSwapRequests.find(
                                      (sr) =>
                                        (sr.requesterUserId === currentUser.id && (sr.targetUserId === memberUserId || sr.targetUserId === member.userId)) ||
                                        (sr.targetUserId === currentUser.id && (sr.requesterUserId === memberUserId || sr.requesterUserId === member.userId))
                                    );

                                    if (activeSwapReq?.status === 'ACCEPTED') {
                                      return (
                                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {t('hardship.tradeAcceptedBadge')}
                                        </span>
                                      );
                                    }
                                    if (activeSwapReq?.status === 'PENDING') {
                                      return (
                                        <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                          <Clock className="w-3 h-3 text-amber-600" /> {t('hardship.awaitingAcceptanceBadge')}
                                        </span>
                                      );
                                    }
                                    if (activeSwapReq?.status === 'DECLINED') {
                                      return (
                                        <span className="text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                          <AlertCircle className="w-3 h-3 text-rose-600" /> {t('hardship.requestDeclinedBadge')}
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                                <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                                  <span>{t('hardship.memberPlatform', { platform: member.platform || realUser?.platform || 'Gig Provider' })}</span>
                                  <span>•</span>
                                  <span>{t('hardship.scheduledPayoutWeek', { week: idx + 1 })}</span>
                                </div>
                              </div>
                            </div>

                            {/* Swap & Notify Action Buttons */}
                            {!isSelf && (
                              <div className="flex items-center gap-2">
                                {hasReceived || currentMemberHasReceived ? (
                                  <span className="text-[11px] text-gray-400 italic bg-gray-100 px-2.5 py-1 rounded-lg">
                                    {t('hardship.payoutProcessedText')}
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isSelectedForTrade) {
                                          setTargetMemberForSwap(null);
                                        } else {
                                          setTargetMemberForSwap(member);
                                          setSwapErrorMsg(null);
                                          setSwapSuccessMsg(null);
                                        }
                                      }}
                                      className={`px-3 py-1.5 rounded-lg border font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                                        isSelectedForTrade
                                          ? 'bg-emerald-600 text-white border-emerald-700'
                                          : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800'
                                      }`}
                                    >
                                      <ArrowLeftRight className="w-3.5 h-3.5" />
                                      <span>{isSelectedForTrade ? t('hardship.selectedBtn') : t('hardship.tradeSpotBtn')}</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* INLINE CONFIRMATION CARD DIRECTLY BELOW TARGET MEMBER */}
                          {isSelectedForTrade && currentMember && (() => {
                            const memberUserId = member.userId || member.id || member.displayName;
                            const activeSwapReq = podSwapRequests.find(
                              (sr) => {
                                const isReqCurrent = sr.requesterUserId === currentUser.id || sr.requesterUserId === currentUser.email || sr.requesterName === currentUser.displayName;
                                const isTgtMember = sr.targetUserId === memberUserId || sr.targetUserId === member.userId || sr.targetUserId === member.id || sr.targetName === member.displayName;
                                const isReqMember = sr.requesterUserId === memberUserId || sr.requesterUserId === member.userId || sr.requesterUserId === member.id || sr.requesterName === member.displayName;
                                const isTgtCurrent = sr.targetUserId === currentUser.id || sr.targetUserId === currentUser.email || sr.targetName === currentUser.displayName;
                                return (isReqCurrent && isTgtMember) || (isReqMember && isTgtCurrent);
                              }
                            );

                            const isAccepted = activeSwapReq?.status === 'ACCEPTED';
                            const isPending = activeSwapReq?.status === 'PENDING';

                            const handleSendTradeProposal = async () => {
                              if (!selectedPod) return;
                              setNotifyingUserId(memberUserId);
                              setSwapErrorMsg(null);
                              setSwapSuccessMsg(null);
                              try {
                                const res = await fetch(`/api/pods/${selectedPod.id}/swap-request`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'x-user-id': currentUser.id,
                                    'x-user-email': currentUser.email || '',
                                    'x-user-name': currentUser.displayName || '',
                                  },
                                  body: JSON.stringify({
                                    targetMemberUserId: memberUserId,
                                  }),
                                });
                                if (res.ok) {
                                  setSwapSuccessMsg(t('hardship.swapRequestSentMsg', { name: memberName }));
                                  fetchPodSwapRequests(selectedPod.id);
                                } else {
                                  const errData = await res.json();
                                  setSwapErrorMsg(errData.message || errData.error || 'Failed to send trade request.');
                                }
                              } catch (err) {
                                console.error(err);
                                setSwapErrorMsg('Network error sending request.');
                              } finally {
                                setNotifyingUserId(null);
                              }
                            };

                            return (
                              <div className="p-4 bg-gradient-to-br from-emerald-50 via-blue-50 to-white border-y-2 border-emerald-500/80 space-y-3.5 animate-in fade-in zoom-in-95 duration-150 rounded-xl my-2">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 text-white rounded-xl shrink-0 ${isAccepted ? 'bg-emerald-600' : isPending ? 'bg-amber-600' : 'bg-[#005FB8]'}`}>
                                    <Repeat className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <h4 className="font-extrabold text-xs text-[#111827]">
                                      {isAccepted
                                        ? t('hardship.step1AcceptedTitle', { name: memberName })
                                        : isPending
                                        ? t('hardship.step1PendingTitle', { name: memberName })
                                        : t('hardship.step1Title', { name: memberName })}
                                    </h4>
                                    <p className="text-[11px] text-gray-600">
                                      {isAccepted
                                        ? t('hardship.step1AcceptedDesc', { name: memberName })
                                        : isPending
                                        ? t('hardship.step1PendingDesc', { name: memberName })
                                        : t('hardship.step1Desc', { name: memberName })}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                                  {(() => {
                                    const currentMemberSlot = (currentMember.rotationIndex !== undefined && currentMember.rotationIndex !== null)
                                      ? currentMember.rotationIndex + 1
                                      : (sortedMembers.findIndex(m => m.userId === currentUser.id || m.id === currentMember.id) + 1 || 1);
                                    
                                    let targetMemberSlot = (member.rotationIndex !== undefined && member.rotationIndex !== null)
                                      ? member.rotationIndex + 1
                                      : (sortedMembers.findIndex(m => (m.userId && m.userId === member.userId) || (m.id && m.id === member.id) || (m.displayName && m.displayName === member.displayName)) + 1 || 2);

                                    if (targetMemberSlot === currentMemberSlot) {
                                      const foundIdx = sortedMembers.findIndex(m => (m.userId && m.userId === member.userId) || (m.id && m.id === member.id) || (m.displayName && m.displayName === member.displayName));
                                      if (foundIdx >= 0) targetMemberSlot = foundIdx + 1;
                                    }

                                    return (
                                      <>
                                        <div className="space-y-1">
                                          <span className="text-[10px] uppercase text-gray-400 font-sans block font-bold">{t('hardship.yourCurrentSlot')}</span>
                                          <strong className="text-xs text-[#005FB8] block">{t('hardship.slotWeekFormat', { slot: currentMemberSlot, week: currentMemberSlot })}</strong>
                                          <span className="text-[10px] text-emerald-700 block font-sans font-semibold">{t('hardship.newSlotFormat', { slot: targetMemberSlot, week: targetMemberSlot })}</span>
                                        </div>

                                        <div className="space-y-1 border-l border-gray-200 pl-3">
                                          <span className="text-[10px] uppercase text-gray-400 font-sans block font-bold">{t('hardship.targetCurrentSlot', { name: memberName })}</span>
                                          <strong className="text-xs text-gray-800 block">{t('hardship.slotWeekFormat', { slot: targetMemberSlot, week: targetMemberSlot })}</strong>
                                          <span className="text-[10px] text-[#005FB8] block font-sans font-semibold">{t('hardship.newSlotFormat', { slot: currentMemberSlot, week: currentMemberSlot })}</span>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setTargetMemberForSwap(null)}
                                    disabled={swapLoading}
                                    className="px-3.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs transition-colors cursor-pointer"
                                  >
                                    {t('hardship.cancelBtn')}
                                  </button>

                                  <div className="flex items-center gap-2">
                                    {!isAccepted && (
                                      <button
                                        type="button"
                                        disabled={notifyingUserId === memberUserId}
                                        onClick={handleSendTradeProposal}
                                        className="px-3.5 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                      >
                                        <Send className="w-3.5 h-3.5" />
                                        <span>
                                          {notifyingUserId === memberUserId
                                            ? t('hardship.sendingRequestBtn')
                                            : isPending
                                            ? t('hardship.resendTradeRequestBtn')
                                            : t('hardship.sendTradeRequestBtn', { name: memberName })}
                                        </span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={handleExecuteSwap}
                                      disabled={swapLoading || !isAccepted}
                                      className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer ${
                                        isAccepted
                                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                          : 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                                      }`}
                                      title={!isAccepted ? `${memberName} must accept your trade request first.` : 'Execute spot swap now'}
                                    >
                                      {swapLoading ? (
                                        <>
                                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                          <span>{t('hardship.tradingSpotsBtn')}</span>
                                        </>
                                      ) : (
                                        <>
                                          <ArrowLeftRight className="w-3.5 h-3.5" />
                                          <span>{t('hardship.executeSwapBtn')}</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </React.Fragment>
                      );
                    })}
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
                  {t('hardship.closeBtn')}
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
