// Landing-page side of AI hero campaigns: load the active campaign (if any),
// make sure its image really loads before showing it, and report impressions,
// clicks and conversions. Every failure here ends the same way: no campaign,
// so the evergreen hero is shown.
import { useEffect, useState } from 'react';
import type { PublicHeroCampaign } from './heroCampaigns';
import { HERO_CTA_DESTINATIONS } from './heroCampaigns';

const CACHE_KEY = 'mp_hero_campaign';
const SEEN_KEY = 'mp_hero_seen';
const ATTRIBUTION_KEY = 'mp_hero_attribution';
const CACHE_MS = 60_000;
const ATTRIBUTION_MS = 7 * 86_400_000;

const storage = (kind: 'local' | 'session'): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

function isUsable(c: any): c is PublicHeroCampaign {
  return Boolean(c && typeof c.id === 'string' && typeof c.headline === 'string' && c.headline
    && typeof c.description === 'string' && typeof c.ctaLabel === 'string' && c.ctaLabel
    && (HERO_CTA_DESTINATIONS as readonly string[]).includes(c.ctaDestination)
    && typeof c.imageUrl === 'string' && c.imageUrl.startsWith('/api/hero/assets/')
    && typeof c.endAt === 'string' && new Date(c.endAt).getTime() > Date.now());
}

function readCache(): PublicHeroCampaign | null {
  try {
    const raw = storage('session')?.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, campaign } = JSON.parse(raw);
    return Date.now() - at < CACHE_MS && isUsable(campaign) ? campaign : null;
  } catch {
    return null;
  }
}

function preload(url: string): Promise<boolean> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

const reported = new Set<string>();
function post(path: string, body: unknown): void {
  try {
    fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
  } catch {
    // Tracking never interrupts the page.
  }
}

function trackImpression(campaignId: string): void {
  if (reported.has(campaignId)) return;
  reported.add(campaignId);
  const local = storage('local');
  let unique = false;
  try {
    const seen: string[] = JSON.parse(local?.getItem(SEEN_KEY) || '[]');
    unique = !seen.includes(campaignId);
    if (unique) local?.setItem(SEEN_KEY, JSON.stringify([campaignId, ...seen].slice(0, 30)));
  } catch {
    unique = false;
  }
  post('/api/hero/events', { campaignId, type: 'impression', unique });
}

// A click on the campaign button: counted, and remembered so a later sign-up
// or first pod can be credited to the campaign.
export function trackHeroClick(campaignId: string): void {
  post('/api/hero/events', { campaignId, type: 'click' });
  try {
    storage('local')?.setItem(ATTRIBUTION_KEY, JSON.stringify({ campaignId, at: Date.now() }));
  } catch {
    // ignore
  }
}

// Called once the visitor is signed in, and again after they create a pod. The
// server decides from its own records whether anything counts.
export function reportHeroConversion(): void {
  try {
    const raw = storage('local')?.getItem(ATTRIBUTION_KEY);
    if (!raw) return;
    const { campaignId, at } = JSON.parse(raw);
    if (typeof campaignId !== 'string' || Date.now() - at > ATTRIBUTION_MS) {
      storage('local')?.removeItem(ATTRIBUTION_KEY);
      return;
    }
    post('/api/hero/conversion', { campaignId });
  } catch {
    // ignore
  }
}

// The campaign to show, or null (evergreen hero). `enabled` is false for
// languages the campaign copy is not written in.
export function useHeroCampaign(enabled: boolean): { campaign: PublicHeroCampaign | null; dismiss: () => void } {
  const [campaign, setCampaign] = useState<PublicHeroCampaign | null>(() => (enabled ? readCache() : null));

  useEffect(() => {
    if (!enabled) { setCampaign(null); return; }
    let cancelled = false;
    (async () => {
      try {
        let next = readCache();
        if (!next) {
          const res = await fetch('/api/hero/active', { headers: { Accept: 'application/json' } });
          const data = res.ok ? await res.json() : null;
          next = isUsable(data?.campaign) ? data.campaign : null;
          try {
            storage('session')?.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), campaign: next }));
          } catch {
            // ignore
          }
        }
        // Only show a campaign whose image has actually loaded.
        if (next && !(await preload(next.imageUrl))) next = null;
        if (cancelled) return;
        setCampaign(next);
        if (next) trackImpression(next.id);
      } catch {
        if (!cancelled) setCampaign(null);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // Stop showing it the moment it ends, even on a page left open.
  useEffect(() => {
    if (!campaign) return;
    const ms = new Date(campaign.endAt).getTime() - Date.now();
    if (ms <= 0) { setCampaign(null); return; }
    const timer = window.setTimeout(() => setCampaign(null), Math.min(ms, 2_000_000_000));
    return () => window.clearTimeout(timer);
  }, [campaign]);

  return { campaign, dismiss: () => setCampaign(null) };
}
