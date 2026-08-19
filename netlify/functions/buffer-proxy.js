// buffer-proxy.js
// Netlify function: stateless pass-through to Buffer's GraphQL API.
// Combines PostIQ's query-size cap with optional origin restriction.

const { corsHeaders, formatProxyError, toIntOrNull, fetchWithTimeout } = require('./_shared');

const MAX_QUERY_LENGTH = 50000;

exports.handler = async function handler(event) {
  const { headers, allowed } = corsHeaders(event, 'X-Buffer-Token');

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (!allowed) {
    return { statusCode: 403, headers, body: JSON.stringify(formatProxyError('Origin not allowed', { code: 'ORIGIN_NOT_ALLOWED', status: 403, retryable: false })) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify(formatProxyError('Invalid request body', { code: 'BAD_REQUEST', status: 400, retryable: false })) };
  }

  const { query, variables } = payload;

  if (typeof query !== 'string' || !query.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify(formatProxyError('No query provided', { code: 'BAD_REQUEST', status: 400, retryable: false })) };
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return { statusCode: 413, headers, body: JSON.stringify(formatProxyError('Buffer query is too large', { code: 'QUERY_TOO_LARGE', status: 413, retryable: false })) };
  }

  const bodyToken = payload.token;
  const headerToken = event.headers && (event.headers['x-buffer-token'] || event.headers['X-Buffer-Token']);
  const envToken = process.env.BUFFER_API_KEY || process.env.BUFFER_TOKEN;
  const token = bodyToken || headerToken || envToken;

  if (!token) {
    return { statusCode: 401, headers, body: JSON.stringify(formatProxyError('No Buffer token provided', { code: 'MISSING_TOKEN', status: 401, retryable: false })) };
  }

  try {
    const res = await fetchWithTimeout('https://api.buffer.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables: variables || {} }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        statusCode: res.status >= 500 ? res.status : 502,
        headers,
        body: JSON.stringify(formatProxyError(`Buffer returned HTTP ${res.status} with non-JSON body: ${text.slice(0, 300)}`, {
          code: 'BUFFER_NON_JSON', status: res.status, retryable: res.status >= 500,
        })),
      };
    }

    if (!res.ok) {
      const msg = (data && data.errors && data.errors[0] && data.errors[0].message) || `Buffer returned HTTP ${res.status}`;
      let code = 'BUFFER_HTTP_ERROR';
      if (res.status === 401 || res.status === 403) code = 'AUTH_ERROR';
      else if (res.status === 429) code = 'RATE_LIMIT';
      else if (res.status >= 500) code = 'BUFFER_SERVER_ERROR';

      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify(formatProxyError(msg, {
          code, status: res.status, retryable: res.status === 429 || res.status >= 500,
          retryAfter: toIntOrNull(res.headers.get('retry-after')),
        })),
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    const isAbort = err && err.name === 'AbortError';
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify(formatProxyError(isAbort ? 'Buffer request timed out' : (err.message || 'Proxy error'), {
        code: isAbort ? 'PROXY_TIMEOUT' : 'PROXY_NETWORK_ERROR', status: 502, retryable: true,
      })),
    };
  }
};
