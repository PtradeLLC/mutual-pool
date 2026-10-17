import React, { useCallback, useEffect, useState } from 'react';
import { AchCollection, DepositDefault, User } from '../types';
import { useToast } from '../context/ToastContext';
import { AlertTriangle, Banknote, CheckCircle2, Clock, Landmark, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';

// Admin view of every missed deposit (what each member still owes) with the
// controls to recover it by ACH debit under the member's mandate.

type DefaultRow = DepositDefault & {
  remainingUsd: number;
  memberMandate: { status: string; bankName?: string; last4?: string };
  memberEmail?: string;
  memberBalanceUsd: number;
  collections: AchCollection[];
};

interface Summary {
  openCount: number;
  owedUsd: number;
  recoveredUsd: number;
  payoutThenDefaultCount: number;
  processingCollections: number;
}

interface DepositDefaultsPanelProps {
  currentUser: User;
  onChanged?: () => void;
}

const money = (n: number | undefined) => `$${(Number(n) || 0).toFixed(2)}`;

export const DepositDefaultsPanel: React.FC<DepositDefaultsPanelProps> = ({ currentUser, onChanged }) => {
  const toast = useToast();
  const [rows, setRows] = useState<DefaultRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/defaults', { headers: { 'x-user-id': currentUser.id } });
      if (!res.ok) return;
      const data = await res.json();
      setRows(data.defaults || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.warn('Failed to load deposit defaults:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => { load(); }, [load]);

  const collect = async (row: DefaultRow) => {
    const raw = amounts[row.id];
    const amountUsd = raw === undefined || raw.trim() === '' ? row.remainingUsd : Number(raw);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > row.remainingUsd + 1e-9) {
      toast.error(`Enter an amount between $0.01 and ${money(row.remainingUsd)}.`, { title: 'Invalid amount' });
      return;
    }
    if (!window.confirm(`Debit ${money(amountUsd)} from ${row.userName}'s bank account ••••${row.memberMandate.last4 || ''} under their mandate?\n\nThe member is notified in the app. ACH settles in ~4 business days.`)) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/defaults/${row.id}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({ amountUsd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Collection failed');
      toast.success(`ACH debit of ${money(amountUsd)} initiated (${data.collection?.stripePaymentIntentId || 'pending'}). You'll be notified when it settles.`, { title: 'Collection started' });
      setAmounts(prev => ({ ...prev, [row.id]: '' }));
      await load();
      onChanged?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Collection failed', { title: 'ACH collection' });
    } finally {
      setBusyId(null);
    }
  };

  const writeOff = async (row: DefaultRow) => {
    const reason = window.prompt(`Write off ${money(row.remainingUsd)} still owed by ${row.userName}? Enter a reason:`);
    if (reason === null) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/defaults/${row.id}/write-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Write-off failed');
      toast.info('Default written off.', { title: 'Deposit defaults' });
      await load();
      onChanged?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Write-off failed', { title: 'Deposit defaults' });
    } finally {
      setBusyId(null);
    }
  };

  const visible = rows.filter(r => showClosed || r.status === 'OPEN' || r.status === 'COLLECTING');

  const statusBadge = (status: DepositDefault['status']) => {
    const map: Record<DepositDefault['status'], string> = {
      OPEN: 'bg-red-50 text-red-700 border-red-200',
      COLLECTING: 'bg-blue-50 text-blue-700 border-blue-200',
      RECOVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      WRITTEN_OFF: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${map[status]}`}>{status.replace('_', ' ')}</span>;
  };

  const collectionBadge = (c: AchCollection) => {
    const icon = c.status === 'SUCCEEDED' ? <CheckCircle2 className="w-3 h-3" /> : c.status === 'PROCESSING' ? <Clock className="w-3 h-3" /> : c.status === 'NEEDS_REVIEW' ? <AlertTriangle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />;
    const color = c.status === 'SUCCEEDED' ? 'text-emerald-700' : c.status === 'PROCESSING' ? 'text-blue-700' : c.status === 'NEEDS_REVIEW' ? 'text-amber-700' : 'text-red-700';
    return (
      <div key={c.id} className={`flex items-center gap-1 text-[10px] font-semibold ${color}`} title={c.failureReason || c.stripePaymentIntentId || ''}>
        {icon}
        <span>{money(c.amountUsd)} {c.status.toLowerCase()}{c.failureReason ? ` — ${c.failureReason}` : ''}</span>
      </div>
    );
  };

  return (
    <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#111827] font-bold text-sm">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span>Deposit Defaults & ACH Collections</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Every missed deposit, what the member still owes, and whether it can be recovered from their bank under the debit mandate they signed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600 font-medium">
            <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} />
            Show recovered / written off
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-xs flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#005FB8] ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg border border-red-200 bg-red-50/60 p-3">
            <div className="text-[10px] uppercase font-bold text-red-700 tracking-wide">Open defaults</div>
            <div className="text-xl font-black font-mono text-[#111827]">{summary.openCount}</div>
            <div className="text-[10px] text-gray-600">{summary.payoutThenDefaultCount} after taking a payout</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <div className="text-[10px] uppercase font-bold text-amber-800 tracking-wide">Still owed</div>
            <div className="text-xl font-black font-mono text-amber-900">{money(summary.owedUsd)}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="text-[10px] uppercase font-bold text-emerald-800 tracking-wide">Recovered</div>
            <div className="text-xl font-black font-mono text-emerald-900">{money(summary.recoveredUsd)}</div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
            <div className="text-[10px] uppercase font-bold text-[#005FB8] tracking-wide">ACH debits processing</div>
            <div className="text-xl font-black font-mono text-[#111827]">{summary.processingCollections}</div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-2.5 px-3">Member</th>
              <th className="py-2.5 px-3">Pod / Week</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Owed / Remaining</th>
              <th className="py-2.5 px-3">Bank mandate</th>
              <th className="py-2.5 px-3">ACH debits</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 px-3 text-center text-gray-500">
                  {loading ? 'Loading…' : 'No open defaults. Missed deposits recorded by the Thursday sweep or a delinquency action will appear here.'}
                </td>
              </tr>
            )}
            {visible.map(row => {
              const mandateActive = row.memberMandate.status === 'ACTIVE';
              const actionable = row.status === 'OPEN' && row.remainingUsd > 0;
              const inFlight = row.status === 'COLLECTING';
              return (
                <tr key={row.id} className="hover:bg-gray-50/80 align-top">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-[#111827]">{row.userName}</div>
                    <div className="text-[10px] text-gray-500">{row.memberEmail || row.userId}</div>
                    {row.payoutReceivedUsd > 0 && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" /> Took payout {money(row.payoutReceivedUsd)}
                      </div>
                    )}
                    {row.memberRemoved && <div className="text-[10px] text-gray-500 mt-0.5">Removed from pod</div>}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-[#111827]">{row.podName}</div>
                    <div className="text-[10px] text-gray-500">Week {row.cycleWeek} • {money(row.depositTierUsd)}/wk • {row.trigger.replace(/_/g, ' ').toLowerCase()}</div>
                    <div className="text-[10px] text-gray-400">{new Date(row.createdAt).toLocaleString()}</div>
                  </td>
                  <td className="py-3 px-3">{statusBadge(row.status)}</td>
                  <td className="py-3 px-3 font-mono">
                    <div className="font-bold text-[#111827]">{money(row.owedUsd)} / <span className={row.remainingUsd > 0 ? 'text-red-700' : 'text-emerald-700'}>{money(row.remainingUsd)}</span></div>
                    <div className="text-[10px] text-gray-500 font-sans">
                      buffer {money(row.bufferCoveredUsd)} • escrow {money(row.escrowCoveredUsd)} • pot {money(row.potShortfallUsd)}
                      {row.remainingObligationUsd > 0 && <> • future deposits {money(row.remainingObligationUsd)}</>}
                    </div>
                    <div className="text-[10px] text-gray-500 font-sans">Member balance {money(row.memberBalanceUsd)}</div>
                  </td>
                  <td className="py-3 px-3">
                    {mandateActive ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                        <Landmark className="w-3 h-3" /> {row.memberMandate.bankName || 'Bank'} ••••{row.memberMandate.last4}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700 font-semibold text-[11px]">
                        <XCircle className="w-3 h-3" /> {row.memberMandate.status === 'NONE' ? 'None on file' : row.memberMandate.status.toLowerCase()}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 space-y-0.5">
                    {row.collections.length === 0 ? <span className="text-gray-400 text-[10px]">None yet</span> : row.collections.map(collectionBadge)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {actionable && mandateActive && (
                      <div className="flex items-center justify-end gap-1.5">
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          max={row.remainingUsd}
                          placeholder={row.remainingUsd.toFixed(2)}
                          value={amounts[row.id] ?? ''}
                          onChange={e => setAmounts(prev => ({ ...prev, [row.id]: e.target.value }))}
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => collect(row)}
                          disabled={busyId === row.id}
                          className="px-2.5 py-1 rounded bg-[#111827] hover:bg-black text-white font-bold text-[10px] inline-flex items-center gap-1 disabled:opacity-60"
                          title="Debit the member's bank under their mandate"
                        >
                          <Banknote className="w-3 h-3" /> {busyId === row.id ? 'Starting…' : 'Collect via ACH'}
                        </button>
                      </div>
                    )}
                    {actionable && !mandateActive && (
                      <div className="text-[10px] text-gray-500">No mandate: deduct from balance / future payouts, or write off.</div>
                    )}
                    {inFlight && (row.collections.some(c => c.status === 'NEEDS_REVIEW')
                      ? <div className="text-[10px] text-amber-700 font-semibold">Stripe answer unclear: resolve in the Operations review queue.</div>
                      : <div className="text-[10px] text-blue-700 font-semibold">Waiting for ACH to settle…</div>)}
                    {actionable && (
                      <button
                        type="button"
                        onClick={() => writeOff(row)}
                        disabled={busyId === row.id}
                        className="mt-1.5 text-[10px] text-gray-500 hover:text-gray-800 underline disabled:opacity-60"
                      >
                        Write off
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
