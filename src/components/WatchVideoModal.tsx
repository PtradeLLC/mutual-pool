import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Play, Pause, Volume2, VolumeX, RotateCcw, CheckCircle2, 
  ShieldCheck, Zap, Gift, Users, Lock, ArrowRight, Sparkles, Layers, Wallet, Maximize2
} from 'lucide-react';
import { Logo } from './Logo';

interface WatchVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRegister: () => void;
  onOpenHowItWorks?: () => void;
}

const CHAPTERS = [
  {
    id: 1,
    title: 'Money Pools & Weekly Rotations',
    timestamp: '0:00',
    timeSec: 0,
    icon: Users,
    color: 'text-[#005FB8]',
    bgColor: 'bg-blue-50',
    description: 'Pool weekly deposits with verified workers. One member gets the full pot each week.',
    highlight: '$20/wk × 20 members = $400 payout rotation',
  },
  {
    id: 2,
    title: 'FDIC Security & Stripe Treasury',
    timestamp: '0:20',
    timeSec: 20,
    icon: ShieldCheck,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    description: 'Your money is held in individual Stripe Treasury accounts, FDIC-insured up to $250k.',
    highlight: 'Zero interest • No credit checks • Bank grade',
  },
  {
    id: 3,
    title: 'Emergency Payout Swaps',
    timestamp: '0:40',
    timeSec: 40,
    icon: Zap,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    description: 'Unexpected repair or emergency? Request an early payout swap through peer community voting.',
    highlight: 'Instant community hardship assistance',
  },
  {
    id: 4,
    title: 'Partner Perks & Benefits',
    timestamp: '1:00',
    timeSec: 60,
    icon: Gift,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    description: 'Access 15-20% discounts on tire maintenance, oil changes, gas, and tax preparation tools.',
    highlight: 'Instant member discounts from verified partners',
  },
];

const TOTAL_DURATION = 80; // 80 seconds total

