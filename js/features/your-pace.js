'use strict';
// Posting schedule modal. A view over the existing planning settings and shared
// coverage model. No Buffer writes — these are local planning choices only.
window.YourPace = (() => {
  const C = window.PostIQCoverage;
  const el = id => document.getElementById(id);
  let initialized = false;
  const today = () => C.dayKey(new Date());
  const channelName = id => state.channels.find(c => String(c.id) === String(id))?.displayName
    || state.channels.find(c => String(c.id) === String(id))?.name || id;

  function message(text) { const m = el('schedStatus'); if (m) m.textContent = text; }

  function validDate(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return false;
    const date = new Date(key + 'T12:00:00Z');
    return Number.isFinite(+date) && date.toISOString().slice(0, 10) === key;
  }

  function offPeriod() {
    const start = el('schedOffStart').value, end = el('schedOffEnd').value;
    const days = Math.round((Date.parse(end + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / 86400000) + 1;
    if (!validDate(start) || !validDate(end) || days < 1 || days > 92) throw new Error('Choose a valid date range of 1–92 days.');
    if (start < today()) throw new Error('Time off must start today or later.');
    return { start, end };
  }

  function target() {
    const raw = el('schedTarget').value;
    if (raw === '' || !Number.isInteger(Number(raw)) || Number(raw) < 0 || Number(raw) > 10) {
      throw new Error('Choose a whole number from 0 to 10 posts per selected day.');
    }
    return Number(raw);
  }

  function selectedChannel() {
    const id = el('schedChannel').value;
    if (!id) throw new Error('Connect Buffer and sync to load a channel first.');
    return id;
  }

  function save(settings, text) {
    try {
      setPlanningSettings(settings);
      if (typeof renderPlanningSettings === 'function') renderPlanningSettings();
      renderCalendar();
      window.PostIQPlanHealth?.render();
      refresh(true);
      message(text + ' Your Buffer posts have not changed.');
    } catch (error) { message('Could not save: ' + error.message); }
  }

  function saveSchedule() {
    try {
      const id = selectedChannel(), settings = getPlanningSettings();
      const days = [...el('schedDays').querySelectorAll('input:checked')].map(i => i.value);
      save({
        ...settings,
        channelPostingDays: { ...settings.channelPostingDays, [id]: days },
        channelTargets: { ...settings.channelTargets, [id]: target() },
      }, 'Schedule saved.');
    } catch (error) { message(error.message); }
  }

  function saveDaysOff() {
    try {
      const dates = offPeriod(), settings = getPlanningSettings();
      const id = el('schedOffScope').value === '*' ? '*' : selectedChannel();
      const entry = { id: 'off_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), channelId: id, start: dates.start, end: dates.end };
      save({ ...settings, daysOff: [...(settings.daysOff || []), entry] }, 'Time off saved.');
    } catch (error) { message(error.message); }
  }

  function loadRhythm() {
    const settings = getPlanningSettings(), id = el('schedChannel').value;
    const days = settings.channelPostingDays?.[id] ?? settings.postingDays;
    el('schedDays').innerHTML = DAY_CODES.map((code, index) =>
      `<label><input type="checkbox" value="${code}" ${!id ? 'disabled' : ''} ${days.includes(code) ? 'checked' : ''}>${DAY_LABELS[index].slice(0, 3)}</label>`).join('');
    el('schedTarget').value = Number.isInteger(settings.channelTargets?.[id]) ? settings.channelTargets[id] : 1;
  }

  function renderExceptions() {
    const settings = getPlanningSettings(), mount = el('schedExceptions');
    if (!mount) return;
    mount.innerHTML = '';
    // Days off are the kept planning exception. Legacy period targets, if any
    // remain from earlier versions, are shown so they can be removed.
    const rows = [];
    (settings.daysOff || []).forEach((entry, index) => rows.push({ kind: 'daysOff', entry, index, label: `${entry.channelId === '*' ? 'All channels' : channelName(entry.channelId)} · ${entry.start}–${entry.end} · time off` }));
    (settings.targetOverrides || []).forEach((entry, index) => rows.push({ kind: 'targetOverrides', entry, index, label: `${channelName(entry.channelId)} · ${entry.start}–${entry.end} · ${entry.target} posts/day (legacy)` }));
    if (!rows.length) { mount.hidden = true; return; }
    mount.hidden = false;
    const head = document.createElement('h3'); head.textContent = 'Planned time off'; head.className = 'sched-exceptions-title'; mount.appendChild(head);
    rows.forEach(({ kind, entry, index, label }) => {
      const row = document.createElement('div'); row.className = 'sched-exception';
      const text = document.createElement('span'); text.textContent = label;
      const button = document.createElement('button'); button.className = 'btn sm ghost'; button.type = 'button'; button.textContent = 'Remove';
      button.setAttribute('aria-label', 'Remove ' + label);
      button.onclick = () => { const next = getPlanningSettings(); next[kind] = (next[kind] || []).filter((item, i) => entry.id ? item.id !== entry.id : i !== index); save(next, 'Removed.'); };
      row.append(text, button); mount.appendChild(row);
    });
  }

  function refresh(forceRhythm = false) {
    if (!initialized) return;
    const select = el('schedChannel'); if (!select) return;
    const previous = select.value;
    select.innerHTML = (state.channels.length ? '' : '<option value="">No channels loaded</option>')
      + (state.channels || []).map(c => `<option value="${safeText(c.id)}">${safeText(c.displayName || c.name || c.id)}</option>`).join('');
    if ([...select.options].some(o => o.value === previous)) select.value = previous;
    for (const id of ['schedSave', 'schedChannel', 'schedTarget']) { const n = el(id); if (n) n.disabled = !select.value; }
    const hint = el('schedChannelHint'); if (hint) hint.hidden = !!select.value;
    const scoped = el('schedOffScope')?.querySelector('[value="selected"]'); if (scoped) scoped.disabled = !select.value;
    if (forceRhythm || select.value !== previous) loadRhythm();
    renderExceptions();
  }

  function open() {
    if (!el('scheduleModal')) return;
    refresh(true);
    if (!el('schedOffStart').value) el('schedOffStart').value = today();
    if (!el('schedOffEnd').value) el('schedOffEnd').value = C.addDays(today(), 6);
    message('');
    openModal('scheduleModal');
  }

  function init() {
    if (initialized || !el('scheduleModal')) return;
    initialized = true;
    el('schedChannel').onchange = loadRhythm;
    el('schedSave').onclick = saveSchedule;
    el('schedOffSave').onclick = saveDaysOff;
    el('schedClose').onclick = () => closeModal('scheduleModal');
    window.addEventListener('postiq:synced', () => refresh());
    window.addEventListener('postiq:planning-changed', () => refresh(true));
    refresh(true);
  }

  return { init, open, refresh };
})();
