// AI hero campaigns: the rules shared by the server and the app. Pure
// functions, no I/O.
//
// The server discovers current trends, drafts campaign concepts and a hero
// image for the relevant ones, and an administrator approves them (or, once
// explicitly switched on, low-risk campaigns publish themselves). The landing
// page shows the active campaign as the first hero slide and falls back to the
// evergreen hero whenever there is none.

export const HERO_CATEGORIES = [
  'GAMING_ENTERTAINMENT', 'SPORTS', 'MOVIES_MUSIC_STREAMING', 'TECHNOLOGY', 'HOLIDAYS_SEASONAL',
  'LIFESTYLE', 'SHOPPING', 'ENTREPRENEURSHIP', 'CULTURAL_EVENTS',
] as const;
export type HeroCategory = typeof HERO_CATEGORIES[number];

export const HERO_CATEGORY_LABELS: Record<HeroCategory, string> = {
  GAMING_ENTERTAINMENT: 'Gaming and entertainment',
  SPORTS: 'Sports and major sporting events',
  MOVIES_MUSIC_STREAMING: 'Movies, music and streaming',
  TECHNOLOGY: 'Technology and product launches',
  HOLIDAYS_SEASONAL: 'Holidays and seasonal activities',
  LIFESTYLE: 'Lifestyle and consumer trends',
  SHOPPING: 'Shopping and popular products',
  ENTREPRENEURSHIP: 'Entrepreneurship and business trends',
  CULTURAL_EVENTS: 'Major cultural events',
};

// What a campaign may promote. Every campaign names at least one.
export const HERO_SERVICES = [
  'COMMUNITY_SAVINGS', 'SAVINGS_PODS', 'POOLING_TOGETHER', 'SCHEDULED_PAYOUTS', 'FINANCIAL_AWARENESS',
  'SHARED_GOALS', 'CREATOR_POOLS', 'BUSINESS_POOLS', 'PERKS',
] as const;
export type HeroService = typeof HERO_SERVICES[number];

export const HERO_SERVICE_LABELS: Record<HeroService, string> = {
  COMMUNITY_SAVINGS: 'Community-powered savings',
  SAVINGS_PODS: 'Savings Pods',
  POOLING_TOGETHER: 'Pooling money with friends, family and communities',
  SCHEDULED_PAYOUTS: 'Scheduled payouts through savings pools',
  FINANCIAL_AWARENESS: 'Financial awareness and discipline',
  SHARED_GOALS: 'Shared financial goals',
  CREATOR_POOLS: 'Creator Pools',
  BUSINESS_POOLS: 'Business Pools',
  PERKS: 'Perks and benefits',
};

// Where a campaign's button may lead. The app maps each to a real screen, so a
// campaign can never carry a missing or outside link.
export const HERO_CTA_DESTINATIONS = ['START_POD', 'JOIN_POD', 'CREATORS', 'PARTNERS', 'PERKS', 'HOW_IT_WORKS'] as const;
export type HeroCtaDestination = typeof HERO_CTA_DESTINATIONS[number];

export const HERO_CTA_LABELS: Record<HeroCtaDestination, string> = {
  START_POD: 'Sign up / start a pod',
  JOIN_POD: 'Explore pods to join',
  CREATORS: 'Creator Pools page',
  PARTNERS: 'Partners (Business Pools) page',
  PERKS: 'Perks and benefits',
  HOW_IT_WORKS: 'How it works',
};

export type TrendSensitivity = 'LOW' | 'MEDIUM' | 'HIGH';
export type TrendStatus = 'NEW' | 'CAMPAIGN_CREATED' | 'DISMISSED' | 'EXPIRED';

export interface TrendSource {
  title: string;
  url: string;
}

export interface HeroTrend {
  id: string;
  title: string;
  description: string;
  category: HeroCategory;
  sourceName: string;
  sourceUrl: string;
  sources: TrendSource[];
  publishedAt: string | null;
  eventDate: string | null;
  discoveredAt: string;
  region: string;
  popularity: string;
  relevanceScore: number; // 0-100, estimated fit with MutualPool
  relevanceReason: string;
  suggestedExpiresAt: string;
  // Backed by at least one source the search service actually returned.
  verified: boolean;
  sensitivity: TrendSensitivity;
  brandsMentioned: string[];
  dedupeKey: string;
  status: TrendStatus;
}

export interface CampaignConcept {
  title: string;
  headline: string;
  description: string;
  ctaLabel: string;
  ctaDestination: HeroCtaDestination;
  targetAudience: string;
  marketingAngle: string;
  service: HeroService;
  category: HeroCategory;
  suggestedDurationDays: number;
  imagePrompt: string;
}

