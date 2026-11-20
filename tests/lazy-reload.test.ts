// Reload once when a page file from an older deploy is gone (src/lib/lazyWithReload.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { isChunkLoadError, reloadForNewVersion } from '../src/lib/lazyWithReload';

test('recognises the ways browsers report a missing page file', () => {
  assert.ok(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://themutualpool.com/assets/LandingPage-DAOj_nB0.js')));
  assert.ok(isChunkLoadError(new TypeError('Importing a module script failed.')));
  assert.ok(isChunkLoadError(new Error('error loading dynamically imported module: https://x/assets/a.js')));
  assert.ok(isChunkLoadError(new Error('Unable to preload CSS for /assets/index.css')));
  assert.equal(isChunkLoadError(new Error('Cannot read properties of undefined')), false);
});

test('reloads once, then lets the error show instead of looping', () => {
  const store = new Map<string, string>();
  let reloads = 0;
  (globalThis as any).sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  (globalThis as any).window = { location: { reload: () => { reloads += 1; } } };
  try {
    assert.equal(reloadForNewVersion(), true);
    assert.equal(reloads, 1);
    assert.equal(reloadForNewVersion(), false, 'a second failure right after the reload is a real outage');
    assert.equal(reloads, 1);
    store.set('mp_chunk_reload_at', String(Date.now() - 120_000));
    assert.equal(reloadForNewVersion(), true, 'a later deploy can reload again');
  } finally {
    delete (globalThis as any).sessionStorage;
    delete (globalThis as any).window;
  }
});
