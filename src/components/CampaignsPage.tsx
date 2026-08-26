import React, { useState } from 'react';
import {
  Megaphone,
  Sparkles,
  MapPin,
  DollarSign,
  Search,
  Filter,
  CheckCircle2,
  Truck,
  ShieldCheck,
  Building2,
  Shirt,
  ArrowRight,
  ExternalLink,
  Users,
  Calendar,
  AlertCircle,
  HelpCircle,
  Plus,
  BarChart3,
  Camera,
  Play,
  Clock,
  Navigation,
  Bell
} from 'lucide-react';
import { AdCampaign, User, CourierCampaignParticipation, isAdvertiserOrAdmin, ActiveShiftSession, CampaignShiftLog } from '../types';
import { CampaignEnrollmentModal } from './CampaignEnrollmentModal';
import { CampaignHowItWorksModal } from './CampaignHowItWorksModal';
import { ActiveShiftModal } from './ActiveShiftModal';
import { useTranslation } from '../i18n/LanguageContext';

interface CampaignsPageProps {
  currentUser: User | null;
  campaigns: AdCampaign[];
  participations: CourierCampaignParticipation[];
  activeShiftSession?: ActiveShiftSession | null;
  onApplyParticipation: (participation: CourierCampaignParticipation) => void;
  onStartShift?: (session: ActiveShiftSession) => void;
  onUpdateShiftSession?: (session: ActiveShiftSession) => void;
  onCompleteShift?: (completedShift: CampaignShiftLog) => void;
  onOpenAuth: () => void;
  onOpenAdvertiser: (tab?: 'metrics' | 'media-kit') => void;
  onOpenCreateCampaign?: () => void;
  onStartPod?: () => void;
}

