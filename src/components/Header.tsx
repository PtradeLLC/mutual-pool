import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Pod, UserRole, isAdminUser, isAdvertiserUser, isCourierUser, isAdvertiserOrAdmin } from '../types';
import { Logo } from './Logo';
import { NotificationCenter } from './NotificationCenter';
import { LanguageSelector } from './LanguageSelector';
import { CountrySelector } from './CountrySelector';
import { useTranslation } from '../i18n';
import { useChat } from '../context/ChatContext';
import { 
  Users, Gift, ShieldCheck, Building2, Download, LogOut,
  ChevronDown, Layers, Activity, AlertCircle, Lock, Wallet, Sparkles, RefreshCw, Home, PlusCircle, ExternalLink, Zap,
  Megaphone, Shirt, BarChart3, MessageSquare, ChevronLeft, ChevronRight, Menu, X, Globe, UserCheck
} from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  allUsers: User[];
  myPods?: Pod[];
  activeTab: 'my-pods' | 'explore-pods' | 'perks' | 'campaigns' | 'audit-log' | 'admin-ops';
  setActiveTab: (tab: 'my-pods' | 'explore-pods' | 'perks' | 'campaigns' | 'audit-log' | 'admin-ops') => void;
  onLogoClick?: () => void;
  onOpenBankModal: () => void;
  onOpenEditProfile?: () => void;
  onOpenSubmitPerk?: () => void;
  onOpenAdvertiser?: (tab?: 'metrics' | 'media-kit') => void;
  onInstallPWA?: () => void;
  canInstallPWA?: boolean;
  onExitToLanding?: () => void;
  onOpenAbout?: () => void;
  onOpenHowItWorks?: () => void;
  onOpenFaq?: () => void;
  onOpenContact?: () => void;
  onLogout?: () => void;
  onOpenKycModal?: () => void;
  hasWelcomeMatch?: boolean;
  onOpenHardshipModal?: (initialTab?: 'hardship' | 'trade') => void;
  onOpenPodDetail?: (podId: string) => void;
  onSwitchRole?: (role: UserRole) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  myPods = [],
  activeTab,
  setActiveTab,
  onLogoClick,
  onOpenBankModal,
  onOpenEditProfile,
  onOpenSubmitPerk,
  onOpenAdvertiser,
  onInstallPWA,
  canInstallPWA,
  onExitToLanding,
  onOpenAbout,
  onOpenHowItWorks,
  onOpenFaq,
  onOpenContact,
  onLogout,
  onOpenKycModal,
  hasWelcomeMatch,
  onOpenHardshipModal,
  onOpenPodDetail,
  onSwitchRole,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);
  const { openChat, totalUnreadCount, isConnected } = useChat();

  // Role-Based Access Control: Admin vs Advertiser vs Courier
  const isAdmin = isAdminUser(currentUser);
  const isAdvertiser = isAdvertiserUser(currentUser);
  const isCourier = isCourierUser(currentUser);

  // Horizontal sub-nav tabs scrolling state and ref
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = tabsContainerRef.current;
    if (el) {
      const hasOverflow = el.scrollWidth > el.clientWidth + 1;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    const el = tabsContainerRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
      // Recheck after fonts and layout settle
      const timer = setTimeout(checkScroll, 120);
      return () => {
        clearTimeout(timer);
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [checkScroll, activeTab]);

  // Keep active tab in view inside the scrollable container
  useEffect(() => {
    const el = tabsContainerRef.current;
    if (el) {
      const activeBtn = el.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement | null;
      if (activeBtn) {
        const containerRect = el.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        if (btnRect.left < containerRect.left || btnRect.right > containerRect.right) {
          activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }
  }, [activeTab]);

  // Lock body scroll when mobile menu drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const scrollTabs = (direction: 'left' | 'right') => {
    const el = tabsContainerRef.current;
    if (el) {
      const amount = direction === 'left' ? -220 : 220;
      el.scrollBy({ left: amount, behavior: 'smooth' });
      setTimeout(checkScroll, 250);
    }
  };

  // Primary navigation tabs list: strictly role-based!
  // User with role 'Admin' accesses all features.
  // User with role 'Advertiser' only accesses advertising content.
  const primaryTabsList: Array<{
    id: HeaderProps['activeTab'];
    label: string;
    icon: React.FC<{ className?: string }>;
    description: string;
    badge?: string | number;
  }> = isAdvertiser
    ? [
        {
          id: 'campaigns',
          label: 'Campaigns & Gear Studio',
          icon: Shirt,
          description: 'Brand apparel sponsorships & Fourthwall custom gear studio',
        },
      ]
    : [
        { id: 'my-pods', label: t('dash.myPods'), icon: Layers, description: 'Your savings circles & scheduled payouts', badge: myPods.length > 0 ? myPods.length : undefined },
        { id: 'explore-pods', label: t('dash.explorePods'), icon: Users, description: 'Find & join community savings pods' },
        { id: 'perks', label: t('dash.perks'), icon: Gift, description: 'Discounts, fuel, maintenance & health perks' },
        { id: 'campaigns', label: t('dash.campaigns'), icon: Shirt, description: 'Courier apparel campaigns & brand payouts' },
        { id: 'audit-log', label: t('dash.auditLog'), icon: Activity, description: 'Immutable transparent audit ledger' },
        ...(isAdmin ? [{ id: 'admin-ops' as const, label: t('dash.adminOps'), icon: Lock, description: 'Platform administration & emergency operations' }] : []),
      ];

  const currentTabIndex = primaryTabsList.findIndex((tab) => tab.id === activeTab);
  const activeTabInfo = primaryTabsList[currentTabIndex >= 0 ? currentTabIndex : 0];
  const ActiveTabIcon = activeTabInfo?.icon || Layers;

  const handleStepTab = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentTabIndex - 1 : currentTabIndex + 1;
    if (newIndex >= 0 && newIndex < primaryTabsList.length) {
      setActiveTab(primaryTabsList[newIndex].id);
    }
  };

  return (
    <header className="bg-white border-b border-[#DDE1E6] sticky top-0 z-50 shadow-xs max-w-full overflow-visible">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3 w-full">
        <div className="flex items-center justify-between gap-1.5 sm:gap-4 w-full min-w-0">
          
          {/* Brand Logo & Name */}
          <div 
            onClick={() => {
              if (onLogoClick) {
                onLogoClick();
              } else {
                setActiveTab(isAdvertiser ? 'campaigns' : 'my-pods');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group shrink-0 min-w-0"
            title="MutualPool Dashboard"
          >
            <Logo size="md" />
          </div>

          {/* User Status Bar & Switcher */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">

            {/* Country & Currency Selector - Hidden on mobile (< md), fully featured in Mobile Drawer */}
            <div className="hidden md:block">
              <CountrySelector />
            </div>

            {/* Language Selector - Hidden on mobile (< md), fully featured in Mobile Drawer */}
            <div className="hidden md:block">
              <LanguageSelector />
            </div>

            {/* PWA Install Button */}
            {canInstallPWA && onInstallPWA && (
              <button
                onClick={onInstallPWA}
                className="hidden md:flex px-2.5 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs shadow-xs items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install PWA App</span>
              </button>
            )}

            {/* Treasury Balance Pill or Brand Escrow Pill based on Role */}
            {isAdvertiser ? (
              <button
                type="button"
                onClick={() => onOpenAdvertiser && onOpenAdvertiser('metrics')}
                title="Brand Advertising Escrow & Campaign Analytics — Click to view Portal"
                className="hidden lg:flex items-center gap-2 bg-[#F8FAFC] hover:bg-amber-50/80 px-3 py-1.5 rounded-lg border border-[#DDE1E6] hover:border-amber-300 text-xs transition-all cursor-pointer group"
              >
                <Megaphone className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <span className="text-[#6B7280] group-hover:text-amber-800 text-[10px] uppercase font-bold block leading-none">Brand Ad Escrow</span>
                  <span className="font-bold text-[#111827] font-mono">
                    $12,500.00 <span className="text-[10px] font-normal text-[#6B7280]">USD</span>
                  </span>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenBankModal}
                title="Click to view Stripe Treasury Account & Add Test Funds"
                className="hidden lg:flex items-center gap-2 bg-[#F8FAFC] hover:bg-emerald-50/80 px-3 py-1.5 rounded-lg border border-[#DDE1E6] hover:border-emerald-300 text-xs transition-all cursor-pointer group"
              >
                <Wallet className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <span className="text-[#6B7280] group-hover:text-emerald-800 text-[10px] uppercase font-bold block leading-none">{t('header.stripeTreasuryBalance')}</span>
                  <span className="font-bold text-[#111827] font-mono">
                    ${currentUser.treasury?.balanceUsd ? currentUser.treasury.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'} <span className="text-[10px] font-normal text-[#6B7280]">USD</span>
                  </span>
                </div>
              </button>
            )}

            {/* Verified Status Badge or KYC Verification Prompt */}
            {isAdvertiser ? (
              <div
                className="hidden lg:flex px-3 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-900 text-xs font-bold items-center gap-1.5 shadow-xs"
                title="Verified Brand Partner & Campaign Sponsor"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="font-extrabold text-[11px] uppercase tracking-wide">Brand Advertiser</span>
              </div>
            ) : currentUser.kycStatus === 'VERIFIED' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open('https://dashboard.stripe.com/test/identity', '_blank', 'noopener,noreferrer');
                  if (onOpenKycModal) onOpenKycModal();
                }}
                className="hidden lg:flex px-3 py-1 rounded-full border border-green-200 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Verified via Stripe Identity — Click to view in Stripe Dashboard & Verification Details"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-bold text-[11px] uppercase tracking-wide">{t('dash.verifiedMember')}</span>
                <ExternalLink className="w-3 h-3 text-green-600 ml-0.5 shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenKycModal}
                className="hidden lg:flex px-3 py-1 rounded-full border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Click to complete Stripe Identity KYC verification"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="font-extrabold text-[11px] uppercase tracking-wide">{t('dash.verifyIdentityKyc')}</span>
              </button>
            )}

            {/* In-App Notifications Center */}
            <NotificationCenter
              currentUser={currentUser}
              myPods={myPods}
              onOpenHardshipModal={onOpenHardshipModal}
              onOpenPodDetail={onOpenPodDetail}
            />

            {/* In-App Real-Time Chat Trigger */}
            <button
              id="header-chat-trigger-btn"
              type="button"
              onClick={openChat}
              className="relative p-2 rounded-lg bg-white hover:bg-gray-50 border border-[#DDE1E6] text-gray-700 hover:text-blue-600 transition-colors shadow-xs"
              title="Fleet & Pod In-App Chat"
              aria-label="Open In-App Chat"
            >
              <MessageSquare className="w-4 h-4" />
              {/* Online connection dot */}
              <span
                className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white ${
                  isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {/* Unread badge count */}
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white font-extrabold text-[10px] flex items-center justify-center shadow-xs">
                  {totalUnreadCount}
                </span>
              )}
            </button>

            {/* User Switcher Dropdown */}
            <div className="relative z-50" ref={userDropdownRef}>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="bg-white hover:bg-gray-50 border border-[#DDE1E6] rounded-lg p-1.5 sm:px-2.5 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 transition-colors text-left shadow-xs cursor-pointer"
                title={currentUser.displayName}
                aria-label="User account menu"
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                  alt={currentUser.displayName}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-gray-300"
                />
                <div className="hidden sm:block text-xs sm:text-sm">
                  <span className="font-bold text-[#111827] block leading-tight">{currentUser.displayName}</span>
                  <span className="text-[11px] sm:text-xs text-[#6B7280]">{currentUser.platform} ({currentUser.role})</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#6B7280]" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-[#DDE1E6] rounded-xl shadow-2xl p-2.5 z-[100] divide-y divide-[#DDE1E6]">
                  {/* Account / Profile Quick Action */}
                  <div className="pb-2.5">
                    <div className="px-3 py-2.5 mb-2 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <p className="text-sm font-bold text-[#111827] truncate">{currentUser.displayName}</p>
                        {isAdmin ? (
                          <span className="text-[9px] font-black uppercase bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full border border-purple-200 shrink-0">
                            Admin (All)
                          </span>
                        ) : isAdvertiser ? (
                          <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                            Advertiser (Ads)
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase bg-blue-100 text-blue-900 px-2 py-0.5 rounded-full border border-blue-200 shrink-0">
                            Courier
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6B7280] truncate">{currentUser.email || `${currentUser.platform} Member`}</p>
                    </div>

                    {/* Quick Demo Role Switcher to effortlessly verify role-based permissions */}
                    {onSwitchRole && (
                      <div className="p-2 mb-2 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          <span>Role-Based Access (RBAC):</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              onSwitchRole('Admin');
                              setShowUserDropdown(false);
                            }}
                            className={`py-1.5 px-1 text-[10px] font-extrabold rounded-md transition-all text-center cursor-pointer ${
                              isAdmin
                                ? 'bg-purple-600 text-white shadow-2xs'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                            title="Admin: Access all features across the platform"
                          >
                            Admin (All)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSwitchRole('ADVERTISER');
                              setShowUserDropdown(false);
                            }}
                            className={`py-1.5 px-1 text-[10px] font-extrabold rounded-md transition-all text-center cursor-pointer ${
                              isAdvertiser
                                ? 'bg-amber-500 text-slate-950 shadow-2xs font-black'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                            title="Advertiser: Only see and access advertising content"
                          >
                            Advertiser
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSwitchRole('RIDER');
                              setShowUserDropdown(false);
                            }}
                            className={`py-1.5 px-1 text-[10px] font-extrabold rounded-md transition-all text-center cursor-pointer ${
                              isCourier
                                ? 'bg-[#005FB8] text-white shadow-2xs'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                            title="Courier/Rider: Mutual pods & perks"
                          >
                            Courier
                          </button>
                        </div>
                      </div>
                    )}

                    {onOpenEditProfile && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenEditProfile();
                        }}
                        className="w-full text-left p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#005FB8] font-bold text-xs sm:text-sm flex items-center justify-between transition-colors border border-blue-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=005FB8&color=fff&size=200`}
                            alt={currentUser.displayName}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span>{t('header.editProfile')}</span>
                        </div>
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Navigation & Logout Section - Strictly Role Gated */}
                  <div className="pt-2 space-y-1">
                    {/* Admin: Show Admin Ops & Advertiser Portal */}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          setActiveTab('admin-ops');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full text-left p-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs flex items-center justify-between transition-colors border border-purple-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-purple-600" />
                          <span>Admin Operations Console</span>
                        </div>
                        <span className="text-[10px] bg-purple-200/80 px-1.5 py-0.5 rounded text-purple-900 font-bold uppercase">All Ops</span>
                      </button>
                    )}

                    {/* Advertiser & Admin: Show Advertiser Portal & Media Kit */}
                    {(isAdvertiser || isAdmin) && onOpenAdvertiser && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenAdvertiser('metrics');
                        }}
                        className="w-full text-left p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs flex items-center justify-between transition-colors border border-amber-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-amber-600" />
                          <span>{t('header.advertiserPortal')}</span>
                        </div>
                        <span className="text-[10px] bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900 font-bold uppercase">{t('header.portal')}</span>
                      </button>
                    )}

                    {/* Media Kit access */}
                    {onOpenAdvertiser && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenAdvertiser('media-kit');
                        }}
                        className="w-full text-left p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#005FB8] font-bold text-xs flex items-center justify-between transition-colors border border-blue-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Megaphone className="w-4 h-4 text-[#005FB8]" />
                          <span>{t('header.mediaKit')}</span>
                        </div>
                        <span className="text-[10px] bg-blue-200/80 px-1.5 py-0.5 rounded text-blue-900 font-bold uppercase">{t('header.mediaKitBadge')}</span>
                      </button>
                    )}

                    {onExitToLanding && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onExitToLanding();
                        }}
                        className="w-full text-left p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-[#111827] font-semibold text-xs flex items-center gap-2 transition-colors border border-gray-200 cursor-pointer"
                      >
                        <Home className="w-4 h-4 text-[#005FB8]" />
                        <span>{t('header.returnToLanding')}</span>
                      </button>
                    )}

                    {/* Quick Access Info Links (accessible on mobile/tablet) */}
                    <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-1 text-[11px] text-[#4B5563]">
                      {onOpenAbout && (
                        <button
                          onClick={() => { setShowUserDropdown(false); onOpenAbout(); }}
                          className="text-left px-2 py-1 rounded hover:bg-gray-100 hover:text-[#005FB8] font-medium"
                        >
                          {t('nav.about')}
                        </button>
                      )}
                      {onOpenHowItWorks && (
                        <button
                          onClick={() => { setShowUserDropdown(false); onOpenHowItWorks(); }}
                          className="text-left px-2 py-1 rounded hover:bg-gray-100 hover:text-[#005FB8] font-medium"
                        >
                          {t('nav.rules')}
                        </button>
                      )}
                      {onOpenFaq && (
                        <button
                          onClick={() => { setShowUserDropdown(false); onOpenFaq(); }}
                          className="text-left px-2 py-1 rounded hover:bg-gray-100 hover:text-[#005FB8] font-bold text-[#005FB8]"
                        >
                          {t('nav.faq')}
                        </button>
                      )}
                      {onOpenContact && (
                        <button
                          onClick={() => { setShowUserDropdown(false); onOpenContact(); }}
                          className="text-left px-2 py-1 rounded hover:bg-gray-100 hover:text-[#005FB8] font-medium"
                        >
                          {t('nav.contact')}
                        </button>
                      )}
                    </div>

                    {/* Mobile Country & Language Shortcut */}
                    <div className="md:hidden pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserDropdown(false);
                          setMobileMenuOpen(true);
                        }}
                        className="w-full text-left p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold text-xs flex items-center justify-between border border-gray-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-[#005FB8]" />
                          <span>Region & Language</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </div>

                    {onLogout && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onLogout();
                        }}
                        className="w-full text-left p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center justify-between transition-colors border border-red-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <LogOut className="w-4 h-4 text-red-600" />
                          <span>{t('nav.logout')}</span>
                        </div>
                        <span className="text-[10px] text-red-500 font-normal">{t('header.endSession')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Menu Button in Top Row */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-[#DDE1E6] text-gray-700 hover:text-[#005FB8] transition-colors shadow-2xs cursor-pointer"
              aria-label={t('nav.openMenu')}
              title={t('nav.openMenu')}
            >
              <Menu className="w-4 h-4" />
            </button>

          </div>

        </div>

        {/* ----------------------------------------------------------------- */}
        {/* MOBILE NAVIGATION BAR (md:hidden)                                 */}
        {/* Transforms navbar menu into a sleek Burger Menu + Stepper Arrows  */}
        {/* ----------------------------------------------------------------- */}
        <div className="md:hidden flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[#DDE1E6]">
          {/* Burger Menu Trigger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex-1 flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-[#DDE1E6] text-[#111827] shadow-2xs transition-all cursor-pointer group"
            aria-label={t('nav.openMenu')}
            aria-expanded={mobileMenuOpen}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#005FB8] group-hover:bg-[#005FB8] group-hover:text-white transition-colors shrink-0">
                <Menu className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5 leading-none mb-1">
                  <span className="text-xs font-bold text-gray-900 tracking-tight">{t('nav.menu')}</span>
                  <span className="text-[10px] font-medium text-gray-400">• Tap to browse</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#005FB8] leading-none truncate">
                  <ActiveTabIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{activeTabInfo?.label}</span>
                  {activeTabInfo?.badge !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 font-bold">
                      {activeTabInfo.badge}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-gray-400 group-hover:text-gray-600 shrink-0">
              <span className="text-xs font-medium">All</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </button>

          {/* Quick Tab Stepping Left/Right Arrows on Mobile */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleStepTab('prev')}
              disabled={currentTabIndex <= 0}
              aria-label={t('nav.scrollLeft')}
              title="Previous tab"
              className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
                currentTabIndex > 0
                  ? 'bg-white hover:bg-blue-50 text-gray-700 hover:text-[#005FB8] border-gray-300 shadow-2xs cursor-pointer active:scale-95'
                  : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed opacity-40'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleStepTab('next')}
              disabled={currentTabIndex >= primaryTabsList.length - 1}
              aria-label={t('nav.scrollRight')}
              title="Next tab"
              className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
                currentTabIndex < primaryTabsList.length - 1
                  ? 'bg-white hover:bg-blue-50 text-gray-700 hover:text-[#005FB8] border-gray-300 shadow-2xs cursor-pointer active:scale-95'
                  : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed opacity-40'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* DESKTOP & TABLET NAVIGATION TABS BAR (hidden md:flex)              */}
        {/* Equipped with Left & Right Arrows for smooth scrolling            */}
        {/* ----------------------------------------------------------------- */}
        <nav className="hidden md:flex w-full min-w-0 items-center justify-between gap-1.5 sm:gap-2 mt-2 pt-2 border-t border-[#DDE1E6]">
          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={() => scrollTabs('left')}
            disabled={!canScrollLeft}
            aria-label={t('nav.scrollLeft')}
            title={t('nav.scrollLeft')}
            className={`p-1.5 sm:p-2 rounded-lg border transition-all shrink-0 flex items-center justify-center ${
              canScrollLeft
                ? 'bg-white hover:bg-blue-50 text-gray-700 hover:text-[#005FB8] border-gray-300 shadow-xs cursor-pointer active:scale-95'
                : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed opacity-40'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Scrollable Tabs Wrapper with subtle edge gradient masks */}
          <div className="relative min-w-0 flex-1 overflow-hidden">
            {canScrollLeft && (
              <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
            )}

            <div
              ref={tabsContainerRef}
              onScroll={checkScroll}
              onWheel={(e) => {
                if (e.deltaY !== 0 && tabsContainerRef.current) {
                  tabsContainerRef.current.scrollLeft += e.deltaY;
                }
              }}
              className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none py-1 scroll-smooth"
            >
              {/* Dynamically render tabs from role-gated primaryTabsList */}
              {primaryTabsList.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                const isSpecialAdmin = tab.id === 'admin-ops';

                return (
                  <button
                    key={tab.id}
                    data-tab={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? isSpecialAdmin
                          ? 'bg-purple-700 text-white font-bold shadow-xs'
                          : 'bg-[#005FB8] text-white font-bold shadow-xs'
                        : isSpecialAdmin
                          ? 'text-purple-800 bg-purple-50 hover:bg-purple-100 font-bold'
                          : 'text-[#4B5563] hover:bg-gray-100'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* If Courier or Admin: show Submit Perk shortcut */}
              {!isAdvertiser && (
                <button
                  onClick={onOpenSubmitPerk || (() => setActiveTab('perks'))}
                  className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-2xs cursor-pointer"
                  title="Submit a partner or community perk offer for admin review"
                >
                  <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                  <span>{t('nav.submitPerksShort')}</span>
                </button>
              )}

              {/* If Advertiser: show direct shortcuts to Portal & Media Kit */}
              {isAdvertiser && onOpenAdvertiser && (
                <>
                  <button
                    type="button"
                    onClick={() => onOpenAdvertiser('metrics')}
                    className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-2xs cursor-pointer"
                    title="Open Advertiser Performance Metrics Portal"
                  >
                    <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                    <span>Advertiser Portal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAdvertiser('media-kit')}
                    className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-2xs cursor-pointer"
                    title="View Media Kit & Rate Card"
                  >
                    <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#005FB8]" />
                    <span>Media Kit</span>
                  </button>
                </>
              )}
            </div>

            {canScrollRight && (
              <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
            )}
          </div>

          {/* Right Arrow Button */}
          <button
            type="button"
            onClick={() => scrollTabs('right')}
            disabled={!canScrollRight}
            aria-label={t('nav.scrollRight')}
            title={t('nav.scrollRight')}
            className={`p-1.5 sm:p-2 rounded-lg border transition-all shrink-0 flex items-center justify-center ${
              canScrollRight
                ? 'bg-white hover:bg-blue-50 text-gray-700 hover:text-[#005FB8] border-gray-300 shadow-xs cursor-pointer active:scale-95'
                : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed opacity-40'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Quick Info Modal Links (Shown on desktop xl+ screens) */}
          <div className="hidden xl:flex items-center gap-2 2xl:gap-3 text-xs sm:text-sm text-[#4B5563] shrink-0 font-medium pl-3 border-l border-[#DDE1E6]">
            <button
              onClick={onOpenAbout}
              className="hover:text-[#005FB8] hover:underline transition-colors py-1 px-1.5 rounded whitespace-nowrap cursor-pointer"
            >
              {t('nav.about')}
            </button>
            <span className="text-gray-300">•</span>
            <button
              onClick={onOpenHowItWorks}
              className="hover:text-[#005FB8] hover:underline transition-colors py-1 px-1.5 rounded whitespace-nowrap cursor-pointer"
            >
              {t('nav.rules')}
            </button>
            {onOpenFaq && (
              <>
                <span className="text-gray-300">•</span>
                <button
                  onClick={onOpenFaq}
                  className="text-[#005FB8] font-bold hover:underline transition-colors py-1 px-1.5 rounded flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <span>{t('nav.faq')}</span>
                </button>
              </>
            )}
            <span className="text-gray-300">•</span>
            <button
              onClick={onOpenContact}
              className="hover:text-[#005FB8] hover:underline transition-colors py-1 px-1.5 rounded whitespace-nowrap cursor-pointer"
            >
              {t('nav.contact')}
            </button>
          </div>
        </nav>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* MOBILE BURGER MENU DRAWER / MODAL (md:hidden)                     */}
      {/* Full-featured slide-over drawer with tabs, actions, and profile   */}
      {/* ----------------------------------------------------------------- */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-fade-in"
            aria-hidden="true"
          />

          {/* Slide-in Aside Drawer */}
          <aside
            className="fixed inset-y-0 left-0 w-[86vw] max-w-sm bg-white shadow-2xl flex flex-col z-50 animate-drawer-in overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
          >
            {/* Drawer Header */}
            <div className="px-4 py-3 border-b border-[#DDE1E6] flex items-center justify-between bg-white shrink-0">
              <div
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onLogoClick) onLogoClick();
                  else setActiveTab(isAdvertiser ? 'campaigns' : 'my-pods');
                }}
                className="cursor-pointer"
              >
                <Logo size="sm" />
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer"
                aria-label={t('nav.closeMenu')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {/* User Account Quick Card */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-3 mb-2.5">
                  <img
                    src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                    alt={currentUser.displayName}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-100"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-[#111827] truncate">{currentUser.displayName}</h4>
                    <p className="text-xs text-[#6B7280] truncate">{currentUser.email || `${currentUser.platform} Member`}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 text-xs">
                  {isAdvertiser ? (
                    <>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          if (onOpenAdvertiser) onOpenAdvertiser('metrics');
                        }}
                        className="text-left p-2 rounded-lg bg-white border border-gray-200 hover:border-amber-300 transition-colors cursor-pointer"
                      >
                        <span className="text-[10px] text-gray-500 block font-bold uppercase">Brand Escrow</span>
                        <span className="font-bold text-gray-900 font-mono text-xs">
                          $12,500.00 USD
                        </span>
                      </button>

                      <div className="text-left p-2 rounded-lg bg-amber-50 border border-amber-200 flex flex-col justify-center">
                        <span className="text-[10px] text-amber-700 block font-bold uppercase">Sponsor Role</span>
                        <span className="font-extrabold text-xs text-amber-900">
                          ✓ Advertiser
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onOpenBankModal();
                        }}
                        className="text-left p-2 rounded-lg bg-white border border-gray-200 hover:border-emerald-300 transition-colors cursor-pointer"
                      >
                        <span className="text-[10px] text-gray-500 block font-bold uppercase">{t('header.stripeTreasuryBalance')}</span>
                        <span className="font-bold text-gray-900 font-mono text-xs">
                          ${currentUser.treasury?.balanceUsd ? currentUser.treasury.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          if (currentUser.kycStatus === 'VERIFIED') {
                            window.open('https://dashboard.stripe.com/test/identity', '_blank', 'noopener,noreferrer');
                            if (onOpenKycModal) onOpenKycModal();
                          } else if (onOpenKycModal) {
                            onOpenKycModal();
                          }
                        }}
                        className="text-left p-2 rounded-lg bg-white border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer flex flex-col justify-center"
                      >
                        <span className="text-[10px] text-gray-500 block font-bold uppercase">Stripe KYC</span>
                        <span className={`font-bold text-xs ${currentUser.kycStatus === 'VERIFIED' ? 'text-green-600' : 'text-amber-600'}`}>
                          {currentUser.kycStatus === 'VERIFIED' ? '✓ Verified' : '⚠ Verify ID'}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Navigation Tabs Section */}
              <div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  Navigation Menu
                </div>
                <div className="space-y-1">
                  {primaryTabsList.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setMobileMenuOpen(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between border cursor-pointer ${
                          isActive
                            ? 'bg-[#005FB8] text-white border-[#005FB8] shadow-xs'
                            : 'bg-white hover:bg-gray-50 text-[#111827] border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm leading-tight flex items-center gap-2">
                              <span>{tab.label}</span>
                              {tab.badge !== undefined && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                  isActive ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {tab.badge}
                                </span>
                              )}
                            </div>
                            <p className={`text-xs truncate ${isActive ? 'text-blue-100' : 'text-gray-500'}`}>
                              {tab.description}
                            </p>
                          </div>
                        </div>
                        {isActive && <span className="w-2 h-2 rounded-full bg-white shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions & Partner Programs */}
              <div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  Actions & Programs
                </div>
                <div className="space-y-2">
                  {!isAdvertiser && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        if (onOpenSubmitPerk) onOpenSubmitPerk();
                        else setActiveTab('perks');
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold text-xs sm:text-sm flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <PlusCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <span className="block font-bold">{t('nav.submitPerksShort')}</span>
                          <span className="text-[11px] text-emerald-700 font-normal">Offer exclusive perks to gig & trade crew</span>
                        </div>
                      </div>
                    </button>
                  )}

                  {(isAdvertiser || isAdmin) && onOpenAdvertiser && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenAdvertiser('metrics');
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-between transition-colors shadow-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <BarChart3 className="w-4 h-4 text-slate-950 shrink-0" />
                        <div>
                          <span className="block font-extrabold">{t('header.advertiserPortal')}</span>
                          <span className="text-[11px] text-slate-800 font-semibold">Brand escrow budget & campaign analytics</span>
                        </div>
                      </div>
                    </button>
                  )}

                  {onOpenAdvertiser && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenAdvertiser('media-kit');
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#005FB8] border border-blue-200 font-bold text-xs sm:text-sm flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Megaphone className="w-4 h-4 text-[#005FB8]" />
                        <div>
                          <span className="block font-bold">{t('header.mediaKit')}</span>
                          <span className="text-[11px] text-blue-700 font-normal">Brand ambassador rate card & proposals</span>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Platform Info Links */}
              <div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  Information & Help
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {onOpenAbout && (
                    <button
                      onClick={() => { setMobileMenuOpen(false); onOpenAbout(); }}
                      className="text-left p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold border border-gray-200 cursor-pointer"
                    >
                      {t('nav.about')}
                    </button>
                  )}
                  {onOpenHowItWorks && (
                    <button
                      onClick={() => { setMobileMenuOpen(false); onOpenHowItWorks(); }}
                      className="text-left p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold border border-gray-200 cursor-pointer"
                    >
                      {t('nav.rules')}
                    </button>
                  )}
                  {onOpenFaq && (
                    <button
                      onClick={() => { setMobileMenuOpen(false); onOpenFaq(); }}
                      className="text-left p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#005FB8] font-bold border border-blue-200 cursor-pointer"
                    >
                      {t('nav.faq')}
                    </button>
                  )}
                  {onOpenContact && (
                    <button
                      onClick={() => { setMobileMenuOpen(false); onOpenContact(); }}
                      className="text-left p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold border border-gray-200 cursor-pointer"
                    >
                      {t('nav.contact')}
                    </button>
                  )}
                </div>
              </div>

              {/* Region & Language Preferences */}
              <div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  Region & Language
                </div>
                <div className="space-y-2.5">
                  <CountrySelector variant="drawer" />
                  <LanguageSelector variant="drawer" />
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#DDE1E6] bg-gray-50 space-y-2 shrink-0">
              {onExitToLanding && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onExitToLanding();
                  }}
                  className="w-full text-left p-2 rounded-lg bg-white hover:bg-gray-100 text-[#111827] font-semibold text-xs flex items-center gap-2 border border-gray-200 transition-colors cursor-pointer"
                >
                  <Home className="w-4 h-4 text-[#005FB8]" />
                  <span>{t('header.returnToLanding')}</span>
                </button>
              )}

              {onLogout && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center justify-between border border-red-200 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <LogOut className="w-4 h-4 text-red-600" />
                    <span>{t('nav.logout')}</span>
                  </div>
                  <span className="text-[10px] text-red-500 font-normal">{t('header.endSession')}</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </header>
  );
};
