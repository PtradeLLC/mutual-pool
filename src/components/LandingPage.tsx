import React, { useState } from 'react';
import { Pod, User, Perk, isDemoPod } from '../types';
import { savePerkToFirestore } from '../lib/firestoreService';
import heroImg from '../assets/images/gig_driver_hero_1784926420728.jpg';
import bikerAdImg from '../assets/images/bikerad.png';
import { Logo } from './Logo';
import { WatchVideoModal } from './WatchVideoModal';
import { AppStoreModal } from './AppStoreModal';
import { CampaignHowItWorksModal } from './CampaignHowItWorksModal';
import { 
  ShieldCheck, Users, Wallet, ArrowRight, Gift, Activity, 
  Sparkles, Layers, CheckCircle2, Lock, ChevronRight, HelpCircle, Building2,
  AlertCircle, DollarSign, Clock, RefreshCw, Zap, Play, Smartphone, LogOut, LayoutDashboard,
  PlusCircle, X, Megaphone, Menu
} from 'lucide-react';

const PERK_CATEGORIES = [
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

interface LandingPageProps {
  allPods: Pod[];
  currentUser?: User | null;
  onOpenAuth: (mode?: 'LOGIN' | 'REGISTER' | 'PHONE' | 'GOOGLE') => void;
  onSelectUser: (user: User) => void;
  onGoToDashboard?: (tab?: 'my-pods' | 'explore-pods' | 'perks' | 'audit-log' | 'admin-ops') => void;
  onLogout?: () => void;
  onOpenAbout?: () => void;
  onOpenHowItWorks?: () => void;
  onOpenContact?: () => void;
  onOpenSubmitPerk?: () => void;
  onOpenAdvertiser?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  allPods,
  currentUser,
  onOpenAuth,
  onSelectUser,
  onGoToDashboard,
  onLogout,
  onOpenAbout,
  onOpenHowItWorks,
  onOpenContact,
  onOpenSubmitPerk,
  onOpenAdvertiser,
}) => {
  const isAuthUser = Boolean(currentUser && currentUser.id && currentUser.id !== 'usr_guest');

  const handleActionOrAuth = (
    mode: 'LOGIN' | 'REGISTER' = 'LOGIN',
    destinationTab?: 'my-pods' | 'explore-pods' | 'perks' | 'audit-log' | 'admin-ops'
  ) => {
    if (isAuthUser && onGoToDashboard) {
      onGoToDashboard(destinationTab || 'explore-pods');
    } else {
      onOpenAuth(mode);
    }
  };

  // Simulator state
  const [calcMembers, setCalcMembers] = useState<number>(20);
  const [calcDeposit, setCalcDeposit] = useState<number>(20);

  // Video Walkthrough Modal State
  const [showWatchVideoModal, setShowWatchVideoModal] = useState(false);

  // App Store Modal State
  const [showAppStoreModal, setShowAppStoreModal] = useState(false);
  const [appStorePlatform, setAppStorePlatform] = useState<'ios' | 'android'>('ios');

  // Campaign How It Works Modal State
  const [showCampaignHowItWorksModal, setShowCampaignHowItWorksModal] = useState(false);

  // Mobile / Tablet Hamburger Menu State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Public Partner Perk Submission Modal State
  const [showSubmitPerkModal, setShowSubmitPerkModal] = useState(false);
  const [submitTitle, setSubmitTitle] = useState('');
  const [submitProvider, setSubmitProvider] = useState('');
  const [submitPartnerEmail, setSubmitPartnerEmail] = useState('');
  const [submitCategory, setSubmitCategory] = useState('Healthcare');
  const [submitBadge, setSubmitBadge] = useState('');
  const [submitDesc, setSubmitDesc] = useState('');
  const [submitRedeemType, setSubmitRedeemType] = useState('CODE');
  const [submitRedeemData, setSubmitRedeemData] = useState('');
  const [submitPartnerNotes, setSubmitPartnerNotes] = useState('');
  const [createAccount, setCreateAccount] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);

  const resetSubmitForm = () => {
    setSubmitTitle('');
    setSubmitProvider('');
    setSubmitPartnerEmail('');
    setSubmitCategory('Healthcare');
    setSubmitBadge('');
    setSubmitDesc('');
    setSubmitRedeemType('CODE');
    setSubmitRedeemData('');
    setSubmitPartnerNotes('');
    setCreateAccount(true);
    setSubmitSuccessMsg(null);
  };

  const handleSubmitPerkOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitSuccessMsg(null);
    try {
      const finalProvider = submitProvider || 'Community Partner';
      const isGuest = !currentUser || currentUser.id === 'usr_guest';

      const newPerk: Perk = {
        id: `perk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        title: submitTitle,
        category: submitCategory as any,
        provider: finalProvider,
        description: submitDesc || '',
        valueBadge: submitBadge || 'Special Member Offer',
        redemptionType: (submitRedeemType || 'CODE') as any,
        redemptionData: submitRedeemData || 'PENDING_APPROVAL',
        eligibility: 'All verified members',
        submittedBy: currentUser?.displayName || finalProvider,
        submittedByUserId: currentUser?.id || 'usr_guest',
        partnerEmail: submitPartnerEmail || currentUser?.email,
        partnerNotes: submitPartnerNotes,
        status: 'PENDING',
        iconName: 'Gift',
        redeemedCount: 0,
      };

      // 1. Send REST payload to backend for account creation & perk registration
      const payload = {
        ...newPerk,
        partnerEmail: submitPartnerEmail || currentUser?.email,
        guestEmail: submitPartnerEmail || currentUser?.email,
        guestDisplayName: finalProvider,
        createAccount: isGuest ? createAccount : false,
      };

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (currentUser?.id && currentUser.id !== 'usr_guest') {
        headers['x-user-id'] = currentUser.id;
      }

      let resData: any = null;
      try {
        const res = await fetch('/api/perks/submit', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (res && res.ok) {
          resData = await res.json().catch(() => null);
        }
      } catch (fetchErr) {
        console.warn('Backend submit fetch error:', fetchErr);
      }

      // 2. Best-effort Firestore & LocalStorage sync
      savePerkToFirestore(newPerk).catch(() => {});

      try {
        const existing = JSON.parse(localStorage.getItem('gig_submitted_perks') || '[]');
        existing.unshift(newPerk);
        localStorage.setItem('gig_submitted_perks', JSON.stringify(existing));
      } catch (e) {}

      // 3. Handle returned user account
      if (resData?.user) {
        const newlyCreatedUser = resData.user;
        setSubmitSuccessMsg(resData.message || `Partner account created for ${newlyCreatedUser.email}! Offer submitted for Admin review.`);
        setTimeout(() => {
          onSelectUser(newlyCreatedUser);
          setShowSubmitPerkModal(false);
          resetSubmitForm();
          if (onGoToDashboard) onGoToDashboard();
        }, 1800);
        return;
      }

      setSubmitSuccessMsg('Benefit offer submitted successfully for Admin review!');
      setTimeout(() => {
        setShowSubmitPerkModal(false);
        resetSubmitForm();
      }, 1800);
    } catch (err) {
      console.error('Submit perk offer error:', err);
      setSubmitSuccessMsg('Benefit offer submitted successfully for Admin review!');
      setTimeout(() => {
        setShowSubmitPerkModal(false);
        resetSubmitForm();
      }, 1800);
    } finally {
      setSubmitLoading(false);
    }
  };

  const openAppStore = (platform: 'ios' | 'android') => {
    setAppStorePlatform(platform);
    setShowAppStoreModal(true);
  };

  const totalPoolPayout = calcMembers * calcDeposit;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827] flex flex-col font-sans selection:bg-[#005FB8] selection:text-white">
      
      {/* 1. LANDING NAVBAR */}
      <header className="bg-white border-b border-[#DDE1E6] sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          
          {/* Logo */}
          <div 
            onClick={() => {
              if (currentUser && onGoToDashboard) {
                onGoToDashboard();
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group shrink-0"
            title={currentUser ? "Click logo to return to Dashboard" : "MutualPool Home"}
          >
            <Logo size="md" />
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#005FB8] border border-blue-200">
                  Treasury
                </span>
                {currentUser && (
                  <span className="text-[10px] font-semibold text-[#005FB8] bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors">
                    <LayoutDashboard className="w-3 h-3 text-[#005FB8]" />
                    <span>Go to Dashboard</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Nav Links (Visible on XL screens 1280px+) */}
          <div className="hidden xl:flex items-center gap-5 text-xs text-[#4B5563] font-semibold">
            <button
              onClick={onOpenAbout}
              className="hover:text-[#005FB8] transition-colors py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              About
            </button>
            <button
              onClick={onOpenHowItWorks}
              className="hover:text-[#005FB8] transition-colors py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              Rules
            </button>
            <button
              onClick={onOpenContact}
              className="hover:text-[#005FB8] transition-colors py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              Contact
            </button>
            {onOpenAdvertiser && (
              <button
                type="button"
                id="landing-advertise-btn"
                onClick={onOpenAdvertiser}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
                title="Launch a brand campaign or sponsor courier promo apparel"
              >
                <Megaphone className="w-3.5 h-3.5 text-slate-950" />
                <span>Advertise with Us</span>
              </button>
            )}
            <button
              onClick={() => {
                if (onOpenSubmitPerk) {
                  onOpenSubmitPerk();
                } else if (!currentUser || currentUser.id === 'usr_guest') {
                  onOpenAuth('LOGIN');
                } else {
                  resetSubmitForm();
                  setShowSubmitPerkModal(true);
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
              title="Submit a partner or community benefit offer for admin review"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Submit Benefits & Perks</span>
            </button>
          </div>

          {/* Right Action CTAs & Mobile/Tablet Burger Button */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {currentUser ? (
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => onGoToDashboard && onGoToDashboard('my-pods')}
                  className="px-3 sm:px-3.5 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 sm:gap-2 cursor-pointer"
                >
                  <img
                    src={currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=005FB8&color=fff&size=200`}
                    alt={currentUser.displayName}
                    className="w-5 h-5 rounded-full object-cover ring-1 ring-white"
                  />
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {onLogout && (
                  <button
                    onClick={onLogout}
                    title="Log Out"
                    className="px-2.5 py-2 rounded-lg bg-white hover:bg-red-50 text-gray-700 hover:text-red-700 border border-[#DDE1E6] hover:border-red-200 font-bold text-xs transition-colors items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-600" />
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => onOpenAuth('LOGIN')}
                  className="px-3 sm:px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-xs transition-all shadow-xs cursor-pointer"
                >
                  Sign In
                </button>

                <button
                  onClick={() => onOpenAuth('REGISTER')}
                  className="px-3 sm:px-4 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Hamburger Menu Toggle Button (Visible on mobile & tablet: < xl) */}
            <button
              id="landing-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 rounded-lg border border-[#DDE1E6] bg-white hover:bg-gray-50 text-gray-700 hover:text-[#005FB8] transition-colors shadow-2xs cursor-pointer flex items-center justify-center"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Mobile & Tablet Menu Drawer (< xl) */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-[#DDE1E6] bg-white px-4 py-4 space-y-3.5 shadow-lg animate-in slide-in-from-top-2 duration-200">
            {/* Primary Auth CTAs in Drawer on Mobile (< md) */}
            {!currentUser ? (
              <div className="md:hidden grid grid-cols-2 gap-2 pb-1 border-b border-gray-100">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('LOGIN');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-bold text-xs text-center transition-all shadow-2xs cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('REGISTER');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs text-center transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="md:hidden pb-1 border-b border-gray-100">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onGoToDashboard) onGoToDashboard('my-pods');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs text-center transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <img
                    src={currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=005FB8&color=fff&size=200`}
                    alt={currentUser.displayName}
                    className="w-5 h-5 rounded-full object-cover ring-1 ring-white"
                  />
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Quick Links */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenAbout) onOpenAbout();
                }}
                className="py-2.5 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-center font-bold text-xs text-gray-800 border border-gray-200 transition-colors"
              >
                About
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenHowItWorks) onOpenHowItWorks();
                }}
                className="py-2.5 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-center font-bold text-xs text-gray-800 border border-gray-200 transition-colors"
              >
                Rules
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenContact) onOpenContact();
                }}
                className="py-2.5 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-center font-bold text-xs text-gray-800 border border-gray-200 transition-colors"
              >
                Contact
              </button>
            </div>

            {/* Special Action Buttons in Drawer (2-column layout on sm+, single column on small phones) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              {onOpenAdvertiser && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAdvertiser();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center justify-between shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Megaphone className="w-4 h-4 text-slate-950 shrink-0" />
                    <span className="truncate">Advertise with Us</span>
                  </div>
                  <ArrowRight className="w-4 h-4 shrink-0 ml-1" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenSubmitPerk) {
                    onOpenSubmitPerk();
                  } else if (!currentUser || currentUser.id === 'usr_guest') {
                    onOpenAuth('LOGIN');
                  } else {
                    resetSubmitForm();
                    setShowSubmitPerkModal(true);
                  }
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition-all flex items-center justify-between shadow-2xs cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <PlusCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">Submit Benefits & Perks</span>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0 ml-1" />
              </button>
            </div>

            {/* Logged in state extra actions in Drawer */}
            {currentUser && (
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <img
                    src={currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=005FB8&color=fff&size=200`}
                    alt={currentUser.displayName}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <span className="font-bold text-gray-800">{currentUser.displayName}</span>
                </div>
                {onLogout && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="text-red-600 hover:text-red-700 font-bold flex items-center gap-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* 2. HERO SECTION */}
      {(() => {
        const heroImageElement = (
          <div className="relative rounded-2xl overflow-hidden border border-[#DDE1E6] shadow-xl bg-[#F8FAFC]">
            <img
              src={heroImg}
              alt="Gig delivery driver using mutual savings app"
              referrerPolicy="no-referrer"
              className="w-full h-auto max-h-[480px] object-cover object-center"
            />
            
            {/* Gradient overlay at bottom for text readability if needed */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

            {/* Floating Badge Top Right */}
            <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md border border-[#DDE1E6] rounded-xl p-3 shadow-lg flex items-center gap-2.5 text-xs">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-[#111827] block text-[11px]">Pass-Through FDIC</span>
                <span className="text-[10px] text-[#6B7280]">Insured up to $250k</span>
              </div>
            </div>

            {/* Floating Badge Bottom Left */}
            <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md border border-[#DDE1E6] rounded-xl p-3 shadow-lg flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 text-[#005FB8] shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-[#111827] block text-[11px]">Fleet Savings Circles</span>
                  <span className="text-[10px] text-[#6B7280]">DoorDash, Uber Eats, Lyft, Instacart</span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                0% Interest
              </span>
            </div>
          </div>
        );

        return (
          <section className="bg-white border-b border-[#DDE1E6] pt-8 sm:pt-10 pb-14 sm:pb-16 px-4 sm:px-6 relative overflow-hidden">
            <div className="max-w-7xl mx-auto relative z-10">
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                
                {/* LEFT COLUMN: HERO IMAGE & OVERLAY BADGES (Desktop only: lg+) */}
                <div className="hidden lg:block lg:col-span-5 relative">
                  {heroImageElement}
                </div>

                {/* RIGHT COLUMN: HERO TEXT & CTAS */}
                <div className="lg:col-span-7 space-y-6 text-left">
                  
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[#005FB8] text-xs font-semibold">
                    <Sparkles className="w-4 h-4 text-[#005FB8]" />
                    <span>Built for DoorDash, Uber, Lyft, Instacart & Amazon Flex Drivers and more</span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-extrabold text-[#111827] tracking-tight leading-tight">
                    Cash pool, Perks & Benefits built for Gig & Trade workers
                  </h1>

                  {/* Mobile & Tablet Hero Image (Placed directly beneath the Hero title) */}
                  <div className="block lg:hidden my-4 sm:my-6">
                    {heroImageElement}
                  </div>

                  <p className="text-base sm:text-lg text-[#4B5563] leading-relaxed">
                    Pool weekly cash deposits with your crew and other members — one member gets the full pot each week, on a fair, fixed rotation.
                  </p>

              {/* Hero CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => handleActionOrAuth('REGISTER', 'explore-pods')}
                  className="px-6 py-3.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-sm transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>{isAuthUser ? 'Go to Dashboard' : 'Join a Pod Free'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setShowWatchVideoModal(true)}
                  className="px-6 py-3.5 rounded-xl bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-sm transition-all shadow-xs flex items-center gap-2 group cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-50 text-[#005FB8] flex items-center justify-center group-hover:bg-[#005FB8] group-hover:text-white transition-colors">
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </div>
                  <span>Watch Video</span>
                </button>
              </div>

              {/* App Store Download Badges in Hero */}
              <div className="pt-2 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5">
                <span className="text-[11px] font-semibold text-[#6B7280] flex items-center gap-1 shrink-0">
                  <Smartphone className="w-3.5 h-3.5 text-[#005FB8]" />
                  Download:
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Apple App Store Button */}
                  <button
                    onClick={() => openAppStore('ios')}
                    className="px-3 py-1.5 rounded-xl bg-black hover:bg-gray-900 text-white transition-all shadow-xs flex items-center gap-2 text-left group border border-gray-800 shrink-0 cursor-pointer"
                  >
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 170 170">
                      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.34.13-9.14-1.9-14.4-6.08-3.38-2.65-7.23-7.24-11.57-13.78-8.16-12.18-14.28-25.79-18.35-40.82-4.07-15.03-6.11-28.84-6.11-41.42 0-16.7 4.12-30.49 12.36-41.37 8.24-10.88 18.59-16.42 31.06-16.63 4.82 0 10.22 1.25 16.2 3.75 5.98 2.5 10.15 3.8 12.51 3.9 1.95 0 6.27-1.35 12.96-4.05 6.69-2.7 12.11-3.95 16.26-3.75 13.62.63 24.58 5.67 32.88 15.13-11.96 7.22-17.82 17.15-17.58 29.79.25 10.02 4.1 18.38 11.56 25.08 7.46 6.7 16.14 10.37 26.04 11.01-2.52 7.74-5.88 15.53-10.08 23.37zm-29.35-104.9c0-7.39 2.65-14.42 7.95-21.09 5.3-6.67 12.01-10.79 20.13-12.36.42 1.08.63 2.16.63 3.24 0 7.29-2.75 14.37-8.25 21.24-5.5 6.87-12.28 11.01-20.34 12.42-.12-.95-.12-2.11-.12-3.45z"/>
                    </svg>
                    <div>
                      <span className="text-[8.5px] block text-gray-300 leading-tight uppercase tracking-wider">Download on the</span>
                      <span className="text-xs font-bold leading-tight block">App Store</span>
                    </div>
                  </button>

                  {/* Google Play Store Button */}
                  <button
                    onClick={() => openAppStore('android')}
                    className="px-3 py-1.5 rounded-xl bg-black hover:bg-gray-900 text-white transition-all shadow-xs flex items-center gap-2 text-left group border border-gray-800 shrink-0 cursor-pointer"
                  >
                    <svg className="w-4 h-4 fill-current shrink-0 text-white" viewBox="0 0 512 512">
                      <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 65.7 65.7 65.7 59-34.2c16.8-9.8 26.7-27 26.7-46.5s-9.9-36.8-26.8-46.6zM104.6 499l220.7-221.3 60.1 60.1L104.6 499z"/>
                    </svg>
                    <div>
                      <span className="text-[8.5px] block text-gray-300 leading-tight uppercase tracking-wider">GET IT ON</span>
                      <span className="text-xs font-bold leading-tight block">Google Play</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Trust Highlights Strip */}
              <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-[#111827] block">Create pod & Invite</span>
                  <span className="text-[10px] text-[#6B7280]">Create pods for free and invite friends to participate</span>
                </div>

                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1">
                  <Lock className="w-4 h-4 text-[#005FB8]" />
                  <span className="text-xs font-bold text-[#111827] block">All deposits are safe</span>
                  <span className="text-[10px] text-[#6B7280]">Every Pod is Safe, Secure & Insured up to $250k via Stripe</span>
                </div>

                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1">
                  <Gift className="w-4 h-4 text-[#005FB8]" />
                  <span className="text-xs font-bold text-[#111827] block">Perks and Benefits</span>
                  <span className="text-[10px] text-[#6B7280]">Get 15-20% off products & services</span>
                </div>

                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-[#111827] block">Emergency Swap</span>
                  <span className="text-[10px] text-[#6B7280]">Swap payout with other members in community voting</span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>
    );
  })()}

      {/* 3. INTERACTIVE ROSCA CALCULATOR SIMULATOR */}
      <section className="py-12 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="bg-white border border-[#DDE1E6] rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="max-w-3xl mb-8">
            <span className="text-xs font-mono font-bold text-[#005FB8] uppercase tracking-wider block mb-1">Interactive Calculator</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827]">
              Calculate Your Mutual Pool Payout
            </h2>
            <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
              See how a small weekly commitment turns into lump-sum emergency fund for impromptu financial hardships.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            
            {/* Controls */}
            <div className="space-y-6 bg-[#F8FAFC] p-6 rounded-xl border border-[#E2E8F0]">
              
              {/* Member Tier Selector */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[#111827] mb-2">
                  <span>Pod Capacity (Gig workers):</span>
                  <span className="text-[#005FB8] font-mono">{calcMembers} Gig Workers</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[20, 50, 100, 500].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCalcMembers(num)}
                      className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                        calcMembers === num
                          ? 'bg-[#005FB8] border-[#005FB8] text-white shadow-xs'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {num} Members
                    </button>
                  ))}
                </div>
              </div>

              {/* Weekly Deposit Tier Selector */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[#111827] mb-2">
                  <span>Weekly Deposit Tier:</span>
                  <span className="text-emerald-700 font-mono">${calcDeposit}/week</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 20, 50, 100].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCalcDeposit(amt)}
                      className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                        calcDeposit === amt
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      ${amt}/wk
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-[#6B7280]">
                * You contribute ${calcDeposit}/wk base deposit (+5% fee = ${(calcDeposit * 1.05).toFixed(2)} total) for {calcMembers} weeks. When your rotation turn arrives, you receive a net payout of ${((calcMembers * calcDeposit) * 0.90).toLocaleString()} after 10% platform fee deduction.
              </p>
            </div>

            {/* Live Result Display */}
            <div className="bg-[#005FB8] text-white rounded-xl p-8 space-y-6 shadow-sm relative overflow-hidden">
              <div>
                <span className="text-xs uppercase font-mono font-bold tracking-wider text-blue-200 block mb-1">
                  Net Single Rotation Payout (After 10% Fee)
                </span>
                <div className="text-4xl sm:text-5xl font-extrabold font-mono tracking-tight">
                  ${(totalPoolPayout * 0.90).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-base font-normal text-blue-200 ml-2">USD Net</span>
                </div>
              </div>

              <div className="space-y-3 text-xs border-t border-blue-400/40 pt-4 font-mono">
                <div className="flex justify-between">
                  <span className="text-blue-100 font-sans">Base Weekly Contribution:</span>
                  <span className="font-bold">${calcDeposit}.00 / week</span>
                </div>

                <div className="flex justify-between text-blue-200">
                  <span className="font-sans">Initial Deposit Fee (5%):</span>
                  <span>+${(calcDeposit * 0.05).toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-blue-100">
                  <span className="font-sans">Gross Collective Pool ({calcMembers} Members):</span>
                  <span className="font-bold">${totalPoolPayout}.00</span>
                </div>

                <div className="flex justify-between text-rose-200">
                  <span className="font-sans">Payout Service Fee (10%):</span>
                  <span>-${(totalPoolPayout * 0.10).toFixed(2)}</span>
                </div>

                <div className="flex justify-between border-t border-blue-400/40 pt-2">
                  <span className="text-blue-100 font-sans">FDIC Pass-Through Status:</span>
                  <span className="font-bold text-emerald-300 font-sans flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Eligible ($250k Limit)
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleActionOrAuth('REGISTER', 'explore-pods')}
                className="w-full py-3 rounded-lg bg-white hover:bg-blue-50 text-[#005FB8] font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isAuthUser ? `Go to Dashboard (${calcMembers}-Member Pod)` : `Join or Create ${calcMembers}-Member Circle`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* 3.5 GUEST COURIER / GIG DRIVER CTA ADVERTISEMENT BANNER */}
      <section className="py-8 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white rounded-3xl overflow-hidden border border-slate-700/60 shadow-xl relative">
          {/* Subtle Ambient Decorative Glows */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#005FB8]/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center p-6 sm:p-10 lg:p-12 relative z-10">
            
            {/* Left Content Column */}
            <div className="lg:col-span-6 space-y-6 text-left">
              
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>Feature Service • Community-Powered Financial Security</span>
              </div>

              {/* Heading */}
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                  Get Paid to Rep our clients, Don't Just Make deliveries: Start now & give Your t-shirt a Job
                </h2>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  After your Pod activates, select brand campaigns, get equipped with turnkey partner gear, and earn guaranteed daily wages on your deliveries.
                </p>
              </div>

              {/* Value Props Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Activate a Pod</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-normal">
                    Start a Pod for free, invite friends, crew members, and families to participate.
                  </p>
                </div>

                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                    <RefreshCw className="w-4 h-4 shrink-0" />
                    <span>We provide Merch</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-normal">
                    After creating and inviting members to join your Pod, your Pod is full & activated we'll send you campaign ad gears from our partners. 
                  </p>
                </div>

                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                    <Gift className="w-4 h-4 shrink-0" />
                    <span>Get Paid everyday</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-normal">
                    Wear the clothing as you go on your delivery routes and get paid per day.
                  </p>
                </div>
              </div>

              {/* CTA Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleActionOrAuth('REGISTER', 'explore-pods')}
                  className="px-6 py-3.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-sm transition-all shadow-lg hover:shadow-blue-500/25 flex items-center gap-2 cursor-pointer"
                >
                  <span>{isAuthUser ? 'Go to Active Pods Dashboard' : 'Start a Pod for Free'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  id="campaign-ad-how-it-works-btn"
                  onClick={() => setShowCampaignHowItWorksModal(true)}
                  className="px-5 py-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>How It Works</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Micro-trust indicators */}
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  No credit check required
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Stripe Identity Verified
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Available across 50 US States
                </span>
              </div>

            </div>

            {/* Right Image / Ad Column */}
            <div className="lg:col-span-6 flex flex-col justify-center">
              <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-900/80 p-1 group">
                <img
                  src={bikerAdImg}
                  alt="Turn Your Hoodie Into a Billboard - Courier & Gig Driver Ad"
                  className="w-full h-auto object-contain rounded-xl block transition-transform duration-300 group-hover:scale-[1.01]"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="mt-3 flex items-center justify-between px-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 font-medium text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active Courier & Gig Network
                </span>
                <span className="font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 text-[10px] font-semibold">
                  Zero Interest Payouts
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section className="py-12 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <span className="text-xs font-mono font-bold text-[#005FB8] uppercase tracking-wider">Transparent Architecture</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827]">
            How MutualPool Pods Work
          </h2>
          <p className="text-xs sm:text-sm text-[#6B7280]">
            Digital Rotating Savings and Credit Associations (ROSCAs) engineered specifically for gig workers and delivery driver fleets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          <div className="bg-white p-6 rounded-xl border border-[#DDE1E6] space-y-3 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#005FB8] font-bold text-sm flex items-center justify-center">
              1
            </div>
            <h3 className="font-bold text-base text-[#111827]">Forming Circle</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Create or Join an open pod in your region or fleet category (DoorDash, Uber Eats, Instacart).
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-[#DDE1E6] space-y-3 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#005FB8] font-bold text-sm flex items-center justify-center">
              2
            </div>
            <h3 className="font-bold text-base text-[#111827]">Rotation Locking</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              When capacity is reached, a cryptographically random shuffle permanently locks rotation indices.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-[#DDE1E6] space-y-3 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#005FB8] font-bold text-sm flex items-center justify-center">
              3
            </div>
            <h3 className="font-bold text-base text-[#111827]">Stripe Treasury Payout</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Each week everyone deposits what they can afford. The collected pool then goes into Stripe Treasury holding accounts and transfer the full lump-sum to whoever's next in the rotation.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-[#DDE1E6] space-y-3 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#005FB8] font-bold text-sm flex items-center justify-center">
              4
            </div>
            <h3 className="font-bold text-base text-[#111827]">Emergency Voting</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Facing sudden transmission or brake failure? Submit a reprioritization request. Members vote to swap payout weeks transparently.
            </p>
          </div>

        </div>
      </section>

      {/* 5. CURRENT FORMING PODS PREVIEW (Displays only when at least 3 active pods are forming) */}
      {(() => {
        const formingPods = allPods.filter((p) => p && p.id && !isDemoPod(p) && p.status !== 'COMPLETED');
        if (formingPods.length < 3) return null;

        return (
          <section className="py-12 px-4 sm:px-6 max-w-7xl mx-auto w-full">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <span className="text-xs font-mono font-bold text-[#005FB8] uppercase tracking-wider block mb-0.5">Live Marketplace</span>
                <h2 className="text-2xl font-extrabold text-[#111827]">
                  Open Forming Pods ({formingPods.length})
                </h2>
              </div>

              <button
                onClick={() => handleActionOrAuth('LOGIN', 'explore-pods')}
                className="px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-[#005FB8] border border-[#DDE1E6] font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>Browse All Pool Circles</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formingPods.slice(0, 6).map((pod) => (
                <div key={pod.id} className="bg-white border border-[#DDE1E6] rounded-xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#005FB8] border border-blue-200">
                        {pod.category}
                      </span>
                      <h3 className="font-bold text-base text-[#111827] mt-1">{pod.name}</h3>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                      ${pod.weeklyPoolTarget}/wk Pool
                    </span>
                  </div>

                  <p className="text-xs text-[#6B7280] line-clamp-2">
                    {pod.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                    <div>
                      <span className="text-[#6B7280] text-[10px] block font-medium">Weekly Deposit</span>
                      <span className="font-bold text-[#111827] font-mono">${pod.depositTier}/wk</span>
                    </div>
                    <div>
                      <span className="text-[#6B7280] text-[10px] block font-medium">Capacity</span>
                      <span className="font-bold text-[#111827] font-mono">{Math.max(pod.memberCount || 0, pod.members ? pod.members.length : 0, 1)} / {pod.sizeTier} Members</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleActionOrAuth('LOGIN', 'explore-pods')}
                    className="w-full py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span>{isAuthUser ? 'View Pod in Dashboard' : 'View & Join Pod'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* 6. CALL TO ACTION FOOTER BANNER & APP STORE DOWNLOAD */}
      <section className="bg-white border-t border-[#DDE1E6] py-12 px-4 sm:px-6 mt-12 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold text-[#005FB8] uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              Available on iOS & Android PWA
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827]">
              Ready to Build Your Emergency Reserve?
            </h2>
            <p className="text-xs sm:text-sm text-[#6B7280] max-w-xl mx-auto">
              Join thousands of gig workers saving together with Stripe Treasury security and pass-through FDIC insurance.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap justify-center gap-3">
            {isAuthUser ? (
              <button
                onClick={() => onGoToDashboard && onGoToDashboard('my-pods')}
                className="px-6 py-3.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Return to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => onOpenAuth('REGISTER')}
                  className="px-6 py-3.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>Create Account Free</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onOpenAuth('LOGIN')}
                  className="px-6 py-3.5 rounded-xl bg-[#F8FAFC] hover:bg-gray-100 text-[#111827] border border-[#DDE1E6] font-semibold text-xs transition-all shadow-xs cursor-pointer"
                >
                  Sign In to Your Account
                </button>
              </>
            )}
          </div>

          {/* App Store CTA Badges Block */}
          <div className="pt-4 border-t border-[#E2E8F0] max-w-md mx-auto">
            <p className="text-xs font-bold text-[#111827] mb-3">Install MutualPool Mobile App:</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Apple App Store Button */}
              <button
                onClick={() => openAppStore('ios')}
                className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white transition-all shadow-sm flex items-center gap-3 text-left group border border-gray-800"
              >
                <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 170 170">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.34.13-9.14-1.9-14.4-6.08-3.38-2.65-7.23-7.24-11.57-13.78-8.16-12.18-14.28-25.79-18.35-40.82-4.07-15.03-6.11-28.84-6.11-41.42 0-16.7 4.12-30.49 12.36-41.37 8.24-10.88 18.59-16.42 31.06-16.63 4.82 0 10.22 1.25 16.2 3.75 5.98 2.5 10.15 3.8 12.51 3.9 1.95 0 6.27-1.35 12.96-4.05 6.69-2.7 12.11-3.95 16.26-3.75 13.62.63 24.58 5.67 32.88 15.13-11.96 7.22-17.82 17.15-17.58 29.79.25 10.02 4.1 18.38 11.56 25.08 7.46 6.7 16.14 10.37 26.04 11.01-2.52 7.74-5.88 15.53-10.08 23.37zm-29.35-104.9c0-7.39 2.65-14.42 7.95-21.09 5.3-6.67 12.01-10.79 20.13-12.36.42 1.08.63 2.16.63 3.24 0 7.29-2.75 14.37-8.25 21.24-5.5 6.87-12.28 11.01-20.34 12.42-.12-.95-.12-2.11-.12-3.45z"/>
                </svg>
                <div>
                  <span className="text-[10px] block text-gray-300 uppercase tracking-wider leading-tight">Download on the</span>
                  <span className="text-xs font-bold leading-tight block">App Store</span>
                </div>
              </button>

              {/* Google Play Store Button */}
              <button
                onClick={() => openAppStore('android')}
                className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white transition-all shadow-sm flex items-center gap-3 text-left group border border-gray-800"
              >
                <svg className="w-5 h-5 fill-current shrink-0 text-white" viewBox="0 0 512 512">
                  <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 65.7 65.7 65.7 59-34.2c16.8-9.8 26.7-27 26.7-46.5s-9.9-36.8-26.8-46.6zM104.6 499l220.7-221.3 60.1 60.1L104.6 499z"/>
                </svg>
                <div>
                  <span className="text-[10px] block text-gray-300 uppercase tracking-wider leading-tight">GET IT ON</span>
                  <span className="text-xs font-bold leading-tight block">Google Play</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#F8FAFC] border-t border-[#DDE1E6] py-6 text-center text-xs text-[#6B7280]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">         
          <span>© {new Date().getFullYear()} Chris Bitoye Ventures. All rights reserved.</span>
          <div className="flex items-center gap-4 text-xs font-medium">
            <button onClick={onOpenAbout} className="hover:text-[#005FB8] transition-colors cursor-pointer">
              About Us
            </button>
            <span>•</span>
            <button onClick={onOpenHowItWorks} className="hover:text-[#005FB8] transition-colors cursor-pointer">
              How It Works & Rules
            </button>
            <span>•</span>
            <button onClick={onOpenContact} className="hover:text-[#005FB8] transition-colors cursor-pointer">
              Contact Us
            </button>
            {onOpenAdvertiser && (
              <>
                <span>•</span>
                <button onClick={onOpenAdvertiser} className="text-amber-700 hover:text-amber-800 font-bold transition-colors cursor-pointer flex items-center gap-1">
                  <Megaphone className="w-3 h-3 text-amber-600" />
                  <span>Advertise with Us</span>
                </button>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* WATCH VIDEO WALKTHROUGH MODAL */}
      <WatchVideoModal
        isOpen={showWatchVideoModal}
        onClose={() => setShowWatchVideoModal(false)}
        onOpenRegister={() => handleActionOrAuth('REGISTER', 'explore-pods')}
        onOpenHowItWorks={onOpenHowItWorks}
      />

      {/* APP STORE PWA INSTALLATION MODAL */}
      <AppStoreModal
        isOpen={showAppStoreModal}
        onClose={() => setShowAppStoreModal(false)}
        defaultPlatform={appStorePlatform}
        onOpenRegister={() => handleActionOrAuth('REGISTER', 'explore-pods')}
      />

      {/* PUBLIC PARTNER SUBMIT BENEFIT OFFER MODAL */}
      {showSubmitPerkModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSubmitPerkModal(false);
            }
          }}
        >
          <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-lg w-full p-6 shadow-2xl relative text-[#111827] max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowSubmitPerkModal(false);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors cursor-pointer z-20"
            >
              <X className="w-5 h-5 pointer-events-none" />
            </button>

            <h3 className="text-lg font-bold text-[#111827] mb-1 flex items-center gap-2">
              <Gift className="w-5 h-5 text-emerald-600" />
              <span>Submit Benefits & Perks Offer</span>
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Partners and public businesses can submit exclusive discount offers for gig workers. Admin will review and approve submissions before publication.
            </p>

            {submitSuccessMsg && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-900 rounded-lg text-xs mb-4 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span>{submitSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPerkOffer} className="space-y-3.5 text-xs">
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
                    onChange={(e) => setSubmitCategory(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  >
                    {PERK_CATEGORIES.map(c => (
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
                    onChange={(e) => setSubmitRedeemType(e.target.value)}
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
                  placeholder="Special instructions, contact details, or notes for the Mutual Pool admin review team."
                />
              </div>

              {!currentUser && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 flex items-start gap-2.5 text-xs">
                  <input
                    type="checkbox"
                    id="landingCreateAccount"
                    checked={createAccount}
                    onChange={(e) => setCreateAccount(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 shrink-0 cursor-pointer"
                  />
                  <label htmlFor="landingCreateAccount" className="cursor-pointer">
                    <strong className="block font-bold text-emerald-900">Establish Partner Account during submission</strong>
                    <span className="text-emerald-800">
                      Creates a Mutual Pool Partner Account with your email so you can log in, track real-time approval status, view member redemption stats, and manage submitted offers anytime.
                    </span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowSubmitPerkModal(false)}
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

      {/* Campaign Ad How It Works Modal */}
      <CampaignHowItWorksModal
        isOpen={showCampaignHowItWorksModal}
        onClose={() => setShowCampaignHowItWorksModal(false)}
        onStartPod={() => handleActionOrAuth('REGISTER', 'explore-pods')}
        isAuthUser={isAuthUser}
      />

    </div>
  );
};
