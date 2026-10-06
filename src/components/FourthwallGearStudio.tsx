import React, { useState, useEffect } from 'react';
import { 
  GearCatalogItem, 
  GearDesignOrder, 
  GearProductType, 
  GearPrintZone, 
  GearColor, 
  GearDesignZoneConfig 
} from '../types';
import { FOURTHWALL_GEAR_CATALOG, INITIAL_GEAR_DESIGNS, dispatchOrderToFourthwall } from '../services/fourthwall';
import { useToast } from '../context/ToastContext';
import { 
  Sparkles, 
  CheckCircle2, 
  Send, 
  Eye, 
  Layers, 
  DollarSign, 
  Truck, 
  ShieldCheck, 
  ExternalLink, 
  RefreshCw, 
  Palette, 
  Type, 
  Sliders, 
  AlertCircle,
  Clock,
  Printer
} from 'lucide-react';

interface FourthwallGearStudioProps {
  sponsorBrand?: string;
  sponsorEmail?: string;
  campaignId?: string;
  campaignTitle?: string;
  onDesignSubmitted?: (design: GearDesignOrder) => void;
  isAdmin?: boolean;
}

const COLOR_MAP: Record<GearColor, { label: string; hex: string; textDark: boolean }> = {
  BLACK: { label: 'Stealth Black', hex: '#0f172a', textDark: false },
  NAVY: { label: 'Midnight Navy', hex: '#1e293b', textDark: false },
  NEON_LIME: { label: 'High-Vis Neon Lime', hex: '#84cc16', textDark: true },
  STEALTH_CHARCOAL: { label: 'Charcoal Grey', hex: '#334155', textDark: false },
  SAFETY_ORANGE: { label: 'Safety Orange', hex: '#ea580c', textDark: false },
  WHITE: { label: 'Clean White', hex: '#f8fafc', textDark: true },
};

