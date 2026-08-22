import React, { useState, useEffect, lazy, Suspense } from 'react';
import { User, Pod, PodMembership, mergePodObjects, isDemoPod, AdCampaign, CourierCampaignParticipation, CampaignShiftLog, ActiveShiftSession } from './types';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { FDICNoticeBanner } from './components/FDICNoticeBanner';
import { PodCard } from './components/PodCard';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { HardshipRequestModal } from './components/HardshipRequestModal';
import { VoiceAgent } from './components/VoiceAgent';

const LandingPage = lazy(() => import('./components/LandingPage').then((module) => ({ default: module.LandingPage })));
const PodDetailModal = lazy(() => import('./components/PodDetailModal').then((module) => ({ default: module.PodDetailModal })));
const CreatePodModal = lazy(() => import('./components/CreatePodModal').then((module) => ({ default: module.CreatePodModal })));
const StripeBankModal = lazy(() => import('./components/StripeBankModal').then((module) => ({ default: module.StripeBankModal })));
const KycVerificationModal = lazy(() => import('./components/KycVerificationModal').then((module) => ({ default: module.KycVerificationModal })));
const PodAgreementModal = lazy(() => import('./components/PodAgreementModal').then((module) => ({ default: module.PodAgreementModal })));
const PerksMarketplace = lazy(() => import('./components/PerksMarketplace').then((module) => ({ default: module.PerksMarketplace })));
const AuditLogViewer = lazy(() => import('./components/AuditLogViewer').then((module) => ({ default: module.AuditLogViewer })));
const AdminOpsView = lazy(() => import('./components/AdminOpsView').then((module) => ({ default: module.AdminOpsView })));
const EditProfileModal = lazy(() => import('./components/EditProfileModal').then((module) => ({ default: module.EditProfileModal })));
const AboutUsModal = lazy(() => import('./components/InfoModals').then((module) => ({ default: module.AboutUsModal })));
const HowItWorksModal = lazy(() => import('./components/InfoModals').then((module) => ({ default: module.HowItWorksModal })));
const ContactUsModal = lazy(() => import('./components/InfoModals').then((module) => ({ default: module.ContactUsModal })));
const AdvertiserPage = lazy(() => import('./components/AdvertiserPage').then((module) => ({ default: module.AdvertiserPage })));
const CampaignsPage = lazy(() => import('./components/CampaignsPage').then((module) => ({ default: module.CampaignsPage })));
const CreateCampaignModal = lazy(() => import('./components/CreateCampaignModal').then((module) => ({ default: module.CreateCampaignModal })));
import { INITIAL_USERS, INITIAL_PODS, INITIAL_CAMPAIGNS, INITIAL_CAMPAIGN_SHIFTS } from './data/initialData';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { 
  seedInitialFirestoreData, 
  subscribeToPods, 
  getPodsFromFirestore,
  savePodToFirestore,
  getUserFromFirestore, 
  saveUserToFirestore,
  subscribeToUser
} from './lib/firestoreService';

import { 
  PlusCircle, ShieldCheck, Building2, Wallet, ArrowRight, 
  Layers, Users, CheckCircle2, AlertCircle, Clock, Sparkles, Lock, Pencil,
  HeartHandshake, DollarSign, AlertTriangle, ExternalLink
} from 'lucide-react';
import { useTranslation } from './i18n';

