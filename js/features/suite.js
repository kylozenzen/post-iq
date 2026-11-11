'use strict';
// Runway (internally "suite"): how far ahead you are, reached from the calendar
// header or the sidebar. Uses the same coverage model the calendar uses.
//   1. Channels: connection health, days until each queue runs out, and the
//      posting schedule (days, posts per day, Shelf reshares) edited inline.
//   2. Break planner: week-by-week coverage for a date range, and an optional
//      fill that queues Shelf reshares on the exact empty days. That fill is
//      the only Buffer write here, and it always previews first.
window.PostIQSuite = (() => {
  const HORIZON_DAYS = 120;   // runway lookahead for the channel list
  const MAX_BREAK_DAYS = 365; // break planner never looks further than this
  const el = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cov = () => window.PostIQCoverage;
  const todayKey = () => cov().dayKey(new Date());
  const channels = () => (Array.isArray(state?.channels) ? state.channels : []);
  const rowName = c => c.displayName || c.name || 'Buffer channel';
  const channelName = c => window.PostIQChannelIcons?.plainName?.(c) || rowName(c);
  const serviceLabel = service => (service && window.PostIQChannelIcons?.tag?.(service)) || service;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  function fmt(key, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
    try { return new Date(key + 'T12:00:00').toLocaleDateString(undefined, opts); } catch { return key; }
  }
  function daysBetween(a, b) {
    return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
  }

  // Turns a runwayInfo result into the words and tone shown on a channel row.
  function describeRunway(info) {
    switch (info.state) {
      case 'gap':
        return {
          tone: info.days <= 2 ? 'warn' : 'ok',
          text: info.days === 0 ? 'Runs out today' : `Runs out in ${plural(info.days, 'day')}`,
          sub: `First empty posting day: ${fmt(info.date)}`,
        };
      case 'covered':
        return { tone: 'ok', text: `Covered ${info.days}+ days`, sub: 'Queued through the planning horizon' };
      case 'stale':
        return { tone: 'warn', text: 'Queue data out of date', sub: 'Sync to refresh this number' };
      case 'disconnected':
        return { tone: 'warn', text: 'Not connected', sub: 'Reconnect Buffer to see this channel' };
      case 'incomplete':
        return { tone: 'muted', text: 'Not enough data yet', sub: 'Sync to load this channel’s queue' };
      default:
        return { tone: 'muted', text: 'No posting days set', sub: 'Pick posting days below' };
    }
  }

  // Per-channel runway for the list view.
  function channelRunways(rows, today) {
    return channels().map(c => {
      const info = cov().runwayInfo(rows, String(c.id), today);
      return { id: String(c.id), name: rowName(c), service: serviceLabel(c.service || ''), info, view: describeRunway(info) };
    });
  }

  // Week-by-week plan for a break. Weeks start on the first day of the range.
  // Each cell counts posts planned in that week and how many are already queued.
  function breakPlan(rows, startKey, endKey) {
    const weeks = [];
    for (let s = startKey; s <= endKey; s = cov().addDays(s, 7)) {
      const e = cov().addDays(s, 6);
      weeks.push({ start: s, end: e > endKey ? endKey : e });
    }
    const byChannel = new Map();
    rows.forEach(r => {
      if (!byChannel.has(r.channelId)) byChannel.set(r.channelId, []);
      byChannel.get(r.channelId).push(r);
    });
    let missingTotal = 0;
    const lines = channels().map(c => {
      const mine = byChannel.get(String(c.id)) || [];
      const cells = weeks.map(w => {
        let planned = 0, covered = 0;
        mine.forEach(r => {
          if (r.date < w.start || r.date > w.end || r.target <= 0) return;
          planned += r.target;
          covered += Math.min(r.target, r.confirmedCount);
        });
        return { planned, covered, missing: planned - covered };
      });
      const missing = cells.reduce((n, cell) => n + cell.missing, 0);
      missingTotal += missing;
      return { id: String(c.id), name: rowName(c), service: serviceLabel(c.service || ''), cells, missing };
    });
    return { weeks, lines, missingTotal, channelsShort: lines.filter(l => l.missing > 0).length };
  }

  function isSuiteActive() {
    return document.getElementById('suiteView')?.classList.contains('active');
  }

  function setNotice(message, sync = false) {
    const box = el('suiteNotice');
    if (!box) return;
    box.hidden = !message;
    box.innerHTML = message ? `<span>${esc(message)}</span>${sync ? ' <button class="btn sm" type="button" data-suite-sync>Sync now</button>' : ''}` : '';
  }

  const DAY_CODES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const DAY_LETTER = { MON: 'M', TUE: 'T', WED: 'W', THU: 'T', FRI: 'F', SAT: 'S', SUN: 'S' };
  const DAY_NAME = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' };

  // Connection health for one channel, from Buffer's own channel flags.
  function channelHealth(c) {
    if (c.isDisconnected) return { tone: 'warn', text: 'Disconnected in Buffer', fix: true };
    if (c.isLocked) return { tone: 'warn', text: 'Locked in Buffer', fix: true };
    return { tone: 'ok', text: 'Connected', fix: false };
  }

  // A channel's schedule, falling back to the account-wide defaults.
  function scheduleFor(id, settings = getPlanningSettings()) {
    const explicit = Array.isArray(settings.channelPostingDays?.[id]);
    const days = explicit ? settings.channelPostingDays[id] : (settings.postingDays || DAY_CODES);
    const raw = settings.channelTargets?.[id];
    return { days, explicit, target: Number.isInteger(raw) ? raw : 1, reshare: !!settings.channelReshare?.[id] };
  }

  function saveSchedule(id, patch) {
    const settings = getPlanningSettings();
    const current = scheduleFor(id, settings);
    const next = { ...current, ...patch };
    setPlanningSettings({
      ...settings,
      channelPostingDays: { ...settings.channelPostingDays, [id]: DAY_CODES.filter(d => next.days.includes(d)) },
      channelTargets: { ...settings.channelTargets, [id]: next.target },
      channelReshare: { ...settings.channelReshare, [id]: next.reshare },
    });
    try { if (typeof renderPlanningSettings === 'function') renderPlanningSettings(); } catch {}
    try { if (typeof renderCalendar === 'function') renderCalendar(); } catch {}
    try { window.PostIQPlanHealth?.render(); } catch {}
    render();
  }

  function scheduleHtml(id) {
    const sch = scheduleFor(id);
    const days = DAY_CODES.map(d => {
      const on = sch.days.includes(d);
      return `<button type="button" class="suite-day${on ? ' is-on' : ''}" data-suite-day="${d}" aria-pressed="${on}" aria-label="${DAY_NAME[d]}" title="${DAY_NAME[d]}">${DAY_LETTER[d]}</button>`;
    }).join('');
    return `
      <div class="suite-schedule" data-suite-channel="${esc(id)}">
        <div class="suite-days" role="group" aria-label="Posting days">${days}</div>
        <label class="suite-target">Posts per day <input type="number" min="0" max="10" step="1" value="${sch.target}" data-suite-target /></label>
        <label class="suite-reshare"><input type="checkbox" data-suite-reshare ${sch.reshare ? 'checked' : ''} /> Fill gaps from Shelf</label>
        ${sch.explicit ? '' : '<span class="suite-default-hint">Using your default days</span>'}
      </div>`;
  }

  function renderChannels(today) {
    const mount = el('suiteChannels');
    if (!mount) return;
    const connection = (typeof getBufferConnectionState === 'function' && getBufferConnectionState()) || { connected: false };
    if (!connection.connected) { mount.innerHTML = ''; return; }
    const list = channels();
    if (!list.length) { mount.innerHTML = '<p class="suite-empty">No channels loaded yet. Sync to load them from Buffer.</p>'; return; }
    const rows = getQueueCoverage(HORIZON_DAYS).rows;
    mount.innerHTML = channelRunways(rows, today).map(r => {
      const c = list.find(x => String(x.id) === r.id) || {};
      const health = channelHealth(c);
      const tone = health.tone === 'warn' ? 'warn' : r.view.tone;
      return `
      <div class="suite-channel suite-tone-${tone}">
        <div class="suite-channel-head">
          <div class="suite-channel-name">
            <strong>${esc(r.name)}</strong>
            ${r.service ? `<span class="suite-service">${esc(r.service)}</span>` : ''}
            <span class="suite-health suite-health-${health.tone}"><span class="suite-health-dot" aria-hidden="true"></span>${esc(health.text)}</span>
            ${health.fix ? '<a class="suite-fix" href="https://publish.buffer.com/" target="_blank" rel="noopener">Fix in Buffer ↗</a>' : ''}
          </div>
          <div class="suite-channel-status">
            <span class="suite-runway">${esc(r.view.text)}</span>
            <span class="suite-runway-sub">${esc(r.view.sub)}</span>
          </div>
        </div>
        ${scheduleHtml(r.id)}
      </div>`;
    }).join('');
  }

  function renderBreak(today) {
    const startInput = el('suiteBreakStart');
    const endInput = el('suiteBreakEnd');
    const summary = el('suiteBreakSummary');
    const grid = el('suiteBreakGrid');
    if (!startInput || !endInput || !grid) return;
    if (!startInput.value) startInput.value = cov().addDays(today, 1);
    if (!endInput.value) endInput.value = cov().addDays(today, 14);
    let start = startInput.value < today ? today : startInput.value;
    let end = endInput.value < start ? start : endInput.value;
    const maxEnd = cov().addDays(today, MAX_BREAK_DAYS - 1);
    if (end > maxEnd) end = maxEnd;
    startInput.value = start;
    endInput.value = end;

    const days = daysBetween(today, end) + 1;
    const plan = breakPlan(getQueueCoverage(days).rows, start, end);
    if (!channels().length) { grid.innerHTML = ''; summary.textContent = ''; return; }

    summary.textContent = plan.missingTotal === 0
      ? `Every channel stays covered from ${fmt(start)} to ${fmt(end)}.`
      : `Queue ${plural(plan.missingTotal, 'more post')} across ${plural(plan.channelsShort, 'channel')} before you leave, so nothing goes quiet from ${fmt(start)} to ${fmt(end)}.`;

    const head = plan.weeks.map(w => `<th scope="col">${esc(fmt(w.start, { month: 'short', day: 'numeric' }))}–${esc(fmt(w.end, { month: 'short', day: 'numeric' }))}</th>`).join('');
    const body = plan.lines.map(line => `
      <tr>
        <th scope="row">${esc(line.name)}${line.service ? ` <span class="suite-service">${esc(line.service)}</span>` : ''}</th>
        ${line.cells.map(cell => {
          if (cell.planned === 0) return '<td class="suite-cell suite-cell-off" title="No posts planned">—</td>';
          const ok = cell.missing === 0;
          const title = ok ? `${cell.covered} of ${cell.planned} posts queued` : `${cell.missing} post${cell.missing === 1 ? '' : 's'} still to queue`;
          return `<td class="suite-cell ${ok ? 'suite-cell-ok' : 'suite-cell-gap'}" title="${esc(title)}">${cell.covered}/${cell.planned}</td>`;
        }).join('')}
      </tr>`).join('');
    grid.innerHTML = `<thead><tr><th scope="col">Channel</th>${head}</tr></thead><tbody>${body}</tbody>`;
    renderFill(plan, start, end);
  }

  // ── Fill a break from Shelf ─────────────────────────────
  // Plans one reshare per missing post, on the exact empty day, at the
  // channel's usual posting time. Only channels with "Fill gaps from Shelf" on.
  const MAX_FILL = 50;
  let pendingFill = null;
  let filling = false;

  function planBreakFill(start, end, { ignoreDaysOff = false } = {}) {
    const T = window.PostIQToday;
    const settings = getPlanningSettings();
    const reshareIds = new Set(channels().map(c => String(c.id)).filter(id => settings.channelReshare?.[id]));
    const coverage = getQueueCoverage(daysBetween(todayKey(), end) + 1, { ignoreDaysOff });
    const gaps = coverage.rows.filter(r => r.date >= start && r.date <= end && r.status === 'gap' && r.missingCount > 0);
    const skipped = new Set();
    const mediaOnly = new Set();
    const short = new Map(); // channelId → slots left open because the Shelf ran out
    const items = [];
    const used = new Map(); // channelId → texts already planned this run
    for (const r of gaps) {
      if (!reshareIds.has(r.channelId)) { skipped.add(r.channelId); continue; }
      if (T?.needsMedia?.(r.channelId)) { mediaOnly.add(r.channelId); continue; }
      const base = T?.slotTime ? T.slotTime(r.date, r.channelId) : null;
      if (!base) continue; // too late today
      const taken = used.get(r.channelId) || [];
      for (let i = 0; i < r.missingCount && items.length < MAX_FILL; i++) {
        const when = new Date(base.getTime() + i * 3 * 3600 * 1000);
        if (cov().dayKey(when) !== r.date) break;
        // Each kept post goes out at most once per channel per fill, and never
        // on a channel that already has it queued.
        const next = T?.candidates ? T.candidates(r.channelId, { exclude: taken })[0] : null;
        if (!next) { short.set(r.channelId, (short.get(r.channelId) || 0) + (r.missingCount - i)); break; }
        taken.push(next.text);
        items.push({ channelId: r.channelId, date: r.date, dueAt: when.toISOString(), text: next.text });
      }
      used.set(r.channelId, taken);
    }
    return { items, stale: !!coverage.stale, skipped: [...skipped], mediaOnly: [...mediaOnly], short: [...short], capped: items.length >= MAX_FILL, reshareCount: reshareIds.size };
  }

  function shelfCount() {
    // How many past posts are kept on the Shelf (what a fill can reshare).
    try {
      const starred = new Set(JSON.parse(localStorage.getItem('postiq_library_starred_v1') || '[]'));
      const cache = JSON.parse(localStorage.getItem('postiq_library_cache_v3') || '{}');
      return (Array.isArray(cache.posts) ? cache.posts : []).filter(p => starred.has(p.id) && String(p.text || '').trim()).length;
    } catch { return 0; }
  }

  function renderFill(plan, start, end) {
    const box = el('suiteFill');
    if (!box) return;
    if (filling) return;
    pendingFill = null;
    if (!channels().length || plan.missingTotal === 0) { box.innerHTML = ''; return; }
    const fill = planBreakFill(start, end);
    let msg = '', action = '';
    if (fill.stale) msg = 'Sync before filling, so nothing doubles up with posts Buffer already has.';
    else if (!fill.reshareCount) msg = 'Turn on “Fill gaps from Shelf” for a channel above to fill these with reshares.';
    else if (!shelfCount()) msg = 'Keep a few posts on your Shelf first. Those are what get reshared.';
    else if (!fill.items.length && fill.mediaOnly.length && !fill.short.length) msg = 'Those channels need a photo or video, so their gaps can’t be filled with text reshares. Write new posts for them.';
    else if (!fill.items.length && fill.short.length) msg = 'Everything you’ve kept on your Shelf is already queued on these channels. Keep more past posts to fill the break.';
    else if (!fill.items.length) msg = 'None of the open slots are on channels set to fill from Shelf.';
    else {
      pendingFill = fill.items;
      const per = new Map();
      fill.items.forEach(i => per.set(i.channelId, (per.get(i.channelId) || 0) + 1));
      const names = [...per].map(([id, n]) => `${channelName(channels().find(c => String(c.id) === id) || {})} ×${n}`).join(', ');
      msg = `Fill ${plural(fill.items.length, 'open slot')} with Shelf reshares (${names}), each on its empty day at that channel's usual time. Posts already in Buffer don't change.`;
      if (fill.capped) msg += ` That's the most per run; run it again for the rest.`;
      if (fill.skipped.length) msg += ` ${plural(fill.skipped.length, 'channel')} with gaps ${fill.skipped.length === 1 ? 'is' : 'are'} set not to fill.`;
      const shortBy = fill.short.reduce((n, [, k]) => n + k, 0);
      if (shortBy) msg += ` ${plural(shortBy, 'slot')} stay${shortBy === 1 ? 's' : ''} open because each kept post goes out once per channel. Keep more posts on your Shelf to fill them.`;
      if (fill.mediaOnly.length) msg += ` ${fill.mediaOnly.map(id => channelName(channels().find(c => String(c.id) === id) || {})).join(', ')} need${fill.mediaOnly.length === 1 ? 's' : ''} a photo or video, so ${fill.mediaOnly.length === 1 ? 'it isn’t' : 'they aren’t'} filled from Shelf.`;
      action = `<button class="btn sm" type="button" id="suiteFillBtn">Queue ${plural(fill.items.length, 'reshare')} in Buffer</button>`;
    }
    box.innerHTML = `<p class="suite-fill-msg">${esc(msg)}</p>${action}`;
    el('suiteFillBtn')?.addEventListener('click', runFill);
  }

  async function runFill() {
    if (!pendingFill || !pendingFill.length || filling) return;
    const box = el('suiteFill');
    const items = pendingFill; pendingFill = null; filling = true;
    box.innerHTML = `<p class="suite-fill-msg" aria-live="polite">Queuing ${plural(items.length, 'reshare')}…</p>`;
    let ok = 0, fail = 0;
    for (const item of items) {
      try {
        const created = await createPost({ channelId: item.channelId, text: item.text, mode: 'customScheduled', dueAt: item.dueAt, schedulingType: 'automatic' });
        ok++;
        if (typeof appendScheduled === 'function') appendScheduled(created?.post, item);
      } catch (e) { fail++; console.error('[PostIQ runway fill]', e); }
    }
    filling = false;
    try { if (typeof renderCalendar === 'function') renderCalendar(); } catch {}
    window.dispatchEvent(new Event('postiq:scheduled-updated'));
    render();
    const done = `Queued ${ok} of ${plural(items.length, 'reshare')}${fail ? `; ${fail} couldn't be queued, so try again or check Buffer` : ''}.`;
    if (typeof showToast === 'function') showToast(done, fail ? 'error' : 'success');
    const after = el('suiteFill');
    if (after) after.insertAdjacentHTML('afterbegin', `<p class="suite-fill-done">${esc(done)}</p>`);
  }

  function render() {
    if (!el('suiteView')) return;
    const today = todayKey();
    const connection = (typeof getBufferConnectionState === 'function' && getBufferConnectionState()) || { connected: false };
    let notice = '';
    if (!connection.connected) notice = 'Connect Buffer to see your channels and how many days each one has queued.';
    else if (!channels().length) notice = 'No channels loaded yet. Sync to load them from Buffer.';
    else if (getQueueCoverage(1).stale) notice = 'Your queue data looks out of date. Sync to refresh these numbers.';
    if (connection.reconnectNeeded) notice = 'Your Buffer sign-in expired. Reconnect so posts keep going out.';
    setNotice(notice, !!notice && connection.connected && !connection.reconnectNeeded && channels().length > 0);
    renderChannels(today);
    renderBreak(today);
  }

  function init() {
    el('calSuiteBtn')?.addEventListener('click', () => activateView('suiteView', 'calendar_header'));
    el('suiteBackBtn')?.addEventListener('click', () => activateView('calendarView', 'suite_back'));
    ['suiteBreakStart', 'suiteBreakEnd'].forEach(id => el(id)?.addEventListener('change', () => { if (isSuiteActive()) render(); }));
    el('suiteNotice')?.addEventListener('click', e => {
      if (e.target.closest('[data-suite-sync]')) { try { syncBuffer({ force: true }); } catch {} }
    });
    const channelsBox = el('suiteChannels');
    channelsBox?.addEventListener('click', e => {
      const btn = e.target.closest('[data-suite-day]');
      if (!btn) return;
      const id = btn.closest('[data-suite-channel]').dataset.suiteChannel;
      const day = btn.dataset.suiteDay;
      const { days } = scheduleFor(id);
      saveSchedule(id, { days: days.includes(day) ? days.filter(d => d !== day) : [...days, day] });
    });
    channelsBox?.addEventListener('change', e => {
      const row = e.target.closest('[data-suite-channel]');
      if (!row) return;
      const id = row.dataset.suiteChannel;
      if (e.target.matches('[data-suite-target]')) {
        const n = Number(e.target.value);
        if (!Number.isInteger(n) || n < 0 || n > 10) { e.target.value = scheduleFor(id).target; return; }
        saveSchedule(id, { target: n });
      } else if (e.target.matches('[data-suite-reshare]')) {
        saveSchedule(id, { reshare: e.target.checked });
      }
    });
    window.addEventListener('postiq:view-changed', e => { if (e.detail?.viewId === 'suiteView') render(); });
    ['postiq:synced', 'postiq:planning-changed', 'postiq:scheduled-updated'].forEach(ev =>
      window.addEventListener(ev, () => { if (isSuiteActive()) render(); }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { render, breakPlan, channelRunways, describeRunway, channelHealth, scheduleFor, planBreakFill };
})();
