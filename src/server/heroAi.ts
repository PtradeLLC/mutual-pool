// AI calls for hero campaigns: trend discovery, marketing analysis and copy,
// and the hero image. One provider interface with two implementations:
//
//   gemini  The app's existing Gemini integration (@google/genai): Google
//           Search grounding for trends, a structured call for copy, and an
//           image model for the picture. Needs GEMINI_API_KEY on a paid plan
//           (search grounding and image generation have no free quota).
//   groq    Copy only (GROQ_API_KEY): writes the analysis and concepts when
//           Gemini cannot. It has no web search, so it never discovers trends.
//   runway  Images only (RUNWAY_API_KEY): makes the picture when Gemini cannot.
//   stub    Fixed, offline output for tests and local development. Selected
//           with HERO_AI_PROVIDER=stub and never available in production.
//
// Copy and images each try their providers in order and move to the next when
// one fails. Gemini goes first unless HERO_TEXT_PROVIDER / HERO_IMAGE_PROVIDER
// names another. Trend discovery needs search, so it is Gemini only.
//
// Every function either returns clean data or throws; callers record the
// failure and the hero keeps showing what it showed before.

import { GoogleGenAI, Type } from '@google/genai';
import Groq from 'groq-sdk';
import {
  HERO_CATEGORIES, HERO_CATEGORY_LABELS, HERO_SERVICES, HERO_SERVICE_LABELS, HERO_CTA_DESTINATIONS, HERO_CTA_LABELS,
  HEADLINE_MIN_WORDS, HEADLINE_MAX_WORDS, LIMITS, sanitizeConcept,
} from '../lib/heroCampaigns';
import { PRODUCT_FACTS } from '../lib/heroCampaigns';
import type { HeroCategory, HeroService, HeroSettings, HeroTrend, CampaignConcept, CampaignContent, TrendAnalysis, TrendSensitivity, TrendSource, FactCheck } from '../lib/heroCampaigns';

export type DiscoveredTrend = Omit<HeroTrend, 'id' | 'discoveredAt' | 'dedupeKey' | 'status'>;

export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
  model: string;
}

export interface HeroAiProvider {
  name: string;
  discoverTrends(settings: HeroSettings, now: Date): Promise<DiscoveredTrend[]>;
  generateConcepts(trend: HeroTrend, settings: HeroSettings): Promise<{ analysis: TrendAnalysis; concepts: CampaignConcept[] }>;
  generateImage(prompt: string): Promise<GeneratedImage>;
  // Checks each slide's copy against PRODUCT_FACTS (index-aligned results).
  factCheck(copies: CampaignContent[]): Promise<FactCheck[]>;
}

const TEXT_MODEL = () => process.env.HERO_TEXT_MODEL || 'gemini-3.7-flash';
const IMAGE_MODEL = () => process.env.HERO_IMAGE_MODEL || 'gemini-3.1-flash-image';
const AI_TIMEOUT_MS = 120_000;

const GROQ_MODEL = () => process.env.HERO_GROQ_MODEL || 'openai/gpt-oss-120b';
const RUNWAY_MODEL = 'gen4_image';

// Providers in the order they are tried: the preferred one (from the env
// variable) first, then the rest; only those with a key.
function providerOrder(preferred: string | undefined, available: Array<[string, boolean]>): string[] {
  const names = available.filter(([, has]) => has).map(([name]) => name);
  const first = (preferred || '').trim().toLowerCase();
  return names.includes(first) ? [first, ...names.filter(n => n !== first)] : names;
}
const copyProviders = () => providerOrder(process.env.HERO_TEXT_PROVIDER, [['gemini', Boolean(process.env.GEMINI_API_KEY)], ['groq', Boolean(process.env.GROQ_API_KEY)]]);
const imageProviders = () => providerOrder(process.env.HERO_IMAGE_PROVIDER, [['gemini', Boolean(process.env.GEMINI_API_KEY)], ['runway', Boolean(process.env.RUNWAY_API_KEY)]]);

export interface HeroAiStatus {
  provider: string;
  // Copy and images can both be produced.
  configured: boolean;
  // Trends can be searched for (needs Gemini).
  discovery: boolean;
  textModel: string;
  imageModel: string;
}

