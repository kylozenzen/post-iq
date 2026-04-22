'use strict';

// ── CONSTANTS ──────────────────────────────────────
const STORE_KEY       = 'postiq_buffer_token';
const NOTE_KEY        = 'postiq_calendar_notes_v2';
const TEMPLATE_KEY    = 'postiq_templates_v1';
const CACHE_KEY       = 'postiq_buffer_cache_v1';
const APPROVAL_PREFIX = 'postiq_approval_';

const IMGUR_KEY    = '546c25a59c58ad7';
const UNSPLASH_KEY = 'tBuaYCO5p-pJPjgF29hR2yJGtlQaG4d5HqdVivV0lbQ';

const TEMPLATE_TYPES     = ['All','Hooks','CTAs','Announcements','Engagement','Hashtag Sets'];
const TEMPLATE_PLATFORMS = ['All Platforms','LinkedIn','X','Threads','Instagram','Universal'];

// ── STATE ──────────────────────────────────────────
let bufferToken = '';
let currentViewId = 'calendarView';
let tokenPanelOpen = false;
let modalCount = 0;

const state = {
  channels: [],
  scheduled: [],
  month: new Date(),
  selectedDate: null,
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
const normTags = v => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : String(v || '').split(',').map(x => x.trim()).filter(Boolean);
const isVideo = url => /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(String(url || ''));
const maskToken = t => !t ? '—' : t.length <= 8 ? '••••' : `${t.slice(0,4)}••••${t.slice(-4)}`;

function showToast(msg, type = '') {
  const wrap = qs('toastWrap'); if (!wrap) return;
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  wrap.appendChild(t);
  const delay = msg.length > 40 ? 3800 : 2600;
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, delay);
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
    card.querySelector('[data-act="copy"]').onclick = () => { navigator.clipboard.writeText(s.body || ''); showToast('Copied'); };
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
  if (!items.length) { list.innerHTML = '<div style="font-size:12px;color:var(--subtle);padding:8px 0;font-family:\'DM Mono\',monospace;">No templates yet.</div>'; return; }
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
      if (id === 'templatePlatformFilter' && i === 0) return; // skip "All" for modal selector
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
function getNotes() { try { return JSON.parse(localStorage.getItem(NOTE_KEY) || '{}'); } catch { return {}; } }
function setNotes(v) { localStorage.setItem(NOTE_KEY, JSON.stringify(v)); }

function renderCalendar() {
  qs('monthLabel').textContent = monthLabel(state.month);
  const grid = qs('calGrid'); grid.innerHTML = '';
  const first = monthStart(state.month);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const notes = getNotes();
  const today = fmtDate(new Date());
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = fmtDate(d);
    const inMonth = d.getMonth() === state.month.getMonth();
    const dayPosts = state.scheduled.filter(p => fmtDate(new Date(p.dueAt)) === key);
    const note = notes[key];
    const isToday = key === today;
    const hasGap = inMonth && !dayPosts.length && [1,2,3,4,5].includes(d.getDay()); // weekday gap indicator

    const day = document.createElement('div');
    let cls = 'cal-day';
    if (!inMonth) cls += ' other-month';
    if (isToday) cls += ' today';
    if (dayPosts.length) cls += ' has-posts';
    day.className = cls;

    let html = `<div class="day-num">${d.getDate()}</div>`;
    if (dayPosts.length) html += `<div class="day-count">${dayPosts.length}</div>`;
    if (dayPosts[0]) html += `<div class="day-post-pill">${safeText(compact(dayPosts[0].text, 60))}</div>`;
    if (dayPosts[1]) html += `<div class="day-post-pill">${safeText(compact(dayPosts[1].text, 60))}</div>`;
    if (dayPosts.length > 2) html += `<div class="more-indicator">+${dayPosts.length - 2} more</div>`;
    if (note) html += `<div class="day-note-pill ${note.tag || 'gold'}">${safeText(compact(note.text, 50))}</div>`;
    day.innerHTML = html;
    day.onclick = () => openDayNote(d);
    grid.appendChild(day);
  }
  renderAgenda();
}

function detectQueueGaps() {
  const panel = qs('gapsPanel'); const list = qs('gapsList');
  if (!panel || !list || !bufferToken) { if (panel) panel.style.display = 'none'; renderPillarBalance(); return; }
  const today = new Date(); today.setHours(0,0,0,0);
  const gaps = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    if ([0,6].includes(d.getDay())) continue; // skip weekends
    const key = fmtDate(d);
    const hasPosts = state.scheduled.some(p => fmtDate(new Date(p.dueAt)) === key);
    if (!hasPosts) gaps.push(d);
  }
  if (!gaps.length) { panel.style.display = 'none'; renderPillarBalance(); return; }
  panel.style.display = 'block';
  list.innerHTML = '';
  gaps.forEach(d => {
    const chip = document.createElement('button');
    chip.className = 'gap-chip';
    chip.textContent = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    chip.onclick = () => openDayNote(d);
    list.appendChild(chip);

    const fillBtn = document.createElement('button');
    fillBtn.className = 'gap-chip';
    fillBtn.style.cssText = 'background:var(--brand-dim,rgba(58,63,255,.08));border-color:var(--brand-glow,rgba(58,63,255,.2));color:var(--brand,#3a3fff);';
    fillBtn.textContent = 'Pick a pillar';
    fillBtn.onclick = (e) => {
      e.stopPropagation();
      openPillarPickerForDate(d);
    };
    list.appendChild(fillBtn);
  });

  renderPillarBalance();
}

function openPillarPickerForDate(date) {
  const data = window.ContentPillars ? window.ContentPillars.getData() : null;
  if (!data || !data.buckets.length) {
    openDayNote(date);
    return;
  }
  openDayNote(date);
  const body = document.getElementById('dayPostPreview');
  if (!body) return;
  const existing = body.querySelector('[data-pillars-picker="1"]');
  if (existing) existing.remove();

  const picker = document.createElement('div');
  picker.dataset.pillarsPicker = '1';
  picker.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:12px;';
  const label = document.createElement('div');
  label.style.cssText = 'font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#5a6080);margin-bottom:4px;';
  label.textContent = 'Draft from a pillar';
  picker.appendChild(label);
  data.buckets.forEach(bucket => {
    const seed = (bucket.seeds || []).find(s => String(s || '').trim()) || '';
    const row = document.createElement('button');
    row.className = 'btn sm';
    row.style.cssText = 'justify-content:flex-start;text-align:left;width:100%;margin-bottom:0;';
    row.innerHTML = '' + safeText(bucket.name) + '&nbsp;&nbsp;' + safeText(seed.slice(0, 60) || 'No seeds yet') + '';
    row.onclick = () => {
      if (seed) {
        const dateStr = date.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
        if (window.ContentPillars) {
          window.ContentPillars.insertStarter(bucket, seed, dateStr);
        }
      }
      closeModal('noteModal');
      activateView('composerView');
    };
    picker.appendChild(row);
  });
  body.prepend(picker);
}

