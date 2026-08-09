import React from 'react';
import { Pod, User } from '../types';
import { Users, DollarSign, Calendar, ShieldCheck, ArrowRight, CheckCircle2, Lock, Sparkles, Clock, Zap, LogOut } from 'lucide-react';

interface PodCardProps {
  pod: Pod;
  currentUser: User;
  onSelectPod: (pod: Pod) => void;
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

  return (
    <div className="bg-white border border-[#DDE1E6] rounded-xl p-4 hover:border-[#005FB8] transition-all flex flex-col justify-between shadow-xs relative group">
      <div>
        
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusColors[pod.status]}`}>
              {pod.status === 'FORMING' && 'Filling Pod Members'}
              {pod.status === 'LOCKED' && 'Rotation Order Locked'}
              {pod.status === 'ACTIVE' && `Cycle Week ${pod.currentCycleWeek}/${pod.totalCycles}`}
              {pod.status === 'COMPLETED' && 'All Cycles Completed'}
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

            {pod.isPrioritizedForReplacement && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-rose-50 text-rose-800 border-rose-200 flex items-center gap-1 animate-pulse">
                <Sparkles className="w-3 h-3 text-rose-600" />
                <span>⚡ Hardship Replacement Spot</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-gray-100 text-[#4B5563] text-[10px] font-mono border border-gray-200">
              ${pod.depositTier}/wk
            </span>
            <span className="px-2 py-0.5 rounded bg-gray-100 text-[#4B5563] text-[10px] font-mono border border-gray-200">
              {pod.sizeTier} Members
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
            <span className="text-[#6B7280] text-[10px] uppercase font-bold block">Active Weekly Pool</span>
            <span className="font-mono font-bold text-[#005FB8] text-sm">
              ${currentActivePool.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#6B7280] block font-mono">
              {displayCount} member{displayCount === 1 ? '' : 's'} × ${pod.depositTier}/wk
            </span>
          </div>
          <div>
            <span className="text-[#6B7280] text-[10px] uppercase font-bold block">Full Target Payout</span>
            <span className="font-mono font-bold text-slate-700 text-sm">
              ${fullCapacityTarget.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#6B7280] block font-mono">
              At {pod.sizeTier} max capacity
            </span>
          </div>
        </div>

        {/* Capacity Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-[#6B7280] mb-1">
            <span>Pod Capacity Fill</span>
            <span className="font-mono text-[#111827] font-semibold">{displayCount} / {pod.sizeTier} Members</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
            <div
              className="bg-[#005FB8] h-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Dynamic Capacity Scaling Notice */}
        {pod.status === 'FORMING' && (
          <div className="mb-3 p-2.5 rounded-lg bg-amber-50/90 border border-amber-200/90 text-[10.5px] text-amber-900 leading-tight space-y-1">
            <div>
              💡 <strong>Dynamic Payout Scaling:</strong> Weekly payout is currently <strong>${currentActivePool.toLocaleString()}</strong> ({displayCount} member{displayCount === 1 ? '' : 's'} × ${pod.depositTier}/wk).
            </div>
            {pod.activationPolicy === 'FLEXIBLE_EARLY' ? (
              <div className="text-[10px] text-amber-800 font-medium flex items-center gap-1 pt-0.5">
                <Zap className="w-3 h-3 text-amber-600 shrink-0" />
                <span>Creator choice: Pod can be activated early before reaching all {pod.sizeTier} member spots.</span>
              </div>
            ) : (
              <div className="text-[10px] text-emerald-800 font-medium flex items-center gap-1 pt-0.5">
                <Users className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Creator choice: Pod activates when all {pod.sizeTier} member spots fill for max target payout (${fullCapacityTarget.toLocaleString()}/wk).</span>
              </div>
            )}
          </div>
        )}

        {/* User Membership Banner if in Pod */}
        {isMember && (
          <div className="mb-3 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#005FB8] shrink-0" />
              <div>
                <span className="font-bold block text-[#111827]">
                  You are Member in Rotation #{userMembership?.rotationIndex ?? 1}
                </span>
                <span className="text-[10px] text-[#005FB8]">
                  {userMembership?.hasReceivedPayout 
                    ? `Payout Received in Week ${userMembership.payoutCycleWeek}` 
                    : `Next Up in Queue`}
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
                Sign Agreement
              </button>
            )}
          </div>
        )}

      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-[#DDE1E6] flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#6B7280]">
          Creator: <strong className="text-[#111827]">{pod.creatorName}</strong>
        </span>

        <div className="flex items-center gap-2">
          {isMember ? (
            <button
              disabled={!hasEveryMemberReceivedPayout}
              onClick={() => onLeavePod?.(pod)}
              title={
                !hasEveryMemberReceivedPayout
                  ? "Leave Pod is disabled until every member in the pod has taken a turn to get their payout."
                  : "Leave this completed pod"
              }
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1 shadow-xs border ${
                !hasEveryMemberReceivedPayout
                  ? 'bg-[#F1F5F9] text-[#94A3B8] border-[#CBD5E1] cursor-not-allowed opacity-80'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 cursor-pointer'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave Pod</span>
            </button>
          ) : (
            !isFull && pod.status !== 'COMPLETED' && (
              <button
                onClick={() => onJoinPod(pod)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <span>Join Pod</span>
              </button>
            )
          )}

          <button
            onClick={() => onSelectPod(pod)}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-[#111827] font-semibold text-xs transition-colors flex items-center gap-1 border border-[#DDE1E6] shadow-xs cursor-pointer"
          >
            <span>View Ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
