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
const NOTEBOOK_KEY    = 'postiq_notebook_v1';
const APPROVAL_PREFIX = 'postiq_approval_';
const WORKSPACE_PREFERENCES_KEY = 'postiq.workspacePreferences';
const THEME_PREFERENCE_KEY = 'postiq.theme';
const THEMES = Object.freeze(['default', 'neon', 'editorial', 'studio', 'evergreen']);
const WORKSPACE_DEFAULTS = Object.freeze({ planning: true, create: true, ideas: true, approvals: true });
const WORKSPACE_VIEWS = Object.freeze({ planning: 'calendarView', create: 'composerView', ideas: 'ideasView', approvals: 'approvalsView' });
// Internal beta feature flags for safely rolling modules on/off. These are not user-facing settings.
const FEATURE_FLAGS = {
  calendar: true,
  composer: true,
  ideas: true,
  approvals: false,
  library: true,
  pulse: true,
  contentItems: true
};
const FEATURE_VIEWS = Object.freeze({
  calendar: 'calendarView',
  composer: 'composerView',
  ideas: 'ideasView',
  approvals: 'approvalsView',
  library: 'libraryView',
  pulse: 'pulseView'
});

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
  betaMessage: "PostIQ is in public beta. Some tools may change as Buffer’s API evolves.",
  features: {
    calendar: true,
    composer: true,
    ideas: true,
    contentPillars: true,
    trending: true,
    approvals: true,
    snapshots: true,
    library: true,
    pulse: true,
    uploads: true,
    unsplash: true,
    contentItems: true,
  },
  notices: {
    calendar: '',
    composer: '',
    ideas: '',
    contentPillars: '',
    approvals: '',
    trending: '',
    library: '',
    pulse: '',
    uploads: '',
    snapshots: '',
    contentItems: ''
  }
};
const BETA_BANNER_SESSION_KEY = 'postiq_beta_banner_seen';
const BETA_BANNER_PERSIST_KEY = 'postiq_beta_banner_seen_persist';
const APP_VISITED_KEY = 'postiq_app_visited';
const CALENDAR_VIEW_KEY = 'postiq_calendar_view';
const FEATURE_HOME_DASHBOARD = false;
const LEGACY_NOTE_TYPES = {
  gold: { id: 'idea', label: 'Idea', color: '#f59e0b' },
  blue: { id: 'draft', label: 'Draft', color: '#3a3fff' },
  green: { id: 'campaign', label: 'Campaign', color: '#0fa672' },
  violet: { id: 'priority', label: 'Priority', color: '#7c3aed' }
};

// ── STATE ──────────────────────────────────────────
let bufferToken = '';
let currentViewId = 'calendarView';
let workspacePreferences = { ...WORKSPACE_DEFAULTS };
let currentIdeasTab = 'notebook';
let tokenPanelOpen = false;
let modalCount = 0;
let modalActionDelegatesBound = false;
let globalStatusTimer = null;
let lastGlobalErrorBannerAt = 0;
let homeActionsBound = false;
let homeDashboardWarned = false;
let composerContentStartedTracked = false;
const composerMilestonesTracked = new Set();
let postiqConfig = {
  ...DEFAULT_POSTIQ_CONFIG,
  features: { ...DEFAULT_POSTIQ_CONFIG.features },
  notices: { ...DEFAULT_POSTIQ_CONFIG.notices },
};

const state = {
  channels: [],
  scheduled: [],
  published: [],
  month: new Date(),
  selectedDate: null,
  editingNoteId: null,
  calendarFilter: 'all',
  syncState: 'idle',
  calendarView: localStorage.getItem(CALENDAR_VIEW_KEY) === 'week' ? 'week' : 'month',
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
  published: { value: [], ts: 0 },
};
const CACHE_TTL = { orgId: 86400000, channels: 86400000, scheduled: 600000, published: 600000 };

// ── UTILITIES ──────────────────────────────────────
const qs = id => document.getElementById(id);
const on = (id, evt, handler, opts) => { const el = qs(id); if (!el) return null; el.addEventListener(evt, handler, opts); return el; };
const fmtDate = value => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const monthLabel = d => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const monthStart = d => new Date(d.getFullYear(), d.getMonth(), 1);
const safeText = v => String(v || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const compact = (v, max = 80) => { const t = String(v || '').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; };
function safeTrack(callback) {
  try { if (typeof callback === 'function') callback(); }
  catch (error) { console.warn('GA4 tracking skipped:', error); }
}
function trackWorkspacePreference(eventName, params = {}) {
  safeTrack(() => {
    if (typeof window.gtag === 'function') window.gtag('event', eventName, params);
  });
}

function applyTheme(theme, persist = true) {
  const normalized = THEMES.includes(theme) ? theme : 'default';
  document.documentElement.dataset.theme = normalized;
  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    const selected = button.dataset.themeChoice === normalized;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-checked', String(selected));
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = normalized === 'neon' ? '#080b12' : normalized === 'editorial' ? '#f2efe6' : normalized === 'studio' ? '#fff5ea' : normalized === 'evergreen' ? '#edf3ec' : '#f5f6fa';
  if (persist) {
    try { localStorage.setItem(THEME_PREFERENCE_KEY, normalized); } catch {}
    const note = qs('themePreferenceNote');
    if (note) note.textContent = 'Theme saved.';
    trackWorkspacePreference('workspace_theme_changed', { theme: normalized });
  }
  return normalized;
}

function initThemePicker() {
  let saved = 'default';
  try { saved = localStorage.getItem(THEME_PREFERENCE_KEY) || 'default'; } catch {}
  applyTheme(saved, false);
  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    button.addEventListener('click', () => applyTheme(button.dataset.themeChoice));
  });
}

