import { User, Pod, Perk, AuditLogEntry, WeeklyCycle, Deposit, AdCampaign, CampaignShiftLog } from '../types';

export const INITIAL_USERS: User[] = [];


export const INITIAL_PODS: Pod[] = [];

export const INITIAL_PERKS: Perk[] = [
  {
    id: 'perk_stride_health',
    title: 'Free ACA Healthcare Enrollment & $0 Subsidy Finder',
    category: 'Healthcare',
    provider: 'Stride Health',
    description: 'Find health, dental, and vision insurance plans starting under $10/month with personalized subsidy calculation for gig and trade workers.',
    valueBadge: 'FREE CONSULT',
    redemptionType: 'LINK',
    redemptionData: 'https://www.stridehealth.com/gigmutual',
    eligibility: 'All gig and trade workers',
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
    id: 'perk_quickbooks_1099',
    title: '50% Off 1099 Expense Tracking & Tax Automation',
    category: 'Tax & Financial Services',
    provider: 'QuickBooks Self-Employed',
    description: 'Track expenses, categorize write-offs, and automate quarterly estimated taxes for independent contractors and trade professionals.',
    valueBadge: '50% OFF',
    redemptionType: 'LINK',
    redemptionData: 'https://quickbooks.intuit.com/self-employed/gigmutual',
    eligibility: 'All active MutualPool members',
    partnerEmail: 'partnerships@intuit.com',
    status: 'APPROVED',
    submittedBy: 'Intuit Self-Employed',
    submittedByUserId: 'partner_intuit',
    iconName: 'Calculator',
    imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=700&auto=format&fit=crop&q=80',
    logoUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=120&auto=format&fit=crop&q=80',
    redeemedCount: 0,
  },
  {
    id: 'perk_trade_equipment',
    title: 'Trade & Equipment Commercial Coverage Discount',
    category: 'Insurance Programs',
    provider: 'Next Insurance',
    description: 'Affordable commercial general liability and tool/equipment protection policies tailored for independent trade contractors and freelancers.',
    valueBadge: '15% OFF',
    redemptionType: 'CODE',
    redemptionData: 'TRADEMUTUAL15',
    eligibility: 'Verified gig & trade workers',
    partnerEmail: 'trades@nextinsurance.com',
    status: 'APPROVED',
    submittedBy: 'Next Insurance',
    submittedByUserId: 'partner_next',
    iconName: 'ShieldCheck',
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=700&auto=format&fit=crop&q=80',
    logoUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=120&auto=format&fit=crop&q=80',
    redeemedCount: 0,
  },
  {
    id: 'perk_contractor_legal',
    title: 'Contractor Legal & Invoice Dispute Resolution',
    category: 'Legal Assistance',
    provider: 'Freelancers Union Legal',
    description: 'Legal consultations, client contract templates, and unpaid invoice recovery support for gig workers and independent trades.',
    valueBadge: 'FREE REVIEW',
    redemptionType: 'LINK',
    redemptionData: 'https://www.freelancersunion.org/legal/mutual',
    eligibility: 'All verified members',
    partnerEmail: 'advocacy@freelancersunion.org',
    status: 'APPROVED',
    submittedBy: 'Freelancers Guild',
    submittedByUserId: 'partner_freelancers',
    iconName: 'FileText',
    imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=700&auto=format&fit=crop&q=80',
    logoUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=120&auto=format&fit=crop&q=80',
    redeemedCount: 0,
  },
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

export const INITIAL_CAMPAIGNS: AdCampaign[] = [];

export const INITIAL_CAMPAIGN_SHIFTS: CampaignShiftLog[] = [];


