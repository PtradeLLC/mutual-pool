// AI hero campaigns end to end against a DEMO_MODE server, with the offline
// stand-in AI provider (HERO_AI_PROVIDER=stub, set by scripts/run-server-tests.ts).
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const CRON_HEADERS = { 'content-type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' };
const DAY = 86_400_000;

let seq = 0;
function makeUser(prefix: string, extra: Record<string, string> = {}) {
  const nonce = `${Date.now()}_${++seq}_${Math.floor(Math.random() * 1e6)}`;
  return { id: `usr_hero_${prefix}_${nonce}`, name: `Hero ${prefix} ${seq}`, extra };
}
type TestUser = ReturnType<typeof makeUser>;
function headers(u: TestUser) {
  return {
    'content-type': 'application/json',
    'x-user-id': u.id,
    'x-user-name': u.name,
    'x-user-email': `${u.id}@example.test`,
    'x-user-kyc-status': 'VERIFIED',
    'x-user-account-age-days': '0',
    'x-user-completed-pods-count': '2',
    ...u.extra,
  };
}
const admin = makeUser('admin', { 'x-user-role': 'Admin' });
const member = makeUser('member');

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, body, headers: res.headers };
}
const send = (method: string) => (u: TestUser | null, path: string, body: unknown = {}) =>
  api(path, { method, headers: u ? headers(u) : { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const post = send('POST');
const put = send('PUT');
const get = (u: TestUser | null, path: string) => api(path, u ? { headers: headers(u) } : {});

const dashboard = async () => (await get(admin, '/api/admin/hero')).body;
const activeCampaign = async () => (await get(null, '/api/hero/active')).body.campaign;
async function idle() {
  for (let i = 0; i < 200; i += 1) {
    const d = await dashboard();
    if (!d.busy) return d;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('The hero job did not finish.');
}
const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const byTrend = (d: any, re: RegExp) => d.campaigns.find((c: any) => re.test(c.trendTitle));

test('1. With no campaign the landing page gets nothing, and the admin tools are admin-only', async () => {
  const active = await get(null, '/api/hero/active');
  assert.equal(active.status, 200);
  assert.equal(active.body.campaign, null, 'the evergreen hero is shown');

  for (const who of [null, member]) {
    assert.equal((await get(who, '/api/admin/hero')).status, 403);
    assert.equal((await post(who, '/api/admin/hero/discover')).status, 403);
    assert.equal((await put(who, '/api/admin/hero/settings', { publishMode: 'AUTO', confirmAutoPublish: true })).status, 403);
    assert.equal((await post(who, '/api/admin/hero/campaigns/x/approve')).status, 403);
  }
  assert.equal((await post(null, '/api/platform/schedule/hero-campaigns')).status, 403);

  const d = await dashboard();
  assert.equal(d.settings.publishMode, 'MANUAL');
  assert.equal(d.settings.discoveryEnabled, false);
  assert.equal(d.ai.provider, 'stub');
  assert.equal(d.campaigns.length, 0);
});

test('2. Discovery records sourced trends, drops duplicates and drafts campaigns for the relevant ones', async () => {
  assert.equal((await post(admin, '/api/admin/hero/discover')).status, 202);
  const d = await idle();
  assert.equal(d.runs[0].kind, 'DISCOVERY');
  assert.equal(d.runs[0].ok, true, JSON.stringify(d.runs[0]));

  assert.equal(d.trends.length, 5, 'six reported, one a duplicate of another');
  const sports = d.trends.find((t: any) => /Championship/.test(t.title));
  assert.equal(sports.category, 'SPORTS');
  assert.equal(sports.verified, true);
  assert.equal(sports.sourceUrl, 'https://news.example.test/sports/championship-weekend');
  assert.ok(sports.discoveredAt && sports.suggestedExpiresAt && sports.eventDate && sports.publishedAt);
  assert.equal(sports.relevanceScore, 88);
  assert.equal(sports.status, 'CAMPAIGN_CREATED');
  const leak = d.trends.find((t: any) => /foldable/.test(t.title));
  assert.equal(leak.verified, false);
  assert.equal(leak.sensitivity, 'MEDIUM');
  assert.equal(leak.status, 'NEW');

  // Two drafts: the two best trends that are verified, relevant and not high-risk.
  assert.equal(d.campaigns.length, 2);
  assert.ok(byTrend(d, /Championship/) && byTrend(d, /open-world game/));
  assert.ok(!byTrend(d, /storm/), 'high-sensitivity trends are not drafted automatically');
  assert.ok(!byTrend(d, /pop-up/), 'low-relevance trends are not drafted');
  for (const c of d.campaigns) {
    assert.equal(c.status, 'DRAFT', 'manual approval is the default');
    assert.ok(c.concepts.length >= 3, 'at least three concepts');
    for (const concept of c.concepts) {
      for (const field of ['title', 'headline', 'description', 'ctaLabel', 'ctaDestination', 'targetAudience', 'marketingAngle', 'category', 'service', 'imagePrompt']) assert.ok(concept[field], field);
      assert.ok(concept.suggestedDurationDays >= 1);
    }
    assert.ok(c.analysis.connectionToMutualPool && c.analysis.whatIsHappening && c.analysis.audienceSegment);
    assert.ok(c.imageUrl, 'a hero image was generated');
    assert.equal(c.image.mimeType, 'image/webp');
    assert.equal(c.image.width, 1600);
    assert.equal(c.image.height, 900, '16:9');
    assert.equal(c.policy.ok, true);
    assert.ok(new Date(c.endAt).getTime() > new Date(c.startAt).getTime());
  }
  const sportsCampaign = byTrend(d, /Championship/);
  assert.equal(sportsCampaign.policy.requiresManualReview, false);
  const days = (new Date(sportsCampaign.endAt).getTime() - new Date(sportsCampaign.startAt).getTime()) / DAY;
  assert.ok(days > 3.9 && days < 4.1, `ends a day after the event (${days} days)`);
  const game = byTrend(d, /open-world game/);
  assert.equal(game.policy.requiresManualReview, true, 'a trend naming a brand always needs a person');
  assert.match(game.policy.reviewReasons.join(' '), /Starfall Studios/);
  assert.ok(!/starfall/i.test(game.image.prompt), 'the brand is kept out of the image prompt');

  assert.equal(await activeCampaign(), null, 'drafts are never shown');

  // Running it again adds nothing.
  assert.equal((await post(admin, '/api/admin/hero/discover')).status, 202);
  const again = await idle();
  assert.equal(again.trends.length, 5);
  assert.equal(again.campaigns.length, 2);
});

let campaignId = '';

test('3. Copy is checked on every edit; a campaign that breaks a rule cannot be approved', async () => {
  const d = await dashboard();
  campaignId = byTrend(d, /Championship/).id;

  const bad = await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { content: { headline: 'Guaranteed Payouts for Game Day' } });
  assert.equal(bad.status, 200, 'a draft can hold work in progress');
  assert.equal(bad.body.campaign.policy.ok, false);
  const refused = await post(admin, `/api/admin/hero/campaigns/${campaignId}/approve`);
  assert.equal(refused.status, 400);
  assert.equal(refused.body.error, 'POLICY_VIOLATION');
  assert.equal(await activeCampaign(), null);

  // Pick another concept, then edit it.
  const picked = await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { selectedConcept: 1 });
  assert.equal(picked.body.campaign.content.headline, 'One Crew. One Goal.');
  assert.equal(picked.body.campaign.content.ctaDestination, 'JOIN_POD');
  const edited = await put(admin, `/api/admin/hero/campaigns/${campaignId}`, {
    selectedConcept: 0,
    content: { headline: 'Game Day. Save Together.', label: 'Game day', ctaLabel: 'Start a Savings Pool' },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.campaign.policy.ok, true);
  assert.equal(edited.body.campaign.content.label, 'Game day');

  assert.equal((await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { content: { ctaDestination: 'https://elsewhere.test' } })).body.campaign.policy.ok, false);
  assert.equal((await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { content: { ctaDestination: 'START_POD' } })).body.campaign.policy.ok, true);
  assert.equal((await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { startAt: iso(3), endAt: iso(1) })).status, 400);
  assert.equal((await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { selectedConcept: 99 })).status, 400);
});

