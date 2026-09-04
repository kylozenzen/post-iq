'use strict';

// ── TOKEN / CONNECTION STATE ──────────────────────────
function getStoredValue(key) {
  return sessionStorage.getItem(key) || localStorage.getItem(key) || '';
}

function getManualBufferToken() {
  return getStoredValue(STORE_KEY);
}


function getOAuthStorageForKey(key) {
  if (sessionStorage.getItem(key)) return sessionStorage;
  if (localStorage.getItem(key)) return localStorage;
  return sessionStorage;
}

function setStoredOAuthValue(key, value) {
  const store = getOAuthStorageForKey(OAUTH_REFRESH_TOKEN_KEY) || localStorage;
  if (value === undefined || value === null || value === '') {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
    return;
  }
  store.setItem(key, String(value));
  const other = store === sessionStorage ? localStorage : sessionStorage;
  other.removeItem(key);
}

function getStoredOAuthToken() {
  const accessToken = getStoredValue(OAUTH_ACCESS_TOKEN_KEY).trim();
  const refreshToken = getStoredValue(OAUTH_REFRESH_TOKEN_KEY).trim();
  const rawExpiresAt = getStoredValue(OAUTH_EXPIRES_AT_KEY).trim();
  const expiresAt = rawExpiresAt ? Number(rawExpiresAt) || null : null;
  if (!accessToken && !refreshToken && !expiresAt) return null;
  return {
    accessToken,
    refreshToken,
    tokenType: getStoredValue(OAUTH_TOKEN_TYPE_KEY).trim() || 'Bearer',
    scope: getStoredValue(OAUTH_SCOPE_KEY).trim(),
    expiresAt,
  };
}

function isOAuthTokenExpired(bufferMs = 5 * 60 * 1000) {
  const token = getStoredOAuthToken();
  if (!token?.accessToken) return false;
  // A missing expiry is not evidence of expiry — Buffer does not always return
  // expires_in. Treating "unknown" as "expired" forced a refresh on every call
  // and turned any refresh hiccup into a reconnect prompt for a working token.
  // Buffer answers with a 401 if the token really is dead; that drives refresh.
  if (!token.expiresAt) return false;
  return Date.now() >= token.expiresAt - bufferMs;
}

function hasReconnectNeeded() {
  if (getStoredValue(OAUTH_RECONNECT_NEEDED_KEY) !== '1') return false;
  // A flag left behind by an earlier failure must not outlive a working token.
  const token = getStoredOAuthToken();
  if (token?.accessToken && !isOAuthTokenExpired(0)) { clearReconnectNeeded(); return false; }
  return true;
}

function clearReconnectNeeded() {
  sessionStorage.removeItem(OAUTH_RECONNECT_NEEDED_KEY);
  localStorage.removeItem(OAUTH_RECONNECT_NEEDED_KEY);
}

function markBufferReconnectNeeded() {
  // Reconnect state is used when Buffer rejects the grant, so the main UI can
  // ask users to sign in again. The rejected access token goes with it —
  // otherwise a stale flag and a stale token disagree with each other forever.
  sessionStorage.removeItem(OAUTH_ACCESS_TOKEN_KEY);
  localStorage.removeItem(OAUTH_ACCESS_TOKEN_KEY);
  const store = getOAuthStorageForKey(OAUTH_REFRESH_TOKEN_KEY) || sessionStorage;
  store.setItem(OAUTH_RECONNECT_NEEDED_KEY, '1');
  bufferToken = '';
  renderConnectionUI();
  initHomeView();
  setSyncStatus('failed', 'Reconnect Buffer to keep syncing.');
}

const BUFFER_TOKEN_ENDPOINT = '/.netlify/functions/buffer-token';

