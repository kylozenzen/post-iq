'use strict';

// ── PLAN HEALTH STRIP ────────────────────────────────
// Connection + queue health on the calendar. Two jobs, both read-only:
//   1. Are your Buffer connection and data healthy? (connected / reconnect /
//      token expiring / data stale)
//   2. A gentle "you're well ahead — a break is fine" nudge.
// The per-channel runway NUMBER lives in the calendar runway banner, not here,
// so a newer creator sees one runway figure, not two in different units.
window.PostIQPlanHealth = (() => {
  const TOKEN_WARN_MS = 24 * 60 * 60 * 1000;
  const BREAK_AHEAD_DAYS = 14; // calendar days of coverage that make a break safe
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function tokenWarning() {
    try {
      const token = getStoredOAuthToken?.();
      const expiresAt = Number(token?.expiresAt || 0);
      const remaining = expiresAt - Date.now();
      if (expiresAt && remaining > 0 && remaining < TOKEN_WARN_MS) return true;
    } catch {}
    return false;
  }

  function syncedAgo() {
    const ts = Number(state?.scheduledCoverage?.ts);
    if (!Number.isFinite(ts) || ts <= 0) return '';
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    return hrs < 24 ? `${hrs} hr ago` : `${Math.round(hrs / 24)} d ago`;
  }

  function setStrip(tone, html) {
    const mount = byId('planHealthStrip');
    if (mount) mount.innerHTML = `<div class="health-card health-${tone}"><span class="health-dot" aria-hidden="true"></span><div class="health-body">${html}</div></div>`;
  }

  // Are all scheduled channels far enough ahead that a break is safe?
  function wellAhead(coverage) {
    try {
      const settings = getPlanningSettings();
      const scheduled = (state.channels || []).filter(c => Array.isArray(settings.channelPostingDays?.[String(c.id)]) && settings.channelPostingDays[String(c.id)].length);
      if (!scheduled.length) return false;
      return scheduled.every(c => {
        const info = window.PostIQCoverage.runwayInfo(coverage.rows, c.id);
        return info.state === 'covered' || (info.state === 'gap' && info.days >= BREAK_AHEAD_DAYS);
      });
    } catch { return false; }
  }

  function render() {
    if (!byId('planHealthStrip')) return;
    const connection = (typeof getBufferConnectionState === 'function' && getBufferConnectionState()) || { connected: false };

    if (!connection.connected) {
      const reconnect = !!connection.reconnectNeeded;
      setStrip('warn', `<strong>${reconnect ? 'Reconnect Buffer' : 'Connect Buffer'}</strong><span>${reconnect ? 'Your Buffer session expired. Sign in again so your posts keep going out.' : 'Connect Buffer to see your channels and content runway.'}</span>`);
      return;
    }

    const channels = Array.isArray(state?.channels) ? state.channels : [];
    if (!channels.length) {
      setStrip('neutral', `<strong>No channels loaded yet</strong><span>Click Sync to load your Buffer channels.</span>`);
      return;
    }

    const coverage = getQueueCoverage();
    const stale = coverage.stale || !coverage.complete;

    if (stale) {
      setStrip('warn', `<strong>Your queue data looks out of date</strong><span>Sync to refresh your calendar and runway.</span>`);
      return;
    }
    if (tokenWarning()) {
      setStrip('warn', `<strong>Buffer sign-in expires soon</strong><span>It should renew on its own — reconnect if your next sync fails.</span>`);
      return;
    }

    const ago = syncedAgo();
    const synced = ago ? ` · synced ${esc(ago)}` : '';
    if (wellAhead(coverage)) {
      setStrip('good', `<strong>You're well ahead</strong><span>Every channel is connected and your queue is full${synced}. It's fine to take a break.</span>`);
    } else {
      setStrip('good', `<strong>Connected to Buffer</strong><span>Your channels are syncing normally${synced}.</span>`);
    }
  }

  return { render };
})();
