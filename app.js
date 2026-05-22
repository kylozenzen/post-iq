'use strict';

// ── CONSTANTS ──────────────────────────────────────
const STORE_KEY       = 'postiq_buffer_token';
const OAUTH_ACCESS_TOKEN_KEY = 'postiq_buffer_access_token';
const OAUTH_REFRESH_TOKEN_KEY = 'postiq_buffer_refresh_token';
const OAUTH_EXPIRES_AT_KEY = 'postiq_buffer_token_expires_at';
const OAUTH_TOKEN_TYPE_KEY = 'postiq_buffer_token_type';
const OAUTH_SCOPE_KEY = 'postiq_buffer_token_scope';
const OAUTH_RECONNECT_NEEDED_KEY = 'postiq_buffer_reconnect_needed';
const NOTE_KEY        = 'postiq_calendar_notes_v2';
const NOTE_TYPES_KEY  = 'postiqNoteTypes';
const PLANNING_KEY    = 'postiqPlanningSettings';
const TEMPLATE_KEY    = 'postiq_templates_v1';
const CACHE_KEY       = 'postiq_buffer_cache_v1';
const APPROVAL_PREFIX = 'postiq_approval_';

const IMGUR_KEY    = '546c25a59c58ad7';
const UNSPLASH_KEY = 'tBuaYCO5p-pJPjgF29hR2yJGtlQaG4d5HqdVivV0lbQ';

const TEMPLATE_TYPES     = ['All','Hooks','CTAs','Announcements','Engagement','Hashtag Sets'];
const TEMPLATE_PLATFORMS = ['All Platforms','LinkedIn','X','Threads','Instagram','Universal'];
const DAY_CODES = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const DAY_LABELS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DEFAULT_PLANNING_SETTINGS = { showQueueGaps: true, postingDays: ['MON','TUE','WED','THU','FRI'] };
const DEFAULT_NOTE_TYPES = [
  { id: 'note', label: 'Note', color: '#6366f1' },
  { id: 'idea', label: 'Idea', color: '#22c55e' },
  { id: 'reminder', label: 'Reminder', color: '#f59e0b' },
  { id: 'revision', label: 'Needs Revision', color: '#ef4444' }
];
const DEFAULT_POSTIQ_CONFIG = {
  betaMessage: 'PostIQ is in public beta. Some tools may change as Buffer’s API evolves.',
  features: {
    calendar: true,
    composer: true,
    ideas: true,
    contentPillars: true,
    trending: true,
    approvals: true,
    snapshots: true,
    uploads: true,
    unsplash: true,
    zenMode: true
  },
  notices: {
    approvals: '',
    trending: '',
    uploads: '',
    snapshots: ''
  }
};
const BETA_BANNER_SESSION_KEY = 'postiq_beta_banner_seen';
const BETA_BANNER_PERSIST_KEY = 'postiq_beta_banner_seen_persist';
const APP_VISITED_KEY = 'postiq_app_visited';
const LEGACY_NOTE_TYPES = {
  gold: { id: 'idea', label: 'Idea', color: '#f59e0b' },
  blue: { id: 'draft', label: 'Draft', color: '#3a3fff' },
  green: { id: 'campaign', label: 'Campaign', color: '#0fa672' },
  violet: { id: 'priority', label: 'Priority', color: '#7c3aed' }
};

// ── STATE ──────────────────────────────────────────
let bufferToken = '';
let currentViewId = 'calendarView';
let currentIdeasTab = 'pillars';
let tokenPanelOpen = false;
let modalCount = 0;
let globalStatusTimer = null;
let lastGlobalErrorBannerAt = 0;
let postiqConfig = {
  ...DEFAULT_POSTIQ_CONFIG,
  features: { ...DEFAULT_POSTIQ_CONFIG.features },
  notices: { ...DEFAULT_POSTIQ_CONFIG.notices },
};

const state = {
  channels: [],
  scheduled: [],
  month: new Date(),
  selectedDate: null,
  editingNoteId: null,
  calendarFilter: 'all',
  syncState: 'idle',
  templates: [],
  templateType: 'All',
  templatePlatform: 'All Platforms',
  templateSearch: '',
  editingTemplateId: null,
  organizationId: null,
};

const mediaState = { url: '', type: '', videoThumbUrl: '', source: '' };
const shareState = { dirty: true, lastLink: '', copyTimer: null, readyTimer: null };

// Cache layer
const cache = {
  orgId:     { value: null, ts: 0 },
  channels:  { value: [], ts: 0 },
  scheduled: { value: [], ts: 0 },
};
const CACHE_TTL = { orgId: 86400000, channels: 86400000, scheduled: 600000 };

