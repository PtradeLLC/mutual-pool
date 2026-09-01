import React, { useState, useEffect } from 'react';
import { User, AdCampaign, CampaignShiftLog, isAdvertiserOrAdmin } from '../types';
import { Logo } from './Logo';
import { AdvertiserDashboard } from './AdvertiserDashboard';
import { LanguageSelector } from './LanguageSelector';
import { INITIAL_CAMPAIGNS, INITIAL_CAMPAIGN_SHIFTS } from '../data/initialData';
import { useTranslation } from '../i18n/LanguageContext';
import { 
  Megaphone, ShieldCheck, Sparkles, TrendingUp, Users, DollarSign, 
  MapPin, CheckCircle2, ArrowRight, Clock, Award, BarChart3, 
  Calendar, Layers, Shirt, Send, Check, Phone, Mail, Building, 
  Globe, HelpCircle, ChevronRight, Eye, RefreshCw, Star, HeartHandshake,
  Download, ArrowLeft, Zap, Filter, LayoutDashboard, Calculator, Plus,
  Lock, LogIn, Store, QrCode, Navigation, Compass, CheckSquare, Tag,
  BadgePercent, Percent
} from 'lucide-react';

import promoFrontImg from '../assets/images/promo_hoodie_front_1786902471783.jpg';
import promoBackImg from '../assets/images/promo_hoodie_back_1786902490265.jpg';
import promoSleeveImg from '../assets/images/promo_hoodie_sleeve_1786902506042.jpg';

interface AdvertiserPageProps {
  currentUser?: User | null;
  campaigns?: AdCampaign[];
  shifts?: CampaignShiftLog[];
  onAddNewShift?: (shift: CampaignShiftLog) => void;
  onOpenCreateCampaign?: () => void;
  onBack: () => void;
  onOpenAuth?: (mode?: 'LOGIN' | 'REGISTER') => void;
  initialTab?: 'metrics' | 'media-kit';
}

const METRO_MARKETS = [
  { id: 'nyc', nameKey: 'advertiser.market_nyc', activeCouriers: '3,200+', dailyFootTraffic: '4.8M+' },
  { id: 'la', nameKey: 'advertiser.market_la', activeCouriers: '2,800+', dailyFootTraffic: '3.9M+' },
  { id: 'chicago', nameKey: 'advertiser.market_chicago', activeCouriers: '1,950+', dailyFootTraffic: '2.7M+' },
  { id: 'miami', nameKey: 'advertiser.market_miami', activeCouriers: '1,400+', dailyFootTraffic: '2.1M+' },
  { id: 'sf', nameKey: 'advertiser.market_sf', activeCouriers: '1,650+', dailyFootTraffic: '2.3M+' },
  { id: 'austin', nameKey: 'advertiser.market_austin', activeCouriers: '950+', dailyFootTraffic: '1.4M+' },
  { id: 'atlanta', nameKey: 'advertiser.market_atlanta', activeCouriers: '1,200+', dailyFootTraffic: '1.8M+' },
  { id: 'national', nameKey: 'advertiser.market_national', activeCouriers: '14,000+', dailyFootTraffic: '22M+' },
] as const;

// Hyperlocal Neighborhoods for Small Businesses
const HYPERLOCAL_NEIGHBORHOODS = [
  { id: 'hood_west_loop', nameKey: 'advertiser.hood_west_loop', metro: 'Chicago, IL', activeFleet: '65 verified couriers' },
  { id: 'hood_les_ev', nameKey: 'advertiser.hood_les_ev', metro: 'New York, NY', activeFleet: '120 verified couriers' },
  { id: 'hood_wburg', nameKey: 'advertiser.hood_wburg', metro: 'Brooklyn, NY', activeFleet: '85 verified couriers' },
  { id: 'hood_wicker', nameKey: 'advertiser.hood_wicker', metro: 'Chicago, IL', activeFleet: '50 verified couriers' },
  { id: 'hood_sm_venice', nameKey: 'advertiser.hood_sm_venice', metro: 'Los Angeles, CA', activeFleet: '75 verified couriers' },
  { id: 'hood_austin_dt', nameKey: 'advertiser.hood_austin_dt', metro: 'Austin, TX', activeFleet: '40 verified couriers' },
  { id: 'hood_midtown_atl', nameKey: 'advertiser.hood_midtown_atl', metro: 'Atlanta, GA', activeFleet: '45 verified couriers' },
  { id: 'hood_custom', nameKey: 'advertiser.hood_custom', metro: 'Direct Storefront Matching', activeFleet: 'Dynamic GPS radius' },
] as const;

// SMB Micro-Tier Duration Options
const SMB_DURATIONS = [
  { id: '1day', labelKey: 'advertiser.duration1Day', days: 1, ratePerDay: 150, subtitle: 'Grand Opening / 1-Day Peak' },
  { id: 'weekend', labelKey: 'advertiser.durationWeekend', days: 3, ratePerDay: 125, subtitle: 'Fri – Sun Dining Surge' },
  { id: '1week', labelKey: 'advertiser.duration1Week', days: 6, ratePerDay: 100, subtitle: '6 Active Delivery Days' },
  { id: '2week', labelKey: 'advertiser.duration2Week', days: 12, ratePerDay: 95, subtitle: '12 Active Days ($95/day)' },
] as const;

// SMB Fleet Options
const SMB_FLEET_OPTIONS = [
  { count: 5, labelKey: 'advertiser.calcSmb5', desc: '1–2 primary delivery corridors passing your storefront' },
  { count: 10, labelKey: 'advertiser.calcSmb10', desc: 'Full neighborhood saturation during lunch & dinner rushes' },
  { count: 15, labelKey: 'advertiser.calcSmb15', desc: 'Multi-corridor blitz for high-volume local restaurants' },
  { count: 25, labelKey: 'advertiser.calcSmb25', desc: 'District-wide coverage spanning adjacent zip codes' },
] as const;

