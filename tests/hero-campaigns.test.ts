// AI hero campaigns: pure rules (copy policy, trends, schedule, performance).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultHeroSettings, applySettingsPatch, trendDedupeKey, isDuplicateTrend, sensitiveTopics, evaluateCampaignPolicy,
  campaignWindow, scheduleProblem, liveState, pickActiveCampaign, engagementScore, clickThroughRate, sanitizeConcept,
  contentFromConcept, buildImagePrompt, wordCount, refreshSlots, scheduledDiscoveryDue, nextScheduledRefresh, monthlyDaysOf,
} from '../src/lib/heroCampaigns';
import type { CampaignContent, PolicyContext } from '../src/lib/heroCampaigns';
import { normalizeTrends, normalizeConcepts, describeAiError, fitRunwayPrompt, heroAiStatus, normalizeFactChecks } from '../src/server/heroAi';
import { IMAGE_STYLE_RULES } from '../src/lib/heroCampaigns';

const NOW = new Date('2026-11-19T12:00:00.000Z');
const DAY = 86_400_000;
const settings = defaultHeroSettings(NOW.toISOString());

const good: CampaignContent = {
  label: 'Trending now',
  headline: 'Game On. Save Together.',
  description: 'Planning to get the latest game? Bring your friends together, pool money, and work toward your shared goals with MutualPool.',
  ctaLabel: 'Start a Savings Pool',
  ctaDestination: 'START_POD',
  imageAlt: 'Friends on a sofa',
};
const ctx: PolicyContext = { sensitivity: 'LOW', brandsMentioned: [], trendText: 'A new game launches Friday', trendVerified: true, blockedTerms: [] };

test('defaults: manual approval, scheduled discovery off', () => {
  assert.equal(settings.publishMode, 'MANUAL');
  assert.equal(settings.discoveryEnabled, false);
  assert.equal(settings.categories.length, 9);
});

test('the spec example passes the copy rules', () => {
  const r = evaluateCampaignPolicy(good, ctx);
  assert.deepEqual(r.issues, []);
  assert.equal(r.ok, true);
  assert.equal(r.requiresManualReview, false);
  assert.equal(wordCount(good.headline), 4);
});

test('financial promises are refused', () => {
  for (const bad of [
    'Guaranteed payouts for your crew',
    'Risk-free saving with friends',
    'Double your money together',
    'Earn interest while you save together',
    'Invest together and save more',
    'Win big: save with friends',
    'Save 20% with your pod',
    'Get $500 when friends save',
    'Easy money: pool with friends',
    'A loan from your friends, pooled',
  ]) {
    const r = evaluateCampaignPolicy({ ...good, headline: bad }, ctx);
    assert.equal(r.ok, false, bad);
  }
  assert.equal(evaluateCampaignPolicy({ ...good, description: 'Pool money with friends. Payouts are guaranteed every week.' }, ctx).ok, false);
  assert.equal(evaluateCampaignPolicy({ ...good, headline: 'Football Returns. Save Together.' }, ctx).ok, true, 'ordinary words are not caught');
});

test('copy may not imply a third party is affiliated with MutualPool', () => {
  for (const bad of [
    'The official savings app of launch day',
    'Sponsored by your favourite studio: save together',
    'In partnership with the league, save together',
    'Save together for GameMax™',
  ]) {
    assert.equal(evaluateCampaignPolicy({ ...good, description: bad }, ctx).ok, false, bad);
  }
});

test('copy must be about what MutualPool offers, and fit the hero', () => {
  assert.equal(evaluateCampaignPolicy({ ...good, headline: 'The Big Game Is Here', description: 'Everyone is talking about it this weekend.' }, ctx).ok, false, 'brand name on an unrelated line');
  assert.equal(evaluateCampaignPolicy({ ...good, headline: '' }, ctx).ok, false);
  assert.equal(evaluateCampaignPolicy({ ...good, headline: 'Save together with every single one of your friends and family this season' }, ctx).ok, false);
  assert.equal(evaluateCampaignPolicy({ ...good, description: 'x'.repeat(221) + ' save' }, ctx).ok, false);
  assert.equal(evaluateCampaignPolicy({ ...good, ctaDestination: 'https://evil.example' as any }, ctx).ok, false, 'no outside or missing destinations');
  const short = evaluateCampaignPolicy({ ...good, headline: 'Save Together' }, ctx);
  assert.equal(short.ok, true);
  assert.equal(short.warnings.length, 1, 'outside 3-9 words is a warning, not a block');
  assert.equal(evaluateCampaignPolicy(good, { ...ctx, blockedTerms: ['game on'] }).ok, false);
});