// The marketing analysis done before any copy is written.
export interface TrendAnalysis {
  whatIsHappening: string;
  whyRelevantNow: string;
  whoIsInterested: string;
  audienceSegment: string;
  connectionToMutualPool: string;
  service: HeroService;
  message: string;
}

export interface CampaignContent {
  label: string;
  headline: string;
  description: string;
  ctaLabel: string;
  ctaDestination: HeroCtaDestination;
  imageAlt: string;
}

export interface PolicyResult {
  // Nothing that blocks publication.
  ok: boolean;
  // Blocks approval and automatic publication.
  issues: string[];
  // Worth a look, does not block.
  warnings: string[];
  // Never published automatically: an administrator must approve.
  requiresManualReview: boolean;
  reviewReasons: string[];
}

export type CampaignStatus = 'DRAFT' | 'APPROVED' | 'PAUSED' | 'REJECTED' | 'RETIRED';

export interface CampaignApproval {
  action: 'GENERATED' | 'EDITED' | 'SLIDE_HIDDEN' | 'SLIDE_SHOWN' | 'REGENERATED_IMAGE' | 'REGENERATED_COPY' | 'APPROVED' | 'AUTO_PUBLISHED' | 'REJECTED' | 'PAUSED' | 'RESUMED' | 'RETIRED' | 'EXPIRED';
  byUserId: string;
  byName: string;
  at: string;
  note?: string;
}