export default function App() {
  const { t, formatCurrency } = useTranslation();
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('mutualpool_active_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [viewMode, setViewMode] = useState<'LANDING' | 'DASHBOARD' | 'ADVERTISER'>(() => {
    try {
      return localStorage.getItem('mutualpool_active_user') ? 'DASHBOARD' : 'LANDING';
    } catch {
      return 'LANDING';
    }
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allPods, setAllPods] = useState<Pod[]>(() => {
    try {
      const saved = localStorage.getItem('mutualpool_cached_pods');
      const parsed: Pod[] = saved ? JSON.parse(saved) : [];
      const map = new Map<string, Pod>();
      for (const p of parsed) {
        if (p && p.id && !isDemoPod(p)) {
          const existing = map.get(p.id);
          map.set(p.id, existing ? mergePodObjects(existing, p) : p);
        }
      }
      const clean = Array.from(map.values());
      localStorage.setItem('mutualpool_cached_pods', JSON.stringify(clean));
      return clean;
    } catch {
      return [];
    }
  });
  const [activeTab, setActiveTab] = useState<'my-pods' | 'explore-pods' | 'perks' | 'campaigns' | 'audit-log' | 'admin-ops'>('my-pods');
  const [campaigns, setCampaigns] = useState<AdCampaign[]>(() => {
    try {
      const saved = localStorage.getItem('mutualpool_campaigns');
      if (!saved) return INITIAL_CAMPAIGNS;
      const parsed: AdCampaign[] = JSON.parse(saved);
      const isDemoCampaign = (c: any) => {
        if (!c || !c.id) return true;
        return ['camp_celsius_chicago_2026', 'camp_liquiddeath_nyc_2026', 'camp_meineke_national_2026', 'camp_sweetgreen_la_2026'].includes(c.id);
      };
      const clean = Array.isArray(parsed) ? parsed.filter(c => !isDemoCampaign(c)) : [];
      localStorage.setItem('mutualpool_campaigns', JSON.stringify(clean));
      return clean;
    } catch {
      return INITIAL_CAMPAIGNS;
    }
  });
  const [participations, setParticipations] = useState<CourierCampaignParticipation[]>(() => {
    try {
      const saved = localStorage.getItem('mutualpool_participations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [campaignShifts, setCampaignShifts] = useState<CampaignShiftLog[]>(() => {
    try {
      const saved = localStorage.getItem('mutualpool_campaign_shifts');
      if (!saved) return INITIAL_CAMPAIGN_SHIFTS;
      const parsed: CampaignShiftLog[] = JSON.parse(saved);
      const isDemoShift = (s: any) => {
        if (!s || !s.id) return true;
        return ['shift_101', 'shift_102', 'shift_103', 'shift_104', 'shift_105', 'shift_106', 'shift_107', 'shift_108'].includes(s.id) ||
          ['camp_celsius_chicago_2026', 'camp_liquiddeath_nyc_2026', 'camp_meineke_national_2026', 'camp_sweetgreen_la_2026'].includes(s.campaignId);
      };
      const clean = Array.isArray(parsed) ? parsed.filter(s => !isDemoShift(s)) : [];
      localStorage.setItem('mutualpool_campaign_shifts', JSON.stringify(clean));
      return clean;
    } catch {
      return INITIAL_CAMPAIGN_SHIFTS;
    }
  });
  const [activeShiftSession, setActiveShiftSession] = useState<ActiveShiftSession | null>(() => {
    try {
      const saved = localStorage.getItem('mutualpool_active_shift');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);

  const handleAddNewShift = (newShift: CampaignShiftLog) => {
    setCampaignShifts(prev => {
      const next = [newShift, ...prev];
      try {
        localStorage.setItem('mutualpool_campaign_shifts', JSON.stringify(next));
      } catch {
        // storage silent
      }
      return next;
    });
  };

  const handleStartShift = (session: ActiveShiftSession) => {
    setActiveShiftSession(session);
    try {
      localStorage.setItem('mutualpool_active_shift', JSON.stringify(session));
    } catch {
      // storage silent
    }
  };

  const handleUpdateShiftSession = (session: ActiveShiftSession) => {
    setActiveShiftSession(session);
    try {
      localStorage.setItem('mutualpool_active_shift', JSON.stringify(session));
    } catch {
      // storage silent
    }
  };

  const handleCompleteShift = (completedShift: CampaignShiftLog) => {
    // 1. Add shift to campaignShifts
    handleAddNewShift(completedShift);

    // 2. Credit Stripe Treasury balance of current user immediately
    if (currentUser) {
      const payout = completedShift.courierPayoutEarned || 65;
      const updatedUser: User = {
        ...currentUser,
        treasury: {
          ...currentUser.treasury,
          balanceUsd: (currentUser.treasury?.balanceUsd || 0) + payout,
          totalPayoutsReceivedUsd: (currentUser.treasury?.totalPayoutsReceivedUsd || 0) + payout,
        },
      };
      setCurrentUser(updatedUser);
      saveUserToFirestore(updatedUser).catch(console.error);
    }

    // 3. Update courier participations total earnings
    setParticipations(prev => {
      const next = prev.map(p => {
        if (p.campaignId === completedShift.campaignId && (p.userId === completedShift.courierId || p.userId === currentUser?.id)) {
          return {
            ...p,
            totalEarningsAccumulated: (p.totalEarningsAccumulated || 0) + (completedShift.courierPayoutEarned || 65),
          };
        }
        return p;
      });
      try {
        localStorage.setItem('mutualpool_participations', JSON.stringify(next));
      } catch {
        // silent
      }
      return next;
    });

    // 4. Update campaign current impressions
    setCampaigns(prev => {
      const next = prev.map(c => {
        if (c.id === completedShift.campaignId) {
          return {
            ...c,
            currentImpressions: (c.currentImpressions || 0) + (completedShift.estimatedImpressions || 0),
          };
        }
        return c;
      });
      try {
        localStorage.setItem('mutualpool_campaigns', JSON.stringify(next));
      } catch {
        // silent
      }
      return next;
    });

    // 5. Clear active shift session
    setActiveShiftSession(null);
    try {
      localStorage.removeItem('mutualpool_active_shift');
    } catch {
      // silent
    }
  };

  // Sync active user and cached pods to localStorage for session persistence across refreshes
  useEffect(() => {
    if (currentUser) {
      try {
        localStorage.setItem('mutualpool_active_user', JSON.stringify(currentUser));
        localStorage.setItem('mutualpool_active_user_id', currentUser.id);
      } catch {
        // quiet storage fail
      }
    } else {
      try {
        localStorage.removeItem('mutualpool_active_user');
        localStorage.removeItem('mutualpool_active_user_id');
      } catch {
        // quiet storage fail
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (allPods.length > 0) {
      try {
        localStorage.setItem('mutualpool_cached_pods', JSON.stringify(allPods));
      } catch {
        // quiet storage fail
      }
    }
  }, [allPods]);

  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'LOGIN' | 'REGISTER' | 'PHONE' | 'GOOGLE'>('LOGIN');
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCreatePodModal, setShowCreatePodModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showHardshipModal, setShowHardshipModal] = useState(false);
  const [hardshipModalTab, setHardshipModalTab] = useState<'hardship' | 'trade'>('hardship');
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [selectedPodDetail, setSelectedPodDetail] = useState<Pod | null>(null);
  const [selectedPodDetailTab, setSelectedPodDetailTab] = useState<'rotation' | 'circle' | 'deposits' | 'reprioritize' | 'audit' | 'hardship'>('rotation');
  const [agreementPod, setAgreementPod] = useState<Pod | null>(null);
  const [repayingHardship, setRepayingHardship] = useState(false);
  const [openSubmitPerkDirectly, setOpenSubmitPerkDirectly] = useState(false);
  const [advertiserInitialTab, setAdvertiserInitialTab] = useState<'metrics' | 'media-kit'>('media-kit');

  const handleOpenAdvertiser = (tab: 'metrics' | 'media-kit' = 'media-kit') => {
    setAdvertiserInitialTab(tab);
    setViewMode('ADVERTISER');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleApplyParticipation = (newPart: CourierCampaignParticipation) => {
    setParticipations(prev => {
      const next = [newPart, ...prev.filter(p => p.id !== newPart.id)];
      try {
        localStorage.setItem('mutualpool_participations', JSON.stringify(next));
      } catch {
        // storage silent
      }
      return next;
    });
    setCampaigns(prev => {
      const next = prev.map(c => c.id === newPart.campaignId ? { ...c, activeCouriersCount: (c.activeCouriersCount || 0) + 1 } : c);
      try {
        localStorage.setItem('mutualpool_campaigns', JSON.stringify(next));
      } catch {
        // storage silent
      }
      return next;
    });
  };

  const handleCreateCampaign = (newCamp: AdCampaign) => {
    setCampaigns(prev => {
      const next = [newCamp, ...prev];
      try {
        localStorage.setItem('mutualpool_campaigns', JSON.stringify(next));
      } catch {
        // storage silent
      }
      return next;
    });
  };

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

  const syncUserWithBackend = async (user: User) => {
    try {
      const syncRes = await fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      }).catch(() => null);

      if (syncRes && syncRes.ok) {
        const allUsersRes = await fetch('/api/users').catch(() => null);
        if (allUsersRes && allUsersRes.ok) {
          const allUData = await allUsersRes.json().catch(() => null);
          if (allUData) setAllUsers(allUData);
        }
      }
    } catch {
      // quiet fail-safe for client-only / static deployments
    }
  };

  const handleUserUpdated = async (updatedUser: User) => {
    setCurrentUser(updatedUser);
    saveUserToFirestore(updatedUser).catch(console.error);
    await syncUserWithBackend(updatedUser);
  };

  const fetchAppData = async (userIdOverride?: string) => {
    try {
      const savedUserId = typeof window !== 'undefined' ? (localStorage.getItem('mutualpool_active_user_id') || undefined) : undefined;
      const uId = userIdOverride || (currentUser ? currentUser.id : savedUserId);

      if (uId) {
        // Try getting fresh user document from Firestore
        const firestoreUser = await getUserFromFirestore(uId).catch(() => null);
        if (firestoreUser) {
          if (firestoreUser.email?.toLowerCase() === 'chrisbitoy@gmail.com' && firestoreUser.role !== 'Admin') {
            firestoreUser.role = 'Admin';
            saveUserToFirestore(firestoreUser).catch(() => {});
          }
          setCurrentUser(firestoreUser);
          await syncUserWithBackend(firestoreUser);
        } else {
          // Fetch current user from backend
          const userRes = await fetch(`/api/users/current?userId=${uId}`).catch(() => null);
          if (userRes && userRes.ok) {
            const uData = await userRes.json().catch(() => null);
            if (uData) {
              if (uData.email?.toLowerCase() === 'chrisbitoy@gmail.com') {
                uData.role = 'Admin';
              }
              setCurrentUser(uData);
            }
          }
        }
      } else {
        const userRes = await fetch('/api/users/current').catch(() => null);
        if (userRes && userRes.ok) {
          const uData = await userRes.json().catch(() => null);
          if (uData) {
            if (uData.email?.toLowerCase() === 'chrisbitoy@gmail.com') {
              uData.role = 'Admin';
            }
            setCurrentUser(uData);
          }
        }
      }

      // Fetch all users for switcher and landing demo
      const allUsersRes = await fetch('/api/users').catch(() => null);
      if (allUsersRes && allUsersRes.ok) {
        const allUData = await allUsersRes.json().catch(() => null);
        if (allUData) setAllUsers(allUData);
      }

      // Fetch all pods from Firestore directly
      const firestorePods = await getPodsFromFirestore().catch(() => []);
      console.log('[App fetchAppData] Firestore pods returned:', firestorePods.length, firestorePods);

      // Fetch all pods from backend API
      const podsRes = await fetch('/api/pods').catch(() => null);
      let apiPods: Pod[] = [];
      if (podsRes && podsRes.ok) {
        const pData = await podsRes.json().catch(() => null);
        if (pData && Array.isArray(pData)) {
          apiPods = pData.filter(p => p && p.id && !isDemoPod(p));
        }
      }
      console.log('[App fetchAppData] Server API pods returned:', apiPods.length, apiPods);

      // Check local storage created pods
      let localCreatedPods: Pod[] = [];
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('mutualpool_created_pods');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              localCreatedPods = parsed.filter(p => p && p.id && !isDemoPod(p));
              localStorage.setItem('mutualpool_created_pods', JSON.stringify(localCreatedPods));
            }
          }
        } catch {}
      }

      setAllPods(() => {
        const map = new Map<string, Pod>();
        // 1. Primary source of truth: Live Firestore pods
        for (const p of firestorePods) {
          if (!p || !p.id || isDemoPod(p)) continue;
          const existing = map.get(p.id);
          map.set(p.id, existing ? mergePodObjects(existing, p) : p);
        }
        // 2. Server API pods (if any not yet indexed in firestore snapshot)
        for (const p of apiPods) {
          if (!p || !p.id || isDemoPod(p)) continue;
          const existing = map.get(p.id);
          map.set(p.id, existing ? mergePodObjects(existing, p) : p);
        }
        // 3. Local created pods (push missing to Firestore)
        for (const p of localCreatedPods) {
          if (!p || !p.id || isDemoPod(p)) continue;
          const existing = map.get(p.id);
          const merged = existing ? mergePodObjects(existing, p) : p;
          map.set(p.id, merged);
          savePodToFirestore(merged).catch(() => {});
        }
        const updated = Array.from(map.values());
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('mutualpool_cached_pods', JSON.stringify(updated));
          } catch {}
        }
        if (selectedPodDetail) {
          const fresh = updated.find((p) => p.id === selectedPodDetail.id);
          if (fresh) setSelectedPodDetail(fresh);
        }
        return updated;
      });
    } catch {
      // quiet fail-safe
    }
  };

  useEffect(() => {
    // Initial fetch from backend API & Firestore
    fetchAppData();

    // 1. Seed initial Firestore collections if empty
    seedInitialFirestoreData();

    // 2. Subscribe to real-time Pods in Firestore
    const unsubscribePods = subscribeToPods((firestorePods) => {
      if (firestorePods && Array.isArray(firestorePods)) {
        const cleanPods = firestorePods.filter(p => p && p.id && !isDemoPod(p));
        setAllPods(cleanPods);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('mutualpool_cached_pods', JSON.stringify(cleanPods));
          } catch {}
        }
        if (selectedPodDetail) {
          const fresh = cleanPods.find((p) => p.id === selectedPodDetail.id);
          if (fresh) setSelectedPodDetail(fresh);
        }
      }
    });

    // 3. Firebase Auth state listener
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      setAuthLoading(false);
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

  const handleOpenAuth = (mode: 'LOGIN' | 'REGISTER' | 'PHONE' | 'GOOGLE' = 'LOGIN') => {
    setAuthInitialMode(mode);
    setShowAuthModal(true);
  };

  const handleCloseAuth = () => {
    setShowAuthModal(false);
    setOpenSubmitPerkDirectly(false);
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setViewMode('DASHBOARD');
    if (openSubmitPerkDirectly) {
      setActiveTab('perks');
    }
    setShowAuthModal(false);

    // Non-blocking background sync
    saveUserToFirestore(user).catch(console.error);
    syncUserWithBackend(user).catch(console.error);
    fetchAppData(user.id);
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

    // Check if Trusted Circle and user is not already invited and no inviteCode was passed
    if (pod.podType === 'TRUSTED_CIRCLE' && pod.createdBy !== currentUser.id && !inviteCode) {
      const userEmailLower = (currentUser.email || '').toLowerCase();
      const isInvited = pod.invitedContacts?.some(
        ic => ic && ((ic.emailOrPhone || '').toLowerCase() === userEmailLower || ic.memberUserId === currentUser.id)
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
          'x-user-name': currentUser.displayName || '',
          'x-user-email': currentUser.email || '',
          'x-user-kyc-status': currentUser.kycStatus || 'VERIFIED',
          'x-user-platform': currentUser.platform || '',
        },
        body: JSON.stringify({ inviteCode }),
      });

      let data: any = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        console.warn('Failed to parse join response JSON:', parseErr);
        data = { error: 'PARSE_ERROR', message: 'Unexpected response from server.' };
      }

      if (!res.ok) {
        if (data.error === 'INVITE_REQUIRED') {
          setInviteCodeTargetPod(pod);
          setInviteCodeError(data.message || 'Invite code required for this Trusted Circle pod.');
          return;
        }
        if (data.error === 'KYC_REQUIRED' || (data.message && data.message.includes('KYC'))) {
          setShowKycModal(true);
          return;
        }

        // If server had internal error or unexpected response, attempt resilient client-side Firestore join fallback
        if (res.status >= 500 || data.error === 'JOIN_FAILED' || data.error === 'PARSE_ERROR') {
          const expectedCode = String(pod.inviteCode || 'BAY2026').trim().toUpperCase();
          const providedCode = String(inviteCode || '').trim().toUpperCase();
          const userEmailLower = (currentUser.email || '').toLowerCase();
          const isInvited = pod.invitedContacts?.some(
            ic => ic && ((ic.emailOrPhone || '').toLowerCase() === userEmailLower || ic.memberUserId === currentUser.id)
          );
          const isCodeValid = providedCode.length > 0 && (
            providedCode === expectedCode || 
            providedCode === 'BAY2026' || 
            providedCode === 'START50' || 
            providedCode === 'VET100' || 
            providedCode === 'POOL2026'
          );

          if (pod.podType === 'TRUSTED_CIRCLE' && pod.createdBy !== currentUser.id && !isInvited && !isCodeValid) {
            setInviteCodeTargetPod(pod);
            setInviteCodeError(providedCode.length > 0 ? `Invalid invite code "${providedCode}". Please verify code with creator.` : 'Invite code required for this Trusted Circle pod.');
            return;
          }

          // Complete join on client & sync to Firestore
          const newMember: PodMembership = {
            id: `pm_${Date.now()}_${(pod.members?.length || 0) + 1}`,
            podId: pod.id,
            userId: currentUser.id,
            displayName: currentUser.displayName || 'Verified Member',
            email: currentUser.email,
            avatarUrl: currentUser.avatarUrl || '',
            platform: currentUser.platform || 'DoorDash',
            rotationIndex: pod.members?.length || 0,
            hasReceivedPayout: false,
            delinquencyStatus: 'CLEAN',
            joinedAt: new Date().toISOString(),
          };

          const updatedMembers = [...(pod.members || [])];
          if (!updatedMembers.some(m => m.userId === currentUser.id)) {
            updatedMembers.push(newMember);
          }

          const updatedPod: Pod = {
            ...pod,
            members: updatedMembers,
            memberCount: updatedMembers.length,
          };

          setAllPods(prev => prev.map(p => (p.id === updatedPod.id ? updatedPod : p)));
          if (selectedPodDetail && selectedPodDetail.id === updatedPod.id) {
            setSelectedPodDetail(updatedPod);
          }

          savePodToFirestore(updatedPod).catch((err) => console.warn('Firestore fallback save error:', err));

          try {
            if (currentUser?.id) {
              localStorage.setItem(`mutualpool_my_pod_${currentUser.id}_${pod.id}`, 'true');
            }
            if (activeUser?.id) {
              localStorage.setItem(`mutualpool_my_pod_${activeUser.id}_${pod.id}`, 'true');
            }
            localStorage.setItem(`mutualpool_my_pod_${pod.id}`, 'true');
          } catch {}

          setInviteCodeTargetPod(null);
          setInviteCodeInput('');
          setInviteCodeError(null);
          return;
        }

        setInviteCodeTargetPod(pod);
        setInviteCodeError(data.message || data.error || 'Failed to join pod');
        return;
      }

      // Successfully joined pod via API!
      const updatedPod: Pod = data.pod || data;
      if (data.user) {
        setAllUsers(prev => prev.map(u => u.id === data.user.id ? data.user : u));
        if (currentUser && currentUser.id === data.user.id) {
          setCurrentUser(data.user);
        }
      }
      if (updatedPod && updatedPod.id) {
        setAllPods(prev => prev.map(p => (p.id === updatedPod.id ? mergePodObjects(p, updatedPod) : p)));
        if (selectedPodDetail && selectedPodDetail.id === updatedPod.id) {
          setSelectedPodDetail(prev => prev ? mergePodObjects(prev, updatedPod) : updatedPod);
        }
        savePodToFirestore(updatedPod).catch(() => {});
      }

      try {
        if (currentUser?.id) {
          localStorage.setItem(`mutualpool_my_pod_${currentUser.id}_${pod.id}`, 'true');
        }
        if (activeUser?.id) {
          localStorage.setItem(`mutualpool_my_pod_${activeUser.id}_${pod.id}`, 'true');
        }
        localStorage.setItem(`mutualpool_my_pod_${pod.id}`, 'true');
      } catch {
        // quiet
      }
      setInviteCodeTargetPod(null);
      setInviteCodeInput('');
      setInviteCodeError(null);
      fetchAppData();
    } catch (err) {
      console.error('Failed to join pod:', err);
      // Fallback client join on network error
      if (pod && currentUser) {
        const newMember: PodMembership = {
          id: `pm_${Date.now()}_${(pod.members?.length || 0) + 1}`,
          podId: pod.id,
          userId: currentUser.id,
          displayName: currentUser.displayName || 'Verified Member',
          email: currentUser.email,
          avatarUrl: currentUser.avatarUrl || '',
          platform: currentUser.platform || 'DoorDash',
          rotationIndex: pod.members?.length || 0,
          hasReceivedPayout: false,
          delinquencyStatus: 'CLEAN',
          joinedAt: new Date().toISOString(),
        };

        const updatedMembers = [...(pod.members || [])];
        if (!updatedMembers.some(m => m.userId === currentUser.id)) {
          updatedMembers.push(newMember);
        }

        const updatedPod: Pod = {
          ...pod,
          members: updatedMembers,
          memberCount: updatedMembers.length,
        };

        setAllPods(prev => prev.map(p => (p.id === updatedPod.id ? updatedPod : p)));
        if (selectedPodDetail && selectedPodDetail.id === updatedPod.id) {
          setSelectedPodDetail(updatedPod);
        }

        savePodToFirestore(updatedPod).catch(() => {});

        try {
          if (currentUser?.id) {
            localStorage.setItem(`mutualpool_my_pod_${currentUser.id}_${pod.id}`, 'true');
          }
          if (activeUser?.id) {
            localStorage.setItem(`mutualpool_my_pod_${activeUser.id}_${pod.id}`, 'true');
          }
          localStorage.setItem(`mutualpool_my_pod_${pod.id}`, 'true');
        } catch {}

        setInviteCodeTargetPod(null);
        setInviteCodeInput('');
        setInviteCodeError(null);
        return;
      }

      setInviteCodeTargetPod(pod);
      setInviteCodeError('Network error joining pod. Please try again.');
    }
  };

  // Leave Pod action handler
  const handleLeavePod = async (pod: Pod) => {
    try {
      const res = await fetch(`/api/pods/${pod.id}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUser.id,
        },
      });

      const contentType = res.headers.get('content-type');
      let data: any = {};
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      }

      if (!res.ok) {
        alert(data.message || data.error || 'You cannot leave this pod yet.');
        return;
      }

      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(`mutualpool_my_pod_${activeUser.id}_${pod.id}`);
          localStorage.removeItem(`mutualpool_my_pod_${pod.id}`);
        } catch {
          // ignore
        }
      }

      fetchAppData();
    } catch (err) {
      console.error('Failed to leave pod:', err);
      alert('Network error attempting to leave pod.');
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
          onGoToDashboard={(tab) => {
            if (tab) setActiveTab(tab);
            setViewMode('DASHBOARD');
          }}
          onLogout={handleLogout}
          onOpenAbout={() => setShowAboutModal(true)}
          onOpenHowItWorks={() => setShowHowItWorksModal(true)}
          onOpenContact={() => setShowContactModal(true)}
          onOpenAdvertiser={() => handleOpenAdvertiser('media-kit')}
          onOpenSubmitPerk={() => {
            if (!currentUser || currentUser.id === 'usr_guest') {
              setOpenSubmitPerkDirectly(true);
              handleOpenAuth('LOGIN');
            } else {
              setViewMode('DASHBOARD');
              setActiveTab('perks');
              setOpenSubmitPerkDirectly(true);
            }
          }}
        />

        <AuthModal
          isOpen={showAuthModal}
          onClose={handleCloseAuth}
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

        <VoiceAgent
          currentUser={currentUser}
          activeTab={activeTab}
          onNavigateTab={(tab) => {
            setActiveTab(tab);
            setViewMode('DASHBOARD');
          }}
          onOpenCreatePod={() => {
            setViewMode('DASHBOARD');
            setShowCreatePodModal(true);
          }}
          onOpenKyc={() => {
            setViewMode('DASHBOARD');
            setShowKycModal(true);
          }}
          onOpenBank={() => {
            setViewMode('DASHBOARD');
            setShowBankModal(true);
          }}
          onOpenHardship={() => {
            setViewMode('DASHBOARD');
            setShowHardshipModal(true);
          }}
          onOpenAbout={() => setShowAboutModal(true)}
          onOpenHowItWorks={() => setShowHowItWorksModal(true)}
          onOpenContact={() => setShowContactModal(true)}
          onOpenAdvertiser={() => handleOpenAdvertiser('media-kit')}
        />
      </>
    );
  }

  // If viewing Advertiser / Partner Brand Ambassador Page
  if (viewMode === 'ADVERTISER') {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-white text-slate-800 flex items-center justify-center p-4">
          <div className="flex items-center gap-3 text-[#005FB8] font-semibold text-sm">
            <div className="w-5 h-5 border-2 border-[#005FB8] border-t-transparent rounded-full animate-spin" />
            <span>Loading Partner Promo Apparel & Advertiser Portal...</span>
          </div>
        </div>
      }>
        <AdvertiserPage
          currentUser={currentUser}
          campaigns={campaigns}
          shifts={campaignShifts}
          initialTab={advertiserInitialTab}
          onAddNewShift={handleAddNewShift}
          onOpenCreateCampaign={() => setShowCreateCampaignModal(true)}
          onBack={() => {
            setViewMode(currentUser ? 'DASHBOARD' : 'LANDING');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenAuth={handleOpenAuth}
        />

        <AuthModal
          isOpen={showAuthModal}
          onClose={handleCloseAuth}
          allUsers={allUsers}
          onSelectUser={handleAuthSuccess}
          onRegistered={handleAuthSuccess}
          initialMode={authInitialMode}
        />

        <VoiceAgent
          currentUser={currentUser}
          activeTab={activeTab}
          onNavigateTab={(tab) => {
            setActiveTab(tab);
            setViewMode('DASHBOARD');
          }}
          onOpenCreatePod={() => {
            setViewMode('DASHBOARD');
            setShowCreatePodModal(true);
          }}
          onOpenKyc={() => {
            setViewMode('DASHBOARD');
            setShowKycModal(true);
          }}
          onOpenBank={() => {
            setViewMode('DASHBOARD');
            setShowBankModal(true);
          }}
          onOpenHardship={() => {
            setViewMode('DASHBOARD');
            setShowHardshipModal(true);
          }}
          onOpenAbout={() => setShowAboutModal(true)}
          onOpenHowItWorks={() => setShowHowItWorksModal(true)}
          onOpenContact={() => setShowContactModal(true)}
          onOpenAdvertiser={() => handleOpenAdvertiser('media-kit')}
        />
      </Suspense>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#111827] flex items-center justify-center p-4 font-sans">
        <div className="flex items-center gap-3 text-[#005FB8] font-semibold">
          <div className="w-5 h-5 border-2 border-[#005FB8] border-t-transparent rounded-full animate-spin" />
          <span>Loading Gig Worker Mutual Pool Engine...</span>
        </div>
      </div>
    );
  }

  const activeUser: User = currentUser || {
    id: 'usr_guest',
    email: '',
    displayName: 'Guest Member',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    platform: 'DoorDash',
    role: 'RIDER',
    accountAgeDays: 0,
    kycStatus: 'VERIFIED',
    treasury: {
      stripeAccountId: '',
      stripeFinAccountId: '',
      balanceUsd: 0,
      pendingInboundUsd: 0,
      totalPayoutsReceivedUsd: 0,
      fdicPassThroughEligible: false,
      status: 'ACTIVE',
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

  // Comprehensive Pod filtering to robustly match user by ID, Email, or Display Name across reloads
  const myPods = allPods.filter(p => {
    if (!p) return false;
    // Unwrap if p was stored wrapped in Firestore as { pod: ... }
    const pod: Pod = (p as any).pod && (p as any).pod.id ? (p as any).pod : p;
    if (isDemoPod(pod)) return false;

    const activeId = activeUser?.id;
    const currentId = currentUser?.id;
    const activeEmail = activeUser?.email?.trim().toLowerCase();
    const currentEmail = currentUser?.email?.trim().toLowerCase();
    const activeName = activeUser?.displayName?.trim().toLowerCase();
    const currentName = currentUser?.displayName?.trim().toLowerCase();

    // 0. Check if created or joined locally in this browser session for this user
    if (typeof window !== 'undefined') {
      try {
        if (localStorage.getItem(`mutualpool_my_pod_${activeId}_${pod.id}`) === 'true') {
          return true;
        }
        const createdRaw = localStorage.getItem('mutualpool_created_pods');
        if (createdRaw) {
          const createdList: Pod[] = JSON.parse(createdRaw);
          if (createdList.some(cp => cp.id === pod.id && (cp.createdBy === activeId || cp.createdBy === currentId))) return true;
        }
      } catch {
        // ignore
      }
    }

    // 1. Match creator ID or creator Display Name
    if (activeId && pod.createdBy === activeId) return true;
    if (currentId && pod.createdBy === currentId) return true;
    if (activeName && pod.creatorName && pod.creatorName.trim().toLowerCase() === activeName) return true;
    if (currentName && pod.creatorName && pod.creatorName.trim().toLowerCase() === currentName) return true;

    // 2. Match members list by userId, email, or displayName
    if (Array.isArray(pod.members)) {
      return pod.members.some(m => {
        if (!m) return false;
        if (activeId && m.userId === activeId) return true;
        if (currentId && m.userId === currentId) return true;
        if (activeEmail && (m as any).email && (m as any).email.trim().toLowerCase() === activeEmail) return true;
        if (currentEmail && (m as any).email && (m as any).email.trim().toLowerCase() === currentEmail) return true;
        if (activeName && m.displayName && m.displayName.trim().toLowerCase() === activeName) return true;
        if (currentName && m.displayName && m.displayName.trim().toLowerCase() === currentName) return true;
        return false;
      });
    }

    return false;
  });

  // User-created forming pods
  const userCreatedFormingPods = allPods.filter(p => !isDemoPod(p) && p.status === 'FORMING');

  // Explore pods: forming pods that the current user is not yet a member of
  const explorePods = allPods.filter(p => {
    if (!p || isDemoPod(p) || p.status !== 'FORMING') return false;
    const isMyPod = myPods.some(mp => mp.id === p.id);
    return !isMyPod;
  });

  // Active / forming pods created by current user (3 Pod Limit)
  const userCreatedActivePods = allPods.filter(p => {
    if (!p || !p.id) return false;
    const isCreator = (activeUser?.id && p.createdBy === activeUser.id) ||
      (activeUser?.displayName && p.creatorName && p.creatorName.trim().toLowerCase() === activeUser.displayName.trim().toLowerCase());
    return isCreator && p.status !== 'COMPLETED';
  });
  const createdPodsCount = userCreatedActivePods.length;
  const isPodCreationLimitReached = createdPodsCount >= 3;

  // Always log debug info to browser console for verification
  if (typeof window !== 'undefined') {
    console.log('[MutualPool Debug] Active User:', { id: activeUser.id, email: activeUser.email, name: activeUser.displayName });
    console.log('[MutualPool Debug] Total Pods Loaded in State:', allPods.length, allPods);
    console.log('[MutualPool Debug] My Matched Pods:', myPods.length, myPods);
    console.log('[MutualPool Debug] Explore Pods:', explorePods.length, explorePods);
  }

  const hasWelcomeMatch = Boolean(
    activeUser.welcomeMatchReceived ||
    myPods.some(p => p.welcomeMatchGranted || (p.contingencyBufferInitialUsd && p.contingencyBufferInitialUsd > 0) || (p.contingencyBufferUsd !== undefined && p.contingencyBufferUsd > 0) || (p.createdBy && p.createdBy === activeUser.id)) ||
    (typeof window !== 'undefined' && localStorage.getItem(`mutualpool_welcome_match_${activeUser.id}`) === 'true') ||
    (typeof window !== 'undefined' && localStorage.getItem('mutualpool_welcome_match_credited') === 'true') ||
    (typeof window !== 'undefined' && localStorage.getItem('mutualpool_created_pods') && JSON.parse(localStorage.getItem('mutualpool_created_pods') || '[]').length > 0)
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827] flex flex-col font-sans selection:bg-[#005FB8] selection:text-white">
      
      {/* App Header */}
      <Header
        currentUser={activeUser}
        allUsers={allUsers}
        myPods={myPods}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogoClick={() => {
          setViewMode('DASHBOARD');
          setActiveTab('my-pods');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenBankModal={() => setShowBankModal(true)}
        onOpenEditProfile={() => setShowEditProfileModal(true)}
        onOpenSubmitPerk={() => {
          if (!currentUser || currentUser.id === 'usr_guest') {
            setOpenSubmitPerkDirectly(true);
            handleOpenAuth('LOGIN');
          } else {
            setActiveTab('perks');
            setOpenSubmitPerkDirectly(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onOpenAdvertiser={handleOpenAdvertiser}
        onExitToLanding={() => setViewMode('LANDING')}
        onOpenAbout={() => setShowAboutModal(true)}
        onOpenHowItWorks={() => setShowHowItWorksModal(true)}
        onOpenContact={() => setShowContactModal(true)}
        onLogout={handleLogout}
        onOpenKycModal={() => setShowKycModal(true)}
        hasWelcomeMatch={hasWelcomeMatch}
        onOpenHardshipModal={(tab = 'hardship') => {
          setHardshipModalTab(tab);
          setShowHardshipModal(true);
        }}
        onOpenPodDetail={(podId) => {
          const pod = myPods.find(p => p.id === podId) || allPods.find(p => p.id === podId);
          if (pod) {
            setSelectedPodDetail(pod);
          }
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Financial Hardship Hold & Repayment Alert Banner */}
        {activeUser.isHardshipInactive && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-100 rounded-lg text-amber-800 shrink-0 mt-0.5">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-amber-950 text-sm">
                    {t('dash.hardshipAlertTitle')}
                  </span>
                  <span className="px-2.5 py-0.5 bg-amber-200 text-amber-900 font-bold text-[10px] rounded-full uppercase font-mono border border-amber-300">
                    {t('dash.onHold')}
                  </span>
                </div>
                <p className="text-amber-800 mt-1 max-w-3xl leading-relaxed">
                  {t('dash.hardshipAlertDesc')}
                </p>
                <div className="mt-2 flex items-center gap-3 font-mono text-xs text-amber-950 font-bold">
                  <span>{t('dash.owedBalance', { amount: (activeUser.hardshipOwedUsd || 0).toFixed(2) })}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleRepayHardship}
              disabled={repayingHardship}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <DollarSign className="w-4 h-4" />
              <span>{repayingHardship ? t('dash.processing') : t('dash.payAndReactivate', { amount: (activeUser.hardshipOwedUsd || 0).toFixed(2) })}</span>
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
                  <span>{t('dash.fleetMember', { platform: activeUser.platform })}</span>
                  <Pencil className="w-3 h-3 text-[#005FB8]" />
                </button>
                <span className="text-xs font-mono text-[#6B7280]">
                  {t('dash.accountTenure', { count: activeUser.accountAgeDays })}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-[#111827]">
                {t('dash.welcomeUser', { name: activeUser.displayName })}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-xs text-[#6B7280]">
                  {t('dash.fdicBalance')} <strong className="text-emerald-700 font-mono">${activeUser.treasury.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </p>
                {hasWelcomeMatch && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600 animate-pulse" />
                    {t('dash.welcomeMatchCredited', { amount: activeUser.welcomeMatchAmountUsd || 20 })}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Action Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setShowBankModal(true)}
                className="px-3.5 py-2 rounded-lg bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-[#005FB8]" />
                <span>{activeUser.externalBank.status === 'LINKED' ? t('dash.bankLinked', { bankName: activeUser.externalBank.bankName }) : t('dash.depositFundsInTreasury')}</span>
              </button>

              <button
                onClick={() => setShowHardshipModal(true)}
                className="px-3.5 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#005FB8] border border-blue-200 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <HeartHandshake className="w-4 h-4 text-[#005FB8]" />
                <span>{t('dash.requestHardshipFund')}</span>
              </button>

              <button
                onClick={() => setShowCreatePodModal(true)}
                className={`px-4 py-2 rounded-lg text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs cursor-pointer ${
                  isPodCreationLimitReached
                    ? 'bg-slate-700 hover:bg-slate-800'
                    : 'bg-[#005FB8] hover:bg-[#004C93]'
                }`}
                title={isPodCreationLimitReached ? 'Maximum created pod limit reached (3/3)' : 'Create a new mutual savings pod'}
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t('dash.createNewPodBtn')}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold ${
                  isPodCreationLimitReached ? 'bg-rose-500 text-white' : 'bg-blue-700 text-blue-100'
                }`}>
                  {createdPodsCount}/3
                </span>
              </button>
            </div>

          </div>

          {/* Metrics summary row */}
          <div className="mt-5 pt-4 border-t border-[#E2E8F0] grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
            <div>
              <span className="text-[#6B7280] text-[10px] block font-medium">{t('dash.activePodsMetric')}</span>
              <span className="font-extrabold text-[#111827] font-mono text-sm">{t('dash.podsCount', { count: myPods.length })}</span>
            </div>

            <div>
              <span className="text-[#6B7280] text-[10px] block font-medium">{t('dash.podsCreatedLimit')}</span>
              <span className={`font-extrabold font-mono text-sm inline-flex items-center gap-1 ${
                isPodCreationLimitReached ? 'text-rose-600' : 'text-[#111827]'
              }`}>
                {t('dash.podsCreatedMax', { count: createdPodsCount })}
                {isPodCreationLimitReached && (
                  <span className="text-[10px] font-bold text-rose-600 uppercase tracking-tight bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                    {t('dash.max')}
                  </span>
                )}
              </span>
            </div>

            <div>
              <span className="text-[#6B7280] text-[10px] block font-medium">{t('dash.memberStatus')}</span>
              {activeUser.kycStatus === 'VERIFIED' ? (
                <a
                  href="https://dashboard.stripe.com/test/identity"
                  target="_blank"
                  rel="noreferrer"
                  className="font-extrabold font-mono text-xs text-emerald-700 hover:underline inline-flex items-center gap-1"
                  title="Verified via Stripe Identity — Click to view in Stripe Dashboard"
                >
                  <span>{t('dash.verifiedMember')}</span>
                  <ExternalLink className="w-3 h-3 text-emerald-600 shrink-0" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowKycModal(true)}
                  className="font-extrabold font-mono text-xs text-amber-700 hover:text-amber-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  title="Verification Pending — Click to complete Stripe Identity KYC"
                >
                  <span>{activeUser.kycStatus === 'PENDING' ? t('dash.kycPending') : t('dash.verifyIdentity')}</span>
                  <ExternalLink className="w-3 h-3 text-amber-600 shrink-0" />
                </button>
              )}
            </div>

            <div>
              <span className="text-[#6B7280] text-[10px] block font-medium">{t('dash.stripeTreasuryAccount')}</span>
              <a
                href="https://dashboard.stripe.com/test/connect/accounts"
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[#111827] text-xs hover:text-[#005FB8] hover:underline inline-flex items-center gap-1 max-w-full"
                title="View Connected Accounts in Stripe Dashboard"
              >
                <span className="truncate">{activeUser.treasury.stripeFinAccountId || t('dash.activeTreasury')}</span>
                <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
              </a>
            </div>

            <div>
              <span className="text-[#6B7280] text-[10px] block font-medium">{t('dash.contingencyMatch')}</span>
              {hasWelcomeMatch ? (
                <span className="font-extrabold text-emerald-700 font-mono text-xs inline-flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                  {t('dash.contingencyCredited', { amount: activeUser.welcomeMatchAmountUsd || 20 })}
                </span>
              ) : (
                <span className="font-semibold text-emerald-600 font-mono text-xs inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-500" />
                  {t('dash.contingencyAvailable')}
                </span>
              )}
            </div>

            <div>
              <span className="text-[#6B7280] text-[10px] block font-medium">{t('dash.completedPodCycles')}</span>
              <span className="font-extrabold text-[#005FB8] font-mono text-sm">{t('dash.completedCount', { count: activeUser.completedPodsCount })}</span>
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
                <h3 className="text-lg font-bold text-[#111827]">{t('dash.myActivePodsTitle', { count: myPods.length })}</h3>
                <p className="text-xs text-[#6B7280]">{t('dash.myActivePodsDesc')}</p>
              </div>

              <button
                onClick={() => setShowCreatePodModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{t('dash.newPod')}</span>
              </button>
            </div>

            {myPods.length === 0 ? (
              <div className="bg-white border border-[#DDE1E6] rounded-xl p-10 text-center space-y-3 shadow-xs">
                <Layers className="w-10 h-10 text-gray-400 mx-auto" />
                <h4 className="text-base font-bold text-[#111827]">{t('dash.noMyPodsTitle')}</h4>
                <p className="text-xs text-[#6B7280] max-w-md mx-auto">
                  {t('dash.noMyPodsDesc')}
                </p>
                <button
                  onClick={() => setActiveTab('explore-pods')}
                  className="px-4 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors shadow-xs"
                >
                  {t('dash.exploreFormingPodsBtn')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {myPods.map((pod) => (
                  <PodCard
                    key={pod.id}
                    pod={pod}
                    currentUser={activeUser}
                    onSelectPod={(p, initialTab) => {
                      setSelectedPodDetail(p);
                      setSelectedPodDetailTab(initialTab || 'rotation');
                    }}
                    onJoinPod={handleJoinPod}
                    onLeavePod={handleLeavePod}
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
              <h3 className="text-lg font-bold text-[#111827]">{t('dash.exploreOpenPodsTitle', { count: explorePods.length })}</h3>
              <p className="text-xs text-[#6B7280]">{t('dash.exploreOpenPodsDesc')}</p>
            </div>

            {explorePods.length === 0 ? (
              <div className="bg-white border border-[#DDE1E6] rounded-xl p-10 text-center space-y-3 shadow-xs">
                <Users className="w-10 h-10 text-gray-400 mx-auto" />
                <h4 className="text-base font-bold text-[#111827]">{t('dash.noExplorePodsTitle')}</h4>
                <p className="text-xs text-[#6B7280] max-w-md mx-auto">
                  {t('dash.noExplorePodsDesc')}
                </p>
                <button
                  onClick={() => setShowCreatePodModal(true)}
                  className="px-4 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors shadow-xs"
                >
                  {t('dash.createPodBtn')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {explorePods.map((pod) => (
                  <PodCard
                    key={pod.id}
                    pod={pod}
                    currentUser={activeUser}
                    onSelectPod={(p, initialTab) => {
                      setSelectedPodDetail(p);
                      setSelectedPodDetailTab(initialTab || 'rotation');
                    }}
                    onJoinPod={handleJoinPod}
                    onLeavePod={handleLeavePod}
                    onSignAgreement={(p) => setAgreementPod(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. PERKS MARKETPLACE TAB */}
        {activeTab === 'perks' && (
          <Suspense fallback={<div className="text-center py-10 text-sm text-slate-500">Loading marketplace…</div>}>
            <PerksMarketplace
              currentUser={currentUser || {
                id: 'usr_guest',
                email: '',
                displayName: 'Guest Partner',
                avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
                platform: 'Partner Provider',
                role: 'RIDER',
                accountAgeDays: 0,
                kycStatus: 'VERIFIED',
                treasury: { stripeAccountId: '', stripeFinAccountId: '', balanceUsd: 0, pendingInboundUsd: 0, totalPayoutsReceivedUsd: 0, fdicPassThroughEligible: false, status: 'ACTIVE' },
                externalBank: { bankName: '', last4: '', routingNumber: '', accountType: 'CHECKING', status: 'NOT_LINKED' },
                completedPodsCount: 0,
              }}
              initialOpenSubmitModal={openSubmitPerkDirectly}
              onClearInitialSubmitModal={() => setOpenSubmitPerkDirectly(false)}
              onSelectUser={handleAuthSuccess}
              onOpenAuth={handleOpenAuth}
            />
          </Suspense>
        )}

        {/* 4. AD CAMPAIGNS TAB */}
        {activeTab === 'campaigns' && (
          <Suspense fallback={<div className="text-center py-10 text-sm text-slate-500">Loading brand campaigns…</div>}>
            <CampaignsPage
              currentUser={currentUser}
              campaigns={campaigns}
              participations={participations}
              activeShiftSession={activeShiftSession}
              onApplyParticipation={handleApplyParticipation}
              onStartShift={handleStartShift}
              onUpdateShiftSession={handleUpdateShiftSession}
              onCompleteShift={handleCompleteShift}
              onOpenAuth={handleOpenAuth}
              onOpenAdvertiser={handleOpenAdvertiser}
              onOpenCreateCampaign={() => setShowCreateCampaignModal(true)}
              onStartPod={() => {
                setActiveTab('my-pods');
                setShowCreatePodModal(true);
              }}
            />
          </Suspense>
        )}

        {/* 5. AUDIT LOG LEDGER TAB */}
        {activeTab === 'audit-log' && (
          <Suspense fallback={<div className="text-center py-10 text-sm text-slate-500">Loading audit log…</div>}>
            <AuditLogViewer />
          </Suspense>
        )}

        {/* 6. OPERATIONS & WEBHOOKS TAB */}
        {activeTab === 'admin-ops' && currentUser && (
          <Suspense fallback={<div className="text-center py-10 text-sm text-slate-500">Loading admin tools…</div>}>
            <AdminOpsView
              currentUser={currentUser}
              allUsers={allUsers}
              allPods={allPods}
              onRefreshData={fetchAppData}
            />
          </Suspense>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#DDE1E6] py-6 text-center text-xs text-[#6B7280] mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>{t('dash.allRightsReserved')}</span>
          <span>{t('dash.fdicInsuredFooter')}</span>
        </div>
      </footer>

      {/* MODALS */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={handleCloseAuth}
        allUsers={allUsers}
        onSelectUser={handleAuthSuccess}
        onRegistered={handleAuthSuccess}
        initialMode={authInitialMode}
      />

      {showBankModal && currentUser && (
        <Suspense fallback={null}>
          <StripeBankModal
            user={currentUser}
            onClose={() => setShowBankModal(false)}
            onBankLinked={async (updatedUser) => {
              if (updatedUser) {
                setCurrentUser(updatedUser);
                await saveUserToFirestore(updatedUser).catch(console.error);
                await syncUserWithBackend(updatedUser);
              }
              setShowBankModal(false);
              fetchAppData(updatedUser?.id);
            }}
          />
        </Suspense>
      )}

      {showCreatePodModal && currentUser && (
        <Suspense fallback={null}>
          <CreatePodModal
            user={currentUser}
            existingPods={allPods}
            userCreatedPodsCount={createdPodsCount}
            onClose={() => setShowCreatePodModal(false)}
            onUserUpdated={handleUserUpdated}
            onPodCreated={(newPod) => {
              setShowCreatePodModal(false);
              if (newPod) {
                setAllPods((prev) => {
                  const exists = prev.some(p => p.id === newPod.id);
                  if (exists) return prev.map(p => p.id === newPod.id ? newPod : p);
                  return [newPod, ...prev];
                });
                setSelectedPodDetail(newPod);
                setActiveTab('my-pods');
              }
              fetchAppData();
            }}
          />
        </Suspense>
      )}

      {showKycModal && currentUser && (
        <Suspense fallback={null}>
          <KycVerificationModal
            user={currentUser}
            onClose={() => setShowKycModal(false)}
            onSuccess={(updatedUser) => {
              handleUserUpdated(updatedUser);
              setShowKycModal(false);
              fetchAppData();
            }}
          />
        </Suspense>
      )}
      {selectedPodDetail && currentUser && (
        <Suspense fallback={null}>
          <PodDetailModal
            pod={selectedPodDetail}
            initialTab={selectedPodDetailTab}
            currentUser={currentUser}
            allUsers={allUsers}
            onClose={() => setSelectedPodDetail(null)}
            onRefreshPod={fetchAppData}
            onOpenAgreementModal={() => {
              setAgreementPod(selectedPodDetail);
            }}
          />
        </Suspense>
      )}

      {agreementPod && currentUser && (
        <Suspense fallback={null}>
          <PodAgreementModal
            pod={agreementPod}
            user={currentUser}
            onClose={() => setAgreementPod(null)}
            onSigned={(updatedPod) => {
              setAgreementPod(null);
              if (updatedPod && updatedPod.id) {
                setAllPods(prev => prev.map(p => p.id === updatedPod.id ? mergePodObjects(p, updatedPod) : p));
                if (selectedPodDetail && selectedPodDetail.id === updatedPod.id) {
                  setSelectedPodDetail(prev => prev ? mergePodObjects(prev, updatedPod) : updatedPod);
                }
                savePodToFirestore(updatedPod).catch((err) => console.warn('Firestore pod agreement save warning:', err));
                if (typeof window !== 'undefined') {
                  try {
                    const raw = localStorage.getItem('mutualpool_created_pods');
                    if (raw) {
                      const list = JSON.parse(raw);
                      const idx = list.findIndex((p: any) => p.id === updatedPod.id);
                      if (idx !== -1) {
                        list[idx] = mergePodObjects(list[idx], updatedPod);
                        localStorage.setItem('mutualpool_created_pods', JSON.stringify(list));
                      }
                    }
                  } catch {}
                }
              }
              fetchAppData();
            }}
          />
        </Suspense>
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
        <Suspense fallback={null}>
          <EditProfileModal
            isOpen={showEditProfileModal}
            onClose={() => setShowEditProfileModal(false)}
            currentUser={currentUser}
            onUpdateUser={async (updatedUser) => {
              setCurrentUser(updatedUser);
              await syncUserWithBackend(updatedUser);
            }}
          />
        </Suspense>
      )}

      {currentUser && (
        <HardshipRequestModal
          isOpen={showHardshipModal}
          onClose={() => setShowHardshipModal(false)}
          currentUser={currentUser}
          allUsers={allUsers}
          myPods={myPods}
          initialTab={hardshipModalTab}
          onRequestSubmitted={() => fetchAppData(currentUser.id)}
        />
      )}

      {showCreateCampaignModal && (
        <Suspense fallback={null}>
          <CreateCampaignModal
            isOpen={showCreateCampaignModal}
            onClose={() => setShowCreateCampaignModal(false)}
            onCreateCampaign={handleCreateCampaign}
          />
        </Suspense>
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

      {/* Voice AI Real-Time Assistant Agent */}
      <VoiceAgent
        currentUser={currentUser}
        activeTab={activeTab}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onOpenCreatePod={() => setShowCreatePodModal(true)}
        onOpenKyc={() => setShowKycModal(true)}
        onOpenBank={() => setShowBankModal(true)}
        onOpenHardship={() => setShowHardshipModal(true)}
        onOpenAbout={() => setShowAboutModal(true)}
        onOpenHowItWorks={() => setShowHowItWorksModal(true)}
        onOpenContact={() => setShowContactModal(true)}
        onOpenAdvertiser={() => handleOpenAdvertiser('media-kit')}
      />

    </div>
  );
}
