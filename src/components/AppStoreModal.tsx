import React, { useState, useEffect } from 'react';
import { X, Smartphone, Share, PlusSquare, ArrowRight, Download, CheckCircle2, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';

interface AppStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlatform?: 'ios' | 'android';
  onOpenRegister?: () => void;
}

export const AppStoreModal: React.FC<AppStoreModalProps> = ({
  isOpen,
  onClose,
  defaultPlatform = 'ios',
  onOpenRegister,
}) => {
  const [platform, setPlatform] = useState<'ios' | 'android'>(defaultPlatform);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(defaultPlatform);
  }, [defaultPlatform]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('To install MutualPool on your device, follow the step-by-step instructions below!');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#DDE1E6] relative my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Logo size="md" />
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xl font-bold text-[#111827]">Download MutualPool</h3>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full">
                PWA Ready
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">Official iOS & Android App Store Installation</p>
          </div>
        </div>

        {/* Platform Switcher */}
        <div className="grid grid-cols-2 gap-2 bg-[#F8FAFC] p-1.5 rounded-xl border border-[#E2E8F0] mb-5 text-xs font-semibold">
          <button
            onClick={() => setPlatform('ios')}
            className={`py-2.5 px-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
              platform === 'ios'
                ? 'bg-black text-white shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {/* Apple Logo SVG */}
            <svg className="w-4 h-4 fill-current" viewBox="0 0 170 170">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.34.13-9.14-1.9-14.4-6.08-3.38-2.65-7.23-7.24-11.57-13.78-8.16-12.18-14.28-25.79-18.35-40.82-4.07-15.03-6.11-28.84-6.11-41.42 0-16.7 4.12-30.49 12.36-41.37 8.24-10.88 18.59-16.42 31.06-16.63 4.82 0 10.22 1.25 16.2 3.75 5.98 2.5 10.15 3.8 12.51 3.9 1.95 0 6.27-1.35 12.96-4.05 6.69-2.7 12.11-3.95 16.26-3.75 13.62.63 24.58 5.67 32.88 15.13-11.96 7.22-17.82 17.15-17.58 29.79.25 10.02 4.1 18.38 11.56 25.08 7.46 6.7 16.14 10.37 26.04 11.01-2.52 7.74-5.88 15.53-10.08 23.37zm-29.35-104.9c0-7.39 2.65-14.42 7.95-21.09 5.3-6.67 12.01-10.79 20.13-12.36.42 1.08.63 2.16.63 3.24 0 7.29-2.75 14.37-8.25 21.24-5.5 6.87-12.28 11.01-20.34 12.42-.12-.95-.12-2.11-.12-3.45z"/>
            </svg>
            <span>Apple App Store</span>
          </button>

          <button
            onClick={() => setPlatform('android')}
            className={`py-2.5 px-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
              platform === 'android'
                ? 'bg-black text-white shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {/* Google Play Triangle SVG */}
            <svg className="w-4 h-4 fill-current" viewBox="0 0 512 512">
              <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 65.7 65.7 65.7 59-34.2c16.8-9.8 26.7-27 26.7-46.5s-9.9-36.8-26.8-46.6zM104.6 499l220.7-221.3 60.1 60.1L104.6 499z"/>
            </svg>
            <span>Google Play Store</span>
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="bg-[#F8FAFC] rounded-xl p-3.5 border border-[#E2E8F0] mb-5 text-xs space-y-2">
          <div className="flex items-center justify-between text-[#111827] font-semibold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#005FB8]" />
              Progressive Web App (PWA) Advantages
            </span>
            <span className="text-[10px] font-mono text-[#005FB8] bg-blue-50 px-2 py-0.5 rounded">Fast & Secure</span>
          </div>
          <ul className="grid grid-cols-2 gap-2 text-[11px] text-[#4B5563]">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Instant Home Screen icon</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>No App Store download delay</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Real-time payout alerts</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Stripe FDIC-insured safety</span>
            </li>
          </ul>
        </div>

        {/* Installation Steps based on Platform */}
        {platform === 'ios' ? (
          <div className="space-y-3 mb-6">
            <h4 className="font-bold text-xs text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#005FB8]" />
              How to Install on iOS (iPhone & iPad)
            </h4>

            <div className="space-y-2 text-xs text-[#374151]">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-6 h-6 rounded-full bg-black text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <div>
                  <span className="font-bold text-[#111827] block mb-0.5">Open in Safari Browser</span>
                  <p className="text-[#6B7280]">Ensure you are viewing MutualPool in Safari on your iPhone.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-6 h-6 rounded-full bg-black text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <div>
                  <span className="font-bold text-[#111827] flex items-center gap-1.5 mb-0.5">
                    Tap the Share Button
                    <Share className="w-3.5 h-3.5 text-[#005FB8]" />
                  </span>
                  <p className="text-[#6B7280]">Tap the Share icon at the bottom center of your Safari browser bar.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-6 h-6 rounded-full bg-black text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </div>
                <div>
                  <span className="font-bold text-[#111827] flex items-center gap-1.5 mb-0.5">
                    Select "Add to Home Screen"
                    <PlusSquare className="w-3.5 h-3.5 text-emerald-600" />
                  </span>
                  <p className="text-[#6B7280]">Scroll down the menu and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            <h4 className="font-bold text-xs text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#005FB8]" />
              How to Install on Android (Google Play & Chrome)
            </h4>

            <div className="space-y-2 text-xs text-[#374151]">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-6 h-6 rounded-full bg-black text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <div>
                  <span className="font-bold text-[#111827] block mb-0.5">Open Chrome or Android Browser</span>
                  <p className="text-[#6B7280]">View MutualPool in Google Chrome on your Android smartphone.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-6 h-6 rounded-full bg-black text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <div>
                  <span className="font-bold text-[#111827] flex items-center gap-1.5 mb-0.5">
                    Tap Install Prompt or Menu
                    <Download className="w-3.5 h-3.5 text-[#005FB8]" />
                  </span>
                  <p className="text-[#6B7280]">Tap the three dots (⋮) in the top right corner of Chrome and select <strong>Install App</strong> or <strong>Add to Home screen</strong>.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-6 h-6 rounded-full bg-black text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </div>
                <div>
                  <span className="font-bold text-[#111827] flex items-center gap-1.5 mb-0.5">
                    Launch from Home Screen
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </span>
                  <p className="text-[#6B7280]">Open MutualPool from your app drawer like a native app anytime!</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {deferredPrompt ? (
            <button
              onClick={handleNativeInstall}
              className="w-full py-3 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Click to Install MutualPool App Now</span>
            </button>
          ) : (
            <button
              onClick={() => {
                if (onOpenRegister) onOpenRegister();
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <span>Create Account & Launch Web App</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-colors"
          >
            Close Guide
          </button>
        </div>

        {/* FDIC Footer */}
        <div className="mt-4 pt-3 border-t border-gray-100 text-center flex items-center justify-center gap-1.5 text-[10px] text-gray-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Pass-Through FDIC Insured up to $250,000 per user via Stripe Treasury</span>
        </div>

      </div>
    </div>
  );
};
