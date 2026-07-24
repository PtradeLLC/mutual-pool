import React, { useState } from 'react';
import { User } from '../types';
import { Building2, CheckCircle2, AlertCircle, X, CreditCard, ShieldCheck } from 'lucide-react';

interface StripeBankModalProps {
  user: User;
  onClose: () => void;
  onBankLinked: (updatedUser: User) => void;
}

export const StripeBankModal: React.FC<StripeBankModalProps> = ({ user, onClose, onBankLinked }) => {
  const [bankName, setBankName] = useState('Chase Bank');
  const [accountNumber, setAccountNumber] = useState('•••• •••• 4821');
  const [routingNumber, setRoutingNumber] = useState('021000021');
  const [accountType, setAccountType] = useState<'CHECKING' | 'SAVINGS'>('CHECKING');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLinkBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/users/bank/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          bankName,
          accountNumber,
          routingNumber,
          accountType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to link bank account');
      }

      onBankLinked(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bank linking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-lg w-full p-6 shadow-2xl relative text-[#111827]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 rounded-xl bg-blue-50 text-[#005FB8]">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#111827]">Stripe Financial Connections</h3>
            <p className="text-xs text-[#6B7280]">Link External Bank Account for Deposits & Payout Pushes</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLinkBank} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#111827] mb-1.5">
              Select Financial Institution
            </label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
            >
              <option value="Chase Bank">Chase Bank (JPMorgan Chase)</option>
              <option value="Bank of America">Bank of America</option>
              <option value="Wells Fargo">Wells Fargo</option>
              <option value="Capital One">Capital One</option>
              <option value="Chime Bank">Chime Financial</option>
              <option value="Discover Bank">Discover Bank</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                Routing Number
              </label>
              <input
                type="text"
                required
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8] font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                Account Type
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as 'CHECKING' | 'SAVINGS')}
                className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
              >
                <option value="CHECKING">Checking Account</option>
                <option value="SAVINGS">Savings Account</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111827] mb-1.5">
              Account Number / Last 4
            </label>
            <input
              type="text"
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8] font-mono text-xs"
            />
          </div>

          <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] text-xs text-[#4B5563] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>256-bit encrypted bank connection via Stripe Financial Connections OAuth.</span>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#111827] font-semibold text-xs border border-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs"
            >
              {loading ? (
                <span>Linking Bank Account...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Connect Bank & Enable Withdrawals</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
