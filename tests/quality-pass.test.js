'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const discordSource = fs.readFileSync('js/discord-integration.js', 'utf8');
assert.match(discordSource, /const escapeHtml = \(value\) =>/);
assert.match(discordSource, /\$\{escapeHtml\(w\.name\)\}/);
assert.match(discordSource, /<option value="\$\{safeAttr\(w\.id\)\}">\$\{escapeHtml\(w\.name\)\}<\/option>/);
assert.match(discordSource, /\$\{escapeHtml\(i\.message\.slice\(0, 180\)\)\}/);
assert.doesNotMatch(discordSource, /\$\{i\.message\.slice\(0, 180\)\}/);

const proxySource = fs.readFileSync('netlify/functions/buffer-proxy.js', 'utf8');
const sharedSource = fs.readFileSync('netlify/functions/_shared.js', 'utf8');
assert.match(sharedSource, /async function fetchWithTimeout/);
assert.match(proxySource, /typeof query !== 'string' \|\| !query\.trim\(\)/);
assert.match(proxySource, /QUERY_TOO_LARGE/);
assert.match(proxySource, /PROXY_TIMEOUT/);

const swSource = fs.readFileSync('sw.js', 'utf8');
assert.match(swSource, /postiq-v11-buffer-save-queue/);
assert.match(swSource, /request\.cache === 'only-if-cached'/);
assert.match(swSource, /request\.mode === 'navigate'/);
assert.match(swSource, /cache\.match\('\/app\.html'\)/);

console.log('Quality pass regression checks passed');
