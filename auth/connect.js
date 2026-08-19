const BUFFER_OAUTH_SCOPE = 'posts:write posts:read account:read offline_access';
const BUFFER_CLIENT_ID = 'ijzu75qv_CAcO0qMelb93HjOVh1EwEanezilfgBiOEG';
const SHARED_OAUTH_SRC = '/js/shared/oauth.js';

const qs = id => document.getElementById(id);
let continueBtn;
let connectError;
let backLink;
let sharedOAuthPromise = null;

function getSafeReturnPath() {
  const requested = new URLSearchParams(location.search).get('return') || '/app.html';
  try {
    const url = new URL(requested, location.origin);
    if (url.origin === location.origin && url.pathname.startsWith('/')) return `${url.pathname}${url.search}${url.hash}`;
  } catch (_) {}
  return '/app.html';
}

function getOAuthRedirectUri() {
  return ['localhost', '127.0.0.1'].includes(location.hostname)
    ? `${location.origin}/auth/callback.html`
    : 'https://postiq.netlify.app/auth/callback.html';
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-shared-buffer-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') resolve();
      else {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      }
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset.sharedBufferSrc = src;
    script.addEventListener('load', () => { script.dataset.loaded = '1'; resolve(); }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function ensureSharedOAuth() {
  if (window.BufferOAuth) return window.BufferOAuth;
  if (!sharedOAuthPromise) sharedOAuthPromise = loadScript(SHARED_OAUTH_SRC);
  await sharedOAuthPromise;
  if (!window.BufferOAuth) throw new Error('Shared Buffer OAuth module did not initialize');
  return window.BufferOAuth;
}

function showConnectError(message, originalError) {
  if (originalError) console.error('[PostIQ OAuth] Failed to start Buffer OAuth', originalError);
  window.GA4_Auth?.signInFailed?.('oauth_start_failed');
  window.GA4_System?.applicationError?.(originalError || new Error('oauth_start_failed'), 'authentication');
  if (connectError) {
    connectError.textContent = message;
    connectError.style.display = 'block';
  }
  if (continueBtn) {
    continueBtn.disabled = false;
    continueBtn.textContent = 'Sign in with Buffer';
  }
}

async function startBufferOAuth() {
  window.GA4_Auth?.signInStarted?.();
  try {
    const oauth = await ensureSharedOAuth();
    await oauth.startAuthorization({
      prefix: 'postiq',
      clientId: BUFFER_CLIENT_ID,
      redirectUri: getOAuthRedirectUri(),
      scope: BUFFER_OAUTH_SCOPE,
      returnTo: getSafeReturnPath(),
    });
  } catch (error) {
    const message = /session storage/i.test(error?.message || '')
      ? 'Your browser blocked session storage, so Buffer sign-in cannot start. Try a normal browser window or adjust privacy settings for this site.'
      : 'We could not start Buffer sign-in. Please make sure this page is loaded over HTTPS or localhost, then try again.';
    showConnectError(message, error);
  }
}

function initBufferSigninPage() {
  continueBtn = qs('continueBtn');
  connectError = qs('connectError');
  backLink = qs('backLink');

  if (!continueBtn) {
    console.error('[PostIQ OAuth] Missing required #continueBtn; cannot initialize Buffer sign-in.');
    return;
  }
  if (backLink) backLink.href = getSafeReturnPath();

  continueBtn.addEventListener('click', () => {
    if (connectError) connectError.style.display = 'none';
    continueBtn.disabled = true;
    continueBtn.textContent = 'Opening Buffer…';
    startBufferOAuth().catch(error => showConnectError('We could not start Buffer sign-in. Please try again.', error));
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBufferSigninPage);
else initBufferSigninPage();
