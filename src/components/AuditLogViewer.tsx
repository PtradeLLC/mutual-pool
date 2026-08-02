import React, { useState, useEffect } from 'react';
import { AuditLogEntry } from '../types';
import { Activity, Search, ShieldCheck, Lock, FileText, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { subscribeToAuditLogs } from '../lib/firestoreService';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/audit-logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
    const unsubscribe = subscribeToAuditLogs((firestoreLogs) => {
      if (firestoreLogs && firestoreLogs.length > 0) {
        setLogs(firestoreLogs);
      }
    });
    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      !searchQuery || 
      log.detail.toLowerCase().includes(q) || 
      log.actorName.toLowerCase().includes(q) ||
      (log.podId && log.podId.toLowerCase().includes(q));
    return matchesAction && matchesSearch;
  });

  const actionPillColor = (action: AuditLogEntry['action']) => {
    switch (action) {
      case 'ROTATION_LOCKED': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'PAYOUT_EXECUTED': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'AGREEMENT_SIGNED': return 'bg-sky-50 text-[#005FB8] border-sky-200';
      case 'DEPOSIT_COMPLETED': return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'REPRIORITIZATION_REQUESTED': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'SLOT_SWAP_EXECUTED': return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'KYC_VERIFIED': return 'bg-blue-50 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Banner */}
      <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-5 h-5 text-[#005FB8]" />
            <h2 className="text-xl font-bold text-[#111827]">
              Immutable Transparent Audit Ledger
            </h2>
          </div>
          <p className="text-xs text-[#6B7280] max-w-2xl">
            Append-only verification trail documenting all pod creation events, digital agreement signatures, rotation locks, Stripe Treasury payouts, and voluntary slot swaps.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#005FB8]" />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by actor, pod ID, or action..."
            className="w-full bg-white border border-[#DDE1E6] rounded-lg pl-10 pr-4 py-2.5 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8] shadow-xs"
          />
        </div>

        <select
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
          className="bg-white border border-[#DDE1E6] rounded-lg px-3.5 py-2.5 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8] shadow-xs font-medium"
        >
          <option value="ALL">All Event Types</option>
          <option value="ROTATION_LOCKED">ROTATION_LOCKED</option>
          <option value="PAYOUT_EXECUTED">PAYOUT_EXECUTED</option>
          <option value="AGREEMENT_SIGNED">AGREEMENT_SIGNED</option>
          <option value="DEPOSIT_COMPLETED">DEPOSIT_COMPLETED</option>
          <option value="REPRIORITIZATION_REQUESTED">REPRIORITIZATION_REQUESTED</option>
          <option value="SLOT_SWAP_EXECUTED">SLOT_SWAP_EXECUTED</option>
          <option value="KYC_VERIFIED">KYC_VERIFIED</option>
        </select>
      </div>

      {/* Log Feed */}
      <div className="space-y-2">
        {filteredLogs.map((log) => {
          const isExpanded = expandedLogId === log.id;

          return (
            <div
              key={log.id}
              className="bg-white border border-[#DDE1E6] hover:border-gray-400 rounded-lg p-4 transition-all text-xs shadow-xs"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${actionPillColor(log.action)}`}>
                    {log.action}
                  </span>
                  {log.podId && (
                    <span className="font-mono text-gray-600 text-[10px] bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                      {log.podId}
                    </span>
                  )}
                </div>

                <span className="text-gray-500 text-[10px] font-mono shrink-0">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>

              <p className="text-[#111827] leading-relaxed font-sans mb-2 font-medium">
                {log.detail}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-[11px]">
                <span className="text-[#6B7280]">
                  Actor: <strong className="text-[#111827]">{log.actorName}</strong> ({log.actorId})
                </span>

                {log.metadata && (
                  <button
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="text-[#005FB8] hover:underline font-mono text-[10px] flex items-center gap-1 font-semibold"
                  >
                    <span>{isExpanded ? 'Hide Payload' : 'View Payload'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {isExpanded && log.metadata && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 font-mono text-[10px] text-gray-800 overflow-x-auto">
                  <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