export const WatchVideoModal: React.FC<WatchVideoModalProps> = ({
  isOpen,
  onClose,
  onOpenRegister,
  onOpenHowItWorks,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [showCaptions, setShowCaptions] = useState(true);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }
    setIsPlaying(true);
  }, [isOpen]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= TOTAL_DURATION) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    // Update chapter based on current time
    if (currentTime >= 60) setActiveChapterIndex(3);
    else if (currentTime >= 40) setActiveChapterIndex(2);
    else if (currentTime >= 20) setActiveChapterIndex(1);
    else setActiveChapterIndex(0);
  }, [currentTime]);

  if (!isOpen) return null;

  const currentChapter = CHAPTERS[activeChapterIndex];

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSeek = (timeSec: number) => {
    setCurrentTime(timeSec);
    setIsPlaying(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-[#DDE1E6] rounded-2xl max-w-4xl w-full shadow-2xl relative text-[#111827] my-auto overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#DDE1E6] flex items-center justify-between gap-4 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-[#005FB8] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200">
                  Platform Demo
                </span>
                <span className="text-xs text-[#6B7280]">1 Min Walkthrough</span>
              </div>
              <h3 className="text-lg font-extrabold text-[#111827]">
                How MutualPool Services Work
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
            title="Close video"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player Canvas & Interactive App Preview */}
        <div className="bg-slate-950 text-white relative flex-1 min-h-[280px] sm:min-h-[360px] flex flex-col justify-between overflow-hidden select-none">
          
          {/* Simulated App Screen Walkthrough Preview Canvas */}
          <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
            {/* Background ambient gradient glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-950/60 via-slate-950 to-emerald-950/40 pointer-events-none" />

            {/* Dynamic Screen Mockup based on active chapter */}
            <div className="relative z-10 w-full max-w-2xl bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 transition-all duration-500">
              
              {/* Screen Top Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${currentChapter.bgColor} ${currentChapter.color}`}>
                    <currentChapter.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-blue-300 font-bold block uppercase tracking-wider">
                      Module {currentChapter.id} of 4
                    </span>
                    <h4 className="text-base font-extrabold text-white">
                      {currentChapter.title}
                    </h4>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Interactive Preview</span>
                </div>
              </div>

              {/* Chapter-Specific Animated Screen Visual */}
              {activeChapterIndex === 0 && (
                <div className="space-y-3 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-white/10 space-y-1">
                      <span className="text-[11px] text-slate-400 font-medium">Active Pod</span>
                      <p className="text-sm font-bold text-white">Bay Area Uber Drivers Pod</p>
                      <span className="text-xs text-emerald-400 font-bold">$20 / week</span>
                    </div>
                    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-white/10 space-y-1">
                      <span className="text-[11px] text-slate-400 font-medium">Rotation Payout</span>
                      <p className="text-sm font-bold text-emerald-400">$400 Lump Sum</p>
                      <span className="text-xs text-slate-300">20 Verified Members</span>
                    </div>
                  </div>

                  <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span>Weekly Auto-Deposit Schedule</span>
                    </div>
                    <span className="font-mono text-blue-300 font-bold">Rotates Every Monday</span>
                  </div>
                </div>
              )}

              {activeChapterIndex === 1 && (
                <div className="space-y-3 py-2">
                  <div className="bg-slate-900/80 p-4 rounded-xl border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Stripe Treasury Member Account
                      </span>
                      <span className="text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">
                        FDIC Insured $250k
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      All deposits are processed through bank-level encryption. Money is strictly separated in individual member treasury vaults.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-white/10 text-slate-300">0% Interest</div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-white/10 text-slate-300">No Hidden Fees</div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-white/10 text-slate-300">0 Impact Credit Score</div>
                  </div>
                </div>
              )}

              {activeChapterIndex === 2 && (
                <div className="space-y-3 py-2">
                  <div className="bg-amber-950/40 p-4 rounded-xl border border-amber-500/40 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-300 font-bold flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-400" />
                        Emergency Swap Request
                      </span>
                      <span className="text-amber-400 text-[10px] bg-amber-900/60 px-2 py-0.5 rounded">Active Community Vote</span>
                    </div>
                    <p className="text-xs text-slate-200">
                      Need funds sooner for vehicle alternator replacement? Member submits hardship swap request to pod peers.
                    </p>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-400 h-full w-4/5 transition-all duration-500" />
                    </div>
                    <div className="flex justify-between text-[10px] text-amber-200 font-mono">
                      <span>16 Approved</span>
                      <span>80% Community Supermajority Met</span>
                    </div>
                  </div>
                </div>
              )}

              {activeChapterIndex === 3 && (
                <div className="space-y-3 py-2">
                  <div className="bg-purple-950/40 p-4 rounded-xl border border-purple-500/40 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-purple-300 font-bold flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-purple-400" />
                        Partner Perks Marketplace
                      </span>
                      <span className="text-purple-300 text-[10px] bg-purple-900/60 px-2 py-0.5 rounded">15-20% Off</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-white/10">
                        <span className="font-bold text-white block">Tire Kingdom</span>
                        <span className="text-[10px] text-purple-300">15% Off Tires & Alignment</span>
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-white/10">
                        <span className="font-bold text-white block">Jiffy Lube</span>
                        <span className="text-[10px] text-purple-300">$20 Off Synthetic Oil Change</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtitle Voiceover Captions */}
              {showCaptions && (
                <div className="bg-black/60 border border-white/10 rounded-lg p-2.5 text-center text-xs text-blue-100 italic">
                  "{currentChapter.description}"
                </div>
              )}

            </div>
          </div>

          {/* Big Center Play Overlay when paused */}
          {!isPlaying && (
            <button
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-[#005FB8] text-white flex items-center justify-center shadow-2xl scale-100 hover:scale-105 transition-transform">
                <Play className="w-8 h-8 fill-current ml-1" />
              </div>
            </button>
          )}

          {/* Video Control Bar at Bottom of Canvas */}
          <div className="relative z-30 bg-slate-900/90 backdrop-blur-md p-3 sm:p-4 border-t border-white/10 space-y-2 shrink-0">
            
            {/* Scrubber Bar */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-slate-300 w-9 text-right">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={TOTAL_DURATION}
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#005FB8]"
              />
              <span className="text-[11px] font-mono text-slate-400 w-9">
                {formatTime(TOTAL_DURATION)}
              </span>
            </div>

            {/* Playback Controls & Chapter Quick Jump */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                </button>

                <button
                  onClick={() => handleSeek(0)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
                  title="Replay video"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setShowCaptions(!showCaptions)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                    showCaptions ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/10 text-slate-400 border-white/10'
                  }`}
                >
                  CC
                </button>
              </div>

              {/* Chapter Jump Selector */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs">
                {CHAPTERS.map((chap, idx) => (
                  <button
                    key={chap.id}
                    onClick={() => handleSeek(chap.timeSec)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      activeChapterIndex === idx
                        ? 'bg-[#005FB8] text-white font-bold shadow-xs'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {chap.id}. {chap.title.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Chapter Overview Cards Grid Below Video */}
        <div className="p-4 sm:p-5 bg-[#F8FAFC] border-t border-[#DDE1E6] shrink-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {CHAPTERS.map((chap, idx) => {
              const Icon = chap.icon;
              const isActive = activeChapterIndex === idx;

              return (
                <button
                  key={chap.id}
                  onClick={() => handleSeek(chap.timeSec)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                    isActive 
                      ? 'bg-white border-[#005FB8] shadow-md ring-2 ring-[#005FB8]/20' 
                      : 'bg-white border-[#E2E8F0] hover:border-slate-300 hover:bg-gray-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-1.5 rounded-lg ${chap.bgColor} ${chap.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {chap.timestamp}
                    </span>
                  </div>

                  <div>
                    <h5 className="font-bold text-[#111827] line-clamp-1">{chap.title}</h5>
                    <p className="text-[10px] text-[#6B7280] line-clamp-2 leading-relaxed mt-0.5">
                      {chap.description}
                    </p>
                  </div>

                  <span className="text-[10px] font-semibold text-[#005FB8]">
                    {chap.highlight}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#E2E8F0]">
            <div className="flex items-center gap-2 text-xs text-[#4B5563]">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Free to join • Zero interest • Stripe Treasury bank protection</span>
            </div>

            <div className="flex items-center gap-2">
              {onOpenHowItWorks && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenHowItWorks();
                  }}
                  className="px-4 py-2.5 rounded-xl border border-[#DDE1E6] bg-white hover:bg-gray-50 text-[#111827] font-semibold text-xs transition-colors"
                >
                  Read Full Rules & FAQ
                </button>
              )}

              <button
                onClick={() => {
                  onClose();
                  onOpenRegister();
                }}
                className="px-5 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-1.5"
              >
                <span>Join a Pod Free</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
