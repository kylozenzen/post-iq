'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const window = {};
vm.runInNewContext(fs.readFileSync('js/features/content-model.js', 'utf8'), { window });
const model = window.ContentModel;

assert.equal(model.lifecycle({ title: 'A thought' }), 'idea');
assert.equal(model.lifecycle({ sourceText: 'A meaningful developed source with detail' }), 'developing');
assert.equal(model.lifecycle({ sourceText: 'Source', variants: [{ channelId: 'li', text: 'Version' }] }), 'ready');
assert.equal(model.lifecycle({ sourceText: 'Source', variants: [{ postId: 'p1', dueAt: '2026-09-02T10:00', buffer: { status: 'scheduled' } }] }), 'scheduled');
assert.equal(model.lifecycle({ sourceText: 'Source', variants: [{ postId: 'p1', buffer: { status: 'published' } }, { postId: 'p2', buffer: { status: 'sent' } }] }), 'published');
assert.equal(model.lifecycle({ sourceText: 'Source', variants: [{ postId: 'p1', buffer: {} }] }), 'ready', 'unknown publishing data is handled conservatively');

const content = { id: 'c1', targetDate: '2026-09-01', buffer: { contentItemId: 'ci1' }, variants: [
  { channelId: 'li', service: 'linkedin', postId: 'p1', dueAt: '2026-09-02T10:00' },
  { channelId: 'th', service: 'threads', buffer: { postId: 'p2' }, dueAt: '2026-09-04T10:00' }
] };
const index = model.buildIndex([content]);
assert.equal(index.byContentItemId.get('ci1'), content);
assert.equal(index.byPostId.get('p2').content, content);
assert.equal(index.byPostId.get('p1').variant.channelId, 'li');
const entry = model.calendarEntry(content);
assert.equal(entry.date, '2026-09-02'); assert.equal(entry.dateEnd, '2026-09-04'); assert.equal(entry.variants.length, 2);

const detail = fs.readFileSync('js/features/content-detail.js', 'utf8');
assert.match(detail, /content_source_edited/); assert.match(detail, /content_variant_edited/);
assert.match(detail, /map\(\(variant, i\) => i === index \? \{ \.\.\.variant, text: value/, 'variant edits clone and change only one execution');
assert.match(fs.readFileSync('js/features/calendar.js', 'utf8'), /isContentCalendarMode\(\)/, 'Posts mode remains the default and Content mode is explicit');
assert.match(fs.readFileSync('js/integrations/post-creation.js', 'utf8'), /async function createPost\(/, 'Composer publishing remains intact');
const flow = fs.readFileSync('js/features/content-flow.js', 'utf8');
assert.match(flow, /updateContentItemDraft\(\{ id: card\.buffer\.contentItemId,/);
assert.match(flow, /updateContentItem\(\{ id: card\.buffer\.contentItemId,/);
assert.match(flow, /promoteContentItemDraft\(\{ id: card\.buffer\.contentItemId, posts:/);
assert.doesNotMatch(flow, /(?:updateContentItemDraft|updateContentItem|promoteContentItemDraft)\(\{ contentItemId:/);
assert.match(flow, /promotionSupportsSaveToDraft/, 'promotion remains guarded by draft-safe capability detection');
console.log('Content Flow v2 lifecycle, relationships, calendar grouping, and isolation tests passed');
