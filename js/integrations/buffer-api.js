'use strict';

// ── CACHE ──────────────────────────────────────────
function loadCacheState() {
  try {
    const raw = localStorage.getItem(CACHE_KEY); if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.keys(cache).forEach(key => {
      if (parsed[key]?.ts) cache[key] = { value: parsed[key].value, ts: parsed[key].ts };
    });
  } catch {}
}
function saveCacheState() { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {} }
function isCacheFresh(key) { return !!cache[key]?.ts && (Date.now() - cache[key].ts) < CACHE_TTL[key]; }
function hydrateFromCache() {
  if (cache.orgId.value) state.organizationId = cache.orgId.value;
  if (Array.isArray(cache.channels.value) && cache.channels.value.length) state.channels = cache.channels.value;
  if (Array.isArray(cache.scheduled.value) && cache.scheduled.value.length) state.scheduled = cache.scheduled.value;
  if (Array.isArray(cache.published.value)) state.published = cache.published.value;
}
function clearSyncedData() {
  state.channels = []; state.scheduled = []; state.published = []; state.organizationId = null;
  Object.keys(cache).forEach(k => { cache[k] = { value: Array.isArray(cache[k]?.value) ? [] : null, ts: 0 }; });
  try { localStorage.removeItem(CACHE_KEY); } catch {}
  renderChannelSelects(); renderCalendar();
}

// ── BUFFER API ──────────────────────────────────────
// Only a transport status or an explicit auth code proves the Buffer session is
// dead. Error *text* never decides: Buffer says "invalid" about post input,
// "expired" about media links, and "forbidden" about fields the experimental
// schema gates, and reading those as auth failures asks people to reconnect a
// key that works perfectly well.
const AUTH_ERROR_CODES = ['AUTH_ERROR', 'UNAUTHENTICATED', 'UNAUTHORIZED', 'UNAUTHORIZED_ERROR'];
const NON_AUTH_ERROR_CODES = [
  'ORIGIN_NOT_ALLOWED', 'BAD_REQUEST', 'QUERY_TOO_LARGE', 'RATE_LIMIT',
  'PROXY_NETWORK_ERROR', 'PROXY_TIMEOUT', 'PROXY_BAD_RESPONSE',
  'BUFFER_NON_JSON', 'BUFFER_SERVER_ERROR', 'REFRESH_NETWORK_ERROR',
];

function isAuthError(err) {
  const code = String(err?.code || '').toUpperCase();
  if (AUTH_ERROR_CODES.includes(code)) return true;
  if (NON_AUTH_ERROR_CODES.includes(code)) return false;
  return err?.status === 401 || err?.status === 403;
}

