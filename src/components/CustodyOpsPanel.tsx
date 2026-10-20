import React, { useEffect, useState } from 'react';
import { Landmark, RefreshCw, Play, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

// Admin Ops: where member money sits (ledger or Column), the settlement queue,
// and anything the bank rejected or returned.

interface MovementRow {
  id: string;
  purpose: string;
  amountUsd: number;
  status: string;
  description: string;
  from: { kind: string; userId?: string; podId?: string; account?: string; label?: string };
  to: { kind: string; userId?: string; podId?: string; account?: string; label?: string };
  lastError?: string;
  attempts?: number;
  columnTransferId?: string;
  createdAt: string;
}
interface CustodyReport {
  status: { mode: string; column: string; platformConfigured: boolean; pendingMovements: number; oldestPendingAt: string | null; failedMovements: number };
  pending: MovementRow[];
  failed: MovementRow[];
  recent: MovementRow[];
}

const readJson = async (res: Response) => { const t = await res.text().catch(() => ''); try { return t ? JSON.parse(t) : {}; } catch { return {}; } };
const ref = (r: MovementRow['from']) => r.kind === 'member' ? `member ${String(r.userId || '').slice(0, 10)}` : r.kind === 'pod' ? `pod ${String(r.podId || '').slice(0, 10)}` : r.kind === 'platform' ? `platform ${r.account}` : `external ${r.label || ''}`;

export const CustodyOpsPanel: React.FC = () => {
  const [report, setReport] = useState<CustodyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [settling, setSettling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'failed' | 'recent'>('pending');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/custody');
      if (res.ok) setReport(await readJson(res));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const settleNow = async () => {
    setSettling(true);
    setMessage(null);
    try {
      const res = await fetch('/api/platform/schedule/custody-settle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await readJson(res);
      setMessage(res.ok ? `Settled ${data.settled}, failed ${data.failed}, waiting ${data.waiting}.` : (data.message || 'Settlement failed'));
      await load();
    } finally {
      setSettling(false);
    }
  };

  if (!report) {
    return <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 shadow-xs text-xs text-slate-500 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading custody…</div>;
  }
  const s = report.status;
  const rows = tab === 'pending' ? report.pending : tab === 'failed' ? report.failed : report.recent;

  return (
    <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-[#005FB8]" />
          <h3 className="text-base font-bold text-[#111827]">Custody & settlement</h3>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.mode === 'column' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
            {s.mode === 'column' ? `Column (${s.column})` : 'ledger only'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 border border-[#DDE1E6] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
          {s.mode === 'column' && (
            <button type="button" onClick={settleNow} disabled={settling} className="px-3 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Play className="w-3.5 h-3.5" /> {settling ? 'Settling…' : 'Settle now'}</button>
          )}
        </div>
      </div>
      {message && <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{message}</div>}

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60">
          <div className="flex items-center gap-1.5 text-amber-800 font-bold uppercase text-[10px]"><Clock className="w-3.5 h-3.5" /> Pending</div>
          <div className="text-2xl font-black font-mono text-[#111827]">{s.pendingMovements}</div>
          <div className="text-[10.5px] text-slate-500">{s.oldestPendingAt ? `oldest ${new Date(s.oldestPendingAt).toLocaleString()}` : 'nothing waiting'}</div>
        </div>
        <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/60">
          <div className="flex items-center gap-1.5 text-rose-800 font-bold uppercase text-[10px]"><AlertTriangle className="w-3.5 h-3.5" /> Failed / returned</div>
          <div className="text-2xl font-black font-mono text-[#111827]">{s.failedMovements}</div>
          <div className="text-[10.5px] text-slate-500">needs a human</div>
        </div>
        <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60">
          <div className="flex items-center gap-1.5 text-emerald-800 font-bold uppercase text-[10px]"><CheckCircle2 className="w-3.5 h-3.5" /> Platform accounts</div>
          <div className="text-2xl font-black font-mono text-[#111827]">{s.platformConfigured ? 'ready' : '—'}</div>
          <div className="text-[10.5px] text-slate-500">{s.platformConfigured ? 'operating · escrow · revenue' : s.mode === 'column' ? 'created on first movement' : 'not used in ledger mode'}</div>
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs">
        {(['pending', 'failed', 'recent'] as const).map(k => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg font-bold capitalize cursor-pointer ${tab === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{k} ({k === 'pending' ? report.pending.length : k === 'failed' ? report.failed.length : report.recent.length})</button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-slate-500">No {tab} movements.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-1.5 pr-3">When</th><th className="py-1.5 pr-3">Purpose</th><th className="py-1.5 pr-3">From</th><th className="py-1.5 pr-3">To</th><th className="py-1.5 pr-3 text-right">Amount</th><th className="py-1.5 pr-3">Status</th><th className="py-1.5">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map(m => (
                <tr key={m.id} className="border-b border-slate-100 align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap font-mono text-slate-500">{new Date(m.createdAt).toLocaleString()}</td>
                  <td className="py-1.5 pr-3 font-bold text-slate-800">{m.purpose.replace(/_/g, ' ').toLowerCase()}</td>
                  <td className="py-1.5 pr-3 font-mono text-slate-600">{ref(m.from)}</td>
                  <td className="py-1.5 pr-3 font-mono text-slate-600">{ref(m.to)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono font-bold">${m.amountUsd.toFixed(2)}</td>
                  <td className="py-1.5 pr-3"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${m.status === 'SETTLED' ? 'bg-emerald-50 text-emerald-800' : m.status === 'PENDING' ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-800'}`}>{m.status.toLowerCase()}</span></td>
                  <td className="py-1.5 text-slate-600">{m.description}{m.lastError ? <span className="block text-rose-700">{m.lastError}{m.attempts ? ` (attempt ${m.attempts})` : ''}</span> : null}{m.columnTransferId ? <span className="block font-mono text-slate-400">{m.columnTransferId}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
