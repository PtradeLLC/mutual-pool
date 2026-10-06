import React, { useState, useEffect } from 'react';
import { 
  GearCatalogItem, 
  GearDesignOrder, 
  GearProductType, 
  GearPrintZone, 
  GearColor, 
  GearDesignZoneConfig 
} from '../types';
import { FOURTHWALL_GEAR_CATALOG, dispatchOrderToFourthwall } from '../services/fourthwall';
import { useToast } from '../context/ToastContext';
import { 
  CheckCircle2, 
  Send, 
  Eye, 
  Layers, 
  Truck, 
  ShieldCheck, 
  ExternalLink, 
  RefreshCw, 
  Palette, 
  Type, 
  Sliders, 
  Printer,
  ChevronRight,
  Sparkles,
  Info,
  Download,
  Check,
  RotateCw
} from 'lucide-react';

interface FourthwallGearStudioProps {
  sponsorBrand?: string;
  sponsorEmail?: string;
  campaignId?: string;
  campaignTitle?: string;
  onDesignSubmitted?: (design: GearDesignOrder) => void;
  isAdmin?: boolean;
}

const COLOR_MAP: Record<GearColor, { label: string; hex: string; textDark: boolean; secondaryHex: string }> = {
  BLACK: { label: 'Stealth Black', hex: '#0f172a', secondaryHex: '#1e293b', textDark: false },
  NAVY: { label: 'Midnight Navy', hex: '#0f172a', secondaryHex: '#1e293b', textDark: false },
  NEON_LIME: { label: 'High-Vis Lime', hex: '#84cc16', secondaryHex: '#65a30d', textDark: true },
  STEALTH_CHARCOAL: { label: 'Charcoal Grey', hex: '#334155', secondaryHex: '#1e293b', textDark: false },
  SAFETY_ORANGE: { label: 'Safety Orange', hex: '#ea580c', secondaryHex: '#c2410c', textDark: false },
  WHITE: { label: 'Clean White', hex: '#f8fafc', secondaryHex: '#e2e8f0', textDark: true },
};

const INK_PALETTE = [
  { label: 'Crisp White', hex: '#ffffff' },
  { label: 'Deep Charcoal', hex: '#0f172a' },
  { label: '3M Reflective Silver', hex: '#e2e8f0' },
  { label: 'High-Vis Lime', hex: '#84cc16' },
  { label: 'Courier Orange', hex: '#f97316' },
  { label: 'Electric Blue', hex: '#38bdf8' },
];