export function heroAiStatus(isProduction: boolean): HeroAiStatus {
  if (!isProduction && process.env.HERO_AI_PROVIDER === 'stub') return { provider: 'stub', configured: true, discovery: true, textModel: 'stub', imageModel: 'stub' };
  const copy = copyProviders();
  const image = imageProviders();
  const modelOf = (name: string) => (name === 'gemini' ? TEXT_MODEL() : name === 'groq' ? GROQ_MODEL() : name);
  const imageModelOf = (name: string) => (name === 'gemini' ? IMAGE_MODEL() : name === 'runway' ? `runway ${RUNWAY_MODEL}` : name);
  const configured = copy.length > 0 && image.length > 0;
  return {
    provider: configured ? `copy: ${copy.join(' then ')}; images: ${image.join(' then ')}` : 'none',
    configured,
    discovery: Boolean(process.env.GEMINI_API_KEY),
    textModel: copy.map(modelOf).join(' then ') || 'none',
    imageModel: image.map(imageModelOf).join(' then ') || 'none',
  };
}

// A provider that just failed for lack of credit is not asked again for a while.
const benched = new Map<string, number>();
const BENCH_MS = 6 * 3_600_000;
const isBillingFailure = (err: unknown) => /quota|RESOURCE_EXHAUSTED|credits|billing|payment|insufficient|\b40[23]\b|\b429\b/i.test(String((err as any)?.message || err));

async function firstThatWorks<T>(kind: string, names: string[], run: (name: string) => Promise<T>): Promise<T> {
  if (!names.length) throw new Error(`No AI provider is configured for ${kind}.`);
  const now = Date.now();
  // Benched providers go last rather than being skipped: one of them may be all there is.
  const ordered = [...names.filter(n => (benched.get(`${kind}:${n}`) || 0) <= now), ...names.filter(n => (benched.get(`${kind}:${n}`) || 0) > now)];
  const failures: string[] = [];
  for (const name of ordered) {
    try {
      const result = await run(name);
      benched.delete(`${kind}:${name}`);
      return result;
    } catch (err) {
      if (isBillingFailure(err)) benched.set(`${kind}:${name}`, now + BENCH_MS);
      failures.push(`${name}: ${describeAiError(err)}`);
      console.warn(`[hero] ${kind} via ${name} failed:`, describeAiError(err));
    }
  }
  throw new Error(failures.length === 1 ? failures[0].replace(/^[a-z]+: /, '') : `Every provider failed. ${failures.join(' | ')}`);
}

export function getHeroAiProvider(isProduction: boolean): HeroAiProvider | null {
  const status = heroAiStatus(isProduction);
  if (status.provider === 'stub') return stubProvider;
  if (!status.configured && !status.discovery) return null;
  const gemini = geminiProvider();
  return {
    name: status.provider,
    discoverTrends(settings, now) {
      if (!status.discovery) throw new Error('Finding trends needs web search, which only Gemini provides here. Set GEMINI_API_KEY, or add a trend yourself.');
      return gemini.discoverTrends(settings, now);
    },
    generateConcepts(trend, settings) {
      return firstThatWorks('copy', copyProviders(), name => (name === 'groq' ? groqConcepts(trend, settings) : gemini.generateConcepts(trend, settings)));
    },
    generateImage(prompt) {
      return firstThatWorks('images', imageProviders(), name => (name === 'runway' ? runwayImage(prompt) : gemini.generateImage(prompt)));
    },
    factCheck(copies) {
      return firstThatWorks('copy', copyProviders(), name => (name === 'groq' ? groqFactCheck(copies) : gemini.factCheck(copies)));
    },
  };
}

// --- Fact check ---

function factCheckPrompt(copies: CampaignContent[]): string {
  return `You check marketing copy for MutualPool against the facts below. Flag only clear claims or promises about MutualPool that the facts do not support: invented features, rewards, perks, extras, events, partnerships, or a plainly wrong description of how pods work. Read the copy fairly: when wording has an accurate reading, it is supported. In particular, saving with friends "to buy", "to fund" or "for" something is accurate, because each member uses their own payout for their own purchase; flag a shared fund only when the copy says the group buys one thing together or everyone gets the money at once. General encouragement and urgency ("save together", "reach your goal", "start now") is fine. Ignore style and tone.\n\n${PRODUCT_FACTS}\n\nCOPY TO CHECK:\n${copies.map((c, i) => `${i}. Headline: ${c.headline}\n   Description: ${c.description}\n   Button: ${c.ctaLabel}`).join('\n')}\n\nFor every item, in order, return {"index": n, "supported": true|false, "unsupportedClaims": ["each unsupported claim, quoted or briefly described"]}.`;
}

export function normalizeFactChecks(raw: any, count: number, model: string): FactCheck[] {
  const list: any[] = Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
  const at = new Date().toISOString();
  return Array.from({ length: count }, (_, i) => {
    const r = list.find(x => Number(x?.index) === i) ?? list[i];
    if (!r || typeof r.supported !== 'boolean') return { status: 'UNCHECKED', claims: [], checkedAt: at, model };
    const claims = (Array.isArray(r.unsupportedClaims) ? r.unsupportedClaims : []).map((c: unknown) => clean(c, 160)).filter(Boolean).slice(0, 5);
    // Supported only when the checker says so and lists nothing against it.
    return { status: r.supported && !claims.length ? 'PASSED' : 'FAILED', claims: r.supported ? claims : (claims.length ? claims : ['Describes something MutualPool does not offer.']), checkedAt: at, model };
  });
}

