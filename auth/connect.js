const BUFFER_AUTHORIZATION_ENDPOINT = 'https://auth.buffer.com/auth';
// Users who connected before insights:read was added must disconnect and reconnect Buffer for metrics access.
const BUFFER_OAUTH_SCOPE = 'posts:write posts:read account:read offline_access insights:read';
// Confirm this public Buffer OAuth client ID matches the app/callback configuration before deploying.
const BUFFER_CLIENT_ID = 'ijzu75qv_CAcO0qMelb93HjOVh1EwEanezilfgBiOEG';

const qs = id => document.getElementById(id);
let continueBtn;
let connectError;
let backLink;

function getSafeReturnPath() {
  const requested = new URLSearchParams(location.search).get('return') || '/app.html';
  try {
    const url = new URL(requested, location.origin);
    if (url.origin === location.origin && url.pathname.startsWith('/')) return `${url.pathname}${url.search}${url.hash}`;
  } catch (_) {}
  return '/app.html';
}

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => chars[byte % chars.length]).join('');
}

function base64UrlEncode(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function createPkceChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

function getOAuthRedirectUri() {
  return ['localhost', '127.0.0.1'].includes(location.hostname)
    ? `${location.origin}/auth/callback.html`
    : 'https://postiq.netlify.app/auth/callback.html';
}

function canUseSessionStorage() {
  try {
    const key = '__postiq_storage_test__';
    sessionStorage.setItem(key, '1');
    sessionStorage.removeItem(key);
    return true;
  } catch (_) {
    return false;
  }
}

function showConnectError(message, originalError) {
  if (originalError) {
    console.error('[PostIQ OAuth] Failed to start Buffer OAuth', originalError);
  }
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
  const CRYPTO_ERROR = 'We could not start Buffer sign-in. Please make sure this page is loaded over HTTPS or localhost, then try again.';
  const STORAGE_ERROR = 'Your browser blocked session storage, so Buffer sign-in cannot start. Try a normal browser window or adjust privacy settings for this site.';

  const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!window.isSecureContext && !isLocalhost) {
    showConnectError(CRYPTO_ERROR, new Error('Insecure context'));
    return;
  }
  if (!window.crypto || typeof window.crypto.getRandomValues !== 'function' || !window.crypto.subtle || typeof TextEncoder !== 'function') {
    showConnectError(CRYPTO_ERROR, new Error('Missing required Web Crypto APIs'));
    return;
  }
  if (!canUseSessionStorage()) {
    showConnectError(STORAGE_ERROR, new Error('sessionStorage unavailable'));
    return;
  }
  if (!BUFFER_CLIENT_ID || !BUFFER_CLIENT_ID.trim()) {
    showConnectError('We could not start Buffer sign-in. Please refresh and try again.', new Error('Missing BUFFER_CLIENT_ID'));
    return;
  }

  const oauthState = generateRandomString(48);
  const verifier = generateRandomString(96);
  const challenge = await createPkceChallenge(verifier);
  const redirectUri = getOAuthRedirectUri();

  try {
    sessionStorage.setItem('postiq_oauth_state', oauthState);
    sessionStorage.setItem('postiq_pkce_verifier', verifier);
    sessionStorage.setItem('postiq_oauth_redirect_uri', redirectUri);
    sessionStorage.setItem('postiq_oauth_return_to', getSafeReturnPath());
  } catch (error) {
    showConnectError(STORAGE_ERROR, error);
    return;
  }

  const params = new URLSearchParams({
    client_id: BUFFER_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: oauthState,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: BUFFER_OAUTH_SCOPE,
    prompt: 'consent',
  });

  const authUrl = new URL(BUFFER_AUTHORIZATION_ENDPOINT);
  authUrl.search = params.toString();
  continueBtn.dataset.authUrl = authUrl.toString();

  console.info('[PostIQ OAuth] Starting Buffer OAuth', { redirectUri });
  console.info('[PostIQ OAuth] Redirecting to Buffer', authUrl.toString());
  window.location.assign(authUrl.toString());
}

function initBufferSigninPage() {
  continueBtn = qs('continueBtn');
  connectError = qs('connectError');
  backLink = qs('backLink');

  if (!continueBtn) {
    console.error('[PostIQ OAuth] Missing required #continueBtn; cannot initialize Buffer sign-in.');
    return;
  }

  if (backLink) {
    backLink.href = getSafeReturnPath();
  }

  continueBtn.addEventListener('click', () => {
    if (connectError) {
      connectError.style.display = 'none';
    }
    continueBtn.disabled = true;
    continueBtn.textContent = 'Opening Buffer…';
    startBufferOAuth().catch(error => {
      showConnectError('We could not start Buffer sign-in. Please make sure this page is loaded over HTTPS or localhost, then try again.', error);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBufferSigninPage);
} else {
  initBufferSigninPage();
}