export interface HeroCampaign {
  id: string;
  trendId: string;
  trendTitle: string;
  trendDescription: string;
  trendSourceName: string;
  trendSourceUrl: string;
  category: HeroCategory;
  status: CampaignStatus;
  priority: number; // higher wins when two campaigns are live
  startAt: string;
  endAt: string;
  analysis: TrendAnalysis | null;
  concepts: CampaignConcept[];
  // Every concept is a slide on the hero, each with its own copy and image
  // (index-aligned with `concepts`). The selected concept leads; `content` and
  // `assetId` always mirror the lead slide. Campaigns saved before slides
  // existed are filled in by normalizeCampaignSlides.
  selectedConcept: number;
  content: CampaignContent;
  assetId: string | null;
  imageError?: string;
  slideContent?: CampaignContent[];
  slideAssets?: Array<string | null>;
  slideImageErrors?: Array<string | null>;
  // Slides an administrator took off the hero.
  hiddenSlides?: number[];
  policy: PolicyResult;
  sensitivity: TrendSensitivity;
  brandsMentioned: string[];
  approvals: CampaignApproval[];
  publishedBy?: 'ADMIN' | 'AUTO';
  retiredReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HeroAsset {
  id: string;
  campaignId: string;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
  dataBase64: string;
  prompt: string;
  model: string;
  createdAt: string;
}

export interface PerformanceCounts {
  impressions: number;
  uniqueImpressions: number;
  clicks: number;
  registrations: number;
  podCreations: number;
}

export interface HeroPerformance extends PerformanceCounts {
  id: string; // campaign id
  campaignId: string;
  byDay: Record<string, PerformanceCounts>;
  // Members already counted, so nobody converts twice.
  registeredUserIds: string[];
  podUserIds: string[];
  updatedAt: string;
}

export type PublishMode = 'MANUAL' | 'AUTO';
export type DiscoveryCadence = 'INTERVAL' | 'TWICE_MONTHLY';
export const DEFAULT_MONTHLY_DAYS: [number, number] = [1, 15];
// Scheduled refreshes start at this hour, server time.
export const REFRESH_HOUR = 6;

export interface HeroSettings {
  id: 'settings';
  publishMode: PublishMode;
  // Scheduled discovery. Off until an administrator turns it on.
  discoveryEnabled: boolean;
  // INTERVAL: every discoveryIntervalHours. TWICE_MONTHLY: on two fixed days of
  // the month, with each campaign running until the next of those days.
  discoveryCadence?: DiscoveryCadence;
  monthlyDays?: [number, number];
  discoveryIntervalHours: number;
  categories: HeroCategory[];
  region: string;
  relevanceThreshold: number;
  maxTrendsPerRun: number;
  // Draft campaigns written per discovery run, best trends first.
  campaignsPerRun: number;
  durationDays: Record<HeroCategory, number>;
  defaultPriority: number;
  // Extra words or phrases campaigns may never use.
  blockedTerms: string[];
  autoPublishActivatedAt?: string;
  autoPublishActivatedBy?: string;
  updatedAt: string;
}

export const MAX_CAMPAIGN_DAYS = 30;

export function defaultHeroSettings(nowIso: string): HeroSettings {
  return {
    id: 'settings',
    publishMode: 'MANUAL',
    discoveryEnabled: false,
    discoveryCadence: 'INTERVAL',
    monthlyDays: [...DEFAULT_MONTHLY_DAYS],
    discoveryIntervalHours: 24,
    categories: [...HERO_CATEGORIES],
    region: 'United States',
    relevanceThreshold: 60,
    maxTrendsPerRun: 8,
    campaignsPerRun: 2,
    durationDays: {
      GAMING_ENTERTAINMENT: 10,
      SPORTS: 5,
      MOVIES_MUSIC_STREAMING: 10,
      TECHNOLOGY: 7,
      HOLIDAYS_SEASONAL: 14,
      LIFESTYLE: 14,
      SHOPPING: 7,
      ENTREPRENEURSHIP: 14,
      CULTURAL_EVENTS: 7,
    },
    defaultPriority: 5,
    blockedTerms: [],
    updatedAt: nowIso,
  };
}

const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;

// Applies an administrator's changes to the settings, or says why not.
export function applySettingsPatch(current: HeroSettings, patch: any, nowIso: string): { ok: true; settings: HeroSettings } | { ok: false; message: string } {
  if (!patch || typeof patch !== 'object') return { ok: false, message: 'Settings are required.' };
  const next: HeroSettings = { ...current, durationDays: { ...current.durationDays }, categories: [...current.categories], blockedTerms: [...current.blockedTerms] };
  if (patch.publishMode !== undefined) {
    if (patch.publishMode !== 'MANUAL' && patch.publishMode !== 'AUTO') return { ok: false, message: 'publishMode must be MANUAL or AUTO.' };
    next.publishMode = patch.publishMode;
  }
  if (patch.discoveryEnabled !== undefined) {
    if (typeof patch.discoveryEnabled !== 'boolean') return { ok: false, message: 'discoveryEnabled must be true or false.' };
    next.discoveryEnabled = patch.discoveryEnabled;
  }
  if (patch.discoveryCadence !== undefined) {
    if (patch.discoveryCadence !== 'INTERVAL' && patch.discoveryCadence !== 'TWICE_MONTHLY') return { ok: false, message: 'discoveryCadence must be INTERVAL or TWICE_MONTHLY.' };
    next.discoveryCadence = patch.discoveryCadence;
  }
  if (patch.monthlyDays !== undefined) {
    const days = Array.isArray(patch.monthlyDays) ? patch.monthlyDays.map((d: unknown) => int(d, 1, 28)) : [];
    // 1 to 28 so every month has both days; a week apart so campaigns have time to run.
    if (days.length !== 2 || days[0] === null || days[1] === null || Math.abs(days[0] - days[1]) < 7) {
      return { ok: false, message: 'Choose two days of the month between 1 and 28, at least a week apart.' };
    }
    next.monthlyDays = [Math.min(days[0], days[1]), Math.max(days[0], days[1])];
  }
  const numeric: Array<[keyof HeroSettings, number, number, string]> = [
    ['discoveryIntervalHours', 6, 168, 'Discovery frequency must be 6 to 168 hours.'],
    ['relevanceThreshold', 0, 100, 'Relevance threshold must be 0 to 100.'],
    ['maxTrendsPerRun', 1, 12, 'Trends per run must be 1 to 12.'],
    ['campaignsPerRun', 0, 4, 'Campaigns per run must be 0 to 4.'],
    ['defaultPriority', 1, 10, 'Priority must be 1 to 10.'],
  ];
  for (const [key, min, max, message] of numeric) {
    if (patch[key] === undefined) continue;
    const v = int(patch[key], min, max);
    if (v === null) return { ok: false, message };
    (next as any)[key] = v;
  }
  if (patch.categories !== undefined) {
    if (!Array.isArray(patch.categories) || patch.categories.some((c: unknown) => !(HERO_CATEGORIES as readonly unknown[]).includes(c))) {
      return { ok: false, message: 'Choose categories from the list.' };
    }
    next.categories = HERO_CATEGORIES.filter(c => patch.categories.includes(c));
    if (!next.categories.length) return { ok: false, message: 'Keep at least one trend category on.' };
  }
  if (patch.region !== undefined) {
    if (typeof patch.region !== 'string' || !patch.region.trim() || patch.region.length > 60) return { ok: false, message: 'Region is required (at most 60 characters).' };
    next.region = patch.region.trim();
  }
  if (patch.durationDays !== undefined) {
    if (!patch.durationDays || typeof patch.durationDays !== 'object') return { ok: false, message: 'durationDays must list days per category.' };
    for (const c of HERO_CATEGORIES) {
      if (patch.durationDays[c] === undefined) continue;
      const v = int(patch.durationDays[c], 1, MAX_CAMPAIGN_DAYS);
      if (v === null) return { ok: false, message: `Campaign length must be 1 to ${MAX_CAMPAIGN_DAYS} days.` };
      next.durationDays[c] = v;
    }
  }
  if (patch.blockedTerms !== undefined) {
    if (!Array.isArray(patch.blockedTerms) || patch.blockedTerms.length > 100 || patch.blockedTerms.some((t: unknown) => typeof t !== 'string' || t.length > 60)) {
      return { ok: false, message: 'Blocked terms must be a list of up to 100 short phrases.' };
    }
    next.blockedTerms = Array.from(new Set((patch.blockedTerms as string[]).map(t => t.trim().toLowerCase()).filter(Boolean)));
  }
  next.updatedAt = nowIso;
  return { ok: true, settings: next };
}

// --- Trends ---

const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'for', 'to', 'in', 'on', 'at', 'is', 'are', 'with', 'new', 'this', 'that', 'its', 'as', 'by']);

