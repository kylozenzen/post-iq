// buffer-token.js
// Netlify function: exchanges an OAuth authorization code (or refresh token)
// for Buffer access/refresh tokens. Used only by apps on the OAuth+PKCE path.
//
// The OAuth client id is public app metadata, not a secret. Each app sends its
// own client_id with the PKCE exchange/refresh request so this shared function
// stays reusable and does not require per-app Netlify credential configuration.

const { corsHeaders, fetchWithTimeout } = require('./_shared');

exports.handler = async function handler(event) {
  const { headers, allowed } = corsHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (!allowed) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'origin_not_allowed' }) };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_json' }) };
  }

  const clientId = String(payload.client_id || '').trim();
  if (!clientId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing_required_fields', required: ['client_id'] }) };
  }

  const grantType = payload.grant_type === 'refresh_token' ? 'refresh_token' : 'authorization_code';

  let params;
  if (grantType === 'refresh_token') {
    const refresh_token = String(payload.refresh_token || '').trim();
    if (!refresh_token) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing_required_fields', required: ['refresh_token'] }) };
    }
    params = new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token });
  } else {
    const code = String(payload.code || '').trim();
    const redirect_uri = String(payload.redirect_uri || '').trim();
    const code_verifier = String(payload.code_verifier || '').trim();
    if (!code || !redirect_uri || !code_verifier) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'missing_required_fields', required: ['code', 'redirect_uri', 'code_verifier'] }),
      };
    }
    params = new URLSearchParams({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri, code_verifier });
  }

  try {
    const res = await fetchWithTimeout('https://auth.buffer.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: 'invalid_buffer_response', raw: text };
    }

    return { statusCode: res.status, headers, body: JSON.stringify(data) };
  } catch (err) {
    const isAbort = err && err.name === 'AbortError';
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error: isAbort ? 'buffer_token_timeout' : 'buffer_token_proxy_failed',
        message: err instanceof Error ? err.message : String(err || 'Unknown error'),
      }),
    };
  }
};
