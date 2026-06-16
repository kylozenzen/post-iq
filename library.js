'use strict';

// library.js — PostIQ Post Library
// Isolated module (same pattern as discord-integration.js)
// Fetches sent posts with metrics, renders the Library view.

window.PostIQLibrary = (() => {

  // ── Constants ──────────────────────────────────
  const CACHE_KEY      = 'postiq_library_cache_v2';
  const STARRED_KEY    = 'postiq_library_starred_v1';
  const CACHE_TTL      = 10 * 60 * 1000; // 10 minutes
  const REPURPOSE_DAYS = 30;             // "ready to reuse" threshold

  // ── State ──────────────────────────────────────
  let posts        = [];
  let starred      = new Set();
  let activeTab    = 'all';
  let searchQuery  = '';
  let sortBy       = 'date';
  let loading      = false;
  let lastFetchAt  = 0;
  let metricsMeta  = { available: false, source: 'unknown', error: null, permissionError: false, postMetricFields: [] };
  let missingOrgWarned = false;

  // ── Utilities ──────────────────────────────────
  const qs        = id => document.getElementById(id);
  const safeText  = v => String(v || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const compact   = (v, max = 140) => { const t = String(v || '').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; };
  const fmtDate   = d => { try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; } };
  const daysAgo   = d => { try { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); } catch { return 0; } };
  const pct       = v => v != null ? (Number(v) * 100).toFixed(1) + '%' : null;
  const fmtNum    = v => v != null && v > 0 ? Number(v).toLocaleString() : null;

  function track(cb) { try { if (typeof cb === 'function') cb(); } catch {} }
  function logDiagnostic(message, details) { console.warn(`[PostIQ Library] ${message}`, details || ''); }
  function hasMetricValue(post) {
    const metrics = post?.metrics;
    return !!metrics && ['reactions', 'comments', 'impressions', 'reach', 'engagementRate'].some(key => metrics[key] != null);
  }

  function hasUsableMetrics(post) {
    const metrics = post?.metrics;
    if (!metrics) return false;

    const values = [];

    function collectNumbers(value) {
      if (typeof value === 'number' && Number.isFinite(value)) values.push(value);
      else if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) values.push(Number(value));
      else if (Array.isArray(value)) value.forEach(collectNumbers);
      else if (value && typeof value === 'object') Object.values(value).forEach(collectNumbers);
    }

    collectNumbers(metrics);
    return values.some(value => value > 0);
  }

  function hasRawMetrics(post) {
    const raw = post?.metrics?.raw;
    return !!raw && typeof raw === 'object' && Object.keys(raw).length > 0;
  }

  function hasPositiveMetric(post, key) {
    const value = Number(post?.metrics?.[key]);
    return Number.isFinite(value) && value > 0;
  }

  function formatLibraryError(data, res) {
    const first = data?.errors?.[0] || null;
    const detail = data?.details || first?.details || null;
    const detailText = typeof detail === 'string'
      ? detail
      : detail
        ? JSON.stringify(detail)
        : '';
    const message = data?.error || first?.message || `HTTP ${res.status}`;
    return detailText && !String(message).includes(detailText)
      ? `${message} — ${detailText.slice(0, 600)}`
      : message;
  }

  function getChannels() {
    return typeof window.getPostIQChannels === 'function' ? (window.getPostIQChannels() || []) : [];
  }

  // ── Persistence ────────────────────────────────
  function loadStarred() {
    try {
      const raw = JSON.parse(localStorage.getItem(STARRED_KEY) || '[]');
      starred = new Set(Array.isArray(raw) ? raw : []);
    } catch { starred = new Set(); }
  }

  function saveStarred() {
    try { localStorage.setItem(STARRED_KEY, JSON.stringify([...starred])); } catch {}
  }

  function loadCache() {
    try {
      const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!raw || !Array.isArray(raw.posts) || !raw.ts) return false;
      if (Date.now() - raw.ts > CACHE_TTL) return false;
      posts = raw.posts;
      metricsMeta = raw.metricsMeta || { available: posts.some(hasUsableMetrics), source: 'cache', error: null, permissionError: false, postMetricFields: [] };
      logFetchSummary({ cacheHit: true, organizationIdPresent: !!raw.organizationId });
      lastFetchAt = raw.ts;
      return true;
    } catch { return false; }
  }

  function saveCache() {
    const orgId = getCurrentOrganizationIdSync();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ posts, metricsMeta, organizationId: orgId || null, ts: Date.now() })); } catch {}
  }

  function getCurrentOrganizationIdSync() {
    if (typeof window.getPostIQOrganizationId !== 'function') return null;
    try {
      const value = window.getPostIQOrganizationId();
      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  }

  async function getOrganizationId({ force = false } = {}) {
    if (typeof window.getPostIQOrganizationId !== 'function') return null;
    try {
      const value = window.getPostIQOrganizationId({ force });
      return await Promise.resolve(value);
    } catch {
      return getCurrentOrganizationIdSync();
    }
  }

  function serviceKey(post) {
    return getChannelService(post) || (getChannelLabel(post) ? 'unknown-service' : 'unknown-channel');
  }

  function breakdownByService(items) {
    return items.reduce((acc, post) => {
      const key = serviceKey(post);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function logFetchSummary({ cacheHit = false, organizationIdPresent = false } = {}) {
    const withMetricsObject = posts.filter(post => !!post?.metrics).length;
    const withUsableMetrics = posts.filter(hasUsableMetrics).length;
    console.info('[PostIQ Library] fetch summary', {
      totalPosts: posts.length,
      postsWithMetricsObject: withMetricsObject,
      postsWithUsableMetrics: withUsableMetrics,
      organizationIdPresent,
      cacheHit,
    });
  }

  function logMetricsDiagnostics(data, orgId) {
    const withMetrics = posts.filter(post => !!post?.metrics);
    const withoutMetrics = posts.filter(post => !post?.metrics);
    logFetchSummary({ cacheHit: false, organizationIdPresent: !!orgId });
    console.info('[PostIQ Library] metrics diagnostics', {
      totalPosts: posts.length,
      postsWithMetricsObject: withMetrics.length,
      postsWithUsableMetrics: posts.filter(hasUsableMetrics).length,
      sampleMetricsObjects: withMetrics.slice(0, 5).map(post => ({ channelId: post.channelId, service: serviceKey(post), metrics: post.metrics })),
      channelServiceBreakdownWithMetrics: breakdownByService(withMetrics),
      channelServiceBreakdownWithoutMetrics: breakdownByService(withoutMetrics),
      metricsAvailable: !!data.metricsAvailable,
      metricsError: data.metricsError || null,
      postMetricFields: data.debug?.postMetricFields || metricsMeta.postMetricFields || [],
    });
  }

  // ── Data fetching ──────────────────────────────
  async function fetchPosts({ force = false } = {}) {
    if (loading) return;
    if (force) { try { localStorage.removeItem(CACHE_KEY); } catch {} }
    if (!force && loadCache() && posts.length) { render(); return; }

    // Need active token + org ID
    const getToken = typeof window.getActiveBufferToken === 'function'
      ? window.getActiveBufferToken
      : async () => null;
    const tokenResult = await getToken();
    if (!tokenResult?.token) {
      logDiagnostic('missing token');
      renderEmpty('Connect Buffer to load your post library.');
      return;
    }

    const orgId = await getOrganizationId({ force });
    if (!orgId) {
      if (!posts.length && !missingOrgWarned) {
        missingOrgWarned = true;
        logDiagnostic('missing organizationId');
      }
      renderEmpty('Sync Buffer first to load your post library.');
      return;
    }
    missingOrgWarned = false;

    loading = true;
    renderLoading();

    try {
      const res = await fetch('/.netlify/functions/buffer-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenResult.token, organizationId: orgId, maxPosts: 150, includeDebug: true }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        logDiagnostic('function HTTP failure', { status: res.status, statusText: res.statusText, body: data });
        throw new Error(formatLibraryError(data, res));
      }
      if (data.errors?.length) {
        logDiagnostic('Buffer GraphQL errors', data.errors);
        throw new Error(formatLibraryError(data, res) || 'Buffer GraphQL error');
      }
      if (data.error) throw new Error(formatLibraryError(data, res));
      if (data.message) logDiagnostic(data.message, { statusUsed: data.statusUsed, attemptedStatuses: data.attemptedStatuses });
      metricsMeta = {
        available: !!data.metricsAvailable,
        source: data.metricsSource || 'unknown',
        error: data.metricsError || null,
        permissionError: !!data.metricsPermissionError,
        postMetricFields: data.debug?.postMetricFields || [],
      };
      if (data.debug) {
        console.info('[PostIQ Library] Buffer analytics probe debug', data.debug);
      }
      const postsWithRawMetrics = (data.posts || []).filter(hasRawMetrics);
      if (postsWithRawMetrics.length) {
        console.info('[PostIQ Library] Raw Buffer metrics available for inspection', postsWithRawMetrics.map(post => ({ id: post.id, metrics: post.metrics.raw })));
      }
      if (metricsMeta.available) {
        console.info('[PostIQ Library] Buffer metrics returned', metricsMeta);
      } else if (metricsMeta.error) {
        console.info('[PostIQ Library] Buffer metrics unavailable; rendering posts without analytics', metricsMeta);
      } else {
        console.info('[PostIQ Library] No Buffer metrics returned for this library response', metricsMeta);
      }

      posts = (data.posts || []).sort((a, b) => new Date(b.sentAt || b.dueAt || 0) - new Date(a.sentAt || a.dueAt || 0));
      if (!posts.length) logDiagnostic('zero posts returned', { organizationId: orgId });
      logMetricsDiagnostics(data, orgId);
      lastFetchAt = Date.now();
      saveCache();
      render();
      track(() => typeof window.GA4_System !== 'undefined' && window.GA4_System.performanceMetric('library_load', posts.length));
    } catch (err) {
      console.error('[PostIQ Library]', err);
      renderEmpty(`Couldn't load posts: ${err.message}`);
    } finally {
      loading = false;
    }
  }

  // ── Filtering / sorting ────────────────────────
  function getChannelLabel(post) {
    const channels = getChannels();
    const ch = channels.find(c => c.id === post.channelId);
    return ch?.displayName || ch?.name || post.channelName || post.profileName || '';
  }

  function getChannelService(post) {
    const channels = getChannels();
    const ch = channels.find(c => c.id === post.channelId);
    return ch?.service || post.service || post.network || '';
  }

  function topPerformers() {
    return posts.filter(hasUsableMetrics).sort((a, b) => (Number(b.metrics?.engagementRate) || 0) - (Number(a.metrics?.engagementRate) || 0));
  }

  function measuredRepurposeCandidates() {
    return topPerformers().filter(p => daysAgo(p.sentAt) >= REPURPOSE_DAYS);
  }

  function isReuseFallbackActive() {
    return activeTab === 'reuse' && !measuredRepurposeCandidates().length && posts.length > 0;
  }

  function readyToRepurpose() {
    const usable = measuredRepurposeCandidates();
    if (usable.length) return usable;
    return [...posts].sort((a, b) => new Date(b.sentAt || b.dueAt || 0) - new Date(a.sentAt || a.dueAt || 0)).slice(0, 12);
  }

  function filteredPosts() {
    let pool;
    if (activeTab === 'top')       pool = topPerformers();
    else if (activeTab === 'reuse') pool = readyToRepurpose();
    else if (activeTab === 'starred') pool = posts.filter(p => starred.has(p.id));
    else pool = [...posts];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      pool = pool.filter(p => String(p.text || '').toLowerCase().includes(q) || getChannelLabel(p).toLowerCase().includes(q));
    }

    if (sortBy === 'engagement') {
      pool = pool.sort((a, b) => (b.metrics?.engagementRate || 0) - (a.metrics?.engagementRate || 0));
    } else if (sortBy === 'reactions') {
      pool = pool.sort((a, b) => (b.metrics?.reactions || 0) - (a.metrics?.reactions || 0));
    } else if (sortBy === 'impressions') {
      pool = pool.sort((a, b) => (b.metrics?.impressions || 0) - (a.metrics?.impressions || 0));
    }
    // default: date order (already sorted from API)

    return pool;
  }

  // ── Actions ────────────────────────────────────
  function repurposePost(post) {
    // Use existing PostIQ function to pin as reference above composer
    if (typeof window.pinReferenceToComposer === 'function') {
      window.pinReferenceToComposer({
        title: `${getChannelLabel(post)} · ${fmtDate(post.sentAt)}`,
        body: post.text || '',
        url: post.externalLink || '',
      });
    } else {
      // Fallback: load text directly into composer
      const editor = document.getElementById('composerEditor');
      if (editor) {
        editor.innerText = post.text || '';
        editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
    }
    if (typeof window.activateView === 'function') window.activateView('composerView');
    if (typeof window.showToast === 'function') window.showToast('Pinned as reference — write your take', 'success');
  }

  function reschedulePost(post) {
    const editor = document.getElementById('composerEditor');
    if (editor) {
      editor.innerText = post.text || '';
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      if (typeof window.updateComposerClearButtonVisibility === 'function') {
        window.updateComposerClearButtonVisibility();
      }
    }
    if (typeof window.activateView === 'function') window.activateView('composerView');
    if (typeof window.showToast === 'function') window.showToast('Post loaded — choose a Buffer action to send', 'success');
  }

  async function copyPost(post) {
    const text = post.text || '';
    try {
      await navigator.clipboard.writeText(text);
      if (typeof window.showToast === 'function') window.showToast('Copied', 'success');
    } catch {
      if (typeof window.showToast === 'function') window.showToast('Copy failed', 'error');
    }
  }

  function toggleStar(postId) {
    if (starred.has(postId)) starred.delete(postId);
    else starred.add(postId);
    saveStarred();
    renderPostList();
  }

  // ── Rendering ──────────────────────────────────
  function renderLoading() {
    const list = qs('libraryPostList');
    if (!list) return;
    list.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:48px 20px;color:var(--subtle);">
        <div style="width:28px;height:28px;border-radius:50%;border:3px solid var(--border2);border-top-color:var(--brand);animation:spin .9s linear infinite;"></div>
        <div style="font-family:'DM Mono',monospace;font-size:12px;">Loading your post library…</div>
      </div>`;
  }

  function emptyStateHtml(msg) {
    return `
      <div class="empty-state" style="margin-top:24px;">
        <div class="empty-icon">📚</div>
        <div class="empty-title">No posts found</div>
        <div class="empty-desc">${safeText(msg)}</div>
      </div>`;
  }

  function renderEmpty(msg) {
    const list = qs('libraryPostList');
    if (!list) return;
    list.innerHTML = emptyStateHtml(msg);
  }

  function metricBadgeHtml(metrics) {
    if (!metrics) return '';
    const parts = [];
    const er = pct(metrics.engagementRate);
    const rc = fmtNum(metrics.reactions);
    const im = fmtNum(metrics.impressions);
    const cm = fmtNum(metrics.comments);
    const rh = fmtNum(metrics.reach);
    if (er)  parts.push(`<span class="lib-metric-badge lib-metric-er">${safeText(er)} eng</span>`);
    if (rc)  parts.push(`<span class="lib-metric-badge lib-metric-rc">♥ ${safeText(rc)}</span>`);
    if (im)  parts.push(`<span class="lib-metric-badge lib-metric-im">👁 ${safeText(im)}</span>`);
    if (cm)  parts.push(`<span class="lib-metric-badge">💬 ${safeText(cm)}</span>`);
    if (rh)  parts.push(`<span class="lib-metric-badge">reach ${safeText(rh)}</span>`);
    return parts.slice(0, 3).join('');
  }

  function rawMetricsIndicatorHtml(post) {
    if (hasMetricValue(post) || !hasRawMetrics(post)) return '';
    return '<span class="lib-metric-badge lib-metric-raw">metrics available</span>';
  }

  function metricsNoticeHtml() {
    const notices = [];
    if (metricsMeta.permissionError) {
      notices.push('Performance metrics need an updated Buffer connection. Reconnect Buffer to enable analytics.');
    }
    if (isReuseFallbackActive()) {
      notices.push('No older high-performing posts have usable metrics yet, so Ready to Reuse is showing recent sent posts as inspiration.');
    }
    if (!notices.length) return '';
    return notices.map(message => `
      <div class="lib-analytics-notice" role="status" style="margin:0 0 14px;padding:12px 14px;border:1px solid rgba(245,158,11,.28);border-radius:14px;background:rgba(245,158,11,.10);color:var(--ink);font-size:13px;line-height:1.5;">
        ${safeText(message)}
      </div>`).join('');
  }

  function postCardHtml(post) {
    const isStarred = starred.has(post.id);
    const channelLabel = getChannelLabel(post);
    const service = getChannelService(post);
    const age = daysAgo(post.sentAt);
    const badges = metricBadgeHtml(post.metrics);
    const rawIndicator = rawMetricsIndicatorHtml(post);
    const isTopPerformer = hasUsableMetrics(post) && hasPositiveMetric(post, 'engagementRate') && (post.metrics?.engagementRate || 0) > 0.02; // >2% engagement
    const isOld = age >= REPURPOSE_DAYS;
    const safeId = safeText(post.id);

    return `
      <article class="lib-post-card" data-post-id="${safeId}">
        <div class="lib-post-card-hdr">
          <div class="lib-post-meta">
            ${channelLabel ? `<span class="lib-channel-badge">${safeText(channelLabel)}</span>` : ''}
            ${service ? `<span class="lib-service-badge">${safeText(service)}</span>` : ''}
            ${post.status ? `<span class="lib-status-badge">${safeText(post.status)}</span>` : ''}
            <span class="lib-date">${fmtDate(post.sentAt)}</span>
            ${post.metricsUpdatedAt ? `<span class="lib-date">metrics ${fmtDate(post.metricsUpdatedAt)}</span>` : ''}
            ${isTopPerformer ? '<span class="lib-top-badge">⭐ Top</span>' : ''}
            ${isOld && isTopPerformer ? '<span class="lib-reuse-badge">↺ Ready to reuse</span>' : ''}
          </div>
          <button class="lib-star-btn ${isStarred ? 'starred' : ''}" data-star="${safeId}" aria-label="${isStarred ? 'Unstar post' : 'Star post'}">
            ${isStarred ? '★' : '☆'}
          </button>
        </div>

        <div class="lib-post-text">${safeText(compact(post.text, 280))}</div>

        ${badges || rawIndicator ? `<div class="lib-metrics-row">${badges || rawIndicator}</div>` : ''}

        <div class="lib-post-actions">
          <button class="btn sm primary" data-action="repurpose" data-post-id="${safeId}">→ Repurpose</button>
          <button class="btn sm" data-action="reschedule" data-post-id="${safeId}">↺ Re-schedule</button>
          <button class="btn sm ghost" data-action="copy" data-post-id="${safeId}">Copy</button>
          ${post.externalLink ? `<a class="btn sm ghost" href="${safeText(post.externalLink)}" target="_blank" rel="noopener">↗ View</a>` : ''}
        </div>
      </article>`;
  }

  function renderPostList() {
    const list = qs('libraryPostList');
    if (!list) return;

    const filtered = filteredPosts();
    if (!filtered.length) {
      const msgs = {
        top: metricsMeta.available && posts.some(hasUsableMetrics) ? 'No posts with usable engagement data yet. Metrics may take time to appear.' : 'No top performers yet.',
        reuse: metricsMeta.available && posts.some(hasUsableMetrics) ? `No high-performing posts older than ${REPURPOSE_DAYS} days found. Showing recent posts instead.` : 'No measured reuse suggestions yet. Showing recent posts instead.',
        starred: 'No starred posts yet. Star any post to save it here.',
        all: searchQuery ? 'No posts match that search.' : 'No sent posts found.',
      };
      list.innerHTML = metricsNoticeHtml() + emptyStateHtml(msgs[activeTab] || msgs.all);
      return;
    }

    list.innerHTML = metricsNoticeHtml() + filtered.map(postCardHtml).join('');

    // Bind card actions
    list.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const postId = btn.dataset.postId;
        const post = posts.find(p => p.id === postId);
        if (!post) return;
        if (btn.dataset.action === 'repurpose')  repurposePost(post);
        if (btn.dataset.action === 'reschedule') reschedulePost(post);
        if (btn.dataset.action === 'copy')       copyPost(post);
      });
    });

    list.querySelectorAll('[data-star]').forEach(btn => {
      btn.addEventListener('click', () => toggleStar(btn.dataset.star));
    });
  }

  function renderStats() {
    const statsEl = qs('libraryStats');
    if (!statsEl) return;

    const total = posts.length;
    const withMetrics = posts.filter(hasUsableMetrics).length;
    const top = topPerformers().slice(0, 1)[0];
    const topEr = top ? pct(top.metrics?.engagementRate) : null;
    const syncAge = lastFetchAt ? Math.floor((Date.now() - lastFetchAt) / 60000) : null;

    statsEl.innerHTML = `
      <div class="lib-stat"><span class="lib-stat-num">${total}</span><span class="lib-stat-lbl">sent posts</span></div>
      <div class="lib-stat"><span class="lib-stat-num">${withMetrics}</span><span class="lib-stat-lbl">with usable metrics</span></div>
      ${topEr ? `<div class="lib-stat"><span class="lib-stat-num">${safeText(topEr)}</span><span class="lib-stat-lbl">best eng. rate</span></div>` : ''}
      ${syncAge != null ? `<div class="lib-stat lib-stat-muted"><span class="lib-stat-num">${syncAge}m</span><span class="lib-stat-lbl">ago</span></div>` : ''}
    `;
  }

  function renderTabCounts() {
    const counts = {
      all:     posts.length,
      top:     topPerformers().length,
      reuse:   readyToRepurpose().length,
      starred: [...starred].filter(id => posts.some(p => p.id === id)).length,
    };
    Object.entries(counts).forEach(([tab, count]) => {
      const el = qs(`libTabCount-${tab}`);
      if (el) el.textContent = count > 0 ? count : '';
    });
  }

  function render() {
    renderStats();
    renderTabCounts();
    renderPostList();
  }

  // ── Init ──────────────────────────────────────
  function init() {
    loadStarred();

    // Fetch on first view activation
    const view = document.getElementById('libraryView');
    if (!view) return;

    // Search
    const searchInput = qs('librarySearch');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        renderPostList();
      });
    }

    // Sort
    const sortSelect = qs('librarySort');
    if (sortSelect) {
      sortSelect.addEventListener('change', e => {
        sortBy = e.target.value;
        renderPostList();
      });
    }

    // Tabs
    document.querySelectorAll('[data-lib-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.libTab;
        document.querySelectorAll('[data-lib-tab]').forEach(t => t.classList.toggle('active', t === tab));
        renderPostList();
      });
    });

    // Refresh button
    const refreshBtn = qs('libraryRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => fetchPosts({ force: true }));
    }

    // Load when view activates, and retry after a Buffer sync supplies token/org state.
    window.addEventListener('postiq:synced', () => fetchPosts({ force: true }));

    // Auto-load if cache available
    if (loadCache() && posts.length) render();
  }

  return {
    init,
    refresh: () => fetchPosts({ force: true }),
    activate: () => fetchPosts(),
  };

})();
