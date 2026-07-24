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

import { 
  PlusCircle, ShieldCheck, Building2, Wallet, ArrowRight, 
  Layers, Users, CheckCircle2, AlertCircle, Clock, Sparkles 
} from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<'LANDING' | 'DASHBOARD'>('LANDING');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allPods, setAllPods] = useState<Pod[]>([]);
  const [activeTab, setActiveTab] = useState<'my-pods' | 'explore-pods' | 'perks' | 'audit-log' | 'admin-ops'>('my-pods');

  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'LOGIN' | 'REGISTER' | 'DEMO'>('DEMO');
  const [showCreatePodModal, setShowCreatePodModal] = useState(false);
  const [showKYCGateModal, setShowKYCGateModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [selectedPodDetail, setSelectedPodDetail] = useState<Pod | null>(null);
  const [agreementPod, setAgreementPod] = useState<Pod | null>(null);

  const fetchAppData = async (userIdOverride?: string) => {
    try {
      const uId = userIdOverride || (currentUser ? currentUser.id : 'usr_marcus');

      // Fetch current user
      const userRes = await fetch(`/api/users/current?userId=${uId}`);
      if (userRes.ok) {
        const uData = await userRes.json();
        setCurrentUser(uData);
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
    fetchAppData();
  }, []);

  const handleOpenAuth = (mode: 'LOGIN' | 'REGISTER' | 'DEMO' = 'DEMO') => {
    setAuthInitialMode(mode);
    setShowAuthModal(true);
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setViewMode('DASHBOARD');
    fetchAppData(user.id);
  };

  const handleSwitchUser = (userId: string) => {
    fetchAppData(userId);
    setViewMode('DASHBOARD');
  };

  const handleJoinPod = async (pod: Pod) => {
    if (!currentUser) {
      handleOpenAuth('LOGIN');
      return;
    }
    if (currentUser.kycStatus !== 'VERIFIED') {
      setShowKYCGateModal(true);
      return;
    }

    try {
      const res = await fetch(`/api/pods/${pod.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
      });

      if (res.ok) {
        fetchAppData();
      }
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
          onOpenAuth={handleOpenAuth}
          onSelectUser={handleAuthSuccess}
        />

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          allUsers={allUsers}
          onSelectUser={handleAuthSuccess}
          onRegistered={handleAuthSuccess}
          initialMode={authInitialMode}
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

  // Filter Pods
  const myPods = allPods.filter(p => p.members.some(m => m.userId === currentUser.id));
  const explorePods = allPods.filter(p => p.status === 'FORMING' && !p.members.some(m => m.userId === currentUser.id));

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827] flex flex-col font-sans selection:bg-[#005FB8] selection:text-white">
      
      {/* App Header */}
      <Header
        currentUser={currentUser}
        allUsers={allUsers}
        onSwitchUser={handleSwitchUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenKYCGate={() => setShowKYCGateModal(true)}
        onOpenBankModal={() => setShowBankModal(true)}
        onExitToLanding={() => setViewMode('LANDING')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Top Personal Dashboard Banner */}
        <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            {/* User Greeting & Badges */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-[#005FB8] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                  {currentUser.platform} Fleet Member
                </span>
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
          <span>Gig Worker Mutual Savings Pool & Perks PWA v2 • Built on Stripe Treasury & Connect Custom Rails</span>
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
          onVerified={(updatedUser) => {
            setCurrentUser(updatedUser);
            setShowKYCGateModal(false);
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

      {/* PWA Floating Install Banner */}
      <PWAInstallPrompt />

    </div>
  );
}
