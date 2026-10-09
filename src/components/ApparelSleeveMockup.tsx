import React, { useState, useEffect, useId, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  Megaphone, Download, ExternalLink, QrCode, Scan, Copy, Check, 
  Sparkles, RefreshCw, Globe, Sun, Moon, Eye, Maximize2, 
  Palette, Layers, ShieldCheck, Camera, Compass, Shirt
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { getSleeveQrUrl, useSiteUrl } from '../utils/siteUrl';
import { EnvironmentSwitcherModal } from './EnvironmentSwitcherModal';

export interface ApparelSleeveMockupProps {
  targetUrl?: string;
  brandName?: string;
  sleeveText?: string;
  accentColor?: string;
  fabricColor?: string;
  onOpenScanner?: () => void;
  className?: string;
  compact?: boolean;
}

const FABRIC_COLOR_OPTIONS = [
  { id: 'black', name: 'Stealth Black', hex: '#090d16', darkText: false, isDark: true },
  { id: 'charcoal', name: 'Charcoal Grey', hex: '#1e293b', darkText: false, isDark: true },
  { id: 'navy', name: 'Fleet Navy', hex: '#0f172a', darkText: false, isDark: true },
  { id: 'slate', name: 'Slate Heather', hex: '#334155', darkText: false, isDark: true },
  { id: 'yellow', name: 'Safety Neon Gold', hex: '#eab308', darkText: true, isDark: false },
  { id: 'white', name: 'Courier White', hex: '#f8fafc', darkText: true, isDark: false },
];

const ACCENT_COLOR_OPTIONS = [
  { id: 'yellow', name: 'Safety Gold', hex: '#FACC15' },
  { id: 'orange', name: 'Fluorescent Orange', hex: '#FB923C' },
  { id: 'cyan', name: 'Electric Cyan', hex: '#38BDF8' },
  { id: 'lime', name: 'Lime Volt', hex: '#A3E635' },
  { id: 'white', name: 'Pure White', hex: '#FFFFFF' },
];

export const ApparelSleeveMockup: React.FC<ApparelSleeveMockupProps> = ({
  targetUrl,
  brandName = 'MutualPool Fleet',
  sleeveText = 'ADVERTISE WITH US',
  accentColor: initialAccentColor = '#FACC15',
  fabricColor: initialFabricColor = '#090d16',
  onOpenScanner,
  className = '',
  compact = false,
}) => {
  const toast = useToast();
  const inputId = useId();
  const mockupRef = useRef<HTMLDivElement>(null);
  const { siteUrl, isProduction, environment } = useSiteUrl();

  // Active state
  const defaultUrl = getSleeveQrUrl();
  const [currentUrl, setCurrentUrl] = useState<string>(targetUrl || defaultUrl);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [selectedFabricHex, setSelectedFabricHex] = useState<string>(initialFabricColor);
  const [selectedAccentHex, setSelectedAccentHex] = useState<string>(initialAccentColor);
  const [activeBrandName, setActiveBrandName] = useState<string>(brandName);
  
  // Visual modes
  const [viewAngle, setViewAngle] = useState<'wearer' | 'technical' | 'scan_macro'>('wearer');
  const [lightingMode, setLightingMode] = useState<'day' | 'night'>('day');
  const [isScanningActive, setIsScanningActive] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showEnvModal, setShowEnvModal] = useState<boolean>(false);

  // Sync external props
  useEffect(() => {
    if (targetUrl) setCurrentUrl(targetUrl);
  }, [targetUrl]);

  useEffect(() => {
    if (brandName) setActiveBrandName(brandName);
  }, [brandName]);

  // If site environment changes and user hasn't explicitly overridden URL
  useEffect(() => {
    if (!targetUrl) {
      setCurrentUrl(getSleeveQrUrl());
    }
  }, [siteUrl, targetUrl]);

  // Generate QR Code matrix
  useEffect(() => {
    let isCancelled = false;

    const generateQR = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(currentUrl, {
          width: 600,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });

        if (!isCancelled) {
          setQrDataUrl(dataUrl);
        }
      } catch (err) {
        console.error('Failed to generate sleeve QR code:', err);
      }
    };

    generateQR();

    return () => {
      isCancelled = true;
    };
  }, [currentUrl]);

  const activeFabric = FABRIC_COLOR_OPTIONS.find(f => f.hex === selectedFabricHex) || FABRIC_COLOR_OPTIONS[0];

  const handleCopyUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      toast.success('Sleeve target URL copied to clipboard!', { title: 'Link Copied' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSimulateScan = () => {
    setIsScanningActive(true);
    toast.info(`Optical scan locked onto QR target: ${currentUrl}`, { title: 'Camera Focus Locked' });
    setTimeout(() => {
      setIsScanningActive(false);
      toast.success(`Redirecting to: ${currentUrl}`, { title: 'Scan Decoded Successfully!' });
    }, 2400);
  };

  const handleExportMockup = async () => {
    setIsExporting(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill background
      ctx.fillStyle = lightingMode === 'night' ? '#020617' : '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Sleeve body background
      const sleeveX = 240;
      const sleeveY = 120;
      const sleeveWidth = 720;
      const sleeveHeight = 1360;

      // Sleeve tapered shape
      ctx.fillStyle = selectedFabricHex;
      ctx.beginPath();
      ctx.moveTo(sleeveX, sleeveY);
      ctx.lineTo(sleeveX + sleeveWidth, sleeveY);
      ctx.lineTo(sleeveX + sleeveWidth - 60, sleeveY + sleeveHeight - 80);
      ctx.lineTo(sleeveX + 60, sleeveY + sleeveHeight - 80);
      ctx.closePath();
      ctx.fill();

      // Ribbed cuff
      ctx.fillStyle = '#05070c';
      ctx.fillRect(sleeveX + 60, sleeveY + sleeveHeight - 80, sleeveWidth - 120, 80);

      // White isolation plate for QR Code
      if (qrDataUrl) {
        const img = new Image();
        img.src = qrDataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const qrBoxSize = 360;
        const qrBoxX = (canvas.width - qrBoxSize) / 2;
        const qrBoxY = sleeveY + 380;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(qrBoxX - 20, qrBoxY - 20, qrBoxSize + 40, qrBoxSize + 40, 24);
        ctx.fill();

        ctx.drawImage(img, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);
      }

      // Megaphone badge
      const centerX = canvas.width / 2;
      ctx.fillStyle = selectedAccentHex;
      ctx.beginPath();
      ctx.arc(centerX, sleeveY + 120, 48, 0, Math.PI * 2);
      ctx.fill();

      // Text: ADVERTISE WITH US
      ctx.textAlign = 'center';
      ctx.fillStyle = activeFabric.darkText ? '#0f172a' : '#ffffff';
      ctx.font = '900 68px Inter, system-ui, sans-serif';
      ctx.fillText('ADVERTISE', centerX, sleeveY + 240);

      ctx.fillStyle = selectedAccentHex;
      ctx.font = '900 76px Inter, system-ui, sans-serif';
      ctx.fillText('WITH US', centerX, sleeveY + 320);

      // Sponsor Brand
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 28px Inter, system-ui, sans-serif';
      ctx.fillText(`SPONSORED BY ${activeBrandName.toUpperCase()}`, centerX, sleeveY + 840);

      ctx.font = '500 24px Inter, system-ui, sans-serif';
      ctx.fillText(`TARGET URL: ${currentUrl}`, centerX, sleeveY + 880);

      // Watermark header
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 32px Inter, system-ui, sans-serif';
      ctx.fillText('MUTUALPOOL • APPAREL SLEEVE PRINT PROOF MOCK-UP', centerX, 60);

      const link = document.createElement('a');
      link.download = `mutualpool_apparel_sleeve_mockup_${activeBrandName.toLowerCase().replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.success('High-resolution apparel sleeve mock-up exported!', { title: 'Download Ready' });
    } catch (err) {
      console.error('Failed to export mockup canvas:', err);
      toast.error('Failed to export mockup image.', { title: 'Export Error' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-slate-100 ${className}`}>
      
      {/* Visualizer Top Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        
        {/* Title & Badges */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-400 text-slate-950 font-black shadow-md flex items-center justify-center">
            <Shirt className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-base sm:text-lg text-white tracking-tight">
                Apparel Sleeve Mock-up Visualization
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase tracking-wider">
                Forearm QR Placement
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Check className="w-2.5 h-2.5" />
                Fourthwall Compliant
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live visualization of the scannable courier forearm sleeve featuring <strong className="text-amber-400">Advertise with us</strong> and dynamic target URL.
            </p>
          </div>
        </div>

        {/* Quick Tools & Environment Indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowEnvModal(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Dynamic Environment Selector"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>{isProduction ? 'PROD (themutualpool.com)' : 'DEV (mutual-pool.vercel.app)'}</span>
          </button>

          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Scan className="w-3.5 h-3.5 text-blue-200" />
              <span>Camera Scanner</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportMockup}
            disabled={isExporting}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>{isExporting ? 'Exporting...' : 'Export Mockup'}</span>
          </button>
        </div>

      </div>

      {/* Main Visualizer Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        
        {/* Left / Center Viewport: The Apparel Sleeve Mockup Canvas */}
        <div className={`lg:col-span-7 p-6 sm:p-8 flex flex-col items-center justify-center relative overflow-hidden transition-colors ${
          lightingMode === 'night' 
            ? 'bg-gradient-to-b from-slate-950 via-[#030712] to-black' 
            : 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950'
        }`}>
          
          {/* Subtle Studio Backdrop Grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

          {/* Viewport Floating Mode Pills */}
          <div className="w-full flex items-center justify-between z-10 mb-4 gap-2 flex-wrap">
            
            {/* Perspective View Selector */}
            <div className="bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 flex items-center text-xs font-bold text-slate-400">
              <button
                type="button"
                onClick={() => setViewAngle('wearer')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewAngle === 'wearer' ? 'bg-[#005FB8] text-white shadow-xs' : 'hover:text-slate-200'
                }`}
              >
                <Compass className="w-3 h-3" />
                <span>Forearm Wearer View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewAngle('technical')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewAngle === 'technical' ? 'bg-[#005FB8] text-white shadow-xs' : 'hover:text-slate-200'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Print Spec Flat Lay</span>
              </button>
              <button
                type="button"
                onClick={() => setViewAngle('scan_macro')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewAngle === 'scan_macro' ? 'bg-[#005FB8] text-white shadow-xs' : 'hover:text-slate-200'
                }`}
              >
                <Camera className="w-3 h-3" />
                <span>Scan Macro View</span>
              </button>
            </div>

            {/* Lighting Mode Toggle */}
            <div className="bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 flex items-center text-xs font-bold text-slate-400">
              <button
                type="button"
                onClick={() => setLightingMode('day')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  lightingMode === 'day' ? 'bg-amber-400 text-slate-950 shadow-xs' : 'hover:text-slate-200'
                }`}
                title="Studio Sunlight Lighting"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLightingMode('night')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  lightingMode === 'night' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:text-slate-200'
                }`}
                title="Night Courier Delivery Lighting"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

          {/* THE MOCK-UP APPAREL SLEEVE */}
          <div 
            ref={mockupRef}
            className={`w-full max-w-sm relative transition-all duration-500 ease-out flex flex-col items-center ${
              viewAngle === 'scan_macro' ? 'scale-110 sm:scale-125' : 'scale-100'
            }`}
          >
            
            {/* Technical Measurement Guides Overlay (Visible in Technical View) */}
            {viewAngle === 'technical' && (
              <div className="absolute -top-7 left-0 right-0 flex items-center justify-between text-[10px] font-mono text-cyan-400 border-b border-dashed border-cyan-500/40 pb-1 z-20">
                <span>&larr; ELBOW JOINT SEAM &larr;</span>
                <span className="bg-cyan-950/80 px-2 rounded border border-cyan-800">PRINT SAFE ZONE (12" x 4")</span>
                <span>&rarr; WRIST RIB CUFF &rarr;</span>
              </div>
            )}

            {/* Main Garment Forearm Sleeve Container */}
            <div 
              className="w-full relative rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 border border-slate-800/80 flex flex-col items-center"
              style={{
                backgroundColor: selectedFabricHex,
                minHeight: '490px',
                clipPath: viewAngle === 'technical' 
                  ? 'none' 
                  : 'polygon(12% 0%, 88% 0%, 96% 92%, 92% 100%, 8% 100%, 4% 92%)',
                boxShadow: lightingMode === 'night'
                  ? '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(250, 204, 21, 0.15)'
                  : '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 10px 30px rgba(0, 0, 0, 0.4)'
              }}
            >
              
              {/* Photorealistic Fabric Texture / Textile Weave Overlay */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay"
                style={{
                  backgroundImage: `radial-gradient(circle at 50% 30%, rgba(255,255,255,0.2) 0%, transparent 70%), linear-gradient(90deg, rgba(0,0,0,0.5) 0%, rgba(255,255,255,0.08) 50%, rgba(0,0,0,0.6) 100%)`
                }}
              />

              {/* Realistic Forearm Muscle & Fabric Curvature Lighting (Cylindrical highlight) */}
              <div className="absolute top-0 bottom-0 left-1/4 right-1/4 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

              {/* Authentic Garment Double-Needle Seams on Left & Right */}
              <div className="absolute top-0 bottom-0 left-6 w-0.5 border-l-2 border-dashed border-slate-600/40 pointer-events-none" />
              <div className="absolute top-0 bottom-0 right-6 w-0.5 border-r-2 border-dashed border-slate-600/40 pointer-events-none" />

              {/* Night Reflective 3M Safety Trim (if night mode) */}
              {lightingMode === 'night' && (
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-slate-400 via-white to-slate-400 shadow-[0_0_12px_#ffffff] opacity-90" />
              )}

              {/* Upper Forearm Content */}
              <div className="w-full pt-8 pb-4 px-6 flex flex-col items-center text-center relative z-10 select-none">
                
                {/* Megaphone Emblem Badge (Matching user's photo) */}
                <div className="relative mb-3.5 group/icon cursor-pointer transition-transform duration-300 hover:scale-110">
                  <div 
                    className="p-3.5 rounded-full shadow-xl flex items-center justify-center transition-colors relative"
                    style={{ 
                      backgroundColor: selectedAccentHex,
                      boxShadow: `0 0 24px ${selectedAccentHex}66`
                    }}
                  >
                    <Megaphone className="w-7 h-7 text-slate-950 fill-slate-950" />
                    {lightingMode === 'night' && (
                      <span className="absolute -inset-1 rounded-full border border-white/60 animate-ping opacity-40 pointer-events-none" />
                    )}
                  </div>
                </div>

                {/* THE ICONIC HEADLINE: "ADVERTISE WITH US" */}
                <div className="mb-4 tracking-tighter leading-none">
                  <span 
                    className="block font-black text-3xl sm:text-4xl uppercase tracking-tight drop-shadow-md transition-colors"
                    style={{ color: activeFabric.darkText ? '#0f172a' : '#ffffff' }}
                  >
                    ADVERTISE
                  </span>
                  <span 
                    className="block font-black text-3xl sm:text-4xl uppercase tracking-tight mt-1 drop-shadow-lg transition-colors"
                    style={{ 
                      color: selectedAccentHex,
                      textShadow: lightingMode === 'night' ? `0 0 20px ${selectedAccentHex}aa` : 'none'
                    }}
                  >
                    {sleeveText.includes('WITH US') ? 'WITH US' : sleeveText}
                  </span>
                </div>

                {/* HIGH-PRECISION GENERATED QR CODE */}
                <div className="relative my-2">
                  
                  {/* Camera Scan Simulation Reticle Overlay */}
                  {isScanningActive && (
                    <div className="absolute -inset-4 z-30 pointer-events-none">
                      {/* Viewfinder corner brackets */}
                      <div className="absolute top-0 left-0 w-5 h-5 border-t-3 border-l-3 border-amber-400" />
                      <div className="absolute top-0 right-0 w-5 h-5 border-t-3 border-r-3 border-amber-400" />
                      <div className="absolute bottom-0 left-0 w-5 h-5 border-b-3 border-l-3 border-amber-400" />
                      <div className="absolute bottom-0 right-0 w-5 h-5 border-b-3 border-r-3 border-amber-400" />
                      {/* Laser scan line animation */}
                      <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_15px_#facc15] animate-bounce" />
                    </div>
                  )}

                  {/* Clean High-Contrast White Substrate Pill */}
                  <div className="p-3 bg-white rounded-2xl shadow-2xl border-2 border-slate-200 relative group cursor-pointer transition-transform hover:scale-102">
                    
                    {qrDataUrl ? (
                      <img 
                        src={qrDataUrl} 
                        alt="Scannable Apparel Sleeve QR Code" 
                        className="w-36 h-36 sm:w-44 sm:h-44 object-contain block mx-auto rounded-lg"
                      />
                    ) : (
                      <div className="w-36 h-36 sm:w-44 sm:h-44 bg-slate-200 animate-pulse rounded-lg flex items-center justify-center">
                        <QrCode className="w-10 h-10 text-slate-400" />
                      </div>
                    )}

                    {/* Camera Instruction Micro-Tag */}
                    <div className="mt-1.5 flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-900 font-mono">
                      <Camera className="w-2.5 h-2.5 text-amber-500" />
                      <span>Scan with phone camera</span>
                    </div>

                    {/* Hover Quick Action to Open Target */}
                    <a
                      href={currentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity p-2 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-5 h-5 text-amber-400 mb-1" />
                      <span className="text-[11px] font-bold">Open Target URL</span>
                      <span className="text-[9px] text-slate-300 font-mono truncate max-w-full px-2 mt-0.5">
                        {currentUrl}
                      </span>
                    </a>

                  </div>

                </div>

                {/* SPONSOR BRAND TAG & AMBASSADOR CALLOUT */}
                <div className="mt-3.5 space-y-1">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-300/90 font-mono flex items-center justify-center gap-1">
                    <span>SPONSORED BY</span>
                    <span 
                      className="px-1.5 py-0.5 rounded font-black tracking-tight"
                      style={{ 
                        backgroundColor: `${selectedAccentHex}22`,
                        color: selectedAccentHex,
                        border: `1px solid ${selectedAccentHex}55`
                      }}
                    >
                      {activeBrandName.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="text-[9px] font-medium text-slate-400 max-w-xs leading-tight">
                    Every courier shift generates an estimated 1,500 - 3,200 street-level pedestrian impressions.
                  </div>
                </div>

              </div>

              {/* Lower Ribbed Knit Wrist Cuff */}
              <div 
                className="w-full mt-auto py-3 px-4 border-t border-slate-700/80 flex items-center justify-between relative z-10"
                style={{
                  backgroundColor: '#040711',
                  backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,255,255,0.06) 4px, rgba(255,255,255,0.06) 8px)'
                }}
              >
                <div className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                  Ribbed Elastic Cuff
                </div>
                <div className="flex items-center gap-1 text-[9px] font-mono text-amber-400">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>300 DPI PROOF</span>
                </div>
              </div>

            </div>

            {/* Simulated Pedestrian Scan Button */}
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSimulateScan}
                disabled={isScanningActive}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Scan className="w-4 h-4 text-slate-950" />
                <span>{isScanningActive ? 'Optical Scan Active...' : 'Simulate Phone Camera Scan'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>

          </div>

        </div>

        {/* Right Configuration & Print Spec Panel */}
        <div className="lg:col-span-5 p-6 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between space-y-6">
          
          <div className="space-y-5">
            
            {/* 1. Apparel Fabric Color Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-amber-400" />
                  <span>Apparel Fabric Color</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">{activeFabric.name}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {FABRIC_COLOR_OPTIONS.map((fab) => (
                  <button
                    key={fab.id}
                    type="button"
                    onClick={() => setSelectedFabricHex(fab.hex)}
                    className={`h-11 rounded-xl border flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                      selectedFabricHex === fab.hex 
                        ? 'border-amber-400 ring-2 ring-amber-400/30 scale-105' 
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                    style={{ backgroundColor: fab.hex }}
                    title={fab.name}
                  >
                    {selectedFabricHex === fab.hex && (
                      <Check className={`w-4 h-4 ${fab.isDark ? 'text-amber-400' : 'text-slate-950'}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Headline & Accent Color Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Branding Accent Color</span>
                </label>
                <span className="text-[10px] text-amber-400 font-mono">High-Vis Print Ink</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_COLOR_OPTIONS.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedAccentHex(acc.hex)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                      selectedAccentHex === acc.hex
                        ? 'border-white text-white bg-slate-800 ring-1 ring-white'
                        : 'border-slate-800 text-slate-400 bg-slate-950 hover:text-slate-200'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.hex }} />
                    <span>{acc.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Destination Website URL Field (Dynamic Environment Resolver) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor={inputId} className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-amber-400" />
                  <span>Encoded Destination Website URL</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowEnvModal(true)}
                    className="text-[10px] font-bold text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>{isProduction ? 'Production' : 'Development'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentUrl(defaultUrl)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
                    title="Reset to default dynamic sleeve URL"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  id={inputId}
                  type="text"
                  value={currentUrl}
                  onChange={(e) => setCurrentUrl(e.target.value)}
                  placeholder="https://themutualpool.com/?ref=sleeve_qr"
                  className="w-full px-3.5 py-2.5 pr-20 text-xs font-mono bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                  Dynamic Environment: <span className="text-amber-400 font-bold">{environment}</span>
                </span>
                <span className="text-emerald-400 font-mono text-[10px]">
                  ✓ Optical Readability Grade: A+
                </span>
              </div>
            </div>

            {/* 4. Sponsor Brand Name Input */}
            <div>
              <label className="text-xs font-bold text-slate-200 block mb-1.5">
                Sponsor Brand Name (Printed on Sleeve)
              </label>
              <input
                type="text"
                value={activeBrandName}
                onChange={(e) => setActiveBrandName(e.target.value)}
                placeholder="e.g. Acme Corp, Red Bull, MutualPool"
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 5. Production & Print Technical Specification */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-200 font-bold">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Fourthwall Print Standards</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">DTG / Poly-Screen</span>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                <li>300 DPI high-resolution vector substrate isolation</li>
                <li>Engineered specifically for forearm motion on bike/scooter</li>
                <li>Weatherproof inks tested for rain, sun, and headlight glare</li>
                <li>Universal smartphone camera auto-focus distance: 1.5 - 6.0 feet</li>
              </ul>
            </div>

          </div>

          {/* Bottom Action Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleExportMockup}
              disabled={isExporting}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-slate-300" />
              <span>{isExporting ? 'Generating Mockup...' : 'Download Sleeve Mock-up (PNG)'}</span>
            </button>

            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Scan className="w-4 h-4 text-slate-950" />
                <span>Test With Camera</span>
              </button>
            )}
          </div>

        </div>

      </div>

      {/* Environment Switcher Modal */}
      <EnvironmentSwitcherModal
        isOpen={showEnvModal}
        onClose={() => setShowEnvModal(false)}
      />

    </div>
  );
};
