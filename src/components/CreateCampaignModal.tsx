import React, { useState } from 'react';
import {
  X,
  Megaphone,
  Sparkles,
  Building2,
  MapPin,
  DollarSign,
  Calendar,
  Users,
  CheckCircle2,
  Shirt,
  Layers,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { AdCampaign } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCampaign: (campaign: AdCampaign) => void;
}

const PRESET_BRANDS = [
  {
    name: 'Red Bull Energy',
    color: '#002B66',
    logo: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=120&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&auto=format&fit=crop&q=80',
    defaultGear: ['Red Bull Thermal Hoodie', 'Branded Waterproof 45L Delivery Bag', 'Reflective Armband'],
  },
  {
    name: 'Liquid Death',
    color: '#111111',
    logo: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=120&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
    defaultGear: ['Liquid Death Matte Black Windbreaker', 'Branded Helmet Decal Pack', 'Insulated Bike Cargo Bag'],
  },
  {
    name: 'Chipotle Mexican Grill',
    color: '#451400',
    logo: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=120&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?w=800&auto=format&fit=crop&q=80',
    defaultGear: ['Chipotle Pro Courier Tee & Cap', 'Insulated Food Warmer Pack', 'Reflective High-Vis Vest'],
  },
  {
    name: 'Oatly Oatmilk',
    color: '#2D5A27',
    logo: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=120&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1508962914676-134849a727f0?w=800&auto=format&fit=crop&q=80',
    defaultGear: ['Oatly Organic Cotton Hoodie', 'Eco-Canvas Delivery Pack', 'Handlebar Phone Mount'],
  },
  {
    name: 'Celsius Live Fit',
    color: '#E04A26',
    logo: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=120&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80',
    defaultGear: ['Celsius Active Performance Hoodie', 'Insulated Courier Backpack', 'LED Safety Clip'],
  },
];

const METRO_OPTIONS = [
  'Chicago Metro',
  'New York City',
  'Los Angeles Metro',
  'Miami / South Florida',
  'San Francisco Bay Area',
  'Austin / Central Texas',
  'Atlanta Metro',
  'Seattle / Pacific Northwest',
  'Boston Metro',
  'Philadelphia Metro',
  'National Multi-City Fleet',
];

