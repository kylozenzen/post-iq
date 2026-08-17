'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/integrations/buffer-oauth.js', 'utf8');
const start = source.indexOf('// ── BUFFER OAUTH (PUBLIC CLIENT + PKCE)');
const end = source.indexOf('// ── BUFFER ASSET NORMALIZATION', start);
assert.ok(start >= 0 && end > start, 'Could not locate Buffer OAuth helpers');
const oauthSource = source.slice(start, end);

assert.match(oauthSource, /const BUFFER_AUTHORIZATION_ENDPOINT = 'https:\/\/auth\.buffer\.com\/auth';/);
assert.match(oauthSource, /const BUFFER_OAUTH_SCOPE = 'posts:write posts:read account:read offline_access';/);
assert.match(oauthSource, /const BUFFER_OAUTH_DEBUG_KEY = 'postiq_oauth_debug';/);
assert.match(oauthSource, /\? 'http:\/\/localhost:8888\/auth\/callback\.html'\s*: 'https:\/\/postiq\.netlify\.app\/auth\/callback\.html'/);
assert.match(oauthSource, /sessionStorage\.setItem\('postiq_oauth_state', oauthState\);/);
assert.match(oauthSource, /sessionStorage\.setItem\('postiq_pkce_verifier', verifier\);/);
assert.match(oauthSource, /sessionStorage\.setItem\('postiq_oauth_redirect_uri', redirectUri\);/);
assert.match(oauthSource, /const challenge = await createPkceChallenge\(verifier\);/);
assert.match(oauthSource, /return base64UrlEncode\(await sha256\(verifier\)\);/);
assert.match(oauthSource, /code_challenge_method: 'S256'/);
assert.match(oauthSource, /response_type: 'code'/);
assert.ok(!oauthSource.toLowerCase().includes(['client', 'secret'].join('_')));
assert.match(oauthSource, /prompt:\s*['"]consent['"]/);

const paramsBlockMatch = oauthSource.match(/const params = new URLSearchParams\(\{([\s\S]*?)\n  \}\);/);
assert.ok(paramsBlockMatch, 'Could not locate authorization URLSearchParams block');
const paramNames = Array.from(paramsBlockMatch[1].matchAll(/^\s+([a-z_]+):/gm), match => match[1]);
assert.deepEqual(paramNames, [
  'client_id',
  'redirect_uri',
  'response_type',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
  'prompt',
]);

const encoded = new URLSearchParams({ scope: 'posts:write posts:read account:read offline_access' }).toString();
assert.equal(encoded, 'scope=posts%3Awrite+posts%3Aread+account%3Aread+offline_access');

console.log('Buffer OAuth start flow tests passed');
