import React, { useState } from 'react';
import { User, GigPlatform } from '../types';
import { 
  UserCheck, PlusCircle, LogIn, X, ShieldCheck, 
  Sparkles, AlertCircle, Building2, Wallet, ArrowRight, Check 
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  allUsers: User[];
  onSelectUser: (user: User) => void;
  onRegistered: (user: User) => void;
  initialMode?: 'LOGIN' | 'REGISTER' | 'DEMO';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  allUsers,
  onSelectUser,
  onRegistered,
  initialMode = 'DEMO',
}) => {
  const [activeTab, setActiveTab] = useState<'DEMO' | 'LOGIN' | 'REGISTER'>(initialMode);

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPlatform, setRegPlatform] = useState<GigPlatform>('DoorDash');
  const [regInitialDeposit, setRegInitialDeposit] = useState('100');
  const [regAutoKyc, setRegAutoKyc] = useState(true);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegLoading(true);

    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: regName,
          email: regEmail,
          platform: regPlatform,
          initialDeposit: regInitialDeposit,
          autoVerifyKyc: regAutoKyc,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register account');
      }

      onRegistered(data.user);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setRegError(err.message);
      } else {
        setRegError('An unexpected error occurred during registration.');
      }
    } finally {
      setRegLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }

      onSelectUser(data);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setLoginError(err.message);
      } else {
        setLoginError('An unexpected error occurred during sign in.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-lg w-full p-6 shadow-2xl relative text-[#111827] my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#005FB8] flex items-center justify-center text-white font-bold text-lg shadow-xs shrink-0">
            P
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#111827]">Rider Mutual Portal Sign In</h3>
            <p className="text-xs text-[#6B7280]">Access your Stripe Treasury savings pods & fleet perks</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 gap-1 bg-[#F8FAFC] p-1 rounded-lg border border-[#E2E8F0] mb-5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('DEMO')}
            className={`py-2 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'DEMO'
                ? 'bg-white text-[#005FB8] shadow-xs font-bold border border-[#DDE1E6]'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Select Persona</span>
          </button>

          <button
            onClick={() => setActiveTab('REGISTER')}
            className={`py-2 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'REGISTER'
                ? 'bg-white text-[#005FB8] shadow-xs font-bold border border-[#DDE1E6]'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Driver</span>
          </button>

          <button
            onClick={() => setActiveTab('LOGIN')}
            className={`py-2 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'LOGIN'
                ? 'bg-white text-[#005FB8] shadow-xs font-bold border border-[#DDE1E6]'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Email Sign In</span>
          </button>
        </div>

        {/* TAB 1: DEMO PERSONA SELECTOR */}
        {activeTab === 'DEMO' && (
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-[#005FB8] flex items-start gap-2">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Reviewer Quick Access:</strong> Choose any pre-configured test driver persona below to jump straight into active savings circles, rotation voting, and payout tracking.
              </span>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {allUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    onSelectUser(u);
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-lg border border-[#DDE1E6] hover:border-[#005FB8] hover:bg-blue-50/50 transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                      alt={u.displayName}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200 group-hover:ring-[#005FB8]"
                    />
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-[#111827] group-hover:text-[#005FB8] truncate">
                          {u.displayName}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-[#4B5563]">
                          {u.platform}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B7280] truncate mt-0.5">
                        {u.role} • Treasury: <span className="font-mono font-semibold text-emerald-700">${u.treasury.balanceUsd}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      u.kycStatus === 'VERIFIED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {u.kycStatus}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#005FB8] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: REGISTER NEW DRIVER */}
        {activeTab === 'REGISTER' && (
          <form onSubmit={handleRegister} className="space-y-4 text-xs">
            {regError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{regError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1">
                Full Legal Name
              </label>
              <input
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="e.g. Maya Lin"
                className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="e.g. maya.lin@example.com"
                className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1">
                  Primary Delivery / Fleet
                </label>
                <select
                  value={regPlatform}
                  onChange={(e) => setRegPlatform(e.target.value as GigPlatform)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                >
                  <option value="DoorDash">DoorDash Driver</option>
                  <option value="Uber Eats">Uber / Uber Eats</option>
                  <option value="Lyft">Lyft Driver</option>
                  <option value="Instacart">Instacart Shopper</option>
                  <option value="Amazon Flex">Amazon Flex Driver</option>
                  <option value="Spark">Walmart Spark</option>
                  <option value="Grubhub">Grubhub Driver</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1">
                  Initial Treasury Balance ($)
                </label>
                <input
                  type="number"
                  min="20"
                  max="5000"
                  value={regInitialDeposit}
                  onChange={(e) => setRegInitialDeposit(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8] font-mono"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] cursor-pointer">
              <input
                type="checkbox"
                checked={regAutoKyc}
                onChange={(e) => setRegAutoKyc(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-[#005FB8] focus:ring-[#005FB8]"
              />
              <div>
                <span className="font-bold text-[#111827] block">Auto-Verify Identity (Instant KYC Gate)</span>
                <span className="text-[11px] text-[#6B7280]">
                  Simulates instant Stripe Identity verification and provisions a test Stripe Custom Treasury Account.
                </span>
              </div>
            </label>

            <button
              type="submit"
              disabled={regLoading}
              className="w-full py-3 rounded-lg bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              {regLoading ? (
                <span>Registering Account & Creating Treasury...</span>
              ) : (
                <>
                  <span>Create Account & Start Savings</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* TAB 3: EMAIL SIGN IN */}
        {activeTab === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1">
                Account Email Address
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="e.g. marcus.vance@doordash.example.com"
                className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1">
                Password
              </label>
              <input
                type="password"
                defaultValue="password123"
                className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
              />
            </div>

            {/* Autofill Demo Email Shortcuts */}
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-1.5">
              <span className="text-[11px] font-bold text-[#6B7280] block">Autofill Test Driver Emails:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setLoginEmail('marcus.vance@doordash.example.com')}
                  className="px-2 py-1 bg-white border border-gray-200 hover:border-[#005FB8] rounded text-[10px] font-mono text-[#111827]"
                >
                  Marcus (DoorDash)
                </button>
                <button
                  type="button"
                  onClick={() => setLoginEmail('elena.rostova@uber.example.com')}
                  className="px-2 py-1 bg-white border border-gray-200 hover:border-[#005FB8] rounded text-[10px] font-mono text-[#111827]"
                >
                  Elena (Uber)
                </button>
                <button
                  type="button"
                  onClick={() => setLoginEmail('jamar.m@instacart.example.com')}
                  className="px-2 py-1 bg-white border border-gray-200 hover:border-[#005FB8] rounded text-[10px] font-mono text-[#111827]"
                >
                  Jamar (Instacart)
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-lg bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              {loginLoading ? (
                <span>Signing In...</span>
              ) : (
                <>
                  <span>Sign In to Driver Dashboard</span>
                  <LogIn className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