function renderPillarBalance() {
  const el = document.getElementById('pillarBalanceBar');
  if (!el) return;
  const data = window.ContentPillars ? window.ContentPillars.getData() : null;
  if (!data || !data.buckets.length) { el.style.display = 'none'; return; }
  let usage = {};
  try { usage = JSON.parse(localStorage.getItem('postiq_pillars_usage_v1') || '{}'); } catch {}
  const total = Object.values(usage).reduce((a, b) => a + b, 0);
  if (total === 0) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'background:var(--surface,#fff);border:1px solid var(--border,#e8eaf2);border-radius:var(--r,12px);padding:14px 16px;margin-bottom:16px;';
  const heading = document.createElement('div');
  heading.style.cssText = 'font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--subtle,#9298b0);margin-bottom:10px;';
  heading.textContent = 'Pillar balance — last ' + total + ' draft' + (total === 1 ? '' : 's');
  wrap.appendChild(heading);
  const colors = ['#3a3fff','#0fa672','#f59e0b','#ff4f6a','#7c3aed','#0ea5e9'];
  data.buckets.forEach((bucket, i) => {
    const count = usage[bucket.id] || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:6px;';
    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:11px;font-family:monospace;color:var(--muted,#5a6080);min-width:64px;';
    nameEl.textContent = bucket.name;
    const track = document.createElement('div');
    track.style.cssText = 'flex:1;height:6px;background:var(--surface3,#f0f2f8);border-radius:3px;overflow:hidden;';
    const fill = document.createElement('div');
    fill.style.cssText = 'height:100%;border-radius:3px;background:' + (colors[i % colors.length]) + ';width:' + pct + '%;transition:width .4s ease;';
    track.appendChild(fill);
    const pctEl = document.createElement('div');
    pctEl.style.cssText = 'font-size:11px;font-family:monospace;color:var(--subtle,#9298b0);min-width:32px;text-align:right;';
    pctEl.textContent = pct + '%';
    row.appendChild(nameEl);
    row.appendChild(track);
    row.appendChild(pctEl);
    wrap.appendChild(row);
  });
  el.appendChild(wrap);
}

function openDayNote(date) {
  state.selectedDate = date;
  const key = fmtDate(date);
  const note = getNotes()[key] || { text: '', tag: 'gold', label: 'Idea' };
  qs('noteDateLabel').textContent = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  qs('noteText').value = note.text || '';
  qs('noteTag').value = `${note.tag || 'gold'}|${note.label || 'Idea'}`;
  const dayPosts = state.scheduled.filter(p => fmtDate(new Date(p.dueAt)) === key);
  qs('dayPostPreview').innerHTML = dayPosts.length
    ? `<div style="font-size:11px;font-family:\'DM Mono\',monospace;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px;">${dayPosts.length} scheduled post${dayPosts.length > 1 ? 's' : ''}</div>${dayPosts.map(p => `<div style="font-size:12px;padding:6px 8px;background:var(--brand-dim);border:1px solid var(--brand-glow);border-radius:5px;color:var(--brand);margin-bottom:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${safeText(p.text || '(no text)')}</div>`).join('')}`
    : `<div style="font-size:12px;color:var(--subtle);margin-bottom:8px;">No posts scheduled on this day.</div>`;
  qs('noteStatus').textContent = '';
  openModal('noteModal');
}

function saveNote() {
  if (!state.selectedDate) return;
  const key = fmtDate(state.selectedDate);
  const text = qs('noteText').value.trim();
  const [tag, label] = qs('noteTag').value.split('|');
  const notes = getNotes();
  if (!text) { delete notes[key]; setNotes(notes); qs('noteStatus').textContent = 'Note removed.'; renderCalendar(); return; }
  notes[key] = { text, tag, label };
  setNotes(notes); qs('noteStatus').textContent = 'Saved.'; renderCalendar();
  showToast('Note saved', 'success');
}

function deleteNote() {
  if (!state.selectedDate) return;
  const notes = getNotes(); delete notes[fmtDate(state.selectedDate)];
  setNotes(notes); qs('noteText').value = ''; qs('noteStatus').textContent = 'Deleted.'; renderCalendar();
  showToast('Note deleted');
}

function sendNoteToDraft() {
  if (!state.selectedDate) return;
  const text = qs('noteText').value.trim();
  if (!text) { qs('noteStatus').textContent = 'Add a note first.'; return; }
  const [, label] = qs('noteTag').value.split('|');
  const editor = qs('composerEditor');
  const payload = `[${label}] ${fmtDate(state.selectedDate)}\n${text}`;
  editor.innerText = editor.innerText ? `${editor.innerText}\n\n${payload}` : payload;
  editor.dispatchEvent(new Event('input'));
  closeModal('noteModal'); activateView('composerView');
  showToast('Note sent to Draft');
}

function renderAgenda() {
  const agenda = qs('calAgenda'); if (!agenda) return;
  const notes = getNotes(); const today = fmtDate(new Date());
  agenda.innerHTML = '';
  const nav = document.createElement('div'); nav.className = 'cal-header';
  nav.innerHTML = `<div class="cal-month-label" style="font-size:18px;">${monthLabel(state.month)}</div>`;
  agenda.appendChild(nav);
  const map = {};
  state.scheduled.forEach(p => { const k = fmtDate(new Date(p.dueAt)); if (!map[k]) map[k] = { posts: [], note: null }; map[k].posts.push(p); });
  Object.entries(notes).forEach(([k, n]) => {
    if (!map[k]) map[k] = { posts: [], note: null }; map[k].note = n;
  });
  const days = [];
  const ms = monthStart(state.month);
  for (let i = 0; i < 35; i++) { const d = new Date(ms.getFullYear(), ms.getMonth(), i + 1); if (d.getMonth() !== ms.getMonth()) break; days.push(fmtDate(d)); }
  days.forEach(key => {
    const data = map[key]; if (!data) return;
    const isToday = key === today;
    const date = new Date(key + 'T00:00:00');
    const dayEl = document.createElement('div');
    dayEl.style.cssText = `border:1px solid ${isToday ? 'var(--brand)' : 'var(--border)'};border-radius:10px;padding:12px;margin-bottom:8px;background:var(--surface);cursor:pointer;`;
    const dateLabel = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;"><span style="font-family:\'DM Mono\',monospace;font-size:11px;font-weight:600;color:${isToday ? 'var(--brand)' : 'var(--muted)'};">${dateLabel}</span>${data.posts.length ? `<span style="font-size:9px;font-family:\'DM Mono\',monospace;background:var(--brand-dim);color:var(--brand);border:1px solid var(--brand-glow);padding:1px 5px;border-radius:3px;">${data.posts.length} post${data.posts.length > 1 ? 's' : ''}</span>` : ''}</div>`;
    data.posts.slice(0, 2).forEach(p => { html += `<div style="font-size:12px;padding:6px 8px;background:var(--brand-dim);border:1px solid var(--brand-glow);border-radius:5px;color:var(--brand);margin-bottom:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${safeText(compact(p.text, 80))}</div>`; });
    if (data.posts.length > 2) html += `<div style="font-size:10px;color:var(--subtle);margin-bottom:4px;">+${data.posts.length - 2} more</div>`;
    if (data.note) html += `<div class="day-note-pill ${data.note.tag || 'gold'}" style="display:block;border-radius:5px;margin-top:4px;">${safeText(compact(data.note.text, 60))}</div>`;
    dayEl.innerHTML = html; dayEl.onclick = () => openDayNote(date);
    agenda.appendChild(dayEl);
  });
  if (!Object.keys(map).length) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.innerHTML = '<div class="empty-icon">📅</div><div class="empty-title">Nothing scheduled</div><div class="empty-desc">Connect Buffer and sync to load your upcoming posts.</div>';
    agenda.appendChild(empty);
  }
}