export const FourthwallGearStudio: React.FC<FourthwallGearStudioProps> = ({
  sponsorBrand = 'Apex Logistics',
  sponsorEmail = 'sponsor@apexlogistics.com',
  campaignId,
  campaignTitle,
  onDesignSubmitted,
  isAdmin = false,
}) => {
  const toast = useToast();
  const [selectedGearType, setSelectedGearType] = useState<GearProductType>('WINDBREAKER');
  const [selectedColor, setSelectedColor] = useState<GearColor>('NEON_LIME');
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [activeZone, setActiveZone] = useState<GearPrintZone>('FRONT_CHEST');
  const [quantity, setQuantity] = useState<number>(50);
  const [brandName, setBrandName] = useState<string>(sponsorBrand);
  const [contactEmail, setContactEmail] = useState<string>(sponsorEmail);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [dispatchedOrder, setDispatchedOrder] = useState<GearDesignOrder | null>(null);

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
        subMessage: z.zone === 'BACK_FULL' ? 'Proud Partner of Local Couriers' : '',
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

    // Default to first supported zone
    if (currentCatalogItem.supportedZones.length > 0) {
      setActiveZone(currentCatalogItem.supportedZones[0].zone);
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

  // Pricing calculations
  const unitCost = currentCatalogItem.baseUnitCostUsd;
  const totalCost = unitCost * quantity;

  // Handle Submission for Approval
  const handleSubmitForApproval = async () => {
    if (!brandName.trim()) {
      toast.error('Please specify the Sponsor Brand Name.', { title: 'Missing Brand' });
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
            // Client-side fallback if server offline
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
          `Design for ${quantity}x ${currentCatalogItem.name} submitted for stewardship review. Upon admin approval, it will automatically transmit to Fourthwall for print production.`,
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

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-6 text-white space-y-6 shadow-xl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <Printer className="w-3 h-3" />
              Powered by Fourthwall Platform API
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              v1 Print-On-Demand Integration
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Sponsored Courier Gear Studio
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Design official high-visibility branded apparel for fleet couriers with designated Fourthwall print zones and automated manufacturing dispatch.
          </p>
        </div>

        {/* Integration Status Badge */}
        <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl flex items-center gap-3 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div className="text-xs">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Fourthwall Integration</span>
            <span className="font-bold text-white">Direct-to-Film Print Pipeline</span>
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Left = Visual Interactive Mockup, Right = Controls & Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual Apparel Canvas (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Controls Bar: Gear Type Selector & Front/Back Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-800/60 p-2 rounded-xl border border-slate-700/80">
            {/* Gear Selector Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
              {FOURTHWALL_GEAR_CATALOG.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setSelectedGearType(item.type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    selectedGearType === item.type
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {item.name.split(' ')[0]} {item.type === 'DELIVERY_BAG' ? 'Bag' : item.name.split(' ')[1]}
                </button>
              ))}
            </div>

            {/* Front / Back Toggle */}
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveView('front')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  activeView === 'front' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Front View
              </button>
              <button
                type="button"
                onClick={() => setActiveView('back')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  activeView === 'back' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Back View
              </button>
            </div>
          </div>

          {/* Interactive Apparel Mockup Canvas */}
          <div className="relative aspect-4/3 w-full bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center p-6 overflow-hidden shadow-inner">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-25" />

            {/* Mockup Canvas Rendering */}
            <div className="relative w-full max-w-md h-full flex flex-col items-center justify-center">
              {/* Apparel Silhouette Mockup (SVG Vector with Fabric Tint) */}
              <svg 
                viewBox="0 0 400 400" 
                className="w-full h-full drop-shadow-2xl transition-all duration-300"
              >
                <defs>
                  {/* Subtle 3D Apparel Shading Gradient */}
                  <linearGradient id="fabricShading" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
                    <stop offset="50%" stopColor="#000000" stopOpacity="0" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
                  </linearGradient>

                  {/* 3M Reflective Stripe Pattern */}
                  <pattern id="reflectiveStripe" width="8" height="8" patternUnits="userSpaceOnUse">
                    <rect width="8" height="8" fill="#e2e8f0" />
                    <circle cx="4" cy="4" r="1.5" fill="#94a3b8" />
                  </pattern>
                </defs>

                {/* SVG Shapes depending on Gear Type */}
                {selectedGearType === 'WINDBREAKER' && (
                  <g>
                    {/* Windbreaker Body Silhouette */}
                    <path
                      d="M 120 70 L 160 50 L 240 50 L 280 70 L 370 140 L 330 190 L 285 160 L 285 360 L 115 360 L 115 160 L 70 190 L 30 140 Z"
                      fill={fabricHex}
                      stroke="#475569"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M 120 70 L 160 50 L 240 50 L 280 70 L 370 140 L 330 190 L 285 160 L 285 360 L 115 360 L 115 160 L 70 190 L 30 140 Z"
                      fill="url(#fabricShading)"
                    />
                    {/* Zipper Placket (Front) */}
                    {activeView === 'front' && (
                      <line x1="200" y1="50" x2="200" y2="360" stroke="#1e293b" strokeWidth="4" />
                    )}
                    {/* 3M Reflective Chest/Back Bands */}
                    <path d="M 115 170 L 285 170 L 285 185 L 115 185 Z" fill="url(#reflectiveStripe)" opacity="0.9" />
                    <path d="M 115 330 L 285 330 L 285 342 L 115 342 Z" fill="url(#reflectiveStripe)" opacity="0.9" />
                    {/* Sleeve Reflective Arm Bands */}
                    <path d="M 45 155 L 75 180" stroke="#f8fafc" strokeWidth="6" strokeDasharray="4 2" />
                    <path d="M 355 155 L 325 180" stroke="#f8fafc" strokeWidth="6" strokeDasharray="4 2" />
                  </g>
                )}

                {selectedGearType === 'HOODIE' && (
                  <g>
                    {/* Hood Silhouette */}
                    <path d="M 150 55 C 150 15, 250 15, 250 55 Z" fill={fabricHex} stroke="#475569" strokeWidth="2" />
                    {/* Body Silhouette */}
                    <path
                      d="M 115 80 L 150 60 L 250 60 L 285 80 L 370 155 L 335 195 L 290 165 L 290 365 L 110 365 L 110 165 L 65 195 L 30 155 Z"
                      fill={fabricHex}
                      stroke="#475569"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M 115 80 L 150 60 L 250 60 L 285 80 L 370 155 L 335 195 L 290 165 L 290 365 L 110 365 L 110 165 L 65 195 L 30 155 Z"
                      fill="url(#fabricShading)"
                    />
                    {/* Front Kangaroo Pocket */}
                    {activeView === 'front' && (
                      <path d="M 145 270 L 255 270 L 240 340 L 160 340 Z" fill="#000000" fillOpacity="0.12" stroke="#475569" strokeWidth="1.5" />
                    )}
                  </g>
                )}

                {selectedGearType === 'DELIVERY_BAG' && (
                  <g>
                    {/* Thermal Bag 3D Cube */}
                    <rect x="90" y="80" width="220" height="260" rx="16" fill={fabricHex} stroke="#475569" strokeWidth="3" />
                    <rect x="90" y="80" width="220" height="260" rx="16" fill="url(#fabricShading)" />
                    {/* Straps / Flap line */}
                    <path d="M 100 130 L 300 130" stroke="#1e293b" strokeWidth="3" strokeDasharray="6 3" />
                    <rect x="110" y="145" width="180" height="150" rx="8" fill="#ffffff" fillOpacity="0.05" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4" />
                    {/* Top Carry Handle */}
                    <path d="M 160 80 C 160 50, 240 50, 240 80" fill="none" stroke="#0f172a" strokeWidth="8" />
                    {/* High-Vis Reflective Strips */}
                    <rect x="90" y="305" width="220" height="16" fill="url(#reflectiveStripe)" />
                  </g>
                )}

                {selectedGearType === 'FLEET_POLO' && (
                  <g>
                    {/* Technical Polo Body */}
                    <path
                      d="M 125 70 L 160 55 L 240 55 L 275 70 L 360 130 L 330 170 L 285 145 L 285 360 L 115 360 L 115 145 L 70 170 L 40 130 Z"
                      fill={fabricHex}
                      stroke="#475569"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M 125 70 L 160 55 L 240 55 L 275 70 L 360 130 L 330 170 L 285 145 L 285 360 L 115 360 L 115 145 L 70 170 L 40 130 Z"
                      fill="url(#fabricShading)"
                    />
                    {/* Polo Collar */}
                    <path d="M 160 55 L 180 115 L 200 130 L 220 115 L 240 55 Z" fill="#000000" fillOpacity="0.2" stroke="#475569" strokeWidth="1.5" />
                  </g>
                )}

                {selectedGearType === 'COURIER_CAP' && (
                  <g>
                    {/* Athletic Cap Profile */}
                    <path d="M 120 220 C 120 110, 280 110, 280 220 Z" fill={fabricHex} stroke="#475569" strokeWidth="2.5" />
                    <path d="M 120 220 C 120 110, 280 110, 280 220 Z" fill="url(#fabricShading)" />
                    {/* Curved Visor / Brim */}
                    <path d="M 105 218 C 105 250, 295 250, 295 218 Z" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2" />
                    {/* Reflective Brim Edge */}
                    <path d="M 120 232 C 140 244, 260 244, 280 232" fill="none" stroke="url(#reflectiveStripe)" strokeWidth="4" />
                  </g>
                )}
              </svg>

              {/* OVERLAY: Dynamic Print Zone Placement on Mockup */}
              {/* 1. FRONT VIEW PLACEMENTS */}
              {activeView === 'front' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {/* Front Chest Zone (Windbreaker / Hoodie / Polo) */}
                  {(selectedGearType === 'WINDBREAKER' || selectedGearType === 'HOODIE' || selectedGearType === 'FLEET_POLO') && zoneConfigs['FRONT_CHEST']?.active && (
                    <div 
                      onClick={() => setActiveZone('FRONT_CHEST')}
                      className={`pointer-events-auto absolute transition-all duration-200 cursor-pointer ${
                        selectedGearType === 'HOODIE' 
                          ? 'top-[36%] w-48 text-center py-2' 
                          : 'top-[30%] left-[34%] w-32 text-left p-1.5'
                      } ${
                        activeZone === 'FRONT_CHEST' 
                          ? 'ring-2 ring-blue-400 bg-blue-500/20 rounded-lg shadow-lg' 
                          : 'hover:ring-1 hover:ring-amber-300 rounded'
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center text-center">
                        <span 
                          style={{ color: zoneConfigs['FRONT_CHEST'].textColor }}
                          className={`font-black uppercase tracking-tight block ${
                            zoneConfigs['FRONT_CHEST'].fontSize === 'xl' ? 'text-sm font-black' : 
                            zoneConfigs['FRONT_CHEST'].fontSize === 'lg' ? 'text-xs font-black' : 
                            'text-[10px] font-bold'
                          } ${
                            zoneConfigs['FRONT_CHEST'].badgeStyle === 'HIGH_VIS_BOX' 
                              ? 'bg-amber-400 text-slate-950 px-2 py-0.5 rounded shadow' :
                            zoneConfigs['FRONT_CHEST'].badgeStyle === 'REFLECTIVE_SHIELD'
                              ? 'border-2 border-slate-300 px-2 py-0.5 rounded bg-slate-900/60 shadow' : ''
                          }`}
                        >
                          {zoneConfigs['FRONT_CHEST'].sponsorMessage || brandName}
                        </span>
                        {zoneConfigs['FRONT_CHEST'].subMessage && (
                          <span 
                            style={{ color: zoneConfigs['FRONT_CHEST'].textColor }}
                            className="text-[8px] font-medium opacity-90 block mt-0.5"
                          >
                            {zoneConfigs['FRONT_CHEST'].subMessage}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Front Flap Zone (Delivery Bag) */}
                  {selectedGearType === 'DELIVERY_BAG' && zoneConfigs['FRONT_FLAP']?.active && (
                    <div 
                      onClick={() => setActiveZone('FRONT_FLAP')}
                      className={`pointer-events-auto absolute top-[36%] w-44 p-3 text-center transition-all cursor-pointer ${
                        activeZone === 'FRONT_FLAP'
                          ? 'ring-2 ring-blue-400 bg-blue-500/20 rounded-xl'
                          : 'hover:ring-1 hover:ring-amber-300 rounded-lg'
                      }`}
                    >
                      <span 
                        style={{ color: zoneConfigs['FRONT_FLAP'].textColor }}
                        className="font-black text-xs uppercase tracking-wider block bg-black/40 px-2 py-1 rounded border border-white/20 shadow"
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
                      onClick={() => setActiveZone('CROWN')}
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

              {/* 2. BACK VIEW PLACEMENTS */}
              {activeView === 'back' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {zoneConfigs['BACK_FULL']?.active && (
                    <div 
                      onClick={() => setActiveZone('BACK_FULL')}
                      className={`pointer-events-auto absolute top-[28%] w-52 p-3 text-center transition-all cursor-pointer ${
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
                            className="text-[9px] font-bold opacity-90 block mt-1 tracking-wide"
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

            {/* Designated Print Zone Indicator Legend */}
            <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-[10px] text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>Active Placement: <strong className="text-white">{currentZoneConfig.label}</strong></span>
            </div>
          </div>

          {/* Color Switcher Bar */}
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/80 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-200">Fabric Color:</span>
              <span className="text-xs font-mono text-emerald-300">{COLOR_MAP[selectedColor]?.label}</span>
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
                      isSelected ? 'border-blue-400 scale-125 ring-2 ring-blue-500/50' : 'border-slate-600 hover:scale-110'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Material & Specs Card */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-bold text-white">{currentCatalogItem.name}</span>
              <span className="font-mono text-emerald-400 font-bold">${unitCost.toFixed(2)} / unit</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {currentCatalogItem.description}
            </p>
            <div className="pt-1 flex items-center gap-1.5 text-[10.5px] text-slate-400 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Spec: {currentCatalogItem.materialSpec}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Designated Zone Customization, Sponsor Message & Dispatch (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Print Zone Tabs */}
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                <span>Designated Print Zones</span>
              </div>
              <span className="text-[10px] text-slate-400">Fourthwall Direct-to-Film</span>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {currentCatalogItem.supportedZones.map((z) => {
                const isActive = activeZone === z.zone;
                return (
                  <button
                    key={z.zone}
                    type="button"
                    onClick={() => {
                      setActiveZone(z.zone);
                      if (z.zone === 'BACK_FULL') {
                        setActiveView('back');
                      } else {
                        setActiveView('front');
                      }
                    }}
                    className={`w-full p-2.5 rounded-lg text-left transition-all flex items-center justify-between text-xs cursor-pointer ${
                      isActive 
                        ? 'bg-blue-600/30 border border-blue-500 text-white font-bold' 
                        : 'bg-slate-900/60 border border-slate-800 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <span className="block font-medium">{z.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono">Max {z.maxCharacters} chars • {z.dimensions}</span>
                    </div>
                    {zoneConfigs[z.zone]?.sponsorMessage ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="text-[10px] text-slate-500">Empty</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Zone Text & Message Editor */}
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-3.5">
            <div className="flex items-center justify-between pb-1 border-b border-slate-700/60">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5" />
                {currentZoneConfig.label}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {currentZoneConfig.sponsorMessage.length} chars
              </span>
            </div>

            {/* Sponsor Main Message Input */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Sponsor Headline / Brand Message
              </label>
              <input
                type="text"
                value={currentZoneConfig.sponsorMessage}
                onChange={(e) => updateActiveZoneField('sponsorMessage', e.target.value)}
                placeholder="e.g. POWERED BY APEX LOGISTICS"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase font-bold focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Sub-Message / Tagline (Optional) */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Secondary Tagline / URL (Optional)
              </label>
              <input
                type="text"
                value={currentZoneConfig.subMessage || ''}
                onChange={(e) => updateActiveZoneField('subMessage', e.target.value)}
                placeholder="e.g. Official Fleet Nutrition Partner"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Font Size & Treatment Style */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Text Scale</label>
                <select
                  value={currentZoneConfig.fontSize}
                  onChange={(e) => updateActiveZoneField('fontSize', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white cursor-pointer"
                >
                  <option value="sm">Small (Compact)</option>
                  <option value="md">Medium (Standard)</option>
                  <option value="lg">Large (Impact)</option>
                  <option value="xl">Extra Large (Billboard)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Badge Treatment</label>
                <select
                  value={currentZoneConfig.badgeStyle}
                  onChange={(e) => updateActiveZoneField('badgeStyle', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white cursor-pointer"
                >
                  <option value="NONE">Direct Print Lettering</option>
                  <option value="OUTLINED">Contrast Outline Border</option>
                  <option value="HIGH_VIS_BOX">High-Vis Courier Box</option>
                  <option value="REFLECTIVE_SHIELD">3M Reflective Shield</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fleet Quantity & Fourthwall Wholesale Cost Estimator */}
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-400" />
                Courier Fleet Order Volume
              </span>
              <span className="font-mono text-emerald-300 font-bold">{quantity} Couriers</span>
            </div>

            {/* Preset Volume Buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              {[15, 25, 50, 100].map((vol) => (
                <button
                  key={vol}
                  type="button"
                  onClick={() => setQuantity(vol)}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    quantity === vol 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-900/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {vol} units
                </button>
              ))}
            </div>

            {/* Total Budget Card */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Fourthwall Total</span>
                <span className="text-xs text-slate-300 font-mono">${unitCost.toFixed(2)} x {quantity} units</span>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-emerald-400 font-mono">${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-slate-400 block font-sans">Turnaround: 3–5 Days</span>
              </div>
            </div>

            {/* Sponsor Identification Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Brand / Sponsor Name</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Brand Name"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Contact Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="sponsor@brand.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Action Submission Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleSubmitForApproval}
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Fourthwall Order...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{isAdmin ? 'Approve & Dispatch Order to Fourthwall' : 'Submit Gear Design for Approval'}</span>
                </>
              )}
            </button>

            <p className="text-[10.5px] text-slate-400 text-center leading-relaxed">
              Upon approval, the design and order specs are automatically transmitted via Fourthwall API to start direct-to-film printing and bulk delivery to courier logistics.
            </p>
          </div>

          {/* Dispatched Order Feedback Card (If Dispatched or Approved) */}
          {dispatchedOrder && (
            <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-100 text-xs space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {dispatchedOrder.status === 'DISPATCHED_TO_FOURTHWALL' 
                    ? 'Fourthwall Order Dispatched!' 
                    : 'Design Queued for Approval'}
                </span>
                <span className="font-mono text-[10px] bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700">
                  {dispatchedOrder.status}
                </span>
              </div>

              {dispatchedOrder.fourthwallOrderNumber && (
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px] text-slate-300">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">Fourthwall Order #</span>
                    <strong className="text-white">{dispatchedOrder.fourthwallOrderNumber}</strong>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">Production Pipeline</span>
                    <strong className="text-emerald-400">{dispatchedOrder.fourthwallProductionStage || 'ARTWORK_VALIDATED'}</strong>
                  </div>
                </div>
              )}

              {dispatchedOrder.fourthwallTrackingUrl && (
                <a
                  href={dispatchedOrder.fourthwallTrackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 underline font-mono"
                >
                  <span>View Production Status on Fourthwall Dashboard</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
