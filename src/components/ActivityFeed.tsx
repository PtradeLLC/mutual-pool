import React, { useState, useMemo, useEffect } from 'react';
import { Pod, User, AuditLogEntry, DelinquencyStatus } from '../types';
import { 
  Activity, 
  DollarSign, 
  Award, 
  AlertTriangle, 
  ArrowRightLeft, 
  Calendar, 
  Clock, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Users, 
  Sparkles, 
  ArrowUpDown, 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw,
  Vote,
  Info
} from 'lucide-react';
import { subscribeToAuditLogs } from '../lib/firestoreService';
import { useTranslation } from '../i18n';

export interface ActivityFeedItem {
  id: string;
  type: 'DEPOSIT' | 'PAYOUT' | 'DELINQUENCY' | 'SWAP_VOTE' | 'SYSTEM';
  action: string;
  title: string;
  detail: string;
  timestamp: string;
  actorName: string;
  actorId?: string;
  amount?: number;
  cycleWeek?: number;
  stripeReferenceId?: string;
  delinquencyStatus?: DelinquencyStatus;
  metadata?: Record<string, unknown>;
}

interface ActivityFeedProps {
  pod: Pod;
  currentUser: User;
  allUsers?: User[];
  auditLogs?: AuditLogEntry[];
  onRefresh?: () => void;
  className?: string;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  pod,
  currentUser,
  allUsers = [],
  auditLogs: initialAuditLogs,
  onRefresh,
  className = '',
}) => {
  const { t, language } = useTranslation();

  const [logs, setLogs] = useState<AuditLogEntry[]>(initialAuditLogs || []);
  const [filterType, setFilterType] = useState<'ALL' | 'DEPOSIT' | 'PAYOUT' | 'DELINQUENCY' | 'SWAP_VOTE'>('ALL');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Sync / fetch audit logs for this specific pod
  const fetchPodLogs = async () => {
    if (!pod?.id) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/audit-logs?podId=${encodeURIComponent(pod.id)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLogs(data);
        }
      }
    } catch (err) {
      console.warn('[ActivityFeed] Failed to fetch server audit logs:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  useEffect(() => {
    fetchPodLogs();
    if (!pod?.id) return;

    // Real-time Firestore subscription filtered by podId
    const unsubscribe = subscribeToAuditLogs((allLogs) => {
      const filtered = allLogs.filter((l) => l.podId === pod.id);
      if (filtered.length > 0) {
        setLogs((prev) => {
          const map = new Map<string, AuditLogEntry>();
          prev.forEach((p) => map.set(p.id, p));
          filtered.forEach((f) => map.set(f.id, f));
          return Array.from(map.values());
        });
      }
    });

    return () => unsubscribe();
  }, [pod.id]);

  useEffect(() => {
    if (initialAuditLogs && initialAuditLogs.length > 0) {
      setLogs((prev) => {
        const map = new Map<string, AuditLogEntry>();
        prev.forEach((p) => map.set(p.id, p));
        initialAuditLogs.forEach((l) => map.set(l.id, l));
        return Array.from(map.values());
      });
    }
  }, [initialAuditLogs]);

  // Aggregate audit log entries and pod member milestones into chronologically sorted items
  const activityItems = useMemo<ActivityFeedItem[]>(() => {
    const items: ActivityFeedItem[] = [];
    const seenIds = new Set<string>();

    // 1. Process server/firestore audit logs
    logs.forEach((log) => {
      if (seenIds.has(log.id)) return;
      seenIds.add(log.id);

      const action = log.action;
      let type: ActivityFeedItem['type'] = 'SYSTEM';
      let title = log.detail;
      const amount = typeof log.metadata?.amount === 'number' 
        ? log.metadata.amount 
        : typeof log.metadata?.totalPoolAmount === 'number'
          ? log.metadata.totalPoolAmount
          : undefined;
      const stripeRef = (log.metadata?.stripeTransferId || log.metadata?.stripePaymentId || log.metadata?.inboundTransferId) as string | undefined;
      const cycleWeek = typeof log.metadata?.cycleWeek === 'number' ? log.metadata.cycleWeek : undefined;
      let delinquencyStatus: DelinquencyStatus | undefined;

      if (
        action === 'DEPOSIT_COMPLETED' || 
        action === 'THURSDAY_AUTOMATED_DEPOSIT_SWEEP' || 
        action === 'CONTINGENCY_BUFFER_BRIDGED_DEPOSIT' ||
        action === 'SYSTEM_ESCROW_DEPOSIT_DISBURSED'
      ) {
        type = 'DEPOSIT';
        title = `Deposit of $${amount ? amount.toFixed(2) : (pod.depositTier * 1.05).toFixed(2)} USD Processed`;
      } else if (
        action === 'PAYOUT_EXECUTED' || 
        action === 'FRIDAY_AUTOMATED_PAYOUT_SWEEP' ||
        action === 'CREATOR_HOST_REWARD_DISBURSED'
      ) {
        type = 'PAYOUT';
        title = `Rotational Payout of $${amount ? amount.toFixed(2) : (pod.weeklyPoolTarget || (pod.sizeTier * pod.depositTier)).toFixed(2)} Disbursed`;
      } else if (
        action === 'DELINQUENCY_HANDLED' || 
        action === 'MEMBER_REMOVED' ||
        log.detail.toLowerCase().includes('delinquen') ||
        log.detail.toLowerCase().includes('grace period')
      ) {
        type = 'DELINQUENCY';
        title = 'Delinquency Status Change';
        if (log.detail.toLowerCase().includes('grace period')) {
          delinquencyStatus = 'GRACE_PERIOD';
        } else if (log.detail.toLowerCase().includes('delinquent')) {
          delinquencyStatus = 'DELINQUENT';
        } else {
          delinquencyStatus = 'CLEAN';
        }
      } else if (
        action === 'SLOT_SWAP_EXECUTED' || 
        action === 'REPRIORITIZATION_REQUESTED' || 
        action === 'REPRIORITIZATION_VOTED'
      ) {
        type = 'SWAP_VOTE';
        title = action === 'SLOT_SWAP_EXECUTED' ? 'Mutual Slot Swap Executed' : 'Emergency Reprioritization Vote';
      }

      items.push({
        id: log.id,
        type,
        action,
        title,
        detail: log.detail,
        timestamp: log.createdAt || new Date().toISOString(),
        actorName: log.actorName || 'MutualPool Member',
        actorId: log.actorId,
        amount,
        cycleWeek,
        stripeReferenceId: stripeRef,
        delinquencyStatus,
        metadata: log.metadata,
      });
    });

    // 2. Synthesize baseline member milestones if not covered by audit logs
    // (e.g. Completed payouts recorded on pod membership or active delinquency states)
    if (pod.members && pod.members.length > 0) {
      pod.members.forEach((member) => {
        // Payout milestone
        if (member.hasReceivedPayout && member.payoutProcessedAt) {
          const payoutSyntheticId = `synth_payout_${pod.id}_${member.userId}`;
          if (!seenIds.has(payoutSyntheticId)) {
            seenIds.add(payoutSyntheticId);
            items.push({
              id: payoutSyntheticId,
              type: 'PAYOUT',
              action: 'PAYOUT_EXECUTED',
              title: `Rotational Payout Disbursed to ${member.displayName}`,
              detail: `Rotational lump sum disbursed to ${member.displayName} for Week ${member.payoutCycleWeek || (member.rotationIndex + 1)} via Stripe Treasury.`,
              timestamp: member.payoutProcessedAt,
              actorName: member.displayName,
              actorId: member.userId,
              amount: pod.weeklyPoolTarget || (pod.sizeTier * pod.depositTier),
              cycleWeek: member.payoutCycleWeek || (member.rotationIndex + 1),
              stripeReferenceId: member.payoutStripeTransferId || `tr_payout_${pod.id.slice(0, 6)}_${member.userId.slice(0, 4)}`,
            });
          }
        }

        // Active Delinquency Alert
        if (member.delinquencyStatus && member.delinquencyStatus !== 'CLEAN') {
          const delinqSyntheticId = `synth_delinq_${pod.id}_${member.userId}_${member.delinquencyStatus}`;
          if (!seenIds.has(delinqSyntheticId)) {
            seenIds.add(delinqSyntheticId);
            const isGrace = member.delinquencyStatus === 'GRACE_PERIOD';
            items.push({
              id: delinqSyntheticId,
              type: 'DELINQUENCY',
              action: 'DELINQUENCY_HANDLED',
              title: isGrace 
                ? `24-Hour Grace Period Active for ${member.displayName}` 
                : `Delinquency Alert: Missed Contribution from ${member.displayName}`,
              detail: isGrace
                ? `${member.displayName} was granted a 24-hour grace period to reconcile missed weekly deposit for cycle week ${pod.currentCycleWeek}.`
                : `${member.displayName} is currently in delinquent status. First-Cycle Contingency Reserve or Platform Escrow may be engaged.`,
              timestamp: pod.cycleStartDate || new Date().toISOString(),
              actorName: member.displayName,
              actorId: member.userId,
              delinquencyStatus: member.delinquencyStatus,
              cycleWeek: pod.currentCycleWeek,
            });
          }
        }
      });
    }

    // 3. Pod Activation / Creation milestone
    if (pod.activatedAt || pod.createdAt) {
      const createdId = `synth_pod_created_${pod.id}`;
      if (!seenIds.has(createdId)) {
        seenIds.add(createdId);
        items.push({
          id: createdId,
          type: 'SYSTEM',
          action: 'POD_CREATED',
          title: `Pod Initialized: ${pod.name}`,
          detail: `Savings pod created with ${pod.sizeTier}-member capacity and $${pod.depositTier}/week deposit tier. Dedicated Treasury Holding Account: ${pod.holdingFinAccountId}.`,
          timestamp: pod.activatedAt || pod.createdAt,
          actorName: pod.creatorName || 'Pod Creator',
          actorId: pod.createdBy,
        });
      }
    }

    // 4. Sort chronologically
    return items.sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      return sortOrder === 'DESC' ? tB - tA : tA - tB;
    });
  }, [logs, pod, sortOrder]);

  // Filter items based on active filters
  const filteredItems = useMemo(() => {
    return activityItems.filter((item) => {
      // Type filter
      if (filterType !== 'ALL' && item.type !== filterType) {
        return false;
      }

      // Member filter
      if (selectedMemberId !== 'ALL') {
        const matchesActor = item.actorId === selectedMemberId;
        const matchesName = item.actorName?.toLowerCase().includes(
          (pod.members?.find((m) => m.userId === selectedMemberId)?.displayName || '').toLowerCase()
        );
        const matchesDetail = item.detail.toLowerCase().includes(
          (pod.members?.find((m) => m.userId === selectedMemberId)?.displayName || '').toLowerCase()
        );
        if (!matchesActor && !matchesName && !matchesDetail) {
          return false;
        }
      }

      // Text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDetail = item.detail.toLowerCase().includes(q);
        const matchActor = item.actorName.toLowerCase().includes(q);
        const matchRef = item.stripeReferenceId?.toLowerCase().includes(q);
        if (!matchTitle && !matchDetail && !matchActor && !matchRef) {
          return false;
        }
      }

      return true;
    });
  }, [activityItems, filterType, selectedMemberId, searchQuery, pod.members]);

  // Metrics summary
  const summary = useMemo(() => {
    const depositCount = activityItems.filter((i) => i.type === 'DEPOSIT').length;
    const payoutCount = activityItems.filter((i) => i.type === 'PAYOUT').length;
    const delinquentMembers = pod.members?.filter((m) => m.delinquencyStatus !== 'CLEAN') || [];

    const totalDepositedUsd = activityItems
      .filter((i) => i.type === 'DEPOSIT')
      .reduce((sum, item) => sum + (item.amount || (pod.depositTier * 1.05)), 0);

    const totalPaidOutUsd = activityItems
      .filter((i) => i.type === 'PAYOUT')
      .reduce((sum, item) => sum + (item.amount || (pod.weeklyPoolTarget || (pod.sizeTier * pod.depositTier))), 0);

    return {
      depositCount,
      payoutCount,
      delinquentCount: delinquentMembers.length,
      delinquentMembers,
      totalDepositedUsd,
      totalPaidOutUsd,
    };
  }, [activityItems, pod]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const now = Date.now();
      const past = new Date(isoString).getTime();
      const diffSec = Math.floor((now - past) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
      const locale = language === 'es' ? 'es-US' : language === 'fr' ? 'fr-FR' : 'en-US';
      return new Date(isoString).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const formatFullDate = (isoString: string) => {
    try {
      const locale = language === 'es' ? 'es-US' : language === 'fr' ? 'fr-FR' : 'en-US';
      return new Date(isoString).toLocaleString(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10.5px] uppercase font-bold tracking-wider">Deposits Logged</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-base font-extrabold text-slate-900 font-mono">
            {summary.depositCount}
          </div>
          <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
            ${summary.totalDepositedUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10.5px] uppercase font-bold tracking-wider">Payouts Completed</span>
            <Award className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-base font-extrabold text-slate-900 font-mono">
            {summary.payoutCount}
          </div>
          <div className="text-[10px] text-indigo-700 font-semibold mt-0.5">
            ${summary.totalPaidOutUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} disbursed
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10.5px] uppercase font-bold tracking-wider">Delinquency Status</span>
            <AlertTriangle className={`w-3.5 h-3.5 ${summary.delinquentCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
          </div>
          <div className={`text-base font-extrabold font-mono ${summary.delinquentCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
            {summary.delinquentCount === 0 ? 'All Clean' : `${summary.delinquentCount} Member${summary.delinquentCount === 1 ? '' : 's'}`}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {summary.delinquentCount === 0 ? '100% on-time standing' : 'Needs attention'}
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10.5px] uppercase font-bold tracking-wider">Active Cycle</span>
            <Calendar className="w-3.5 h-3.5 text-[#005FB8]" />
          </div>
          <div className="text-base font-extrabold text-slate-900 font-mono">
            Week {pod.currentCycleWeek || 1}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            of {pod.totalCycles || pod.sizeTier} total weeks
          </div>
        </div>
      </div>

      {/* Controls Bar: Filters, Search, Member Dropdown & Sort */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        {/* Filter Category Chips */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              All Events ({activityItems.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterType('DEPOSIT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'DEPOSIT'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Deposits ({activityItems.filter((i) => i.type === 'DEPOSIT').length})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType('PAYOUT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'PAYOUT'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Payouts ({activityItems.filter((i) => i.type === 'PAYOUT').length})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType('DELINQUENCY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'DELINQUENCY'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Delinquency ({activityItems.filter((i) => i.type === 'DELINQUENCY').length})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType('SWAP_VOTE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'SWAP_VOTE'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Swaps & Votes ({activityItems.filter((i) => i.type === 'SWAP_VOTE').length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC')}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              title={`Sorting: ${sortOrder === 'DESC' ? 'Newest first' : 'Oldest first'}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{sortOrder === 'DESC' ? 'Newest' : 'Oldest'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                fetchPodLogs();
                if (onRefresh) onRefresh();
              }}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Activity Feed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search & Member Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-100">
          <div className="relative sm:col-span-2">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by member name, amount, or Stripe transfer ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#005FB8]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-[10px] text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#005FB8] cursor-pointer"
            >
              <option value="ALL">All Members ({pod.members?.length || 0})</option>
              {pod.members?.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName} {member.delinquencyStatus !== 'CLEAN' ? `(${member.delinquencyStatus})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h5 className="font-bold text-sm text-slate-800">No matching pod activity found</h5>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery || filterType !== 'ALL' || selectedMemberId !== 'ALL'
                  ? 'Try clearing your search or category filter to view all events.'
                  : 'As members deposit weekly contributions, receive rotational payouts, or experience status changes, events will record here in real time.'}
              </p>
            </div>
            {(searchQuery || filterType !== 'ALL' || selectedMemberId !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setFilterType('ALL');
                  setSelectedMemberId('ALL');
                  setSearchQuery('');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-3">
            {/* Left Connecting Timeline Line */}
            <div className="absolute left-2.5 sm:left-3.5 top-3 bottom-3 w-0.5 bg-slate-200" />

            {filteredItems.map((item, idx) => {
              // Icon and style mappings
              let iconNode = <Activity className="w-3.5 h-3.5 text-slate-600" />;
              let dotBg = 'bg-slate-100 border-slate-300';
              let badgeColor = 'bg-slate-100 text-slate-800 border-slate-200';
              let badgeLabel = item.action;

              if (item.type === 'DEPOSIT') {
                iconNode = <DollarSign className="w-3.5 h-3.5 text-emerald-600" />;
                dotBg = 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-100';
                badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                badgeLabel = 'Deposit Completed';
              } else if (item.type === 'PAYOUT') {
                iconNode = <Award className="w-3.5 h-3.5 text-indigo-600" />;
                dotBg = 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-100';
                badgeColor = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                badgeLabel = 'Rotational Payout';
              } else if (item.type === 'DELINQUENCY') {
                iconNode = <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />;
                dotBg = 'bg-rose-50 border-rose-500 ring-2 ring-rose-100 animate-pulse';
                badgeColor = item.delinquencyStatus === 'GRACE_PERIOD' 
                  ? 'bg-amber-50 text-amber-900 border-amber-300' 
                  : 'bg-rose-50 text-rose-900 border-rose-300';
                badgeLabel = item.delinquencyStatus === 'GRACE_PERIOD' ? 'Grace Period (24h)' : 'Delinquency Status';
              } else if (item.type === 'SWAP_VOTE') {
                iconNode = <ArrowRightLeft className="w-3.5 h-3.5 text-sky-600" />;
                dotBg = 'bg-sky-50 border-sky-500 ring-2 ring-sky-100';
                badgeColor = 'bg-sky-50 text-sky-800 border-sky-200';
                badgeLabel = 'Rotation Swap / Vote';
              }

              return (
                <div key={item.id} className="relative group">
                  {/* Timeline Node Dot */}
                  <div className={`absolute -left-6 sm:-left-8 top-3.5 w-5 h-5 rounded-full border flex items-center justify-center bg-white shadow-2xs z-10 ${dotBg}`}>
                    {iconNode}
                  </div>

                  {/* Activity Card */}
                  <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-2">
                    {/* Header: Action Badge, Relative Time & Full Timestamp */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-mono text-[10.5px] font-bold border ${badgeColor}`}>
                          {badgeLabel}
                        </span>

                        {item.cycleWeek && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                            Week {item.cycleWeek}
                          </span>
                        )}

                        {item.delinquencyStatus && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                            item.delinquencyStatus === 'CLEAN'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : item.delinquencyStatus === 'GRACE_PERIOD'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-rose-100 text-rose-900 border-rose-300'
                          }`}>
                            {item.delinquencyStatus}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono" title={formatFullDate(item.timestamp)}>
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="font-semibold text-slate-600">{formatRelativeTime(item.timestamp)}</span>
                        <span className="hidden sm:inline text-slate-300">•</span>
                        <span className="hidden sm:inline text-[10.5px]">{formatFullDate(item.timestamp)}</span>
                      </div>
                    </div>

                    {/* Title & Detail Narrative */}
                    <div>
                      <h5 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                        <span>{item.title}</span>
                      </h5>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        {item.detail}
                      </p>
                    </div>

                    {/* Metadata Footer: Actor, Amount & Stripe Transfer Reference */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                          {item.actorName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[11px]">
                          Member: <strong>{item.actorName}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.amount !== undefined && item.amount > 0 && (
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-900 border border-slate-200">
                            ${item.amount.toFixed(2)} USD
                          </span>
                        )}

                        {item.stripeReferenceId && (
                          <button
                            type="button"
                            onClick={() => handleCopy(item.id, item.stripeReferenceId!)}
                            className="text-[10px] font-mono text-[#005FB8] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                            title="Click to copy Stripe reference ID"
                          >
                            <span>Ref: {item.stripeReferenceId.slice(0, 16)}...</span>
                            {copiedId === item.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-blue-500" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