test('4. An approved campaign is scheduled, goes live, and is served with its image', async () => {
  // Scheduled for tomorrow: approved but not shown yet.
  const scheduled = await post(admin, `/api/admin/hero/campaigns/${campaignId}/approve`, { startAt: iso(1), endAt: iso(4), priority: 6, note: 'Looks good' });
  assert.equal(scheduled.status, 200, JSON.stringify(scheduled.body));
  assert.equal(scheduled.body.campaign.status, 'APPROVED');
  assert.equal(scheduled.body.campaign.state, 'SCHEDULED');
  assert.equal(await activeCampaign(), null);
  const review = scheduled.body.campaign.approvals.at(-1);
  assert.equal(review.action, 'APPROVED');
  assert.equal(review.byUserId, admin.id);
  assert.equal(review.note, 'Looks good');
  assert.ok(review.at);

  // Bring the start forward: it is live.
  const live = await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { startAt: iso(-0.01), endAt: iso(4) });
  assert.equal(live.body.campaign.state, 'LIVE');
  const active = await activeCampaign();
  assert.equal(active.id, campaignId);
  assert.ok(active.endAt);
  assert.deepEqual(Object.keys(active).sort(), ['endAt', 'id', 'slides'], 'nothing internal is exposed');
  // Every concept is a slide with its own image, the lead (edited) one first.
  assert.equal(active.slides.length, 3);
  assert.deepEqual(active.slides.map((x: any) => x.index), [0, 1, 2]);
  assert.equal(new Set(active.slides.map((x: any) => x.imageUrl)).size, 3, 'a different image for each slide');
  const shown = active.slides[0];
  assert.equal(shown.headline, 'Game Day. Save Together.');
  assert.equal(shown.label, 'Game day');
  assert.equal(shown.ctaLabel, 'Start a Savings Pool');
  assert.equal(shown.ctaDestination, 'START_POD');
  assert.ok(shown.description && shown.imageAlt);
  assert.deepEqual(Object.keys(shown).sort(), ['ctaDestination', 'ctaLabel', 'description', 'headline', 'imageAlt', 'imageUrl', 'index', 'label']);
  assert.equal(active.slides[1].headline, 'One Crew. One Goal.');
  assert.equal(active.slides[1].ctaDestination, 'JOIN_POD');

  const image = await fetch(`${BASE_URL}${shown.imageUrl}`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/webp');
  assert.match(image.headers.get('cache-control') || '', /immutable/);
  assert.ok((await image.arrayBuffer()).byteLength > 100);
  assert.equal((await fetch(`${BASE_URL}/api/hero/assets/nope`)).status, 404);

  // A published campaign cannot be edited into breaking a rule.
  const broken = await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { content: { description: 'Pool money with friends: risk-free and guaranteed.' } });
  assert.equal(broken.status, 400);
  assert.equal(broken.body.error, 'POLICY_VIOLATION');
  assert.equal((await activeCampaign()).slides[0].description, shown.description, 'the live copy is unchanged');
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${campaignId}/regenerate-copy`)).status, 400, 'live copy is not regenerated');
});

test('4b. Each slide is managed on its own: edit, hide, lead, and per-slide images', async () => {
  const slidesOf = async () => (await activeCampaign()).slides.map((x: any) => x.index);
  // A published slide that is not the lead cannot be edited into breaking a rule either.
  const broken = await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { slide: 2, content: { description: 'Guaranteed payouts with your crew.' } });
  assert.equal(broken.status, 400);
  assert.equal(broken.body.error, 'POLICY_VIOLATION');
  // Editing a non-lead slide changes only that slide.
  const edited = await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { slide: 2, content: { headline: 'Plan Big. Save Weekly Together.' } });
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  let active = await activeCampaign();
  assert.equal(active.slides[0].headline, 'Game Day. Save Together.');
  assert.equal(active.slides[2].headline, 'Plan Big. Save Weekly Together.');
  const view = edited.body.campaign;
  assert.equal(view.slides.length, 3);
  assert.ok(view.slides.every((x: any) => x.imageUrl && x.onHero && x.policy.ok));
  assert.equal(view.slides[0].lead, true);

  // Hide and show a slide.
  assert.equal((await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { slide: 1, hidden: true })).status, 200);
  assert.deepEqual(await slidesOf(), [0, 2]);
  assert.equal((await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { slide: 0, hidden: true })).status, 400, 'the lead cannot be hidden');
  assert.equal((await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { slide: 1, hidden: false })).status, 200);
  assert.deepEqual(await slidesOf(), [0, 1, 2]);

  // Another slide can lead; every slide keeps its own copy.
  assert.equal((await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { selectedConcept: 2 })).status, 200);
  active = await activeCampaign();
  assert.deepEqual(active.slides.map((x: any) => x.index), [2, 0, 1]);
  assert.equal(active.slides[0].headline, 'Plan Big. Save Weekly Together.');
  assert.equal(active.slides[1].headline, 'Game Day. Save Together.');
  assert.equal((await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { selectedConcept: 0 })).status, 200);

  // One slide's image can be remade; the others keep theirs.
  const before = (await activeCampaign()).slides.map((x: any) => x.imageUrl);
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${campaignId}/regenerate-image`, { slide: 1 })).status, 202);
  await idle();
  const after = (await activeCampaign()).slides.map((x: any) => x.imageUrl);
  assert.equal(after[0], before[0]);
  assert.notEqual(after[1], before[1]);
  assert.equal(after[2], before[2]);
  assert.equal((await fetch(`${BASE_URL}${before[1]}`)).status, 404, 'the replaced image is removed');
  const nothing = await post(admin, `/api/admin/hero/campaigns/${campaignId}/regenerate-image`, { missing: true });
  assert.equal(nothing.status, 400);
  assert.equal(nothing.body.error, 'NOTHING_MISSING');
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${campaignId}/regenerate-image`, { slide: 9 })).status, 400);
});

test('4c. Slides may only describe what MutualPool offers', async () => {
  // New copy is fact-checked as it is written.
  let view = (await dashboard()).campaigns.find((c: any) => c.id === campaignId);
  // Slides 0 and 2 were rewritten by the administrator in earlier tests.
  assert.deepEqual(view.slides.map((x: any) => x.factCheck?.status), ['EDITED', 'PASSED', 'EDITED']);
  // A live slide cannot be edited into describing something that does not exist.
  const invented = await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { slide: 1, content: { description: 'Join a pod and unlock exclusive gaming perks like early access codes as you save together.' } });
  assert.equal(invented.status, 400);
  assert.equal(invented.body.error, 'POLICY_VIOLATION');
  // Wording the rules cannot catch is caught by "Check copy" (the stand-in AI
  // flags "UNOFFERED"). Edited copy is marked as written by a person until then.
  const edited = await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { slide: 1, content: { description: 'Save the same amount each week with your crew and use the UNOFFERED feature together.' } });
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  assert.equal(edited.body.campaign.slides[1].factCheck.status, 'EDITED');
  assert.deepEqual((await activeCampaign()).slides.map((x: any) => x.index), [0, 1, 2]);
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${campaignId}/fact-check`)).status, 202);
  let d = await idle();
  assert.equal(d.runs[0].ok, true, JSON.stringify(d.runs[0]));
  assert.match(d.runs[0].summary, /1 of 3 slides/);
  view = d.campaigns.find((c: any) => c.id === campaignId);
  assert.equal(view.slides[1].factCheck.status, 'FAILED');
  assert.equal(view.slides[1].onHero, false);
  assert.deepEqual((await activeCampaign()).slides.map((x: any) => x.index), [0, 2], 'the slide is off the hero at once');
  // Rewritten accurately and checked again, it comes back.
  assert.equal((await put(admin, `/api/admin/hero/campaigns/${campaignId}`, { slide: 1, content: { description: 'Set a goal with the people you trust. Everyone saves the same amount each week and you take turns receiving the pot.' } })).status, 200);
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${campaignId}/fact-check`)).status, 202);
  d = await idle();
  assert.deepEqual((await activeCampaign()).slides.map((x: any) => x.index), [0, 1, 2]);
  assert.equal((await post(member, `/api/admin/hero/campaigns/${campaignId}/fact-check`)).status, 403);
});

test('5. Impressions, clicks, sign-ups and pods created are tracked per campaign', async () => {
  assert.equal((await post(null, '/api/hero/events', { campaignId, type: 'impression', unique: true })).body.counted, true);
  assert.equal((await post(null, '/api/hero/events', { campaignId, type: 'impression', unique: true })).body.counted, false, 'a repeat from the same visitor is not counted');
  assert.equal((await post(null, '/api/hero/events', { campaignId, type: 'click' })).body.counted, true);
  assert.equal((await post(null, '/api/hero/events', { campaignId: 'hcamp_missing', type: 'click' })).body.counted, false);
  assert.equal((await post(null, '/api/hero/events', { campaignId, type: 'purchase' })).body.counted, false);

  assert.equal((await post(null, '/api/hero/conversion', { campaignId })).status, 401);
  // A member who signed up after the campaign started.
  const first = await post(member, '/api/hero/conversion', { campaignId });
  assert.deepEqual(first.body, { registration: true, podCreation: false });
  assert.equal((await post(member, '/api/users/treasury/topup', { amount: 200 })).status, 200);
  assert.equal((await post(member, '/api/users/debit-mandate/accept', {})).status, 200);
  assert.equal((await post(member, '/api/pods', { name: `Hero Pod ${Date.now()}`, sizeTier: 5, depositTier: 10 })).status, 200);
  const second = await post(member, '/api/hero/conversion', { campaignId });
  assert.deepEqual(second.body, { registration: false, podCreation: true }, 'each is counted once per member');
  assert.deepEqual((await post(member, '/api/hero/conversion', { campaignId })).body, { registration: false, podCreation: false });
  // An account older than the campaign is not a registration.
  const veteran = makeUser('veteran', { 'x-user-account-age-days': '200' });
  assert.deepEqual((await post(veteran, '/api/hero/conversion', { campaignId })).body, { registration: false, podCreation: false });

  const d = await dashboard();
  const perf = d.campaigns.find((c: any) => c.id === campaignId).performance;
  assert.equal(perf.impressions, 1);
  assert.equal(perf.uniqueImpressions, 1);
  assert.equal(perf.clicks, 1);
  assert.equal(perf.registrations, 1);
  assert.equal(perf.podCreations, 1);
  assert.equal(perf.clickThroughRate, 1);
  assert.ok(perf.engagementScore > 0);
  const sportsRow = d.categoryPerformance.find((r: any) => r.category === 'SPORTS');
  assert.equal(sportsRow.registrations, 1);
  assert.equal(d.activeCampaignId, campaignId);
});

test('6. Pause, resume, priority, and automatic retirement when a campaign ends', async () => {
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${campaignId}/pause`)).body.campaign.status, 'PAUSED');
  assert.equal(await activeCampaign(), null, 'a paused campaign falls back to the evergreen hero');
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${campaignId}/resume`)).body.campaign.state, 'LIVE');
  assert.equal((await activeCampaign()).id, campaignId);

  // A second live campaign with a higher priority takes the hero.
  const d = await dashboard();
  const game = byTrend(d, /open-world game/);
  const approved = await post(admin, `/api/admin/hero/campaigns/${game.id}/approve`, { startAt: iso(-0.01), endAt: iso(2), priority: 9 });
  assert.equal(approved.status, 200, 'an administrator may approve a campaign flagged for review');
  assert.equal((await activeCampaign()).id, game.id);
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${game.id}/retire`, { note: 'Launch moved' })).body.campaign.status, 'RETIRED');
  assert.equal((await activeCampaign()).id, campaignId);
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${game.id}/approve`)).status, 400, 'a retired campaign stays retired');

  // Five days on, the scheduler finds it expired.
  const tick = await api('/api/platform/schedule/hero-campaigns', { method: 'POST', headers: CRON_HEADERS, body: JSON.stringify({ now: iso(5) }) });
  assert.equal(tick.status, 200);
  assert.equal(tick.body.retired, 1);
  const after = await dashboard();
  const expired = after.campaigns.find((c: any) => c.id === campaignId);
  assert.equal(expired.status, 'RETIRED');
  assert.equal(expired.retiredReason, 'EXPIRED');
  assert.equal(expired.approvals.at(-1).action, 'EXPIRED');
  assert.equal(await activeCampaign(), null, 'back to the evergreen hero');
  assert.equal((await post(null, '/api/hero/events', { campaignId, type: 'click' })).body.counted, false);
});

test('7. Unverified trends never become campaigns, and a trend gets one campaign', async () => {
  const d = await dashboard();
  const leak = d.trends.find((t: any) => /foldable/.test(t.title));
  const refused = await post(admin, `/api/admin/hero/trends/${leak.id}/generate`);
  assert.equal(refused.status, 400);
  assert.equal(refused.body.error, 'UNVERIFIED_TREND');
  assert.equal((await post(admin, `/api/admin/hero/trends/${leak.id}/dismiss`)).body.trend.status, 'DISMISSED');

  const storm = d.trends.find((t: any) => /storm/.test(t.title));
  assert.equal((await post(admin, `/api/admin/hero/trends/${storm.id}/generate`)).status, 202);
  const made = await idle();
  assert.ok(byTrend(made, /storm/));
  const dup = await post(admin, `/api/admin/hero/trends/${storm.id}/generate`);
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error, 'CAMPAIGN_EXISTS');
  assert.equal((await post(admin, '/api/admin/hero/trends/nope/generate')).status, 404);
});

test('8. Automatic publication needs an explicit switch and never covers risky campaigns', async () => {
  const unconfirmed = await put(admin, '/api/admin/hero/settings', { publishMode: 'AUTO' });
  assert.equal(unconfirmed.status, 400);
  assert.equal(unconfirmed.body.error, 'CONFIRMATION_REQUIRED');
  assert.equal((await dashboard()).settings.publishMode, 'MANUAL');

  const on = await put(admin, '/api/admin/hero/settings', { publishMode: 'AUTO', confirmAutoPublish: true, relevanceThreshold: 10 });
  assert.equal(on.status, 200);
  assert.equal(on.body.settings.publishMode, 'AUTO');
  assert.ok(on.body.settings.autoPublishActivatedAt);
  assert.equal(on.body.settings.autoPublishActivatedBy, admin.name);

  // The storm draft (high sensitivity) was made before the switch and stays a draft.
  let d = await dashboard();
  const storm = byTrend(d, /storm/);
  assert.equal(storm.status, 'DRAFT');
  assert.equal(storm.policy.requiresManualReview, true);
  assert.match(storm.policy.reviewReasons.join(' '), /high sensitivity/);
  assert.match(storm.policy.reviewReasons.join(' '), /disaster/);

  // A clean, verified, low-risk trend publishes itself.
  const chef = d.trends.find((t: any) => /pop-up/.test(t.title));
  assert.equal((await post(admin, `/api/admin/hero/trends/${chef.id}/generate`)).status, 202);
  d = await idle();
  const auto = byTrend(d, /pop-up/);
  assert.equal(auto.status, 'APPROVED', JSON.stringify(auto.policy));
  assert.equal(auto.publishedBy, 'AUTO');
  assert.equal(auto.approvals.at(-1).action, 'AUTO_PUBLISHED');
  assert.equal((await activeCampaign()).id, auto.id);

  // A risky one generated under automatic mode still waits for a person.
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${storm.id}/reject`, { note: 'Not appropriate' })).body.campaign.status, 'REJECTED');
  const stormTrend = d.trends.find((t: any) => /storm/.test(t.title));
  assert.equal((await post(admin, `/api/admin/hero/trends/${stormTrend.id}/generate`)).status, 202);
  d = await idle();
  const redo = d.campaigns.find((c: any) => /storm/.test(c.trendTitle) && c.status !== 'REJECTED');
  assert.equal(redo.status, 'DRAFT', 'sensitive campaigns always need manual approval');

  assert.equal((await put(admin, '/api/admin/hero/settings', { publishMode: 'MANUAL', relevanceThreshold: 60 })).status, 200);
});

