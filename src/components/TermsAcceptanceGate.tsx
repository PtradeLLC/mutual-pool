import React, { useState } from 'react';
import { Scale, CheckCircle2, AlertCircle } from 'lucide-react';
import { User } from '../types';
import { TERMS_VERSION } from '../lib/legal';

interface TermsAcceptanceGateProps {
  user: User;
  onAccepted: (user: User) => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}

// Shown to signed-in members who haven't accepted the current Terms (new
// Google/phone sign-ups, and everyone when the terms version changes). The
// server also refuses money actions until acceptance is recorded.
export const TermsAcceptanceGate: React.FC<TermsAcceptanceGateProps> = ({ user, onAccepted, onOpenTerms, onOpenPrivacy }) => {
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isUpdate = Boolean(user.termsAcceptedVersion);

  const accept = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/users/accept-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: TERMS_VERSION }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.user) throw new Error(data.message || 'Could not record your acceptance. Please try again.');
      onAccepted(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record your acceptance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#DDE1E6] rounded-2xl max-w-md w-full p-6 shadow-2xl text-[#111827] space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-50 text-[#005FB8] border border-blue-100">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">{isUpdate ? 'Our terms have been updated' : 'One last step'}</h3>
            <p className="text-xs text-[#6B7280]">
              {isUpdate ? 'Please review and accept the new version to keep using pods and payments.' : 'Please review and accept our terms before using pods and payments.'}
            </p>
          </div>
        </div>

        <p className="text-xs text-[#374151] leading-relaxed">
          The terms explain your commitment to each pod you join, the fees ({'10% per payout'}) and the refundable 5% pod buffer, what happens if a member stops paying,
          and how brand-campaign shifts are verified and paid.
        </p>

        <label className="flex items-start gap-2.5 text-xs text-[#374151] cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#005FB8]" />
          <span>
            I have read and agree to the{' '}
            <button type="button" onClick={onOpenTerms} className="text-[#005FB8] underline font-semibold">Terms of Service</button>
            {' '}and the{' '}
            <button type="button" onClick={onOpenPrivacy} className="text-[#005FB8] underline font-semibold">Privacy Policy</button>.
          </span>
        </label>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={accept}
          disabled={!agreed || saving}
          className="w-full py-3 rounded-xl bg-[#005FB8] text-white font-bold text-sm hover:bg-[#004C94] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          {saving ? 'Saving…' : 'I agree'}
        </button>
        <p className="text-[10px] text-[#9CA3AF] text-center">Version {TERMS_VERSION}</p>
      </div>
    </div>
  );
};