test('unverified trends are never publishable; sensitive or branded ones need a person', () => {
  assert.equal(evaluateCampaignPolicy(good, { ...ctx, trendVerified: false }).ok, false);
  const branded = evaluateCampaignPolicy(good, { ...ctx, brandsMentioned: ['Starfall Studios'] });
  assert.equal(branded.ok, true);
  assert.equal(branded.requiresManualReview, true);
  assert.equal(evaluateCampaignPolicy(good, { ...ctx, sensitivity: 'MEDIUM' }).requiresManualReview, true);
  assert.equal(evaluateCampaignPolicy(good, { ...ctx, trendText: 'Flood damage after the hurricane' }).requiresManualReview, true);
  assert.deepEqual(sensitiveTopics('Election night watch parties'), ['politics']);
  assert.deepEqual(sensitiveTopics('Record lottery jackpot'), ['gambling']);
  assert.deepEqual(sensitiveTopics('Championship weekend watch parties'), []);
});

test('duplicate trends are recognised across wording', () => {
  const a = trendDedupeKey('Championship weekend watch parties');
  const existing = [{ dedupeKey: a, sourceUrl: 'https://a.test/1' }];
  assert.equal(isDuplicateTrend({ dedupeKey: trendDedupeKey('Championship Weekend: watch parties') }, existing), true);
  assert.equal(isDuplicateTrend({ dedupeKey: trendDedupeKey('The watch parties of championship weekend') }, existing), true);
  assert.equal(isDuplicateTrend({ dedupeKey: trendDedupeKey('New foldable phone announced') }, existing), false);
  assert.equal(isDuplicateTrend({ dedupeKey: trendDedupeKey('Something else entirely'), sourceUrl: 'https://a.test/1' }, existing), true, 'same source page');
  assert.equal(isDuplicateTrend({ dedupeKey: '' }, existing), true, 'an empty title is never stored');
});

test('campaign length depends on the category and the event', () => {
  const sports = campaignWindow({ startAt: NOW, category: 'SPORTS', settings });
  assert.equal(new Date(sports.endAt).getTime() - NOW.getTime(), 5 * DAY);
  const holiday = campaignWindow({ startAt: NOW, category: 'HOLIDAYS_SEASONAL', settings });
  assert.equal(new Date(holiday.endAt).getTime() - NOW.getTime(), 14 * DAY);
  // Ends a day after the event, not a week later.
  const event = campaignWindow({ startAt: NOW, category: 'HOLIDAYS_SEASONAL', settings, eventDate: new Date(NOW.getTime() + 2 * DAY).toISOString() });
  assert.equal(new Date(event.endAt).getTime() - NOW.getTime(), 3 * DAY);
  const expiring = campaignWindow({ startAt: NOW, category: 'LIFESTYLE', settings, suggestedExpiresAt: new Date(NOW.getTime() + 4 * DAY).toISOString() });
  assert.equal(new Date(expiring.endAt).getTime() - NOW.getTime(), 4 * DAY);
  const pastEvent = campaignWindow({ startAt: NOW, category: 'SPORTS', settings, eventDate: new Date(NOW.getTime() - 3 * DAY).toISOString() });
  assert.equal(new Date(pastEvent.endAt).getTime() - NOW.getTime(), 5 * DAY, 'a past date does not produce a campaign that is already over');
});

test('schedules are validated', () => {
  const iso = (d: number) => new Date(NOW.getTime() + d * DAY).toISOString();
  assert.equal(scheduleProblem(iso(0), iso(5), NOW), null);
  assert.match(scheduleProblem(iso(5), iso(1), NOW) || '', /after the start/);
  assert.match(scheduleProblem(iso(-9), iso(-1), NOW) || '', /already passed/);
  assert.match(scheduleProblem(iso(0), iso(45), NOW) || '', /at most 30 days/);
  assert.match(scheduleProblem('soon', iso(5), NOW) || '', /required/);
});