function normalizeWorkspacePreferences(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const normalized = {};
  Object.keys(WORKSPACE_DEFAULTS).forEach(workspace => {
    normalized[workspace] = typeof source[workspace] === 'boolean' ? source[workspace] : WORKSPACE_DEFAULTS[workspace];
  });
  if (!Object.values(normalized).some(Boolean)) normalized.planning = true;
  return normalized;
}

function getWorkspacePreferences() {
  let parsed = null;
  try { parsed = JSON.parse(localStorage.getItem(WORKSPACE_PREFERENCES_KEY) || 'null'); } catch {}
  const normalized = normalizeWorkspacePreferences(parsed);
  try {
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      localStorage.setItem(WORKSPACE_PREFERENCES_KEY, JSON.stringify(normalized));
    }
  } catch {}
  return normalized;
}

function getFirstEnabledWorkspace(preferences = workspacePreferences) {
  return Object.keys(WORKSPACE_DEFAULTS).find(workspace => preferences[workspace]) || 'planning';
}

function getWorkspaceForView(viewId) {
  return Object.keys(WORKSPACE_VIEWS).find(workspace => WORKSPACE_VIEWS[workspace] === viewId) || null;
}

function syncNavSectionVisibility() {
  const hasVisibleTools = Array.from(document.querySelectorAll('[data-feature="library"], [data-feature="pulse"]'))
    .some(el => !el.hidden && el.style.display !== 'none');
  document.querySelectorAll('[data-tools-section]').forEach(el => {
    el.hidden = !hasVisibleTools;
    if (el.style) el.style.display = hasVisibleTools ? '' : 'none';
  });
}

function renderWorkspacePreferences() {
  document.querySelectorAll('[data-workspace-nav]').forEach(el => {
    const feature = el.dataset.feature;
    const featureEnabled = !feature || isFeatureEnabled(feature);
    const visible = !!workspacePreferences[el.dataset.workspaceNav] && featureEnabled;
    el.hidden = !visible;
    if (el.style) el.style.display = visible ? '' : 'none';
  });
  document.querySelectorAll('[data-workspace-toggle]').forEach(input => {
    const workspace = input.dataset.workspaceToggle;
    input.checked = !!workspacePreferences[workspace];
  });
  syncNavSectionVisibility();
}

function ensureActiveWorkspaceVisible() {
  const activeWorkspace = getWorkspaceForView(currentViewId);
  if (activeWorkspace && !workspacePreferences[activeWorkspace]) {
    activateView(WORKSPACE_VIEWS[getFirstEnabledWorkspace(workspacePreferences)], 'workspace_preferences');
  }
}

function saveWorkspacePreferences(nextPreferences) {
  workspacePreferences = normalizeWorkspacePreferences(nextPreferences);
  try { localStorage.setItem(WORKSPACE_PREFERENCES_KEY, JSON.stringify(workspacePreferences)); } catch {}
  renderWorkspacePreferences();
  ensureActiveWorkspaceVisible();
  return workspacePreferences;
}

function setWorkspacePreference(workspace, enabled) {
  if (!(workspace in WORKSPACE_DEFAULTS)) return;
  const note = qs('workspacePreferenceNote');
  const enabledCount = Object.values(workspacePreferences).filter(Boolean).length;
  if (!enabled && workspacePreferences[workspace] && enabledCount === 1) {
    if (note) note.textContent = 'At least one workspace needs to stay on.';
    renderWorkspacePreferences();
    return;
  }
  if (note) note.textContent = '';
  saveWorkspacePreferences({ ...workspacePreferences, [workspace]: !!enabled });
  trackWorkspacePreference(`workspace_toggle_${workspace}`, { enabled: !!enabled });
}

function resetWorkspacePreferences() {
  const note = qs('workspacePreferenceNote');
  if (note) note.textContent = 'All workspaces are back on.';
  saveWorkspacePreferences({ ...WORKSPACE_DEFAULTS });
  trackWorkspacePreference('workspace_preferences_reset');
}

