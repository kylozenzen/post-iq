'use strict';

// ── BUFFER OAUTH (PUBLIC CLIENT + PKCE) ─────────────
const BUFFER_AUTHORIZATION_ENDPOINT = 'https://auth.buffer.com/auth';
// insights:read is not permitted for OAuth App Clients (Buffer restricts it to Personal API Keys and MCP clients);
// requesting it makes Buffer reject the whole authorization request with invalid_scope.
const BUFFER_OAUTH_SCOPE = 'posts:write posts:read account:read offline_access';
const BUFFER_OAUTH_DEBUG_KEY = 'postiq_oauth_debug';

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

function base64UrlEncode(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function sha256(plainText) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plainText));
}

async function createPkceChallenge(verifier) {
  return base64UrlEncode(await sha256(verifier));
}

function getOAuthRedirectUri() {
  return ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://localhost:8888/auth/callback.html'
    : 'https://postiq.netlify.app/auth/callback.html';
}

function isOAuthDebugEnabled() {
  return localStorage.getItem(BUFFER_OAUTH_DEBUG_KEY) === '1';
}

function redactOAuthClientId(authUrl) {
  const url = new URL(authUrl);
  if (url.searchParams.has('client_id')) url.searchParams.set('client_id', '[redacted]');
  return url.toString();
}

function logOAuthDebug(details) {
  if (!isOAuthDebugEnabled()) return;
  console.info('[PostIQ OAuth debug]', details);
}

