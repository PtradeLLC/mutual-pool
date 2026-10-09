/**
 * Utility for smooth scrolling to specific dashboard sections and tabs,
 * dynamically taking into account the sticky navigation header height.
 */
export function scrollToTabSection(tabId: string, customOffset?: number) {
  if (typeof window === 'undefined') return;

  const attemptScroll = (retries = 0) => {
    // Try to locate the specific tab section first, then fallback to general main tab content container
    const target =
      document.getElementById(`section-${tabId}`) ||
      document.getElementById(`tab-${tabId}`) ||
      document.getElementById('main-tab-content');

    if (target) {
      const headerEl = document.querySelector('header');
      // Sticky header height + breathing room padding (defaults to 16px)
      const headerOffset = customOffset ?? (headerEl ? headerEl.offsetHeight + 16 : 120);
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth',
      });
    } else if (retries < 8) {
      setTimeout(() => attemptScroll(retries + 1), 30);
    }
  };

  // Small delay to allow React state updates / newly rendered tab component to commit to DOM
  setTimeout(() => attemptScroll(0), 40);
}