async function groqFactCheck(copies: CampaignContent[]): Promise<FactCheck[]> {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set.');
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: AI_TIMEOUT_MS, maxRetries: 1 });
  const response = await groqClient.chat.completions.create({
    model: GROQ_MODEL(),
    messages: [{ role: 'user', content: `${factCheckPrompt(copies)}\n\nReply with one JSON object and nothing else: {"results":[{"index":0,"supported":true,"unsupportedClaims":[]}]}` }],
    response_format: { type: 'json_object' },
  });
  return normalizeFactChecks(parseJson(response.choices?.[0]?.message?.content || undefined), copies.length, GROQ_MODEL());
}

// A short, safe description of a provider failure for the admin screen.
export function describeAiError(err: unknown): string {
  let message = String((err as any)?.message || err || 'Unknown error');
  try {
    const parsed = JSON.parse(message);
    if (parsed?.error?.message) message = `${parsed.error.status || parsed.error.code || 'ERROR'}: ${parsed.error.message}`;
  } catch {
    // not JSON
  }
  if (/prepayment credits are depleted/i.test(message)) return 'Gemini refused the request: the prepaid credits for this API key are used up.';
  if (/quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(message)) {
    return 'The AI provider refused the request: quota exceeded. Google Search grounding and image generation need a Gemini API key with billing enabled.';
  }
  return message.replace(/\s+/g, ' ').slice(0, 300);
}

// --- Shared cleaning ---

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const isoOrNull = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

// Turns the model's trend list into records. A trend is verified only when it
// points at a source the search service itself returned; the model cannot
// invent one.
export function normalizeTrends(raw: any, sources: TrendSource[], settings: HeroSettings, now: Date): DiscoveredTrend[] {
  const list: any[] = Array.isArray(raw?.trends) ? raw.trends : [];
  const out: DiscoveredTrend[] = [];
  for (const t of list) {
    const title = clean(t?.title, 160);
    const description = clean(t?.description, 600);
    if (!title || !description) continue;
    const category = (HERO_CATEGORIES as readonly string[]).includes(t?.category) ? t.category as HeroCategory : null;
    if (!category || !settings.categories.includes(category)) continue;
    const indexes: number[] = (Array.isArray(t?.sourceIndexes) ? t.sourceIndexes : [])
      .map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n >= 1 && n <= sources.length);
    const cited = Array.from(new Set(indexes)).map(n => sources[n - 1]).slice(0, 5);
    const publishedAt = isoOrNull(t?.publishedAt);
    const eventDate = isoOrNull(t?.eventDate);
    // Old news is not a trend.
    if (publishedAt && now.getTime() - new Date(publishedAt).getTime() > 21 * 86_400_000 && !(eventDate && new Date(eventDate).getTime() > now.getTime())) continue;
    const fallbackExpiry = new Date(now.getTime() + settings.durationDays[category] * 86_400_000).toISOString();
    const expires = isoOrNull(t?.suggestedExpiresAt);
    const sensitivity: TrendSensitivity = t?.sensitivity === 'HIGH' || t?.sensitivity === 'MEDIUM' ? t.sensitivity : t?.sensitivity === 'LOW' ? 'LOW' : 'MEDIUM';
    const score = Number(t?.relevanceScore);
    out.push({
      title,
      description,
      category,
      sourceName: cited[0]?.title || '',
      sourceUrl: cited[0]?.url || '',
      sources: cited,
      publishedAt,
      eventDate,
      region: clean(t?.region, 60) || settings.region,
      popularity: clean(t?.popularity, 200),
      relevanceScore: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
      relevanceReason: clean(t?.relevanceReason, 400),
      suggestedExpiresAt: expires && new Date(expires).getTime() > now.getTime() ? expires : fallbackExpiry,
      verified: cited.length > 0,
      // A speculative item is never treated as low risk.
      sensitivity: t?.speculative === true && sensitivity === 'LOW' ? 'MEDIUM' : sensitivity,
      brandsMentioned: (Array.isArray(t?.brandsMentioned) ? t.brandsMentioned : []).map((b: unknown) => clean(b, 60)).filter(Boolean).slice(0, 8),
    });
  }
  return out.slice(0, settings.maxTrendsPerRun);
}

