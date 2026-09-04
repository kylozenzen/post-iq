'use strict';

// Regression cover for the "expired key — reconnect Buffer" report: saving and
// queueing posts failed, and every underlying reason was reported as a dead
// Buffer connection.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/integrations/buffer-api.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('js/integrations/post-creation.js', 'utf8'), sandbox);
const { isAuthError, getErrorMessage, unwrapPostAction } = sandbox;

// The functions under test run inside a vm realm, so capture their throws
// directly rather than relying on cross-realm instanceof checks.
function catchError(fn) {
  try { fn(); } catch (error) { return error; }
  return assert.fail('expected a throw');
}

// ── Error text must never decide that a token died ──────────────────────────
const contentErrors = [
  { code: 'BUFFER_ERROR', message: 'Variable "$input" got invalid value null at "input.organizationId"' },
  { code: 'INVALID_INPUT_ERROR', message: 'Invalid input: dueAt must be in the future' },
  { code: 'BUFFER_ERROR', message: 'The media link has expired' },
  { code: 'BUFFER_ERROR', message: 'Field "contentItems" is forbidden on this schema' },
];
contentErrors.forEach(err => {
  assert.equal(isAuthError(err), false, `content error must not read as auth: ${err.message}`);
  assert.equal(getErrorMessage(err), err.message, 'the real Buffer reason must reach the user');
});

// The proxy rejects disallowed origins with a 403 that says nothing about the token.
assert.equal(isAuthError({ code: 'ORIGIN_NOT_ALLOWED', status: 403 }), false);
assert.equal(isAuthError({ code: 'PROXY_NETWORK_ERROR', status: 502, retryable: true }), false);
assert.equal(isAuthError({ code: 'REFRESH_NETWORK_ERROR', retryable: true }), false);

// ── Real auth signals still count ───────────────────────────────────────────
assert.equal(isAuthError({ status: 401 }), true);
assert.equal(isAuthError({ code: 'AUTH_ERROR' }), true);
assert.equal(isAuthError({ code: 'UNAUTHENTICATED' }), true);
assert.equal(getErrorMessage({ code: 'AUTH_ERROR' }), 'Buffer sign-in expired. Reconnect Buffer.');
assert.equal(getErrorMessage({ code: 'MISSING_TOKEN' }), 'Sign in with Buffer first.');
assert.match(getErrorMessage({ code: 'RATE_LIMIT', retryAfter: 30 }), /rate limit/i);

// ── createPost answers with concrete union members, never "MutationError" ───
assert.deepEqual(unwrapPostAction({ __typename: 'PostActionSuccess', post: { id: 'p1' } }).post, { id: 'p1' });

const limit = catchError(() => unwrapPostAction({ __typename: 'LimitReachedError', message: 'Queue is full' }));
assert.equal(limit.code, 'LIMIT_REACHED_ERROR');
assert.equal(isAuthError(limit), false, 'a full queue is not an expired key');
assert.equal(getErrorMessage(limit), 'Queue is full');

const limitNoMessage = catchError(() => unwrapPostAction({ __typename: 'LimitReachedError' }));
assert.match(getErrorMessage(limitNoMessage), /plan limit reached/i);

const unauthorized = catchError(() => unwrapPostAction({ __typename: 'UnauthorizedError', message: 'Not allowed' }));
assert.equal(unauthorized.status, 401);
assert.equal(isAuthError(unauthorized), true, 'Buffer saying unauthorized is a real auth failure');

const notFound = catchError(() => unwrapPostAction({ __typename: 'NotFoundError' }));
assert.equal(notFound.code, 'NOT_FOUND_ERROR');
assert.match(getErrorMessage(notFound), /could not find that channel/i);

assert.match(catchError(() => unwrapPostAction(null)).message, /Empty mutation response/);

