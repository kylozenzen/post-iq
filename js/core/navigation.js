'use strict';

// ── VIEW NAVIGATION ──────────────────────────────────
function activateView(viewId, source = 'navigation') {
  if (viewId === 'homeView' && !FEATURE_HOME_DASHBOARD) viewId = 'composerView';
  const requestedFeature = getFeatureForView(viewId);
  if (requestedFeature && !isFeatureEnabled(requestedFeature)) {
    viewId = getSafeFeatureFallbackView();
  }
  const requestedWorkspace = getWorkspaceForView(viewId);
  if (requestedWorkspace && !workspacePreferences[requestedWorkspace]) {
    viewId = WORKSPACE_VIEWS[getFirstEnabledWorkspace(workspacePreferences)];
  }
  if (document.body.dataset.gaReady) safeTrack(() => GA4_System.viewChanged(viewId, source));
  safeTrack(() => {
    if (viewId === 'composerView') GA4_Composer.composerOpened(source);
    if (viewId === 'calendarView') GA4_Calendar.calendarOpened();
    if (viewId === 'ideasView') GA4_Ideas.ideasOpened();
    if (viewId === 'approvalsView') GA4_Approvals.approvalsOpened();
  });
  if (viewId === 'libraryView' && isFeatureEnabled('library') && window.PostIQLibrary) window.PostIQLibrary.activate();
  if (viewId === 'pulseView' && isFeatureEnabled('pulse') && window.PostIQPulse) window.PostIQPulse.activate();
  document.body.dataset.gaReady = '1';
  currentViewId = viewId;
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x.dataset.view === viewId));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === viewId));
  document.querySelectorAll('.mob-tab[data-view]').forEach(t => t.classList.toggle('active', t.dataset.view === viewId));
  if (viewId === 'homeView' && FEATURE_HOME_DASHBOARD) renderHomeView();
  if (viewId === 'ideasView') setIdeasTab(currentIdeasTab || 'notebook');
  window.dispatchEvent(new CustomEvent('postiq:view-changed', { detail: { viewId, source } }));
}
window.activateView = activateView;

function setIdeasTab(tabId = 'notebook') {
  if (tabId === 'trending' && !getFeatureFlag('trending')) { showFeaturePaused('trending'); tabId = 'notebook'; }
  const tab = ['notebook', 'pillars', 'templates', 'trending'].includes(tabId) ? tabId : 'notebook';
  currentIdeasTab = tab;
  safeTrack(() => GA4_Ideas.tabSwitched(tab));
  if (tab === 'pillars') safeTrack(() => GA4_Pillars.builderOpened());
  if (tab === 'trending') safeTrack(() => GA4_Trending.trendingOpened());
  document.querySelectorAll('.ideas-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ideasTab === tab);
  });
  document.querySelectorAll('[data-ideas-panel]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.ideasPanel === tab);
  });
}

// ── SCHEDULE PICKERS ──────────────────────────────────
function buildTimePickers() {
  const h = qs('scheduleHour'), m = qs('scheduleMin'), ap = qs('scheduleAmpm');
  if (!h || !m || !ap) return;
  for (let i = 1; i <= 12; i++) { const o = document.createElement('option'); o.value = i; o.textContent = String(i).padStart(2, '0'); h.appendChild(o); }
  for (let i = 0; i < 60; i += 5) { const o = document.createElement('option'); o.value = i; o.textContent = String(i).padStart(2, '0'); m.appendChild(o); }
  ['AM','PM'].forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; ap.appendChild(o); });
  const now = new Date(); h.value = (now.getHours() % 12) || 12; m.value = 0; ap.value = now.getHours() >= 12 ? 'PM' : 'AM';
}