async function refreshBufferOAuthToken() {
  const token = getStoredOAuthToken();
  if (!token?.refreshToken) throw Object.assign(new Error('No Buffer refresh token'), { code: 'MISSING_REFRESH_TOKEN' });

  // Public OAuth clients refresh without a browser secret, but Buffer's token
  // endpoint is not callable from page JavaScript, so the refresh goes through
  // PostIQ's own Netlify function — the same exchange the OAuth callback uses.
  // Calling auth.buffer.com directly from the browser made every refresh throw,
  // which surfaced as "expired key, reconnect" on a perfectly healthy grant.
  let response;
  try {
    response = await fetch(BUFFER_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: BUFFER_CLIENT_ID, grant_type: 'refresh_token', refresh_token: token.refreshToken }),
    });
  } catch (err) {
    // The network failed; the grant is untouched. Do not force a reconnect.
    throw Object.assign(new Error('Could not reach Buffer to refresh the connection'), { code: 'REFRESH_NETWORK_ERROR', retryable: true, cause: err });
  }

  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok && response.status >= 500) {
    throw Object.assign(new Error(data?.error_description || data?.error || 'Buffer could not refresh the connection right now'), { code: 'REFRESH_NETWORK_ERROR', retryable: true, status: response.status });
  }
  if (!response.ok || !data?.access_token) {
    // Buffer rejected the grant itself. This is the one case that needs a new sign-in.
    markBufferReconnectNeeded();
    throw Object.assign(new Error(data?.error_description || data?.error || 'Could not refresh Buffer connection'), { code: 'AUTH_ERROR', status: response.status || 401 });
  }

  clearReconnectNeeded();
  setStoredOAuthValue(OAUTH_ACCESS_TOKEN_KEY, data.access_token);
  if (data.refresh_token) setStoredOAuthValue(OAUTH_REFRESH_TOKEN_KEY, data.refresh_token);
  setStoredOAuthValue(OAUTH_TOKEN_TYPE_KEY, data.token_type || token.tokenType || 'Bearer');
  const scope = Array.isArray(data.scope) ? data.scope.join(' ') : (data.scope || token.scope || '');
  setStoredOAuthValue(OAUTH_SCOPE_KEY, scope);
  const expiresIn = Number(data.expires_in || 0);
  setStoredOAuthValue(OAUTH_EXPIRES_AT_KEY, expiresIn ? Date.now() + expiresIn * 1000 : '');
  renderConnectionUI();
  initHomeView();
  safeTrack(() => GA4_Auth.tokenRefreshed('automatic'));
  return getStoredOAuthToken();
}

async function getActiveBufferToken() {
  const oauthToken = getStoredOAuthToken();

  if (oauthToken?.accessToken && !isOAuthTokenExpired()) {
    clearReconnectNeeded();
    return { token: oauthToken.accessToken, source: 'oauth' };
  }

  // A refresh token is a working connection even when the access token is gone
  // or stale, so spend it before asking anyone to sign in again.
  if (oauthToken?.refreshToken) {
    try {
      const refreshed = await refreshBufferOAuthToken();
      if (refreshed?.accessToken) return { token: refreshed.accessToken, source: 'oauth' };
    } catch (error) {
      safeTrack(() => GA4_Auth.tokenRefreshFailed());
      safeTrack(() => GA4_System.applicationError(error, 'authentication'));
      // A transient failure is not a dead grant: keep whatever token we still
      // hold and let Buffer be the one to reject it.
      if (error?.retryable) return oauthToken.accessToken ? { token: oauthToken.accessToken, source: 'oauth' } : null;
      markBufferReconnectNeeded();
      return null;
    }
  }

  if (oauthToken?.accessToken) {
    clearReconnectNeeded();
    return { token: oauthToken.accessToken, source: 'oauth' };
  }
  if (hasReconnectNeeded()) return null;

  const manualToken = getManualBufferToken().trim();
  return manualToken ? { token: manualToken, source: 'manual' } : null;
}

function getPostIQOrganizationId(options = {}) {
  const force = !!options?.force;
  if (!force && state.organizationId) return state.organizationId;
  if (!force && cache.orgId.value) return cache.orgId.value;
  if (force) return getOrgId({ force: true });
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const cachedOrgId = parsed?.orgId?.value || null;
    if (cachedOrgId) {
      state.organizationId = cachedOrgId;
      cache.orgId = { value: cachedOrgId, ts: parsed?.orgId?.ts || Date.now() };
    }
    return cachedOrgId;
  } catch {
    return null;
  }
}