// ── UTILITIES ──────────────────────────────────────
const qs = id => document.getElementById(id);
const on = (id, evt, handler, opts) => { const el = qs(id); if (!el) return null; el.addEventListener(evt, handler, opts); return el; };
const fmtDate = d => d.toISOString().slice(0, 10);
const monthLabel = d => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const monthStart = d => new Date(d.getFullYear(), d.getMonth(), 1);
const safeText = v => String(v || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const compact = (v, max = 80) => { const t = String(v || '').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; };

const validStatusType = type => ['info', 'warning', 'error', 'success'].includes(type) ? type : 'info';
const defaultFeaturePausedMessage = 'This feature is temporarily paused during the PostIQ public beta.';

function showGlobalStatus(message, options = {}) {
  const banner = qs('globalStatusBanner');
  const titleEl = qs('globalStatusTitle');
  const msgEl = qs('globalStatusMessage');
  if (!banner || !titleEl || !msgEl) return null;

  if (globalStatusTimer) {
    clearTimeout(globalStatusTimer);
    globalStatusTimer = null;
  }

  const type = validStatusType(options.type || 'info');
  titleEl.textContent = String(options.title || 'PostIQ notice');
  msgEl.textContent = String(message || 'Something needs your attention.');
  banner.className = `global-status-banner ${type}`;
  banner.dataset.type = type;

  if (!options.persistent) {
    const delay = Number(options.timeout) > 0 ? Number(options.timeout) : 5000;
    globalStatusTimer = setTimeout(hideGlobalStatus, delay);
  }
  return banner;
}

function hideGlobalStatus() {
  const banner = qs('globalStatusBanner');
  if (!banner) return;
  if (globalStatusTimer) {
    clearTimeout(globalStatusTimer);
    globalStatusTimer = null;
  }
  banner.classList.add('hidden');
}

function bindGlobalStatusDismiss() {
  on('globalStatusDismiss', 'click', () => {
    hideGlobalStatus();
    try {
      sessionStorage.setItem(BETA_BANNER_SESSION_KEY, '1');
      localStorage.setItem(BETA_BANNER_PERSIST_KEY, '1');
    } catch {}
  });
}

function mergePostiqConfig(base, override) {
  if (!override || typeof override !== 'object') return {
    ...base,
    features: { ...base.features },
    notices: { ...base.notices },
  };
  return {
    ...base,
    ...override,
    features: { ...(base.features || {}), ...(override.features || {}) },
    notices: { ...(base.notices || {}), ...(override.notices || {}) },
  };
}

function getFeatureFlag(name) {
  if (!name) return true;
  return postiqConfig?.features?.[name] !== false;
}

function getFeatureNotice(name) {
  return String(postiqConfig?.notices?.[name] || defaultFeaturePausedMessage);
}

function showFeaturePaused(name) {
  showGlobalStatus(getFeatureNotice(name), { title: 'Feature paused', type: 'warning', timeout: 6000 });
}

function setFeatureControlPaused(el, featureName, paused) {
  if (!el) return;
  const notice = getFeatureNotice(featureName);
  el.dataset.featureFlag = featureName;
  el.classList.toggle('feature-paused', paused);
  el.setAttribute('aria-disabled', paused ? 'true' : 'false');
  if (paused) {
    el.dataset.postiqOriginalTitle = el.dataset.postiqOriginalTitle || el.getAttribute('title') || '';
    el.setAttribute('title', notice);
    if ('disabled' in el) el.disabled = true;
  } else {
    if ('disabled' in el) el.disabled = false;
    const original = el.dataset.postiqOriginalTitle || '';
    if (original) el.setAttribute('title', original);
    else el.removeAttribute('title');
    delete el.dataset.postiqOriginalTitle;
  }
}

function applyFeatureFlags() {
  const flagControls = {
    snapshots: ['shareMonthBtn', 'shareMonthBtnMob', 'generateShare', 'copyShare'],
    approvals: ['approvalsRefreshBtn', 'approvalsRefreshBtnMob'],
    uploads: ['uploadBrowseBtn', 'uploadReplaceBtn'],
    unsplash: ['unsplashSearchBtn'],
  };

  Object.entries(flagControls).forEach(([feature, ids]) => {
    const paused = !getFeatureFlag(feature);
    ids.forEach(id => setFeatureControlPaused(qs(id), feature, paused));
  });

  document.querySelectorAll('[data-view="approvalsView"]').forEach(el => setFeatureControlPaused(el, 'approvals', !getFeatureFlag('approvals')));
  document.querySelectorAll('[data-ideas-tab="trending"]').forEach(el => setFeatureControlPaused(el, 'trending', !getFeatureFlag('trending')));
  document.querySelectorAll('.media-tab[data-mtab="upload"], [data-mtabpanel="upload"] button, #uploadZone').forEach(el => setFeatureControlPaused(el, 'uploads', !getFeatureFlag('uploads')));
  document.querySelectorAll('.media-tab[data-mtab="unsplash"], [data-mtabpanel="unsplash"] button, [data-mtabpanel="unsplash"] input').forEach(el => setFeatureControlPaused(el, 'unsplash', !getFeatureFlag('unsplash')));
  const zenToggleBtn = qs('zenToggleBtn');
  if (zenToggleBtn) {
    if (!getFeatureFlag('zenMode')) zenToggleBtn.style.setProperty('display', 'none', 'important');
    else zenToggleBtn.style.removeProperty('display');
  }
}

async function loadPostiqConfig() {
  try {
    const response = await fetch('/.netlify/functions/app-config', { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const remoteConfig = await response.json();
    postiqConfig = mergePostiqConfig(DEFAULT_POSTIQ_CONFIG, remoteConfig);
  } catch {
    postiqConfig = mergePostiqConfig(DEFAULT_POSTIQ_CONFIG);
  } finally {
    applyFeatureFlags();
    renderSettingsFeatureStatus();
    maybeShowBetaBanner();
  }
}

function maybeShowBetaBanner() {
  const message = String(postiqConfig?.betaMessage || '').trim();
  if (!message) return;
  try {
    if (sessionStorage.getItem(BETA_BANNER_SESSION_KEY) || localStorage.getItem(BETA_BANNER_PERSIST_KEY)) return;
    sessionStorage.setItem(BETA_BANNER_SESSION_KEY, '1');
    localStorage.setItem(BETA_BANNER_PERSIST_KEY, '1');
  } catch {}
  showGlobalStatus(message, { title: 'Public beta', type: 'info', timeout: 7000 });
}

function handlePausedFeatureEvent(event) {
  const target = event.target?.closest?.('[data-feature-flag]');
  if (!target) return;
  const feature = target.dataset.featureFlag;
  if (getFeatureFlag(feature)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  showFeaturePaused(feature);
}

function showGlobalErrorBanner() {
  const now = Date.now();
  if (now - lastGlobalErrorBannerAt < 3000) return;
  lastGlobalErrorBannerAt = now;
  showGlobalStatus('Something did not load correctly. Try refreshing, reconnecting Buffer, or using another tool.', {
    title: 'PostIQ hit a snag',
    type: 'error',
    persistent: true,
  });
}

function bindGlobalErrorHandlers() {
  window.addEventListener('error', event => {
    console.error('[PostIQ global error]', {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error,
    });
    showGlobalErrorBanner();
  });
  window.addEventListener('unhandledrejection', event => {
    console.error('[PostIQ unhandled rejection]', event.reason);
    showGlobalErrorBanner();
  });
}

const SNAP_ADJECTIVES = ['amber','brisk','cobalt','clever','cosmic','crisp','electric','golden','lively','lunar','mint','neon','quiet','rapid','silver','sunny','tidy','vivid'];
const SNAP_NOUNS = ['atlas','beacon','canvas','comet','draft','ember','grove','harbor','kite','lane','maple','orbit','pencil','quill','signal','spark','studio','thread'];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const toBase64Url = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const fromBase64Url = str => {
  const normalized = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return decodeURIComponent(escape(atob(padded)));
};
function generateSnapshotId() { return `${pick(SNAP_ADJECTIVES)}-${pick(SNAP_NOUNS)}-${Math.random().toString(36).slice(2, 6)}`; }
function formatDateTime(value) {
  if (!value) return 'Unscheduled';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function formatDateOnly(value) {
  const d = new Date(value + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
function formatDateWithYear(date) {
  const d = date instanceof Date ? date : new Date(String(date) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return String(date || 'this date');
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}
const normTags = v => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : String(v || '').split(',').map(x => x.trim()).filter(Boolean);
const isVideo = url => /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(String(url || ''));
const isImageUrl = url => /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(String(url || ''));
const normalizeHexColor = color => /^#[0-9a-f]{6}$/i.test(String(color || '')) ? String(color) : '#6366f1';
const rgbaFromHex = (hex, alpha = 0.1) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean;
  const num = /^[0-9a-f]{6}$/i.test(full) ? parseInt(full, 16) : 0x6366f1;
  return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${alpha})`;
};
const maskToken = t => !t ? '—' : t.length <= 8 ? '••••' : `${t.slice(0,4)}••••${t.slice(-4)}`;

// ── BUFFER OAUTH (PUBLIC CLIENT + PKCE) ─────────────
const BUFFER_AUTHORIZATION_ENDPOINT = 'https://auth.buffer.com/auth';
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

function openModal(id) {
  const el = qs(id); if (!el || el.classList.contains('open')) return;
  el.classList.add('open'); modalCount++;
  if (modalCount > 0) document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  const el = qs(id); if (!el || !el.classList.contains('open')) return;
  el.classList.remove('open'); modalCount = Math.max(0, modalCount - 1);
  if (modalCount === 0) document.body.style.overflow = '';
}

// ── APPROVAL METADATA (localStorage) ──────────────
function getApprovalMeta(draftId) {
  try { const r = localStorage.getItem(APPROVAL_PREFIX + draftId); return r ? JSON.parse(r) : null; } catch { return null; }
}
function setApprovalMeta(draftId, data) { try { localStorage.setItem(APPROVAL_PREFIX + draftId, JSON.stringify(data)); } catch {} }
function clearApprovalMeta(draftId) { try { localStorage.removeItem(APPROVAL_PREFIX + draftId); } catch {} }
function getAllApprovalMetas() {
  const result = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(APPROVAL_PREFIX)) {
        const draftId = key.slice(APPROVAL_PREFIX.length);
        const meta = getApprovalMeta(draftId);
        if (meta && meta.needs_approval) result.push({ draftId, ...meta });
      }
    }
  } catch {}
  return result;
}

// ── TEMPLATES ──────────────────────────────────────
function loadTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    if (!raw) { state.templates = []; return; }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) { state.templates = []; return; }
    state.templates = parsed.map((s, i) => ({
      id: String(s.id || `${Date.now()}-${i}`),
      title: String(s.title || 'Untitled'),
      type: TEMPLATE_TYPES.includes(s.type) ? s.type : 'Hooks',
      platform: TEMPLATE_PLATFORMS.includes(s.platform) ? s.platform : 'Universal',
      tags: normTags(s.tags),
      body: String(s.body || ''),
      createdAt: String(s.createdAt || new Date().toISOString()),
      updatedAt: String(s.updatedAt || new Date().toISOString()),
    }));
  } catch { state.templates = []; }
}
function persistTemplates() { try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(state.templates)); } catch {} }

function filteredTemplates(search = state.templateSearch, type = state.templateType, platform = state.templatePlatform) {
  const q = search.trim().toLowerCase();
  return state.templates.filter(s => {
    const typeOk = type === 'All' || s.type === type;
    const platOk = platform === 'All Platforms' || s.platform === platform;
    const txt = `${s.title} ${s.body} ${(s.tags || []).join(' ')}`.toLowerCase();
    return typeOk && platOk && (!q || txt.includes(q));
  });
}

function renderTemplateTypeFilters() {
  const rail = qs('templateTypeFilters'); rail.innerHTML = '';
  TEMPLATE_TYPES.forEach(type => {
    const count = type === 'All' ? state.templates.length : state.templates.filter(s => s.type === type).length;
    const b = document.createElement('button');
    b.className = `type-filter-btn ${state.templateType === type ? 'active' : ''}`;
    b.innerHTML = `<span>${type}</span><span class="type-filter-count">${count || ''}</span>`;
    b.onclick = () => { state.templateType = type; renderTemplates(); };
    rail.appendChild(b);
  });
}

function renderTemplates() {
  renderTemplateTypeFilters();
  const list = filteredTemplates();
  const grid = qs('templatesGrid');
  qs('templatesEmpty').style.display = list.length ? 'none' : 'flex';
  grid.innerHTML = '';
  list.forEach(s => {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `
      <div class="template-card-hdr">
        <div class="template-card-title">${safeText(s.title)}</div>
        <div style="display:flex;gap:3px;flex-shrink:0;">
          <span class="chip">${safeText(s.type)}</span>
          <span class="chip">${safeText(s.platform)}</span>
        </div>
      </div>
      <div class="template-card-body">${safeText(s.body)}</div>
      ${s.tags?.length ? `<div class="template-card-tags">${safeText(s.tags.join(' · '))}</div>` : ''}
      <div class="template-card-actions">
        <button class="btn sm" data-act="copy">Copy</button>
        <button class="btn sm primary" data-act="use">→ Compose</button>
        <button class="btn sm ghost" data-act="edit" style="margin-left:auto;">✏️</button>
        <button class="btn sm ghost" data-act="del">🗑</button>
      </div>`;
    card.querySelector('[data-act="copy"]').onclick = async () => {
      const ok = await copyTextSafe(s.body || '');
      showToast(ok ? 'Copied' : 'Copy failed', ok ? 'success' : 'error');
    };
    card.querySelector('[data-act="use"]').onclick  = () => { activateView('composerView'); useTemplateInEditor(s); };
    card.querySelector('[data-act="edit"]').onclick = () => openTemplateModal(s.id);
    card.querySelector('[data-act="del"]').onclick  = () => deleteTemplate(s.id);
    grid.appendChild(card);
  });
  renderComposerTemplateSidebar();
}

function renderComposerTemplateSidebar() {
  const list = qs('composerTemplateList'); if (!list) return;
  const items = state.templates.slice(0, 8);
  if (!items.length) { list.innerHTML = "<div style=\"font-size:12px;color:var(--subtle);padding:8px 0;font-family:'DM Mono',monospace;\">No templates yet.</div>"; return; }
  list.innerHTML = '';
  items.forEach(s => {
    const el = document.createElement('div');
    el.className = 'template-item';
    el.innerHTML = `<div class="template-item-title">${safeText(s.title)}</div><div class="template-item-preview">${safeText(compact(s.body, 70))}</div>`;
    el.onclick = () => useTemplateInEditor(s);
    list.appendChild(el);
  });
}

function useTemplateInEditor(template) {
  const editor = qs('composerEditor'); if (!editor) return;
  const body = template.body || '';
  try {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      sel.deleteFromDocument();
      sel.getRangeAt(0).insertNode(document.createTextNode(body));
    } else {
      editor.innerText = editor.innerText ? `${editor.innerText}\n\n${body}` : body;
    }
  } catch { editor.innerText = editor.innerText ? `${editor.innerText}\n\n${body}` : body; }
  editor.dispatchEvent(new Event('input'));
  editor.focus();
  showToast('Template inserted', 'success');
}

function openTemplateModal(id = null) {
  state.editingTemplateId = id;
  const s = id ? state.templates.find(x => x.id === id) : null;
  qs('templateModalTitle').textContent = s ? 'Edit Template' : 'New Template';
  qs('templateTitle').value = s?.title || '';
  qs('templateType').value = s?.type || 'Hooks';
  qs('templatePlatform').value = s?.platform || 'Universal';
  qs('templateTags').value = (s?.tags || []).join(', ');
  qs('templateBody').value = s?.body || '';
  openModal('templateModal');
}

function saveTemplate() {
  const title = qs('templateTitle').value.trim();
  const body  = qs('templateBody').value.trim();
  if (!title || !body) { showToast('Title and body required', 'error'); return; }
  const now = new Date().toISOString();
  const payload = {
    id: state.editingTemplateId || `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    title, type: qs('templateType').value, platform: qs('templatePlatform').value,
    tags: normTags(qs('templateTags').value), body, createdAt: now, updatedAt: now,
  };
  if (state.editingTemplateId) {
    const prev = state.templates.find(s => s.id === state.editingTemplateId);
    payload.createdAt = prev?.createdAt || now;
    state.templates = state.templates.map(s => s.id === state.editingTemplateId ? payload : s);
  } else {
    state.templates = [payload, ...state.templates];
  }
  persistTemplates(); closeModal('templateModal'); renderTemplates(); showToast('Template saved', 'success');
}

function deleteTemplate(id) {
  if (!confirm('Delete this template?')) return;
  state.templates = state.templates.filter(s => s.id !== id);
  persistTemplates(); renderTemplates(); showToast('Deleted');
}

function renderTemplatePicker() {
  const list = qs('pickerList');
  const items = filteredTemplates(qs('pickerSearch').value, qs('pickerType').value, 'All Platforms');
  qs('pickerEmpty').style.display = items.length ? 'none' : 'flex';
  list.innerHTML = '';
  items.forEach(s => {
    const el = document.createElement('div');
    el.style.cssText = 'padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--surface);transition:all .1s;';
    el.innerHTML = `<strong style="font-size:13px;">${safeText(s.title)}</strong><div style="font-size:12px;color:var(--muted);margin-top:3px;">${safeText(compact(s.body, 150))}</div>`;
    el.onmouseenter = () => { el.style.borderColor = 'var(--brand-glow)'; el.style.background = 'var(--brand-dim)'; };
    el.onmouseleave = () => { el.style.borderColor = 'var(--border)'; el.style.background = 'var(--surface)'; };
    el.onclick = () => { useTemplateInEditor(s); closeModal('templatePickerModal'); };
    list.appendChild(el);
  });
}

function initTemplateSelectors() {
  ['templatePlatform', 'templatePlatformFilter'].forEach(id => {
    const sel = qs(id); if (!sel) return;
    sel.innerHTML = '';
    TEMPLATE_PLATFORMS.forEach((p, i) => {
      if (id === 'templatePlatformFilter' && i === 0) return;
      const o = document.createElement('option'); o.value = p; o.textContent = p; sel.appendChild(o);
    });
    if (id === 'templatePlatformFilter') {
      const allOpt = document.createElement('option'); allOpt.value = 'All Platforms'; allOpt.textContent = 'All Platforms';
      sel.prepend(allOpt); sel.value = 'All Platforms';
    }
  });
  ['templateType', 'pickerType'].forEach(id => {
    const sel = qs(id); if (!sel) return;
    sel.innerHTML = '';
    TEMPLATE_TYPES.forEach((t, i) => {
      if (id === 'templateType' && i === 0) return;
      const o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o);
    });
  });
}

// ── TOKEN / CONNECTION STATE ──────────────────────────
function getStoredValue(key) {
  return sessionStorage.getItem(key) || localStorage.getItem(key) || '';
}

function getManualBufferToken() {
  return getStoredValue(STORE_KEY);
}


function getOAuthStorageForKey(key) {
  if (sessionStorage.getItem(key)) return sessionStorage;
  if (localStorage.getItem(key)) return localStorage;
  return sessionStorage;
}

function setStoredOAuthValue(key, value) {
  const store = getOAuthStorageForKey(OAUTH_ACCESS_TOKEN_KEY) || sessionStorage;
  if (value === undefined || value === null || value === '') {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
    return;
  }
  store.setItem(key, String(value));
  const other = store === sessionStorage ? localStorage : sessionStorage;
  other.removeItem(key);
}

function getStoredOAuthToken() {
  const accessToken = getStoredValue(OAUTH_ACCESS_TOKEN_KEY).trim();
  const refreshToken = getStoredValue(OAUTH_REFRESH_TOKEN_KEY).trim();
  const rawExpiresAt = getStoredValue(OAUTH_EXPIRES_AT_KEY).trim();
  const expiresAt = rawExpiresAt ? Number(rawExpiresAt) || null : null;
  if (!accessToken && !refreshToken && !expiresAt) return null;
  return {
    accessToken,
    refreshToken,
    tokenType: getStoredValue(OAUTH_TOKEN_TYPE_KEY).trim() || 'Bearer',
    scope: getStoredValue(OAUTH_SCOPE_KEY).trim(),
    expiresAt,
  };
}

function isOAuthTokenExpired(bufferMs = 5 * 60 * 1000) {
  const token = getStoredOAuthToken();
  if (!token?.accessToken) return false;
  if (!token.expiresAt) return true;
  return Date.now() >= token.expiresAt - bufferMs;
}

function hasReconnectNeeded() {
  return getStoredValue(OAUTH_RECONNECT_NEEDED_KEY) === '1';
}

function clearReconnectNeeded() {
  sessionStorage.removeItem(OAUTH_RECONNECT_NEEDED_KEY);
  localStorage.removeItem(OAUTH_RECONNECT_NEEDED_KEY);
}

function markBufferReconnectNeeded() {
  // Reconnect state is used when refresh fails, so the main UI can ask users to sign in again.
  const store = getOAuthStorageForKey(OAUTH_REFRESH_TOKEN_KEY) || sessionStorage;
  store.setItem(OAUTH_RECONNECT_NEEDED_KEY, '1');
  bufferToken = '';
  renderConnectionUI();
  setSyncStatus('failed', 'Reconnect Buffer to keep syncing.');
}

async function refreshBufferOAuthToken() {
  const token = getStoredOAuthToken();
  if (!token?.refreshToken) throw Object.assign(new Error('No Buffer refresh token'), { code: 'MISSING_REFRESH_TOKEN' });

  // Public OAuth clients refresh without a browser secret; the refresh token keeps users connected.
  const body = new URLSearchParams({
    client_id: BUFFER_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
  });

  let response;
  try {
    response = await fetch('https://auth.buffer.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch (err) {
    markBufferReconnectNeeded();
    throw Object.assign(new Error('Could not refresh Buffer connection'), { code: 'AUTH_ERROR', status: 401, cause: err });
  }

  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok || !data?.access_token) {
    sessionStorage.removeItem(OAUTH_ACCESS_TOKEN_KEY);
    localStorage.removeItem(OAUTH_ACCESS_TOKEN_KEY);
    markBufferReconnectNeeded();
    throw Object.assign(new Error(data?.error_description || data?.error || 'Could not refresh Buffer connection'), { code: 'AUTH_ERROR', status: response.status || 401 });
  }

  clearReconnectNeeded();
  setStoredOAuthValue(OAUTH_ACCESS_TOKEN_KEY, data.access_token);
  if (data.refresh_token) setStoredOAuthValue(OAUTH_REFRESH_TOKEN_KEY, data.refresh_token);
  setStoredOAuthValue(OAUTH_TOKEN_TYPE_KEY, data.token_type || token.tokenType || 'Bearer');
  const scope = Array.isArray(data.scope) ? data.scope.join(' ') : (data.scope || token.scope || '');
  setStoredOAuthValue(OAUTH_SCOPE_KEY, scope);
  const expiresIn = Number(data.expires_in || 0);
  setStoredOAuthValue(OAUTH_EXPIRES_AT_KEY, expiresIn ? Date.now() + expiresIn * 1000 : '');
  renderConnectionUI();
  return getStoredOAuthToken();
}

async function getActiveBufferToken() {
  const oauthToken = getStoredOAuthToken();
  if (oauthToken?.accessToken) {
    if (!isOAuthTokenExpired()) {
      clearReconnectNeeded();
      return { token: oauthToken.accessToken, source: 'oauth' };
    }
    try {
      const refreshed = await refreshBufferOAuthToken();
      if (refreshed?.accessToken) return { token: refreshed.accessToken, source: 'oauth' };
    } catch {
      markBufferReconnectNeeded();
      return null;
    }
  }

  if (oauthToken?.refreshToken || hasReconnectNeeded()) {
    markBufferReconnectNeeded();
    return null;
  }

  const manualToken = getManualBufferToken().trim();
  return manualToken ? { token: manualToken, source: 'manual' } : null;
}

function clearOAuthConnection() {
  [sessionStorage, localStorage].forEach(store => {
    store.removeItem(OAUTH_ACCESS_TOKEN_KEY);
    store.removeItem(OAUTH_REFRESH_TOKEN_KEY);
    store.removeItem(OAUTH_EXPIRES_AT_KEY);
    store.removeItem(OAUTH_TOKEN_TYPE_KEY);
    store.removeItem(OAUTH_SCOPE_KEY);
    store.removeItem(OAUTH_RECONNECT_NEEDED_KEY);
    store.removeItem('postiq_oauth_state');
    store.removeItem('postiq_pkce_verifier');
    store.removeItem('postiq_oauth_redirect_uri');
  });
}

function getBufferConnectionState() {
  const oauthToken = getStoredOAuthToken();
  const expired = !!(oauthToken?.accessToken && isOAuthTokenExpired(0));
  const reconnectNeeded = hasReconnectNeeded() || !!(oauthToken?.refreshToken && !oauthToken.accessToken);

  if (oauthToken?.accessToken || reconnectNeeded) {
    return {
      connected: !!(oauthToken?.accessToken && !expired && !reconnectNeeded),
      source: 'oauth',
      token: oauthToken?.accessToken || '',
      expiresAt: oauthToken?.expiresAt || null,
      expired: expired || reconnectNeeded,
      reconnectNeeded,
      label: expired || reconnectNeeded ? 'Reconnect Buffer' : 'Connected to Buffer',
    };
  }

  const manualToken = getManualBufferToken().trim();
  if (manualToken) {
    return {
      connected: true,
      source: 'manual',
      token: manualToken,
      expiresAt: null,
      expired: false,
      label: 'Connected',
    };
  }

  return {
    connected: false,
    source: 'none',
    token: '',
    expiresAt: null,
    expired: false,
    label: 'Not connected',
  };
}

function syncBufferTokenFromState() {
  const connection = getBufferConnectionState();
  bufferToken = connection.connected ? connection.token : '';
  return connection;
}

function maskPreview(t) { return t ? maskToken(t) : '—'; }

function setButtonClass(el, className) {
  if (!el) return;
  el.className = className;
}

function setTokenPanelVisible(panel, open) {
  if (!panel) return;
  if (panel.tagName === 'DETAILS') panel.open = !!open;
  else panel.style.display = open ? 'block' : 'none';
}

function selectSettingsTab(tabName) {
  document.querySelectorAll('.settings-tab').forEach(tab => {
    const active = tab.dataset.stab === tabName;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    tab.tabIndex = active ? 0 : -1;
  });
  const panel = 'settingsPanel' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
  document.querySelectorAll('.settings-panel').forEach(p => {
    const active = p.id === panel;
    p.classList.toggle('active', active);
    p.hidden = !active;
  });
  if (tabName === 'features') renderSettingsFeatureStatus();
}

function renderSettingsFeatureStatus() {
  document.querySelectorAll('[data-settings-feature]').forEach(el => {
    const feature = el.dataset.settingsFeature;
    const available = getFeatureFlag(feature);
    el.textContent = available ? 'Available' : 'Paused';
    el.classList.toggle('is-paused', !available);
    const notice = !available ? getFeatureNotice(feature) : '';
    if (notice) el.setAttribute('title', notice);
    else el.removeAttribute('title');
  });
  const betaMessage = qs('settingsBetaMessage');
  if (betaMessage) betaMessage.textContent = String(postiqConfig?.betaMessage || '').trim();
}

function openConnectionSettings(options = {}) {
  selectSettingsTab('connection');
  tokenPanelOpen = !!options.advancedApi;
  renderConnectionUI();
  const panel = qs('tokenPanel');
  if (options.advancedApi) setTokenPanelVisible(panel, true);
  openModal('settingsModal');
}


function getBufferConnectUrl() {
  return '/auth/connect.html?return=/app.html';
}

function goToBufferConnect() {
  location.href = getBufferConnectUrl();
}

function markAppVisited() {
  try { localStorage.setItem(APP_VISITED_KEY, '1'); } catch {}
}

function renderConnectionUI() {
  const connection = syncBufferTokenFromState();
  const connected = connection.connected;
  const expired = connection.expired;
  const reconnectNeeded = !!connection.reconnectNeeded;
  const oauthActive = connection.source === 'oauth';
  const manualActive = connection.source === 'manual';

  const manualToken = getManualBufferToken();
  const desktopPanel = qs('tokenPanel');
  if (!tokenPanelOpen) setTokenPanelVisible(desktopPanel, false);

  const primaryHeading = connected ? '' : (reconnectNeeded ? 'Reconnect Buffer' : 'Not connected');
  const helper = connected
    ? ''
    : (reconnectNeeded ? 'Your Buffer session expired. Sign in again to keep syncing.' : 'Sign in with Buffer to load your channels, plan posts, and publish from PostIQ.');
  const statusLabel = connected ? (oauthActive ? 'Connected to Buffer' : 'Connected') : (reconnectNeeded ? 'Reconnect Buffer' : 'Not connected');

  const sidebarCard = document.querySelector('.side-connection.connection-card');
  if (sidebarCard) {
    sidebarCard.classList.toggle('compact', connected);
    sidebarCard.classList.toggle('connected', connected);
    sidebarCard.classList.toggle('api-live-pulse', connected);
  }
  const connDot = qs('connDot'); if (connDot) connDot.classList.toggle('on', connected);
  const connLabel = qs('connLabel'); if (connLabel) connLabel.textContent = statusLabel;
  const connHeading = qs('connHeading');
  if (connHeading) {
    connHeading.textContent = primaryHeading;
    connHeading.style.display = connected ? 'none' : '';
  }
  const connHelper = qs('connHelper');
  if (connHelper) {
    connHelper.textContent = helper;
    connHelper.style.display = connected ? 'none' : '';
  }
  const connLastSync = qs('connLastSync');
  const lastSynced = qs('lastSynced')?.textContent?.trim() || '';
  if (connLastSync) {
    connLastSync.textContent = lastSynced || '';
    connLastSync.style.display = connected && lastSynced ? '' : 'none';
  }

  const manageBtn = qs('manageTokenBtn');
  if (manageBtn) {
    setButtonClass(manageBtn, 'btn sm primary');
    manageBtn.textContent = connected ? 'Sync now' : (reconnectNeeded ? 'Reconnect Buffer' : 'Sign in with Buffer');
  }
  const revealBtn = qs('revealTokenBtn');
  if (revealBtn) {
    revealBtn.style.display = '';
    revealBtn.textContent = 'Connection settings';
  }

  const tokenInput = qs('tokenInput');
  if (tokenInput) tokenInput.value = manualToken || '';
  const tokenMsg = qs('tokenMsg');
  if (tokenMsg && !tokenPanelOpen) tokenMsg.textContent = manualActive ? 'Manual API key fallback active.' : '';

  const connectionIntroCopy = qs('connectionIntroCopy');
  if (connectionIntroCopy) {
    connectionIntroCopy.textContent = manualActive
      ? 'PostIQ is currently connected using advanced API setup. You can keep using PostIQ this way, or switch to Buffer sign-in for the smoother OAuth experience.'
      : 'Recommended for most users. Sign in with Buffer so PostIQ can load your channels, view your queue, and publish through your account when you choose.';
  }

  const oauthStatus = qs('oauthStatusText');
  if (oauthStatus) {
    oauthStatus.textContent = oauthActive
      ? 'Connected with Buffer sign-in.'
      : (manualActive
        ? 'Connected via API key fallback.'
        : (reconnectNeeded ? 'Your Buffer session expired. Sign in again to keep syncing.' : 'Not connected.'));
  }
  const connectBtn = qs('connectBufferBtn');
  if (connectBtn) {
    connectBtn.textContent = oauthActive || reconnectNeeded
      ? 'Reconnect Buffer'
      : (manualActive ? 'Switch to Buffer sign-in' : 'Sign in with Buffer');
  }
  const disconnectBtn = qs('disconnectBufferBtn');
  if (disconnectBtn) disconnectBtn.style.display = oauthActive || reconnectNeeded ? '' : 'none';

  const advancedConnectionCopy = qs('advancedConnectionCopy');
  if (advancedConnectionCopy) {
    advancedConnectionCopy.textContent = manualActive
      ? 'You’re currently using the advanced setup. This works, but Buffer sign-in is recommended for most users because it is easier to manage and does not require manually storing an API key. Disconnect Buffer clears OAuth sign-in only; saved manual keys stay here until you remove them.'
      : (oauthActive
        ? 'API key fallback is optional and only needed if Buffer sign-in is unavailable. Disconnect Buffer clears OAuth sign-in only; saved manual keys stay here until you remove them.'
        : 'Use this only if Buffer sign-in is unavailable or you need a manual setup. Disconnect Buffer clears OAuth sign-in only; saved manual keys stay here until you remove them.');
  }

  const mobDot = qs('mobConnDot'); if (mobDot) mobDot.classList.toggle('on', connected);
  const mobLabel = qs('mobConnLabel'); if (mobLabel) mobLabel.textContent = statusLabel;
  const mobHelper = qs('mobConnHelper');
  if (mobHelper) {
    mobHelper.textContent = connected ? '' : (reconnectNeeded ? 'Your Buffer session expired. Sign in again to keep syncing.' : 'Sign in with Buffer to load your channels, plan posts, and publish from PostIQ.');
    mobHelper.style.display = connected ? 'none' : '';
  }
  const mobManage = qs('mobManageTokenBtn');
  if (mobManage) {
    setButtonClass(mobManage, 'btn primary');
    mobManage.style.width = '100%';
    mobManage.style.justifyContent = 'center';
    mobManage.style.fontSize = '13px';
    mobManage.textContent = connected ? 'Sync now' : (reconnectNeeded ? 'Reconnect Buffer' : 'Sign in with Buffer');
  }
  const mobSettings = qs('mobConnectionSettingsBtn');
  if (mobSettings) mobSettings.textContent = 'Connection settings';

  updateNavTags();
  return connection;
}

function refreshTokenUI() {
  renderConnectionUI();
}

function toggleDesktopTokenPanel({ reveal = false } = {}) {
  tokenPanelOpen = !tokenPanelOpen;
  setTokenPanelVisible(qs('tokenPanel'), tokenPanelOpen);
  if (reveal && tokenPanelOpen) {
    const inp = qs('tokenInput');
    if (inp) { inp.type = 'text'; inp.focus(); }
  }
  renderConnectionUI();
}

function toggleMobileTokenPanel() {
  window.postiqMobileTokenPanelOpen = !window.postiqMobileTokenPanelOpen;
  setTokenPanelVisible(qs('mobTokenPanel'), window.postiqMobileTokenPanelOpen);
  renderConnectionUI();
}

function updateNavTags() {
  const connection = getBufferConnectionState();
  const connected = connection.connected;
  ['calNavTag','appNavTag'].forEach(id => {
    const el = qs(id); if (!el) return;
    el.style.display = connected ? 'none' : '';
  });
  document.querySelectorAll('.nav-free-tag').forEach(el => {
    el.style.display = connected ? 'none' : '';
  });
  const calDesc = qs('calDesc');
  if (calDesc) calDesc.textContent = connected
    ? 'Your Buffer queue in a monthly view. Spot gaps and add planning notes before you draft.'
    : (connection.reconnectNeeded ? 'Reconnect Buffer to load your scheduled posts and spot queue gaps.' : 'Sign in with Buffer to load your scheduled posts and spot queue gaps.');
  const composerDesc = qs('composerDesc');
  if (composerDesc) composerDesc.textContent = connected
    ? 'Write your post, attach media, then send to Buffer as a draft, queued post, or scheduled post.'
    : 'Write here now — connect Buffer to unlock Buffer drafts, queueing, and scheduling.';
  updateComposerButtonStates();
  const calEmpty = qs('calEmptyHint'); if (calEmpty) calEmpty.style.display = connected ? 'none' : 'block';
}

function updateComposerButtonStates() {
  const connection = getBufferConnectionState();
  const connected = connection.connected;
  const hasChannel = !!qs('composerChannel')?.value;
  const ready = connected && hasChannel;
  ['composerDraft','composerQueue','composerScheduleToggle'].forEach(id => {
    const btn = qs(id); if (!btn) return;
    btn.disabled = !ready;
    btn.style.opacity = ready ? '1' : '.45';
    btn.style.cursor = ready ? 'pointer' : 'not-allowed';
    btn.title = !connected ? (connection.reconnectNeeded ? 'Reconnect Buffer first' : 'Sign in with Buffer first') : !hasChannel ? 'Load channels from Buffer first' : '';
  });
}

function setBufferToken(token, { mode = 'session', messageEl = null } = {}) {
  const clean = String(token || '').trim();
  localStorage.removeItem(STORE_KEY);
  sessionStorage.removeItem(STORE_KEY);
  if (!clean) {
    const after = syncBufferTokenFromState();
    if (!after.connected) clearSyncedData();
    if (messageEl) messageEl.textContent = 'Manual API key disconnected.';
    renderConnectionUI();
    showToast('Manual API key disconnected');
    return false;
  }
  clearOAuthBufferToken();
  if (mode === 'local') localStorage.setItem(STORE_KEY, clean);
  else sessionStorage.setItem(STORE_KEY, clean);
  bufferToken = clean;
  if (messageEl) messageEl.textContent = mode === 'local' ? 'API key fallback saved locally.' : 'API key fallback saved for session.';
  renderConnectionUI();
  showToast('API key fallback saved', 'success');
  return true;
}

function disconnectBuffer() {
  clearOAuthConnection();
  const after = syncBufferTokenFromState();
  if (!after.connected) clearSyncedData();
  renderConnectionUI();
  showToast('Buffer disconnected.', 'success');
  setSyncStatus('idle', after.connected ? 'Connected with advanced setup.' : 'Buffer disconnected.');
  return true;
}

function loadStoredToken() {
  const connection = syncBufferTokenFromState();
  const manualToken = getManualBufferToken();
  const inp = qs('tokenInput'); if (inp) inp.value = manualToken;
  const mobInp = qs('mobTokenInput'); if (mobInp) mobInp.value = manualToken;
  if (connection.connected) {
    loadCacheState();
    hydrateFromCache();
  }
  renderConnectionUI();
}


async function checkBufferConnectionHealth() {
  const oauthToken = getStoredOAuthToken();
  if (oauthToken?.accessToken && !isOAuthTokenExpired()) {
    clearReconnectNeeded();
    renderConnectionUI();
    return getBufferConnectionState();
  }
  if (oauthToken?.accessToken || oauthToken?.refreshToken) {
    try {
      await refreshBufferOAuthToken();
    } catch {
      markBufferReconnectNeeded();
    }
    renderConnectionUI();
    return getBufferConnectionState();
  }
  renderConnectionUI();
  return getBufferConnectionState();
}

function saveToken() {
  const token = qs('tokenInput').value.trim();
  const mode = [...document.querySelectorAll('input[name="tokenMode"]')].find(r => r.checked)?.value || 'session';
  const ok = setBufferToken(token, { mode, messageEl: qs('tokenMsg') });
  if (ok) {
    const msg = 'API key saved. Click Sync now to load Buffer posts.';
    const tokenMsg = qs('tokenMsg');
    if (tokenMsg) tokenMsg.textContent = msg;
    setSyncStatus('idle', msg);
  }
}

// ── CACHE ──────────────────────────────────────────
function loadCacheState() {
  try {
    const raw = localStorage.getItem(CACHE_KEY); if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.keys(cache).forEach(key => {
      if (parsed[key]?.ts) cache[key] = { value: parsed[key].value, ts: parsed[key].ts };
    });
  } catch {}
}
function saveCacheState() { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {} }
function isCacheFresh(key) { return !!cache[key]?.ts && (Date.now() - cache[key].ts) < CACHE_TTL[key]; }
function hydrateFromCache() {
  if (cache.orgId.value) state.organizationId = cache.orgId.value;
  if (Array.isArray(cache.channels.value) && cache.channels.value.length) state.channels = cache.channels.value;
  if (Array.isArray(cache.scheduled.value) && cache.scheduled.value.length) state.scheduled = cache.scheduled.value;
}
function clearSyncedData() {
  state.channels = []; state.scheduled = []; state.organizationId = null;
  Object.keys(cache).forEach(k => { cache[k] = { value: Array.isArray(cache[k]?.value) ? [] : null, ts: 0 }; });
  try { localStorage.removeItem(CACHE_KEY); } catch {}
  renderChannelSelects(); renderCalendar();
}

// ── BUFFER API ──────────────────────────────────────
async function callBuffer(query, variables = {}) {
  const activeToken = await getActiveBufferToken();
  if (!activeToken?.token) throw Object.assign(new Error(hasReconnectNeeded() ? 'Buffer connection expired' : 'No Buffer token'), { code: hasReconnectNeeded() ? 'AUTH_ERROR' : 'MISSING_TOKEN', status: hasReconnectNeeded() ? 401 : undefined });
  let res;
  try { res = await fetch('/.netlify/functions/buffer-proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: activeToken.token, query, variables }) }); }
  catch (err) { throw Object.assign(new Error('Network error'), { code: 'PROXY_NETWORK_ERROR', retryable: true, cause: err }); }
  let data;
  try { data = await res.json(); } catch { throw Object.assign(new Error('Invalid proxy response'), { code: 'PROXY_BAD_RESPONSE' }); }
  if (data.errors?.length && !data.data) {
    const first = data.errors[0] || {};
    if (activeToken.source === 'oauth' && (first.status === 401 || first.status === 403 || /unauthorized|invalid|forbidden|expired/i.test(String(first.message || '')))) markBufferReconnectNeeded();
    throw Object.assign(new Error(first.message || 'Buffer request failed'), { code: first.code || 'BUFFER_ERROR', status: first.status, retryable: !!first.retryable, retryAfter: first.retryAfter });
  }
  handleBufferWarnings(data);
  return data;
}

function getErrorMessage(err, fallback = 'Request failed. Please try again.') {
  const code = String(err?.code || '').toUpperCase();
  const msg  = String(err?.message || '');
  if (code === 'MISSING_TOKEN') return 'Sign in with Buffer first.';
  if (code === 'RATE_LIMIT' || err?.status === 429) return `Buffer rate limit hit.${err?.retryAfter ? ` Retry in ${err.retryAfter}s.` : ''}`;
  if (code === 'AUTH_ERROR' || /unauthorized|invalid|forbidden|expired/i.test(msg)) return 'Token appears invalid or expired. Reconnect Buffer.';
  if (code === 'PROXY_NETWORK_ERROR') return 'Network issue reaching Buffer. Check connection and retry.';
  return msg || fallback;
}

function isAuthError(err) {
  return ['AUTH_ERROR'].includes(String(err?.code || '').toUpperCase())
    || err?.status === 401 || err?.status === 403
    || /unauthorized|invalid token|forbidden|expired/i.test(String(err?.message || ''));
}

function handleAuthFailure(msg) {
  bufferToken = '';
  if (getBufferConnectionState().source === 'oauth') markBufferReconnectNeeded();
  clearSyncedData(); renderConnectionUI();
  setSyncStatus('failed', msg);
}

// ── SYNC ──────────────────────────────────────────
function setSyncStatus(state_, msg) {
  state.syncState = state_;
  const el = qs('syncStatus'); if (!el) return;
  el.textContent = msg;
  const lastEl = qs('lastSynced');
  if (state_ === 'success' && lastEl) lastEl.textContent = `Synced at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

async function getOrgId({ force = false } = {}) {
  if (!force && state.organizationId && isCacheFresh('orgId')) return state.organizationId;
  const acc = await callBuffer('query { account { organizations { id name } } }');
  const orgId = acc?.data?.account?.organizations?.[0]?.id || null;
  if (orgId) { state.organizationId = orgId; cache.orgId = { value: orgId, ts: Date.now() }; }
  return orgId;
}

async function getChannels({ force = false } = {}) {
  if (!force && state.channels.length && isCacheFresh('channels')) return state.channels;
  const orgId = await getOrgId({ force });
  if (!orgId) return [];
  const q = 'query C($organizationId: OrganizationId!) { channels(input:{organizationId:$organizationId}){ id displayName name service } }';
  const ch = await callBuffer(q, { organizationId: orgId });
  state.channels = ch?.data?.channels || [];
  cache.channels = { value: state.channels, ts: Date.now() };
  return state.channels;
}

async function getScheduledPosts({ force = false } = {}) {
  if (!force && state.scheduled.length && isCacheFresh('scheduled')) return state.scheduled;
  const orgId = await getOrgId({ force });
  if (!orgId) return [];
  const bounds = getScheduledBounds();
  let all = [], after = null, hasNext = true, fetched = 0;
  const seen = new Set();
  const q = 'query P($organizationId: OrganizationId!, $after: String, $first: Int!) { posts(first:$first,after:$after,input:{organizationId:$organizationId,filter:{status:[scheduled]}}){edges{node{id text dueAt channelId}} pageInfo{hasNextPage endCursor} } }';
  while (hasNext && fetched < 200 && all.length < 200) {
    const page = await callBuffer(q, { organizationId: orgId, after, first: 50 });
    const block = page?.data?.posts;
    (block?.edges || []).forEach(e => {
      const post = e?.node;
      if (!post?.id || seen.has(post.id)) return;
      const due = new Date(post.dueAt);
      if (due >= bounds.start && due <= bounds.end) { seen.add(post.id); all.push(post); }
    });
    hasNext = !!block?.pageInfo?.hasNextPage; after = block?.pageInfo?.endCursor || null; fetched += (block?.edges || []).length;
    if (!block?.pageInfo) break;
  }
  all.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  state.scheduled = all;
  cache.scheduled = { value: all, ts: Date.now() };
  saveCacheState();
  return all;
}

function getScheduledBounds() {
  const m = state.month;
  const start = new Date(m.getFullYear(), m.getMonth(), 1); start.setDate(start.getDate() - 7);
  const end = new Date(m.getFullYear(), m.getMonth() + 1, 0); end.setDate(end.getDate() + 60);
  return { start, end };
}

async function syncBuffer({ force = false } = {}) {
  const connection = syncBufferTokenFromState();
  const oauthToken = getStoredOAuthToken();
  if (connection.reconnectNeeded) { renderConnectionUI(); setSyncStatus('failed', 'Reconnect Buffer to keep syncing.'); return; }
  if (!connection.connected && !oauthToken?.accessToken && !oauthToken?.refreshToken) { renderConnectionUI(); setSyncStatus('failed', 'Sign in with Buffer first.'); return; }
  setSyncStatus('syncing', 'Syncing…');
  const btn = qs('syncBtn'); const orig = btn.innerHTML;
  btn.innerHTML = '↻ Syncing…'; btn.disabled = true;
  try {
    const orgId = await getOrgId({ force });
    if (!orgId) { clearSyncedData(); setSyncStatus('failed', 'No organization found.'); return; }
    await getChannels({ force });
    const posts = await getScheduledPosts({ force });
    renderChannelSelects();
    renderCalendar();
    detectQueueGaps();
    setSyncStatus('success', `${posts.length} scheduled posts loaded.`);
    renderConnectionUI();
    showToast(`Loaded ${posts.length} posts`, 'success');
    window.dispatchEvent(new Event('postiq:synced'));
  } catch (e) {
    const msg = getErrorMessage(e, 'Sync failed.');
    if (isAuthError(e)) handleAuthFailure(msg);
    else setSyncStatus('failed', msg);
    showToast(msg, 'error');
  } finally { btn.innerHTML = orig; btn.disabled = false; }
}

// ── CHANNEL SELECTS ──────────────────────────────────
function renderChannelSelects() {
  const sel = qs('composerChannel'); if (!sel) return;
  sel.innerHTML = '';
  if (state.channels.length) {
    state.channels.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = `${c.displayName || c.name} (${c.service})`; sel.appendChild(o);
    });
    qs('composerNoChannels').style.display = 'none'; sel.style.display = '';
  } else {
    qs('composerNoChannels').style.display = 'block'; sel.style.display = 'none';
  }
  updateComposerButtonStates();
}

// ── CALENDAR ──────────────────────────────────────
function createNoteId() { return `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }
function normalizeNoteForDate(note, date) {
  if (!note || typeof note !== 'object') return null;
  const meta = getNoteTypeMeta(note);
  const text = String(note.text || '').trim();
  if (!text) return null;
  const createdAt = note.createdAt || note.updatedAt || new Date().toISOString();
  return {
    ...note,
    id: note.id || createNoteId(),
    date: note.date || date,
    typeId: note.typeId || note.type || meta.id || 'note',
    label: note.label || meta.label || 'Note',
    color: note.color || meta.color || DEFAULT_NOTE_TYPES[0].color,
    text,
    createdAt,
    updatedAt: note.updatedAt || createdAt
  };
}
function normalizeNotesStore(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const normalized = {};
  let changed = !source || Array.isArray(raw);
  Object.entries(source).forEach(([date, value]) => {
    const list = Array.isArray(value) ? value : [value];
    if (!Array.isArray(value)) changed = true;
    if (list.some(n => !n || typeof n !== 'object' || !n.id || !n.date || !(n.typeId || n.type))) changed = true;
    const notes = list.map(n => normalizeNoteForDate(n, date)).filter(Boolean);
    if (notes.length) normalized[date] = notes;
    if (notes.length !== list.length) changed = true;
  });
  return { notes: normalized, changed };
}
function getNotes() {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTE_KEY) || '{}');
    const { notes, changed } = normalizeNotesStore(raw);
    if (changed) setNotes(notes);
    return notes;
  } catch { return {}; }
}
function setNotes(v) { localStorage.setItem(NOTE_KEY, JSON.stringify(normalizeNotesStore(v).notes)); }
function getNotesForDate(dateKey, notes = getNotes()) { return Array.isArray(notes[dateKey]) ? notes[dateKey] : []; }
function getPlanningSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLANNING_KEY) || 'null') || {};
    const postingDays = Array.isArray(saved.postingDays) ? saved.postingDays.filter(d => DAY_CODES.includes(d)) : DEFAULT_PLANNING_SETTINGS.postingDays;
    return { showQueueGaps: saved.showQueueGaps !== false, postingDays: postingDays.length ? postingDays : DEFAULT_PLANNING_SETTINGS.postingDays };
  } catch { return { ...DEFAULT_PLANNING_SETTINGS }; }
}
function setPlanningSettings(v) { localStorage.setItem(PLANNING_KEY, JSON.stringify(v)); }
function getNoteTypes() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTE_TYPES_KEY) || 'null');
    if (Array.isArray(saved) && saved.length) return saved.map(t => ({ id: String(t.id || '').trim(), label: String(t.label || 'Note').trim() || 'Note', color: String(t.color || '#6366f1') })).filter(t => t.id);
  } catch {}
  return DEFAULT_NOTE_TYPES.map(t => ({ ...t }));
}
function setNoteTypes(types) { localStorage.setItem(NOTE_TYPES_KEY, JSON.stringify(types)); }
function getNoteTypeMeta(note, noteTypes = getNoteTypes()) {
  const fallback = noteTypes.find(t => t.id === 'note') || DEFAULT_NOTE_TYPES[0];
  if (!note) return fallback;
  const byId = noteTypes.find(t => t.id === note.typeId || t.id === note.type || t.id === note.id);
  if (byId) return byId;
  const byLabel = noteTypes.find(t => String(t.label).toLowerCase() === String(note.label || '').toLowerCase());
  if (byLabel) return byLabel;
  if (note.tag && LEGACY_NOTE_TYPES[note.tag]) return LEGACY_NOTE_TYPES[note.tag];
  return fallback;
}
function notePillStyle(meta) {
  const color = normalizeHexColor(meta?.color || DEFAULT_NOTE_TYPES[0].color);
  return `background:${rgbaFromHex(color, .1)};border:1px solid ${rgbaFromHex(color, .24)};color:${color};`;
}
function getDefaultNoteType() {
  const types = getNoteTypes();
  return types.find(t => t.id === 'note') || types[0] || DEFAULT_NOTE_TYPES[0];
}
function renderNoteTypeOptions(selectedId) {
  const sel = qs('noteTag'); if (!sel) return;
  const types = getNoteTypes();
  const defaultId = getDefaultNoteType().id;
  const activeId = selectedId || defaultId;
  sel.innerHTML = types.map(t => `<option value="${safeText(t.id)}" ${t.id === activeId ? 'selected' : ''}>${safeText(t.label)}</option>`).join('');
}
function calendarFilterAllowsPosts(filter = state.calendarFilter) { return filter === 'all' || filter === 'posts'; }
function calendarFilterNotes(notes, filter = state.calendarFilter) {
  const list = Array.isArray(notes) ? notes : [];
  if (filter === 'posts') return [];
  if (filter === 'all' || filter === 'notes') return list;
  if (String(filter).startsWith('type:')) {
    const typeId = String(filter).slice(5);
    return list.filter(note => getNoteTypeMeta(note).id === typeId);
  }
  return list;
}
function renderCalendarFilter() {
  const sel = qs('calendarFilter'); if (!sel) return;
  const current = state.calendarFilter || 'all';
  const options = [
    { value: 'all', label: 'All' },
    { value: 'posts', label: 'Posts only' },
    { value: 'notes', label: 'Notes only' },
    ...getNoteTypes().map(t => ({ value: `type:${t.id}`, label: t.label }))
  ];
  const selected = options.some(o => o.value === current) ? current : 'all';
  if (selected !== current) state.calendarFilter = selected;
  sel.innerHTML = options.map(o => `<option value="${safeText(o.value)}" ${o.value === selected ? 'selected' : ''}>${safeText(o.label)}</option>`).join('');
}
function mediaUrlsFromAssets(assets) {
  const urls = [];
  if (!Array.isArray(assets)) return urls;
  assets.forEach(asset => {
    const item = asset?.image || asset?.video || asset?.document || asset?.link || asset;
    const url = item?.url || item?.thumbnailUrl || item?.previewUrl;
    if (url) urls.push(String(url));
  });
  return urls;
}
function getPostMediaUrls(post) {
  const candidates = [];
  ['mediaUrls','media_urls','media','imageUrls','image_urls'].forEach(k => { if (Array.isArray(post?.[k])) candidates.push(...post[k]); });
  ['mediaUrl','media_url','imageUrl','image_url','thumbnailUrl','thumbnail_url'].forEach(k => { if (post?.[k]) candidates.push(post[k]); });
  candidates.push(...mediaUrlsFromAssets(post?.assets));
  return [...new Set(candidates.map(x => String(x || '').trim()).filter(Boolean))];
}
function mediaPreviewHtml(post) {
  const urls = getPostMediaUrls(post);
  if (!urls.length) return '';
  const items = urls.map(url => isImageUrl(url)
    ? `<a class="post-media-preview" href="${safeText(url)}" target="_blank" rel="noopener"><img src="${safeText(url)}" alt="Attached media preview" loading="lazy" onerror="this.closest('a').classList.add('is-broken');this.remove();" /><span class="post-media-broken">Preview unavailable — open media</span></a>`
    : `<a class="post-media-link" href="${safeText(url)}" target="_blank" rel="noopener">Open media ↗</a>`).join('');
  return `<div class="post-media-list"><div class="post-detail-label">Media</div>${items}</div>`;
}
function postChannelLabel(p) {
  const ch = state.channels.find(c => c.id === (p?.channelId || p?.channel_id));
  return p?.channelName || p?.channel || ch?.displayName || ch?.name || '';
}
function postPlatformLabel(p) {
  const ch = state.channels.find(c => c.id === (p?.channelId || p?.channel_id));
  return p?.platform || p?.service || ch?.service || '';
}
function snapshotPostPayload(p) {
  return {
    dueAt: p.dueAt, text: p.text || '', status: p.status || 'scheduled',
    channelName: postChannelLabel(p), platform: postPlatformLabel(p), channelId: p.channelId || '',
    mediaUrls: getPostMediaUrls(p)
  };
}

