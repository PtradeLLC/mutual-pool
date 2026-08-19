import { User, Pod, Perk, AuditLogEntry, WeeklyCycle, Deposit, AdCampaign, CampaignShiftLog } from '../types';

export const INITIAL_USERS: User[] = [];


export const INITIAL_PODS: Pod[] = [];

export const INITIAL_PERKS: Perk[] = [
  {
    id: 'perk_meineke_20',
    title: '20% Off Full Synthetic Oil Change & Brake Inspection',
    category: 'Vehicle Maintenance',
    provider: 'Meineke Car Care',
    description: 'Exclusive 20% discount on all oil changes, tire rotations, and brake servicing for verified gig drivers.',
    valueBadge: '20% OFF',
    redemptionType: 'CODE',
    redemptionData: 'MEINEKE20GIG',
    eligibility: 'All active Mutual Pool members',
    partnerEmail: 'partnerships@meineke.com',
    partnerNotes: 'Nationwide partner offer for rideshare and delivery drivers.',
    status: 'APPROVED',
    submittedBy: 'Meineke Corporate',
    submittedByUserId: 'partner_meineke',
    iconName: 'Car',
    imageUrl: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=700&auto=format&fit=crop&q=80',
    logoUrl: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=120&auto=format&fit=crop&q=80',
    redeemedCount: 0,
  },
  {
    id: 'perk_stride_health',
    title: 'Free ACA Healthcare Enrollment & $0 Subsidy Finder',
    category: 'Healthcare',
    provider: 'Stride Health',
    description: 'Find health, dental, and vision insurance plans starting under $10/month with personalized subsidy calculation.',
    valueBadge: 'FREE CONSULT',
    redemptionType: 'LINK',
    redemptionData: 'https://www.stridehealth.com/gigmutual',
    eligibility: 'All gig workers',
    partnerEmail: 'affiliates@stridehealth.com',
    status: 'APPROVED',
    submittedBy: 'Stride Health',
    submittedByUserId: 'partner_stride',
    iconName: 'HeartPulse',
    imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=700&auto=format&fit=crop&q=80',
    logoUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=120&auto=format&fit=crop&q=80',
    redeemedCount: 0,
  },
  {
    id: 'perk_legal_shield',
    title: '25% Off Rideshare & Delivery Legal Defense Plan',
    category: 'Insurance & Roadside',
    provider: 'LegalShield',
    description: 'On-demand traffic ticket defense, accident consultation, and contract review tailored for gig fleet drivers.',
    valueBadge: '25% OFF',
    redemptionType: 'CODE',
    redemptionData: 'GIGLEGAL25',
    eligibility: 'All verified members',
    partnerEmail: 'legal@partnerships.com',
    status: 'APPROVED',
    submittedBy: 'Imagine Legal',
    submittedByUserId: 'partner_imagine',
    iconName: 'ShieldCheck',
    imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=700&auto=format&fit=crop&q=80',
    logoUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=120&auto=format&fit=crop&q=80',
    redeemedCount: 0,
  },
  {
    id: 'perk_gasbuddy_fuel',
    title: '15¢/Gal Cashback on All Fuel Purchases',
    category: 'Gas & Fuel Discounts',
    provider: 'GasBuddy Business',
    description: 'Save up to 15¢ per gallon at over 95% of gas stations nationwide with Pay with GasBuddy card.',
    valueBadge: '15¢/GAL OFF',
    redemptionType: 'LINK',
    redemptionData: 'https://pay.gasbuddy.com/gigmutual',
    eligibility: 'Active delivery riders',
    partnerEmail: 'fleet@gasbuddy.com',
    status: 'APPROVED',
    submittedBy: 'GasBuddy Fleet',
    submittedByUserId: 'partner_gasbuddy',
    iconName: 'Zap',
    imageUrl: 'https://images.unsplash.com/photo-1527018601619-a508a2be00be?w=700&auto=format&fit=crop&q=80',
    logoUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=120&auto=format&fit=crop&q=80',
    redeemedCount: 0,
  },
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

export const INITIAL_CAMPAIGNS: AdCampaign[] = [];

export const INITIAL_CAMPAIGN_SHIFTS: CampaignShiftLog[] = [];


