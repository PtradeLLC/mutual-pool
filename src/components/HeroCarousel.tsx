import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles } from 'lucide-react';
import type { PublicHeroCampaign, PublicHeroSlide } from '../lib/heroCampaigns';
import { useTranslation, type TranslationKey } from '../i18n';
import familyImg from '../assets/images/hero/family.jpg';
import nurseImg from '../assets/images/hero/nurse.jpg';
import shopOwnerImg from '../assets/images/hero/shop-owner.jpg';
import friendsImg from '../assets/images/hero/friends.jpg';
import teacherImg from '../assets/images/hero/teacher.jpg';
import deliveryImg from '../assets/images/hero/delivery.jpg';

// Landing-page hero photos: everyday people saving together, gig workers
// included. Photos are generated with scripts/make-hero-images.ts.
export interface HeroSlide {
  id: string;
  src: string;
  // Set on the slides of a live AI campaign.
  campaignSlide?: PublicHeroSlide;
}

export const HERO_SLIDES: HeroSlide[] = [
  { id: 'family', src: familyImg },
  { id: 'nurse', src: nurseImg },
  { id: 'shopOwner', src: shopOwnerImg },
  { id: 'friends', src: friendsImg },
  { id: 'teacher', src: teacherImg },
  { id: 'gig', src: deliveryImg },
];

const INTERVAL_MS = 5000;
// Campaign slides carry copy to read, so each stays up longer than a photo.
const CAMPAIGN_INTERVAL_MS = 9000;

interface HeroCarouselProps {
  // Badges drawn over the photos; receives the slide being shown.
  renderOverlay?: (slide: HeroSlide) => React.ReactNode;
  // The active AI campaign, if any. While one is live the carousel shows only
  // its slides; without one it shows the evergreen photos.
  campaign?: PublicHeroCampaign | null;
  onCampaignCta?: (campaign: PublicHeroCampaign, slide: PublicHeroSlide) => void;
  // A campaign slide's image failed to load: stop showing that slide.
  onCampaignSlideError?: (index: number) => void;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ renderOverlay, campaign, onCampaignCta, onCampaignSlideError }) => {
  const { t } = useTranslation();
  const k = (key: string) => t(key as TranslationKey);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchX = useRef<number | null>(null);
  const slides: HeroSlide[] = campaign?.slides.length
    ? campaign.slides.map(s => ({ id: `campaign_${campaign.id}_${s.index}`, src: s.imageUrl, campaignSlide: s }))
    : HERO_SLIDES;
  const count = slides.length;
  // Changes when a campaign arrives or ends, or its set of slides changes.
  const campaignId = campaign ? `${campaign.id}:${campaign.slides.map(s => s.index).join(',')}` : undefined;

  // A campaign arriving (or ending) brings the carousel back to the first slide.
  // Done while rendering, not in an effect, so no frame shows the wrong photo.
  const [shownCampaignId, setShownCampaignId] = useState(campaignId);
  if (shownCampaignId !== campaignId) {
    setShownCampaignId(campaignId);
    setIndex(0);
  }

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    if (count < 2) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setIndex(i => (i + 1) % count);
    }, campaignId ? CAMPAIGN_INTERVAL_MS : INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, count, index, campaignId]);

  const slide = slides[Math.min(index, count - 1)];
  const shownCampaignSlide = campaign ? slide.campaignSlide : undefined;

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-[#DDE1E6] shadow-xl bg-[#F8FAFC] aspect-[4/3] max-h-[480px] w-full"
      role="region"
      aria-roledescription="carousel"
      aria-label={k('hero.carouselLabel')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={e => { touchX.current = e.touches[0]?.clientX ?? null; setPaused(true); }}
      onTouchEnd={e => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        setPaused(false);
        if (start === null || end === undefined || Math.abs(end - start) < 40) return;
        go(index + (end < start ? 1 : -1));
      }}
    >
      {slides.map((s, i) => (
        <img
          key={s.id}
          src={s.src}
          alt={s.campaignSlide ? (s.campaignSlide.imageAlt || s.campaignSlide.headline) : k(`hero.slide.${s.id}.alt`)}
          onError={s.campaignSlide ? () => onCampaignSlideError?.(s.campaignSlide!.index) : undefined}
          aria-hidden={i !== index}
          loading={i === 0 ? 'eager' : 'lazy'}
          decoding="async"
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ease-in-out ${i === index ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}

      <div className={`absolute inset-0 bg-gradient-to-t pointer-events-none transition-colors duration-700 ${shownCampaignSlide ? 'from-black/85 via-black/35 to-black/10' : 'from-black/40 via-transparent to-transparent'}`} />

      {shownCampaignSlide && campaign ? (
        <div className="absolute inset-x-0 bottom-0 px-14 pb-4 sm:px-16 sm:pb-5 text-white">
          {shownCampaignSlide.label && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> {shownCampaignSlide.label}
            </span>
          )}
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-extrabold leading-tight tracking-tight drop-shadow-md">{shownCampaignSlide.headline}</p>
          <p className="mt-1 text-xs sm:text-sm text-white/90 leading-snug hidden min-[360px]:[display:-webkit-box] line-clamp-2 sm:line-clamp-3 drop-shadow">{shownCampaignSlide.description}</p>
          <button
            type="button"
            onClick={() => onCampaignCta?.(campaign, shownCampaignSlide)}
            className="mt-2.5 sm:mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-white hover:bg-blue-50 text-[#005FB8] font-bold text-xs sm:text-sm shadow-md cursor-pointer whitespace-nowrap"
          >
            {shownCampaignSlide.ctaLabel} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        renderOverlay?.(slide)
      )}

      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label={k('hero.carouselPrev')}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#111827] shadow-md flex items-center justify-center backdrop-blur-sm cursor-pointer"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label={k('hero.carouselNext')}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#111827] shadow-md flex items-center justify-center backdrop-blur-sm cursor-pointer"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      <div className="absolute top-4 left-4 sm:top-5 sm:left-5 flex gap-1.5 p-1.5 rounded-full bg-black/25 backdrop-blur-sm">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(i)}
            aria-label={`${k('hero.carouselShow')} ${i + 1}`}
            aria-current={i === index}
            className={`h-2 rounded-full transition-all cursor-pointer ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/90'}`}
          />
        ))}
      </div>
    </div>
  );
};