function getPostIQChannels() {
  if (Array.isArray(state.channels) && state.channels.length) return state.channels;
  if (Array.isArray(cache.channels.value) && cache.channels.value.length) return cache.channels.value;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.channels?.value) ? parsed.channels.value : [];
  } catch {
    return [];
  }
}

window.getPostIQOrganizationId = getPostIQOrganizationId;
window.getPostIQChannels = getPostIQChannels;
window.getActiveBufferToken = getActiveBufferToken;

function clearOAuthConnection() {
  [sessionStorage, localStorage].forEach(store => {
    store.removeItem(OAUTH_ACCESS_TOKEN_KEY);
    store.removeItem(OAUTH_REFRESH_TOKEN_KEY);
    store.removeItem(OAUTH_EXPIRES_AT_KEY);
    store.removeItem(OAUTH_TOKEN_TYPE_KEY);
    store.removeItem(OAUTH_SCOPE_KEY);
    store.removeItem(OAUTH_RECONNECT_NEEDED_KEY);
    store.removeItem('postiq_oauth_state');
    store.removeItem('postiq_pkce_verifier');
    store.removeItem('postiq_oauth_redirect_uri');
  });
}

function getBufferConnectionState() {
  const oauthToken = getStoredOAuthToken();
  const expired = !!(oauthToken?.accessToken && isOAuthTokenExpired(0));
  const reconnectNeeded = hasReconnectNeeded() || !!(oauthToken?.refreshToken && !oauthToken.accessToken);

  if (oauthToken?.accessToken || reconnectNeeded) {
    return {
      connected: !!(oauthToken?.accessToken && !expired && !reconnectNeeded),
      source: 'oauth',
      token: oauthToken?.accessToken || '',
      expiresAt: oauthToken?.expiresAt || null,
      expired: expired || reconnectNeeded,
      reconnectNeeded,
      label: expired || reconnectNeeded ? 'Reconnect Buffer' : 'Connected to Buffer',
    };
  }

  const manualToken = getManualBufferToken().trim();
  if (manualToken) {
    return {
      connected: true,
      source: 'manual',
      token: manualToken,
      expiresAt: null,
      expired: false,
      label: 'Connected',
    };
  }

  return {
    connected: false,
    source: 'none',
    token: '',
    expiresAt: null,
    expired: false,
    label: 'Not connected',
  };
}

function syncBufferTokenFromState() {
  const connection = getBufferConnectionState();
  bufferToken = connection.connected ? connection.token : '';
  return connection;
}

function maskPreview(t) { return t ? maskToken(t) : '—'; }

function setButtonClass(el, className) {
  if (!el) return;
  el.className = className;
}

function setTokenPanelVisible(panel, open) {
  if (!panel) return;
  if (panel.tagName === 'DETAILS') panel.open = !!open;
  else panel.style.display = open ? 'block' : 'none';
}

function selectSettingsTab(tabName) {
  const legacyCustomizeTabs = ['workspace', 'planning', 'notes'];
  let targetTab = legacyCustomizeTabs.includes(tabName) ? 'customize' : (tabName || 'connection');
  document.querySelectorAll('.settings-tab').forEach(tab => {
    if (!tab) return;
    const active = tab.dataset.stab === targetTab;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    tab.tabIndex = active ? 0 : -1;
  });
  const panel = ('settingspanel' + targetTab).toLowerCase();
  document.querySelectorAll('.settings-panel').forEach(p => {
    if (!p) return;
    const active = p.id.toLowerCase() === panel;
    p.classList.toggle('active', active);
    p.hidden = !active;
  });
  if (targetTab === 'features') renderSettingsFeatureStatus();
  if (targetTab === 'discord' && window.Discord) window.Discord.renderSettings();
}






function renderSettingsFeatureStatus() {
  document.querySelectorAll('[data-settings-feature]').forEach(el => {
    const feature = el.dataset.settingsFeature;
    const available = getFeatureFlag(feature);
    el.textContent = available ? 'Available' : 'Paused';
    el.classList.toggle('is-paused', !available);
    const notice = !available ? getFeatureNotice(feature) : '';
    if (notice) el.setAttribute('title', notice);
    else el.removeAttribute('title');
  });
  const betaMessage = qs('settingsBetaMessage');
  if (betaMessage) betaMessage.textContent = String(postiqConfig?.betaMessage || '').trim();
}


