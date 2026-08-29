'use strict';

// Buffer Content Items are experimental. All schema-dependent GraphQL lives in
// this file so the rest of PostIQ only handles stable, normalized objects.
(function initializeContentItems(window) {
  const enabled = () => window.isPostIQFeatureEnabled?.('contentItems') !== false;
  const requireEnabled = () => {
    if (!enabled()) throw Object.assign(new Error('Content Flow sync is currently disabled. Your source is still saved in PostIQ.'), { code: 'CONTENT_ITEMS_DISABLED' });
  };
  const nodes = connection => Array.isArray(connection) ? connection : (connection?.edges || []).map(edge => edge?.node).filter(Boolean);
  const value = (object, keys) => keys.reduce((result, key) => result ?? object?.[key], null);

  function normalizePost(post = {}) {
    return {
      id: String(post.id || ''), channelId: String(post.channelId || post.channel?.id || ''),
      text: String(post.text || ''), dueAt: post.dueAt || null,
      schedulingType: post.schedulingType || null, service: post.channel?.service || post.service || ''
    };
  }

  function normalizeContentItem(item = {}) {
    const content = item.content || item.draft || item.postContent || {};
    const typename = String(content.__typename || item.contentType || item.state || '');
    const draft = /draft/i.test(typename) || (!typename && typeof content.text === 'string');
    const posts = nodes(content.posts || item.posts).map(normalizePost);
    return {
      id: String(item.id || ''), title: String(item.title || ''), targetDate: item.targetDate || null,
      state: draft ? 'draft' : (/post/i.test(typename) || posts.length ? 'posts' : 'unknown'),
      sourceText: draft ? String(content.text || '') : '', aiAssisted: draft ? !!content.aiAssisted : false,
      posts, channelIds: [...new Set(posts.map(post => post.channelId).filter(Boolean))], raw: item
    };
  }

  function contentItemError(payload, fallback) {
    const typename = String(payload?.__typename || 'MutationError');
    const details = payload?.errors || payload?.validationErrors || [];
    const error = new Error(payload?.message || details[0]?.message || fallback);
    error.code = typename === 'ContentItemStateError' ? 'CONTENT_ITEM_STATE_ERROR' : typename.toUpperCase();
    error.typename = typename;
    error.validationErrors = details.map(detail => ({
      message: detail?.message || String(detail), channelId: detail?.channelId || detail?.channel?.id || null,
      path: detail?.path || null, code: detail?.code || null
    }));
    return error;
  }

  function unwrapMutation(response, field, fallback = 'Buffer could not save this content.') {
    const payload = response?.data?.[field];
    if (!payload) throw contentItemError(response?.errors?.[0], fallback);
    if (/error$/i.test(String(payload.__typename || '')) || payload.message && !value(payload, ['contentItem', 'item'])) throw contentItemError(payload, fallback);
    const item = value(payload, ['contentItem', 'item']);
    if (!item) throw contentItemError(payload, fallback);
    return normalizeContentItem(item);
  }

  async function getContentItems(options = {}) {
    requireEnabled();
    const organizationId = options.organizationId || await getOrgId();
    const query = `query ContentItems($organizationId:OrganizationId!,$first:Int!,$after:String){contentItems(first:$first,after:$after,input:{organizationId:$organizationId}){edges{node{id title targetDate content{__typename ... on DraftContent{text aiAssisted} ... on PostContent{posts{id text dueAt channelId schedulingType channel{ id service }}}}}}pageInfo{hasNextPage endCursor}}}`;
    const response = await callBuffer(query, { organizationId, first: options.first || 50, after: options.after || null });
    const connection = response?.data?.contentItems;
    return { items: nodes(connection).map(normalizeContentItem), pageInfo: connection?.pageInfo || {} };
  }

  async function getContentItem(id) {
    requireEnabled();
    const query = `query ContentItem($id:ContentItemId!){contentItem(id:$id){id title targetDate content{__typename ... on DraftContent{text aiAssisted} ... on PostContent{posts{id text dueAt channelId schedulingType channel{id service}}}}}}`;
    const response = await callBuffer(query, { id });
    if (!response?.data?.contentItem) throw contentItemError(response?.errors?.[0], 'Content could not be loaded from Buffer.');
    return normalizeContentItem(response.data.contentItem);
  }

  async function createContentItemDraft(input) {
    requireEnabled();
    const mutation = `mutation CreateContentItemDraft($input:CreateContentItemDraftInput!){createContentItemDraft(input:$input){__typename ... on ContentItemActionSuccess{contentItem{id title targetDate content{__typename ... on DraftContent{text aiAssisted}}}} ... on MutationError{message}}}`;
    return unwrapMutation(await callBuffer(mutation, { input }), 'createContentItemDraft');
  }

  async function updateContentItemDraft(input) {
    requireEnabled();
    const mutation = `mutation UpdateContentItemDraft($input:UpdateContentItemDraftInput!){updateContentItemDraft(input:$input){__typename ... on ContentItemActionSuccess{contentItem{id title targetDate content{__typename ... on DraftContent{text aiAssisted}}}} ... on ContentItemStateError{message} ... on MutationError{message}}}`;
    return unwrapMutation(await callBuffer(mutation, { input }), 'updateContentItemDraft');
  }

  async function updateContentItem(input) {
    requireEnabled();
    const mutation = `mutation UpdateContentItem($input:UpdateContentItemInput!){updateContentItem(input:$input){__typename ... on ContentItemActionSuccess{contentItem{id title targetDate content{__typename ... on DraftContent{text aiAssisted}}}} ... on MutationError{message}}}`;
    return unwrapMutation(await callBuffer(mutation, { input }), 'updateContentItem');
  }

  async function promoteContentItemDraft(input) {
    requireEnabled();
    const mutation = `mutation PromoteContentItemDraftToPosts($input:PromoteContentItemDraftToPostsInput!){promoteContentItemDraftToPosts(input:$input){__typename ... on ContentItemActionSuccess{contentItem{id title targetDate content{__typename ... on PostContent{posts{id text dueAt channelId schedulingType channel{id service}}}}}} ... on ContentItemValidationError{message errors{message channelId path code}} ... on ContentItemStateError{message} ... on MutationError{message}}}`;
    return unwrapMutation(await callBuffer(mutation, { input }), 'promoteContentItemDraftToPosts', 'Buffer could not create the channel versions.');
  }

  window.ContentItems = { enabled, normalizePost, normalizeContentItem, unwrapMutation, getContentItems, getContentItem, createContentItemDraft, updateContentItemDraft, updateContentItem, promoteContentItemDraft };
})(window);
