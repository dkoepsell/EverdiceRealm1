// Bump this on any change to force old caches to purge on activate.
const CACHE_NAME = 'everdice-offline-v2';
const LEARN_CACHE_NAME = 'everdice-learn-v1';

const STATIC_ASSETS = [
  '/offline.html'
];

const LEARN_ROUTES = [
  '/learn',
  '/dm-toolkit'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== LEARN_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  // HTML / navigations: NETWORK-FIRST so new deploys always show up. Cache-first
  // here was the bug that pinned users to a stale index.html (and thus stale
  // bundles). Fall back to cache, then the offline page.
  const isNavigation = event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html');
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  // Content-hashed static assets (js/css/fonts/images): cache-first is safe
  // because the filename changes whenever the content changes.
  const isHashedAsset = url.pathname.startsWith('/assets/') || url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff2?)$/);
  if (isHashedAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        });
      }).catch(() => new Response('Offline', { status: 503, statusText: 'Service Unavailable' }))
    );
    return;
  }

  // Everything else: just go to network.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_LEARN_CONTENT') {
    event.waitUntil(
      caches.open(LEARN_CACHE_NAME).then(async (cache) => {
        const urlsToCache = ['/learn', '/dm-toolkit'];
        for (const u of urlsToCache) {
          try {
            const response = await fetch(u);
            if (response.ok) await cache.put(u, response);
          } catch (err) {
            console.log('[SW] Failed to cache:', u, err);
          }
        }
        if (event.source) event.source.postMessage({ type: 'LEARN_CONTENT_CACHED', success: true });
      }).catch((err) => {
        console.error('[SW] Cache error:', err);
        if (event.source) event.source.postMessage({ type: 'LEARN_CONTENT_CACHED', success: false });
      })
    );
  }
});
