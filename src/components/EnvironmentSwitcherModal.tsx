import React, { useState } from 'react';
import { 
  Globe, Check, Copy, ExternalLink, RefreshCw, Server, Laptop, 
  Sparkles, ShieldCheck, QrCode, Share2, HelpCircle, ArrowRight, X,
  Radio, Layers, Terminal
} from 'lucide-react';
import { 
  useSiteUrl, 
  SiteUrlMode, 
  DEFAULT_DEV_URL, 
  DEFAULT_PROD_URL,
  getSleeveQrUrl,
  getPodShareUrl,
  getTrustedCircleInviteUrl
} from '../utils/siteUrl';
import { useToast } from '../context/ToastContext';

interface EnvironmentSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EnvironmentSwitcherModal: React.FC<EnvironmentSwitcherModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    siteUrl,
    environment,
    isProduction,
    isDevelopment,
    isVercel,
    isSimulated,
    activeMode,
    configuredDevUrl,
    configuredProdUrl,
    switchMode,
    setCustomProductionUrl,
    resetToAuto,
  } = useSiteUrl();

  const toast = useToast();
  const [customInput, setCustomInput] = useState(configuredProdUrl);
  const [showDeploymentGuide, setShowDeploymentGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(label);
    toast.success(`${label} copied to clipboard!`, { title: 'Copied' });
    setTimeout(() => {
      setCopiedUrl(null);
    }, 2500);
  };

  const handleSaveCustomProd = (e: React.FormEvent) => {
    e.preventDefault();
    let url = customInput.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    setCustomProductionUrl(url);
    switchMode('production');
    toast.success(`Production domain saved as ${url}`, { title: 'Production URL Updated' });
  };

  // Sample generated URLs for live preview
  const previewSleeveUrl = getSleeveQrUrl({ utmSource: 'apparel_sleeve', utmCampaign: 'advertise_with_us' });
  const previewInviteUrl = getTrustedCircleInviteUrl('CIRC-7749', 'demo-courier-1');
  const previewPodUrl = getPodShareUrl('pod-courier-sf-1', 'INV-5521');

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-[#0B2545] to-[#005FB8] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-amber-300">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">Dynamic Site URL & Deployment</h2>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  isProduction 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {environment.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-blue-100/80">
                Switch between Development (Vercel) & Production for QR codes, deep links, and invites
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(85vh-80px)] overflow-y-auto text-slate-800">
          {/* Active Resolved URL Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Active Base URL (In-App Resolver)
              </span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-medium">Mode:</span>
                <span className="font-mono font-bold text-slate-800 px-2 py-0.5 rounded bg-white border border-slate-200 capitalize">
                  {activeMode === 'auto' ? 'Auto-Detect (Origin)' : `${activeMode} Override`}
                </span>
                {isSimulated && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                    Simulated
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-300 shadow-inner">
              <span className="text-emerald-500 font-mono text-sm select-none">●</span>
              <span className="font-mono font-bold text-sm text-slate-900 truncate flex-1 select-all">
                {siteUrl}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(siteUrl, 'Base URL')}
                className="px-2.5 py-1 text-xs font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {copiedUrl === 'Base URL' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl === 'Base URL' ? 'Copied' : 'Copy'}</span>
              </button>
              <a
                href={siteUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 rounded-md text-slate-500 hover:text-[#005FB8] transition-colors"
                title="Open base URL in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Quick Environment Mode Switcher */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                1-Click Environment Switcher
              </label>
              {isSimulated && (
                <button
                  type="button"
                  onClick={() => {
                    resetToAuto();
                    toast.info('Restored dynamic browser auto-detection (window.location.origin).');
                  }}
                  className="text-xs font-bold text-[#005FB8] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset to Auto-Detect</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: Development / Vercel Preview */}
              <button
                type="button"
                onClick={() => {
                  switchMode('development');
                  toast.success('Switched to Development environment URL.', { title: 'Environment Changed' });
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                  activeMode === 'development' || (activeMode === 'auto' && siteUrl === DEFAULT_DEV_URL)
                    ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-1 ring-amber-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                    <Laptop className="w-3.5 h-3.5 text-amber-600" />
                    <span>Development (Vercel)</span>
                  </div>
                  {(activeMode === 'development' || (activeMode === 'auto' && siteUrl === DEFAULT_DEV_URL)) && (
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500 text-slate-950">
                      Active
                    </span>
                  )}
                </div>
                <p className="font-mono text-[11px] text-slate-600 truncate">
                  {DEFAULT_DEV_URL}
                </p>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Current development URL issued by Vercel
                </span>
              </button>

              {/* Option 2: Production Domain */}
              <button
                type="button"
                onClick={() => {
                  switchMode('production');
                  toast.success(`Switched to Production environment URL: ${configuredProdUrl}`, { title: 'Environment Changed' });
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                  activeMode === 'production' || (activeMode === 'auto' && siteUrl === configuredProdUrl)
                    ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-600'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900">
                    <Server className="w-3.5 h-3.5 text-blue-600" />
                    <span>Production Launch</span>
                  </div>
                  {(activeMode === 'production' || (activeMode === 'auto' && siteUrl === configuredProdUrl)) && (
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-[#005FB8] text-white">
                      Active
                    </span>
                  )}
                </div>
                <p className="font-mono text-[11px] text-slate-600 truncate">
                  {configuredProdUrl}
                </p>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Target domain after launch & DNS mapping
                </span>
              </button>

              {/* Option 3: Localhost */}
              <button
                type="button"
                onClick={() => {
                  switchMode('localhost');
                  toast.info('Switched to Localhost dev server URL.', { title: 'Localhost Active' });
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  activeMode === 'localhost'
                    ? 'border-purple-500 bg-purple-50/70 shadow-sm ring-1 ring-purple-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-purple-900">
                    <Terminal className="w-3.5 h-3.5 text-purple-600" />
                    <span>Localhost Dev Server</span>
                  </div>
                  {activeMode === 'localhost' && (
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-purple-600 text-white">
                      Active
                    </span>
                  )}
                </div>
                <p className="font-mono text-[11px] text-slate-600 truncate">
                  http://localhost:3000
                </p>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  For local Vite development & testing
                </span>
              </button>

              {/* Option 4: Live Auto-Detect (Dynamic window.location.origin) */}
              <button
                type="button"
                onClick={() => {
                  resetToAuto();
                  toast.success('Dynamic browser auto-detect enabled! All deep links match the active host.', { title: 'Auto-Detect Active' });
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  activeMode === 'auto'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-600'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Dynamic Auto-Detect</span>
                  </div>
                  {activeMode === 'auto' && (
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-600 text-white">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="font-mono text-[11px] text-slate-600 truncate">
                  {typeof window !== 'undefined' ? window.location.origin : 'Dynamic Host Origin'}
                </p>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Zero config: automatically updates on any domain
                </span>
              </button>
            </div>
          </div>

          {/* Custom Production Domain Setting Form */}
          <form onSubmit={handleSaveCustomProd} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label htmlFor="custom-prod-input" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-[#005FB8]" />
                <span>Configure Your Production Domain</span>
              </label>
              <span className="text-[11px] text-slate-500">
                (Will be used when switching to Production)
              </span>
            </div>

            <div className="flex gap-2">
              <input
                id="custom-prod-input"
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="https://themutualpool.com or https://yourdomain.com"
                className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#005FB8] focus:border-transparent text-slate-800"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg bg-[#005FB8] hover:bg-blue-700 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer"
              >
                Save & Set Active
              </button>
            </div>
          </form>

          {/* Live Generated Deep Link & QR Code Previews */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-amber-500" />
                <span>Live Deep Link Previews (Using Active URL)</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Verify QR codes & invite links dynamically match
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {/* Sleeve QR Code Target Link */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>Apparel Sleeve QR Code Target:</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 truncate mt-0.5">
                    {previewSleeveUrl}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(previewSleeveUrl, 'Sleeve QR Link')}
                  className="px-2 py-1 text-[11px] font-bold rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 shrink-0 cursor-pointer"
                >
                  {copiedUrl === 'Sleeve QR Link' ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Trusted Circle Invite Link */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>Trusted Circle Invite Link:</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 truncate mt-0.5">
                    {previewInviteUrl}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(previewInviteUrl, 'Invite Link')}
                  className="px-2 py-1 text-[11px] font-bold rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 shrink-0 cursor-pointer"
                >
                  {copiedUrl === 'Invite Link' ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Savings Pod Deep Link */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    <span>Savings Pod Deep Link:</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 truncate mt-0.5">
                    {previewPodUrl}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(previewPodUrl, 'Pod Share Link')}
                  className="px-2 py-1 text-[11px] font-bold rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 shrink-0 cursor-pointer"
                >
                  {copiedUrl === 'Pod Share Link' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Vercel & Production Launch Explanation Toggle */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDeploymentGuide(!showDeploymentGuide)}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left font-bold text-xs text-slate-800 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#005FB8]" />
                <span>How the Dynamic URL Switches from Vercel to Production</span>
              </div>
              <span className="text-[11px] text-[#005FB8] font-bold">
                {showDeploymentGuide ? 'Hide Guide ▲' : 'Read Guide ▼'}
              </span>
            </button>

            {showDeploymentGuide && (
              <div className="p-4 bg-white text-xs text-slate-600 space-y-3 border-t border-slate-200">
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-[#005FB8] font-black text-xs flex items-center justify-center">1</span>
                    <span>Development Phase (Vercel Preview)</span>
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-600 pl-6.5">
                    While in development on Vercel, your app is hosted at <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-slate-800">https://mutual-pool.vercel.app</code>. The dynamic URL utility automatically sets <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-slate-800">window.location.origin</code> to this URL. All courier sleeve QR codes, email notifications, and invite links generate with this domain.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-[#005FB8] font-black text-xs flex items-center justify-center">2</span>
                    <span>Production Launch (Zero Code Changes Needed)</span>
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-600 pl-6.5">
                    When you are ready to launch and add your custom domain (e.g. <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-slate-800">themutualpool.com</code>) in Vercel (<span className="font-semibold">Project Settings &rarr; Domains</span>), you do <span className="font-bold text-slate-900">not need to change any code</span>. The dynamic resolver immediately reads the new domain from <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-slate-800">window.location.origin</code>!
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-[#005FB8] font-black text-xs flex items-center justify-center">3</span>
                    <span>Optional Environment Variables in Vercel</span>
                  </h4>
                  <div className="pl-6.5 space-y-1">
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      If you ever need to override URLs at build time or for server functions, you can configure these in Vercel Project Settings:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                      <li><code className="font-mono font-bold text-slate-800">VITE_PROD_URL</code>: Set to <code className="font-mono">https://themutualpool.com</code> (or your custom domain)</li>
                      <li><code className="font-mono font-bold text-slate-800">VITE_DEV_URL</code>: Set to <code className="font-mono">https://mutual-pool.vercel.app</code></li>
                      <li><code className="font-mono font-bold text-slate-800">VITE_SITE_URL</code>: Force a single URL override across all environments</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>State persisted in local browser storage</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
