const APP_URL = '/app.html';

const qs = id => document.getElementById(id);

function setScreen(kind, title, message, detailText = '') {
  const card = qs('card');
  if (!card) {
    console.error('[PostIQ OAuth] Missing #card; callback UI cannot render.');
    return;
  }
  card.className = `card ${kind || ''}`.trim();

  const icon = qs('icon');
  if (icon) {
    icon.innerHTML = kind === 'success'
      ? '✓'
      : kind === 'cancelled'
        ? '↩'
        : kind === 'error'
          ? '!'
          : '<div class="spinner" aria-hidden="true"></div>';
  }

  const titleEl = qs('title');
  if (titleEl) titleEl.textContent = title;

  const messageEl = qs('message');
  if (messageEl) messageEl.textContent = message;

  const detail = qs('detail');
  if (detail) {
    detail.style.display = detailText ? 'block' : 'none';
    detail.textContent = detailText;
  }
}

function showActions(primaryText = 'Return to PostIQ') {
  const actions = qs('actions');
  if (!actions) return;

  actions.style.display = 'flex';
  actions.innerHTML = `<a href="${APP_URL}">${primaryText}</a><button class="ghost" type="button" id="startOverBtn">Start over</button>`;
  qs('startOverBtn')?.addEventListener('click', () => {
    ['postiq_oauth_state', 'postiq_pkce_verifier', 'postiq_oauth_redirect_uri'].forEach(key => sessionStorage.removeItem(key));
    location.href = APP_URL;
  });
}

function yesNo(value) {
  return value ? 'yes' : 'no';
}

function buildOAuthTechnicalDetails({ error, errorDescription, iss, state, storedState, verifier, code }) {
  return [
    `error: ${error || 'none'}`,
    `error_description: ${errorDescription || 'none'}`,
    `iss: ${iss || 'none'}`,
    `returned state present: ${yesNo(state)}`,
    `stored state present: ${yesNo(storedState)}`,
    `stored verifier present: ${yesNo(verifier)}`,
    `code present: ${yesNo(code)}`,
    `current origin: ${location.origin}`,
  ].join('\n');
}

async function exchangeCodeForTokens(code, redirectUri, verifier) {
  const tokenResponse = await fetch('/.netlify/functions/buffer-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });

  const tokenData = await tokenResponse.json().catch(() => null);
  if (!tokenResponse.ok || !tokenData?.access_token) {
    throw new Error(tokenData?.error_description || tokenData?.error || 'Could not connect Buffer');
  }
  return tokenData;
}

function storeTokenField(key, value) {
  sessionStorage.removeItem(key);
  if (value === undefined || value === null || value === '') {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, String(value));
}

function storeTokens(tokenResponse) {
  const expiresIn = Number(tokenResponse.expires_in || 0);
  const scope = Array.isArray(tokenResponse.scope) ? tokenResponse.scope.join(' ') : (tokenResponse.scope || '');
  storeTokenField('postiq_buffer_access_token', tokenResponse.access_token || '');
  storeTokenField('postiq_buffer_refresh_token', tokenResponse.refresh_token || '');
  storeTokenField('postiq_buffer_token_type', tokenResponse.token_type || 'Bearer');
  storeTokenField('postiq_buffer_token_scope', scope);
  storeTokenField('postiq_buffer_token_expires_at', expiresIn ? String(Date.now() + expiresIn * 1000) : '');
  localStorage.removeItem('postiq_buffer_reconnect_needed');
  sessionStorage.removeItem('postiq_buffer_reconnect_needed');
}

async function handleCallback() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');
  const iss = params.get('iss');
  const storedState = sessionStorage.getItem('postiq_oauth_state');
  const verifier = sessionStorage.getItem('postiq_pkce_verifier');
  const redirectUri = sessionStorage.getItem('postiq_oauth_redirect_uri');
  const technicalDetails = buildOAuthTechnicalDetails({ error, errorDescription, iss, state, storedState, verifier, code });

  if (error === 'access_denied') {
    setScreen('cancelled', 'Connection cancelled', 'Buffer did not authorize the connection. If you never saw an approval screen, the authorization request may need adjustment.', technicalDetails);
    showActions('Back to PostIQ');
    if (typeof gtag !== 'undefined') gtag('event', 'buffer_connect_error', {
      error_type: 'callback_failure'
    });
    return;
  }
  if (error) {
    setScreen('error', 'Buffer connection failed', errorDescription || error, technicalDetails);
    showActions('Back to PostIQ');
    if (typeof gtag !== 'undefined') gtag('event', 'buffer_connect_error', {
      error_type: 'callback_failure'
    });
    return;
  }

  if (!state || !storedState || state !== storedState) {
    setScreen('error', 'Security check failed', 'The OAuth state was missing or invalid, so PostIQ stopped the connection for your safety.', technicalDetails);
    showActions('Try again');
    if (typeof gtag !== 'undefined') gtag('event', 'buffer_connect_error', {
      error_type: 'callback_failure'
    });
    return;
  }
  if (!code) {
    setScreen('error', 'Missing authorization code', 'Buffer did not return the code PostIQ needs to finish connecting.', technicalDetails);
    showActions('Try again');
    if (typeof gtag !== 'undefined') gtag('event', 'buffer_connect_error', {
      error_type: 'callback_failure'
    });
    return;
  }
  if (!verifier || !redirectUri) {
    setScreen('error', 'Session expired', 'The saved PKCE verifier or redirect URL is missing. Please start the Buffer connection again.', technicalDetails);
    showActions('Try again');
    if (typeof gtag !== 'undefined') gtag('event', 'buffer_connect_error', {
      error_type: 'callback_failure'
    });
    return;
  }

  try {
    const tokenResponse = await exchangeCodeForTokens(code, redirectUri, verifier);
    storeTokens(tokenResponse);
    sessionStorage.removeItem('postiq_oauth_state');
    sessionStorage.removeItem('postiq_pkce_verifier');
    sessionStorage.removeItem('postiq_oauth_redirect_uri');
    setScreen('success', 'Buffer connected', 'Redirecting you back to PostIQ…');
    if (typeof gtag !== 'undefined') gtag('event', 'buffer_connect_success');
    setTimeout(() => {
      location.href = `${APP_URL}?connected=buffer`;
    }, 700);
  } catch (err) {
    setScreen('error', 'Could not finish connecting', err.message || 'The token exchange failed. Please try again.', `${technicalDetails}\ntoken exchange error: ${err.message || 'unknown'}`);
    showActions('Try again');
    if (typeof gtag !== 'undefined') gtag('event', 'buffer_connect_error', {
      error_type: 'token_exchange_failed'
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handleCallback);
} else {
  handleCallback();
}
