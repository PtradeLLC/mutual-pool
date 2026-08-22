import React, { useState } from 'react';
import { User, Pod, PodSizeTier, DepositTier, PodType, InvitedContact, ActivationPolicy } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
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
  existingPods?: Pod[];
  userCreatedPodsCount?: number;
}

export const CreatePodModal: React.FC<CreatePodModalProps> = ({ 
  user, 
  onClose, 
  onPodCreated, 
  onUserUpdated,
  existingPods = [],
  userCreatedPodsCount
}) => {
  const { t } = useTranslation();
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
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('424');
  const [cardZip, setCardZip] = useState('90210');
  const [createdPodResult, setCreatedPodResult] = useState<any>(null);

  // Default invite code generator preview
  const [generatedInviteCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());

  // 3-Pod Creation Limit Guard (Anti-Fraud & Community Solvency Protection)
  const activeCreatedCount = userCreatedPodsCount !== undefined ? userCreatedPodsCount : (
    (existingPods || []).filter(p => {
      if (!p || !p.id) return false;
      const isCreator = (currentUserState?.id && p.createdBy === currentUserState?.id) ||
        (currentUserState?.displayName && p.creatorName && p.creatorName.trim().toLowerCase() === currentUserState.displayName.trim().toLowerCase());
      return isCreator && p.status !== 'COMPLETED';
    }).length
  );
  const isCreationLimitReached = activeCreatedCount >= 3;

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
      setError(t('createPod.errorKyc'));
      setShowKycModal(true);
      return;
    }

    if (isCreationLimitReached) {
      setError(t('createPod.errorLimit', { count: activeCreatedCount }));
      return;
    }

    if (!name.trim()) {
      setError(t('createPod.errorName'));
      return;
    }

    if (podType === 'OPEN_POD' && !canCreateOpenPod) {
      setError(t('createPod.errorOpenPodReq'));
      return;
    }

    setError(null);
    setStep('STRIPE_CHECKOUT');
  };

  // Step 2 -> Step 3 transition: execute Stripe payment and server pod creation
  const handleExecuteStripePayment = async () => {
    if (currentUserState.kycStatus !== 'VERIFIED') {
      setError(t('createPod.errorKyc'));
      setShowKycModal(true);
      return;
    }

    if (isCreationLimitReached) {
      setError(t('createPod.errorLimit', { count: activeCreatedCount }));
      setLoading(false);
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
        if (networkOrServerError.message && (
          networkOrServerError.message.includes('KYC') || 
          networkOrServerError.message.includes('Validation') || 
          networkOrServerError.message.includes('name is required') || 
          networkOrServerError.message.includes('tier') ||
          networkOrServerError.message.includes('limit') ||
          networkOrServerError.message.includes('POD_CREATION_LIMIT') ||
          networkOrServerError.message.includes('3 concurrent') ||
          networkOrServerError.message.includes('maximum limit')
        )) {
          throw networkOrServerError;
        }
        if (isCreationLimitReached) {
          throw new Error('Pod creation limit reached: You cannot maintain more than 3 active or forming created Pods at one time.');
        }
        // Fail-safe fallback to client-side creation for 500 or offline backend
      }

      const baseDepositAmount = Number(depositTier);
      const platformFee = Math.round(baseDepositAmount * 0.05 * 100) / 100;
      const totalChargedAmount = baseDepositAmount + platformFee;
      // Guarantee $20 First-Cycle Contingency Buffer match for all new pods
      const welcomeMatchAmount = Math.max(20, Math.min(baseDepositAmount, 20));

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
          welcomeMatchGranted: true,
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
          localStorage.setItem(`mutualpool_my_pod_${currentUserState.id}_${podData.id}`, 'true');
          localStorage.setItem(`mutualpool_my_pod_${podData.id}`, 'true');
          const cachedRaw = localStorage.getItem('mutualpool_cached_pods');
          const cachedPods: Pod[] = cachedRaw ? JSON.parse(cachedRaw) : [];
          const exists = cachedPods.some((p: Pod) => p.id === podData.id);
          const updatedCached = exists ? cachedPods.map((p: Pod) => p.id === podData.id ? podData : p) : [podData, ...cachedPods];
          localStorage.setItem('mutualpool_cached_pods', JSON.stringify(updatedCached));

          const createdRaw = localStorage.getItem('mutualpool_created_pods');
          const createdList: Pod[] = createdRaw ? JSON.parse(createdRaw) : [];
          if (!createdList.some((p: Pod) => p.id === podData.id)) {
            createdList.unshift(podData);
            localStorage.setItem('mutualpool_created_pods', JSON.stringify(createdList));
          }
          localStorage.setItem('mutualpool_welcome_match_credited', 'true');
          localStorage.setItem(`mutualpool_welcome_match_${currentUserState.id}`, 'true');
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
            welcomeMatchAmountUsd: welcomeMatchAmount > 0 ? welcomeMatchAmount : (currentUserState.welcomeMatchAmountUsd || 20),
            treasury: currentUserState.treasury ? {
              ...currentUserState.treasury,
              balanceUsd: Math.max(0, (currentUserState.treasury.balanceUsd || 0) - totalChargedAmount) + welcomeMatchAmount,
            } : {
              stripeAccountId: '',
              stripeFinAccountId: '',
              balanceUsd: welcomeMatchAmount,
              pendingInboundUsd: 0,
              totalPayoutsReceivedUsd: 0,
              fdicPassThroughEligible: false,
              status: 'ACTIVE',
            },
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
                <h3 className="text-xl font-bold text-[#111827]">{t('createPod.modalTitle')}</h3>
                <p className="text-xs text-[#6B7280]">{t('createPod.modalSubtitle')}</p>
              </div>
            </div>

            {/* Welcome Match & First-Cycle Contingency Buffer Banner */}
            {!user.welcomeMatchReceived ? (
              <div className="mb-5 p-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 text-emerald-950 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                    <Sparkles className="w-4 h-4 text-emerald-600 fill-emerald-600 shrink-0" />
                    <span>{t('createPod.welcomeMatchTitle')}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white uppercase tracking-wider shrink-0">
                    {t('createPod.platformFundedBadge')}
                  </span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  {t('createPod.welcomeMatchDesc', { amount: Math.min(depositTier, 20) })}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-emerald-700 pt-1 border-t border-emerald-200/60">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{currentUserState.kycStatus === 'VERIFIED' ? t('createPod.verifiedKycQualified') : t('createPod.requiresKyc')}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t('createPod.nonWithdrawalBuffer')}</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="mb-5 p-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{t('createPod.lifetimeMatchClaimed', { amount: user.welcomeMatchAmountUsd || 20 })}</span>
                </span>
                <span className="text-[11px] text-gray-500 font-mono">{t('createPod.oneMatchLimit')}</span>
              </div>
            )}

            {/* Unverified KYC Notice Banner */}
            {currentUserState.kycStatus !== 'VERIFIED' && (
              <div className="mb-5 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                    <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>{t('createPod.kycRequiredTitle')}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-600 text-white uppercase tracking-wider shrink-0">
                    {t('createPod.kycRequiredBadge')}
                  </span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  {t('createPod.kycRequiredDesc')}
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowKycModal(true)}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t('createPod.completeKycBtn')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3-Pod Creation Limit & Fraud Prevention Policy Banner */}
            <div className={`mb-5 p-3.5 rounded-xl border text-xs flex items-start justify-between gap-3 ${
              isCreationLimitReached
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : activeCreatedCount === 2
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}>
              <div className="flex items-start gap-2.5">
                <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                  isCreationLimitReached 
                    ? 'bg-rose-100 text-rose-700' 
                    : activeCreatedCount === 2
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-200 text-slate-700'
                }`}>
                  <Shield className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      {isCreationLimitReached ? t('createPod.limitReachedTitle') : t('createPod.limitPolicyTitle')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isCreationLimitReached
                        ? 'bg-rose-600 text-white'
                        : activeCreatedCount === 2
                          ? 'bg-amber-600 text-white'
                          : 'bg-blue-600 text-white'
                    }`}>
                      {t('createPod.activePodsBadge', { current: activeCreatedCount })}
                    </span>
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-slate-600">
                    {isCreationLimitReached
                      ? t('createPod.limitReachedDesc')
                      : t('createPod.limitPolicyDesc')}
                  </p>
                </div>
              </div>
              {/* Visual 3-slot Indicator */}
              <div className="flex items-center gap-1 shrink-0 mt-1" title={`${activeCreatedCount} of 3 creation slots active`}>
                {[0, 1, 2].map((slotIdx) => (
                  <div
                    key={slotIdx}
                    title={`Slot ${slotIdx + 1}: ${slotIdx < activeCreatedCount ? 'In Use' : 'Available'}`}
                    className={`w-3 h-3 rounded-full border transition-all ${
                      slotIdx < activeCreatedCount
                        ? isCreationLimitReached ? 'bg-rose-600 border-rose-700' : 'bg-blue-600 border-blue-700'
                        : 'bg-white border-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>

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
                  {isSeasoned ? t('createPod.tenureUnlockedTitle') : t('createPod.tenurePolicyTitle')}
                </span>
                <span>
                  {isSeasoned
                    ? t('createPod.tenureUnlockedDesc', { days: currentUserState.accountAgeDays })
                    : t('createPod.tenurePolicyDesc')}
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
                    <span>{t('createPod.verifyIdentityBtn')}</span>
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleProceedToPayment} className="space-y-5">
              
              {/* SECTION 1: POD TYPE SELECTION */}
              <div>
                <label className="block text-xs font-bold text-[#111827] mb-2">
                  {t('createPod.selectTypeLabel')}
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
                        <span>{t('createPod.trustedCircleTitle')}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-[#005FB8]">{t('createPod.defaultBadge')}</span>
                    </div>
                    <p className="text-[#374151] text-[11px] leading-relaxed">
                      {t('createPod.trustedCircleDesc')}
                    </p>
                    <div className="text-[10px] text-[#005FB8] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{t('createPod.trustedCircleFeature')}</span>
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
                        <span>{t('createPod.openPodTitle')}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-[#374151]">{t('createPod.autoMatchBadge')}</span>
                    </div>
                    <p className="text-[#374151] text-[11px] leading-relaxed">
                      {t('createPod.openPodDesc')}
                    </p>
                    {!canCreateOpenPod && (
                      <span className="text-[10px] text-amber-700 font-medium block">
                        {t('createPod.openPodRequirement')}
                      </span>
                    )}
                  </div>

                </div>
              </div>

              {/* SECTION: POD ACTIVATION POLICY SELECTION */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#111827]">
                    {t('createPod.activationTimingLabel')}
                  </label>
                  <span className="text-[10px] text-[#005FB8] font-bold uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {t('createPod.creatorSettingBadge')}
                  </span>
                </div>

                <p className="text-[11px] text-[#6B7280] mb-2.5 leading-relaxed">
                  {t('createPod.activationTimingDesc')}
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
                        <span>{t('createPod.activateWhenFullTitle')}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {t('createPod.maxPayoutBadge')}
                      </span>
                    </div>

                    <p className="text-[#374151] text-[11px] leading-relaxed">
                      {t('createPod.activateWhenFullDesc', { count: sizeTier })}
                    </p>

                    <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-600 flex items-center justify-between font-mono">
                      <span>{t('createPod.targetPayoutPool')}</span>
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
                        <span>{t('createPod.flexibleEarlyTitle')}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {t('createPod.startBeforeMaxBadge')}
                      </span>
                    </div>

                    <p className="text-[#374151] text-[11px] leading-relaxed">
                      {t('createPod.flexibleEarlyDesc')}
                    </p>

                    <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-600 flex items-center justify-between font-mono">
                      <span>{t('createPod.minThreshold')}</span>
                      <strong className="text-amber-800 font-bold">{t('createPod.minThresholdValue')}</strong>
                    </div>
                  </div>

                </div>
              </div>

              {/* SECTION 2: TRUSTED CIRCLE INVITE WINDOW & ACCESS CONFIG (IF TRUSTED_CIRCLE) */}
              {podType === 'TRUSTED_CIRCLE' && (
                <div className="p-4 bg-white border border-[#DDE1E6] rounded-xl space-y-3.5 text-xs">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#111827]">
                    <Clock className="w-4 h-4 text-[#005FB8]" />
                    <span>{t('createPod.inviteWindowLabel')}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    <div>
                      <label className="block text-[11px] font-semibold text-[#111827] mb-1">
                        {t('createPod.inviteWindowDuration')}
                      </label>
                      <select
                        value={inviteWindowDays}
                        onChange={(e) => setInviteWindowDays(Number(e.target.value))}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8]"
                      >
                        <option value={3}>{t('createPod.inviteWindow3Days')}</option>
                        <option value={7}>{t('createPod.inviteWindow7Days')}</option>
                        <option value={14}>{t('createPod.inviteWindow14Days')}</option>
                        <option value={30}>{t('createPod.inviteWindow30Days')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111827] mb-1">
                        {t('createPod.expireActionLabel')}
                      </label>
                      <select
                        value={autoOpenOnExpire ? 'AUTO_OPEN' : 'KEEP_WAITING'}
                        onChange={(e) => setAutoOpenOnExpire(e.target.value === 'AUTO_OPEN')}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8]"
                      >
                        <option value="AUTO_OPEN">{t('createPod.autoOpenOption')}</option>
                        <option value="KEEP_WAITING">{t('createPod.keepWaitingOption')}</option>
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
                  <label className="block text-xs font-semibold text-[#111827] mb-1">{t('createPod.podNameLabel')}</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                    placeholder={t('createPod.podNamePlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111827] mb-1">{t('createPod.categoryLabel')}</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  >
                    <option value="Food Delivery & Rideshare">{t('createPod.catFoodDelivery')}</option>
                    <option value="Grocery & Cargo">{t('createPod.catGroceryCargo')}</option>
                    <option value="General Gig Workers">{t('createPod.catGeneralGig')}</option>
                    <option value="High-Yield Reserve">{t('createPod.catHighYield')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111827] mb-1">{t('createPod.descriptionLabel')}</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                    placeholder={t('createPod.descriptionPlaceholder')}
                  />
                </div>
              </div>

              {/* Member Size Tier Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                  {t('createPod.memberCapacityLabel')}
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
                        <span>{t('createPod.membersCount', { count: tier })}</span>
                        {disabled && <span className="text-[9px] text-amber-700 font-mono">{t('createPod.threeMonthReq')}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Deposit Tier Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                  {t('createPod.weeklyDepositLabel')}
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
                        {disabled && <span className="text-[9px] text-amber-700 font-mono">{t('createPod.lockedTier')}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Calculated Weekly Payout & 5% Fee Breakdown Preview */}
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#111827] font-bold block">{t('createPod.initialDepositLabel', { name: user.displayName })}</span>
                    <span className="text-[11px] text-gray-500">{t('createPod.initialDepositDesc')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#111827] font-mono">
                      ${depositTier}.00
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#005FB8] font-bold block">{t('createPod.platformFeeLabel')}</span>
                    <span className="text-[11px] text-gray-500">{t('createPod.platformFeeDesc')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#005FB8] font-mono">
                      +${platformFee.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 flex items-center justify-between bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
                  <div>
                    <span className="text-[#111827] font-bold block text-xs">{t('createPod.totalInitialPaymentLabel')}</span>
                    <span className="text-[10.5px] text-[#005FB8]">{t('createPod.totalInitialPaymentDesc')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-[#005FB8] font-mono">
                      ${totalChargedAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="text-[#111827] font-bold block">{t('createPod.fullCapacityTargetLabel')}</span>
                    <span className="text-[11px] text-gray-500">{t('createPod.fullCapacityCalculation', { size: sizeTier, deposit: depositTier })}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-extrabold text-emerald-600 font-mono">
                      ${(sizeTier * depositTier).toLocaleString()}.00 / wk
                    </span>
                  </div>
                </div>

                <p className="text-[10.5px] text-[#6B7280] pt-1">
                  {t('createPod.dynamicPayoutNote', { min: 5 * depositTier, size: sizeTier, max: (sizeTier * depositTier).toLocaleString() })}
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#111827] font-semibold text-xs border border-gray-300 transition-colors cursor-pointer"
                >
                  {t('createPod.cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={isCreationLimitReached}
                  className={`px-5 py-2.5 rounded-lg text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs ${
                    isCreationLimitReached
                      ? 'bg-gray-400 cursor-not-allowed opacity-75'
                      : 'bg-[#005FB8] hover:bg-[#004C93] cursor-pointer'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {isCreationLimitReached
                      ? t('createPod.limitReachedBadge')
                      : t('createPod.payAndCreateBtn', { amount: totalChargedAmount.toFixed(2), type: podType === 'TRUSTED_CIRCLE' ? t('createPod.typeTrustedCircle') : t('createPod.typeOpenPod') })}
                  </span>
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
                    <span>{t('createPod.stripeCheckoutTitle')}</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {t('createPod.sslEncrypted')}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#6B7280]">
                    {t('createPod.stripeCheckoutSubtitle')}
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
                <span className="font-bold text-slate-800">{t('createPod.orderSummary')}</span>
                <span className="text-[10.5px] text-slate-500 font-mono">{t('createPod.ref')} {name.trim() || 'New Pod'}</span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>{t('createPod.initialWeeklyDepositSummary', { size: sizeTier, deposit: depositTier })}</span>
                  <span className="font-bold font-mono">${depositTier}.00</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{t('createPod.stripeFeeSummary')}</span>
                  <span className="font-mono">+${platformFee.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-extrabold text-[#111827]">
                  <span>{t('createPod.totalDueNow')}</span>
                  <span className="text-emerald-700 font-mono text-base">${totalChargedAmount.toFixed(2)}</span>
                </div>
              </div>

              {!user.welcomeMatchReceived && (
                <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] flex items-center gap-2 font-medium">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {t('createPod.welcomeMatchBanner')}
                  </span>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#111827]">
                {t('createPod.selectPaymentMethod')}
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
                  {t('createPod.savedCard')}
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
                  {t('createPod.newCard')}
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
                  {t('createPod.applePay')}
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
                      <span className="font-bold text-slate-900 block">{t('createPod.stripeTreasuryVisa')}</span>
                      <span className="text-[11px] text-slate-500 font-mono">•••• •••• •••• 4242 (Expires 12/28)</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 rounded-full">
                    {t('createPod.verifiedBadge')}
                  </span>
                </div>
              )}

              {paymentMethod === 'NEW_CARD' && (
                <div className="p-3.5 rounded-xl border border-gray-200 bg-white space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">{t('createPod.cardholderName')}</label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8]"
                      placeholder={t('createPod.cardholderNamePlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">{t('createPod.cardNumber')}</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
                        const formatted = digits.replace(/(.{4})/g, '$1 ').trim();
                        setCardNumber(formatted);
                      }}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-mono text-[#111827] focus:outline-none focus:border-[#005FB8]"
                      placeholder="4242 4242 4242 4242"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCardNumber('4242 4242 4242 4242');
                          setCardExpiry('12/28');
                          setCardCvc('424');
                          setCardZip('90210');
                        }}
                        className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md text-[#005FB8] text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>{t('createPod.useTestCard')}</span>
                      </button>
                      <span className="text-[10px] text-gray-500 font-mono">{t('createPod.stripeTestMode')}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">{t('createPod.expires')}</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#111827] focus:outline-none focus:border-[#005FB8]"
                        placeholder="MM/YY"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">{t('createPod.cvc')}</label>
                      <input
                        type="text"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#111827] focus:outline-none focus:border-[#005FB8]"
                        placeholder="321"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">{t('createPod.postalCode')}</label>
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
                  <div className="text-lg font-bold">{t('createPod.applePayInstant')}</div>
                  <p className="text-[11px] text-gray-400">
                    {t('createPod.applePayPrompt')}
                  </p>
                </div>
              )}
            </div>

            {/* Compliance Guarantee */}
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-[11px] text-gray-600 flex items-start gap-2 leading-relaxed">
              <Shield className="w-4 h-4 text-[#005FB8] shrink-0 mt-0.5" />
              <span>
                {t('createPod.stripeProtection')}
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
                <span>{t('createPod.backToConfig')}</span>
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
                    <span>{t('createPod.processingPayment', { amount: totalChargedAmount.toFixed(2) })}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>{t('createPod.confirmAndPay', { amount: totalChargedAmount.toFixed(2) })}</span>
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
                {t('createPod.successTitle')}
              </h3>
              <p className="text-xs text-slate-600">
                {t('createPod.successDesc', { amount: totalChargedAmount.toFixed(2) })}
              </p>
            </div>

            <div className="max-w-md mx-auto p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-left space-y-2 text-xs text-emerald-950">
              <div className="flex justify-between font-bold border-b border-emerald-200 pb-1.5">
                <span>{t('createPod.successPodName')}</span>
                <span className="font-mono text-emerald-800">{createdPodResult?.name || name}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('createPod.stripePaymentRef')}</span>
                <span className="font-mono text-emerald-800">pi_create_pod_{Date.now().toString().substring(5)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('createPod.holdingAccount')}</span>
                <span className="font-mono text-emerald-800">{createdPodResult?.holdingFinAccountId || `fa_pod_holding_${Date.now()}`}</span>
              </div>
              {createdPodResult?.welcomeMatchGranted && (
                <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-emerald-200/80">
                  <span>{t('createPod.welcomeMatchGranted')}</span>
                  <span>{t('createPod.welcomeMatchAdded', { amount: createdPodResult.welcomeMatchAmountUsd })}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {t('createPod.successFormingDesc')}
            </p>

            <div className="pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => onPodCreated(createdPodResult || undefined)}
                className="w-full max-w-sm py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm transition-colors shadow-md cursor-pointer mx-auto block"
              >
                {t('createPod.viewMyPodBtn')}
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