test('9. AI failures are recorded and never disturb the hero', async () => {
  const before = await activeCampaign();
  assert.ok(before, 'a campaign is live going in');

  // Trend search down.
  assert.equal((await put(admin, '/api/admin/hero/settings', { region: 'FAIL_DISCOVERY' })).status, 200);
  assert.equal((await post(admin, '/api/admin/hero/discover')).status, 202);
  let d = await idle();
  assert.equal(d.runs[0].ok, false);
  assert.match(d.runs[0].error, /trend search is down/);
  assert.equal(d.trends.length, 5, 'nothing was half-written');
  assert.equal((await activeCampaign()).id, before.id);

  // Copy generation down.
  const draft = d.campaigns.find((c: any) => /storm/.test(c.trendTitle) && c.status === 'DRAFT');
  assert.equal((await put(admin, '/api/admin/hero/settings', { region: 'FAIL_COPY' })).status, 200);
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${draft.id}/regenerate-copy`)).status, 202);
  d = await idle();
  assert.equal(d.runs[0].ok, false);
  assert.equal(d.campaigns.find((c: any) => c.id === draft.id).content.headline, draft.content.headline, 'the existing copy is kept');

  // Image generation down: the campaign keeps the image it had.
  assert.equal((await put(admin, '/api/admin/hero/settings', { region: 'FAIL_IMAGE' })).status, 200);
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${draft.id}/regenerate-copy`)).status, 202);
  await idle();
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${draft.id}/regenerate-image`)).status, 202);
  d = await idle();
  assert.equal(d.runs[0].kind, 'IMAGE');
  assert.equal(d.runs[0].ok, false);
  const failed = d.campaigns.find((c: any) => c.id === draft.id);
  assert.match(failed.imageError, /image generation is down/);
  assert.equal(failed.imageUrl, draft.imageUrl, 'the previous image is still there');
  assert.equal((await fetch(`${BASE_URL}${failed.imageUrl}`)).status, 200);

  // Back to normal: a new image replaces the old one.
  assert.equal((await put(admin, '/api/admin/hero/settings', { region: 'United States' })).status, 200);
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${draft.id}/regenerate-copy`)).status, 202);
  await idle();
  assert.equal((await post(admin, `/api/admin/hero/campaigns/${draft.id}/regenerate-image`)).status, 202);
  d = await idle();
  const fixed = d.campaigns.find((c: any) => c.id === draft.id);
  assert.equal(fixed.imageError, undefined);
  assert.notEqual(fixed.imageUrl, draft.imageUrl);
  assert.equal((await fetch(`${BASE_URL}${draft.imageUrl}`)).status, 404, 'the replaced image is removed');

  const still = await get(null, '/api/hero/active');
  assert.equal(still.status, 200);
  assert.equal(still.body.campaign.id, before.id);
});