test('only an approved, in-date campaign with an image is live; priority decides ties', () => {
  const iso = (d: number) => new Date(NOW.getTime() + d * DAY).toISOString();
  const mk = (over: Record<string, unknown>) => ({ id: 'x', status: 'APPROVED', startAt: iso(-1), endAt: iso(3), priority: 5, assetId: 'a', policy: { ok: true }, ...over }) as any;
  assert.equal(liveState(mk({}), NOW), 'LIVE');
  assert.equal(liveState(mk({ startAt: iso(1) }), NOW), 'SCHEDULED');
  assert.equal(liveState(mk({ endAt: iso(-0.01) }), NOW), 'EXPIRED');
  assert.equal(liveState(mk({ status: 'PAUSED' }), NOW), 'PAUSED');
  assert.equal(pickActiveCampaign([], NOW), null, 'nothing live: the evergreen hero shows');
  assert.equal(pickActiveCampaign([mk({ status: 'DRAFT' }), mk({ status: 'PAUSED' }), mk({ endAt: iso(-1) }), mk({ startAt: iso(1) }), mk({ assetId: null }), mk({ policy: { ok: false } })], NOW), null);
  const picked = pickActiveCampaign([mk({ id: 'low', priority: 3 }), mk({ id: 'high', priority: 8 }), mk({ id: 'mid', priority: 5 })], NOW);
  assert.equal(picked?.id, 'high');
  const newest = pickActiveCampaign([mk({ id: 'older', startAt: iso(-3) }), mk({ id: 'newer', startAt: iso(-1) })], NOW);
  assert.equal(newest?.id, 'newer');
});

test('performance rewards sign-ups and pods over clicks', () => {
  const clicky = { impressions: 1000, uniqueImpressions: 800, clicks: 100, registrations: 0, podCreations: 0 };
  const converting = { impressions: 1000, uniqueImpressions: 800, clicks: 30, registrations: 6, podCreations: 3 };
  assert.equal(clickThroughRate(clicky), 0.1);
  assert.ok(engagementScore(converting) > engagementScore(clicky));
  assert.equal(engagementScore({ impressions: 0, uniqueImpressions: 0, clicks: 0, registrations: 0, podCreations: 0 }), 0);
});

test('settings changes are validated', () => {
  const at = NOW.toISOString();
  const ok = applySettingsPatch(settings, { discoveryIntervalHours: 12, relevanceThreshold: 70, categories: ['SPORTS', 'SHOPPING'], blockedTerms: [' Black Friday ', 'black friday'], durationDays: { SPORTS: 3 } }, at);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.deepEqual(ok.settings.categories, ['SPORTS', 'SHOPPING']);
    assert.deepEqual(ok.settings.blockedTerms, ['black friday']);
    assert.equal(ok.settings.durationDays.SPORTS, 3);
    assert.equal(ok.settings.durationDays.SHOPPING, 7, 'other categories keep their length');
  }
  assert.equal(applySettingsPatch(settings, { discoveryIntervalHours: 1 }, at).ok, false);
  assert.equal(applySettingsPatch(settings, { publishMode: 'YOLO' }, at).ok, false);
  assert.equal(applySettingsPatch(settings, { categories: [] }, at).ok, false);
  assert.equal(applySettingsPatch(settings, { categories: ['POLITICS'] }, at).ok, false);
  assert.equal(applySettingsPatch(settings, { durationDays: { SPORTS: 90 } }, at).ok, false);
  assert.equal(applySettingsPatch(settings, { relevanceThreshold: 140 }, at).ok, false);
});

test('model output is cleaned before it is stored', () => {
  assert.equal(sanitizeConcept({ headline: 'x' }, 'SPORTS'), null, 'missing fields');
  assert.equal(sanitizeConcept({ headline: 'Save Together', description: 'd', ctaLabel: 'Go', imagePrompt: 'p', service: 'SAVINGS_PODS', ctaDestination: 'https://elsewhere.test' }, 'SPORTS'), null, 'no destination outside the app');
  const c = sanitizeConcept({ headline: '  "Save   Together"  ', description: 'Pool money with friends.', ctaLabel: 'Start', imagePrompt: 'Friends at a table', service: 'SAVINGS_PODS', ctaDestination: 'START_POD', suggestedDurationDays: 400, category: 'NOPE' }, 'SPORTS');
  assert.equal(c?.headline, 'Save Together');
  assert.equal(c?.category, 'SPORTS');
  assert.equal(c?.suggestedDurationDays, 30);
  assert.equal(contentFromConcept(c!, 'Trending now').ctaDestination, 'START_POD');
});

