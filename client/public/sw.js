const CACHE_NAME = 'everdice-offline-v1';
const LEARN_CACHE_NAME = 'everdice-learn-v1';

const STATIC_ASSETS = [
  '/',
  '/learn',
  '/dm-toolkit',
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
      console.log('[SW] Precaching static assets...');
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
  
  if (event.request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  const isLearnContent = LEARN_ROUTES.some(route => url.pathname.startsWith(route));
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        if (isLearnContent || url.pathname === '/' || url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_LEARN_CONTENT') {
    console.log('[SW] Caching learn content...');
    
    event.waitUntil(
      caches.open(LEARN_CACHE_NAME).then(async (cache) => {
        const urlsToCache = [
          '/',
          '/learn',
          '/dm-toolkit'
        ];
        
        for (const url of urlsToCache) {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response);
              console.log('[SW] Cached:', url);
            }
          } catch (err) {
            console.log('[SW] Failed to cache:', url, err);
          }
        }
        
        if (event.source) {
          event.source.postMessage({ type: 'LEARN_CONTENT_CACHED', success: true });
        }
      }).catch((err) => {
        console.error('[SW] Cache error:', err);
        if (event.source) {
          event.source.postMessage({ type: 'LEARN_CONTENT_CACHED', success: false });
        }
      })
    );
  }
});
