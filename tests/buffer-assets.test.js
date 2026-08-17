'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/integrations/buffer-oauth.js', 'utf8');
const start = source.indexOf('// ── BUFFER ASSET NORMALIZATION');
const end = source.length;
assert.ok(start >= 0, 'Could not locate Buffer asset normalization helpers');

const sandbox = { console, warnings: [] };
vm.createContext(sandbox);
vm.runInContext(`${source.slice(start, end)}\nObject.assign(globalThis, { normalizeBufferAssets, normalizeThreadAssets, normalizeBufferPostInput, getDeprecatedLegacyAssetWarnings });`, sandbox);

const {
  normalizeBufferAssets,
  normalizeThreadAssets,
  normalizeBufferPostInput,
  getDeprecatedLegacyAssetWarnings,
} = sandbox;
const toPlain = value => JSON.parse(JSON.stringify(value));

assert.equal(normalizeBufferAssets(undefined), undefined);

const alreadyNew = [{ image: { url: 'a' } }];
assert.deepEqual(toPlain(normalizeBufferAssets(alreadyNew)), alreadyNew);
assert.deepEqual(toPlain(normalizeBufferAssets({ images: [{ url: 'a' }] })), [{ image: { url: 'a' } }]);
assert.deepEqual(toPlain(normalizeBufferAssets({ videos: [{ url: 'v' }] })), [{ video: { url: 'v' } }]);
assert.deepEqual(toPlain(normalizeBufferAssets({ documents: [{ url: 'd' }] })), [{ document: { url: 'd' } }]);
assert.deepEqual(toPlain(normalizeBufferAssets({ link: { url: 'l' } })), [{ link: { url: 'l' } }]);

assert.deepEqual(
  toPlain(normalizeBufferAssets([{ image: { url: 'a', alt: 'alt' }, video: { url: 'v' }, extra: true }])),
  [{ image: { url: 'a', alt: 'alt' } }, { video: { url: 'v' } }]
);
assert.deepEqual(
  toPlain(normalizeBufferAssets([{ image: { url: 'a' }, extra: true }, null, { caption: 'no asset' }])),
  [{ image: { url: 'a' } }]
);
assert.deepEqual(
  toPlain(normalizeBufferAssets({
    videos: [{ url: 'v' }],
    link: { url: 'l' },
    images: [{ url: 'a' }],
    documents: [{ url: 'd' }],
  })),
  [{ image: { url: 'a' } }, { video: { url: 'v' } }, { document: { url: 'd' } }, { link: { url: 'l' } }]
);
assert.equal(normalizeBufferAssets({ images: [{}], videos: [null], link: {} }), undefined);

assert.deepEqual(
  toPlain(normalizeThreadAssets([{ text: 'one', assets: { images: [{ url: 'a' }] }, untouched: true }, { text: 'two' }])),
  [{ text: 'one', assets: [{ image: { url: 'a' } }], untouched: true }, { text: 'two' }]
);
assert.deepEqual(
  toPlain(normalizeBufferPostInput({
    text: 'root',
    assets: { images: [{ url: 'root-image' }] },
    metadata: {
      twitter: { thread: [{ text: 'reply', assets: { videos: [{ url: 'reply-video' }] } }] },
      bluesky: { thread: [{ text: 'sky', assets: [{ image: { url: 'sky-image' } }] }] },
      mastodon: { thread: [{ text: 'mast', assets: { documents: [{ url: 'doc' }] } }] },
      threads: { type: 'thread', thread: [{ text: 'threads', assets: { link: { url: 'link' } } }] },
    },
  })),
  {
    text: 'root',
    assets: [{ image: { url: 'root-image' } }],
    metadata: {
      twitter: { thread: [{ text: 'reply', assets: [{ video: { url: 'reply-video' } }] }] },
      bluesky: { thread: [{ text: 'sky', assets: [{ image: { url: 'sky-image' } }] }] },
      mastodon: { thread: [{ text: 'mast', assets: [{ document: { url: 'doc' } }] }] },
      threads: { type: 'thread', thread: [{ text: 'threads', assets: [{ link: { url: 'link' } }] }] },
    },
  }
);
assert.deepEqual(toPlain(normalizeBufferPostInput({ assets: {} })), {});
assert.deepEqual(toPlain(normalizeBufferPostInput({ assets: {} }, { clearAssets: true })), { assets: [] });
assert.deepEqual(
  toPlain(getDeprecatedLegacyAssetWarnings({ extensions: { warnings: [{ code: 'OTHER' }, { code: 'DEPRECATED_LEGACY_ASSETS_INPUT', paths: ['input.assets'] }] } })),
  [{ code: 'DEPRECATED_LEGACY_ASSETS_INPUT', paths: ['input.assets'] }]
);

console.log('Buffer asset normalization tests passed');
