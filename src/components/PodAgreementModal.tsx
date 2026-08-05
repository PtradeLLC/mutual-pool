import React, { useState } from 'react';
import { Pod, User } from '../types';
import { FileText, CheckCircle2, Lock, ShieldCheck, AlertTriangle, X } from 'lucide-react';

interface PodAgreementModalProps {
  pod: Pod;
  user: User;
  onClose: () => void;
  onSigned: () => void;
}

export const PodAgreementModal: React.FC<PodAgreementModalProps> = ({ pod, user, onClose, onSigned }) => {
  const [signatureName, setSignatureName] = useState(user.displayName);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acknowledged) {
      setError('You must acknowledge all terms before signing.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/pods/${pod.id}/agreement/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          signatureName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Signing failed');
      }

      onSigned();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Agreement signature failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col text-[#111827]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="p-3 rounded-xl bg-blue-50 text-[#005FB8]">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#111827]">Pod Mutual Agreement v2.0-2026</h3>
            <p className="text-xs text-[#6B7280]">{pod.name} ({pod.sizeTier} Members @ ${pod.depositTier}/wk)</p>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs shrink-0">
            {error}
          </div>
        )}

        {/* Scrollable Document Text */}
        <div className="overflow-y-auto space-y-4 text-xs text-[#4B5563] bg-[#F8FAFC] p-5 rounded-lg border border-[#E2E8F0] flex-1 leading-relaxed mb-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-[#005FB8] font-medium">
            <strong>PLAIN-LANGUAGE SUMMARY:</strong> This is a legally binding agreement for a digital Rotating Savings and Credit Association (ROSCA). All deposits are committed to weekly member rotation payouts.
          </div>

          <section>
            <h4 className="font-bold text-[#111827] text-sm mb-1">1. Fixed Rotation Order (No Random Lotteries)</h4>
            <p>
              When this pod fills to capacity, a one-time cryptographically secure random shuffle will fix the payout rotation indices (0 through {pod.sizeTier - 1}). Once established, this rotation order is permanent for all {pod.totalCycles} cycles and cannot be re-randomized.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-[#111827] text-sm mb-1">2. No Guaranteed Interest or Investment Returns</h4>
            <p>
              Mutual savings pools are interest-free financial tools. Members deposit exactly ${pod.depositTier}.00 weekly for {pod.totalCycles} weeks and receive one lump sum payout of ${pod.weeklyPoolTarget}.00. There are no fees, dividends, or interest payments accrued.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-[#111827] text-sm mb-1">3. Emergency Reprioritization & Voluntary Swaps</h4>
            <p>
              Members facing urgent financial hardship (e.g., vehicle repairs, medical emergencies) may submit a formal Reprioritization Request. Advancement requires a formal pod vote meeting a 50%+1 quorum threshold. Two consenting members may also execute a voluntary slot swap before payout. Every rotation modification is written to an immutable audit log.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-[#111827] text-sm mb-1">4. Missed Deposit & Delinquency Handling Policy</h4>
            <p>
              Weekly deposits close on scheduled cycle cutoffs. Members who fail to deposit are marked DELINQUENT with a 24-hour grace window. If unresolved, pod admins or pod vote will determine whether to cover the gap from pod reserve funds, delay the cycle payout, or remove the delinquent member per terms.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-[#111827] text-sm mb-1">5. Stripe Treasury FDIC Pass-Through Disclosure</h4>
            <p>
              Pod cycle balances sit in Stripe Treasury Financial Accounts backed by Evolve Bank & Trust or Fifth Third Bank, N.A., Members FDIC. Deposits are FDIC-insured pass-through up to $250,000 per user, subject to standard policy conditions.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-[#111827] text-sm mb-1">6. Mutual Pool First Deposit Welcome Match & Contingency Buffer</h4>
            <p>
              For new pod creators with verified KYC accounts, Mutual Pool provides a 100% platform-funded Welcome Match up to $20.00. This non-withdrawable promotional credit is deposited directly into the pod's First-Cycle Contingency Buffer to safeguard rotation payout schedules against missed deposits during Cycle 1. If the pod disbands prior to activation, unspent match funds revert to Mutual Pool Treasury.
            </p>
          </section>
        </div>

        {/* Signature Controls */}
        <form onSubmit={handleSign} className="space-y-3 shrink-0">
          <label className="flex items-start gap-2.5 text-xs text-[#111827] cursor-pointer bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-[#005FB8] focus:ring-[#005FB8] shrink-0"
            />
            <span>
              I have read, understood, and agree to abide by all 5 clauses of the Pod Mutual Agreement v2.0-2026.
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1">
                Digital Signature (Type Full Name)
              </label>
              <input
                type="text"
                required
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-[#111827] font-serif focus:outline-none focus:border-[#005FB8]"
                placeholder="e.g. Marcus Vance"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#111827] font-semibold text-xs border border-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !acknowledged}
                className="w-1/2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                {loading ? (
                  <span>Signing...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>e-Sign Pod Agreement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
