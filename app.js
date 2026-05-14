'use strict';

// ── CONSTANTS ──────────────────────────────────────
const STORE_KEY       = 'postiq_buffer_token';
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

const SNAP_ADJECTIVES = ['amber','brisk','cobalt','clever','cosmic','crisp','electric','golden','lively','lunar','mint','neon','quiet','rapid','silver','sunny','tidy','vivid'];
const SNAP_NOUNS = ['atlas','beacon','canvas','comet','draft','ember','grove','harbor','kite','lane','maple','orbit','pencil','quill','signal','spark','studio','thread'];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const toBase64Url = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const fromBase64Url = str => decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
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
        <button class="btn sm primary" data-act="use">→ Draft</button>
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

// ── TOKEN ──────────────────────────────────────────
function maskPreview(t) { return t ? maskToken(t) : 'Not connected'; }

function refreshTokenUI() {
  const connected = !!bufferToken;
  qs('connDot').classList.toggle('on', connected);
  qs('connLabel').textContent = connected ? 'Connected' : 'Not connected';
  qs('connTokenPreview').textContent = maskPreview(bufferToken);
  updateNavTags();
}

function updateNavTags() {
  const connected = !!bufferToken;
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
    : 'Connect your Buffer token to load your scheduled posts and spot queue gaps.';
  const composerDesc = qs('composerDesc');
  if (composerDesc) composerDesc.textContent = connected
    ? 'Write your post, attach media, then send to Buffer as a draft, queued post, or scheduled post.'
    : 'Write here now — connect Buffer to unlock drafting, queueing, and scheduling.';
  updateComposerButtonStates();
  qs('calEmptyHint').style.display = connected ? 'none' : 'block';
}

function updateComposerButtonStates() {
  const connected = !!bufferToken;
  const hasChannel = !!qs('composerChannel')?.value;
  const ready = connected && hasChannel;
  ['composerDraft','composerQueue','composerScheduleToggle'].forEach(id => {
    const btn = qs(id); if (!btn) return;
    btn.disabled = !ready;
    btn.style.opacity = ready ? '1' : '.45';
    btn.style.cursor = ready ? 'pointer' : 'not-allowed';
    btn.title = !connected ? 'Add your Buffer token first' : !hasChannel ? 'Load channels from Buffer first' : '';
  });
}

function setBufferToken(token, { mode = 'session', messageEl = null } = {}) {
  localStorage.removeItem(STORE_KEY);
  sessionStorage.removeItem(STORE_KEY);
  const clean = String(token || '').trim();
  if (!clean) {
    bufferToken = '';
    clearSyncedData();
    if (messageEl) messageEl.textContent = 'Token removed.';
    refreshTokenUI();
    showToast('Token removed');
    return false;
  }
  if (mode === 'local') localStorage.setItem(STORE_KEY, clean);
  else sessionStorage.setItem(STORE_KEY, clean);
  bufferToken = clean;
  if (messageEl) messageEl.textContent = mode === 'local' ? 'Saved locally.' : 'Saved for session.';
  refreshTokenUI();
  showToast('Token saved', 'success');
  return true;
}

function loadStoredToken() {
  bufferToken = sessionStorage.getItem(STORE_KEY) || localStorage.getItem(STORE_KEY) || '';
  if (bufferToken) {
    const inp = qs('tokenInput'); if (inp) inp.value = bufferToken;
    loadCacheState();
    hydrateFromCache();
  }
  refreshTokenUI();
}