export function normalizeConcepts(raw: any, trend: HeroTrend): { analysis: TrendAnalysis; concepts: CampaignConcept[] } {
  const a = raw?.analysis || {};
  const service = (HERO_SERVICES as readonly string[]).includes(a.service) ? a.service as HeroService : 'SAVINGS_PODS';
  const analysis: TrendAnalysis = {
    whatIsHappening: clean(a.whatIsHappening, 500),
    whyRelevantNow: clean(a.whyRelevantNow, 500),
    whoIsInterested: clean(a.whoIsInterested, 300),
    audienceSegment: clean(a.audienceSegment, 200),
    connectionToMutualPool: clean(a.connectionToMutualPool, 600),
    service,
    message: clean(a.message, 400),
  };
  const concepts = (Array.isArray(raw?.concepts) ? raw.concepts : [])
    .map((c: any) => sanitizeConcept(c, trend.category))
    .filter((c: CampaignConcept | null): c is CampaignConcept => Boolean(c));
  return { analysis, concepts };
}

// --- Gemini ---

let client: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set.');
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: AI_TIMEOUT_MS } });
  return client;
}

// What the AI may say about MutualPool: the shared fact sheet (src/lib/heroCampaigns.ts).
const BRAND_BRIEF = `MutualPool is a community savings app.\n\n${PRODUCT_FACTS}`;

function trendJsonSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      trends: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING, enum: [...HERO_CATEGORIES] },
            sourceIndexes: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            publishedAt: { type: Type.STRING },
            eventDate: { type: Type.STRING },
            region: { type: Type.STRING },
            popularity: { type: Type.STRING },
            relevanceScore: { type: Type.INTEGER },
            relevanceReason: { type: Type.STRING },
            suggestedExpiresAt: { type: Type.STRING },
            sensitivity: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'] },
            speculative: { type: Type.BOOLEAN },
            brandsMentioned: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['title', 'description', 'category', 'sourceIndexes', 'relevanceScore', 'relevanceReason', 'sensitivity', 'speculative', 'brandsMentioned'],
        },
      },
    },
    required: ['trends'],
  };
}

function conceptJsonSchema() {
  const text = { type: Type.STRING };
  return {
    type: Type.OBJECT,
    properties: {
      analysis: {
        type: Type.OBJECT,
        properties: {
          whatIsHappening: text, whyRelevantNow: text, whoIsInterested: text, audienceSegment: text, connectionToMutualPool: text,
          service: { type: Type.STRING, enum: [...HERO_SERVICES] },
          message: text,
        },
        required: ['whatIsHappening', 'whyRelevantNow', 'whoIsInterested', 'audienceSegment', 'connectionToMutualPool', 'service', 'message'],
      },
      concepts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: text, headline: text, description: text, ctaLabel: text,
            ctaDestination: { type: Type.STRING, enum: [...HERO_CTA_DESTINATIONS] },
            targetAudience: text, marketingAngle: text,
            service: { type: Type.STRING, enum: [...HERO_SERVICES] },
            category: { type: Type.STRING, enum: [...HERO_CATEGORIES] },
            suggestedDurationDays: { type: Type.INTEGER },
            imagePrompt: text,
          },
          required: ['title', 'headline', 'description', 'ctaLabel', 'ctaDestination', 'targetAudience', 'marketingAngle', 'service', 'category', 'suggestedDurationDays', 'imagePrompt'],
        },
      },
    },
    required: ['analysis', 'concepts'],
  };
}

function conceptPrompt(trend: HeroTrend, settings: HeroSettings): string {
  return `${BRAND_BRIEF}\n\nYou are MutualPool's marketing strategist. Write hero-banner campaign concepts that tie a current trend to MutualPool.\n\nTREND\nTitle: ${trend.title}\nWhat: ${trend.description}\nCategory: ${HERO_CATEGORY_LABELS[trend.category]}\nRegion: ${trend.region}\nEvent date: ${trend.eventDate || 'n/a'}\nBrands named: ${trend.brandsMentioned.join(', ') || 'none'}\n\nFirst, the analysis: what is happening, why it matters now, who cares, which audience segment, how it connects naturally to MutualPool, which one service fits best, and the message that would land.\n\nThen write 4 different concepts (different angle or audience each). For each:\n- headline: ${HEADLINE_MIN_WORDS} to ${HEADLINE_MAX_WORDS} words, plain mainstream language, positive, with an emotional or practical benefit.\n- description: one or two sentences, at most ${LIMITS.descriptionChars} characters, that say what MutualPool lets people do (save the same amount each week with people they trust and take turns receiving the whole pot, so each person reaches their own goal) and invite them in.\n- ctaLabel: at most ${LIMITS.ctaChars} characters. ctaDestination: ${HERO_CTA_DESTINATIONS.map(d => `${d} (${HERO_CTA_LABELS[d]})`).join('; ')}.\n- service: one of ${HERO_SERVICES.map(s => `${s} (${HERO_SERVICE_LABELS[s]})`).join('; ')}.\n- suggestedDurationDays: how long this stays timely.\n- imagePrompt: a scene for an original photograph or illustration that carries the theme through setting, light and mood. Ordinary people, plain clothing. Never name or depict brands, logos, characters, celebrities, team kits, game or film artwork, or any text.\n\nHard rules for the copy:\n- Describe ONLY what the fact sheet above says MutualPool offers. Never invent features, rewards, perks, extras, events or ways of using a pod. If the only link to the trend would need something MutualPool does not offer, use a different angle.\n- Describe pods correctly: each member puts in the same amount every week and receives the whole pot once, on their own turn. A pod is not a shared fund for one group purchase, party or trip.\n- Perks are only everyday discounts for workers on the road; never tie perks to games, creators, saving or playing.\n- The trend is the hook; MutualPool's service is the point. Never just attach the brand name to an unrelated headline.\n- Never say or imply MutualPool is official, a sponsor, a partner of, or endorsed by anyone named in the trend. Prefer describing the moment ("the big game", "launch day") over naming a brand.\n- No promises: no "guaranteed", "risk-free", "win", "earn", "returns", "profit", "invest", "loan", "interest", no percentages, no dollar amounts, nothing that promises a payout or financial success.\n- Do not use: ${settings.blockedTerms.join(', ') || '(no extra blocked terms)'}.`;
}