function renderCalendar() {
  qs('monthLabel').textContent = monthLabel(state.month);
  renderCalendarFilter();
  const grid = qs('calGrid'); grid.innerHTML = '';
  const first = monthStart(state.month);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const notes = getNotes();
  const today = fmtDate(new Date());
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = fmtDate(d);
    const inMonth = d.getMonth() === state.month.getMonth();
    const allDayPosts = state.scheduled.filter(p => fmtDate(new Date(p.dueAt)) === key);
    const allDayNotes = getNotesForDate(key, notes);
    const dayPosts = calendarFilterAllowsPosts() ? allDayPosts : [];
    const dayNotes = calendarFilterNotes(allDayNotes);
    const isToday = key === today;

    const day = document.createElement('div');
    let cls = 'cal-day';
    if (!inMonth) cls += ' other-month';
    if (isToday) cls += ' today';
    if (dayPosts.length) cls += ' has-posts';
    if (dayNotes.length) cls += ' has-notes';
    day.className = cls;

    let html = `<div class="day-header"><div class="day-num">${d.getDate()}</div><button type="button" class="day-add-note-btn" data-add-note-date="${key}" aria-label="Add note for ${safeText(formatDateWithYear(d))}">+</button></div>`;
    if (dayPosts.length) html += `<div class="day-count">${dayPosts.length}</div>`;
    dayPosts.slice(0, 2).forEach(p => { html += `<button type="button" class="day-post-pill" data-post-detail="${key}">${safeText(compact(p.text, 60))}</button>`; });
    if (dayPosts.length > 2) html += `<div class="more-indicator">+${dayPosts.length - 2} more</div>`;
    dayNotes.slice(0, 2).forEach(note => { const meta = getNoteTypeMeta(note); html += `<button type="button" class="day-note-pill" data-note-detail="${safeText(note.id)}" style="${notePillStyle(meta)}" aria-label="Edit note for ${safeText(formatDateWithYear(d))}">${safeText(compact(note.text, 50))}</button>`; });
    if (dayNotes.length > 2) html += `<div class="more-indicator">+${dayNotes.length - 2} notes</div>`;
    day.innerHTML = html;
    day.querySelectorAll('[data-add-note-date]').forEach(el => {
      el.addEventListener('click', ev => { ev.stopPropagation(); openNewNoteForDate(d); });
    });
    day.querySelectorAll('[data-post-detail]').forEach(el => {
      el.addEventListener('click', ev => { ev.stopPropagation(); openCalendarPostDetails(key, allDayPosts, allDayNotes); });
    });
    day.querySelectorAll('[data-note-detail]').forEach(el => {
      el.addEventListener('click', ev => { ev.stopPropagation(); openEditNoteForDate(d, el.dataset.noteDetail); });
    });
    day.onclick = () => openCalendarDayDetails(d);
    grid.appendChild(day);
  }
  renderAgenda();
}


function detectQueueGaps() {
  const panel = qs('gapsPanel'); const list = qs('gapsList');
  if (!panel || !list || !getBufferConnectionState().connected) { if (panel) panel.style.display = 'none'; return; }
  const settings = getPlanningSettings();
  if (!settings.showQueueGaps) { panel.style.display = 'none'; return; }
  const today = new Date(); today.setHours(0,0,0,0);
  const gaps = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    if (!settings.postingDays.includes(DAY_CODES[d.getDay()])) continue;
    const key = fmtDate(d);
    const hasPosts = state.scheduled.some(p => fmtDate(new Date(p.dueAt)) === key);
    if (!hasPosts) gaps.push(d);
  }
  if (!gaps.length) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  list.innerHTML = '';
  gaps.forEach(d => {
    const chip = document.createElement('button');
    chip.className = 'gap-chip';
    chip.textContent = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    chip.onclick = () => openDayNote(d);
    list.appendChild(chip);
  });
}

function openDayNote(date) { openCalendarDayDetails(date); }

function populateNoteModal(date, existing = null) {
  const key = fmtDate(date);
  qs('noteDateLabel').textContent = `${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · ${existing ? 'Edit note' : 'Add note'}`;
  qs('noteText').value = existing ? existing.text || '' : '';
  renderNoteTypeOptions(existing ? getNoteTypeMeta(existing).id : getDefaultNoteType().id);
  const dayPosts = state.scheduled.filter(p => fmtDate(new Date(p.dueAt)) === key);
  const noteCount = getNotesForDate(key).length;
  qs('dayPostPreview').innerHTML = `<div style="font-size:12px;color:var(--subtle);margin-bottom:8px;">${dayPosts.length} scheduled post${dayPosts.length === 1 ? '' : 's'} · ${noteCount} existing note${noteCount === 1 ? '' : 's'}</div>`;
  qs('noteStatus').textContent = '';
  openModal('noteModal');
}

function openNewNoteForDate(date) {
  state.selectedDate = date;
  state.editingNoteId = null;
  populateNoteModal(date, null);
}

function openEditNoteForDate(date, noteId) {
  const key = fmtDate(date);
  const existing = getNotesForDate(key).find(n => n.id === noteId);
  if (!existing) { openNewNoteForDate(date); return; }
  state.selectedDate = date;
  state.editingNoteId = existing.id;
  populateNoteModal(date, existing);
}

function openAddNoteForDate(date, noteId = null) {
  if (noteId) openEditNoteForDate(date, noteId);
  else openNewNoteForDate(date);
}

function resetNoteForm() {
  const textEl = qs('noteText'); if (textEl) textEl.value = '';
  renderNoteTypeOptions(getDefaultNoteType().id);
  const preview = qs('dayPostPreview'); if (preview) preview.innerHTML = '';
  const status = qs('noteStatus'); if (status) status.textContent = '';
  state.selectedDate = null;
  state.editingNoteId = null;
}

function saveNote() {
  if (!state.selectedDate) return;
  const key = fmtDate(state.selectedDate);
  const text = qs('noteText').value.trim();
  if (!text) { qs('noteStatus').textContent = 'Add note text first.'; return; }
  const typeId = qs('noteTag').value || 'note';
  const typeMeta = getNoteTypes().find(t => t.id === typeId) || DEFAULT_NOTE_TYPES[0];
  const notes = getNotes();
  const list = getNotesForDate(key, notes);
  const now = new Date().toISOString();
  const existingIdx = state.editingNoteId ? list.findIndex(n => n.id === state.editingNoteId) : -1;
  const nextNote = {
    ...(existingIdx >= 0 ? list[existingIdx] : {}),
    id: existingIdx >= 0 ? list[existingIdx].id : createNoteId(),
    date: key,
    text,
    typeId: typeMeta.id,
    label: typeMeta.label,
    color: typeMeta.color,
    createdAt: existingIdx >= 0 ? list[existingIdx].createdAt : now,
    updatedAt: now
  };
  if (existingIdx >= 0) list[existingIdx] = nextNote;
  else list.push(nextNote);
  notes[key] = list;
  setNotes(notes);
  renderCalendar();
  closeModal('noteModal');
  resetNoteForm();
  activateView('calendarView');
  showToast(existingIdx >= 0 ? 'Note updated' : 'Note saved', 'success');
}

function deleteNote() {
  if (!state.selectedDate || !state.editingNoteId) { resetNoteForm(); closeModal('noteModal'); return; }
  const key = fmtDate(state.selectedDate);
  const notes = getNotes();
  const next = getNotesForDate(key, notes).filter(n => n.id !== state.editingNoteId);
  if (next.length) notes[key] = next; else delete notes[key];
  setNotes(notes);
  renderCalendar();
  closeModal('noteModal');
  resetNoteForm();
  activateView('calendarView');
  showToast('Note deleted');
}

function sendNoteToDraft() {
  if (!state.selectedDate) return;
  const text = qs('noteText').value.trim();
  if (!text) { qs('noteStatus').textContent = 'Add a note first.'; return; }
  const typeMeta = getNoteTypes().find(t => t.id === qs('noteTag').value) || DEFAULT_NOTE_TYPES[0];
  const label = typeMeta.label;
  const editor = qs('composerEditor');
  const payload = `[${label}] ${fmtDate(state.selectedDate)}\n${text}`;
  editor.innerText = editor.innerText ? `${editor.innerText}\n\n${payload}` : payload;
  editor.dispatchEvent(new Event('input'));
  closeModal('noteModal'); resetNoteForm(); activateView('composerView');
  showToast('Note sent to Compose');
}

function renderAgenda() {
  const agenda = qs('calAgenda'); if (!agenda) return;
  renderCalendarFilter();
  const notes = getNotes(); const today = fmtDate(new Date());
  agenda.innerHTML = '';
  const nav = document.createElement('div'); nav.className = 'cal-header';
  nav.innerHTML = `<div class="cal-month-label" style="font-size:18px;">${monthLabel(state.month)}</div>`;
  agenda.appendChild(nav);
  const map = {};
  state.scheduled.forEach(p => { const k = fmtDate(new Date(p.dueAt)); if (!map[k]) map[k] = { posts: [], notes: [] }; map[k].posts.push(p); });
  Object.entries(notes).forEach(([k, list]) => {
    if (!map[k]) map[k] = { posts: [], notes: [] };
    map[k].notes = getNotesForDate(k, notes);
  });
  const days = [];
  const ms = monthStart(state.month);
  for (let i = 0; i < 35; i++) { const d = new Date(ms.getFullYear(), ms.getMonth(), i + 1); if (d.getMonth() !== ms.getMonth()) break; days.push(fmtDate(d)); }
  const dmMono = 'DM Mono';
  days.forEach(key => {
    const raw = map[key]; if (!raw) return;
    const posts = calendarFilterAllowsPosts() ? raw.posts : [];
    const filteredNotes = calendarFilterNotes(raw.notes);
    if (!posts.length && !filteredNotes.length) return;
    const isToday = key === today;
    const date = new Date(key + 'T00:00:00');
    const dayEl = document.createElement('div');
    dayEl.style.cssText = `border:1px solid ${isToday ? 'var(--brand)' : 'var(--border)'};border-radius:10px;padding:12px;margin-bottom:8px;background:var(--surface);cursor:pointer;`;
    const dateLabel = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;"><span style="font-family:'${dmMono}',monospace;font-size:11px;font-weight:600;color:${isToday ? 'var(--brand)' : 'var(--muted)'};">${dateLabel}</span>${posts.length ? `<span style="font-size:9px;font-family:'${dmMono}',monospace;background:var(--brand-dim);color:var(--brand);border:1px solid var(--brand-glow);padding:1px 5px;border-radius:3px;">${posts.length} post${posts.length > 1 ? 's' : ''}</span>` : ''}</div>`;
    posts.slice(0, 2).forEach(p => { html += `<button type="button" class="day-post-preview-btn" data-agenda-post="${key}">${safeText(compact(p.text, 80))}</button>`; });
    if (posts.length > 2) html += `<div style="font-size:10px;color:var(--subtle);margin-bottom:4px;">+${posts.length - 2} more</div>`;
    filteredNotes.slice(0, 2).forEach(note => { const meta = getNoteTypeMeta(note); html += `<div class="day-note-pill" style="display:block;border-radius:5px;margin-top:4px;${notePillStyle(meta)}">${safeText(compact(note.text, 60))}</div>`; });
    if (filteredNotes.length > 2) html += `<div style="font-size:10px;color:var(--subtle);margin-top:4px;">+${filteredNotes.length - 2} notes</div>`;
    dayEl.innerHTML = html;
    dayEl.querySelectorAll('[data-agenda-post]').forEach(btn => btn.addEventListener('click', ev => { ev.stopPropagation(); openCalendarPostDetails(key, raw.posts, raw.notes); }));
    dayEl.onclick = () => openCalendarDayDetails(date);
    agenda.appendChild(dayEl);
  });
  if (!Object.keys(map).length) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.innerHTML = '<div class="empty-icon">📅</div><div class="empty-title">Nothing scheduled</div><div class="empty-desc">Connect Buffer and sync to load your upcoming posts.</div>';
    agenda.appendChild(empty);
  }
}

// Calendar snapshot share
function showShareCopyError() {
  if (typeof showGlobalStatus === 'function') {
    showGlobalStatus('Could not copy the snapshot link. Select the link and copy it manually.', { type: 'error', title: 'Copy failed' });
  } else if (typeof showToast === 'function') {
    showToast('Could not copy', 'error');
  }
}
function setGenerateShareText(text) {
  const generate = qs('generateShare');
  if (generate) generate.textContent = text;
}
function updateShareUrlWarning(link = qs('shareLink')?.value || '') {
  const warning = qs('shareUrlWarning');
  if (!warning) return;
  const len = String(link || '').length;
  warning.classList.toggle('strong', len > 10000);
  if (len > 10000) {
    warning.textContent = 'This snapshot link is very long and may not work in every app. Try sharing a week view or excluding planning notes.';
    warning.style.display = 'block';
  } else if (len > 6000) {
    warning.textContent = 'This snapshot link is getting long. It should still work, but a week view may be easier to share.';
    warning.style.display = 'block';
  } else {
    warning.textContent = '';
    warning.style.display = 'none';
  }
}
function resetShareForm({ resetRange = true } = {}) {
  const title = qs('shareCustomTitle'); if (title) title.value = '';
  const note = qs('shareNote'); if (note) note.value = '';
  const link = qs('shareLink'); if (link) link.value = '';
  shareState.dirty = true;
  shareState.lastLink = '';
  const meta = qs('shareLinkMeta'); if (meta) meta.style.display = 'none';
  const empty = qs('shareEmptyHint'); if (empty) empty.style.display = 'none';
  updateShareUrlWarning('');
  setGenerateShareText('Generate link');
  const copy = qs('copyShare'); if (copy) copy.textContent = 'Copy';
  const range = qs('shareRange'); if (range && resetRange) range.value = 'month';
}
function openShareSnapshotModal() {
  if (!getFeatureFlag('snapshots')) { showFeaturePaused('snapshots'); return; }
  resetShareForm();
  updateShareSummary();
  openModal('shareModal');
}

function visibleWeekBounds() {
  const base = new Date(state.month);
  const today = new Date();
  if (today.getFullYear() === state.month.getFullYear() && today.getMonth() === state.month.getMonth()) base.setDate(today.getDate());
  const start = new Date(base); start.setHours(0,0,0,0); start.setDate(base.getDate() - base.getDay());
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
  return { start, end };
}
function rangeLabelForSnapshot(range) {
  if (range === 'week') {
    const { start, end } = visibleWeekBounds();
    return `This week · ${start.toLocaleDateString(undefined, { month:'short', day:'numeric' })}–${end.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })}`;
  }
  return monthLabel(state.month);
}
function defaultSnapshotTitle(range, label) {
  if (range === 'week') return String(label || '').replace(/^This week\s*·\s*/i, '') + ' content plan';
  return `${monthLabel(state.month)} content plan`;
}
function snapshotDisplayTitle(snap) {
  if (snap.customTitle) return snap.customTitle;
  const range = getSnapshotRange(snap);
  if (range === 'week') return String(snap.rangeLabel || snap.title || 'This week').replace(/^This week\s*·\s*/i, '').replace(/\s*content plan$/i, '') + ' content plan';
  return snap.title || (snap.month ? `${snap.month} content plan` : 'Content Plan');
}
function buildSnapshotPayload() {
  const include     = !!qs('includeNotes')?.checked;
  const customTitle = (qs('shareCustomTitle')?.value || '').trim();
  const message     = (qs('shareNote')?.value || '').trim();
  const range       = qs('shareRange')?.value || 'month';
  const bounds      = range === 'week' ? visibleWeekBounds() : null;
  const inRange = value => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return false;
    if (range === 'week') return d >= bounds.start && d <= bounds.end;
    return d.getFullYear() === state.month.getFullYear() && d.getMonth() === state.month.getMonth();
  };
  const posts = state.scheduled.filter(p => inRange(p.dueAt));
  const allNotes   = getNotes();
  const rangeNotes = Object.entries(allNotes)
    .filter(([k]) => inRange(k + 'T12:00:00'))
    .flatMap(([date, list]) => getNotesForDate(date, allNotes).map(note => ({ ...note, date, ...getNoteTypeMeta(note) })));
  const label      = rangeLabelForSnapshot(range);
  const snapshotId = generateSnapshotId();
  const title      = customTitle || defaultSnapshotTitle(range, label);
  return {
    payload: {
      snapshotId, createdAt: Date.now(), period: range, month: range === 'month' ? monthLabel(state.month) : '', rangeLabel: label,
      rangeStart: range === 'week' ? fmtDate(bounds.start) : '', rangeEnd: range === 'week' ? fmtDate(bounds.end) : '', title, customTitle, message,
      includeNotes: include,
      noteTypes: getNoteTypes(),
      posts: posts.map(snapshotPostPayload),
      notes: include ? rangeNotes : []
    },
    label,
    posts,
    rangeNotes,
    include
  };
}
function updateShareSummary() {
  const { label, posts, rangeNotes, include } = buildSnapshotPayload();
  const name = qs('shareMonthName'); if (name) name.textContent = label;
  const count = qs('sharePostCount'); if (count) count.textContent = posts.length;
  const empty = qs('shareEmptyHint'); if (empty) empty.style.display = posts.length === 0 ? 'block' : 'none';
  return { posts, rangeNotes, include };
}
function markShareNeedsRefresh() {
  updateShareSummary();
  const link = qs('shareLink')?.value || '';
  shareState.dirty = !!link;
  if (link) setGenerateShareText('Refresh link');
  else setGenerateShareText('Generate link');
  const meta = qs('shareLinkMeta');
  if (meta && link) meta.textContent = 'Snapshot settings changed. Refresh the link before sharing.';
  updateShareUrlWarning(link);
}
function shareSnapshot() {
  if (!getFeatureFlag('snapshots')) { showFeaturePaused('snapshots'); return ''; }
  const { payload } = buildSnapshotPayload();
  updateShareSummary();
  const encoded = toBase64Url(JSON.stringify(payload));
  const link = location.origin + location.pathname + '#share=' + payload.snapshotId + '.' + encoded;
  const linkInput = qs('shareLink'); if (linkInput) linkInput.value = link;
  shareState.dirty = false;
  shareState.lastLink = link;
  const meta = qs('shareLinkMeta');
  if (meta) {
    meta.textContent = 'Anyone with this link can view the snapshot. No PostIQ account needed.';
    meta.style.display = 'block';
  }
  updateShareUrlWarning(link);
  setGenerateShareText('Link ready');
  if (shareState.readyTimer) clearTimeout(shareState.readyTimer);
  shareState.readyTimer = setTimeout(() => setGenerateShareText('Refresh link'), 2200);
  return link;
}
async function copyCurrentShareLink() {
  if (!getFeatureFlag('snapshots')) { showFeaturePaused('snapshots'); return; }
  let link = qs('shareLink')?.value || '';
  if (!link || shareState.dirty) link = shareSnapshot();
  if (!link) { showShareCopyError(); return; }
  const ok = await copyTextSafe(link);
  const btn = qs('copyShare');
  if (ok) {
    if (btn) btn.textContent = 'Copied!';
    if (shareState.copyTimer) clearTimeout(shareState.copyTimer);
    shareState.copyTimer = setTimeout(() => { const nextBtn = qs('copyShare'); if (nextBtn) nextBtn.textContent = 'Copy'; }, 1800);
  } else {
    showShareCopyError();
  }
}


function postDetailCardsHtml(posts) {
  return posts.map((p, idx) => {
    const platform = postPlatformLabel(p) || postChannelLabel(p);
    const channel = postChannelLabel(p);
    const status = p.status || 'scheduled';
    return `<div class="snap-modal-post">
      <div class="snap-modal-post-hdr">
        <div class="snap-modal-post-meta">
          <span class="snap-post-num">Post ${idx + 1}</span>
          ${platform ? '<span class="snap-platform-badge">' + safeText(platform) + '</span>' : ''}
          ${channel && channel !== platform ? '<span class="snap-platform-badge">' + safeText(channel) + '</span>' : ''}
          ${status ? '<span class="snap-platform-badge">' + safeText(status) + '</span>' : ''}
        </div>
        <span class="snap-scheduled-time">${safeText(formatDateTime(p.dueAt))}</span>
      </div>
      <div class="snap-modal-post-body">${safeText(p.text || '(no copy)')}</div>
      ${mediaPreviewHtml(p)}
      <div class="snap-modal-post-copy">
        <button class="btn sm ghost" data-copy="${safeText(p.text || '')}">Copy post</button>
      </div>
    </div>`;
  }).join('');
}
function noteCardsHtml(notes, noteTypes = getNoteTypes()) {
  return (notes || []).map(n => {
    const meta = getNoteTypeMeta(n, noteTypes);
    return `<div class="snap-modal-note" style="background:${rgbaFromHex(meta.color, .06)};border-color:${rgbaFromHex(meta.color, .24)};"><div class="snap-modal-note-label" style="color:${normalizeHexColor(meta.color)};">${safeText(meta.label || 'Note')}</div><div class="snap-modal-note-text">${safeText(n.text || '')}</div></div>`;
  }).join('');
}
function bindPostDetailCopy(bodyEl) {
  bodyEl.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await copyTextSafe(btn.dataset.copy);
      if (ok) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy post'; }, 1800); }
      else showToast('Could not copy', 'error');
    });
  });
}
function editableNoteCardsHtml(notes, noteTypes = getNoteTypes()) {
  return (notes || []).map(n => {
    const meta = getNoteTypeMeta(n, noteTypes);
    return `<div class="snap-modal-note" style="background:${rgbaFromHex(meta.color, .06)};border-color:${rgbaFromHex(meta.color, .24)};"><div class="snap-modal-note-label" style="color:${normalizeHexColor(meta.color)};">${safeText(meta.label || 'Note')}</div><div class="snap-modal-note-text">${safeText(n.text || '')}</div><div class="snap-modal-note-actions"><button class="btn sm ghost" data-edit-note="${safeText(n.id || '')}">Edit note</button></div></div>`;
  }).join('');
}
function openCalendarDayDetails(date) {
  const key = fmtDate(date);
  const posts = state.scheduled.filter(p => fmtDate(new Date(p.dueAt)) === key);
  const notes = getNotesForDate(key);
  const titleEl = qs('sharedDayTitle');
  const bodyEl = qs('sharedDayBody');
  if (!titleEl || !bodyEl) return;
  titleEl.textContent = formatDateOnly(key);
  const sections = [];
  if (posts.length) sections.push(`<div style="margin-bottom:16px;"><div class="post-detail-label">${posts.length} Scheduled post${posts.length > 1 ? 's' : ''}</div>${postDetailCardsHtml(posts)}</div>`);
  if (notes.length) sections.push(`<div style="margin-bottom:16px;"><div class="post-detail-label">${notes.length} Planning note${notes.length > 1 ? 's' : ''}</div>${editableNoteCardsHtml(notes)}</div>`);
  if (!posts.length && !notes.length) sections.push('<div class="empty-state" style="padding:20px 16px 10px;"><div class="empty-title">No plans yet</div><div class="empty-desc">Add a planning note or draft content for this day.</div></div>');
  sections.push('<div class="row mt8"><button class="btn primary" data-add-note>Add planning note</button></div>');
  bodyEl.innerHTML = sections.join('');
  bindPostDetailCopy(bodyEl);
  bodyEl.querySelector('[data-add-note]')?.addEventListener('click', () => { closeModal('sharedDayModal'); openAddNoteForDate(date); });
  bodyEl.querySelectorAll('[data-edit-note]').forEach(btn => btn.addEventListener('click', () => { closeModal('sharedDayModal'); openAddNoteForDate(date, btn.dataset.editNote); }));
  openModal('sharedDayModal');
}
function openCalendarPostDetails(key, posts, notes = []) {
  openPostDetails(key, { posts, notes }, { title: formatDateOnly(key), noteTypes: getNoteTypes() });
}
function openPostDetails(key, data, options = {}) {
  const titleEl = qs('sharedDayTitle');
  const bodyEl  = qs('sharedDayBody');
  if (!titleEl || !bodyEl) return;
  titleEl.textContent = options.title || formatDateOnly(key);
  const sections = [];
  if (data.posts && data.posts.length) {
    sections.push(`<div style="margin-bottom:16px;"><div class="post-detail-label">${data.posts.length} Scheduled post${data.posts.length > 1 ? 's' : ''}</div>${postDetailCardsHtml(data.posts)}</div>`);
  } else {
    sections.push('<div class="empty-state" style="padding:20px 16px 10px;"><div class="empty-title">No post scheduled</div><div class="empty-desc">This day does not have a scheduled post in this calendar.</div></div>');
  }
  if (data.notes && data.notes.length) {
    sections.push(`<div><div class="post-detail-label">Planning notes</div>${noteCardsHtml(data.notes, options.noteTypes || getNoteTypes())}</div>`);
  }
  bodyEl.innerHTML = sections.join('');
  bindPostDetailCopy(bodyEl);
  openModal('sharedDayModal');
}
function openSharedDayDetails(key, data, snap = {}) {
  openPostDetails(key, { posts: data.posts || [], notes: snap.includeNotes !== false ? (data.notes || []) : [] }, { title: formatDateOnly(key), noteTypes: snap.noteTypes || DEFAULT_NOTE_TYPES });
}

