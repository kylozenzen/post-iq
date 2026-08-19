const APP_URL = '/app.html';
const BUFFER_CLIENT_ID = 'ijzu75qv_CAcO0qMelb93HjOVh1EwEanezilfgBiOEG';
const TOKEN_ENDPOINT = '/.netlify/functions/buffer-token';
const SHARED_CONNECTION_SRC = '/js/shared/connection.js';
const SHARED_OAUTH_SRC = '/js/shared/oauth.js';

const qs = id => document.getElementById(id);

function setScreen(kind, title, message, detailText = '') {
  const card = qs('card');
  if (!card) {
    console.error('[PostIQ OAuth] Missing #card; callback UI cannot render.');
    return;
  }
  card.className = `card ${kind || ''}`.trim();
  const icon = qs('icon');
  if (icon) icon.innerHTML = kind === 'success' ? '✓' : kind === 'cancelled' ? '↩' : kind === 'error' ? '!' : '<div class="spinner" aria-hidden="true"></div>';
  const titleEl = qs('title'); if (titleEl) titleEl.textContent = title;
  const messageEl = qs('message'); if (messageEl) messageEl.textContent = message;
  const detail = qs('detail');
  if (detail) {
    detail.style.display = detailText ? 'block' : 'none';
    detail.textContent = detailText;
  }
}

function clearOAuthSession() {
  ['postiq_oauth_state', 'postiq_oauth_verifier', 'postiq_pkce_verifier', 'postiq_oauth_redirect_uri', 'postiq_oauth_return_to']
    .forEach(key => sessionStorage.removeItem(key));
  try { localStorage.removeItem('postiq_oauth_transaction'); } catch {}
}

function showActions(primaryText = 'Return to PostIQ') {
  const actions = qs('actions');
  if (!actions) return;
  actions.style.display = 'flex';
  actions.innerHTML = `<a href="${APP_URL}">${primaryText}</a><button class="ghost" type="button" id="startOverBtn">Start over</button>`;
  qs('startOverBtn')?.addEventListener('click', () => { clearOAuthSession(); location.href = APP_URL; });
}

function yesNo(value) { return value ? 'yes' : 'no'; }

function hasFallbackTransaction() {
  try { return !!localStorage.getItem('postiq_oauth_transaction'); } catch { return false; }
}

function buildOAuthTechnicalDetails() {
  const params = new URLSearchParams(location.search);
  return [
    `error: ${params.get('error') || 'none'}`,
    `error_description: ${params.get('error_description') || 'none'}`,
    `iss: ${params.get('iss') || 'none'}`,
    `returned state present: ${yesNo(params.get('state'))}`,
    `stored state present: ${yesNo(sessionStorage.getItem('postiq_oauth_state'))}`,
    `stored verifier present: ${yesNo(sessionStorage.getItem('postiq_oauth_verifier') || sessionStorage.getItem('postiq_pkce_verifier'))}`,
    `fallback transaction present: ${yesNo(hasFallbackTransaction())}`,
    `code present: ${yesNo(params.get('code'))}`,
    `current origin: ${location.origin}`,
  ].join('\n');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function ensureSharedBufferModules() {
  if (!window.BufferConnection) await loadScript(SHARED_CONNECTION_SRC);
  if (!window.BufferOAuth) await loadScript(SHARED_OAUTH_SRC);
  if (!window.BufferConnection || !window.BufferOAuth) throw new Error('Shared Buffer modules did not initialize');
  window.BufferConnection.init({ prefix: 'postiq', clientId: BUFFER_CLIENT_ID, tokenEndpoint: TOKEN_ENDPOINT, refreshSkewMs: 5 * 60 * 1000 });
}

function safeReturnUrl(returnTo) {
  try {
    const url = new URL(returnTo || APP_URL, location.origin);
    if (url.origin !== location.origin || !url.pathname.startsWith('/')) return APP_URL;
    url.searchParams.set('connected', 'buffer');
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return `${APP_URL}?connected=buffer`;
  }
}

async function handleCallback() {
  const technicalDetails = buildOAuthTechnicalDetails();
  try {
    await ensureSharedBufferModules();
    const result = await window.BufferOAuth.handleCallback({ prefix: 'postiq', tokenEndpoint: TOKEN_ENDPOINT, clientId: BUFFER_CLIENT_ID });

    if (!result.ok) {
      const kind = result.reason === 'cancelled' ? 'cancelled' : 'error';
      const title = result.reason === 'cancelled' ? 'Connection cancelled'
        : result.reason === 'state_mismatch' ? 'Security check failed'
        : result.reason === 'missing_code' ? 'Missing authorization code'
        : result.reason === 'session_expired' ? 'Session expired'
        : result.reason === 'missing_client_id' ? 'OAuth app not configured'
        : 'Buffer connection failed';
      setScreen(kind, title, result.message || 'Could not connect Buffer.', technicalDetails);
      showActions(result.reason === 'cancelled' ? 'Back to PostIQ' : 'Try again');
      window.GA4_Auth?.signInFailed?.(result.reason === 'missing_code' ? 'no_auth_code' : result.reason === 'token_exchange_failed' ? 'token_exchange_failed' : 'callback_failure');
      if (result.reason === 'token_exchange_failed') window.GA4_System?.applicationError?.(new Error(result.message || 'token_exchange_failed'), 'authentication');
      return;
    }

    setScreen('success', 'Buffer connected', 'Redirecting you back to PostIQ…');
    window.GA4_Auth?.signInSuccess?.({ channelCount: 0, hasScheduled: false, queueDepth: 0, hasApprovals: false });
    setTimeout(() => { location.href = safeReturnUrl(result.returnTo); }, 700);
  } catch (err) {
    setScreen('error', 'Could not finish connecting', err.message || 'The token exchange failed. Please try again.', `${technicalDetails}\nshared module error: ${err.message || 'unknown'}`);
    showActions('Try again');
    window.GA4_Auth?.signInFailed?.('token_exchange_failed');
    window.GA4_System?.applicationError?.(err, 'authentication');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', handleCallback);
else handleCallback();