function parseJson(text: string | undefined): any {
  if (!text) throw new Error('The model returned no content.');
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(trimmed);
}

// Search results come back as redirect links; keep the page's real address
// when it can be resolved quickly.
async function resolveSourceUrl(url: string): Promise<string> {
  if (!/grounding-api-redirect|vertexaisearch/.test(url)) return url;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    clearTimeout(timer);
    return res.url && /^https?:\/\//.test(res.url) ? res.url : url;
  } catch {
    return url;
  }
}

function geminiProvider(): HeroAiProvider {
  return {
    name: 'gemini',

    async discoverTrends(settings, now) {
      const today = now.toISOString().slice(0, 10);
      const categories = settings.categories.map(c => `- ${HERO_CATEGORY_LABELS[c]}`).join('\n');
      // Step 1: search. The sources come from the search service, not the model.
      const search = await gemini().models.generateContent({
        model: TEXT_MODEL(),
        contents: `Today is ${today}. Use Google Search to find what people in ${settings.region} are talking about right now or will be in the next two weeks, in these areas:\n${categories}\n\nList up to ${settings.maxTrendsPerRun + 4} distinct items. For each give: a short title, two sentences on what is happening and why it matters now, when it was reported, the date of the event or release if there is one, and any sign of how popular it is. ${settings.discoveryCadence === 'TWICE_MONTHLY' ? 'The result will be featured for about two weeks, so prefer things that stay timely that long (a season, an upcoming holiday, a multi-week event, a release with a long tail) over one-day news. ' : ''}Only include things you found in current search results. Skip rumours, leaks and anything you cannot date. Skip tragedies, crime, politics and disasters.`,
        config: { tools: [{ googleSearch: {} }] },
      });
      const candidate: any = search.candidates?.[0];
      const chunks: any[] = candidate?.groundingMetadata?.groundingChunks || [];
      const rawSources: TrendSource[] = chunks
        .map(c => ({ title: clean(c?.web?.title, 120), url: typeof c?.web?.uri === 'string' ? c.web.uri : '' }))
        .filter(s => /^https?:\/\//.test(s.url));
      const findings = search.text || '';
      if (!findings.trim() || !rawSources.length) throw new Error('Trend search returned no sourced results.');
      const sources = await Promise.all(rawSources.slice(0, 40).map(async s => ({ ...s, url: await resolveSourceUrl(s.url) })));

      // Step 2: structure and score, citing only the numbered sources above.
      const structured = await gemini().models.generateContent({
        model: TEXT_MODEL(),
        contents: `${BRAND_BRIEF}\n\nToday is ${today}. Below are search findings and the numbered sources they came from. Turn them into a JSON list of trends.\n\nRules:\n- Use only what the findings say. Do not add facts, dates or numbers.\n- sourceIndexes: the numbers of the sources that support the item. Leave it empty if none clearly does.\n- Dates in ISO 8601. Leave publishedAt or eventDate empty when unknown.\n- relevanceScore 0-100: how naturally this connects to people saving up together for something (a purchase, a trip, an event, a shared goal, a business, a season of spending). Score low when the only link would be inserting the brand name.\n- sensitivity: HIGH for tragedy, crime, politics, religion, health scares, gambling, alcohol or drugs, investing or anything divisive; MEDIUM when unsure; LOW only for plainly positive mainstream topics.\n- speculative: true for rumours, leaks or unconfirmed reports.\n- brandsMentioned: every company, product, franchise, team, league, show, artist or celebrity named.\n- suggestedExpiresAt: when the topic stops being timely.\n- category: one of ${HERO_CATEGORIES.join(', ')}.\n\nSOURCES:\n${sources.map((s, i) => `${i + 1}. ${s.title || 'source'} (${s.url.slice(0, 120)})`).join('\n')}\n\nFINDINGS:\n${findings.slice(0, 12_000)}`,
        config: { responseMimeType: 'application/json', responseSchema: trendJsonSchema() },
      });
      return normalizeTrends(parseJson(structured.text), sources, settings, now);
    },

    async generateConcepts(trend, settings) {
      const response = await gemini().models.generateContent({
        model: TEXT_MODEL(),
        contents: conceptPrompt(trend, settings),
        config: { responseMimeType: 'application/json', responseSchema: conceptJsonSchema() },
      });
      return normalizeConcepts(parseJson(response.text), trend);
    },

    async factCheck(copies) {
      const response = await gemini().models.generateContent({
        model: TEXT_MODEL(),
        contents: factCheckPrompt(copies),
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              results: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { index: { type: Type.INTEGER }, supported: { type: Type.BOOLEAN }, unsupportedClaims: { type: Type.ARRAY, items: { type: Type.STRING } } },
                  required: ['index', 'supported', 'unsupportedClaims'],
                },
              },
            },
            required: ['results'],
          },
        },
      });
      return normalizeFactChecks(parseJson(response.text), copies.length, TEXT_MODEL());
    },

    async generateImage(prompt) {
      const model = IMAGE_MODEL();
      const response = await gemini().models.generateContent({
        model,
        contents: prompt,
        config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
      });
      const parts: any[] = response.candidates?.[0]?.content?.parts || [];
      const image = parts.find(p => p?.inlineData?.data);
      if (!image) throw new Error(`The image model returned no image${response.candidates?.[0]?.finishReason ? ` (${response.candidates[0].finishReason})` : ''}.`);
      return { data: Buffer.from(image.inlineData.data, 'base64'), mimeType: image.inlineData.mimeType || 'image/png', model };
    },
  };
}

