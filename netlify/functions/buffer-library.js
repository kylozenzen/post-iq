'use strict';

// netlify/functions/buffer-library.js
// Fetches sent/published posts from Buffer GraphQL API using the same endpoint,
// auth pattern, and known-good post fields used by the scheduled-post sync.

const BUFFER_GRAPHQL_ENDPOINT = 'https://api.buffer.com';
const BASIC_POST_FIELDS = 'id text dueAt channelId';
const SENT_STATUSES = ['sent', 'published'];

function buildSentPostsQuery(status) {
  return `
query GetLibraryPosts($organizationId: OrganizationId!, $first: Int!, $after: String) {
  posts(
    first: $first
    after: $after
    input: {
      organizationId: $organizationId
      filter: { status: [${status}] }
    }
  ) {
    edges {
      node { ${BASIC_POST_FIELDS} }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function toIntOrNull(value) {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeBufferError(status, text, data) {
  const first = data?.errors?.[0] || null;
  const details = data || text || null;
  const message = first?.message || (text ? `Buffer returned HTTP ${status}: ${String(text).slice(0, 300)}` : `Buffer returned HTTP ${status}`);
  let code = 'BUFFER_HTTP_ERROR';
  if (status === 401 || status === 403) code = 'AUTH_ERROR';
  else if (status === 429) code = 'RATE_LIMIT';
  else if (status >= 500) code = 'BUFFER_SERVER_ERROR';

  return {
    error: message,
    errors: data?.errors,
    details,
    code,
    status,
    retryable: status === 429 || status >= 500,
  };
}

function isInvalidSentPostQuery(data, status) {
  const text = JSON.stringify(data?.errors || data || '').toLowerCase();
  return text.includes(status.toLowerCase())
    || text.includes('status')
    || text.includes('filter')
    || text.includes('cannot query field')
    || text.includes('unknown argument')
    || text.includes('bad request')
    || text.includes('validation');
}

function normalizePost(node, status) {
  return {
    ...node,
    status,
    // The library UI historically uses sentAt. Buffer's known-good scheduled
    // query exposes dueAt, so map dueAt as the best available date without
    // querying unconfirmed fields such as sentAt or externalLink.
    sentAt: node?.sentAt || node?.dueAt || null,
  };
}

async function callBuffer(token, query, variables) {
  const res = await fetch(BUFFER_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables: variables || {} }),
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!res.ok) {
    const formatted = normalizeBufferError(res.status, text, data);
    console.error('[buffer-library] Buffer HTTP error', formatted);
    const err = Object.assign(new Error(formatted.error), formatted);
    throw err;
  }

  if (data?.errors?.length && !data.data) {
    const first = data.errors[0] || {};
    const formatted = {
      error: first.message || 'Buffer GraphQL error',
      errors: data.errors,
      details: data,
      code: first.code || 'BUFFER_GRAPHQL_ERROR',
      status: first.status || 400,
      retryable: false,
    };
    console.error('[buffer-library] Buffer GraphQL error', formatted);
    const err = Object.assign(new Error(formatted.error), formatted);
    throw err;
  }

  return data || {};
}

async function fetchPostsForStatus({ token, organizationId, limit, status }) {
  const all = [];
  let after = null;
  let hasNext = true;
  let pages = 0;
  const maxPages = 5;
  const query = buildSentPostsQuery(status);

  while (hasNext && all.length < limit && pages < maxPages) {
    const variables = { organizationId, first: Math.min(50, limit - all.length) };
    if (after) variables.after = after;

    const data = await callBuffer(token, query, variables);
    const block = data?.data?.posts;
    const edges = block?.edges || [];

    edges.forEach(e => {
      if (e?.node?.id) all.push(normalizePost(e.node, status));
    });

    hasNext = !!block?.pageInfo?.hasNextPage;
    after = block?.pageInfo?.endCursor || null;
    pages++;

    if (!block?.pageInfo) break;
  }

  return { posts: all, pages };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { token, organizationId, maxPosts = 100 } = payload;

  if (!token) {
    return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ error: 'No Buffer token provided', code: 'MISSING_TOKEN' }) };
  }
  if (!organizationId) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'organizationId is required', code: 'MISSING_ORG_ID' }) };
  }

  const limit = Math.min(Number(maxPosts) || 100, 200);
  const attemptedStatuses = [];
  const failures = [];
  const emptyResults = [];

  try {
    for (const status of SENT_STATUSES) {
      attemptedStatuses.push(status);
      try {
        const result = await fetchPostsForStatus({ token, organizationId, limit, status });
        if (result.posts.length) {
          return {
            statusCode: 200,
            headers: corsHeaders(),
            body: JSON.stringify({
              posts: result.posts,
              total: result.posts.length,
              pages: result.pages,
              statusUsed: status,
              attemptedStatuses,
            }),
          };
        }
        emptyResults.push({ status, pages: result.pages });
      } catch (err) {
        failures.push({ status, error: err.error || err.message, code: err.code, httpStatus: err.status, details: err.details || err.errors });
        if (!isInvalidSentPostQuery(err.details || err.errors || err.message, status)) throw err;
      }
    }

    if (emptyResults.length) {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({
          posts: [],
          total: 0,
          pages: emptyResults.reduce((sum, result) => sum + (result.pages || 0), 0),
          attemptedStatuses,
          message: 'Buffer API did not return sent posts with the current query. Check supported post status/filter fields.',
        }),
      };
    }

    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: 'Buffer API did not return sent posts with the current query. Check supported post status/filter fields.',
        code: 'BUFFER_SENT_POSTS_UNSUPPORTED',
        attemptedStatuses,
        details: failures,
      }),
    };
  } catch (err) {
    return {
      statusCode: err.status || 502,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: err.error || err.message || 'Proxy error',
        errors: err.errors,
        details: err.details,
        code: err.code || 'PROXY_ERROR',
        status: err.status,
        retryable: !!err.retryable,
        retryAfter: toIntOrNull(err.retryAfter),
      }),
    };
  }
};
