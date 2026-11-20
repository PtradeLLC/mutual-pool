// Lazy-loaded screens after a deploy.
//
// Each deploy replaces the hashed page files under /assets. A browser still
// running the previous version (an open tab, or Safari restoring one) then asks
// for a file that no longer exists and the import fails. Reloading picks up the
// new version. One reload per session is allowed, so a real outage shows the
// error screen instead of reloading forever.
import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'mp_chunk_reload_at';
const RELOAD_WINDOW_MS = 60_000;

export function isChunkLoadError(err: unknown): boolean {
  const message = String((err as any)?.message || err || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError|Loading chunk \S+ failed/i.test(message);
}

// Reloads the page once. Returns false when a reload already happened within
// the last minute (the new version did not fix it).
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Without storage, still reload once: the flag below stops a loop in this page.
    if ((window as any).__mpChunkReloaded) return false;
    (window as any).__mpChunkReloaded = true;
  }
  window.location.reload();
  return true;
}

export function lazyWithReload<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await load();
    } catch (err) {
      if (isChunkLoadError(err) && reloadForNewVersion()) {
        // Keep the spinner up while the page reloads.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

// Vite reports failed preloads of a screen's dependencies with this event.
export function installChunkReloadHandler(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewVersion()) event.preventDefault();
  });
}