// --- Groq (copy only) ---

let groqClient: Groq | null = null;

const CONCEPT_JSON_SHAPE = `Reply with one JSON object and nothing else, in exactly this shape:
{"analysis":{"whatIsHappening":"","whyRelevantNow":"","whoIsInterested":"","audienceSegment":"","connectionToMutualPool":"","service":"","message":""},"concepts":[{"title":"","headline":"","description":"","ctaLabel":"","ctaDestination":"","targetAudience":"","marketingAngle":"","service":"","category":"","suggestedDurationDays":7,"imagePrompt":""}]}
"service" must be one of: ${HERO_SERVICES.join(', ')}. "ctaDestination" must be one of: ${HERO_CTA_DESTINATIONS.join(', ')}. "category" must be one of: ${HERO_CATEGORIES.join(', ')}.`;

async function groqConcepts(trend: HeroTrend, settings: HeroSettings): Promise<{ analysis: TrendAnalysis; concepts: CampaignConcept[] }> {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set.');
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: AI_TIMEOUT_MS, maxRetries: 1 });
  const response = await groqClient.chat.completions.create({
    model: GROQ_MODEL(),
    messages: [{ role: 'user', content: `${conceptPrompt(trend, settings)}\n\n${CONCEPT_JSON_SHAPE}` }],
    response_format: { type: 'json_object' },
  });
  return normalizeConcepts(parseJson(response.choices?.[0]?.message?.content || undefined), trend);
}

// --- Runway (images only) ---

const RUNWAY_PROMPT_LIMIT = 1000;

// Runway accepts at most 1000 characters. The originality rules (the tail of
// the prompt) always survive; the scene description gives way.
export function fitRunwayPrompt(prompt: string): string {
  if (prompt.length <= RUNWAY_PROMPT_LIMIT) return prompt;
  const rules = 'Cinematic wide 16:9 marketing photograph, one clear focal point, lower third darker and uncluttered. Original imagery only: no text, letters, logos, brand marks or watermarks; no real people, celebrities, characters, team kits or trademarked designs. Everyday adults in plain unbranded clothing, warm optimistic mood.';
  const scene = prompt.slice(0, RUNWAY_PROMPT_LIMIT - rules.length - 1).replace(/\s+\S*$/, '');
  return `${scene} ${rules}`;
}