export const FourthwallGearStudio: React.FC<FourthwallGearStudioProps> = ({
  sponsorBrand = 'Apex Logistics',
  sponsorEmail = 'sponsor@apexlogistics.com',
  campaignId,
  campaignTitle,
  onDesignSubmitted,
  isAdmin = false,
}) => {
  const toast = useToast();

  // Studio step navigation: 'design' -> 'fleet' -> 'proof'
  const [activeStep, setActiveStep] = useState<'apparel' | 'design' | 'fleet'>('design');

  const [selectedGearType, setSelectedGearType] = useState<GearProductType>('WINDBREAKER');
  const [selectedColor, setSelectedColor] = useState<GearColor>('NEON_LIME');
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [activeZone, setActiveZone] = useState<GearPrintZone>('FRONT_CHEST');
  const [quantity, setQuantity] = useState<number>(50);
  const [brandName, setBrandName] = useState<string>(sponsorBrand);
  const [contactEmail, setContactEmail] = useState<string>(sponsorEmail);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [dispatchedOrder, setDispatchedOrder] = useState<GearDesignOrder | null>(null);
  const [fontFamilyMode, setFontFamilyMode] = useState<'HEAVY' | 'CONDENSED' | 'MINIMAL'>('HEAVY');
  const [showProofModal, setShowProofModal] = useState<boolean>(false);

  // Active gear catalog configuration
  const currentCatalogItem = FOURTHWALL_GEAR_CATALOG.find(c => c.type === selectedGearType) || FOURTHWALL_GEAR_CATALOG[0];

  // Initialize zone configuration for the current gear
  const [zoneConfigs, setZoneConfigs] = useState<Record<string, GearDesignZoneConfig>>(() => {
    const initial: Record<string, GearDesignZoneConfig> = {};
    for (const z of currentCatalogItem.supportedZones) {
      initial[z.zone] = {
        zone: z.zone,
        label: z.label,
        sponsorMessage: z.zone === 'FRONT_CHEST' || z.zone === 'FRONT_FLAP' || z.zone === 'CROWN' 
          ? sponsorBrand.toUpperCase() 
          : 'FUELING THE GIG ECONOMY',
        subMessage: z.zone === 'BACK_FULL' ? 'Official Courier Fleet Partner' : '',
        fontSize: z.zone === 'BACK_FULL' ? 'xl' : 'md',
        textColor: selectedColor === 'NEON_LIME' || selectedColor === 'WHITE' ? '#0f172a' : '#ffffff',
        badgeStyle: z.zone === 'BACK_FULL' ? 'HIGH_VIS_BOX' : 'REFLECTIVE_SHIELD',
        active: true,
      };
    }
    return initial;
  });

  // Re-sync zone configs when gear type changes
  useEffect(() => {
    setZoneConfigs(prev => {
      const next: Record<string, GearDesignZoneConfig> = {};
      for (const z of currentCatalogItem.supportedZones) {
        if (prev[z.zone]) {
          next[z.zone] = prev[z.zone];
        } else {
          next[z.zone] = {
            zone: z.zone,
            label: z.label,
            sponsorMessage: z.zone === 'FRONT_CHEST' || z.zone === 'FRONT_FLAP' || z.zone === 'CROWN' 
              ? brandName.toUpperCase() 
              : 'COURIER SAFETY NETWORK',
            subMessage: '',
            fontSize: z.zone === 'BACK_FULL' ? 'xl' : 'md',
            textColor: selectedColor === 'NEON_LIME' || selectedColor === 'WHITE' ? '#0f172a' : '#ffffff',
            badgeStyle: 'REFLECTIVE_SHIELD',
            active: true,
          };
        }
      }
      return next;
    });

    if (currentCatalogItem.supportedZones.length > 0) {
      const firstZone = currentCatalogItem.supportedZones[0].zone;
      setActiveZone(firstZone);
      setActiveView(firstZone === 'BACK_FULL' ? 'back' : 'front');
    }
  }, [selectedGearType]);

  // Adjust text color contrast when fabric color switches
  const handleColorChange = (newColor: GearColor) => {
    setSelectedColor(newColor);
    const darkFabric = newColor !== 'NEON_LIME' && newColor !== 'WHITE';
    setZoneConfigs(prev => {
      const updated = { ...prev };
      for (const k of Object.keys(updated)) {
        if (updated[k]) {
          updated[k] = {
            ...updated[k],
            textColor: darkFabric ? '#ffffff' : '#0f172a',
          };
        }
      }
      return updated;
    });
  };

  const currentZoneConfig = zoneConfigs[activeZone] || {
    zone: activeZone,
    label: 'Designated Zone',
    sponsorMessage: '',
    subMessage: '',
    fontSize: 'md',
    textColor: '#0f172a',
    badgeStyle: 'NONE',
    active: true,
  };

  const updateActiveZoneField = (field: keyof GearDesignZoneConfig, value: any) => {
    setZoneConfigs(prev => ({
      ...prev,
      [activeZone]: {
        ...prev[activeZone],
        [field]: value,
      },
    }));
  };

  // Pricing & Metrics Calculations
  const unitCost = currentCatalogItem.baseUnitCostUsd;
  const totalCost = unitCost * quantity;
  // Metric: Estimated weekly urban courier pedestrian & traffic impressions (approx 3,600 impressions per 6-hr shift)
  const estimatedWeeklyImpressions = quantity * 3600 * 6;

  // Handle Submission for Approval / Dispatch
  const handleSubmitForApproval = async () => {
    if (!brandName.trim()) {
      toast.error('Please enter your Sponsor Brand Name before submitting.', { title: 'Missing Brand' });
      return;
    }

    setSubmitting(true);
    const newDesignOrder: GearDesignOrder = {
      id: `gdes_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      campaignId: campaignId || 'camp_ad_hoc_sponsor',
      campaignTitle: campaignTitle || `${brandName} Fleet Sponsorship`,
      sponsorBrand: brandName,
      sponsorContactEmail: contactEmail || 'sponsor@mutualpool.org',
      sponsorContactName: brandName,
      gearType: selectedGearType,
      gearName: currentCatalogItem.name,
      baseColor: selectedColor,
      quantity,
      unitCostUsd: unitCost,
      totalEstimatedCostUsd: totalCost,
      zones: zoneConfigs,
      status: isAdmin ? 'APPROVED' : 'PENDING_APPROVAL',
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // 1. Persist design to server backend
      let serverDesign = newDesignOrder;
      try {
        const createRes = await fetch('/api/fourthwall/designs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newDesignOrder),
        });
        if (createRes.ok) {
          const createData = await createRes.json();
          if (createData.design) {
            serverDesign = createData.design;
          }
        }
      } catch (err) {
        console.warn('Backend save warning:', err);
      }

      if (isAdmin) {
        // Admin direct approval & dispatch to Fourthwall API
        try {
          const approveRes = await fetch(`/api/fourthwall/designs/${serverDesign.id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminNotes: 'Approved directly by Administrator' }),
          });
          if (approveRes.ok) {
            const approveData = await approveRes.json();
            if (approveData.design) {
              serverDesign = approveData.design;
            }
          } else {
            const fwResult = await dispatchOrderToFourthwall(serverDesign);
            serverDesign.status = 'DISPATCHED_TO_FOURTHWALL';
            serverDesign.approvedAt = new Date().toISOString();
            serverDesign.fourthwallOrderId = fwResult.fourthwallOrderId;
            serverDesign.fourthwallOrderNumber = fwResult.fourthwallOrderNumber;
            serverDesign.fourthwallTrackingUrl = fwResult.fourthwallTrackingUrl;
            serverDesign.fourthwallProductionStage = fwResult.productionStage;
          }
        } catch {
          const fwResult = await dispatchOrderToFourthwall(serverDesign);
          serverDesign.status = 'DISPATCHED_TO_FOURTHWALL';
          serverDesign.approvedAt = new Date().toISOString();
          serverDesign.fourthwallOrderId = fwResult.fourthwallOrderId;
          serverDesign.fourthwallOrderNumber = fwResult.fourthwallOrderNumber;
          serverDesign.fourthwallTrackingUrl = fwResult.fourthwallTrackingUrl;
          serverDesign.fourthwallProductionStage = fwResult.productionStage;
        }

        setDispatchedOrder(serverDesign);
        toast.success(
          `Order ${serverDesign.fourthwallOrderNumber || 'FW-ORDER'} successfully transmitted to Fourthwall print pipeline! Production confirmed for ${quantity} units.`,
          { title: 'Fourthwall Order Dispatched' }
        );
      } else {
        // Submit for stewardship review
        try {
          const submitRes = await fetch(`/api/fourthwall/designs/${serverDesign.id}/submit`, {
            method: 'POST',
          });
          if (submitRes.ok) {
            const submitData = await submitRes.json();
            if (submitData.design) {
              serverDesign = submitData.design;
            }
          }
        } catch (err) {
          console.warn('Submit warning:', err);
        }

        setDispatchedOrder(serverDesign);
        toast.success(
          `Design for ${quantity}x ${currentCatalogItem.name} submitted for review. Upon approval, it will transmit to Fourthwall for print production.`,
          { title: 'Design Submitted for Approval' }
        );
      }

      if (onDesignSubmitted) {
        onDesignSubmitted(serverDesign);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit gear design.', { title: 'Submission Error' });
    } finally {
      setSubmitting(false);
    }
  };

  const fabricHex = COLOR_MAP[selectedColor]?.hex || '#0f172a';
  const fabricSecondaryHex = COLOR_MAP[selectedColor]?.secondaryHex || '#1e293b';

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl text-slate-900 shadow-sm overflow-hidden">
      {/* Studio Header Bar */}
      <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>Fourthwall Platform API</span>
            <span aria-hidden="true">·</span>
            <span>Direct-to-Film Print Pipeline</span>
            <span aria-hidden="true">·</span>
            <span>Certified Courier Gear</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Sponsored Courier Gear Studio
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Design branded high-visibility apparel with designated print zones and automated manufacturing dispatch.
          </p>
        </div>

        {/* Step Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveStep('apparel')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeStep === 'apparel' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Apparel & Color
          </button>
          <button
            type="button"
            onClick={() => setActiveStep('design')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeStep === 'design' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Message & Zones
          </button>
          <button
            type="button"
            onClick={() => setActiveStep('fleet')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeStep === 'fleet' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Fleet & Dispatch
          </button>
        </div>
      </div>

      {/* Main Studio Interactive Layout */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Photorealistic Interactive Garment Darkroom Stage (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Top Controls Toolbar: Garment Carousel & Front/Back Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
            {/* Gear Selector Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
              {FOURTHWALL_GEAR_CATALOG.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setSelectedGearType(item.type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer border ${
                    selectedGearType === item.type
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {item.name.split(' ')[0]} {item.type === 'DELIVERY_BAG' ? 'Bag' : item.name.split(' ')[1]}
                </button>
              ))}
            </div>

            {/* Front / Back Angle Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setActiveView('front')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activeView === 'front' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Front View
              </button>
              <button
                type="button"
                onClick={() => setActiveView('back')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activeView === 'back' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Back View
              </button>
            </div>
          </div>

          {/* Tactical Studio Canvas Stage */}
          <div className="relative aspect-4/3 w-full bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center p-6 overflow-hidden shadow-xl select-none">
            {/* Ambient Lighting & Measurement Grid */}
            <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px] opacity-30" />
            <div className="absolute inset-0 bg-radial from-slate-900/40 via-transparent to-slate-950/80 pointer-events-none" />

            {/* Top Left Tag: Specs & Active Print Zone */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-800">
                {currentCatalogItem.category}
              </span>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-1 rounded-md border border-emerald-800">
                DTF 300 DPI
              </span>
            </div>

            {/* Top Right: Flip Angle Quick Action */}
            <button
              type="button"
              onClick={() => setActiveView(prev => prev === 'front' ? 'back' : 'front')}
              className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 cursor-pointer transition-colors shadow-sm"
            >
              <RotateCw className="w-3.5 h-3.5 text-blue-400" />
              <span>Flip Angle</span>
            </button>

            {/* Garment SVG Vector Canvas */}
            <div className="relative w-full max-w-sm sm:max-w-md h-full flex flex-col items-center justify-center">
              <svg 
                viewBox="0 0 400 400" 
                className="w-full h-full drop-shadow-2xl transition-all duration-300"
              >
                <defs>
                  {/* Real Fabric 3D Texture & Shadow Gradients */}
                  <linearGradient id="fabricShading3D" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
                    <stop offset="35%" stopColor="#ffffff" stopOpacity="0.05" />
                    <stop offset="70%" stopColor="#000000" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
                  </linearGradient>

                  <linearGradient id="sleeveShade" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#000000" stopOpacity="0.25" />
                    <stop offset="50%" stopColor="#ffffff" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
                  </linearGradient>

                  {/* 3M Scotchlite Reflective Pattern */}
                  <pattern id="reflectivePattern" width="10" height="10" patternUnits="userSpaceOnUse">
                    <rect width="10" height="10" fill="#e2e8f0" />
                    <circle cx="5" cy="5" r="1.5" fill="#94a3b8" />
                  </pattern>
                </defs>

                {/* 1. WINDBREAKER SILHOUETTE */}
                {selectedGearType === 'WINDBREAKER' && (
                  <g>
                    {/* Sleeves */}
                    <path d="M 120 70 L 30 140 L 70 190 L 115 160 Z" fill={fabricSecondaryHex} stroke="#475569" strokeWidth="2" />
                    <path d="M 280 70 L 370 140 L 330 190 L 285 160 Z" fill={fabricSecondaryHex} stroke="#475569" strokeWidth="2" />
                    {/* Body Torso */}
                    <path
                      d="M 120 70 L 160 50 L 240 50 L 280 70 L 285 360 L 115 360 Z"
                      fill={fabricHex}
                      stroke="#475569"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M 120 70 L 160 50 L 240 50 L 280 70 L 285 360 L 115 360 Z"
                      fill="url(#fabricShading3D)"
                    />
                    {/* Storm Flap Center Zipper (Front) */}
                    {activeView === 'front' ? (
                      <>
                        <line x1="200" y1="50" x2="200" y2="360" stroke="#0f172a" strokeWidth="4.5" />
                        <rect x="196" y="70" width="8" height="14" rx="2" fill="#94a3b8" />
                      </>
                    ) : (
                      /* Back Seam */
                      <line x1="200" y1="50" x2="200" y2="360" stroke="#000000" strokeWidth="1.5" opacity="0.3" strokeDasharray="3 3" />
                    )}
                    {/* 3M Reflective Safety Bands */}
                    <path d="M 115 165 L 285 165 L 285 180 L 115 180 Z" fill="url(#reflectivePattern)" opacity="0.9" />
                    <path d="M 115 325 L 285 325 L 285 338 L 115 338 Z" fill="url(#reflectivePattern)" opacity="0.9" />
                    {/* Sleeve Reflective Accents */}
                    <path d="M 45 155 L 75 180" stroke="#f8fafc" strokeWidth="6" strokeDasharray="4 2" />
                    <path d="M 355 155 L 325 180" stroke="#f8fafc" strokeWidth="6" strokeDasharray="4 2" />
                  </g>
                )}

                {/* 2. HOODIE SILHOUETTE */}
                {selectedGearType === 'HOODIE' && (
                  <g>
                    {/* Hood Silhouette */}
                    <path d="M 145 60 C 145 15, 255 15, 255 60 Z" fill={fabricSecondaryHex} stroke="#475569" strokeWidth="2.5" />
                    {activeView === 'front' && (
                      <path d="M 175 60 C 175 40, 225 40, 225 60 Z" fill="#000000" fillOpacity="0.4" />
                    )}
                    {/* Sleeves */}
                    <path d="M 115 80 L 30 155 L 65 195 L 110 165 Z" fill={fabricSecondaryHex} stroke="#475569" strokeWidth="2" />
                    <path d="M 285 80 L 370 155 L 335 195 L 290 165 Z" fill={fabricSecondaryHex} stroke="#475569" strokeWidth="2" />
                    {/* Body */}
                    <path
                      d="M 115 80 L 150 60 L 250 60 L 285 80 L 290 365 L 110 365 Z"
                      fill={fabricHex}
                      stroke="#475569"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M 115 80 L 150 60 L 250 60 L 285 80 L 290 365 L 110 365 Z"
                      fill="url(#fabricShading3D)"
                    />
                    {/* Front Kangaroo Pocket */}
                    {activeView === 'front' && (
                      <path d="M 140 265 L 260 265 L 245 340 L 155 340 Z" fill="#000000" fillOpacity="0.18" stroke="#475569" strokeWidth="1.5" />
                    )}
                    {/* Ribbed Bottom Hem */}
                    <rect x="110" y="350" width="180" height="15" fill={fabricSecondaryHex} stroke="#475569" strokeWidth="1.5" />
                  </g>
                )}

                {/* 3. COMMERCIAL 40L DELIVERY BAG */}
                {selectedGearType === 'DELIVERY_BAG' && (
                  <g>
                    {/* Rigid Thermal Box Body */}
                    <rect x="90" y="80" width="220" height="260" rx="14" fill={fabricHex} stroke="#475569" strokeWidth="3" />
                    <rect x="90" y="80" width="220" height="260" rx="14" fill="url(#fabricShading3D)" />
                    {/* Flap Closure Edge */}
                    <path d="M 90 135 L 310 135" stroke="#0f172a" strokeWidth="4" />
                    <rect x="110" y="150" width="180" height="145" rx="8" fill="#ffffff" fillOpacity="0.05" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="5 3" />
                    {/* Top Carry Handle */}
                    <path d="M 160 80 C 160 45, 240 45, 240 80" fill="none" stroke="#0f172a" strokeWidth="9" />
                    {/* High-Vis Reflective Strips */}
                    <rect x="90" y="305" width="220" height="16" fill="url(#reflectivePattern)" />
                    <rect x="90" y="90" width="220" height="10" fill="url(#reflectivePattern)" opacity="0.6" />
                  </g>
                )}

                {/* 4. TECHNICAL FLEET POLO */}
                {selectedGearType === 'FLEET_POLO' && (
                  <g>
                    {/* Sleeves */}
                    <path d="M 125 70 L 40 130 L 70 170 L 115 145 Z" fill={fabricSecondaryHex} stroke="#475569" strokeWidth="2" />
                    <path d="M 275 70 L 360 130 L 330 170 L 285 145 Z" fill={fabricSecondaryHex} stroke="#475569" strokeWidth="2" />
                    {/* Body */}
                    <path
                      d="M 125 70 L 160 55 L 240 55 L 275 70 L 285 360 L 115 360 Z"
                      fill={fabricHex}
                      stroke="#475569"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M 125 70 L 160 55 L 240 55 L 275 70 L 285 360 L 115 360 Z"
                      fill="url(#fabricShading3D)"
                    />
                    {/* Ribbed Collar */}
                    <path d="M 160 55 L 180 115 L 200 130 L 220 115 L 240 55 Z" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
                    {activeView === 'front' && (
                      <g>
                        <line x1="200" y1="130" x2="200" y2="185" stroke="#475569" strokeWidth="2" />
                        <circle cx="200" cy="145" r="2.5" fill="#f8fafc" />
                        <circle cx="200" cy="165" r="2.5" fill="#f8fafc" />
                      </g>
                    )}
                  </g>
                )}

                {/* 5. COURIER CAP */}
                {selectedGearType === 'COURIER_CAP' && (
                  <g>
                    {/* Structured Crown */}
                    <path d="M 120 220 C 120 105, 280 105, 280 220 Z" fill={fabricHex} stroke="#475569" strokeWidth="2.5" />
                    <path d="M 120 220 C 120 105, 280 105, 280 220 Z" fill="url(#fabricShading3D)" />
                    {/* Eyelets */}
                    <circle cx="160" cy="160" r="3" fill="#0f172a" />
                    <circle cx="240" cy="160" r="3" fill="#0f172a" />
                    {/* Curved Visor */}
                    <path d="M 105 218 C 105 255, 295 255, 295 218 Z" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2" />
                    <path d="M 120 234 C 140 246, 260 246, 280 234" fill="none" stroke="url(#reflectivePattern)" strokeWidth="4.5" />
                  </g>
                )}
              </svg>

              {/* OVERLAY: Interactive Placement Hotspots & Live Rendered Typography */}
              
              {/* FRONT VIEW PLACEMENTS */}
              {activeView === 'front' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {/* Front Chest Zone */}
                  {(selectedGearType === 'WINDBREAKER' || selectedGearType === 'HOODIE' || selectedGearType === 'FLEET_POLO') && zoneConfigs['FRONT_CHEST']?.active && (
                    <div 
                      onClick={() => {
                        setActiveZone('FRONT_CHEST');
                        setActiveStep('design');
                      }}
                      className={`pointer-events-auto absolute transition-all duration-200 cursor-pointer ${
                        selectedGearType === 'HOODIE' 
                          ? 'top-[36%] w-52 text-center py-2' 
                          : 'top-[28%] left-[32%] w-36 text-left p-2'
                      } ${
                        activeZone === 'FRONT_CHEST' 
                          ? 'ring-2 ring-blue-400 bg-blue-500/20 rounded-xl shadow-lg' 
                          : 'hover:ring-1 hover:ring-amber-300 rounded-lg'
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center text-center">
                        <span 
                          style={{ color: zoneConfigs['FRONT_CHEST'].textColor }}
                          className={`font-black uppercase tracking-tight block ${
                            fontFamilyMode === 'CONDENSED' ? 'tracking-wider font-extrabold' : 
                            fontFamilyMode === 'MINIMAL' ? 'tracking-widest font-bold text-xs' : 'font-black'
                          } ${
                            zoneConfigs['FRONT_CHEST'].fontSize === 'xl' ? 'text-sm font-black' : 
                            zoneConfigs['FRONT_CHEST'].fontSize === 'lg' ? 'text-xs font-black' : 
                            'text-[11px] font-bold'
                          } ${
                            zoneConfigs['FRONT_CHEST'].badgeStyle === 'HIGH_VIS_BOX' 
                              ? 'bg-amber-400 text-slate-950 px-2 py-0.5 rounded shadow' :
                            zoneConfigs['FRONT_CHEST'].badgeStyle === 'REFLECTIVE_SHIELD'
                              ? 'border-2 border-slate-200 px-2 py-0.5 rounded bg-slate-900/70 shadow' : ''
                          }`}
                        >
                          {zoneConfigs['FRONT_CHEST'].sponsorMessage || brandName}
                        </span>
                        {zoneConfigs['FRONT_CHEST'].subMessage && (
                          <span 
                            style={{ color: zoneConfigs['FRONT_CHEST'].textColor }}
                            className="text-[8.5px] font-medium opacity-90 block mt-0.5"
                          >
                            {zoneConfigs['FRONT_CHEST'].subMessage}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Delivery Bag Front Flap */}
                  {selectedGearType === 'DELIVERY_BAG' && zoneConfigs['FRONT_FLAP']?.active && (
                    <div 
                      onClick={() => {
                        setActiveZone('FRONT_FLAP');
                        setActiveStep('design');
                      }}
                      className={`pointer-events-auto absolute top-[36%] w-48 p-3 text-center transition-all cursor-pointer ${
                        activeZone === 'FRONT_FLAP'
                          ? 'ring-2 ring-blue-400 bg-blue-500/20 rounded-xl'
                          : 'hover:ring-1 hover:ring-amber-300 rounded-lg'
                      }`}
                    >
                      <span 
                        style={{ color: zoneConfigs['FRONT_FLAP'].textColor }}
                        className="font-black text-xs uppercase tracking-wider block bg-black/40 px-3 py-1.5 rounded border border-white/20 shadow"
                      >
                        {zoneConfigs['FRONT_FLAP'].sponsorMessage || brandName}
                      </span>
                      {zoneConfigs['FRONT_FLAP'].subMessage && (
                        <span 
                          style={{ color: zoneConfigs['FRONT_FLAP'].textColor }}
                          className="text-[9px] font-bold block mt-1"
                        >
                          {zoneConfigs['FRONT_FLAP'].subMessage}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Crown Zone (Cap) */}
                  {selectedGearType === 'COURIER_CAP' && zoneConfigs['CROWN']?.active && (
                    <div 
                      onClick={() => {
                        setActiveZone('CROWN');
                        setActiveStep('design');
                      }}
                      className={`pointer-events-auto absolute top-[40%] w-32 p-1.5 text-center transition-all cursor-pointer ${
                        activeZone === 'CROWN'
                          ? 'ring-2 ring-blue-400 bg-blue-500/20 rounded-lg'
                          : 'hover:ring-1 hover:ring-amber-300 rounded'
                      }`}
                    >
                      <span 
                        style={{ color: zoneConfigs['CROWN'].textColor }}
                        className="font-black text-[11px] uppercase tracking-wide block bg-black/50 px-2 py-0.5 rounded border border-white/20"
                      >
                        {zoneConfigs['CROWN'].sponsorMessage || brandName}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* BACK VIEW PLACEMENTS */}
              {activeView === 'back' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {zoneConfigs['BACK_FULL']?.active && (
                    <div 
                      onClick={() => {
                        setActiveZone('BACK_FULL');
                        setActiveStep('design');
                      }}
                      className={`pointer-events-auto absolute top-[28%] w-56 p-3 text-center transition-all cursor-pointer ${
                        activeZone === 'BACK_FULL'
                          ? 'ring-2 ring-blue-400 bg-blue-500/20 rounded-xl shadow-lg'
                          : 'hover:ring-1 hover:ring-amber-300 rounded-lg'
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span 
                          style={{ color: zoneConfigs['BACK_FULL'].textColor }}
                          className={`font-black uppercase tracking-tight block ${
                            zoneConfigs['BACK_FULL'].fontSize === 'xl' ? 'text-sm font-black' : 'text-xs font-bold'
                          } ${
                            zoneConfigs['BACK_FULL'].badgeStyle === 'HIGH_VIS_BOX' 
                              ? 'bg-amber-400 text-slate-950 px-3 py-1 rounded shadow-md font-black' :
                            zoneConfigs['BACK_FULL'].badgeStyle === 'REFLECTIVE_SHIELD'
                              ? 'border-2 border-slate-200 px-3 py-1 rounded bg-slate-900/80 shadow-md' : ''
                          }`}
                        >
                          {zoneConfigs['BACK_FULL'].sponsorMessage || 'COURIER IMPACT BILLBOARD'}
                        </span>
                        {zoneConfigs['BACK_FULL'].subMessage && (
                          <span 
                            style={{ color: zoneConfigs['BACK_FULL'].textColor }}
                            className="text-[9.5px] font-bold opacity-90 block mt-1 tracking-wide"
                          >
                            {zoneConfigs['BACK_FULL'].subMessage}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Status Pill */}
            <div className="absolute bottom-3 left-4 bg-slate-900/90 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>Editing: <strong className="text-white">{currentZoneConfig.label}</strong></span>
            </div>
          </div>

          {/* Colorways Palette Selector */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-semibold text-slate-800">Garment Color:</span>
              <span className="text-xs font-medium text-slate-600">{COLOR_MAP[selectedColor]?.label}</span>
            </div>

            <div className="flex items-center gap-2">
              {currentCatalogItem.availableColors.map((color) => {
                const conf = COLOR_MAP[color];
                const isSelected = selectedColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleColorChange(color)}
                    title={conf.label}
                    style={{ backgroundColor: conf.hex }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                      isSelected ? 'border-blue-600 scale-125 ring-2 ring-blue-500/30' : 'border-slate-300 hover:scale-110'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Technical Specifications Accordion */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">{currentCatalogItem.name}</span>
              <span className="font-mono text-emerald-700 font-bold">${unitCost.toFixed(2)} wholesale/unit</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11.5px]">
              {currentCatalogItem.description}
            </p>
            <div className="pt-1 flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>{currentCatalogItem.materialSpec}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Step-by-Step Configuration Panels (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* STEP 1: APPAREL & COLOR SELECTION */}
          {activeStep === 'apparel' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Step 1 of 3</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">Select Fleet Apparel</h3>
                <p className="text-xs text-slate-500 mt-0.5">Choose gear optimized for courier mobility and extreme weather.</p>
              </div>

              <div className="space-y-2.5">
                {FOURTHWALL_GEAR_CATALOG.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setSelectedGearType(item.type)}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      selectedGearType === item.type
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{item.name}</span>
                        {selectedGearType === item.type && (
                          <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-1.5 py-0.5 rounded">Selected</span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">{item.category}</span>
                      <span className="text-[10.5px] text-slate-400 block mt-1 font-mono">
                        {item.supportedZones.length} print zones: {item.supportedZones.map(z => z.label.split(' ')[0]).join(', ')}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-900 shrink-0">
                      ${item.baseUnitCostUsd.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setActiveStep('design')}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span>Continue to Message & Print Zones</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* STEP 2: MESSAGE PLACEMENT & DESIGN */}
          {activeStep === 'design' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Step 2 of 3</span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">Designate Print Zones</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep('fleet')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>Fleet Sizing</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Zone Selector Buttons */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Select Placement Area:</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {currentCatalogItem.supportedZones.map((z) => {
                    const isActive = activeZone === z.zone;
                    const hasMessage = Boolean(zoneConfigs[z.zone]?.sponsorMessage?.trim());
                    return (
                      <button
                        key={z.zone}
                        type="button"
                        onClick={() => {
                          setActiveZone(z.zone);
                          setActiveView(z.zone === 'BACK_FULL' ? 'back' : 'front');
                        }}
                        className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between text-xs cursor-pointer border ${
                          isActive 
                            ? 'border-blue-600 bg-blue-50 text-slate-900 font-bold shadow-xs' 
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <span className="block font-semibold">{z.label}</span>
                          <span className="text-[10.5px] text-slate-500 font-mono">Max {z.maxCharacters} chars · {z.dimensions}</span>
                        </div>
                        {hasMessage ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">Empty</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Zone Editor Box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3.5">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-blue-600" />
                    {currentZoneConfig.label}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {currentZoneConfig.sponsorMessage.length} chars
                  </span>
                </div>

                {/* Main Sponsor Headline */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Sponsor Headline / Brand Name
                  </label>
                  <input
                    type="text"
                    value={currentZoneConfig.sponsorMessage}
                    onChange={(e) => updateActiveZoneField('sponsorMessage', e.target.value)}
                    placeholder="e.g. GATORADE FAST-TWITCH"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 uppercase font-bold focus:outline-none focus:border-blue-600 transition-colors shadow-xs"
                  />
                </div>

                {/* Secondary Tagline */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Secondary Sub-Message / Tagline (Optional)
                  </label>
                  <input
                    type="text"
                    value={currentZoneConfig.subMessage || ''}
                    onChange={(e) => updateActiveZoneField('subMessage', e.target.value)}
                    placeholder="e.g. Fueling the Courier Fleet"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition-colors shadow-xs"
                  />
                </div>

                {/* Typography Scale & Badge Style */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600 block mb-1">Text Scale</label>
                    <select
                      value={currentZoneConfig.fontSize}
                      onChange={(e) => updateActiveZoneField('fontSize', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 cursor-pointer shadow-xs"
                    >
                      <option value="sm">Small (Compact)</option>
                      <option value="md">Medium (Standard)</option>
                      <option value="lg">Large (Impact)</option>
                      <option value="xl">Extra Large (Billboard)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600 block mb-1">Badge Treatment</label>
                    <select
                      value={currentZoneConfig.badgeStyle}
                      onChange={(e) => updateActiveZoneField('badgeStyle', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 cursor-pointer shadow-xs"
                    >
                      <option value="NONE">Direct Print Lettering</option>
                      <option value="OUTLINED">Contrast Outline Border</option>
                      <option value="HIGH_VIS_BOX">High-Vis Courier Box</option>
                      <option value="REFLECTIVE_SHIELD">3M Reflective Shield</option>
                    </select>
                  </div>
                </div>

                {/* Ink Color Picker */}
                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-1.5">Print Ink Color</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {INK_PALETTE.map((ink) => (
                      <button
                        key={ink.hex}
                        type="button"
                        onClick={() => updateActiveZoneField('textColor', ink.hex)}
                        title={ink.label}
                        style={{ backgroundColor: ink.hex }}
                        className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                          currentZoneConfig.textColor === ink.hex ? 'border-blue-600 scale-125 ring-2 ring-blue-500/30' : 'border-slate-300 hover:scale-110'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveStep('fleet')}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span>Proceed to Fleet Volume & Dispatch</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* STEP 3: FLEET VOLUME, PRICING & DISPATCH */}
          {activeStep === 'fleet' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Step 3 of 3</span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">Fleet Logistics & Dispatch</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep('design')}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Back to Design
                </button>
              </div>

              {/* Volume Preset Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                    Fleet Quantity:
                  </span>
                  <span className="font-mono text-blue-700 font-bold">{quantity} Couriers</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[15, 25, 50, 100].map((vol) => (
                    <button
                      key={vol}
                      type="button"
                      onClick={() => setQuantity(vol)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        quantity === vol 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {vol} units
                    </button>
                  ))}
                </div>
              </div>

              {/* Impact & Economics Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Street Impressions</span>
                    <span className="text-sm font-black text-slate-900 font-mono">
                      ~{estimatedWeeklyImpressions.toLocaleString()} views/week
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Production Turnaround</span>
                    <span className="text-xs font-semibold text-slate-700">3–5 Business Days</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Fourthwall Order Total</span>
                    <span className="text-xs text-slate-600 font-mono">${unitCost.toFixed(2)} × {quantity} units</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-emerald-700 font-mono">
                      ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sponsor Contact Details */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Sponsor Verification Details</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="Brand Name"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 shadow-xs"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="sponsor@brand.com"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleSubmitForApproval}
                  disabled={submitting}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Transmitting Order to Fourthwall...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{isAdmin ? 'Approve & Dispatch Order to Fourthwall' : 'Submit Gear Design for Approval'}</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                  Upon approval, design assets and fleet quantities are transmitted via the Fourthwall Ordering API to trigger direct-to-film printing.
                </p>
              </div>

              {/* Dispatched Order Confirmation Banner */}
              {dispatchedOrder && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {dispatchedOrder.status === 'DISPATCHED_TO_FOURTHWALL' 
                        ? 'Fourthwall Order Dispatched!' 
                        : 'Design Submitted for Stewardship Approval'}
                    </span>
                    <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                      {dispatchedOrder.status}
                    </span>
                  </div>

                  {dispatchedOrder.fourthwallOrderNumber && (
                    <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                      <div className="bg-white p-2 rounded-lg border border-emerald-200">
                        <span className="text-[10px] text-slate-500 block font-sans">Fourthwall Order #</span>
                        <strong className="text-slate-900">{dispatchedOrder.fourthwallOrderNumber}</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-200">
                        <span className="text-[10px] text-slate-500 block font-sans">Production Pipeline</span>
                        <strong className="text-emerald-700">{dispatchedOrder.fourthwallProductionStage || 'ARTWORK_VALIDATED'}</strong>
                      </div>
                    </div>
                  )}

                  {dispatchedOrder.fourthwallTrackingUrl && (
                    <a
                      href={dispatchedOrder.fourthwallTrackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 underline font-mono"
                    >
                      <span>Track Order on Fourthwall Dashboard</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
