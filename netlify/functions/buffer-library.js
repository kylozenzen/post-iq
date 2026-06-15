'use strict';

// netlify/functions/buffer-library.js
// Fetches sent/published posts from Buffer GraphQL API using the same endpoint,
// auth pattern, and known-good post fields used by the scheduled-post sync.

const BUFFER_GRAPHQL_ENDPOINT = 'https://api.buffer.com';
const BASIC_POST_FIELDS = 'id text dueAt channelId';
const METRIC_FIELD_SETS = [
  { source: 'probe.posts.metrics.full', selection: 'metrics { reactions comments impressions reach engagementRate engagements likes favorites replies engagement clicks }' },
  { source: 'probe.posts.metrics.core', selection: 'metrics { reactions comments impressions reach engagementRate }' },
  { source: 'probe.posts.metrics.impressions', selection: 'metrics { impressions }' },
];
const SENT_STATUSES = ['sent', 'published'];

function buildSentPostsQuery(status, extraNodeFields = '') {
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
      node { ${BASIC_POST_FIELDS}${extraNodeFields ? ` ${extraNodeFields}` : ''} }
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

function firstNonNull(...values) {
  for (const value of values) {
    const num = toIntOrNull(value);
    if (num != null) return num;
  }
  return null;
}

function normalizeEngagementRate(value, engagements, impressions) {
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct > 1 ? direct / 100 : direct;

  const engagementCount = toIntOrNull(engagements);
  const impressionCount = toIntOrNull(impressions);
  if (engagementCount != null && impressionCount > 0) return engagementCount / impressionCount;

  return null;
}

function normalizeMetrics(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const reactions = firstNonNull(raw.reactions, raw.likes, raw.favorites);
  const comments = firstNonNull(raw.comments, raw.replies);
  const impressions = firstNonNull(raw.impressions);
  const reach = firstNonNull(raw.reach);
  const engagements = firstNonNull(raw.engagements, raw.engagement, raw.clicks, reactions, comments);
  const engagementRate = normalizeEngagementRate(raw.engagementRate, engagements, impressions);

  return {
    reactions,
    comments,
    impressions,
    reach,
    engagementRate,
  };
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
  const { metrics, ...post } = node || {};
  return {
    ...post,
    metrics: normalizeMetrics(metrics),
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
    const err = Object.assign(new Error(formatted.error), formatted, { bufferErrorBody: text });
    throw err;
  }

  if (data?.errors?.length) {
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
    const err = Object.assign(new Error(formatted.error), formatted, { bufferErrorBody: text });
    throw err;
  }

  return data || {};
}

async function fetchPostsForStatus({ token, organizationId, limit, status }) {
  const all = [];
  let samplePostShape = [];
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
      if (e?.node?.id) {
        if (!samplePostShape.length) samplePostShape = Object.keys(e.node).sort();
        all.push(normalizePost(e.node, status));
      }
    });

    hasNext = !!block?.pageInfo?.hasNextPage;
    after = block?.pageInfo?.endCursor || null;
    pages++;

    if (!block?.pageInfo) break;
  }

  return { posts: all, pages, samplePostShape };
}

async function fetchMetricsProbe({ token, organizationId, status, metricFieldSet }) {
  const query = buildSentPostsQuery(status, metricFieldSet.selection);
  const variables = { organizationId, first: 3 };
  const data = await callBuffer(token, query, variables);
  const edges = data?.data?.posts?.edges || [];
  const posts = edges
    .map(e => e?.node)
    .filter(node => node?.id)
    .map(node => normalizePost(node, status));

  return { posts, source: metricFieldSet.source };
}

function debugQueryAttempt(source, query, variables) {
  return { source, query, variables };
}