// SMB Hardware & Co-sponsorship
const SMB_HARDWARE_OPTIONS = [
  {
    id: 'modular_sleeve',
    nameKey: 'advertiser.gearModularSleeveName',
    descKey: 'advertiser.gearModularSleeveDesc',
    rateDiscount: 0,
    badge: 'Amortized Hardware • $0 Setup',
  },
  {
    id: 'dual_sponsor',
    nameKey: 'advertiser.gearDualSponsorName',
    descKey: 'advertiser.gearDualSponsorDesc',
    rateDiscount: 25, // $25 discount per courier/day when sharing bag with a non-competing merchant
    badge: 'Save $25/day per courier',
  },
] as const;

const GEAR_ITEMS = [
  {
    id: 'hoodie',
    nameKey: 'advertiser.gear_hoodie_name',
    placementKey: 'advertiser.gear_hoodie_placement',
    materialKey: 'advertiser.gear_hoodie_material',
    visibilityKey: 'advertiser.gear_hoodie_visibility',
    recommendedForKey: 'advertiser.gear_hoodie_recommendedFor',
  },
  {
    id: 'tshirt',
    nameKey: 'advertiser.gear_tshirt_name',
    placementKey: 'advertiser.gear_tshirt_placement',
    materialKey: 'advertiser.gear_tshirt_material',
    visibilityKey: 'advertiser.gear_tshirt_visibility',
    recommendedForKey: 'advertiser.gear_tshirt_recommendedFor',
  },
  {
    id: 'delivery_bag',
    nameKey: 'advertiser.gear_delivery_bag_name',
    placementKey: 'advertiser.gear_delivery_bag_placement',
    materialKey: 'advertiser.gear_delivery_bag_material',
    visibilityKey: 'advertiser.gear_delivery_bag_visibility',
    recommendedForKey: 'advertiser.gear_delivery_bag_recommendedFor',
  },
  {
    id: 'cap_beanie',
    nameKey: 'advertiser.gear_cap_beanie_name',
    placementKey: 'advertiser.gear_cap_beanie_placement',
    materialKey: 'advertiser.gear_cap_beanie_material',
    visibilityKey: 'advertiser.gear_cap_beanie_visibility',
    recommendedForKey: 'advertiser.gear_cap_beanie_recommendedFor',
  },
] as const;

const FAQS = [
  { qKey: 'advertiser.faq1_q', aKey: 'advertiser.faq1_a' },
  { qKey: 'advertiser.faq2_q', aKey: 'advertiser.faq2_a' },
  { qKey: 'advertiser.faq3_q', aKey: 'advertiser.faq3_a' },
  { qKey: 'advertiser.faq4_q', aKey: 'advertiser.faq4_a' },
  { qKey: 'advertiser.faq5_q', aKey: 'advertiser.faq5_a' },
] as const;