test('trends are verified only by sources the search service returned', () => {
  const sources = [{ title: 'Example News', url: 'https://news.example.test/a' }];
  const raw = { trends: [
    { title: 'Sourced story', description: 'Something current.', category: 'SPORTS', sourceIndexes: [1], relevanceScore: 80, sensitivity: 'LOW', speculative: false, brandsMentioned: ['Acme'] },
    { title: 'Invented source', description: 'Cites a source that was not returned.', category: 'SPORTS', sourceIndexes: [7], relevanceScore: 80, sensitivity: 'LOW', speculative: false },
    { title: 'A rumour', description: 'Unconfirmed.', category: 'TECHNOLOGY', sourceIndexes: [1], relevanceScore: 150, sensitivity: 'LOW', speculative: true },
    { title: 'Old news', description: 'Reported months ago.', category: 'SPORTS', sourceIndexes: [1], publishedAt: '2026-06-01', relevanceScore: 80, sensitivity: 'LOW' },
    { title: 'Wrong category', description: 'Not a category we follow.', category: 'POLITICS', sourceIndexes: [1], relevanceScore: 80 },
    { title: '', description: 'No title.' },
  ] };
  const trends = normalizeTrends(raw, sources, settings, NOW);
  assert.deepEqual(trends.map(t => t.title), ['Sourced story', 'Invented source', 'A rumour']);
  assert.equal(trends[0].verified, true);
  assert.equal(trends[0].sourceUrl, 'https://news.example.test/a');
  assert.deepEqual(trends[0].brandsMentioned, ['Acme']);
  assert.equal(trends[1].verified, false, 'a source the model made up does not verify anything');
  assert.equal(trends[1].sourceUrl, '');
  assert.equal(trends[2].sensitivity, 'MEDIUM', 'speculation is never low risk');
  assert.equal(trends[2].relevanceScore, 100);
  const sportsOnly = normalizeTrends(raw, sources, { ...settings, categories: ['TECHNOLOGY'] }, NOW);
  assert.deepEqual(sportsOnly.map(t => t.title), ['A rumour'], 'switched-off categories are dropped');
});

test('concept lists drop unusable entries', () => {
  const trend: any = { category: 'SPORTS' };
  const { analysis, concepts } = normalizeConcepts({
    analysis: { whatIsHappening: 'A game', service: 'NOT_A_SERVICE' },
    concepts: [
      { headline: 'Game Day. Save Together.', description: 'Pool money with friends.', ctaLabel: 'Start', imagePrompt: 'Friends', service: 'POOLING_TOGETHER', ctaDestination: 'START_POD' },
      { headline: '', description: '', ctaLabel: '' },
      'nonsense',
    ],
  }, trend);
  assert.equal(concepts.length, 1);
  assert.equal(analysis.service, 'SAVINGS_PODS');
});

test('image prompts always carry the originality rules and never a brand name', () => {
  const prompt = buildImagePrompt('Friends celebrating the Starfall Studios launch in a neon-lit living room', ['Starfall Studios']);
  assert.ok(!/starfall/i.test(prompt));
  assert.match(prompt, /No text, letters/);
  assert.match(prompt, /Do not depict real people, celebrities/);
  assert.match(prompt, /16:9/);
});

test('provider failures are described plainly', () => {
  assert.match(describeAiError(new Error('{"error":{"code":429,"message":"You exceeded your current quota","status":"RESOURCE_EXHAUSTED"}}')), /billing enabled/);
  assert.equal(describeAiError(new Error('boom')), 'boom');
});

// --- Twice-a-month refresh ---

// Local-time dates, as the scheduler uses server time.
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0, 0);
const twice = { ...settings, discoveryEnabled: true, discoveryCadence: 'TWICE_MONTHLY' as const, monthlyDays: [1, 15] as [number, number] };

