// oauth.js
// Client-side PKCE OAuth flow against Buffer, generalized so client id,
// redirect uri, scope, and storage prefix are configurable per app.

(function (global) {
  'use strict';

  const AUTHORIZATION_ENDPOINT = 'https://auth.buffer.com/auth';
  const TRANSACTION_TTL_MS = 15 * 60 * 1000;

  function sessionKey(prefix, name) {
    return `${prefix}_oauth_${name}`;
  }

  function transactionKey(prefix) {
    return `${prefix}_oauth_transaction`;
  }

  function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => chars[b % chars.length]).join('');
  }

  function base64UrlEncode(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  async function createPkceChallenge(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64UrlEncode(digest);
  }

  function canUseSessionStorage() {
    try {
      const k = '__buffer_oauth_storage_test__';
      sessionStorage.setItem(k, '1');
      sessionStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  function canUseLocalStorage() {
    try {
      const k = '__buffer_oauth_local_storage_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  function saveFallbackTransaction(prefix, transaction) {
    if (!canUseLocalStorage()) return;
    try {
      localStorage.setItem(transactionKey(prefix), JSON.stringify(transaction));
    } catch {}
  }

  function readFallbackTransaction(prefix) {
    if (!canUseLocalStorage()) return null;
    try {
      const raw = localStorage.getItem(transactionKey(prefix));
      if (!raw) return null;
      const transaction = JSON.parse(raw);
      const createdAt = Number(transaction?.createdAt || 0);
      if (!createdAt || Date.now() - createdAt > TRANSACTION_TTL_MS) {
        localStorage.removeItem(transactionKey(prefix));
        return null;
      }
      return transaction;
    } catch {
      try { localStorage.removeItem(transactionKey(prefix)); } catch {}
      return null;
    }
  }

  function clearFallbackTransaction(prefix) {
    try { localStorage.removeItem(transactionKey(prefix)); } catch {}
  }

  async function startAuthorization({ prefix, clientId, redirectUri, scope, returnTo }) {
    if (!prefix || !clientId || !redirectUri || !scope) {
      throw new Error('BufferOAuth.startAuthorization requires { prefix, clientId, redirectUri, scope }');
    }

    const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!window.isSecureContext && !isLocalhost) {
      throw new Error('Buffer sign-in requires HTTPS or localhost.');
    }
    if (!window.crypto || typeof window.crypto.getRandomValues !== 'function' || !window.crypto.subtle || typeof TextEncoder !== 'function') {
      throw new Error('This browser is missing required Web Crypto APIs.');
    }
    if (!canUseSessionStorage()) {
      throw new Error('Session storage is blocked, so Buffer sign-in cannot start.');
    }

    const oauthState = generateRandomString(48);
    const verifier = generateRandomString(96);
    const challenge = await createPkceChallenge(verifier);

    sessionStorage.setItem(sessionKey(prefix, 'state'), oauthState);
    sessionStorage.setItem(sessionKey(prefix, 'verifier'), verifier);
    sessionStorage.setItem(sessionKey(prefix, 'redirect_uri'), redirectUri);
    if (returnTo) sessionStorage.setItem(sessionKey(prefix, 'return_to'), returnTo);

    // Some private-browsing flows recreate the top-level browsing context while
    // returning from the identity provider, which can drop sessionStorage even
    // though the app returns to the same origin. Keep a short-lived, same-origin
    // fallback transaction so PKCE can finish, then delete it immediately.
    saveFallbackTransaction(prefix, {
      state: oauthState,
      verifier,
      redirectUri,
      returnTo: returnTo || null,
      clientId,
      createdAt: Date.now(),
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: oauthState,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope,
      prompt: 'consent',
    });

    const authUrl = new URL(AUTHORIZATION_ENDPOINT);
    authUrl.search = params.toString();
    window.location.assign(authUrl.toString());
  }

  async function handleCallback({ prefix, tokenEndpoint, clientId }) {
    if (!prefix || !tokenEndpoint) {
      throw new Error('BufferOAuth.handleCallback requires { prefix, tokenEndpoint }');
    }
    if (!global.BufferConnection) {
      throw new Error('connection.js must be loaded and BufferConnection.init() called before handleCallback()');
    }

    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const fallback = readFallbackTransaction(prefix);
    const storedState = sessionStorage.getItem(sessionKey(prefix, 'state')) || fallback?.state || null;
    // Shared key is `${prefix}_oauth_verifier`. During migration, also accept
    // PostIQ's legacy `${prefix}_pkce_verifier`. A short-lived local fallback
    // handles private-browsing contexts that lose sessionStorage on redirect.
    const verifier = sessionStorage.getItem(sessionKey(prefix, 'verifier'))
      || sessionStorage.getItem(`${prefix}_pkce_verifier`)
      || fallback?.verifier
      || null;
    const redirectUri = sessionStorage.getItem(sessionKey(prefix, 'redirect_uri')) || fallback?.redirectUri || null;
    const returnTo = sessionStorage.getItem(sessionKey(prefix, 'return_to')) || fallback?.returnTo || null;
    const resolvedClientId = clientId || fallback?.clientId || null;

    function cleanup() {
      [sessionKey(prefix, 'state'), sessionKey(prefix, 'verifier'), sessionKey(prefix, 'redirect_uri'), sessionKey(prefix, 'return_to'), `${prefix}_pkce_verifier`]
        .forEach(k => sessionStorage.removeItem(k));
      clearFallbackTransaction(prefix);
    }

    if (error === 'access_denied') { cleanup(); return { ok: false, reason: 'cancelled', message: errorDescription || 'Connection cancelled', returnTo }; }
    if (error) { cleanup(); return { ok: false, reason: 'buffer_error', message: errorDescription || error, returnTo }; }
    if (!state || !storedState || state !== storedState) { cleanup(); return { ok: false, reason: 'state_mismatch', message: 'Security check failed — please try connecting again.', returnTo }; }
    if (!code) { cleanup(); return { ok: false, reason: 'missing_code', message: 'Buffer did not return an authorization code.', returnTo }; }
    if (!verifier || !redirectUri) { cleanup(); return { ok: false, reason: 'session_expired', message: 'The connection session expired — please try again.', returnTo }; }
    if (!resolvedClientId) { cleanup(); return { ok: false, reason: 'missing_client_id', message: 'This app is missing its Buffer OAuth client ID.', returnTo }; }

    try {
      const res = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: resolvedClientId, code, redirect_uri: redirectUri, code_verifier: verifier }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.access_token) {
        throw new Error((data && (data.error_description || data.error)) || 'Could not connect Buffer');
      }
      global.BufferConnection.storeTokens(data);
      cleanup();
      return { ok: true, returnTo };
    } catch (err) {
      cleanup();
      return { ok: false, reason: 'token_exchange_failed', message: err.message || 'Token exchange failed', returnTo };
    }
  }

  global.BufferOAuth = { startAuthorization, handleCallback };
})(typeof window !== 'undefined' ? window : globalThis);
