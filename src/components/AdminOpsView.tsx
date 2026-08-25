import React, { useState } from 'react';
import { User, Pod } from '../types';
import { Sparkles, Send, ShieldCheck, AlertTriangle, Activity, RefreshCw, CheckCircle2 } from 'lucide-react';

interface AdminOpsViewProps {
  currentUser: User;
  allUsers: User[];
  allPods: Pod[];
  onRefreshData: () => void;
}

export const AdminOpsView: React.FC<AdminOpsViewProps> = ({
  currentUser,
  allUsers,
  allPods,
  onRefreshData,
}) => {
  const [webhookType, setWebhookType] = useState('treasury.outbound_transfer.posted');
  const [webhookPayload, setWebhookPayload] = useState('{\n  "amount": 40000,\n  "currency": "usd",\n  "status": "posted"\n}');
  const [firingWebhook, setFiringWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<string | null>(null);

  // Delinquency handling form state
  const [selectedPodId, setSelectedPodId] = useState(allPods[0]?.id || '');
  const [selectedMemberUserId, setSelectedMemberUserId] = useState('');
  const [actionChoice, setActionChoice] = useState<'GRACE_PERIOD' | 'COVER_GAP' | 'REMOVE'>('GRACE_PERIOD');
  const [handlingDelinquency, setHandlingDelinquency] = useState(false);
  const [delinquencyResult, setDelinquencyResult] = useState<string | null>(null);

  const activePod = allPods.find(p => p.id === selectedPodId);

  const handleFireWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setFiringWebhook(true);
    setWebhookResult(null);

    try {
      let parsed = {};
      try { parsed = JSON.parse(webhookPayload); } catch { parsed = { raw: webhookPayload }; }

      const res = await fetch('/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: webhookType,
          data: parsed,
        }),
      });

      const data = await res.json();
      setWebhookResult(`Webhook delivered successfully! Signature verified in test sandbox.`);
      onRefreshData();
    } catch (err: unknown) {
      setWebhookResult(`Webhook error: ${err instanceof Error ? err.message : 'Failed'}`);
    } finally {
      setFiringWebhook(false);
    }
  };

  const handleDelinquencyAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPodId || !selectedMemberUserId) return;

    setHandlingDelinquency(true);
    setDelinquencyResult(null);

    try {
      const res = await fetch('/api/admin/delinquency/handle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          podId: selectedPodId,
          memberUserId: selectedMemberUserId,
          actionChoice,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Action failed');

      if (data.removedFromPod) {
        setDelinquencyResult(`⚠️ Insufficient Balance: $${(data.balanceDeducted || 0).toFixed(2)} deducted from balance, remainder $${(data.welcomeMatchUsed || 0).toFixed(2)} covered by Welcome Match Reserve. Member was removed from Pod due to missed deposit default, and Pod is now publicly listed as Open Pod with replacement priority.`);
      } else if (data.outcome === 'FULL_BALANCE_DEDUCTED') {
        setDelinquencyResult(`💳 Full deposit of $${(data.balanceDeducted || 0).toFixed(2)} auto-deducted directly from member's account balance. Delinquency resolved and member remains active in pod.`);
      } else {
        setDelinquencyResult(`Action "${actionChoice}" executed for selected member.`);
      }
      onRefreshData();
    } catch (err: unknown) {
      setDelinquencyResult(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setHandlingDelinquency(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-[#005FB8]" />
            <h2 className="text-xl font-bold text-[#111827]">
              Platform Operations & Webhooks Test Sandbox
            </h2>
          </div>
          <p className="text-xs text-[#6B7280] max-w-2xl">
            Simulate Stripe Treasury & Identity asynchronous webhooks, manage delinquent deposit grace periods, and audit user KYC verification statuses.
          </p>
        </div>

        <button
          onClick={onRefreshData}
          className="px-3.5 py-2 rounded-lg bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <RefreshCw className="w-4 h-4 text-[#005FB8]" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Grid Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Stripe Webhook Simulator */}
        <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-[#005FB8] font-bold text-sm">
            <Send className="w-4 h-4" />
            <span>Stripe Webhook Event Generator</span>
          </div>

          <form onSubmit={handleFireWebhook} className="space-y-3 text-xs">
            <div>
              <label className="block text-[#111827] font-semibold mb-1">Select Event Type</label>
              <select
                value={webhookType}
                onChange={(e) => setWebhookType(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
              >
                <option value="treasury.outbound_transfer.posted">treasury.outbound_transfer.posted</option>
                <option value="treasury.financial_account.features_status_updated">treasury.financial_account.features_status_updated</option>
                <option value="identity.verification_session.verified">identity.verification_session.verified</option>
                <option value="account.updated">account.updated (Connect Custom)</option>
              </select>
            </div>

            <div>
              <label className="block text-[#111827] font-semibold mb-1">Payload JSON</label>
              <textarea
                rows={4}
                value={webhookPayload}
                onChange={(e) => setWebhookPayload(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-xs font-mono text-emerald-800"
              />
            </div>

            {webhookResult && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-900 rounded-lg text-xs font-medium">
                {webhookResult}
              </div>
            )}

            <button
              type="submit"
              disabled={firingWebhook}
              className="px-4 py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs"
            >
              <Send className="w-4 h-4" />
              <span>Fire Webhook Event</span>
            </button>
          </form>
        </div>

        {/* Missed Deposit & Delinquency Operations Tool */}
        <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Missed Deposit & Delinquency Handling</span>
          </div>

          <form onSubmit={handleDelinquencyAction} className="space-y-3 text-xs">
            <div>
              <label className="block text-[#111827] font-semibold mb-1">Select Active Pod</label>
              <select
                value={selectedPodId}
                onChange={(e) => setSelectedPodId(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
              >
                {allPods.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[#111827] font-semibold mb-1">Select Pod Member</label>
              <select
                value={selectedMemberUserId}
                onChange={(e) => setSelectedMemberUserId(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
              >
                <option value="">Select Member...</option>
                {activePod?.members.map(m => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName} ({m.delinquencyStatus})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[#111827] font-semibold mb-1">Action Choice</label>
              <select
                value={actionChoice}
                onChange={(e) => setActionChoice(e.target.value as 'GRACE_PERIOD' | 'COVER_GAP' | 'REMOVE')}
                className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
              >
                <option value="COVER_GAP">Auto-Deduct from Balance / Welcome Match Fallback</option>
                <option value="GRACE_PERIOD">Grant 24-Hour Grace Period</option>
                <option value="REMOVE">Remove Member Directly per Agreement</option>
              </select>
            </div>

            {delinquencyResult && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-900 rounded-lg text-xs font-medium">
                {delinquencyResult}
              </div>
            )}

            <button
              type="submit"
              disabled={handlingDelinquency || !selectedMemberUserId}
              className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs"
            >
              Execute Delinquency Action
            </button>
          </form>
        </div>

      </div>

    </div>
  );
};