test('twice-a-month refresh times fall on the two chosen days at 6 AM', () => {
  let s = refreshSlots(local(2026, 11, 19), [1, 15]);
  assert.equal(s.previous.getTime(), local(2026, 11, 15, 6).getTime());
  assert.equal(s.next.getTime(), local(2026, 12, 1, 6).getTime());
  s = refreshSlots(local(2026, 11, 15, 5), [1, 15]);
  assert.equal(s.previous.getTime(), local(2026, 11, 1, 6).getTime(), 'before 6 AM the refresh has not happened yet');
  assert.equal(s.next.getTime(), local(2026, 11, 15, 6).getTime());
  s = refreshSlots(local(2026, 11, 15, 6), [1, 15]);
  assert.equal(s.previous.getTime(), local(2026, 11, 15, 6).getTime());
  s = refreshSlots(local(2027, 1, 1, 3), [1, 15]);
  assert.equal(s.previous.getTime(), local(2026, 12, 15, 6).getTime(), 'across the year boundary');
  assert.equal(s.next.getTime(), local(2027, 1, 1, 6).getTime());
  s = refreshSlots(local(2026, 2, 27), [10, 28]);
  assert.equal(s.next.getTime(), local(2026, 2, 28, 6).getTime(), 'day 28 exists in every month');
  assert.deepEqual(monthlyDaysOf({ monthlyDays: [20, 5] }), [5, 20]);
  assert.deepEqual(monthlyDaysOf({}), [1, 15], 'settings saved before this option default to the 1st and 15th');
});

test('the refresh runs once per period, exactly twice a month', () => {
  const run = (d: Date, ok = true) => ({ at: d.toISOString(), ok });
  assert.equal(scheduledDiscoveryDue({ ...twice, discoveryEnabled: false }, local(2026, 11, 19), []), false, 'off means off');
  assert.equal(scheduledDiscoveryDue(twice, local(2026, 11, 19), []), true, 'switched on mid-period: the current period is filled straight away');
  const ran15 = [run(local(2026, 11, 15, 6))];
  assert.equal(scheduledDiscoveryDue(twice, local(2026, 11, 15, 7), ran15), false);
  assert.equal(scheduledDiscoveryDue(twice, local(2026, 11, 30, 23), ran15), false, 'nothing more until the next refresh day');
  assert.equal(scheduledDiscoveryDue(twice, local(2026, 12, 1, 5), ran15), false);
  assert.equal(scheduledDiscoveryDue(twice, local(2026, 12, 1, 6), ran15), true);
  // Count the refreshes over a year of five-minute ticks, hour by hour.
  const runs: Array<{ at: string; ok: boolean }> = [run(local(2026, 12, 15, 6))];
  for (let t = local(2027, 1, 1, 0).getTime(); t < local(2028, 1, 1, 0).getTime(); t += 3_600_000) {
    if (scheduledDiscoveryDue(twice, new Date(t), runs)) runs.unshift(run(new Date(t)));
  }
  assert.equal(runs.length - 1, 24, 'two a month for twelve months');
  assert.ok(runs.every(r => [1, 15].includes(new Date(r.at).getDate()) && new Date(r.at).getHours() === 6));
});

test('a failed refresh is retried later the same day, not every few minutes', () => {
  const failed = [{ at: local(2026, 11, 15, 6).toISOString(), ok: false }];
  assert.equal(scheduledDiscoveryDue(twice, local(2026, 11, 15, 7), failed), false);
  assert.equal(scheduledDiscoveryDue(twice, local(2026, 11, 15, 12), failed), true, 'six hours on');
  const thenOk = [{ at: local(2026, 11, 15, 12).toISOString(), ok: true }, ...failed];
  assert.equal(scheduledDiscoveryDue(twice, local(2026, 11, 16), thenOk), false);
  assert.equal(nextScheduledRefresh(twice, local(2026, 11, 16), thenOk), local(2026, 12, 1, 6).toISOString());
  assert.equal(nextScheduledRefresh({ ...twice, discoveryEnabled: false }, local(2026, 11, 16), thenOk), null);
});

test('hourly cadence still works as before', () => {
  const every = { ...settings, discoveryEnabled: true, discoveryIntervalHours: 24 };
  assert.equal(scheduledDiscoveryDue(every, NOW, []), true);
  assert.equal(scheduledDiscoveryDue(every, NOW, [{ at: new Date(NOW.getTime() - 23 * 3_600_000).toISOString(), ok: true }]), false);
  assert.equal(scheduledDiscoveryDue(every, NOW, [{ at: new Date(NOW.getTime() - 25 * 3_600_000).toISOString(), ok: false }]), true);
});

