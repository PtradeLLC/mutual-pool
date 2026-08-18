import React, { useState } from 'react';
import { User, Pod } from '../types';
import { Logo } from './Logo';
import { NotificationCenter } from './NotificationCenter';
import { 
  Users, Gift, ShieldCheck, Building2, Download, LogOut,
  ChevronDown, Layers, Activity, AlertCircle, Lock, Wallet, Sparkles, RefreshCw, Home, PlusCircle, ExternalLink, Zap,
  Megaphone, Shirt, BarChart3
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
  onOpenContact?: () => void;
  onLogout?: () => void;
  onOpenKycModal?: () => void;
  hasWelcomeMatch?: boolean;
  onOpenHardshipModal?: (initialTab?: 'hardship' | 'trade') => void;
  onOpenPodDetail?: (podId: string) => void;
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
  onOpenContact,
  onLogout,
  onOpenKycModal,
  hasWelcomeMatch,
  onOpenHardshipModal,
  onOpenPodDetail,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'POD_ADMIN' || (typeof currentUser.role === 'string' && currentUser.role.toUpperCase().includes('ADMIN')) || currentUser.email?.toLowerCase() === 'chrisbitoy@gmail.com' || Boolean(currentUser.isAdmin);

  return (
    <header className="bg-white border-b border-[#DDE1E6] sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          
          {/* Brand Logo & Name */}
          <div 
            onClick={() => {
              if (onLogoClick) {
                onLogoClick();
              } else {
                setActiveTab('my-pods');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-3 cursor-pointer group"
            title="MutualPool Dashboard"
          >
            <Logo size="md" />
            <div className="hidden sm:block">
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#005FB8] border border-blue-200">
                Stripe Treasury
              </span>
            </div>
          </div>

          {/* User Status Bar & Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* PWA Install Button */}
            {canInstallPWA && onInstallPWA && (
              <button
                onClick={onInstallPWA}
                className="px-2.5 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Install PWA App</span>
              </button>
            )}

            {/* Treasury Balance Pill */}
            <button
              type="button"
              onClick={onOpenBankModal}
              title="Click to view Stripe Treasury Account & Add Test Funds"
              className="hidden lg:flex items-center gap-2 bg-[#F8FAFC] hover:bg-emerald-50/80 px-3 py-1.5 rounded-lg border border-[#DDE1E6] hover:border-emerald-300 text-xs transition-all cursor-pointer group"
            >
              <Wallet className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <span className="text-[#6B7280] group-hover:text-emerald-800 text-[10px] uppercase font-bold block leading-none">Stripe Treasury Balance</span>
                <span className="font-bold text-[#111827] font-mono">
                  ${currentUser.treasury.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-[#6B7280]">USD</span>
                </span>
              </div>
            </button>

            {/* Welcome Match Credited Pill */}
            {(hasWelcomeMatch || currentUser.welcomeMatchReceived) && (
              <div className="hidden xl:flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1.5 rounded-lg text-xs font-extrabold shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600 animate-pulse shrink-0" />
                <span>+$20.00 Welcome Match</span>
              </div>
            )}

            {/* Verified Status Badge or KYC Verification Prompt */}
            {currentUser.kycStatus === 'VERIFIED' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open('https://dashboard.stripe.com/test/identity', '_blank', 'noopener,noreferrer');
                  if (onOpenKycModal) onOpenKycModal();
                }}
                className="px-3 py-1 rounded-full border border-green-200 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Verified via Stripe Identity — Click to view in Stripe Dashboard & Verification Details"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="hidden sm:inline font-bold text-[11px] uppercase tracking-wide">VERIFIED MEMBER</span>
                <ExternalLink className="w-3 h-3 text-green-600 ml-0.5 shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenKycModal}
                className="px-3 py-1 rounded-full border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Click to complete Stripe Identity KYC verification"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="hidden sm:inline font-extrabold text-[11px] uppercase tracking-wide">VERIFY IDENTITY (KYC)</span>
              </button>
            )}

            {/* In-App Notifications Center */}
            <NotificationCenter
              currentUser={currentUser}
              myPods={myPods}
              onOpenHardshipModal={onOpenHardshipModal}
              onOpenPodDetail={onOpenPodDetail}
            />

            {/* User Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="bg-white hover:bg-gray-50 border border-[#DDE1E6] rounded-lg px-2.5 py-1.5 flex items-center gap-2 transition-colors text-left shadow-xs"
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                  alt={currentUser.displayName}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-gray-300"
                />
                <div className="hidden sm:block text-xs">
                  <span className="font-bold text-[#111827] block leading-tight">{currentUser.displayName}</span>
                  <span className="text-[10px] text-[#6B7280]">{currentUser.platform} ({currentUser.role})</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#6B7280]" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-[#DDE1E6] rounded-xl shadow-xl p-2 z-50 divide-y divide-[#DDE1E6]">
                  {/* Account / Profile Quick Action */}
                  <div className="pb-2">
                    <div className="px-2 py-1.5 mb-1 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-xs font-bold text-[#111827] truncate">{currentUser.displayName}</p>
                      <p className="text-[10px] text-[#6B7280] truncate">{currentUser.email || `${currentUser.platform} Member`}</p>
                    </div>

                    {onOpenEditProfile && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenEditProfile();
                        }}
                        className="w-full text-left p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#005FB8] font-bold text-xs flex items-center justify-between transition-colors border border-blue-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=005FB8&color=fff&size=200`}
                            alt={currentUser.displayName}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span>Edit Profile, Fleet & Role</span>
                        </div>
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Navigation & Logout Section */}
                  <div className="pt-2 space-y-1">
                    {onOpenAdvertiser && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenAdvertiser('metrics');
                        }}
                        className="w-full text-left p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs flex items-center justify-between transition-colors border border-amber-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-amber-600" />
                          <span>Advertiser & Campaign Metrics</span>
                        </div>
                        <span className="text-[10px] bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900 font-bold uppercase">Portal</span>
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
                        <span>Return to Landing Page</span>
                      </button>
                    )}

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
                          <span>Log Out</span>
                        </div>
                        <span className="text-[10px] text-red-500 font-normal">End Session</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-[#DDE1E6]">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar shrink-0">
            <button
              onClick={() => setActiveTab('my-pods')}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'my-pods'
                  ? 'bg-[#005FB8] text-white font-bold shadow-xs'
                  : 'text-[#4B5563] hover:bg-gray-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>My Mutual Pods</span>
            </button>

            <button
              onClick={() => setActiveTab('explore-pods')}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'explore-pods'
                  ? 'bg-[#005FB8] text-white font-bold shadow-xs'
                  : 'text-[#4B5563] hover:bg-gray-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Explore Pods</span>
            </button>

            <button
              onClick={() => setActiveTab('perks')}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'perks'
                  ? 'bg-[#005FB8] text-white font-bold shadow-xs'
                  : 'text-[#4B5563] hover:bg-gray-100'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Benefits Marketplace</span>
            </button>

            <button
              id="header-tab-campaigns"
              onClick={() => setActiveTab('campaigns')}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'campaigns'
                  ? 'bg-[#005FB8] text-white font-bold shadow-xs'
                  : 'text-[#4B5563] hover:bg-gray-100'
              }`}
            >
              <Shirt className="w-3.5 h-3.5" />
              <span>Ad Campaigns</span>
            </button>

            <button
              onClick={onOpenSubmitPerk || (() => setActiveTab('perks'))}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
              title="Submit a partner or community perk offer for admin review"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Submit Benefits & Perks</span>
            </button>

            {onOpenAdvertiser && (
              <button
                type="button"
                id="header-advertise-btn"
                onClick={() => onOpenAdvertiser('media-kit')}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                title="Launch a brand campaign or sponsor courier promo apparel"
              >
                <Megaphone className="w-3.5 h-3.5 text-slate-950" />
                <span>Advertise with Us</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('audit-log')}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'audit-log'
                  ? 'bg-[#005FB8] text-white font-bold shadow-xs'
                  : 'text-[#4B5563] hover:bg-gray-100'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Audit Ledger</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin-ops')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'admin-ops'
                    ? 'bg-[#005FB8] text-white font-bold shadow-xs'
                    : 'text-[#4B5563] hover:bg-gray-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Operations & Webhooks</span>
              </button>
            )}
          </div>

          {/* Quick Info Modal Links */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-[#4B5563] shrink-0 font-medium">
            <button
              onClick={onOpenAbout}
              className="hover:text-[#005FB8] hover:underline transition-colors py-1 px-1.5 rounded"
            >
              About
            </button>
            <span className="text-gray-300">•</span>
            <button
              onClick={onOpenHowItWorks}
              className="hover:text-[#005FB8] hover:underline transition-colors py-1 px-1.5 rounded"
            >
              Rules
            </button>
            <span className="text-gray-300">•</span>
            <button
              onClick={onOpenContact}
              className="hover:text-[#005FB8] hover:underline transition-colors py-1 px-1.5 rounded"
            >
              Contact
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
};
