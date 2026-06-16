'use strict';

// pulse.js — PostIQ Pulse
// Lightweight Buffer performance snapshot powered by aggregatedPostMetrics.

window.PostIQPulse = (() => {
  const CACHE_KEY = 'postiq_pulse_cache_v1';
  const CACHE_TTL = 12 * 60 * 60 * 1000; // Buffer performance metrics update daily-ish.
  const ALLOWED_DAYS = [7, 14, 30];

  let activeDays = 30;
  let loading = false;
  let lastLoadedAt = 0;
  let data = null;

  const qs = id => document.getElementById(id);
  const safeText = v => String(v || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const fmtNum = v => v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const fmtAvg = v => v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const setStatus = text => { const el = qs('pulseStatus'); if (el) el.textContent = text || ''; };

  function cacheKey(days = activeDays) {
    let orgId = null;
    try { orgId = typeof window.getPostIQOrganizationId === 'function' ? window.getPostIQOrganizationId() : null; } catch {}
    return `${CACHE_KEY}_${orgId || 'no-org'}_${days}`;
  }

  function readCache(days = activeDays) {
    try {
      const raw = JSON.parse(localStorage.getItem(cacheKey(days)) || 'null');
      if (!raw || !raw.ts || Date.now() - raw.ts > CACHE_TTL) return null;
      return raw;
    } catch { return null; }
  }

  function writeCache(payload, days = activeDays) {
    try { localStorage.setItem(cacheKey(days), JSON.stringify({ ts: Date.now(), payload })); } catch {}
  }

  function renderConnect() {
    const cards = qs('pulseCards');
    const body = qs('pulseBody');
    if (cards) cards.innerHTML = '';
    if (body) body.innerHTML = `<div class="pulse-empty"><div class="empty-icon">〰️</div><div class="empty-title">Connect Buffer to view your Pulse.</div><div class="empty-desc">Pulse uses aggregate Buffer metrics to show a calm recent-performance snapshot.</div></div>`;
    setStatus('');
  }

  function metricCard(label, value, note = '') {
    return `<div class="pulse-card"><span class="pulse-card-label">${safeText(label)}</span><strong class="pulse-card-value">${safeText(value)}</strong>${note ? `<span class="pulse-card-note">${safeText(note)}</span>` : ''}</div>`;
  }

  function renderLoading() {
    const cards = qs('pulseCards');
    const body = qs('pulseBody');
    if (cards) cards.innerHTML = metricCard('Posts sent', '—') + metricCard('Reactions', '—') + metricCard('Comments', '—') + metricCard('Avg reactions/post', '—') + metricCard('Metrics status', 'Loading');
    if (body) body.innerHTML = `<div class="pulse-note">Loading your recent Pulse…</div>`;
    setStatus('');
  }

  function renderPulse(payload = data) {
    const metrics = payload?.aggregateMetrics || {};
    const cards = qs('pulseCards');
    const body = qs('pulseBody');
    const available = !!metrics.available;
    if (cards) {
      cards.innerHTML = [
        metricCard('Posts sent', fmtNum(metrics.postCount), `${payload?.days || activeDays} days`),
        metricCard('Reactions', fmtNum(metrics.reactions)),
        metricCard('Comments', fmtNum(metrics.comments)),
        metricCard('Avg reactions/post', fmtAvg(metrics.averageReactionsPerPost)),
        metricCard('Metrics status', available ? 'Available' : 'Syncing', available ? 'From Buffer aggregate metrics' : 'No values yet'),
      ].join('');
    }
    if (body) {
      body.innerHTML = available
        ? `<div class="pulse-note">Use this snapshot to spot whether recent posts are earning reactions or comments, then revisit your Library for specific posts to reuse.</div>`
        : `<div class="pulse-empty compact"><div class="empty-title">Performance data is syncing or unavailable from Buffer.</div><div class="empty-desc">Pulse will keep working and Library can still load your sent posts.</div></div>`;
    }
    setStatus(lastLoadedAt ? `Updated ${new Date(lastLoadedAt).toLocaleString()}` : '');
  }

  async function fetchPulse({ force = false } = {}) {
    if (loading) return;
    activeDays = ALLOWED_DAYS.includes(Number(activeDays)) ? Number(activeDays) : 30;

    const cached = !force ? readCache(activeDays) : null;
    if (cached?.payload) {
      data = cached.payload;
      lastLoadedAt = cached.ts;
      renderPulse(data);
      return;
    }

    const tokenResult = typeof window.getActiveBufferToken === 'function' ? await window.getActiveBufferToken() : null;
    if (!tokenResult?.token) { renderConnect(); return; }

    const orgId = typeof window.getPostIQOrganizationId === 'function' ? await Promise.resolve(window.getPostIQOrganizationId({ force })) : null;
    if (!orgId) { renderConnect(); return; }

    loading = true;
    renderLoading();
    try {
      const res = await fetch('/.netlify/functions/buffer-pulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenResult.token, organizationId: orgId, dashboardDays: activeDays }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
      data = payload;
      lastLoadedAt = Date.now();
      writeCache(payload, activeDays);
      renderPulse(payload);
    } catch (err) {
      console.info('[PostIQ Pulse] metrics unavailable', err?.message || err);
      data = { ok: true, days: activeDays, aggregateMetrics: { available: false, postCount: null, reactions: null, comments: null, averageReactionsPerPost: null, raw: null, error: err?.message || null } };
      lastLoadedAt = Date.now();
      renderPulse(data);
    } finally {
      loading = false;
    }
  }

  function setRange(days) {
    activeDays = ALLOWED_DAYS.includes(Number(days)) ? Number(days) : 30;
    document.querySelectorAll('[data-pulse-days]').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.pulseDays) === activeDays));
    fetchPulse();
  }

  function init() {
    if (!qs('pulseView')) return;
    document.querySelectorAll('[data-pulse-days]').forEach(btn => btn.addEventListener('click', () => setRange(btn.dataset.pulseDays)));
    ['pulseRefreshBtn', 'pulseRefreshBtnMob'].forEach(id => { const btn = qs(id); if (btn) btn.addEventListener('click', () => fetchPulse({ force: true })); });
    window.addEventListener('postiq:synced', () => fetchPulse({ force: true }));
    const cached = readCache(activeDays);
    if (cached?.payload) { data = cached.payload; lastLoadedAt = cached.ts; renderPulse(data); }
  }

  return { init, activate: () => fetchPulse(), refresh: () => fetchPulse({ force: true }) };
})();
