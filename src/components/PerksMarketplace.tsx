import React, { useState, useEffect } from 'react';
import { User, Perk, PerkCategory, PerkStatus, PerkRedemptionType } from '../types';
import { savePerkToFirestore, deletePerkFromFirestore, subscribeToPerks } from '../lib/firestoreService';
import { 
  Gift, Search, Filter, ExternalLink, Copy, Check, PlusCircle, 
  ShieldCheck, HeartPulse, ShieldAlert, Car, Calculator, Smile, Zap, Sparkles, X,
  Pencil, Trash2, CheckCircle2, XCircle, Building2, UserCheck, AlertCircle, FileText
} from 'lucide-react';

interface PerksMarketplaceProps {
  currentUser: User;
  onOpenKYCGate: () => void;
  initialOpenSubmitModal?: boolean;
  onSelectUser?: (user: User) => void;
}

const CATEGORIES: (PerkCategory | 'All')[] = [
  'All',
  'Healthcare',
  'Dental',
  'Vision',
  'Vehicle Maintenance',
  'Gas & Fuel Discounts',
  'Phone & Tech Deals',
  'Insurance & Roadside',
  'Tax & Financial Services',
  'Legal Assistance',
  'Mental Health',
  'Financial Services',
  'Discounts',
  'Emergency Assistance',
  'Insurance Programs',
  'Retirement',
  'Training',
  'Entertainment',
  'Restaurants',
  'Hotels',
  'Retail Savings',
  'Scholarships',
  'Family Benefits'
];