test('10. Settings are validated and blocked terms apply to existing campaigns', async () => {
  assert.equal((await put(admin, '/api/admin/hero/settings', { discoveryIntervalHours: 1 })).status, 400);
  assert.equal((await put(admin, '/api/admin/hero/settings', { categories: ['POLITICS'] })).status, 400);
  const saved = await put(admin, '/api/admin/hero/settings', { discoveryEnabled: true, discoveryIntervalHours: 48, categories: ['SPORTS', 'SHOPPING'], durationDays: { SPORTS: 3 } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.settings.discoveryIntervalHours, 48);
  assert.deepEqual(saved.body.settings.categories, ['SPORTS', 'SHOPPING']);

  // Blocking a phrase the live campaign uses takes it off the hero.
  const live = await activeCampaign();
  assert.ok(live);
  const phrase = live.slides[0].headline.split(' ').slice(0, 2).join(' ').replace(/[.]/g, '').toLowerCase();
  assert.equal((await put(admin, '/api/admin/hero/settings', { blockedTerms: [phrase] })).status, 200);
  assert.equal(await activeCampaign(), null, 'falls back to the evergreen hero');
  assert.equal((await put(admin, '/api/admin/hero/settings', { blockedTerms: [], discoveryEnabled: false })).status, 200);
  assert.equal((await activeCampaign()).id, live.id);
});

test('11. Twice-a-month refresh: runs on schedule, once per period, and campaigns run until the next refresh', async () => {
  assert.equal((await put(admin, '/api/admin/hero/settings', { monthlyDays: [1, 30] })).status, 400);
  const on = await put(admin, '/api/admin/hero/settings', { discoveryEnabled: true, discoveryCadence: 'TWICE_MONTHLY', monthlyDays: [15, 1], categories: ['SPORTS', 'GAMING_ENTERTAINMENT', 'LIFESTYLE', 'TECHNOLOGY'] });
  assert.equal(on.status, 200, JSON.stringify(on.body));
  assert.equal(on.body.settings.discoveryCadence, 'TWICE_MONTHLY');
  assert.deepEqual(on.body.settings.monthlyDays, [1, 15]);

  // Discovery already ran earlier today, so this period is covered: the next
  // refresh is on the 1st or the 15th at 6 AM, and a tick now does nothing.
  let d = await dashboard();
  const next = new Date(d.nextRefreshAt);
  assert.ok(next.getTime() > Date.now());
  assert.ok([1, 15].includes(next.getDate()), `next refresh on ${next.toString()}`);
  assert.equal(next.getHours(), 6);
  const tick = (now?: Date) => api('/api/platform/schedule/hero-campaigns', { method: 'POST', headers: CRON_HEADERS, body: JSON.stringify(now ? { now: now.toISOString() } : {}) });
  // The dashboard lists only the latest jobs, so compare the newest one.
  const lastRunBefore = d.runs[0]?.id;
  assert.equal((await tick()).status, 200);
  d = await idle();
  assert.equal(d.runs[0]?.id, lastRunBefore, 'nothing runs between refresh days');
  assert.equal((await tick(new Date(next.getTime() - 60_000))).status, 200);
  d = await idle();
  assert.equal(d.runs[0]?.id, lastRunBefore, 'not a minute early');

  // The refresh day arrives: the scheduler runs discovery by itself.
  assert.equal((await tick(new Date(next.getTime() + 60_000))).status, 200);
  d = await idle();
  assert.notEqual(d.runs[0].id, lastRunBefore);
  assert.equal(d.runs[1]?.id, lastRunBefore, 'exactly one new run');
  assert.equal(d.runs[0].kind, 'DISCOVERY');
  assert.equal(d.runs[0].trigger, 'SCHEDULE');
  assert.equal(d.runs[0].ok, true, JSON.stringify(d.runs[0]));

  // A campaign drafted in this mode is scheduled to hand over at the next refresh.
  // (The simulated refresh day was past the earlier campaign's end, so it has retired.)
  assert.ok(!d.campaigns.some((c: any) => /pop-up/.test(c.trendTitle) && c.status !== 'RETIRED'));
  const chef = d.trends.find((t: any) => /pop-up/.test(t.title));
  assert.equal((await post(admin, `/api/admin/hero/trends/${chef.id}/generate`)).status, 202);
  d = await idle();
  const fresh = d.campaigns.find((c: any) => /pop-up/.test(c.trendTitle) && c.status === 'DRAFT');
  assert.ok(fresh, 'a new draft with image and copy');
  assert.ok(fresh.imageUrl && fresh.content.headline && fresh.content.description && fresh.content.ctaLabel);
  const expectedEnd = Math.min(next.getTime(), new Date(chef.suggestedExpiresAt).getTime());
  assert.equal(new Date(fresh.endAt).getTime(), expectedEnd, 'ends at the next refresh (or when the trend stops being timely)');

  assert.equal((await put(admin, '/api/admin/hero/settings', { discoveryEnabled: false, discoveryCadence: 'INTERVAL' })).status, 200);
  assert.equal((await dashboard()).nextRefreshAt, null);
});

test('12. An administrator can add a trend by hand and draft a campaign from it', async () => {
  const good = { title: 'Thanksgiving travel week', description: 'Families are planning Thanksgiving trips and splitting the cost of travel and the meal.', category: 'HOLIDAYS_SEASONAL', sourceUrl: 'https://news.example.test/thanksgiving-travel', eventDate: iso(6) };
  assert.equal((await post(member, '/api/admin/hero/trends', good)).status, 403);
  assert.equal((await post(admin, '/api/admin/hero/trends', { ...good, sourceUrl: '' })).status, 400, 'a trend needs a source');
  assert.equal((await post(admin, '/api/admin/hero/trends', { ...good, sourceUrl: 'javascript:alert(1)' })).status, 400);
  assert.equal((await post(admin, '/api/admin/hero/trends', { ...good, category: 'POLITICS' })).status, 400);
  assert.equal((await post(admin, '/api/admin/hero/trends', { ...good, title: 'x' })).status, 400);
  assert.equal((await post(admin, '/api/admin/hero/trends', { ...good, eventDate: 'someday' })).status, 400);

  const added = await post(admin, '/api/admin/hero/trends', good);
  assert.equal(added.status, 200, JSON.stringify(added.body));
  const trend = added.body.trend;
  assert.equal(trend.verified, true);
  assert.equal(trend.sensitivity, 'LOW');
  assert.equal(trend.sourceName, 'news.example.test');
  assert.equal(trend.status, 'NEW');
  assert.equal(new Date(trend.suggestedExpiresAt).getTime(), new Date(good.eventDate).getTime() + DAY, 'timely until a day after the event');
  assert.equal((await post(admin, '/api/admin/hero/trends', { ...good, title: 'Thanksgiving Travel Week!' })).status, 409, 'no duplicates');

  // Sensitive subjects and brand names are flagged exactly as for discovered trends.
  const risky = await post(admin, '/api/admin/hero/trends', { title: 'Election night watch parties', description: 'Friends are gathering to watch the election results together.', category: 'CULTURAL_EVENTS', sourceUrl: 'https://news.example.test/election' });
  assert.equal(risky.body.trend.sensitivity, 'HIGH');
  const branded = await post(admin, '/api/admin/hero/trends', { title: 'New console goes on sale', description: 'A new games console goes on sale next week and stores expect queues.', category: 'GAMING_ENTERTAINMENT', sourceUrl: 'https://news.example.test/console', brandsMentioned: ['PlayBox'] });
  assert.deepEqual(branded.body.trend.brandsMentioned, ['PlayBox']);

  assert.equal((await post(admin, `/api/admin/hero/trends/${trend.id}/generate`)).status, 202);
  const d = await idle();
  const campaign = byTrend(d, /Thanksgiving/);
  assert.ok(campaign, JSON.stringify(d.runs[0]));
  assert.equal(campaign.status, 'DRAFT');
  assert.ok(campaign.concepts.length >= 3 && campaign.imageUrl);
  assert.equal(campaign.policy.ok, true);
  assert.equal(campaign.policy.requiresManualReview, false);
  assert.equal(campaign.trendSourceUrl, good.sourceUrl);
});