function showOAuthDebugPanel(details, continueUrl) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:18px;background:rgba(8,10,24,.72);backdrop-filter:blur(8px);';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Buffer OAuth debug details');

  const panel = document.createElement('div');
  panel.style.cssText = 'width:min(100%,720px);max-height:90vh;overflow:auto;border:1px solid rgba(255,255,255,.14);border-radius:22px;background:#17182b;color:#f8fafc;box-shadow:0 28px 90px rgba(0,0,0,.45);padding:22px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';

  const rows = [
    ['authorization endpoint', details.authorizationEndpoint],
    ['redirect_uri', details.redirectUri],
    ['response_type', details.responseType],
    ['scope', details.scope],
    ['code_challenge_method', details.codeChallengeMethod],
    ['state length', String(details.stateLength)],
    ['code_verifier length', String(details.codeVerifierLength)],
    ['full authorization URL', details.redactedAuthorizationUrl],
  ];

  panel.innerHTML = `
    <div style="font-weight:800;font-size:22px;margin-bottom:8px;">Buffer OAuth Debug</div>
    <p style="margin:0 0 16px;color:#a5adbd;line-height:1.5;">Debug mode is enabled, so PostIQ is pausing before redirecting to Buffer.</p>
    <div style="display:grid;gap:10px;margin-bottom:18px;">
      ${rows.map(([label, value]) => `
        <div style="border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:10px;background:rgba(255,255,255,.04);">
          <div style="font:700 11px/1.3 'DM Mono',monospace;text-transform:uppercase;letter-spacing:.04em;color:#8b5cf6;margin-bottom:5px;">${safeText(label)}</div>
          <div style="font:12px/1.55 'DM Mono',monospace;color:#dbe2ee;overflow-wrap:anywhere;">${safeText(value)}</div>
        </div>
      `).join('')}
    </div>
    <button class="btn primary" type="button" data-oauth-continue="1">Continue to Buffer</button>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  const continueBtn = overlay.querySelector('[data-oauth-continue]');
  continueBtn.focus();
  continueBtn.addEventListener('click', () => { location.href = continueUrl; });
}

async function startBufferOAuth() {
  safeTrack(() => GA4_Auth.signInStarted());
  if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    showToast('OAuth needs a secure HTTPS page.', 'error');
    return;
  }

  // `state` protects the OAuth redirect from CSRF by binding this browser session to the callback.
  const oauthState = generateRandomString(48);
  // PKCE protects public clients: the browser keeps the verifier and Buffer receives only its challenge up front.
  const verifier = generateRandomString(96);
  const challenge = await createPkceChallenge(verifier);
  const redirectUri = getOAuthRedirectUri();

  sessionStorage.setItem('postiq_oauth_state', oauthState);
  sessionStorage.setItem('postiq_pkce_verifier', verifier);
  sessionStorage.setItem('postiq_oauth_redirect_uri', redirectUri);

  // This is browser code for a public OAuth client; client secrets should never be used here.
  const params = new URLSearchParams({
    client_id: BUFFER_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: BUFFER_OAUTH_SCOPE,
    state: oauthState,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'consent',
  });
  const authorizationUrl = `${BUFFER_AUTHORIZATION_ENDPOINT}?${params.toString()}`;

  if (isOAuthDebugEnabled()) {
    const debugDetails = {
      authorizationEndpoint: BUFFER_AUTHORIZATION_ENDPOINT,
      redirectUri,
      responseType: 'code',
      scope: BUFFER_OAUTH_SCOPE,
      codeChallengeMethod: 'S256',
      stateLength: oauthState.length,
      codeVerifierLength: verifier.length,
      redactedAuthorizationUrl: redactOAuthClientId(authorizationUrl),
    };
    logOAuthDebug(debugDetails);
    showOAuthDebugPanel(debugDetails, authorizationUrl);
    return;
  }

  location.href = authorizationUrl;
}

function getOAuthBufferToken() {
  const connection = getBufferConnectionState();
  return connection.source === 'oauth' && connection.connected ? connection.token : '';
}

function clearOAuthBufferToken() {
  clearOAuthConnection();
}


// ── BUFFER ASSET NORMALIZATION ─────────────────────
function hasBufferAssetPayload(asset) {
  return !!asset && typeof asset === 'object' && !Array.isArray(asset) && Object.keys(asset).length > 0;
}

const BUFFER_ASSET_TYPES = ['image', 'video', 'document', 'link'];

function normalizeBufferAssetItem(asset) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return [];
  return BUFFER_ASSET_TYPES
    .filter(type => hasBufferAssetPayload(asset[type]))
    .map(type => ({ [type]: asset[type] }));
}

function normalizeBufferAssets(input, options = {}) {
  if (input === undefined || input === null) return undefined;
  if (Array.isArray(input)) {
    const normalizedArray = input.flatMap(normalizeBufferAssetItem);
    if (normalizedArray.length) return normalizedArray;
    return options.emptyObjectAsEmptyArray ? [] : undefined;
  }
  if (typeof input !== 'object') return undefined;

  const normalized = [];
  const pushAssetList = (items, type) => {
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      if (hasBufferAssetPayload(item)) normalized.push({ [type]: item });
    });
  };

  pushAssetList(input.images, 'image');
  pushAssetList(input.videos, 'video');
  pushAssetList(input.documents, 'document');
  if (hasBufferAssetPayload(input.link)) normalized.push({ link: input.link });

  if (normalized.length) return normalized;
  return options.emptyObjectAsEmptyArray ? [] : undefined;
}

function normalizeThreadAssets(threadItems) {
  if (!Array.isArray(threadItems)) return threadItems;
  return threadItems.map(item => {
    if (!item || typeof item !== 'object' || !Object.prototype.hasOwnProperty.call(item, 'assets')) return item;
    const normalizedAssets = normalizeBufferAssets(item.assets);
    const next = { ...item };
    if (normalizedAssets === undefined) delete next.assets;
    else next.assets = normalizedAssets;
    return next;
  });
}

function normalizeThreadContainer(container) {
  if (!container || typeof container !== 'object') return container;
  let changed = false;
  const next = { ...container };
  if (Array.isArray(container.thread)) {
    next.thread = normalizeThreadAssets(container.thread);
    changed = next.thread !== container.thread;
  }
  return changed ? next : container;
}

function normalizeBufferThreadMetadata(input) {
  if (!input || typeof input !== 'object') return input;
  let nextInput = input;
  const cloneInput = () => { if (nextInput === input) nextInput = { ...input }; return nextInput; };
  const metadata = input.metadata;
  if (metadata && typeof metadata === 'object') {
    let nextMetadata = metadata;
    const cloneMetadata = () => { if (nextMetadata === metadata) nextMetadata = { ...metadata }; return nextMetadata; };
    ['twitter', 'threads', 'bluesky', 'mastodon'].forEach(platform => {
      const current = metadata[platform];
      const normalized = normalizeThreadContainer(current);
      if (normalized !== current) cloneMetadata()[platform] = normalized;
    });
    if (Array.isArray(metadata.thread)) cloneMetadata().thread = normalizeThreadAssets(metadata.thread);
    if (nextMetadata !== metadata) cloneInput().metadata = nextMetadata;
  }
  ['twitter', 'threads', 'bluesky', 'mastodon'].forEach(platform => {
    const current = input[platform];
    const normalized = normalizeThreadContainer(current);
    if (normalized !== current) cloneInput()[platform] = normalized;
  });
  return nextInput;
}

function normalizeBufferPostInput(input, options = {}) {
  if (!input || typeof input !== 'object') return input;
  let next = normalizeBufferThreadMetadata(input);
  const hasAssets = Object.prototype.hasOwnProperty.call(input, 'assets');
  if (!hasAssets) return next;

  const normalizedAssets = normalizeBufferAssets(input.assets, { emptyObjectAsEmptyArray: !!options.clearAssets });
  if (next === input) next = { ...input };
  if (normalizedAssets === undefined) delete next.assets;
  else next.assets = normalizedAssets;
  return next;
}

function getDeprecatedLegacyAssetWarnings(response) {
  const warnings = response?.extensions?.warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.filter(warning => warning?.code === 'DEPRECATED_LEGACY_ASSETS_INPUT');
}

function handleBufferWarnings(response) {
  const warnings = getDeprecatedLegacyAssetWarnings(response);
  if (!warnings.length) return;
  warnings.forEach(warning => {
    const paths = Array.isArray(warning.paths) ? warning.paths : Array.isArray(warning.path) ? warning.path : [];
    console.warn('Buffer deprecated legacy assets input warning', { warning, paths });
  });
  if (typeof showToast === 'function') showToast('Buffer accepted this request but reported deprecated legacy assets input. Check console paths.', '');
}

function showToast(msg, type = '') {
  const wrap = qs('toastWrap'); if (!wrap) return;
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  wrap.appendChild(t);
  const delay = msg.length > 40 ? 3800 : 2600;
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, delay);
}

async function copyTextSafe(text) {
  const value = String(text || '');
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  } catch {
    return false;
  }
}
