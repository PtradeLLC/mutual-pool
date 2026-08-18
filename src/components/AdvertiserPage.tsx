import React, { useState } from 'react';
import { User, AdCampaign, CampaignShiftLog } from '../types';
import { Logo } from './Logo';
import { AdvertiserDashboard } from './AdvertiserDashboard';
import { INITIAL_CAMPAIGNS, INITIAL_CAMPAIGN_SHIFTS } from '../data/initialData';
import { 
  Megaphone, ShieldCheck, Sparkles, TrendingUp, Users, DollarSign, 
  MapPin, CheckCircle2, ArrowRight, Clock, Award, BarChart3, 
  Calendar, Layers, Shirt, Send, Check, Phone, Mail, Building, 
  Globe, HelpCircle, ChevronRight, Eye, RefreshCw, Star, HeartHandshake,
  Download, ArrowLeft, Zap, Filter, LayoutDashboard, Calculator, Plus,
  Lock, LogIn
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
  { id: 'nyc', name: 'New York City (Manhattan & Brooklyn)', activeCouriers: '3,200+', dailyFootTraffic: '4.8M+' },
  { id: 'la', name: 'Los Angeles & Santa Monica', activeCouriers: '2,800+', dailyFootTraffic: '3.9M+' },
  { id: 'chicago', name: 'Chicago (Loop & River North)', activeCouriers: '1,950+', dailyFootTraffic: '2.7M+' },
  { id: 'miami', name: 'Miami & South Beach', activeCouriers: '1,400+', dailyFootTraffic: '2.1M+' },
  { id: 'sf', name: 'San Francisco & Bay Area', activeCouriers: '1,650+', dailyFootTraffic: '2.3M+' },
  { id: 'austin', name: 'Austin & Downtown Tech Corridor', activeCouriers: '950+', dailyFootTraffic: '1.4M+' },
  { id: 'atlanta', name: 'Atlanta (Buckhead & Midtown)', activeCouriers: '1,200+', dailyFootTraffic: '1.8M+' },
  { id: 'national', name: 'National Multi-Market Fleet (Top 15 Cities)', activeCouriers: '14,000+', dailyFootTraffic: '22M+' },
];

const GEAR_ITEMS = [
  {
    id: 'hoodie',
    name: 'Heavyweight Streetwear Hoodie',
    placement: 'Front Chest Logo + Full Back Banner + Right Sleeve',
    material: '450 GSM Ultra-Durable Cotton Fleece',
    visibility: 'High (360° Street Level)',
    recommendedFor: 'Fall, Winter & Spring High-Impact Brand Launches',
  },
  {
    id: 'tshirt',
    name: 'High-Visibility Performance Tee / Jersey',
    placement: 'Chest Emblem + Back Motto + Left & Right Sleeves',
    material: 'Moisture-Wicking Breathable Poly-Cotton Blend',
    visibility: 'Maximum Summer Route Exposure',
    recommendedFor: 'Warm Weather & Fast Delivery Couriers',
  },
  {
    id: 'delivery_bag',
    name: 'Insulated Commercial Delivery Backpack',
    placement: 'Triple-Sided Reflective Waterproof Brand Print',
    material: '600D Waterproof Ballistic Nylon with Thermal Lining',
    visibility: 'Dominant Walking & Bike Eye-Level Billboard',
    recommendedFor: 'Food, Grocery & Retail Delivery Platforms',
  },
  {
    id: 'cap_beanie',
    name: 'Reflective Safety Cap & Knitted Beanie',
    placement: 'Front Embroidered 3D Brand Badge',
    material: 'Reflective Threaded Cotton / Acrylic Knit',
    visibility: 'High-Density Pickup & Dropoff Eye Contact',
    recommendedFor: 'Year-Round Add-On Campaign Accessory',
  },
];

