'use strict';
// Suite: a dedicated queue-health space, reached from the calendar header or
// the sidebar. Read-only: it reads the same coverage model the calendar uses.
//   1. Channels: how many days until each channel runs out of queued posts.
//   2. Break planner: for the dates you pick, how each week is covered and how
//      many posts still need queuing before you leave.
window.PostIQSuite = (() => {
  const HORIZON_DAYS = 120;   // runway lookahead for the channel list
  const MAX_BREAK_DAYS = 365; // break planner never looks further than this
  const el = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cov = () => window.PostIQCoverage;
  const todayKey = () => cov().dayKey(new Date());
  const channels = () => (Array.isArray(state?.channels) ? state.channels : []);
  const channelName = c => c.displayName || c.name || 'Buffer channel';
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
        return { tone: 'muted', text: 'No posting days set', sub: 'Choose posting days in Settings' };
    }
  }

  // Per-channel runway for the list view.
  function channelRunways(rows, today) {
    return channels().map(c => {
      const info = cov().runwayInfo(rows, String(c.id), today);
      return { id: String(c.id), name: channelName(c), service: c.service || '', info, view: describeRunway(info) };
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
      return { id: String(c.id), name: channelName(c), cells, missing };
    });
    return { weeks, lines, missingTotal, channelsShort: lines.filter(l => l.missing > 0).length };
  }

  function isSuiteActive() {
    return document.getElementById('suiteView')?.classList.contains('active');
  }

  function setNotice(message) {
    const box = el('suiteNotice');
    if (!box) return;
    box.hidden = !message;
    box.textContent = message || '';
  }

  function renderChannels(today) {
    const mount = el('suiteChannels');
    if (!mount) return;
    const connection = (typeof getBufferConnectionState === 'function' && getBufferConnectionState()) || { connected: false };
    if (!connection.connected) { mount.innerHTML = ''; return; }
    const list = channels();
    if (!list.length) { mount.innerHTML = '<p class="suite-empty">No channels loaded yet. Sync to load them from Buffer.</p>'; return; }
    const rows = getQueueCoverage(HORIZON_DAYS).rows;
    mount.innerHTML = channelRunways(rows, today).map(r => `
      <div class="suite-channel suite-tone-${r.view.tone}">
        <div class="suite-channel-name">
          <strong>${esc(r.name)}</strong>
          ${r.service ? `<span class="suite-service">${esc(r.service)}</span>` : ''}
        </div>
        <div class="suite-channel-status">
          <span class="suite-runway">${esc(r.view.text)}</span>
          <span class="suite-runway-sub">${esc(r.view.sub)}</span>
        </div>
      </div>`).join('');
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
        <th scope="row">${esc(line.name)}</th>
        ${line.cells.map(cell => {
          if (cell.planned === 0) return '<td class="suite-cell suite-cell-off" title="No posts planned">—</td>';
          const ok = cell.missing === 0;
          const title = ok ? `${cell.covered} of ${cell.planned} posts queued` : `${cell.missing} post${cell.missing === 1 ? '' : 's'} still to queue`;
          return `<td class="suite-cell ${ok ? 'suite-cell-ok' : 'suite-cell-gap'}" title="${esc(title)}">${cell.covered}/${cell.planned}</td>`;
        }).join('')}
      </tr>`).join('');
    grid.innerHTML = `<thead><tr><th scope="col">Channel</th>${head}</tr></thead><tbody>${body}</tbody>`;
  }

  function render() {
    if (!el('suiteView')) return;
    const today = todayKey();
    const connection = (typeof getBufferConnectionState === 'function' && getBufferConnectionState()) || { connected: false };
    let notice = '';
    if (!connection.connected) notice = 'Connect Buffer to see your channels and how many days each one has queued.';
    else if (!channels().length) notice = 'No channels loaded yet. Sync to load them from Buffer.';
    else if (getQueueCoverage(1).stale) notice = 'Your queue data looks out of date. Sync to refresh these numbers.';
    setNotice(notice);
    renderChannels(today);
    renderBreak(today);
  }

  function init() {
    el('calSuiteBtn')?.addEventListener('click', () => activateView('suiteView', 'calendar_header'));
    el('suiteBackBtn')?.addEventListener('click', () => activateView('calendarView', 'suite_back'));
    ['suiteBreakStart', 'suiteBreakEnd'].forEach(id => el(id)?.addEventListener('change', () => { if (isSuiteActive()) render(); }));
    window.addEventListener('postiq:view-changed', e => { if (e.detail?.viewId === 'suiteView') render(); });
    ['postiq:synced', 'postiq:planning-changed', 'postiq:scheduled-updated'].forEach(ev =>
      window.addEventListener(ev, () => { if (isSuiteActive()) render(); }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { render, breakPlan, channelRunways, describeRunway };
})();