export const AdvertiserPage: React.FC<AdvertiserPageProps> = ({
  currentUser,
  campaigns = INITIAL_CAMPAIGNS,
  shifts = INITIAL_CAMPAIGN_SHIFTS,
  onAddNewShift,
  onOpenCreateCampaign,
  onBack,
  onOpenAuth,
  initialTab = 'media-kit',
}) => {
  const { t, formatCurrency, language } = useTranslation();
  const isAuthenticated = !!(currentUser && currentUser.id && currentUser.id !== 'usr_guest');
  const canAccessMetrics = isAdvertiserOrAdmin(currentUser);

  // Users with role of Advertisers and Admins can access 'metrics' or 'media-kit'.
  // Gig workers, pod creators, and unauthenticated users only access 'media-kit' (Media Kit & Proposal Builder).
  const [pageViewMode, setPageViewMode] = useState<'metrics' | 'media-kit'>(() => {
    if (!canAccessMetrics) return 'media-kit';
    return initialTab === 'metrics' ? 'metrics' : 'media-kit';
  });

  useEffect(() => {
    if (!canAccessMetrics && pageViewMode === 'metrics') {
      setPageViewMode('media-kit');
    }
  }, [canAccessMetrics, pageViewMode]);

  // Campaign Calculator Tier Mode: 'smb' | 'enterprise' (Default to SMB for accessible self-serve micro-tiers)
  const [campaignTier, setCampaignTier] = useState<'smb' | 'enterprise'>('smb');

  // SMB Calculator State
  const [smbNeighborhood, setSmbNeighborhood] = useState<string>(HYPERLOCAL_NEIGHBORHOODS[0].id);
  const [smbFleetCount, setSmbFleetCount] = useState<number>(10);
  const [smbDurationId, setSmbDurationId] = useState<string>('1week');
  const [smbHardwareId, setSmbHardwareId] = useState<string>('modular_sleeve');
  const [customZipCode, setCustomZipCode] = useState<string>('');

  // Enterprise Calculator State
  const [selectedMarket, setSelectedMarket] = useState<string>(METRO_MARKETS[0].id);
  const [courierCount, setCourierCount] = useState<number>(100);
  const [durationWeeks, setDurationWeeks] = useState<number>(4);
  const [selectedGear, setSelectedGear] = useState<string>('hoodie');
  const [previewTab, setPreviewTab] = useState<'front' | 'back' | 'sleeve' | 'full'>('full');

  // Lead Intake Form State
  const [formData, setFormData] = useState({
    brandName: '',
    contactName: currentUser?.displayName || '',
    contactEmail: currentUser?.email || '',
    contactPhone: '',
    websiteUrl: '',
    campaignObjective: 'Brand Awareness & Street Dominance',
    budgetRange: '$500 - $1,500 (Hyperlocal 5–10 Couriers • Weekend/1-Week)',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Economic Model Calculations
  // SMB Micro-Tier Math
  const selectedSmbDuration = SMB_DURATIONS.find(d => d.id === smbDurationId) || SMB_DURATIONS[2];
  const selectedSmbHardware = SMB_HARDWARE_OPTIONS.find(h => h.id === smbHardwareId) || SMB_HARDWARE_OPTIONS[0];
  const smbActiveDays = selectedSmbDuration.days;
  const smbDailyRatePerCourier = Math.max(70, selectedSmbDuration.ratePerDay - selectedSmbHardware.rateDiscount);
  const smbTotalCost = smbFleetCount * smbDailyRatePerCourier * smbActiveDays;
  
  // 65% of the daily rate goes directly to the courier as a verified gig stipend ($65 - $97.50 / day)
  const smbCourierDailyPayout = smbDailyRatePerCourier * 0.65;
  const smbTotalCourierEarnings = smbFleetCount * smbCourierDailyPayout * smbActiveDays;
  
  // 35% platform gross margin covers amortized clear sleeve hardware ($3.50/insert), GPS route matching & QR attribution
  const smbPlatformGrossProfit = smbTotalCost - smbTotalCourierEarnings;
  
  // Hyperlocal impressions: ~1,600 high-density neighborhood impressions per courier shift
  const smbDailyImpressionsPerCourier = 1600;
  const smbTotalImpressions = smbFleetCount * smbDailyImpressionsPerCourier * smbActiveDays;
  const smbEffectiveCpm = ((smbTotalCost / smbTotalImpressions) * 1000).toFixed(2);
  const smbEstimatedQrScans = Math.round(smbFleetCount * smbActiveDays * 32);

  // Enterprise Tier Math
  const enterpriseActiveDays = durationWeeks * 6;
  const enterpriseDailyImpressionsPerCourier = 1450;
  const enterpriseTotalImpressions = courierCount * enterpriseDailyImpressionsPerCourier * enterpriseActiveDays;
  const enterpriseCourierDailyPayout = 65; // Average net take-home
  const enterpriseTotalCourierEarnings = courierCount * enterpriseCourierDailyPayout * enterpriseActiveDays;
  const enterpriseOpsAndGearCost = (enterpriseTotalCourierEarnings / 0.65) * 0.35 + (courierCount * 45);
  const enterpriseTotalCost = enterpriseTotalCourierEarnings + enterpriseOpsAndGearCost;
  const enterpriseEffectiveCpm = ((enterpriseTotalCost / enterpriseTotalImpressions) * 1000).toFixed(2);

  // Active Display Figures based on current selected tier
  const isSmb = campaignTier === 'smb';
  const displayCost = isSmb ? smbTotalCost : enterpriseTotalCost;
  const displayImpressions = isSmb ? smbTotalImpressions : enterpriseTotalImpressions;
  const displayEarnings = isSmb ? smbTotalCourierEarnings : enterpriseTotalCourierEarnings;
  const displayPlatformProfit = isSmb ? smbPlatformGrossProfit : (enterpriseTotalCost - enterpriseTotalCourierEarnings);
  const displayCpm = isSmb ? smbEffectiveCpm : enterpriseEffectiveCpm;
  const displayActiveDays = isSmb ? smbActiveDays : enterpriseActiveDays;
  const displayCourierCount = isSmb ? smbFleetCount : courierCount;

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brandName.trim() || !formData.contactEmail.trim()) {
      setErrorMsg(t('advertiser.formError'));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/campaigns/advertiser-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: formData.brandName.trim(),
          contactName: formData.contactName.trim() || 'Brand Partner',
          contactEmail: formData.contactEmail.trim(),
          contactPhone: formData.contactPhone.trim(),
          websiteUrl: formData.websiteUrl.trim(),
          targetMarkets: [selectedMarket],
          campaignObjective: formData.campaignObjective,
          estimatedBudget: formData.budgetRange,
          fleetSizeTarget: courierCount,
          campaignDurationWeeks: durationWeeks,
          apparelTypes: [selectedGear],
          customNotes: formData.notes.trim(),
          submittedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        console.warn('API returned non-200, continuing with client confirmation.');
      }

      setSubmittedSuccess(true);
    } catch (err: unknown) {
      console.error('Submit error:', err);
      setSubmittedSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-[#005FB8] selection:text-white font-sans">
      
      {/* Top Sticky Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-300 cursor-pointer"
              title="Return to previous view"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('advertiser.back')}</span>
            </button>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Logo size="sm" />
            </div>
          </div>

          {/* Center View Selector Tabs - Visible Only to Users with Role Advertiser or Admin */}
          {canAccessMetrics && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setPageViewMode('media-kit');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  pageViewMode === 'media-kit'
                    ? 'bg-[#005FB8] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>{t('advertiser.tabMediaKit')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPageViewMode('metrics');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  pageViewMode === 'metrics'
                    ? 'bg-[#005FB8] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View live campaign analytics & courier fleet shifts"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>{t('advertiser.tabMetrics')}</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <LanguageSelector />

            {!isAuthenticated && onOpenAuth && (
              <button
                type="button"
                onClick={() => onOpenAuth('LOGIN')}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors border border-slate-300 flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-700" />
                <span>{t('advertiser.signIn')}</span>
              </button>
            )}

            {pageViewMode === 'metrics' && canAccessMetrics ? (
              <button
                type="button"
                onClick={() => {
                  setPageViewMode('media-kit');
                  setTimeout(() => {
                    document.getElementById('launch-form')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="px-4 py-2 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('advertiser.sponsorFleet')}</span>
              </button>
            ) : (
              <a
                href="#launch-form"
                className="px-4 py-2 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Megaphone className="w-4 h-4" />
                <span>{t('advertiser.launchCampaign')}</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Render: Restricted to Advertisers and Admins only */}
      {pageViewMode === 'metrics' && canAccessMetrics ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <AdvertiserDashboard
            currentUser={currentUser}
            campaigns={campaigns}
            shifts={shifts}
            onAddNewShift={onAddNewShift}
            onOpenProposalBuilder={() => {
              setPageViewMode('media-kit');
              setTimeout(() => {
                document.getElementById('launch-form')?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            onOpenCreateCampaign={onOpenCreateCampaign}
            onBack={onBack}
          />
        </main>
      ) : (
        <>
          {/* Hero Section */}
      <section className="relative overflow-hidden pt-10 pb-16 px-4 sm:px-6 border-b border-slate-200 bg-gradient-to-b from-[#F8FAFC] via-white to-white">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-extrabold tracking-wide uppercase">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>{t('advertiser.heroBadge')}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight uppercase leading-none">
              {t('advertiser.heroTitle')}
            </h1>

            <p className="text-base sm:text-xl text-slate-700 font-semibold leading-relaxed">
              {t('advertiser.heroSubtitle')}
            </p>

            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
              {t('advertiser.heroDesc')}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href="#launch-form"
                className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm tracking-wide transition-all shadow-md shadow-amber-500/20 flex items-center gap-2"
              >
                <span>{t('advertiser.requestMediaKit')}</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#calculator"
                className="px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-sm transition-all shadow-xs"
              >
                {t('advertiser.estimateReach')}
              </a>
            </div>
          </div>

          {/* EXACT 3-PANEL APPAREL SHOWCASE */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 shadow-xl space-y-6">
            
            {/* Header of Showcase */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight uppercase">
                    {t('advertiser.heroTitle')}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    {t('advertiser.showcaseBadge')}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  {t('advertiser.heroSubtitle')}
                </p>
              </div>

              {/* View Toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setPreviewTab('full')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    previewTab === 'full' ? 'bg-[#005FB8] text-white shadow-xs' : 'hover:text-slate-950'
                  }`}
                >
                  {t('advertiser.all3Views')}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('front')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    previewTab === 'front' ? 'bg-[#005FB8] text-white shadow-xs' : 'hover:text-slate-950'
                  }`}
                >
                  {t('advertiser.frontView')}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('back')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    previewTab === 'back' ? 'bg-[#005FB8] text-white shadow-xs' : 'hover:text-slate-950'
                  }`}
                >
                  {t('advertiser.backView')}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('sleeve')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    previewTab === 'sleeve' ? 'bg-[#005FB8] text-white shadow-xs' : 'hover:text-slate-950'
                  }`}
                >
                  {t('advertiser.sleeveDetail')}
                </button>
              </div>
            </div>

            {/* 3-Panel Visual Showcase Grid */}
            {previewTab === 'full' ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                
                {/* Panel 1: Front View (Span 5) */}
                <div className="md:col-span-5 bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 relative group flex flex-col shadow-sm">
                  <div className="absolute top-4 left-4 z-10">
                    <span className="px-3 py-1 rounded-md bg-black/75 backdrop-blur-md text-white font-mono font-bold text-xs tracking-wider border border-white/20 uppercase">
                      {t('advertiser.panel1Badge')}
                    </span>
                  </div>
                  <div className="relative aspect-4/5 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                    <img
                      src={promoFrontImg}
                      alt="Front View of Partner Promo Hoodie"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 pointer-events-none" />
                  </div>
                  <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-1">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                      {t('advertiser.panel1Title')}
                    </div>
                    <p className="text-xs text-slate-200 font-medium">
                      {t('advertiser.panel1Desc')}
                    </p>
                  </div>
                </div>

                {/* Panel 2: Back View (Span 4) */}
                <div className="md:col-span-4 bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 relative group flex flex-col shadow-sm">
                  <div className="absolute top-4 left-4 z-10">
                    <span className="px-3 py-1 rounded-md bg-black/75 backdrop-blur-md text-white font-mono font-bold text-xs tracking-wider border border-white/20 uppercase">
                      {t('advertiser.panel2Badge')}
                    </span>
                  </div>
                  <div className="relative aspect-4/5 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                    <img
                      src={promoBackImg}
                      alt="Back View of Partner Promo Hoodie"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 pointer-events-none" />
                  </div>
                  <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-1">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                      {t('advertiser.panel2Title')}
                    </div>
                    <p className="text-xs text-slate-200 font-medium">
                      {t('advertiser.panel2Desc')}
                    </p>
                  </div>
                </div>

                {/* Panel 3: Sleeve Detail (Span 3) */}
                <div className="md:col-span-3 bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 relative group flex flex-col shadow-sm">
                  <div className="absolute top-4 left-4 z-10">
                    <span className="px-3 py-1 rounded-md bg-black/75 backdrop-blur-md text-white font-mono font-bold text-xs tracking-wider border border-white/20 uppercase">
                      {t('advertiser.panel3Badge')}
                    </span>
                  </div>
                  <div className="relative aspect-4/5 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                    <img
                      src={promoSleeveImg}
                      alt="Sleeve Detail of Partner Promo Hoodie"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 pointer-events-none" />
                  </div>
                  <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-1">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                      {t('advertiser.panel3Title')}
                    </div>
                    <p className="text-xs text-slate-200 font-medium">
                      {t('advertiser.panel3Desc')}
                    </p>
                  </div>
                </div>

              </div>
            ) : previewTab === 'front' ? (
              <div className="max-w-2xl mx-auto rounded-2xl overflow-hidden border border-slate-200 bg-slate-950">
                <img src={promoFrontImg} alt="Front View" className="w-full object-cover aspect-3/4" />
                <div className="p-4 bg-slate-900 text-center">
                  <h3 className="font-bold text-white text-base">{t('advertiser.frontViewDetailTitle')}</h3>
                  <p className="text-xs text-slate-300 mt-1">{t('advertiser.frontViewDetailDesc')}</p>
                </div>
              </div>
            ) : previewTab === 'back' ? (
              <div className="max-w-2xl mx-auto rounded-2xl overflow-hidden border border-slate-200 bg-slate-950">
                <img src={promoBackImg} alt="Back View" className="w-full object-cover aspect-3/4" />
                <div className="p-4 bg-slate-900 text-center">
                  <h3 className="font-bold text-white text-base">{t('advertiser.backViewDetailTitle')}</h3>
                  <p className="text-xs text-slate-300 mt-1">{t('advertiser.backViewDetailDesc')}</p>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto rounded-2xl overflow-hidden border border-slate-200 bg-slate-950">
                <img src={promoSleeveImg} alt="Sleeve Detail" className="w-full object-cover aspect-3/4" />
                <div className="p-4 bg-slate-900 text-center">
                  <h3 className="font-bold text-white text-base">{t('advertiser.sleeveViewDetailTitle')}</h3>
                  <p className="text-xs text-slate-300 mt-1">{t('advertiser.sleeveViewDetailDesc')}</p>
                </div>
              </div>
            )}

            {/* Quick Metrics Bar Under Showcase */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200">
              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200 text-center">
                <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{t('advertiser.avgDailyShifts')}</div>
                <div className="text-lg font-black text-slate-900 mt-0.5">{t('advertiser.avgDailyShiftsVal')}</div>
              </div>
              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200 text-center">
                <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{t('advertiser.dailyImpressions')}</div>
                <div className="text-lg font-black text-amber-600 mt-0.5">{t('advertiser.dailyImpressionsVal')}</div>
              </div>
              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200 text-center">
                <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{t('advertiser.courierDailyPayout')}</div>
                <div className="text-lg font-black text-emerald-600 mt-0.5">{t('advertiser.courierDailyPayoutVal')}</div>
              </div>
              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200 text-center">
                <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{t('advertiser.effectiveCpm')}</div>
                <div className="text-lg font-black text-[#005FB8] mt-0.5">{t('advertiser.effectiveCpmVal')}</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Why Advertise with MutualPool Section */}
      <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <h2 className="text-2xl sm:text-4xl font-black uppercase text-slate-950 tracking-tight">
            {t('advertiser.whyTitle')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {t('advertiser.whyDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#005FB8]">
              <Eye className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{t('advertiser.prop1Title')}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t('advertiser.prop1Desc')}
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{t('advertiser.prop2Title')}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t('advertiser.prop2Desc')}
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{t('advertiser.prop3Title')}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t('advertiser.prop3Desc')}
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Campaign Reach & ROI Calculator Section */}
      <section id="calculator" className="py-16 px-4 sm:px-6 bg-[#F8FAFC] border-y border-slate-200">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-8">
            <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#005FB8] text-xs font-bold uppercase tracking-wider">
              {t('advertiser.calcBadge')}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black uppercase text-slate-950 tracking-tight">
              {t('advertiser.calcTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              {t('advertiser.calcDesc')}
            </p>
          </div>

          {/* Tier Switcher: Self-Serve Hyperlocal SMB vs. Metro Enterprise */}
          <div className="max-w-2xl mx-auto mb-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 p-1.5 bg-slate-200/75 rounded-2xl gap-1.5 border border-slate-300 shadow-inner">
              <button
                type="button"
                onClick={() => {
                  setCampaignTier('smb');
                  setFormData(prev => ({
                    ...prev,
                    budgetRange: '$500 - $1,500 (Hyperlocal 5–10 Couriers • Weekend/1-Week)',
                  }));
                }}
                className={`py-3 px-4 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 ${
                  campaignTier === 'smb'
                    ? 'bg-white text-slate-950 shadow-md font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  campaignTier === 'smb' ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-500'
                }`}>
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-950 flex items-center gap-1.5">
                    {t('advertiser.tierSmb')}
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800">
                      Self-Serve
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal">
                    {t('advertiser.tierSmbSubtitle')}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCampaignTier('enterprise');
                  setFormData(prev => ({
                    ...prev,
                    budgetRange: '$15,000 - $50,000 (Multi-City Fleet)',
                  }));
                }}
                className={`py-3 px-4 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 ${
                  campaignTier === 'enterprise'
                    ? 'bg-white text-slate-950 shadow-md font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  campaignTier === 'enterprise' ? 'bg-blue-100 text-blue-900' : 'bg-slate-200 text-slate-500'
                }`}>
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-950">
                    {t('advertiser.tierEnterprise')}
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal">
                    {t('advertiser.tierEnterpriseSubtitle')}
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Calculator Controls (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
              
              {/* Conditional Controls: SMB vs Enterprise */}
              {isSmb ? (
                <>
                  {/* Step 1: Hyperlocal Neighborhood / Radius */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                        {t('advertiser.calcStep1Smb')}
                      </label>
                      <span className="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
                        <Compass className="w-3.5 h-3.5" /> 2-Mile Courier Corridors
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {HYPERLOCAL_NEIGHBORHOODS.map(hood => (
                        <button
                          key={hood.id}
                          type="button"
                          onClick={() => setSmbNeighborhood(hood.id)}
                          className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                            smbNeighborhood === hood.id
                              ? 'bg-amber-50/80 border-amber-500 text-slate-950 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                          }`}
                        >
                          <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                            <span>{t(hood.nameKey)}</span>
                            {smbNeighborhood === hood.id && <Check className="w-3.5 h-3.5 text-amber-700" />}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                            <span>{hood.metro}</span>
                            <span className="text-slate-800 font-semibold">{hood.activeFleet}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {smbNeighborhood === 'hood_custom' && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Enter Storefront Address or Target Zip Codes:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., 94103 (Mission District) or 123 Main St, Austin TX"
                          value={customZipCode}
                          onChange={(e) => setCustomZipCode(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#005FB8]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Step 2: SMB Fleet Size Options (5 - 25 Couriers) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                        {t('advertiser.calcStep2Smb')}
                      </label>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-mono font-bold">
                        {smbFleetCount} Couriers Selected
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {SMB_FLEET_OPTIONS.map(opt => (
                        <button
                          key={opt.count}
                          type="button"
                          onClick={() => setSmbFleetCount(opt.count)}
                          className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                            smbFleetCount === opt.count
                              ? 'bg-amber-50/80 border-amber-500 text-slate-950 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                          }`}
                        >
                          <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                            <span>{t(opt.labelKey)}</span>
                            {smbFleetCount === opt.count && <Check className="w-3.5 h-3.5 text-amber-700" />}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                            {opt.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 3: SMB Duration (Daily / Weekend / Weekly) */}
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                      {t('advertiser.calcStep3Smb')}
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {SMB_DURATIONS.map(dur => (
                        <button
                          key={dur.id}
                          type="button"
                          onClick={() => setSmbDurationId(dur.id)}
                          className={`p-2.5 rounded-xl text-center border font-bold transition-all cursor-pointer ${
                            smbDurationId === dur.id
                              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-black'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                          }`}
                        >
                          <div className="text-xs">{t(dur.labelKey)}</div>
                          <div className="text-[10px] font-normal mt-0.5 opacity-80">{dur.subtitle}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 4: Modular Hardware & Foot-Traffic Tracking */}
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                      {t('advertiser.calcStep4Smb')}
                    </label>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {SMB_HARDWARE_OPTIONS.map(hw => (
                        <button
                          key={hw.id}
                          type="button"
                          onClick={() => setSmbHardwareId(hw.id)}
                          className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                            smbHardwareId === hw.id
                              ? 'bg-amber-50/80 border-amber-500 text-slate-950'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-bold text-slate-900">{t(hw.nameKey)}</div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              {hw.badge}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                            {t(hw.descKey)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                /* Enterprise Mode Controls */
                <>
                  {/* Market Selection */}
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                      {t('advertiser.calcStep1Enterprise')}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {METRO_MARKETS.map(market => (
                        <button
                          key={market.id}
                          type="button"
                          onClick={() => setSelectedMarket(market.id)}
                          className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                            selectedMarket === market.id
                              ? 'bg-blue-50/80 border-[#005FB8] text-slate-950 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                          }`}
                        >
                          <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                            <span>{t(market.nameKey)}</span>
                            {selectedMarket === market.id && <Check className="w-3.5 h-3.5 text-[#005FB8]" />}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {t('advertiser.calcActiveFleet')} <span className="text-slate-800 font-semibold">{market.activeCouriers}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fleet Size Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                        {t('advertiser.calcStep2Enterprise')}
                      </label>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-xs font-mono font-bold">
                        {t('advertiser.calcActiveCouriers', { count: courierCount })}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="25"
                      max="500"
                      step="25"
                      value={courierCount}
                      onChange={(e) => setCourierCount(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#005FB8]"
                    />
                    <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
                      <span>{t('advertiser.calcPilot')}</span>
                      <span>{t('advertiser.calcStandard')}</span>
                      <span>{t('advertiser.calcDominant')}</span>
                      <span>{t('advertiser.calcTakeover')}</span>
                    </div>
                  </div>

                  {/* Duration Selector */}
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                      {t('advertiser.calcStep3Enterprise')}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[2, 4, 8, 12].map(weeks => (
                        <button
                          key={weeks}
                          type="button"
                          onClick={() => setDurationWeeks(weeks)}
                          className={`py-2.5 px-2 rounded-xl text-center border font-bold text-xs transition-all cursor-pointer ${
                            durationWeeks === weeks
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-black'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                          }`}
                        >
                          {t('advertiser.calcWeeks', { weeks })}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Apparel Gear Package */}
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                      {t('advertiser.calcStep4Enterprise')}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {GEAR_ITEMS.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedGear(item.id)}
                          className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                            selectedGear === item.id
                              ? 'bg-blue-50/80 border-[#005FB8] text-slate-950'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="text-xs font-bold text-slate-900">{t(item.nameKey)}</div>
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{t(item.placementKey)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

            </div>

            {/* Live Campaign ROI & Economics Card (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md">
              
              <div className="border-b border-slate-200 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                    {t('advertiser.summaryBadge')}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    isSmb ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                  }`}>
                    {isSmb ? 'Hyperlocal SMB Tier' : 'Metro Enterprise Tier'}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-950 mt-1">
                  {t('advertiser.summaryTitle')}
                </h3>
              </div>

              <div className="space-y-4">
                
                {/* Total Street Impressions */}
                <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">{t('advertiser.summaryImpressions')}</div>
                  <div className="text-3xl font-black text-amber-600 font-mono mt-1">
                    {displayImpressions.toLocaleString()}+
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {t('advertiser.summaryImpressionsSub', { days: displayActiveDays, couriers: displayCourierCount })}
                  </div>
                </div>

                {/* Direct Courier Earnings */}
                <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">{t('advertiser.summaryEarnings')}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      65% Payout
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-600 font-mono mt-1">
                    {formatCurrency ? formatCurrency(displayEarnings) : `$${displayEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {t('advertiser.summaryEarningsSub')}
                  </div>
                </div>

                {/* Additional Stats: Estimated QR Scans & Platform Margin */}
                {isSmb && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                      <div className="text-[10px] text-emerald-800 uppercase font-bold flex items-center gap-1">
                        <QrCode className="w-3 h-3 text-emerald-600" /> {t('advertiser.summaryEstimatedQrScans')}
                      </div>
                      <div className="text-base font-black text-emerald-950 font-mono mt-0.5">
                        ~{smbEstimatedQrScans.toLocaleString()} scans
                      </div>
                    </div>

                    <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200">
                      <div className="text-[10px] text-blue-800 uppercase font-bold flex items-center gap-1">
                        <Percent className="w-3 h-3 text-blue-600" /> Platform Margin
                      </div>
                      <div className="text-base font-black text-blue-950 font-mono mt-0.5">
                        35% (${Math.round(smbPlatformGrossProfit).toLocaleString()})
                      </div>
                    </div>
                  </div>
                )}

                {/* Cost and CPM */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">{t('advertiser.summaryCost')}</div>
                    <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                      {formatCurrency ? formatCurrency(displayCost) : `$${displayCost.toLocaleString()}`}
                    </div>
                  </div>

                  <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">{t('advertiser.summaryCpm')}</div>
                    <div className="text-lg font-black text-[#005FB8] font-mono mt-0.5">
                      ${displayCpm}
                    </div>
                  </div>
                </div>

              </div>

              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-[#005FB8] shrink-0 mt-0.5" />
                <span>
                  {isSmb ? t('advertiser.summaryNoteSmb') : t('advertiser.summaryNoteEnterprise')}
                </span>
              </div>

              <a
                href="#launch-form"
                onClick={() => {
                  if (isSmb) {
                    const foundHood = HYPERLOCAL_NEIGHBORHOODS.find(h => h.id === smbNeighborhood);
                    const hoodLabel = foundHood ? t(foundHood.nameKey) : 'Hyperlocal 2-Mile Radius';
                    setFormData(prev => ({
                      ...prev,
                      budgetRange: smbTotalCost < 1500 
                        ? '$500 - $1,500 (Hyperlocal 5–10 Couriers • Weekend/1-Week)'
                        : '$1,500 - $3,500 (Neighborhood Blitz 15–25 Couriers)',
                      notes: `Hyperlocal Micro-Tier: ${smbFleetCount} couriers, ${selectedSmbDuration.subtitle}, Neighborhood: ${smbNeighborhood === 'hood_custom' ? customZipCode || 'Custom Storefront' : hoodLabel}`,
                    }));
                  }
                }}
                className="w-full py-3.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-sm text-center block transition-all shadow-md shadow-blue-500/25 cursor-pointer"
              >
                {isSmb ? t('advertiser.summaryLockInSmb') : t('advertiser.summaryLockInEnterprise')}
              </a>

            </div>

          </div>

          {/* Educational Explainer: The Hyperlocal Small Business Economics */}
          <div className="mt-12 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-950">Why the Hyperlocal Micro-Tier Makes Economic Sense</h3>
                <p className="text-xs text-slate-500">How small businesses achieve high-density impressions and positive ROI with zero production overhead</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                65% Courier Wages • 35% Platform Margin
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                  <Navigation className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Natural Courier Corridors</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  A local pizzeria doesn't need 100 couriers across the whole city. 5–15 delivery couriers already pick up 15–25 food orders per day directly within your 2-mile radius, circling your neighborhood during lunch and dinner.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Amortized Modular Hardware</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Instead of paying $1,000+ for custom screen-printed textile runs, we utilize weather-proof modular backpack clear-window billboard sleeves with synthetic inserts ($3.50/unit amortized), eliminating upfront setup costs.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                  <QrCode className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Measurable QR Foot-Traffic</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Every courier billboard includes high-contrast, scannable QR codes and unique neighborhood promo codes, driving direct local foot-traffic and trackable customer redemptions right to your register.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Promotional Apparel Gear Catalog Section */}
      <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
            {t('advertiser.catalogBadge')}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black uppercase text-slate-950 tracking-tight">
            {t('advertiser.catalogTitle')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            {t('advertiser.catalogDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {GEAR_ITEMS.map((gear, idx) => (
            <div
              key={gear.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-amber-600 font-bold">
                  0{idx + 1}
                </div>
                <h3 className="font-bold text-slate-900 text-base leading-snug">{t(gear.nameKey)}</h3>
                <div className="text-xs text-slate-600 space-y-1">
                  <p><strong className="text-slate-800">{t('advertiser.gearPlacement')}</strong> {t(gear.placementKey)}</p>
                  <p><strong className="text-slate-800">{t('advertiser.gearMaterial')}</strong> {t(gear.materialKey)}</p>
                  <p><strong className="text-slate-800">{t('advertiser.gearVisibility')}</strong> {t(gear.visibilityKey)}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <span className="text-[11px] text-amber-700 font-bold block">
                  {t('advertiser.gearBestFor')} {t(gear.recommendedForKey)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Campaign Launch & Inquiry Intake Form Section */}
      <section id="launch-form" className="py-16 px-4 sm:px-6 bg-[#F8FAFC] border-t border-slate-200">
        <div className="max-w-4xl mx-auto">
          
          <div className="text-center space-y-3 mb-10">
            <span className="px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold uppercase tracking-wider">
              {t('advertiser.formBadge')}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black uppercase text-slate-950 tracking-tight">
              {t('advertiser.formTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
              {t('advertiser.formDesc')}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-lg">
            {submittedSuccess ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-950">{t('advertiser.successTitle')}</h3>
                <p className="text-sm text-slate-700 max-w-md mx-auto leading-relaxed">
                  {t('advertiser.successDesc', { 
                    name: formData.contactName || 'Partner',
                    email: formData.contactEmail
                  })}
                </p>
                <div className="pt-4 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedSuccess(false);
                      setFormData({
                        brandName: '',
                        contactName: currentUser?.displayName || '',
                        contactEmail: currentUser?.email || '',
                        contactPhone: '',
                        websiteUrl: '',
                        campaignObjective: 'Brand Awareness & Street Dominance',
                        budgetRange: '$5,000 - $15,000',
                        notes: '',
                      });
                    }}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer border border-slate-300"
                  >
                    {t('advertiser.submitAnother')}
                  </button>
                  <button
                    type="button"
                    onClick={onBack}
                    className="px-5 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    {t('advertiser.returnToApp')}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitInquiry} className="space-y-6">
                
                {errorMsg && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t('advertiser.brandNameLabel')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="brandName"
                      required
                      placeholder={t('advertiser.brandNamePlaceholder')}
                      value={formData.brandName}
                      onChange={handleFormChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t('advertiser.websiteUrlLabel')}
                    </label>
                    <input
                      type="url"
                      name="websiteUrl"
                      placeholder={t('advertiser.websiteUrlPlaceholder')}
                      value={formData.websiteUrl}
                      onChange={handleFormChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t('advertiser.contactNameLabel')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="contactName"
                      required
                      placeholder={t('advertiser.contactNamePlaceholder')}
                      value={formData.contactName}
                      onChange={handleFormChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t('advertiser.businessEmailLabel')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="contactEmail"
                      required
                      placeholder={t('advertiser.businessEmailPlaceholder')}
                      value={formData.contactEmail}
                      onChange={handleFormChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t('advertiser.phoneLabel')}
                    </label>
                    <input
                      type="tel"
                      name="contactPhone"
                      placeholder={t('advertiser.phonePlaceholder')}
                      value={formData.contactPhone}
                      onChange={handleFormChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t('advertiser.objectiveLabel')}
                    </label>
                    <select
                      name="campaignObjective"
                      value={formData.campaignObjective}
                      onChange={handleFormChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                    >
                      <option value="Brand Awareness & Street Dominance">{t('advertiser.obj1')}</option>
                      <option value="Product Launch or Promo Code Blitz">{t('advertiser.obj2')}</option>
                      <option value="App Downloads & QR Drive">{t('advertiser.obj3')}</option>
                      <option value="Corporate Social Responsibility & Gig Support">{t('advertiser.obj4')}</option>
                      <option value="Event Sponsorship / Festival Activation">{t('advertiser.obj5')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t('advertiser.budgetLabel')}
                    </label>
                    <select
                      name="budgetRange"
                      value={formData.budgetRange}
                      onChange={handleFormChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                    >
                      <optgroup label="Hyperlocal Small Business Micro-Tiers">
                        <option value="$500 - $1,500 (Hyperlocal 5–10 Couriers • Weekend/1-Week)">
                          $500 – $1,500 ({t('advertiser.budgetSmb1')})
                        </option>
                        <option value="$1,500 - $3,500 (Neighborhood Blitz 15–25 Couriers)">
                          $1,500 – $3,500 ({t('advertiser.budgetSmb2')})
                        </option>
                      </optgroup>
                      <optgroup label="Metro Enterprise & Multi-City Campaigns">
                        <option value="Under $5,000 (Pilot 25 Couriers)">{t('advertiser.budget1')}</option>
                        <option value="$5,000 - $15,000 (50 - 100 Couriers)">{t('advertiser.budget2')}</option>
                        <option value="$15,000 - $50,000 (Multi-City Fleet)">{t('advertiser.budget3')}</option>
                        <option value="$50,000+ (National Enterprise Takeover)">{t('advertiser.budget4')}</option>
                      </optgroup>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('advertiser.notesLabel')}
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder={t('advertiser.notesPlaceholder')}
                    value={formData.notes}
                    onChange={handleFormChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-6 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-black text-sm tracking-wide transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>{isSubmitting ? t('advertiser.submitting') : t('advertiser.submitBtn')}</span>
                  </button>
                  <p className="text-[11px] text-center text-slate-500 mt-2">
                    {t('advertiser.noUpfront')}
                  </p>
                </div>

              </form>
            )}
          </div>

        </div>
      </section>

      {/* FAQs Section */}
      <section className="py-16 px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="text-center space-y-3 mb-10">
          <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider">
            {t('advertiser.faqBadge')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-slate-950 tracking-tight">
            {t('advertiser.faqTitle')}
          </h2>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-start gap-2">
                <span className="text-[#005FB8] font-mono">Q.</span>
                <span>{t(faq.qKey)}</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 pl-5 leading-relaxed">
                {t(faq.aKey)}
              </p>
            </div>
          ))}
        </div>
      </section>
      </>
      )}

      {/* Footer */}
      <footer className="bg-[#F8FAFC] border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
          </div>
          <div>
            © {new Date().getFullYear()} Chris Bitoye Ventures. {t('advertiser.rightsReserved')}
          </div>
        </div>
      </footer>

    </div>
  );
};

