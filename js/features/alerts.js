'use strict';
// Alerts bell + overlay. Keeps the top of the calendar clean: nothing shows up
// there unless there's something to act on. The bell badges when a channel is
// within the runway window (2 days) or Buffer needs attention; the overlay holds
// connection status, channel health, and the low-runway list.
window.PostIQAlerts = (() => {
  const ALERT_DAYS = 2; // runway alerts only within this many days of running out
  const TOKEN_WARN_MS = 24 * 60 * 60 * 1000;
  const el = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = key => { try { return new Date(key + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return key; } };

  function tokenExpiringSoon() {
    try {
      const t = typeof getStoredOAuthToken === 'function' ? getStoredOAuthToken() : null;
      const exp = Number(t?.expiresAt || 0); const left = exp - Date.now();
      return exp && left > 0 && left < TOKEN_WARN_MS;
    } catch { return false; }
  }

  function compute() {
    const alerts = [];
    const conn = (typeof getBufferConnectionState === 'function' && getBufferConnectionState()) || { connected: false };
    if (!conn.connected) {
      alerts.push({ tone: 'warn', kind: conn.reconnectNeeded ? 'reconnect' : 'connect',
        title: conn.reconnectNeeded ? 'Reconnect Buffer' : 'Connect Buffer',
        detail: conn.reconnectNeeded ? 'Your Buffer session expired — sign in again so posts keep going out.' : 'Connect Buffer to see your channels and days ahead.' });
      return alerts; // nothing else is measurable
    }
    const coverage = typeof getQueueCoverage === 'function' ? getQueueCoverage(90) : null;
    if (coverage && (coverage.stale || !coverage.complete)) {
      alerts.push({ tone: 'warn', kind: 'stale', title: 'Queue data out of date', detail: 'Sync to refresh your calendar and days ahead.' });
    }
    if (tokenExpiringSoon()) {
      alerts.push({ tone: 'info', kind: 'token', title: 'Buffer sign-in expires soon', detail: 'It should renew on its own — reconnect if your next sync fails.' });
    }
    // Runway: only channels within ALERT_DAYS of running out.
    if (coverage && !coverage.stale && coverage.complete) {
      const settings = getPlanningSettings();
      const scheduled = (state.channels || []).filter(c => Array.isArray(settings.channelPostingDays?.[String(c.id)]) && settings.channelPostingDays[String(c.id)].length);
      const today = window.PostIQCoverage.dayKey(new Date());
      const dups = window.PostIQChannelIcons?.duplicateNames?.();
      scheduled.forEach(ch => {
        const info = window.PostIQCoverage.runwayInfo(coverage.rows, ch.id, today);
        if (info.state === 'gap' && info.days <= ALERT_DAYS) {
          alerts.push({ tone: info.days === 0 ? 'warn' : 'info', kind: 'runway', channelId: String(ch.id),
            label: window.PostIQChannelIcons ? window.PostIQChannelIcons.label(ch, { dups }) : esc(ch.displayName || ch.name || ch.id),
            detail: info.days === 0 ? 'Needs content today.' : `${info.days} day${info.days === 1 ? '' : 's'} of content left — add by ${fmt(info.date)}.` });
        }
      });
    }
    return alerts;
  }

  function alertRowHtml(a) {
    const title = a.kind === 'runway' ? a.label : `<strong>${esc(a.title)}</strong>`;
    let action = '';
    if (a.kind === 'reconnect' || a.kind === 'connect') action = `<button class="btn sm" type="button" data-alert-action="connect">${a.kind === 'reconnect' ? 'Reconnect' : 'Connect'}</button>`;
    else if (a.kind === 'stale') action = `<button class="btn sm" type="button" data-alert-action="sync">Sync</button>`;
    else if (a.kind === 'runway') action = `<button class="btn sm" type="button" data-alert-action="compose" data-channel="${esc(a.channelId)}">Add</button>`;
    return `<li class="alert-row tone-${esc(a.tone)}"><span class="alert-dot" aria-hidden="true"></span><div class="alert-copy"><div class="alert-title">${title}</div><div class="alert-detail">${esc(a.detail)}</div></div>${action}</li>`;
  }

  function render() {
    const bell = el('calAlertBell');
    if (!bell) return;
    const alerts = compute();
    const count = alerts.length;
    const warn = alerts.some(a => a.tone === 'warn');
    bell.classList.toggle('has-alerts', count > 0);
    bell.classList.toggle('has-warn', warn);
    const countEl = bell.querySelector('.cal-alert-count');
    if (countEl) { countEl.textContent = String(count); countEl.hidden = count === 0; }
    bell.setAttribute('aria-label', count ? `${count} alert${count === 1 ? '' : 's'}` : 'No alerts');
    bell.hidden = count === 0; // quiet when all is well

    const body = el('alertsBody');
    if (body) {
      body.innerHTML = count
        ? `<ul class="alert-list">${alerts.map(alertRowHtml).join('')}</ul>`
        : `<div class="empty-state" style="padding:24px 16px;"><div class="empty-title">All clear</div><div class="empty-desc">Your channels are covered and Buffer is connected.</div></div>`;
      body.querySelectorAll('[data-alert-action]').forEach(btn => btn.addEventListener('click', () => {
        const act = btn.dataset.alertAction;
        if (act === 'connect') { try { typeof goToBufferConnect === 'function' ? goToBufferConnect() : (window.location.href = '/auth/connect.html'); } catch {} }
        else if (act === 'sync') { try { syncBuffer({ force: true }); } catch {} closeModal('alertsModal'); }
        else if (act === 'compose') {
          const chId = btn.dataset.channel; closeModal('alertsModal');
          if (chId) state.calendarChannel = String(chId);
          window.activateView?.('composerView', 'alert');
          const sel = el('composerChannel'); if (sel && chId) { sel.value = String(chId); sel.dispatchEvent(new Event('change')); }
        }
      }));
    }
  }

  function init() {
    const bell = el('calAlertBell');
    if (!bell) return;
    bell.addEventListener('click', () => { render(); openModal('alertsModal'); });
    el('alertsClose')?.addEventListener('click', () => closeModal('alertsModal'));
    ['postiq:synced', 'postiq:planning-changed', 'postiq:scheduled-updated'].forEach(ev => window.addEventListener(ev, render));
    render();
  }

  return { init, render };
})();
