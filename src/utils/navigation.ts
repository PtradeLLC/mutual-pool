/**
 * Utility for smooth scrolling to specific dashboard sections and tabs,
 * dynamically taking into account the sticky navigation header height,
 * handling responsive layout shifts, iframe containers, and asynchronous re-renders.
 */
export function scrollToTabSection(tabId: string, customOffset?: number) {
  if (typeof window === 'undefined') return;

  const findTargetElement = (): HTMLElement | null => {
    // 1. Direct section ID
    const direct = document.getElementById(`section-${tabId}`);
    if (direct) return direct;

    // 2. Tab aliases
    if (tabId === 'my-pods') {
      const el = document.getElementById('section-my-pods');
      if (el) return el;
    }
    if (tabId === 'explore-pods') {
      const el = document.getElementById('section-explore-pods');
      if (el) return el;
    }
    if (tabId === 'perks') {
      const el = document.getElementById('section-perks');
      if (el) return el;
    }
    if (tabId === 'campaigns') {
      const el = document.getElementById('section-campaigns');
      if (el) return el;
    }
    if (tabId === 'audit-log') {
      const el = document.getElementById('section-audit-log');
      if (el) return el;
    }
    if (tabId === 'admin-ops') {
      const el = document.getElementById('section-admin-ops');
      if (el) return el;
    }

    // 3. Data attribute fallback
    const byData = document.querySelector(`[data-section="${tabId}"]`);
    if (byData) return byData as HTMLElement;

    // 4. Main tab content container fallback
    const mainContainer = document.getElementById('main-tab-content');
    if (mainContainer) return mainContainer;

    return null;
  };

  const getHeaderHeight = (): number => {
    const headerEl = document.querySelector('header');
    if (headerEl) {
      const rect = headerEl.getBoundingClientRect();
      if (rect.height > 0) return rect.height;
    }
    return 75; // Safe default desktop/mobile header height
  };

  const performScroll = (target: HTMLElement) => {
    const headerHeight = getHeaderHeight();
    const offsetPadding = customOffset ?? (headerHeight + 20);

    // Method A: scrollIntoView with block: 'start'
    // Uses the element's CSS scroll-margin-top automatically
    try {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    } catch {
      target.scrollIntoView(true);
    }

    // Method B: Explicit window and documentElement scrollTo
    // Computes absolute position in case scrollIntoView is constrained by nested containers
    const rect = target.getBoundingClientRect();
    const currentScrollY =
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;
    const targetScrollY = Math.max(0, rect.top + currentScrollY - offsetPadding);

    // Only scroll if difference is noticeable (> 10px) to prevent twitching
    if (Math.abs(currentScrollY - targetScrollY) > 10) {
      window.scrollTo({
        top: targetScrollY,
        behavior: 'smooth',
      });

      if (document.documentElement && document.documentElement.scrollTop !== undefined) {
        document.documentElement.scrollTo({
          top: targetScrollY,
          behavior: 'smooth',
        });
      }
    }
  };

  // Immediate frame + Staggered retry intervals (15ms, 60ms, 150ms, 300ms, 550ms)
  // Guarantees that even if components re-render or expand content asynchronously,
  // the viewport smoothly glides directly to the selected section.
  const delays = [15, 60, 150, 300, 550];
  delays.forEach((delay) => {
    setTimeout(() => {
      const target = findTargetElement();
      if (target) {
        performScroll(target);
      }
    }, delay);
  });
}
