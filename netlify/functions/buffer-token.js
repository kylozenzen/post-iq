const BUFFER_CLIENT_ID = 'ijzu75qv_CAcO0qMelb93HjOVh1EwEanezilfgBiOEG';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'method_not_allowed' }),
    };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'invalid_json' }),
    };
  }

  const code = String(payload.code || '').trim();
  const redirect_uri = String(payload.redirect_uri || '').trim();
  const code_verifier = String(payload.code_verifier || '').trim();

  if (!code || !redirect_uri || !code_verifier) {
    return {
      statusCode: 400,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'missing_required_fields',
        required: ['code', 'redirect_uri', 'code_verifier'],
      }),
    };
  }

  try {
    const res = await fetch('https://auth.buffer.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: BUFFER_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri,
        code_verifier,
      }).toString(),
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {
        error: 'invalid_buffer_response',
        raw: text,
      };
    }

    return {
      statusCode: res.status,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'buffer_token_proxy_failed',
        message: err instanceof Error ? err.message : String(err || 'Unknown error'),
      }),
    };
  }
};
