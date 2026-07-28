const CACHE_NAME = 'gig-mutual-pwa-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache standard GET requests
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Ignore non-http(s) schemes like chrome-extension://, file://, data:
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  // Skip backend API network calls and web sockets
  if (url.includes('/api/')) return;

  // Navigation / HTML requests: Network first, fallback to cached index.html
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // Static assets: Cache first with network fallback & safe cache update
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update for static assets
        fetch(event.request).then((fetchRes) => {
          if (fetchRes && fetchRes.status === 200 && fetchRes.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => {
              try {
                cache.put(event.request, fetchRes.clone());
              } catch (e) {
                // Ignore caching errors for uncacheable requests
              }
            });
          }
        }).catch(() => {/* Offline */});
        return cachedResponse;
      }

      return fetch(event.request).then((fetchRes) => {
        if (!fetchRes || fetchRes.status !== 200 || fetchRes.type !== 'basic') {
          return fetchRes;
        }

        const resClone = fetchRes.clone();
        caches.open(CACHE_NAME).then((cache) => {
          try {
            cache.put(event.request, resClone);
          } catch (e) {
            // Ignore caching errors for uncacheable requests
          }
        });

        return fetchRes;
      }).catch(() => {
        // If asset fetch fails (e.g. offline), return offline fallback if needed
        return new Response('Network error', { status: 408, headers: { 'Content-Type': 'text/plain' } });
      });
    })
  );
});

