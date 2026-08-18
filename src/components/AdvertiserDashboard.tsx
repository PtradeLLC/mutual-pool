import React, { useState, useMemo } from 'react';
import { AdCampaign, CampaignShiftLog, User } from '../types';
import { 
  BarChart3, TrendingUp, Users, DollarSign, MapPin, CheckCircle2, 
  ShieldCheck, ArrowUpRight, Download, Filter, Search, Calendar,
  Sparkles, Layers, RefreshCw, Eye, Bike, Car, Shirt, Clock,
  ChevronRight, Award, Plus, Check, Play, AlertCircle, ArrowLeft
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface AdvertiserDashboardProps {
  currentUser?: User | null;
  campaigns: AdCampaign[];
  shifts: CampaignShiftLog[];
  onAddNewShift?: (newShift: CampaignShiftLog) => void;
  onOpenProposalBuilder?: () => void;
  onOpenCreateCampaign?: () => void;
  onBack?: () => void;
}

export const AdvertiserDashboard: React.FC<AdvertiserDashboardProps> = ({
  currentUser,
  campaigns,
  shifts,
  onAddNewShift,
  onOpenProposalBuilder,
  onOpenCreateCampaign,
  onBack,
}) => {
  // Active selected campaign filter ('all' or specific campaign id)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'7d' | '14d' | '30d' | 'all'>('30d');
  const [shiftSearchQuery, setShiftSearchQuery] = useState('');
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'shifts' | 'geography' | 'gear' | 'economics'>('overview');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationToast, setSimulationToast] = useState<string | null>(null);

  // Selected campaign object if not 'all'
  const selectedCampaign = useMemo(() => {
    if (selectedCampaignId === 'all') return null;
    return campaigns.find(c => c.id === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  // Filtered shifts based on selected campaign
  const filteredShifts = useMemo(() => {
    return shifts.filter(shift => {
      const matchCampaign = selectedCampaignId === 'all' || shift.campaignId === selectedCampaignId;
      const matchPlatform = selectedPlatformFilter === 'all' || shift.platform.toLowerCase() === selectedPlatformFilter.toLowerCase();
      const matchSearch = shiftSearchQuery === '' ||
        shift.courierName.toLowerCase().includes(shiftSearchQuery.toLowerCase()) ||
        shift.neighborhood.toLowerCase().includes(shiftSearchQuery.toLowerCase()) ||
        shift.metro.toLowerCase().includes(shiftSearchQuery.toLowerCase()) ||
        shift.brandName.toLowerCase().includes(shiftSearchQuery.toLowerCase());
      return matchCampaign && matchPlatform && matchSearch;
    });
  }, [shifts, selectedCampaignId, selectedPlatformFilter, shiftSearchQuery]);

  // Aggregated KPI numbers
  const metrics = useMemo(() => {
    const relevantCampaigns = selectedCampaign 
      ? [selectedCampaign] 
      : campaigns;

    const relevantShifts = selectedCampaign 
      ? shifts.filter(s => s.campaignId === selectedCampaign.id)
      : shifts;

    const totalImpressionsTarget = relevantCampaigns.reduce((acc, c) => acc + (c.impressionsTarget || 350000), 0);
    const totalImpressionsDelivered = relevantCampaigns.reduce((acc, c) => acc + (c.currentImpressions || 0), 0) +
      relevantShifts.reduce((acc, s) => acc + s.estimatedImpressions, 0);

    const totalCouriersActive = relevantCampaigns.reduce((acc, c) => acc + (c.activeCouriersCount || 0), 0);
    const totalCouriersTarget = relevantCampaigns.reduce((acc, c) => acc + (c.maxCouriersTarget || 0), 0);
    const totalShiftsCount = relevantShifts.length + (relevantCampaigns.length * 140);
    const totalWagesDistributed = relevantShifts.reduce((acc, s) => acc + s.courierPayoutEarned, 0) + (totalShiftsCount * 65);
    const totalMiles = relevantShifts.reduce((acc, s) => acc + s.milesTraveled, 0) + (totalShiftsCount * 18.5);
    const totalHours = relevantShifts.reduce((acc, s) => acc + s.durationHours, 0) + (totalShiftsCount * 4.2);

    // CPM calculation: Total Spend / (Impressions / 1000)
    const estimatedTotalSpend = totalWagesDistributed / 0.65;
    const effectiveCPM = totalImpressionsDelivered > 0 
      ? ((estimatedTotalSpend / totalImpressionsDelivered) * 1000).toFixed(2) 
      : '3.45';

    const complianceRate = '99.2%';

    return {
      totalImpressionsTarget,
      totalImpressionsDelivered,
      percentTargetReached: Math.min(100, Math.round((totalImpressionsDelivered / (totalImpressionsTarget || 1)) * 100)),
      totalCouriersActive,
      totalCouriersTarget,
      totalShiftsCount,
      totalWagesDistributed,
      totalMiles: Math.round(totalMiles),
      totalHours: Math.round(totalHours),
      effectiveCPM,
      complianceRate,
    };
  }, [campaigns, selectedCampaign, shifts]);

  // Timeseries data for chart
  const timeseriesData = useMemo(() => {
    return [
      { day: 'Day 1', impressions: 42000, couriers: 24, spend: 1560 },
      { day: 'Day 3', impressions: 78000, couriers: 35, spend: 2275 },
      { day: 'Day 6', impressions: 115000, couriers: 48, spend: 3120 },
      { day: 'Day 9', impressions: 168000, couriers: 62, spend: 4030 },
      { day: 'Day 12', impressions: 245000, couriers: 78, spend: 5070 },
      { day: 'Day 15', impressions: 320000, couriers: 95, spend: 6175 },
      { day: 'Day 18', impressions: 410000, couriers: 110, spend: 7150 },
      { day: 'Day 21', impressions: 520000, couriers: 128, spend: 8320 },
      { day: 'Day 24', impressions: 680000, couriers: 145, spend: 9425 },
      { day: 'Day 27', impressions: 840000, couriers: 158, spend: 10270 },
      { day: 'Today', impressions: metrics.totalImpressionsDelivered, couriers: metrics.totalCouriersActive, spend: Math.round(metrics.totalWagesDistributed) },
    ];
  }, [metrics]);

  // Platform share data
  const platformShareData = [
    { name: 'DoorDash', value: 44, color: '#FF3008' },
    { name: 'UberEats', value: 32, color: '#06C167' },
    { name: 'Grubhub', value: 14, color: '#FF8000' },
    { name: 'Instacart', value: 7, color: '#108910' },
    { name: 'Relay / Other', value: 3, color: '#005FB8' },
  ];

  // Hourly visibility peak data
  const hourlyPeakData = [
    { hour: '8 AM', couriers: 18, traffic: 'Moderate' },
    { hour: '10 AM', couriers: 42, traffic: 'High' },
    { hour: '12 PM', couriers: 115, traffic: 'Peak Lunch Rush' },
    { hour: '2 PM', couriers: 68, traffic: 'High' },
    { hour: '4 PM', couriers: 54, traffic: 'Moderate' },
    { hour: '6 PM', couriers: 138, traffic: 'Peak Dinner Rush' },
    { hour: '8 PM', couriers: 96, traffic: 'Night Rush' },
    { hour: '10 PM', couriers: 32, traffic: 'Late Night' },
  ];

  // Zone Breakdown Data
  const metroZones = [
    {
      name: 'Chicago Loop & River North Corridor',
      metro: 'Chicago, IL',
      couriers: 28,
      impressions: '215,000+',
      trafficScore: 'A+ (Ultra-High Density)',
      dominantPlatform: 'DoorDash & UberEats',
      highlights: 'Millennium Park, Wacker Dr, Merchandise Mart, Fulton Market',
    },
    {
      name: 'New York Midtown, SoHo & Williamsburg',
      metro: 'New York, NY',
      couriers: 52,
      impressions: '390,000+',
      trafficScore: 'A+ (Constant Foot Traffic)',
      dominantPlatform: 'Relay & DoorDash',
      highlights: 'Broadway, Union Square, Bedford Ave, Financial District',
    },
    {
      name: 'Los Angeles Westside & Downtown',
      metro: 'Los Angeles, CA',
      couriers: 22,
      impressions: '160,000+',
      trafficScore: 'A (High Vehicle & Pedestrian)',
      dominantPlatform: 'UberEats & Postmates',
      highlights: 'Santa Monica Blvd, Abbot Kinney, Culver City Arts District',
    },
    {
      name: 'Lincoln Park, Lakeview & Wrigleyville',
      metro: 'Chicago, IL',
      couriers: 18,
      impressions: '125,000+',
      trafficScore: 'A (High Residential Density)',
      dominantPlatform: 'Instacart & DoorDash',
      highlights: 'Clark St, Halsted St, Belmont Ave, Lincoln Ave',
    },
  ];

  // Handler to simulate a verified shift in real-time
  const handleSimulateShift = () => {
    setIsSimulating(true);
    const mockNames = ['Jaden Rivera', 'Sofia Alvarez', 'Darnell Washington', 'Kaitlyn Chen', 'Tariq Malik', 'Olivia Rossi'];
    const mockPlatforms: ('DoorDash' | 'UberEats' | 'Grubhub' | 'Instacart' | 'Relay')[] = ['DoorDash', 'UberEats', 'Grubhub', 'Instacart', 'Relay'];
    const mockNeighborhoods = ['West Loop & Fulton Market', 'SoHo & Lower East Side', 'Downtown Loop Corridor', 'Santa Monica Promenade', 'Midtown Broadway Corridor'];

    const targetCamp = selectedCampaign || campaigns[0] || {
      id: 'camp_celsius_chicago_2026',
      title: 'Celsius Live Fit — Chicago Metro Fleet',
      brandName: 'Celsius Energy',
      dailyPayout: 65,
      targetMetro: 'Chicago, IL',
    };

    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const randomPlatform = mockPlatforms[Math.floor(Math.random() * mockPlatforms.length)];
    const randomNeighborhood = mockNeighborhoods[Math.floor(Math.random() * mockNeighborhoods.length)];
    const randomHours = parseFloat((3.5 + Math.random() * 2).toFixed(1));
    const randomMiles = parseFloat((12 + Math.random() * 12).toFixed(1));
    const randomImpressions = Math.floor(4000 + Math.random() * 3500);

    const newShift: CampaignShiftLog = {
      id: `shift_${Date.now()}`,
      campaignId: targetCamp.id,
      campaignTitle: targetCamp.title,
      brandName: targetCamp.brandName,
      courierId: `usr_sim_${Date.now()}`,
      courierName: randomName,
      courierAvatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 50000000)}?w=80&auto=format&fit=crop&q=80`,
      platform: randomPlatform,
      metro: targetCamp.targetMetro || 'Chicago, IL',
      neighborhood: randomNeighborhood,
      date: new Date().toISOString().split('T')[0],
      startTime: '12:00 PM',
      endTime: '4:30 PM',
      durationHours: randomHours,
      milesTraveled: randomMiles,
      estimatedImpressions: randomImpressions,
      courierPayoutEarned: targetCamp.dailyPayout || 65,
      verifiedGps: true,
      verifiedPhoto: true,
      complianceScore: 100,
      notes: `Live check-in: Verified ${randomHours}hr shift with brand gear. Generated ~${randomImpressions.toLocaleString()} impressions.`
    };

    setTimeout(() => {
      if (onAddNewShift) {
        onAddNewShift(newShift);
      }
      setIsSimulating(false);
      setSimulationToast(`✓ New verified shift recorded for ${randomName} (+${randomImpressions.toLocaleString()} impressions)!`);
      setTimeout(() => setSimulationToast(null), 5000);
    }, 800);
  };

  // Export report to CSV
  const handleExportCSV = () => {
    const headers = 'Shift ID,Campaign,Brand,Courier,Platform,Metro,Neighborhood,Date,Duration (Hrs),Miles,Impressions,Courier Payout,GPS Verified,Photo Verified\n';
    const rows = filteredShifts.map(s => 
      `"${s.id}","${s.campaignTitle}","${s.brandName}","${s.courierName}","${s.platform}","${s.metro}","${s.neighborhood}","${s.date}",${s.durationHours},${s.milesTraveled},${s.estimatedImpressions},${s.courierPayoutEarned},${s.verifiedGps},${s.verifiedPhoto}`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `MutualPool_Campaign_Metrics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Toast Notification for Live Shift Simulation */}
      {simulationToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-950 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 animate-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{simulationToast}</span>
          <button onClick={() => setSimulationToast(null)} className="text-slate-400 hover:text-white text-xs ml-2">✕</button>
        </div>
      )}

      {/* Top Controls & Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors mr-1 cursor-pointer"
                title="Back to portal"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Fleet Tracking
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Real-time street impressions & verified delivery route audits
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Advertiser Campaign Performance Dashboard
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleSimulateShift}
            disabled={isSimulating}
            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Simulate a new verified courier delivery shift"
          >
            <Play className={`w-3.5 h-3.5 text-amber-700 fill-amber-700 ${isSimulating ? 'animate-spin' : ''}`} />
            <span>{isSimulating ? 'Logging Live Shift…' : 'Simulate Live Shift'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Export shift logs and metrics to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {onOpenProposalBuilder && (
            <button
              type="button"
              onClick={onOpenProposalBuilder}
              className="px-4 py-2 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Sponsor New Fleet</span>
            </button>
          )}
        </div>
      </div>

      {/* Campaign Selector & Sub-Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Campaign Filter Pill Selector */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Campaign:
          </span>
          <button
            onClick={() => setSelectedCampaignId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedCampaignId === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Active Campaigns ({campaigns.length})
          </button>
          {campaigns.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCampaignId(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                selectedCampaignId === c.id
                  ? 'bg-[#005FB8] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{c.brandName}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${selectedCampaignId === c.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {c.activeCouriersCount || 0} fleet
              </span>
            </button>
          ))}
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'overview' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview & Trends
          </button>
          <button
            onClick={() => setActiveTab('shifts')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'shifts' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Verified Shifts ({filteredShifts.length})
          </button>
          <button
            onClick={() => setActiveTab('geography')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'geography' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Metro Zones
          </button>
          <button
            onClick={() => setActiveTab('gear')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'gear' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Gear Fulfillment
          </button>
        </div>
      </div>

      {/* Selected Campaign Header Info Card (If a specific campaign is selected) */}
      {selectedCampaign && (
        <div className="bg-gradient-to-r from-blue-50 via-slate-50 to-white border border-blue-200 rounded-3xl p-5 sm:p-6 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {selectedCampaign.brandLogo ? (
                <img 
                  src={selectedCampaign.brandLogo} 
                  alt={selectedCampaign.brandName} 
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-200 bg-white shadow-2xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-2xs">
                  {selectedCampaign.brandName.charAt(0)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">{selectedCampaign.brandName}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                    {selectedCampaign.status}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-950 mt-0.5">{selectedCampaign.title}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1 font-medium"><MapPin className="w-3.5 h-3.5 text-blue-600" /> {selectedCampaign.targetMetro}</span>
                  <span>•</span>
                  <span>Platforms: {selectedCampaign.deliveryPlatforms.join(', ')}</span>
                  <span>•</span>
                  <span className="text-amber-800 font-bold">${selectedCampaign.dailyPayout}/day stipend</span>
                </div>
              </div>
            </div>

            {/* Campaign Progress Gauge */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs min-w-[240px] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-600">Impression Target</span>
                <span className="font-black text-slate-950">{metrics.percentTargetReached}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${metrics.percentTargetReached}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                <span>{metrics.totalImpressionsDelivered.toLocaleString()} delivered</span>
                <span>{metrics.totalImpressionsTarget.toLocaleString()} goal</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6 Executive KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. Total Street Impressions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span className="uppercase tracking-wider text-[10px]">Street Impressions</span>
            <Eye className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-950 font-mono mt-1">
            {metrics.totalImpressionsDelivered.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>{metrics.percentTargetReached}% of campaign goal</span>
          </div>
        </div>

        {/* 2. Active Ambassadors */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span className="uppercase tracking-wider text-[10px]">Active Fleet</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-950 font-mono mt-1">
            {metrics.totalCouriersActive}
            <span className="text-xs font-normal text-slate-400 ml-1">/ {metrics.totalCouriersTarget}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Verified couriers on road
          </div>
        </div>

        {/* 3. Verified Delivery Shifts */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span className="uppercase tracking-wider text-[10px]">Verified Shifts</span>
            <CheckCircle2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-950 font-mono mt-1">
            {metrics.totalShiftsCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-purple-700 font-semibold mt-1">
            GPS + Photo Validated
          </div>
        </div>

        {/* 4. Direct Courier Wealth */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span className="uppercase tracking-wider text-[10px]">Gig Payouts (65%)</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-950 font-mono mt-1">
            ${metrics.totalWagesDistributed.toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">
            Stripe Treasury credited
          </div>
        </div>

        {/* 5. Effective Street CPM */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span className="uppercase tracking-wider text-[10px]">Effective CPM</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-700 font-mono mt-1">
            ${metrics.effectiveCPM}
          </div>
          <div className="text-[11px] text-slate-500 line-through mt-1">
            Traditional OOH: $18.50
          </div>
        </div>

        {/* 6. Route Hours on Streets */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span className="uppercase tracking-wider text-[10px]">Street Exposure</span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-950 font-mono mt-1">
            {metrics.totalHours.toLocaleString()}h
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            across {metrics.totalMiles.toLocaleString()} miles
          </div>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS CHARTS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Area Chart & Donut Share Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Cols: Cumulative Impressions & Spend Over Time */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950">Street Impressions & Fleet Growth Velocity</h3>
                  <p className="text-xs text-slate-500">Continuous audience reach captured during active delivery hours</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="flex items-center gap-1 text-[#005FB8]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#005FB8]" /> Impressions
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 ml-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Active Couriers
                  </span>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeseriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="impressionsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#005FB8" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#005FB8" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(val: any, name: any) => [
                        name === 'impressions' ? `${Number(val).toLocaleString()} views` : val,
                        name === 'impressions' ? 'Estimated Impressions' : 'Active Fleet Couriers'
                      ]}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '12px', border: 'none', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="impressions" stroke="#005FB8" strokeWidth={2.5} fillOpacity={1} fill="url(#impressionsGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-50">
                  <div className="text-slate-400 text-[10px] font-semibold uppercase">Weekend Spike</div>
                  <div className="text-slate-900 font-black font-mono text-sm">+42% Reach</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-50">
                  <div className="text-slate-400 text-[10px] font-semibold uppercase">Avg Exposure / Shift</div>
                  <div className="text-slate-900 font-black font-mono text-sm">~4,850 views</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-50">
                  <div className="text-slate-400 text-[10px] font-semibold uppercase">Verification Integrity</div>
                  <div className="text-emerald-700 font-black font-mono text-sm">{metrics.complianceRate}</div>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Platform Share Breakdown */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-950">Fleet Delivery Platforms</h3>
                <p className="text-xs text-slate-500">Distribution of gig applications active fleet is delivering on</p>
              </div>

              <div className="h-48 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platformShareData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {platformShareData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: any) => [`${val}% of fleet shifts`, 'Platform Share']}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '10px', fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                {platformShareData.map(p => (
                  <div key={p.name} className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="font-semibold">{p.name}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-950">{p.value}%</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Peak Hourly Exposure Bar Chart & Live Proof Highlights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Peak Hours Visibility Bar Chart */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950">Hourly Street Fleet Volume (Rush Hour Heatmap)</h3>
                  <p className="text-xs text-slate-500">Highest foot-traffic and diner visibility occurs during 11:30 AM – 2:00 PM and 5:30 PM – 9:00 PM</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                  Peak Dining Rushes
                </span>
              </div>

              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyPeakData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="hour" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <Tooltip 
                      formatter={(val: any, name: any, item: any) => [
                        `${val} couriers on street (${item.payload.traffic})`,
                        'Active Fleet Count'
                      ]}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Bar dataKey="couriers" fill="#005FB8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Proof of Execution Audit Summary */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-slate-950 font-black">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black">Verified Proof of Performance</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Every dollar sponsored is backed by strict multi-layered verification before courier daily wage release.
              </p>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-950">GPS Route Tracking</div>
                    <div className="text-slate-500 text-[11px]">Continuous shift tracking matches target metro delivery corridors.</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-950">Mandatory Shift Photo Check-in</div>
                    <div className="text-slate-500 text-[11px]">Couriers submit timestamped photos wearing partner apparel at pickups.</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-950">Direct Stripe Treasury Disbursement</div>
                    <div className="text-slate-500 text-[11px]">65% is deposited directly to gig workers once shift compliance is verified.</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: VERIFIED SHIFTS STREAM & AUDIT LOG */}
      {activeTab === 'shifts' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-950">Verified Courier Shift Audit Stream</h3>
              <p className="text-xs text-slate-500">Live feed of verified delivery shifts with GPS proof and impression credits</p>
            </div>

            {/* Shift Search & Platform Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={shiftSearchQuery}
                  onChange={(e) => setShiftSearchQuery(e.target.value)}
                  placeholder="Search courier, zone, or brand…"
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005FB8]"
                />
              </div>

              <select
                value={selectedPlatformFilter}
                onChange={(e) => setSelectedPlatformFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 font-medium focus:outline-none"
              >
                <option value="all">All Platforms</option>
                <option value="doordash">DoorDash</option>
                <option value="ubereats">UberEats</option>
                <option value="grubhub">Grubhub</option>
                <option value="instacart">Instacart</option>
                <option value="relay">Relay</option>
              </select>
            </div>
          </div>

          {/* Shifts Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Courier / Ambassador</th>
                  <th className="py-3 px-4">Campaign & Brand</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Metro & Corridor</th>
                  <th className="py-3 px-4">Shift Duration</th>
                  <th className="py-3 px-4">Impressions</th>
                  <th className="py-3 px-4">Courier Wage</th>
                  <th className="py-3 px-4">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShifts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No shift records matching the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredShifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-950">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-black text-xs shrink-0">
                            {shift.courierName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold">{shift.courierName}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{shift.date} • {shift.startTime}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900">{shift.brandName}</span>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{shift.campaignTitle}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                          {shift.platform}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{shift.neighborhood}</div>
                        <div className="text-[10px] text-slate-400">{shift.metro}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {shift.durationHours}h ({shift.milesTraveled} mi)
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-[#005FB8]">
                        +{shift.estimatedImpressions.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-700">
                        ${shift.courierPayoutEarned}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>GPS + Photo</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
            <span>Showing {filteredShifts.length} verified shift logs</span>
            <button
              onClick={handleExportCSV}
              className="text-[#005FB8] font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Complete Audit Log (CSV)</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: METRO ZONES & HEATMAP */}
      {activeTab === 'geography' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-lg font-black text-slate-950">Metropolitan Route Coverage & Foot Traffic Heatmaps</h3>
              <p className="text-xs text-slate-500">High-density pedestrian corridors and restaurant delivery clusters targeted by active fleet couriers</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metroZones.map(zone => (
                <div key={zone.name} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800">
                      {zone.metro}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      {zone.trafficScore}
                    </span>
                  </div>

                  <h4 className="text-base font-black text-slate-950">{zone.name}</h4>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <div className="text-slate-400 text-[10px] uppercase font-semibold">Active Ambassadors</div>
                      <div className="text-slate-900 font-black font-mono mt-0.5">{zone.couriers} Couriers</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <div className="text-slate-400 text-[10px] uppercase font-semibold">Monthly Impressions</div>
                      <div className="text-[#005FB8] font-black font-mono mt-0.5">{zone.impressions}</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 pt-1">
                    <span className="font-bold text-slate-900">Key Corridors: </span>
                    <span>{zone.highlights}</span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1 border-t border-slate-200">
                    <Bike className="w-3.5 h-3.5 text-slate-400" />
                    <span>Primary Apps: {zone.dominantPlatform}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GEAR FULFILLMENT & TURNKEY MERCH STATUS */}
      {activeTab === 'gear' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-950">Turnkey Apparel & Gear Supply Chain</h3>
            <p className="text-xs text-slate-500">Tracking courier merchandise kits manufactured and deployed across the active fleet</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold uppercase tracking-wider text-[10px]">Heavyweight Hoodies</span>
                <Shirt className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-950 font-mono">140 / 140</div>
              <div className="text-xs text-emerald-700 font-bold">100% Deployed on Street</div>
              <div className="text-[11px] text-slate-500">450 GSM Fleece • 360° Front/Back/Sleeve Branding</div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold uppercase tracking-wider text-[10px]">Insulated Delivery Bags</span>
                <Layers className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-950 font-mono">160 / 160</div>
              <div className="text-xs text-emerald-700 font-bold">100% Active in Transit</div>
              <div className="text-[11px] text-slate-500">600D Waterproof • Thermal Lined Eye-Level Billboard</div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold uppercase tracking-wider text-[10px]">Performance Jerseys</span>
                <Shirt className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-slate-950 font-mono">85 / 100</div>
              <div className="text-xs text-blue-700 font-bold">15 In Production / Batch 2</div>
              <div className="text-[11px] text-slate-500">Moisture-Wicking Breathable Poly-Cotton</div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold uppercase tracking-wider text-[10px]">Reflective Caps & Beanies</span>
                <Award className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-slate-950 font-mono">110 / 110</div>
              <div className="text-xs text-emerald-700 font-bold">100% Active</div>
              <div className="text-[11px] text-slate-500">Embroidered 3D Badge • High-Vis Threading</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex items-start gap-3 text-xs text-blue-900">
            <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Zero Overhead Fulfillment Guaranteed</div>
              <div className="text-blue-800 text-[11px] mt-0.5 leading-relaxed">
                MutualPool manages all garment manufacturing, embroidery, sizing intake, quality checks, and doorstep courier fulfillment. Couriers receive high-durability apparel at zero cost, ensuring high wear rates during shifts.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom CTA / Help Footer */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400 text-slate-950">
              Enterprise Brand Solutions
            </span>
            <span className="text-xs text-slate-400 font-medium">MutualPool Ambassador Network</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black">Ready to scale to 500+ couriers across 10 top markets?</h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Our brand partnerships team can construct customized geographic routing, dedicated vehicle wraps, and custom promotional apparel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {onOpenProposalBuilder && (
            <button
              onClick={onOpenProposalBuilder}
              className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer"
            >
              Launch Custom Campaign Proposal
            </button>
          )}
        </div>
      </div>

    </div>
  );
};
