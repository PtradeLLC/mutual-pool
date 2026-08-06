import { z } from 'zod';
import { 
  KYCStatus, UserRole, GigPlatform, PodStatus, 
  PodSizeTier, DepositTier, DelinquencyStatus,
  ReprioritizationStatus, PerkStatus, PerkCategory,
  PerkRedemptionType
} from '../types';

// User schemas
export const registerUserSchema = z.object({
  displayName: z.string().min(2).max(100),
  email: z.string().email(),
  platform: z.enum(['Uber Eats', 'Lyft', 'DoorDash', 'Instacart', 'Amazon Flex', 'Grubhub', 'Spark']),
  initialDeposit: z.number().min(20).max(5000).optional(),
  autoVerifyKyc: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: z.string().email().optional(),
  userId: z.string().optional(),
}).refine(data => data.email || data.userId, {
  message: 'Either email or userId is required',
});

export const kycVerifySchema = z.object({
  idType: z.enum(['Driver License', 'State ID', 'US Passport']).optional(),
  documentNumber: z.string().optional(),
  fullName: z.string().min(2).max(100),
  ssnLast4: z.string().length(4).regex(/^\d{4}$/),
});

export const bankLinkSchema = z.object({
  bankName: z.string().min(2).max(100),
  accountNumber: z.string().min(4).max(20),
  routingNumber: z.string().length(9).regex(/^\d{9}$/),
  accountType: z.enum(['CHECKING', 'SAVINGS']),
});

export const switchUserSchema = z.object({
  userId: z.string().min(1),
});

// Pod schemas
export const createPodSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  category: z.string().min(2).max(50),
  sizeTier: z.number(),
  depositTier: z.number(),
});

export const joinPodSchema = z.object({});

export const signAgreementSchema = z.object({
  signatureName: z.string().min(2).max(100),
});

export const lockPodSchema = z.object({});

export const depositSchema = z.object({});

export const processCycleSchema = z.object({});

export const reprioritizeRequestSchema = z.object({
  reason: z.string().min(10).max(500),
});

export const reprioritizeVoteSchema = z.object({
  requestId: z.string().min(1),
  vote: z.enum(['FOR', 'AGAINST']),
});

export const swapSlotsSchema = z.object({
  targetMemberUserId: z.string().min(1),
});

// Perk schemas
export const redeemPerkSchema = z.object({
  perkId: z.string().min(1),
});

export const submitPerkSchema = z.object({
  title: z.string().min(3).max(100),
  category: z.enum([
    'Healthcare', 'Dental', 'Vision', 'Retirement', 'Training',
    'Legal Assistance', 'Mental Health', 'Financial Services',
    'Discounts', 'Entertainment', 'Restaurants', 'Hotels',
    'Retail Savings', 'Insurance Programs', 'Scholarships',
    'Family Benefits', 'Emergency Assistance'
  ] as [PerkCategory, ...PerkCategory[]]),
  provider: z.string().min(2).max(100),
  description: z.string().min(10).max(1000),
  valueBadge: z.string().min(2).max(50),
  redemptionType: z.enum(['CODE', 'LINK', 'VOUCHER', 'PARTNER_API'] as [PerkRedemptionType, ...PerkRedemptionType[]]),
  redemptionData: z.string().min(1).max(500),
  eligibility: z.string().max(200).optional(),
});

export const approvePerkSchema = z.object({});

// Admin schemas
export const delinquencyActionSchema = z.object({
  podId: z.string().min(1),
  memberUserId: z.string().min(1),
  actionChoice: z.enum(['GRACE_PERIOD', 'COVER_GAP', 'REMOVE']),
});

export const webhookSchema = z.object({
  eventType: z.string().min(1),
  data: z.record(z.string(), z.any()).optional(),
});

// Audit log query schema
export const auditLogQuerySchema = z.object({
  podId: z.string().optional(),
  action: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
});

// Perks query schema
export const perksQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
});

// Type exports
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type KycVerifyInput = z.infer<typeof kycVerifySchema>;
export type BankLinkInput = z.infer<typeof bankLinkSchema>;
export type SwitchUserInput = z.infer<typeof switchUserSchema>;
export type CreatePodInput = z.infer<typeof createPodSchema>;
export type JoinPodInput = z.infer<typeof joinPodSchema>;
export type SignAgreementInput = z.infer<typeof signAgreementSchema>;
export type LockPodInput = z.infer<typeof lockPodSchema>;
export type DepositInput = z.infer<typeof depositSchema>;
export type ProcessCycleInput = z.infer<typeof processCycleSchema>;
export type ReprioritizeRequestInput = z.infer<typeof reprioritizeRequestSchema>;
export type ReprioritizeVoteInput = z.infer<typeof reprioritizeVoteSchema>;
export type SwapSlotsInput = z.infer<typeof swapSlotsSchema>;
export type RedeemPerkInput = z.infer<typeof redeemPerkSchema>;
export type SubmitPerkInput = z.infer<typeof submitPerkSchema>;
export type ApprovePerkInput = z.infer<typeof approvePerkSchema>;
export type DelinquencyActionInput = z.infer<typeof delinquencyActionSchema>;
export type WebhookInput = z.infer<typeof webhookSchema>;
export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
export type PerksQueryInput = z.infer<typeof perksQuerySchema>;