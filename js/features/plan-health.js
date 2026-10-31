'use strict';

// ── PLAN HEALTH PANEL ────────────────────────────────
// Channel coverage details in the Queue Health tool. Read-only: it never writes
// to Buffer or to stored post data. Expanded by default;
// the open/closed choice is a per-browser convenience kept in localStorage.
window.PostIQPlanHealth = (() => {
  const OPEN_KEY = 'postiqPlanHealthOpen';
  const TOKEN_WARN_MS = 24 * 60 * 60 * 1000;
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  let bound = false;

  function isOpen() {
    try { return localStorage.getItem(OPEN_KEY) !== '0'; } catch { return false; }
  }
  function setOpen(open) {
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch {}
  }

  function tokenWarning() {
    try {
      const token = getStoredOAuthToken?.();
      const expiresAt = Number(token?.expiresAt || 0);
      const remaining = expiresAt - Date.now();
      if (expiresAt && remaining > 0 && remaining < TOKEN_WARN_MS) {
        return 'Your Buffer sign-in expires within a day. It should renew on its own; reconnect if sync fails.';
      }
    } catch {}
    return '';
  }

  function channelRows(runways, channels) {
    return channels.map(channel => {
      const id = String(channel.id);
      const days = runways[id] ?? 0;
      const status = window.PostIQRunway.classifyRunway(days);
      const label = channel.displayName || channel.name || channel.service || 'Channel';
      const copy = status === 'empty' ? 'No confirmed runway'
        : status === 'low' ? `Low: ${plural(days, 'posting day')} covered`
        : `Healthy: ${plural(days, 'posting day')} covered`;
      return { label, status, copy };
    });
  }

  function setStrip(html) {
    const mount = byId('planHealthStrip');
    if (mount) mount.innerHTML = html;
  }

  function bindOnce() {
    if (bound) return;
    const mount = byId('planHealthStrip');
    if (!mount) return;
    bound = true;
    mount.addEventListener('click', event => {
      const toggle = event.target.closest('[data-health-toggle]');
      if (!toggle) return;
      const open = !isOpen();
      setOpen(open);
      render();
    });
  }

  function render() {
    if (!byId('planHealthStrip')) return;
    if (typeof detectQueueGaps === 'function') detectQueueGaps();
    bindOnce();
    const connection = (typeof getBufferConnectionState === 'function' && getBufferConnectionState()) || { connected: false };
    const syncButton = byId('queueHealthSync');
    if (syncButton) syncButton.textContent = connection.connected ? 'Sync now' : (connection.reconnectNeeded ? 'Reconnect Buffer' : 'Connect Buffer');
    const channels = Array.isArray(state?.channels) ? state.channels : [];
    const scheduled = Array.isArray(state?.scheduled) ? state.scheduled : [];
    const runway = window.PostIQRunway;

    if (!connection.connected) {
      const reconnect = !!connection.reconnectNeeded;
      setStrip(`<div class="plan-health-card plan-health-static plan-health-warn">
        <strong>${reconnect ? 'Reconnect Buffer' : 'Connect Buffer'}</strong>
        <span>${reconnect ? 'Sign in again to keep channel status and queue runway up to date.' : 'Connect Buffer to see channel health and queue runway.'}</span>
      </div>`);
      return;
    }
    if (!channels.length) {
      setStrip(`<div class="plan-health-card plan-health-static"><strong>No channels loaded yet</strong><span>Click Sync now to load your Buffer channels.</span></div>`);
      return;
    }

    const coverage = getQueueCoverage();
    const runways = Object.fromEntries(channels.map(c => [String(c.id), window.PostIQCoverage.runway(coverage.rows, c.id)]));
    const accountRunway = Math.min(...Object.values(runways));
    const rows = channelRows(runways, channels);
    const attention = rows.filter(r => r.status !== 'healthy').length;
    const open = isOpen();

    const summary = attention
      ? `${plural(attention, 'channel')} need${attention === 1 ? 's' : ''} attention`
      : (coverage.complete ? 'Each channel has at least 3 posting days covered' : 'Runway based on loaded posts only');
    const dataNote = !coverage.complete ? 'Coverage uncertain: incomplete or stale sync. ' : '';
    const breakPrompt = accountRunway >= runway.RUNWAY_BREAK_THRESHOLD_DAYS
      ? `<div class="plan-health-break">${plural(accountRunway, 'posting day')} queued across your channels. A break is fine.</div>` : '';
    const warning = tokenWarning();
    const tokenLine = warning ? `<div class="plan-health-note">${esc(warning)}</div>` : '';

    setStrip(`<div class="plan-health-card${open ? ' is-open' : ''}">
      <button type="button" class="plan-health-toggle" data-health-toggle aria-expanded="${open}" aria-controls="planHealthBody">
        <span class="plan-health-title">Channel health</span>
        <span class="plan-health-summary">${esc(dataNote)}${esc(summary)} · Runway ${plural(accountRunway, 'posting day')}</span>
        <span class="plan-health-chevron" aria-hidden="true">${open ? '▴' : '▾'}</span>
      </button>
      <div id="planHealthBody" class="plan-health-body" ${open ? '' : 'hidden'}>
        <ul class="plan-health-list">
          ${rows.map(r => `<li class="plan-health-row plan-health-${r.status}">
            <span class="plan-health-dot" aria-hidden="true"></span>
            <span class="plan-health-name">${esc(r.label)}</span>
            <span class="plan-health-copy">${esc(r.copy)}</span>
          </li>`).join('')}
        </ul>
        <div class="plan-health-note">Timezone: ${esc(coverage.timezone)}. Runway counts consecutive required posting days from tomorrow, skipping intentional off days. Summary is the minimum across channels; unknown days stop the count. Sync freshness: ${coverage.stale ? 'stale' : 'current or unknown'}.</div>${breakPrompt}${tokenLine}
      </div>
    </div>`);
  }

  return { render };
})();
