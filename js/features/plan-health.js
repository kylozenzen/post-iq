'use strict';

// ── PLAN HEALTH STRIP ────────────────────────────────
// Shown above the Plan (calendar) grid. Read-only: it never writes to Buffer or
// changes stored data. It shows:
//   - whether Buffer is connected, and whether the sign-in needs attention,
//   - a per-channel status (healthy / low / empty queue),
//   - account runway, and the break prompt once runway reaches the threshold.
window.PostIQPlanHealth = (() => {
  const TOKEN_WARN_MS = 24 * 60 * 60 * 1000;
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
      const copy = status === 'empty' ? 'Empty queue: nothing scheduled in the next few days'
        : status === 'low' ? `Low queue: ${days} day${days === 1 ? '' : 's'} covered`
        : `Healthy: ${days} days covered`;
      return { id, label, status, copy };
    });
  }

  function setStrip(html) {
    const mount = byId('planHealthStrip');
    if (mount) mount.innerHTML = html;
  }

  function render() {
    if (!byId('planHealthStrip')) return;
    const connection = (typeof getBufferConnectionState === 'function' && getBufferConnectionState()) || { connected: false };
    const channels = Array.isArray(state?.channels) ? state.channels : [];
    const scheduled = Array.isArray(state?.scheduled) ? state.scheduled : [];
    const runway = window.PostIQRunway;

    if (!connection.connected) {
      const reconnect = !!connection.reconnectNeeded;
      setStrip(`<div class="plan-health-card plan-health-warn">
        <strong>${reconnect ? 'Reconnect Buffer' : 'Connect Buffer'}</strong>
        <span>${reconnect ? 'Sign in again to keep channel status and queue runway up to date.' : 'Connect Buffer to see channel health and queue runway.'}</span>
      </div>`);
      return;
    }
    if (!channels.length) {
      setStrip(`<div class="plan-health-card"><strong>No channels loaded yet</strong><span>Click Sync now to load your Buffer channels.</span></div>`);
      return;
    }

    const now = new Date();
    const ids = channels.map(c => String(c.id));
    const runways = runway.computeChannelRunways(scheduled, ids, { now });
    const accountRunway = runway.computeRunway(scheduled, { now });
    const rows = channelRows(runways, channels);
    const warning = tokenWarning();

    const breakPrompt = accountRunway >= runway.RUNWAY_BREAK_THRESHOLD_DAYS
      ? `<div class="plan-health-break">You have ${accountRunway} days queued across your channels. A break is fine.</div>` : '';
    const tokenLine = warning ? `<div class="plan-health-note">${esc(warning)}</div>` : '';

    setStrip(`<div class="plan-health-card">
      <div class="plan-health-head">
        <strong>Channel health</strong>
        <span class="plan-health-runway">Runway: ${accountRunway} day${accountRunway === 1 ? '' : 's'}</span>
      </div>
      <ul class="plan-health-list">
        ${rows.map(r => `<li class="plan-health-row plan-health-${r.status}">
          <span class="plan-health-dot" aria-hidden="true"></span>
          <span class="plan-health-name">${esc(r.label)}</span>
          <span class="plan-health-copy">${esc(r.copy)}</span>
        </li>`).join('')}
      </ul>
      ${breakPrompt}${tokenLine}
    </div>`);
  }

  return { render };
})();