test('a twice-monthly campaign holds the hero until the next refresh, unless its event ends first', () => {
  const start = local(2026, 11, 15, 6);
  const until = local(2026, 12, 1, 6).toISOString();
  const held = campaignWindow({ startAt: start, category: 'SPORTS', settings, runUntil: until });
  assert.equal(held.endAt, until, 'not cut to the 5-day sports length');
  const short = campaignWindow({ startAt: start, category: 'SPORTS', settings, runUntil: until, suggestedDurationDays: 3 });
  assert.equal(short.endAt, until);
  const event = campaignWindow({ startAt: start, category: 'SPORTS', settings, runUntil: until, eventDate: local(2026, 11, 20, 6).toISOString() });
  assert.equal(event.endAt, local(2026, 11, 21, 6).toISOString(), 'a day after the event');
  const expiring = campaignWindow({ startAt: start, category: 'SPORTS', settings, runUntil: until, suggestedExpiresAt: local(2026, 11, 25, 6).toISOString() });
  assert.equal(expiring.endAt, local(2026, 11, 25, 6).toISOString());
});

test('twice-monthly settings are validated', () => {
  const at = NOW.toISOString();
  const ok = applySettingsPatch(settings, { discoveryEnabled: true, discoveryCadence: 'TWICE_MONTHLY', monthlyDays: [20, 5] }, at);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.settings.monthlyDays, [5, 20]);
  assert.equal(applySettingsPatch(settings, { discoveryCadence: 'WEEKLY' }, at).ok, false);
  assert.equal(applySettingsPatch(settings, { monthlyDays: [1, 31] }, at).ok, false, 'not every month has a 31st');
  assert.equal(applySettingsPatch(settings, { monthlyDays: [1, 3] }, at).ok, false, 'too close together');
  assert.equal(applySettingsPatch(settings, { monthlyDays: [15] }, at).ok, false);
  assert.equal(applySettingsPatch(settings, { monthlyDays: [1.5, 15] }, at).ok, false);
});

// --- Providers ---

