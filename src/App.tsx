import React, { useState, useEffect } from 'react';
import { User, Pod } from './types';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { FDICNoticeBanner } from './components/FDICNoticeBanner';
import { PodCard } from './components/PodCard';
import { PodDetailModal } from './components/PodDetailModal';
import { CreatePodModal } from './components/CreatePodModal';
import { KYCGateModal } from './components/KYCGateModal';
import { StripeBankModal } from './components/StripeBankModal';
import { PodAgreementModal } from './components/PodAgreementModal';
import { PerksMarketplace } from './components/PerksMarketplace';
import { AuditLogViewer } from './components/AuditLogViewer';
import { AdminOpsView } from './components/AdminOpsView';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { EditProfileModal } from './components/EditProfileModal';
import { AboutUsModal, HowItWorksModal, ContactUsModal } from './components/InfoModals';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { 
  seedInitialFirestoreData, 
  subscribeToPods, 
  getUserFromFirestore, 
  saveUserToFirestore,
  subscribeToUser
} from './lib/firestoreService';

import { 
  PlusCircle, ShieldCheck, Building2, Wallet, ArrowRight, 
  Layers, Users, CheckCircle2, AlertCircle, Clock, Sparkles, Lock, Pencil,
  HeartHandshake, DollarSign, AlertTriangle
} from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<'LANDING' | 'DASHBOARD'>('LANDING');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allPods, setAllPods] = useState<Pod[]>([]);
  const [activeTab, setActiveTab] = useState<'my-pods' | 'explore-pods' | 'perks' | 'audit-log' | 'admin-ops'>('my-pods');

  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'LOGIN' | 'REGISTER' | 'PHONE' | 'GOOGLE'>('LOGIN');
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCreatePodModal, setShowCreatePodModal] = useState(false);
  const [showKYCGateModal, setShowKYCGateModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [selectedPodDetail, setSelectedPodDetail] = useState<Pod | null>(null);
  const [agreementPod, setAgreementPod] = useState<Pod | null>(null);

  const syncUserWithBackend = async (user: User) => {
    try {
      await fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      const allUsersRes = await fetch('/api/users');
      if (allUsersRes.ok) {
        const allUData = await allUsersRes.json();
        setAllUsers(allUData);
      }
    } catch (err) {
      console.error('Error syncing user to backend:', err);
    }
  };

  const fetchAppData = async (userIdOverride?: string) => {
    try {
      const uId = userIdOverride || (currentUser ? currentUser.id : undefined);

      if (uId) {
        // Try getting fresh user document from Firestore
        const firestoreUser = await getUserFromFirestore(uId);
        if (firestoreUser) {
          setCurrentUser(firestoreUser);
          await syncUserWithBackend(firestoreUser);
        } else {
          // Fetch current user from backend
          const userRes = await fetch(`/api/users/current?userId=${uId}`);
          if (userRes.ok) {
            const uData = await userRes.json();
            setCurrentUser(uData);
          }
        }
      } else {
        const userRes = await fetch('/api/users/current');
        if (userRes.ok) {
          const uData = await userRes.json();
          setCurrentUser(uData);
        }
      }

      // Fetch all users for switcher and landing demo
      const allUsersRes = await fetch('/api/users');
      if (allUsersRes.ok) {
        const allUData = await allUsersRes.json();
        setAllUsers(allUData);
      }

      // Fetch all pods
      const podsRes = await fetch('/api/pods');
      if (podsRes.ok) {
        const pData = await podsRes.json();
        setAllPods(pData);

        // Keep selectedPodDetail updated if open
        if (selectedPodDetail) {
          const fresh = pData.find((p: Pod) => p.id === selectedPodDetail.id);
          if (fresh) setSelectedPodDetail(fresh);
        }
      }
    } catch (err) {
      console.error('Error fetching app data:', err);
    }
  };

  useEffect(() => {
    // Initial fetch from backend API
    fetchAppData();

    // 1. Seed initial Firestore collections if empty
    seedInitialFirestoreData();

    // 2. Subscribe to real-time Pods in Firestore
    const unsubscribePods = subscribeToPods((firestorePods) => {
      if (firestorePods && firestorePods.length > 0) {
        setAllPods(firestorePods);
      }
    });

    // 3. Firebase Auth state listener
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        // Immediately show dashboard and close auth modal
        setShowAuthModal(false);
        setViewMode('DASHBOARD');

        // Non-blocking async background profile sync
        (async () => {
          let dbUser = await getUserFromFirestore(fbUser.uid);
          if (dbUser) {
            let modified = false;
            // Clean legacy $100 placeholder or fake bank placeholders for new user profiles with 0 completed pods
            if (dbUser.treasury && (dbUser.treasury.stripeAccountId?.startsWith('acct_fb_') || (dbUser.completedPodsCount === 0 && dbUser.treasury.balanceUsd === 100))) {
              dbUser.treasury.balanceUsd = 0.00;
              if (dbUser.treasury.stripeAccountId?.startsWith('acct_fb_')) {
                dbUser.treasury.stripeAccountId = '';
                dbUser.treasury.stripeFinAccountId = '';
                dbUser.treasury.status = 'UNINITIALIZED';
                dbUser.treasury.fdicPassThroughEligible = false;
              }
              modified = true;
            }
            if (dbUser.externalBank && dbUser.externalBank.bankName === 'Linked Bank Account') {
              dbUser.externalBank = {
                bankName: '',
                last4: '',
                routingNumber: '',
                accountType: 'CHECKING',
                status: 'NOT_LINKED',
              };
              modified = true;
            }

            // Ensure unverified users correctly reflect PENDING KYC status unless verified
            if (dbUser.kycStatus === 'VERIFIED' && !dbUser.kycVerifiedAt && !dbUser.treasury.stripeAccountId) {
              dbUser.kycStatus = 'PENDING';
              modified = true;
            }

            // Sync real avatar photoURL from Firebase Auth or generate dynamic avatar from display name
            if (fbUser.photoURL && dbUser.avatarUrl !== fbUser.photoURL) {
              dbUser.avatarUrl = fbUser.photoURL;
              modified = true;
            } else if (!dbUser.avatarUrl || dbUser.avatarUrl.includes('unsplash.com/photo-1534528741775-53994a69daeb')) {
              dbUser.avatarUrl = fbUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(dbUser.displayName || fbUser.displayName || 'Member')}&background=005FB8&color=fff&size=200`;
              modified = true;
            }

            if (modified) {
              saveUserToFirestore(dbUser).catch(console.error);
            }
            setCurrentUser(dbUser);
            syncUserWithBackend(dbUser).catch(console.error);
          } else {
            const resolvedName = fbUser.displayName || fbUser.phoneNumber || 'MutualPool Member';
            const newUser: User = {
              id: fbUser.uid,
              email: fbUser.email || `${fbUser.uid.substring(0, 8)}@mutualpool.org`,
              displayName: resolvedName,
              avatarUrl: fbUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedName)}&background=005FB8&color=fff&size=200`,
              platform: 'DoorDash',
              role: 'RIDER',
              accountAgeDays: 1,
              kycStatus: 'PENDING',
              treasury: {
                stripeAccountId: '',
                stripeFinAccountId: '',
                balanceUsd: 0.00,
                pendingInboundUsd: 0.00,
                totalPayoutsReceivedUsd: 0.00,
                fdicPassThroughEligible: false,
                status: 'UNINITIALIZED',
              },
              externalBank: {
                bankName: '',
                last4: '',
                routingNumber: '',
                accountType: 'CHECKING',
                status: 'NOT_LINKED',
              },
              completedPodsCount: 0,
            };
            saveUserToFirestore(newUser).catch(console.error);
            setCurrentUser(newUser);
            syncUserWithBackend(newUser).catch(console.error);
          }
        })().catch(console.error);
      }
    });

    return () => {
      unsubscribePods();
      unsubscribeAuth();
    };
  }, []);

  // Real-time Firestore listener for active user profile
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsubscribeUser = subscribeToUser(currentUser.id, (freshUser) => {
      if (freshUser) {
        setCurrentUser(freshUser);
      }
    });
    return () => {
      unsubscribeUser();
    };
  }, [currentUser?.id]);

  const handleOpenAuth = (mode: 'LOGIN' | 'REGISTER' | 'DEMO' | 'PHONE' | 'GOOGLE' = 'DEMO') => {
    setAuthInitialMode(mode);
    setShowAuthModal(true);
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setViewMode('DASHBOARD');
    setShowAuthModal(false);

    // Non-blocking background sync
    saveUserToFirestore(user).catch(console.error);
    syncUserWithBackend(user).catch(console.error);
    fetchAppData(user.id);
  };

  const handleSwitchUser = (userId: string) => {
    fetchAppData(userId);
    setViewMode('DASHBOARD');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Error signing out from Firebase:', err);
    }
    setCurrentUser(null);
    setViewMode('LANDING');
  };

  const [inviteCodeTargetPod, setInviteCodeTargetPod] = useState<Pod | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [inviteCodeError, setInviteCodeError] = useState<string | null>(null);

  const handleJoinPod = async (pod: Pod, inviteCode?: string) => {
    if (!currentUser) {
      handleOpenAuth('LOGIN');
      return;
    }
    if (currentUser.kycStatus !== 'VERIFIED') {
      setShowKYCGateModal(true);
      return;
    }

    // Check if Trusted Circle and user is not already invited
    if (pod.podType === 'TRUSTED_CIRCLE' && pod.createdBy !== currentUser.id && !inviteCode) {
      const isInvited = pod.invitedContacts?.some(
        ic => ic.emailOrPhone.toLowerCase() === currentUser.email.toLowerCase() || ic.memberUserId === currentUser.id
      );
      if (!isInvited) {
        setInviteCodeTargetPod(pod);
        setInviteCodeInput('');
        setInviteCodeError(null);
        return;
      }
    }

    try {
      const res = await fetch(`/api/pods/${pod.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ inviteCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'INVITE_REQUIRED') {
          setInviteCodeTargetPod(pod);
          setInviteCodeError(data.message || 'Invite code required for this Trusted Circle pod.');
          return;
        }
        alert(data.message || data.error || 'Failed to join pod');
        return;
      }

      setInviteCodeTargetPod(null);
      fetchAppData();
    } catch (err) {
      console.error('Failed to join pod:', err);
    }
  };

  // If viewing Landing Page or user explicitly hasn't entered dashboard
  if (viewMode === 'LANDING') {
    return (
      <>
        <LandingPage
          allPods={allPods}
          currentUser={currentUser}
          onOpenAuth={handleOpenAuth}
          onSelectUser={handleAuthSuccess}
          onGoToDashboard={() => setViewMode('DASHBOARD')}
          onLogout={handleLogout}
          onOpenAbout={() => setShowAboutModal(true)}
          onOpenHowItWorks={() => setShowHowItWorksModal(true)}
          onOpenContact={() => setShowContactModal(true)}
        />

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          allUsers={allUsers}
          onSelectUser={handleAuthSuccess}
          onRegistered={handleAuthSuccess}
          initialMode={authInitialMode}
        />

        <AboutUsModal
          isOpen={showAboutModal}
          onClose={() => setShowAboutModal(false)}
        />

        <HowItWorksModal
          isOpen={showHowItWorksModal}
          onClose={() => setShowHowItWorksModal(false)}
        />

        <ContactUsModal
          isOpen={showContactModal}
          onClose={() => setShowContactModal(false)}
        />
      </>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#111827] flex items-center justify-center p-4 font-sans">
        <div className="flex items-center gap-3 text-[#005FB8] font-semibold">
          <div className="w-5 h-5 border-2 border-[#005FB8] border-t-transparent rounded-full animate-spin" />
          <span>Loading Gig Worker Mutual Pool Engine...</span>
        </div>
      </div>
    );
  }

  const [repayingHardship, setRepayingHardship] = useState(false);

  const handleRepayHardship = async () => {
    if (!currentUser) return;
    setRepayingHardship(true);
    try {
      const reqsRes = await fetch('/api/hardship/requests', {
        headers: { 'x-user-id': currentUser.id },
      });
      if (!reqsRes.ok) throw new Error('Could not fetch hardship requests');
      const reqs = await reqsRes.json();
      const activeReq = reqs.find((r: any) => r.userId === currentUser.id && r.status === 'APPROVED');
      
      if (!activeReq) {
        alert('No active approved hardship request found.');
        return;
      }

      const res = await fetch('/api/hardship/repay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ requestId: activeReq.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Repayment failed');

      alert(`Hardship Fund paid off ($${data.request.totalPayoffAmount.toFixed(2)} including 7% fee)! Account reactivated for pool participation.`);
      fetchAppData(currentUser.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Repayment failed');
    } finally {
      setRepayingHardship(false);
    }
  };

  // Filter Pods
  const myPods = allPods.filter(p => p.members.some(m => m.userId === currentUser.id));

  // User-created forming pods (excluding initial demo seed pods)
  const userCreatedFormingPods = allPods.filter(
    p => p.status === 'FORMING' && p.id !== 'pod_starter_50_5usd' && p.id !== 'pod_metro_riders_20'
  );

  // If actual user-created forming pods exist, replace the demo seed pod with actual user-created pods
  const explorePods = userCreatedFormingPods.length > 0
    ? userCreatedFormingPods
    : allPods.filter(p => p.status === 'FORMING' && !p.members.some(m => m.userId === currentUser.id));

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827] flex flex-col font-sans selection:bg-[#005FB8] selection:text-white">
      
      {/* App Header */}
      <Header
        currentUser={currentUser}
        allUsers={allUsers}
        onSwitchUser={handleSwitchUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogoClick={() => {
          setViewMode('DASHBOARD');
          setActiveTab('my-pods');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenKYCGate={() => setShowKYCGateModal(true)}
        onOpenBankModal={() => setShowBankModal(true)}
        onOpenEditProfile={() => setShowEditProfileModal(true)}
        onExitToLanding={() => setViewMode('LANDING')}
        onOpenAbout={() => setShowAboutModal(true)}
        onOpenHowItWorks={() => setShowHowItWorksModal(true)}
        onOpenContact={() => setShowContactModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Financial Hardship Hold & Repayment Alert Banner */}
        {currentUser.isHardshipInactive && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-100 rounded-lg text-amber-800 shrink-0 mt-0.5">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-amber-950 text-sm">
                    Account Inactive / On Hold — Financial Hardship Fund Active
                  </span>
                  <span className="px-2.5 py-0.5 bg-amber-200 text-amber-900 font-bold text-[10px] rounded-full uppercase font-mono border border-amber-300">
                    On Hold
                  </span>
                </div>
                <p className="text-amber-800 mt-1 max-w-3xl leading-relaxed">
                  A Financial Hardship Fund deposit was disbursed on your behalf. While on hold, you cannot participate in weekly pool deposits or join new pods until repaid.
                </p>
                <div className="mt-2 flex items-center gap-3 font-mono text-xs text-amber-950 font-bold">
                  <span>Owed Balance: ${(currentUser.hardshipOwedUsd || 0).toFixed(2)} (Deposit + 7% service fee)</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleRepayHardship}
              disabled={repayingHardship}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <DollarSign className="w-4 h-4" />
              <span>{repayingHardship ? 'Processing...' : `Pay $${(currentUser.hardshipOwedUsd || 0).toFixed(2)} & Reactivate`}</span>
            </button>
          </div>
        )}

        {/* Top Personal Dashboard Banner */}
        <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            {/* User Greeting & Badges */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => setShowEditProfileModal(true)}
                  title="Click to change your primary gig platform or role"
                  className="text-xs font-mono font-bold text-[#005FB8] bg-blue-50 hover:bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span>{currentUser.platform} Fleet Member</span>
                  <Pencil className="w-3 h-3 text-[#005FB8]" />
                </button>
                <span className="text-xs font-mono text-[#6B7280]">
                  {currentUser.accountAgeDays} days account tenure
                </span>
              </div>
              <h2 className="text-2xl font-bold text-[#111827]">
                Welcome back, {currentUser.displayName}
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                FDIC Pass-Through Treasury Balance: <strong className="text-emerald-700 font-mono">${currentUser.treasury.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              </p>
            </div>

            {/* Quick Action Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {currentUser.kycStatus !== 'VERIFIED' && (
                <button
                  onClick={() => setShowKYCGateModal(true)}
                  className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs animate-pulse"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Verify Identity (KYC Gate)</span>
                </button>
              )}

              <button
                onClick={() => setShowBankModal(true)}
                className="px-3.5 py-2 rounded-lg bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Building2 className="w-4 h-4 text-[#005FB8]" />
                <span>{currentUser.externalBank.status === 'LINKED' ? `Bank: ${currentUser.externalBank.bankName}` : 'Link Bank Account'}</span>
              </button>

              <button
                onClick={() => setShowCreatePodModal(true)}
                className="px-4 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create New Pod</span>
              </button>
            </div>

          </div>

          {/* Metrics summary row */}
          <div className="mt-5 pt-4 border-t border-[#E2E8F0] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[#6B7280] text-[10px] block font-medium">Active Pods</span>
              <span className="font-extrabold text-[#111827] font-mono text-sm">{myPods.length} Pods</span>
            </div>

            <div>
              <span className="text-[#6B7280] text-[10px] block font-medium">KYC Verification</span>
              <span className={`font-extrabold font-mono text-xs ${currentUser.kycStatus === 'VERIFIED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {currentUser.kycStatus}
              </span>
            </div>

            <div>
              <span className="text-[#6B7280] text-[10px] block font-medium">Stripe Treasury Account</span>
              <span className="font-mono text-[#111827] text-xs truncate block">
                {currentUser.treasury.stripeFinAccountId || 'Pending KYC'}
              </span>
            </div>

            <div>
              <span className="text-[#6B7280] text-[10px] block font-medium">Completed Pod Cycles</span>
              <span className="font-extrabold text-[#005FB8] font-mono text-sm">{currentUser.completedPodsCount} Completed</span>
            </div>
          </div>
        </div>

        {/* FDIC Disclosure Notice Banner */}
        <FDICNoticeBanner />

        {/* TAB CONTENTS */}

        {/* 1. MY MUTUAL PODS TAB */}
        {activeTab === 'my-pods' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#111827]">My Active Mutual Pods ({myPods.length})</h3>
                <p className="text-xs text-[#6B7280]">Pods you are currently participating in with locked rotation order.</p>
              </div>

              <button
                onClick={() => setShowCreatePodModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>New Pod</span>
              </button>
            </div>

            {myPods.length === 0 ? (
              <div className="bg-white border border-[#DDE1E6] rounded-xl p-10 text-center space-y-3 shadow-xs">
                <Layers className="w-10 h-10 text-gray-400 mx-auto" />
                <h4 className="text-base font-bold text-[#111827]">You haven't joined any pods yet</h4>
                <p className="text-xs text-[#6B7280] max-w-md mx-auto">
                  Explore available forming pods in the marketplace or create a new pod with custom weekly deposit tiers.
                </p>
                <button
                  onClick={() => setActiveTab('explore-pods')}
                  className="px-4 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors shadow-xs"
                >
                  Explore Forming Pods
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {myPods.map((pod) => (
                  <PodCard
                    key={pod.id}
                    pod={pod}
                    currentUser={currentUser}
                    onSelectPod={(p) => setSelectedPodDetail(p)}
                    onJoinPod={handleJoinPod}
                    onSignAgreement={(p) => setAgreementPod(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. EXPLORE FORMING PODS TAB */}
        {activeTab === 'explore-pods' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-[#111827]">Explore Open Forming Pods ({explorePods.length})</h3>
              <p className="text-xs text-[#6B7280]">Join an open savings circle. Rotation order locks automatically when full.</p>
            </div>

            {explorePods.length === 0 ? (
              <div className="bg-white border border-[#DDE1E6] rounded-xl p-10 text-center space-y-3 shadow-xs">
                <Users className="w-10 h-10 text-gray-400 mx-auto" />
                <h4 className="text-base font-bold text-[#111827]">No open forming pods right now</h4>
                <p className="text-xs text-[#6B7280] max-w-md mx-auto">
                  Be the first to start a new savings pool for your delivery fleet!
                </p>
                <button
                  onClick={() => setShowCreatePodModal(true)}
                  className="px-4 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors shadow-xs"
                >
                  Create Pod
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {explorePods.map((pod) => (
                  <PodCard
                    key={pod.id}
                    pod={pod}
                    currentUser={currentUser}
                    onSelectPod={(p) => setSelectedPodDetail(p)}
                    onJoinPod={handleJoinPod}
                    onSignAgreement={(p) => setAgreementPod(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. PERKS MARKETPLACE TAB */}
        {activeTab === 'perks' && (
          <PerksMarketplace
            currentUser={currentUser}
            onOpenKYCGate={() => setShowKYCGateModal(true)}
          />
        )}

        {/* 4. AUDIT LOG LEDGER TAB */}
        {activeTab === 'audit-log' && <AuditLogViewer />}

        {/* 5. OPERATIONS & WEBHOOKS TAB */}
        {activeTab === 'admin-ops' && (
          <AdminOpsView
            currentUser={currentUser}
            allUsers={allUsers}
            allPods={allPods}
            onRefreshData={fetchAppData}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#DDE1E6] py-6 text-center text-xs text-[#6B7280] mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>2026 Chris Bitoye Ventures. All rights reserved.</span>
          <span>Pass-Through FDIC Insured up to $250,000 per user</span>
        </div>
      </footer>

      {/* MODALS */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        allUsers={allUsers}
        onSelectUser={handleAuthSuccess}
        onRegistered={handleAuthSuccess}
        initialMode={authInitialMode}
      />
      {showKYCGateModal && (
        <KYCGateModal
          user={currentUser}
          onClose={() => setShowKYCGateModal(false)}
          onVerified={async (updatedUser) => {
            setCurrentUser(updatedUser);
            setShowKYCGateModal(false);
            await saveUserToFirestore(updatedUser);
            await syncUserWithBackend(updatedUser);
            fetchAppData();
          }}
        />
      )}

      {showBankModal && (
        <StripeBankModal
          user={currentUser}
          onClose={() => setShowBankModal(false)}
          onBankLinked={(updatedUser) => {
            setCurrentUser(updatedUser);
            setShowBankModal(false);
            fetchAppData();
          }}
        />
      )}

      {showCreatePodModal && (
        <CreatePodModal
          user={currentUser}
          onClose={() => setShowCreatePodModal(false)}
          onPodCreated={() => {
            setShowCreatePodModal(false);
            fetchAppData();
          }}
        />
      )}

      {selectedPodDetail && (
        <PodDetailModal
          pod={selectedPodDetail}
          currentUser={currentUser}
          allUsers={allUsers}
          onClose={() => setSelectedPodDetail(null)}
          onRefreshPod={fetchAppData}
          onOpenAgreementModal={() => {
            setAgreementPod(selectedPodDetail);
          }}
          onOpenKYCGate={() => setShowKYCGateModal(true)}
        />
      )}

      {agreementPod && (
        <PodAgreementModal
          pod={agreementPod}
          user={currentUser}
          onClose={() => setAgreementPod(null)}
          onSigned={() => {
            setAgreementPod(null);
            fetchAppData();
          }}
        />
      )}

      <AboutUsModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />

      <HowItWorksModal
        isOpen={showHowItWorksModal}
        onClose={() => setShowHowItWorksModal(false)}
      />

      <ContactUsModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />

      {currentUser && (
        <EditProfileModal
          isOpen={showEditProfileModal}
          onClose={() => setShowEditProfileModal(false)}
          currentUser={currentUser}
          onUpdateUser={async (updatedUser) => {
            setCurrentUser(updatedUser);
            await syncUserWithBackend(updatedUser);
          }}
        />
      )}

      {inviteCodeTargetPod && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-md w-full p-6 shadow-2xl relative space-y-4 text-[#111827]">
            <button
              onClick={() => setInviteCodeTargetPod(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>

            <div className="flex items-center gap-2.5 text-[#005FB8]">
              <Lock className="w-5 h-5" />
              <h3 className="font-bold text-base">Private Trusted Circle Pod</h3>
            </div>

            <p className="text-xs text-[#6B7280]">
              <strong>"{inviteCodeTargetPod.name}"</strong> is a restricted Trusted Circle pod. Enter the 6-character private invite code provided by the pod creator ({inviteCodeTargetPod.creatorName}) to join:
            </p>

            {inviteCodeError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{inviteCodeError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inviteCodeInput.trim()) {
                  handleJoinPod(inviteCodeTargetPod, inviteCodeInput.trim().toUpperCase());
                }
              }}
              className="space-y-3"
            >
              <input
                type="text"
                required
                maxLength={8}
                placeholder="Enter Invite Code (e.g. BAY2026)"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-center font-mono font-bold text-base tracking-widest text-[#005FB8] uppercase focus:outline-none focus:border-[#005FB8]"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteCodeTargetPod(null)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors shadow-xs"
                >
                  Verify Code & Join Pod
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PWA Floating Install Banner */}
      <PWAInstallPrompt />

    </div>
  );
}
