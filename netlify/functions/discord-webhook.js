exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { webhookUrl, content } = JSON.parse(event.body || '{}');
    const valid = /^https:\/\/discord\.com\/api\/webhooks\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+/.test(String(webhookUrl || ''));
    if (!valid) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid Discord webhook URL.' }) };
    if (!String(content || '').trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message content is required.' }) };

    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: String(content).slice(0, 1900) }),
    });

    if (!resp.ok) {
      const raw = await resp.text();
      const msg = resp.status === 404 ? 'Webhook not found or deleted.' : resp.status === 401 || resp.status === 403 ? 'Webhook is invalid or unauthorized.' : resp.status === 429 ? 'Discord rate limit reached. Try again shortly.' : `Discord error (${resp.status}).`;
      return { statusCode: resp.status, headers, body: JSON.stringify({ error: msg, details: raw.slice(0, 300) }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || 'Unexpected Discord proxy error.' }) };
  }
};
