'use strict';
// Campaigns & newsletters — date-range planning items on the calendar.
// Style B: the covered days get a subtle tint, the start day shows a labelled
// pill, the end day shows an end marker. Each item carries stages you tick off
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
  // Campaigns covering a given day, each with its role for that day.
  function forDate(key) {
    return load().filter(c => c.start && c.end && key >= c.start && key <= c.end).map(c => ({
      c, role: c.start === c.end ? 'single' : key === c.start ? 'start' : key === c.end ? 'end' : 'mid',
    }));
  }

  // HTML added inside a calendar day cell (pills on start/end).
  function cellHtml(key) {
    const items = forDate(key);
    if (!items.length) return '';
    return items.map(({ c, role }) => {
      const color = colorFor(c);
      const done = (c.stages || []).filter(s => s.done).length, total = (c.stages || []).length;
      if (role === 'mid') return '';
      const title = esc(c.title || TYPES[c.type]?.label || 'Campaign');
      const tag = role === 'end' ? '◆ ends' : (total ? `${done}/${total}` : '');
      return `<button type="button" class="campaign-pill is-${role}" style="--camp:${esc(color)}" data-campaign="${esc(c.id)}" title="${title} · ${esc(c.start)}–${esc(c.end)}"><span class="campaign-pill-dot" aria-hidden="true"></span><span class="campaign-pill-label">${title}</span>${tag ? `<span class="campaign-pill-tag">${esc(tag)}</span>` : ''}</button>`;
    }).join('');
  }
  // Does any campaign cover this day? (drives the cell tint class)
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
    el('campDelete').addEventListener('click', () => { if (editingId) { remove(editingId); closeModal('campaignModal'); if (typeof renderCalendar === 'function') renderCalendar(); } });
    el('campClose').addEventListener('click', () => closeModal('campaignModal'));
    // Click a campaign pill anywhere on the calendar to edit it.
    document.addEventListener('click', e => { const pill = e.target.closest('[data-campaign]'); if (pill) { e.stopPropagation(); open(pill.dataset.campaign); } });
  }

  return { init, open, list, get, cellHtml, covers, forDate };
})();