// Same story, different wording: compare on the significant words.
export function trendDedupeKey(title: string): string {
  return Array.from(new Set(
    String(title || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(w => w && !STOP_WORDS.has(w)),
  )).sort().join(' ');
}

export function isDuplicateTrend(candidate: { dedupeKey: string; sourceUrl?: string }, existing: Array<Pick<HeroTrend, 'dedupeKey' | 'sourceUrl'>>): boolean {
  const words = new Set(candidate.dedupeKey.split(' ').filter(Boolean));
  if (!words.size) return true;
  return existing.some(e => {
    if (candidate.sourceUrl && e.sourceUrl && candidate.sourceUrl === e.sourceUrl) return true;
    const other = e.dedupeKey.split(' ').filter(Boolean);
    if (!other.length) return false;
    const shared = other.filter(w => words.has(w)).length;
    return shared / Math.min(words.size, other.length) >= 0.8 && shared >= Math.min(2, words.size);
  });
}

// Topics an administrator must always look at before anything is published.
const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(death|dead|dies|died|killed|murder|shooting|shot|stabb\w*|suicide|funeral|obituar\w*)\b/i, 'death or violence'],
  [/\b(war|invasion|terror\w*|bomb\w*|hostage\w*|massacre|genocide|riot\w*)\b/i, 'war or violent conflict'],
  [/\b(hurricane|earthquake|wildfire|flood\w*|tornado|tsunami|pandemic|outbreak|crash|disaster)\b/i, 'disaster or emergency'],
  [/\b(election\w*|president\w*|senat\w*|congress\w*|republican\w*|democrat\w*|politic\w*|ballot|campaign rally|immigration|abortion|protest\w*)\b/i, 'politics'],
  [/\b(lawsuit|indict\w*|arrest\w*|scandal|fraud|convicted|trial|allegation\w*)\b/i, 'legal trouble or scandal'],
  [/\b(church|mosque|synagogue|religio\w*|ramadan|easter|diwali|hanukkah|christmas mass)\b/i, 'religion'],
  [/\b(gambl\w*|betting|sportsbook|casino|lottery|powerball|jackpot|poker)\b/i, 'gambling'],
  [/\b(crypto\w*|bitcoin|ethereum|memecoin|nft|stocks?|stock market|forex|day trading)\b/i, 'investing or speculation'],
  [/\b(alcohol|beer|wine|liquor|vape|vaping|cannabis|marijuana|weed|drug\w*)\b/i, 'alcohol or drugs'],
  [/\b(layoffs?|bankrupt\w*|recession|eviction\w*|foreclos\w*|debt crisis)\b/i, 'financial hardship'],
];

export function sensitiveTopics(text: string): string[] {
  return Array.from(new Set(SENSITIVE_PATTERNS.filter(([re]) => re.test(text)).map(([, label]) => label)));
}

// --- Copy policy ---

