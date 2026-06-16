'use strict';

// netlify/functions/buffer-pulse.js
// Lightweight recent-performance summary for Pulse using Buffer aggregatedPostMetrics.

const BUFFER_GRAPHQL_ENDPOINT = 'https://api.buffer.com';
const ALLOWED_DAYS = new Set([7, 14, 30]);

function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function clampDays(value) {
  const days = Number(value);
  return ALLOWED_DAYS.has(days) ? days : 30;
}

function dateRangeForDays(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function toNumberOrNull(value) {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function pickNumber(raw, keys) {
  if (!raw || typeof raw !== 'object') return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) return toNumberOrNull(raw[key]);
  }
  return null;
}

function normalizeAggregateMetrics(raw) {
  const postCount = pickNumber(raw, ['postCount', 'posts', 'postsCount', 'sentPosts', 'publishedPosts']);
  const reactions = pickNumber(raw, ['reactions', 'reactionCount', 'likes', 'likeCount', 'favorites', 'favoriteCount']);
  const comments = pickNumber(raw, ['comments', 'commentCount', 'replies', 'replyCount']);
  const averageReactionsPerPost = postCount != null && postCount > 0 && reactions != null
    ? reactions / postCount
    : null;

  return {
    available: [postCount, reactions, comments].some(value => value != null),
    postCount,
    reactions,
    comments,
    averageReactionsPerPost,
    raw: raw && typeof raw === 'object' ? raw : null,
    error: null,
  };
}

function unavailable(error) {
  return {
    available: false,
    postCount: null,
    reactions: null,
    comments: null,
    averageReactionsPerPost: null,
    raw: null,
    error: error || 'Performance data is unavailable from Buffer.',
  };
}

function safeErrorMessage(err) {
  const message = err?.message || err?.error || 'Buffer performance metrics are unavailable.';
  return String(message).replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]').slice(0, 500);
}

async function callBuffer(token, query, variables) {
  const res = await fetch(BUFFER_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!res.ok) {
    const first = data?.errors?.[0];
    throw new Error(first?.message || `Buffer returned HTTP ${res.status}`);
  }
  if (data?.errors?.length) {
    throw new Error(data.errors[0]?.message || 'Buffer GraphQL error');
  }
  return data || {};
}

async function fetchAggregatedPostMetrics({ token, organizationId, dateRange }) {
  const query = `
query GetPulseMetrics($organizationId: OrganizationId!, $start: DateTime!, $end: DateTime!) {
  aggregatedPostMetrics(
    input: {
      organizationId: $organizationId
      start: $start
      end: $end
    }
  ) {
    postCount
    reactions
    comments
  }
}`;

  const data = await callBuffer(token, query, { organizationId, start: dateRange.start, end: dateRange.end });
  return data?.data?.aggregatedPostMetrics || null;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Invalid request body' }) }; }

  const days = clampDays(payload.dashboardDays);
  const dateRange = dateRangeForDays(days);
  const base = { ok: true, days, dateRange };

  if (!payload.token) {
    return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ error: 'No Buffer token provided', code: 'MISSING_TOKEN' }) };
  }
  if (!payload.organizationId) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'organizationId is required', code: 'MISSING_ORG_ID' }) };
  }

  try {
    const raw = await fetchAggregatedPostMetrics({ token: payload.token, organizationId: payload.organizationId, dateRange });
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ...base, aggregateMetrics: normalizeAggregateMetrics(raw) }) };
  } catch (err) {
    console.warn('[buffer-pulse] aggregatedPostMetrics unavailable', { message: safeErrorMessage(err) });
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ...base, aggregateMetrics: unavailable(safeErrorMessage(err)) }) };
  }
};
