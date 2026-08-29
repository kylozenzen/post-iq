const CACHE = 'postiq-v10-content-flow';
const SHELL = [
  '/',
  '/index.html',
  '/app.html',
  '/css/app/tokens-layout.css',
  '/css/app/components.css',
  '/css/app/calendar.css',
  '/css/app/composer.css',
  '/css/app/approvals.css',
  '/css/app/ideas-settings.css',
  '/css/app/content-flow.css',
  '/css/app/content-pillars.css',
  '/css/app/responsive.css',
  '/css/app/polish.css',
  '/css/app/preferences-ai.css',
  '/css/app/library.css',
  '/css/app/pulse.css',
  '/css/onboarding.css',
  '/js/analytics.js',
  '/js/ai-assist.js',
  '/js/core/runtime.js',
  '/js/integrations/buffer-oauth.js',
  '/js/features/approvals/metadata.js',
  '/js/features/templates.js',
  '/js/integrations/buffer-connection.js',
  '/js/integrations/buffer-api.js',
  '/js/integrations/content-items.js',
  '/js/features/calendar.js',
  '/js/features/composer.js',
  '/js/features/composer-resources.js',
  '/js/features/content-flow.js',
  '/js/features/media.js',
  '/js/integrations/post-creation.js',
  '/js/features/approvals/index.js',
  '/js/features/approvals/reviewer.js',
  '/js/core/navigation.js',
  '/js/core/bootstrap.js',
  '/js/features/content-pillars.js',
  '/js/core/startup.js',
  '/js/discord-integration.js',
  '/js/library.js',
  '/js/pulse.js',
  '/js/onboarding.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL).catch(err => console.warn('[PostIQ SW] shell cache failed:', err))));
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
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/.netlify/functions/') || request.cache === 'only-if-cached') {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    try {
      const networkResponse = await fetch(request);

      // Clone once for cache before the browser consumes the response body.
      if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
        cache.put(request, networkResponse.clone()).catch(err => {
          console.warn('[PostIQ SW] cache put failed:', err);
        });
      }

      return networkResponse;
    } catch (err) {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const appShell = await cache.match('/app.html') || await cache.match('/index.html');
        if (appShell) return appShell;
      }
      throw err;
    }
  })());
});
