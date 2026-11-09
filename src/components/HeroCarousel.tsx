import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

interface HeroCarouselProps {
  // Badges drawn over the photos; receives the slide being shown.
  renderOverlay?: (slide: HeroSlide) => React.ReactNode;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ renderOverlay }) => {
  const { t } = useTranslation();
  const k = (key: string) => t(key as TranslationKey);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = HERO_SLIDES.length;

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
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setIndex(i => (i + 1) % count);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, count]);

  const slide = HERO_SLIDES[index];

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
      {HERO_SLIDES.map((s, i) => (
        <img
          key={s.id}
          src={s.src}
          alt={k(`hero.slide.${s.id}.alt`)}
          aria-hidden={i !== index}
          loading={i === 0 ? 'eager' : 'lazy'}
          decoding="async"
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ease-in-out ${i === index ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

      {renderOverlay?.(slide)}

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
        {HERO_SLIDES.map((s, i) => (
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
