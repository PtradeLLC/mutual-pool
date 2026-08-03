const CACHE_NAME = 'gig-mutual-pwa-v5';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png'
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
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const reqUrl = event.request.url;

  // STRICT CHECK: Ignore all unsupported schemes (chrome-extension://, moz-extension://, data:, blob:, etc.)
  if (!reqUrl.startsWith('http://') && !reqUrl.startsWith('https://')) {
    return;
  }

  // Skip backend API calls, dev modules, vite assets, and websockets
  if (reqUrl.includes('/api/') || reqUrl.includes('/@vite/') || reqUrl.includes('/src/') || reqUrl.includes('node_modules')) return;

  // Safe helper to cache a response without throwing unhandled promise rejections
  const safeCachePut = (request, response) => {
    // Never attempt to cache non-http(s) or opaque chrome-extension requests
    if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) return;
    if (!response || response.status !== 200) return;

    caches.open(CACHE_NAME).then((cache) => {
      cache.put(request, response).catch(() => {
        // Silently ignore cache storage errors (e.g. quota, unsupported scheme)
      });
    }).catch(() => {});
  };

  // Navigation / HTML page requests: Network first with cache fallback
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            safeCachePut(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html').then((match) => match || caches.match('/'));
        })
    );
    return;
  }

  // Static assets: Cache first with network fallback & background update
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Background cache revalidation
        fetch(event.request).then((fetchRes) => {
          if (fetchRes && fetchRes.status === 200) {
            safeCachePut(event.request, fetchRes.clone());
          }
        }).catch(() => {/* Ignore offline background fetch failure */});

        return cachedResponse;
      }

      return fetch(event.request).then((fetchRes) => {
        if (fetchRes && fetchRes.status === 200) {
          safeCachePut(event.request, fetchRes.clone());
        }
        return fetchRes;
      }).catch(() => {
        return new Response('Network error', { status: 408, headers: { 'Content-Type': 'text/plain' } });
      });
    })
  );
});
