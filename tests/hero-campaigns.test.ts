// AI hero campaigns: pure rules (copy policy, trends, schedule, performance).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultHeroSettings, applySettingsPatch, trendDedupeKey, isDuplicateTrend, sensitiveTopics, evaluateCampaignPolicy,
  campaignWindow, scheduleProblem, liveState, pickActiveCampaign, engagementScore, clickThroughRate, sanitizeConcept,
  contentFromConcept, buildImagePrompt, wordCount,
} from '../src/lib/heroCampaigns';
import type { CampaignContent, PolicyContext } from '../src/lib/heroCampaigns';
import { normalizeTrends, normalizeConcepts, describeAiError } from '../src/server/heroAi';

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
