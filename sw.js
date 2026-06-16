const CACHE = 'postiq-v5-hotfix';
const SHELL = [
  '/',
  '/index.html',
  '/app.html',
  '/app.css',
  '/app.js',
  '/js/ai-assist.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept non-GET requests, cross-origin requests, or Netlify functions.
  // Functions must always hit the network so POST bodies are not consumed/cached by the SW.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/.netlify/functions/')) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    try {
      const networkResponse = await fetch(request);

      // Clone once for cache before the browser consumes the response body.
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone()).catch(err => {
          console.warn('[PostIQ SW] cache put failed:', err);
        });
      }

      return networkResponse;
    } catch (err) {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw err;
    }
  })());
});
