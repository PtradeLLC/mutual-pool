import React, { useState } from 'react';
import { X, ArrowDownToLine, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

// Withdraw from the member's MutualPool (Dwolla) balance to their linked bank.

interface Props {
  availableUsd: number;
  bankName?: string | null;
  onClose: () => void;
  onDone: () => void;
}

export const WithdrawModal: React.FC<Props> = ({ availableUsd, bankName, onClose, onDone }) => {
  const [amount, setAmount] = useState(availableUsd >= 1 ? availableUsd.toFixed(2) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(value) || value < 1) return setError('Withdraw at least $1.00.');
    if (value > availableUsd + 1e-9) return setError(`You can withdraw up to $${availableUsd.toFixed(2)}.`);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/dwolla/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ amountUsd: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Withdrawal failed.');
      setDone(true);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed.');
    } finally {
      setBusy(false);
    }
  };

  const primary = 'w-full py-2.5 rounded-xl bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-900 font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer';

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="bg-white border border-[#DDE1E6] rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-[#111827]">
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 cursor-pointer">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="p-3 rounded-xl bg-blue-50 text-[#005FB8] border border-blue-100"><ArrowDownToLine className="w-6 h-6" /></div>
          <div>
            <h3 className="text-lg font-bold">Withdraw to bank</h3>
            <p className="text-xs text-[#6B7280]">Available: ${availableUsd.toFixed(2)}</p>
          </div>
        </div>
        {done ? (
          <div className="text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <p className="text-sm font-semibold">Withdrawal started</p>
            <p className="text-xs text-slate-600">It usually reaches {bankName || 'your bank'} in 1–2 business days.</p>
            <button type="button" onClick={onClose} className={primary}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {error && <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Amount (USD)</label>
              <input className="w-full px-3 py-2 rounded-lg border border-[#DDE1E6] text-sm" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <p className="text-[11px] text-slate-500">To {bankName || 'your linked bank'} · standard transfer, 1–2 business days.</p>
            <button type="submit" disabled={busy || availableUsd < 1} className={primary}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Withdraw
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default WithdrawModal;
