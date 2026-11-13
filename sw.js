const CACHE = 'postiq-v40-editorial-default';
// Precache list mirrors the assets app.html loads (scripts/check-project.js verifies it).
const SHELL = [
  '/',
  '/index.html',
  '/app.html',
  '/manifest.json',
  '/js/analytics.js',
  '/css/app/tokens-layout.css',
  '/css/app/components.css',
  '/css/app/calendar.css',
  '/css/app/composer.css',
  '/css/app/ideas-settings.css',
  '/css/app/settings-customize.css',
  '/css/app/content-flow.css',
  '/css/app/responsive.css',
  '/css/app/library.css',
  '/css/app/plan-health.css',
  '/css/app/suite.css',
  '/css/app/calendar-experience.css',
  '/css/app/planning-tools.css',
  '/css/app/tour.css',
  '/css/app/calm-calendar.css',
  '/css/app/celebrate.css',
  '/css/app/power-layer.css',
  '/js/features/platform-guidance.js',
  '/js/features/develop.js',
  '/js/features/coverage.js',
  '/js/core/runtime.js',
  '/js/integrations/buffer-oauth.js',
  '/js/features/templates.js',
  '/js/integrations/buffer-connection.js',
  '/js/integrations/buffer-api.js',
  '/js/integrations/content-items.js',
  '/js/features/content-model.js',
  '/js/features/channel-icon.js',
  '/js/features/calendar.js',
  '/js/features/runway.js',
  '/js/features/plan-health.js',
  '/js/features/suite.js',
  '/js/features/composer.js',
  '/js/features/composer-resources.js',
  '/js/features/content-flow.js',
  '/js/features/content-detail.js',
  '/js/features/media.js',
  '/js/integrations/post-creation.js',
  '/js/features/scheduled-post-editor.js',
  '/js/core/navigation.js',
  '/js/core/bootstrap.js',
  '/js/features/calendar-experience.js',
  '/js/features/your-pace.js',
  '/js/features/getting-started.js',
  '/js/features/alerts.js',
  '/js/features/celebrate.js',
  '/js/features/campaigns.js',
  '/js/core/startup.js',
  '/js/discord-integration.js',
  '/js/library.js',
  '/js/features/tour.js',
  '/js/features/holidays.js',
  '/js/features/quick-add.js',
  '/js/features/calendar-drag.js',
  '/js/features/today.js',
  '/js/features/backup.js',
  '/js/features/power-layer.js'
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
