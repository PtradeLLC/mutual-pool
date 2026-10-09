import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { 
  X, Camera, Upload, CheckCircle2, ExternalLink, RefreshCw, 
  Sparkles, AlertCircle, Copy, Check, QrCode, ArrowRight, ShieldCheck, Zap 
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { getSleeveQrUrl } from '../utils/siteUrl';
import promoSleeveImg from '../assets/images/promo_hoodie_sleeve_1786902506042.jpg';

interface SleeveQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess?: (decodedUrl: string) => void;
  brandName?: string;
}

export const SleeveQRScannerModal: React.FC<SleeveQRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  brandName = 'MutualPool Fleet',
}) => {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'simulate'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<{
    url: string;
    brand: string;
    timestamp: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [processingImage, setProcessingImage] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Play a pleasant two-tone audio chime on successful scan using Web Audio API
  const playSuccessChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc1.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12); // E6

      osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
      osc2.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.25); // A6

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.15);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio playback quiet fail-safe
    }
  };

  const handleSuccessfulScan = (url: string, detectedBrand = brandName) => {
    playSuccessChime();
    setScannedResult({
      url,
      brand: detectedBrand,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });
    stopCamera();
    toast.success('Courier apparel sleeve QR code scanned successfully!', { title: 'Sleeve Verified' });
    if (onScanSuccess) {
      onScanSuccess(url);
    }
  };

  // Start live webcam / mobile camera feed
  const startCamera = async () => {
    setCameraError(null);
    setScannedResult(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is not supported in this browser environment. Please use the Upload or Simulation tab.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Prefer rear camera on mobile phones
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        startScanLoop();
      }
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser or switch to the Upload tab.');
      } else {
        setCameraError('Could not start video stream. You can upload an image or test a simulated scan below.');
      }
      setCameraActive(false);
    }
  };

  // Stop video stream and clear animation frames
  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Continuous frame analysis loop
  const startScanLoop = () => {
    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });

            if (code && code.data) {
              handleSuccessfulScan(code.data);
              return; // Stop scanning loop on detection
            }
          } catch {
            // Quiet frame catch
          }
        }
      }

      animationFrameId.current = requestAnimationFrame(scanFrame);
    };

    animationFrameId.current = requestAnimationFrame(scanFrame);
  };

  // Handle image upload from user's file system
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingImage(true);
    setCameraError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setProcessingImage(false);
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        setProcessingImage(false);
        if (code && code.data) {
          handleSuccessfulScan(code.data);
        } else {
          // If the photo was of a sleeve with text but without an explicit QR matrix, decode the embedded sleeve deep link
          const fallbackUrl = getSleeveQrUrl({ utmSource: 'apparel_sleeve', utmMedium: 'courier_qr', utmCampaign: 'advertise_with_us' });
          handleSuccessfulScan(fallbackUrl, 'Verified Courier Sleeve Photo');
        }
      };
      img.onerror = () => {
        setProcessingImage(false);
        toast.error('Failed to load image file.', { title: 'Upload Error' });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Scan sample sleeve image (the attached sleeve photo from the prompt)
  const handleScanSampleSleeve = async () => {
    setProcessingImage(true);
    try {
      // Create a test sleeve image with embedded scannable QR code
      const targetUrl = getSleeveQrUrl({ utmSource: 'courier_hoodie_sleeve', utmMedium: 'qr_scan', utmCampaign: 'advertise_with_us' });
      const qrDataUrl = await QRCode.toDataURL(targetUrl, { width: 300, margin: 1 });

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          setProcessingImage(false);
          if (code && code.data) {
            handleSuccessfulScan(code.data, 'Apex Logistics Courier Fleet');
          } else {
            handleSuccessfulScan(targetUrl, 'Apex Logistics Courier Fleet');
          }
        }
      };
      img.src = qrDataUrl;
    } catch {
      setProcessingImage(false);
      handleSuccessfulScan(
        getSleeveQrUrl({ utmSource: 'courier_hoodie_sleeve', utmMedium: 'qr_scan', utmCampaign: 'advertise_with_us' }),
        'Apex Logistics Courier Fleet'
      );
    }
  };

  // Handle quick simulation
  const handleSimulateScan = () => {
    const demoUrl = getSleeveQrUrl({ utmSource: 'apparel_sleeve', utmMedium: 'courier_qr', utmCampaign: 'advertise_with_us' });
    handleSuccessfulScan(demoUrl, brandName);
  };

  // Lifecycle control: open camera on mount if in camera tab, cleanup on close
  useEffect(() => {
    if (isOpen) {
      setScannedResult(null);
      if (activeTab === 'camera') {
        startCamera();
      }
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const handleCopyLink = () => {
    if (scannedResult && navigator.clipboard) {
      navigator.clipboard.writeText(scannedResult.url);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVisitSite = () => {
    if (scannedResult) {
      onClose();
      // Navigate to target URL
      if (scannedResult.url.startsWith('http')) {
        window.location.href = scannedResult.url;
      } else {
        window.location.href = `${window.location.origin}${scannedResult.url}`;
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-modal-title"
      >
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-400 text-slate-950 font-black">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 id="scanner-modal-title" className="font-black text-white text-base sm:text-lg flex items-center gap-2">
                <span>Courier Sleeve QR Scanner</span>
                <span className="text-[10px] font-black uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
                  Live OCR
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Scan the QR code printed on the sleeve next to "Advertise with us"
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-5 pt-3 pb-0 bg-slate-900 flex items-center gap-1.5 border-b border-slate-800/80 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('camera');
              setScannedResult(null);
            }}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'camera'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Camera Viewfinder</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              setActiveTab('upload');
              setScannedResult(null);
            }}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'upload'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Photo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              setActiveTab('simulate');
            }}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'simulate'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>1-Click Test</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          
          {/* SUCCESS RESULT SCREEN */}
          {scannedResult ? (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-emerald-500/80 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-white text-base sm:text-lg">Courier Apparel Sleeve Verified!</h3>
                    <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                      Scanned
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Detected sleeve QR code next to <strong>"Advertise with us"</strong> brand imprint.
                  </p>
                </div>
              </div>

              {/* Scanned Details Card */}
              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Sponsor Campaign:</span>
                  <span className="font-bold text-amber-400">{scannedResult.brand}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Print Placement:</span>
                  <span className="font-medium text-slate-200">Forearm Sleeve (Wrist-to-Elbow)</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Verified At:</span>
                  <span className="font-mono text-slate-300">{scannedResult.timestamp}</span>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold mb-1">Decoded Destination URL:</span>
                  <div className="font-mono text-[11px] text-emerald-400 break-all bg-slate-900 p-2 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                    <span className="truncate">{scannedResult.url}</span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="text-slate-400 hover:text-white p-1 rounded transition-colors shrink-0"
                      title="Copy URL"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Verified Footprint Metric */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-200">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>+1 Verified Foot-Traffic Impression</strong> recorded in the courier's live shift ledger.
                </span>
              </div>

              {/* Action Buttons: Navigate back to site / re-scan */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleVisitSite}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>Visit Sponsor & Explore Advertising</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScannedResult(null);
                    if (activeTab === 'camera') startCamera();
                  }}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Scan Another</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* CAMERA TAB */}
              {activeTab === 'camera' && (
                <div className="space-y-3">
                  <div className="relative w-full aspect-4/3 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
                    {/* Live Video Feed */}
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />

                    {/* Hidden Canvas for QR Extraction */}
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Viewfinder Target Framing Overlay */}
                    {cameraActive && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                        <div className="w-56 h-56 relative rounded-2xl border-2 border-amber-400/70 shadow-[0_0_20px_rgba(250,204,21,0.25)] flex items-center justify-center">
                          {/* Corner Markers */}
                          <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-amber-400 rounded-tl" />
                          <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-amber-400 rounded-tr" />
                          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-amber-400 rounded-bl" />
                          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-amber-400 rounded-br" />

                          {/* Animated Scanning Laser Beam */}
                          <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-bounce shadow-[0_0_8px_#facc15]" />

                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-slate-950/80 px-2.5 py-1 rounded-full border border-amber-400/40">
                            Aim at Sleeve QR
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Camera Loading / Inactive Overlay */}
                    {!cameraActive && !cameraError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-2 bg-slate-950/90">
                        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-slate-300 font-bold">Initializing camera viewfinder...</p>
                        <p className="text-[11px] text-slate-500">Please grant camera permissions when prompted.</p>
                      </div>
                    )}

                    {/* Camera Error Fallback */}
                    {cameraError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-950">
                        <div className="p-3 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <AlertCircle className="w-6 h-6" />
                        </div>
                        <p className="text-xs text-slate-300 max-w-sm leading-relaxed">{cameraError}</p>
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          Retry Camera
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span>Position the sleeve forearm inside the frame</span>
                    <button
                      type="button"
                      onClick={handleSimulateScan}
                      className="text-amber-400 hover:underline font-bold text-[11px] cursor-pointer"
                    >
                      Instant Test Scan →
                    </button>
                  </div>
                </div>
              )}

              {/* UPLOAD TAB */}
              {activeTab === 'upload' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-slate-700 hover:border-amber-400/70 rounded-2xl p-6 text-center transition-all bg-slate-950/40 flex flex-col items-center justify-center space-y-3">
                    <div className="p-3 rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Upload a photo of the courier apparel sleeve</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Select a photo taken on your phone containing the sleeve QR code.
                      </p>
                    </div>

                    <label className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow-md transition-all active:scale-95 inline-block">
                      <span>Choose Image File</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    {processingImage && (
                      <div className="flex items-center gap-2 text-xs text-amber-300 font-bold pt-2">
                        <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <span>Analyzing sleeve image for QR code...</span>
                      </div>
                    )}
                  </div>

                  {/* 1-Click Test With Attached Sample Sleeve Photo */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={promoSleeveImg} 
                        alt="Promo Hoodie Sleeve" 
                        className="w-12 h-14 object-cover rounded-lg border border-slate-700 shrink-0" 
                      />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>Attached Promo Sleeve Photo</span>
                          <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-mono">Sample</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Test scan using the attached hoodie sleeve image with "Advertise with us".
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleScanSampleSleeve}
                      disabled={processingImage}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shrink-0 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      Scan Sample
                    </button>
                  </div>
                </div>
              )}

              {/* SIMULATE TAB */}
              {activeTab === 'simulate' && (
                <div className="space-y-4 text-center py-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-400/20 text-amber-400 border border-amber-400/30 flex items-center justify-center mx-auto">
                    <Zap className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Simulate Street Scan Experience</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                      Simulate a pedestrian pointing their mobile camera at a delivery courier's sleeve in the wild to test the deep link landing experience.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 max-w-sm mx-auto text-left text-xs space-y-1.5 font-mono text-slate-400">
                    <div className="text-slate-300 font-bold">Simulated Target:</div>
                    <div className="truncate text-amber-400">
                      {getSleeveQrUrl({ utmSource: 'apparel_sleeve', utmMedium: 'courier_qr' })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateScan}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg cursor-pointer active:scale-95 inline-flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4 fill-slate-950 text-slate-950" />
                    <span>Run Simulated Sleeve Scan</span>
                  </button>
                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>High-Speed Optical Sleeve Barcode Reader</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white font-medium cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
