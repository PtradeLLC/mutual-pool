import React, { useState } from 'react';
import { Pod, User } from '../types';
import { 
  Trophy, 
  Award, 
  CheckCircle2, 
  DollarSign, 
  TrendingUp, 
  Sparkles, 
  Flag, 
  ShieldCheck, 
  Clock, 
  Zap, 
  ChevronRight, 
  Users,
  Target
} from 'lucide-react';

interface PodMilestoneProgressProps {
  pod: Pod;
  currentUser?: User;
}

export interface Milestone {
  id: string;
  title: string;
  shortLabel: string;
  badge: string;
  description: string;
  targetWeek: number;
  targetContributionUsd: number;
  icon: React.ComponentType<{ className?: string }>;
  motivationalQuote: string;
  rewardText: string;
}

export const PodMilestoneProgress: React.FC<PodMilestoneProgressProps> = ({ pod, currentUser }) => {
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);

  const totalMembers = pod.members?.length || pod.sizeTier || 6;
  const depositTier = pod.depositTier || 100;
  const weeklyPool = totalMembers * depositTier;
  const totalCycleTarget = weeklyPool * totalMembers;

  const currentWeek = pod.status === 'ACTIVE' 
    ? Math.max(1, pod.currentCycleWeek || 1) 
    : pod.status === 'COMPLETED' 
    ? totalMembers 
    : 0;

  const completedWeeks = pod.status === 'COMPLETED' 
    ? totalMembers 
    : Math.max(0, currentWeek - 1);

  // Total contributions collected across the pod so far
  const totalContributed = pod.status === 'COMPLETED'
    ? totalCycleTarget
    : (completedWeeks * weeklyPool) + (pod.currentWeeklyCollected || 0);

  const contributionPercentage = Math.min(
    100, 
    Math.round((totalContributed / (totalCycleTarget || 1)) * 100)
  );

  // Members who have already received payout
  const paidMembersCount = pod.members?.filter(m => m.hasReceivedPayout).length || completedWeeks;
  const totalDisbursed = paidMembersCount * (weeklyPool * 0.90);

  // Define structured milestones based on pod timeline & contribution thresholds
  const milestones: Milestone[] = [
    {
      id: 'kickoff',
      title: 'Pod Activation & Lock',
      shortLabel: 'Kickoff',
      badge: 'Week 1',
      description: 'Pod locked, cryptographic order settled, and first escrow deposits secured.',
      targetWeek: 1,
      targetContributionUsd: weeklyPool,
      icon: Flag,
      motivationalQuote: 'Every journey begins with a first deposit. Collective savings are officially locked in!',
      rewardText: 'Escrow protection active & FDIC pass-through account bound.',
    },
    {
      id: 'first_payout',
      title: '1st Payout Reached',
      shortLabel: '1st Payout',
      badge: 'Turn #1 Funded',
      description: 'First member receives their net lump-sum payout via Stripe Treasury.',
      targetWeek: 1,
      targetContributionUsd: weeklyPool,
      icon: DollarSign,
      motivationalQuote: 'Proof of concept validated! The rotation engine is now actively delivering payouts.',
      rewardText: 'Recipient #1 claimed payout. 100% on-time contribution streak initiated.',
    },
    {
      id: 'quarter_mark',
      title: 'Quarter-Cycle Mark',
      shortLabel: '25% Mark',
      badge: `${Math.max(1, Math.ceil(totalMembers * 0.25))} Wks`,
      description: '25% of all pod members have completed their rotation payout turns.',
      targetWeek: Math.max(1, Math.ceil(totalMembers * 0.25)),
      targetContributionUsd: Math.round(totalCycleTarget * 0.25),
      icon: TrendingUp,
      motivationalQuote: 'Building strong community trust velocity! Consistent weekly habits are paying off.',
      rewardText: 'Quarterly milestone bonus badge awarded to all on-time contributors.',
    },
    {
      id: 'mid_cycle',
      title: 'Mid-Cycle Milestone',
      shortLabel: '50% Halfway',
      badge: 'Halfway Mark',
      description: '50% of the entire rotation timeline is completed. Half the pod has received payouts!',
      targetWeek: Math.max(2, Math.ceil(totalMembers * 0.5)),
      targetContributionUsd: Math.round(totalCycleTarget * 0.5),
      icon: Award,
      motivationalQuote: 'Halfway to the finish line! Over half your crew has seen real financial uplift.',
      rewardText: 'Mid-cycle celebration milestone! Pod trust rating elevated to High Tier.',
    },
    {
      id: 'three_quarter',
      title: 'Three-Quarter Home Stretch',
      shortLabel: '75% Stretch',
      badge: `${Math.ceil(totalMembers * 0.75)} Wks`,
      description: '75% of cycle fulfilled. Final rotation turns are locked and scheduled.',
      targetWeek: Math.ceil(totalMembers * 0.75),
      targetContributionUsd: Math.round(totalCycleTarget * 0.75),
      icon: ShieldCheck,
      motivationalQuote: 'Home stretch! The majority of members have successfully cycled their lump sum.',
      rewardText: 'Eligibility unlocked for priority placement in future season pods.',
    },
    {
      id: 'full_cycle',
      title: 'Full Cycle Completion',
      shortLabel: '100% Complete',
      badge: 'Graduation',
      description: 'All members have received their full lump sum! 100% cycle completion.',
      targetWeek: totalMembers,
      targetContributionUsd: totalCycleTarget,
      icon: Trophy,
      motivationalQuote: 'Mission accomplished! Full cycle delivered without missing a single beat.',
      rewardText: 'Pod graduated! 100% completion credit boost + platform renewal match unlocked.',
    },
  ];

  // Helper to determine milestone status
  const getMilestoneStatus = (m: Milestone): 'COMPLETED' | 'CURRENT' | 'UPCOMING' => {
    if (pod.status === 'COMPLETED') return 'COMPLETED';

    const isWeekMet = currentWeek > m.targetWeek || (currentWeek === m.targetWeek && pod.currentWeeklyCollected >= weeklyPool);
    const isContributionMet = totalContributed >= m.targetContributionUsd;
    
    // For 1st payout, check if paid count >= 1 or currentWeek > 1
    if (m.id === 'first_payout') {
      if (paidMembersCount >= 1 || (currentWeek > 1) || (currentWeek === 1 && pod.currentWeeklyCollected >= weeklyPool)) {
        return 'COMPLETED';
      }
    } else if (m.id === 'kickoff') {
      if (pod.status === 'ACTIVE') return 'COMPLETED';
    } else if (m.id === 'full_cycle') {
      if (paidMembersCount >= totalMembers && totalContributed >= totalCycleTarget) {
        return 'COMPLETED';
      }
    } else {
      if (isWeekMet || isContributionMet || paidMembersCount >= Math.ceil(totalMembers * (m.targetWeek / totalMembers))) {
        return 'COMPLETED';
      }
    }

    // Determine if this is the immediate active next milestone
    return 'UPCOMING';
  };

  // Find the current active milestone (the first one not completed)
  let foundCurrent = false;
  const milestonesWithStatus = milestones.map(m => {
    let status = getMilestoneStatus(m);
    if (status !== 'COMPLETED' && !foundCurrent && pod.status === 'ACTIVE') {
      status = 'CURRENT';
      foundCurrent = true;
    }
    return { ...m, status };
  });

  const currentMilestone = milestonesWithStatus.find(m => m.status === 'CURRENT') || 
    (pod.status === 'COMPLETED' ? milestonesWithStatus[milestonesWithStatus.length - 1] : milestonesWithStatus[0]);

  const completedCount = milestonesWithStatus.filter(m => m.status === 'COMPLETED').length;

  // Selected milestone details (defaults to current if clicked or null)
  const activeDetail = selectedMilestoneId 
    ? milestonesWithStatus.find(m => m.id === selectedMilestoneId) || currentMilestone
    : null;

  // Calculate remaining dollars and weeks to next milestone
  const remainingDollarsToNext = Math.max(0, currentMilestone.targetContributionUsd - totalContributed);
  const remainingWeeksToNext = Math.max(0, currentMilestone.targetWeek - currentWeek);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-[#0B1528] to-slate-900 border border-slate-700/60 rounded-xl p-4 sm:p-5 text-white shadow-lg space-y-4">
      {/* Header Row: Title, Motivation Badge, and High-Level Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Trophy className="w-4 h-4" />
            </span>
            <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-2">
              <span>Pod Rotation Progress & Milestones</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {pod.status === 'COMPLETED' ? 'Cycle Completed' : `${completedCount} of ${milestones.length} Reached`}
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Real-time milestones tracking collective contributions and rotation payouts across all {totalMembers} members.
          </p>
        </div>

        {/* Quick Progress KPI Pill */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 shrink-0 text-xs">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Pooled</span>
            <span className="font-mono font-bold text-emerald-400">
              ${totalContributed.toLocaleString()} <span className="text-slate-400 font-normal">/ ${totalCycleTarget.toLocaleString()}</span>
            </span>
          </div>
          <div className="h-7 w-[1px] bg-slate-700 mx-1" />
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Payouts</span>
            <span className="font-bold text-amber-300 font-mono">
              {paidMembersCount}/{totalMembers} Members
            </span>
          </div>
        </div>
      </div>

      {/* Main Overall Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-300 font-semibold">
              Current Focus: <strong className="text-amber-300">{currentMilestone.title}</strong>
            </span>
          </div>
          <span className="font-mono font-bold text-emerald-400 text-xs">
            {contributionPercentage}% Cycle Target Reached
          </span>
        </div>

        <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/80 p-0.5">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400 transition-all duration-700 ease-out shadow-sm"
            style={{ width: `${Math.max(4, contributionPercentage)}%` }}
          />
        </div>
      </div>

      {/* Motivational Next Target Callout Banner */}
      {pod.status === 'ACTIVE' && currentMilestone.status !== 'COMPLETED' && (
        <div className="p-3 bg-gradient-to-r from-amber-500/15 via-blue-500/10 to-transparent border border-amber-500/30 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400">
              <Zap className="w-4 h-4 fill-amber-400/20" />
            </div>
            <div>
              <span className="font-bold text-amber-200 block text-xs">
                Next Pod Goal: {currentMilestone.title} ({currentMilestone.badge})
              </span>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                {currentMilestone.motivationalQuote}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0 bg-slate-800/90 px-2.5 py-1.5 rounded-lg border border-slate-700 text-[11px]">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Needed to Unlock</span>
            <span className="font-mono font-bold text-amber-300">
              ${remainingDollarsToNext.toLocaleString()}
            </span>
            {remainingWeeksToNext > 0 && (
              <span className="text-slate-400 text-[10px] ml-1">
                ({remainingWeeksToNext} wk{remainingWeeksToNext === 1 ? '' : 's'})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Interactive Horizontal Milestone Stepper Track */}
      <div className="relative pt-2 pb-1">
        {/* Desktop Connected Line Track */}
        <div className="hidden md:block absolute top-[28px] left-6 right-6 h-1 bg-slate-800 rounded-full z-0">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-500"
            style={{ 
              width: `${Math.min(100, Math.max(0, (completedCount / (milestones.length - 1)) * 100))}%` 
            }}
          />
        </div>

        {/* Milestone Node Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 relative z-10">
          {milestonesWithStatus.map((m) => {
            const Icon = m.icon;
            const isCompleted = m.status === 'COMPLETED';
            const isCurrent = m.status === 'CURRENT';
            const isSelected = selectedMilestoneId === m.id;

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMilestoneId(isSelected ? null : m.id)}
                className={`p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-blue-900/60 border-blue-400 shadow-md ring-2 ring-blue-500/50'
                    : isCompleted
                    ? 'bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-950/60'
                    : isCurrent
                    ? 'bg-amber-950/40 border-amber-400/80 shadow-md ring-1 ring-amber-400/40 hover:bg-amber-950/60 animate-pulse-subtle'
                    : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600 opacity-70 hover:opacity-90'
                }`}
              >
                <div>
                  {/* Top Node Indicator & Status */}
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-xs ${
                      isCompleted 
                        ? 'bg-emerald-500 text-slate-950 font-black' 
                        : isCurrent 
                        ? 'bg-amber-500 text-slate-950 font-black ring-2 ring-amber-300' 
                        : 'bg-slate-700 text-slate-400'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-slate-950" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>

                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                      isCompleted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : isCurrent
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-700 text-slate-400'
                    }`}>
                      {isCompleted ? 'Reached' : isCurrent ? 'Active' : 'Locked'}
                    </span>
                  </div>

                  {/* Title & Badge */}
                  <div className="font-bold text-xs text-white line-clamp-1">
                    {m.title}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {m.badge} • ${m.targetContributionUsd.toLocaleString()}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{isCompleted ? '✓ Unlocked' : isCurrent ? '⚡ In Progress' : '🔒 Upcoming'}</span>
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expanded Milestone Details Drawer (when a node is selected) */}
      {activeDetail && (
        <div className="p-3.5 bg-slate-800/90 border border-blue-400/40 rounded-xl space-y-2 text-xs transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                activeDetail.status === 'COMPLETED' 
                  ? 'bg-emerald-500 text-slate-950' 
                  : activeDetail.status === 'CURRENT'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {activeDetail.status === 'COMPLETED' ? 'Milestone Achieved' : activeDetail.status === 'CURRENT' ? 'Current Focus Goal' : 'Future Milestone'}
              </span>
              <h4 className="font-bold text-white text-sm">
                {activeDetail.title} ({activeDetail.badge})
              </h4>
            </div>

            <button
              type="button"
              onClick={() => setSelectedMilestoneId(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-slate-700 cursor-pointer"
            >
              ✕ Close Detail
            </button>
          </div>

          <p className="text-slate-300 leading-relaxed">
            {activeDetail.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-700 font-mono text-[11px]">
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block font-sans uppercase font-bold">Target Rotation Week</span>
              <span className="font-bold text-white">Week {activeDetail.targetWeek} of {totalMembers}</span>
            </div>

            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block font-sans uppercase font-bold">Target Cumulative Pool</span>
              <span className="font-bold text-emerald-400">${activeDetail.targetContributionUsd.toLocaleString()}</span>
            </div>

            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block font-sans uppercase font-bold">Community Reward</span>
              <span className="font-bold text-amber-300 text-[10px] line-clamp-1 font-sans">{activeDetail.rewardText}</span>
            </div>
          </div>
        </div>
      )}

      {/* Member Payout Celebration Row */}
      <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="font-bold text-white block">
              Member Payout Milestones
            </span>
            <span className="text-[11px] text-slate-300">
              {paidMembersCount} of {totalMembers} members have completed their rotation payout turn so far (${totalDisbursed.toLocaleString()} disbursed).
            </span>
          </div>
        </div>

        {/* Member Avatar Progress Avatars */}
        <div className="flex items-center -space-x-1.5 overflow-x-auto py-1">
          {pod.members.map((member) => (
            <div
              key={member.id}
              title={`Turn #${member.rotationIndex + 1}: ${member.displayName} (${member.hasReceivedPayout ? 'Paid Out' : 'Scheduled'})`}
              className={`relative group shrink-0 w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                member.hasReceivedPayout
                  ? 'border-emerald-400 ring-2 ring-emerald-500/40'
                  : member.rotationIndex === (currentWeek - 1)
                  ? 'border-amber-400 ring-2 ring-amber-500/40'
                  : 'border-slate-600 opacity-60'
              }`}
            >
              <img
                src={member.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'}
                alt={member.displayName}
                className="w-full h-full rounded-full object-cover"
              />
              {member.hasReceivedPayout && (
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center text-slate-950 text-[9px] font-black">
                  ✓
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