function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) {
    console.warn('[PostIQ] Missing modal:', id);
    return false;
  }
  const wasOpen = modal.classList.contains('open');
  modal.removeAttribute('hidden');
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('open');
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
  if (!wasOpen) modalCount += 1;
  return true;
}

// Explicitly expose real Settings navigation for cross-file UI entry points such as AI Assist.
window.selectSettingsTab = selectSettingsTab;
window.openModal = openModal;

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) {
    console.warn('[PostIQ] Missing modal:', id);
    return false;
  }
  const wasOpen = modal.classList.contains('open');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modal.hidden = true;
  if (wasOpen) modalCount = Math.max(0, modalCount - 1);
  if (!document.querySelector('.modal.open')) {
    modalCount = 0;
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
  }
  return true;
}

function bindModalActionDelegates() {
  if (modalActionDelegatesBound) return;
  modalActionDelegatesBound = true;

  document.addEventListener('click', async event => {
    const settingsBtn = event.target.closest('#openSettings');
    if (settingsBtn) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof selectSettingsTab === 'function') selectSettingsTab('connection');
      openModal('settingsModal');
      return;
    }

    const mobSettingsBtn = event.target.closest('#mobOpenSettings');
    if (mobSettingsBtn) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof closeMobDrawer === 'function') closeMobDrawer();
      if (typeof selectSettingsTab === 'function') selectSettingsTab('connection');
      openModal('settingsModal');
      return;
    }

    const closeSettingsBtn = event.target.closest('#closeSettings');
    if (closeSettingsBtn) {
      event.preventDefault();
      event.stopPropagation();
      closeModal('settingsModal');
      return;
    }

    const newTemplateBtn = event.target.closest('#newTemplateBtn, #newTemplateBtnMob');
    if (newTemplateBtn) {
      event.preventDefault();
      event.stopPropagation();
      openTemplateModal();
      return;
    }

    const closeTemplateBtn = event.target.closest('#closeTemplateModal, #cancelTemplateBtn');
    if (closeTemplateBtn) {
      event.preventDefault();
      event.stopPropagation();
      closeModal('templateModal');
      return;
    }

    const saveTemplateBtn = event.target.closest('#saveTemplateBtn');
    if (saveTemplateBtn) {
      event.preventDefault();
      event.stopPropagation();
      saveTemplate();
      return;
    }

    const templateActionBtn = event.target.closest('[data-template-action][data-template-id]');
    if (!templateActionBtn) return;

    event.preventDefault();
    event.stopPropagation();
    const action = templateActionBtn.dataset.templateAction;
    const id = templateActionBtn.dataset.templateId;
    if (!id) return;

    if (action === 'copy') {
      const template = state.templates.find(t => t.id === id);
      if (!template) { showToast('Template not found', 'error'); return; }
      const ok = await copyTextSafe(template.body || '');
      showToast(ok ? 'Copied' : 'Copy failed', ok ? 'success' : 'error');
      return;
    }
    if (action === 'use') {
      const template = state.templates.find(t => t.id === id);
      if (!template) { showToast('Template not found', 'error'); return; }
      activateView('composerView');
      useTemplateInEditor(template);
      return;
    }
    if (action === 'edit') { openTemplateModal(id); return; }
    if (action === 'delete') { deleteTemplate(id); return; }
  });
}





function openConnectionSettings(options = {}) {
  selectSettingsTab('connection');
  tokenPanelOpen = !!options.advancedApi;
  renderConnectionUI();
  initHomeView();
  const panel = qs('tokenPanel');
  if (options.advancedApi) setTokenPanelVisible(panel, true);

  setTimeout(() => openModal('settingsModal'), 0);
}



function getBufferConnectUrl() {
  return '/auth/connect.html?return=/app.html';
}

function goToBufferConnect() {
  location.href = getBufferConnectUrl();
}