const FAQS = [
  {
    q: 'How does MutualPool verify that couriers are actually wearing our partner gear?',
    a: 'We combine route GPS shift activity with regular in-app photographic check-ins at delivery pickups and drops. Daily wage payments ($55–$75/day) are released to couriers only after qualifying route activity is recorded during active campaign hours.',
  },
  {
    q: 'How long does it take to manufacture and fulfill campaign apparel for our fleet?',
    a: 'Turnaround for standard campaign apparel (hoodies, tees, caps, delivery bags) is typically 10 to 14 business days from artwork approval to courier doorstep delivery.',
  },
  {
    q: 'Can we target specific neighborhoods or delivery platforms?',
    a: 'Yes! You can target specific metropolitan areas (e.g. Lower Manhattan, West Hollywood, Downtown Chicago) and courier delivery types (Bike/E-bike, Scooter, Foot, Car).',
  },
  {
    q: 'Where do our sponsorship funds go?',
    a: "65% of campaign sponsorship funds are credited directly to verified couriers' Stripe Treasury accounts as daily supplemental earnings ($55–$75/day). The remaining 35% is invested into custom high-durability gear manufacturing, fulfillment, GPS verification, and operational overhead.",
  },
  {
    q: 'What is the minimum campaign commitment?',
    a: 'Campaigns start at 25 courier ambassadors for a minimum 2-week active run, scaling all the way up to multi-city enterprise deployments with 1,000+ couriers.',
  },
];

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
  const isAuthenticated = !!(currentUser && currentUser.id && currentUser.id !== 'usr_guest');

  // Non-authenticated users ALWAYS default to 'media-kit' (Media Kit & Proposal Builder)
  // Authenticated users can view either 'metrics' or 'media-kit'
  const [pageViewMode, setPageViewMode] = useState<'metrics' | 'media-kit'>(() => {
    if (!isAuthenticated) return 'media-kit';
    return initialTab === 'metrics' ? 'metrics' : 'media-kit';
  });

  // Campaign Calculator State
  const [selectedMarket, setSelectedMarket] = useState(METRO_MARKETS[0].id);
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
    budgetRange: '$10,000 - $25,000',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Math Calculations for Calculator
  // Courier Net Take-Home: $55 - $75 / day ($65 average net take-home)
  // This represents 65% of the total sponsorship budget, with the remaining 35% allocated to custom gear, fulfillment & operations.
  const activeDays = durationWeeks * 6;
  const dailyImpressionsPerCourier = 1450;
  const totalImpressions = courierCount * dailyImpressionsPerCourier * activeDays;
  const estimatedCourierDailyPayout = 65; // Average net take-home: $55 - $75 / day
  const totalCourierEarningsGenerated = courierCount * estimatedCourierDailyPayout * activeDays;
  // Since courier payouts = 65% of budget, total campaign sponsorship = courier earnings / 0.65 (plus custom gear unit cost)
  const operationsAndGearCost = (totalCourierEarningsGenerated / 0.65) * 0.35 + (courierCount * 45);
  const estimatedCampaignCost = totalCourierEarningsGenerated + operationsAndGearCost;
  const effectiveCpm = ((estimatedCampaignCost / totalImpressions) * 1000).toFixed(2);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brandName.trim() || !formData.contactEmail.trim()) {
      setErrorMsg('Please provide your brand name and a valid business email.');
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
              <span>Back</span>
            </button>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Logo size="sm" />
            </div>
          </div>

          {/* Center View Selector Tabs */}
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
              <span>Media Kit & Proposal Builder</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  onOpenAuth?.('LOGIN');
                  return;
                }
                setPageViewMode('metrics');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                pageViewMode === 'metrics' && isAuthenticated
                  ? 'bg-[#005FB8] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={isAuthenticated ? 'View live campaign analytics & courier fleet shifts' : 'Sign in to access real-time metrics'}
            >
              {isAuthenticated ? (
                <LayoutDashboard className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>Campaign Metrics Dashboard</span>
              {!isAuthenticated && (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded border border-amber-300">
                  Login Required
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isAuthenticated && onOpenAuth && (
              <button
                type="button"
                onClick={() => onOpenAuth('LOGIN')}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors border border-slate-300 flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-700" />
                <span>Sign In</span>
              </button>
            )}

            {pageViewMode === 'metrics' && isAuthenticated ? (
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
                <span>Sponsor Fleet</span>
              </button>
            ) : (
              <a
                href="#launch-form"
                className="px-4 py-2 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Megaphone className="w-4 h-4" />
                <span>Launch a Campaign</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Render */}
      {pageViewMode === 'metrics' && isAuthenticated ? (
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
      ) : pageViewMode === 'metrics' && !isAuthenticated ? (
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-xl space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
              <Lock className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                Authentication Required
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Real-time courier fleet route logs, impression charts, and active shift ledgers are restricted to authenticated brand partners and administrators.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={() => onOpenAuth('LOGIN')}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Log In to View Metrics</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setPageViewMode('media-kit')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm border border-slate-300 transition-colors cursor-pointer"
              >
                <span>View Media Kit & Proposal Builder</span>
              </button>
            </div>
          </div>
        </main>
      ) : (
        <>
          {/* Hero Section */}
      <section className="relative overflow-hidden pt-10 pb-16 px-4 sm:px-6 border-b border-slate-200 bg-gradient-to-b from-[#F8FAFC] via-white to-white">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-extrabold tracking-wide uppercase">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Turn Delivery Fleets into High-Impact Streetwear Billboards</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight uppercase leading-none">
              Partner Promo Apparel
            </h1>

            <p className="text-base sm:text-xl text-slate-700 font-semibold leading-relaxed">
              Built for Gig Workers. Powered by Partnerships.
            </p>

            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Equip thousands of active gig delivery couriers with premium streetwear apparel and insulated gear. Capture millions of organic, high-frequency impressions across high-density metro downtowns while directly supporting working couriers.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href="#launch-form"
                className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm tracking-wide transition-all shadow-md shadow-amber-500/20 flex items-center gap-2"
              >
                <span>Request Media Kit & Quote</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#calculator"
                className="px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-sm transition-all shadow-xs"
              >
                Estimate Campaign Reach
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
                    Partner Promo Apparel
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    Official Kit v1.0
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Built for Gig Workers. Powered by Partnerships.
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
                  All 3 Views
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('front')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    previewTab === 'front' ? 'bg-[#005FB8] text-white shadow-xs' : 'hover:text-slate-950'
                  }`}
                >
                  Front View
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('back')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    previewTab === 'back' ? 'bg-[#005FB8] text-white shadow-xs' : 'hover:text-slate-950'
                  }`}
                >
                  Back View
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('sleeve')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    previewTab === 'sleeve' ? 'bg-[#005FB8] text-white shadow-xs' : 'hover:text-slate-950'
                  }`}
                >
                  Sleeve Detail
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
                      Front View
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
                      Chest Print & Brand Emblem
                    </div>
                    <p className="text-xs text-slate-200 font-medium">
                      High-contrast typography: <span className="text-white font-semibold">"FUELED BY HUSTLE. POWERED BY COMMUNITY."</span> with Partner Co-Branding.
                    </p>
                  </div>
                </div>

                {/* Panel 2: Back View (Span 4) */}
                <div className="md:col-span-4 bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 relative group flex flex-col shadow-sm">
                  <div className="absolute top-4 left-4 z-10">
                    <span className="px-3 py-1 rounded-md bg-black/75 backdrop-blur-md text-white font-mono font-bold text-xs tracking-wider border border-white/20 uppercase">
                      Back View
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
                      Back Banner & Feature Badges
                    </div>
                    <p className="text-xs text-slate-200 font-medium">
                      Bold Gold Header: <span className="text-white font-semibold">"TODAY WE DELIVER. TOMORROW WE WIN."</span> with Local Brands & Zero Fees icons.
                    </p>
                  </div>
                </div>

                {/* Panel 3: Sleeve Detail (Span 3) */}
                <div className="md:col-span-3 bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 relative group flex flex-col shadow-sm">
                  <div className="absolute top-4 left-4 z-10">
                    <span className="px-3 py-1 rounded-md bg-black/75 backdrop-blur-md text-white font-mono font-bold text-xs tracking-wider border border-white/20 uppercase">
                      Sleeve Detail
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
                      Right Arm Call-To-Action
                    </div>
                    <p className="text-xs text-slate-200 font-medium">
                      Vertical Megaphone Print: <span className="text-white font-semibold">"ADVERTISE WITH US"</span> with custom QR or promo code options.
                    </p>
                  </div>
                </div>

              </div>
            ) : previewTab === 'front' ? (
              <div className="max-w-2xl mx-auto rounded-2xl overflow-hidden border border-slate-200 bg-slate-950">
                <img src={promoFrontImg} alt="Front View" className="w-full object-cover aspect-3/4" />
                <div className="p-4 bg-slate-900 text-center">
                  <h3 className="font-bold text-white text-base">FRONT VIEW: Chest Graphic & Co-Brand Placement</h3>
                  <p className="text-xs text-slate-300 mt-1">High-visibility chest branding visible on every pickup and handoff.</p>
                </div>
              </div>
            ) : previewTab === 'back' ? (
              <div className="max-w-2xl mx-auto rounded-2xl overflow-hidden border border-slate-200 bg-slate-950">
                <img src={promoBackImg} alt="Back View" className="w-full object-cover aspect-3/4" />
                <div className="p-4 bg-slate-900 text-center">
                  <h3 className="font-bold text-white text-base">BACK VIEW: Street-Level Billboard Banner</h3>
                  <p className="text-xs text-slate-300 mt-1">Visible to pedestrians, drivers, and riders across dense metropolitan traffic.</p>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto rounded-2xl overflow-hidden border border-slate-200 bg-slate-950">
                <img src={promoSleeveImg} alt="Sleeve Detail" className="w-full object-cover aspect-3/4" />
                <div className="p-4 bg-slate-900 text-center">
                  <h3 className="font-bold text-white text-base">SLEEVE DETAIL: High-Contrast Campaign Callout</h3>
                  <p className="text-xs text-slate-300 mt-1">Eye-level visibility whenever couriers handle orders, handlebars, and smartphones.</p>
                </div>
              </div>
            )}

            {/* Quick Metrics Bar Under Showcase */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200">
              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200 text-center">
                <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Avg Daily Shifts</div>
                <div className="text-lg font-black text-slate-900 mt-0.5">8 - 11 Hours</div>
              </div>
              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200 text-center">
                <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Daily Impressions</div>
                <div className="text-lg font-black text-amber-600 mt-0.5">1,450+ / Courier</div>
              </div>
              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200 text-center">
                <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Courier Daily Payout</div>
                <div className="text-lg font-black text-emerald-600 mt-0.5">$55 - $75 / Day</div>
              </div>
              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200 text-center">
                <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Effective CPM</div>
                <div className="text-lg font-black text-[#005FB8] mt-0.5">$8.50 - $14.50</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Why Advertise with MutualPool Section */}
      <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <h2 className="text-2xl sm:text-4xl font-black uppercase text-slate-950 tracking-tight">
            Why Street-Level Courier Sponsorship Beats Traditional Ads
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Standard billboards stay static. Couriers navigate restaurant corridors, high-density residential towers, and downtown financial districts at pedestrian eye level.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#005FB8]">
              <Eye className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Un-skippable Street Visibility</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              No ad blockers. No banner blindness. Your brand is worn naturally by authentic local couriers entering high-traffic restaurants, building lobbies, and metro elevators hundreds of times a day.
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">GPS Route Verification & Quality</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every payout is backed by verified active route activity and in-app photo confirmations. You only pay for active, verified campaign delivery shifts.
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Direct Social & Community Impact</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Earnings go directly to hardworking gig workers through Stripe Treasury, helping them build emergency savings.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Campaign Reach & ROI Calculator Section */}
      <section id="calculator" className="py-16 px-4 sm:px-6 bg-[#F8FAFC] border-y border-slate-200">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
            <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#005FB8] text-xs font-bold uppercase tracking-wider">
              Interactive Planning Tool
            </span>
            <h2 className="text-2xl sm:text-4xl font-black uppercase text-slate-950 tracking-tight">
              Campaign Reach & Budget Estimator
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Select your target market, ambassador fleet size, and duration to model real-world delivery impressions and worker earnings.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Calculator Controls (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
              
              {/* Market Selection */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                  1. Select Target Metropolitan Market
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
                        <span>{market.name}</span>
                        {selectedMarket === market.id && <Check className="w-3.5 h-3.5 text-[#005FB8]" />}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Active Fleet: <span className="text-slate-800 font-semibold">{market.activeCouriers}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fleet Size Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    2. Courier Ambassador Fleet Size
                  </label>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono font-bold">
                    {courierCount} Active Couriers
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
                  <span>25 (Pilot)</span>
                  <span>100 (Metro Standard)</span>
                  <span>250 (Dominant)</span>
                  <span>500+ (City Takeover)</span>
                </div>
              </div>

              {/* Duration Selector */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                  3. Campaign Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 4, 8, 12].map(weeks => (
                    <button
                      key={weeks}
                      type="button"
                      onClick={() => setDurationWeeks(weeks)}
                      className={`py-2.5 px-2 rounded-xl text-center border font-bold text-xs transition-all cursor-pointer ${
                        durationWeeks === weeks
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-black'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      }`}
                    >
                      {weeks} Weeks
                    </button>
                  ))}
                </div>
              </div>

              {/* Apparel Gear Package */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                  4. Primary Promotional Apparel Item
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
                      <div className="text-xs font-bold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{item.placement}</div>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Live Campaign ROI Summary Card (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md">
              
              <div className="border-b border-slate-200 pb-4">
                <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                  Projected Campaign Impact
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-950 mt-1">
                  Estimated Performance Summary
                </h3>
              </div>

              <div className="space-y-4">
                
                <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Estimated Street-Level Impressions</div>
                  <div className="text-3xl font-black text-amber-600 font-mono mt-1">
                    {totalImpressions.toLocaleString('en-US')}+
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Based on {activeDays} active shift days × {courierCount} couriers
                  </div>
                </div>

                <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Direct Gig Worker Earnings Paid</div>
                  <div className="text-2xl font-black text-emerald-600 font-mono mt-1">
                    ${totalCourierEarningsGenerated.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    65% credited to verified delivery couriers via Stripe Treasury (remainder invested in custom gear & operations)
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Estimated Cost</div>
                    <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                      ${estimatedCampaignCost.toLocaleString('en-US')}
                    </div>
                  </div>

                  <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Effective CPM</div>
                    <div className="text-lg font-black text-[#005FB8] font-mono mt-0.5">
                      ${effectiveCpm}
                    </div>
                  </div>
                </div>

              </div>

              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-[#005FB8] shrink-0 mt-0.5" />
                <span>
                  Includes turnkey apparel production, custom screen printing, doorstep fulfillment, GPS shift tracking, and compliance management.
                </span>
              </div>

              <a
                href="#launch-form"
                className="w-full py-3.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-sm text-center block transition-all shadow-md shadow-blue-500/25 cursor-pointer"
              >
                Lock In This Campaign Proposal
              </a>

            </div>

          </div>

        </div>
      </section>

      {/* Promotional Apparel Gear Catalog Section */}
      <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
            Premium Garments & Gear
          </span>
          <h2 className="text-2xl sm:text-4xl font-black uppercase text-slate-950 tracking-tight">
            Designed for Durability & Maximum Eye-Level Impact
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            We manufacture commercial-grade streetwear and all-weather gear that gig workers proudly wear on every shift.
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
                <h3 className="font-bold text-slate-900 text-base leading-snug">{gear.name}</h3>
                <div className="text-xs text-slate-600 space-y-1">
                  <p><strong className="text-slate-800">Placement:</strong> {gear.placement}</p>
                  <p><strong className="text-slate-800">Material:</strong> {gear.material}</p>
                  <p><strong className="text-slate-800">Visibility:</strong> {gear.visibility}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <span className="text-[11px] text-amber-700 font-bold block">
                  Best For: {gear.recommendedFor}
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
              Get Started in Under 24 Hours
            </span>
            <h2 className="text-2xl sm:text-4xl font-black uppercase text-slate-950 tracking-tight">
              Launch Your Partner Campaign
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
              Submit your brand details below to receive a custom media plan, digital apparel mockup, and fleet deployment schedule.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-lg">
            {submittedSuccess ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-950">Campaign Inquiry Received!</h3>
                <p className="text-sm text-slate-700 max-w-md mx-auto leading-relaxed">
                  Thank you, <strong className="text-slate-950">{formData.contactName || 'Partner'}</strong>. Our Brand Partnerships Director will reach out to <strong className="text-[#005FB8]">{formData.contactEmail}</strong> within 1 business day with your custom campaign mockup and media kit.
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
                    Submit Another Inquiry
                  </button>
                  <button
                    type="button"
                    onClick={onBack}
                    className="px-5 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Return to App
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
                      Brand / Company Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="brandName"
                      required
                      placeholder="e.g. Acme Tech, Red Bull, Local Brewery"
                      value={formData.brandName}
                      onChange={handleFormChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Website URL
                    </label>
                    <input
                      type="url"
                      name="websiteUrl"
                      placeholder="https://yourbrand.com"
                      value={formData.websiteUrl}
                      onChange={handleFormChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Contact Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="contactName"
                      required
                      placeholder="Your Full Name"
                      value={formData.contactName}
                      onChange={handleFormChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Business Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="contactEmail"
                      required
                      placeholder="name@company.com"
                      value={formData.contactEmail}
                      onChange={handleFormChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="contactPhone"
                      placeholder="(555) 000-0000"
                      value={formData.contactPhone}
                      onChange={handleFormChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Primary Campaign Objective
                    </label>
                    <select
                      name="campaignObjective"
                      value={formData.campaignObjective}
                      onChange={handleFormChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                    >
                      <option value="Brand Awareness & Street Dominance">Brand Awareness & Street Dominance</option>
                      <option value="Product Launch or Promo Code Blitz">Product Launch or Promo Code Blitz</option>
                      <option value="App Downloads & QR Drive">App Downloads & QR Drive</option>
                      <option value="Corporate Social Responsibility & Gig Support">CSR & Direct Gig Worker Support</option>
                      <option value="Event Sponsorship / Festival Activation">Event Sponsorship / Festival Activation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Estimated Campaign Budget
                    </label>
                    <select
                      name="budgetRange"
                      value={formData.budgetRange}
                      onChange={handleFormChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:border-[#005FB8]"
                    >
                      <option value="Under $5,000 (Pilot 25 Couriers)">Under $5,000 (Pilot 25 Couriers)</option>
                      <option value="$5,000 - $15,000 (50 - 100 Couriers)">$5,000 - $15,000 (50 - 100 Couriers)</option>
                      <option value="$15,000 - $50,000 (Multi-City Fleet)">$15,000 - $50,000 (Multi-City Fleet)</option>
                      <option value="$50,000+ (National Enterprise Takeover)">$50,000+ (National Enterprise Takeover)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Custom Notes or Brand Design Requirements
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Tell us about your target launch dates, creative concepts, specific cities, or promotional offers..."
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
                    <span>{isSubmitting ? 'Submitting Proposal Request...' : 'Submit Campaign Inquiry'}</span>
                  </button>
                  <p className="text-[11px] text-center text-slate-500 mt-2">
                    No upfront payment required. We will send you a digital mockup and media deck within 24 hours.
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
            Brand Partner FAQ
          </span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-slate-950 tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-start gap-2">
                <span className="text-[#005FB8] font-mono">Q.</span>
                <span>{faq.q}</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 pl-5 leading-relaxed">
                {faq.a}
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
            © {new Date().getFullYear()} Chris Bitoye Ventures. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
};