async function runwayImage(prompt: string): Promise<GeneratedImage> {
  if (!process.env.RUNWAY_API_KEY) throw new Error('RUNWAY_API_KEY is not set.');
  const RunwayML = (await import('@runwayml/sdk')).default;
  const runway = new RunwayML({ apiKey: process.env.RUNWAY_API_KEY, timeout: AI_TIMEOUT_MS, maxRetries: 2 });
  const task = await runway.textToImage
    .create({ model: RUNWAY_MODEL, ratio: '1920:1080', promptText: fitRunwayPrompt(prompt) })
    .waitForTaskOutput({ timeout: 5 * 60_000 });
  const url = task.output?.[0];
  if (typeof url !== 'string' || !/^https:\/\//.test(url)) throw new Error('Runway returned no image.');
  const download = await fetch(url);
  if (!download.ok) throw new Error(`The Runway image could not be downloaded (HTTP ${download.status}).`);
  const data = Buffer.from(await download.arrayBuffer());
  if (data.length < 1000) throw new Error('The Runway image was empty.');
  return { data, mimeType: download.headers.get('content-type') || 'image/png', model: `runway ${RUNWAY_MODEL}` };
}

// --- Stub (tests and local development) ---

const stubSources: TrendSource[] = [
  { title: 'Example Sports Daily', url: 'https://news.example.test/sports/championship-weekend' },
  { title: 'Example Games Weekly', url: 'https://news.example.test/games/big-launch' },
  { title: 'Example Local News', url: 'https://news.example.test/local/storm' },
];

const stubProvider: HeroAiProvider = {
  name: 'stub',

  async discoverTrends(settings, now) {
    // Tests make a step fail by naming it in the region setting.
    if (process.env.HERO_STUB_FAIL === 'discover' || settings.region === 'FAIL_DISCOVERY') throw new Error('Stub: trend search is down.');
    const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
    return normalizeTrends({
      trends: [
        { title: 'Championship weekend watch parties', description: 'Fans are planning watch parties for the championship game this weekend. Hosts are splitting the cost of food and decorations.', category: 'SPORTS', sourceIndexes: [1], publishedAt: inDays(-1), eventDate: inDays(3), popularity: 'Top search topic this week', relevanceScore: 88, relevanceReason: 'Groups of friends are already pooling money for a shared event.', sensitivity: 'LOW', speculative: false, brandsMentioned: [] },
        { title: 'Blockbuster open-world game launches Friday', description: 'A long-awaited open-world game from Starfall Studios launches this Friday and pre-orders are at record levels.', category: 'GAMING_ENTERTAINMENT', sourceIndexes: [2], publishedAt: inDays(-2), eventDate: inDays(4), popularity: 'Record pre-orders', relevanceScore: 81, relevanceReason: 'Friends save up together for a big purchase.', sensitivity: 'LOW', speculative: false, brandsMentioned: ['Starfall Studios'] },
        { title: 'Severe storm causes flood damage downtown', description: 'A severe storm flooded parts of downtown and residents are raising money for repairs.', category: 'LIFESTYLE', sourceIndexes: [3], publishedAt: inDays(-1), relevanceScore: 70, relevanceReason: 'Communities pooling money.', sensitivity: 'HIGH', speculative: false, brandsMentioned: [] },
        { title: 'Rumoured foldable phone leak', description: 'An unconfirmed leak suggests a new foldable phone may be announced next month.', category: 'TECHNOLOGY', sourceIndexes: [], publishedAt: inDays(-1), relevanceScore: 75, relevanceReason: 'People save for new devices.', sensitivity: 'LOW', speculative: true, brandsMentioned: [] },
        { title: 'Celebrity chef opens a pop-up', description: 'A chef opened a one-night pop-up restaurant.', category: 'LIFESTYLE', sourceIndexes: [1], publishedAt: inDays(-1), relevanceScore: 20, relevanceReason: 'Little connection to saving together.', sensitivity: 'LOW', speculative: false, brandsMentioned: [] },
        { title: 'Championship Weekend: watch parties', description: 'Same story as the first, reported again.', category: 'SPORTS', sourceIndexes: [1], publishedAt: inDays(-1), relevanceScore: 85, relevanceReason: 'Duplicate.', sensitivity: 'LOW', speculative: false, brandsMentioned: [] },
      ],
    }, stubSources, settings, now);
  },

  async generateConcepts(trend, settings) {
    if (process.env.HERO_STUB_FAIL === 'concepts' || settings.region === 'FAIL_COPY') throw new Error('Stub: copy generation is down.');
    const scene = settings.region === 'FAIL_IMAGE' ? ' FAIL_IMAGE' : '';
    const moment = trend.category === 'SPORTS' ? 'Game Day' : 'Launch Day';
    return normalizeConcepts({
      analysis: {
        whatIsHappening: trend.description,
        whyRelevantNow: 'It happens within days and people are making plans now.',
        whoIsInterested: 'Groups of friends and families planning to take part.',
        audienceSegment: 'Adults 21 to 40 who organise group plans',
        connectionToMutualPool: 'Friends already chip in for shared plans; a Savings Pod makes that a habit with a clear schedule.',
        service: 'POOLING_TOGETHER',
        message: 'Bring your people together and save toward the things you enjoy as a group.',
      },
      concepts: [
        { title: `${moment} together`, headline: `${moment}. Save Together.`, description: 'Planning something big with friends? Bring your group together, pool money each week, and reach your shared goal with MutualPool.', ctaLabel: 'Start a Savings Pool', ctaDestination: 'START_POD', targetAudience: 'Friend groups planning a shared event', marketingAngle: 'Shared plans are easier when everyone chips in on a schedule.', service: 'POOLING_TOGETHER', category: trend.category, suggestedDurationDays: 5, imagePrompt: 'Five friends in a cozy living room at dusk, laughing on a sofa with snacks on a low table, warm lamp light and a soft glow from an off-frame screen.' + scene },
        { title: 'Your crew, one goal', headline: 'One Crew. One Goal.', description: 'Set a goal with the people you trust. Everyone saves the same amount each week and you take turns receiving the pot.', ctaLabel: 'Explore Pods', ctaDestination: 'JOIN_POD', targetAudience: 'Young adults new to saving', marketingAngle: 'Accountability from saving alongside friends.', service: 'SAVINGS_PODS', category: trend.category, suggestedDurationDays: 7, imagePrompt: 'Four friends around a kitchen table at night planning with a notebook, city lights through the window.' },
        { title: 'Plan it, save it', headline: 'Plan Big. Save Weekly.', description: 'Know your goal, pick a weekly amount you can keep, and save with a group that keeps you on track.', ctaLabel: 'See How It Works', ctaDestination: 'HOW_IT_WORKS', targetAudience: 'Budget-conscious households', marketingAngle: 'Financial awareness turns a wish into a plan.', service: 'FINANCIAL_AWARENESS', category: trend.category, suggestedDurationDays: 7, imagePrompt: 'A couple at a desk with a calendar and a phone, morning light, relaxed and confident.' },
        { title: 'Unusable', headline: '', description: '', ctaLabel: '', ctaDestination: 'NOWHERE', service: 'SAVINGS_PODS', imagePrompt: '' },
      ],
    }, trend);
  },

  async factCheck(copies) {
    // Tests: copy containing "UNOFFERED" fails; a region of FAIL_FACTCHECK makes the check itself fail.
    if (process.env.HERO_STUB_FAIL === 'factcheck') throw new Error('Stub: fact check is down.');
    return normalizeFactChecks({
      results: copies.map((c, i) => ({ index: i, supported: !/UNOFFERED/.test(`${c.headline} ${c.description}`), unsupportedClaims: /UNOFFERED/.test(`${c.headline} ${c.description}`) ? ['Invents an UNOFFERED feature'] : [] })),
    }, copies.length, 'stub');
  },

  async generateImage(prompt) {
    if (process.env.HERO_STUB_FAIL === 'image' || /FAIL_IMAGE/.test(prompt)) throw new Error('Stub: image generation is down.');
    const sharp = (await import('sharp')).default;
    const data = await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 18, g: 52, b: 96 } } }).png().toBuffer();
    return { data, mimeType: 'image/png', model: 'stub-image' };
  },
};

