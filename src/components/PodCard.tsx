import React from 'react';
import { Pod, User } from '../types';
import { useTranslation } from '../i18n';
import { useChat } from '../context/ChatContext';
import { Users, DollarSign, Calendar, ShieldCheck, ArrowRight, CheckCircle2, Lock, Sparkles, Clock, Zap, LogOut, MessageSquare, Bot, AlertTriangle } from 'lucide-react';

interface PodCardProps {
  pod: Pod;
  currentUser: User;
  onSelectPod: (pod: Pod, initialTab?: 'rotation' | 'circle' | 'deposits' | 'reprioritize' | 'audit' | 'hardship') => void;
  onJoinPod: (pod: Pod) => void;
  onLeavePod?: (pod: Pod) => void;
  onSignAgreement: (pod: Pod) => void;
}

export const PodCard: React.FC<PodCardProps> = ({
  pod,
  currentUser,
  onSelectPod,
  onJoinPod,
  onLeavePod,
  onSignAgreement,
}) => {
  const { t } = useTranslation();
  const { openPodChat } = useChat();
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
    localStorage.getItem(`mutualpool_my_pod_${activeId}_${pod.id}`) === 'true'
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

  const displayCount = Math.max(
    1,
    pod.memberCount || 0,
    effectiveMembers.length,
    pod.members ? pod.members.length : 0
  );

  const hasEveryMemberReceivedPayout = Boolean(
    effectiveMembers &&
    effectiveMembers.length > 0 &&
    (pod.status === 'COMPLETED' || effectiveMembers.every(m => m.hasReceivedPayout))
  );

  const isFull = displayCount >= pod.sizeTier;
  const progressPercent = Math.min(100, Math.round((displayCount / pod.sizeTier) * 100));

  const statusColors = {
    FORMING: 'bg-amber-50 text-amber-700 border-amber-200',
    LOCKED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    ACTIVE: 'bg-green-50 text-green-700 border-green-200',
    COMPLETED: 'bg-blue-50 text-[#005FB8] border-blue-200',
  };

  const currentActivePool = displayCount * pod.depositTier;
  const fullCapacityTarget = pod.sizeTier * pod.depositTier;

  // Determine user rotation index (0-indexed)
  const userRotationIndex = userMembership
    ? userMembership.rotationIndex
    : (isCreator ? Math.max(0, (pod.sizeTier || 1) - 1) : 0);

  const hasUserReceivedPayout = userMembership?.hasReceivedPayout || false;

  // Visual Emergency Indicator: triggered when the user is in their designated payout rotation week
  const isDesignatedPayoutWeek = Boolean(
    isMember &&
    pod.status === 'ACTIVE' &&
    (userRotationIndex + 1 === pod.currentCycleWeek) &&
    !hasUserReceivedPayout
  );

  const treasuryBalance = currentUser?.treasury?.balanceUsd ?? 0;
  const requiredWeeklyDeposit = pod.depositTier || 0;
  const isTreasurySufficient = treasuryBalance >= requiredWeeklyDeposit;
  const estimatedNetPot = currentActivePool * 0.90;

  return (
    <div className={`bg-white border ${
      isDesignatedPayoutWeek 
        ? 'border-red-500 ring-2 ring-red-400/40 shadow-lg' 
        : 'border-[#DDE1E6] hover:border-[#005FB8]'
    } rounded-xl p-4 transition-all flex flex-col justify-between shadow-xs relative group`}>
      <div>
        
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusColors[pod.status]}`}>
              {pod.status === 'FORMING' && t('pod.fillingMembers')}
              {pod.status === 'LOCKED' && t('pod.rotationLocked')}
              {pod.status === 'ACTIVE' && t('pod.cycleWeek', { current: pod.currentCycleWeek, total: pod.totalCycles })}
              {pod.status === 'COMPLETED' && t('pod.allCyclesCompleted')}
            </span>

            {/* Payout Week Emergency Badge */}
            {isDesignatedPayoutWeek && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border bg-red-600 text-white border-red-700 flex items-center gap-1.5 shadow-sm animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white inline-block animate-ping" />
                🚨 YOUR PAYOUT WEEK (WK {pod.currentCycleWeek})
              </span>
            )}

            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
              pod.podType === 'TRUSTED_CIRCLE' 
                ? 'bg-blue-50 text-[#005FB8] border-blue-200' 
                : 'bg-gray-100 text-gray-700 border-gray-200'
            }`}>
              {pod.podType === 'TRUSTED_CIRCLE' ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3 text-[#005FB8]" />}
              <span>{pod.podType === 'TRUSTED_CIRCLE' ? t('pod.trustedCircle') : t('pod.openPod')}</span>
            </span>

            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
              pod.activationPolicy === 'FLEXIBLE_EARLY'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              {pod.activationPolicy === 'FLEXIBLE_EARLY' ? (
                <>
                  <Zap className="w-3 h-3 text-amber-600" />
                  <span>{t('pod.earlyStartAllowed')}</span>
                </>
              ) : (
                <>
                  <Users className="w-3 h-3 text-emerald-600" />
                  <span>{t('pod.fullCapacityRequired')}</span>
                </>
              )}
            </span>

            {pod.isPrioritizedForReplacement && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-rose-50 text-rose-800 border-rose-200 flex items-center gap-1 animate-pulse">
                <Sparkles className="w-3 h-3 text-rose-600" />
                <span>{t('pod.hardshipReplacementSpot')}</span>
              </span>
            )}

            {pod.stewardshipMode === 'AUTONOMOUS_AI' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-purple-50 text-purple-900 border-purple-300 flex items-center gap-1">
                <Bot className="w-3 h-3 text-purple-700" />
                <span>🤖 AI Custodian (Escrow Backed)</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-gray-100 text-[#4B5563] text-[10px] font-mono border border-gray-200">
              {t('pod.depositPerWeek', { amount: pod.depositTier })}
            </span>
            <span className="px-2 py-0.5 rounded bg-gray-100 text-[#4B5563] text-[10px] font-mono border border-gray-200">
              {t('pod.memberCountOfTotal', { current: pod.sizeTier, max: pod.sizeTier })}
            </span>
          </div>
        </div>

        {/* Title & Description */}
        <h3 className="text-base font-bold text-[#111827] mb-1 group-hover:text-[#005FB8] transition-colors">
          {pod.name}
        </h3>
        <p className="text-xs text-[#6B7280] line-clamp-2 mb-3 leading-relaxed">
          {pod.description}
        </p>

        {/* Financial Overview Metrics */}
        <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] mb-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-[#6B7280] text-[10px] uppercase font-bold block">{t('pod.activeWeeklyPool')}</span>
            <span className="font-mono font-bold text-[#005FB8] text-sm">
              ${currentActivePool.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#6B7280] block font-mono">
              {displayCount} {displayCount === 1 ? 'member' : 'members'} × ${pod.depositTier}/wk
            </span>
          </div>
          <div>
            <span className="text-[#6B7280] text-[10px] uppercase font-bold block">{t('pod.fullTargetPayout')}</span>
            <span className="font-mono font-bold text-slate-700 text-sm">
              ${fullCapacityTarget.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#6B7280] block font-mono">
              {t('pod.maxCapacityLabel', { count: pod.sizeTier })}
            </span>
          </div>
        </div>

        {/* Capacity Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-[#6B7280] mb-1">
            <span>{t('pod.podCapacityFill')}</span>
            <span className="font-mono text-[#111827] font-semibold">{t('pod.memberCountOfTotal', { current: displayCount, max: pod.sizeTier })}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
            <div
              className="bg-[#005FB8] h-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* User Membership Banner if in Pod */}
        {isMember && (
          <div className="mb-3 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#005FB8] shrink-0" />
              <div>
                <span className="font-bold block text-[#111827]">
                  {t('pod.lineForPayout', { index: userMembership ? userMembership.rotationIndex + 1 : 1 })}
                </span>
                <span className="text-[10px] text-[#005FB8]">
                  {userMembership?.hasReceivedPayout 
                    ? t('pod.payoutReceivedWeek', { week: userMembership.payoutCycleWeek })
                    : t('pod.nextUpInQueue')}
                </span>
              </div>
            </div>
            {userMembership && !userMembership.agreementSignedAt && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSignAgreement(pod);
                }}
                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] shrink-0 transition-colors shadow-xs cursor-pointer"
              >
                {t('pod.signPodAgreement')}
              </button>
            )}
          </div>
        )}

        {/* Visual Emergency Payout Week Indicator */}
        {isDesignatedPayoutWeek && (
          <div className="mb-3 p-3.5 rounded-xl border-2 border-red-500 bg-gradient-to-br from-red-50 via-rose-50 to-amber-50 shadow-md">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 flex-wrap mb-1">
                  <span className="text-xs font-black uppercase tracking-wider text-red-900 flex items-center gap-1">
                    🚨 EMERGENCY PAYOUT NOTICE
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide border ${
                    isTreasurySufficient 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : 'bg-red-100 text-red-800 border-red-300 animate-pulse'
                  }`}>
                    {isTreasurySufficient ? '✓ Treasury Balance Ready' : '⚠️ Balance Insufficient'}
                  </span>
                </div>
                
                <p className="text-xs text-red-950 font-medium leading-snug mb-2">
                  It is currently your <strong>designated payout rotation week (Week {pod.currentCycleWeek} • Turn #{userRotationIndex + 1})</strong> to receive the <strong className="text-emerald-700">${estimatedNetPot.toFixed(2)} net pot payout</strong>!
                </p>

                <div className="p-2 rounded-lg bg-white/90 border border-red-200 text-xs mb-2 space-y-1">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-600">Your Stripe Treasury Balance:</span>
                    <span className={`font-bold ${isTreasurySufficient ? 'text-emerald-700' : 'text-red-600'}`}>
                      ${treasuryBalance.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-600">Required Weekly Deposit:</span>
                    <span className="font-bold text-slate-800">${requiredWeeklyDeposit.toFixed(2)}</span>
                  </div>
                </div>

                {isTreasurySufficient ? (
                  <p className="text-[11px] text-emerald-800 font-medium mb-2.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Reminder: Ensure your Stripe Treasury balance stays sufficient until weekly cycle settlement completes.</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-red-700 font-semibold mb-2.5 flex items-center gap-1 bg-red-100/80 p-1.5 rounded border border-red-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>CRITICAL: Shortfall of ${(requiredWeeklyDeposit - treasuryBalance).toFixed(2)}! Fund your Stripe Treasury wallet immediately to prevent cycle hold or member default.</span>
                  </p>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPod(pod, 'deposits');
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <span>Verify Stripe Treasury & Pod Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Thursday/Friday Platform Heartbeat Schedule Badge */}
        <div className="mt-3 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[10.5px] text-slate-600 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-[#005FB8] shrink-0" />
            <span>Auto-Debit: <strong>Thurs 12AM</strong> (${pod.depositTier})</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-emerald-700">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>Payouts: <strong>Fri 12AM</strong></span>
          </div>
        </div>

      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-[#DDE1E6] flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#6B7280]">
          {t('pod.creator')}: <strong className="text-[#111827]">{pod.creatorName}</strong>
        </span>

        <div className="flex items-center gap-2">
          {isMember && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openPodChat(pod);
              }}
              title="Open Pod Group Chat"
              className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#005FB8] border border-blue-200 font-bold text-xs transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
          )}

          {isMember ? (
            <button
              disabled={!hasEveryMemberReceivedPayout}
              onClick={() => onLeavePod?.(pod)}
              title={
                !hasEveryMemberReceivedPayout
                  ? t('pod.leavePodDisabledTitle')
                  : t('pod.leavePod')
              }
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1 shadow-xs border ${
                !hasEveryMemberReceivedPayout
                  ? 'bg-[#F1F5F9] text-[#94A3B8] border-[#CBD5E1] cursor-not-allowed opacity-80'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 cursor-pointer'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('pod.leavePod')}</span>
            </button>
          ) : (
            !isFull && pod.status !== 'COMPLETED' && (
              <button
                onClick={() => onJoinPod(pod)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <span>{t('pod.joinPod')}</span>
              </button>
            )
          )}

          <button
            onClick={() => onSelectPod(pod, 'deposits')}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-[#111827] font-semibold text-xs transition-colors flex items-center gap-1 border border-[#DDE1E6] shadow-xs cursor-pointer"
          >
            <span>{t('pod.viewLedger')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