function markAppVisited() {
  try { localStorage.setItem(APP_VISITED_KEY, '1'); } catch {}
}

function renderConnectionUI() {
  const connection = syncBufferTokenFromState();
  const connected = connection.connected;
  const expired = connection.expired;
  const reconnectNeeded = !!connection.reconnectNeeded;
  const oauthActive = connection.source === 'oauth';
  const manualActive = connection.source === 'manual';

  const manualToken = getManualBufferToken();
  const desktopPanel = qs('tokenPanel');
  if (!tokenPanelOpen) setTokenPanelVisible(desktopPanel, false);

  const primaryHeading = connected ? '' : (reconnectNeeded ? 'Reconnect Buffer' : 'Not connected');
  const helper = connected
    ? ''
    : (reconnectNeeded ? 'Your Buffer session expired. Sign in again to keep syncing.' : 'Sign in with Buffer to load your channels, plan posts, and publish from PostIQ.');
  const statusLabel = connected ? (oauthActive ? 'Connected to Buffer' : 'Connected') : (reconnectNeeded ? 'Reconnect Buffer' : 'Not connected');

  const sidebarCard = document.querySelector('.side-connection.connection-card');
  if (sidebarCard) {
    sidebarCard.classList.toggle('compact', connected);
    sidebarCard.classList.toggle('connected', connected);
    sidebarCard.classList.toggle('api-live-pulse', connected);
  }
  const connDot = qs('connDot'); if (connDot) connDot.classList.toggle('on', connected);
  const connLabel = qs('connLabel'); if (connLabel) connLabel.textContent = statusLabel;
  const connHeading = qs('connHeading');
  if (connHeading) {
    connHeading.textContent = primaryHeading;
    connHeading.style.display = connected ? 'none' : '';
  }
  const connHelper = qs('connHelper');
  if (connHelper) {
    connHelper.textContent = helper;
    connHelper.style.display = connected ? 'none' : '';
  }
  const connLastSync = qs('connLastSync');
  const lastSynced = qs('lastSynced')?.textContent?.trim() || '';
  if (connLastSync) {
    connLastSync.textContent = lastSynced || '';
    connLastSync.style.display = connected && lastSynced ? '' : 'none';
  }

  const manageBtn = qs('manageTokenBtn');
  if (manageBtn) {
    setButtonClass(manageBtn, 'btn sm primary');
    manageBtn.textContent = connected ? 'Sync now' : (reconnectNeeded ? 'Reconnect Buffer' : 'Sign in with Buffer');
  }
  const revealBtn = qs('revealTokenBtn');
  if (revealBtn) {
    revealBtn.style.display = '';
    revealBtn.textContent = 'Connection settings';
  }

  const tokenInput = qs('tokenInput');
  if (tokenInput) tokenInput.value = manualToken || '';
  const tokenMsg = qs('tokenMsg');
  if (tokenMsg && !tokenPanelOpen) tokenMsg.textContent = manualActive ? 'Manual API key fallback active.' : '';

  const connectionIntroCopy = qs('connectionIntroCopy');
  if (connectionIntroCopy) {
    connectionIntroCopy.textContent = manualActive
      ? 'PostIQ is currently connected using advanced API setup. You can keep using PostIQ this way, or switch to Buffer sign-in for the smoother OAuth experience.'
      : 'Recommended for most users. Sign in with Buffer so PostIQ can load your channels, view your queue, and publish through your account when you choose.';
  }

  const oauthStatus = qs('oauthStatusText');
  if (oauthStatus) {
    oauthStatus.textContent = oauthActive
      ? 'Connected with Buffer sign-in.'
      : (manualActive
        ? 'Connected via API key fallback.'
        : (reconnectNeeded ? 'Your Buffer session expired. Sign in again to keep syncing.' : 'Not connected.'));
  }
  const connectBtn = qs('connectBufferBtn');
  if (connectBtn) {
    connectBtn.textContent = oauthActive || reconnectNeeded
      ? 'Reconnect Buffer'
      : (manualActive ? 'Switch to Buffer sign-in' : 'Sign in with Buffer');
  }
  const disconnectBtn = qs('disconnectBufferBtn');
  if (disconnectBtn) disconnectBtn.style.display = oauthActive || reconnectNeeded ? '' : 'none';

  const advancedConnectionCopy = qs('advancedConnectionCopy');
  if (advancedConnectionCopy) {
    advancedConnectionCopy.textContent = manualActive
      ? 'You’re currently using the advanced setup. This works, but Buffer sign-in is recommended for most users because it is easier to manage and does not require manually storing an API key. Disconnect Buffer clears OAuth sign-in only; saved manual keys stay here until you remove them.'
      : (oauthActive
        ? 'API key fallback is optional and only needed if Buffer sign-in is unavailable. Disconnect Buffer clears OAuth sign-in only; saved manual keys stay here until you remove them.'
        : 'Use this only if Buffer sign-in is unavailable or you need a manual setup. Disconnect Buffer clears OAuth sign-in only; saved manual keys stay here until you remove them.');
  }

  const mobDot = qs('mobConnDot'); if (mobDot) mobDot.classList.toggle('on', connected);
  const mobLabel = qs('mobConnLabel'); if (mobLabel) mobLabel.textContent = statusLabel;
  const mobHelper = qs('mobConnHelper');
  if (mobHelper) {
    mobHelper.textContent = connected ? '' : (reconnectNeeded ? 'Your Buffer session expired. Sign in again to keep syncing.' : 'Sign in with Buffer to load your channels, plan posts, and publish from PostIQ.');
    mobHelper.style.display = connected ? 'none' : '';
  }
  const mobManage = qs('mobManageTokenBtn');
  if (mobManage) {
    setButtonClass(mobManage, 'btn primary');
    mobManage.style.width = '100%';
    mobManage.style.justifyContent = 'center';
    mobManage.style.fontSize = '13px';
    mobManage.textContent = connected ? 'Sync now' : (reconnectNeeded ? 'Reconnect Buffer' : 'Sign in with Buffer');
  }
  const mobSettings = qs('mobConnectionSettingsBtn');
  if (mobSettings) mobSettings.textContent = 'Connection settings';

  updateNavTags();
  return connection;
}

