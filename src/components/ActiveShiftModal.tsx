import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, CheckCircle2, Clock, MapPin, ShieldCheck, 
  AlertTriangle, Upload, Sparkles, Navigation, DollarSign,
  TrendingUp, Play, Square, Bell, RefreshCw, Smartphone, Eye, Check
} from 'lucide-react';
import { AdCampaign, ActiveShiftSession, PhotoSpotCheck, CampaignShiftLog, User } from '../types';

interface ActiveShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  campaign: AdCampaign;
  activeSession: ActiveShiftSession | null;
  onStartShift: (session: ActiveShiftSession) => void;
  onUpdateSession: (session: ActiveShiftSession) => void;
  onCompleteShift: (completedShift: CampaignShiftLog) => void;
}

export const ActiveShiftModal: React.FC<ActiveShiftModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  campaign,
  activeSession,
  onStartShift,
  onUpdateSession,
  onCompleteShift,
}) => {
  // Setup / Start Shift Form State
  const [initialPhoto, setInitialPhoto] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<ActiveShiftSession['platform']>(
    (currentUser.platform as any) || 'DoorDash'
  );
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('West Loop & Fulton Market');
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  // Spot-check response state
  const [spotCheckPhoto, setSpotCheckPhoto] = useState<string>('');
  const [spotCheckTimeRemaining, setSpotCheckTimeRemaining] = useState<number>(300); // 5 mins countdown
  const [isSubmittingSpotCheck, setIsSubmittingSpotCheck] = useState(false);
  const [spotCheckToast, setSpotCheckToast] = useState<string | null>(null);

  // Live timer for active session
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [liveMiles, setLiveMiles] = useState<number>(0);
  const [liveImpressions, setLiveImpressions] = useState<number>(0);

  // End shift confirmation modal state
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const neighborhoods = [
    'West Loop & Fulton Market',
    'Downtown Loop Corridor',
    'River North & Gold Coast',
    'Wicker Park & Logan Square',
    'Lincoln Park & Lakeview',
    'South Loop & Chinatown',
  ];

  // Calculate elapsed time and update live metrics every second
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'ACTIVE') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diffSecs = Math.max(0, Math.floor((now - activeSession.startedAt) / 1000));
      setElapsedSeconds(diffSecs);

      // Dynamically calculate miles & impressions: ~3.8 miles/hr and ~1,450 impressions/hr in urban core
      const hoursFraction = diffSecs / 3600;
      const miles = parseFloat((hoursFraction * 4.2).toFixed(1));
      const impressions = Math.floor(hoursFraction * 1650);
      setLiveMiles(miles);
      setLiveImpressions(impressions);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  // Countdown timer for active randomized spot check prompt
  useEffect(() => {
    if (!activeSession?.activePrompt) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsedPromptSecs = Math.floor((now - activeSession.activePrompt!.promptedAt) / 1000);
      const remaining = Math.max(0, activeSession.activePrompt!.responseWindowSeconds - elapsedPromptSecs);
      setSpotCheckTimeRemaining(remaining);

      if (remaining === 0 && activeSession.activePrompt!.status === 'PENDING') {
        // Mark as missed if time expires
        const updatedPrompt: PhotoSpotCheck = {
          ...activeSession.activePrompt!,
          status: 'MISSED',
        };
        const updatedSpotChecks = activeSession.spotChecks.map(s => 
          s.id === updatedPrompt.id ? updatedPrompt : s
        );
        onUpdateSession({
          ...activeSession,
          spotChecks: updatedSpotChecks,
          activePrompt: null,
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession, onUpdateSession]);

  if (!isOpen) return null;

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsStarting(true);

    const now = Date.now();
    const startTimeFormatted = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const initialCheck: PhotoSpotCheck = {
      id: `spot_${now}_init`,
      timestamp: startTimeFormatted,
      promptedAt: now,
      respondedAt: now,
      status: 'VERIFIED',
      photoUrl: initialPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      locationLabel: `${selectedNeighborhood}, ${campaign.targetMetro}`,
      responseWindowSeconds: 300,
      secondsToRespond: 12,
    };

    const newSession: ActiveShiftSession = {
      id: `shift_${now}`,
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      brandName: campaign.brandName,
      brandColor: campaign.brandColor || '#005FB8',
      dailyRate: campaign.dailyPayout,
      targetMetro: campaign.targetMetro,
      platform: selectedPlatform,
      courierId: currentUser.id,
      courierName: currentUser.displayName || 'Courier Ambassador',
      startedAt: now,
      startFormatted: startTimeFormatted,
      status: 'ACTIVE',
      currentMiles: 0,
      estimatedImpressions: 0,
      neighborhood: selectedNeighborhood,
      spotChecks: [initialCheck],
      activePrompt: null,
      lastGpsPing: {
        neighborhood: selectedNeighborhood,
        speedMph: 11.4,
        accuracyMeters: 4,
        heading: 'NE along Corridor',
      },
    };

    setTimeout(() => {
      onStartShift(newSession);
      setIsStarting(false);
    }, 400);
  };

  // Trigger a randomized spot check prompt
  const handleTriggerRandomPrompt = () => {
    if (!activeSession) return;
    const now = Date.now();
    const promptTime = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newPrompt: PhotoSpotCheck = {
      id: `spot_${now}`,
      timestamp: promptTime,
      promptedAt: now,
      status: 'PENDING',
      locationLabel: `${activeSession.neighborhood}, ${activeSession.targetMetro}`,
      responseWindowSeconds: 300, // 5 minutes
    };

    const updatedSession: ActiveShiftSession = {
      ...activeSession,
      spotChecks: [...activeSession.spotChecks, newPrompt],
      activePrompt: newPrompt,
    };

    onUpdateSession(updatedSession);
    setSpotCheckTimeRemaining(300);
    setSpotCheckPhoto('');
  };

  // Submit response to spot check prompt
  const handleRespondSpotCheck = () => {
    if (!activeSession || !activeSession.activePrompt) return;
    setIsSubmittingSpotCheck(true);

    const now = Date.now();
    const responseSecs = Math.floor((now - activeSession.activePrompt.promptedAt) / 1000);

    const updatedPrompt: PhotoSpotCheck = {
      ...activeSession.activePrompt,
      status: 'VERIFIED',
      respondedAt: now,
      secondsToRespond: responseSecs,
      photoUrl: spotCheckPhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    };

    const updatedSpotChecks = activeSession.spotChecks.map(s => 
      s.id === updatedPrompt.id ? updatedPrompt : s
    );

    setTimeout(() => {
      onUpdateSession({
        ...activeSession,
        spotChecks: updatedSpotChecks,
        activePrompt: null,
      });
      setIsSubmittingSpotCheck(false);
      setSpotCheckToast('✓ Random spot-check photo verified on-time! Compliance score protected.');
      setTimeout(() => setSpotCheckToast(null), 4000);
    }, 600);
  };

  // Complete and end shift
  const handleFinishShift = () => {
    if (!activeSession) return;
    setIsCompleting(true);

    const now = Date.now();
    const endTimeFormatted = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const durationHours = parseFloat((Math.max(1, elapsedSeconds) / 3600).toFixed(2));
    const verifiedSpotChecks = activeSession.spotChecks.filter(s => s.status === 'VERIFIED').length;
    const totalPrompts = activeSession.spotChecks.length;
    const complianceScore = totalPrompts > 0 ? Math.round((verifiedSpotChecks / totalPrompts) * 100) : 100;

    const completedShift: CampaignShiftLog = {
      id: activeSession.id,
      campaignId: activeSession.campaignId,
      campaignTitle: activeSession.campaignTitle,
      brandName: activeSession.brandName,
      courierId: activeSession.courierId,
      courierName: activeSession.courierName,
      courierAvatar: currentUser.avatarUrl,
      platform: activeSession.platform,
      metro: activeSession.targetMetro,
      neighborhood: activeSession.neighborhood,
      date: new Date(activeSession.startedAt).toISOString().split('T')[0],
      startTime: activeSession.startFormatted,
      endTime: endTimeFormatted,
      durationHours: durationHours,
      milesTraveled: Math.max(2.5, liveMiles),
      estimatedImpressions: Math.max(1200, liveImpressions),
      courierPayoutEarned: activeSession.dailyRate,
      verifiedGps: true,
      verifiedPhoto: true,
      spotChecks: activeSession.spotChecks,
      spotChecksCount: totalPrompts,
      spotChecksVerified: verifiedSpotChecks,
      complianceScore: complianceScore,
      notes: `Verified shift with ${verifiedSpotChecks}/${totalPrompts} random spot-checks validated on route.`
    };

    setTimeout(() => {
      onCompleteShift(completedShift);
      setIsCompleting(false);
      setShowEndConfirmation(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold shrink-0">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                {campaign.brandName}
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                ${campaign.dailyPayout}/day Payout
              </span>
            </div>
            <h2 className="text-lg font-black text-slate-950 mt-0.5">
              {activeSession?.status === 'ACTIVE' ? 'Active Courier Shift in Progress' : 'Start Delivery Route & Check-in'}
            </h2>
          </div>
        </div>

        {/* Toast for Spot-check */}
        {spotCheckToast && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{spotCheckToast}</span>
          </div>
        )}

        {/* VIEW 1: START SHIFT SETUP (If no active session) */}
        {!activeSession || activeSession.status !== 'ACTIVE' ? (
          <form onSubmit={handleStartShiftSubmit} className="space-y-5 text-xs">
            
            {/* Explanatory Banner: Multi-Point Verification */}
            <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-blue-900">
                <ShieldCheck className="w-4 h-4 text-[#005FB8]" />
                <span>Continuous Apparel Verification Protocol</span>
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                To guarantee sponsor trust and unlock your <strong>${campaign.dailyPayout} daily payout</strong>, you'll provide an initial check-in selfie wearing your brand gear, followed by <strong>randomized mid-shift photo prompts</strong> during active delivery runs.
              </p>
            </div>

            {/* Initial Photo Check-In */}
            <div className="space-y-2">
              <label className="block font-bold text-slate-900">
                1. Initial Check-In Photo (Wearing {campaign.brandName} Apparel)
              </label>
              
              <div className="p-4 border-2 border-dashed border-slate-300 hover:border-[#005FB8] rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-center gap-2 transition-colors">
                {initialPhoto ? (
                  <div className="space-y-2">
                    <img
                      src={initialPhoto}
                      alt="Initial selfie"
                      className="w-24 h-24 object-cover rounded-xl border border-slate-300 mx-auto shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setInitialPhoto('')}
                      className="text-[11px] text-rose-600 font-bold hover:underline cursor-pointer"
                    >
                      Retake / Replace Photo
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-[#005FB8] flex items-center justify-center">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">Take a quick selfie in your brand gear</div>
                      <div className="text-[11px] text-slate-500">Ensure sponsor logo on jacket/hoodie is clearly visible</div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setInitialPhoto('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80')}
                        className="px-3 py-1.5 rounded-lg bg-[#005FB8] text-white font-bold text-[11px] hover:bg-[#004C93] cursor-pointer"
                      >
                        Capture Camera Selfie
                      </button>
                      <button
                        type="button"
                        onClick={() => setInitialPhoto('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80')}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-[11px] hover:bg-slate-100 cursor-pointer"
                      >
                        Upload Photo
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Platform & Neighborhood Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-900 mb-1">
                  2. Active Gig App Platform
                </label>
                <select
                  value={selectedPlatform}
                  onChange={e => setSelectedPlatform(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-[#005FB8] focus:outline-hidden"
                >
                  <option value="DoorDash">DoorDash Driver</option>
                  <option value="UberEats">Uber Eats Courier</option>
                  <option value="Grubhub">Grubhub Delivery</option>
                  <option value="Instacart">Instacart Shopper</option>
                  <option value="Relay">Relay Delivery</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-900 mb-1">
                  3. Primary Corridor Zone
                </label>
                <select
                  value={selectedNeighborhood}
                  onChange={e => setSelectedNeighborhood(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-[#005FB8] focus:outline-hidden"
                >
                  {neighborhoods.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* GPS Geofence Confirmation */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="font-bold text-slate-900">GPS Breadcrumb Geofencing</div>
                  <div className="text-[10px] text-slate-500">Live street movement logs match {campaign.targetMetro} corridor</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                ACTIVE
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isStarting}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>{isStarting ? 'Initiating Route...' : 'Start Active Shift'}</span>
              </button>
            </div>

          </form>
        ) : (
          
          /* VIEW 2: ACTIVE SHIFT DASHBOARD & RANDOM PROMPT CONTROLLER */
          <div className="space-y-5 text-xs">
            
            {/* Active Live Timer & Street Stats Bar */}
            <div className="bg-slate-950 text-white p-5 rounded-2xl space-y-4 shadow-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Live Route Active</span>
                </div>
                <span className="text-slate-400 font-mono text-xs">
                  Started at {activeSession.startFormatted}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center pt-1 border-t border-slate-800">
                <div>
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider">Elapsed Time</div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
                    {formatTimer(elapsedSeconds)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider">Route Miles</div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-0.5">
                    {liveMiles} mi
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider">Est. Views</div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-amber-400 mt-0.5">
                    +{liveImpressions.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* URGENT OVERLAY: ACTIVE RANDOM SPOT CHECK PROMPT */}
            {activeSession.activePrompt && activeSession.activePrompt.status === 'PENDING' ? (
              <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-400 space-y-4 animate-in pulse duration-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-amber-950 font-black text-sm">
                    <Bell className="w-5 h-5 text-amber-600 animate-bounce" />
                    <span>⚡ RANDOM SPOT-CHECK PROMPT LANDED!</span>
                  </div>
                  <div className="px-3 py-1 rounded-xl bg-amber-200 text-amber-950 font-mono font-black text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{Math.floor(spotCheckTimeRemaining / 60)}:{(spotCheckTimeRemaining % 60).toString().padStart(2, '0')}</span>
                  </div>
                </div>

                <p className="text-amber-900 text-xs leading-relaxed font-medium">
                  Snap a quick photo now wearing your <strong>{campaign.brandName}</strong> apparel at your current location. You have 5 minutes to submit to protect your 100% compliance rate.
                </p>

                {spotCheckPhoto ? (
                  <div className="space-y-2">
                    <img
                      src={spotCheckPhoto}
                      alt="Spot-check selfie"
                      className="w-32 h-32 object-cover rounded-xl border border-amber-300 shadow-sm mx-auto"
                    />
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleRespondSpotCheck}
                        disabled={isSubmittingSpotCheck}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 shadow-xs cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>{isSubmittingSpotCheck ? 'Verifying...' : 'Submit Verification Photo'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setSpotCheckPhoto('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80')}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Instant Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpotCheckPhoto('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80')}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white border border-amber-300 text-amber-950 font-bold hover:bg-amber-100 cursor-pointer"
                    >
                      Upload Snapshot
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* SPOT CHECK MONITORING STATUS */
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#005FB8] flex items-center justify-center font-bold">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Randomized Spot-Check Prompts</div>
                    <div className="text-[11px] text-slate-500">
                      Prompts fire at unpredictable intervals during shift
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTriggerRandomPrompt}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-[11px] border border-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Simulate unpredictable push notification prompt"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-700" />
                  <span>Simulate Random Prompt</span>
                </button>
              </div>
            )}

            {/* Spot-Checks Verification History */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Shift Verification Log</span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {activeSession.spotChecks.filter(s => s.status === 'VERIFIED').length} / {activeSession.spotChecks.length} Verified (100% Score)
                </span>
              </div>

              <div className="space-y-2 max-h-36 overflow-y-auto">
                {activeSession.spotChecks.map((spot, idx) => (
                  <div
                    key={spot.id}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      {spot.status === 'VERIFIED' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : spot.status === 'MISSED' ? (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-spin" />
                      )}
                      <div>
                        <div className="font-bold text-slate-900">
                          {idx === 0 ? 'Initial Check-in' : `Random Spot-Check #${idx}`} ({spot.timestamp})
                        </div>
                        <div className="text-slate-500 text-[10px]">
                          {spot.locationLabel || activeSession.neighborhood}
                          {spot.secondsToRespond && ` • Responded in ${spot.secondsToRespond}s`}
                        </div>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      spot.status === 'VERIFIED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : spot.status === 'MISSED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {spot.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* End Shift Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
              >
                Minimize & Keep Running
              </button>

              <button
                type="button"
                onClick={() => setShowEndConfirmation(true)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-2 shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                <Square className="w-4 h-4" />
                <span>Complete Route & Claim ${campaign.dailyPayout}</span>
              </button>
            </div>

          </div>
        )}

        {/* END SHIFT CONFIRMATION MODAL OVERLAY */}
        {showEndConfirmation && activeSession && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-xs rounded-3xl p-6 flex flex-col justify-between animate-in fade-in duration-150 z-20">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto font-bold">
                <DollarSign className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-lg font-black text-slate-950">Confirm Shift Completion</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  You've logged <strong>{formatTimer(elapsedSeconds)}</strong> and completed all required photo verifications.
                </p>
              </div>

              <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Courier Ambassador:</span>
                  <strong className="text-slate-950">{activeSession.courierName}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Street Exposure:</span>
                  <strong className="text-slate-950">{liveMiles} miles (~{liveImpressions.toLocaleString()} views)</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Spot-Check Compliance:</span>
                  <strong className="text-emerald-700 font-black">
                    {activeSession.spotChecks.filter(s => s.status === 'VERIFIED').length} / {activeSession.spotChecks.length} Verified (100%)
                  </strong>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-900">Instant Stripe Treasury Credit:</span>
                  <span className="text-base font-black text-emerald-600 font-mono">+${activeSession.dailyRate}.00</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => setShowEndConfirmation(false)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 font-bold text-xs text-slate-700 cursor-pointer"
              >
                Back to Route
              </button>
              <button
                type="button"
                onClick={handleFinishShift}
                disabled={isCompleting}
                className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isCompleting ? 'Crediting Treasury...' : 'Claim & End Shift'}</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
