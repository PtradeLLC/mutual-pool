import React, { useState } from 'react';
import { Globe, Laptop, Server, Terminal, Sparkles, ChevronRight } from 'lucide-react';
import { useSiteUrl } from '../utils/siteUrl';
import { EnvironmentSwitcherModal } from './EnvironmentSwitcherModal';

interface SiteUrlBadgeProps {
  variant?: 'pill' | 'button' | 'card' | 'minimal';
  className?: string;
  showModalOnClick?: boolean;
}

export const SiteUrlBadge: React.FC<SiteUrlBadgeProps> = ({
  variant = 'pill',
  className = '',
  showModalOnClick = true,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const {
    siteUrl,
    environment,
    isProduction,
    isDevelopment,
    isSimulated,
    activeMode,
    configuredDevUrl,
    configuredProdUrl,
  } = useSiteUrl();

  const handleClick = (e: React.MouseEvent) => {
    if (showModalOnClick) {
      e.preventDefault();
      e.stopPropagation();
      setModalOpen(true);
    }
  };

  const getIcon = () => {
    if (activeMode === 'development') return <Laptop className="w-3 h-3 text-amber-500" />;
    if (activeMode === 'production') return <Server className="w-3 h-3 text-blue-500" />;
    if (activeMode === 'localhost') return <Terminal className="w-3 h-3 text-purple-500" />;
    return <Sparkles className="w-3 h-3 text-emerald-500" />;
  };

  const displayHost = siteUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  return (
    <>
      {variant === 'pill' && (
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
            isProduction
              ? 'bg-blue-50/90 hover:bg-blue-100 text-[#005FB8] border-blue-200'
              : 'bg-amber-50/90 hover:bg-amber-100 text-amber-900 border-amber-200'
          } ${className}`}
          title={`Active Site URL: ${siteUrl} (${environment.toUpperCase()}). Click to switch or configure.`}
        >
          {getIcon()}
          <span className="truncate max-w-[150px] font-mono text-[10px]">{displayHost}</span>
          <span className={`text-[9px] px-1 py-0.2 rounded font-black uppercase tracking-wider ${
            isProduction ? 'bg-blue-200 text-blue-900' : 'bg-amber-200 text-amber-950'
          }`}>
            {isProduction ? 'PROD' : 'DEV'}
          </span>
          {isSimulated && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Simulated mode active" />
          )}
        </button>
      )}

      {variant === 'button' && (
        <button
          type="button"
          onClick={handleClick}
          className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            isProduction
              ? 'bg-blue-50 hover:bg-blue-100/80 border-blue-200 text-blue-950'
              : 'bg-amber-50 hover:bg-amber-100/80 border-amber-200 text-amber-950'
          } ${className}`}
        >
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${isProduction ? 'bg-blue-600 text-white' : 'bg-amber-500 text-slate-950'}`}>
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold">Dynamic Site URL</span>
                <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                  isProduction ? 'bg-blue-200 text-blue-900' : 'bg-amber-200 text-amber-900'
                }`}>
                  {environment.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-600 truncate max-w-[200px]">
                {siteUrl}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      )}

      {variant === 'minimal' && (
        <button
          type="button"
          onClick={handleClick}
          className={`text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors ${className}`}
        >
          <Globe className="w-3 h-3 text-[#005FB8]" />
          <span className="font-mono text-[10px]">{displayHost}</span>
          <span className="text-[9px] text-slate-400 uppercase">({environment})</span>
        </button>
      )}

      {variant === 'card' && (
        <div className={`p-4 rounded-xl border bg-white ${className}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#005FB8]" />
              <span className="text-xs font-bold text-slate-800">Site URL Environment Resolver</span>
            </div>
            <button
              type="button"
              onClick={handleClick}
              className="text-xs font-bold text-[#005FB8] hover:underline cursor-pointer"
            >
              Switch Mode &rarr;
            </button>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-slate-800 truncate mr-2">{siteUrl}</span>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shrink-0 ${
              isProduction ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'
            }`}>
              {environment}
            </span>
          </div>
        </div>
      )}

      {showModalOnClick && (
        <EnvironmentSwitcherModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
};
