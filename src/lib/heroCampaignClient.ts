// Landing-page side of AI hero campaigns: load the active campaign (if any),
// make sure its image really loads before showing it, and report impressions,
// clicks and conversions. Every failure here ends the same way: no campaign,
// so the evergreen hero is shown.
import { useEffect, useState } from 'react';
import type { PublicHeroCampaign, PublicHeroSlide } from './heroCampaigns';
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

function isUsableSlide(s: any): s is PublicHeroSlide {
  return Boolean(s && Number.isInteger(s.index) && typeof s.headline === 'string' && s.headline
    && typeof s.description === 'string' && typeof s.ctaLabel === 'string' && s.ctaLabel
    && (HERO_CTA_DESTINATIONS as readonly string[]).includes(s.ctaDestination)
    && typeof s.imageUrl === 'string' && s.imageUrl.startsWith('/api/hero/assets/'));
}

// The campaign with only its well-formed slides, or null when none is left.
function usable(c: any): PublicHeroCampaign | null {
  if (!c || typeof c.id !== 'string' || typeof c.endAt !== 'string' || !(new Date(c.endAt).getTime() > Date.now())) return null;
  const slides = Array.isArray(c.slides) ? c.slides.filter(isUsableSlide) : [];
  return slides.length ? { id: c.id, endAt: c.endAt, slides } : null;
}

function readCache(): PublicHeroCampaign | null {
  try {
    const raw = storage('session')?.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, campaign } = JSON.parse(raw);
    return Date.now() - at < CACHE_MS ? usable(campaign) : null;
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
export function useHeroCampaign(enabled: boolean): { campaign: PublicHeroCampaign | null; dismiss: () => void; dropSlide: (index: number) => void } {
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
          next = usable(data?.campaign);
          try {
            storage('session')?.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), campaign: next }));
          } catch {
            // ignore
          }
        }
        // Only show slides whose image has actually loaded.
        if (next) {
          const loaded = await Promise.all(next.slides.map(s => preload(s.imageUrl)));
          const slides = next.slides.filter((_, i) => loaded[i]);
          next = slides.length ? { ...next, slides } : null;
        }
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

  // A slide whose image fails later is dropped; with none left, the evergreen hero returns.
  const dropSlide = (index: number) => setCampaign(c => {
    if (!c) return c;
    const slides = c.slides.filter(s => s.index !== index);
    return slides.length ? { ...c, slides } : null;
  });

  return { campaign, dismiss: () => setCampaign(null), dropSlide };
}
