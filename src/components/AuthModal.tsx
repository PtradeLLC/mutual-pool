import React, { useState, useEffect, useRef } from 'react';
import { User, GigPlatform } from '../types';
import { Logo } from './Logo';
import { 
  UserCheck, PlusCircle, LogIn, X, ShieldCheck, 
  Sparkles, AlertCircle, Building2, Wallet, ArrowRight, Check,
  Phone, Mail, Smartphone
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  RecaptchaVerifier, 
  signInWithPhoneNumber,
  ConfirmationResult,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { getUserFromFirestore, saveUserToFirestore } from '../lib/firestoreService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  allUsers: User[];
  onSelectUser: (user: User) => void;
  onRegistered: (user: User) => void;
  initialMode?: 'LOGIN' | 'REGISTER' | 'DEMO' | 'PHONE' | 'GOOGLE';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  allUsers: _allUsers,
  onSelectUser,
  onRegistered,
  initialMode = 'LOGIN',
}) => {
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER' | 'PHONE'>(
    initialMode === 'REGISTER' ? 'REGISTER' : (initialMode === 'PHONE' ? 'PHONE' : 'LOGIN')
  );

  // Email Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPlatform, setRegPlatform] = useState<GigPlatform>('DoorDash');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  // Email Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Phone Auth State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneStep, setPhoneStep] = useState<'NUMBER' | 'CODE'>('NUMBER');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Shared Auth Platform State
  const [authPlatform, setAuthPlatform] = useState<GigPlatform>('DoorDash');

  // Google Loading State
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // cleanup silent
        }
      }
    };
  }, []);

  if (!isOpen) return null;

  // Helper to ensure a user exists in Firestore and return full User object
  const ensureUserInFirestore = async (
    uid: string, 
    email: string | null, 
    displayName: string | null, 
    platform: GigPlatform = 'DoorDash',
    phoneNumber?: string,
    photoURL?: string | null
  ): Promise<User> => {
    let existing = await getUserFromFirestore(uid);
    const resolvedName = displayName || (phoneNumber ? `Member ${phoneNumber.slice(-4)}` : 'MutualPool Member');
    const defaultAvatar = photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedName)}&background=005FB8&color=fff&size=200`;

    if (existing) {
      let modified = false;
      if (photoURL && existing.avatarUrl !== photoURL) {
        existing = { ...existing, avatarUrl: photoURL };
        modified = true;
      } else if (!existing.avatarUrl || existing.avatarUrl.includes('unsplash.com/photo-1534528741775-53994a69daeb')) {
        existing = { ...existing, avatarUrl: defaultAvatar };
        modified = true;
      }

      if (existing.kycStatus === 'VERIFIED' && !existing.kycVerifiedAt && !existing.treasury?.stripeAccountId) {
        existing = { ...existing, kycStatus: 'PENDING' };
        modified = true;
      }

      if (modified) {
        await saveUserToFirestore(existing);
      }
      return existing;
    }

    const newUser: User = {
      id: uid,
      email: email || `${uid.substring(0, 8)}@mutualpool.org`,
      displayName: resolvedName,
      avatarUrl: defaultAvatar,
      platform: platform,
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

    await saveUserToFirestore(newUser);
    return newUser;
  };

  // 1. EMAIL SIGN UP (FIREBASE AUTH)
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegLoading(true);

    try {
      if (!regPassword || regPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      const userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: regName });
        const appUser = await ensureUserInFirestore(
          userCredential.user.uid,
          regEmail,
          regName,
          regPlatform,
          undefined,
          userCredential.user.photoURL
        );
        onRegistered(appUser);
        onClose();
      }
    } catch (err: unknown) {
      console.error('Firebase Register Error:', err);
      if (err instanceof Error) {
        setRegError(err.message.replace('Firebase: ', ''));
      } else {
        setRegError('Failed to register with Firebase Auth.');
      }
    } finally {
      setRegLoading(false);
    }
  };

  // 2. EMAIL SIGN IN (FIREBASE AUTH)
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      if (userCredential.user) {
        const appUser = await ensureUserInFirestore(
          userCredential.user.uid,
          userCredential.user.email,
          userCredential.user.displayName,
          'DoorDash',
          undefined,
          userCredential.user.photoURL
        );
        onSelectUser(appUser);
        onClose();
      }
    } catch (err: unknown) {
      console.error('Firebase Login Error:', err);
      if (err instanceof Error) {
        setLoginError(err.message.replace('Firebase: ', ''));
      } else {
        setLoginError('Failed to sign in with Firebase Auth.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // 3. GOOGLE OAUTH SIGN IN
  const handleGoogleSignIn = async () => {
    setGoogleError('');
    setGoogleLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        const appUser = await ensureUserInFirestore(
          result.user.uid,
          result.user.email,
          result.user.displayName,
          authPlatform,
          undefined,
          result.user.photoURL
        );
        onSelectUser(appUser);
        onClose();
      }
    } catch (err: unknown) {
      console.error('Google Sign-In Error:', err);
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'auth/unauthorized-domain') {
        const hostname = window.location.hostname;
        const activeProjectId = auth.app.options.projectId || 'unknown';
        setGoogleError(`Domain Unauthorized: "${hostname}" is not authorized for Firebase Project "${activeProjectId}". Please check that "${hostname}" is added to Authorized Domains for Firebase Project "${activeProjectId}" in Firebase Console > Authentication > Settings > Authorized domains.`);
      } else if (err instanceof Error) {
        setGoogleError(err.message.replace('Firebase: ', ''));
      } else {
        setGoogleError('Failed to sign in with Google.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // 4. PHONE AUTHENTICATION
  const handleSendPhoneSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    setPhoneLoading(true);

    try {
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+1' + formattedPhone.replace(/\D/g, ''); // default US +1 if missing country code
      }

      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved
          }
        });
      }

      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifierRef.current);
      setConfirmationResult(confirmation);
      setPhoneStep('CODE');
    } catch (err: unknown) {
      console.error('Phone SMS Error:', err);
      if (err instanceof Error) {
        setPhoneError(err.message.replace('Firebase: ', ''));
      } else {
        setPhoneError('Failed to send SMS code. Make sure phone number includes country code.');
      }
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyPhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;

    setPhoneError('');
    setPhoneLoading(true);

    try {
      const userCredential = await confirmationResult.confirm(verificationCode);
      if (userCredential.user) {
        const appUser = await ensureUserInFirestore(
          userCredential.user.uid,
          null,
          `Driver ${phoneNumber.slice(-4)}`,
          authPlatform,
          phoneNumber
        );
        onSelectUser(appUser);
        onClose();
      }
    } catch (err: unknown) {
      console.error('Phone Code Verify Error:', err);
      if (err instanceof Error) {
        setPhoneError(err.message.replace('Firebase: ', ''));
      } else {
        setPhoneError('Invalid SMS code entered.');
      }
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-[#DDE1E6] rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-[#111827] my-auto max-h-[85vh] overflow-y-auto">
        
        {/* Invisible Recaptcha Container */}
        <div id="recaptcha-container"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <Logo size="md" />
          <div>
            <h3 className="text-xl font-bold text-[#111827]">MutualPool Portal</h3>
            <p className="text-xs text-[#6B7280]">Email, Google, or Phone Authentication</p>
          </div>
        </div>

        {/* Gig Platform Selector for Social / Phone Login */}
        <div className="mb-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl p-3">
          <label className="block text-[11px] font-bold text-[#005FB8] mb-1">
            Select Your Primary Gig Fleet Platform
          </label>
          <select
            value={authPlatform}
            onChange={(e) => {
              const selected = e.target.value as GigPlatform;
              setAuthPlatform(selected);
              setRegPlatform(selected);
            }}
            className="w-full px-3 py-1.5 text-xs font-semibold border border-blue-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#005FB8] bg-white text-[#111827]"
          >
            <option value="DoorDash">DoorDash Fleet</option>
            <option value="Uber Eats">Uber Eats Fleet</option>
            <option value="Instacart">Instacart Shoppers</option>
            <option value="Lyft">Lyft Drivers</option>
            <option value="Grubhub">Grubhub Delivery</option>
            <option value="Spark">Spark (Walmart)</option>
            <option value="Amazon Flex">Amazon Flex Drivers</option>
          </select>
        </div>

        {/* Global Google OAuth Button */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full py-2.5 px-4 rounded-xl border border-gray-300 hover:border-[#005FB8] bg-white hover:bg-gray-50 text-gray-800 font-bold text-xs transition-all flex items-center justify-center gap-2.5 shadow-2xs"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{googleLoading ? 'Signing in with Google...' : 'Continue with Google Account'}</span>
          </button>
          {googleError && (
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px] space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Google Auth Domain Setup Needed</span>
              </div>
              <p>{googleError}</p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('LOGIN')}
                  className="px-2.5 py-1 rounded bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold text-[10px]"
                >
                  Use Email Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('PHONE')}
                  className="px-2.5 py-1 rounded bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold text-[10px]"
                >
                  Use Phone Sign In
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative flex py-2 items-center mb-4">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="flex-shrink mx-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Or choose method</span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 gap-1 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0] mb-5 text-[11px] font-semibold">
          <button
            onClick={() => setActiveTab('LOGIN')}
            className={`py-2 px-1 rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === 'LOGIN'
                ? 'bg-white text-[#005FB8] shadow-2xs font-bold border border-[#DDE1E6]'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email</span>
          </button>

          <button
            onClick={() => setActiveTab('PHONE')}
            className={`py-2 px-1 rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === 'PHONE'
                ? 'bg-white text-[#005FB8] shadow-2xs font-bold border border-[#DDE1E6]'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Phone</span>
          </button>

          <button
            onClick={() => setActiveTab('REGISTER')}
            className={`py-2 px-1 rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === 'REGISTER'
                ? 'bg-white text-[#005FB8] shadow-2xs font-bold border border-[#DDE1E6]'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Sign Up</span>
          </button>
        </div>

        {/* TAB 2: EMAIL SIGN IN */}
        {activeTab === 'LOGIN' && (
          <form onSubmit={handleEmailLogin} className="space-y-4 text-xs">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1">
                Firebase Email Address
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="e.g. driver@mutualpool.org"
                className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-2xs"
            >
              {loginLoading ? (
                <span>Verifying Credentials...</span>
              ) : (
                <>
                  <span>Sign In with Email</span>
                  <LogIn className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* TAB 3: PHONE SMS AUTHENTICATION */}
        {activeTab === 'PHONE' && (
          <div className="space-y-4 text-xs">
            {phoneError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{phoneError}</span>
              </div>
            )}

            {phoneStep === 'NUMBER' ? (
              <form onSubmit={handleSendPhoneSms} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#111827] mb-1">
                    Mobile Phone Number (with Country Code)
                  </label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. +1 555 234 5678"
                    className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8] font-mono"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    We'll send an SMS code to verify your mobile identity.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={phoneLoading}
                  className="w-full py-3 rounded-xl bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-2xs"
                >
                  {phoneLoading ? (
                    <span>Sending SMS Verification...</span>
                  ) : (
                    <>
                      <span>Send SMS Verification Code</span>
                      <Smartphone className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyPhoneCode} className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs">
                  SMS Code sent to <strong>{phoneNumber}</strong>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111827] mb-1">
                    Enter 6-Digit SMS Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="e.g. 123456"
                    maxLength={6}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-center tracking-widest text-lg font-mono font-bold text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPhoneStep('NUMBER')}
                    className="w-1/3 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 font-bold text-xs text-gray-700"
                  >
                    Change Number
                  </button>
                  <button
                    type="submit"
                    disabled={phoneLoading}
                    className="w-2/3 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-2xs"
                  >
                    {phoneLoading ? 'Verifying Code...' : 'Confirm Code & Sign In'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 4: REGISTER NEW DRIVER */}
        {activeTab === 'REGISTER' && (
          <form onSubmit={handleEmailRegister} className="space-y-4 text-xs">
            {regError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
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
                className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
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
                className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1">
                Primary Delivery / Fleet
              </label>
              <select
                value={regPlatform}
                onChange={(e) => setRegPlatform(e.target.value as GigPlatform)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
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

            <button
              type="submit"
              disabled={regLoading}
              className="w-full py-3 rounded-xl bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-2xs"
            >
              {regLoading ? (
                <span>Creating Firebase User & Firestore Profile...</span>
              ) : (
                <>
                  <span>Register Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
