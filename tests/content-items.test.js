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

(async () => {
  const draft = api.normalizeContentItem({ id: 'ci_1', title: 'Source', targetDate: '2026-08-31', body: { __typename: 'DraftContent', id: 'draft_1', text: 'Original', aiAssisted: true } });
  assert.equal(draft.state, 'draft'); assert.equal(draft.sourceText, 'Original'); assert.equal(draft.targetDate, '2026-08-31'); assert.deepEqual([...draft.posts], []);

  const posts = api.normalizeContentItem({ id: 'ci_2', body: { __typename: 'PostContent', posts: [{ id: 'p1', text: 'LI', status: 'draft', dueAt: null, channel: { id: 'linkedin', name: 'LinkedIn' } }] } });
  assert.equal(posts.state, 'posts'); assert.equal(posts.posts[0].status, 'draft'); assert.deepEqual([...posts.channelIds], ['linkedin']);

  sandbox.response = { data: { createContentItemDraft: { __typename: 'CreateContentItemDraftSuccess', contentItem: { id: 'ci_3', body: { __typename: 'DraftContent', id: 'd3', text: 'Kept' } } } } };
  assert.equal((await api.createContentItemDraft({ organizationId: 'org_1', draft: { text: 'Kept' } })).id, 'ci_3');
  assert.match(calls.at(-1).query, /CreateContentItemDraftSuccess/); assert.match(calls.at(-1).query, /CreateContentItemDraftFailure/); assert.match(calls.at(-1).query, /body\{/);

  sandbox.response = { data: { createContentItemDraft: { __typename: 'CreateContentItemDraftFailure', error: { __typename: 'InvalidInputError', message: 'Bad draft' } } } };
  await assert.rejects(api.createContentItemDraft({}), error => error.typename === 'InvalidInputError');

  sandbox.response = { data: { updateContentItemDraft: { __typename: 'UpdateContentItemDraftSuccess', contentItem: { id: 'ci_3', body: { __typename: 'DraftContent', text: 'Updated' } } } } };
  assert.equal((await api.updateContentItemDraft({ contentItemId: 'ci_3', draft: { text: 'Updated' } })).sourceText, 'Updated');
  sandbox.response = { data: { updateContentItemDraft: { __typename: 'UpdateContentItemDraftFailure', error: { __typename: 'ContentItemStateError', message: 'Already promoted' } } } };
  await assert.rejects(api.updateContentItemDraft({}), error => error.code === 'CONTENT_ITEM_STATE_ERROR');
  sandbox.response = { data: { updateContentItemDraft: { __typename: 'UpdateContentItemDraftFailure', error: { __typename: 'InvalidInputError', message: 'Invalid text' } } } };
  await assert.rejects(api.updateContentItemDraft({}), error => error.typename === 'InvalidInputError');

  sandbox.response = { data: { contentItem: { id: 'ci_4', body: { __typename: 'DraftContent', text: 'Lookup' } } } };
  await api.getContentItem('ci_4');
  assert.match(calls.at(-1).query, /contentItem\(input:\{id:\$id\}\)/); assert.doesNotMatch(calls.at(-1).query, /contentItem\(id:/); assert.equal(calls.at(-1).variables.id, 'ci_4');

  assert.equal(api.promotionSupportsSaveToDraft(), false, 'live Content Items promotion input does not document saveToDraft');
  assert.equal(api.draftPromotionPost({ channelId: 'li', text: 'Draft' }), null, 'unsupported promotion cannot produce a schedulable input');
  assert.deepEqual({ ...api.draftPromotionPost({ channelId: 'li', text: 'Draft' }, true) }, { channelId: 'li', text: 'Draft', mode: 'addToQueue', saveToDraft: true });
  const before = calls.length;
  await assert.rejects(api.promoteContentItemDraft({ contentItemId: 'ci_3', posts: [] }), error => error.code === 'DRAFT_PROMOTION_UNSUPPORTED');
  assert.equal(calls.length, before, 'unsupported draft promotion never calls Buffer');

  const integration = fs.readFileSync('js/integrations/content-items.js', 'utf8');
  assert.match(integration, /PromoteContentItemDraftToPostsSuccess/); assert.match(integration, /PromoteContentItemDraftToPostsFailure/);
  for (const type of ['ContentItemStateError', 'PostChannelNotFoundError', 'PostInvalidInputError', 'PostLimitReachedError', 'MutationError']) assert.match(integration, new RegExp(type));
  const failure = { data: { promoteContentItemDraftToPosts: { __typename: 'PromoteContentItemDraftToPostsFailure', error: { __typename: 'PostChannelNotFoundError', message: 'Missing channel', channelId: 'gone' } } } };
  assert.throws(() => api.unwrapMutation(failure, 'promoteContentItemDraftToPosts'), error => error.typename === 'PostChannelNotFoundError' && error.validationErrors[0].channelId === 'gone');
  const success = { data: { promoteContentItemDraftToPosts: { __typename: 'PromoteContentItemDraftToPostsSuccess', contentItem: { id: 'ci_5', body: { __typename: 'PostContent', posts: [{ id: 'p5', text: 'Draft', status: 'draft', channel: { id: 'li', name: 'LinkedIn' } }] } } } } };
  assert.equal(api.unwrapMutation(success, 'promoteContentItemDraftToPosts').posts[0].status, 'draft');
  console.log('Content Items live schema, normalization, failures, and draft-safety tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
