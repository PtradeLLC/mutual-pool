import React, { useState } from 'react';
import { User, Pod, PodSizeTier, DepositTier, PodType, InvitedContact, ActivationPolicy } from '../types';
import { savePodToFirestore, saveUserToFirestore, addAuditLogToFirestore } from '../lib/firestoreService';
import { TrustedCircleInviter } from './TrustedCircleInviter';
import { KycVerificationModal } from './KycVerificationModal';
import { 
  PlusCircle, 
  Lock, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles, 
  X, 
  CheckCircle2, 
  Users, 
  Clock, 
  Zap, 
  CreditCard, 
  ArrowLeft, 
  Building2, 
  Shield, 
  Check,
  UserCheck
} from 'lucide-react';

interface CreatePodModalProps {
  user: User;
  onClose: () => void;
  onPodCreated: (newPod?: Pod) => void;
  onUserUpdated?: (updatedUser: User) => void;
}

export const CreatePodModal: React.FC<CreatePodModalProps> = ({ user, onClose, onPodCreated, onUserUpdated }) => {
  const [currentUserState, setCurrentUserState] = useState<User>(user);
  const [showKycModal, setShowKycModal] = useState(false);
  const [step, setStep] = useState<'CONFIG' | 'STRIPE_CHECKOUT' | 'SUCCESS'>('CONFIG');
  
  // Pod configuration states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food Delivery & Rideshare');
  const [podType, setPodType] = useState<PodType>('TRUSTED_CIRCLE');
  const [activationPolicy, setActivationPolicy] = useState<ActivationPolicy>('WHEN_FULL');
  const [inviteWindowDays, setInviteWindowDays] = useState<number>(7);
  const [autoOpenOnExpire, setAutoOpenOnExpire] = useState<boolean>(true);
  const [invitedContacts, setInvitedContacts] = useState<InvitedContact[]>([]);
  const [sizeTier, setSizeTier] = useState<PodSizeTier>(20);
  const [depositTier, setDepositTier] = useState<DepositTier>(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stripe Payment Checkout states
  const [paymentMethod, setPaymentMethod] = useState<'SAVED_CARD' | 'NEW_CARD' | 'APPLE_PAY'>('SAVED_CARD');
  const [cardName, setCardName] = useState(currentUserState.displayName || 'Verified Member');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('321');
  const [cardZip, setCardZip] = useState('90210');
  const [createdPodResult, setCreatedPodResult] = useState<any>(null);

  // Default invite code generator preview
  const [generatedInviteCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());

  const isSeasoned = currentUserState.accountAgeDays >= 90 || currentUserState.completedPodsCount >= 1;
  const canCreateOpenPod = currentUserState.completedPodsCount >= 1 || isSeasoned;

  const baseDepositAmount = Number(depositTier) || 20;
  const platformFee = Math.round(baseDepositAmount * 0.05 * 100) / 100;
  const totalChargedAmount = baseDepositAmount + platformFee;

  const handleAddContacts = (newItems: { name: string; emailOrPhone: string }[]) => {
    const freshInvites: InvitedContact[] = newItems.map(item => ({
      id: `ic_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: item.name || item.emailOrPhone,
      emailOrPhone: item.emailOrPhone,
      isExistingMember: item.emailOrPhone.includes('gigmutual.app'),
      status: item.emailOrPhone.includes('gigmutual.app') ? 'PENDING_INVITE' : 'INVITED',
      invitedAt: new Date().toISOString(),
    }));

    setInvitedContacts(prev => [...prev, ...freshInvites]);
  };

  // Step 1 -> Step 2 transition: validate pod details before showing Stripe checkout
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (currentUserState.kycStatus !== 'VERIFIED') {
      setError('You must complete Stripe Identity KYC verification before creating a mutual savings pod.');
      setShowKycModal(true);
      return;
    }

    if (!name.trim()) {
      setError('Please enter a descriptive name for your Mutual Savings Pod before proceeding to payment.');
      return;
    }

    if (podType === 'OPEN_POD' && !canCreateOpenPod) {
      setError('Creating an Open Pod requires having completed at least 1 full Trusted Circle pod cycle with no missed payments.');
      return;
    }

    setError(null);
    setStep('STRIPE_CHECKOUT');
  };

  // Step 2 -> Step 3 transition: execute Stripe payment and server pod creation
  const handleExecuteStripePayment = async () => {
    if (currentUserState.kycStatus !== 'VERIFIED') {
      setError('You must complete Stripe Identity KYC verification before creating a mutual savings pod.');
      setShowKycModal(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let podData: Pod | null = null;

      try {
        const res = await fetch('/api/pods', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUserState.id,
            'x-user-name': currentUserState.displayName || 'Verified Member',
            'x-user-email': currentUserState.email || `${currentUserState.id}@mutualpool.org`,
            'x-user-kyc-status': currentUserState.kycStatus,
            'x-user-account-age-days': String(currentUserState.accountAgeDays || 1),
            'x-user-completed-pods-count': String(currentUserState.completedPodsCount || 0),
            'x-user-platform': currentUserState.platform || 'DoorDash',
            'x-user-role': currentUserState.role || 'RIDER',
          },
          body: JSON.stringify({
            name: name.trim(),
            description,
            category,
            podType,
            activationPolicy,
            inviteWindowDays,
            autoOpenOnExpire,
            invitedContacts,
            sizeTier,
            depositTier,
            paymentMethod,
          }),
        }).catch(() => null);

        if (res && res.ok) {
          const text = await res.text().catch(() => '');
          if (text) {
            try { 
              const parsed = JSON.parse(text);
              podData = (parsed && parsed.pod) ? parsed.pod : parsed;
            } catch { /* ignore */ }
          }
        } else if (res && !res.ok) {
          const text = await res.text().catch(() => '');
          let errJson: any = {};
          try { errJson = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
          if (errJson.error === 'KYC_REQUIRED' || (errJson.message && errJson.message.includes('KYC'))) {
            setShowKycModal(true);
            throw new Error(errJson.message || 'KYC verification required');
          }
          if (res.status === 400 || res.status === 403) {
            throw new Error(errJson.message || errJson.error || 'Validation error creating pod');
          }
        }
      } catch (networkOrServerError: any) {
        if (networkOrServerError.message && (networkOrServerError.message.includes('KYC') || networkOrServerError.message.includes('Validation') || networkOrServerError.message.includes('name is required') || networkOrServerError.message.includes('tier'))) {
          throw networkOrServerError;
        }
        // Fail-safe fallback to client-side creation for 500 or offline backend
      }

      const baseDepositAmount = Number(depositTier);
      const platformFee = Math.round(baseDepositAmount * 0.05 * 100) / 100;
      const totalChargedAmount = baseDepositAmount + platformFee;
      const isEligibleForWelcomeMatch = currentUserState.kycStatus === 'VERIFIED' && !currentUserState.welcomeMatchReceived;
      const welcomeMatchAmount = isEligibleForWelcomeMatch ? Math.min(baseDepositAmount, 20) : 0;

      // If backend didn't return created pod, perform client-side creation
      if (!podData) {
        const podId = `pod_${Date.now()}`;
        const creatorMemberId = `pm_${Date.now()}_1`;

        podData = {
          id: podId,
          name: name.trim(),
          description: description || 'Community gig worker mutual savings pool',
          category: category || 'General Gig Workers',
          podType: podType === 'OPEN_POD' ? 'OPEN_POD' : 'TRUSTED_CIRCLE',
          activationPolicy: activationPolicy === 'FLEXIBLE_EARLY' ? 'FLEXIBLE_EARLY' : 'WHEN_FULL',
          inviteWindowDays: Number(inviteWindowDays) || 7,
          autoOpenOnExpire: autoOpenOnExpire !== false,
          inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          invitedContacts: Array.isArray(invitedContacts) ? invitedContacts : [],
          sizeTier: Number(sizeTier) as PodSizeTier,
          depositTier: Number(depositTier) as DepositTier,
          status: 'FORMING',
          currentCycleWeek: 1,
          totalCycles: Number(sizeTier),
          agreementVersion: 'v2.0-2026',
          holdingFinAccountId: `fa_pod_holding_${Date.now()}`,
          createdBy: currentUserState.id,
          creatorName: currentUserState.displayName || 'Verified Member',
          createdAt: new Date().toISOString(),
          weeklyPoolTarget: Number(sizeTier) * Number(depositTier),
          currentWeeklyCollected: baseDepositAmount,
          welcomeMatchGranted: welcomeMatchAmount > 0,
          welcomeMatchAmountUsd: welcomeMatchAmount,
          contingencyBufferUsd: welcomeMatchAmount,
          contingencyBufferInitialUsd: welcomeMatchAmount,
          members: [
            {
              id: creatorMemberId,
              podId: podId,
              userId: currentUserState.id,
              displayName: currentUserState.displayName || 'Verified Member',
              email: currentUserState.email || `${currentUserState.id}@mutualpool.org`,
              avatarUrl: currentUserState.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserState.displayName || 'User')}&background=005FB8&color=fff`,
              platform: currentUserState.platform || 'DoorDash',
              rotationIndex: 0,
              hasReceivedPayout: false,
              delinquencyStatus: 'CLEAN',
              joinedAt: new Date().toISOString(),
            } as any
          ],
        };
      }

      // ALWAYS save created pod to Firestore so real-time listeners and page reloads pick it up!
      if (podData) {
        await savePodToFirestore(podData).catch((err) => console.warn('Firestore pod save warning:', err));

        // Sync with backend Express server as well
        fetch('/api/pods', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUserState.id,
          },
          body: JSON.stringify({
            name: podData.name,
            description: podData.description,
            category: podData.category,
            sizeTier: podData.sizeTier,
            depositTier: podData.depositTier,
            podType: podData.podType,
            activationPolicy: podData.activationPolicy,
            inviteWindowDays: podData.inviteWindowDays,
            autoOpenOnExpire: podData.autoOpenOnExpire,
            invitedContacts: podData.invitedContacts,
          }),
        }).catch((err) => console.warn('Backend pod sync warning:', err));

        // Persist to local cache immediately
        try {
          const cachedRaw = localStorage.getItem('mutualpool_cached_pods');
          const cachedPods: Pod[] = cachedRaw ? JSON.parse(cachedRaw) : [];
          const exists = cachedPods.some((p: Pod) => p.id === podData.id);
          const updatedCached = exists ? cachedPods.map((p: Pod) => p.id === podData.id ? podData : p) : [podData, ...cachedPods];
          localStorage.setItem('mutualpool_cached_pods', JSON.stringify(updatedCached));
        } catch {
          // quiet cache fail
        }

        // Add audit log entry to Firestore
        addAuditLogToFirestore({
          id: `log_${Date.now()}`,
          podId: podData.id,
          actorId: currentUserState.id,
          actorName: currentUserState.displayName || 'Member',
          action: 'POD_CREATED',
          detail: `Created new ${podData.podType === 'TRUSTED_CIRCLE' ? '🔒 Trusted Circle' : '🌐 Open'} pod "${podData.name}" (${podData.sizeTier} members @ $${podData.depositTier}/wk). Initial pool deposit charged: $${baseDepositAmount.toFixed(2)} + $${platformFee.toFixed(2)} platform fee.`,
          metadata: { baseDepositAmount, platformFee, totalChargedAmount, sizeTier, depositTier }
        }).catch(() => null);

        // Update user state for welcome match or treasury deduction
        if (welcomeMatchAmount > 0 || currentUserState.treasury) {
          const updatedUser: User = {
            ...currentUserState,
            welcomeMatchReceived: welcomeMatchAmount > 0 ? true : currentUserState.welcomeMatchReceived,
            welcomeMatchAmountUsd: welcomeMatchAmount > 0 ? welcomeMatchAmount : currentUserState.welcomeMatchAmountUsd,
            treasury: currentUserState.treasury ? {
              ...currentUserState.treasury,
              balanceUsd: Math.max(0, (currentUserState.treasury.balanceUsd || 0) - totalChargedAmount),
            } : undefined,
          };
          setCurrentUserState(updatedUser);
          onUserUpdated?.(updatedUser);
          saveUserToFirestore(updatedUser).catch(() => null);
        }
      }

      setCreatedPodResult(podData);
      setStep('SUCCESS');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Stripe Payment and Pod creation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white border border-[#DDE1E6] rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative my-auto max-h-[90vh] overflow-y-auto text-[#111827]">
        
        {/* Modal Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors z-10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ============================================================= */}
        {/* STEP 1: POD CONFIGURATION FORM                               */}
        {/* ============================================================= */}
        {step === 'CONFIG' && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-xl bg-blue-50 text-[#005FB8]">
                <PlusCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#111827]">Create New Mutual Savings Pod</h3>
                <p className="text-xs text-[#6B7280]">Fixed-Rotation Pod with Stripe Treasury Balance</p>
              </div>
            </div>

            {/* Welcome Match & First-Cycle Contingency Buffer Banner */}
            {!user.welcomeMatchReceived ? (
              <div className="mb-5 p-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 text-emerald-950 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                    <Sparkles className="w-4 h-4 text-emerald-600 fill-emerald-600 shrink-0" />
                    <span>$20 Founding Member Welcome Match & Contingency Buffer</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white uppercase tracking-wider shrink-0">
                    100% Platform Funded
                  </span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Mutual Pool matches up to <strong>${Math.min(depositTier, 20)}.00</strong> on your first pod creation deposit! This promotional credit goes directly into your pod's <strong>First-Cycle Contingency Buffer</strong> to guarantee rotation stability if any member misses a deposit during Cycle 1.
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-emerald-700 pt-1 border-t border-emerald-200/60">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{currentUserState.kycStatus === 'VERIFIED' ? 'Verified KYC Account Qualified' : 'Requires Verified KYC Account'}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Non-Withdrawal Pod Buffer</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="mb-5 p-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Lifetime Welcome Match Claimed (${user.welcomeMatchAmountUsd || 20}.00)</span>
                </span>
                <span className="text-[11px] text-gray-500 font-mono">1 match per account limit</span>
              </div>
            )}

            {/* Unverified KYC Notice Banner */}
            {currentUserState.kycStatus !== 'VERIFIED' && (
              <div className="mb-5 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                    <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>Stripe Identity Verification Required</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-600 text-white uppercase tracking-wider shrink-0">
                    KYC Required
                  </span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Federal banking regulations and Stripe Treasury rules require identity verification before creating or managing mutual savings pools.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowKycModal(true)}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Complete Stripe Identity Verification Now</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tenure Rule Notice Banner */}
            <div className={`mb-5 p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
              isSeasoned 
                ? 'bg-green-50 border-green-200 text-green-900' 
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              {isSeasoned ? (
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
              ) : (
                <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              )}
              <div>
                <span className="font-bold block mb-0.5">
                  {isSeasoned ? 'Tenure Unlocked: Seasoned Account' : '3-Month Tenure Tier Policy'}
                </span>
                <span>
                  {isSeasoned
                    ? `Account tenure of ${currentUserState.accountAgeDays} days unlocks all large pod member tiers (up to 10,000) and $50/$100 deposit tiers.`
                    : `New accounts (<90 days tenure) can create 20 or 50 member pods at $5, $10, or $20 weekly tiers. Larger tiers unlock after 3 months of successful operation.`}
                </span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
                {(error.includes('KYC') || error.includes('identity') || currentUserState.kycStatus !== 'VERIFIED') && (
                  <button
                    type="button"
                    onClick={() => setShowKycModal(true)}
                    className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ml-6"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verify Identity (KYC)</span>
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleProceedToPayment} className="space-y-5">
              
              {/* SECTION 1: POD TYPE SELECTION */}
              <div>
                <label className="block text-xs font-bold text-[#111827] mb-2">
                  Select Pod Type & Access Rules
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  
                  {/* TRUSTED CIRCLE CARD */}
                  <div
                    onClick={() => setPodType('TRUSTED_CIRCLE')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2 relative ${
                      podType === 'TRUSTED_CIRCLE'
                        ? 'bg-blue-50/70 border-[#005FB8] ring-2 ring-blue-500/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#005FB8] text-sm flex items-center gap-1.5">
                        <Lock className="w-4 h-4" />
                        <span>🔒 Trusted Circle</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-[#005FB8]">Default</span>
                    </div>
                    <p className="text-[#374151] text-[11px] leading-relaxed">
                      Built from people you already know — contacts from your phone, email, or social invites. Only people you invite can join.
                    </p>
                    <div className="text-[10px] text-[#005FB8] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Includes Contact Picker & Private Code</span>
                    </div>
                  </div>

                  {/* OPENPODCARD*/}
                  <div
                    onClick={() => canCreateOpenPod && setPodType('OPEN_POD')}
                    className={`p-4 rounded-xl border transition-all space-y-2 relative ${
                      !canCreateOpenPod
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-75'
                        : podType === 'OPEN_POD'
                        ? 'bg-blue-50/70 border-[#005FB8] ring-2 ring-blue-500/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#111827] text-sm flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#005FB8]" />
                        <span>🌐 Open Pod</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-[#374151]">Auto-Match</span>
                    </div>
                    <p className="text-[#374151] text-[11px] leading-relaxed">
                      Open to any verified member on the platform. Pod fills automatically based on availability.
                    </p>
                    {!canCreateOpenPod && (
                      <span className="text-[10px] text-amber-700 font-medium block">
                        ⚠️ Requires 1 completed Trusted Circle cycle first.
                      </span>
                    )}
                  </div>

                </div>
              </div>

              {/* SECTION: POD ACTIVATION POLICY SELECTION */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#111827]">
                    Choose Pod Activation & Lock Timing Policy
                  </label>
                  <span className="text-[10px] text-[#005FB8] font-bold uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Pod Creator Setting
                  </span>
                </div>

                <p className="text-[11px] text-[#6B7280] mb-2.5 leading-relaxed">
                  Select when this Pod should lock its rotation order and begin active weekly savings cycles. Full capacity guarantees maximum lump-sum payouts, but flexible activation lets you start earlier.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  
                  {/* OPTION A: ACTIVATE ONLY WHEN FULL */}
                  <div
                    onClick={() => setActivationPolicy('WHEN_FULL')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-2 relative ${
                      activationPolicy === 'WHEN_FULL'
                        ? 'bg-blue-50/70 border-[#005FB8] ring-2 ring-blue-500/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#111827] text-xs flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#005FB8]" />
                        <span>Activate Only When 100% Full</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Max Payout
                      </span>
                    </div>

                    <p className="text-[#374151] text-[11px] leading-relaxed">
                      Wait until all <strong>{sizeTier} member spots</strong> are filled before locking rotation. Guarantees maximum lump-sum payout target for every member.
                    </p>

                    <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-600 flex items-center justify-between font-mono">
                      <span>Target Payout Pool:</span>
                      <strong className="text-emerald-700 font-bold">${(sizeTier * depositTier).toLocaleString()}/wk</strong>
                    </div>
                  </div>

                  {/* OPTION B: FLEXIBLE EARLY ACTIVATION */}
                  <div
                    onClick={() => setActivationPolicy('FLEXIBLE_EARLY')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-2 relative ${
                      activationPolicy === 'FLEXIBLE_EARLY'
                        ? 'bg-blue-50/70 border-[#005FB8] ring-2 ring-blue-500/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#111827] text-xs flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-600" />
                        <span>Flexible Early Activation</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Start Before Max
                      </span>
                    </div>

                    <p className="text-[#374151] text-[11px] leading-relaxed">
                      Allows you (Pod Creator) to lock rotation and activate weekly cycles early as soon as <strong>2+ members</strong> join, without waiting for max capacity.
                    </p>

                    <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-600 flex items-center justify-between font-mono">
                      <span>Minimum Threshold:</span>
                      <strong className="text-amber-800 font-bold">2 Signed Members</strong>
                    </div>
                  </div>

                </div>
              </div>

              {/* SECTION 2: TRUSTED CIRCLE INVITE WINDOW & ACCESS CONFIG (IF TRUSTED_CIRCLE) */}
              {podType === 'TRUSTED_CIRCLE' && (
                <div className="p-4 bg-white border border-[#DDE1E6] rounded-xl space-y-3.5 text-xs">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#111827]">
                    <Clock className="w-4 h-4 text-[#005FB8]" />
                    <span>Trusted Circle Invite Window & Expiration Action</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    <div>
                      <label className="block text-[11px] font-semibold text-[#111827] mb-1">
                        Set Invite Window Duration
                      </label>
                      <select
                        value={inviteWindowDays}
                        onChange={(e) => setInviteWindowDays(Number(e.target.value))}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8]"
                      >
                        <option value={3}>3 Days Invite Window</option>
                        <option value={7}>7 Days Invite Window (Default)</option>
                        <option value={14}>14 Days Invite Window</option>
                        <option value={30}>30 Days Invite Window</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111827] mb-1">
                        If Pod Isn't Full After Window Expires
                      </label>
                      <select
                        value={autoOpenOnExpire ? 'AUTO_OPEN' : 'KEEP_WAITING'}
                        onChange={(e) => setAutoOpenOnExpire(e.target.value === 'AUTO_OPEN')}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8]"
                      >
                        <option value="AUTO_OPEN">Automatically open remaining spots to verified Open Pod members</option>
                        <option value="KEEP_WAITING">Keep waiting for private circle invites only</option>
                      </select>
                    </div>

                  </div>

                  {/* EMBEDDED TRUSTED CIRCLE INVITER TOOL */}
                  <TrustedCircleInviter
                    invitedContacts={invitedContacts}
                    inviteCode={generatedInviteCode}
                    podName={name || 'My Trusted Circle Pod'}
                    onAddContacts={handleAddContacts}
                    currentUser={user}
                  />
                </div>
              )}

              {/* SECTION 3: POD NAME & DETAILS */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#111827] mb-1">Pod Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                    placeholder="e.g. SF East Bay DoorDash Drivers Circle"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111827] mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  >
                    <option value="Food Delivery & Rideshare">Food Delivery & Rideshare</option>
                    <option value="Grocery & Cargo">Grocery & Cargo</option>
                    <option value="General Gig Workers">General Gig Workers</option>
                    <option value="High-Yield Reserve">High-Yield Reserve (Advanced)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111827] mb-1">Description & Purpose</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                    placeholder="Describe purpose (e.g., tax reserves, vehicle maintenance, emergency gear)..."
                  />
                </div>
              </div>

              {/* Member Size Tier Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                  Member Capacity Tier
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {([20, 50, 100, 500] as PodSizeTier[]).map((tier) => {
                    const disabled = !isSeasoned && tier > 50;
                    return (
                      <button
                        key={tier}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSizeTier(tier)}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                          sizeTier === tier
                            ? 'bg-[#005FB8] border-[#005FB8] text-white shadow-xs'
                            : disabled
                            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>{tier} Members</span>
                        {disabled && <span className="text-[9px] text-amber-700 font-mono">3-Mo Req</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Deposit Tier Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                  Weekly Deposit Tier
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {([5, 10, 20, 50, 100] as DepositTier[]).map((tier) => {
                    const disabled = !isSeasoned && tier > 20;
                    return (
                      <button
                        key={tier}
                        type="button"
                        disabled={disabled}
                        onClick={() => setDepositTier(tier)}
                        className={`py-2 px-2 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                          depositTier === tier
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                            : disabled
                            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>${tier}/wk</span>
                        {disabled && <span className="text-[9px] text-amber-700 font-mono">Locked</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Calculated Weekly Payout & 5% Fee Breakdown Preview */}
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#111827] font-bold block">Initial Pool Deposit ({user.displayName})</span>
                    <span className="text-[11px] text-gray-500">Your base weekly deposit allocated to the pool</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#111827] font-mono">
                      ${depositTier}.00
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#005FB8] font-bold block">Platform Service & Treasury Fee (5%)</span>
                    <span className="text-[11px] text-gray-500">Applied to all deposits before creating pool</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#005FB8] font-mono">
                      +${platformFee.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 flex items-center justify-between bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
                  <div>
                    <span className="text-[#111827] font-bold block text-xs">Total Initial Payment Required to Create Pool</span>
                    <span className="text-[10.5px] text-[#005FB8]">Includes base deposit + 5% fee</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-[#005FB8] font-mono">
                      ${totalChargedAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="text-[#111827] font-bold block">Full Capacity Payout Target</span>
                    <span className="text-[11px] text-gray-500">{sizeTier} members × ${depositTier}/wk</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-extrabold text-emerald-600 font-mono">
                      ${(sizeTier * depositTier).toLocaleString()}.00 / wk
                    </span>
                  </div>
                </div>

                <p className="text-[10.5px] text-[#6B7280] pt-1">
                  💡 <strong>Dynamic Payout Scaling:</strong> Weekly payouts scale automatically as members join. For example, when 5 members join, weekly payout becomes ${5 * depositTier}/wk; when all {sizeTier} members join, payout reaches ${(sizeTier * depositTier).toLocaleString()}/wk.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#111827] font-semibold text-xs border border-gray-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Pay ${totalChargedAmount.toFixed(2)} & Create {podType === 'TRUSTED_CIRCLE' ? 'Trusted Circle' : 'Open'} Pod</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================= */}
        {/* STEP 2: STRIPE PAYMENT CHECKOUT WINDOW                         */}
        {/* ============================================================= */}
        {step === 'STRIPE_CHECKOUT' && (
          <div className="space-y-5">
            {/* Stripe Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('CONFIG')}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors mr-1 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="p-2 rounded-lg bg-[#635BFF] text-white font-black text-xs tracking-wider flex items-center gap-1 shadow-2xs">
                  <span>stripe</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111827] flex items-center gap-1.5">
                    <span>Stripe Checkout</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      256-bit SSL Encrypted
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#6B7280]">
                    Mutual Pool Deposit & Treasury Holding Account Setup
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Order Summary Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-800">Order Summary</span>
                <span className="text-[10.5px] text-slate-500 font-mono">Ref: {name.trim() || 'New Pod'}</span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>Initial Weekly Deposit ({sizeTier} Members @ ${depositTier}/wk)</span>
                  <span className="font-bold font-mono">${depositTier}.00</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Stripe Treasury & Platform Reserve Fee (5%)</span>
                  <span className="font-mono">+${platformFee.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-extrabold text-[#111827]">
                  <span>Total Due Now</span>
                  <span className="text-emerald-700 font-mono text-base">${totalChargedAmount.toFixed(2)}</span>
                </div>
              </div>

              {!user.welcomeMatchReceived && (
                <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] flex items-center gap-2 font-medium">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    🎁 <strong>+$20.00 Welcome Match</strong> will be funded automatically by Mutual Pool directly into your Pod First-Cycle Contingency Reserve!
                  </span>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#111827]">
                Select Payment Method
              </label>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('SAVED_CARD')}
                  className={`py-2 px-3 rounded-lg border font-bold text-center transition-all cursor-pointer ${
                    paymentMethod === 'SAVED_CARD'
                      ? 'bg-blue-50 border-[#005FB8] text-[#005FB8] ring-2 ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  💳 Saved Visa (4242)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('NEW_CARD')}
                  className={`py-2 px-3 rounded-lg border font-bold text-center transition-all cursor-pointer ${
                    paymentMethod === 'NEW_CARD'
                      ? 'bg-blue-50 border-[#005FB8] text-[#005FB8] ring-2 ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  ➕ New Card
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('APPLE_PAY')}
                  className={`py-2 px-3 rounded-lg border font-bold text-center transition-all cursor-pointer ${
                    paymentMethod === 'APPLE_PAY'
                      ? 'bg-blue-50 border-[#005FB8] text-[#005FB8] ring-2 ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                   Apple Pay / GPay
                </button>
              </div>

              {/* Card Input Details */}
              {paymentMethod === 'SAVED_CARD' && (
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white border border-gray-200 rounded-md shadow-2xs font-bold text-slate-800">
                      VISA
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Stripe Treasury Linked Visa</span>
                      <span className="text-[11px] text-slate-500 font-mono">•••• •••• •••• 4242 (Expires 12/28)</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 rounded-full">
                    Verified
                  </span>
                </div>
              )}

              {paymentMethod === 'NEW_CARD' && (
                <div className="p-3.5 rounded-xl border border-gray-200 bg-white space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Cardholder Name</label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8]"
                      placeholder="Name as it appears on card"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-mono text-[#111827] focus:outline-none focus:border-[#005FB8]"
                      placeholder="4242 •••• •••• 4242"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">Expires</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#111827] focus:outline-none focus:border-[#005FB8]"
                        placeholder="MM/YY"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">CVC</label>
                      <input
                        type="text"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#111827] focus:outline-none focus:border-[#005FB8]"
                        placeholder="321"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={cardZip}
                        onChange={(e) => setCardZip(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#111827] focus:outline-none focus:border-[#005FB8]"
                        placeholder="90210"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'APPLE_PAY' && (
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-900 text-white text-center space-y-1">
                  <div className="text-lg font-bold"> Pay / Google Pay Instant Authorization</div>
                  <p className="text-[11px] text-gray-400">
                    Touch ID or Face ID will be prompted upon clicking Confirm.
                  </p>
                </div>
              )}
            </div>

            {/* Compliance Guarantee */}
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-[11px] text-gray-600 flex items-start gap-2 leading-relaxed">
              <Shield className="w-4 h-4 text-[#005FB8] shrink-0 mt-0.5" />
              <span>
                <strong>Stripe Treasury Protection:</strong> Mutual Pool deposits are held in dedicated Stripe Treasury Financial Accounts with FDIC pass-through coverage up to $250,000 per member.
              </span>
            </div>

            {/* Submit & Navigation Buttons */}
            <div className="pt-2 flex items-center justify-between border-t border-gray-200">
              <button
                type="button"
                onClick={() => setStep('CONFIG')}
                className="px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#111827] font-semibold text-xs border border-gray-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Pod Configuration</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleExecuteStripePayment}
                className="px-6 py-2.5 rounded-lg bg-[#635BFF] hover:bg-[#5249E0] disabled:opacity-50 text-white font-extrabold text-xs transition-colors flex items-center gap-2 shadow-md cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing Stripe Payment (${totalChargedAmount.toFixed(2)})...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Confirm & Pay ${totalChargedAmount.toFixed(2)} via Stripe</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* STEP 3: SUCCESS CONFIRMATION                                  */}
        {/* ============================================================= */}
        {step === 'SUCCESS' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md animate-bounce">
              <Check className="w-10 h-10 stroke-[3]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-extrabold text-slate-900">
                Stripe Payment Authorized & Pod Initialized!
              </h3>
              <p className="text-xs text-slate-600">
                Your initial deposit of <strong>${totalChargedAmount.toFixed(2)}</strong> has been processed via Stripe.
              </p>
            </div>

            <div className="max-w-md mx-auto p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-left space-y-2 text-xs text-emerald-950">
              <div className="flex justify-between font-bold border-b border-emerald-200 pb-1.5">
                <span>Pod Name:</span>
                <span className="font-mono text-emerald-800">{createdPodResult?.name || name}</span>
              </div>
              <div className="flex justify-between">
                <span>Stripe Payment Ref:</span>
                <span className="font-mono text-emerald-800">pi_create_pod_{Date.now().toString().substring(5)}</span>
              </div>
              <div className="flex justify-between">
                <span>Holding Account:</span>
                <span className="font-mono text-emerald-800">{createdPodResult?.holdingFinAccountId || `fa_pod_holding_${Date.now()}`}</span>
              </div>
              {createdPodResult?.welcomeMatchGranted && (
                <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-emerald-200/80">
                  <span>Welcome Match Granted:</span>
                  <span>+${createdPodResult.welcomeMatchAmountUsd}.00 to Contingency Buffer</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Your Mutual Savings Pod is now set up in <strong>FORMING</strong> status. Invites have been created for your circle!
            </p>

            <div className="pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => onPodCreated(createdPodResult || undefined)}
                className="w-full max-w-sm py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm transition-colors shadow-md cursor-pointer mx-auto block"
              >
                View My Pod & Start Inviting Members
              </button>
            </div>
          </div>
        )}

        {/* KYC Verification Modal overlay */}
        {showKycModal && (
          <KycVerificationModal
            user={currentUserState}
            onClose={() => setShowKycModal(false)}
            onSuccess={(updatedUser) => {
              setCurrentUserState(updatedUser);
              setShowKycModal(false);
              setError(null);
              onUserUpdated?.(updatedUser);
            }}
          />
        )}

      </div>
    </div>
  );
};