function syncComposerWhen() {
  const dateEl = qs('scheduleDate'), hourEl = qs('scheduleHour'), minEl = qs('scheduleMin'), ampmEl = qs('scheduleAmpm'), whenEl = qs('composerWhen');
  if (!dateEl || !hourEl || !minEl || !ampmEl || !whenEl) return;
  const d = dateEl.value; if (!d) { whenEl.value = ''; return; }
  let h = parseInt(hourEl.value); const m = parseInt(minEl.value); const ap = ampmEl.value;
  if (ap === 'PM' && h !== 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
  whenEl.value = `${d}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`;
}


function getGreetingLabel() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function getHomeDisplayName() {
  const channelName = (state.channels || []).find(ch => ch && ch.name)?.name || '';
  const savedName = localStorage.getItem('postiq_display_name') || '';
  const fromChannel = String(channelName).replace(/^@/, '').trim();
  const fromSettings = String(savedName).trim();
  return fromChannel || fromSettings || 'there';
}
function getScheduledPostsForRange(startDate, endDate) {
  const startMs = +startDate; const endMs = +endDate;
  return (state.scheduled || []).filter(p => {
    const due = new Date(p.due_at || p.dueAt || p.scheduled_at || p.scheduledAt || 0).getTime();
    return due >= startMs && due <= endMs;
  });
}
function getQueueHealth(posts = []) {
  const now = new Date();
  const settings = getPlanningSettings();
  const next7 = getScheduledPostsForRange(now, new Date(now.getTime() + 7 * 86400000));
  const byDay = new Set(next7.map(p => fmtDate(new Date(p.due_at || p.dueAt || p.scheduled_at || p.scheduledAt))));
  const activeChannels = new Set(next7.map(p => String(p.service || p.channel_service || p.channel_id || p.channel || 'Unknown')));
  const weekGaps = (settings.postingDays || []).filter(code => {
    const idx = DAY_CODES.indexOf(code);
    if (idx < 0) return false;
    const d = new Date(now);
    d.setDate(now.getDate() + ((idx - now.getDay() + 7) % 7));
    return !byDay.has(fmtDate(d));
  });
  return { next7, byDayCount: byDay.size, weekGaps, activeChannelsCount: activeChannels.size };
}
function getNext72HoursPosts(posts = []) {
  const now = new Date();
  return getScheduledPostsForRange(now, new Date(now.getTime() + 72 * 3600000))
    .sort((a, b) => new Date(a.due_at || a.dueAt || 0) - new Date(b.due_at || b.dueAt || 0))
    .slice(0, 5);
}
async function getSocialNewsForHome() {
  const feeds = [
    { source: 'rss', feed: 'buffer-blog', label: 'Buffer' },
    { source: 'rss', feed: 'social-media-today', label: 'Social Media Today' },
  ];
  const out = [];
  for (const f of feeds) {
    try {
      const res = await fetch('/.netlify/functions/trending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(f),
      });
      if (!res.ok) continue;
      const data = await res.json();
      (data?.posts || []).slice(0, 2).forEach(p => out.push({ ...p, _source: f.label }));
    } catch {}
  }
  return out;
}
function getHomeDashboardData() {
  const now = new Date();
  const connection = getBufferConnectionState?.() || { connected: false, reconnectNeeded: false };
  const connected = !!connection.connected;
  const queue = getQueueHealth(state?.scheduled || []);
  const next72 = getNext72HoursPosts(state?.scheduled || []);
  const hasScheduledPosts = Array.isArray(state?.scheduled) && state.scheduled.length > 0;
  return { now, connected, reconnectNeeded: !!connection.reconnectNeeded, displayName: getHomeDisplayName(), queue, next72, hasScheduledPosts };
}
async function renderHomeView() {
  if (!FEATURE_HOME_DASHBOARD) return;
  let d;
  try {
    d = getHomeDashboardData();
  } catch (err) {
    d = { connected: false, reconnectNeeded: false, displayName: getHomeDisplayName(), queue: { next7: [], byDayCount: 0, weekGaps: [], activeChannelsCount: 0 }, next72: [], hasScheduledPosts: false };
    if (!homeDashboardWarned) {
      console.warn('Home dashboard data unavailable; rendering fallback state.', err);
      homeDashboardWarned = true;
    }
  }
  const q = d.queue || { next7: [], byDayCount: 0, weekGaps: [], activeChannelsCount: 0 };
  const syncedText = qs('lastSynced')?.textContent?.trim();
  const isConnectedNoData = d.connected && !d.hasScheduledPosts;
  const coveragePct = Math.max(0, Math.min(100, Math.round(((q.byDayCount || 0) / 7) * 100)));

  const welcome = qs('homeWelcomeCard');
  if (welcome) welcome.innerHTML = `<div class="home-kicker">Command Center</div><div class="home-title">${safeText(getGreetingLabel())}${d.displayName && d.displayName !== 'there' ? `, ${safeText(d.displayName)}` : ''}.</div><div class="home-copy">${d.connected ? (isConnectedNoData ? 'Connected. Click Sync now to load Buffer posts.' : 'Here’s what’s happening in your content queue.') : 'Connect Buffer to unlock your dashboard.'}</div><div class="home-status-pills"><span class="home-status-pill ${d.connected ? 'connected' : 'offline'}">${d.connected ? 'Connected' : (d.reconnectNeeded ? 'Reconnect needed' : 'Not connected')}</span><span class="home-status-pill">${q.next7?.length || 0} scheduled</span><span class="home-status-pill ${q.weekGaps?.length ? 'gap' : ''}">${q.weekGaps?.length || 0} gaps</span><span class="home-status-pill">${q.activeChannelsCount || 0} channels</span>${syncedText ? `<span class="home-status-pill">${safeText(syncedText)}</span>` : ''}</div><div class="home-actions-row"><button class="btn sm primary" id="homeSyncBtn">${d.connected ? '↻ Sync now' : (d.reconnectNeeded ? 'Reconnect Buffer' : 'Sign in with Buffer')}</button></div>`;

  const gapSummary = q.weekGaps?.length ? `Coverage needs attention: ${q.weekGaps.map(code => DAY_LABELS[DAY_CODES.indexOf(code)]).join(', ')} currently look open.` : 'Nice work — no configured posting-day gaps this week.';
  const qh = qs('homeQueueHealth');
  if (qh) qh.innerHTML = `<div class="home-kicker">Queue Health</div><div class="home-title">Current week snapshot</div><div class="home-copy">${!d.connected ? 'Connect Buffer to see your queue health.' : (isConnectedNoData ? 'Click Sync now to load Buffer posts.' : gapSummary)}</div><div class="home-stat-grid"><div class="home-stat"><div class="home-stat-num">${q.next7?.length || 0}</div><div class="home-stat-lbl">Scheduled</div></div><div class="home-stat"><div class="home-stat-num">${q.byDayCount || 0}</div><div class="home-stat-lbl">Days covered</div></div><div class="home-stat"><div class="home-stat-num">${q.weekGaps?.length || 0}</div><div class="home-stat-lbl">Gaps this week</div></div><div class="home-stat"><div class="home-stat-num">${q.activeChannelsCount || 0}</div><div class="home-stat-lbl">Channels</div></div></div><div class="home-coverage-wrap"><div class="home-item-meta">Coverage ${coveragePct}%</div><div class="home-coverage-bar"><span style="width:${coveragePct}%"></span></div></div>`;

  const next = qs('homeNext72');
  const nextItems = (d.next72 || []).slice(0, 5);
  const nextEmptyText = !d.connected ? 'Connect Buffer to see upcoming posts.' : (isConnectedNoData ? 'Sync Buffer to see upcoming posts.' : 'No scheduled posts in the next 72 hours.');
  const fmtDay = dt => { const now=new Date(); const t=new Date(dt); const delta=Math.floor((new Date(t.getFullYear(),t.getMonth(),t.getDate())-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/86400000); if(delta===0) return 'Today'; if(delta===1) return 'Tomorrow'; return t.toLocaleDateString(undefined,{weekday:'short'}); };
  if (next) next.innerHTML = `<div class="home-kicker">Next 72 Hours</div><div class="home-title">Upcoming scheduled posts</div><div class="home-post-list">${nextItems.length ? nextItems.map(p => { const due = new Date(p?.due_at || p?.dueAt || 0); return `<div class="home-post-item"><div class="home-item-meta">${fmtDay(due)} · ${due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${safeText(p?.service || p?.channel || 'Channel')}</div><div class="home-item-title">${safeText(compact(p?.text || p?.description || p?.body || '', 150))}</div></div>`; }).join('') : `<div class="home-post-item"><div class="home-item-title">${nextEmptyText}</div></div>`}</div><div class="home-actions-row"><button class="btn sm" id="homeViewCalendarBtn">View in calendar</button></div>`;

  const news = qs('homeNews');
  if (news) {
    news.innerHTML = `<div class="home-kicker">Social News</div><div class="home-title">Social News</div><div class="home-copy">Fresh platform updates and content signals worth watching.</div><div class="home-social-grid"><div class="home-news-card"><div class="home-item-title">Loading stories…</div></div></div>`;
    try {
      const items = await getSocialNewsForHome();
      const bySource = {
        Buffer: (items || []).filter(i => i?._source === 'Buffer').slice(0, 2),
        'Social Media Today': (items || []).filter(i => i?._source === 'Social Media Today').slice(0, 2),
      };
      const cards = [];
      const pushSourceCards = (source, emptyText) => {
        const srcItems = bySource[source] || [];
        for (let i = 0; i < 2; i += 1) {
          const item = srcItems[i];
          if (item) cards.push(item);
          else cards.push({ _source: source, _empty: true, title: emptyText });
        }
      };
      pushSourceCards('Buffer', 'No new Buffer stories loaded yet.');
      pushSourceCards('Social Media Today', 'No Social Media Today stories loaded yet.');
      window.__homeNewsItems = cards;
      news.innerHTML = `<div class="home-kicker">Social News</div><div class="home-title">Social News</div><div class="home-copy">Fresh platform updates and content signals worth watching.</div><div class="home-social-grid">${cards.map((n, idx) => `<div class="home-news-card ${n._empty ? 'empty' : ''}"><div class="home-news-source ${n?._source === 'Buffer' ? 'buffer' : 'smt'}">${safeText(n?._source || 'Source')}</div><div class="home-item-title">${safeText(compact(n?.title || 'Untitled', 140))}</div><div class="home-item-meta">${safeText(n?.publishedAt ? new Date(n.publishedAt).toLocaleDateString() : '')}</div><div class="home-actions-row">${n._empty ? '' : `<a class="btn sm ghost" href="${safeText(toSafeExternalUrl(n?.url || n?.link || n?.permalink) || '#')}" target="_blank" rel="noopener">Open</a><button class="btn sm" data-home-use-idea="${idx}">Use as idea</button>`}</div></div>`).join('')}</div>`;
    } catch {
      window.__homeNewsItems = [];
      news.innerHTML = `<div class="home-kicker">Social News</div><div class="home-title">Social News</div><div class="home-copy">Social news will appear here once sources are loaded.</div><div class="home-social-grid"><div class="home-news-card empty"><div class="home-item-title">Social news will appear here once sources are loaded.</div></div></div>`;
    }
  }

  const note = qs('homeDevNote');
  if (note) note.innerHTML = `<div class="home-kicker">Message from the dev team</div><div class="home-title">Message from the dev team</div><div class="home-copy">PostIQ is still in beta, which means some edges may be weird. If something feels clunky, useful, confusing, or weirdly magical, I want to know.</div><div class="home-actions-row"><a class="btn sm" href="mailto:hello@postiq.app?subject=PostIQ%20beta%20feedback">Send feedback</a></div>`;

  const qa = qs('homeQuickActions');
  if (qa) qa.innerHTML = `<div class="home-kicker">Quick Actions</div><div class="home-title">Quick Actions</div><div class="home-action-grid"><button class="home-action-card" data-home-action="compose"><span class="home-action-icon">✍️</span><span class="home-action-title">New Post</span><span class="home-action-copy">Start a fresh draft.</span></button><button class="home-action-card" data-home-action="gap"><span class="home-action-icon">🧩</span><span class="home-action-title">Fill Gap</span><span class="home-action-copy">Patch an empty spot in your week.</span></button><button class="home-action-card" data-home-action="snapshot"><span class="home-action-icon">📸</span><span class="home-action-title">Create Snapshot</span><span class="home-action-copy">Share the plan without another login.</span></button><a class="home-action-card" href="https://publish.buffer.com/" target="_blank" rel="noopener"><span class="home-action-icon">↗</span><span class="home-action-title">Open Buffer</span><span class="home-action-copy">Jump to publishing.</span></a></div>`;
}
function initHomeView() {
  if (!FEATURE_HOME_DASHBOARD) return;
  renderHomeView();
  if (homeActionsBound) return;
  homeActionsBound = true;
  document.addEventListener('click', e => {
    const a=e.target.closest('[data-home-action]'); if (a){ const v=a.dataset.homeAction; if (v==='compose'){activateView('composerView');} if (v==='gap'){activateView('calendarView');} if (v==='snapshot'){activateView('calendarView'); openShareSnapshotModal();} }
    if (e.target.id==='homeViewCalendarBtn') activateView('calendarView');
    if (e.target.id==='homeSyncBtn') { const connection = getBufferConnectionState(); if (connection.connected) syncBuffer({force:true}); else goToBufferConnect(); }
    const ideaBtn = e.target.closest('[data-home-use-idea]');
    if (ideaBtn) {
      const item = (window.__homeNewsItems || [])[Number(ideaBtn.dataset.homeUseIdea)];
      if (item && !item._empty) {
        activateView('composerView');
        const ed = qs('composerEditor');
        if (ed) {
          const sourceUrl = toSafeExternalUrl(item.url || item.link || item.permalink);
          ed.textContent = `Idea from ${item._source || 'news'}:\n${item.title || ''}${sourceUrl ? `\n${sourceUrl}` : ''}\n\nMy take: `;
          ed.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
          updateComposerClearButtonVisibility();
        }
      }
    }
  });
}