// Financial promises MutualPool never makes.
const BANNED_CLAIMS: Array<[RegExp, string]> = [
  [/\bguarant\w*/i, 'promises a guarantee'],
  [/\brisk[\s-]?free\b|\bno risk\b|\bzero risk\b/i, 'claims there is no risk'],
  [/\bget rich\b|\bquick cash\b|\beasy money\b|\bfree money\b|\bfast cash\b/i, 'promises easy money'],
  [/\bdouble your\b|\btriple your\b|\bmultiply your\b/i, 'promises to multiply money'],
  [/\b(roi|yield|dividends?|profits?|interest rates?|apy|apr|high returns?|returns? on|earn(s|ing)? returns?|earn(s|ing)? interest)\b/i, 'describes savings as an investment return'],
  [/\b(invest|investing|investment|investor)s?\b/i, 'describes MutualPool as an investment'],
  [/\b(loan|lend|lending|borrow|credit line)s?\b/i, 'describes MutualPool as a loan'],
  [/\b(win|winner|winning|prize|jackpot|lottery|sweepstakes)s?\b/i, 'suggests winning money'],
  [/\bfdic\b|\binsured\b/i, 'makes a deposit-insurance claim'],
  [/\b\d+(\.\d+)?\s?%/i, 'quotes a percentage'],
  [/\$\s?\d/i, 'quotes a dollar amount'],
  [/\b(always|never fail\w*|100 ?percent|certain to|will definitely)\b/i, 'makes an absolute promise'],
];

// Wording that implies a third party is involved with MutualPool.
const AFFILIATION_CLAIMS: Array<[RegExp, string]> = [
  [/\bofficial(ly)?\b/i, 'says "official"'],
  [/\b(sponsor\w*|endors\w*|approved by|certified by|licensed by)\b/i, 'implies sponsorship or endorsement'],
  [/\b(in partnership with|partner(ed|ing)? with|teamed up with|collab\w* with|brought to you by|presented by)\b/i, 'implies a partnership'],
  [/[™®©]/, 'uses a trademark symbol'],
];

// The copy has to be about what MutualPool does.
const MUTUALPOOL_TERMS = /\b(sav(e|es|ed|ing|ings|er|ers)|pool\w*|pods?|mutualpool|together|payouts?|goals?|chip in|contribut\w*|perks?|budget\w*)\b/i;

export const HEADLINE_MIN_WORDS = 3;
export const HEADLINE_MAX_WORDS = 9;
export const LIMITS = { headlineChars: 70, headlineWordsHard: 12, descriptionChars: 220, ctaChars: 28, labelChars: 32, altChars: 160 };

export function wordCount(text: string): number {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

export interface PolicyContext {
  sensitivity: TrendSensitivity;
  brandsMentioned: string[];
  trendText: string;
  trendVerified: boolean;
  blockedTerms: string[];
}

// Checks campaign copy against the brand and financial-communication rules.
// Runs on every draft, every edit and again before anything is published.
export function evaluateCampaignPolicy(content: CampaignContent, ctx: PolicyContext): PolicyResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const reviewReasons: string[] = [];
  const headline = (content.headline || '').trim();
  const description = (content.description || '').trim();
  const cta = (content.ctaLabel || '').trim();
  const copy = `${content.label || ''} ${headline} ${description} ${cta}`;

  if (!headline) issues.push('The headline is empty.');
  if (headline.length > LIMITS.headlineChars || wordCount(headline) > LIMITS.headlineWordsHard) issues.push(`The headline is too long (at most ${LIMITS.headlineWordsHard} words and ${LIMITS.headlineChars} characters).`);
  else if (headline && (wordCount(headline) < HEADLINE_MIN_WORDS || wordCount(headline) > HEADLINE_MAX_WORDS)) warnings.push(`Headlines work best at ${HEADLINE_MIN_WORDS} to ${HEADLINE_MAX_WORDS} words.`);
  if (!description) issues.push('The supporting description is empty.');
  if (description.length > LIMITS.descriptionChars) issues.push(`The description is too long (at most ${LIMITS.descriptionChars} characters).`);
  if (!cta) issues.push('The button label is empty.');
  if (cta.length > LIMITS.ctaChars) issues.push(`The button label is too long (at most ${LIMITS.ctaChars} characters).`);
  if ((content.label || '').length > LIMITS.labelChars) issues.push(`The campaign label is too long (at most ${LIMITS.labelChars} characters).`);
  if (!(HERO_CTA_DESTINATIONS as readonly string[]).includes(content.ctaDestination)) issues.push('The button has no valid destination.');

  for (const [re, why] of BANNED_CLAIMS) if (re.test(copy)) issues.push(`The copy ${why}.`);
  for (const [re, why] of AFFILIATION_CLAIMS) if (re.test(copy)) issues.push(`The copy ${why}, which suggests a third party is affiliated with MutualPool.`);
  for (const term of ctx.blockedTerms) {
    if (term && copy.toLowerCase().includes(term.toLowerCase())) issues.push(`The copy uses a blocked term ("${term}").`);
  }
  if (headline && description && !MUTUALPOOL_TERMS.test(`${headline} ${description}`)) {
    issues.push('The copy does not say what MutualPool offers (saving, pooling, pods, payouts or shared goals).');
  }

  if (!ctx.trendVerified) issues.push('The trend has no verified source.');
  if (ctx.sensitivity !== 'LOW') reviewReasons.push(`The trend was rated ${ctx.sensitivity.toLowerCase()} sensitivity.`);
  const topics = sensitiveTopics(`${ctx.trendText} ${copy}`);
  if (topics.length) reviewReasons.push(`Touches a sensitive topic: ${topics.join(', ')}.`);
  if (ctx.brandsMentioned.length) reviewReasons.push(`Refers to a third-party brand or product: ${ctx.brandsMentioned.slice(0, 5).join(', ')}.`);

  return { ok: issues.length === 0, issues, warnings, requiresManualReview: reviewReasons.length > 0, reviewReasons };
}