function refreshTokenUI() {
  renderConnectionUI();
  initHomeView();
}

function toggleDesktopTokenPanel({ reveal = false } = {}) {
  tokenPanelOpen = !tokenPanelOpen;
  setTokenPanelVisible(qs('tokenPanel'), tokenPanelOpen);
  if (reveal && tokenPanelOpen) {
    const inp = qs('tokenInput');
    if (inp) { inp.type = 'text'; inp.focus(); }
  }
  renderConnectionUI();
  initHomeView();
}

function toggleMobileTokenPanel() {
  window.postiqMobileTokenPanelOpen = !window.postiqMobileTokenPanelOpen;
  setTokenPanelVisible(qs('mobTokenPanel'), window.postiqMobileTokenPanelOpen);
  renderConnectionUI();
  initHomeView();
}

function updateNavTags() {
  const connection = getBufferConnectionState();
  const connected = connection.connected;
  ['calNavTag','appNavTag'].forEach(id => {
    const el = qs(id); if (!el) return;
    el.style.display = connected ? 'none' : '';
  });
  document.querySelectorAll('.nav-free-tag').forEach(el => {
    el.style.display = connected ? 'none' : '';
  });
  const calDesc = qs('calDesc');
  if (calDesc) calDesc.textContent = connected
    ? 'Your Buffer queue in a monthly view. Spot gaps and add planning notes before you draft.'
    : (connection.reconnectNeeded ? 'Reconnect Buffer to load your scheduled posts and spot queue gaps.' : 'Sign in with Buffer to load your scheduled posts and spot queue gaps.');
  const composerDesc = qs('composerDesc');
  if (composerDesc) composerDesc.textContent = connected
    ? 'Write your post, attach media, then send to Buffer as a draft, queued post, or scheduled post.'
    : 'Write here now — connect Buffer to unlock Buffer drafts, queueing, and scheduling.';
  updateComposerButtonStates();
  const calEmpty = qs('calEmptyHint'); if (calEmpty) calEmpty.style.display = connected ? 'none' : 'block';
}

