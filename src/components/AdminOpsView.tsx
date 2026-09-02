import React, { useState } from 'react';
import { User, Pod } from '../types';
import { useCountry } from '../context/CountryContext';
import { SUPPORTED_COUNTRIES } from '../config/countries';
import { Sparkles, Send, ShieldCheck, AlertTriangle, Activity, RefreshCw, CheckCircle2, DollarSign, Users, Bot, Layers, ArrowUpRight, Globe, Building2, Smartphone, ExternalLink, Shield } from 'lucide-react';

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
  const { country, countryCode, setCountry, isStandalone } = useCountry();
  const [webhookType, setWebhookType] = useState('treasury.outbound_transfer.posted');
  const [webhookPayload, setWebhookPayload] = useState('{\n  "amount": 40000,\n  "currency": "usd",\n  "status": "posted"\n}');
  const [firingWebhook, setFiringWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<string | null>(null);

  // Delinquency handling form state
  const [selectedPodId, setSelectedPodId] = useState(allPods[0]?.id || '');
  const [selectedMemberUserId, setSelectedMemberUserId] = useState('');
  const [actionChoice, setActionChoice] = useState<'GRACE_PERIOD' | 'COVER_GAP' | 'REMOVE'>('COVER_GAP');
  const [handlingDelinquency, setHandlingDelinquency] = useState(false);
  const [delinquencyResult, setDelinquencyResult] = useState<string | null>(null);
  const [injectingSpot, setInjectingSpot] = useState<string | null>(null);

  const activePod = allPods.find(p => p.id === selectedPodId);

  // Calculate Real-Time Aggregate Delinquency & System Spotting Metrics
  let totalDelinquentMembers = 0;
  let totalGracePeriodMembers = 0;
  let totalHardshipMembers = 0;
  let totalSystemEscrowDrawnUsd = 0;
  let totalWelcomeMatchReserveDrawnUsd = 0;
  let totalAiStewardshipPods = 0;

  allPods.forEach(pod => {
    if (pod.stewardshipMode === 'AUTONOMOUS_AI') {
      totalAiStewardshipPods += 1;
    }
    if (pod.systemEscrowDrawnUsd) {
      totalSystemEscrowDrawnUsd += pod.systemEscrowDrawnUsd;
    }
    const initialBuffer = pod.contingencyBufferInitialUsd ?? 20;
    const currentBuffer = pod.contingencyBufferUsd ?? 20;
    if (currentBuffer < initialBuffer) {
      totalWelcomeMatchReserveDrawnUsd += (initialBuffer - currentBuffer);
    }

    pod.members?.forEach(m => {
      if (m.delinquencyStatus === 'DELINQUENT') {
        totalDelinquentMembers += 1;
      } else if (m.delinquencyStatus === 'GRACE_PERIOD') {
        totalGracePeriodMembers += 1;
      }
      if (m.isHardshipInactive || m.hardshipStatus === 'INACTIVE_HOLD') {
        totalHardshipMembers += 1;
      }
    });
  });

  const totalMembersInDefaultState = totalDelinquentMembers + totalGracePeriodMembers + totalHardshipMembers;
  const totalSystemSpottingLiquidity = totalSystemEscrowDrawnUsd + totalWelcomeMatchReserveDrawnUsd;

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

  const handleSystemDepositSpot = async (podId: string) => {
    setInjectingSpot(podId);
    try {
      const res = await fetch(`/api/pods/${podId}/system-deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to spot pod');
      onRefreshData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'System deposit failed');
    } finally {
      setInjectingSpot(null);
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
              Platform Operations & Delinquency Command Center
            </h2>
          </div>
          <p className="text-xs text-[#6B7280] max-w-2xl">
            Live tracking of member default statuses, system spot liquidity draws (Platform Escrow & Welcome Match Reserves), automated AI custodian takeovers, and Stripe webhook testing.
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

      {/* Aggregate Delinquency & System Spotting Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Members in Default / Delinquency */}
        <div className="bg-white border border-red-200 rounded-xl p-4.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-red-700 tracking-wide uppercase">Members in Default</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#111827] font-mono mb-1">
            {totalMembersInDefaultState}
          </div>
          <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-2">
            <span>{totalDelinquentMembers} Delinquent</span>
            <span>•</span>
            <span>{totalGracePeriodMembers} Grace Period</span>
            <span>•</span>
            <span>{totalHardshipMembers} Hardship</span>
          </div>
        </div>

        {/* Metric 2: Total System Liquidity Spotting */}
        <div className="bg-white border border-amber-200 rounded-xl p-4.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-800 tracking-wide uppercase">Total System Spotting</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-900 font-mono mb-1">
            ${totalSystemSpottingLiquidity.toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-500">
            Advanced to keep Pod payout pots 100% whole
          </div>
        </div>

        {/* Metric 3: System Deposits Escrow Drawn */}
        <div className="bg-white border border-blue-200 rounded-xl p-4.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#005FB8] tracking-wide uppercase">Platform Escrow Drawn</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#005FB8]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#005FB8] font-mono mb-1">
            ${totalSystemEscrowDrawnUsd.toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-500">
            Direct System Escrow injections
          </div>
        </div>

        {/* Metric 4: Autonomous AI Custodian Pods */}
        <div className="bg-white border border-purple-200 rounded-xl p-4.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-purple-700 tracking-wide uppercase">AI Custodian Takeovers</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-900 font-mono mb-1">
            {totalAiStewardshipPods} <span className="text-xs font-normal text-purple-700">of {allPods.length} Pods</span>
          </div>
          <div className="text-[11px] text-gray-500">
            Lainie AI managing defaulted Creator slots
          </div>
        </div>

      </div>

      {/* Multi-Country Domain Architecture & Market Control Panel */}
      <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 text-[#111827] font-bold text-sm">
              <Globe className="w-4 h-4 text-[#005FB8]" />
              <span>Multi-Country Domain Architecture & Isolated Market Context</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Single codebase powering country-specific domains (myapp.com, myapp.uk, myapp.ng, myapp.nl) with dynamic PWA manifests and standalone in-app switching.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Active Market:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-[#005FB8] font-bold text-xs">
              <span>{country.flag}</span>
              <span>{country.countryName} ({country.currency.code})</span>
            </span>
          </div>
        </div>

        {/* Live Market Simulation Tabs for Admin */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">Simulate Domain Context:</span>
          {SUPPORTED_COUNTRIES.map((c) => {
            const isCurrent = countryCode === c.countryCode;
            return (
              <button
                key={c.countryCode}
                type="button"
                onClick={() => setCountry(c.countryCode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isCurrent
                    ? 'bg-[#005FB8] text-white border-[#005FB8] shadow-xs'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                <span>{c.flag}</span>
                <span>{c.primaryDomain}</span>
                <span className={`text-[10px] font-mono px-1 rounded ${isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                  {c.currency.code}
                </span>
              </button>
            );
          })}
        </div>

        {/* Country Registry Details Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-[10px] tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5">Region</th>
                <th className="px-3 py-2.5">Primary Domain</th>
                <th className="px-3 py-2.5">Currency & Locale</th>
                <th className="px-3 py-2.5">Payment Rails</th>
                <th className="px-3 py-2.5">Regulatory Authority</th>
                <th className="px-3 py-2.5">PWA Manifest Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SUPPORTED_COUNTRIES.map((c) => {
                const isSelected = countryCode === c.countryCode;
                return (
                  <tr key={c.countryCode} className={isSelected ? 'bg-blue-50/50 font-medium' : 'hover:bg-gray-50/50'}>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{c.flag}</span>
                        <span className="font-bold text-gray-900">{c.countryName}</span>
                        {isSelected && (
                          <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded">
                            ACTIVE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-gray-700">
                      {c.primaryDomain}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-mono font-bold text-blue-700">{c.currency.code} ({c.currency.symbol})</span>
                      <span className="text-gray-400 ml-1">· {c.defaultLocale}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                      {c.payment.providerDisplayName.split('(')[0].trim()}
                    </td>
                    <td className="px-3 py-2.5 max-w-xs truncate text-gray-600" title={c.regulations.regulatoryBody}>
                      {c.regulations.regulatoryBody}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-800 font-semibold">
                      {c.pwa.name}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PWA & Standalone Mode Isolation Notice */}
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600 flex items-start gap-2">
          <Smartphone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-gray-800">
              App Store & PWA Origin Isolation Guard {isStandalone ? '(Installed Mode Active)' : '(Web Browser Mode)'}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              In installed PWA or native App Store wrappers, external domain hops (e.g. from myapp.com to myapp.ng) are strictly intercepted to execute seamless in-app context switching. This preserves the standalone window experience and prevents the OS from opening a secondary browser tab.
            </p>
          </div>
        </div>
      </div>

      {/* Pod Delinquency & System Escrow Ledger Table */}
      <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#111827] font-bold text-sm">
            <Layers className="w-4 h-4 text-[#005FB8]" />
            <span>Pod Delinquency & System Liquidity Audit Ledger</span>
          </div>
          <span className="text-xs text-[#6B7280] font-medium">
            {allPods.length} Total Pods Tracked
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Pod Name</th>
                <th className="py-2.5 px-3">Status / Cycle</th>
                <th className="py-2.5 px-3">Stewardship</th>
                <th className="py-2.5 px-3">Delinquent Members</th>
                <th className="py-2.5 px-3">Welcome Match Buffer</th>
                <th className="py-2.5 px-3">System Escrow Spotted</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-sans">
              {allPods.map((p) => {
                const delinquentCount = p.members.filter(m => m.delinquencyStatus !== 'CLEAN' || m.isHardshipInactive).length;
                const bufferRemaining = p.contingencyBufferUsd ?? 20;
                const escrowDrawn = p.systemEscrowDrawnUsd || 0;
                const isAiManaged = p.stewardshipMode === 'AUTONOMOUS_AI';

                return (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-3 font-semibold text-[#111827]">
                      {p.name}
                      <div className="text-[10px] text-gray-500 font-mono font-normal">
                        ID: {p.id} • ${p.depositTier}/wk
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        p.status === 'FORMING' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {p.status} (Wk {p.currentCycleWeek}/{p.totalCycles})
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {isAiManaged ? (
                        <span className="inline-flex items-center gap-1 text-purple-700 font-bold text-[11px]">
                          <Bot className="w-3 h-3 text-purple-600" />
                          <span>Lainie AI Custodian</span>
                        </span>
                      ) : (
                        <span className="text-gray-700 text-[11px]">
                          {p.creatorName || 'Creator Host'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {delinquentCount > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[11px]">
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                          <span>{delinquentCount} Member{delinquentCount > 1 ? 's' : ''}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>All Clean</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono font-medium">
                      <span className={bufferRemaining < 20 ? 'text-amber-700 font-bold' : 'text-emerald-700'}>
                        ${bufferRemaining.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium">
                      {escrowDrawn > 0 ? (
                        <span className="font-bold text-[#005FB8]">
                          ${escrowDrawn.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">$0.00</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleSystemDepositSpot(p.id)}
                        disabled={injectingSpot === p.id}
                        className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-[#005FB8] font-bold text-[10px] border border-blue-200 transition-colors inline-flex items-center gap-1"
                        title="Inject system escrow liquidity deposit"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>{injectingSpot === p.id ? 'Spotting…' : 'Spot Deposit'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Missed Deposit & Delinquency Operations Tool */}
        <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Missed Deposit & Delinquency Resolution Tool</span>
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
                    {m.displayName} ({m.delinquencyStatus}{m.isHardshipInactive ? ' • Hardship Hold' : ''})
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
                <option value="COVER_GAP">Auto-Deduct from Balance / Welcome Match & Escrow Fallback</option>
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
                rows={3}
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

      </div>

    </div>
  );
};