// --- Image optimisation ---

export interface OptimizedImage {
  data: Buffer;
  mimeType: string;
  width: number;
  height: number;
}

const HERO_IMAGE_WIDTH = 1600;

// 1600px-wide 16:9 WebP: sharp on a laptop, small on a phone. If the image
// library is unavailable the original is kept as long as it is small enough.
export async function optimizeHeroImage(image: GeneratedImage, maxOriginalBytes = 2_800_000): Promise<OptimizedImage> {
  try {
    const sharp = (await import('sharp')).default;
    const out = await sharp(image.data)
      .resize({ width: HERO_IMAGE_WIDTH, height: Math.round(HERO_IMAGE_WIDTH * 9 / 16), fit: 'cover', position: 'attention' })
      .webp({ quality: 78 })
      .toBuffer({ resolveWithObject: true });
    return { data: out.data, mimeType: 'image/webp', width: out.info.width, height: out.info.height };
  } catch (err) {
    if (image.data.length > maxOriginalBytes) throw new Error(`The generated image could not be optimised and is too large to store (${image.data.length} bytes).`);
    console.warn('[hero] image optimisation unavailable, storing the original:', String((err as any)?.message || err));
    return { data: image.data, mimeType: image.mimeType, width: 0, height: 0 };
  }
}