// --- Schedule ---

const DAY_MS = 86_400_000;

// How long a campaign runs: the category's length, cut short by the event
// itself (a day after it) and by the trend's own expiry, never over the cap.
// With `runUntil` (the next scheduled refresh) the campaign is meant to hold the
// hero until then, so the category length does not apply; the event and the
// trend's expiry still do.
export function campaignWindow(input: { startAt: Date; category: HeroCategory; settings: Pick<HeroSettings, 'durationDays'>; eventDate?: string | null; suggestedExpiresAt?: string | null; suggestedDurationDays?: number; runUntil?: string | null }): { startAt: string; endAt: string } {
  const start = input.startAt.getTime();
  let days = input.settings.durationDays[input.category] || 7;
  if (input.suggestedDurationDays && input.suggestedDurationDays > 0) days = Math.min(days, Math.ceil(input.suggestedDurationDays));
  let end = start + Math.min(days, MAX_CAMPAIGN_DAYS) * DAY_MS;
  const until = input.runUntil ? new Date(input.runUntil).getTime() : NaN;
  if (Number.isFinite(until) && until > start) end = Math.min(until, start + MAX_CAMPAIGN_DAYS * DAY_MS);
  const bound = (iso?: string | null, padMs = 0) => {
    const t = iso ? new Date(iso).getTime() : NaN;
    if (Number.isFinite(t) && t + padMs > start) end = Math.min(end, t + padMs);
  };
  bound(input.eventDate, DAY_MS);
  bound(input.suggestedExpiresAt);
  if (end - start < DAY_MS) end = start + DAY_MS;
  return { startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() };
}

// --- Scheduled refreshes ---

export function monthlyDaysOf(settings: Pick<HeroSettings, 'monthlyDays'>): [number, number] {
  const d = settings.monthlyDays;
  return Array.isArray(d) && d.length === 2 && d.every(n => Number.isInteger(n) && n >= 1 && n <= 28) ? [Math.min(d[0], d[1]), Math.max(d[0], d[1])] : [...DEFAULT_MONTHLY_DAYS];
}

// The twice-monthly refresh times around `now` (server local time): the most
// recent one at or before it, and the next one after it.
export function refreshSlots(now: Date, days: [number, number]): { previous: Date; next: Date } {
  const slots: Date[] = [];
  for (let m = -1; m <= 1; m += 1) {
    for (const day of days) slots.push(new Date(now.getFullYear(), now.getMonth() + m, day, REFRESH_HOUR, 0, 0, 0));
  }
  slots.sort((a, b) => a.getTime() - b.getTime());
  const previous = [...slots].reverse().find(s => s.getTime() <= now.getTime())!;
  const next = slots.find(s => s.getTime() > now.getTime())!;
  return { previous, next };
}

const RETRY_AFTER_FAILURE_MS = 6 * 3_600_000;

// Whether scheduled discovery should run now. `runs`: earlier discovery runs.
export function scheduledDiscoveryDue(settings: HeroSettings, now: Date, runs: Array<{ at: string; ok: boolean }>): boolean {
  if (!settings.discoveryEnabled) return false;
  const times = runs.map(r => ({ t: new Date(r.at).getTime(), ok: r.ok })).filter(r => Number.isFinite(r.t));
  const lastAttempt = times.reduce((max, r) => Math.max(max, r.t), 0);
  if (settings.discoveryCadence === 'TWICE_MONTHLY') {
    const slot = refreshSlots(now, monthlyDaysOf(settings)).previous.getTime();
    // Done for this period once a run has succeeded since the refresh time.
    if (times.some(r => r.ok && r.t >= slot)) return false;
    // A failed attempt is retried, but not every few minutes.
    return !lastAttempt || now.getTime() - lastAttempt >= RETRY_AFTER_FAILURE_MS;
  }
  return !lastAttempt || now.getTime() - lastAttempt >= settings.discoveryIntervalHours * 3_600_000;
}

