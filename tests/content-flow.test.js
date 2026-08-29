'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const storage = new Map();
const window = { dispatchEvent() {}, ContentItems: { enabled: () => false } };
const sandbox = { console, window, localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) }, NOTEBOOK_KEY: 'postiq_notebook_v1', document: { getElementById: () => null }, CustomEvent: class {}, state: { channels: [] }, safeText: String, showToast() {} };
vm.createContext(sandbox); vm.runInContext(fs.readFileSync('js/features/content-flow.js', 'utf8'), sandbox);

const oldIdea = window.Notebook.normalizeIdea({ id: 'legacy', title: 'Old idea', body: 'Original legacy copy', createdAt: 1 });
assert.equal(oldIdea.sourceText, 'Original legacy copy'); assert.equal(oldIdea.status, 'idea'); assert.deepEqual([...oldIdea.variants], []);

const promoted = window.Notebook.normalizeIdea({ ...oldIdea, buffer: { contentItemId: 'ci_1', state: 'posts' }, variants: [{ channelId: 'li', text: 'LinkedIn rewrite', postId: 'p1' }] });
assert.equal(promoted.sourceText, 'Original legacy copy', 'promotion metadata never replaces source copy'); assert.equal(promoted.variants[0].text, 'LinkedIn rewrite');

const variants = window.Notebook.generateVariants(promoted, [{ id: 'li', service: 'linkedin', name: 'LinkedIn' }, { id: 'th', service: 'threads', name: 'Threads' }]);
assert.equal(variants.length, 2); assert.notStrictEqual(variants[0], variants[1]); variants[0].text = 'edited independently'; assert.equal(variants[1].text, 'Original legacy copy');
assert.ok(variants.every(variant => variant.mode === 'draft' && !variant.dueAt), 'Content Flow channel versions are always local drafts');

const html = fs.readFileSync('app.html', 'utf8');
for (const copy of ['Sync Source to Buffer', 'Create Platform Drafts', 'Generate Platform Drafts', 'Buffer platform sync unavailable']) assert.match(html, new RegExp(copy));
assert.match(html, /id="remixPromote"[^>]*disabled/, 'unsafe Buffer platform sync is disabled');
const flow = fs.readFileSync('js/features/content-flow.js', 'utf8');
assert.match(flow, /promotionSupportsSaveToDraft/); assert.match(flow, /cannot currently save these as Buffer drafts safely/);
assert.match(flow, /getContentItem\(result\.id\)/, 'mutation is followed by read-back verification');
assert.match(flow, /verified: false/); assert.match(flow, /verified: true/);
assert.match(flow, /Buffer sync could not be verified\. Your PostIQ source is safe\./);

assert.equal(window.ContentItems.enabled(), false, 'feature can be disabled without touching local source data');
assert.match(fs.readFileSync('js/integrations/post-creation.js', 'utf8'), /async function createPost\(/, 'legacy Composer post creation remains intact');
console.log('Content Flow migration, preservation, remix, and fallback tests passed');
