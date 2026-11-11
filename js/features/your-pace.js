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
        channelReshare: { ...settings.channelReshare, [id]: !!el('schedReshare').checked },
      }, 'Schedule saved.');
    } catch (error) { message(error.message); }
  }

  // ── Evergreen reshare / "fill my break" ──────────────────
  // Queues kept Shelf posts into Buffer on the exact empty posting days of the
  // time-off range, at each channel's usual time. Same planner as Runway's break
  // fill: each kept post goes out at most once per channel, and nothing doubles
  // up with what Buffer already has. (This used to use addToQueue, which put the
  // reshares in Buffer's next open slots, usually before the break even began.)
  let pendingFill = null;
  function planFill() {
    const status = el('schedFillStatus'), confirmBtn = el('schedFillConfirm');
    confirmBtn.hidden = true; pendingFill = null;
    try {
      const dates = offPeriod();
      const settings = getPlanningSettings();
      if (!(state.channels || []).some(c => settings.channelReshare?.[String(c.id)])) { status.textContent = 'Turn on reshares for at least one channel first (the checkbox above).'; return; }
      const fill = window.PostIQSuite?.planBreakFill?.(dates.start, dates.end, { ignoreDaysOff: true });
      if (!fill) { status.textContent = 'Reshare planning isn’t available right now. Try Runway.'; return; }
      if (fill.stale) { status.textContent = 'Sync Buffer first, so nothing doubles up with posts already queued.'; return; }
      if (!fill.items.length) {
        status.textContent = fill.short.length
          ? 'Everything you’ve kept on your Shelf is already queued on these channels. Keep more past posts first.'
          : fill.mediaOnly.length ? 'Those channels need a photo or video, so they can’t be filled with text reshares.'
          : 'Those days are already covered, or no posting days fall in that range for your reshare channels.';
        return;
      }
      pendingFill = fill.items;
      const n = fill.items.length;
      status.textContent = `Ready to queue ${n} reshare${n === 1 ? '' : 's'}, each on an empty posting day between ${dates.start} and ${dates.end} at that channel’s usual time.${fill.short.length ? ' Some days stay open because each kept post goes out once per channel.' : ''}`;
      confirmBtn.hidden = false;
    } catch (error) { status.textContent = error.message; }
  }
  async function runFill() {
    const status = el('schedFillStatus'), confirmBtn = el('schedFillConfirm');
    if (!pendingFill || !pendingFill.length) { planFill(); return; }
    const plan = pendingFill; pendingFill = null; confirmBtn.hidden = true; confirmBtn.disabled = true;
    status.textContent = `Queuing ${plan.length}…`;
    let ok = 0, fail = 0;
    for (const item of plan) {
      try {
        const created = await createPost({ channelId: item.channelId, text: item.text, mode: 'customScheduled', dueAt: item.dueAt, schedulingType: 'automatic' });
        ok++; if (created?.post?.dueAt && typeof appendScheduled === 'function') appendScheduled(created.post, item);
      } catch (e) { fail++; console.error('[PostIQ reshare]', e); }
    }
    confirmBtn.disabled = false;
    status.textContent = `Queued ${ok} reshare${ok === 1 ? '' : 's'}${fail ? `, ${fail} couldn't be queued` : ''}. Your existing Buffer posts are unchanged.`;
    window.dispatchEvent(new Event('postiq:scheduled-updated'));
    renderCalendar(); window.PostIQPlanHealth?.render();
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
    const reshare = el('schedReshare'); if (reshare) { reshare.checked = !!settings.channelReshare?.[id]; reshare.disabled = !id; }
  }

  function renderExceptions() {
    const settings = getPlanningSettings(), mount = el('schedExceptions');
    if (!mount) return;
    mount.innerHTML = '';
    // Days off are the kept planning exception. Legacy period targets, if any
    // remain from earlier versions, are shown so they can be removed.
    const chLabel = id => {
      if (id === '*') return 'All channels';
      const ch = (state.channels || []).find(c => String(c.id) === String(id));
      return window.PostIQChannelIcons && ch ? window.PostIQChannelIcons.label(ch) : safeText(channelName(id));
    };
    const rows = [];
    (settings.daysOff || []).forEach((entry, index) => rows.push({ kind: 'daysOff', entry, index, label: `${chLabel(entry.channelId)} · ${safeText(entry.start)}–${safeText(entry.end)} · time off` }));
    (settings.targetOverrides || []).forEach((entry, index) => rows.push({ kind: 'targetOverrides', entry, index, label: `${chLabel(entry.channelId)} · ${safeText(entry.start)}–${safeText(entry.end)} · ${entry.target} posts/day (legacy)` }));
    if (!rows.length) { mount.hidden = true; return; }
    mount.hidden = false;
    const head = document.createElement('h3'); head.textContent = 'Planned time off'; head.className = 'sched-exceptions-title'; mount.appendChild(head);
    rows.forEach(({ kind, entry, index, label }) => {
      const row = document.createElement('div'); row.className = 'sched-exception';
      const text = document.createElement('span'); text.innerHTML = label;
      const button = document.createElement('button'); button.className = 'btn sm ghost'; button.type = 'button'; button.textContent = 'Remove';
      button.setAttribute('aria-label', 'Remove this planned time off');
      button.onclick = () => { const next = getPlanningSettings(); next[kind] = (next[kind] || []).filter((item, i) => entry.id ? item.id !== entry.id : i !== index); save(next, 'Removed.'); };
      row.append(text, button); mount.appendChild(row);
    });
  }

  function refresh(forceRhythm = false) {
    if (!initialized) return;
    const select = el('schedChannel'); if (!select) return;
    const previous = select.value;
    select.innerHTML = (state.channels.length ? '' : '<option value="">No channels loaded</option>')
      + (state.channels || []).map(c => `<option value="${safeText(c.id)}">${safeText(c.displayName || c.name || c.id)}${c.service ? ' · ' + safeText(c.service) : ''}</option>`).join('');
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
    el('schedFill').onclick = planFill;
    el('schedFillConfirm').onclick = runFill;
    ['schedOffStart', 'schedOffEnd'].forEach(id => el(id)?.addEventListener('input', () => { pendingFill = null; const c = el('schedFillConfirm'); if (c) c.hidden = true; }));
    el('schedClose').onclick = () => closeModal('scheduleModal');
    window.addEventListener('postiq:synced', () => refresh());
    window.addEventListener('postiq:planning-changed', () => refresh(true));
    refresh(true);
  }

  return { init, open, refresh };
})();
