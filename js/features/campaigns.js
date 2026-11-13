'use strict';
// Campaigns & newsletters — date-range planning items on the calendar.
// Each range is a band across its days: solid and labelled on the first and
// last day, a quiet tint in between. Each item carries stages you tick off
// (Plan → Draft → Final → Publish → …). One mechanism serves newsletter issues
// and campaign ranges. These are local planning items; they never touch Buffer.
window.PostIQCampaigns = (() => {
  const KEY = 'postiq_campaigns_v1';
  const el = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => 'camp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const TYPES = {
    newsletter: { label: 'Newsletter', color: '#6366f1', stages: ['Plan', 'Draft', 'Final', 'Publish', 'Substack note'] },
    campaign: { label: 'Campaign', color: '#a855f7', stages: ['Plan', 'Build', 'Launch', 'Wrap'] },
  };

  function load() { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} window.dispatchEvent(new Event('postiq:campaigns-changed')); }
  function list() { return load(); }
  function get(id) { return load().find(c => c.id === id) || null; }
  function remove(id) { save(load().filter(c => c.id !== id)); }
  function upsert(c) {
    const l = load(); const i = l.findIndex(x => x.id === c.id);
    if (i >= 0) l[i] = c; else l.push(c);
    save(l);
  }
  function defaultStages(type) { return (TYPES[type] || TYPES.campaign).stages.map(label => ({ label, done: false })); }
  function colorFor(c) { return c.color || TYPES[c.type]?.color || '#6366f1'; }

  const dayKey = v => window.PostIQCoverage.dayKey(v);
  const sorted = () => load().filter(c => c.start && c.end && c.end >= c.start).sort((x, y) => x.start.localeCompare(y.start) || y.end.localeCompare(x.end) || String(x.id).localeCompare(String(y.id)));
  // Campaigns covering a given day, each with its role for that day.
  function forDate(key) {
    return sorted().filter(c => key >= c.start && key <= c.end).map(c => ({
      c, role: c.start === c.end ? 'single' : key === c.start ? 'start' : key === c.end ? 'end' : 'mid',
    }));
  }
  // Each campaign keeps one lane (row) for the whole week it's drawn in, so its
  // band lines up from cell to cell even when another range starts or ends
  // mid-week. Lanes are worked out per week row, so a range that ended last
  // week doesn't leave an empty row behind.
  const addDays = (key, n) => window.PostIQCoverage.addDays(key, n);
  function lanes(rowStart = null) {
    const rowEnd = rowStart ? addDays(rowStart, 6) : null;
    const list = sorted().filter(c => !rowStart || (c.start <= rowEnd && c.end >= rowStart));
    const laneEnds = [], out = new Map();
    for (const c of list) {
      const from = rowStart && c.start < rowStart ? rowStart : c.start;
      let lane = laneEnds.findIndex(end => end < from);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = c.end; out.set(c.id, lane);
    }
    return out;
  }
  const progress = c => { const st = c.stages || []; return { done: st.filter(x => x.done).length, total: st.length, next: st.find(x => !x.done)?.label || '' }; };
  const nameOf = c => c.title || TYPES[c.type]?.label || 'Campaign';

  // Bands inside a calendar day cell. The first and last day are solid and
  // labelled; the days between are a quiet tint of the same colour, so a
  // range reads as one stretch of work. rowStart/rowEnd: the cell is the first
  // or last of its week row, where the band is capped and (mid-range) relabelled.
  function cellHtml(key, { rowStart = false, rowEnd = false, rowKey = null } = {}) {
    const items = forDate(key);
    if (!items.length) return '';
    const laneOf = lanes(rowKey);
    const byLane = [];
    items.forEach(it => { byLane[laneOf.get(it.c.id) ?? 0] = it; });
    const html = [];
    for (let lane = 0; lane < byLane.length; lane++) {
      const it = byLane[lane];
      if (!it) { html.push('<span class="camp-band is-empty" aria-hidden="true"></span>'); continue; }
      const { c, role } = it;
      const name = esc(nameOf(c));
      const p = progress(c);
      const range = `${esc(c.start)} to ${esc(c.end)}`;
      const status = p.total ? `${p.done} of ${p.total} stages done${p.next ? `, next: ${esc(p.next)}` : ''}` : '';
      let inner = '';
      if (role === 'start' || role === 'single') inner = `<span class="camp-band-label">${name}</span>${p.total ? `<span class="camp-band-tag">${p.done}/${p.total}</span>` : ''}`;
      else if (role === 'end') inner = `<span class="camp-band-label">${p.done === p.total && p.total ? '✓ ' : ''}${esc(TYPES[c.type]?.label === 'Newsletter' ? 'Sends' : 'Ends')}</span>`;
      else if (rowStart) inner = `<span class="camp-band-label is-quiet">${name}</span>`;
      const cls = `camp-band is-${role}${rowStart ? ' is-row-start' : ''}${rowEnd ? ' is-row-end' : ''}${p.total && p.done === p.total ? ' is-done' : ''}`;
      html.push(`<button type="button" class="${cls}" style="--camp:${esc(colorFor(c))}" data-campaign="${esc(c.id)}" title="${name} · ${range}${status ? ' · ' + status : ''}" aria-label="${name}, ${role === 'mid' ? 'in progress' : role === 'end' ? 'last day' : 'first day'}, ${range}${status ? ', ' + status : ''}">${inner}</button>`);
    }
    return `<div class="camp-bands">${html.join('')}</div>`;
  }
  // Rows for the day drawer: what's running that day and where it stands.
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
  const shortDay = key => new Date(key + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  // Where a day sits in its range: "Day 3 of 5", "Send day · 5 of 5".
  function dayInRange(c, key) {
    const total = daysBetween(c.start, c.end) + 1, n = daysBetween(c.start, key) + 1;
    if (total === 1) return c.type === 'newsletter' ? 'Send day' : 'One day';
    if (n === total) return `${c.type === 'newsletter' ? 'Send day' : 'Last day'} · ${n} of ${total}`;
    return `Day ${n} of ${total} · ${c.type === 'newsletter' ? 'sends' : 'ends'} ${shortDay(c.end)}`;
  }
  function detailHtml(key, { heading = true } = {}) {
    const items = forDate(key);
    if (!items.length) return '';
    return `<div class="day-camp-list">${heading ? '<div class="day-cov-head">Newsletters and campaigns</div>' : ''}${items.map(({ c }) => {
      const p = progress(c);
      return `<button type="button" class="day-camp-row" style="--camp:${esc(colorFor(c))}" data-campaign="${esc(c.id)}"><span class="day-camp-dot" aria-hidden="true"></span><span class="day-camp-name">${esc(nameOf(c))}</span><span class="day-camp-meta">${esc(dayInRange(c, key))}${p.total ? ` · ${p.done}/${p.total}${p.next ? ` · next: ${esc(p.next)}` : ''}` : ''}</span></button>`;
    }).join('')}</div>`;
  }
  // Does any campaign cover this day?
  function covers(key) { return forDate(key).length > 0; }

  // ── Editor modal ──────────────────────────────────────────
  let editingId = null;
  function renderStages(stages) {
    const mount = el('campStages'); if (!mount) return;
    mount.innerHTML = stages.map((s, i) => `<li class="camp-stage"><label><input type="checkbox" data-stage-done="${i}" ${s.done ? 'checked' : ''}> <input type="text" class="input camp-stage-label" data-stage-label="${i}" value="${esc(s.label)}"></label><button type="button" class="btn sm ghost" data-stage-remove="${i}" aria-label="Remove stage">✕</button></li>`).join('');
    mount.querySelectorAll('[data-stage-remove]').forEach(b => b.addEventListener('click', () => { stages.splice(Number(b.dataset.stageRemove), 1); renderStages(stages); }));
    mount.querySelectorAll('[data-stage-done]').forEach(cb => cb.addEventListener('change', () => { stages[Number(cb.dataset.stageDone)].done = cb.checked; }));
    mount.querySelectorAll('[data-stage-label]').forEach(inp => inp.addEventListener('input', () => { stages[Number(inp.dataset.stageLabel)].label = inp.value; }));
  }
  let draftStages = [];
  function open(id = null, prefillDate = null) {
    if (!el('campaignModal')) return;
    editingId = id;
    const c = id ? get(id) : null;
    el('campaignModalTitle').textContent = c ? 'Edit' : 'Plan a campaign or newsletter';
    el('campType').value = c?.type || 'newsletter';
    el('campTitle').value = c?.title || '';
    el('campStart').value = c?.start || prefillDate || dayKey(new Date());
    el('campEnd').value = c?.end || prefillDate || dayKey(new Date());
    draftStages = c ? (c.stages || []).map(s => ({ ...s })) : defaultStages(el('campType').value);
    renderStages(draftStages);
    el('campDelete').hidden = !c;
    el('campDelete').dataset.confirm = ''; el('campDelete').textContent = 'Delete'; el('campDelete').classList.remove('danger');
    el('campStatus').textContent = '';
    openModal('campaignModal');
  }
  function onTypeChange() {
    // Only reset stages to the template when creating fresh (not editing).
    if (!editingId) { draftStages = defaultStages(el('campType').value); renderStages(draftStages); }
  }
  function saveFromForm() {
    const title = el('campTitle').value.trim();
    const type = el('campType').value, start = el('campStart').value, end = el('campEnd').value;
    if (!title) { el('campStatus').textContent = 'Give it a title.'; return; }
    if (!start || !end || end < start) { el('campStatus').textContent = 'Choose a start and end (end on or after start).'; return; }
    const c = { id: editingId || uid(), type, title, start, end, color: TYPES[type]?.color, stages: draftStages.filter(s => s.label.trim()).map(s => ({ label: s.label.trim(), done: !!s.done })) };
    upsert(c);
    closeModal('campaignModal');
    if (typeof renderCalendar === 'function') renderCalendar();
  }

  function init() {
    if (!el('campaignModal')) return;
    el('campType').addEventListener('change', onTypeChange);
    el('campAddStage').addEventListener('click', () => { draftStages.push({ label: '', done: false }); renderStages(draftStages); });
    el('campSave').addEventListener('click', saveFromForm);
    // Delete asks once inline (no browser dialog), then offers Undo.
    el('campDelete').addEventListener('click', () => {
      if (!editingId) return;
      const btn = el('campDelete');
      if (btn.dataset.confirm !== '1') { btn.dataset.confirm = '1'; btn.textContent = 'Delete for good?'; btn.classList.add('danger'); return; }
      const removed = get(editingId);
      remove(editingId); closeModal('campaignModal');
      if (typeof renderCalendar === 'function') renderCalendar();
      const undo = () => { upsert(removed); if (typeof renderCalendar === 'function') renderCalendar(); };
      if (removed && window.PostIQDrag?.actionToast) window.PostIQDrag.actionToast(`Deleted “${nameOf(removed)}”`, { onAction: undo });
      else if (removed && typeof showToast === 'function') showToast(`Deleted “${nameOf(removed)}”`);
    });
    el('campClose').addEventListener('click', () => closeModal('campaignModal'));
    // Click a campaign pill anywhere on the calendar to edit it.
    document.addEventListener('click', e => { const pill = e.target.closest('[data-campaign]'); if (pill) { e.stopPropagation(); open(pill.dataset.campaign); } });
  }

  return { init, open, list, get, cellHtml, detailHtml, covers, forDate, lanes };
})();