// When the next scheduled refresh will happen, or null when scheduling is off.
export function nextScheduledRefresh(settings: HeroSettings, now: Date, runs: Array<{ at: string; ok: boolean }>): string | null {
  if (!settings.discoveryEnabled) return null;
  if (scheduledDiscoveryDue(settings, now, runs)) return now.toISOString();
  if (settings.discoveryCadence === 'TWICE_MONTHLY') return refreshSlots(now, monthlyDaysOf(settings)).next.toISOString();
  const last = runs.reduce((max, r) => Math.max(max, new Date(r.at).getTime() || 0), 0);
  return new Date(last + settings.discoveryIntervalHours * 3_600_000).toISOString();
}

export function scheduleProblem(startAt: unknown, endAt: unknown, now: Date): string | null {
  const s = typeof startAt === 'string' ? new Date(startAt).getTime() : NaN;
  const e = typeof endAt === 'string' ? new Date(endAt).getTime() : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 'Start and end dates are required.';
  if (e <= s) return 'The end date must be after the start date.';
  if (e <= now.getTime()) return 'The end date has already passed.';
  if (e - s > MAX_CAMPAIGN_DAYS * DAY_MS) return `A campaign can run for at most ${MAX_CAMPAIGN_DAYS} days.`;
  return null;
}

export type LiveState = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'REJECTED' | 'RETIRED' | 'EXPIRED';

export function liveState(c: Pick<HeroCampaign, 'status' | 'startAt' | 'endAt'>, now: Date): LiveState {
  if (c.status !== 'APPROVED') return c.status;
  const t = now.getTime();
  if (t >= new Date(c.endAt).getTime()) return 'EXPIRED';
  return t < new Date(c.startAt).getTime() ? 'SCHEDULED' : 'LIVE';
}

// The campaign the hero shows now: approved, inside its dates, with an image.
// Highest priority first, then the most recently started.
export function pickActiveCampaign<T extends Pick<HeroCampaign, 'status' | 'startAt' | 'endAt' | 'priority' | 'assetId' | 'policy'>>(campaigns: T[], now: Date): T | null {
  const live = campaigns.filter(c => c && liveState(c, now) === 'LIVE' && c.assetId && c.policy?.ok);
  if (!live.length) return null;
  return live.sort((a, b) => b.priority - a.priority || new Date(b.startAt).getTime() - new Date(a.startAt).getTime())[0];
}

// --- Performance ---

export const emptyCounts = (): PerformanceCounts => ({ impressions: 0, uniqueImpressions: 0, clicks: 0, registrations: 0, podCreations: 0 });

export function clickThroughRate(c: PerformanceCounts): number {
  return c.impressions > 0 ? c.clicks / c.impressions : 0;
}

// One number to compare campaigns by. Sign-ups and pods started count for far
// more than clicks, so a clickbait headline does not come out on top.
export const ENGAGEMENT_WEIGHTS = { click: 1, registration: 12, podCreation: 30 };
export function engagementScore(c: PerformanceCounts): number {
  if (c.impressions <= 0) return 0;
  const points = c.clicks * ENGAGEMENT_WEIGHTS.click + c.registrations * ENGAGEMENT_WEIGHTS.registration + c.podCreations * ENGAGEMENT_WEIGHTS.podCreation;
  return Math.round((points / c.impressions) * 1000) / 10; // points per 100 impressions
}

export function addCounts(a: PerformanceCounts, b: PerformanceCounts): PerformanceCounts {
  return {
    impressions: a.impressions + b.impressions,
    uniqueImpressions: a.uniqueImpressions + b.uniqueImpressions,
    clicks: a.clicks + b.clicks,
    registrations: a.registrations + b.registrations,
    podCreations: a.podCreations + b.podCreations,
  };
}

// --- Cleaning model output ---

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

// One concept from the model, or null when it is unusable.
export function sanitizeConcept(raw: any, fallbackCategory: HeroCategory): CampaignConcept | null {
  if (!raw || typeof raw !== 'object') return null;
  const headline = clean(raw.headline, 200).replace(/^["“]|["”]$/g, '');
  const description = clean(raw.description, 600);
  const ctaLabel = clean(raw.ctaLabel, 80);
  const imagePrompt = clean(raw.imagePrompt, 1200);
  if (!headline || !description || !ctaLabel || !imagePrompt) return null;
  const service = (HERO_SERVICES as readonly string[]).includes(raw.service) ? raw.service as HeroService : null;
  const destination = (HERO_CTA_DESTINATIONS as readonly string[]).includes(raw.ctaDestination) ? raw.ctaDestination as HeroCtaDestination : null;
  if (!service || !destination) return null;
  const days = Number(raw.suggestedDurationDays);
  return {
    title: clean(raw.title, 120) || headline,
    headline,
    description,
    ctaLabel,
    ctaDestination: destination,
    targetAudience: clean(raw.targetAudience, 200),
    marketingAngle: clean(raw.marketingAngle, 300),
    service,
    category: (HERO_CATEGORIES as readonly string[]).includes(raw.category) ? raw.category as HeroCategory : fallbackCategory,
    suggestedDurationDays: Number.isFinite(days) && days >= 1 ? Math.min(MAX_CAMPAIGN_DAYS, Math.round(days)) : 7,
    imagePrompt,
  };
}