const PLATFORM_OPTIONS = [
  'DoorDash',
  'UberEats',
  'Grubhub',
  'Instacart',
  'Relay Delivery',
  'Spark Delivery',
  'Amazon Flex',
];

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({
  isOpen,
  onClose,
  onCreateCampaign,
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [brandName, setBrandName] = useState('');
  const [brandColor, setBrandColor] = useState('#005FB8');
  const [brandLogo, setBrandLogo] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [description, setDescription] = useState('');
  const [targetMetro, setTargetMetro] = useState('Chicago Metro');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['DoorDash', 'UberEats']);
  const [dailyPayout, setDailyPayout] = useState<number>(65);
  const [durationWeeks, setDurationWeeks] = useState<number>(4);
  const [maxCouriersTarget, setMaxCouriersTarget] = useState<number>(50);
  const [impressionsTarget, setImpressionsTarget] = useState<number>(350000);
  const [gearList, setGearList] = useState<string[]>([
    'Branded Performance Thermal Hoodie',
    'Commercial Grade 45L Delivery Bag',
    'Reflective Safety Armband',
  ]);
  const [newGearItem, setNewGearItem] = useState('');
  const [requirementsList, setRequirementsList] = useState<string[]>([
    'Active delivery courier on DoorDash, UberEats, or Grubhub',
    'Minimum 4 active delivery hours/day during campaign shift window',
    'Must wear official campaign apparel & carry branded delivery gear',
    'Daily in-app GPS route tracking and shift photo verification',
  ]);
  const [newRequirement, setNewRequirement] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'recruiting' | 'active'>('recruiting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: typeof PRESET_BRANDS[0]) => {
    setBrandName(preset.name);
    setBrandColor(preset.color);
    setBrandLogo(preset.logo);
    setBannerUrl(preset.banner);
    setTitle(`${preset.name} Street Ambassador Fleet`);
    setGearList(preset.defaultGear);
    setDescription(`Represent ${preset.name} during peak delivery shifts across high-density metro zones. Wear premium branded gear and earn daily supplemental income.`);
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  const handleAddGear = () => {
    if (newGearItem.trim() && !gearList.includes(newGearItem.trim())) {
      setGearList(prev => [...prev, newGearItem.trim()]);
      setNewGearItem('');
    }
  };

  const handleRemoveGear = (idx: number) => {
    setGearList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddRequirement = () => {
    if (newRequirement.trim() && !requirementsList.includes(newRequirement.trim())) {
      setRequirementsList(prev => [...prev, newRequirement.trim()]);
      setNewRequirement('');
    }
  };

  const handleRemoveRequirement = (idx: number) => {
    setRequirementsList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !brandName.trim()) {
      setErrorMsg(t('campaigns.create.errTitleBrand'));
      return;
    }

    if (selectedPlatforms.length === 0) {
      setErrorMsg(t('campaigns.create.errPlatform'));
      return;
    }

    if (dailyPayout < 20) {
      setErrorMsg(t('campaigns.create.errPayout'));
      return;
    }

    const calculatedEndDate = new Date(Date.now() + durationWeeks * 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const newCampaign: AdCampaign = {
      id: `camp-${Date.now()}`,
      title: title.trim(),
      brandName: brandName.trim(),
      brandLogo: brandLogo.trim() || 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=120&auto=format&fit=crop&q=80',
      brandColor: brandColor || '#005FB8',
      bannerUrl: bannerUrl.trim() || 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&auto=format&fit=crop&q=80',
      description: description.trim() || `Official brand ambassador campaign for ${brandName.trim()}.`,
      requirements: requirementsList.length > 0 ? requirementsList : ['Active delivery courier', 'Wear campaign apparel during shifts'],
      gearRequired: gearList.length > 0 ? gearList : ['Branded Delivery Bag', 'Custom Hoodie'],
      dailyPayout,
      weeklyEstimatedEarnings: dailyPayout * 6,
      targetMetro,
      deliveryPlatforms: selectedPlatforms,
      activeCouriersCount: 0,
      maxCouriersTarget,
      durationWeeks,
      startDate,
      endDate: calculatedEndDate,
      status,
      impressionsTarget: impressionsTarget || (maxCouriersTarget * 1450 * durationWeeks * 6),
      currentImpressions: 0,
      payoutTerms: `65% (${dailyPayout}/day) credited daily to verified couriers via Stripe Treasury upon GPS verified shifts.`,
    };

    onCreateCampaign(newCampaign);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="bg-[#F8FAFC] border-b border-slate-200 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center font-bold">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                {t('campaigns.create.studioBadge')}
              </span>
              <h2 className="text-xl font-black text-slate-950 mt-0.5">{t('campaigns.create.title')}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-900">
          
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Preset Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {t('campaigns.create.quickFill')}
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_BRANDS.map(preset => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.color }} />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Basic Campaign Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('campaigns.create.campaignTitle')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Red Bull Energy Courier Ambassadors"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('campaigns.create.brandName')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Red Bull Energy"
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
              />
            </div>
          </div>

          {/* Target Metro & Brand Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('campaigns.create.targetMetro')} <span className="text-rose-500">*</span>
              </label>
              <select
                value={targetMetro}
                onChange={e => setTargetMetro(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
              >
                {METRO_OPTIONS.map(metro => (
                  <option key={metro} value={metro}>{metro}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('campaigns.create.brandColor')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandColor}
                  onChange={e => setBrandColor(e.target.value)}
                  className="w-10 h-10 p-0.5 rounded-xl border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={e => setBrandColor(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-mono text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Image URLs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('campaigns.create.brandLogo')}
              </label>
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={brandLogo}
                onChange={e => setBrandLogo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('campaigns.create.bannerUrl')}
              </label>
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={bannerUrl}
                onChange={e => setBannerUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('campaigns.create.description')} <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              placeholder="Detail what couriers will be doing, where they will ride, and how they represent the brand..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          {/* Payout & Fleet Math */}
          <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-200 space-y-4">
            <div className="text-xs font-bold text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>{t('campaigns.create.compensationTitle')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {t('campaigns.create.dailyPayout')}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    min={20}
                    max={200}
                    required
                    value={dailyPayout}
                    onChange={e => setDailyPayout(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-mono font-bold text-emerald-700"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500">/day</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {t('campaigns.create.dailyPayoutHelp', { amount: (dailyPayout * 6).toLocaleString() })}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {t('campaigns.create.duration')}
                </label>
                <select
                  value={durationWeeks}
                  onChange={e => setDurationWeeks(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 font-bold"
                >
                  <option value={2}>{t('campaigns.create.durationOption', { weeks: 2, label: 'Pilot' })}</option>
                  <option value={4}>{t('campaigns.create.durationOption', { weeks: 4, label: 'Standard' })}</option>
                  <option value={6}>{t('campaigns.create.durationOption', { weeks: 6, label: 'Extended' })}</option>
                  <option value={8}>{t('campaigns.create.durationOption', { weeks: 8, label: 'Takeover' })}</option>
                  <option value={12}>{t('campaigns.create.durationOption', { weeks: 12, label: 'Quarterly' })}</option>
                </select>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {t('campaigns.create.durationHelp', { count: durationWeeks * 6 })}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {t('campaigns.create.fleetSize')}
                </label>
                <input
                  type="number"
                  min={5}
                  max={500}
                  required
                  value={maxCouriersTarget}
                  onChange={e => setMaxCouriersTarget(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-mono font-bold text-slate-900"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {t('campaigns.create.fleetHelp')}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery Platforms Multi-Select */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {t('campaigns.create.platforms')} <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map(plat => {
                const isSelected = selectedPlatforms.includes(plat);
                return (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => togglePlatform(plat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}{plat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Apparel & Gear Included */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('campaigns.create.apparelKit')}
            </label>
            <div className="space-y-2 mb-2">
              {gearList.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <Shirt className="w-3.5 h-3.5 text-purple-600" />
                    <span className="font-semibold text-slate-800">{item}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveGear(idx)}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t('campaigns.create.gearPlaceholder')}
                value={newGearItem}
                onChange={e => setNewGearItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddGear(); } }}
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
              <button
                type="button"
                onClick={handleAddGear}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('campaigns.create.addBtn')}</span>
              </button>
            </div>
          </div>

          {/* Requirements List */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('campaigns.create.requirements')}
            </label>
            <div className="space-y-2 mb-2">
              {requirementsList.map((req, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-slate-700">{req}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveRequirement(idx)}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t('campaigns.create.reqPlaceholder')}
                value={newRequirement}
                onChange={e => setNewRequirement(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRequirement(); } }}
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
              <button
                type="button"
                onClick={handleAddRequirement}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('campaigns.create.addBtn')}</span>
              </button>
            </div>
          </div>

          {/* Campaign Status & Launch Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('campaigns.create.status')}
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'recruiting' | 'active')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 font-bold"
              >
                <option value="recruiting">{t('campaigns.create.statusRecruiting')}</option>
                <option value="active">{t('campaigns.create.statusActive')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('campaigns.create.launchDate')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              {t('campaigns.create.btnCancel')}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all shadow-md shadow-purple-500/25 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('campaigns.create.btnPublish')}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
