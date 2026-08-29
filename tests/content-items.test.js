'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/integrations/content-items.js', 'utf8');
const calls = [];
const sandbox = {
  console,
  window: { isPostIQFeatureEnabled: () => true },
  getOrgId: async () => 'org_1',
  callBuffer: async (query, variables) => { calls.push({ query, variables }); return sandbox.response; },
};
vm.createContext(sandbox); vm.runInContext(source, sandbox);
const api = sandbox.window.ContentItems;

const draft = api.normalizeContentItem({ id: 'ci_1', title: 'Source', targetDate: '2026-08-31', content: { __typename: 'DraftContent', text: 'Original', aiAssisted: true } });
assert.equal(draft.state, 'draft'); assert.equal(draft.sourceText, 'Original'); assert.equal(draft.targetDate, '2026-08-31'); assert.deepEqual([...draft.posts], []);

const posts = api.normalizeContentItem({ id: 'ci_2', targetDate: '2026-09-01', content: { __typename: 'PostContent', posts: [{ id: 'p1', channelId: 'linkedin', text: 'LI', dueAt: '2026-09-02T10:00:00Z' }, { id: 'p2', channelId: 'threads', text: 'TH', dueAt: '2026-09-03T10:00:00Z' }] } });
assert.equal(posts.state, 'posts'); assert.equal(posts.sourceText, ''); assert.equal(posts.posts[0].dueAt, '2026-09-02T10:00:00Z'); assert.notEqual(posts.targetDate, posts.posts[0].dueAt, 'planning target date is not a post schedule');

sandbox.response = { data: { createContentItemDraft: { __typename: 'ContentItemActionSuccess', contentItem: { id: 'ci_3', content: { __typename: 'DraftContent', text: 'Kept' } } } } };
api.createContentItemDraft({ organizationId: 'org_1', draft: { text: 'Kept' } }).then(result => {
  assert.equal(result.id, 'ci_3'); assert.match(calls.at(-1).query, /createContentItemDraft/);
}).then(async () => {
  sandbox.response = { data: { promoteContentItemDraftToPosts: { __typename: 'ContentItemValidationError', message: 'One version is invalid', errors: [{ channelId: 'threads', message: 'Too long', path: ['posts', 1] }] } } };
  await assert.rejects(api.promoteContentItemDraft({ contentItemId: 'ci_3', posts: [] }), error => error.validationErrors[0].channelId === 'threads');
  sandbox.response = { data: { updateContentItemDraft: { __typename: 'ContentItemStateError', message: 'Already promoted' } } };
  await assert.rejects(api.updateContentItemDraft({ contentItemId: 'ci_3', draft: { text: 'Local edit' } }), error => error.code === 'CONTENT_ITEM_STATE_ERROR');
  console.log('Content Items normalization and mutation tests passed');
}).catch(error => { console.error(error); process.exitCode = 1; });