export const CampaignsPage: React.FC<CampaignsPageProps> = ({
  currentUser,
  campaigns,
  participations,
  activeShiftSession,
  onApplyParticipation,
  onStartShift,
  onUpdateShiftSession,
  onCompleteShift,
  onOpenAuth,
  onOpenAdvertiser,
  onOpenCreateCampaign,
  onStartPod,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMetro, setSelectedMetro] = useState('all');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'recruiting' | 'active'>('all');
  
  // Modal states
  const [selectedCampaignForApply, setSelectedCampaignForApply] = useState<AdCampaign | null>(null);
  const [selectedCampaignForShift, setSelectedCampaignForShift] = useState<AdCampaign | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [detailCampaignModal, setDetailCampaignModal] = useState<AdCampaign | null>(null);

  // User participations map
  const userParticipations = participations.filter(p => p.userId === currentUser?.id);
  const userEnrolledCampaignIds = new Set(userParticipations.map(p => p.campaignId));

  const isUserAdmin = Boolean(
    currentUser?.isAdmin ||
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'POD_ADMIN' ||
    (typeof currentUser?.role === 'string' && currentUser.role.toUpperCase().includes('ADMIN')) ||
    currentUser?.email?.toLowerCase() === 'chrisbitoy@gmail.com'
  );

  // Metros and platforms lists
  const availableMetros = Array.from(new Set(campaigns.map(c => c.targetMetro)));
  const availablePlatforms = ['DoorDash', 'UberEats', 'Grubhub', 'Instacart', 'Relay'];

  // Filtered campaigns
  const filteredCampaigns = campaigns.filter(camp => {
    const matchesSearch =
      camp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      camp.brandName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      camp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      camp.targetMetro.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesMetro = selectedMetro === 'all' || camp.targetMetro.toLowerCase() === selectedMetro.toLowerCase();
    const matchesPlatform =
      selectedPlatform === 'all' ||
      camp.deliveryPlatforms.some(p => p.toLowerCase().includes(selectedPlatform.toLowerCase()));
    const matchesStatus = selectedStatus === 'all' || camp.status === selectedStatus;

    return matchesSearch && matchesMetro && matchesPlatform && matchesStatus;
  });

  const handleApplyClick = (campaign: AdCampaign) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    setSelectedCampaignForApply(campaign);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Hero Banner for Couriers */}
      <div className="bg-[#F8FAFC] text-slate-900 rounded-3xl p-6 sm:p-10 shadow-xs border border-slate-200 relative overflow-hidden">
        
        {/* Subtle decorative accents */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 fill-amber-600 text-amber-600" />
              <span>{t('campaigns.badge.earnExtra')}</span>
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              {t('campaigns.badge.freeGear')}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight">
            {t('campaigns.hero.title')}
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
            {t('campaigns.hero.desc')}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowHowItWorks(true)}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors border border-slate-200 shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-amber-500" />
              <span>{t('campaigns.btn.howItWorks')}</span>
            </button>

            {isAdvertiserOrAdmin(currentUser) ? (
              <button
                type="button"
                onClick={() => onOpenAdvertiser('metrics')}
                className="px-5 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <BarChart3 className="w-4 h-4" />
                <span>{t('campaigns.btn.advertiserPortal')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAdvertiser('media-kit')}
                className="px-5 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Megaphone className="w-4 h-4" />
                <span>{t('campaigns.btn.advertiseWithUs')}</span>
              </button>
            )}

            {isUserAdmin && onOpenCreateCampaign && (
              <button
                type="button"
                onClick={onOpenCreateCampaign}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('campaigns.btn.createCampaignAdmin')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Highlights Grid */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-slate-200 text-xs">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">{t('campaigns.stats.dailyEarnings')}</div>
            <div className="text-base sm:text-lg font-black text-amber-700 font-mono mt-0.5">{t('campaigns.stats.dailyEarningsVal')}</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">{t('campaigns.stats.paymentChannel')}</div>
            <div className="text-base sm:text-lg font-black text-slate-950 mt-0.5">{t('campaigns.stats.paymentChannelVal')}</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">{t('campaigns.stats.verificationMethod')}</div>
            <div className="text-base sm:text-lg font-black text-slate-950 mt-0.5">{t('campaigns.stats.verificationMethodVal')}</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">{t('campaigns.stats.gearShippedTo')}</div>
            <div className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">{t('campaigns.stats.gearShippedToVal')}</div>
          </div>
        </div>

      </div>

      {/* ACTIVE SHIFT IN PROGRESS BANNER (IF ANY) */}
      {activeShiftSession && activeShiftSession.status === 'ACTIVE' && (
        <div className="bg-slate-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3.5 w-full md:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Camera className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">{t('campaigns.activeShift.inProgress')}</span>
                <span className="text-xs text-slate-400">• {t('campaigns.activeShift.fleet', { brand: activeShiftSession.brandName })}</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
                {activeShiftSession.campaignTitle}
              </h3>
              <p className="text-xs text-slate-400">
                {t('campaigns.activeShift.started', {
                  start: activeShiftSession.startFormatted,
                  verified: activeShiftSession.spotChecks.filter(s => s.status === 'VERIFIED').length,
                  total: activeShiftSession.spotChecks.length,
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                const targetCamp = campaigns.find(c => c.id === activeShiftSession.campaignId);
                if (targetCamp) {
                  setSelectedCampaignForShift(targetCamp);
                  setShowShiftModal(true);
                }
              }}
              className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>{t('campaigns.activeShift.openTracker')}</span>
            </button>
          </div>
        </div>
      )}

      {/* User's Active Enrolled Campaigns Section (If any) */}
      {userParticipations.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-950">{t('campaigns.enrolled.title')}</h2>
                <p className="text-xs text-slate-500">{t('campaigns.enrolled.desc')}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {userParticipations.length > 1
                ? t('campaigns.enrolled.activeBadgePlural', { count: userParticipations.length })
                : t('campaigns.enrolled.activeBadge', { count: userParticipations.length })}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userParticipations.map(part => {
              const campaign = campaigns.find(c => c.id === part.campaignId);
              const isThisShiftActive = activeShiftSession?.status === 'ACTIVE' && activeShiftSession.campaignId === part.campaignId;

              return (
                <div
                  key={part.id}
                  className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        {part.brandName}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm mt-1">{part.campaignTitle}</h3>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {t('campaigns.enrolled.dailyPayout')} <strong className="text-emerald-600 font-black">${part.dailyRate}{t('campaigns.enrolled.perDay')}</strong>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {part.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded-xl border border-slate-200">
                    <div>
                      <div className="text-[10px] text-slate-500">{t('campaigns.enrolled.gearDelivery')}</div>
                      <div className="font-bold text-slate-800 capitalize flex items-center gap-1 mt-0.5">
                        <Truck className="w-3.5 h-3.5 text-[#005FB8]" />
                        <span>{part.apparelDeliveryStatus}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">{t('campaigns.enrolled.totalEarned')}</div>
                      <div className="font-bold text-emerald-600 font-mono mt-0.5">
                        ${part.totalEarningsAccumulated.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {part.apparelShipmentTracking && (
                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
                      <span>{t('campaigns.enrolled.tracking')} <strong className="text-slate-700 font-mono">{part.apparelShipmentTracking}</strong></span>
                      <span className="text-emerald-600 font-semibold">{t('campaigns.enrolled.activeAmbassador')}</span>
                    </div>
                  )}

                  {/* SHIFT ACTION BUTTON */}
                  <div className="pt-2 border-t border-slate-200">
                    {isThisShiftActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (campaign) {
                            setSelectedCampaignForShift(campaign);
                            setShowShiftModal(true);
                          }
                        }}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                      >
                        <Clock className="w-4 h-4 animate-spin" />
                        <span>{t('campaigns.enrolled.shiftInProgress')}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (campaign) {
                            setSelectedCampaignForShift(campaign);
                            setShowShiftModal(true);
                          }
                        }}
                        className="w-full py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>{t('campaigns.enrolled.startShift', { rate: part.dailyRate })}</span>
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder={t('campaigns.search.placeholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#005FB8] focus:bg-white"
            />
          </div>

          {/* Quick Filter Selects */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Metro Select */}
            <select
              value={selectedMetro}
              onChange={e => setSelectedMetro(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#005FB8]"
            >
              <option value="all">{t('campaigns.filter.allMetros')}</option>
              {availableMetros.map(metro => (
                <option key={metro} value={metro}>{metro}</option>
              ))}
            </select>

            {/* Platform Select */}
            <select
              value={selectedPlatform}
              onChange={e => setSelectedPlatform(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#005FB8]"
            >
              <option value="all">{t('campaigns.filter.allPlatforms')}</option>
              {availablePlatforms.map(plat => (
                <option key={plat} value={plat}>{plat}</option>
              ))}
            </select>

            {/* Status Select */}
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#005FB8]"
            >
              <option value="all">{t('campaigns.filter.allStatuses')}</option>
              <option value="recruiting">{t('campaigns.filter.recruiting')}</option>
              <option value="active">{t('campaigns.filter.active')}</option>
            </select>

            {(searchQuery || selectedMetro !== 'all' || selectedPlatform !== 'all' || selectedStatus !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedMetro('all');
                  setSelectedPlatform('all');
                  setSelectedStatus('all');
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
              >
                {t('campaigns.filter.reset')}
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Campaigns Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-black text-slate-950">
            {t('campaigns.list.title', { count: filteredCampaigns.length })}
          </h2>
          <span className="text-xs text-slate-500">
            {t('campaigns.list.limitedSpots')}
          </span>
        </div>

        {filteredCampaigns.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
            <Megaphone className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">{t('campaigns.empty.title')}</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {t('campaigns.empty.desc')}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedMetro('all');
                setSelectedPlatform('all');
                setSelectedStatus('all');
              }}
              className="px-4 py-2 rounded-xl bg-[#005FB8] text-white text-xs font-bold cursor-pointer"
            >
              {t('campaigns.empty.clearBtn')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampaigns.map(camp => {
              const isEnrolled = userEnrolledCampaignIds.has(camp.id);
              const spotsLeft = Math.max(0, camp.maxCouriersTarget - camp.activeCouriersCount);

              return (
                <div
                  key={camp.id}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  
                  {/* Campaign Card Top Banner Image */}
                  <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
                    <img
                      src={camp.bannerUrl || 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&auto=format&fit=crop&q=80'}
                      alt={camp.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-85"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/90 backdrop-blur-md text-slate-900 shadow-sm">
                        {camp.targetMetro}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          camp.status === 'active'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-amber-400 text-slate-950'
                        }`}
                      >
                        {camp.status === 'active' ? t('campaigns.card.statusActive') : t('campaigns.card.statusRecruiting')}
                      </span>
                    </div>

                    {/* Daily Wage Highlight */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                          {t('campaigns.card.payoutLabel')}
                        </div>
                        <div className="text-2xl font-black font-mono text-white leading-none mt-0.5">
                          ${camp.dailyPayout}
                          <span className="text-xs font-normal text-slate-300 font-sans ml-1">{t('campaigns.card.perShift')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-300">{t('campaigns.card.weeklyEstimate')}</div>
                        <div className="text-sm font-bold font-mono text-emerald-400">
                          {t('campaigns.card.weeklyVal', { amount: camp.weeklyEstimatedEarnings })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2.5">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          {camp.brandName}
                        </span>
                        <h3 className="text-base font-bold text-slate-950 leading-snug">
                          {camp.title}
                        </h3>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {camp.description}
                      </p>

                      {/* Gear Kit Included Preview */}
                      <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-slate-100 space-y-1.5">
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                          <Shirt className="w-3 h-3 text-[#005FB8]" />
                          <span>{t('campaigns.card.gearShippedFree')}</span>
                        </div>
                        <div className="text-xs text-slate-800 font-semibold line-clamp-1">
                          {camp.gearRequired.join(' • ')}
                        </div>
                      </div>

                      {/* Platforms Supported */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="text-slate-400 font-medium">{t('campaigns.card.platforms')}</span>
                        {camp.deliveryPlatforms.map((plat, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                            {plat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Footer Stats & Actions */}
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {spotsLeft === 1
                              ? t('campaigns.card.spotsRemaining', { count: spotsLeft })
                              : t('campaigns.card.spotsRemainingPlural', { count: spotsLeft })}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t('campaigns.card.weeks', { count: camp.durationWeeks })}</span>
                        </span>
                      </div>

                      {isEnrolled ? (
                        <div className="w-full py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>{t('campaigns.card.alreadyEnrolled')}</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApplyClick(camp)}
                          className="w-full py-2.5 px-4 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer group-hover:shadow-md"
                        >
                          <span>{t('campaigns.card.applyBtn')}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Campaign Enrollment & Agreement Modal */}
      {selectedCampaignForApply && currentUser && (
        <CampaignEnrollmentModal
          campaign={selectedCampaignForApply}
          currentUser={currentUser}
          isOpen={Boolean(selectedCampaignForApply)}
          onClose={() => setSelectedCampaignForApply(null)}
          onApplySuccess={(newPart) => {
            onApplyParticipation(newPart);
            setSelectedCampaignForApply(null);
          }}
        />
      )}

      {/* Active Shift Tracking & Randomized Photo Spot-Checks Modal */}
      {showShiftModal && selectedCampaignForShift && currentUser && (
        <ActiveShiftModal
          isOpen={showShiftModal}
          onClose={() => setShowShiftModal(false)}
          currentUser={currentUser}
          campaign={selectedCampaignForShift}
          activeSession={activeShiftSession || null}
          onStartShift={(newSession) => {
            onStartShift?.(newSession);
          }}
          onUpdateSession={(updatedSession) => {
            onUpdateShiftSession?.(updatedSession);
          }}
          onCompleteShift={(completedShift) => {
            onCompleteShift?.(completedShift);
            setShowShiftModal(false);
          }}
        />
      )}

      {/* How it works modal */}
      {showHowItWorks && (
        <CampaignHowItWorksModal
          isOpen={showHowItWorks}
          onClose={() => setShowHowItWorks(false)}
          onStartPod={onStartPod || (() => setShowHowItWorks(false))}
          isAuthUser={Boolean(currentUser)}
        />
      )}

    </div>
  );
};