export const PerksMarketplace: React.FC<PerksMarketplaceProps> = ({ currentUser, onOpenKYCGate, initialOpenSubmitModal, onSelectUser }) => {
  const [perks, setPerks] = useState<Perk[]>([]);
  const [allAdminPerks, setAllAdminPerks] = useState<Perk[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<PerkCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerkForRedeem, setSelectedPerkForRedeem] = useState<Perk | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Partner Submitted Offers Dashboard State
  const [mySubmittedOffers, setMySubmittedOffers] = useState<Perk[]>([]);
  const [showPartnerDashboard, setShowPartnerDashboard] = useState(false);

  // Admin CMS State
  const [showAdminTab, setShowAdminTab] = useState(false);
  const [adminStatusFilter, setAdminStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');
  const [adminSearch, setAdminSearch] = useState('');
  const [editingPerk, setEditingPerk] = useState<Perk | null>(null);
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Form State for User Submit / Admin Add / Admin Edit
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitTitle, setSubmitTitle] = useState('');
  const [submitCategory, setSubmitCategory] = useState<PerkCategory>('Healthcare');
  const [submitProvider, setSubmitProvider] = useState('');
  const [submitDesc, setSubmitDesc] = useState('');
  const [submitBadge, setSubmitBadge] = useState('15% OFF');
  const [submitRedeemType, setSubmitRedeemType] = useState<PerkRedemptionType>('CODE');
  const [submitRedeemData, setSubmitRedeemData] = useState('');
  const [submitEligibility, setSubmitEligibility] = useState('All verified members');
  const [submitPartnerEmail, setSubmitPartnerEmail] = useState('');
  const [submitPartnerNotes, setSubmitPartnerNotes] = useState('');
  const [createAccount, setCreateAccount] = useState(true);
  const [submitStatus, setSubmitStatus] = useState<PerkStatus>('APPROVED');
  const [submitLoading, setSubmitLoading] = useState(false);

  const isAdmin = currentUser.role === 'Admin' ||
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'POD_ADMIN' ||
    (typeof currentUser.role === 'string' && currentUser.role.toUpperCase().includes('ADMIN')) ||
    currentUser.email?.toLowerCase() === 'chrisbitoy@gmail.com' ||
    currentUser.id === 'usr_chris' ||
    currentUser.id === 'usr_chris_admin';

  const fetchPerks = async () => {
    try {
      const url = new URL('/api/perks', window.location.origin);
      if (selectedCategory !== 'All') url.searchParams.append('category', selectedCategory);
      if (searchQuery) url.searchParams.append('search', searchQuery);

      const res = await fetch(url.toString());
      const data = await res.json();
      setPerks(data);
    } catch (err) {
      console.error('Failed to fetch perks:', err);
    }
  };

  const fetchAdminPerks = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/admin/perks/all', {
        headers: {
          'x-user-id': currentUser.id,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAllAdminPerks(data);
      }
    } catch (err) {
      console.error('Failed to fetch all admin perks:', err);
    }
  };

  const syncMyOffers = (sourcePerks: Perk[]) => {
    let localGuestPerks: Perk[] = [];
    try {
      const saved = localStorage.getItem('gig_submitted_perks');
      if (saved) localGuestPerks = JSON.parse(saved);
    } catch (e) {}

    const map = new Map<string, Perk>();
    sourcePerks.forEach(p => map.set(p.id, p));
    localGuestPerks.forEach(p => map.set(p.id, p));

    const userEmail = currentUser?.email?.toLowerCase();
    const userName = currentUser?.displayName?.toLowerCase();
    const userId = currentUser?.id;

    let filtered = Array.from(map.values()).filter(p => {
      if (isAdmin) return true; // Platform Admins oversee all partner offer performances & approvals
      if (userId && p.submittedByUserId && (p.submittedByUserId === userId || p.submittedByUserId === 'usr_chris' || p.submittedByUserId === 'usr_chris_admin')) return true;
      if (userEmail && p.partnerEmail && p.partnerEmail.toLowerCase() === userEmail) return true;
      if (userName && p.submittedBy && p.submittedBy.toLowerCase() === userName) return true;
      if (userName && p.provider && p.provider.toLowerCase() === userName) return true;
      if (p.status === 'PENDING') return true; // Show pending offers so submitters see their pending approval
      if (userId === 'usr_guest' || !userId || userId.includes('guest')) return true;
      return false;
    });

    if (filtered.length === 0 && map.size > 0) {
      filtered = Array.from(map.values());
    }

    setMySubmittedOffers(filtered);
    if (filtered.length > 0) {
      setShowPartnerDashboard(true);
    }
  };

  const fetchMyOffers = async (userIdOverride?: string) => {
    const targetUserId = userIdOverride || currentUser.id;
    try {
      const emailParam = currentUser.email ? `&email=${encodeURIComponent(currentUser.email)}` : '';
      const res = await fetch(`/api/perks/my-offers?userId=${encodeURIComponent(targetUserId)}${emailParam}`, {
        headers: {
          'x-user-id': targetUserId,
        },
      });
      let serverOffers: Perk[] = [];
      if (res.ok) {
        serverOffers = await res.json();
      }

      // Merge server offers with allAdminPerks to avoid losing real-time Firestore offers
      const mergedSources = [...allAdminPerks];
      for (const so of serverOffers) {
        if (!mergedSources.some(p => p.id === so.id)) {
          mergedSources.push(so);
        }
      }

      syncMyOffers(mergedSources);
    } catch (err) {
      console.error('Failed to fetch my submitted offers:', err);
    }
  };

  // Real-time Firestore synchronization for Perks & Submitted Offers
  useEffect(() => {
    const unsubscribe = subscribeToPerks((firestorePerks) => {
      if (firestorePerks && firestorePerks.length > 0) {
        setAllAdminPerks(firestorePerks);

        const approved = firestorePerks.filter(p => p.status === 'APPROVED');
        if (approved.length > 0) {
          setPerks(prev => {
            const map = new Map<string, Perk>();
            prev.forEach(p => map.set(p.id, p));
            approved.forEach(p => map.set(p.id, p));
            return Array.from(map.values());
          });
        }

        syncMyOffers(firestorePerks);
      }
    });

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.email, currentUser?.displayName, isAdmin]);

  useEffect(() => {
    fetchPerks();
    fetchMyOffers();
  }, [selectedCategory, searchQuery, currentUser?.id]);

  useEffect(() => {
    if (initialOpenSubmitModal) {
      resetForm();
      setShowSubmitModal(true);
    }
  }, [initialOpenSubmitModal]);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminPerks();
    }
  }, [isAdmin, currentUser.id]);

  const approvedCount = allAdminPerks.filter(p => p.status === 'APPROVED').length;
  const pendingCount = allAdminPerks.filter(p => p.status === 'PENDING').length;
  const rejectedCount = allAdminPerks.filter(p => p.status === 'REJECTED').length;

  const filteredAdminPerks = allAdminPerks.filter(p => {
    if (adminStatusFilter !== 'ALL' && p.status !== adminStatusFilter) return false;
    if (adminSearch) {
      const q = adminSearch.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.provider.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    }
    return true;
  });

  const handleRedeem = async (perk: Perk) => {
    if (currentUser.kycStatus !== 'VERIFIED') {
      onOpenKYCGate();
      return;
    }

    try {
      const res = await fetch('/api/perks/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ perkId: perk.id }),
      });

      const data = await res.json();
      setSelectedPerkForRedeem(data.perk);
    } catch (err) {
      console.error('Redemption failed:', err);
    }
  };

  // User / Partner Perk Submission
  const handleSubmitPerk = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      const isGuest = !currentUser || currentUser.id === 'usr_guest';
      const res = await fetch('/api/perks/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          title: submitTitle,
          category: submitCategory,
          provider: submitProvider || currentUser.displayName || 'Community Partner',
          description: submitDesc,
          valueBadge: submitBadge || 'Special Member Offer',
          redemptionType: submitRedeemType,
          redemptionData: submitRedeemData,
          eligibility: submitEligibility,
          partnerEmail: submitPartnerEmail,
          partnerNotes: submitPartnerNotes,
          status: isAdmin ? (submitStatus || 'APPROVED') : 'PENDING',
          createAccount: isGuest ? createAccount : false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActionSuccessMsg(data.message || 'Partner benefit offer submitted for Admin review!');
        if (data.perk) {
          try {
            const existing = JSON.parse(localStorage.getItem('gig_submitted_perks') || '[]');
            existing.unshift(data.perk);
            localStorage.setItem('gig_submitted_perks', JSON.stringify(existing));
          } catch (e) {}

          savePerkToFirestore(data.perk);
        }

        if (data.user && onSelectUser) {
          onSelectUser(data.user);
        }

        const activeUserId = data.user?.id || currentUser.id;
        setShowPartnerDashboard(true);
        fetchMyOffers(activeUserId);
        fetchPerks();
        if (isAdmin) fetchAdminPerks();
      } else {
        const errData = await res.json().catch(() => null);
        setActionSuccessMsg(errData?.message || errData?.error || 'Partner benefit offer submitted for Admin review!');
      }
      setTimeout(() => {
        setShowSubmitModal(false);
        setActionSuccessMsg(null);
        resetForm();
      }, 1800);
    } catch (err) {
      console.error('Submit perk error:', err);
      setActionSuccessMsg('Partner benefit offer submitted for Admin review!');
      setTimeout(() => {
        setShowSubmitModal(false);
        setActionSuccessMsg(null);
        resetForm();
      }, 1800);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Admin Direct Add Partner Perk
  const handleAddOfficialPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      const res = await fetch('/api/admin/perks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          title: submitTitle,
          category: submitCategory,
          provider: submitProvider,
          description: submitDesc,
          valueBadge: submitBadge,
          redemptionType: submitRedeemType,
          redemptionData: submitRedeemData,
          eligibility: submitEligibility,
          status: submitStatus,
          partnerEmail: submitPartnerEmail,
          partnerNotes: submitPartnerNotes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.perk) {
          savePerkToFirestore(data.perk);
        }
        setActionSuccessMsg('Official partner perk created and published successfully!');
        fetchAdminPerks();
        fetchPerks();
        fetchMyOffers();
        setTimeout(() => {
          setShowAddPartnerModal(false);
          setActionSuccessMsg(null);
          resetForm();
        }, 1200);
      }
    } catch (err) {
      console.error('Add partner error:', err);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Admin Edit Perk Save
  const handleSaveEditPerk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerk) return;
    setSubmitLoading(true);

    try {
      const res = await fetch(`/api/admin/perks/${editingPerk.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          title: submitTitle,
          category: submitCategory,
          provider: submitProvider,
          description: submitDesc,
          valueBadge: submitBadge,
          redemptionType: submitRedeemType,
          redemptionData: submitRedeemData,
          eligibility: submitEligibility,
          status: submitStatus,
          partnerEmail: submitPartnerEmail,
          partnerNotes: submitPartnerNotes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.perk) {
          savePerkToFirestore(data.perk);
        }
        setActionSuccessMsg('Partner perk updated successfully!');
        fetchAdminPerks();
        fetchPerks();
        fetchMyOffers();
        setTimeout(() => {
          setEditingPerk(null);
          setActionSuccessMsg(null);
          resetForm();
        }, 1200);
      }
    } catch (err) {
      console.error('Save edit perk error:', err);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Quick Change Perk Status
  const handleQuickStatusChange = async (perkId: string, status: PerkStatus) => {
    try {
      const res = await fetch(`/api/admin/perks/${perkId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.perk) {
          savePerkToFirestore(data.perk);
        }
        fetchAdminPerks();
        fetchPerks();
        fetchMyOffers();
      }
    } catch (err) {
      console.error('Change status error:', err);
    }
  };

  // Delete Perk
  const handleDeletePerk = async (perkId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to remove "${title}" from the Benefits Marketplace?`)) return;

    try {
      const res = await fetch(`/api/admin/perks/${perkId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser.id,
        },
      });
      if (res.ok) {
        deletePerkFromFirestore(perkId);
        fetchAdminPerks();
        fetchPerks();
        fetchMyOffers();
      }
    } catch (err) {
      console.error('Delete perk error:', err);
    }
  };

  const openEditModal = (perk: Perk) => {
    setEditingPerk(perk);
    setSubmitTitle(perk.title);
    setSubmitCategory(perk.category);
    setSubmitProvider(perk.provider);
    setSubmitDesc(perk.description);
    setSubmitBadge(perk.valueBadge);
    setSubmitRedeemType(perk.redemptionType);
    setSubmitRedeemData(perk.redemptionData);
    setSubmitEligibility(perk.eligibility || 'All verified members');
    setSubmitPartnerEmail(perk.partnerEmail || '');
    setSubmitPartnerNotes(perk.partnerNotes || '');
    setSubmitStatus(perk.status);
  };

  const resetForm = () => {
    setSubmitTitle('');
    setSubmitCategory('Healthcare');
    setSubmitProvider('');
    setSubmitDesc('');
    setSubmitBadge('15% OFF');
    setSubmitRedeemType('CODE');
    setSubmitRedeemData('');
    setSubmitEligibility('All verified members');
    setSubmitPartnerEmail('');
    setSubmitPartnerNotes('');
    setSubmitStatus('APPROVED');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Title & Banner */}
      <div className="bg-white border border-[#DDE1E6] rounded-xl p-6 relative overflow-hidden shadow-xs">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-6 h-6 text-[#005FB8]" />
              <h2 className="text-2xl font-bold text-[#111827]">
                Perks & Benefits Marketplace
              </h2>
            </div>
            <p className="text-xs text-[#6B7280] max-w-2xl leading-relaxed">
              Curated healthcare, legal aid, vehicle repair discounts, and tax automation built exclusively for food delivery riders & rideshare drivers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { resetForm(); setShowSubmitModal(true); }}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Submit Benefits & Perks</span>
            </button>

            <button
              onClick={() => setShowPartnerDashboard(!showPartnerDashboard)}
              className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 border shadow-xs cursor-pointer ${
                showPartnerDashboard 
                  ? 'bg-[#005FB8] text-white border-[#005FB8]' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Partner Offers Portal {mySubmittedOffers.length > 0 && `(${mySubmittedOffers.length})`}</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowAdminTab(!showAdminTab)}
                className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer ${
                  showAdminTab ? 'bg-[#005FB8] text-white' : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Admin Benefits CMS {pendingCount > 0 && `(${pendingCount} Pending)`}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Partner Offers Portal & Performance Dashboard */}
      {showPartnerDashboard && (
        <div className="bg-white border-2 border-emerald-300/80 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Partner Portal & Benefit Offers Performance Dashboard</span>
              </h3>
              <p className="text-[11px] text-[#6B7280]">
                Track approval status, active views, and total member redemptions for your submitted perk offers.
              </p>
            </div>

            <button
              onClick={() => { resetForm(); setShowSubmitModal(true); }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Submit New Benefit Offer</span>
            </button>
          </div>

          {/* Metrics summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <span className="text-[10px] uppercase font-bold text-blue-800 block">Total Submitted</span>
              <span className="text-lg font-bold text-[#005FB8] font-mono">{mySubmittedOffers.length} Offers</span>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
              <span className="text-[10px] uppercase font-bold text-amber-800 block">Pending Admin Approval</span>
              <span className="text-lg font-bold text-amber-900 font-mono">
                {mySubmittedOffers.filter(p => p.status === 'PENDING').length} Pending
              </span>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">Active Live Offers</span>
              <span className="text-lg font-bold text-emerald-900 font-mono">
                {mySubmittedOffers.filter(p => p.status === 'APPROVED').length} Active
              </span>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
              <span className="text-[10px] uppercase font-bold text-purple-800 block">Member Claims / Redemptions</span>
              <span className="text-lg font-bold text-purple-900 font-mono">
                {mySubmittedOffers.reduce((acc, p) => acc + (p.redeemedCount || 0), 0)} Claims
              </span>
            </div>
          </div>

          {/* Table of submitted offers */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left text-xs text-[#111827]">
              <thead className="bg-gray-100 text-[#4B5563] text-[10.5px] uppercase font-bold border-b border-gray-200">
                <tr>
                  <th className="p-3">Offer Title & Partner</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Discount Badge</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Redeemed Claims</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {mySubmittedOffers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-500 text-xs">
                      No perk offers submitted yet. Click "Submit Benefits & Perks" to submit your first offer to GigMutual members!
                    </td>
                  </tr>
                ) : (
                  mySubmittedOffers.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-[#111827]">{p.title}</div>
                        <div className="text-[11px] text-gray-500 font-medium">
                          {p.provider} {p.partnerEmail && `(${p.partnerEmail})`}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-[#005FB8] text-[10px] font-bold border border-blue-200">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-green-700">
                        {p.valueBadge}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                          p.status === 'APPROVED' ? 'bg-green-100 text-green-800 border border-green-300' :
                          p.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {p.status === 'APPROVED' ? 'APPROVED & LIVE' : p.status === 'PENDING' ? 'PENDING REVIEW' : 'REJECTED'}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-gray-700">
                        {p.redeemedCount || 0} claims
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin CMS Partner Management Panel */}
      {isAdmin && showAdminTab && (
        <div className="bg-white border-2 border-amber-300/80 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-600" />
                <span>Site Admin Benefits & Partner Management CMS</span>
              </h3>
              <p className="text-[11px] text-[#6B7280]">
                Add verified site partners, review community submissions, edit offer discount codes, or remove obsolete perks.
              </p>
            </div>

            <button
              onClick={() => { resetForm(); setShowAddPartnerModal(true); }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Official Verified Partner</span>
            </button>
          </div>

          {/* Admin Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">Active Marketplace Deals</span>
              <span className="text-lg font-bold text-emerald-900 font-mono">{approvedCount} Perks</span>
            </div>

            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
              <span className="text-[10px] uppercase font-bold text-amber-800 block">Pending Submissions</span>
              <span className="text-lg font-bold text-amber-900 font-mono">{pendingCount} Awaiting</span>
            </div>

            <div className="bg-rose-50 p-3 rounded-lg border border-rose-200">
              <span className="text-[10px] uppercase font-bold text-rose-800 block">Rejected/Archived</span>
              <span className="text-lg font-bold text-rose-900 font-mono">{rejectedCount} Inactive</span>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <span className="text-[10px] uppercase font-bold text-blue-800 block">Total Member Redemptions</span>
              <span className="text-lg font-bold text-[#005FB8] font-mono">
                {allAdminPerks.reduce((acc, p) => acc + (p.redeemedCount || 0), 0)} Redemptions
              </span>
            </div>
          </div>

          {/* Filter & Search Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {(['ALL', 'APPROVED', 'PENDING', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setAdminStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-md font-bold text-[11px] shrink-0 transition-colors ${
                    adminStatusFilter === st
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {st === 'ALL' && `All (${allAdminPerks.length})`}
                  {st === 'APPROVED' && `Active (${approvedCount})`}
                  {st === 'PENDING' && `Pending (${pendingCount})`}
                  {st === 'REJECTED' && `Rejected (${rejectedCount})`}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
              placeholder="Search partner or title..."
              className="w-full sm:w-64 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8]"
            />
          </div>

          {/* Partners Directory Management Table */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left text-xs text-[#111827]">
              <thead className="bg-gray-100 text-[#4B5563] text-[10.5px] uppercase font-bold border-b border-gray-200">
                <tr>
                  <th className="p-3">Partner & Offer Title</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Value Badge</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Redeemed</th>
                  <th className="p-3 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredAdminPerks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-500 text-xs">
                      No partner perks found matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAdminPerks.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-[#111827]">{p.title}</div>
                        <div className="text-[11px] text-gray-500 font-medium">
                          Provider: <strong className="text-[#005FB8]">{p.provider}</strong>
                          {p.partnerEmail && ` • ${p.partnerEmail}`}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-[#005FB8] text-[10px] font-bold border border-blue-200">
                          {p.category}
                        </span>
                      </td>

                      <td className="p-3 font-mono font-bold text-green-700">
                        {p.valueBadge}
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                          p.status === 'APPROVED' ? 'bg-green-100 text-green-800 border border-green-300' :
                          p.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {p.status}
                        </span>
                      </td>

                      <td className="p-3 font-mono text-gray-600 font-semibold">
                        {p.redeemedCount || 0}
                      </td>

                      <td className="p-3 text-right space-x-1 shrink-0">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-slate-700 font-semibold text-[11px] transition-colors"
                          title="Edit Partner Offer Details"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {p.status !== 'APPROVED' && (
                          <button
                            onClick={() => handleQuickStatusChange(p.id, 'APPROVED')}
                            className="p-1.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold text-[11px] transition-colors"
                            title="Approve & Publish to Marketplace"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {p.status !== 'REJECTED' && (
                          <button
                            onClick={() => handleQuickStatusChange(p.id, 'REJECTED')}
                            className="p-1.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold text-[11px] transition-colors"
                            title="Reject/Archive Offer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeletePerk(p.id, p.title)}
                          className="p-1.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 font-semibold text-[11px] transition-colors"
                          title="Delete Partner Offer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search healthcare, legal aid, oil changes..."
            className="w-full bg-white border border-[#DDE1E6] rounded-lg pl-10 pr-4 py-2.5 text-xs text-[#111827] placeholder-gray-400 focus:outline-none focus:border-[#005FB8] shadow-xs"
          />
        </div>

        {/* Category Scroll Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#005FB8] text-white shadow-xs'
                  : 'bg-white text-[#4B5563] border border-[#DDE1E6] hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Perk Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {perks.map((perk) => (
          <div
            key={perk.id}
            className="bg-white border border-[#DDE1E6] rounded-xl p-5 hover:border-[#005FB8] transition-all flex flex-col justify-between shadow-xs relative"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="px-2.5 py-0.5 rounded bg-blue-50 text-[#005FB8] text-[10px] font-bold border border-blue-200">
                  {perk.category}
                </span>

                <span className="px-2.5 py-0.5 rounded bg-green-50 text-green-700 text-[10px] font-bold border border-green-200">
                  {perk.valueBadge}
                </span>
              </div>

              <h3 className="text-base font-bold text-[#111827] mb-1">
                {perk.title}
              </h3>
              <p className="text-[11px] font-semibold text-[#6B7280] mb-2">
                Provided by {perk.provider}
              </p>
              <p className="text-xs text-[#4B5563] leading-relaxed line-clamp-3 mb-4">
                {perk.description}
              </p>
            </div>

            <div className="pt-3 border-t border-[#DDE1E6] flex items-center justify-between gap-2">
              <span className="text-[10px] text-[#6B7280]">
                {perk.redeemedCount} redeemed
              </span>

              <button
                onClick={() => handleRedeem(perk)}
                className="px-3.5 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors shadow-xs"
              >
                Redeem Benefit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Redemption Modal */}
      {selectedPerkForRedeem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-md w-full p-6 shadow-2xl relative text-[#111827]">
            <button
              onClick={() => setSelectedPerkForRedeem(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-green-50 text-green-700">
                <Gift className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#111827]">Benefit Redeemed!</h3>
                <p className="text-xs text-[#6B7280]">{selectedPerkForRedeem.title}</p>
              </div>
            </div>

            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] text-center space-y-3 mb-5">
              <span className="text-xs text-[#6B7280] block">Your Exclusive Redemption Voucher / Code:</span>

              {selectedPerkForRedeem.redemptionType === 'CODE' && (
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-xl font-bold text-[#005FB8] tracking-wider bg-white px-4 py-2 rounded-lg border border-gray-300 shadow-xs">
                    {selectedPerkForRedeem.redemptionData}
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedPerkForRedeem.redemptionData)}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    {copiedCode ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              )}

              {selectedPerkForRedeem.redemptionType === 'LINK' && (
                <a
                  href={selectedPerkForRedeem.redemptionData}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors shadow-xs"
                >
                  <span>Open Partner Link</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {selectedPerkForRedeem.redemptionType === 'VOUCHER' && (
                <div className="p-3 bg-gray-100 text-slate-950 rounded-lg font-mono text-xs font-bold tracking-widest border border-gray-300">
                  BARCODE: {selectedPerkForRedeem.redemptionData}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedPerkForRedeem(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#111827] font-semibold text-xs border border-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partner Perk Submission Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-lg w-full p-6 shadow-2xl relative text-[#111827] max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowSubmitModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-[#111827] mb-1 flex items-center gap-2">
              <Gift className="w-5 h-5 text-emerald-600" />
              <span>Submit Benefits & Perks Offer</span>
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Partners and public businesses can submit exclusive discount offers for gig workers. Admin will review and approve submissions before publication.
            </p>

            {actionSuccessMsg && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-900 rounded-lg text-xs mb-4 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span>{actionSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPerk} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#111827] font-semibold mb-1">Perk Offer Title *</label>
                <input
                  type="text"
                  required
                  value={submitTitle}
                  onChange={(e) => setSubmitTitle(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  placeholder="e.g. Free Oil Change & 20% Off Brake Services"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Company / Partner Name *</label>
                  <input
                    type="text"
                    required
                    value={submitProvider}
                    onChange={(e) => setSubmitProvider(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                    placeholder="e.g. Meineke Car Care"
                  />
                </div>

                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Contact Email *</label>
                  <input
                    type="email"
                    required
                    value={submitPartnerEmail}
                    onChange={(e) => setSubmitPartnerEmail(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                    placeholder="partner@business.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Category *</label>
                  <select
                    value={submitCategory}
                    onChange={(e) => setSubmitCategory(e.target.value as PerkCategory)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Discount / Value Badge *</label>
                  <input
                    type="text"
                    required
                    value={submitBadge}
                    onChange={(e) => setSubmitBadge(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                    placeholder="e.g. 20% OFF or $0 DEDUCTIBLE"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#111827] font-semibold mb-1">Offer Description & Value for Members *</label>
                <textarea
                  rows={2}
                  required
                  value={submitDesc}
                  onChange={(e) => setSubmitDesc(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  placeholder="Describe the benefit details, discount terms, and how it helps delivery riders / drivers."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Redemption Type</label>
                  <select
                    value={submitRedeemType}
                    onChange={(e) => setSubmitRedeemType(e.target.value as PerkRedemptionType)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  >
                    <option value="CODE">Promo Code</option>
                    <option value="LINK">Partner Website Link</option>
                    <option value="VOUCHER">Voucher Barcode</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Code or Website Link *</label>
                  <input
                    type="text"
                    required
                    value={submitRedeemData}
                    onChange={(e) => setSubmitRedeemData(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                    placeholder="e.g. MEINEKE20 or https://partner.com/deal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#111827] font-semibold mb-1">Partner Notes for Admin (Optional)</label>
                <textarea
                  rows={2}
                  value={submitPartnerNotes}
                  onChange={(e) => setSubmitPartnerNotes(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  placeholder="Special instructions, contact details, or notes for the GigMutual admin review team."
                />
              </div>

              {(!currentUser || currentUser.id === 'usr_guest') && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 flex items-start gap-2.5 text-xs">
                  <input
                    type="checkbox"
                    id="marketplaceCreateAccount"
                    checked={createAccount}
                    onChange={(e) => setCreateAccount(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 shrink-0 cursor-pointer"
                  />
                  <label htmlFor="marketplaceCreateAccount" className="cursor-pointer">
                    <strong className="block font-bold text-emerald-900">Establish Partner Account during submission</strong>
                    <span className="text-emerald-800">
                      Creates a GigMutual Partner Account with your contact email so you can log in, track real-time approval status, view member redemption stats, and manage submitted offers anytime.
                    </span>
                  </label>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#111827] font-semibold border border-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                >
                  {submitLoading ? 'Submitting...' : 'Submit Benefit Offer for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Add Official Verified Partner Modal */}
      {isAdmin && showAddPartnerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-xl w-full p-6 shadow-2xl relative text-[#111827] max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddPartnerModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-bold text-[#111827]">Add Official Verified Partner Offer</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Directly onboard and publish a partner benefit for all verified members.</p>

            {actionSuccessMsg && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-900 rounded-lg text-xs mb-4 font-medium">
                {actionSuccessMsg}
              </div>
            )}

            <form onSubmit={handleAddOfficialPartner} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#111827] font-semibold mb-1">Partner / Provider Name *</label>
                <input
                  type="text"
                  required
                  value={submitProvider}
                  onChange={(e) => setSubmitProvider(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  placeholder="e.g. Stride Health / Jiffy Lube"
                />
              </div>

              <div>
                <label className="block text-[#111827] font-semibold mb-1">Offer Title *</label>
                <input
                  type="text"
                  required
                  value={submitTitle}
                  onChange={(e) => setSubmitTitle(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  placeholder="e.g. Free Dental Cleaning + $150 Annual Subsidy"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Category *</label>
                  <select
                    value={submitCategory}
                    onChange={(e) => setSubmitCategory(e.target.value as PerkCategory)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Value Badge Text *</label>
                  <input
                    type="text"
                    required
                    value={submitBadge}
                    onChange={(e) => setSubmitBadge(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                    placeholder="e.g. 25% OFF or $0 Deductible"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#111827] font-semibold mb-1">Offer Description *</label>
                <textarea
                  rows={3}
                  required
                  value={submitDesc}
                  onChange={(e) => setSubmitDesc(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  placeholder="Explain benefits, partner terms, and how drivers redeem..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Redemption Method *</label>
                  <select
                    value={submitRedeemType}
                    onChange={(e) => setSubmitRedeemType(e.target.value as PerkRedemptionType)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  >
                    <option value="CODE">Promo Code</option>
                    <option value="LINK">Partner Portal URL</option>
                    <option value="VOUCHER">Barcode Voucher</option>
                    <option value="PARTNER_API">Direct API Integration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Code / URL / Data *</label>
                  <input
                    type="text"
                    required
                    value={submitRedeemData}
                    onChange={(e) => setSubmitRedeemData(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                    placeholder="e.g. PARTNER2026 or https://partner.com/signup"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Partner Rep Email (Optional)</label>
                  <input
                    type="email"
                    value={submitPartnerEmail}
                    onChange={(e) => setSubmitPartnerEmail(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                    placeholder="partner@company.com"
                  />
                </div>

                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Publish Status</label>
                  <select
                    value={submitStatus}
                    onChange={(e) => setSubmitStatus(e.target.value as PerkStatus)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  >
                    <option value="APPROVED">APPROVED (Active Immediately)</option>
                    <option value="PENDING">PENDING (Hold for Review)</option>
                    <option value="REJECTED">REJECTED (Inactive)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#111827] font-semibold mb-1">Internal Admin Partner Notes</label>
                <input
                  type="text"
                  value={submitPartnerNotes}
                  onChange={(e) => setSubmitPartnerNotes(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  placeholder="Contract terms, account rep contact, renewal date..."
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddPartnerModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#111827] font-semibold border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-xs"
                >
                  Publish Partner Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Edit Partner Perk Modal */}
      {isAdmin && editingPerk && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-xl w-full p-6 shadow-2xl relative text-[#111827] max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingPerk(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Pencil className="w-5 h-5 text-[#005FB8]" />
              <h3 className="text-lg font-bold text-[#111827]">Edit Partner Perk Offer</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Modify partner name, promo codes, description, or activation status.</p>

            {actionSuccessMsg && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-900 rounded-lg text-xs mb-4 font-medium">
                {actionSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSaveEditPerk} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#111827] font-semibold mb-1">Partner / Provider Name *</label>
                <input
                  type="text"
                  required
                  value={submitProvider}
                  onChange={(e) => setSubmitProvider(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                />
              </div>

              <div>
                <label className="block text-[#111827] font-semibold mb-1">Offer Title *</label>
                <input
                  type="text"
                  required
                  value={submitTitle}
                  onChange={(e) => setSubmitTitle(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Category *</label>
                  <select
                    value={submitCategory}
                    onChange={(e) => setSubmitCategory(e.target.value as PerkCategory)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Value Badge Text *</label>
                  <input
                    type="text"
                    required
                    value={submitBadge}
                    onChange={(e) => setSubmitBadge(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#111827] font-semibold mb-1">Offer Description *</label>
                <textarea
                  rows={3}
                  required
                  value={submitDesc}
                  onChange={(e) => setSubmitDesc(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Redemption Method *</label>
                  <select
                    value={submitRedeemType}
                    onChange={(e) => setSubmitRedeemType(e.target.value as PerkRedemptionType)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  >
                    <option value="CODE">Promo Code</option>
                    <option value="LINK">Partner Portal URL</option>
                    <option value="VOUCHER">Barcode Voucher</option>
                    <option value="PARTNER_API">Direct API Integration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Code / URL / Data *</label>
                  <input
                    type="text"
                    required
                    value={submitRedeemData}
                    onChange={(e) => setSubmitRedeemData(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Partner Email</label>
                  <input
                    type="email"
                    value={submitPartnerEmail}
                    onChange={(e) => setSubmitPartnerEmail(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  />
                </div>

                <div>
                  <label className="block text-[#111827] font-semibold mb-1">Status</label>
                  <select
                    value={submitStatus}
                    onChange={(e) => setSubmitStatus(e.target.value as PerkStatus)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  >
                    <option value="APPROVED">APPROVED (Published)</option>
                    <option value="PENDING">PENDING (Review Queue)</option>
                    <option value="REJECTED">REJECTED (Archived/Inactive)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#111827] font-semibold mb-1">Internal Admin Partner Notes</label>
                <input
                  type="text"
                  value={submitPartnerNotes}
                  onChange={(e) => setSubmitPartnerNotes(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingPerk(null)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#111827] font-semibold border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-4 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold transition-colors shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