function saveToken() {
  const token = qs('tokenInput').value.trim();
  const mode = [...document.querySelectorAll('input[name="tokenMode"]')].find(r => r.checked)?.value || 'session';
  const ok = setBufferToken(token, { mode, messageEl: qs('tokenMsg') });
  if (ok) syncBuffer({ force: true });
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
  if (!bufferToken) throw Object.assign(new Error('No Buffer token'), { code: 'MISSING_TOKEN' });
  let res;
  try { res = await fetch('/.netlify/functions/buffer-proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: bufferToken, query, variables }) }); }
  catch (err) { throw Object.assign(new Error('Network error'), { code: 'PROXY_NETWORK_ERROR', retryable: true, cause: err }); }
  let data;
  try { data = await res.json(); } catch { throw Object.assign(new Error('Invalid proxy response'), { code: 'PROXY_BAD_RESPONSE' }); }
  if (data.errors?.length && !data.data) {
    const first = data.errors[0] || {};
    throw Object.assign(new Error(first.message || 'Buffer request failed'), { code: first.code || 'BUFFER_ERROR', status: first.status, retryable: !!first.retryable, retryAfter: first.retryAfter });
  }
  handleBufferWarnings(data);
  return data;
}

function getErrorMessage(err, fallback = 'Request failed. Please try again.') {
  const code = String(err?.code || '').toUpperCase();
  const msg  = String(err?.message || '');
  if (code === 'MISSING_TOKEN') return 'Add your Buffer token first.';
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
  localStorage.removeItem(STORE_KEY); sessionStorage.removeItem(STORE_KEY);
  clearSyncedData(); refreshTokenUI();
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
  if (!bufferToken) { setSyncStatus('failed', 'Add your Buffer token first.'); return; }
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
  if (!panel || !list || !bufferToken) { if (panel) panel.style.display = 'none'; return; }
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
  showToast('Note sent to Draft');
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
function resetShareForm({ resetRange = true } = {}) {
  const title = qs('shareCustomTitle'); if (title) title.value = '';
  const note = qs('shareNote'); if (note) note.value = '';
  const link = qs('shareLink'); if (link) link.value = '';
  const meta = qs('shareLinkMeta'); if (meta) meta.style.display = 'none';
  const generate = qs('generateShare'); if (generate) generate.textContent = 'Generate link';
  const range = qs('shareRange'); if (range && resetRange) range.value = 'month';
}
function openShareSnapshotModal() {
  resetShareForm();
  shareSnapshot();
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
// Calendar snapshot share
function shareSnapshot() {
  const include     = qs('includeNotes').checked;
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
  qs('shareMonthName').textContent = label;
  qs('sharePostCount').textContent = posts.length;
  const payload = {
    snapshotId, createdAt: Date.now(), period: range, month: range === 'month' ? monthLabel(state.month) : '', rangeLabel: label,
    rangeStart: range === 'week' ? fmtDate(bounds.start) : '', rangeEnd: range === 'week' ? fmtDate(bounds.end) : '', title, customTitle, message,
    includeNotes: include,
    noteTypes: getNoteTypes(),
    posts: posts.map(snapshotPostPayload),
    notes: include ? rangeNotes : []
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  qs('shareLink').value = location.origin + location.pathname + '#share=' + snapshotId + '.' + encoded;
  const meta = qs('shareLinkMeta'); if (meta) meta.style.display = 'block';
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
  openPostDetails(key, data, { title: formatDateOnly(key), noteTypes: snap.noteTypes || DEFAULT_NOTE_TYPES });
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
  const hasContent = data.posts.length > 0 || data.notes.length > 0;
  const day = document.createElement('div');
  day.className = 'cal-day' + (!inMonth ? ' other-month' : '') + (hasContent ? ' has-content' : ' empty-day');
  let inner = '<div class="day-num">' + date.getDate() + '</div>';
  if (data.posts.length) {
    inner += '<div class="day-count">' + data.posts.length + '</div>';
    data.posts.slice(0,2).forEach(post => { inner += '<div class="day-post-pill">' + safeText((post.text||'').slice(0,60)) + '</div>'; });
    if (data.posts.length > 2) inner += '<div class="more-indicator">+' + (data.posts.length - 2) + ' more</div>';
  }
  if (data.notes.length && snap.includeNotes) {
    data.notes.slice(0,1).forEach(n => { const meta = getNoteTypeMeta(n, snap.noteTypes || DEFAULT_NOTE_TYPES); inner += '<div class="day-note-pill" style="' + notePillStyle(meta) + '">' + safeText((n.text||'').slice(0,50)) + '</div>'; });
  }
  day.innerHTML = inner;
  if (hasContent) day.onclick = () => openSharedDayDetails(key, data, snap);
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

function renderSharedFromHash() {
  if (!location.hash.startsWith('#share=')) return false;
  try {
    const raw     = location.hash.slice(7);
    const dot     = raw.indexOf('.');
    const encoded = dot >= 0 ? raw.slice(dot + 1) : raw;
    const snap    = JSON.parse(fromBase64Url(encoded));
    qs('app').classList.add('hidden');
    qs('sharedView').classList.remove('hidden');
    const titleEl = qs('sharedTitle');
    if (titleEl) titleEl.textContent = snapshotDisplayTitle(snap);
    const countEl = qs('sharedPostCount'); if (countEl) countEl.textContent = (snap.posts || []).length;
    const noteEl = qs('sharedSnapshotNote'); if (noteEl) { noteEl.textContent = snap.message || ''; noteEl.style.display = snap.message ? 'block' : 'none'; }
    const periodEl = qs('sharedPeriodStat'); if (periodEl) periodEl.innerHTML = '<strong>' + safeText(snap.rangeLabel || snap.month || 'Snapshot') + '</strong>';
    if (snap.includeNotes && snap.notes?.length) {
      const dot2  = qs('sharedNotesDot');  if (dot2)  dot2.style.display  = 'block';
      const stat = qs('sharedNotesStat'); if (stat) { stat.style.display = 'flex'; stat.innerHTML = '<strong>' + snap.notes.length + '</strong>&nbsp;planning note' + (snap.notes.length > 1 ? 's' : ''); }
    }
    const calLabel = qs('sharedCalLabel');
    if (calLabel) calLabel.textContent = (snap.posts || []).length > 0 ? 'Click any highlighted day to read the full post' : 'No posts in this snapshot';
    const closeBtn = qs('closeSharedDay'); if (closeBtn) closeBtn.onclick = () => closeModal('sharedDayModal');
    const map = {};
    (snap.posts || []).forEach(p => { const k = String(p.dueAt || '').slice(0,10); if (!map[k]) map[k]={posts:[],notes:[]}; map[k].posts.push(p); });
    (snap.notes || []).forEach(n => { if (!map[n.date]) map[n.date]={posts:[],notes:[]}; map[n.date].notes.push(n); });
    renderSharedCalendarGrid(snap, map);
    return true;
  } catch(err) { console.error('Failed to render shared snapshot', err); return false; }
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

async function handleUploadFile(file) {
  const st = qs('uploadStatus');
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { st.textContent = 'Unsupported type.'; return; }
  if (file.type.startsWith('video/')) {
    st.textContent = 'For video, use the URL tab with a hosted video link.';
    switchMediaTab('url'); return;
  }
  qs('uploadZone').style.display = 'none'; st.textContent = 'Uploading…';
  try {
    const url = await imgurUpload(file);
    qs('uploadResult').style.display = 'flex';
    qs('uploadThumb').src = url; qs('uploadResultName').textContent = file.name || 'uploaded image'; qs('uploadResultUrl').textContent = url;
    st.textContent = ''; applyMedia(url, 'upload'); showToast('Image uploaded', 'success');
  } catch (err) {
    qs('uploadZone').style.display = 'block'; st.textContent = 'Upload failed: ' + err.message;
  }
}

function switchMediaTab(id) {
  document.querySelectorAll('.media-tab').forEach(t => t.classList.toggle('active', t.dataset.mtab === id));
  document.querySelectorAll('.media-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.mtabpanel === id));
}

let _unsplashLast = '';
async function runUnsplashSearch() {
  const q = qs('unsplashQuery').value.trim(); if (!q) return;
  if (q === _unsplashLast) return; _unsplashLast = q;
  const grid = qs('unsplashGrid'), status = qs('unsplashStatus');
  status.textContent = 'Searching…'; grid.innerHTML = '';
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=9&orientation=landscape`, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } });
    if (!res.ok) throw new Error(res.status === 403 ? 'Rate limit' : `HTTP ${res.status}`);
    const data = await res.json();
    if (!data.results?.length) { status.textContent = `No results for "${q}".`; return; }
    status.textContent = `${data.total.toLocaleString()} results`;
    data.results.forEach(photo => {
      const item = document.createElement('div');
      item.style.cssText = 'position:relative;border-radius:6px;overflow:hidden;border:2px solid transparent;cursor:pointer;aspect-ratio:4/3;background:var(--surface2);transition:border-color .12s;';
      item.innerHTML = `<img src="${photo.urls.small}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy"/>`;
      item.title = `Photo by ${photo.user.name}`;
      item.onmouseenter = () => { item.style.borderColor = 'var(--brand)'; };
      item.onmouseleave = () => { item.style.borderColor = 'transparent'; };
      item.onclick = () => { applyMedia(photo.urls.regular, 'unsplash'); closeMediaPanel(); showToast(`Photo by ${photo.user.name} added`, 'success'); };
      grid.appendChild(item);
    });
  } catch (err) { status.textContent = 'Search failed: ' + err.message; }
}

function openMediaPanel() { qs('mediaPanel').classList.add('open'); }
function closeMediaPanel() { qs('mediaPanel').classList.remove('open'); }

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
  if (!bufferToken) { showToast('Connect Buffer first', 'error'); return; }
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
    const msg = action === 'draft' ? 'Draft saved.' : action === 'queue' ? 'Added to queue.' : 'Scheduled.';
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
  if (appState.loading) return; appState.loading = true;
  const listEl = qs('approvalsList'), emptyEl = qs('approvalsEmpty');
  if (!listEl) { appState.loading = false; return; }
  listEl.innerHTML = '';
  emptyEl.style.display = 'none';
  try {
    const metas = getAllApprovalMetas();
    if (!metas.length) { emptyEl.style.display = 'flex'; appState.loading = false; return; }
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
    const msg = action === 'draft' ? 'Draft saved.' : action === 'queue' ? 'Added to queue.' : 'Scheduled.';
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
  currentViewId = viewId;
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x.dataset.view === viewId));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === viewId));
  document.querySelectorAll('.mob-tab[data-view]').forEach(t => t.classList.toggle('active', t.dataset.view === viewId));
  if (viewId === 'ideasView') setIdeasTab('pillars');
  if (viewId === 'approvalsView') loadApprovals();
}
window.activateView = activateView;

function setIdeasTab(tabId = 'pillars') {
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
  const d = qs('scheduleDate').value; if (!d) { qs('composerWhen').value = ''; return; }
  let h = parseInt(qs('scheduleHour').value); const m = parseInt(qs('scheduleMin').value); const ap = qs('scheduleAmpm').value;
  if (ap === 'PM' && h !== 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
  qs('composerWhen').value = `${d}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`;
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

  loadStoredToken();
  loadTemplates();
  initTemplateSelectors();
  renderTemplates();
  if (window.ContentPillars?.init) window.ContentPillars.init();
  buildTimePickers();
  qs('scheduleDate').value = new Date().toISOString().slice(0, 10);
  qs('scheduleDate').min = new Date().toISOString().slice(0, 10);
  renderCalendar();
  renderPlanningSettings();
  renderNoteTypesSettings();
  activateView('calendarView');

  qs('manageTokenBtn').onclick = () => {
    tokenPanelOpen = !tokenPanelOpen;
    qs('tokenPanel').style.display = tokenPanelOpen ? 'block' : 'none';
    qs('manageTokenBtn').textContent = tokenPanelOpen ? 'Done' : 'Manage token';
  };
  qs('revealTokenBtn').onclick = () => {
    tokenPanelOpen = true; qs('tokenPanel').style.display = 'block';
    qs('manageTokenBtn').textContent = 'Done';
    const inp = qs('tokenInput'); inp.type = 'text'; inp.focus();
  };
  qs('saveTokenBtn').onclick = saveToken;
  qs('clearTokenBtn').onclick = () => { qs('tokenInput').value = ''; saveToken(); };

  qs('syncBtn').onclick = () => syncBuffer({ force: true });
  if (bufferToken) syncBuffer();

  document.querySelectorAll('[data-view]').forEach(b => {
    b.onclick = () => {
      activateView(b.dataset.view);
      if (b.dataset.view === 'ideasView' && b.dataset.ideasTab) setIdeasTab(b.dataset.ideasTab);
    };
  });
  document.querySelectorAll('.ideas-tab').forEach(tabBtn => {
    tabBtn.onclick = () => setIdeasTab(tabBtn.dataset.ideasTab);
  });

  qs('prevMonth').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCalendar(); detectQueueGaps(); };
  qs('nextMonth').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCalendar(); detectQueueGaps(); };
  qs('todayMonth').onclick = () => { state.month = new Date(); renderCalendar(); detectQueueGaps(); };
  qs('closeNote').onclick = () => { closeModal('noteModal'); resetNoteForm(); };
  const closeShared = qs('closeSharedDay'); if (closeShared) closeShared.onclick = () => closeModal('sharedDayModal');
  qs('saveNoteBtn').onclick = saveNote;
  qs('deleteNoteBtn').onclick = deleteNote;
  qs('sendNoteToDraftBtn').onclick = sendNoteToDraft;
  qs('shareMonthBtn').onclick = openShareSnapshotModal;
  qs('closeShare').onclick = () => closeModal('shareModal');
  qs('includeNotes').onchange = shareSnapshot;
  const shareRangeInput = qs('shareRange'); if (shareRangeInput) shareRangeInput.onchange = shareSnapshot;
  const shareTitleInput = qs('shareCustomTitle'); if (shareTitleInput) shareTitleInput.oninput = shareSnapshot;
  const shareNoteInput = qs('shareNote'); if (shareNoteInput) shareNoteInput.oninput = shareSnapshot;
  const calendarFilter = qs('calendarFilter'); if (calendarFilter) calendarFilter.onchange = e => { state.calendarFilter = e.target.value || 'all'; renderCalendar(); };
  const showQueue = qs('showQueueGapsSetting'); if (showQueue) showQueue.onchange = savePlanningSettingsFromUI;
  const postingDays = qs('postingDaysSettings'); if (postingDays) postingDays.addEventListener('change', savePlanningSettingsFromUI);
  const noteTypesWrap = qs('noteTypesSettings'); if (noteTypesWrap) {
    noteTypesWrap.addEventListener('input', saveNoteTypesFromSettings);
    noteTypesWrap.addEventListener('click', e => { const btn = e.target.closest('[data-delete-note-type]'); if (btn) deleteNoteType(btn.dataset.deleteNoteType); });
  }
  const addNoteTypeBtn = qs('addNoteTypeBtn'); if (addNoteTypeBtn) addNoteTypeBtn.onclick = addNoteType;
  qs('generateShare').onclick = () => { shareSnapshot(); qs('generateShare').textContent = '✓ Link ready'; setTimeout(() => { qs('generateShare').textContent = 'Generate link'; }, 2500); };
  qs('copyShare').onclick = async () => { const ok = await copyTextSafe(qs('shareLink').value || ''); if (ok) { qs('copyShare').textContent = 'Copied!'; setTimeout(() => { qs('copyShare').textContent = 'Copy'; }, 1800); } else showToast('Could not copy', 'error'); };

  const editor = qs('composerEditor');
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
  qs('charCount').textContent = '0 chars';
  qs('composerChannel').addEventListener('change', updateComposerButtonStates);

  qs('composerClearBtn').onclick = () => {
    if (editorToText(editor.innerHTML) && !confirm('Clear composer?')) return;
    editor.innerHTML = ''; editor.dispatchEvent(new Event('input'));
    qs('composerStatus').textContent = ''; clearMedia();
  };

  document.querySelectorAll('[data-cmd]').forEach(btn => btn.onclick = () => composerFormat(btn.dataset.cmd));
  qs('composerDraft').onclick = () => composerSend('draft');
  qs('composerQueue').onclick = () => composerSend('queue');
  qs('composerScheduleSend').onclick = () => composerSend('schedule');
  qs('composerScheduleToggle').onclick = () => {
    qs('schedulePanel').classList.add('open');
    qs('composerScheduleToggle').style.display = 'none';
  };
  qs('scheduleCancel').onclick = () => {
    qs('schedulePanel').classList.remove('open');
    qs('composerScheduleToggle').style.display = 'inline-flex';
  };
  ['scheduleDate','scheduleHour','scheduleMin','scheduleAmpm'].forEach(id => qs(id).addEventListener('change', syncComposerWhen));
  syncComposerWhen();
  updateComposerButtonStates();
  window.addEventListener('postiq:synced', updateComposerButtonStates);

  qs('insertTemplateBtn').onclick = () => { renderTemplatePicker(); openModal('templatePickerModal'); };
  qs('saveAsTemplateBtn').onclick = () => {
    const sel = window.getSelection(); const text = (sel?.toString() || '').trim();
    if (!text) { showToast('Select text in the editor first', 'error'); return; }
    qs('templateBody').value = text; openTemplateModal();
  };

  qs('refPinDismiss').onclick = () => { qs('refPin').style.display = 'none'; };

  qs('mediaToggleBtn').onclick = () => { qs('mediaPanel').classList.contains('open') ? closeMediaPanel() : openMediaPanel(); };
  qs('mediaToggleOff').onclick = () => { qs('mediaPanel').classList.contains('open') ? closeMediaPanel() : openMediaPanel(); };
  qs('mediaSummaryClear').onclick = () => { clearMedia(); showToast('Media removed'); };
  document.querySelectorAll('.media-tab').forEach(t => t.onclick = () => switchMediaTab(t.dataset.mtab));

  const zone = qs('uploadZone'), fi = qs('uploadFileInput');
  zone.onclick = e => { if (!e.target.closest('#uploadBrowseBtn') && !e.target.closest('#uploadResult')) fi.click(); };
  qs('uploadBrowseBtn').onclick = e => { e.stopPropagation(); fi.click(); };
  fi.onchange = () => { if (fi.files[0]) handleUploadFile(fi.files[0]); };
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--brand)'; zone.style.background = 'var(--brand-dim)'; });
  zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) { zone.style.borderColor = 'var(--border2)'; zone.style.background = ''; } });
  zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = 'var(--border2)'; zone.style.background = ''; if (e.dataTransfer.files[0]) handleUploadFile(e.dataTransfer.files[0]); });
  document.addEventListener('paste', e => {
    if (!qs('mediaPanel').classList.contains('open')) return;
    const active = document.querySelector('.media-tab.active')?.dataset?.mtab;
    if (active !== 'upload') return;
    const img = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
    if (img) handleUploadFile(img.getAsFile());
  });
  qs('uploadReplaceBtn').onclick = e => { e.stopPropagation(); resetUploadTab(); fi.click(); };
  qs('uploadClearBtn').onclick  = e => { e.stopPropagation(); resetUploadTab(); clearMedia(); showToast('Media removed'); };

  const urlInp = qs('mediaUrlInput'); const urlClear = qs('mediaUrlClear');
  urlInp.addEventListener('input', () => {
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
  urlClear.onclick = () => { urlInp.value = ''; urlInp.dispatchEvent(new Event('input')); };
  const vtu = qs('videoThumbUrl');
  if (vtu) vtu.addEventListener('input', () => { mediaState.videoThumbUrl = vtu.value.trim(); });

  qs('unsplashSearchBtn').onclick = runUnsplashSearch;
  qs('unsplashQuery').addEventListener('keydown', e => { if (e.key === 'Enter') runUnsplashSearch(); });

  qs('newTemplateBtn').onclick = () => openTemplateModal();
  const manageTplBtn = qs('composerManageTemplatesBtn'); if (manageTplBtn) manageTplBtn.onclick = () => { activateView('ideasView'); setIdeasTab('templates'); };
  qs('closeTemplateModal').onclick = () => closeModal('templateModal');
  qs('cancelTemplateBtn').onclick = () => closeModal('templateModal');
  qs('saveTemplateBtn').onclick = saveTemplate;
  qs('closeTemplatePicker').onclick = () => closeModal('templatePickerModal');
  qs('templateSearch').addEventListener('input', e => { state.templateSearch = e.target.value; renderTemplates(); });
  qs('templatePlatformFilter').onchange = e => { state.templatePlatform = e.target.value; renderTemplates(); };
  qs('pickerSearch').addEventListener('input', renderTemplatePicker);
  qs('pickerType').onchange = renderTemplatePicker;

  qs('approvalsRefreshBtn').onclick = loadApprovals;
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
  let zenActive = false;

  function enterZen() {
    zenActive = true;
    document.body.classList.add('zen-active');
    activateView('composerView');
    const composePanel = qs('composeModePanel');
    const splitPanel = qs('splitModePanel');
    if (composePanel) composePanel.style.display = 'contents';
    if (splitPanel) splitPanel.style.display = 'none';
    document.querySelectorAll('.composer-mode-tab').forEach(t => {
      const active = t.dataset.cmode === 'compose';
      t.style.color = active ? 'var(--brand)' : 'var(--muted)';
      t.style.borderBottomColor = active ? 'var(--brand)' : 'transparent';
    });
    qs('composerEditor')?.focus();
    qs('zenToggleBtn').title = 'Exit zen mode';
  }

  function exitZen() {
    zenActive = false;
    document.body.classList.remove('zen-active');
    qs('zenToggleBtn').title = 'Zen mode — distraction-free writing';
  }

  qs('zenToggleBtn').onclick = () => zenActive ? exitZen() : enterZen();
  qs('zenExit').onclick = exitZen;

  const zenChannel = qs('zenChannel');
  if (zenChannel) {
    zenChannel.addEventListener('change', () => {
      const main = qs('composerChannel');
      if (main) main.value = zenChannel.value;
      updateComposerButtonStates();
    });
  }

  const zenDraft = qs('zenDraft'); if (zenDraft) zenDraft.onclick = () => composerSend('draft');
  const zenQueue = qs('zenQueue'); if (zenQueue) zenQueue.onclick = () => composerSend('queue');
  const zenSchedule = qs('zenSchedule');
  if (zenSchedule) zenSchedule.onclick = () => {
    exitZen();
    qs('schedulePanel')?.classList.add('open');
    const tgl = qs('composerScheduleToggle');
    if (tgl) tgl.style.display = 'none';
  };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && zenActive) {
      if (!document.querySelector('.modal.open')) { exitZen(); return; }
    }
  }, true);

  qs('openSettings').onclick = () => openModal('settingsModal');
  qs('closeSettings').onclick = () => closeModal('settingsModal');
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const panel = 'settingsPanel' + tab.dataset.stab.charAt(0).toUpperCase() + tab.dataset.stab.slice(1);
      document.querySelectorAll('.settings-panel').forEach(p => p.classList.toggle('active', p.id === panel));
    };
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
    const connected = !!bufferToken;
    const md = qs('mobConnDot'); if (md) md.classList.toggle('on', connected);
    const ml = qs('mobConnLabel'); if (ml) ml.textContent = connected ? 'Connected' : 'Not connected';
    qs('mobDrawer').classList.add('open');
    qs('mobBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMobDrawer() {
    qs('mobDrawer').classList.remove('open');
    qs('mobBackdrop').classList.remove('open');
    document.body.style.overflow = '';
  }
  qs('mobBackdrop').onclick = closeMobDrawer;
  ['mobMenuBtn','mobMenuBtnDraft','mobMenuBtnApprovals'].forEach(id => {
    const btn = qs(id); if (btn) btn.onclick = openMobDrawer;
  });
  qs('mobSyncBtn').onclick = () => { syncBuffer({ force: true }); closeMobDrawer(); };
  let mobTokenOpen = false;
  qs('mobManageTokenBtn').onclick = () => {
    mobTokenOpen = !mobTokenOpen;
    qs('mobTokenPanel').style.display = mobTokenOpen ? 'block' : 'none';
    qs('mobManageTokenBtn').textContent = mobTokenOpen ? '🔑 Done' : '🔑 Manage Buffer token';
    if (mobTokenOpen && bufferToken) qs('mobTokenInput').value = bufferToken;
  };
  qs('mobSaveTokenBtn').onclick = () => {
    const t = qs('mobTokenInput').value.trim();
    const mode = [...document.querySelectorAll('input[name="mobTokenMode"]')].find(r => r.checked)?.value || 'session';
    const ok = setBufferToken(t, { mode, messageEl: qs('mobTokenMsg') });
    if (ok) { qs('tokenInput').value = t; syncBuffer({ force: true }); closeMobDrawer(); }
  };
  qs('mobClearTokenBtn').onclick = () => { qs('mobTokenInput').value = ''; setBufferToken('', { mode: 'session', messageEl: qs('mobTokenMsg') }); };
  qs('mobOpenSettings').onclick = () => { closeMobDrawer(); openModal('settingsModal'); };

  const smb = qs('shareMonthBtnMob'); if (smb) smb.onclick = openShareSnapshotModal;

  const ccbm = qs('composerClearBtnMob');
  if (ccbm) {
    ccbm.onclick = () => {
      if (editorToText(editor.innerHTML) && !confirm('Clear composer?')) return;
      editor.innerHTML = ''; editor.dispatchEvent(new Event('input'));
      qs('composerStatus').textContent = ''; clearMedia();
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
    qs('composeModePanel').style.display = mode === 'compose' ? 'contents' : 'none';
    qs('splitModePanel').style.display  = mode === 'split'   ? 'block'    : 'none';
    const support = qs('composerSupportSection');
    if (support) support.style.display = mode === 'compose' ? 'grid' : 'none';
    if (mode === 'split') initSplitMode();
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
        <textarea data-ti="${i}" style="min-height:80px;font-size:13px;">${p}</textarea>`;
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
        const msg = action==='draft'?'Draft saved.':action==='queue'?'Added to queue.':'Scheduled.';
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
            <button class="btn sm" style="font-size:11px;" data-inspire="${i}">→ Draft from this</button>
            <a class="btn sm ghost" href="${safeText(item.url)}" target="_blank" rel="noopener" style="font-size:11px;">↗ Source</a>
          </div>
        </div>`;
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
    const statusEl = qs('trendingRedditStatus'); const listEl = qs('trendingRedditList');
    if (!statusEl || !listEl) return;
    statusEl.textContent = 'Loading…'; listEl.innerHTML = '';
    try {
      const res = await fetch(`https://www.reddit.com/r/${trendingState.sub}/hot.json?limit=25`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const posts = (data?.data?.children||[]).filter(p => !p.data.stickied);
      statusEl.textContent = `${posts.length} posts from r/${trendingState.sub}`;
      renderTrendingItems('trendingRedditList', posts.map((p) => ({
        title: p.data.title, score: p.data.score, comments: p.data.num_comments,
        sub: `r/${p.data.subreddit}`, url: `https://reddit.com${p.data.permalink}`,
        body: p.data.selftext, age: timeAgo(p.data.created_utc * 1000),
      })));
    } catch(e) { statusEl.textContent = 'Failed to load — Reddit may be blocking. Try again.'; }
  }

  async function loadHN() {
    const statusEl = qs('trendingHNStatus'); const listEl = qs('trendingHNList');
    if (!statusEl || !listEl) return;
    statusEl.textContent = 'Loading…'; listEl.innerHTML = '';
    try {
      const ids = await fetch(`https://hacker-news.firebaseio.com/v0/${trendingState.hn}.json`).then(r=>r.json());
      const stories = await Promise.all(ids.slice(0,20).map(id => fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r=>r.json())));
      statusEl.textContent = `${stories.length} stories from Hacker News`;
      renderTrendingItems('trendingHNList', stories.filter(s=>s?.title).map((s) => ({
        title: s.title, score: s.score, comments: s.descendants||0,
        sub: s.by ? `by ${s.by}` : 'HN', url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
        age: timeAgo(s.time * 1000),
      })));
    } catch(e) { statusEl.textContent = 'Failed to load Hacker News.'; }
  }

  function initTrending() {
    renderSubPills();

    document.querySelectorAll('.trending-src-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.trending-src-tab').forEach(t => {
          t.style.color = 'var(--muted)'; t.style.borderBottomColor = 'transparent';
        });
        tab.style.color = 'var(--brand)'; tab.style.borderBottomColor = 'var(--brand)';
        trendingState.src = tab.dataset.tsrc;
        qs('trendingRedditPanel').style.display = trendingState.src==='reddit' ? 'block' : 'none';
        qs('trendingHNPanel').style.display     = trendingState.src==='hn'     ? 'block' : 'none';
        if (trendingState.src==='hn') loadHN();
      };
    });

    document.querySelectorAll('.trending-hn-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.trending-hn-tab').forEach(t => {
          t.style.background='var(--surface)'; t.style.color='var(--muted)'; t.style.borderColor='var(--border2)';
        });
        tab.style.background='var(--brand-dim)'; tab.style.color='var(--brand)'; tab.style.borderColor='var(--brand-glow)';
        trendingState.hn = tab.dataset.hn; loadHN();
      };
    });

    qs('trendingGoSub').onclick = () => {
      const val = qs('trendingCustomSub').value.trim().replace(/^r\//,'');
      if (!val) return;
      if (!DEFAULT_SUBS.includes(val)) DEFAULT_SUBS.push(val);
      trendingState.sub = val; renderSubPills(); loadReddit();
      qs('trendingCustomSub').value = '';
    };
    qs('trendingCustomSub').addEventListener('keydown', e => { if (e.key==='Enter') qs('trendingGoSub').click(); });

    ['trendingRefreshBtn','trendingRefreshMob','trendingRefreshReddit'].forEach(id => {
      const btn = qs(id); if (btn) btn.onclick = () => { if (trendingState.src==='reddit') loadReddit(); else loadHN(); };
    });
    const hnRefBtn = qs('trendingRefreshHN'); if (hnRefBtn) hnRefBtn.onclick = loadHN;

    loadReddit();
  }

  let trendingInited = false;
  const origActivateView = activateView;
  window.activateView = function(viewId) {
    origActivateView(viewId);
    if (viewId === 'ideasView' && currentIdeasTab === 'trending' && !trendingInited) { trendingInited = true; initTrending(); }
  };

  const origSetIdeasTab = setIdeasTab;
  setIdeasTab = function(tabId) {
    origSetIdeasTab(tabId);
    if (currentIdeasTab === 'trending' && !trendingInited) { trendingInited = true; initTrending(); }
  };

  const guidePanel = qs('settingsPanelGuide');
  if (guidePanel && !guidePanel.querySelector('[data-guide-trending]')) {
    const trendingEntry = document.createElement('div');
    trendingEntry.dataset.guideTrending = '1';
    trendingEntry.innerHTML = `<div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:14px;margin-bottom:6px;">📈 Trending</div><p style="font-size:13px;color:var(--muted);line-height:1.65;">Browse hot Reddit posts by subreddit or Hacker News stories for post inspiration. Click "Draft from this" on any story to pin it as a reference above your Composer editor.</p>`;
    const threadEntry = document.createElement('div');
    threadEntry.innerHTML = `<div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:14px;margin-bottom:6px;">🧵 Split into thread</div><p style="font-size:13px;color:var(--muted);line-height:1.65;">Inside Draft, switch to the Split tab. Paste long-form content, hit Split Thread, and PostIQ breaks it into numbered parts. Edit each part, then queue or schedule the whole thread to Buffer natively.</p>`;
    guidePanel.querySelector('div').appendChild(trendingEntry);
    guidePanel.querySelector('div').appendChild(threadEntry);
  }

  if ('serviceWorker' in navigator && location.hostname !== 'localhost' && !location.hostname.includes('claudeusercontent')) {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW:', e));
  }
}



