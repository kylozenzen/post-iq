'use strict';

// ── CHANNEL SELECTS ──────────────────────────────────
function renderChannelSelects() {
  const sel = qs('composerChannel'); if (!sel) return;
  sel.innerHTML = '';
  const noChannels = qs('composerNoChannels');
  if (state.channels.length) {
    state.channels.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = `${c.displayName || c.name} (${c.service})`; sel.appendChild(o);
    });
    if (noChannels) noChannels.style.display = 'none'; sel.style.display = '';
  } else {
    if (noChannels) noChannels.style.display = 'block'; sel.style.display = 'none';
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
function platformIdentity(post) {
  const raw = String(postPlatformLabel(post) || postChannelLabel(post) || 'Social post').trim();
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const platforms = [
    { match: ['twitter', 'x', 'xcom'], key: 'x', label: 'X', mark: 'X' },
    { match: ['linkedin'], key: 'linkedin', label: 'LinkedIn', mark: 'in' },
    { match: ['instagram'], key: 'instagram', label: 'Instagram', mark: '◎' },
    { match: ['facebook', 'facebookpage'], key: 'facebook', label: 'Facebook', mark: 'f' },
    { match: ['threads', 'threadsnet'], key: 'threads', label: 'Threads', mark: '@' },
    { match: ['tiktok'], key: 'tiktok', label: 'TikTok', mark: '♪' },
    { match: ['youtube', 'youtubeshorts'], key: 'youtube', label: 'YouTube', mark: '▶' },
    { match: ['pinterest'], key: 'pinterest', label: 'Pinterest', mark: 'P' },
    { match: ['bluesky'], key: 'bluesky', label: 'Bluesky', mark: '◇' },
    { match: ['mastodon'], key: 'mastodon', label: 'Mastodon', mark: 'M' }
  ];
  return platforms.find(item => item.match.includes(key)) || { key: 'social', label: raw || 'Social post', mark: '•' };
}
function platformLogoHtml(post) {
  const platform = platformIdentity(post);
  return `<span class="platform-logo platform-${platform.key}" role="img" aria-label="${safeText(platform.label)}" title="${safeText(platform.label)}"><span aria-hidden="true">${safeText(platform.mark)}</span></span>`;
}
function calendarPostPillHtml(post, dataAttribute, dateKey, limit) {
  const platform = platformIdentity(post);
  const published = isPublishedPost(post);
  const statusLabel = published ? 'Published' : 'Scheduled';
  return `<button type="button" class="day-post-pill${published ? ' is-published' : ''}" ${dataAttribute}="${safeText(dateKey)}" title="${safeText(statusLabel)} · ${safeText(platform.label)} · ${safeText(compact(post.text, 120))}">${platformLogoHtml(post)}<span class="day-post-status" aria-hidden="true">${published ? '✓' : '◷'}</span><span class="day-post-copy">${safeText(compact(post.text, limit))}</span></button>`;
}
function snapshotPostPayload(p) {
  const planningAt = getPostPlanningAt(p);
  return {
    dueAt: planningAt, dateKey: fmtDate(planningAt), sentAt: p.sentAt || null, externalLink: p.externalLink || '',
    text: p.text || '', status: isPublishedPost(p) ? 'sent' : 'scheduled',
    channelName: postChannelLabel(p), platform: postPlatformLabel(p), channelId: p.channelId || '',
    mediaUrls: getPostMediaUrls(p)
  };
}

function renderCalendar() {
  qs('monthLabel').textContent = monthLabel(state.month);
  renderCalendarFilter();
  const grid = qs('calGrid'); grid.innerHTML = '';
  const week = qs('calWeek'); if (week) week.innerHTML = '';
  const first = monthStart(state.month);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const notes = getNotes();
  const today = fmtDate(new Date());
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = fmtDate(d);
    const inMonth = d.getMonth() === state.month.getMonth();
    const allDayPosts = postsForDateKey(key);
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
    dayPosts.slice(0, 2).forEach(p => { html += calendarPostPillHtml(p, 'data-post-detail', key, 60); });
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
  renderWeekView();
  updateCalendarViewUI();
}

function weekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function renderWeekView() {
  const weekEl = qs('calWeek'); if (!weekEl) return;
  const notes = getNotes();
  const start = weekStart(state.month);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  weekEl.innerHTML = `<div class="cal-week-hdr"><div class="cal-week-range">${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div><div class="cal-week-controls"><button class="btn sm ghost" id="prevWeek">‹ Prev week</button><button class="btn sm ghost" id="nextWeek">Next week ›</button></div></div>`;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = fmtDate(d);
    const allDayPosts = postsForDateKey(key);
    const allDayNotes = getNotesForDate(key, notes);
    const dayPosts = calendarFilterAllowsPosts() ? allDayPosts : [];
    const dayNotes = calendarFilterNotes(allDayNotes);
    const card = document.createElement('div');
    card.className = `cal-week-day${key === fmtDate(new Date()) ? ' today' : ''}${dayPosts.length ? ' has-posts' : ''}`;
    let html = `<div class="cal-week-day-title"><span class="cal-week-day-name">${d.toLocaleDateString(undefined,{ weekday:'short'})}</span><div class="cal-week-day-title-right"><strong class="cal-week-day-date">${d.toLocaleDateString(undefined,{ month:'short', day:'numeric'})}</strong><button type="button" class="day-add-note-btn" data-add-note-date="${key}" aria-label="Add note for ${safeText(formatDateWithYear(d))}">+</button></div></div><div class="cal-week-day-summary">${dayPosts.length ? plannerDaySummary(dayPosts) : 'Open day'}${dayNotes.length ? ` · ${dayNotes.length} note${dayNotes.length === 1 ? '' : 's'}` : ''}</div>`;
    if (!dayPosts.length && !dayNotes.length) html += `<div class="cal-week-empty">No posts or notes</div>`;
    dayPosts.forEach(p => { html += calendarPostPillHtml(p, 'data-week-post', key, 110); });
    dayNotes.forEach(note => { const meta = getNoteTypeMeta(note); html += `<button type="button" class="day-note-pill" data-week-note="${safeText(note.id)}" style="${notePillStyle(meta)}">${safeText(compact(note.text, 70))}</button>`; });
    card.innerHTML = html;
    card.querySelectorAll('[data-week-post]').forEach(el => el.addEventListener('click', ev => { ev.stopPropagation(); openCalendarPostDetails(key, allDayPosts, allDayNotes); }));
    card.querySelectorAll('[data-week-note]').forEach(el => el.addEventListener('click', ev => { ev.stopPropagation(); openEditNoteForDate(d, el.dataset.weekNote); }));
    card.onclick = () => openCalendarDayDetails(d);

    // Bind add-note buttons same as month view
    card.querySelectorAll('[data-add-note-date]').forEach(el => {
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        openNewNoteForDate(d);
      });
    });

    weekEl.appendChild(card);
  }
  on('prevWeek', 'click', () => { state.month = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7); renderCalendar(); detectQueueGaps(); });
  on('nextWeek', 'click', () => { state.month = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7); renderCalendar(); detectQueueGaps(); });
}
function setCalendarView(view) {
  state.calendarView = view === 'week' ? 'week' : 'month';
  localStorage.setItem(CALENDAR_VIEW_KEY, state.calendarView);
  updateCalendarViewUI();
  safeTrack(() => GA4_Calendar.viewModeChanged(state.calendarView));
}
function updateCalendarViewUI() {
  const isWeek = state.calendarView === 'week';
  const calendarRoot = qs('calendarView');
  if (calendarRoot) {
    calendarRoot.classList.toggle('is-week-view', isWeek);
    calendarRoot.classList.toggle('is-month-view', !isWeek);
  }
  qs('calGrid')?.style.setProperty('display', isWeek ? 'none' : 'grid');
  qs('calWeek')?.style.setProperty('display', isWeek ? 'grid' : 'none');
  qs('calendarViewMonthBtn')?.classList.toggle('active', !isWeek);
  qs('calendarViewWeekBtn')?.classList.toggle('active', isWeek);
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
  const dayPosts = postsForDateKey(key);
  const noteCount = getNotesForDate(key).length;
  qs('dayPostPreview').innerHTML = `<div style="font-size:12px;color:var(--subtle);margin-bottom:8px;">${dayPosts.length} post${dayPosts.length === 1 ? '' : 's'} · ${noteCount} existing note${noteCount === 1 ? '' : 's'}</div>`;
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
  if (existingIdx < 0) safeTrack(() => GA4_Calendar.noteAdded(['note', 'idea', 'reminder'].includes(typeMeta.id) ? typeMeta.id : 'note'));
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
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
  updateComposerClearButtonVisibility();
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
  getPlannerPosts().forEach(p => { const k = fmtDate(getPostPlanningAt(p)); if (!k) return; if (!map[k]) map[k] = { posts: [], notes: [] }; map[k].posts.push(p); });
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
    posts.slice(0, 2).forEach(p => { const published = isPublishedPost(p); html += `<button type="button" class="day-post-preview-btn${published ? ' is-published' : ''}" data-agenda-post="${key}">${published ? '✓ ' : ''}${safeText(compact(p.text, 80))}</button>`; });
    if (posts.length > 2) html += `<div style="font-size:10px;color:var(--subtle);margin-bottom:4px;">+${posts.length - 2} more</div>`;
    filteredNotes.slice(0, 2).forEach(note => { const meta = getNoteTypeMeta(note); html += `<div class="day-note-pill" style="display:block;border-radius:5px;margin-top:4px;${notePillStyle(meta)}">${safeText(compact(note.text, 60))}</div>`; });
    if (filteredNotes.length > 2) html += `<div style="font-size:10px;color:var(--subtle);margin-top:4px;">+${filteredNotes.length - 2} notes</div>`;
    dayEl.innerHTML = html;
    dayEl.querySelectorAll('[data-agenda-post]').forEach(btn => btn.addEventListener('click', ev => { ev.stopPropagation(); openCalendarPostDetails(key, raw.posts, raw.notes); }));
    dayEl.onclick = () => openCalendarDayDetails(date);
    agenda.appendChild(dayEl);
  });
  if (!Object.keys(map).length) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.innerHTML = '<div class="empty-icon">📅</div><div class="empty-title">Nothing planned</div><div class="empty-desc">Connect Buffer and sync to load published and upcoming posts.</div>';
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
  const posts = getPlannerPosts().filter(p => inRange(getPostPlanningAt(p)));
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
  safeTrack(() => GA4_Calendar.snapshotCreated({ range: qs('shareRange')?.value || 'month', channelCount: state.channels.length, postCount: getPlannerPosts().length }));
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
    safeTrack(() => GA4_Calendar.snapshotLinkCopied());
    safeTrack(() => GA4_Calendar.snapshotShared('copy_link'));
  } else {
    showShareCopyError();
  }
}