function getSnapshotRange(snap) {
  return snap?.period || snap?.range || 'month';
}
function getSharedBaseDate(snap) {
  if (snap.rangeStart) {
    const d = new Date(snap.rangeStart + 'T00:00:00');
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (snap.posts?.[0]?.dueAt) {
    const d = new Date(snap.posts[0].dueAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (snap.notes?.[0]?.date) {
    const d = new Date(snap.notes[0].date + 'T00:00:00');
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (snap.month) {
    const d = new Date(snap.month + ' 1');
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}
function renderSharedDayCell(grid, key, date, data, snap, { inMonth = true } = {}) {
  const visibleNotes = snap.includeNotes !== false ? (data.notes || []) : [];
  const hasContent = (data.posts || []).length > 0 || visibleNotes.length > 0;
  const day = document.createElement('div');
  day.className = 'cal-day' + (!inMonth ? ' other-month' : '') + (hasContent ? ' has-content' : ' empty-day');
  let inner = '<div class="day-num">' + date.getDate() + '</div>';
  if (data.posts.length) {
    inner += '<div class="day-count">' + data.posts.length + '</div>';
    data.posts.slice(0,2).forEach(post => { inner += '<div class="day-post-pill">' + safeText((post.text||'').slice(0,60)) + '</div>'; });
    if (data.posts.length > 2) inner += '<div class="more-indicator">+' + (data.posts.length - 2) + ' more</div>';
  }
  if (visibleNotes.length) {
    visibleNotes.slice(0,1).forEach(n => { const meta = getNoteTypeMeta(n, snap.noteTypes || DEFAULT_NOTE_TYPES); inner += '<div class="day-note-pill" style="' + notePillStyle(meta) + '">' + safeText((n.text||'').slice(0,50)) + '</div>'; });
  }
  day.innerHTML = inner;
  if (hasContent) day.onclick = () => openSharedDayDetails(key, { posts: data.posts || [], notes: visibleNotes }, snap);
  grid.appendChild(day);
}
function renderSharedCalendarGrid(snap, map) {
  const grid = qs('sharedGrid');
  grid.innerHTML = '';
  const range = getSnapshotRange(snap);
  const baseDate = getSharedBaseDate(snap);
  if (range === 'week') {
    const start = new Date(baseDate);
    start.setHours(0,0,0,0);
    if (!snap.rangeStart) start.setDate(start.getDate() - start.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = fmtDate(d);
      renderSharedDayCell(grid, key, d, map[key] || { posts: [], notes: [] }, snap, { inMonth: true });
    }
    return;
  }
  const first = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = fmtDate(d);
    renderSharedDayCell(grid, key, d, map[key] || { posts: [], notes: [] }, snap, { inMonth: d.getMonth() === baseDate.getMonth() });
  }
}

function renderSharedErrorView(err) {
  console.error('Failed to render shared snapshot', err);
  qs('app')?.classList.add('hidden');
  qs('sharedView')?.classList.add('hidden');
  qs('sharedErrorView')?.classList.remove('hidden');
}
function parseSharedSnapshotFromHash() {
  const raw = location.hash.slice(7);
  if (!raw) throw new Error('Missing shared snapshot payload');
  const dot = raw.indexOf('.');
  const encoded = dot >= 0 ? raw.slice(dot + 1) : raw;
  if (!encoded) throw new Error('Missing encoded shared snapshot payload');
  const snap = JSON.parse(fromBase64Url(encoded));
  if (!snap || typeof snap !== 'object') throw new Error('Shared snapshot payload was not an object');
  return snap;
}
function renderSharedFromHash() {
  if (!location.hash.startsWith('#share=')) return false;
  try {
    const snap = parseSharedSnapshotFromHash();
    const posts = Array.isArray(snap.posts) ? snap.posts : [];
    const notes = snap.includeNotes !== false && Array.isArray(snap.notes) ? snap.notes : [];
    const hasPosts = posts.length > 0;
    const hasNotes = notes.length > 0;
    qs('app')?.classList.add('hidden');
    qs('sharedErrorView')?.classList.add('hidden');
    qs('sharedView')?.classList.remove('hidden');
    const titleEl = qs('sharedTitle');
    if (titleEl) titleEl.textContent = snapshotDisplayTitle(snap);
    const countEl = qs('sharedPostCount');
    if (countEl) {
      countEl.textContent = posts.length;
      if (countEl.parentElement) countEl.parentElement.innerHTML = '<strong id="sharedPostCount">' + posts.length + '</strong> scheduled post' + (posts.length === 1 ? '' : 's');
    }
    const noteEl = qs('sharedSnapshotNote');
    if (noteEl) {
      if (snap.message) {
        noteEl.textContent = snap.message;
      } else if (!hasPosts && hasNotes) {
        noteEl.textContent = 'This snapshot mainly contains planning notes for the selected range.';
      } else if (!hasPosts) {
        noteEl.textContent = 'This shared view does not include scheduled posts or planning notes for the selected range.';
      } else {
        noteEl.textContent = '';
      }
      noteEl.style.display = noteEl.textContent ? 'block' : 'none';
    }
    if (!hasPosts && !hasNotes && titleEl) titleEl.textContent = 'No posts in this snapshot';
    if (!hasPosts && hasNotes && titleEl && !snap.customTitle && !snap.title) titleEl.textContent = 'Planning notes snapshot';
    const periodEl = qs('sharedPeriodStat'); if (periodEl) periodEl.innerHTML = '<strong>' + safeText(snap.rangeLabel || snap.month || 'Snapshot') + '</strong>';
    const dot2 = qs('sharedNotesDot'); if (dot2) dot2.style.display = hasNotes ? 'block' : 'none';
    const stat = qs('sharedNotesStat');
    if (stat) {
      stat.style.display = hasNotes ? 'flex' : 'none';
      stat.innerHTML = hasNotes ? '<strong>' + notes.length + '</strong>&nbsp;planning note' + (notes.length > 1 ? 's' : '') : '';
    }
    const calLabel = qs('sharedCalLabel');
    if (calLabel) {
      if (hasPosts) calLabel.textContent = 'Click any highlighted day to read the full post';
      else if (hasNotes) calLabel.textContent = 'Click highlighted days to read planning notes';
      else calLabel.textContent = 'No posts in this snapshot';
    }
    const closeBtn = qs('closeSharedDay'); if (closeBtn) closeBtn.onclick = () => closeModal('sharedDayModal');
    const map = {};
    posts.forEach(p => { const k = String(p.dueAt || '').slice(0,10); if (!k) return; if (!map[k]) map[k]={posts:[],notes:[]}; map[k].posts.push(p); });
    notes.forEach(n => { if (!n.date) return; if (!map[n.date]) map[n.date]={posts:[],notes:[]}; map[n.date].notes.push(n); });
    renderSharedCalendarGrid({ ...snap, posts, notes }, map);
    return true;
  } catch(err) {
    renderSharedErrorView(err);
    return true;
  }
}

// ── COMPOSER ──────────────────────────────────────
function editorToText(html) {
  const root = document.createElement('div'); root.innerHTML = html;
  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    const tag = (node.tagName || '').toLowerCase();
    if (tag === 'br') return '\n';
    if (tag === 'strong' || tag === 'b') return `**${[...node.childNodes].map(walk).join('')}**`;
    if (tag === 'em' || tag === 'i') return `*${[...node.childNodes].map(walk).join('')}*`;
    if (tag === 'li') return [...node.childNodes].map(walk).join('');
    if (tag === 'ul') return [...node.children].map(li => `• ${walk(li)}`).join('\n') + '\n';
    if (tag === 'ol') return [...node.children].map((li, i) => `${i+1}. ${walk(li)}`).join('\n') + '\n';
    const inner = [...node.childNodes].map(walk).join('');
    if (['p','div'].includes(tag)) return inner + '\n';
    return inner;
  };
  return [...root.childNodes].map(walk).join('').replace(/\n{3,}/g, '\n\n').trim();
}

function composerFormat(cmd) {
  const sel = window.getSelection(); if (!sel?.rangeCount) return;
  if (cmd === 'bold' || cmd === 'italic') document.execCommand(cmd, false, null);
  else if (cmd === 'ul') document.execCommand('insertUnorderedList', false, null);
  else if (cmd === 'ol') document.execCommand('insertOrderedList', false, null);
  else if (cmd === 'clear') document.execCommand('removeFormat', false, null);
}

// ── MEDIA ──────────────────────────────────────────
function applyMedia(url, source, thumbUrl = '') {
  const type = isVideo(url) ? 'video' : 'image';
  mediaState.url = url; mediaState.type = type; mediaState.source = source; mediaState.videoThumbUrl = thumbUrl;
  const ton = qs('mediaToggleBtn'), toff = qs('mediaToggleOff'), tthumb = qs('mediaThumbPreview'), tlabel = qs('mediaToggleLabel');
  if (url) {
    ton.style.display = 'none'; toff.style.display = 'flex';
    tlabel.textContent = type === 'video' ? '🎬 Video attached' : '🖼 Image attached';
    if (tthumb) { tthumb.src = type === 'image' ? url : ''; tthumb.style.display = type === 'image' ? 'inline' : 'none'; }
    const ms = qs('mediaSummary'); if (ms) ms.style.display = 'flex';
    const mst = qs('mediaSummaryThumb'); if (mst) { mst.src = type === 'image' ? url : ''; mst.style.display = type === 'image' ? 'block' : 'none'; }
    const mstype = qs('mediaSummaryType'); if (mstype) mstype.textContent = type === 'video' ? '🎬 Video' : '🖼 Image';
    const msurl = qs('mediaSummaryUrl'); if (msurl) msurl.textContent = url;
  } else { clearMedia(); }
}

function clearMedia() {
  mediaState.url = ''; mediaState.type = ''; mediaState.source = ''; mediaState.videoThumbUrl = '';
  qs('mediaToggleBtn').style.display = 'flex'; qs('mediaToggleOff').style.display = 'none';
  const ms = qs('mediaSummary'); if (ms) ms.style.display = 'none';
  const inp = qs('mediaUrlInput'); if (inp) inp.value = '';
  resetUploadTab();
}

function resetUploadTab() {
  qs('uploadZone').style.display = 'block'; qs('uploadResult').style.display = 'none';
  const fi = qs('uploadFileInput'); if (fi) fi.value = '';
  const st = qs('uploadStatus'); if (st) { st.textContent = ''; }
}

async function imgurUpload(file) {
  const fd = new FormData(); fd.append('image', file);
  const res = await fetch('https://api.imgur.com/3/image', { method: 'POST', headers: { Authorization: `Client-ID ${IMGUR_KEY}` }, body: fd });
  const data = await res.json();
  if (!data.success) throw new Error(data.data?.error || 'Upload failed');
  return data.data.link;
}

function getErrorMessage(err) {
  if (err instanceof Error) return err.message;
  return String(err || 'Unknown error');
}

function logLocalModuleError(scope, err, details = {}) {
  console.error(`[PostIQ:${scope}]`, { message: getErrorMessage(err), details, error: err });
}

async function handleUploadFile(file) {
  const st = qs('uploadStatus');
  const zone = qs('uploadZone');
  try {
    if (!st || !zone) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { st.textContent = 'Unsupported type.'; return; }
    if (file.type.startsWith('video/')) {
      st.textContent = 'For video, use the URL tab with a hosted video link.';
      switchMediaTab('url'); return;
    }
    zone.style.display = 'none'; st.textContent = 'Uploading…';
    const url = await imgurUpload(file);
    qs('uploadResult').style.display = 'flex';
    qs('uploadThumb').src = url; qs('uploadResultName').textContent = file.name || 'uploaded image'; qs('uploadResultUrl').textContent = url;
    st.textContent = ''; applyMedia(url, 'upload'); showToast('Image uploaded', 'success');
  } catch (err) {
    if (zone) zone.style.display = 'block';
    if (st) st.textContent = 'Unable to upload image. Please try again.';
    logLocalModuleError('upload', err, { fileName: file?.name, fileType: file?.type, fileSize: file?.size });
    return;
  }
}

function switchMediaTab(id) {
  if (id === 'upload' && !getFeatureFlag('uploads')) { showFeaturePaused('uploads'); return; }
  if (id === 'unsplash' && !getFeatureFlag('unsplash')) { showFeaturePaused('unsplash'); return; }
  document.querySelectorAll('.media-tab').forEach(t => t.classList.toggle('active', t.dataset.mtab === id));
  document.querySelectorAll('.media-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.mtabpanel === id));
}

let _unsplashLast = '';
async function runUnsplashSearch() {
  const queryInput = qs('unsplashQuery');
  const grid = qs('unsplashGrid');
  const status = qs('unsplashStatus');
  try {
    if (!queryInput || !grid || !status) return;
    const q = queryInput.value.trim(); if (!q) return;
    if (q === _unsplashLast) return; _unsplashLast = q;
    status.textContent = 'Searching…'; grid.innerHTML = '';
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=9&orientation=landscape`, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } });
    if (!res.ok) throw new Error(res.status === 403 ? 'Rate limit' : `HTTP ${res.status}`);
    const data = await res.json();
    if (!data.results?.length) { status.textContent = `No results for "${q}".`; return; }
    status.textContent = `${data.total.toLocaleString()} results`;
    data.results.forEach(photo => {
      const item = document.createElement('div');
      item.style.cssText = 'position:relative;border-radius:6px;overflow:hidden;border:2px solid transparent;cursor:pointer;aspect-ratio:4/3;background:var(--surface2);transition:border-color .12s;';
      const img = document.createElement('img');
      img.src = toSafeExternalUrl(photo?.urls?.small);
      img.alt = '';
      img.loading = 'lazy';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      item.appendChild(img);
      item.title = `Photo by ${photo.user.name}`;
      item.onmouseenter = () => { item.style.borderColor = 'var(--brand)'; };
      item.onmouseleave = () => { item.style.borderColor = 'transparent'; };
      item.onclick = () => { const mediaUrl = toSafeExternalUrl(photo?.urls?.regular); if (!mediaUrl) return; applyMedia(mediaUrl, 'unsplash'); closeMediaPanel(); showToast(`Photo by ${photo.user.name} added`, 'success'); };
      grid.appendChild(item);
    });
  } catch (err) {
    if (status) status.textContent = 'Unable to fetch images. Please try again.';
    logLocalModuleError('unsplash-search', err, { query: queryInput?.value?.trim() || '' });
    return;
  }
}

function openMediaPanel() { qs('mediaPanel')?.classList.add('open'); }
function closeMediaPanel() { qs('mediaPanel')?.classList.remove('open'); }

// ── POST CREATION ──────────────────────────────────
async function createPost(input) {
  const mutation = `mutation CreatePost($input:CreatePostInput!){createPost(input:$input){__typename ... on PostActionSuccess{post{id dueAt text channelId}} ... on MutationError{message}}}`;
  const normalizedInput = normalizeBufferPostInput(input);
  const res = await callBuffer(mutation, { input: normalizedInput });
  const result = res?.data?.createPost;
  if (!result) throw new Error('Empty mutation response.');
  if (result.__typename === 'MutationError') throw new Error(result.message || 'Buffer rejected this post.');
  if (result.__typename !== 'PostActionSuccess') throw Object.assign(new Error(result.message || `Unexpected result: ${result.__typename}`), { code: 'MUTATION_ERROR' });
  return result;
}

async function editPost(input, options = {}) {
  const mutation = `mutation EditPost($input:EditPostInput!){editPost(input:$input){__typename ... on PostActionSuccess{post{id dueAt text channelId}} ... on MutationError{message}}}`;
  const normalizedInput = normalizeBufferPostInput(input, { clearAssets: !!options.clearAssets });
  const res = await callBuffer(mutation, { input: normalizedInput });
  const result = res?.data?.editPost;
  if (!result) throw new Error('Empty mutation response.');
  if (result.__typename === 'MutationError') throw new Error(result.message || 'Buffer rejected this post.');
  if (result.__typename !== 'PostActionSuccess') throw Object.assign(new Error(result.message || `Unexpected result: ${result.__typename}`), { code: 'MUTATION_ERROR' });
  return result;
}

function appendScheduled(post, sourceInput = {}) {
  const id = post?.id; if (!id) return;
  if (state.scheduled.some(p => p.id === id)) return;
  const channel = state.channels.find(c => c.id === (post.channelId || sourceInput.channelId));
  state.scheduled = [...state.scheduled, {
    id, text: post.text || sourceInput.text || '', dueAt: post.dueAt || sourceInput.dueAt, channelId: post.channelId || sourceInput.channelId,
    channelName: channel?.displayName || channel?.name || '', platform: channel?.service || '', status: 'scheduled',
    mediaUrls: mediaUrlsFromAssets(sourceInput.assets)
  }];
  cache.scheduled = { value: state.scheduled, ts: Date.now() }; saveCacheState();
}

async function composerSend(action) {
  const text = editorToText(qs('composerEditor').innerHTML);
  if (!text) { showToast('Write something first', 'error'); return; }
  const connection = getBufferConnectionState();
  const oauthToken = getStoredOAuthToken();
  if (!connection.connected && !oauthToken?.accessToken && !oauthToken?.refreshToken) { showToast(connection.reconnectNeeded ? 'Reconnect Buffer first' : 'Connect Buffer first', 'error'); return; }
  const channelId = qs('composerChannel').value;
  if (!channelId) { showToast('Load channels first', 'error'); return; }
  const needsApproval = qs('needsApprovalCheck')?.checked || false;
  const when = qs('composerWhen').value;
  const input = { channelId, text, schedulingType: 'automatic' };
  if (action === 'draft') { input.mode = 'addToQueue'; input.saveToDraft = true; }
  if (action === 'queue') { input.mode = 'addToQueue'; }
  if (action === 'schedule') {
    if (!when) { qs('composerStatus').textContent = 'Pick a date/time first.'; return; }
    input.mode = 'customScheduled'; input.dueAt = when;
  }
  const imgUrl = mediaState.url || '';
  if (imgUrl) {
    if (isVideo(imgUrl)) {
      const entry = { url: imgUrl };
      if (mediaState.videoThumbUrl) entry.thumbnailUrl = mediaState.videoThumbUrl;
      input.assets = [{ video: entry }];
    } else {
      input.assets = [{ image: { url: imgUrl } }];
    }
  }
  qs('composerStatus').textContent = 'Sending…';
  try {
    const created = await createPost(input);
    const draftId = created?.post?.id;
    if (action === 'draft' && needsApproval && draftId) {
      const ch = state.channels.find(c => c.id === channelId);
      setApprovalMeta(draftId, {
        needs_approval: true, status: 'pending', comments: [], link_generated: false, locked: false,
        content: text, platform: ch?.service || null, image_url: imgUrl || null, channel_id: channelId, created_at: Date.now(),
      });
    }
    const msg = action === 'draft' ? 'Buffer draft saved.' : action === 'queue' ? 'Added to queue.' : 'Scheduled.';
    qs('composerStatus').textContent = msg; showToast(msg, 'success');
    if (created?.post?.dueAt) { appendScheduled(created.post, input); renderCalendar(); }
    qs('composerEditor').innerHTML = '';
    qs('composerEditor').dispatchEvent(new Event('input'));
    qs('composerWhen').value = '';
    if (qs('needsApprovalCheck')) qs('needsApprovalCheck').checked = false;
    clearMedia(); closeMediaPanel();
    qs('schedulePanel').classList.remove('open');
    qs('composerScheduleToggle').style.display = 'inline-flex';
  } catch (e) {
    const msg = getErrorMessage(e, 'Failed to send.');
    if (isAuthError(e)) handleAuthFailure(msg);
    qs('composerStatus').textContent = `Failed: ${msg}`;
    showToast('Failed: ' + msg, 'error');
  }
}

// ── APPROVALS ──────────────────────────────────────
const appState = { loading: false };

async function loadApprovals() {
  if (!getFeatureFlag('approvals')) { showFeaturePaused('approvals'); return; }
  if (appState.loading) return; appState.loading = true;
  const listEl = qs('approvalsList'), emptyEl = qs('approvalsEmpty');
  if (!listEl) { appState.loading = false; return; }
  listEl.innerHTML = '';
  if (emptyEl) emptyEl.style.display = 'none';
  try {
    const metas = getAllApprovalMetas();
    if (!metas.length) { if (emptyEl) emptyEl.style.display = 'flex'; appState.loading = false; return; }
    for (const meta of metas) {
      if (meta.link_generated && meta.approval_uuid) {
        try {
          const r = await fetch('/.netlify/functions/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get', id: meta.approval_uuid }) });
          const d = await r.json();
          if (!d.error) {
            const updated = { ...meta, status: d.status || meta.status, comments: d.comments || meta.comments };
            if (d.status === 'changes_requested') { updated.link_generated = false; updated.locked = false; }
            setApprovalMeta(meta.draftId, updated); Object.assign(meta, updated);
          }
        } catch {}
      }
    }
    metas.forEach(meta => renderApprovalCard(meta));
  } catch (e) { console.error('[PostIQ] loadApprovals:', e); }
  finally { appState.loading = false; }
}

function renderApprovalCard(meta) {
  const listEl = qs('approvalsList');
  const safeId = meta.draftId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const statusClass = meta.status === 'approved' ? 'approved' : meta.status === 'changes_requested' ? 'changes' : 'pending';
  const statusLabel = meta.status === 'approved' ? 'Approved' : meta.status === 'changes_requested' ? 'Changes Requested' : 'Pending';
  const platformBadge = meta.platform ? `<span class="chip">${safeText(meta.platform)}</span>` : '';
  const pubDisabled = meta.status === 'pending' && meta.link_generated;
  const dmMono = 'DM Mono';

  const card = document.createElement('div');
  card.className = 'approval-card';
  card.dataset.draftId = meta.draftId;
  card.dataset.safeId = safeId;

  card.innerHTML = `
    <div class="approval-card-status-bar ${statusClass}"></div>
    <div class="approval-card-header">
      <div class="approval-card-meta">
        <span class="approval-status-badge ${statusClass}">${statusLabel}</span>
        ${platformBadge}
        <span style="font-size:10px;font-family:'${dmMono}',monospace;color:var(--subtle);">${meta.created_at ? new Date(meta.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : ''}</span>
      </div>
      <button class="btn sm ghost" onclick="approvalRemove('${safeId}')">✕ Remove</button>
    </div>
    <div class="approval-card-body">
      ${meta.image_url ? `<img src="${safeText(meta.image_url)}" alt="Media" style="width:100%;max-height:240px;object-fit:cover;border-radius:8px;border:1px solid var(--border);margin-bottom:12px;display:block;" />` : ''}
      <div class="approval-content-text">${safeText(meta.content || '')}</div>
      ${meta.comments?.length ? `
        <div class="approval-comments">
          <div style="font-size:10px;font-family:'${dmMono}',monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">Reviewer feedback</div>
          ${meta.comments.map(c => `
            <div class="approval-comment">
              <div class="approval-comment-meta">
                <span class="approval-comment-author">${safeText(c.author || 'Anonymous')}</span>
                <span class="approval-comment-time">${c.timestamp ? new Date(c.timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : ''}</span>
                ${c.action ? `<span class="approval-comment-action ${c.action === 'approved' ? 'approved' : 'changes'}">${c.action === 'approved' ? 'Approved' : 'Changes'}</span>` : ''}
              </div>
              <div class="approval-comment-text">${safeText(c.text || '')}</div>
            </div>`).join('')}
        </div>` : ''}
    </div>
    <div class="approval-footer">
      ${!meta.link_generated ? `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:12px;font-weight:600;margin-bottom:2px;">Share for approval</div>
            <div style="font-size:11px;color:var(--muted);">Generate a link to send to your reviewer.</div>
          </div>
          <button class="btn primary" id="approval-gen-${safeId}" onclick="approvalGenerateLink('${safeId}')">🔗 Generate Link</button>
        </div>` : `
        <div style="margin-bottom:12px;">
          <div class="label mb8">Approval link</div>
          <div class="approval-link-row">
            <span class="approval-link-url">${safeText(meta.approval_url || '')}</span>
            <button class="btn sm" onclick="approvalCopyLink('${safeId}')">Copy</button>
          </div>
        </div>
        <div style="${pubDisabled ? 'opacity:.45;pointer-events:none;' : ''}">
          ${pubDisabled ? `<div style="font-size:11px;font-family:'${dmMono}',monospace;color:var(--subtle);margin-bottom:10px;">Publishing unlocks once reviewer responds.</div>` : ''}
          <div class="label mb8">Publish to</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <select id="approval-ch-${safeId}" class="input" style="flex:1;min-width:160px;font-size:13px;"></select>
            <button class="btn sm" onclick="approvalPublish('${safeId}','draft')">Draft</button>
            <button class="btn sm success" onclick="approvalPublish('${safeId}','queue')">Queue</button>
            <button class="btn sm primary" onclick="approvalToggleSchedule('${safeId}')">📅 Schedule</button>
          </div>
          <div id="approval-sched-${safeId}" style="display:none;margin-top:8px;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <input type="date" id="approval-date-${safeId}" class="input" style="flex:1;" />
              <input type="time" id="approval-time-${safeId}" class="input" style="max-width:120px;" value="09:00" />
              <button class="btn sm primary" onclick="approvalPublish('${safeId}','schedule')">Send</button>
              <button class="btn sm ghost" onclick="document.getElementById('approval-sched-${safeId}').style.display='none'">✕</button>
            </div>
          </div>
        </div>`}
      <div id="approval-status-${safeId}" style="font-size:12px;color:var(--muted);margin-top:8px;font-family:'${dmMono}',monospace;min-height:16px;"></div>
    </div>`;

  setTimeout(() => {
    const sel = document.getElementById(`approval-ch-${safeId}`);
    if (sel) {
      sel.innerHTML = '';
      if (state.channels.length) {
        state.channels.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.displayName || c.name} (${c.service})`; if (c.id === meta.channel_id) o.selected = true; sel.appendChild(o); });
      } else { const o = document.createElement('option'); o.value = ''; o.textContent = '↻ Load channels from Buffer first'; sel.appendChild(o); }
    }
    const di = document.getElementById(`approval-date-${safeId}`); if (di) di.value = new Date().toISOString().slice(0,10);
  }, 0);

  listEl.appendChild(card);
}

function getApprovalDraftId(safeId) {
  const card = document.querySelector(`.approval-card[data-safe-id="${CSS.escape(safeId)}"]`);
  return card?.dataset?.draftId || safeId;
}

window.approvalGenerateLink = async function (safeId) {
  const draftId = getApprovalDraftId(safeId);
  const meta = getApprovalMeta(draftId); if (!meta) { showToast('Record not found', 'error'); return; }
  const btn = document.getElementById(`approval-gen-${safeId}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
  try {
    const res = await fetch('/.netlify/functions/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', post: { content: meta.content || '', platform: meta.platform || null, image_url: meta.image_url || null } }) });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    setApprovalMeta(draftId, { ...meta, link_generated: true, locked: true, approval_uuid: data.id, approval_url: data.url });
    showToast('Approval link generated!', 'success'); loadApprovals();
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🔗 Generate Link'; }
  }
};

window.approvalCopyLink = function (safeId) {
  const draftId = getApprovalDraftId(safeId); const meta = getApprovalMeta(draftId);
  if (!meta?.approval_url) { showToast('No link available', 'error'); return; }
  navigator.clipboard.writeText(meta.approval_url); showToast('Link copied!', 'success');
};

window.approvalRemove = function (safeId) {
  const draftId = getApprovalDraftId(safeId);
  if (!confirm('Remove this approval entry? The Buffer draft is not deleted.')) return;
  clearApprovalMeta(draftId);
  const card = document.querySelector(`[data-draft-id="${CSS.escape(draftId)}"]`);
  if (card) card.remove(); else loadApprovals();
  showToast('Removed');
};

window.approvalToggleSchedule = function (safeId) {
  const panel = document.getElementById(`approval-sched-${safeId}`);
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};

window.approvalPublish = async function (safeId, action) {
  const draftId = getApprovalDraftId(safeId); const meta = getApprovalMeta(draftId);
  if (!meta) { showToast('Record not found', 'error'); return; }
  const channelId = document.getElementById(`approval-ch-${safeId}`)?.value;
  if (!channelId) { showToast('Select a channel first', 'error'); return; }
  const input = { channelId, text: meta.content || '', schedulingType: 'automatic' };
  if (action === 'draft') { input.mode = 'addToQueue'; input.saveToDraft = true; }
  if (action === 'queue') { input.mode = 'addToQueue'; }
  if (action === 'schedule') {
    const dv = document.getElementById(`approval-date-${safeId}`)?.value;
    const tv = document.getElementById(`approval-time-${safeId}`)?.value || '09:00';
    if (!dv) { showToast('Pick a date first', 'error'); return; }
    input.mode = 'customScheduled'; input.dueAt = `${dv}T${tv}:00.000Z`;
  }
  if (meta.image_url) { if (isVideo(meta.image_url)) input.assets = [{ video: { url: meta.image_url } }]; else input.assets = [{ image: { url: meta.image_url } }]; }
  const statusEl = document.getElementById(`approval-status-${safeId}`);
  if (statusEl) statusEl.textContent = 'Sending…';
  try {
    const created = await createPost(input);
    clearApprovalMeta(draftId);
    const msg = action === 'draft' ? 'Buffer draft saved.' : action === 'queue' ? 'Added to queue.' : 'Scheduled.';
    showToast(msg, 'success');
    if (created?.post?.dueAt) { appendScheduled(created.post, input); renderCalendar(); }
    const card = document.querySelector(`[data-draft-id="${CSS.escape(draftId)}"]`);
    if (card) { card.style.opacity = '.4'; card.style.pointerEvents = 'none'; setTimeout(() => card.remove(), 600); }
  } catch (e) {
    const msg = getErrorMessage(e, 'Failed.');
    if (isAuthError(e)) handleAuthFailure(msg);
    if (statusEl) statusEl.textContent = `Failed: ${msg}`;
    showToast('Failed: ' + msg, 'error');
  }
};

// ── REVIEWER PAGE ──────────────────────────────────
async function renderReviewerPage(uuid) {
  document.getElementById('app')?.style.setProperty('display','none');
  document.querySelector('.mobile-tabs')?.style.setProperty('display','none');
  const page = qs('reviewerPage'); if (!page) return;
  page.classList.add('active');
  const loading = qs('reviewerLoading'), content = qs('reviewerContent'), confirmed = qs('reviewerConfirmed'), error = qs('reviewerError');
  loading.style.display = 'block'; content.style.display = 'none'; confirmed.style.display = 'none'; error.style.display = 'none';
  try {
    const res = await fetch('/.netlify/functions/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get', id: uuid }) });
    const record = await res.json();
    loading.style.display = 'none';
    if (record.error) { error.style.display = 'block'; qs('reviewerErrorMsg').textContent = 'This review link could not be found. It may have expired or been removed.'; return; }
    content.style.display = 'block';
    const { platform, content: postContent, image_url: imageUrl } = record.post || {};
    const comments = record.comments || [];
    const dmMono = 'DM Mono';
    content.innerHTML = `
      <div class="reviewer-card">
        ${platform ? `<div style="font-size:10px;font-family:'${dmMono}',monospace;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px;border:1px solid var(--border2);border-radius:4px;color:var(--subtle);display:inline-flex;margin-bottom:16px;">${safeText(platform)}</div>` : ''}
        <div style="font-size:15px;line-height:1.75;color:var(--text);white-space:pre-wrap;word-break:break-word;">${safeText(postContent || '')}</div>
        ${imageUrl ? `<img src="${safeText(imageUrl)}" style="width:100%;max-height:360px;object-fit:cover;border-radius:10px;border:1px solid var(--border);margin-top:16px;" />` : ''}
      </div>
      ${comments.length ? `
        <div class="reviewer-card">
          <div style="font-size:11px;font-weight:600;font-family:'${dmMono}',monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:14px;">Previous comments</div>
          ${comments.map(c => `<div style="padding:12px;background:var(--surface2);border-radius:8px;margin-bottom:8px;"><div style="font-weight:600;font-size:13px;margin-bottom:2px;">${safeText(c.author || 'Anonymous')}</div><div style="font-size:14px;color:var(--muted);line-height:1.55;">${safeText(c.text || '')}</div></div>`).join('')}
        </div>` : ''}
      <div class="reviewer-card">
        <div style="margin-bottom:18px;">
          <label class="reviewer-form-label" for="reviewerAuthor">Your name</label>
          <input id="reviewerAuthor" class="input" placeholder="Enter your name…" style="background:var(--surface2);border-color:var(--border2);" />
        </div>
        <div style="margin-bottom:22px;">
          <label class="reviewer-form-label" for="reviewerComment">Notes (optional)</label>
          <textarea id="reviewerComment" class="input" placeholder="Leave feedback or approval notes…" style="background:var(--surface2);border-color:var(--border2);min-height:90px;"></textarea>
        </div>
        <div class="reviewer-actions">
          <button class="reviewer-btn approve" id="reviewerApproveBtn" onclick="submitReview('${safeText(uuid)}','approved')">✓ Approve</button>
          <button class="reviewer-btn changes" id="reviewerChangesBtn" onclick="submitReview('${safeText(uuid)}','changes_requested')">✎ Request Changes</button>
        </div>
        <div id="reviewerStatus" style="font-size:13px;color:var(--muted);text-align:center;margin-top:12px;min-height:20px;"></div>
      </div>`;
  } catch (e) {
    loading.style.display = 'none'; error.style.display = 'block';
    qs('reviewerErrorMsg').textContent = 'Failed to load the review. Please try again.';
  }
}

window.submitReview = async function (uuid, action) {
  const author = (qs('reviewerAuthor')?.value || '').trim() || 'Anonymous';
  const comment = (qs('reviewerComment')?.value || '').trim();
  const approveBtn = qs('reviewerApproveBtn'), changesBtn = qs('reviewerChangesBtn'), statusEl = qs('reviewerStatus');
  if (approveBtn) approveBtn.disabled = true; if (changesBtn) changesBtn.disabled = true;
  if (statusEl) statusEl.textContent = 'Submitting…';
  try {
    const res = await fetch('/.netlify/functions/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: uuid, status: action, author, comment: comment || (action === 'approved' ? 'Approved.' : 'Changes requested.') }) });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    qs('reviewerContent').style.display = 'none'; qs('reviewerConfirmed').style.display = 'block';
    const isApproved = action === 'approved';
    qs('reviewerConfirmIcon').textContent = isApproved ? '✅' : '📝';
    qs('reviewerConfirmTitle').textContent = isApproved ? 'Approved!' : 'Feedback Sent';
    qs('reviewerConfirmDesc').textContent = isApproved
      ? 'Approval recorded. The author can now publish.'
      : 'Feedback sent. The author will make revisions and share a new link if needed.';
  } catch (e) {
    if (approveBtn) approveBtn.disabled = false; if (changesBtn) changesBtn.disabled = false;
    if (statusEl) statusEl.textContent = 'Error: ' + e.message;
  }
};

// ── VIEW NAVIGATION ──────────────────────────────────
function activateView(viewId) {
  if (viewId === 'approvalsView' && !getFeatureFlag('approvals')) { showFeaturePaused('approvals'); return; }
  currentViewId = viewId;
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x.dataset.view === viewId));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === viewId));
  document.querySelectorAll('.mob-tab[data-view]').forEach(t => t.classList.toggle('active', t.dataset.view === viewId));
  if (viewId === 'ideasView') setIdeasTab('pillars');
  if (viewId === 'approvalsView') loadApprovals();
}
window.activateView = activateView;

function setIdeasTab(tabId = 'pillars') {
  if (tabId === 'trending' && !getFeatureFlag('trending')) { showFeaturePaused('trending'); tabId = 'pillars'; }
  const tab = ['pillars', 'templates', 'trending'].includes(tabId) ? tabId : 'pillars';
  currentIdeasTab = tab;
  document.querySelectorAll('.ideas-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ideasTab === tab);
  });
  document.querySelectorAll('[data-ideas-panel]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.ideasPanel === tab);
  });
}

// ── SCHEDULE PICKERS ──────────────────────────────────
function buildTimePickers() {
  const h = qs('scheduleHour'), m = qs('scheduleMin'), ap = qs('scheduleAmpm');
  for (let i = 1; i <= 12; i++) { const o = document.createElement('option'); o.value = i; o.textContent = String(i).padStart(2, '0'); h.appendChild(o); }
  for (let i = 0; i < 60; i += 5) { const o = document.createElement('option'); o.value = i; o.textContent = String(i).padStart(2, '0'); m.appendChild(o); }
  ['AM','PM'].forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; ap.appendChild(o); });
  const now = new Date(); h.value = (now.getHours() % 12) || 12; m.value = 0; ap.value = now.getHours() >= 12 ? 'PM' : 'AM';
}

function syncComposerWhen() {
  const dateEl = qs('scheduleDate'), hourEl = qs('scheduleHour'), minEl = qs('scheduleMin'), ampmEl = qs('scheduleAmpm'), whenEl = qs('composerWhen');
  if (!dateEl || !hourEl || !minEl || !ampmEl || !whenEl) return;
  const d = dateEl.value; if (!d) { whenEl.value = ''; return; }
  let h = parseInt(hourEl.value); const m = parseInt(minEl.value); const ap = ampmEl.value;
  if (ap === 'PM' && h !== 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
  whenEl.value = `${d}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`;
}

// ── INIT ──────────────────────────────────────────────
function renderPlanningSettings() {
  const show = qs('showQueueGapsSetting');
  const daysWrap = qs('postingDaysSettings');
  if (!show || !daysWrap) return;
  const settings = getPlanningSettings();
  show.checked = settings.showQueueGaps;
  daysWrap.innerHTML = DAY_CODES.map((code, idx) => `<label class="settings-check"><input type="checkbox" data-posting-day="${code}" ${settings.postingDays.includes(code) ? 'checked' : ''} /> ${DAY_LABELS[idx]}</label>`).join('');
}
function savePlanningSettingsFromUI() {
  const show = qs('showQueueGapsSetting');
  const postingDays = [...document.querySelectorAll('[data-posting-day]')].filter(i => i.checked).map(i => i.dataset.postingDay);
  const next = { showQueueGaps: !!show?.checked, postingDays: postingDays.length ? postingDays : DEFAULT_PLANNING_SETTINGS.postingDays };
  setPlanningSettings(next);
  detectQueueGaps();
}
function renderNoteTypesSettings() {
  const wrap = qs('noteTypesSettings'); if (!wrap) return;
  const types = getNoteTypes();
  wrap.innerHTML = types.map((t, idx) => `
    <div class="note-type-row" data-note-type-row="${safeText(t.id)}">
      <input type="color" value="${safeText(t.color)}" data-note-type-color="${safeText(t.id)}" aria-label="${safeText(t.label)} color" />
      <input class="input" value="${safeText(t.label)}" data-note-type-label="${safeText(t.id)}" maxlength="40" />
      <button class="btn sm ghost" type="button" data-delete-note-type="${safeText(t.id)}" ${DEFAULT_NOTE_TYPES.some(d => d.id === t.id) ? 'disabled title="Default types cannot be deleted"' : ''}>Delete</button>
    </div>`).join('');
  renderNoteTypeOptions(qs('noteTag')?.value);
}
function saveNoteTypesFromSettings() {
  const current = getNoteTypes();
  const next = current.map(t => {
    const label = document.querySelector(`[data-note-type-label="${CSS.escape(t.id)}"]`)?.value.trim() || t.label;
    const color = document.querySelector(`[data-note-type-color="${CSS.escape(t.id)}"]`)?.value || t.color;
    return { ...t, label, color };
  });
  setNoteTypes(next);
  renderCalendar();
  renderNoteTypeOptions(qs('noteTag')?.value);
}
function addNoteType() {
  const types = getNoteTypes();
  const id = `custom_${Date.now().toString(36)}`;
  types.push({ id, label: 'New type', color: '#6366f1' });
  setNoteTypes(types);
  renderNoteTypesSettings();
}
function deleteNoteType(id) {
  if (DEFAULT_NOTE_TYPES.some(t => t.id === id)) return;
  const notes = getNotes();
  const inUse = Object.values(notes).some(list => (Array.isArray(list) ? list : [list]).some(n => (n.typeId || n.type || n.id) === id));
  if (inUse) { showToast('This note type is used by existing notes.', 'error'); return; }
  setNoteTypes(getNoteTypes().filter(t => t.id !== id));
  renderNoteTypesSettings();
  renderCalendar();
}

function init() {
  const approveParam = new URLSearchParams(location.search).get('approve');
  if (approveParam) { renderReviewerPage(approveParam); return; }
  if (renderSharedFromHash()) return;

  markAppVisited();
  loadStoredToken();
  loadTemplates();
  initTemplateSelectors();
  renderTemplates();
  if (window.ContentPillars?.init) window.ContentPillars.init();
  buildTimePickers();
  const scheduleDate = qs('scheduleDate');
  if (scheduleDate) {
    scheduleDate.value = new Date().toISOString().slice(0, 10);
    scheduleDate.min = new Date().toISOString().slice(0, 10);
  }
  renderChannelSelects();
  renderCalendar();
  renderPlanningSettings();
  renderNoteTypesSettings();
  activateView('calendarView');

  on('manageTokenBtn', 'click', () => {
    const connection = getBufferConnectionState();
    if (connection.connected) syncBuffer({ force: true });
    else goToBufferConnect();
  });
  on('revealTokenBtn', 'click', openConnectionSettings);
  on('saveTokenBtn', 'click', saveToken);
  on('clearTokenBtn', 'click', () => { const tokenInput = qs('tokenInput'); if (tokenInput) tokenInput.value = ''; saveToken(); });
  const connectBufferBtn = qs('connectBufferBtn'); if (connectBufferBtn) connectBufferBtn.onclick = goToBufferConnect;
  const disconnectBufferBtn = qs('disconnectBufferBtn'); if (disconnectBufferBtn) disconnectBufferBtn.onclick = disconnectBuffer;

  on('syncBtn', 'click', () => syncBuffer({ force: true }));
  const initialParams = new URLSearchParams(location.search);
  const connectedParam = initialParams.get('connected');
  if (connectedParam === 'buffer') {
    showToast('Buffer connected.', 'success');
    setSyncStatus('idle', 'Buffer connected.');
    const cleanParams = new URLSearchParams(location.search);
    cleanParams.delete('connected');
    const cleanUrl = `${location.pathname}${cleanParams.toString() ? `?${cleanParams.toString()}` : ''}${location.hash || ''}`;
    history.replaceState({}, document.title, cleanUrl);
  }
  renderConnectionUI();
  if (initialParams.get('settings') === 'connection') {
    openConnectionSettings({ advancedApi: initialParams.get('advanced') === 'api' });
  }
  checkBufferConnectionHealth().then(connection => {
    if (connection.connected) {
      const hasCachedScheduledPosts = Array.isArray(state.scheduled) && state.scheduled.length > 0;
      setSyncStatus('idle', hasCachedScheduledPosts
        ? 'Using cached Buffer data. Click Sync now to refresh.'
        : 'Connected. Click Sync now to load Buffer posts.');
    } else if (connection.reconnectNeeded) {
      setSyncStatus('failed', 'Reconnect Buffer to keep syncing.');
    }
  });

  document.querySelectorAll('[data-view]').forEach(b => {
    b.onclick = () => {
      activateView(b.dataset.view);
      if (b.dataset.view === 'ideasView' && b.dataset.ideasTab) setIdeasTab(b.dataset.ideasTab);
    };
  });
  document.querySelectorAll('.ideas-tab').forEach(tabBtn => {
    tabBtn.onclick = () => setIdeasTab(tabBtn.dataset.ideasTab);
  });

  on('prevMonth', 'click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCalendar(); detectQueueGaps(); });
  on('nextMonth', 'click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCalendar(); detectQueueGaps(); });
  on('todayMonth', 'click', () => { state.month = new Date(); renderCalendar(); detectQueueGaps(); });
  on('closeNote', 'click', () => { closeModal('noteModal'); resetNoteForm(); });
  const closeShared = qs('closeSharedDay'); if (closeShared) closeShared.onclick = () => closeModal('sharedDayModal');
  on('saveNoteBtn', 'click', saveNote);
  on('deleteNoteBtn', 'click', deleteNote);
  on('sendNoteToDraftBtn', 'click', sendNoteToDraft);
  on('shareMonthBtn', 'click', openShareSnapshotModal);
  on('closeShare', 'click', () => closeModal('shareModal'));
  on('includeNotes', 'change', markShareNeedsRefresh);
  const shareRangeInput = qs('shareRange'); if (shareRangeInput) shareRangeInput.onchange = markShareNeedsRefresh;
  const shareTitleInput = qs('shareCustomTitle'); if (shareTitleInput) shareTitleInput.oninput = markShareNeedsRefresh;
  const shareNoteInput = qs('shareNote'); if (shareNoteInput) shareNoteInput.oninput = markShareNeedsRefresh;
  const calendarFilter = qs('calendarFilter'); if (calendarFilter) calendarFilter.onchange = e => { state.calendarFilter = e.target.value || 'all'; renderCalendar(); };
  const showQueue = qs('showQueueGapsSetting'); if (showQueue) showQueue.onchange = savePlanningSettingsFromUI;
  const postingDays = qs('postingDaysSettings'); if (postingDays) postingDays.addEventListener('change', savePlanningSettingsFromUI);
  const noteTypesWrap = qs('noteTypesSettings'); if (noteTypesWrap) {
    noteTypesWrap.addEventListener('input', saveNoteTypesFromSettings);
    noteTypesWrap.addEventListener('click', e => { const btn = e.target.closest('[data-delete-note-type]'); if (btn) deleteNoteType(btn.dataset.deleteNoteType); });
  }
  const addNoteTypeBtn = qs('addNoteTypeBtn'); if (addNoteTypeBtn) addNoteTypeBtn.onclick = addNoteType;
  on('generateShare', 'click', shareSnapshot);
  on('copyShare', 'click', copyCurrentShareLink);

  const editor = qs('composerEditor');
  if (!editor) { applyFeatureFlags(); return; }
  editor.addEventListener('input', () => {
    const text = editorToText(editor.innerHTML);
    const ch = state.channels.find(c => c.id === qs('composerChannel')?.value);
    const svc = (ch?.service || '').toLowerCase();
    let limit = null;
    if (svc.includes('twitter') || svc.includes('x-')) limit = 280;
    else if (svc.includes('thread')) limit = 500;
    else if (svc.includes('linkedin')) limit = 3000;
    else if (svc.includes('instagram')) limit = 2200;
    const cc = qs('charCount');
    if (limit) {
      const rem = limit - text.length;
      cc.textContent = `${text.length}/${limit}`;
      cc.className = 'char-count' + (rem < 0 ? ' over' : rem < 50 ? ' warn' : '');
    } else {
      cc.textContent = `${text.length} chars`;
      cc.className = 'char-count' + (text.length > 500 ? ' warn' : '');
    }
    const showClear = text.length > 0;
    const ccBtn = qs('composerClearBtn'); if (ccBtn) ccBtn.style.display = showClear ? 'inline-flex' : 'none';
  });
  const charCount = qs('charCount'); if (charCount) charCount.textContent = '0 chars';
  on('composerChannel', 'change', updateComposerButtonStates);

  on('composerClearBtn', 'click', () => {
    if (editorToText(editor.innerHTML) && !confirm('Clear composer?')) return;
    editor.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('removeFormat', false, null);
    editor.innerHTML = ''; editor.dispatchEvent(new Event('input'));
    const status = qs('composerStatus'); if (status) status.textContent = ''; clearMedia();
  });

  document.querySelectorAll('[data-cmd]').forEach(btn => btn.onclick = () => composerFormat(btn.dataset.cmd));
  on('composerDraft', 'click', () => composerSend('draft'));
  on('composerQueue', 'click', () => composerSend('queue'));
  on('composerScheduleSend', 'click', () => composerSend('schedule'));
  on('composerScheduleToggle', 'click', () => {
    qs('schedulePanel')?.classList.add('open');
    const toggle = qs('composerScheduleToggle'); if (toggle) toggle.style.display = 'none';
  });
  on('scheduleCancel', 'click', () => {
    qs('schedulePanel')?.classList.remove('open');
    const toggle = qs('composerScheduleToggle'); if (toggle) toggle.style.display = 'inline-flex';
  });
  ['scheduleDate','scheduleHour','scheduleMin','scheduleAmpm'].forEach(id => on(id, 'change', syncComposerWhen));
  syncComposerWhen();
  updateComposerButtonStates();
  window.addEventListener('postiq:synced', updateComposerButtonStates);

  on('insertTemplateBtn', 'click', () => { renderTemplatePicker(); openModal('templatePickerModal'); });
  on('saveAsTemplateBtn', 'click', () => {
    const sel = window.getSelection(); const text = (sel?.toString() || '').trim();
    if (!text) { showToast('Select text in the editor first', 'error'); return; }
    const body = qs('templateBody'); if (body) body.value = text; openTemplateModal();
  });

  on('refPinDismiss', 'click', () => { const refPin = qs('refPin'); if (refPin) refPin.style.display = 'none'; });

  on('mediaToggleBtn', 'click', () => { qs('mediaPanel')?.classList.contains('open') ? closeMediaPanel() : openMediaPanel(); });
  on('mediaToggleOff', 'click', () => { qs('mediaPanel')?.classList.contains('open') ? closeMediaPanel() : openMediaPanel(); });
  on('mediaSummaryClear', 'click', () => { clearMedia(); showToast('Media removed'); });
  document.querySelectorAll('.media-tab').forEach(t => t.onclick = () => switchMediaTab(t.dataset.mtab));

  const zone = qs('uploadZone'), fi = qs('uploadFileInput');
  if (zone && fi) {
    zone.onclick = e => { if (!getFeatureFlag('uploads')) { showFeaturePaused('uploads'); return; } if (!e.target.closest('#uploadBrowseBtn') && !e.target.closest('#uploadResult')) fi.click(); };
    on('uploadBrowseBtn', 'click', e => { e.stopPropagation(); if (!getFeatureFlag('uploads')) { showFeaturePaused('uploads'); return; } fi.click(); });
    fi.onchange = () => { if (fi.files[0]) handleUploadFile(fi.files[0]); };
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--brand)'; zone.style.background = 'var(--brand-dim)'; });
    zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) { zone.style.borderColor = 'var(--border2)'; zone.style.background = ''; } });
    zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = 'var(--border2)'; zone.style.background = ''; if (!getFeatureFlag('uploads')) { showFeaturePaused('uploads'); return; } if (e.dataTransfer.files[0]) handleUploadFile(e.dataTransfer.files[0]); });
  }
  document.addEventListener('paste', e => {
    if (!qs('mediaPanel')?.classList.contains('open')) return;
    if (!getFeatureFlag('uploads')) return;
    const active = document.querySelector('.media-tab.active')?.dataset?.mtab;
    if (active !== 'upload') return;
    const img = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
    if (img) handleUploadFile(img.getAsFile());
  });
  on('uploadReplaceBtn', 'click', e => { e.stopPropagation(); if (!fi) return; if (!getFeatureFlag('uploads')) { showFeaturePaused('uploads'); return; } resetUploadTab(); fi.click(); });
  on('uploadClearBtn', 'click', e => { e.stopPropagation(); resetUploadTab(); clearMedia(); showToast('Media removed'); });

  const urlInp = qs('mediaUrlInput'); const urlClear = qs('mediaUrlClear');
  if (urlInp && urlClear) urlInp.addEventListener('input', () => {
    const url = urlInp.value.trim();
    urlClear.style.display = url ? 'inline-flex' : 'none';
    const vts = qs('videoThumbSection'), up = qs('urlPreview'), ui = qs('urlPreviewImg'), ut = qs('urlPreviewType');
    if (url) {
      if (isVideo(url)) {
        ui.style.display = 'none'; vts.style.display = 'block';
        ut.textContent = '🎬 Video URL'; up.style.display = 'flex';
      } else {
        ui.src = url; ui.style.display = 'block'; vts.style.display = 'none';
        ut.textContent = 'Image URL'; up.style.display = 'flex';
      }
      applyMedia(url, 'url', qs('videoThumbUrl')?.value?.trim() || '');
    } else { up.style.display = 'none'; clearMedia(); }
  });
  if (urlClear && urlInp) urlClear.onclick = () => { urlInp.value = ''; urlInp.dispatchEvent(new Event('input')); };
  const vtu = qs('videoThumbUrl');
  if (vtu) vtu.addEventListener('input', () => { mediaState.videoThumbUrl = vtu.value.trim(); });

  on('unsplashSearchBtn', 'click', runUnsplashSearch);
  on('unsplashQuery', 'keydown', e => { if (e.key === 'Enter') runUnsplashSearch(); });

  on('newTemplateBtn', 'click', () => openTemplateModal());
  const manageTplBtn = qs('composerManageTemplatesBtn'); if (manageTplBtn) manageTplBtn.onclick = () => { activateView('ideasView'); setIdeasTab('templates'); };
  on('closeTemplateModal', 'click', () => closeModal('templateModal'));
  on('cancelTemplateBtn', 'click', () => closeModal('templateModal'));
  on('saveTemplateBtn', 'click', saveTemplate);
  on('closeTemplatePicker', 'click', () => closeModal('templatePickerModal'));
  on('templateSearch', 'input', e => { state.templateSearch = e.target.value; renderTemplates(); });
  on('templatePlatformFilter', 'change', e => { state.templatePlatform = e.target.value; renderTemplates(); });
  on('pickerSearch', 'input', renderTemplatePicker);
  on('pickerType', 'change', renderTemplatePicker);

  on('approvalsRefreshBtn', 'click', loadApprovals);
  document.querySelectorAll('[data-afilter]').forEach(pill => {
    pill.onclick = () => {
      document.querySelectorAll('[data-afilter]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const filter = pill.dataset.afilter;
      document.querySelectorAll('#approvalsList .approval-card').forEach(card => {
        const bar = card.querySelector('.approval-card-status-bar');
        if (!bar) return;
        const status = bar.classList.contains('approved') ? 'approved' : bar.classList.contains('changes') ? 'changes' : 'pending';
        card.style.display = (filter === 'all' || status === filter) ? '' : 'none';
      });
    };
  });

  // ── ZEN MODE ──
  const ZEN_DRAFT_KEY = 'postiq_zen_draft_v1';
  const ZEN_PINS_KEY = 'postiq_zen_pins_v1';
  let zenActive = false;
  let zenPreviousView = 'composerView';
  let zenLastSavedAt = '';
  let zenSaveTimer = null;
  const zenState = { selectedTab: 'pins' };
  const parseLocal = (k, fallback) => { try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const loadZenDraft = () => {
    const d = parseLocal(ZEN_DRAFT_KEY, {});
    return {
      title: String(d?.title || ''),
      body: String(d?.body || ''),
      updatedAt: String(d?.updatedAt || d?.lastSavedAt || ''),
      backgroundImage: String(d?.backgroundImage || ''),
      selectedTab: ['pins','sparks','snippets'].includes(d?.selectedTab) ? d.selectedTab : 'pins'
    };
  };
  const saveZenDraft = (draft) => { try { localStorage.setItem(ZEN_DRAFT_KEY, JSON.stringify(draft || {})); } catch {} };
  const getZenPins = () => Array.isArray(parseLocal(ZEN_PINS_KEY, [])) ? parseLocal(ZEN_PINS_KEY, []) : [];
  const saveZenPins = pins => { try { localStorage.setItem(ZEN_PINS_KEY, JSON.stringify(Array.isArray(pins) ? pins : [])); } catch {} };
  const getZenIdeaSparks = () => (window.cpState?.pillars || []).flatMap(p => (Array.isArray(p?.seeds) ? p.seeds : [])).slice(0, 8).map(v => `Turn this idea into a practical post: ${compact(v, 90)}`);
  const getZenTrendingSparks = () => Array.from(document.querySelectorAll('#trendingRedditList .trend-card-title, #trendingHNList .trend-card-title')).slice(0, 8).map(el => `What can your audience learn from: ${compact(el.textContent, 80)}?`);
  const getZenSnippetItems = () => Array.isArray(state?.templates) ? state.templates.slice(0, 20).map(t => ({ text: t?.body || t?.title || '' })).filter(s => s.text.trim()) : [];
  const zenFallbackSparks = ['Turn a small frustration into a useful lesson.','Explain the problem before pitching the feature.','Write the post you wish existed before you started.','Make the first line impossible to ignore.'];
  const zenAppendToBody = text => { const b = qs('zenBodyInput'); if (!b || !text) return; b.value = `${b.value}${b.value ? '\n\n' : ''}${text}`; b.dispatchEvent(new Event('input')); };
  const hasZenDom = () => !!(qs('zenOverlay') && qs('zenTitleInput') && qs('zenBodyInput'));
  const updateZenMetrics = () => {
    const body = qs('zenBodyInput')?.value || '';
    const wc = qs('zenWordCount'); if (wc) wc.textContent = `${body.trim() ? body.trim().split(/\s+/).length : 0} words`;
    const cc = qs('zenCharCount'); if (cc) cc.textContent = `${body.length} chars`;
  };
  function zenSaveNow() {
    if (!hasZenDom()) return;
    const draft = {
      title: qs('zenTitleInput')?.value || '',
      body: qs('zenBodyInput')?.value || '',
      updatedAt: new Date().toISOString(),
      backgroundImage: loadZenDraft().backgroundImage || '',
      selectedTab: zenState.selectedTab
    };
    saveZenDraft(draft);
    zenLastSavedAt = draft.updatedAt;
    const saved = qs('zenLastSaved'); if (saved) saved.textContent = 'Saved in Zen.';
    const status = qs('zenStatusText'); if (status) status.textContent = 'Saved in Zen.';
  }
  function renderZenTab() {
    const out = qs('zenTabContent'); if (!out) return;
    if (zenState.selectedTab === 'pins') {
      const pins = getZenPins();
      out.innerHTML = `<div class="row mb8"><input id="zenPinLabel" class="input" placeholder="Label (optional)" /><input id="zenPinText" class="input grow" placeholder="Pin anything…" /><button class="btn sm" id="zenAddPin">Pin</button></div>` + (pins.length ? pins.map((p, i) => `<div class="zen-card"><small>${safeText(p.label || 'Pin')} · ${new Date(p.createdAt || Date.now()).toLocaleString()}</small><p>${safeText(p.text || '')}</p><div class="zen-card-actions"><button class="btn sm" data-zen-insert="${i}">Insert into draft</button><button class="btn sm" data-zen-copy="${i}">Copy</button><button class="btn sm ghost" data-zen-del="${i}">Delete</button></div></div>`).join('') : `<div class="empty-desc">Pin the stuff your brain swears it will remember and absolutely will not.</div>`);
    } else if (zenState.selectedTab === 'sparks') {
      const sparks = [...getZenTrendingSparks(), ...getZenIdeaSparks()].slice(0, 10);
      const finalSparks = sparks.length ? sparks : zenFallbackSparks;
      out.innerHTML = !sparks.length ? `<div class="empty-desc mb8">No trends loaded yet. Here are a few starter sparks.</div>` : '';
      out.innerHTML += finalSparks.map((s, i) => `<div class="zen-card"><p>${safeText(s)}</p><div class="zen-card-actions"><button class="btn sm" data-zen-angle="${i}">Use as angle</button><button class="btn sm" data-zen-note="${i}">Insert as note</button><button class="btn sm ghost" data-zen-pin-spark="${i}">Pin this</button></div></div>`).join('');
    } else {
      const snippets = getZenSnippetItems();
      out.innerHTML = snippets.length ? snippets.map((s, i) => `<div class="zen-card"><p>${safeText(compact(s.text, 220))}</p><div class="zen-card-actions"><button class="btn sm" data-zen-snip="${i}">Insert snippet</button></div></div>`).join('') : `<div class="empty-desc">No snippets saved yet. Future-you is already judging present-you.</div>`;
    }
  }
  function enterZen() {
    if (!hasZenDom()) { showToast('Zen Mode is unavailable right now.', 'error'); return; }
    zenPreviousView = currentViewId || 'composerView';
    activateView('composerView');
    zenActive = true;
    document.body.classList.add('zen-active');
    const d = loadZenDraft();
    zenState.selectedTab = d.selectedTab;
    const titleInput = qs('zenTitleInput'); if (titleInput) titleInput.value = d.title || '';
    const bodyInput = qs('zenBodyInput'); if (bodyInput) bodyInput.value = d.body || editorToText(qs('composerEditor')?.innerHTML || '');
    const saved = qs('zenLastSaved'); if (saved) saved.textContent = 'Saved in Zen.';
    const status = qs('zenStatusText'); if (status) status.textContent = 'Saved in Zen.';
    updateZenMetrics();
    document.querySelectorAll('.zen-tab').forEach(t => t.classList.toggle('active', t.dataset.zenTab === zenState.selectedTab));
    renderZenTab();
    qs('zenBodyInput')?.focus();
  }
  function exitZen() {
    if (zenSaveTimer) { clearTimeout(zenSaveTimer); zenSaveTimer = null; }
    zenSaveNow();
    zenActive = false;
    document.body.classList.remove('zen-active');
    if (zenPreviousView) activateView(zenPreviousView);
  }
  on('zenToggleBtn', 'click', () => zenActive ? exitZen() : enterZen());
  on('zenExit', 'click', exitZen);
  on('zenExitFooter', 'click', exitZen);
  on('zenCopyBtn', 'click', () => { navigator.clipboard.writeText(`${qs('zenTitleInput')?.value || ''}\n${qs('zenBodyInput')?.value || ''}`.trim()); showToast('Copied', 'success'); });
  on('zenCopyFooter', 'click', () => qs('zenCopyBtn')?.click());
  on('zenSendComposeHeader', 'click', () => qs('zenSendCompose')?.click());
  on('zenSendCompose', 'click', () => {
    const ed = qs('composerEditor');
    if (ed) {
      ed.innerText = qs('zenBodyInput')?.value || '';
      ed.dispatchEvent(new Event('input'));
    }
    showToast('Sent to Compose. Working title stayed in Zen.', 'success');
  });
  on('zenClearDraftBtn', 'click', () => { if (!confirm('Clear your Zen content?')) return; saveZenDraft({ title: '', body: '', updatedAt: '', backgroundImage: '', selectedTab: zenState.selectedTab }); const ti = qs('zenTitleInput'); if (ti) ti.value = ''; const bi = qs('zenBodyInput'); if (bi) { bi.value = ''; bi.dispatchEvent(new Event('input')); } updateZenMetrics(); });
  on('zenRailToggle', 'click', () => { const rail = qs('zenRail'); if (!rail) return; rail.classList.toggle('collapsed'); const collapsed = rail.classList.contains('collapsed'); qs('zenRailToggle').textContent = collapsed ? 'Open Writing Tray' : 'Collapse'; qs('zenRailToggle').setAttribute('aria-expanded', String(!collapsed)); });
  ['zenTitleInput','zenBodyInput'].forEach(id => on(id, 'input', () => {
    updateZenMetrics();
    if (zenSaveTimer) clearTimeout(zenSaveTimer);
    zenSaveTimer = setTimeout(zenSaveNow, 450);
  }));
  document.querySelectorAll('.zen-tab').forEach(t => t.onclick = () => { zenState.selectedTab = t.dataset.zenTab; document.querySelectorAll('.zen-tab').forEach(b => b.classList.toggle('active', b === t)); renderZenTab(); zenSaveNow(); });
  on('zenTabContent', 'click', e => {
    const pins = getZenPins();
    const sparks = ([...getZenTrendingSparks(), ...getZenIdeaSparks()].slice(0, 10).length ? [...getZenTrendingSparks(), ...getZenIdeaSparks()].slice(0, 10) : zenFallbackSparks);
    const snippets = getZenSnippetItems();
    const t = e.target.closest('button'); if (!t) return;
    const i = Number(Object.values(t.dataset)[0]);
    if (t.dataset.zenInsert !== undefined) zenAppendToBody(pins[i]?.text || '');
    if (t.dataset.zenCopy !== undefined) navigator.clipboard.writeText(pins[i]?.text || '');
    if (t.dataset.zenDel !== undefined) { pins.splice(i, 1); saveZenPins(pins); renderZenTab(); }
    if (t.dataset.zenAngle !== undefined || t.dataset.zenNote !== undefined) zenAppendToBody(sparks[i] || '');
    if (t.dataset.zenPinSpark !== undefined) { pins.unshift({ text: sparks[i] || '', label: 'Spark', createdAt: new Date().toISOString() }); saveZenPins(pins); showToast('Pinned spark', 'success'); }
    if (t.dataset.zenSnip !== undefined) zenAppendToBody(snippets[i]?.text || '');
    if (t.id === 'zenAddPin') {
      const text = qs('zenPinText')?.value?.trim(); if (!text) return;
      pins.unshift({ text, label: qs('zenPinLabel')?.value?.trim() || '', createdAt: new Date().toISOString() });
      saveZenPins(pins); renderZenTab();
    }
  });

  document.addEventListener('keydown', e => {
    if (!getFeatureFlag('zenMode')) return;
    if (e.key === 'Escape' && zenActive) {
      if (!document.querySelector('.modal.open')) { exitZen(); return; }
    }
  }, true);

  on('openSettings', 'click', () => openModal('settingsModal'));
  on('closeSettings', 'click', () => closeModal('settingsModal'));
  selectSettingsTab(document.querySelector('.settings-tab.active')?.dataset.stab || 'connection');
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.onclick = () => selectSettingsTab(tab.dataset.stab);
    tab.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      const tabs = [...document.querySelectorAll('.settings-tab')];
      const current = tabs.indexOf(tab);
      let next = current;
      if (e.key === 'ArrowLeft') next = Math.max(0, current - 1);
      if (e.key === 'ArrowRight') next = Math.min(tabs.length - 1, current + 1);
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = tabs.length - 1;
      e.preventDefault();
      tabs[next]?.focus();
      if (tabs[next]) selectSettingsTab(tabs[next].dataset.stab);
    });
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal.id); });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.modal.open')];
    if (open.length) closeModal(open[open.length - 1].id);
  });

  function openMobDrawer() {
    const syncEl = qs('syncStatus');
    const ms = qs('mobSyncStatus'); if (ms && syncEl) ms.textContent = syncEl.textContent;
    renderConnectionUI();
    qs('mobDrawer')?.classList.add('open');
    qs('mobBackdrop')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMobDrawer() {
    qs('mobDrawer')?.classList.remove('open');
    qs('mobBackdrop')?.classList.remove('open');
    document.body.style.overflow = '';
  }
  on('mobBackdrop', 'click', closeMobDrawer);
  ['mobMenuBtn','mobMenuBtnDraft','mobMenuBtnApprovals'].forEach(id => {
    const btn = qs(id); if (btn) btn.onclick = openMobDrawer;
  });
  on('mobSyncBtn', 'click', () => { syncBuffer({ force: true }); closeMobDrawer(); });
  window.postiqMobileTokenPanelOpen = false;
  on('mobManageTokenBtn', 'click', () => {
    const connection = getBufferConnectionState();
    if (connection.connected) syncBuffer({ force: true });
    else goToBufferConnect();
    closeMobDrawer();
  });
  const mobConnectionSettingsBtn = qs('mobConnectionSettingsBtn');
  if (mobConnectionSettingsBtn) mobConnectionSettingsBtn.onclick = () => { closeMobDrawer(); openConnectionSettings(); };
  on('mobOpenSettings', 'click', () => { closeMobDrawer(); openModal('settingsModal'); });

  const smb = qs('shareMonthBtnMob'); if (smb) smb.onclick = openShareSnapshotModal;

  const ccbm = qs('composerClearBtnMob');
  if (ccbm) {
    ccbm.onclick = () => {
      if (editorToText(editor.innerHTML) && !confirm('Clear composer?')) return;
      editor.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('removeFormat', false, null);
      editor.innerHTML = ''; editor.dispatchEvent(new Event('input'));
      const status = qs('composerStatus'); if (status) status.textContent = ''; clearMedia();
    };
  }

  editor.addEventListener('input', () => {
    const hasText = !!editorToText(editor.innerHTML);
    const ccbmBtn = qs('composerClearBtnMob'); if (ccbmBtn) ccbmBtn.style.display = hasText ? 'inline-flex' : 'none';
  });

  const arbm = qs('approvalsRefreshBtnMob'); if (arbm) arbm.onclick = loadApprovals;
  const ntbm = qs('newTemplateBtnMob'); if (ntbm) ntbm.onclick = () => openTemplateModal();

  const mobMoreBtn = qs('mobMoreBtn');
  if (mobMoreBtn) mobMoreBtn.onclick = openMobDrawer;

  // ── COMPOSER MODE TABS ──
  function setComposerMode(mode) {
    document.querySelectorAll('.composer-mode-tab').forEach(t => {
      const isActive = t.dataset.cmode === mode;
      t.style.color = isActive ? 'var(--brand)' : 'var(--muted)';
      t.style.borderBottomColor = isActive ? 'var(--brand)' : 'transparent';
    });
    const composePanel = qs('composeModePanel'); if (composePanel) composePanel.style.display = mode === 'compose' ? 'contents' : 'none';
    const splitPanel = qs('splitModePanel'); if (splitPanel) splitPanel.style.display  = mode === 'split'   ? 'block'    : 'none';
    const support = qs('composerSupportSection');
    if (support) support.style.display = mode === 'compose' ? 'grid' : 'none';
    if (mode === 'split') initSplitMode();
    const editorText = editorToText(qs('composerEditor').innerHTML);
    if (editorText) {
      const ti = qs('threadInput');
      if (ti && !ti.value.trim()) ti.value = editorText;
    }
  }
  document.querySelectorAll('.composer-mode-tab').forEach(t => {
    t.onclick = () => setComposerMode(t.dataset.cmode);
  });

  // ── THREAD SPLITTER ──
  let threadParts = [];
  let threadNumbered = false;
  let splitInited = false;

  function splitThreadText(text, max = 280) {
    const parts = []; let left = text.trim();
    while (left.length > max) {
      let cut = left.lastIndexOf('\n', max);
      if (cut < 80) cut = left.lastIndexOf(' ', max);
      if (cut < 80) cut = max;
      parts.push(left.slice(0, cut).trim()); left = left.slice(cut).trim();
    }
    if (left) parts.push(left);
    return parts;
  }

  function renderThreadParts() {
    const out = qs('threadOut'); const empty = qs('threadEmpty');
    const actions = qs('threadActions'); const whenRow = qs('threadWhenRow');
    if (!threadParts.length) {
      out.innerHTML = ''; empty.style.display = 'flex';
      if (actions) actions.style.display = 'none';
      if (whenRow) whenRow.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    if (actions) actions.style.display = 'flex';
    out.innerHTML = '';
    threadParts.forEach((p, i) => {
      const label = threadNumbered ? `${i+1}/${threadParts.length} ` : '';
      const full = label + p;
      const over = full.length > 280;
      const div = document.createElement('div');
      div.className = 'card';
      div.style.cssText = 'padding:12px;margin-bottom:0;';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:11px;font-family:'DM Mono',monospace;color:var(--brand);background:var(--brand-dim);border:1px solid var(--brand-glow);padding:2px 7px;border-radius:4px;">Part ${i+1}</span>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:11px;font-family:'DM Mono',monospace;color:${over?'var(--red)':'var(--subtle)'};">${full.length}/280</span>
            <button class="btn sm ghost" data-pi="${i}">Copy</button>
          </div>
        </div>
        <textarea data-ti="${i}" style="min-height:80px;font-size:13px;">${safeText(p)}</textarea>`;
      div.querySelector('[data-pi]').onclick = () => { navigator.clipboard.writeText(full); showToast('Part copied'); };
      div.querySelector('[data-ti]').addEventListener('input', e => {
        threadParts[+e.target.dataset.ti] = e.target.value;
        const span = e.target.closest('.card').querySelector('span[style*="DM Mono"]');
        const lbl = threadNumbered ? `${i+1}/${threadParts.length} ` : '';
        const len = (lbl + e.target.value).length;
        if (span) { span.textContent = `${len}/280`; span.style.color = len > 280 ? 'var(--red)' : 'var(--subtle)'; }
      });
      out.appendChild(div);
    });
  }

  function initSplitMode() {
    if (splitInited) return; splitInited = true;

    const tch = qs('threadChannel');
    if (tch) {
      tch.innerHTML = '';
      const xChs = state.channels.filter(c => { const s = (c.service||'').toLowerCase(); return s.includes('twitter')||s.includes('thread')||s.includes('x-'); });
      if (xChs.length) {
        xChs.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.displayName||c.name} (${c.service})`; tch.appendChild(o); });
      } else if (state.channels.length) {
        state.channels.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.displayName||c.name} (${c.service})`; tch.appendChild(o); });
      } else {
        const o = document.createElement('option'); o.value = ''; o.textContent = '↻ Load channels from Buffer'; tch.appendChild(o);
      }
    }

    qs('splitBtn').onclick = () => {
      const text = qs('threadInput').value.trim();
      if (!text) { showToast('Add some text first', 'error'); return; }
      threadParts = splitThreadText(text);
      renderThreadParts();
      showToast(`${threadParts.length} thread parts`, 'success');
    };

    qs('splitSampleBtn').onclick = () => {
      qs('threadInput').value = 'PostIQ helps Buffer users move faster. Start with one big idea, split it into clear thread parts, refine each part, and send a cleaner post flow to Buffer — drafts, queued, or scheduled. The whole thing in under two minutes.';
      qs('splitBtn').click();
    };

    const toggle = qs('threadNumberToggle');
    if (toggle) toggle.onchange = e => { threadNumbered = e.target.checked; renderThreadParts(); };

    qs('copyAllPartsBtn').onclick = () => {
      if (!threadParts.length) return;
      const text = threadParts.map((p,i) => threadNumbered ? `${i+1}/${threadParts.length} ${p}` : p).join('\n\n');
      navigator.clipboard.writeText(text); showToast('All parts copied', 'success');
    };

    async function sendThread(action) {
      if (!threadParts.length) { qs('threadStatus').textContent = 'Split content first.'; return; }
      const channelId = qs('threadChannel')?.value;
      if (!channelId) { qs('threadStatus').textContent = 'Select a channel first.'; return; }
      const parts = threadParts.map((p,i) => threadNumbered ? `${i+1}/${threadParts.length} ${p}` : p);
      const when = qs('threadWhen')?.value;
      const ch = state.channels.find(c => c.id === channelId);
      const svc = (ch?.service||'').toLowerCase();
      const isThreads = svc.includes('thread');
      const metadata = parts.length > 1 ? { metadata: { [isThreads?'threads':'twitter']: isThreads ? { type:'thread', thread: parts.slice(1).map(t=>({text:t})) } : { thread: parts.slice(1).map(t=>({text:t})) } } } : {};
      const input = { channelId, text: parts[0], schedulingType: 'automatic', ...metadata };
      if (action === 'draft')    { input.mode = 'addToQueue'; input.saveToDraft = true; }
      if (action === 'queue')    { input.mode = 'addToQueue'; }
      if (action === 'schedule') {
        if (!when) { qs('threadStatus').textContent = 'Set a date/time first.'; qs('threadWhenRow').style.display = 'block'; return; }
        input.mode = 'customScheduled'; input.dueAt = when;
      }
      qs('threadStatus').textContent = 'Sending…';
      try {
        await createPost(input);
        const msg = action==='draft'?'Buffer draft saved.':action==='queue'?'Added to queue.':'Scheduled.';
        qs('threadStatus').textContent = msg; showToast(msg, 'success');
      } catch(e) {
        const msg = getErrorMessage(e, 'Failed.');
        if (isAuthError(e)) handleAuthFailure(msg);
        qs('threadStatus').textContent = `Failed: ${msg}`;
      }
    }

    qs('draftThreadBtn').onclick    = () => sendThread('draft');
    qs('queueThreadBtn').onclick    = () => sendThread('queue');
    qs('scheduleThreadBtn').onclick = () => { qs('threadWhenRow').style.display = 'block'; };

    window.addEventListener('postiq:synced', () => {
      const tch2 = qs('threadChannel'); if (!tch2) return;
      tch2.innerHTML = '';
      const xChs = state.channels.filter(c => { const s=(c.service||'').toLowerCase(); return s.includes('twitter')||s.includes('thread')||s.includes('x-'); });
      const pool = xChs.length ? xChs : state.channels;
      pool.forEach(c => { const o=document.createElement('option'); o.value=c.id; o.textContent=`${c.displayName||c.name} (${c.service})`; tch2.appendChild(o); });
    });
  }

  // ── TRENDING ──
  const trendingState = { src: 'reddit', sub: 'socialmedia', hn: 'topstories' };
  const DEFAULT_SUBS = ['socialmedia','entrepreneur','marketing','business'];

  function renderSubPills() {
    const wrap = qs('trendingSubPills'); if (!wrap) return;
    wrap.innerHTML = '';
    DEFAULT_SUBS.forEach(sub => {
      const btn = document.createElement('button');
      btn.style.cssText = `padding:5px 12px;border-radius:20px;border:1px solid var(--border2);font-size:12px;font-family:'DM Mono',monospace;cursor:pointer;transition:all .12s;background:${trendingState.sub===sub?'var(--brand-dim)':'var(--surface)'};color:${trendingState.sub===sub?'var(--brand)':'var(--muted)'};border-color:${trendingState.sub===sub?'var(--brand-glow)':'var(--border2)'};`;
      btn.textContent = 'r/' + sub;
      btn.onclick = () => { trendingState.sub = sub; renderSubPills(); loadReddit(); };
      wrap.appendChild(btn);
    });
  }

  function timeAgo(ts) {
    const d = (Date.now() - ts) / 1000;
    if (d < 3600) return `${Math.floor(d/60)}m ago`;
    if (d < 86400) return `${Math.floor(d/3600)}h ago`;
    return `${Math.floor(d/86400)}d ago`;
  }

  function renderTrendingItems(containerId, items) {
    const list = qs(containerId); list.innerHTML = '';
    if (!items.length) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">📈</div><div class="empty-title">Nothing loaded</div><div class="empty-desc">Try refreshing or switching to a different source.</div></div>'; return; }
    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.style.cssText = 'display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;transition:border-color .12s;';
      el.innerHTML = `
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--subtle);width:22px;flex-shrink:0;padding-top:2px;font-weight:600;">${i+1}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:500;color:var(--text);line-height:1.4;margin-bottom:5px;">${safeText(item.title)}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--amber);font-weight:700;">▲ ${(item.score||0).toLocaleString()}</span>
            <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);">💬 ${item.comments||0}</span>
            <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--brand);">${safeText(item.sub||'')}</span>
            <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);">${item.age||''}</span>
          </div>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn sm" style="font-size:11px;" data-inspire="${i}">→ Compose from this</button>
            <a class="btn sm ghost" data-source-link="1" target="_blank" rel="noopener" style="font-size:11px;">↗ Source</a>
          </div>
        </div>`;
      const sourceLink = el.querySelector('[data-source-link]');
      if (sourceLink) {
        const safeUrl = toSafeExternalUrl(item.url);
        if (safeUrl) sourceLink.setAttribute('href', safeUrl);
        else sourceLink.remove();
      }
      el.onmouseenter = () => { el.style.borderColor = 'var(--border2)'; };
      el.onmouseleave = () => { el.style.borderColor = 'var(--border)'; };
      el.querySelector('[data-inspire]').onclick = () => {
        qs('refPinTitle').textContent = item.title;
        qs('refPinBody').textContent = item.body ? item.body.slice(0,200) : '';
        qs('refPin').style.display = 'block';
        activateView('composerView');
        showToast('Pinned as reference — write your take', 'info');
      };
      list.appendChild(el);
    });
  }

  async function loadReddit() {

    // ── TRENDING (PROXY-BASED) ────────────────────────────────────────
// Replaces the direct-fetch trending section in app.js.
// All feeds route through /.netlify/functions/trending to avoid CORS + CSP issues.
// Drop this entire block in place of the existing trending state + initTrending() function.

  const trendingState = {
    src: 'reddit',
    sub: 'socialmedia',
    hn: 'topstories',
  };

  // ── Proxy fetch helper ──────────────────────────────────────────
  async function fetchTrendingFeed(params) {
    const res = await fetch('/.netlify/functions/trending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Trending feed returned HTTP ${res.status}`);
    }
    return res.json();
  }

  // ── Time-ago formatter ──────────────────────────────────────────
  function trendingTimeAgo(ageSeconds) {
    const s = Number(ageSeconds || 0);
    if (s < 3600)  return `${Math.max(1, Math.floor(s / 60))}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  // ── Render a list of feed items ─────────────────────────────────
  function renderTrendingItems(containerId, items, sourceType) {
    const list = qs(containerId);
    if (!list) return;
    list.innerHTML = '';

    if (!items || !items.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📈</div>
          <div class="empty-title">Nothing loaded</div>
          <div class="empty-desc">Try refreshing or switching to a different source.</div>
        </div>`;
      return;
    }

    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'trend-card';
      el.style.cssText = `
        display:flex;align-items:flex-start;gap:12px;
        padding:12px 14px;
        background:var(--surface);
        border:1px solid var(--border);
        border-radius:10px;
        transition:border-color .12s;
        margin-bottom:6px;
      `;

      const tagline = item.tagline || item.selftext || '';
      const subLabel = String(item.sub || '').slice(0, 40);
      const scoreLabel = item.score > 0 ? `▲ ${item.score.toLocaleString()}` : '';
      const commentLabel = item.comments > 0 ? `💬 ${item.comments}` : '';
      const ageLabel = item.age ? trendingTimeAgo(item.age) : '';

      el.innerHTML = `
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--subtle);width:22px;flex-shrink:0;padding-top:2px;font-weight:600;">${i + 1}</div>
        <div style="flex:1;min-width:0;">
          <div class="trend-card-title" style="font-size:13px;font-weight:500;color:var(--text);line-height:1.4;margin-bottom:${tagline ? '4px' : '5px'};">${safeText(item.title)}</div>
          ${tagline ? `<div style="font-size:11px;color:var(--subtle);line-height:1.5;margin-bottom:5px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${safeText(tagline)}</div>` : ''}
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
            ${scoreLabel ? `<span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--amber);font-weight:700;">${safeText(scoreLabel)}</span>` : ''}
            ${commentLabel ? `<span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);">${safeText(commentLabel)}</span>` : ''}
            ${subLabel ? `<span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--brand);">${safeText(subLabel)}</span>` : ''}
            ${ageLabel ? `<span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);">${safeText(ageLabel)}</span>` : ''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn sm" style="font-size:11px;" data-inspire="${i}">→ Compose from this</button>
            <a class="btn sm ghost" href="${safeText(item.url || item.permalink || '#')}" target="_blank" rel="noopener" style="font-size:11px;">↗ Source</a>
          </div>
        </div>`;

      el.onmouseenter = () => { el.style.borderColor = 'var(--border2)'; };
      el.onmouseleave = () => { el.style.borderColor = 'var(--border)'; };

      el.querySelector('[data-inspire]').onclick = () => {
        const refPin = qs('refPin');
        const refPinTitle = qs('refPinTitle');
        const refPinBody = qs('refPinBody');
        if (refPin && refPinTitle && refPinBody) {
          refPinTitle.textContent = item.title;
          refPinBody.textContent = tagline || '';
          refPin.style.display = 'block';
        }
        if (typeof window.activateView === 'function') window.activateView('composerView');
        showToast('Pinned as reference — write your take', 'success');
      };

      list.appendChild(el);
    });
  }

  // ── Subreddit pills ─────────────────────────────────────────────
  const DEFAULT_SUBS = ['socialmedia', 'entrepreneur', 'marketing', 'business', 'smallbusiness'];

  function renderSubPills() {
    const wrap = qs('trendingSubPills');
    if (!wrap) return;
    wrap.innerHTML = '';
    DEFAULT_SUBS.forEach(sub => {
      const active = trendingState.sub === sub;
      const btn = document.createElement('button');
      btn.style.cssText = `
        padding:5px 12px;border-radius:20px;border:1px solid ${active ? 'var(--brand-glow)' : 'var(--border2)'};
        font-size:12px;font-family:'DM Mono',monospace;cursor:pointer;transition:all .12s;
        background:${active ? 'var(--brand-dim)' : 'var(--surface)'};
        color:${active ? 'var(--brand)' : 'var(--muted)'};
      `;
      btn.textContent = `r/${sub}`;
      btn.onclick = () => { trendingState.sub = sub; renderSubPills(); loadReddit(); };
      wrap.appendChild(btn);
    });
  }

  // ── Reddit ──────────────────────────────────────────────────────
  async function loadReddit() {
    const statusEl = qs('trendingRedditStatus');
    const listEl   = qs('trendingRedditList');
    if (!statusEl || !listEl) return;

    statusEl.textContent = `Loading r/${trendingState.sub}…`;
    listEl.innerHTML = '';

    try {
      const data = await fetchTrendingFeed({ source: 'reddit', subreddit: trendingState.sub });
      const posts = data.posts || [];
      statusEl.textContent = `${posts.length} posts from r/${data.subreddit || trendingState.sub}`;
      renderTrendingItems('trendingRedditList', posts, 'reddit');
    } catch (err) {
      statusEl.textContent = `Failed to load r/${trendingState.sub} — ${err.message}`;
      renderTrendingItems('trendingRedditList', [], 'reddit');
    }
  }

  // ── Hacker News ─────────────────────────────────────────────────
  async function loadHN() {
    const statusEl = qs('trendingHNStatus');
    const listEl   = qs('trendingHNList');
    if (!statusEl || !listEl) return;

    statusEl.textContent = 'Loading Hacker News…';
    listEl.innerHTML = '';

    try {
      const data = await fetchTrendingFeed({ source: 'hn', feed: trendingState.hn });
      const posts = data.posts || [];
      statusEl.textContent = `${posts.length} stories from Hacker News`;
      renderTrendingItems('trendingHNList', posts, 'hn');
    } catch (err) {
      statusEl.textContent = `Failed to load Hacker News — ${err.message}`;
      renderTrendingItems('trendingHNList', [], 'hn');
    }
  }

  // ── Product Hunt ────────────────────────────────────────────────
  async function loadProductHunt() {
    const statusEl = qs('trendingPHStatus');
    const listEl   = qs('trendingPHList');
    if (!statusEl || !listEl) return;

    statusEl.textContent = 'Loading Product Hunt…';
    listEl.innerHTML = '';

    try {
      const data = await fetchTrendingFeed({ source: 'producthunt' });
      const posts = data.posts || [];
      statusEl.textContent = `${posts.length} launches from Product Hunt`;
      renderTrendingItems('trendingPHList', posts, 'producthunt');
    } catch (err) {
      statusEl.textContent = `Failed to load Product Hunt — ${err.message}`;
      renderTrendingItems('trendingPHList', [], 'producthunt');
    }
  }

  // ── initTrending ────────────────────────────────────────────────
  function initTrending() {
    renderSubPills();

    // Source tab switching
    document.querySelectorAll('.trending-src-tab').forEach(tab => {
      tab.onclick = () => {
        // Reset all tab styles
        document.querySelectorAll('.trending-src-tab').forEach(t => {
          t.style.color = 'var(--muted)';
          t.style.borderBottomColor = 'transparent';
        });
        tab.style.color = 'var(--brand)';
        tab.style.borderBottomColor = 'var(--brand)';

        trendingState.src = tab.dataset.tsrc;

        const panels = {
          reddit:       'trendingRedditPanel',
          hn:           'trendingHNPanel',
          producthunt:  'trendingPHPanel',
        };
        Object.values(panels).forEach(id => {
          const el = qs(id);
          if (el) el.style.display = 'none';
        });
        const active = panels[trendingState.src];
        if (active) { const el = qs(active); if (el) el.style.display = 'block'; }

        if (trendingState.src === 'hn')           loadHN();
        if (trendingState.src === 'producthunt')  loadProductHunt();
      };
    });

    // HN sub-tabs
    document.querySelectorAll('.trending-hn-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.trending-hn-tab').forEach(t => {
          t.style.background    = 'var(--surface)';
          t.style.color         = 'var(--muted)';
          t.style.borderColor   = 'var(--border2)';
        });
        tab.style.background  = 'var(--brand-dim)';
        tab.style.color       = 'var(--brand)';
        tab.style.borderColor = 'var(--brand-glow)';
        trendingState.hn = tab.dataset.hn;
        loadHN();
      };
    });

    // Custom subreddit input
    const goSub = qs('trendingGoSub');
    const customSub = qs('trendingCustomSub');
    if (goSub && customSub) {
      goSub.onclick = () => {
        const val = customSub.value.trim().replace(/^r\//i, '').replace(/[^a-zA-Z0-9_]/g, '');
        if (!val) return;
        if (!DEFAULT_SUBS.includes(val)) DEFAULT_SUBS.push(val);
        trendingState.sub = val;
        renderSubPills();
        loadReddit();
        customSub.value = '';
      };
      customSub.addEventListener('keydown', e => { if (e.key === 'Enter') goSub.click(); });
    }

    // Refresh buttons
    const refreshHandlers = {
      trendingRefreshBtn:     () => { if (trendingState.src === 'reddit') loadReddit(); else if (trendingState.src === 'hn') loadHN(); else loadProductHunt(); },
      trendingRefreshMob:     () => { if (trendingState.src === 'reddit') loadReddit(); else if (trendingState.src === 'hn') loadHN(); else loadProductHunt(); },
      trendingRefreshReddit:  () => loadReddit(),
      trendingRefreshHN:      () => loadHN(),
      trendingRefreshPH:      () => loadProductHunt(),
    };
    Object.entries(refreshHandlers).forEach(([id, handler]) => {
      const btn = qs(id);
      if (btn) btn.onclick = handler;
    });

    // Load Reddit on init
    loadReddit();
  }



// ── CONTENT PILLARS v2 ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
// STRATEGY SNACK MACHINE × POSTIQ INTEGRATION
// Drop this entire block into app.js, replacing the existing
// ContentPillars IIFE. Then update the cpGateNew handler below.
//
// CHANGES TO EXISTING HTML (app.html):
//   1. Replace cpGateNew card inner HTML (see GATE CARD HTML section)
//   2. Add SSM form HTML (see SSM FORM HTML section)
//   Both are drop-in replacements — no structural changes needed.
// ═══════════════════════════════════════════════════════════════

// ── SSM GATE CARD HTML (replace cpGateNew button contents) ──────
// Paste this as the innerHTML of the existing #cpGateNew button:
/*
<span class="cp-gate-icon">⚡</span>
<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-family:'DM Mono',monospace;font-weight:600;letter-spacing:.06em;text-transform:uppercase;background:var(--brand-dim);border:1px solid var(--brand-glow);color:var(--brand);padding:2px 8px;border-radius:4px;margin-bottom:8px;">Pillar Plan Builder</span>
<span class="cp-gate-title">Generate my content strategy</span>
<span class="cp-gate-desc">Answer 6 quick questions. Get 5 content pillars, 25 post ideas, hooks, CTAs, recurring series ideas, and one post you can publish today.</span>
<span class="cp-gate-cta">Build my plan →</span>
*/

// ── SSM FORM HTML (insert inside #cpStageJourney, replace all inner content) ──
/*
Replace everything inside <div class="cp-stage" id="cpStageJourney"> with:

<div style="max-width:660px;">
  <!-- Loading screen (hidden until generate()) -->
  <div id="ssmLoading" style="display:none;text-align:center;padding:40px 20px;">
    <div style="font-family:'DM Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);margin-bottom:12px;" id="ssmLoadStep">Reading your inputs...</div>
    <div style="border:1px solid var(--border2);height:14px;max-width:280px;margin:0 auto 16px;overflow:hidden;border-radius:2px;"><div style="height:100%;background:var(--brand);width:0%;transition:width .1s linear;" id="ssmLoadBar"></div></div>
    <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:20px;color:var(--ink);letter-spacing:-.02em;">Building your pillar plan<span id="ssmDots">...</span></div>
  </div>

  <!-- Form (shown by default) -->
  <div id="ssmForm">
    <div style="margin-bottom:20px;">
      <div style="font-family:'DM Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--brand);margin-bottom:8px;">Pillar Plan Builder</div>
      <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:18px;color:var(--ink);margin-bottom:4px;">Answer a few questions. Get a pillar plan.</div>
      <div style="font-size:13px;color:var(--muted);line-height:1.6;">6 quick fields. Deterministic output — built from your inputs.</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="field">
        <label class="label">Brand / Creator Name</label>
        <input type="text" class="input" id="ssm-brand" placeholder="e.g. Maria Chen, TechWave" />
      </div>
      <div class="field">
        <label class="label">Industry Category</label>
        <select class="input" id="ssm-industry">
          <option value="">Select industry...</option>
          <option value="fitness">Fitness & Wellness</option>
          <option value="food">Food & Beverage</option>
          <option value="saas">SaaS / Tech</option>
          <option value="realestate">Real Estate</option>
          <option value="creative">Creative Services</option>
          <option value="ecommerce">E-Commerce / Product Brand</option>
          <option value="coaching">Coaching & Consulting</option>
          <option value="finance">Finance & Money</option>
          <option value="education">Education & Courses</option>
          <option value="nonprofit">Nonprofit / Mission-Driven</option>
          <option value="entertainment">Entertainment / Media</option>
          <option value="localbiz">Local Business</option>
        </select>
      </div>
      <div class="field">
        <label class="label">Target Audience</label>
        <input type="text" class="input" id="ssm-audience" placeholder="e.g. early-stage founders, busy moms" />
      </div>
      <div class="field">
        <label class="label">Product / Service / Offer</label>
        <input type="text" class="input" id="ssm-offer" placeholder="e.g. 1:1 coaching, SaaS tool, meal kits" />
      </div>
      <div class="field">
        <label class="label">Brand Tone</label>
        <select class="input" id="ssm-tone">
          <option value="">Select tone...</option>
          <option value="bold">Bold & Direct</option>
          <option value="playful">Playful & Fun</option>
          <option value="expert">Expert & Authoritative</option>
          <option value="warm">Warm & Relatable</option>
          <option value="edgy">Edgy & Provocative</option>
          <option value="professional">Professional & Polished</option>
        </select>
      </div>
      <div class="field">
        <label class="label">Main Goal</label>
        <select class="input" id="ssm-goal">
          <option value="">Select goal...</option>
          <option value="grow">Grow Audience</option>
          <option value="sales">Drive Sales</option>
          <option value="trust">Build Trust</option>
          <option value="educate">Educate</option>
          <option value="hired">Get Hired</option>
          <option value="launch">Launch Product</option>
          <option value="event">Promote Event</option>
        </select>
      </div>
    </div>

    <div class="field" style="margin-top:4px;grid-column:1/-1;">
      <label class="label">Anything else? (optional)</label>
      <textarea class="input" id="ssm-notes" placeholder="Upcoming launches, topics to avoid, specific angles..." style="min-height:60px;"></textarea>
    </div>

    <div style="display:flex;gap:8px;margin-top:16px;align-items:center;">
      <button class="btn ghost" id="ssmBackBtn" type="button">← Back</button>
      <button class="btn primary" id="ssmGenerateBtn" type="button">⚡ Generate pillar plan →</button>
    </div>
  </div>
</div>
*/

// ═══════════════════════════════════════════════════════════════
// JAVASCRIPT — replaces window.ContentPillars IIFE in app.js
// ═══════════════════════════════════════════════════════════════

window.ContentPillars = (() => {
  const CP_KEY    = 'postiq_pillars_v3';
  const USAGE_KEY = 'postiq_pillars_usage_v1';
  const CP_TEMPLATE_TAG = 'postiq-content-pillars';
  const TONES     = ['Practical', 'Story', 'Contrarian', 'Question'];
  const COLORS    = ['#3a3fff','#0fa672','#f59e0b','#ff4f6a','#7c3aed','#9298b0'];

  const cpState = {
    identity: '',
    pillars: [],
    _ssmInputs: null,
  };

  const cpQs    = id => document.getElementById(id);
  const cpUid   = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const cpEsc   = s  => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pillarColor = i => COLORS[i % COLORS.length];

  function cpGetUsage() { try { return JSON.parse(localStorage.getItem(USAGE_KEY) || '{}'); } catch { return {}; } }
  function cpBumpUsage(pid) { const u = cpGetUsage(); u[pid] = (u[pid] || 0) + 1; try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch {} }
  function cpTotalUsage() { return Object.values(cpGetUsage()).reduce((a, b) => a + Number(b || 0), 0); }
  function cpUsageFor(pid) { return cpGetUsage()[pid] || 0; }

  function cpGeneratedSeriesNames() {
    try { return new Set(Object.values(SERIES || {}).flat().map(s => String(s?.name || '').trim()).filter(Boolean)); }
    catch { return new Set(); }
  }

  function cpIsGeneratedTemplate(tpl) {
    const tags = Array.isArray(tpl?.tags) ? tpl.tags.map(x => String(x || '').trim().toLowerCase()) : [];
    if (tags.includes(CP_TEMPLATE_TAG) || tags.includes('pillar-plan')) return true;
    const title = String(tpl?.title || '').trim();
    return tags.includes('series') && cpGeneratedSeriesNames().has(title);
  }

  function cpClearGeneratedTemplates() {
    if (typeof state === 'undefined' || !Array.isArray(state.templates)) return 0;
    const before = state.templates.length;
    state.templates = state.templates.filter(t => !cpIsGeneratedTemplate(t));
    const removed = before - state.templates.length;
    if (removed > 0) {
      if (typeof persistTemplates === 'function') persistTemplates();
      if (typeof renderTemplates === 'function') renderTemplates();
    }
    return removed;
  }

  function cpNormalizePillar(p, i = 0) {
    return {
      id:      String(p?.id      || cpUid()),
      name:    String(p?.name    || `Pillar ${i + 1}`),
      promise: String(p?.promise || p?.desc || ''),
      layer:   ['awareness','credibility','action'].includes(p?.layer) ? p.layer : '',
      seeds:   Array.isArray(p?.seeds) && p.seeds.length ? p.seeds.map(s => String(s || '')) : (Array.isArray(p?.ideas) ? p.ideas.map(s => String(s || '')) : ['']),
      tones:   p?.tones && typeof p.tones === 'object' ? p.tones : {},
      hook:    String(p?.hook || ''),
      cta:     String(p?.cta  || ''),
    };
  }

  function cpPersist() {
    try { localStorage.setItem(CP_KEY, JSON.stringify({ identity: cpState.identity, pillars: cpState.pillars })); } catch {}
    cpRenderCompact();
  }

  function cpLoad() {
    try {
      const d = JSON.parse(localStorage.getItem(CP_KEY) || 'null');
      if (d?.pillars?.length) {
        cpState.identity = d.identity || '';
        cpState.pillars  = d.pillars.map(cpNormalizePillar);
        return true;
      }
    } catch {}
    return false;
  }

  function cpShowStage(id) {
    document.querySelectorAll('.cp-stage').forEach(el => el.classList.remove('active'));
    const el = cpQs(id);
    if (el) el.classList.add('active');
  }

  // ── SSM ENGINE ─────────────────────────────────────────────────

  // Pillar library (subset — grow/sales for most verticals)
  // Full library inlined from SSM index.html
  const LIBRARY = {
    fitness_grow: [
      { name:'Real Progress, No Filter', desc:'Show the actual journey — sweat, setbacks, and small wins.', ideas:['Week 3 and I almost quit — here\'s what kept me going','My workout looked nothing like the plan today. Here\'s why that\'s fine','The fitness advice that actually worked for me (vs what I tried first)','What nobody shows you about getting in shape after 30','Progress pic I almost didn\'t post — but here we are'], hook:'The fitness account you actually need isn\'t showing you the full picture.', cta:'Follow if you\'re tired of the highlight reel. Real progress lives here.' },
      { name:'Workout How-Tos', desc:'Teach your audience a specific exercise, modification, or technique.', ideas:['How to do a proper Romanian deadlift if you\'ve never tried one','3 beginner-friendly swaps for exercises that hurt your knees','The form mistake everyone makes on bench press (and how to fix it)','5-minute morning mobility routine you can do in bed','How to build a full-body workout with just a resistance band'], hook:'You\'re working out consistently and still not seeing results. Here\'s why.', cta:'Save this one. Come back to it when you need a form check.' },
      { name:'Myth Busting', desc:'Fitness is full of bad advice that won\'t die. Be the person who calls it out.', ideas:['No, you don\'t need to do cardio every day to lose fat','The \'no pain no gain\' mindset is actually keeping you injured','Spot reduction isn\'t real — here\'s what actually works','You don\'t need a gym membership to get strong','Why eating less is sometimes making your weight loss harder'], hook:'I\'ve been in fitness for years and the amount of bad advice out there is actually alarming.', cta:'Drop your biggest fitness myth in the comments. Let\'s debunk it.' },
      { name:'Community & Motivation', desc:'Build belonging. People stay loyal to communities, not just content creators.', ideas:['If you worked out at all this week, this post is for you','Who else started their fitness journey after a doctor\'s visit?','The type of gym-goer I love to see (and it\'s not who you think)','Tag someone who needs to hear this today','What getting fit actually gave me that had nothing to do with my body'], hook:'Fitness changed my life. But not the way I expected.', cta:'Tell me where you\'re at in your journey. No judgment here.' },
      { name:'Lifestyle & Nutrition', desc:'Show that fitness is a full-system game — sleep, food, stress, recovery all matter.', ideas:['What I eat in a day as someone who actually lifts','The sleep habit that improved my training more than any supplement','3 high-protein meals I make when I have no time','Why I stopped counting calories and what I do instead','Recovery isn\'t lazy. Here\'s how I structure my rest days'], hook:'Your workouts aren\'t the problem. Your recovery is.', cta:'Save this. Your future self will thank you.' },
    ],
    fitness_sales: [
      { name:'Client Transformations', desc:'Document real outcomes from real clients — not just bodies, but confidence and consistency.', ideas:['Client went from skipping workouts to showing up 5x/week — here\'s what changed','Before & after: 90 days with a plan that actually fit her schedule','He told me he\'d "tried everything." 8 weeks later, this happened.','What my client learned in month one that she wishes she knew sooner','Real talk from a client: what coaching actually feels like from the inside'], hook:'I don\'t sell shortcuts. I sell systems that stick — and here\'s proof.', cta:'DM me READY to see if my coaching is the right fit for you.' },
      { name:'What You Get', desc:'Break down your offer in concrete, specific terms.', ideas:['Here\'s exactly what happens in week 1 of working with me','What\'s included in my program (and why I built it that way)','The difference between my coaching and a generic app','How I build your program around your actual schedule, not an ideal one','FAQ: Is your program right for me? Honest answer.'], hook:'Most fitness programs fail because they weren\'t built for your life. Mine is.', cta:'See the full breakdown at the link in bio. Spots are limited.' },
      { name:'Common Objections Answered', desc:'Meet your audience where their doubts live.', ideas:['"I don\'t have time to work out." Let me reframe that.','"I\'ve tried programs before and quit." Here\'s why this is different.','"I can just use YouTube." You can. Here\'s what you\'ll miss.','"I can\'t afford a coach right now." Let\'s talk about what\'s actually expensive.','"I\'m not in good enough shape to start." That\'s exactly why you should.'], hook:'You\'ve been telling yourself the same story for months. Let\'s challenge it.', cta:'Your questions are valid. Let\'s talk. DM me anytime.' },
      { name:'Social Proof', desc:'Let your clients do the selling.', ideas:['What she told me at the end of our 12 weeks together','Client DM that made my morning — sharing with permission','From "I hate working out" to 4x a week. Her words, not mine.','Results that surprised even me (and I\'ve been coaching for years)','The review that reminded me why I do this'], hook:'I could tell you my program works. Or I could let my clients.', cta:'Ready to write your own story? DM me to get started.' },
      { name:'Your Story & Method', desc:'Share why you do this and how your method is different.', ideas:['Why I became a fitness coach (it wasn\'t for the obvious reason)','The method I use that most trainers skip entirely','What I got wrong about fitness before I figured this out','My philosophy: I don\'t chase aesthetics, I chase ability','The moment I knew I had to start coaching other people'], hook:'There are thousands of fitness coaches. Here\'s why my clients choose me.', cta:'Follow for a different kind of fitness perspective. No fluff.' },
    ],
    saas_grow: [
      { name:'Build In Public', desc:'Document what you\'re building, deciding, and learning.', ideas:['We shipped a feature we almost cut. Here\'s what convinced us.','The metric we watch instead of MRR (and why)','3 things our users told us that changed our roadmap','Why we chose to build in [tech stack] and what we\'d do differently','What our churn data taught us that our NPS score never could'], hook:'Most SaaS companies share the wins. We\'re going to share everything.', cta:'Follow if you want to see what building a software company actually looks like.' },
      { name:'Hot Takes & Industry POV', desc:'Have real opinions about the tools, trends, and practices in your space.', ideas:['Unpopular opinion: your tech stack matters less than your distribution strategy','The SaaS metric everyone obsesses over that actually means nothing','Why most B2B software has a UX problem and nobody\'s talking about it','The "growth hack" that\'s actually just good product thinking','AI isn\'t replacing SaaS — but it\'s changing what SaaS has to be'], hook:'The SaaS advice that keeps getting recycled is keeping founders stuck.', cta:'Follow for takes on software, growth, and building products that last.' },
      { name:'Founder & Team Stories', desc:'Put humans behind the logo.', ideas:['Why we turned down a partnership that looked perfect on paper','The hire that changed everything about how we build','A decision I made in year one that still haunts me (and what I fixed)','Our remote team has never met in person. Here\'s how we make it work.','The week we thought about shutting down — and what we learned'], hook:'Behind every SaaS is a team making hard calls with incomplete information.', cta:'Follow along as we build this thing in public — wins, mistakes, and all.' },
      { name:'Use Case Education', desc:'Show your product solving real problems in specific industries.', ideas:['How a solo founder uses [product] to replace 3 different tools','[Industry] team saved 6 hours/week with this workflow in [product]','The exact setup a [role] uses in [product] to manage their pipeline','3 ways [product] handles [problem] that [competitor] can\'t','A day in the life of a power user — every tool, every trigger'], hook:'You\'ve heard about [product]. Here\'s what it actually looks like in the wild.', cta:'Try it free. Link in bio. No credit card required.' },
      { name:'Market Commentary', desc:'React to industry news with genuine analysis.', ideas:['What [major company] shutting down [feature] means for everyone in [space]','This funding round tells us a lot about where the market is going','The trend I\'m watching in [category] that nobody\'s written about yet','Why the consolidation happening in [space] is actually good for smaller players','My take on the "AI-first" narrative and what it gets wrong'], hook:'The [industry] news cycle moves fast. Here\'s the take you actually need.', cta:'Follow for weekly signal vs noise analysis on [space].' },
    ],
    saas_sales: [
      { name:'Problem-First Content', desc:'Name the exact friction your product removes.', ideas:['If your team is still doing [task] manually, here\'s what that\'s costing you','The reason [workflow] breaks down at scale (and what companies do about it)','Signs your current [tool category] is holding your team back','How much time does [problem] actually cost per week? (We did the math)','What happens when [process] doesn\'t have a system behind it'], hook:'The [problem] you\'ve been working around has a fix. You\'re just not using it.', cta:'See how [offer] handles this in 2 minutes — demo link in bio.' },
      { name:'Feature Storytelling', desc:'Tell the story of the problem features solve.', ideas:['We built [feature] because a customer showed us something that broke our heart','How [feature] works and why we built it this way (not the obvious way)','The edge case that led to [feature] — and why it matters for your team','[Feature] in 60 seconds: here\'s what changes for your workflow','Before [feature] vs after [feature] — a real user workflow comparison'], hook:'Software features don\'t matter. The problems they solve do. Here\'s ours.', cta:'Activate [feature] in your account today.' },
      { name:'ROI & Business Case', desc:'Help your buyers justify the purchase internally.', ideas:['How to calculate what [problem] is actually costing your company','The ROI calculation our customers use to justify [product] internally','What "saving time" actually means when 4 people use [product] every day','Our customers report [outcome] in the first 30 days — here\'s how','The business case for [product]: a template you can steal'], hook:'Your boss needs a number, not a feature list. Here\'s the number.', cta:'Need a custom ROI analysis? DM us your team size.' },
      { name:'Customer Stories', desc:'Your customers are your best salespeople.', ideas:['[Customer type] reduced [metric] by [X]% using this workflow in [product]','From spreadsheet chaos to [outcome]: a [company type] story','How a [team size] team uses [product] to do what used to take twice as many people','The customer who said they\'d "never switch tools again" — and what changed their mind','Interview: how [customer type] went from [before] to [after] in 60 days'], hook:'Don\'t take our word for it. Here\'s what [industry] teams say after 90 days.', cta:'Book a 15-min call. We\'ll show you how this works for your team.' },
      { name:'Comparison & Positioning', desc:'Help buyers understand why you\'re the right choice.', ideas:['[Product] vs [competitor]: what\'s actually different (honest breakdown)','Why [product] isn\'t for everyone — and who it\'s built for','The workflow [competitor] can\'t do that [product] was designed for','What to look for when evaluating [tool category] (regardless of who you choose)','The questions to ask any [tool category] vendor before you sign'], hook:'Every [tool category] looks the same on a comparison page. Here\'s what to actually look for.', cta:'See a side-by-side comparison. Link in bio.' },
    ],
    coaching_grow: [
      { name:'Thought Leadership', desc:'Share your genuine perspective on the problems your clients face.', ideas:['The advice every [client type] keeps getting that\'s actually holding them back','What [goal] actually requires — and why nobody wants to hear it','The coaching industry problem I\'m not willing to ignore anymore','Why [popular approach] works for some people and fails for most','My most controversial belief about [your niche] — and why I stand by it'], hook:'Most coaches in [space] are teaching the same thing. Here\'s what they\'re missing.', cta:'Follow if you\'re tired of advice that sounds good but doesn\'t land.' },
      { name:'Client Story Spotlights', desc:'Tell transformation stories with context, emotion, and specifics.', ideas:['She came to me believing [limiting belief]. Here\'s what shifted.','The client who had tried everything before working with me — and what finally worked','What 6 months of coaching looks like from the inside','A client win that had nothing to do with [obvious metric]','The moment a client said something that completely changed how I coach'], hook:'Transformation doesn\'t look the way you think it does. Let me show you.', cta:'Follow for real stories about what growth actually looks like.' },
      { name:'Your Framework & Method', desc:'Give your audience a taste of how you think and how you work.', ideas:['The 3-part framework I use with every new client','How I diagnose what\'s really blocking [audience type] in the first session','The question I ask that unlocks everything else','My signature process, explained — step by step','Why most [audience type] are solving the wrong problem'], hook:'Most people in [niche] focus on the symptom. I work on the root.', cta:'Follow to learn the framework behind real results.' },
      { name:'Behind The Coaching Business', desc:'Show what it\'s like to run a coaching practice.', ideas:['What a full coaching week actually looks like for me','How I structure my offers (and why I changed them twice)','The boundary I set that changed my business','What I charge and why (transparency post)','The tools I use to run my entire coaching practice'], hook:'Running a coaching business is nothing like what the gurus show you.', cta:'Follow for an honest look at what building a coaching practice actually takes.' },
      { name:'Mindset & Growth Content', desc:'Speak to the internal game — beliefs, fears, and patterns.', ideas:['The belief that\'s costing [audience type] the most right now','Why [audience] keep starting over (and how to stop)','The fear I see in almost every new client — and how we move through it','What "not ready" really means (and what to do about it)','The mindset shift that changes everything for [audience type]'], hook:'Your [goal] isn\'t a strategy problem. It\'s a belief problem.', cta:'Follow if you\'re ready to work on the thing that\'s actually in the way.' },
    ],
    creative_grow: [
      { name:'Process & Craft', desc:'Show your work in progress — not just the polished final product.', ideas:['Before and after: how this project evolved from brief to final delivery','The sketch that became the brand identity for [client type]','How I approach color when I have complete creative freedom','Why this logo went through 6 rounds — and what each version taught me','The creative decision I almost didn\'t make (and why I\'m glad I did)'], hook:'The final version never looks like the first one. Here\'s the full story.', cta:'Follow for a behind-the-scenes look at how creative work actually gets made.' },
      { name:'Portfolio Storytelling', desc:'Tell the story behind the work — the brief, the challenge, the decision-making.', ideas:['The brief: [client] needed [goal]. Here\'s what we built and why.','This project had one constraint that made it better','The client who trusted us completely — and what that unlocked','A project I\'m proud of that almost nobody saw','What I would do differently on this project if I had another shot'], hook:'Great creative work doesn\'t happen in a vacuum. Here\'s the context behind this one.', cta:'See the full project breakdown at [link]. Follow for more.' },
      { name:'Industry Takes', desc:'Have opinions about design, photography, video, or your craft.', ideas:['The design trend I\'m already tired of seeing everywhere','What makes [craft] actually hard — not just technically, but creatively','The client feedback that secretly made the project better','Why [popular style] is overused and what I\'d recommend instead','What AI is doing to [creative field] — my honest take'], hook:'Most designers/photographers/editors won\'t say this publicly. I will.', cta:'Follow for takes on [craft] that go beyond tutorials and aesthetics.' },
      { name:'Creative Tips & Education', desc:'Teach your audience something real about your craft.', ideas:['The typography rule I apply to every project without fail','3 things I check before I call a design/photo/video done','How I approach creative briefs when clients don\'t know what they want','The free tool that changed how I present work to clients','What I wish I knew in year one of being a [role]'], hook:'I\'ve been doing [craft] for [X] years. Here\'s the shortcut I wish I had.', cta:'Save this. The tutorial version is coming next week.' },
      { name:'Client Collaboration', desc:'Show what it\'s like to work with you.', ideas:['What my client onboarding actually looks like — step by step','The questions I ask before I touch any creative work','How I handle client feedback that misses the mark — honestly','What "unlimited revisions" really means and why I don\'t offer it','Why I show 1-2 concepts instead of 5 — and how clients feel about it afterwards'], hook:'Working with a creative shouldn\'t feel like a mystery. Here\'s how I make it easy.', cta:'Curious about working together? DM me. Let\'s see if it\'s a fit.' },
    ],
    ecommerce_grow: [
      { name:'Product in the Wild', desc:'Show your product living in the world — styled, used, loved.', ideas:['How our customers are styling [product] this season','UGC of the week: [product] in a home we never expected','The way [product] actually gets used vs how we originally imagined','Our team\'s favorite way to use [product] (3 very different answers)','[Product] in a day: morning, afternoon, and night'], hook:'The best thing about [product] is how many different ways people use it.', cta:'Tag us in your [product] photos. We share every one.' },
      { name:'Behind The Brand', desc:'Show your sourcing, your values, your process.', ideas:['Where [product] is made — and why we chose that factory/supplier/maker','The material we spent 6 months finding before we felt good about launching','Meet the person who [role] at [brand]','Why we made [brand decision] that other brands don\'t','The product we almost launched — and why we pulled it'], hook:'You can buy [product category] anywhere. Here\'s why people buy ours.', cta:'Follow [brand] to go behind the curtain on what we build and why.' },
      { name:'Education & Use Cases', desc:'Teach your audience how to get more value out of what you sell.', ideas:['The [product] mistake most people make in the first week','How to get the most out of [product] — tips from our most loyal customers','[Product] 101: everything to know before your first order','The use case for [product] you probably haven\'t tried yet','How to pair [product] with [complementary thing] for [better outcome]'], hook:'Most people only use [product] one way. Here are four more.', cta:'Save this for when your order arrives.' },
      { name:'Trend & Culture', desc:'Connect your product to what\'s culturally relevant right now.', ideas:['[Product] and the [trend] moment: why this is the year to care about [value]','How [cultural shift] is changing how people think about [product category]','The aesthetic moment [product] was made for — and why it\'s having a moment','What [pop culture thing] gets right about [product category]','Why [season/moment/year] is the perfect time for [product]'], hook:'[Product category] is having a moment. Here\'s where [brand] fits in.', cta:'Follow [brand] — we stay ahead of what\'s coming next.' },
      { name:'Community & UGC', desc:'Turn your customers into content.', ideas:['Customer photo of the month — congrats to [handle]','The review that stopped us in our tracks — sharing it here','How our community is using [product] in ways we didn\'t expect','The [product] photo that outperformed every piece of branded content we\'ve made','Real customers, real homes, real [product]: this week\'s roundup'], hook:'Our best marketing doesn\'t come from us. It comes from people like you.', cta:'Order [product], take a photo, tag us. We\'ll feature you here.' },
    ],
    finance_grow: [
      { name:'Personal Finance Education', desc:'Break down money concepts that feel intimidating into content that actually helps.', ideas:['What a Roth IRA actually is — explained like you\'re 25 and finally ready to care','The difference between good debt and bad debt (with real examples)','Why your budget keeps failing — and the simpler version that works','What [financial concept] means and why it matters for [audience]','The money move I wish I\'d made in my 20s (not clickbait)'], hook:'The financial system wasn\'t built to be understood. Let me fix that.', cta:'Follow for money content that makes you feel smarter, not worse.' },
      { name:'Market & News Commentary', desc:'React to economic news and market events with genuine analysis.', ideas:['What today\'s [economic news] actually means for your accounts/savings/portfolio','The Fed rate decision explained in 3 sentences that actually make sense','Why I\'m not panicking about [market event] — here\'s how I\'m thinking about it','The economic news nobody\'s talking about — and why it matters','What this recession signal does and doesn\'t mean for your money'], hook:'Financial news is designed to be alarming. Let\'s look at it clearly instead.', cta:'Follow for weekly market context — no fear, no hype.' },
      { name:'Budgeting & Spending Systems', desc:'Give your audience practical tools for managing money day-to-day.', ideas:['The budgeting method I\'ve seen work for people who hate budgets','How I allocate my income — the percentages and why','The subscription audit that saves people $100+ a month (do this today)','Why I stopped using a spending category called "miscellaneous"','How to pay yourself first when money is already tight'], hook:'Budgeting advice is everywhere. Here\'s what actually works in the real world.', cta:'Save this and actually do it this weekend. Your future self will be glad.' },
      { name:'Building Wealth Basics', desc:'Demystify investing, saving, and building long-term wealth.', ideas:['What to do with $1,000 if you have no idea where to start','Index funds explained without the jargon — why I recommend them first','The wealth gap between people who invest and people who don\'t (the math is wild)','How compound interest works — visualized simply','3 investing mistakes I see over and over with first-timers'], hook:'Wealth building isn\'t complicated. It\'s just not taught anywhere.', cta:'Follow for the financial education system that failed you.' },
      { name:'Financial Mindset', desc:'Address the emotional and psychological side of money.', ideas:['The money story from childhood that\'s affecting your finances right now','Why high earners still feel broke — the spending psychology behind it','The guilt I see around money that\'s keeping people from building wealth','What "good with money" actually means — it\'s not what you think','Financial anxiety is real. Here\'s how I talk to clients about it.'], hook:'Most money problems aren\'t math problems. They\'re psychology problems.', cta:'Follow if you want to fix your relationship with money — not just your budget.' },
    ],
    localbiz_grow: [
      { name:'Local Expertise & Context', desc:'Be the most useful local expert in your space.', ideas:['The [neighborhood] spots we recommend to our own customers','What [local event/season] means for [your business category]','Why [city] customers are different from national trends — and what we do about it','The [local thing] that inspired something we do at [business]','Our take on what\'s happening in [local area] right now'], hook:'Nobody knows [city] like we do. Here\'s what we\'re seeing.', cta:'Follow [business] — we\'re as local as it gets.' },
      { name:'Behind The Business', desc:'Show your team, your space, your process.', ideas:['Meet [team member] — what they do here and why they love it','A day in [business] before we open the doors','How we prep for [busy season] — the real version','What it actually took to open [business] in [city]','The decision we made about [business practice] that surprised people'], hook:'You\'ve probably walked past [business]. Here\'s who we actually are.', cta:'Come visit us at [address]. We\'re here [hours].' },
      { name:'Customer Love', desc:'Celebrate your regulars, your reviews, and the community.', ideas:['Customer of the month: [name] has been coming since [year]','The review that made our whole team stop what they were doing','A thank-you post to our neighborhood for [milestone]','What a local regular means to a small business — honestly','The community event we hosted and what it meant to us'], hook:'Small businesses run on regulars. Here\'s a thank-you to ours.', cta:'Leave us a review if we\'ve earned it. It matters more than you know.' },
      { name:'Educational & Service Content', desc:'Teach your audience something relevant to your category.', ideas:['What to look for when choosing a [business category] in [city]','The question you should always ask before hiring a [service type]','How to tell quality [product/service] from the generic version','Why [common misconception about your category] isn\'t quite right','What we\'ve learned after [X] years serving [city]'], hook:'We\'ve been in [business category] long enough to know what actually matters.', cta:'Questions about [service/product]? DM us or stop in anytime.' },
      { name:'Events & Promotions', desc:'Drive foot traffic and community engagement.', ideas:['[Event] at [business] on [date] — here\'s what to expect','We\'re doing [special offer] this week only — here\'s the deal','Celebrating [local event] with [something special] at [business]','Why we [host/participate in] [local thing] every year','[Limited time thing] is back — and it won\'t last long'], hook:'Something\'s happening at [business] and you don\'t want to miss it.', cta:'See you at [location] on [date]. Bring a friend.' },
    ],
  };

  // Inline the full fallback + series + hooks from SSM
  const SERIES = {
    grow:  [ { name:'Weekly Insight Drop', desc:'Every week, one specific insight from your world. Keep it concrete, keep it useful.' }, { name:'Myth vs. Reality', desc:'Monthly myth-busting post targeted at your audience\'s most common misconceptions.' }, { name:'Community Spotlight', desc:'Regular feature on a real person from your community — customer, follower, or collaborator.' } ],
    sales: [ { name:'Client Story of the Month', desc:'Feature one real client outcome every month. The before, the work, the result.' }, { name:'Objection of the Week', desc:'Pick one real objection you hear and address it with care and specificity.' }, { name:'Value Stack Breakdown', desc:'Monthly breakdown of everything inside your offer. Reinforce perceived value without discounting.' } ],
    trust: [ { name:'Learning in Public', desc:'Weekly update on something you\'re actively figuring out. Show the messy middle.' }, { name:'Process Deep Dive', desc:'Every two weeks, document the exact process behind something you do.' }, { name:'Transparency Report', desc:'Monthly real numbers post — what happened, what worked, what didn\'t.' } ],
    educate: [ { name:'101 → 301 Series', desc:'Build a curriculum from beginner to advanced on your core topic.' }, { name:'Myth of the Month', desc:'Monthly explainer that kills one widely-held misconception in your space.' }, { name:'Tool Teardown', desc:'Biweekly breakdown of a relevant tool — what it does, who it\'s for, honest verdict.' } ],
    hired: [ { name:'Work in Progress', desc:'Document a real project across multiple posts. Show your thinking, not just the output.' }, { name:'Skills Unlocked', desc:'Weekly post on one specific skill — what it is, how you apply it, proof it works.' }, { name:'Industry Read of the Week', desc:'Share and react to one article or trend each week.' } ],
    launch: [ { name:'Build Log', desc:'Weekly documentation of building your product.' }, { name:'Founding Story Arc', desc:'Multi-part narrative from idea to launch.' }, { name:'Beta Diaries', desc:'Share early user stories as they come in.' } ],
    event: [ { name:'Road to the Event', desc:'A short countdown series that reveals why the event matters.' }, { name:'Speaker / Feature Spotlight', desc:'Highlight one person, product, or reason to attend at a time.' }, { name:'Last Call Logistics', desc:'A practical series answering time, place, cost, schedule, and what-to-bring questions.' } ],
  };

  const HOOKS = {
    bold: ['Stop doing this in {industry}. It\'s costing you.','The {industry} advice everyone repeats that is actually wrong.','Nobody in {industry} wants to say this out loud.','Here is the take that will get me unfollowed:','If you are doing {offer}, you need to hear this first.'],
    playful: ['Okay but why does nobody talk about this in {industry}??','This is unhinged but hear me out...','POV: you finally figured out {industry}','Friendly reminder that this exists and it is completely free.','Hot take incoming and I am not sorry at all.'],
    expert: ['After years working in {industry}, here is what I know with confidence:','The research on this is clearer than most people realize.','A framework I have used across dozens of {audience}: it works.','Here is what actually happens in {industry} — not what the courses say.','If you only take one thing from this:'],
    warm: ['I have been wanting to share this for a while now.','Can we be honest for a second about {industry}?','Something I wish someone had told me earlier:','This community keeps teaching me things. Here is what I mean.','You are not behind. You are just human. Let me explain.'],
    edgy: ['Everyone is wrong about this in {industry}. Here is proof.','I am about to upset some people and that is fine.','This is what {industry} does not want {audience} to know.','Hard truth: the popular {industry} advice is keeping {audience} stuck.','Controversial? Maybe. But someone had to say it.'],
    professional: ['Sharing a framework that consistently drives results for {audience}:','Based on our experience across {industry}, here is what we have found:','A strategic insight for {audience} worth bookmarking:','The data does not lie: here is what matters in {industry}.','For {audience} making decisions in {industry}: this is worth your time.'],
  };

  const QUICK_WINS = {
    fitness_grow:'Post a real photo from your last workout — no filter, no setup. Caption it with one honest sentence about where you\'re at in your fitness journey. Authenticity outperforms aesthetic every time.',
    fitness_sales:'Share a 3-sentence client story: the problem they came to you with, what changed, and what they said to you after. End with "DM me READY if this sounds familiar."',
    saas_grow:'Share one thing you learned from your last user interview or support ticket that changed how you think about your product. Be specific. Founders and operators love content that shows real product thinking.',
    saas_sales:'Write a 3-line business case for your product: the problem, what it costs companies to ignore it, and what your product does about it. No features — just outcome language.',
    coaching_grow:'Give away one piece of genuinely useful content from inside your coaching — a framework, a question you ask clients, a mindset shift. If it\'s useful enough to put in a program, it\'s useful enough to post.',
    coaching_sales:'Describe your ideal client in 4 sentences: where they are, what they\'ve already tried, what\'s actually blocking them, and where they want to be. The right person will read it and DM you.',
    creative_grow:'Show a before/after of a project you finished recently — the rough first version and the final delivery. Add 2 sentences about the key creative decision that changed everything.',
    creative_sales:'Post a project spotlight: the brief you received, the challenge you faced, and the outcome you delivered. Use the client\'s industry so the right buyer sees themselves in the story.',
    ecommerce_grow:'Post a real UGC photo from a customer — with permission — and in the caption, share what they said about the product. No polish. Real people, real products, real words.',
    finance_grow:'Break down one financial concept that most of your audience is confused about — in plain language, no jargon. The simpler and more useful, the better the save rate.',
    localbiz_grow:'Post a "day before we open" photo or video — your team getting ready, the space being prepped. Add one sentence about what you love about your neighborhood. Local and human always wins.',
  };

  // Trust layer mapping — maps SSM pillar order to PostIQ trust layers
  const LAYER_MAP = ['awareness', 'credibility', 'awareness', 'action', 'credibility'];

  function getFallback(industry, goal, inp) {
    const byGoal = {
      grow: [
        { name:'Behind The Scenes', desc:`Pull the curtain back on how ${inp.brand} works.`, ideas:[`A day running ${inp.brand}`,`The decision behind ${inp.offer} that surprised us`,`What ${inp.brand} looks like before it's polished`,`The team/person behind ${inp.brand}`,`Why we do things differently in ${inp.industry}`], hook:`Most ${inp.industry} brands only show you the highlight reel.`, cta:`Follow ${inp.brand} for the real version.` },
        { name:'Education & Value', desc:`Teach ${inp.audience} something genuinely useful every week.`, ideas:[`The ${inp.industry} mistake ${inp.audience} keep making`,`How to get more out of ${inp.offer}`,`What most people misunderstand about ${inp.industry}`,`3 things ${inp.audience} should know before ${inp.offer}`,`The question I get asked most — answered properly`], hook:`${inp.audience} deserve better information about ${inp.industry}.`, cta:`Follow for real, useful content — no fluff.` },
        { name:'Hot Takes & POV', desc:`Say something real. Generic accounts are invisible.`, ideas:[`The ${inp.industry} advice I'm tired of seeing`,`Unpopular opinion about ${inp.offer}`,`What everyone gets wrong about ${inp.industry}`,`The trend in ${inp.industry} I think is overhyped`,`My honest take on where ${inp.industry} is headed`], hook:`Most ${inp.industry} content sounds the same. Here's a different take.`, cta:`Follow if you want ${inp.industry} content with an actual perspective.` },
        { name:'Community & Stories', desc:`Build belonging. Feature your audience, celebrate wins.`, ideas:[`A win from someone in our community worth celebrating`,`The DM that made our week`,`Who our ${inp.audience} actually are — real stories`,`What ${inp.audience} have in common (it's not what you think)`,`Shoutout to every ${inp.audience} doing the work right now`], hook:`${inp.brand} isn't just content. It's a community.`, cta:`Tell us your story in the comments. We want to hear it.` },
        { name:'Progress & Milestones', desc:`Document your journey — the wins, the setbacks, the lessons.`, ideas:[`What ${inp.brand} looked like 1 year ago vs today`,`A mistake we made and what it taught us`,`The milestone we just hit — and what it took`,`What we're working on right now (and why it's hard)`,`The decision that changed everything for ${inp.brand}`], hook:`The best brands show you where they started and how far they've come.`, cta:`Follow ${inp.brand} to see where we go next.` },
      ],
      sales: [
        { name:'Problem Clarity', desc:`Name the exact pain ${inp.offer} solves.`, ideas:[`The real reason ${inp.audience} struggle with ${inp.industry}`,`What happens when ${inp.audience} keep doing ${inp.industry} without a system`,`Signs ${inp.audience} are ready for ${inp.offer}`,`The cost of not solving this problem`,`What ${inp.audience} tell us they tried before ${inp.offer}`], hook:`If you're ${inp.audience} dealing with [problem], this is for you.`, cta:`DM us or visit the link in bio to learn more.` },
        { name:'Offer Breakdown', desc:`Explain ${inp.offer} with specificity.`, ideas:[`What's inside ${inp.offer} — the full breakdown`,`Who ${inp.offer} is built for (and who it's not)`,`How ${inp.offer} works from start to finish`,`The difference between ${inp.offer} and everything else in ${inp.industry}`,`FAQ about ${inp.offer} — the real questions answered`], hook:`Here's exactly what you get with ${inp.offer} — no surprises.`, cta:`Full details at the link in bio. Questions? DM us.` },
        { name:'Social Proof', desc:`Let results, reviews, and real customers do the selling.`, ideas:[`A customer result we're proud of — with the full story`,`What ${inp.audience} say after 30 days with ${inp.offer}`,`The review that surprised even us`,`Before & after: how ${inp.offer} changed things for a real customer`,`X customers in — here's what we're hearing`], hook:`Don't take our word for it. Here's what ${inp.audience} say.`, cta:`Ready to add your name to this list? Link in bio.` },
        { name:'Objection Handling', desc:`Meet your audience where their doubts live.`, ideas:[`"Is ${inp.offer} right for me?" — honest answer`,`The hesitation we hear most often (and why it makes sense)`,`What makes ${inp.offer} worth it, even if you've tried other things`,`For ${inp.audience} who aren't sure they're ready`,`Why now is actually a better time than waiting`], hook:`The reason you haven't bought yet is probably one of these things.`, cta:`Still have questions? DM us. We'll be straight with you.` },
        { name:'Your Story & Credibility', desc:`Show who's behind ${inp.brand} and why they're qualified.`, ideas:[`Why we built ${inp.offer}`,`What qualifies us to help ${inp.audience} with ${inp.industry}`,`The mistake that led to building ${inp.brand}`,`What we've learned after serving ${inp.audience}`,`Our values — and how they show up in ${inp.offer}`], hook:`There are options in ${inp.industry}. Here's why ${inp.audience} choose us.`, cta:`Follow ${inp.brand} — and reach out when you're ready.` },
      ],
    };
    return byGoal[goal] || byGoal.grow;
  }

  function fillHook(hook, inp) {
    return hook.replace(/{industry}/g, inp.industry).replace(/{audience}/g, inp.audience).replace(/{offer}/g, inp.offer).replace(/{brand}/g, inp.brand);
  }

  function getQuickWin(industry, goal, inp) {
    const key = `${industry}_${goal}`;
    if (QUICK_WINS[key]) return QUICK_WINS[key];
    const fallbacks = {
      grow: `Post one honest, specific insight from your work in ${inp.industry} this week. Not a tip — a real observation. Something ${inp.audience} rarely hear from anyone in your space.`,
      sales: `Write three sentences about ${inp.offer}: the problem it solves, who it's for, and one specific outcome a real customer got. Then add your contact or link.`,
      trust: `Share something you got wrong recently in ${inp.industry} and specifically what you changed because of it. Honest, specific, and humble content is the fastest trust-builder there is.`,
      educate: `Teach one small, specific, genuinely useful thing to ${inp.audience} about ${inp.industry}. Make it complete — not a teaser.`,
      hired: `Post a breakdown of a recent project: the brief, your process, and the outcome. Show your actual thinking, not just the final product.`,
      launch: `Share the "why" behind ${inp.offer} in 3-5 sentences. No features, no specs. Just the problem it solves, who it's for, and why you cared enough to build it.`,
      event: `Post the clearest possible invite for ${inp.offer}: who should come, what they will get, when it happens, and why it is worth showing up.`,
    };
    return fallbacks[goal] || fallbacks.grow;
  }

  function ssmGetPillars(industry, goal) {
    return LIBRARY[`${industry}_${goal}`] || null;
  }

  function ssmBuildStrategy(inp) {
    let rawPillars = ssmGetPillars(inp.industry, inp.goal);
    if (!rawPillars) rawPillars = getFallback(inp.industry, inp.goal, inp);

    const tonePool = HOOKS[inp.tone] || HOOKS.bold;
    const series   = SERIES[inp.goal] || SERIES.grow;
    const quickWin = getQuickWin(inp.industry, inp.goal, inp);

    // Convert SSM pillars → PostIQ pillar format with trust layer tags
    const pillars = rawPillars.map((p, i) => ({
      id:      cpUid(),
      name:    p.name,
      promise: p.desc,
      layer:   LAYER_MAP[i] || 'awareness',
      seeds:   (p.ideas || []).slice(0, 5).map(s => String(s || '')),
      tones:   {},
      hook:    fillHook(tonePool[i] || tonePool[0], inp),
      cta:     p.cta || '',
    }));

    if (inp.notes && pillars.length) {
      pillars[0].seeds = [
        `Context to work in: ${inp.notes}`,
        ...pillars[0].seeds
      ].slice(0, 6);
    }

    return { pillars, series, quickWin, inp };
  }

  // ── SSM FORM LOGIC ─────────────────────────────────────────────

  function ssmInit() {
    const backBtn     = cpQs('ssmBackBtn');
    const generateBtn = cpQs('ssmGenerateBtn');
    if (!backBtn || !generateBtn) return;

    backBtn.onclick     = () => cpShowStage('cpStageGate');
    generateBtn.onclick = ssmRunGenerate;
  }

  function ssmRunGenerate() {
    const brand    = (cpQs('ssm-brand')?.value    || '').trim() || 'Your Brand';
    const industry = cpQs('ssm-industry')?.value  || '';
    const audience = (cpQs('ssm-audience')?.value || '').trim() || 'your audience';
    const offer    = (cpQs('ssm-offer')?.value    || '').trim() || 'your offer';
    const tone     = cpQs('ssm-tone')?.value      || 'bold';
    const goal     = cpQs('ssm-goal')?.value      || 'grow';
    const notes    = (cpQs('ssm-notes')?.value    || '').trim();

    if (!industry) { if (typeof showToast === 'function') showToast('Select an industry first', 'error'); return; }
    if (!goal)     { if (typeof showToast === 'function') showToast('Select a goal first', 'error'); return; }

    const inp = { brand, industry, audience, offer, tone, goal, notes }
    cpState._ssmInputs = inp;

    // Show loading screen
    const form    = cpQs('ssmForm');
    const loading = cpQs('ssmLoading');
    if (form)    form.style.display    = 'none';
    if (loading) loading.style.display = 'block';

    const steps  = ['Detecting your industry...','Matching goal + industry combo...','Pulling pillar templates...','Generating hooks for your tone...','Finalizing your pillar plan...'];
    const bar    = cpQs('ssmLoadBar');
    const label  = cpQs('ssmLoadStep');
    let i = 0;
    const iv = setInterval(() => {
      if (bar)   bar.style.width    = ((i + 1) * 20) + '%';
      if (label) label.textContent  = steps[i] || 'Almost ready...';
      i++;
      if (i >= 5) {
        clearInterval(iv);
        setTimeout(() => ssmFinish(inp), 200);
      }
    }, 320);
  }

  function ssmFinish(inp) {
    const result = ssmBuildStrategy(inp);

    // Set identity from inputs
    cpState.identity = `${inp.brand} — ${inp.audience} — ${inp.offer}${inp.notes ? ` — Context: ${inp.notes}` : ''}`;
    cpState.pillars  = result.pillars.map(cpNormalizePillar);
    cpState._ssmInputs = inp;

    cpPersist();

    // Move to builder
    cpShowStage('cpStageBuilder');

    // Populate identity field
    const bi = cpQs('cpBuilderIdentity');
    if (bi) bi.value = cpState.identity;

    // Render pillars in builder
    cpRenderPillars();

    // Keep the quick-win starter inside the pillar plan. Do not auto-insert into Compose.
    cpState._latestGeneratedStarter = result.quickWin || '';

    // Replace any old pillar-generated series templates so reset/new generation stays clean.
    cpClearGeneratedTemplates();

    // Save recurring series as PostIQ templates
    ssmSaveSeriesAsTemplates(result.series, inp);

    if (typeof showToast === 'function') {
      showToast('Pillar plan generated — review your starters below', 'success');
    }

    // Restore form for next time
    const form    = cpQs('ssmForm');
    const loading = cpQs('ssmLoading');
    const bar     = cpQs('ssmLoadBar');
    if (form)    form.style.display    = 'block';
    if (loading) loading.style.display = 'none';
    if (bar)     bar.style.width       = '0%';
  }

  function ssmSendQuickWin(text) {
    const editor = document.getElementById('composerEditor');
    if (!editor) return;
    const existing = editor.innerText.trim();
    editor.innerText = existing ? `${existing}\n\n${text}` : text;
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
  }

  function ssmSaveSeriesAsTemplates(series, inp) {
    if (!Array.isArray(series) || !series.length) return;
    const now = new Date().toISOString();
    const newTpls = series.map(s => ({
      id:        cpUid(),
      title:     s.name,
      type:      'Hooks',
      platform:  'Universal',
      tags:      [CP_TEMPLATE_TAG, 'pillar-plan', 'series', inp.industry, inp.goal, inp.notes ? 'custom-context' : ''].filter(Boolean),
      body:      inp.notes ? `${s.desc}\n\nContext to consider: ${inp.notes}` : s.desc,
      createdAt: now,
      updatedAt: now,
    }));
    if (typeof state !== 'undefined' && Array.isArray(state.templates)) {
      state.templates = [...newTpls, ...state.templates];
      if (typeof persistTemplates === 'function') persistTemplates();
      if (typeof renderTemplates   === 'function') renderTemplates();
    }
  }

  // ── BUILDER RENDER ─────────────────────────────────────────────

  function cpRenderPillars() {
    const list = cpQs('cpPillarsList');
    if (!list) return;
    cpState.pillars = cpState.pillars.map(cpNormalizePillar);
    list.innerHTML = '';
    cpState.pillars.forEach((pillar, pi) => {
      const card  = document.createElement('div');
      card.className  = 'cp-pillar-card';
      card.dataset.pid = pillar.id;
      const usage = cpUsageFor(pillar.id);
      card.innerHTML = `<div class="cp-pillar-head"><div class="cp-pillar-tab" style="background:${pillarColor(pi)};"></div><div class="cp-pillar-head-inner"><div class="cp-pillar-inputs"><input class="cp-pillar-name" data-field="name" value="${cpEsc(pillar.name)}" placeholder="Pillar name" /><input class="cp-pillar-promise" data-field="promise" value="${cpEsc(pillar.promise)}" placeholder="The recurring promise this pillar makes…" /></div></div><div class="cp-pillar-head-right"><select class="cp-layer-select" data-field="layer"><option value="" ${pillar.layer ? '' : 'selected'}>Tag layer…</option><option value="awareness" ${pillar.layer==='awareness'?'selected':''}>👁 Awareness</option><option value="credibility" ${pillar.layer==='credibility'?'selected':''}>🎓 Credibility</option><option value="action" ${pillar.layer==='action'?'selected':''}>🛒 Action</option></select><span class="cp-usage-badge ${usage > 0 ? 'used' : ''}">${usage > 0 ? `${usage} starter${usage > 1 ? 's' : ''}` : 'unused'}</span></div></div>` +
        (pillar.hook ? `<div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--brand);background:var(--brand-dim);border-top:1px solid var(--brand-glow);padding:8px 13px;line-height:1.45;">Hook: "${cpEsc(pillar.hook)}"</div>` : '') +
        `<div class="cp-seeds" data-seeds-for="${pillar.id}">${pillar.seeds.map((seed, si) => cpSeedRowHtml(pillar, si, seed)).join('')}</div><div class="cp-pillar-footer"><button class="btn sm ghost" data-action="add-seed" type="button" style="font-size:11px;height:26px;padding:0 10px;">+ Add seed idea</button><button class="btn sm ghost" data-action="remove-pillar" type="button" style="font-size:11px;height:26px;padding:0 8px;color:var(--subtle);">Remove pillar</button></div>`;

      card.querySelectorAll('[data-field="name"],[data-field="promise"]').forEach(inp => {
        inp.addEventListener('input', () => { pillar[inp.dataset.field] = inp.value; cpPersist(); cpUpdateHealth(); });
      });
      card.querySelector('[data-field="layer"]').addEventListener('change', e => { pillar.layer = e.target.value; cpPersist(); cpUpdateLayerCheck(); });
      card.querySelector('[data-action="add-seed"]').addEventListener('click', () => { pillar.seeds.push(''); cpRenderPillars(); cpPersist(); });
      card.querySelector('[data-action="remove-pillar"]').addEventListener('click', () => {
        if (!confirm('Remove this pillar?')) return;
        cpState.pillars = cpState.pillars.filter(p => p.id !== pillar.id);
        cpRenderPillars(); cpPersist(); cpUpdateHealth();
        if (typeof showToast === 'function') showToast('Pillar removed');
      });
      cpBindSeeds(card, pillar);
      list.appendChild(card);
    });
    cpUpdateHealth();
    cpUpdateLayerCheck();
  }

  function cpSeedRowHtml(pillar, si, seed) {
    const tone = (pillar.tones && pillar.tones[si]) || 'Practical';
    return `<div class="cp-seed-row" data-si="${si}"><div class="cp-seed-idx">${si + 1}</div><div class="cp-seed-body"><input class="cp-seed-input" value="${cpEsc(seed)}" placeholder="A specific, real idea you could write about…" /><select class="cp-tone-select" data-tone="${si}">${TONES.map(t => `<option value="${t}" ${t === tone ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="cp-seed-actions"><button class="cp-seed-btn go" data-action="start" type="button">Start</button><button class="cp-seed-btn del" data-action="del" type="button" title="Remove">×</button></div></div>`;
  }

  function cpBindSeeds(card, pillar) {
    const wrap = card.querySelector('[data-seeds-for]');
    wrap.querySelectorAll('.cp-seed-input').forEach((inp, si) => {
      inp.addEventListener('input', () => { pillar.seeds[si] = inp.value; cpPersist(); cpUpdateHealth(); });
    });
    wrap.querySelectorAll('[data-tone]').forEach(sel => {
      sel.addEventListener('change', e => { if (!pillar.tones) pillar.tones = {}; pillar.tones[+e.target.dataset.tone] = e.target.value; cpPersist(); });
    });
    wrap.querySelectorAll('[data-action="start"]').forEach((btn, si) => {
      btn.addEventListener('click', () => {
        const seed = (pillar.seeds[si] || '').trim();
        if (!seed) { if (typeof showToast === 'function') showToast('Add a seed idea first', 'error'); return; }
        const tone = (pillar.tones && pillar.tones[si]) || 'Practical';
        cpSendToComposer(cpBuildStarter(pillar, seed, tone));
        cpBumpUsage(pillar.id);
        cpRenderPillars();
        if (typeof showToast === 'function') showToast('Starter added to Compose', 'success');
      });
    });
    wrap.querySelectorAll('[data-action="del"]').forEach((btn, si) => {
      btn.addEventListener('click', () => {
        if (pillar.seeds.length <= 1) pillar.seeds = [''];
        else pillar.seeds.splice(si, 1);
        cpRenderPillars(); cpPersist();
      });
    });
  }

  function cpBuildStarter(pillar, seed, tone) {
    const identity  = (cpState.identity || '').trim();
    const voiceLine = identity ? `Voice: ${identity}\n\n` : '';
    const openers   = { Practical:'Here\'s the clearest way I can explain this:', Story:'Here\'s a moment that changed how I think about this:', Contrarian:'Unpopular take:', Question:'Quick question for you:' };
    const hookLine  = pillar.hook ? `\nHook: "${pillar.hook}"\n` : '';
    const ctaLine   = pillar.cta  ? `\nCTA: ${pillar.cta}\n`    : '';
    return `${voiceLine}Pillar: ${pillar.name} — ${pillar.promise}\nTopic: ${seed}${hookLine}${ctaLine}\nPost starter: ${openers[tone] || openers.Practical}`;
  }

  function cpSendToComposer(text) {
    const editor = document.getElementById('composerEditor');
    if (editor) {
      const existing = editor.innerText.trim();
      editor.innerText = existing ? `${existing}\n\n${text}` : text;
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
      if (typeof window.activateView === 'function') window.activateView('composerView');
      editor.focus();
      return true;
    }
    return false;
  }

  function cpUpdateHealth() {
    const total = cpState.pillars.length;
    const seeds = cpState.pillars.reduce((a, p) => a + p.seeds.filter(s => String(s || '').trim()).length, 0);
    const used  = cpTotalUsage();
    const hP = cpQs('cpHealthPillars'), hS = cpQs('cpHealthSeeds'), hU = cpQs('cpHealthUsage');
    if (hP) hP.textContent = total;
    if (hS) hS.textContent = seeds;
    if (hU) hU.textContent = used;
    const score = Math.min(100, (Math.min(total, 5) / 5) * 40 + (Math.min(seeds, 15) / 15) * 40 + (Math.min(used, 5) / 5) * 20);
    const bar = cpQs('cpHealthBar');
    if (bar) { bar.style.width = `${score}%`; bar.className = `cp-health-fill${score >= 70 ? ' good' : score >= 40 ? ' warn' : ''}`; }
    const msgs = [[90,'Pillar system firing on all cylinders.'],[70,'Strong foundation. Keep creating starters.'],[50,'Looking solid. Start from a few seeds.'],[20,'Good start — add more seed ideas.'],[0,'Add your pillars to start.']];
    const msg = msgs.find(m => score >= m[0]);
    const el = cpQs('cpHealthMsg'); if (el) el.textContent = (msg || msgs[msgs.length - 1])[1];
  }

  function cpUpdateLayerCheck() {
    const has = l => cpState.pillars.some(p => p.layer === l);
    const fmt = l => has(l) ? '<span style="color:var(--green);font-weight:700;">✓</span>' : '<span style="color:var(--border2);">—</span>';
    const a = cpQs('cpLayerA'), c = cpQs('cpLayerC'), x = cpQs('cpLayerX');
    if (a) a.innerHTML = fmt('awareness');
    if (c) c.innerHTML = fmt('credibility');
    if (x) x.innerHTML = fmt('action');
  }

  function cpRenderCompact() {
    const wrap = document.getElementById('composerPillarsCompact');
    if (!wrap) return;
    const pillars = cpState.pillars.slice(0, 4);
    if (!pillars.length) {
      wrap.innerHTML = "<div style=\"font-size:12px;color:var(--subtle);padding:8px 0;font-family:'DM Mono',monospace;\">Build your pillars in the Ideas tab to see quick starters here.</div>";
      return;
    }
    wrap.innerHTML = '';
    const usage = cpGetUsage();
    pillars.forEach(pillar => {
      const card  = document.createElement('div');
      card.className = 'cp-compact-card';
      const seed  = pillar.seeds.find(s => String(s || '').trim()) || '';
      const count = usage[pillar.id] || 0;
      const unusedBadge  = count === 0 ? `<span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);border:1px solid var(--border);padding:1px 6px;border-radius:999px;margin-left:6px;">unused</span>` : '';
      const draftedLabel = count > 0 ? `${count} starter${count > 1 ? 's' : ''} created` : 'Not used yet';
      const seedHtml = seed ? `<div class="cp-compact-seed">${cpEsc(seed)}</div><div class="cp-compact-row"><span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);">${draftedLabel}</span><button class="btn sm primary" type="button" style="height:24px;font-size:11px;padding:0 8px;" data-start="${cpEsc(pillar.id)}">Start</button></div>` : '';
      card.innerHTML = `<div class="cp-compact-name">${cpEsc(pillar.name)}${unusedBadge}</div>${seedHtml}`;
      const btn = card.querySelector('[data-start]');
      if (btn) btn.addEventListener('click', e => {
        e.stopPropagation();
        const p = cpState.pillars.find(item => item.id === pillar.id);
        if (p) { cpSendToComposer(cpBuildStarter(p, seed, 'Practical')); cpBumpUsage(p.id); cpRenderCompact(); if (typeof showToast === 'function') showToast('Starter added to Compose', 'success'); }
      });
      wrap.appendChild(card);
    });
  }

  function init() {
    const hasData = cpLoad();

    // Gate: SSM path
    const gN = cpQs('cpGateNew');
    if (gN) gN.addEventListener('click', () => { cpShowStage('cpStageJourney'); ssmInit(); });

    // Gate: manual path
    const gE = cpQs('cpGateExperienced');
    if (gE) gE.addEventListener('click', () => {
      if (!cpState.pillars.length) {
        // Seed default pillars
        cpState.pillars = ['Behind The Scenes','Education & Value','Hot Takes & POV','Community & Stories','Your Offer & Story'].map((name, i) => ({
          id: cpUid(), name, promise: 'Define the recurring promise this pillar makes to your audience.', layer: LAYER_MAP[i] || 'awareness', seeds: [''], tones: {}, hook: '', cta: '',
        }));
      }
      cpShowStage('cpStageBuilder');
      const bi = cpQs('cpBuilderIdentity'); if (bi) bi.value = cpState.identity || '';
      cpRenderPillars(); cpPersist();
    });

    // Builder UI
    const bi = cpQs('cpBuilderIdentity');
    if (bi) bi.addEventListener('input', e => { cpState.identity = e.target.value; cpPersist(); });

    const ap = cpQs('cpAddPillarBtn');
    if (ap) ap.addEventListener('click', () => {
      cpState.pillars.push({ id: cpUid(), name: 'New Pillar', promise: 'The recurring promise this pillar makes…', layer: '', seeds: [''], tones: {}, hook: '', cta: '' });
      cpRenderPillars(); cpPersist(); if (typeof showToast === 'function') showToast('Pillar added');
    });

    const rb = cpQs('cpRestartBtn');
    if (rb) rb.addEventListener('click', () => {
      if (!confirm('Start over? This clears your pillars, starter counts, and pillar-generated series templates.')) return;
      const removedTemplates = cpClearGeneratedTemplates();
      cpState.pillars = [];
      cpState.identity = '';
      cpState._ssmInputs = null;
      cpState._latestGeneratedStarter = '';
      try { localStorage.removeItem(CP_KEY); localStorage.removeItem(USAGE_KEY); } catch {}
      const bi = cpQs('cpBuilderIdentity'); if (bi) bi.value = '';
      ['ssm-brand','ssm-industry','ssm-audience','ssm-offer','ssm-tone','ssm-goal','ssm-notes'].forEach(id => { const el = cpQs(id); if (el) el.value = ''; });
      cpRenderPillars();
      cpShowStage('cpStageGate');
      cpRenderCompact();
      if (typeof showToast === 'function') showToast(`Content pillars reset${removedTemplates ? ` — removed ${removedTemplates} generated template${removedTemplates > 1 ? 's' : ''}` : ''}.`, 'success');
    });

    const eb = cpQs('cpExportBtn');
    if (eb) eb.addEventListener('click', () => {
      const lines = ['# My Content Pillars\n', `Voice: ${cpState.identity || '(not set)'}\n`];
      cpState.pillars.forEach(p => {
        lines.push(`\n## ${p.name}`, `Promise: ${p.promise}`, `Layer: ${p.layer || 'untagged'}`, p.hook ? `Hook: "${p.hook}"` : '', p.cta ? `CTA: ${p.cta}` : '');
        p.seeds.filter(s => String(s || '').trim()).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      });
      const a = document.createElement('a');
      a.href     = URL.createObjectURL(new Blob([lines.filter(Boolean).join('\n')], { type: 'text/plain' }));
      a.download = 'content-pillars.txt';
      a.click();
      URL.revokeObjectURL(a.href);
      if (typeof showToast === 'function') showToast('Exported', 'success');
    });

    if (hasData) {
      cpShowStage('cpStageBuilder');
      const bi2 = cpQs('cpBuilderIdentity'); if (bi2) bi2.value = cpState.identity || '';
      cpRenderPillars();
    }
    cpRenderCompact();
  }

  return {
    init,
    renderCompact: cpRenderCompact,
    renderDraftCompact: cpRenderCompact,
    getData: () => ({ identity: cpState.identity, pillars: cpState.pillars }),
    insertStarter: (pillar, seed, dateLabel) => {
      const normalized = cpNormalizePillar(pillar || { name: 'Pillar', promise: 'Post starter' });
      const topic      = String(seed || '').trim();
      if (!topic) return false;
      const starter = `${dateLabel ? `Date: ${dateLabel}\n` : ''}${cpBuildStarter(normalized, topic, 'Practical')}`;
      const wrote = cpSendToComposer(starter);
      if (wrote && normalized.id) cpBumpUsage(normalized.id);
      cpRenderCompact();
      return wrote;
    },
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  bindGlobalStatusDismiss();
  bindGlobalErrorHandlers();
  document.addEventListener('click', handlePausedFeatureEvent, true);
  document.addEventListener('pointerdown', handlePausedFeatureEvent, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') handlePausedFeatureEvent(event);
  }, true);
  loadPostiqConfig();

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-view]');
    if (!trigger || !trigger.dataset.view) return;
    if (trigger.tagName === 'A' && trigger.hasAttribute('href')) return;
    e.preventDefault();
    if (typeof window.activateView === 'function') window.activateView(trigger.dataset.view);
    if (trigger.dataset.view === 'ideasView' && typeof setIdeasTab === 'function' && trigger.dataset.ideasTab) {
      setIdeasTab(trigger.dataset.ideasTab);
    }
  });

  try { init(); applyFeatureFlags(); } catch (e) { console.error('[PostIQ] init() crashed:', e); showGlobalErrorBanner(); }
});