async function callBuffer(query, variables = {}, options = {}) {
  const activeToken = await getActiveBufferToken();
  if (!activeToken?.token) throw Object.assign(new Error(hasReconnectNeeded() ? 'Buffer connection expired' : 'No Buffer token'), { code: hasReconnectNeeded() ? 'AUTH_ERROR' : 'MISSING_TOKEN', status: hasReconnectNeeded() ? 401 : undefined });
  let res;
  try { res = await fetch('/.netlify/functions/buffer-proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: activeToken.token, query, variables }) }); }
  catch (err) { throw Object.assign(new Error('Network error'), { code: 'PROXY_NETWORK_ERROR', retryable: true, cause: err }); }
  let data;
  try { data = await res.json(); } catch { throw Object.assign(new Error('Invalid proxy response'), { code: 'PROXY_BAD_RESPONSE' }); }
  if (data.errors?.length && !data.data) {
    const first = data.errors[0] || {};
    const error = Object.assign(new Error(first.message || 'Buffer request failed'), { code: first.code || 'BUFFER_ERROR', status: first.status, retryable: !!first.retryable, retryAfter: first.retryAfter });
    if (activeToken.source === 'oauth' && isAuthError(error)) {
      // An access token can age out between two calls. Refresh once and replay
      // before telling anyone their connection is gone.
      if (!options.isRetry && getStoredOAuthToken()?.refreshToken) {
        try {
          await refreshBufferOAuthToken();
          return await callBuffer(query, variables, { ...options, isRetry: true });
        } catch (refreshError) {
          if (refreshError?.retryable) throw refreshError;
        }
      }
      markBufferReconnectNeeded();
    }
    throw error;
  }
  handleBufferWarnings(data);
  return data;
}

function getErrorMessage(err, fallback = 'Request failed. Please try again.') {
  const code = String(err?.code || '').toUpperCase();
  const msg  = String(err?.message || '');
  if (code === 'MISSING_TOKEN') return 'Sign in with Buffer first.';
  if (code === 'RATE_LIMIT' || err?.status === 429) return `Buffer rate limit hit.${err?.retryAfter ? ` Retry in ${err.retryAfter}s.` : ''}`;
  if (isAuthError(err)) return 'Buffer sign-in expired. Reconnect Buffer.';
  if (code === 'LIMIT_REACHED_ERROR') return msg || 'Buffer plan limit reached. Clear space in the queue and try again.';
  if (code === 'PROXY_NETWORK_ERROR' || code === 'PROXY_TIMEOUT' || code === 'REFRESH_NETWORK_ERROR') return 'Network issue reaching Buffer. Check connection and retry.';
  return msg || fallback;
}

function handleAuthFailure(msg) {
  bufferToken = '';
  if (getBufferConnectionState().source === 'oauth') markBufferReconnectNeeded();
  clearSyncedData(); renderConnectionUI();
  setSyncStatus('failed', msg);
}

// ── SYNC ──────────────────────────────────────────
function setSyncStatus(state_, msg) {
  state.syncState = state_;
  const el = qs('syncStatus'); if (!el) return;
  el.textContent = msg;
  const lastEl = qs('lastSynced');
  if (state_ === 'success' && lastEl) lastEl.textContent = `Synced at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

async function getOrgId({ force = false } = {}) {
  if (!force && state.organizationId && isCacheFresh('orgId')) return state.organizationId;
  const acc = await callBuffer('query { account { organizations { id name } } }');
  const orgId = acc?.data?.account?.organizations?.[0]?.id || null;
  if (orgId) { state.organizationId = orgId; cache.orgId = { value: orgId, ts: Date.now() }; }
  return orgId;
}

async function getChannels({ force = false } = {}) {
  if (!force && state.channels.length && isCacheFresh('channels')) return state.channels;
  const orgId = await getOrgId({ force });
  if (!orgId) return [];
  const q = 'query C($organizationId: OrganizationId!) { channels(input:{organizationId:$organizationId}){ id displayName name service } }';
  const ch = await callBuffer(q, { organizationId: orgId });
  state.channels = ch?.data?.channels || [];
  cache.channels = { value: state.channels, ts: Date.now() };
  return state.channels;
}

async function getScheduledPosts({ force = false } = {}) {
  if (!force && state.scheduled.length && isCacheFresh('scheduled')) return state.scheduled;
  const orgId = await getOrgId({ force });
  if (!orgId) return [];
  const bounds = getScheduledBounds();
  let all = [], after = null, hasNext = true, fetched = 0;
  const seen = new Set();
  const q = 'query P($organizationId: OrganizationId!, $after: String, $first: Int!) { posts(first:$first,after:$after,input:{organizationId:$organizationId,filter:{status:[scheduled]}}){edges{node{id text dueAt channelId}} pageInfo{hasNextPage endCursor} } }';
  while (hasNext && fetched < 200 && all.length < 200) {
    const page = await callBuffer(q, { organizationId: orgId, after, first: 50 });
    const block = page?.data?.posts;
    (block?.edges || []).forEach(e => {
      const post = e?.node;
      if (!post?.id || seen.has(post.id)) return;
      const due = new Date(post.dueAt);
      if (due >= bounds.start && due <= bounds.end) { seen.add(post.id); all.push(post); }
    });
    hasNext = !!block?.pageInfo?.hasNextPage; after = block?.pageInfo?.endCursor || null; fetched += (block?.edges || []).length;
    if (!block?.pageInfo) break;
  }
  all.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  state.scheduled = all;
  cache.scheduled = { value: all, ts: Date.now() };
  saveCacheState();
  return all;
}

function getScheduledBounds() {
  const m = state.month;
  const start = new Date(m.getFullYear(), m.getMonth(), 1); start.setDate(start.getDate() - 7);
  const end = new Date(m.getFullYear(), m.getMonth() + 1, 0); end.setDate(end.getDate() + 60);
  return { start, end };
}

function isPublishedPost(post) {
  return ['sent', 'published'].includes(String(post?.status || '').toLowerCase());
}

function getPostPlanningAt(post) {
  return isPublishedPost(post)
    ? (post?.sentAt || post?.publishedAt || post?.dueAt || post?.createdAt || null)
    : (post?.dueAt || post?.scheduledAt || post?.createdAt || null);
}

function getPlannerPosts() {
  const byId = new Map();
  [...(state.published || []), ...(state.scheduled || [])].forEach((post, index) => {
    if (!post) return;
    const fallback = `${getPostPlanningAt(post) || ''}|${post.channelId || ''}|${post.text || ''}|${index}`;
    const key = String(post.id || fallback);
    const existing = byId.get(key);
    if (!existing || (!isPublishedPost(existing) && isPublishedPost(post))) byId.set(key, post);
  });
  return [...byId.values()].sort((a, b) => new Date(getPostPlanningAt(a) || 0) - new Date(getPostPlanningAt(b) || 0));
}

function postsForDateKey(dateKey) {
  return getPlannerPosts().filter(post => fmtDate(getPostPlanningAt(post)) === dateKey);
}

function plannerDaySummary(posts = []) {
  const published = posts.filter(isPublishedPost).length;
  const scheduled = posts.length - published;
  const parts = [];
  if (published) parts.push(`${published} published`);
  if (scheduled) parts.push(`${scheduled} scheduled`);
  return parts.join(' · ') || 'Open day';
}

async function getPublishedPosts({ force = false } = {}) {
  if (!force && isCacheFresh('published')) return state.published || [];
  const orgId = await getOrgId({ force });
  if (!orgId) return [];
  const bounds = getScheduledBounds();
  let all = [], after = null, hasNext = true, fetched = 0;
  const seen = new Set();
  const q = 'query SentPosts($organizationId: OrganizationId!, $after: String, $first: Int!) { posts(first:$first,after:$after,input:{organizationId:$organizationId,filter:{status:[sent]},sort:[{field:createdAt,direction:desc}]}){edges{node{id text createdAt sentAt channelId externalLink assets{thumbnail mimeType source}}} pageInfo{hasNextPage endCursor}} }';
  while (hasNext && fetched < 500) {
    const page = await callBuffer(q, { organizationId: orgId, after, first: 100 });
    const block = page?.data?.posts;
    const edges = block?.edges || [];
    edges.forEach(edge => {
      const post = edge?.node;
      if (!post?.id || seen.has(post.id)) return;
      const sentAt = post.sentAt || post.createdAt;
      const sent = new Date(sentAt || 0);
      if (!Number.isNaN(sent.getTime()) && sent >= bounds.start && sent <= bounds.end) {
        seen.add(post.id);
        all.push({ ...post, dueAt: sentAt, status: 'sent' });
      }
    });
    fetched += edges.length;
    hasNext = !!block?.pageInfo?.hasNextPage;
    after = block?.pageInfo?.endCursor || null;
    if (!block?.pageInfo || !edges.length) break;
    const oldest = edges[edges.length - 1]?.node;
    const oldestAt = new Date(oldest?.sentAt || oldest?.createdAt || 0);
    if (!Number.isNaN(oldestAt.getTime()) && oldestAt < bounds.start) break;
  }
  all.sort((a, b) => new Date(getPostPlanningAt(a) || 0) - new Date(getPostPlanningAt(b) || 0));
  state.published = all;
  cache.published = { value: all, ts: Date.now() };
  saveCacheState();
  return all;
}

async function syncBuffer({ force = false } = {}) {
  const connection = syncBufferTokenFromState();
  const oauthToken = getStoredOAuthToken();
  if (connection.reconnectNeeded) { renderConnectionUI(); setSyncStatus('failed', 'Reconnect Buffer to keep syncing.'); return; }
  if (!connection.connected && !oauthToken?.accessToken && !oauthToken?.refreshToken) { renderConnectionUI(); setSyncStatus('failed', 'Sign in with Buffer first.'); return; }
  const syncStartTime = Date.now();
  safeTrack(() => GA4_Auth.syncStarted());
  setSyncStatus('syncing', 'Syncing…');
  const btn = qs('syncBtn'); const orig = btn.innerHTML;
  btn.innerHTML = '↻ Syncing…'; btn.disabled = true;
  try {
    const orgId = await getOrgId({ force });
    if (!orgId) { clearSyncedData(); setSyncStatus('failed', 'No organization found.'); safeTrack(() => GA4_Auth.syncFailed('not_found')); return; }
    await getChannels({ force });
    const [scheduledPosts, publishedPosts] = await Promise.all([
      getScheduledPosts({ force }),
      getPublishedPosts({ force })
    ]);
    const plannerPosts = getPlannerPosts();
    renderChannelSelects();
    renderCalendar();
    detectQueueGaps();
    setSyncStatus('success', `${scheduledPosts.length} scheduled · ${publishedPosts.length} published.`);
    renderConnectionUI();
  initHomeView();
    showToast(`Loaded ${plannerPosts.length} planner posts`, 'success');
    safeTrack(() => GA4_Auth.syncComplete({ postCount: plannerPosts.length, channelCount: state.channels.length, syncTimeMs: Date.now() - syncStartTime, usedCache: false }));
    safeTrack(() => GA4_System.performanceMetric('buffer_sync', Date.now() - syncStartTime));
    if (state.organizationId) safeTrack(() => GA4.setUserIdentity(state.organizationId, { connected: true, channelCount: state.channels.length, queueDepth: state.scheduled.length, hasApprovals: getAllApprovalMetas().length > 0 }));
    window.dispatchEvent(new Event('postiq:synced'));
  } catch (e) {
    const msg = getErrorMessage(e, 'Sync failed.');
    if (isAuthError(e)) handleAuthFailure(msg);
    else setSyncStatus('failed', msg);
    showToast(msg, 'error');
    safeTrack(() => GA4_Auth.syncFailed(getErrorType(e)));
    safeTrack(() => GA4_System.applicationError(e, 'buffer_api'));
  } finally { btn.innerHTML = orig; btn.disabled = false; }
}
