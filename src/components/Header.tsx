import React, { useState } from 'react';
import { User } from '../types';
import { Logo } from './Logo';
import { 
  Users, Gift, ShieldCheck, Building2, Download, LogOut,
  ChevronDown, Layers, Activity, AlertCircle, Lock, Wallet, Sparkles, RefreshCw, Home
} from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  allUsers: User[];
  onSwitchUser: (userId: string) => void;
  activeTab: 'my-pods' | 'explore-pods' | 'perks' | 'audit-log' | 'admin-ops';
  setActiveTab: (tab: 'my-pods' | 'explore-pods' | 'perks' | 'audit-log' | 'admin-ops') => void;
  onLogoClick?: () => void;
  onOpenKYCGate: () => void;
  onOpenBankModal: () => void;
  onOpenEditProfile?: () => void;
  onInstallPWA?: () => void;
  canInstallPWA?: boolean;
  onExitToLanding?: () => void;
  onOpenAbout?: () => void;
  onOpenHowItWorks?: () => void;
  onOpenContact?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  activeTab,
  setActiveTab,
  onLogoClick,
  onOpenKYCGate,
  onOpenBankModal,
  onOpenEditProfile,
  onInstallPWA,
  canInstallPWA,
  onExitToLanding,
  onOpenAbout,
  onOpenHowItWorks,
  onOpenContact,
  onLogout,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);

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
            <div className="hidden lg:flex items-center gap-2 bg-[#F8FAFC] px-3 py-1.5 rounded-lg border border-[#DDE1E6] text-xs">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="text-[#6B7280] text-[10px] uppercase font-bold block leading-none">Stripe Treasury Balance</span>
                <span className="font-bold text-[#111827] font-mono">
                  ${currentUser.treasury.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-[#6B7280]">USD</span>
                </span>
              </div>
            </div>

            {/* KYC Status Badge */}
            <button
              onClick={onOpenKYCGate}
              className={`px-3 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                currentUser.kycStatus === 'VERIFIED'
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
              title={currentUser.kycStatus === 'VERIFIED' ? 'Identity Verified via Stripe' : 'Click to complete identity verification'}
            >
              {currentUser.kycStatus === 'VERIFIED' ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="hidden sm:inline font-bold text-[11px] uppercase tracking-wide">KYC VERIFIED</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline font-bold text-[11px] uppercase tracking-wide">KYC PENDING</span>
                </>
              )}
            </button>

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

            <button
              onClick={() => setActiveTab('admin-ops')}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'admin-ops'
                  ? 'bg-[#005FB8] text-white font-bold shadow-xs'
                  : 'text-[#4B5563] hover:bg-gray-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Operations & Webhooks</span>
            </button>
          </div>

          {/* Quick Info Modal Links */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-[#4B5563] shrink-0 font-medium">
            <button
              onClick={onOpenAbout}
              className="hover:text-[#005FB8] hover:underline transition-colors py-1 px-1.5 rounded"
            >
              About Us
            </button>
            <span className="text-gray-300">•</span>
            <button
              onClick={onOpenHowItWorks}
              className="hover:text-[#005FB8] hover:underline transition-colors py-1 px-1.5 rounded"
            >
              How It Works & Rules
            </button>
            <span className="text-gray-300">•</span>
            <button
              onClick={onOpenContact}
              className="hover:text-[#005FB8] hover:underline transition-colors py-1 px-1.5 rounded"
            >
              Contact Us
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
};
