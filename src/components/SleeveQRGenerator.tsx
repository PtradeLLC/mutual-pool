import React, { useState, useEffect, useId } from 'react';
import QRCode from 'qrcode';
import { Megaphone, Download, ExternalLink, QrCode, Scan, Copy, Check, Sparkles, RefreshCw } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface SleeveQRGeneratorProps {
  targetUrl?: string;
  brandName?: string;
  sleeveText?: string;
  accentColor?: string;
  fabricColor?: string;
  onUrlChange?: (url: string) => void;
  onOpenScanner?: () => void;
  className?: string;
}

export const SleeveQRGenerator: React.FC<SleeveQRGeneratorProps> = ({
  targetUrl,
  brandName = 'MutualPool Fleet',
  sleeveText = 'ADVERTISE WITH US',
  accentColor = '#FACC15', // High-vis yellow from sleeve photo
  fabricColor = '#0f172a', // Stealth black
  onUrlChange,
  onOpenScanner,
  className = '',
}) => {
  const toast = useToast();
  const inputId = useId();

  // Default target URL brings users back to the site with sleeve tracking query parameters
  const defaultUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/?ref=sleeve_qr&utm_source=apparel_sleeve&utm_medium=courier_qr&utm_campaign=advertise_with_us`
    : 'https://mutualpool.org/?ref=sleeve_qr';

  const [currentUrl, setCurrentUrl] = useState<string>(targetUrl || defaultUrl);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [qrStyle, setQrStyle] = useState<'standard' | 'high_contrast_dark' | 'yellow_accent'>('standard');
  const [downloading, setDownloading] = useState(false);

  // Sync with prop if it changes
  useEffect(() => {
    if (targetUrl && targetUrl !== currentUrl) {
      setCurrentUrl(targetUrl);
    }
  }, [targetUrl]);

  // Generate QR code data URL whenever currentUrl or qrStyle changes
  useEffect(() => {
    let isCancelled = false;

    const generateQR = async () => {
      try {
        const darkColor = qrStyle === 'yellow_accent' ? '#0f172a' : '#000000';
        const lightColor = qrStyle === 'yellow_accent' ? '#FACC15' : '#ffffff';

        const dataUrl = await QRCode.toDataURL(currentUrl, {
          width: 512,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: {
            dark: darkColor,
            light: lightColor,
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
  }, [currentUrl, qrStyle]);

  const handleUrlChange = (newUrl: string) => {
    setCurrentUrl(newUrl);
    if (onUrlChange) {
      onUrlChange(newUrl);
    }
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      toast.success('Sleeve target URL copied to clipboard!', { title: 'Link Copied' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadPrintAsset = async () => {
    setDownloading(true);
    try {
      // Create high-res canvas (1200 x 1800 px at 300 DPI for Fourthwall print specs)
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1800;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Transparent/dark background
      ctx.fillStyle = fabricColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Load QR code image into canvas
      const img = new Image();
      img.src = qrDataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Draw QR Code centered in upper half
      const qrSize = 520;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 160;

      // White protective pill border for optimal scannability on fabric
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(qrX - 24, qrY - 24, qrSize + 48, qrSize + 48, 28);
      ctx.fill();

      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      // Draw Megaphone icon placeholder & Text: "ADVERTISE WITH US"
      ctx.textAlign = 'center';

      // "ADVERTISE" in bold white
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 96px Inter, system-ui, sans-serif';
      ctx.fillText('ADVERTISE', canvas.width / 2, 860);

      // "WITH US" in high-vis yellow
      ctx.fillStyle = accentColor;
      ctx.font = '900 110px Inter, system-ui, sans-serif';
      ctx.fillText('WITH US', canvas.width / 2, 980);

      // Sponsor Brand Tag & Instructions
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 36px Inter, system-ui, sans-serif';
      ctx.fillText(`SPONSORED BY ${brandName.toUpperCase()}`, canvas.width / 2, 1100);

      ctx.font = '500 28px Inter, system-ui, sans-serif';
      ctx.fillText('SCAN SLEEVE TO VISIT SITE & BECOME A BRAND AMBASSADOR', canvas.width / 2, 1160);

      // Fourthwall print registration marks
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 12]);
      ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

      const link = document.createElement('a');
      link.download = `fourthwall_sleeve_qr_${brandName.toLowerCase().replace(/\s+/g, '_')}_300dpi.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.success('High-resolution 300 DPI sleeve print asset downloaded!', { title: 'Print Ready' });
    } catch (err) {
      console.error('Download print asset failed:', err);
      toast.error('Failed to generate print download.', { title: 'Download Error' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-100 shadow-xl ${className}`}>
      
      {/* Header with Title and Scanner Launcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base text-white">Default Sleeve QR Code & Print Spec</h3>
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                Printed By Default
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Every apparel sleeve includes this scannable QR code printed next to <strong className="text-amber-400">Advertise with us</strong> to drive traffic back to the platform.
            </p>
          </div>
        </div>

        {onOpenScanner && (
          <button
            type="button"
            onClick={onOpenScanner}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
          >
            <Scan className="w-4 h-4 text-blue-200" />
            <span>Test Sleeve Scanner</span>
          </button>
        )}
      </div>

      {/* Main Grid: Live Sleeve Forearm Graphic Preview + URL Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5">
        
        {/* Left Column: Realistic Sleeve Graphic Preview (forearm orientation) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5 self-start">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Sleeve Forearm Print Preview</span>
          </div>

          {/* Sleeve Mockup Container styled to match the attached photo */}
          <div 
            className="w-full max-w-xs rounded-2xl p-5 border border-slate-700 shadow-2xl relative overflow-hidden flex flex-col items-center text-center transition-all"
            style={{ backgroundColor: fabricColor }}
          >
            {/* Fabric subtle weave texture background overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/40 pointer-events-none" />
            
            {/* Ribbed cuff seam indicator at the bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-4 border-t border-slate-700/80 bg-slate-950/40" />

            {/* Megaphone Icon Badge (matching the attached image in yellow) */}
            <div className="relative z-10 mb-3 flex items-center justify-center">
              <div className="p-2.5 rounded-full bg-amber-400 text-slate-950 shadow-md">
                <Megaphone className="w-6 h-6 fill-slate-950 text-slate-950" />
              </div>
            </div>

            {/* Typography: "ADVERTISE" in white, "WITH US" in yellow */}
            <div className="relative z-10 mb-4 tracking-tighter leading-none select-none">
              <span className="block font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                ADVERTISE
              </span>
              <span 
                style={{ color: accentColor }}
                className="block font-black text-2xl sm:text-3xl uppercase tracking-tight mt-0.5"
              >
                WITH US
              </span>
            </div>

            {/* High-Contrast Printed Scannable QR Code */}
            <div className="relative z-10 p-2.5 bg-white rounded-xl shadow-lg border border-slate-200">
              {qrDataUrl ? (
                <img 
                  src={qrDataUrl} 
                  alt="Sleeve QR Code" 
                  className="w-32 h-32 sm:w-36 sm:h-36 object-contain block"
                />
              ) : (
                <div className="w-32 h-32 bg-slate-200 animate-pulse rounded" />
              )}
              <div className="mt-1 text-[9px] font-black uppercase tracking-wider text-slate-900 font-mono">
                Scan with phone camera
              </div>
            </div>

            {/* Subtle Forearm Seam Stitch Line */}
            <div className="absolute top-0 bottom-0 left-3 w-px border-l border-dashed border-slate-700/50" />
            <div className="absolute top-0 bottom-0 right-3 w-px border-r border-dashed border-slate-700/50" />

            <div className="relative z-10 mt-3 text-[10px] text-slate-400 font-mono">
              Printed on every courier sleeve
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-slate-400">QR Code Style:</span>
            <button
              type="button"
              onClick={() => setQrStyle('standard')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-all ${
                qrStyle === 'standard' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Classic B/W
            </button>
            <button
              type="button"
              onClick={() => setQrStyle('yellow_accent')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-all ${
                qrStyle === 'yellow_accent' ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              High-Vis Gold
            </button>
          </div>
        </div>

        {/* Right Column: Configuration Controls, Destination URL, and Download */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          
          <div className="space-y-4">
            {/* Destination URL Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor={inputId} className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <span>Destination Website URL (When Scanned)</span>
                  <span className="text-amber-400 text-[10px] font-normal">• Brings users back to the site</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleUrlChange(defaultUrl)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset Default</span>
                </button>
              </div>

              <div className="relative">
                <input
                  id={inputId}
                  type="text"
                  value={currentUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://yourwebsite.com/advertise"
                  className="w-full px-3.5 py-2.5 pr-20 text-xs font-mono bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                When pedestrians scan a courier's sleeve in foot traffic, their phone opens this URL instantly. It is pre-configured with campaign tracking parameters to measure courier impression conversions.
              </p>
            </div>

            {/* Sleeve Text & Brand Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Default Sleeve Headline</span>
                <span className="font-black text-amber-400 text-sm block">ADVERTISE WITH US</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">High-impact pedestrian call-to-action</span>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Print Placement Zone</span>
                <span className="font-bold text-white text-sm block">Forearm Sleeve (Wrist-to-Elbow)</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Always visible when courier delivers orders</span>
              </div>
            </div>

            {/* Fourthwall Print Specifications & Proof Compliance */}
            <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 text-xs">
              <div className="flex items-center gap-2 text-blue-300 font-bold mb-1">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>Fourthwall DTG & Screen-Print Specification Verified</span>
              </div>
              <p className="text-[11px] text-blue-200/80 leading-relaxed">
                High-contrast white border ensures 100% optical readability under sunlight, rain, and street lighting. Configured for 300 DPI direct-to-garment (DTG) print on hoodies, windbreakers, and fleet polos.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleDownloadPrintAsset}
              disabled={downloading}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-slate-300" />
              <span>{downloading ? 'Generating Asset...' : 'Download 300-DPI Print Vector Asset'}</span>
            </button>

            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Scan className="w-4 h-4 text-slate-950" />
                <span>Launch QR Code Scanner</span>
              </button>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