function getErrorType(error) {
  const status = error?.response?.status || error?.status;
  const message = error?.message?.toLowerCase?.() || '';
  if (status === 400) return 'validation_error';
  if (status === 401 || status === 403) return 'auth_error';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server_error';
  if (message.includes('network') || message.includes('failed to fetch')) return 'network_error';
  return 'unknown';
}
function toSafeExternalUrl(url) {
  if (!url) return '';
  const str = String(url).trim();
  try {
    const parsed = new URL(str);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return str;
  } catch {}
  return '';
}

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

function isFeatureEnabled(featureName) {
  if (!featureName) return true;
  if (Object.prototype.hasOwnProperty.call(FEATURE_FLAGS, featureName) && FEATURE_FLAGS[featureName] === false) return false;
  return getFeatureFlag(featureName);
}
window.isPostIQFeatureEnabled = isFeatureEnabled;

function getFeatureNotice(name) {
  return String(postiqConfig?.notices?.[name] || defaultFeaturePausedMessage);
}

function showFeaturePaused(name) {
  safeTrack(() => GA4_System.pausedFeatureAttempted(name));
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

function applyInternalFeatureFlags() {
  // Internal beta feature flags hide every marked module entry point (nav + views).
  // These are not user-facing paused controls, so disabled items should disappear entirely.
  document.querySelectorAll('[data-feature]').forEach(el => {
    const feature = el.dataset.feature;
    const enabled = isFeatureEnabled(feature);
    el.hidden = !enabled;
    el.style.display = enabled ? '' : 'none';
    el.setAttribute('aria-hidden', enabled ? 'false' : 'true');
    if (!enabled) {
      el.classList.remove('active', 'feature-paused');
      el.removeAttribute('aria-disabled');
      if ('disabled' in el) el.disabled = true;
    } else if ('disabled' in el) {
      el.disabled = false;
    }
  });

  syncNavSectionVisibility();

  const activeFeature = getFeatureForView(currentViewId);
  if (activeFeature && !isFeatureEnabled(activeFeature)) {
    activateView(getSafeFeatureFallbackView(), 'feature_flag');
  }
}

function getFeatureForView(viewId) {
  return Object.keys(FEATURE_VIEWS).find(feature => FEATURE_VIEWS[feature] === viewId) || null;
}

function getSafeFeatureFallbackView() {
  if (isFeatureEnabled('calendar')) return 'calendarView';
  if (isFeatureEnabled('composer')) return 'composerView';
  return 'composerView';
}

function applyFeatureFlags() {
  applyInternalFeatureFlags();
  const flagControls = {
    snapshots: ['shareMonthBtn', 'shareMonthBtnMob', 'generateShare', 'copyShare'],
    uploads: ['uploadBrowseBtn', 'uploadReplaceBtn'],
    unsplash: ['unsplashSearchBtn'],
  };

  Object.entries(flagControls).forEach(([feature, ids]) => {
    const paused = !getFeatureFlag(feature);
    ids.forEach(id => setFeatureControlPaused(qs(id), feature, paused));
  });

  document.querySelectorAll('[data-ideas-tab="trending"]').forEach(el => setFeatureControlPaused(el, 'trending', !getFeatureFlag('trending')));
  document.querySelectorAll('.media-tab[data-mtab="upload"], [data-mtabpanel="upload"] button, #uploadZone').forEach(el => setFeatureControlPaused(el, 'uploads', !getFeatureFlag('uploads')));
  document.querySelectorAll('.media-tab[data-mtab="unsplash"], [data-mtabpanel="unsplash"] button, [data-mtabpanel="unsplash"] input').forEach(el => setFeatureControlPaused(el, 'unsplash', !getFeatureFlag('unsplash')));
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
    safeTrack(() => GA4_System.applicationError(event.error || new Error('window_error'), 'app_init'));
    showGlobalErrorBanner();
  });
  window.addEventListener('unhandledrejection', event => {
    console.error('[PostIQ unhandled rejection]', event.reason);
    safeTrack(() => GA4_System.applicationError(event.reason, 'app_init'));
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
// Schedule pickers collect a local wall-clock time, but Buffer's dueAt is an
// absolute instant. Build the Date in local time and let toISOString convert
// it — stamping a literal "Z" onto the typed digits schedules the post in the
// wrong hour, and often in the past, which Buffer then rejects outright.
function localWallClockToISO(dateValue, hours, minutes) {
  const [year, month, day] = String(dateValue || '').split('-').map(Number);
  if (!year || !month || !day) return '';
  const when = new Date(year, month - 1, day, Number(hours) || 0, Number(minutes) || 0, 0, 0);
  return Number.isNaN(when.getTime()) ? '' : when.toISOString();
}
function datetimeLocalToISO(value) {
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(String(value || ''));
  return parts ? localWallClockToISO(parts[1], Number(parts[2]), Number(parts[3])) : '';
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