test('copy and image providers are tried in order, the preferred one first', () => {
  const saved = { ...process.env };
  try {
    delete process.env.HERO_AI_PROVIDER; delete process.env.HERO_TEXT_PROVIDER; delete process.env.HERO_IMAGE_PROVIDER;
    process.env.GEMINI_API_KEY = 'g'; process.env.GROQ_API_KEY = 'q'; process.env.RUNWAY_API_KEY = 'r';
    let s = heroAiStatus(true);
    assert.equal(s.provider, 'copy: gemini then groq; images: gemini then runway');
    assert.equal(s.configured, true);
    assert.equal(s.discovery, true);
    process.env.HERO_IMAGE_PROVIDER = 'runway'; process.env.HERO_TEXT_PROVIDER = 'Groq';
    s = heroAiStatus(true);
    assert.equal(s.provider, 'copy: groq then gemini; images: runway then gemini');
    assert.match(s.imageModel, /^runway gen4_image then /);
    // Without Gemini: copy and images still work, trend search does not.
    process.env.GEMINI_API_KEY = '';
    s = heroAiStatus(true);
    assert.equal(s.provider, 'copy: groq; images: runway');
    assert.equal(s.configured, true);
    assert.equal(s.discovery, false);
    process.env.RUNWAY_API_KEY = '';
    assert.equal(heroAiStatus(true).configured, false, 'no image provider left');
    process.env.HERO_AI_PROVIDER = 'stub';
    assert.equal(heroAiStatus(true).provider, 'none', 'the stand-in is never used in production');
    assert.equal(heroAiStatus(false).provider, 'stub');
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test('Runway prompts fit its 1000-character limit and keep the originality rules', () => {
  const short = 'Friends on a sofa. No text, no logos.';
  assert.equal(fitRunwayPrompt(short), short);
  const long = buildImagePrompt('A family loading suitcases into a car on a tree-lined street in autumn. '.repeat(12), []);
  assert.ok(long.length > 1000);
  const fitted = fitRunwayPrompt(long);
  assert.ok(fitted.length <= 1000, String(fitted.length));
  assert.match(fitted, /^A family loading suitcases/);
  assert.match(fitted, /no text, letters, logos/);
  assert.match(fitted, /no real people, celebrities, characters/);
  assert.ok(buildImagePrompt('x'.repeat(300), []).length <= 1000 || IMAGE_STYLE_RULES.length > 700);
});

// --- Copy may only describe what MutualPool offers ---

test('copy that invents features is blocked; accurate copy passes', () => {
  const invented = [
    ['Earn Perks While You Play', 'Join a MutualPool pod and unlock exclusive gaming perks, like early access codes or discount vouchers, as you save together.'],
    ["Join the Creator's Money Quest", "Follow your favorite streamer's savings pod and help each other reach milestones, like exclusive merch or game nights, with every weekly contribution."],
    ['Team Up for Game Night Funds', 'Employers can set up a savings pod for staff to pool money for shared gaming experiences, like a launch party or tournament entry, with scheduled payouts.'],
    ['Save and Get Rewards', 'Every weekly deposit in your savings pod gets you closer to rewards.'],
    ['Cashback on Every Pod', 'Save together and enjoy cash back on your weekly contributions.'],
  ];
  for (const [headline, description] of invented) {
    assert.equal(evaluateCampaignPolicy({ ...good, headline, description }, ctx).ok, false, headline);
  }
  const accurate = [
    ['One Crew. One Goal.', 'Set a goal with the people you trust. Everyone saves the same amount each week and you take turns receiving the pot.'],
    ['Perks for the Road', 'Members get everyday discounts on quick meals, tire repair and car washes while they save together.'],
    ['Host Your Crew', 'Start a pod for your crew, take the last turn and earn the host reward on each weekly pot.'],
    ['Level Up Your Savings Together', 'Create a savings pod with friends to fund the next big game release, rotating contributions and payouts to keep the excitement rolling.'],
  ];
  for (const [headline, description] of accurate) {
    const r = evaluateCampaignPolicy({ ...good, headline, description }, ctx);
    assert.equal(r.ok, true, `${headline}: ${r.issues.join(' ')}`);
  }
});

test('the AI fact check decides publication: failed blocks, missing needs a person', () => {
  const at = NOW.toISOString();
  assert.equal(evaluateCampaignPolicy(good, { ...ctx, factCheck: { status: 'PASSED', claims: [], checkedAt: at } }).requiresManualReview, false);
  const failed = evaluateCampaignPolicy(good, { ...ctx, factCheck: { status: 'FAILED', claims: ['Promises early access'], checkedAt: at } });
  assert.equal(failed.ok, false);
  assert.match(failed.issues.join(' '), /Promises early access/);
  const unchecked = evaluateCampaignPolicy(good, { ...ctx, factCheck: { status: 'UNCHECKED', claims: [], checkedAt: at } });
  assert.equal(unchecked.ok, true);
  assert.equal(unchecked.requiresManualReview, true);
  assert.equal(evaluateCampaignPolicy(good, { ...ctx, factCheck: null }).requiresManualReview, true, 'never checked');
  assert.equal(evaluateCampaignPolicy(good, { ...ctx, factCheck: { status: 'EDITED', claims: [], checkedAt: at } }).requiresManualReview, false, 'a person wrote it');
});

test('fact-check answers are read strictly', () => {
  const checks = normalizeFactChecks({ results: [
    { index: 0, supported: true, unsupportedClaims: [] },
    { index: 1, supported: false, unsupportedClaims: ['Promises exclusive merch'] },
    { index: 2, supported: true, unsupportedClaims: ['Says perks are earned by saving'] },
    { index: 3, supported: false, unsupportedClaims: [] },
  ] }, 5, 'm');
  assert.deepEqual(checks.map(c => c.status), ['PASSED', 'FAILED', 'FAILED', 'FAILED', 'UNCHECKED']);
  assert.deepEqual(checks[1].claims, ['Promises exclusive merch']);
  assert.equal(checks[3].claims.length, 1, 'a failure always says something');
});

test('"always" is only a problem as a promise about the outcome', () => {
  const mine = evaluateCampaignPolicy({ ...good, headline: 'Save money with friends to buy that gaming system', description: "Join a MutualPool pod and get the guys together on that gaming system you've always wanted. Don't wait, buy it now." }, ctx);
  assert.equal(mine.ok, true, mine.issues.join(' '));
  for (const promise of ['Your pod always pays out on time.', 'Save together: you always get paid.', 'A pod that never fails.']) {
    assert.equal(evaluateCampaignPolicy({ ...good, description: `Pool money with friends. ${promise}` }, ctx).ok, false, promise);
  }
});
