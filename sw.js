const CACHE_NAME = 'studypad-v2'; // Bumped from v1 to force update
const ASSETS = [
  './',
  './index.html',
  './library.html',          // <-- Added the library page
  './manifest.json',
  './sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-icon-180.png'
];

// Install: pre-cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS).catch(err => console.log('Cache add failed:', err)))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for pages, cache-first for assets
self.addEventListener('fetch', (event) => {
  // Don't intercept cross-origin (ads, external APIs)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // 1. NETWORK-FIRST for HTML/Navigation (Ensures site updates)
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the new HTML version
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // If offline, fallback to cache
          return caches.match(event.request).then(cached => {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // 2. CACHE-FIRST for other assets (Images, CSS, JS)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for non-navigation requests
        return caches.match('./index.html');
      });
    })
  );
});