function updateComposerButtonStates() {
  const connection = getBufferConnectionState();
  const connected = connection.connected;
  const hasChannel = !!qs('composerChannel')?.value;
  const ready = connected && hasChannel;
  ['composerDraft','composerQueue','composerScheduleToggle'].forEach(id => {
    const btn = qs(id); if (!btn) return;
    btn.disabled = !ready;
    btn.style.opacity = ready ? '1' : '.45';
    btn.style.cursor = ready ? 'pointer' : 'not-allowed';
    btn.title = !connected ? (connection.reconnectNeeded ? 'Reconnect Buffer first' : 'Sign in with Buffer first') : !hasChannel ? 'Load channels from Buffer first' : '';
  });
}

function setBufferToken(token, { mode = 'session', messageEl = null } = {}) {
  const clean = String(token || '').trim();
  localStorage.removeItem(STORE_KEY);
  sessionStorage.removeItem(STORE_KEY);
  if (!clean) {
    const after = syncBufferTokenFromState();
    if (!after.connected) clearSyncedData();
    if (messageEl) messageEl.textContent = 'Manual API key disconnected.';
    renderConnectionUI();
  initHomeView();
    showToast('Manual API key disconnected');
    return false;
  }
  clearOAuthBufferToken();
  if (mode === 'local') localStorage.setItem(STORE_KEY, clean);
  else sessionStorage.setItem(STORE_KEY, clean);
  bufferToken = clean;
  if (messageEl) messageEl.textContent = mode === 'local' ? 'API key fallback saved locally.' : 'API key fallback saved for session.';
  renderConnectionUI();
  initHomeView();
  showToast('API key fallback saved', 'success');
  return true;
}

function disconnectBuffer() {
  clearOAuthConnection();
  const after = syncBufferTokenFromState();
  if (!after.connected) clearSyncedData();
  renderConnectionUI();
  initHomeView();
  showToast('Buffer disconnected.', 'success');
  setSyncStatus('idle', after.connected ? 'Connected with advanced setup.' : 'Buffer disconnected.');
  safeTrack(() => GA4_Auth.signedOut());
  safeTrack(() => GA4.clearUserIdentity());
  return true;
}

function loadStoredToken() {
  const connection = syncBufferTokenFromState();
  const manualToken = getManualBufferToken();
  const inp = qs('tokenInput'); if (inp) inp.value = manualToken;
  const mobInp = qs('mobTokenInput'); if (mobInp) mobInp.value = manualToken;
  if (connection.connected) {
    loadCacheState();
    hydrateFromCache();
  }
  renderConnectionUI();
  initHomeView();
}


async function checkBufferConnectionHealth() {
  const oauthToken = getStoredOAuthToken();
  if (oauthToken?.accessToken && !isOAuthTokenExpired()) {
    clearReconnectNeeded();
    renderConnectionUI();
  initHomeView();
    const connection = getBufferConnectionState();
    safeTrack(() => GA4_Auth.connectionStatusChecked(connection.connected));
    return connection;
  }
  if (oauthToken?.accessToken || oauthToken?.refreshToken) {
    try {
      await refreshBufferOAuthToken();
    } catch {
      markBufferReconnectNeeded();
    }
    renderConnectionUI();
  initHomeView();
    const connection = getBufferConnectionState();
    safeTrack(() => GA4_Auth.connectionStatusChecked(connection.connected));
    return connection;
  }
  renderConnectionUI();
  initHomeView();
  const connection = getBufferConnectionState();
  safeTrack(() => GA4_Auth.connectionStatusChecked(connection.connected));
  return connection;
}

function saveToken() {
  const token = qs('tokenInput').value.trim();
  const mode = [...document.querySelectorAll('input[name="tokenMode"]')].find(r => r.checked)?.value || 'session';
  const ok = setBufferToken(token, { mode, messageEl: qs('tokenMsg') });
  if (ok) {
    const msg = 'API key saved. Click Sync now to load Buffer posts.';
    const tokenMsg = qs('tokenMsg');
    if (tokenMsg) tokenMsg.textContent = msg;
    setSyncStatus('idle', msg);
  }
}
