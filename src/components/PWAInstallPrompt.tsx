import React, { useState, useEffect } from "react";
import { Download, Sparkles, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    // The bottom-right corner belongs to the voice assistant (bottom-6) and the
    // chat launcher stacked above it (bottom-[88px]). Keep this banner out of that
    // column: bottom-left on wider screens, and above both on phones.
    <div className="fixed z-50 bottom-[148px] left-4 right-4 sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-md bg-white border border-[#DDE1E6] rounded-xl p-4 shadow-xl flex items-center justify-between gap-3 text-xs text-[#111827]">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-blue-50 text-[#005FB8] shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-[#111827] block">
            Install MutualPool
          </span>
          <span className="text-[11px] text-[#6B7280]">
            Add to Home Screen for offline access & instant rotation alerts.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleInstallClick}
          className="px-3 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install</span>
        </button>
        <button
          onClick={() => setShowBanner(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