// ── CONTENT PILLARS v2 ────────────────────────────────────
window.ContentPillars = (() => {
  const CP_KEY = 'postiq_pillars_v3';
  const USAGE_KEY = 'postiq_pillars_usage_v1';
  const TONES = ['Practical', 'Story', 'Contrarian', 'Question'];
  const COLORS = ['#3a3fff', '#0fa672', '#f59e0b', '#ff4f6a', '#7c3aed', '#9298b0'];

  const cpState = {
    journeyStep: 0,
    audience: { who: '', struggles: [], custom: '' },
    quickSeeds: '',
    identity: '',
    pillars: [],
    _previewPillars: null,
  };

  const cpQs = id => document.getElementById(id);
  const cpUid = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const cpEsc = s => String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const pillarColor = i => COLORS[i % COLORS.length];

  function cpGetUsage() { try { return JSON.parse(localStorage.getItem(USAGE_KEY) || '{}'); } catch { return {}; } }
  function cpBumpUsage(pid) { const u = cpGetUsage(); u[pid] = (u[pid] || 0) + 1; try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch {} }
  function cpTotalUsage() { return Object.values(cpGetUsage()).reduce((a, b) => a + Number(b || 0), 0); }
  function cpUsageFor(pid) { return cpGetUsage()[pid] || 0; }

  function cpNormalizePillar(p, i = 0) {
    return {
      id: String(p?.id || cpUid()),
      name: String(p?.name || p?.helper || `Pillar ${i + 1}`),
      promise: String(p?.promise || p?.helper || 'The recurring promise this pillar makes to your audience'),
      layer: ['awareness', 'credibility', 'action'].includes(p?.layer) ? p.layer : '',
      seeds: Array.isArray(p?.seeds) && p.seeds.length ? p.seeds.map(s => String(s || '')) : [''],
      tones: p?.tones && typeof p.tones === 'object' ? p.tones : {},
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
        cpState.pillars = d.pillars.map(cpNormalizePillar);
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

  function cpShowStep(n) {
    cpState.journeyStep = n;
    document.querySelectorAll('.cp-journey-step').forEach(el => el.classList.remove('active'));
    const el = document.querySelector(`.cp-journey-step[data-jstep="${n}"]`);
    if (el) el.classList.add('active');
    document.querySelectorAll('.cp-prog-step').forEach((step, i) => {
      step.classList.toggle('active', i === n);
      step.classList.toggle('done', i < n);
    });
    if (n === 4) cpBuildPreview();
  }

  function cpDefaultPillars(who = '') {
    const audience = who || 'your audience';
    return [
      { id: cpUid(), name: 'What I Know', promise: `Teaching ${audience} the things that took me years to learn`, layer: 'credibility', seeds: ['The question I get asked every single week', 'Something obvious to me that surprises most people', 'What I wish someone had told me when I started'], tones: {} },
      { id: cpUid(), name: 'Real Talk', promise: 'Honest takes and the reality behind the polished version', layer: 'awareness', seeds: ['A mistake I made and what it taught me', 'What actually happened vs. what I posted about it', 'The version of success nobody talks about'], tones: {} },
      { id: cpUid(), name: 'My Beliefs', promise: 'Opinions worth holding — things I know to be true', layer: 'awareness', seeds: ["A belief I held 2 years ago that I've changed", 'The thing I will not stop saying', 'An unpopular opinion in my industry'], tones: {} },
      { id: cpUid(), name: 'How I Can Help', promise: "What I offer, who it's for, and what changes", layer: 'action', seeds: ['Who gets the most from what I do', 'The moment someone realizes they need this', 'What looks different after working with me'], tones: {} },
    ];
  }

  function cpPillarsFromJourney() {
    const who = cpQs('cpAudienceWho')?.value?.trim() || '';
    const seedsRaw = cpQs('cpQuickSeeds')?.value?.trim() || '';
    const seeds = seedsRaw.split('\n').map(s => s.replace(/^\d+[.)]?\s*/, '').trim()).filter(Boolean);
    return [
      { id: cpUid(), name: 'What I Know', promise: `Teaching ${who || 'your audience'} the things that took me years to learn`, layer: 'credibility', seeds: [seeds[0] || 'The question I get asked every single week', 'Something obvious to me that surprises most people', 'What I wish someone had told me when I started'], tones: {} },
      { id: cpUid(), name: 'Real Talk', promise: 'Honest takes and the reality behind the polished version', layer: 'awareness', seeds: [seeds[1] || 'A mistake I made and what it taught me', 'What actually happened vs. what I posted', 'The version of success nobody talks about'], tones: {} },
      { id: cpUid(), name: 'My Beliefs', promise: 'Opinions worth holding — things I know to be true', layer: 'awareness', seeds: [seeds[2] || "A belief I held 2 years ago that I've changed", 'The thing I will not stop saying', 'An unpopular opinion in my industry'], tones: {} },
      { id: cpUid(), name: 'How I Can Help', promise: "What I offer, who it's for, and what changes", layer: 'action', seeds: ['Who gets the most from what I do', 'The moment someone realizes they need this', 'What looks different after working with me'], tones: {} },
    ];
  }

  function cpBuildPreview() {
    const pills = cpPillarsFromJourney();
    cpState._previewPillars = pills;
    const wrap = cpQs('cpPreviewPillars');
    if (!wrap) return;
    const layerLabels = { credibility: '🎓 Credibility', awareness: '👁 Awareness', action: '🛒 Action' };
    wrap.innerHTML = '';
    pills.forEach((p, i) => {
      const el = document.createElement('div');
      el.style.cssText = `background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:13px 15px;box-shadow:var(--shadow-sm);margin-bottom:8px;border-left:4px solid ${pillarColor(i)};`;
      el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;"><span style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:14px;color:var(--ink);">${cpEsc(p.name)}</span><span style="font-family:'DM Mono',monospace;font-size:9px;padding:2px 7px;border-radius:3px;background:var(--brand-dim);border:1px solid var(--brand-glow);color:var(--brand);">${layerLabels[p.layer] || ''}</span></div><div style="font-size:12px;color:var(--muted);margin-bottom:8px;">${cpEsc(p.promise)}</div><div style="display:flex;flex-wrap:wrap;gap:5px;">${p.seeds.map(s => `<span style="font-size:11px;padding:3px 8px;border-radius:4px;background:var(--surface2);border:1px solid var(--border);color:var(--muted);">${cpEsc(s)}</span>`).join('')}</div>`;
      wrap.appendChild(el);
    });
  }

  function cpRenderPillars() {
    const list = cpQs('cpPillarsList');
    if (!list) return;
    cpState.pillars = cpState.pillars.map(cpNormalizePillar);
    list.innerHTML = '';
    cpState.pillars.forEach((pillar, pi) => {
      const card = document.createElement('div');
      card.className = 'cp-pillar-card';
      card.dataset.pid = pillar.id;
      const usage = cpUsageFor(pillar.id);
      card.innerHTML = `<div class="cp-pillar-head"><div class="cp-pillar-tab" style="background:${pillarColor(pi)};"></div><div class="cp-pillar-head-inner"><div class="cp-pillar-inputs"><input class="cp-pillar-name" data-field="name" value="${cpEsc(pillar.name)}" placeholder="Pillar name" /><input class="cp-pillar-promise" data-field="promise" value="${cpEsc(pillar.promise)}" placeholder="The recurring promise this pillar makes to your audience…" /></div></div><div class="cp-pillar-head-right"><select class="cp-layer-select" data-field="layer"><option value="" ${pillar.layer ? '' : 'selected'}>Tag layer…</option><option value="awareness" ${pillar.layer === 'awareness' ? 'selected' : ''}>👁 Awareness</option><option value="credibility" ${pillar.layer === 'credibility' ? 'selected' : ''}>🎓 Credibility</option><option value="action" ${pillar.layer === 'action' ? 'selected' : ''}>🛒 Action</option></select><span class="cp-usage-badge ${usage > 0 ? 'used' : ''}">${usage > 0 ? `${usage} drafted` : 'unused'}</span></div></div><div class="cp-seeds" data-seeds-for="${pillar.id}">${pillar.seeds.map((seed, si) => cpSeedRowHtml(pillar, si, seed)).join('')}</div><div class="cp-pillar-footer"><button class="btn sm ghost" data-action="add-seed" type="button" style="font-size:11px;height:26px;padding:0 10px;">+ Add seed idea</button><button class="btn sm ghost" data-action="remove-pillar" type="button" style="font-size:11px;height:26px;padding:0 8px;color:var(--subtle);">Remove pillar</button></div>`;
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
      sel.addEventListener('change', e => {
        if (!pillar.tones) pillar.tones = {};
        pillar.tones[+e.target.dataset.tone] = e.target.value;
        cpPersist();
      });
    });
    wrap.querySelectorAll('[data-action="start"]').forEach((btn, si) => {
      btn.addEventListener('click', () => {
        const seed = (pillar.seeds[si] || '').trim();
        if (!seed) { if (typeof showToast === 'function') showToast('Add a seed idea first', 'error'); return; }
        const tone = (pillar.tones && pillar.tones[si]) || 'Practical';
        cpSendToComposer(cpBuildStarter(pillar, seed, tone));
        cpBumpUsage(pillar.id);
        cpRenderPillars();
        if (typeof showToast === 'function') showToast('Starter sent to Draft', 'success');
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
    const identity = (cpState.identity || '').trim();
    const voiceLine = identity ? `Voice: ${identity}\n\n` : '';
    const openers = {
      Practical: "Here's the clearest way I can explain this:",
      Story: "Here's a moment that changed how I think about this:",
      Contrarian: 'Unpopular take:',
      Question: 'Quick question for you:',
    };
    return `${voiceLine}Pillar: ${pillar.name} — ${pillar.promise}\nTopic: ${seed}\n\nDraft starter: ${openers[tone] || openers.Practical}`;
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
    const used = cpTotalUsage();
    const hP = cpQs('cpHealthPillars'), hS = cpQs('cpHealthSeeds'), hU = cpQs('cpHealthUsage');
    if (hP) hP.textContent = total;
    if (hS) hS.textContent = seeds;
    if (hU) hU.textContent = used;
    const score = Math.min(100, (Math.min(total, 5) / 5) * 40 + (Math.min(seeds, 15) / 15) * 40 + (Math.min(used, 5) / 5) * 20);
    const bar = cpQs('cpHealthBar');
    if (bar) { bar.style.width = `${score}%`; bar.className = `cp-health-fill${score >= 70 ? ' good' : score >= 40 ? ' warn' : ''}`; }
    const msgs = [[90, 'Pillar system firing on all cylinders.'], [70, 'Strong foundation. Keep drafting.'], [50, 'Looking solid. Start drafting from seeds.'], [20, 'Good start — add more seed ideas.'], [0, 'Add your pillars to start.']];
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
      const card = document.createElement('div');
      card.className = 'cp-compact-card';
      const seed = pillar.seeds.find(s => String(s || '').trim()) || '';
      const count = usage[pillar.id] || 0;
      const unusedBadge = count === 0 ? `<span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);border:1px solid var(--border);padding:1px 6px;border-radius:999px;margin-left:6px;">unused</span>` : '';
      const draftedLabel = count > 0 ? `${count} post${count > 1 ? 's' : ''} drafted` : 'Not used yet';
      const seedHtml = seed ? `<div class="cp-compact-seed">${cpEsc(seed)}</div><div class="cp-compact-row"><span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);">${draftedLabel}</span><button class="btn sm primary" type="button" style="height:24px;font-size:11px;padding:0 8px;" data-start="${cpEsc(pillar.id)}">Start</button></div>` : '';
      card.innerHTML = `<div class="cp-compact-name">${cpEsc(pillar.name)}${unusedBadge}</div>${seedHtml}`;
      const btn = card.querySelector('[data-start]');
      if (btn) btn.addEventListener('click', e => {
        e.stopPropagation();
        const p = cpState.pillars.find(item => item.id === pillar.id);
        if (p) { cpSendToComposer(cpBuildStarter(p, seed, 'Practical')); cpBumpUsage(p.id); cpRenderCompact(); if (typeof showToast === 'function') showToast('Starter sent to Draft', 'success'); }
      });
      wrap.appendChild(card);
    });
  }

  function init() {
    const hasData = cpLoad();
    const gN = cpQs('cpGateNew'), gE = cpQs('cpGateExperienced');
    if (gN) gN.addEventListener('click', () => { cpShowStage('cpStageJourney'); cpShowStep(0); });
    if (gE) gE.addEventListener('click', () => {
      if (!cpState.pillars.length) cpState.pillars = cpDefaultPillars('');
      cpShowStage('cpStageBuilder');
      const bi = cpQs('cpBuilderIdentity'); if (bi) bi.value = cpState.identity || '';
      cpRenderPillars(); cpPersist();
    });

    const j0n = cpQs('cpJ0Next'); if (j0n) j0n.addEventListener('click', () => cpShowStep(1));
    const j1b = cpQs('cpJ1Back'); if (j1b) j1b.addEventListener('click', () => cpShowStep(0));
    const j1n = cpQs('cpJ1Next'); if (j1n) j1n.addEventListener('click', () => { cpState.audience.who = (cpQs('cpAudienceWho')?.value || '').trim(); cpState.audience.custom = (cpQs('cpStruggleCustom')?.value || '').trim(); cpShowStep(2); });
    const j2b = cpQs('cpJ2Back'); if (j2b) j2b.addEventListener('click', () => cpShowStep(1));
    const j2n = cpQs('cpJ2Next'); if (j2n) j2n.addEventListener('click', () => cpShowStep(3));
    const j3b = cpQs('cpJ3Back'); if (j3b) j3b.addEventListener('click', () => cpShowStep(2));
    const j3n = cpQs('cpJ3Next'); if (j3n) j3n.addEventListener('click', () => { cpState.quickSeeds = (cpQs('cpQuickSeeds')?.value || ''); cpShowStep(4); });
    const j4b = cpQs('cpJ4Back'); if (j4b) j4b.addEventListener('click', () => cpShowStep(3));
    const j4f = cpQs('cpJ4Finish'); if (j4f) j4f.addEventListener('click', () => {
      cpState.pillars = cpState._previewPillars || cpDefaultPillars(cpState.audience.who);
      const who = (cpQs('cpAudienceWho')?.value || '').trim();
      cpState.identity = who ? `I create content for ${who}${cpState.audience.custom ? ` — ${cpState.audience.custom}` : ''}` : '';
      cpPersist(); cpShowStage('cpStageBuilder');
      const bi = cpQs('cpBuilderIdentity'); if (bi) bi.value = cpState.identity;
      cpRenderPillars();
    });

    const struggles = cpQs('cpStruggles');
    if (struggles) struggles.querySelectorAll('.cp-tag-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        pill.classList.toggle('selected');
        const val = pill.dataset.val;
        if (pill.classList.contains('selected')) { if (!cpState.audience.struggles.includes(val)) cpState.audience.struggles.push(val); }
        else cpState.audience.struggles = cpState.audience.struggles.filter(s => s !== val);
      });
    });

    const bi = cpQs('cpBuilderIdentity');
    if (bi) bi.addEventListener('input', e => { cpState.identity = e.target.value; cpPersist(); });

    const ap = cpQs('cpAddPillarBtn');
    if (ap) ap.addEventListener('click', () => {
      cpState.pillars.push({ id: cpUid(), name: 'New Pillar', promise: 'The recurring promise this pillar makes…', layer: '', seeds: [''], tones: {} });
      cpRenderPillars(); cpPersist(); if (typeof showToast === 'function') showToast('Pillar added');
    });

    const rb = cpQs('cpRestartBtn');
    if (rb) rb.addEventListener('click', () => {
      if (!confirm('Start over? Your current pillars will be cleared.')) return;
      cpState.pillars = []; cpState.identity = ''; cpPersist(); cpShowStage('cpStageGate'); cpRenderCompact();
    });

    const eb = cpQs('cpExportBtn');
    if (eb) eb.addEventListener('click', () => {
      const lines = ['# My Content Pillars\n', `Voice: ${cpState.identity || '(not set)'}\n`];
      cpState.pillars.forEach(p => {
        lines.push(`\n## ${p.name}`, `Promise: ${p.promise}`, `Layer: ${p.layer || 'untagged'}`);
        p.seeds.filter(s => String(s || '').trim()).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
      a.download = 'content-pillars.txt'; a.click();
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
      const normalized = cpNormalizePillar(pillar || { name: 'Pillar', promise: 'Draft starter' });
      const topic = String(seed || '').trim();
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

  try { init(); } catch (e) { console.error('[PostIQ] init() crashed:', e); }
});
