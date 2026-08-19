'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const connectionSource = fs.readFileSync('js/shared/connection.js', 'utf8');
const oauthSource = fs.readFileSync('js/shared/oauth.js', 'utf8');
const connectWrapper = fs.readFileSync('auth/connect.js', 'utf8');
const callbackWrapper = fs.readFileSync('auth/callback.js', 'utf8');

const storage = new Map();
const localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
const sandbox = { console, localStorage, fetch: async () => { throw new Error('unexpected fetch'); } };
vm.createContext(sandbox);
vm.runInContext(connectionSource, sandbox);
sandbox.BufferConnection.init({ prefix: 'postiq', tokenEndpoint: '/.netlify/functions/buffer-token' });

storage.set('postiq_buffer_access_token', 'existing-access');
storage.set('postiq_buffer_refresh_token', 'existing-refresh');
storage.set('postiq_buffer_token_type', 'Bearer');
storage.set('postiq_buffer_token_scope', 'posts:read');
storage.set('postiq_buffer_token_expires_at', String(Date.now() + 600000));
assert.equal(sandbox.BufferConnection.getToken().accessToken, 'existing-access');
assert.equal(sandbox.BufferConnection.getToken().refreshToken, 'existing-refresh');

storage.set('postiq_buffer_reconnect_needed', '1');
assert.equal(sandbox.BufferConnection.reconnectNeeded(), true, 'legacy reconnect flag should survive migration');
storage.set('postiq_buffer_reconnect_needed', 'true');
assert.equal(sandbox.BufferConnection.reconnectNeeded(), true, 'shared reconnect flag should be accepted');

assert.match(oauthSource, /sessionKey\(prefix, 'verifier'\)/);
assert.match(oauthSource, /`\$\{prefix\}_pkce_verifier`/);
assert.match(connectWrapper, /oauth\.startAuthorization/);
assert.match(callbackWrapper, /BufferOAuth\.handleCallback/);
assert.match(connectWrapper, /GA4_Auth.*signInStarted/);
assert.match(callbackWrapper, /GA4_Auth.*signInSuccess/);
assert.match(callbackWrapper, /GA4_Auth.*signInFailed/);
assert.match(callbackWrapper, /GA4_System.*applicationError/);

console.log('Shared Buffer migration tests passed');
