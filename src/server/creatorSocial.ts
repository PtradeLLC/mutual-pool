// Connecting a creator's Instagram, TikTok or YouTube account: proves they own
// it and reads the follower count. We keep the account id, handle and count;
// access tokens are used once and never stored.
//
// Each platform needs an app registered with it (env below). A platform without
// credentials shows as unavailable; admins can then verify an account by hand.
//
//   Instagram  INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET   (Instagram API with Instagram Login,
//              business/creator accounts, scope instagram_business_basic)
//   TikTok     TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET   (Login Kit, scopes user.info.basic,user.info.stats)
//   YouTube    GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET (scope youtube.readonly)
//
// Redirect URI registered with each platform:
//   <APP_URL>/api/creator/connect/<platform>/callback

import crypto from 'node:crypto';
import type { SocialPlatform } from '../types';

export interface SocialProfile {
  externalId: string;
  handle: string;
  followers: number;
}

type Env = Record<string, string | undefined>;

export function platformConfigured(platform: SocialPlatform, env: Env = process.env): boolean {
  if (platform === 'instagram') return Boolean(env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET);
  if (platform === 'tiktok') return Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET);
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export function redirectUri(appUrl: string, platform: SocialPlatform): string {
  return `${appUrl.replace(/\/+$/, '')}/api/creator/connect/${platform}/callback`;
}

// ---------------------------------------------------------------------------
// Signed state: ties the callback to the signed-in creator for 15 minutes.
// ---------------------------------------------------------------------------

const STATE_TTL_MS = 15 * 60 * 1000;
const processSecret = crypto.randomBytes(32);

function stateSecret(env: Env): Buffer {
  const s = env.CREATOR_OAUTH_STATE_SECRET || env.CRON_SECRET;
  return s ? crypto.createHash('sha256').update(`creator-oauth:${s}`).digest() : processSecret;
}

export function signState(userId: string, platform: SocialPlatform, now = Date.now(), env: Env = process.env): string {
  const body = Buffer.from(JSON.stringify({ u: userId, p: platform, e: now + STATE_TTL_MS, n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
  const sig = crypto.createHmac('sha256', stateSecret(env)).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyState(state: string, platform: SocialPlatform, now = Date.now(), env: Env = process.env): string | null {
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', stateSecret(env)).update(body).digest('base64url');
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (parsed.p !== platform || typeof parsed.u !== 'string' || !(parsed.e > now)) return null;
    return parsed.u;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Authorize URLs
// ---------------------------------------------------------------------------

export function authorizeUrl(platform: SocialPlatform, state: string, appUrl: string, env: Env = process.env): string {
  const redirect = redirectUri(appUrl, platform);
  if (platform === 'instagram') {
    const q = new URLSearchParams({ client_id: env.INSTAGRAM_APP_ID || '', redirect_uri: redirect, response_type: 'code', scope: 'instagram_business_basic', state });
    return `https://www.instagram.com/oauth/authorize?${q}`;
  }
  if (platform === 'tiktok') {
    const q = new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY || '', redirect_uri: redirect, response_type: 'code', scope: 'user.info.basic,user.info.stats', state });
    return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
  }
  const q = new URLSearchParams({ client_id: env.GOOGLE_OAUTH_CLIENT_ID || '', redirect_uri: redirect, response_type: 'code', scope: 'https://www.googleapis.com/auth/youtube.readonly', state, access_type: 'online', prompt: 'select_account' });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

// ---------------------------------------------------------------------------
// Code exchange + profile read
// ---------------------------------------------------------------------------

type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

async function postForm(fetchFn: FetchLike, url: string, form: Record<string, string>): Promise<any> {
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`token exchange failed (${res.status}): ${data?.error_message || data?.error_description || data?.error?.message || data?.error || 'unknown'}`);
  return data;
}

async function getJson(fetchFn: FetchLike, url: string, token?: string): Promise<any> {
  const res = await fetchFn(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`profile read failed (${res.status}): ${data?.error?.message || data?.error || 'unknown'}`);
  return data;
}

export async function exchangeAndReadProfile(
  platform: SocialPlatform,
  code: string,
  appUrl: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
  env: Env = process.env,
): Promise<SocialProfile> {
  const redirect = redirectUri(appUrl, platform);
  if (platform === 'instagram') {
    const tok = await postForm(fetchFn, 'https://api.instagram.com/oauth/access_token', {
      client_id: env.INSTAGRAM_APP_ID || '', client_secret: env.INSTAGRAM_APP_SECRET || '',
      grant_type: 'authorization_code', redirect_uri: redirect, code,
    });
    const token = tok.access_token;
    const me = await getJson(fetchFn, `https://graph.instagram.com/v21.0/me?fields=user_id,username,followers_count&access_token=${encodeURIComponent(token)}`);
    return { externalId: String(me.user_id || me.id || tok.user_id), handle: String(me.username || ''), followers: Number(me.followers_count) || 0 };
  }
  if (platform === 'tiktok') {
    const tok = await postForm(fetchFn, 'https://open.tiktokapis.com/v2/oauth/token/', {
      client_key: env.TIKTOK_CLIENT_KEY || '', client_secret: env.TIKTOK_CLIENT_SECRET || '',
      grant_type: 'authorization_code', redirect_uri: redirect, code,
    });
    const info = await getJson(fetchFn, 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count', tok.access_token);
    const u = info?.data?.user || {};
    return { externalId: String(u.open_id || tok.open_id), handle: String(u.display_name || ''), followers: Number(u.follower_count) || 0 };
  }
  const tok = await postForm(fetchFn, 'https://oauth2.googleapis.com/token', {
    client_id: env.GOOGLE_OAUTH_CLIENT_ID || '', client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    grant_type: 'authorization_code', redirect_uri: redirect, code,
  });
  const ch = await getJson(fetchFn, 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', tok.access_token);
  const item = (ch.items || [])[0];
  if (!item) throw new Error('No YouTube channel on this Google account.');
  const hidden = Boolean(item.statistics?.hiddenSubscriberCount);
  return {
    externalId: String(item.id),
    handle: String(item.snippet?.customUrl || item.snippet?.title || ''),
    followers: hidden ? 0 : Number(item.statistics?.subscriberCount) || 0,
  };
}