// ── Schedule pickers hold local wall-clock time; dueAt is an absolute instant ─
const runtimeSource = fs.readFileSync('js/core/runtime.js', 'utf8');
const helpers = runtimeSource.slice(
  runtimeSource.indexOf('// Schedule pickers collect'),
  runtimeSource.indexOf('const normTags'),
);
assert.ok(helpers.includes('function localWallClockToISO'), 'date helpers must stay in runtime.js');
const clock = { console };
vm.createContext(clock);
vm.runInContext(helpers, clock);

const iso = clock.localWallClockToISO('2026-09-07', 14, 30);
assert.equal(new Date(iso).getHours(), 14, '2:30 PM chosen locally must stay 2:30 PM locally');
assert.equal(new Date(iso).getMinutes(), 30);
assert.equal(clock.datetimeLocalToISO('2026-09-07T14:30'), iso, 'datetime-local inputs convert the same way');
assert.equal(clock.localWallClockToISO('', 1, 2), '');
assert.equal(clock.datetimeLocalToISO('not-a-date'), '');
// The old code stamped a literal Z onto the typed digits, which shifted the
// post by the user's UTC offset and often scheduled it in the past.
assert.doesNotMatch(fs.readFileSync('js/core/navigation.js', 'utf8'), /:00\.000Z`/);

// ── Refresh goes through PostIQ's function, not a blocked browser call ──────
const connectionSource = fs.readFileSync('js/integrations/buffer-connection.js', 'utf8');
assert.doesNotMatch(connectionSource, /fetch\('https:\/\/auth\.buffer\.com\/token'/, 'browsers cannot call Buffer token endpoint directly');
assert.match(connectionSource, /BUFFER_TOKEN_ENDPOINT = '\/\.netlify\/functions\/buffer-token'/);
assert.match(connectionSource, /code: 'REFRESH_NETWORK_ERROR', retryable: true/, 'a network blip must not revoke the connection');
// A missing expires_in is not evidence that the access token died.
assert.match(connectionSource, /if \(!token\.expiresAt\) return false;/);
// A refresh token is a live connection even with no access token in hand.
assert.match(connectionSource, /if \(oauthToken\?\.refreshToken\) \{\n    try \{\n      const refreshed = await refreshBufferOAuthToken\(\);/);
// A stale reconnect flag must not outlive a working token.
assert.match(connectionSource, /if \(token\?\.accessToken && !isOAuthTokenExpired\(0\)\) \{ clearReconnectNeeded\(\); return false; \}/);

// One refresh-and-replay before anyone is told to reconnect.
const apiSource = fs.readFileSync('js/integrations/buffer-api.js', 'utf8');
assert.match(apiSource, /await refreshBufferOAuthToken\(\);\n          return await callBuffer\(query, variables, \{ \.\.\.options, isRetry: true \}\);/);

// ── Content Flow must send a real organizationId ────────────────────────────
const contentFlowSource = fs.readFileSync('js/features/content-flow.js', 'utf8');
assert.match(contentFlowSource, /async function resolveOrganizationId\(\)/);
assert.doesNotMatch(contentFlowSource, /organizationId: state\.organizationId/, 'null organizationId reads as a bad token to Buffer');
assert.match(contentFlowSource, /Sync Buffer first so PostIQ knows which organization to save into/);

// ── Threads only go to channels that accept them ────────────────────────────
const bootstrapSource = fs.readFileSync('js/core/bootstrap.js', 'utf8');
assert.match(bootstrapSource, /THREAD_METADATA_KEYS = \{ twitter: 'twitter', threads: 'threads', bluesky: 'bluesky', mastodon: 'mastodon' \}/);
assert.doesNotMatch(bootstrapSource, /\[isThreads\?'threads':'twitter'\]/, 'Bluesky and Mastodon reject twitter thread metadata');
assert.match(bootstrapSource, /input\.dueAt = dueAt;/);

console.log('Buffer auth/error classification, scheduling, and save-path tests passed');
