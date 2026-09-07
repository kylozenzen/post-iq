const CACHE = 'postiq-v14-split-cache';
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
  '/css/app/preferences-ai.css',
  '/css/app/library.css',
  '/css/app/pulse.css',
  '/css/app/home.css',
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

// Same-origin directories served cache-first. Filenames are not content-hashed,
// so a bumped CACHE is what publishes new CSS/JS to returning visitors.
const STATIC_DIR = /^\/(?:css|js|assets|images)\//;
const FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

function isDocumentRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function isStaticAsset(url) {
  if (FONT_ORIGINS.includes(url.origin)) return true;
  return url.origin === self.location.origin && STATIC_DIR.test(url.pathname);
}

// Google Fonts stylesheets are fetched no-cors, so they arrive opaque (status 0).
// Those are still worth storing; everything else has to be a real 2xx.
function isStorable(response) {
  return !!response && (response.ok || response.type === 'opaque');
}

function putInCache(cache, request, response) {
  cache.put(request, response.clone()).catch(err => {
    console.warn('[PostIQ SW] cache put failed:', err);
  });
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Cache each shell file on its own so a single 404 cannot drop the whole
    // shell, and bypass the HTTP cache so a CACHE bump really does refetch.
    await Promise.all(SHELL.map(path => cache
      .add(new Request(path, { cache: 'reload' }))
      .catch(err => console.warn('[PostIQ SW] shell cache failed:', path, err))));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

// Documents: network-first so a deploy lands on the next load, with the cached
// copy (and finally the app shell) as the offline fallback.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const networkResponse = await fetch(request);

    // Clone once for cache before the browser consumes the response body.
    if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
      putInCache(cache, request, networkResponse);
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
}

// Static assets: serve the cached copy immediately and refresh it in the
// background, so a warm cache never blocks first paint on the network.
async function cacheFirst(event, request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);

  if (cached) {
    event.waitUntil(fetch(request)
      .then(response => { if (isStorable(response)) putInCache(cache, request, response); })
      .catch(() => {}));
    return cached;
  }

  const networkResponse = await fetch(request);
  if (isStorable(networkResponse)) putInCache(cache, request, networkResponse);
  return networkResponse;
}

self.addEventListener('fetch', event => {
  const request = event.request;

  // Never intercept non-GET requests. Netlify functions in particular must
  // always hit the network so POST bodies are not consumed/cached by the SW.
  if (request.method !== 'GET' || request.cache === 'only-if-cached') return;

  let url;
  try { url = new URL(request.url); } catch { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.pathname.includes('/.netlify/functions/')) return;

  if (isDocumentRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event, request));
    return;
  }

  // Everything else (API calls, anything cross-origin) goes straight to the
  // network untouched and is never cached.
});
