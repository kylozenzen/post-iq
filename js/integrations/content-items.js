'use strict';

// Buffer Content Items are experimental. All schema-dependent GraphQL lives in
// this file so the rest of PostIQ only handles stable, normalized objects.
(function initializeContentItems(window) {
  // The documented PromoteContentItemDraftToPosts posts input currently has no
  // saveToDraft field. Keep this false until Buffer documents that field.
  const PROMOTION_SUPPORTS_SAVE_TO_DRAFT = false;
  const enabled = () => window.isPostIQFeatureEnabled?.('contentItems') !== false;
  const requireEnabled = () => {
    if (!enabled()) throw Object.assign(new Error('Content Flow sync is currently disabled. Your source is still saved in PostIQ.'), { code: 'CONTENT_ITEMS_DISABLED' });
  };
  const nodes = connection => Array.isArray(connection) ? connection : (connection?.edges || []).map(edge => edge?.node).filter(Boolean);

  const DRAFT_BODY = 'body{__typename ... on DraftContent{id text aiAssisted}}';
  const POST_BODY = 'body{__typename ... on PostContent{posts{id text status dueAt channel{id name}}}}';
  const CONTENT_BODY = 'body{__typename ... on DraftContent{id text aiAssisted} ... on PostContent{posts{id text status dueAt channel{id name}}}}';

  function normalizePost(post = {}) {
    return {
      id: String(post.id || ''), channelId: String(post.channel?.id || ''),
      text: String(post.text || ''), status: post.status || null, dueAt: post.dueAt || null,
      schedulingType: null, service: post.channel?.name || ''
    };
  }

  function normalizeContentItem(item = {}) {
    const body = item.body || {};
    const typename = String(body.__typename || '');
    const draft = typename === 'DraftContent';
    const posts = nodes(body.posts).map(normalizePost);
    return {
      id: String(item.id || ''), title: String(item.title || ''), targetDate: item.targetDate || null,
      state: draft ? 'draft' : (typename === 'PostContent' ? 'posts' : 'unknown'),
      sourceText: draft ? String(body.text || '') : '', aiAssisted: draft ? !!body.aiAssisted : false,
      posts, channelIds: [...new Set(posts.map(post => post.channelId).filter(Boolean))], raw: item
    };
  }

  function contentItemError(payload, fallback) {
    const nested = payload?.error || payload?.errors?.[0] || payload;
    const typename = String(nested?.__typename || payload?.__typename || 'MutationError');
    const details = nested?.errors || nested?.validationErrors || payload?.errors || [];
    const error = new Error(nested?.message || details[0]?.message || payload?.message || fallback);
    error.code = typename === 'ContentItemStateError' ? 'CONTENT_ITEM_STATE_ERROR' : typename.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
    error.typename = typename;
    error.validationErrors = details.map(detail => ({
      message: detail?.message || String(detail), channelId: detail?.channelId || detail?.channel?.id || nested?.channelId || null,
      path: detail?.path || null, code: detail?.code || null
    }));
    if (!error.validationErrors.length && /^Post(?:ChannelNotFound|InvalidInput|LimitReached)Error$/.test(typename)) {
      error.validationErrors = [{ message: error.message, channelId: nested?.channelId || null, path: null, code: typename }];
    }
    return error;
  }

  function unwrapMutation(response, field, fallback = 'Buffer could not save this content.') {
    const payload = response?.data?.[field];
    if (!payload) throw contentItemError(response?.errors?.[0], fallback);
    if (/Failure$/.test(String(payload.__typename || ''))) throw contentItemError(payload, fallback);
    if (!payload.contentItem) throw contentItemError(payload, fallback);
    return normalizeContentItem(payload.contentItem);
  }

  async function getContentItems(options = {}) {
    requireEnabled();
    const organizationId = options.organizationId || await getOrgId();
    const query = `query ContentItems($organizationId:OrganizationId!,$first:Int!,$after:String){contentItems(first:$first,after:$after,input:{organizationId:$organizationId}){edges{node{id title targetDate ${CONTENT_BODY}}pageInfo{hasNextPage endCursor}}}`;
    const response = await callBuffer(query, { organizationId, first: options.first || 50, after: options.after || null });
    const connection = response?.data?.contentItems;
    return { items: nodes(connection).map(normalizeContentItem), pageInfo: connection?.pageInfo || {} };
  }

  async function getContentItem(id) {
    requireEnabled();
    const query = `query ContentItem($id:ContentItemId!){contentItem(input:{id:$id}){id title targetDate body{__typename ... on DraftContent{id text aiAssisted} ... on PostContent{posts{id text status dueAt channel{id name}}}}}}`;
    const response = await callBuffer(query, { id });
    if (!response?.data?.contentItem) throw contentItemError(response?.errors?.[0], 'Content could not be loaded from Buffer.');
    return normalizeContentItem(response.data.contentItem);
  }

  async function createContentItemDraft(input) {
    requireEnabled();
    const mutation = `mutation CreateContentItemDraft($input:CreateContentItemDraftInput!){createContentItemDraft(input:$input){__typename ... on CreateContentItemDraftSuccess{contentItem{id title targetDate ${DRAFT_BODY}}} ... on CreateContentItemDraftFailure{error{__typename ... on InvalidInputError{message} ... on MutationError{message}}}}}`;
    return unwrapMutation(await callBuffer(mutation, { input }), 'createContentItemDraft');
  }

  async function updateContentItemDraft(input) {
    requireEnabled();
    const mutation = `mutation UpdateContentItemDraft($input:UpdateContentItemDraftInput!){updateContentItemDraft(input:$input){__typename ... on UpdateContentItemDraftSuccess{contentItem{id title targetDate ${DRAFT_BODY}}} ... on UpdateContentItemDraftFailure{error{__typename ... on ContentItemStateError{message} ... on InvalidInputError{message} ... on MutationError{message}}}}}`;
    return unwrapMutation(await callBuffer(mutation, { input }), 'updateContentItemDraft');
  }

  async function updateContentItem(input) {
    requireEnabled();
    const mutation = `mutation UpdateContentItem($input:UpdateContentItemInput!){updateContentItem(input:$input){__typename ... on UpdateContentItemSuccess{contentItem{id title targetDate ${DRAFT_BODY}}} ... on UpdateContentItemFailure{error{__typename ... on ContentItemStateError{message} ... on InvalidInputError{message} ... on MutationError{message}}}}}`;
    return unwrapMutation(await callBuffer(mutation, { input }), 'updateContentItem');
  }

  async function promoteContentItemDraft(input) {
    requireEnabled();
    if (!PROMOTION_SUPPORTS_SAVE_TO_DRAFT) throw Object.assign(new Error("Buffer's experimental Content Items API cannot currently save channel versions as Buffer drafts safely."), { code: 'DRAFT_PROMOTION_UNSUPPORTED' });
    const mutation = `mutation PromoteContentItemDraftToPosts($input:PromoteContentItemDraftToPostsInput!){promoteContentItemDraftToPosts(input:$input){__typename ... on PromoteContentItemDraftToPostsSuccess{contentItem{id title targetDate ${POST_BODY}}} ... on PromoteContentItemDraftToPostsFailure{error{__typename ... on ContentItemStateError{message} ... on PostChannelNotFoundError{message} ... on PostInvalidInputError{message} ... on PostLimitReachedError{message} ... on MutationError{message}}}}}`;
    return unwrapMutation(await callBuffer(mutation, { input }), 'promoteContentItemDraftToPosts', 'Buffer could not create the channel drafts.');
  }

  function draftPromotionPost(variant, supported = PROMOTION_SUPPORTS_SAVE_TO_DRAFT) {
    if (!supported) return null;
    return { channelId: variant.channelId, text: variant.text, mode: 'addToQueue', saveToDraft: true };
  }

  window.ContentItems = { enabled, promotionSupportsSaveToDraft: () => PROMOTION_SUPPORTS_SAVE_TO_DRAFT, draftPromotionPost, normalizePost, normalizeContentItem, unwrapMutation, getContentItems, getContentItem, createContentItemDraft, updateContentItemDraft, updateContentItem, promoteContentItemDraft };
})(window);
