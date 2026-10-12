import React, { useEffect, useState } from 'react';
import { HardshipFundRequest, Pod } from '../types';
import { useToast } from '../context/ToastContext';
import { HeartHandshake, RefreshCw, CheckCircle2, X, AlertTriangle } from 'lucide-react';

interface HardshipReviewQueueProps {
  allPods: Pod[];
  onDecision: () => void;
}

const RISK_STYLES: Record<string, string> = {
  LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MEDIUM: 'bg-amber-50 text-amber-800 border-amber-200',
  HIGH: 'bg-rose-50 text-rose-700 border-rose-200',
};

// Admin-only queue: every hardship request puts platform money into a pod, so
// MutualPool (not the pod creator) approves or rejects it, guided by the risk score.
export const HardshipReviewQueue: React.FC<HardshipReviewQueueProps> = ({ allPods, onDecision }) => {
  const toast = useToast();
  const [requests, setRequests] = useState<HardshipFundRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hardship/requests');
      if (res.ok) setRequests(await res.json());
    } catch (err) {
      console.warn('Failed to load hardship requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (request: HardshipFundRequest, action: 'approve' | 'reject') => {
    setBusyId(request.id);
    try {
      const res = await fetch(`/api/hardship/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: request.id, reason: rejectReasons[request.id] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || `Could not ${action} request`);
      toast.success(action === 'approve'
        ? `Approved: $${request.depositAmount.toFixed(2)} deposit covered for ${request.userName}.`
        : `Rejected hardship request from ${request.userName}.`);
      await load();
      onDecision();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Could not ${action} request`);
    } finally {
      setBusyId(null);
    }
  };

  const pending = requests
    .filter(r => r.status === 'PENDING')
    .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
  const recent = requests.filter(r => r.status !== 'PENDING').slice(0, 8);
  const podName = (podId: string, fallback: string) => allPods.find(p => p.id === podId)?.name || fallback;

  return (
    <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#111827] flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-rose-600" />
            Hardship Review Queue ({pending.length} pending)
          </h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Approving puts one platform-funded deposit into the pod. Limits: 1 approval per pod per week, 2 unpaid per pod.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="p-2 rounded-lg border border-[#DDE1E6] hover:bg-gray-50 text-[#6B7280]"
          aria-label="Refresh hardship requests"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {pending.length === 0 ? (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-xs text-gray-500">
          No hardship requests waiting for review.
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map(req => (
            <div key={req.id} className="p-4 border border-[#E2E8F0] rounded-lg space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-bold text-[#111827]">{req.userName}</span>
                  <span className="text-[#6B7280]"> in "{podName(req.podId, req.podName)}"</span>
                  {req.userId === req.creatorUserId && (
                    <span className="ml-2 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">POD CREATOR</span>
                  )}
                </div>
                <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${RISK_STYLES[req.riskLevel || 'LOW']}`}>
                  {req.riskLevel || 'LOW'} RISK · {req.riskScore ?? 0}/100
                </span>
              </div>

              <div className="text-xs text-[#374151] grid grid-cols-1 sm:grid-cols-3 gap-1">
                <span>Deposit covered: <strong>${req.depositAmount.toFixed(2)}</strong></span>
                <span>Payoff owed: <strong>${req.totalPayoffAmount.toFixed(2)}</strong></span>
                <span>Requested: {new Date(req.requestedAt).toLocaleDateString()}</span>
              </div>

              {req.reason && (
                <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded italic">"{req.reason}"</p>
              )}

              {req.riskReasons && req.riskReasons.length > 0 && (
                <ul className="text-[11px] text-[#92400E] bg-amber-50/60 border border-amber-100 rounded p-2 space-y-0.5">
                  {req.riskReasons.map(reason => (
                    <li key={reason} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Reason (shown to member if rejected)"
                  value={rejectReasons[req.id] || ''}
                  onChange={e => setRejectReasons(prev => ({ ...prev, [req.id]: e.target.value }))}
                  className="flex-1 px-3 py-2 text-xs border border-[#DDE1E6] rounded-lg"
                  maxLength={500}
                />
                <button
                  type="button"
                  onClick={() => decide(req, 'reject')}
                  disabled={busyId === req.id}
                  className="px-3 py-2 text-xs font-bold rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
                <button
                  type="button"
                  onClick={() => decide(req, 'approve')}
                  disabled={busyId === req.id}
                  className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve ${req.depositAmount.toFixed(2)}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <h4 className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">Recent decisions</h4>
          <ul className="space-y-1 text-xs text-[#374151]">
            {recent.map(r => (
              <li key={r.id} className="flex justify-between gap-2">
                <span>{r.userName} · {podName(r.podId, r.podName)}</span>
                <span className="font-mono text-[11px]">{r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
