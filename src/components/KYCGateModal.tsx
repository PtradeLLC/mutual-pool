import React, { useState } from 'react';
import { User } from '../types';
import { ShieldAlert, CheckCircle2, AlertCircle, FileText, Lock, ArrowRight, X } from 'lucide-react';

interface KYCGateModalProps {
  user: User;
  onClose: () => void;
  onVerified: (updatedUser: User) => void;
}

export const KYCGateModal: React.FC<KYCGateModalProps> = ({ user, onClose, onVerified }) => {
  const [idType, setIdType] = useState('Driver License');
  const [fullName, setFullName] = useState(user.displayName);
  const [ssnLast4, setSsnLast4] = useState('4821');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/users/kyc/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          idType,
          fullName,
          ssnLast4,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      onVerified(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'KYC verification failed');
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
          <div className="p-3 rounded-xl bg-amber-50 text-amber-700">
            <ShieldAlert className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#111827]">Stripe Identity Verification Required</h3>
            <p className="text-xs text-[#6B7280]">Mandatory KYC Gate for Stripe Treasury Financial Accounts</p>
          </div>
        </div>

        <div className="mb-6 bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0] text-xs text-[#4B5563] space-y-2">
          <div className="flex items-start gap-2 text-amber-800 font-semibold">
            <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>Hard Compliance Requirement</span>
          </div>
          <p>
            Per Stripe Treasury underwriting guidelines, every mutual pool member must complete identity verification before creating, holding, or depositing funds into a Treasury Financial Account.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#111827] mb-1.5">
              Full Legal Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
              placeholder="e.g. Marcus Vance"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                Government ID Type
              </label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
              >
                <option value="Driver License">Driver's License</option>
                <option value="State ID">State ID Card</option>
                <option value="US Passport">US Passport</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                SSN Last 4 Digits
              </label>
              <input
                type="password"
                maxLength={4}
                required
                value={ssnLast4}
                onChange={(e) => setSsnLast4(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8] font-mono tracking-widest text-center"
                placeholder="••••"
              />
            </div>
          </div>

          <div className="bg-[#F8FAFC] border border-dashed border-gray-300 rounded-lg p-4 text-center text-xs text-[#6B7280] space-y-1">
            <FileText className="w-5 h-5 mx-auto text-[#005FB8] mb-1" />
            <p className="text-[#111827] font-semibold">[Stripe Test Mode] Instant Identity Verification</p>
            <p className="text-[11px] text-gray-500">Submits synthetic payload to Stripe Identity verification endpoint.</p>
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
                <span>Verifying via Stripe Identity...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify Identity & Activate Treasury</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
