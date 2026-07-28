import React from 'react';
import { Pod, User } from '../types';
import { Users, DollarSign, Calendar, ShieldCheck, ArrowRight, CheckCircle2, Lock, Sparkles, Clock } from 'lucide-react';

interface PodCardProps {
  pod: Pod;
  currentUser: User;
  onSelectPod: (pod: Pod) => void;
  onJoinPod: (pod: Pod) => void;
  onSignAgreement: (pod: Pod) => void;
}

export const PodCard: React.FC<PodCardProps> = ({
  pod,
  currentUser,
  onSelectPod,
  onJoinPod,
  onSignAgreement,
}) => {
  const userMembership = pod.members.find(m => m.userId === currentUser.id);
  const isMember = !!userMembership;
  const isFull = pod.members.length >= pod.sizeTier;
  const progressPercent = Math.min(100, Math.round((pod.members.length / pod.sizeTier) * 100));

  const statusColors = {
    FORMING: 'bg-amber-50 text-amber-700 border-amber-200',
    LOCKED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    ACTIVE: 'bg-green-50 text-green-700 border-green-200',
    COMPLETED: 'bg-blue-50 text-[#005FB8] border-blue-200',
  };

  const currentActivePool = pod.members.length * pod.depositTier;
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
              {pod.members.length} member{pod.members.length === 1 ? '' : 's'} × ${pod.depositTier}/wk
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
            <span className="font-mono text-[#111827] font-semibold">{pod.members.length} / {pod.sizeTier} Members</span>
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
          <div className="mb-3 p-2.5 rounded-lg bg-amber-50/90 border border-amber-200/90 text-[10.5px] text-amber-900 leading-tight">
            💡 <strong>Dynamic Payout Scaling:</strong> Weekly payout is currently <strong>${currentActivePool.toLocaleString()}</strong> ({pod.members.length} member{pod.members.length === 1 ? '' : 's'} × ${pod.depositTier}/wk). Scales up to <strong>${fullCapacityTarget.toLocaleString()}</strong> as remaining spots fill.
          </div>
        )}

        {/* User Membership Banner if in Pod */}
        {isMember && userMembership && (
          <div className="mb-3 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#005FB8] shrink-0" />
              <div>
                <span className="font-bold block text-[#111827]">You are Member in Rotation #{userMembership.rotationIndex}</span>
                <span className="text-[10px] text-[#005FB8]">
                  {userMembership.hasReceivedPayout 
                    ? `Payout Received in Week ${userMembership.payoutCycleWeek}` 
                    : `Next Up in Queue`}
                </span>
              </div>
            </div>
            {!userMembership.agreementSignedAt && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSignAgreement(pod);
                }}
                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] shrink-0 transition-colors shadow-xs"
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
          {!isMember && pod.status === 'FORMING' && !isFull && (
            <button
              onClick={() => onJoinPod(pod)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-xs"
            >
              <span>Join Pod</span>
            </button>
          )}

          <button
            onClick={() => onSelectPod(pod)}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-[#111827] font-semibold text-xs transition-colors flex items-center gap-1 border border-[#DDE1E6] shadow-xs"
          >
            <span>View Ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
