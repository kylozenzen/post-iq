'use strict';

// library.js — PostIQ Post Library
// Isolated module (same pattern as discord-integration.js)
// Fetches sent posts with metrics, renders the Library view.

window.PostIQLibrary = (() => {

  // ── Constants ──────────────────────────────────
  const CACHE_KEY      = 'postiq_library_cache_v1';
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

  // ── Utilities ──────────────────────────────────
  const qs        = id => document.getElementById(id);
  const safeText  = v => String(v || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const compact   = (v, max = 140) => { const t = String(v || '').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; };
  const fmtDate   = d => { try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; } };
  const daysAgo   = d => { try { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); } catch { return 0; } };
  const pct       = v => v != null ? (Number(v) * 100).toFixed(1) + '%' : null;
  const fmtNum    = v => v != null && v > 0 ? Number(v).toLocaleString() : null;

  function track(cb) { try { if (typeof cb === 'function') cb(); } catch {} }

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
      lastFetchAt = raw.ts;
      return true;
    } catch { return false; }
  }

  function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ posts, ts: Date.now() })); } catch {}
  }

  // ── Data fetching ──────────────────────────────
  async function fetchPosts({ force = false } = {}) {
    if (loading) return;
    if (!force && loadCache() && posts.length) { render(); return; }

    // Need active token + org ID
    const getToken = typeof window.getActiveBufferToken === 'function'
      ? window.getActiveBufferToken
      : async () => null;
    const tokenResult = await getToken();
    if (!tokenResult?.token) {
      renderEmpty('Connect Buffer to load your post library.');
      return;
    }

    // Get org ID from app state
    const orgId = window.state?.organizationId || null;
    if (!orgId) {
      renderEmpty('Sync Buffer first to load your post library.');
      return;
    }

    loading = true;
    renderLoading();

    try {
      const res = await fetch('/.netlify/functions/buffer-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenResult.token, organizationId: orgId, maxPosts: 150 }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

      posts = data.posts || [];
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
    const channels = window.state?.channels || [];
    const ch = channels.find(c => c.id === post.channelId);
    return ch?.displayName || ch?.name || post.channelId || '';
  }

  function getChannelService(post) {
    const channels = window.state?.channels || [];
    const ch = channels.find(c => c.id === post.channelId);
    return ch?.service || '';
  }

  function topPerformers() {
    return posts.filter(p => p.metrics?.engagementRate > 0).sort((a, b) => (b.metrics?.engagementRate || 0) - (a.metrics?.engagementRate || 0));
  }

  function readyToRepurpose() {
    return topPerformers().filter(p => daysAgo(p.sentAt) >= REPURPOSE_DAYS);
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

  function renderEmpty(msg) {
    const list = qs('libraryPostList');
    if (!list) return;
    list.innerHTML = `
      <div class="empty-state" style="margin-top:24px;">
        <div class="empty-icon">📚</div>
        <div class="empty-title">No posts found</div>
        <div class="empty-desc">${safeText(msg)}</div>
      </div>`;
  }

  function metricBadgeHtml(metrics) {
    if (!metrics) return '';
    const parts = [];
    const er = pct(metrics.engagementRate);
    const rc = fmtNum(metrics.reactions);
    const im = fmtNum(metrics.impressions);
    if (er)  parts.push(`<span class="lib-metric-badge lib-metric-er">${safeText(er)} eng</span>`);
    if (rc)  parts.push(`<span class="lib-metric-badge lib-metric-rc">♥ ${safeText(rc)}</span>`);
    if (im)  parts.push(`<span class="lib-metric-badge lib-metric-im">👁 ${safeText(im)}</span>`);
    return parts.slice(0, 3).join('');
  }

  function postCardHtml(post) {
    const isStarred = starred.has(post.id);
    const channelLabel = getChannelLabel(post);
    const service = getChannelService(post);
    const age = daysAgo(post.sentAt);
    const hasMetrics = post.metrics && (post.metrics.engagementRate > 0 || post.metrics.reactions > 0 || post.metrics.impressions > 0);
    const isTopPerformer = (post.metrics?.engagementRate || 0) > 0.02; // >2% engagement
    const isOld = age >= REPURPOSE_DAYS;
    const safeId = safeText(post.id);

    return `
      <article class="lib-post-card" data-post-id="${safeId}">
        <div class="lib-post-card-hdr">
          <div class="lib-post-meta">
            ${channelLabel ? `<span class="lib-channel-badge">${safeText(channelLabel)}</span>` : ''}
            ${service ? `<span class="lib-service-badge">${safeText(service)}</span>` : ''}
            <span class="lib-date">${fmtDate(post.sentAt)}</span>
            ${isTopPerformer ? '<span class="lib-top-badge">⭐ Top</span>' : ''}
            ${isOld && isTopPerformer ? '<span class="lib-reuse-badge">↺ Ready to reuse</span>' : ''}
          </div>
          <button class="lib-star-btn ${isStarred ? 'starred' : ''}" data-star="${safeId}" aria-label="${isStarred ? 'Unstar post' : 'Star post'}">
            ${isStarred ? '★' : '☆'}
          </button>
        </div>

        <div class="lib-post-text">${safeText(compact(post.text, 280))}</div>

        ${hasMetrics ? `<div class="lib-metrics-row">${metricBadgeHtml(post.metrics)}</div>` : ''}

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
        top: 'No posts with engagement data yet. Metrics may take time to appear.',
        reuse: `No high-performing posts older than ${REPURPOSE_DAYS} days found.`,
        starred: 'No starred posts yet. Star any post to save it here.',
        all: searchQuery ? 'No posts match that search.' : 'No sent posts found.',
      };
      renderEmpty(msgs[activeTab] || msgs.all);
      return;
    }

    list.innerHTML = filtered.map(postCardHtml).join('');

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
    const withMetrics = posts.filter(p => p.metrics?.engagementRate > 0).length;
    const top = topPerformers().slice(0, 1)[0];
    const topEr = top ? pct(top.metrics?.engagementRate) : null;
    const syncAge = lastFetchAt ? Math.floor((Date.now() - lastFetchAt) / 60000) : null;

    statsEl.innerHTML = `
      <div class="lib-stat"><span class="lib-stat-num">${total}</span><span class="lib-stat-lbl">sent posts</span></div>
      <div class="lib-stat"><span class="lib-stat-num">${withMetrics}</span><span class="lib-stat-lbl">with metrics</span></div>
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

    // Load when view activates
    window.addEventListener('postiq:library-activated', () => fetchPosts());

    // Auto-load if cache available
    if (loadCache() && posts.length) render();
  }

  return {
    init,
    refresh: () => fetchPosts({ force: true }),
    activate: () => { fetchPosts(); window.dispatchEvent(new Event('postiq:library-activated')); },
  };

})();