// Calendar snapshot share
function shareSnapshot() {
  const include = qs('includeNotes').checked;
  const customTitle = qs('shareCustomTitle')?.value.trim() || '';
  const posts = state.scheduled.filter(p => {
    const d = new Date(p.dueAt);
    return d.getFullYear() === state.month.getFullYear() && d.getMonth() === state.month.getMonth();
  });
  const allNotes = getNotes();
  const monthNotes = Object.entries(allNotes)
    .filter(([k]) => {
      const d = new Date(k + 'T00:00:00');
      return d.getFullYear() === state.month.getFullYear() && d.getMonth() === state.month.getMonth();
    })
    .map(([date, val]) => ({ date, ...val }));
  const label = monthLabel(state.month);
  const snapshotId = generateSnapshotId();
  qs('shareMonthName').textContent = label;
  qs('sharePostCount').textContent = posts.length;
  const payload = {
    snapshotId,
    createdAt: Date.now(),
    period: 'month',
    month: label,
    customTitle,
    includeNotes: include,
    posts: posts.map(p => ({
      dueAt: p.dueAt,
      text: p.text || '',
      channelName: p.channelName || p.channel || '',
      platform: p.service || p.platform || '',
      channelId: p.channelId || ''
    })),
    notes: include ? monthNotes : []
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  qs('shareLink').value = `${location.origin}${location.pathname}#share=${snapshotId}.${encoded}`;
}

function openSharedDayDetails(key, data) {
  const titleEl = qs('sharedDayTitle');
  const bodyEl = qs('sharedDayBody');
  if (!titleEl || !bodyEl) return;
  titleEl.textContent = formatDateOnly(key);
  const postsHtml = data.posts.length
    ? `<div style="display:flex;flex-direction:column;gap:12px;">${data.posts.map((p, idx) => `
        <div class="card" style="padding:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
              <span class="chip brand">Post ${idx + 1}</span>
              ${p.platform ? `<span class="chip">${safeText(p.platform)}</span>` : ''}
              ${p.channelName ? `<span class="chip">${safeText(p.channelName)}</span>` : ''}
            </div>
            <span style="font-size:11px;color:var(--subtle);font-family:\'DM Mono\',monospace;">${safeText(formatDateTime(p.dueAt))}</span>
          </div>
          <div style="font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word;color:var(--text);">${safeText(p.text || '(no copy)')}</div>
        </div>
      `).join('')}</div>`
    : `<div class="empty-state" style="padding:20px 16px;"><div class="empty-title">No post scheduled</div><div class="empty-desc">This day does not have a scheduled post in the shared snapshot.</div></div>`;

  const notesHtml = data.notes.length
    ? `<div style="display:flex;flex-direction:column;gap:10px;">${data.notes.map(n => `
        <div class="card" style="padding:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
            <span class="chip ${n.tag === 'green' ? 'green' : 'brand'}">Planning note</span>
            ${n.tag ? `<span style="font-size:11px;color:var(--subtle);font-family:\'DM Mono\',monospace;text-transform:uppercase;">${safeText(n.tag)}</span>` : ''}
          </div>
          <div style="font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word;color:var(--text);">${safeText(n.text || '(empty note)')}</div>
        </div>
      `).join('')}</div>`
    : `<div class="empty-state" style="padding:20px 16px;"><div class="empty-title">No planning notes</div><div class="empty-desc">Nothing was added for this day.</div></div>`;

  bodyEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div>
        <div style="font-family:\'DM Mono\',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">Scheduled posts</div>
        ${postsHtml}
      </div>
      <div>
        <div style="font-family:\'DM Mono\',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">Planning notes</div>
        ${notesHtml}
      </div>
    </div>`;
  openModal('sharedDayModal');
}

function renderSharedFromHash() {
  if (!location.hash.startsWith('#share=')) return false;
  try {
    const raw = location.hash.slice(7);
    const dot = raw.indexOf('.');
    const encoded = dot >= 0 ? raw.slice(dot + 1) : raw;
    const snap = JSON.parse(fromBase64Url(encoded));
    qs('app').classList.add('hidden');
    qs('sharedView').classList.remove('hidden');
    qs('sharedMonthTitle').textContent = snap.customTitle || snap.month || 'Shared snapshot';
    const meta = [];
    if (snap.month) meta.push(snap.month);
    meta.push(`${snap.posts.length} scheduled post${snap.posts.length === 1 ? '' : 's'}`);
    meta.push(`Notes ${snap.includeNotes ? 'included' : 'excluded'}`);
    const sharedMeta = qs('sharedMeta');
    if (sharedMeta) sharedMeta.textContent = meta.join(' · ');
    const sharedBanner = qs('sharedBanner');
    if (sharedBanner) sharedBanner.textContent = `Read-only snapshot · ${snap.snapshotId || 'shared-view'}`;
    const closeBtn = qs('closeSharedDay');
    if (closeBtn) closeBtn.onclick = () => closeModal('sharedDayModal');

    const grid = qs('sharedGrid');
    grid.innerHTML = '';
    const map = {};
    snap.posts.forEach(p => {
      const k = String(p.dueAt || '').slice(0, 10);
      if (!map[k]) map[k] = { posts: [], notes: [] };
      map[k].posts.push(p);
    });
    (snap.notes || []).forEach(n => {
      if (!map[n.date]) map[n.date] = { posts: [], notes: [] };
      map[n.date].notes.push(n);
    });

    let baseDate = new Date();
    if (snap.posts[0]?.dueAt) baseDate = new Date(snap.posts[0].dueAt);
    else if (snap.notes?.[0]?.date) baseDate = new Date(snap.notes[0].date + 'T00:00:00');
    const first = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());

    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = fmtDate(d);
      const data = map[key] || { posts: [], notes: [] };
      const inMonth = d.getMonth() === baseDate.getMonth();
      const day = document.createElement('div');
      day.className = 'cal-day' + (inMonth ? '' : ' other-month');
      day.style.cursor = 'pointer';
      if (!data.posts.length && !data.notes.length) day.style.opacity = inMonth ? '0.9' : '0.35';
      let html = `<div class="day-num">${d.getDate()}</div>`;
      if (data.posts.length) html += `<div class="day-count">${data.posts.length}</div>`;
      data.posts.slice(0, 2).forEach(p => {
        const label = p.channelName || p.platform || 'Scheduled post';
        html += `<div class="day-post-pill" title="${safeText(label)}">${safeText(compact(p.text || '(no copy)', 60))}</div>`;
      });
      if (data.posts.length > 2) html += `<div class="more-indicator">+${data.posts.length - 2} more</div>`;
      data.notes.slice(0, 1).forEach(n => {
        html += `<div class="day-note-pill ${n.tag || 'gold'}">${safeText(compact(n.text || '', 50))}</div>`;
      });
      if (!data.posts.length && !data.notes.length && inMonth) html += `<div class="more-indicator">No plans</div>`;
      day.innerHTML = html;
      day.onclick = () => openSharedDayDetails(key, data);
      grid.appendChild(day);
    }
    return true;
  } catch (err) {
    console.error('Failed to render shared snapshot', err);
    return false;
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
  const res = await callBuffer(mutation, { input });
  const result = res?.data?.createPost;
  if (!result) throw new Error('Empty mutation response.');
  if (result.__typename === 'MutationError') throw new Error(result.message || 'Buffer rejected this post.');
  if (result.__typename !== 'PostActionSuccess') throw Object.assign(new Error(result.message || `Unexpected result: ${result.__typename}`), { code: 'MUTATION_ERROR' });
  return result;
}

function appendScheduled(post) {
  const id = post?.id; if (!id) return;
  if (state.scheduled.some(p => p.id === id)) return;
  state.scheduled = [...state.scheduled, { id, text: post.text || '', dueAt: post.dueAt, channelId: post.channelId }];
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
  // Attach media
  const imgUrl = mediaState.url || '';
  if (imgUrl) {
    if (isVideo(imgUrl)) {
      const entry = { url: imgUrl };
      if (mediaState.videoThumbUrl) entry.thumbnailUrl = mediaState.videoThumbUrl;
      input.assets = { videos: [entry] };
    } else {
      input.assets = { images: [{ url: imgUrl }] };
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
    if (created?.post?.dueAt) { appendScheduled(created.post); renderCalendar(); }
    // Clear
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

  const card = document.createElement('div');
  card.className = 'approval-card';
  card.dataset.draftId = meta.draftId;
  card.dataset.safeId = safeId;

  const borderColor = meta.status === 'approved' ? 'var(--green)' : meta.status === 'changes_requested' ? 'var(--accent)' : 'var(--amber)';

  card.innerHTML = `
    <div class="approval-card-status-bar ${statusClass}"></div>
    <div class="approval-card-header">
      <div class="approval-card-meta">
        <span class="approval-status-badge ${statusClass}">${statusLabel}</span>
        ${platformBadge}
        <span style="font-size:10px;font-family:\'DM Mono\',monospace;color:var(--subtle);">${meta.created_at ? new Date(meta.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : ''}</span>
      </div>
      <button class="btn sm ghost" onclick="approvalRemove('${safeId}')">✕ Remove</button>
    </div>
    <div class="approval-card-body">
      ${meta.image_url ? `<img src="${safeText(meta.image_url)}" alt="Media" style="width:100%;max-height:240px;object-fit:cover;border-radius:8px;border:1px solid var(--border);margin-bottom:12px;display:block;" />` : ''}
      <div class="approval-content-text">${safeText(meta.content || '')}</div>
      ${meta.comments?.length ? `
        <div class="approval-comments">
          <div style="font-size:10px;font-family:\'DM Mono\',monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">Reviewer feedback</div>
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
          ${pubDisabled ? `<div style="font-size:11px;font-family:\'DM Mono\',monospace;color:var(--subtle);margin-bottom:10px;">Publishing unlocks once reviewer responds.</div>` : ''}
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
      <div id="approval-status-${safeId}" style="font-size:12px;color:var(--muted);margin-top:8px;font-family:\'DM Mono\',monospace;min-height:16px;"></div>
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
  if (meta.image_url) { if (isVideo(meta.image_url)) input.assets = { videos: [{ url: meta.image_url }] }; else input.assets = { images: [{ url: meta.image_url }] }; }
  const statusEl = document.getElementById(`approval-status-${safeId}`);
  if (statusEl) statusEl.textContent = 'Sending…';
  try {
    const created = await createPost(input);
    clearApprovalMeta(draftId);
    const msg = action === 'draft' ? 'Draft saved.' : action === 'queue' ? 'Added to queue.' : 'Scheduled.';
    showToast(msg, 'success');
    if (created?.post?.dueAt) { appendScheduled(created.post); renderCalendar(); }
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
    content.innerHTML = `
      <div class="reviewer-card">
        ${platform ? `<div style="font-size:10px;font-family:\'DM Mono\',monospace;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px;border:1px solid var(--border2);border-radius:4px;color:var(--subtle);display:inline-flex;margin-bottom:16px;">${safeText(platform)}</div>` : ''}
        <div style="font-size:15px;line-height:1.75;color:var(--text);white-space:pre-wrap;word-break:break-word;">${safeText(postContent || '')}</div>
        ${imageUrl ? `<img src="${safeText(imageUrl)}" style="width:100%;max-height:360px;object-fit:cover;border-radius:10px;border:1px solid var(--border);margin-top:16px;" />` : ''}
      </div>
      ${comments.length ? `
        <div class="reviewer-card">
          <div style="font-size:11px;font-weight:600;font-family:\'DM Mono\',monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:14px;">Previous comments</div>
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
  if (viewId === 'approvalsView') loadApprovals();
  if (viewId === 'calendarView') renderPillarBalance();
}
window.activateView = activateView;

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
function init() {
  // Reviewer page check
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
  activateView('calendarView');

  // Token management
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

  // Sync
  qs('syncBtn').onclick = () => syncBuffer({ force: true });
  if (bufferToken) syncBuffer();

  // Navigation
  document.querySelectorAll('[data-view]').forEach(b => {
    b.onclick = () => activateView(b.dataset.view);
  });

  // Calendar
  qs('prevMonth').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCalendar(); detectQueueGaps(); };
  qs('nextMonth').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCalendar(); detectQueueGaps(); };
  qs('todayMonth').onclick = () => { state.month = new Date(); renderCalendar(); detectQueueGaps(); };
  qs('closeNote').onclick = () => closeModal('noteModal');
  qs('saveNoteBtn').onclick = saveNote;
  qs('deleteNoteBtn').onclick = deleteNote;
  qs('sendNoteToDraftBtn').onclick = sendNoteToDraft;
  qs('shareMonthBtn').onclick = () => { const t = qs('shareCustomTitle'); if (t && !t.value.trim()) t.value = `${monthLabel(state.month)} snapshot`; shareSnapshot(); openModal('shareModal'); };
  qs('closeShare').onclick = () => closeModal('shareModal');
  qs('includeNotes').onchange = shareSnapshot;
  const shareTitleInput = qs('shareCustomTitle'); if (shareTitleInput) shareTitleInput.oninput = shareSnapshot;
  qs('generateShare').onclick = shareSnapshot;
  qs('copyShare').onclick = () => navigator.clipboard.writeText(qs('shareLink').value || '');

  // Composer
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

  // Template insert
  qs('insertTemplateBtn').onclick = () => { renderTemplatePicker(); openModal('templatePickerModal'); };
  qs('saveAsTemplateBtn').onclick = () => {
    const sel = window.getSelection(); const text = (sel?.toString() || '').trim();
    if (!text) { showToast('Select text in the editor first', 'error'); return; }
    qs('templateBody').value = text; openTemplateModal();
  };

  // Ref pin
  qs('refPinDismiss').onclick = () => { qs('refPin').style.display = 'none'; };

  // Media
  qs('mediaToggleBtn').onclick = () => { qs('mediaPanel').classList.contains('open') ? closeMediaPanel() : openMediaPanel(); };
  qs('mediaToggleOff').onclick = () => { qs('mediaPanel').classList.contains('open') ? closeMediaPanel() : openMediaPanel(); };
  qs('mediaSummaryClear').onclick = () => { clearMedia(); showToast('Media removed'); };
  document.querySelectorAll('.media-tab').forEach(t => t.onclick = () => switchMediaTab(t.dataset.mtab));

  // Upload
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

  // URL media
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

  // Unsplash
  qs('unsplashSearchBtn').onclick = runUnsplashSearch;
  qs('unsplashQuery').addEventListener('keydown', e => { if (e.key === 'Enter') runUnsplashSearch(); });

  // Templates
  qs('newTemplateBtn').onclick = () => openTemplateModal();
  const manageTplBtn = qs('composerManageTemplatesBtn'); if (manageTplBtn) manageTplBtn.onclick = () => activateView('templatesView');
  qs('closeTemplateModal').onclick = () => closeModal('templateModal');
  qs('cancelTemplateBtn').onclick = () => closeModal('templateModal');
  qs('saveTemplateBtn').onclick = saveTemplate;
  qs('closeTemplatePicker').onclick = () => closeModal('templatePickerModal');
  qs('templateSearch').addEventListener('input', e => { state.templateSearch = e.target.value; renderTemplates(); });
  qs('templatePlatformFilter').onchange = e => { state.templatePlatform = e.target.value; renderTemplates(); };
  qs('pickerSearch').addEventListener('input', renderTemplatePicker);
  qs('pickerType').onchange = renderTemplatePicker;

  // Approvals
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

  // ── ZEN MODE ──────────────────────────────────
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

  // Escape key exits zen
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && zenActive) {
      // Only exit zen if no modals are open
      if (!document.querySelector('.modal.open')) { exitZen(); return; }
    }
  }, true); // capture phase so it fires before modal handler

  // Settings
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

  // Modal overlay close
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal.id); });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.modal.open')];
    if (open.length) closeModal(open[open.length - 1].id);
  });

  // Mobile drawer
  function openMobDrawer() {
    // Sync status before opening
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
  // All three "…" menu buttons on mobile view headers open the drawer
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

  // Mobile-only share button for calendar
  const smb = qs('shareMonthBtnMob'); if (smb) smb.onclick = () => { const t = qs('shareCustomTitle'); if (t && !t.value.trim()) t.value = `${monthLabel(state.month)} snapshot`; shareSnapshot(); openModal('shareModal'); };

  // Mobile clear button for composer
  const ccbm = qs('composerClearBtnMob');
  if (ccbm) {
    ccbm.onclick = () => {
      if (editorToText(editor.innerHTML) && !confirm('Clear composer?')) return;
      editor.innerHTML = ''; editor.dispatchEvent(new Event('input'));
      qs('composerStatus').textContent = ''; clearMedia();
    };
  }

  // Keep mob clear button visibility in sync
  editor.addEventListener('input', () => {
    const hasText = !!editorToText(editor.innerHTML);
    const ccbmBtn = qs('composerClearBtnMob'); if (ccbmBtn) ccbmBtn.style.display = hasText ? 'inline-flex' : 'none';
  });

  // Mobile approvals refresh
  const arbm = qs('approvalsRefreshBtnMob'); if (arbm) arbm.onclick = loadApprovals;
  // Mobile new template
  const ntbm = qs('newTemplateBtnMob'); if (ntbm) ntbm.onclick = () => openTemplateModal();

  // Mobile More button — opens drawer
  const mobMoreBtn = qs('mobMoreBtn');
  if (mobMoreBtn) mobMoreBtn.onclick = openMobDrawer;

  // ── COMPOSER MODE TABS (Compose / Split) ──────────────
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

  // ── THREAD SPLITTER ────────────────────────────────────
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
          <span style="font-size:11px;font-family:\'DM Mono\',monospace;color:var(--brand);background:var(--brand-dim);border:1px solid var(--brand-glow);padding:2px 7px;border-radius:4px;">Part ${i+1}</span>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:11px;font-family:\'DM Mono\',monospace;color:${over?'var(--red)':'var(--subtle)'};">${full.length}/280</span>
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

    // Populate channel selector
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
      // Re-populate channels after sync
      const tch = qs('threadChannel'); if (!tch) return;
      tch.innerHTML = '';
      const xChs = state.channels.filter(c => { const s=(c.service||'').toLowerCase(); return s.includes('twitter')||s.includes('thread')||s.includes('x-'); });
      const pool = xChs.length ? xChs : state.channels;
      pool.forEach(c => { const o=document.createElement('option'); o.value=c.id; o.textContent=`${c.displayName||c.name} (${c.service})`; tch.appendChild(o); });
    });
  }

  // ── TRENDING ──────────────────────────────────────────
  const trendingState = { src: 'reddit', sub: 'socialmedia', hn: 'topstories' };
  const DEFAULT_SUBS = ['socialmedia','entrepreneur','marketing','business'];

  function renderSubPills() {
    const wrap = qs('trendingSubPills'); if (!wrap) return;
    wrap.innerHTML = '';
    DEFAULT_SUBS.forEach(sub => {
      const btn = document.createElement('button');
      btn.style.cssText = `padding:5px 12px;border-radius:20px;border:1px solid var(--border2);font-size:12px;font-family:\'DM Mono\',monospace;cursor:pointer;transition:all .12s;background:${trendingState.sub===sub?'var(--brand-dim)':'var(--surface)'};color:${trendingState.sub===sub?'var(--brand)':'var(--muted)'};border-color:${trendingState.sub===sub?'var(--brand-glow)':'var(--border2)'};`;
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
        <div style="font-family:\'DM Mono\',monospace;font-size:11px;color:var(--subtle);width:22px;flex-shrink:0;padding-top:2px;font-weight:600;">${i+1}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:500;color:var(--text);line-height:1.4;margin-bottom:5px;">${safeText(item.title)}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:10px;font-family:\'DM Mono\',monospace;color:var(--amber);font-weight:700;">▲ ${(item.score||0).toLocaleString()}</span>
            <span style="font-size:10px;font-family:\'DM Mono\',monospace;color:var(--subtle);">💬 ${item.comments||0}</span>
            <span style="font-size:10px;font-family:\'DM Mono\',monospace;color:var(--brand);">${safeText(item.sub||'')}</span>
            <span style="font-size:10px;font-family:\'DM Mono\',monospace;color:var(--subtle);">${item.age||''}</span>
          </div>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn sm" style="font-size:11px;" data-inspire="${i}">→ Draft from this</button>
            <a class="btn sm ghost" href="${safeText(item.url)}" target="_blank" rel="noopener" style="font-size:11px;">↗ Source</a>
          </div>
        </div>`;
      el.onmouseenter = () => { el.style.borderColor = 'var(--border2)'; };
      el.onmouseleave = () => { el.style.borderColor = 'var(--border)'; };
      el.querySelector('[data-inspire]').onclick = () => {
        // Pin as reference in composer
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
      renderTrendingItems('trendingRedditList', posts.map((p,i) => ({
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
      renderTrendingItems('trendingHNList', stories.filter(s=>s?.title).map((s,i) => ({
        title: s.title, score: s.score, comments: s.descendants||0,
        sub: s.by ? `by ${s.by}` : 'HN', url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
        age: timeAgo(s.time * 1000),
      })));
    } catch(e) { statusEl.textContent = 'Failed to load Hacker News.'; }
  }

  function initTrending() {
    renderSubPills();

    // Source tabs
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

    // HN sub tabs
    document.querySelectorAll('.trending-hn-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.trending-hn-tab').forEach(t => {
          t.style.background='var(--surface)'; t.style.color='var(--muted)'; t.style.borderColor='var(--border2)';
        });
        tab.style.background='var(--brand-dim)'; tab.style.color='var(--brand)'; tab.style.borderColor='var(--brand-glow)';
        trendingState.hn = tab.dataset.hn; loadHN();
      };
    });

    // Custom sub
    qs('trendingGoSub').onclick = () => {
      const val = qs('trendingCustomSub').value.trim().replace(/^r\//,'');
      if (!val) return;
      if (!DEFAULT_SUBS.includes(val)) DEFAULT_SUBS.push(val);
      trendingState.sub = val; renderSubPills(); loadReddit();
      qs('trendingCustomSub').value = '';
    };
    qs('trendingCustomSub').addEventListener('keydown', e => { if (e.key==='Enter') qs('trendingGoSub').click(); });

    // Refresh buttons
    ['trendingRefreshBtn','trendingRefreshMob','trendingRefreshReddit'].forEach(id => {
      const btn = qs(id); if (btn) btn.onclick = () => { if (trendingState.src==='reddit') loadReddit(); else loadHN(); };
    });
    const hnRefBtn = qs('trendingRefreshHN'); if (hnRefBtn) hnRefBtn.onclick = loadHN;

    // Load on first visit
    loadReddit();
  }

  // Init trending when view activates (lazy)
  let trendingInited = false;
  const origActivateView = activateView;
  window.activateView = function(viewId) {
    origActivateView(viewId);
    if (viewId === 'trendingView' && !trendingInited) { trendingInited = true; initTrending(); }
  };

  // Also update settings guide entry
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

  // Service worker
  if ('serviceWorker' in navigator && location.hostname !== 'localhost' && !location.hostname.includes('claudeusercontent')) {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW:', e));
  }
}



// ── CONTENT PILLARS (SAFE PREVIEW) ───────────────────
window.ContentPillars = (() => {
  const CP_MODE_KEY = 'postiq_pillars_onboarding_v1';
  const CP_DATA_KEY = 'postiq_pillars_builder_v2';
  const CP_USAGE_KEY = 'postiq_pillars_usage_v1';

  const DEFAULT_BUCKETS = [
    { id: 'teach', name: 'Teach', helper: 'what you know', seeds: ['Why local-first apps reduce privacy risk', 'How to explain your process without jargon'] },
    { id: 'share', name: 'Share', helper: 'what you experience', seeds: ['A real lesson from this week', 'A behind-the-scenes moment your audience can relate to'] },
    { id: 'believe', name: 'Believe', helper: 'what you stand for', seeds: ['A belief that guides your work', 'What you wish more people understood'] },
    { id: 'offer', name: 'Offer', helper: 'what you sell', seeds: ['Who your offer helps and why', 'A practical invitation to work with you'] }
  ];

  const EXAMPLE_SETS = {
    saas_founder: {
      identity: 'I am a senior dev building minimalist, local-first tools for creators. My tone is clear, practical, and calm.',
      buckets: [
        { name: 'Teach', helper: 'what you know', seeds: ['Why local-first apps reduce privacy risk', 'How tiny weekly releases beat big quarterly launches'] },
        { name: 'Share', helper: 'what you experience', seeds: ['A bug that taught me a better system', 'What solo building looked like this week'] },
        { name: 'Believe', helper: 'what you stand for', seeds: ['Software should feel like a tool, not a trap', 'Simple UX is a performance feature'] },
        { name: 'Offer', helper: 'what you sell', seeds: ['Who PostIQ is best for', 'What the new pillars flow helps you do faster'] }
      ]
    },
    nurse: {
      identity: 'I am a compassionate nurse focused on practical education and myth-busting. My tone is warm, direct, and encouraging.',
      buckets: [
        { name: 'Teach', helper: 'what you know', seeds: ['How to prep kids for a checkup', 'Early signs burnout is building'] },
        { name: 'Share', helper: 'what you experience', seeds: ['What a long shift taught me today', 'A patient-safe story that changed my approach'] },
        { name: 'Believe', helper: 'what you stand for', seeds: ['Compassion is a clinical skill', 'Advocacy belongs in everyday care'] },
        { name: 'Offer', helper: 'what you sell', seeds: ['My wellness checklist for busy families', 'How to join my next health Q&A'] }
      ]
    },
    teacher: {
      identity: 'I am an educator sharing practical classroom strategies and student-first advocacy. My tone is optimistic and practical.',
      buckets: [
        { name: 'Teach', helper: 'what you know', seeds: ['A low-prep classroom routine that works', 'One strategy for reluctant readers'] },
        { name: 'Share', helper: 'what you experience', seeds: ['A classroom win from this week', 'The real Sunday planning routine'] },
        { name: 'Believe', helper: 'what you stand for', seeds: ['Every student needs a safe adult', 'Confidence should count as progress too'] },
        { name: 'Offer', helper: 'what you sell', seeds: ['What is inside my classroom templates', 'How to join my teacher prep session'] }
      ]
    },
    restaurant: {
      identity: 'I run a scratch kitchen and share practical food stories rooted in local community. My tone is warm and welcoming.',
      buckets: [
        { name: 'Teach', helper: 'what you know', seeds: ['How we build flavor from scratch', 'How we source local ingredients on a budget'] },
        { name: 'Share', helper: 'what you experience', seeds: ['What prep hour looks like before service', 'A Saturday rush story from our team'] },
        { name: 'Believe', helper: 'what you stand for', seeds: ['Why local food businesses matter', 'Why we choose quality over shortcuts'] },
        { name: 'Offer', helper: 'what you sell', seeds: ['Who our seasonal menu is for', 'How to book our patio for events'] }
      ]
    }
  };

  const cpState = {
    mode: null,
    persona: 'saas_founder',
    identity: '',
    buckets: [],
    seedTones: {}
  };

  const cpQsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const cpUid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  function cpCloneDefaultBuckets() {
    return DEFAULT_BUCKETS.map((bucket) => ({ ...bucket, id: cpUid(), seeds: [...bucket.seeds] }));
  }

  function cpNormalizeBuckets(buckets) {
    if (!Array.isArray(buckets) || !buckets.length) return cpCloneDefaultBuckets();
    return buckets.map((bucket) => ({
      id: bucket?.id || cpUid(),
      name: String(bucket?.name || 'Untitled').trim() || 'Untitled',
      helper: String(bucket?.helper || '').trim(),
      seeds: Array.isArray(bucket?.seeds) && bucket.seeds.length
        ? bucket.seeds.map((seed) => String(seed ?? ''))
        : ['']
    }));
  }

  function cpReadMode() {
    try {
      const raw = localStorage.getItem(CP_MODE_KEY);
      return raw === 'beginner' || raw === 'experienced' ? raw : null;
    } catch { return null; }
  }

  function cpWriteMode(mode) { try { localStorage.setItem(CP_MODE_KEY, mode); } catch {} }

  function cpGetUsage() {
    try { return JSON.parse(localStorage.getItem(CP_USAGE_KEY) || '{}'); } catch { return {}; }
  }

  function cpIncrementUsage(bucketId) {
    const usage = cpGetUsage();
    usage[bucketId] = (usage[bucketId] || 0) + 1;
    try { localStorage.setItem(CP_USAGE_KEY, JSON.stringify(usage)); } catch {}
  }

  function cpHasOnlyDefaultBuckets() {
    const ids = DEFAULT_BUCKETS.map((b) => b.id);
    return !cpState.buckets.length || cpState.buckets.every((b) => ids.includes(b.id));
  }

  function cpAutoLoadStarterPersona() {
    if (cpHasOnlyDefaultBuckets()) cpLoadExample('saas_founder');
  }

  function cpReadData() {
    try {
      const raw = localStorage.getItem(CP_DATA_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        identity: String(parsed?.identity || ''),
        buckets: cpNormalizeBuckets(parsed?.buckets),
        seedTones: parsed?.seedTones && typeof parsed.seedTones === 'object' ? parsed.seedTones : {}
      };
    } catch { return null; }
  }

  function cpPersistData() {
    try {
      localStorage.setItem(CP_DATA_KEY, JSON.stringify({
        identity: cpState.identity,
        buckets: cpNormalizeBuckets(cpState.buckets),
        seedTones: cpState.seedTones || {}
      }));
    } catch {}
    cpRenderDraftCompact();
  }

  function cpSetStage(mode) {
    cpState.mode = mode;
    const choice = qs('pillarsChoiceStage');
    const beginner = qs('pillarsBeginnerStage');
    const builder = qs('pillarsBuilderStage');
    if (choice) choice.style.display = mode ? 'none' : 'block';
    if (beginner) beginner.style.display = mode === 'beginner' ? 'block' : 'none';
    if (builder) builder.style.display = mode === 'builder' ? 'block' : 'none';
  }

  function cpSetActivePersonaButton(key) {
    cpQsa('[data-persona]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.persona === key));
  }

  function cpComposeStarter(pillarName, helper, topic, tone) {
    const identity = (cpState.identity || '').trim();
    const voiceLine = identity ? 'Voice: ' + identity + '\n\n' : '';
    let starterLine = 'Here is the clearest way I can explain this:';
    if (tone === 'Story') starterLine = 'Here is a moment that changed how I think about this:';
    if (tone === 'Contrarian') starterLine = 'Unpopular take:';
    if (tone === 'Question') starterLine = 'Quick question for you:';
    return voiceLine + 'Pillar: ' + pillarName + ' — ' + (helper || 'explain this clearly') + '\nTopic: ' + topic + '\n\nDraft starter: ' + starterLine;
  }

  function cpComposeAiPrompt(pillarName, helper, topic) {
    const identity = (cpState.identity || '').trim() || 'A practical creator with a clear point of view';
    return `Voice and point of view: ${identity}
Pillar: ${pillarName}
Helper framing: ${helper || 'Explain this clearly and simply'}
Topic: ${topic}
Task: Write a punchy, authentic social post from this angle. Avoid corporate jargon.`;
  }

  function cpInsertIntoComposer(text) {
    if (typeof window.activateView === 'function') window.activateView('composerView');
    const rich = document.getElementById('composerEditor');
    if (!rich || rich.getAttribute('contenteditable') !== 'true') return false;
    rich.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
    rich.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    return true;
  }

  async function cpCopyText(text) {
    try {
      await safeWriteText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    }
  }

  function cpRenderDraftCompact() {
    const wrap = qs('composerPillarsCompact');
    if (!wrap) return;
    const buckets = cpNormalizeBuckets(cpState.buckets);
    if (!buckets.length) {
      wrap.innerHTML = '<div style="font-size:12px;color:var(--subtle);padding:8px 0;font-family:\'DM Mono\',monospace;">Build your pillars to see quick starters here.</div>';
      return;
    }

    wrap.innerHTML = '';
    const usage = cpGetUsage();
    buckets.slice(0, 4).forEach((bucket) => {
      const card = document.createElement('div');
      card.className = 'composer-pillar-mini';
      card.style.cursor = 'pointer';
      const seed = bucket.seeds.find(Boolean) || '';
      const count = usage[bucket.id] || 0;
      const badge = count === 0 ? '<span style="font-size:10px;font-family:monospace;color:var(--color-text-secondary,#9298b0);border:1px solid var(--color-border-secondary,#d8dce8);padding:1px 6px;border-radius:999px;margin-left:6px;">unused</span>' : '';
      card.innerHTML = `<h4>${safeText(bucket.name)}${badge}</h4><small>${safeText(bucket.helper || '')}</small>`;
      if (seed) {
        const row = document.createElement('div');
        row.className = 'composer-pillar-mini-row';
        row.innerHTML = `<span class="seed-grow" style="font-size:12px;color:var(--muted);">${safeText(seed)}</span>`;
        const btn = document.createElement('button');
        btn.className = 'btn-copy-prompt';
        btn.type = 'button';
        btn.textContent = 'Start';
        const startDraft = () => {
          const wrote = cpInsertIntoComposer(cpComposeStarter(bucket.name, bucket.helper, seed, 'Practical'));
          if (wrote) cpIncrementUsage(bucket.id);
          cpRenderDraftCompact();
          if (typeof window.renderPillarBalance === 'function') window.renderPillarBalance();
          showToast(wrote ? 'Starter added to Draft.' : 'Could not open Draft editor.', wrote ? 'success' : 'error');
        };
        btn.addEventListener('click', (event) => {
          event.stopPropagation();
          startDraft();
        });
        card.addEventListener('click', () => startDraft());
        row.appendChild(btn);
        card.appendChild(row);
      }
      const usageLine = document.createElement('div');
      usageLine.style.cssText = 'font-size:11px;color:var(--color-text-secondary,#9298b0);font-family:monospace;margin-top:4px;';
      usageLine.textContent = count > 0 ? count + ' post' + (count === 1 ? '' : 's') + ' drafted from this pillar' : 'Not used yet';
      card.appendChild(usageLine);
      wrap.appendChild(card);
    });
  }

  function cpRenderBuilder() {
    const container = qs('bucket-container');
    if (!container) return;
    container.innerHTML = '';

    cpNormalizeBuckets(cpState.buckets).forEach((bucket) => {
      const card = document.createElement('article');
      card.className = 'bucket-card';
      card.dataset.bucketId = bucket.id;
      card.innerHTML = `
        <div class="bucket-head">
          <input class="bucket-input" data-cp-field="name" type="text" value="${safeText(bucket.name)}" aria-label="Bucket title" />
          <input class="bucket-input" data-cp-field="helper" type="text" value="${safeText(bucket.helper)}" aria-label="Bucket helper" />
        </div>
      `;

      bucket.seeds.forEach((seed, idx) => {
        const row = document.createElement('div');
        row.className = 'seed-item';
        row.dataset.seedIndex = String(idx);
        row.innerHTML = `
          <input class="seed-input" data-cp-field="seed" type="text" value="${safeText(seed)}" aria-label="Seed idea" />
          <div class="seed-actions">
            <button class="btn-copy-prompt start" type="button" data-cp-action="start">Start</button>
            <button class="btn-copy-prompt copy" type="button" data-cp-action="copy">Copy</button>
            <button class="btn-copy-prompt remove" type="button" data-cp-action="remove-seed">Remove</button>
          </div>
        `;
        const toneKey = bucket.id + ':' + idx;
        const toneSelect = document.createElement('select');
        toneSelect.dataset.cpField = 'tone';
        toneSelect.dataset.toneKey = toneKey;
        toneSelect.style.cssText = 'font-size:11px;padding:3px 6px;border-radius:6px;border:0.5px solid var(--color-border-secondary,#d8dce8);background:var(--color-background-secondary,#f9fafc);color:var(--color-text-secondary,#5a6080);cursor:pointer;margin-top:4px;width:100%;';
        ['Practical','Story','Contrarian','Question'].forEach(t => {
          const o = document.createElement('option');
          o.value = t; o.textContent = t;
          if ((cpState.seedTones[toneKey] || 'Practical') === t) o.selected = true;
          toneSelect.appendChild(o);
        });
        row.appendChild(toneSelect);
        card.appendChild(row);
      });

      const footer = document.createElement('div');
      footer.className = 'bucket-actions';
      footer.innerHTML = `
        <button class="btn sm cp-add-seed" type="button" data-cp-action="add-seed">+ Add seed idea</button>
        <button class="btn sm ghost" type="button" data-cp-action="remove-bucket">Remove bucket</button>
      `;
      card.appendChild(footer);
      container.appendChild(card);
    });
  }

  function cpFindBucket(bucketId) {
    return cpState.buckets.find((bucket) => bucket.id === bucketId);
  }

  function cpLoadExample(key) {
    const data = EXAMPLE_SETS[key];
    if (!data) return;
    cpState.persona = key;
    cpState.identity = data.identity;
    cpState.buckets = data.buckets.map((bucket) => ({ id: cpUid(), name: bucket.name, helper: bucket.helper, seeds: [...bucket.seeds] }));
    cpState.seedTones = {};
    const identityEl = qs('global-identity');
    if (identityEl) identityEl.value = cpState.identity;
    cpSetActivePersonaButton(key);
    cpRenderBuilder();
    cpPersistData();
  }

  async function cpHandleBuilderAction(action, bucketId, seedIndex) {
    const bucket = cpFindBucket(bucketId);
    if (!bucket) return;

    if (action === 'add-seed') {
      bucket.seeds.push('');
      cpRenderBuilder();
      cpPersistData();
      return;
    }

    if (action === 'remove-bucket') {
      cpState.buckets = cpState.buckets.filter((b) => b.id !== bucketId);
      cpRenderBuilder();
      cpPersistData();
      return;
    }

    if (typeof seedIndex !== 'number' || seedIndex < 0) return;
    const topic = String(bucket.seeds[seedIndex] || '').trim();
    const pillar = String(bucket.name || 'Pillar').trim() || 'Pillar';
    const helper = String(bucket.helper || '').trim();

    if (action === 'remove-seed') {
      bucket.seeds.splice(seedIndex, 1);
      if (!bucket.seeds.length) bucket.seeds.push('');
      cpRenderBuilder();
      cpPersistData();
      return;
    }

    if (!topic) {
      showToast('Add a seed idea first.', 'error');
      return;
    }

    if (action === 'start') {
      const tone = cpState.seedTones[bucketId + ':' + seedIndex] || 'Practical';
      const wrote = cpInsertIntoComposer(cpComposeStarter(pillar, helper, topic, tone));
      if (wrote) cpIncrementUsage(bucketId);
      cpRenderDraftCompact();
      if (typeof window.renderPillarBalance === 'function') window.renderPillarBalance();
      showToast(wrote ? 'Starter added to Draft.' : 'Could not open Draft editor.', wrote ? 'success' : 'error');
      return;
    }

    if (action === 'copy') {
      const copied = await cpCopyText(cpComposeAiPrompt(pillar, helper, topic));
      showToast(copied ? 'Prompt copied.' : 'Could not copy prompt.', copied ? 'success' : 'error');
    }
  }

  function cpHandleChoice(mode) {
    if (mode !== 'beginner' && mode !== 'experienced') return;
    cpWriteMode(mode);
    if (mode === 'experienced') {
      cpSetStage('builder');
      cpAutoLoadStarterPersona();
      cpRenderBuilder();
    } else {
      cpSetStage('beginner');
    }
  }

  function cpResetOnboarding() {
    try { localStorage.removeItem(CP_MODE_KEY); } catch {}
    cpSetStage(null);
  }

  function cpResetDefaults() {
    cpState.buckets = cpCloneDefaultBuckets();
    cpRenderBuilder();
    cpPersistData();
  }

  function init() {
    const root = qs('pillars-section');
    if (!root) {
      const data = cpReadData();
      cpState.identity = data?.identity || '';
      cpState.buckets = cpNormalizeBuckets(data?.buckets);
      cpState.seedTones = data?.seedTones || {};
      cpRenderDraftCompact();
      return;
    }

    const persisted = cpReadData();
    cpState.identity = persisted?.identity || '';
    cpState.buckets = cpNormalizeBuckets(persisted?.buckets);
    cpState.seedTones = persisted?.seedTones || {};

    const identityEl = qs('global-identity');
    if (identityEl) {
      identityEl.value = cpState.identity;
      identityEl.addEventListener('input', (e) => {
        cpState.identity = e.target.value;
        cpPersistData();
      });
    }

    root.addEventListener('click', (event) => {
      const choiceBtn = event.target.closest('[data-pillars-choice]');
      if (choiceBtn) {
        cpHandleChoice(choiceBtn.dataset.pillarsChoice);
        return;
      }

      const actionBtn = event.target.closest('[data-cp-action]');
      if (actionBtn) {
        const card = actionBtn.closest('[data-bucket-id]');
        const row = actionBtn.closest('[data-seed-index]');
        const bucketId = card?.dataset.bucketId;
        const seedIndex = row ? Number(row.dataset.seedIndex) : null;
        cpHandleBuilderAction(actionBtn.dataset.cpAction, bucketId, seedIndex);
      }
    });

    root.addEventListener('input', (event) => {
      const field = event.target.dataset.cpField;
      if (!field) return;
      const card = event.target.closest('[data-bucket-id]');
      const bucket = cpFindBucket(card?.dataset.bucketId);
      if (!bucket) return;

      if (field === 'name') bucket.name = event.target.value;
      if (field === 'helper') bucket.helper = event.target.value;
      if (field === 'seed') {
        const row = event.target.closest('[data-seed-index]');
        const idx = row ? Number(row.dataset.seedIndex) : -1;
        if (idx >= 0) bucket.seeds[idx] = event.target.value;
      }
      if (field === 'tone') {
        const toneKey = event.target.dataset.toneKey;
        if (toneKey) cpState.seedTones[toneKey] = event.target.value || 'Practical';
      }
      cpPersistData();
    });

    const addBucketBtn = qs('pillarsAddBucketBtn');
    if (addBucketBtn) addBucketBtn.addEventListener('click', () => {
      cpState.buckets.push({ id: cpUid(), name: 'New bucket', helper: 'what this pillar is for', seeds: [''] });
      cpRenderBuilder();
      cpPersistData();
    });

    const resetDefaultsBtn = qs('pillarsResetDefaultsBtn');
    if (resetDefaultsBtn) resetDefaultsBtn.addEventListener('click', cpResetDefaults);

    const buildBtn = qs('pillarsBuildBtn');
    if (buildBtn) buildBtn.addEventListener('click', () => { cpSetStage('builder'); cpAutoLoadStarterPersona(); cpRenderBuilder(); });

    const resetBtn = qs('pillarsResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', cpResetOnboarding);

    const loadExamplesBtn = qs('pillarsLoadExamplesBtn');
    const picker = qs('persona-picker');
    if (loadExamplesBtn && picker) {
      loadExamplesBtn.addEventListener('click', () => {
        const open = picker.style.display !== 'none';
        picker.style.display = open ? 'none' : 'flex';
      });
    }

    cpQsa('[data-persona]').forEach((btn) => {
      btn.addEventListener('click', () => cpLoadExample(btn.dataset.persona));
    });

    const mode = cpReadMode();
    if (!mode) cpSetStage(null);
    else if (mode === 'experienced') { cpSetStage('builder'); cpRenderBuilder(); }
    else cpSetStage('beginner');

    cpRenderDraftCompact();
  }

  return {
    init,
    getData: () => ({ identity: cpState.identity, buckets: cpNormalizeBuckets(cpState.buckets), seedTones: { ...cpState.seedTones } }),
    insertStarter: (bucket, seed, dateLabel) => {
      const name = String(bucket?.name || 'Pillar');
      const helper = String(bucket?.helper || 'explain this clearly');
      const topic = String(seed || '').trim();
      if (!topic) return false;
      const starter = `Date: ${dateLabel}\n` + cpComposeStarter(name, helper, topic, 'Practical');
      const wrote = cpInsertIntoComposer(starter);
      if (wrote && bucket?.id) cpIncrementUsage(bucket.id);
      cpRenderDraftCompact();
      if (typeof window.renderPillarBalance === 'function') window.renderPillarBalance();
      return wrote;
    },
    renderDraftCompact: cpRenderDraftCompact
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  // Keep view switching alive even if a later init block crashes.
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-view]');
    if (!trigger || !trigger.dataset.view) return;
    if (trigger.tagName === 'A' && trigger.hasAttribute('href')) return;
    e.preventDefault();
    if (typeof window.activateView === 'function') window.activateView(trigger.dataset.view);
  });

  try { init(); } catch (e) { console.error('[PostIQ] init() crashed:', e); }
});
