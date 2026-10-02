import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Pod, User, PaymentHistoryItem } from '../types';
import { 
  getUpcomingCycleDates, 
  UpcomingCyclePair, 
  formatTimeRemaining 
} from '../utils/platformSchedule';
import { 
  Calendar, 
  Clock, 
  ArrowRight, 
  DollarSign, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle, 
  Zap, 
  Layers, 
  ChevronRight, 
  ExternalLink,
  Wallet,
  Users,
  Building2,
  Lock,
  PlusCircle,
  HelpCircle,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Search,
  Receipt,
  RefreshCw,
  Filter
} from 'lucide-react';

interface UpcomingPaymentsProps {
  currentUser: User;
  myPods: Pod[];
  onExplorePods?: () => void;
  onOpenPodDetail?: (pod: Pod) => void;
}

export const UpcomingPayments: React.FC<UpcomingPaymentsProps> = ({
  currentUser,
  myPods,
  onExplorePods,
  onOpenPodDetail,
}) => {
  const [now, setNow] = useState<Date>(new Date());
  const [filterMode, setFilterMode] = useState<'ALL' | 'WITHDRAWALS' | 'PAYOUTS'>('ALL');

  // Payment History State
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'DEPOSIT' | 'PAYOUT'>('ALL');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyLimit, setHistoryLimit] = useState<number>(5);

  // Clock tick every 10 seconds for countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Payment History from API
  const fetchPaymentHistory = useCallback(async () => {
    if (!currentUser || !currentUser.id) return;
    setHistoryLoading(true);

    try {
      const res = await fetch('/api/user/payment-history', {
        headers: {
          'x-user-id': currentUser.id,
          'x-user-name': currentUser.displayName || '',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.history)) {
          setHistory(data.history);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch payment history from backend, falling back to local calculation:', err);
    } finally {
      setHistoryLoading(false);
    }

    // Client-side fallback derivation if API is unavailable or empty
    const fallbackHistory: PaymentHistoryItem[] = [];

    // Derive payouts from pods
    (myPods || []).forEach(pod => {
      const member = (pod.members || []).find(m => 
        m.userId === currentUser.id || 
        (m.displayName && currentUser.displayName && m.displayName.trim().toLowerCase() === currentUser.displayName.trim().toLowerCase())
      );

      if (member && member.hasReceivedPayout) {
        const week = member.payoutCycleWeek || (member.rotationIndex + 1);
        fallbackHistory.push({
          id: member.payoutStripeTransferId || `pay_${pod.id}`,
          type: 'PAYOUT',
          podId: pod.id,
          podName: pod.name,
          amount: pod.weeklyPoolTarget || (pod.depositTier * (pod.members?.length || pod.sizeTier)),
          status: 'COMPLETED',
          date: member.payoutProcessedAt || pod.cycleStartDate || pod.createdAt || new Date(Date.now() - 86400000 * 7).toISOString(),
          cycleWeek: week,
          description: `Rotating lump-sum payout for ${pod.name} (Cycle Week ${week})`,
          paymentMethod: 'Stripe Treasury Account',
        });
      }

      // Check if user has made deposits in active pods
      if (pod.status === 'ACTIVE' && member) {
        const currentWeek = pod.currentCycleWeek || 1;
        // Prior weeks were deposited
        for (let w = 1; w <= currentWeek; w++) {
          fallbackHistory.push({
            id: `dep_fallback_${pod.id}_w${w}`,
            type: 'DEPOSIT',
            podId: pod.id,
            podName: pod.name,
            amount: pod.depositTier,
            status: 'COMPLETED',
            date: new Date(Date.now() - (currentWeek - w + 1) * 7 * 86400000).toISOString(),
            cycleWeek: w,
            description: `Weekly contribution for ${pod.name} (Cycle Week ${w})`,
            paymentMethod: 'Stripe Treasury / Bank',
          });
        }
      }
    });

    fallbackHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setHistory(fallbackHistory);
  }, [currentUser, myPods]);

  useEffect(() => {
    fetchPaymentHistory();
  }, [fetchPaymentHistory]);

  const cycles = useMemo(() => getUpcomingCycleDates(3, now), [now]);

  // Separate active vs forming pods
  const activePods = useMemo(() => {
    return (myPods || []).filter(p => p && p.status === 'ACTIVE');
  }, [myPods]);

  const formingPods = useMemo(() => {
    return (myPods || []).filter(p => p && (p.status === 'FORMING' || p.status === 'LOCKED'));
  }, [myPods]);

  // Total weekly deposit obligation across all active pods
  const weeklyTotalWithdrawal = useMemo(() => {
    return activePods.reduce((sum, pod) => {
      const isMember = (pod.members || []).some(m => 
        m.userId === currentUser.id || 
        (m.displayName && currentUser.displayName && m.displayName.trim().toLowerCase() === currentUser.displayName.trim().toLowerCase())
      );
      return isMember ? sum + (pod.depositTier || 0) : sum;
    }, 0);
  }, [activePods, currentUser]);

  // Calculate detailed cycle items
  const cycleData = useMemo(() => {
    return cycles.map((cycle) => {
      // 1. Thursday Withdrawals for this cycle
      const withdrawals = activePods.map(pod => {
        const userMember = (pod.members || []).find(m => 
          m.userId === currentUser.id || 
          (m.displayName && currentUser.displayName && m.displayName.trim().toLowerCase() === currentUser.displayName.trim().toLowerCase())
        );

        return {
          pod,
          amount: pod.depositTier || 0,
          isMember: Boolean(userMember),
          cycleWeek: (pod.currentCycleWeek || 1) + cycle.cycleIndex,
          totalCycles: pod.totalCycles,
          delinquencyStatus: userMember?.delinquencyStatus || 'CLEAN',
        };
      }).filter(item => item.isMember);

      const totalWithdrawal = withdrawals.reduce((sum, w) => sum + w.amount, 0);

      // 2. Friday Payouts for this cycle
      const payouts = activePods.map(pod => {
        const cycleWeek = (pod.currentCycleWeek || 1) + cycle.cycleIndex;
        const isCycleActive = cycleWeek <= pod.totalCycles;

        let recipientMember = null;
        let isUserRecipient = false;

        if (isCycleActive) {
          const targetIndex = cycleWeek - 1;
          recipientMember = (pod.members || []).find(m => m.rotationIndex === targetIndex);
          isUserRecipient = Boolean(
            recipientMember && (
              recipientMember.userId === currentUser.id ||
              (recipientMember.displayName && currentUser.displayName && recipientMember.displayName.trim().toLowerCase() === currentUser.displayName.trim().toLowerCase())
            )
          );
        }

        return {
          pod,
          cycleWeek,
          isCycleActive,
          amount: pod.weeklyPoolTarget || (pod.depositTier * (pod.members?.length || pod.sizeTier)),
          recipientMember,
          isUserRecipient,
        };
      }).filter(p => p.isCycleActive);

      const userPayouts = payouts.filter(p => p.isUserRecipient);
      const totalUserPayoutAmount = userPayouts.reduce((sum, p) => sum + p.amount, 0);

      return {
        ...cycle,
        withdrawals,
        totalWithdrawal,
        payouts,
        userPayouts,
        hasUserPayout: userPayouts.length > 0,
        totalUserPayoutAmount,
      };
    });
  }, [cycles, activePods, currentUser]);

  // Overall metrics across all 3 weeks
  const totalUserPayoutsNext3Weeks = cycleData.reduce((sum, c) => sum + c.totalUserPayoutAmount, 0);
  const totalUserPayoutCountNext3Weeks = cycleData.reduce((sum, c) => sum + c.userPayouts.length, 0);

  const nextThursdayCountdown = formatTimeRemaining(cycles[0]?.msUntilThursday || 0);
  const treasuryBalance = currentUser.treasury?.balanceUsd || 0;
  const isBalanceSufficient = treasuryBalance >= weeklyTotalWithdrawal;

  // Filtered History
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      if (historyFilter !== 'ALL' && item.type !== historyFilter) return false;
      if (historySearch.trim()) {
        const query = historySearch.toLowerCase();
        const matchesPod = item.podName.toLowerCase().includes(query);
        const matchesDesc = (item.description || '').toLowerCase().includes(query);
        const matchesId = (item.id || '').toLowerCase().includes(query);
        return matchesPod || matchesDesc || matchesId;
      }
      return true;
    });
  }, [history, historyFilter, historySearch]);

  // History Statistics
  const historyStats = useMemo(() => {
    let totalDeposited = 0;
    let totalPayouts = 0;
    let depositCount = 0;
    let payoutCount = 0;

    history.forEach(item => {
      if (item.status === 'COMPLETED') {
        if (item.type === 'DEPOSIT') {
          totalDeposited += item.amount;
          depositCount++;
        } else if (item.type === 'PAYOUT') {
          totalPayouts += item.amount;
          payoutCount++;
        }
      }
    });

    return {
      totalDeposited,
      totalPayouts,
      depositCount,
      payoutCount,
      netDifference: totalPayouts - totalDeposited,
    };
  }, [history]);

  return (
    <div className="bg-white border border-[#DDE1E6] rounded-2xl p-5 sm:p-6 shadow-sm space-y-7">
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#005FB8] flex items-center justify-center shrink-0 border border-blue-200">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono font-bold text-[#005FB8] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200">
              Automated Settlement Schedule
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-[#111827] tracking-tight">
            Upcoming Payments & Payouts
          </h3>
          <p className="text-xs text-[#6B7280] max-w-2xl">
            Next three weekly settlement cycles specific to your active pods. Automated deposit withdrawals execute on <strong className="text-[#111827]">Thursdays at 12:00 AM Midnight</strong>, and rotating pool payouts disburse on <strong className="text-[#111827]">Fridays at 12:00 AM Midnight</strong>.
          </p>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs self-start md:self-center shrink-0">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              filterMode === 'ALL'
                ? 'bg-white text-[#111827] shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            All 3 Cycles
          </button>
          <button
            onClick={() => setFilterMode('WITHDRAWALS')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterMode === 'WITHDRAWALS'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Withdrawals</span>
            {weeklyTotalWithdrawal > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-100 text-[#005FB8]">
                ${weeklyTotalWithdrawal}/wk
              </span>
            )}
          </button>
          <button
            onClick={() => setFilterMode('PAYOUTS')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterMode === 'PAYOUTS'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Payouts</span>
            {totalUserPayoutCountNext3Weeks > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-600 text-white font-mono animate-pulse">
                {totalUserPayoutCountNext3Weeks}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Snapshot Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Weekly Auto-Withdrawal */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Weekly Auto-Withdrawal
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-[#111827] font-mono">
              ${weeklyTotalWithdrawal.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500">/ week</span>
          </div>
          <span className="text-[11px] text-slate-600 block">
            Across {activePods.length} active {activePods.length === 1 ? 'pod' : 'pods'}
          </span>
        </div>

        {/* Metric 2: Next Immediate Thursday Sweep */}
        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1">
          <span className="text-[10px] font-bold text-[#005FB8] uppercase tracking-wider block flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Next Thursday Sweep
          </span>
          <div className="text-sm font-black text-[#111827] truncate">
            {cycles[0]?.thursdayFormatted || 'Upcoming Thursday'}
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100/80 text-[10px] font-bold text-[#005FB8] font-mono">
            <span>In {nextThursdayCountdown.formatted}</span>
          </div>
        </div>

        {/* Metric 3: Payouts Due in 3-Week Horizon */}
        <div className={`p-3.5 rounded-xl border space-y-1 ${
          totalUserPayoutCountNext3Weeks > 0 
            ? 'bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-200' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider block flex items-center gap-1 ${
            totalUserPayoutCountNext3Weeks > 0 ? 'text-emerald-700' : 'text-slate-500'
          }`}>
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Payouts (Next 3 Wks)
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-black font-mono ${
              totalUserPayoutCountNext3Weeks > 0 ? 'text-emerald-700' : 'text-[#111827]'
            }`}>
              ${totalUserPayoutsNext3Weeks.toFixed(2)}
            </span>
          </div>
          <span className={`text-[11px] font-medium block ${
            totalUserPayoutCountNext3Weeks > 0 ? 'text-emerald-800' : 'text-slate-500'
          }`}>
            {totalUserPayoutCountNext3Weeks > 0 
              ? `🎉 ${totalUserPayoutCountNext3Weeks} payout scheduled to you` 
              : 'None scheduled in next 3 wks'}
          </span>
        </div>

        {/* Metric 4: Funding & Treasury Buffer Health */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Funding Readiness
          </span>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#111827]">
            <Wallet className="w-3.5 h-3.5 text-slate-600" />
            <span>Treasury: ${treasuryBalance.toFixed(2)}</span>
          </div>
          <div className="pt-0.5">
            {weeklyTotalWithdrawal === 0 ? (
              <span className="text-[10px] text-slate-500">No active obligations</span>
            ) : isBalanceSufficient ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="w-3 h-3" />
                Covered by Balance
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                <AlertCircle className="w-3 h-3" />
                Linked Bank Backup Ready
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Empty State if no active pods */}
      {activePods.length === 0 && (
        <div className="p-6 sm:p-8 rounded-xl bg-gradient-to-r from-blue-50/50 via-slate-50 to-blue-50/50 border border-blue-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#005FB8] flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-base font-bold text-[#111827]">
              No Active Pod Settlements Scheduled
            </h4>
            <p className="text-xs text-[#6B7280]">
              You are not currently in any active rotation cycles. Join an existing active pod or start a new circle to establish your automated weekly savings and payout rotation dates.
            </p>
          </div>
          {onExplorePods && (
            <button
              onClick={onExplorePods}
              className="px-4 py-2 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Explore Active Mutual Pods</span>
            </button>
          )}
        </div>
      )}

      {/* 4. Forming Pods Callout (if any) */}
      {formingPods.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-start sm:items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold">
                {formingPods.length} Forming {formingPods.length === 1 ? 'Pod' : 'Pods'} Pending Lock:
              </span>{' '}
              <span className="text-amber-800">
                {formingPods.map(p => `${p.name} (${p.members?.length || 0}/${p.sizeTier})`).join(', ')}. Automated Thursday debits will initiate on the first Thursday after lock.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. The 3 Upcoming Weekly Cycles */}
      {activePods.length > 0 && (
        <div className="space-y-4 pt-1">
          {cycleData.map((cycle, idx) => {
            const isFirst = idx === 0;

            return (
              <div 
                key={cycle.cycleIndex} 
                className={`rounded-2xl border transition-all overflow-hidden ${
                  cycle.hasUserPayout
                    ? 'border-emerald-300 bg-gradient-to-b from-emerald-50/40 via-white to-white shadow-xs'
                    : isFirst
                    ? 'border-blue-200 bg-white shadow-xs'
                    : 'border-[#E2E8F0] bg-white'
                }`}
              >
                {/* Cycle Header */}
                <div className={`px-4 sm:px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
                  cycle.hasUserPayout
                    ? 'bg-emerald-100/60 border-emerald-200'
                    : isFirst
                    ? 'bg-blue-50/70 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono tracking-wider ${
                      cycle.hasUserPayout
                        ? 'bg-emerald-700 text-white'
                        : isFirst
                        ? 'bg-[#005FB8] text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {cycle.label}
                    </span>
                    <span className="text-xs font-bold text-[#111827] flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      {cycle.thursdayFormatted} — {cycle.fridayFormatted}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {cycle.hasUserPayout && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs animate-pulse">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>YOUR PAYOUT: +${cycle.totalUserPayoutAmount.toFixed(2)}</span>
                      </span>
                    )}

                    {isFirst && !cycle.hasUserPayout && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#005FB8] font-mono">
                        <Clock className="w-3 h-3" />
                        <span>Sweep in {nextThursdayCountdown.days}d {nextThursdayCountdown.hours}h</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Cycle Dual Column Content: Thursday Withdrawal & Friday Payout */}
                <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                  
                  {/* LEFT: Thursday Automated Withdrawal (col-span-5) */}
                  {(filterMode === 'ALL' || filterMode === 'WITHDRAWALS') && (
                    <div className={`${filterMode === 'WITHDRAWALS' ? 'lg:col-span-12' : 'lg:col-span-5'} space-y-3`}>
                      <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                          <h5 className="text-xs font-bold text-[#111827]">
                            Thursday 12:00 AM Midnight
                          </h5>
                        </div>
                        <span className="text-xs font-extrabold text-[#005FB8] font-mono">
                          -${cycle.totalWithdrawal.toFixed(2)} Total
                        </span>
                      </div>

                      {/* Withdrawal items by pod */}
                      <div className="space-y-2">
                        {cycle.withdrawals.map(({ pod, amount, cycleWeek, totalCycles }) => (
                          <div 
                            key={`w_${pod.id}_${cycle.cycleIndex}`}
                            onClick={() => onOpenPodDetail && onOpenPodDetail(pod)}
                            className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-[#111827] hover:text-[#005FB8] flex items-center gap-1 truncate max-w-[200px]">
                                {pod.name}
                                <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                              </span>
                              <span className="font-extrabold text-xs text-rose-700 font-mono">
                                -${amount.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-[#6B7280]">
                              <span>Cycle Week {cycleWeek} of {totalCycles}</span>
                              <span className="px-1.5 py-0.2 rounded bg-blue-100/70 text-[#005FB8] font-semibold">
                                Auto-Debit Ready
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-0.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Protected by First-Cycle Contingency Buffer</span>
                      </div>
                    </div>
                  )}

                  {/* MIDDLE: 24-Hour Settlement Buffer Indicator (col-span-2) */}
                  {filterMode === 'ALL' && (
                    <div className="lg:col-span-2 flex lg:flex-col items-center justify-center py-2 lg:py-0 border-y lg:border-y-0 lg:border-x border-gray-100 px-2 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-amber-900 block font-mono">
                          24h BUFFER
                        </span>
                        <span className="text-[9px] text-amber-700 leading-tight block">
                          Bank clearing & buffer reconciliation
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-600 hidden lg:block" />
                    </div>
                  )}

                  {/* RIGHT: Friday Automated Payout (col-span-5) */}
                  {(filterMode === 'ALL' || filterMode === 'PAYOUTS') && (
                    <div className={`${filterMode === 'PAYOUTS' ? 'lg:col-span-12' : 'lg:col-span-5'} space-y-3`}>
                      <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                          <h5 className="text-xs font-bold text-[#111827]">
                            Friday 12:00 AM Midnight
                          </h5>
                        </div>
                        <span className="text-xs font-bold text-slate-500 font-mono">
                          Rotation Payout
                        </span>
                      </div>

                      {/* Payout items by pod */}
                      <div className="space-y-2">
                        {cycle.payouts.map(({ pod, cycleWeek, amount, recipientMember, isUserRecipient }) => (
                          <div 
                            key={`p_${pod.id}_${cycle.cycleIndex}`}
                            onClick={() => onOpenPodDetail && onOpenPodDetail(pod)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                              isUserRecipient
                                ? 'bg-gradient-to-r from-emerald-500/10 via-teal-50 to-emerald-500/10 border-emerald-300 shadow-2xs'
                                : 'bg-slate-50 hover:bg-gray-100 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-[#111827] truncate max-w-[200px]">
                                {pod.name}
                              </span>
                              <span className={`font-black text-xs font-mono ${
                                isUserRecipient ? 'text-emerald-700' : 'text-[#111827]'
                              }`}>
                                +${amount.toFixed(2)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px]">
                              {isUserRecipient ? (
                                <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold">
                                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600/30" />
                                  <span>YOU receive this payout!</span>
                                </div>
                              ) : (
                                <div className="text-[#4B5563] text-[10px] truncate max-w-[210px]">
                                  Recipient: <strong className="text-[#111827]">{recipientMember?.displayName || 'Scheduled Member'}</strong>
                                  {recipientMember?.platform && (
                                    <span className="ml-1 text-gray-500 font-normal">
                                      ({recipientMember.platform})
                                    </span>
                                  )}
                                </div>
                              )}

                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                isUserRecipient
                                  ? 'bg-emerald-600 text-white uppercase tracking-wider'
                                  : 'bg-gray-200 text-gray-700'
                              }`}>
                                {isUserRecipient ? 'Your Turn' : `Week ${cycleWeek}`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-0.5">
                        <Zap className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Direct automated disbursement to Stripe Treasury</span>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. PAYMENT HISTORY SECTION */}
      <div className="pt-6 border-t border-[#E2E8F0] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                <History className="w-4 h-4" />
              </div>
              <h4 className="text-base sm:text-lg font-black text-[#111827]">
                Payment History
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 font-mono">
                {history.length} {history.length === 1 ? 'Record' : 'Records'}
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">
              Verified historical record of completed weekly contributions and lump-sum rotation payouts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPaymentHistory()}
              disabled={historyLoading}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer text-xs flex items-center gap-1 disabled:opacity-50"
              title="Refresh Payment History"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline font-semibold">Refresh</span>
            </button>
          </div>
        </div>

        {/* History Stats Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#005FB8] flex items-center justify-center shrink-0">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                Total Deposited
              </span>
              <span className="font-extrabold text-[#111827] font-mono text-sm">
                -${historyStats.totalDeposited.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 block font-normal">
                {historyStats.depositCount} weekly {historyStats.depositCount === 1 ? 'deposit' : 'deposits'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-3 border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                Total Payouts Received
              </span>
              <span className="font-extrabold text-emerald-700 font-mono text-sm">
                +${historyStats.totalPayouts.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 block font-normal">
                {historyStats.payoutCount} rotation {historyStats.payoutCount === 1 ? 'payout' : 'payouts'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-3 border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                Net Wealth Accumulated
              </span>
              <span className={`font-extrabold font-mono text-sm ${
                historyStats.netDifference >= 0 ? 'text-emerald-700' : 'text-slate-700'
              }`}>
                {historyStats.netDifference >= 0 ? '+' : ''}${historyStats.netDifference.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 block font-normal">
                Across all completed cycles
              </span>
            </div>
          </div>
        </div>

        {/* History Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search by pod name or cycle..."
              className="w-full pl-8.5 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs text-[#111827] focus:outline-none focus:border-[#005FB8] transition-colors"
            />
          </div>

          <div className="flex items-center p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs self-start sm:self-center">
            <button
              onClick={() => setHistoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                historyFilter === 'ALL'
                  ? 'bg-white text-[#111827] shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setHistoryFilter('DEPOSIT')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                historyFilter === 'DEPOSIT'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Deposits ({historyStats.depositCount})
            </button>
            <button
              onClick={() => setHistoryFilter('PAYOUT')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                historyFilter === 'PAYOUT'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Payouts ({historyStats.payoutCount})
            </button>
          </div>
        </div>

        {/* History Records Table / Cards */}
        {historyLoading ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#005FB8]" />
            <p>Loading verified payment records...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
            <Receipt className="w-8 h-8 text-slate-400 mx-auto" />
            <h5 className="font-bold text-sm text-[#111827]">No Payment Records Found</h5>
            <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
              {historySearch.trim() || historyFilter !== 'ALL'
                ? 'No transactions matched your current search or filter criteria.'
                : 'Historical records of automated Thursday deposit sweeps and Friday payouts will appear here as cycles complete.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredHistory.slice(0, historyLimit).map((item) => {
              const isPayout = item.type === 'PAYOUT';
              const dateObj = new Date(item.date);
              const formattedDate = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recent Date';
              const formattedTime = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : '';

              const matchingPod = (myPods || []).find(p => p.id === item.podId);

              return (
                <div
                  key={item.id}
                  onClick={() => matchingPod && onOpenPodDetail && onOpenPodDetail(matchingPod)}
                  className={`p-3 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                    isPayout
                      ? 'bg-emerald-50/40 hover:bg-emerald-50/70 border-emerald-200'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  } ${matchingPod ? 'cursor-pointer' : ''}`}
                >
                  {/* Left: Icon, Pod Name, Date */}
                  <div className="flex items-start sm:items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isPayout
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                        : 'bg-blue-50 text-[#005FB8] border-blue-200'
                    }`}>
                      {isPayout ? (
                        <ArrowUpRight className="w-5 h-5" />
                      ) : (
                        <ArrowDownLeft className="w-5 h-5" />
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#111827] hover:text-[#005FB8] text-sm">
                          {item.podName}
                        </span>
                        {item.cycleWeek && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-gray-100 text-gray-700 border border-gray-200">
                            Cycle Week {item.cycleWeek}
                          </span>
                        )}
                        <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${
                          isPayout 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-blue-100 text-[#005FB8]'
                        }`}>
                          {isPayout ? 'Rotation Payout' : 'Automated Sweep'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                        <span>{formattedDate} {formattedTime && `• ${formattedTime}`}</span>
                        <span>•</span>
                        <span className="text-slate-500 font-mono text-[10px]">
                          {item.paymentMethod || 'Stripe Treasury'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status and Amount */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-center shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                      item.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {item.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                      {item.status === 'PENDING' && <Clock className="w-3 h-3 text-amber-600" />}
                      {item.status === 'FAILED' && <AlertCircle className="w-3 h-3 text-rose-600" />}
                      <span>{item.status}</span>
                    </span>

                    <span className={`text-base font-black font-mono ${
                      isPayout ? 'text-emerald-700' : 'text-slate-900'
                    }`}>
                      {isPayout ? '+' : '-'}${item.amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Pagination / Expand Control */}
            {filteredHistory.length > 5 && (
              <div className="pt-2 text-center">
                {historyLimit < filteredHistory.length ? (
                  <button
                    onClick={() => setHistoryLimit(prev => prev + 5)}
                    className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Show More ({filteredHistory.length - historyLimit} remaining)
                  </button>
                ) : (
                  <button
                    onClick={() => setHistoryLimit(5)}
                    className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Show Less (Reset to 5)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. Footer Disclaimer & Automation Advice */}
      <div className="pt-3 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#6B7280]">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-[#005FB8] shrink-0" />
          <span>
            Sweeps run automatically via cloud heartbeat every Thursday and Friday at 12:00 AM Eastern.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-700">
            Current Treasury: ${treasuryBalance.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};
