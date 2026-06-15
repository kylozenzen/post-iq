'use strict';

// netlify/functions/buffer-library.js
// Fetches sent posts with performance metrics from Buffer GraphQL API.
// Handles pagination to pull up to 200 posts, sorted by sent date descending.

const SENT_POSTS_QUERY = `
query GetSentPostsWithMetrics($organizationId: OrganizationId!, $first: Int!, $after: String) {
  posts(
    first: $first
    after: $after
    input: {
      organizationId: $organizationId
      sort: [{ field: sentAt, direction: desc }]
      filter: { status: [sent] }
    }
  ) {
    edges {
      node {
        id
        text
        sentAt
        externalLink
        channelId
        metrics {
          reactions
          comments
          impressions
          reach
          engagementRate
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
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
  const all = [];
  let after = null;
  let hasNext = true;
  let pages = 0;
  const maxPages = 5;

  try {
    while (hasNext && all.length < limit && pages < maxPages) {
      const variables = { organizationId, first: Math.min(50, limit - all.length) };
      if (after) variables.after = after;

      const res = await fetch('https://api.buffer.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query: SENT_POSTS_QUERY, variables }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          statusCode: res.status,
          headers: corsHeaders(),
          body: JSON.stringify({ error: `Buffer returned HTTP ${res.status}`, details: text.slice(0, 300) }),
        };
      }

      const data = await res.json();

      if (data.errors?.length && !data.data) {
        const first = data.errors[0] || {};
        return {
          statusCode: first.status || 400,
          headers: corsHeaders(),
          body: JSON.stringify({ error: first.message || 'Buffer GraphQL error', code: first.code }),
        };
      }

      const block = data?.data?.posts;
      const edges = block?.edges || [];

      edges.forEach(e => {
        if (e?.node?.id) all.push(e.node);
      });

      hasNext = !!block?.pageInfo?.hasNextPage;
      after = block?.pageInfo?.endCursor || null;
      pages++;

      if (!block?.pageInfo) break;
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ posts: all, total: all.length, pages }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message || 'Proxy error', code: 'PROXY_ERROR' }),
    };
  }
};
