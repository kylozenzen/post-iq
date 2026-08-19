// connection.js
// Client-side token storage + refresh for apps on the OAuth+PKCE path
// (adapted from PostIQ's buffer-connection.js, generalized so the storage
// key prefix, public OAuth client id, and token endpoint are configurable per app).
//
// Usage:
//   BufferConnection.init({ prefix: 'postiq', clientId: 'public-client-id', tokenEndpoint: '/.netlify/functions/buffer-token' });
//   const token = await BufferConnection.getValidAccessToken(); // auto-refreshes if needed
//   if (!token) { /* prompt user to connect */ }

(function (global) {
  'use strict';

  let cfg = null;

  function keys() {
    const p = cfg.prefix;
    return {
      access: `${p}_buffer_access_token`,
      refresh: `${p}_buffer_refresh_token`,
      type: `${p}_buffer_token_type`,
      scope: `${p}_buffer_token_scope`,
      expiresAt: `${p}_buffer_token_expires_at`,
      reconnectNeeded: `${p}_buffer_reconnect_needed`,
    };
  }

  function init(options) {
    if (!options || !options.prefix || !options.tokenEndpoint) {
      throw new Error('BufferConnection.init requires { prefix, tokenEndpoint }');
    }
    cfg = { refreshSkewMs: 60000, ...options };
  }

  function requireInit() {
    if (!cfg) throw new Error('BufferConnection.init(...) must be called before use');
  }

  function getStoredValue(key) {
    try {
      return localStorage.getItem(key) || '';
    } catch {
      return '';
    }
  }

  function setStoredValue(key, value) {
    try {
      if (value === undefined || value === null || value === '') localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch {
      /* storage unavailable — connection just won't persist across reloads */
    }
  }

  function getToken() {
    requireInit();
    const K = keys();
    const accessToken = getStoredValue(K.access).trim();
    const refreshToken = getStoredValue(K.refresh).trim();
    const expiresAt = Number(getStoredValue(K.expiresAt) || 0) || null;
    if (!accessToken && !refreshToken) return null;
    return { accessToken, refreshToken, expiresAt, tokenType: getStoredValue(K.type) || 'Bearer', scope: getStoredValue(K.scope) };
  }

  function storeTokens(tokenResponse) {
    requireInit();
    const K = keys();
    const expiresIn = Number(tokenResponse.expires_in || 0);
    const scope = Array.isArray(tokenResponse.scope) ? tokenResponse.scope.join(' ') : (tokenResponse.scope || '');
    setStoredValue(K.access, tokenResponse.access_token || '');
    if (tokenResponse.refresh_token) setStoredValue(K.refresh, tokenResponse.refresh_token);
    setStoredValue(K.type, tokenResponse.token_type || 'Bearer');
    setStoredValue(K.scope, scope);
    setStoredValue(K.expiresAt, expiresIn ? String(Date.now() + expiresIn * 1000) : '');
    setStoredValue(K.reconnectNeeded, '');
  }

  function clearTokens() {
    requireInit();
    const K = keys();
    Object.values(K).forEach(k => setStoredValue(k, ''));
  }

  function isExpired(token) {
    if (!token || !token.expiresAt) return false; // no expiry info — assume caller will handle a 401
    return Date.now() >= token.expiresAt - cfg.refreshSkewMs;
  }

  async function refresh(token) {
    requireInit();
    if (!token || !token.refreshToken) {
      throw Object.assign(new Error('No Buffer refresh token'), { code: 'MISSING_REFRESH_TOKEN' });
    }
    if (!cfg.clientId) {
      throw Object.assign(new Error('Missing Buffer OAuth client ID'), { code: 'MISSING_CLIENT_ID' });
    }
    const res = await fetch(cfg.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: cfg.clientId, grant_type: 'refresh_token', refresh_token: token.refreshToken }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.access_token) {
      setStoredValue(keys().reconnectNeeded, 'true');
      throw Object.assign(new Error((data && (data.error_description || data.error)) || 'Buffer reconnect required'), { code: 'REFRESH_FAILED' });
    }
    storeTokens(data);
    return getToken();
  }

  // Returns a usable access token, refreshing first if it's expired or about
  // to expire. Returns null if there's no connection at all. Throws if a
  // refresh is needed but fails (caller should prompt reconnect).
  async function getValidAccessToken() {
    requireInit();
    let token = getToken();
    if (!token) return null;
    if (token.accessToken && !isExpired(token)) return token.accessToken;
    token = await refresh(token);
    return token ? token.accessToken : null;
  }

  // Force an immediate refresh regardless of expiry (e.g. a manual
  // "refresh connection" action). Throws on failure like refresh().
  async function refreshNow() {
    requireInit();
    return refresh(getToken());
  }

  function hasConnection() {
    return !!getToken();
  }

  function reconnectNeeded() {
    requireInit();
    const value = getStoredValue(keys().reconnectNeeded);
    // PostIQ historically stored this flag as '1'. Accept both values so
    // existing sessions survive the shared-layer migration unchanged.
    return value === 'true' || value === '1';
  }

  global.BufferConnection = { init, storeTokens, clearTokens, getToken, getValidAccessToken, refreshNow, hasConnection, reconnectNeeded };
})(typeof window !== 'undefined' ? window : globalThis);