export function contentFromConcept(concept: CampaignConcept, label: string): CampaignContent {
  return {
    label: label.slice(0, LIMITS.labelChars),
    headline: concept.headline,
    description: concept.description,
    ctaLabel: concept.ctaLabel,
    ctaDestination: concept.ctaDestination,
    imageAlt: `${concept.title}: ${concept.targetAudience || 'people saving together'}`.slice(0, LIMITS.altChars),
  };
}

// Added to every image prompt, whatever the model wrote.
export const IMAGE_STYLE_RULES = [
  'High-quality cinematic marketing photograph or illustration, wide 16:9 landscape composition with one clear focal point.',
  'Keep the lower third of the frame darker and uncluttered so white text can sit over it.',
  'Entirely original imagery. No text, letters, numbers, captions, logos, brand marks, watermarks or signatures anywhere.',
  'Do not depict real people, celebrities, athletes, fictional characters, team uniforms, game or film artwork, product packaging or any trademarked design.',
  'Everyday adults in plain unbranded clothing; warm, optimistic, inclusive mood. No cash piles, no gambling, no luxury excess.',
].join(' ');

export function buildImagePrompt(conceptPrompt: string, brands: string[]): string {
  let prompt = conceptPrompt;
  // Brand names in a prompt pull the image toward protected artwork.
  for (const brand of brands) {
    if (brand && brand.length >= 3) prompt = prompt.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'the event');
  }
  return `${prompt.trim()} ${IMAGE_STYLE_RULES}`;
}

// --- Slides ---

// Fills in the per-slide fields (for campaigns saved before every concept had
// its own slide) and keeps `content` / `assetId` in step with the lead slide.
export function normalizeCampaignSlides(c: HeroCampaign, labelFallback = 'Trending now'): HeroCampaign {
  const n = c.concepts.length;
  const lead = Number.isInteger(c.selectedConcept) && c.selectedConcept >= 0 && c.selectedConcept < n ? c.selectedConcept : 0;
  c.selectedConcept = lead;
  const label = c.content?.label ?? labelFallback;
  const content = Array.isArray(c.slideContent) ? c.slideContent : [];
  const assets = Array.isArray(c.slideAssets) ? c.slideAssets : [];
  const errors = Array.isArray(c.slideImageErrors) ? c.slideImageErrors : [];
  const fresh = !Array.isArray(c.slideContent);
  c.slideContent = c.concepts.map((concept, i) => content[i] || (fresh && i === lead && c.content ? c.content : contentFromConcept(concept, label)));
  c.slideAssets = c.concepts.map((_, i) => (assets[i] !== undefined ? assets[i] : fresh && i === lead ? c.assetId : null) || null);
  c.slideImageErrors = c.concepts.map((_, i) => errors[i] ?? (fresh && i === lead ? c.imageError ?? null : null));
  c.hiddenSlides = Array.from(new Set((c.hiddenSlides || []).filter(i => Number.isInteger(i) && i >= 0 && i < n && i !== lead))).sort((a, b) => a - b);
  c.content = c.slideContent[lead];
  c.assetId = c.slideAssets[lead];
  if (c.slideImageErrors[lead]) c.imageError = c.slideImageErrors[lead]!;
  else delete c.imageError;
  return c;
}

// The order slides appear on the hero: the lead first, then the rest in order.
export function slideOrder(c: Pick<HeroCampaign, 'concepts' | 'selectedConcept'>): number[] {
  return [c.selectedConcept, ...c.concepts.map((_, i) => i).filter(i => i !== c.selectedConcept)];
}

export interface PublicHeroSlide {
  index: number;
  label: string;
  headline: string;
  description: string;
  ctaLabel: string;
  ctaDestination: HeroCtaDestination;
  imageUrl: string;
  imageAlt: string;
}

// What the landing page receives. Nothing internal.
export interface PublicHeroCampaign {
  id: string;
  endAt: string;
  // In display order, lead first. Only slides that pass the copy rules, have
  // an image and are not hidden.
  slides: PublicHeroSlide[];
}