async function probeAnalyticsSafely({ token, organizationId, posts, status, samplePostShape }) {
  const debug = {
    attemptedQueries: [],
    metricsAvailable: false,
    metricsError: null,
    bufferErrorBodies: [],
    samplePostShape: samplePostShape || [],
  };

  if (!posts.length) {
    debug.metricsError = 'No sent posts were returned, so analytics probes were skipped.';
    return { posts, metricsSource: 'none', debug };
  }

  let lastError = null;
  const introspectionQuery = `
query ProbePostAnalyticsFields {
  __type(name: "Post") {
    name
    fields { name type { kind name ofType { kind name } } }
  }
}`;

  debug.attemptedQueries.push(debugQueryAttempt('probe.introspection.postFields', introspectionQuery, {}));
  try {
    const data = await callBuffer(token, introspectionQuery, {});
    const fields = data?.data?.__type?.fields?.map(field => field.name).sort() || [];
    debug.postTypeFields = fields.filter(field => /analytics|metric|insight|impression|reaction|engagement|reach|click|comment|stat/i.test(field));
  } catch (err) {
    lastError = err;
    if (err.bufferErrorBody) debug.bufferErrorBodies.push(err.bufferErrorBody);
  }

  for (const metricFieldSet of METRIC_FIELD_SETS) {
    const query = buildSentPostsQuery(status, metricFieldSet.selection);
    const variables = { organizationId, first: 3 };
    debug.attemptedQueries.push(debugQueryAttempt(metricFieldSet.source, query, variables));
    try {
      const result = await fetchMetricsProbe({ token, organizationId, status, metricFieldSet });
      const metricsById = new Map(result.posts.map(post => [post.id, post.metrics]));
      const merged = posts.map(post => ({ ...post, metrics: metricsById.get(post.id) || null }));
      const metricsAvailable = merged.some(post => post.metrics && Object.values(post.metrics).some(value => value != null));

      debug.metricsAvailable = metricsAvailable;
      debug.metricsError = metricsAvailable ? null : 'Buffer returned the metrics field but no metric values were present.';
      return { posts: merged, metricsSource: result.source, debug };
    } catch (err) {
      lastError = err;
      if (err.bufferErrorBody) debug.bufferErrorBodies.push(err.bufferErrorBody);
      console.warn('[buffer-library] Metrics query unavailable', {
        source: metricFieldSet.source,
        error: err.error || err.message,
        code: err.code,
        status: err.status,
      });
    }
  }

  debug.metricsAvailable = false;
  debug.metricsError = lastError?.error || lastError?.message || 'Buffer metrics are unavailable for this account or API schema.';

  return { posts: posts.map(post => ({ ...post, metrics: null })), metricsSource: 'unsupported', debug };
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

  const { token, organizationId, maxPosts = 100, includeDebug = false } = payload;

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
          const metricsResult = includeDebug
            ? await probeAnalyticsSafely({ token, organizationId, posts: result.posts, status, samplePostShape: result.samplePostShape })
            : {
                posts: result.posts.map(post => ({ ...post, metrics: null })),
                metricsSource: 'not_requested',
                debug: {
                  attemptedQueries: [],
                  metricsAvailable: false,
                  metricsError: null,
                  bufferErrorBodies: [],
                  samplePostShape: result.samplePostShape || [],
                },
              };
          const body = {
            posts: metricsResult.posts,
            total: metricsResult.posts.length,
            pages: result.pages,
            statusUsed: status,
            attemptedStatuses,
            metricsAvailable: metricsResult.debug.metricsAvailable,
            metricsSource: metricsResult.metricsSource,
            metricsError: metricsResult.debug.metricsError,
          };
          if (includeDebug) body.debug = metricsResult.debug;
          return {
            statusCode: 200,
            headers: corsHeaders(),
            body: JSON.stringify(body),
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
          metricsAvailable: false,
          metricsSource: 'none',
          metricsError: null,
          ...(includeDebug ? { debug: { attemptedQueries: [], metricsAvailable: false, metricsError: 'No sent posts were returned.', bufferErrorBodies: [], samplePostShape: [] } } : {}),
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