function postDetailCardsHtml(posts) {
  return posts.map((p, idx) => {
    const platform = postPlatformLabel(p) || postChannelLabel(p);
    const channel = postChannelLabel(p);
    const published = isPublishedPost(p);
    const statusLabel = published ? 'Published' : 'Scheduled';
    const externalLink = toSafeExternalUrl(p.externalLink);
    return `<div class="snap-modal-post${published ? ' is-published' : ''}">
      <div class="snap-modal-post-hdr">
        <div class="snap-modal-post-meta">
          <span class="snap-post-num">Post ${idx + 1}</span>
          ${platform ? '<span class="snap-platform-badge">' + safeText(platform) + '</span>' : ''}
          ${channel && channel !== platform ? '<span class="snap-platform-badge">' + safeText(channel) + '</span>' : ''}
          <span class="snap-platform-badge${published ? ' is-published' : ''}">${statusLabel}</span>
        </div>
        <span class="snap-scheduled-time">${safeText(formatDateTime(getPostPlanningAt(p)))}</span>
      </div>
      <div class="snap-modal-post-body">${safeText(p.text || '(no copy)')}</div>
      ${mediaPreviewHtml(p)}
      <div class="snap-modal-post-copy">
        <button class="btn sm ghost" data-copy="${safeText(p.text || '')}">Copy post</button>
        ${externalLink ? `<a class="btn sm ghost" href="${safeText(externalLink)}" target="_blank" rel="noopener">View post ↗</a>` : ''}
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
  const posts = postsForDateKey(key);
  const notes = getNotesForDate(key);
  const titleEl = qs('sharedDayTitle');
  const bodyEl = qs('sharedDayBody');
  if (!titleEl || !bodyEl) return;
  titleEl.textContent = formatDateOnly(key);
  const sections = [];
  if (posts.length) sections.push(`<div style="margin-bottom:16px;"><div class="post-detail-label">${posts.length} post${posts.length > 1 ? 's' : ''}</div>${postDetailCardsHtml(posts)}</div>`);
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
    sections.push(`<div style="margin-bottom:16px;"><div class="post-detail-label">${data.posts.length} post${data.posts.length > 1 ? 's' : ''}</div>${postDetailCardsHtml(data.posts)}</div>`);
  } else {
    sections.push('<div class="empty-state" style="padding:20px 16px 10px;"><div class="empty-title">No post on this day</div><div class="empty-desc">This day does not have a published or scheduled post in this calendar.</div></div>');
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
    data.posts.slice(0,2).forEach(post => { const published = isPublishedPost(post); inner += '<div class="day-post-pill' + (published ? ' is-published' : '') + '">' + (published ? '✓ ' : '') + safeText((post.text||'').slice(0,60)) + '</div>'; });
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
      if (countEl.parentElement) countEl.parentElement.innerHTML = '<strong id="sharedPostCount">' + posts.length + '</strong> post' + (posts.length === 1 ? '' : 's');
    }
    const noteEl = qs('sharedSnapshotNote');
    if (noteEl) {
      if (snap.message) {
        noteEl.textContent = snap.message;
      } else if (!hasPosts && hasNotes) {
        noteEl.textContent = 'This snapshot mainly contains planning notes for the selected range.';
      } else if (!hasPosts) {
        noteEl.textContent = 'This shared view does not include posts or planning notes for the selected range.';
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
    posts.forEach(p => { const k = p.dateKey || fmtDate(p.dueAt); if (!k) return; if (!map[k]) map[k]={posts:[],notes:[]}; map[k].posts.push(p); });
    notes.forEach(n => { if (!n.date) return; if (!map[n.date]) map[n.date]={posts:[],notes:[]}; map[n.date].notes.push(n); });
    renderSharedCalendarGrid({ ...snap, posts, notes }, map);
    return true;
  } catch(err) {
    renderSharedErrorView(err);
    return true;
  }
}
