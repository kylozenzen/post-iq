const CACHE_NAME = 'postiq-shell-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/app.html',
  '/manifest.json',
  '/icons/postiq-icon.svg',
  '/assets/css/app.css',
  '/assets/css/landing.css',
  '/assets/css/tool-manager.css',
  '/assets/js/app.js',
  '/assets/js/landing.js',
  '/assets/js/tool-registry.js',
  '/assets/js/tools/trending-view.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/.netlify/functions/')) return;

  event.respondWith(
    caches.match(request).then(cached => {
      const refreshed = fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);

      return cached || refreshed;
    })
  );
});
