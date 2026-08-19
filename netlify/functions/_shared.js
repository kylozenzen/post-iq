// _shared.js
// Common CORS + config helpers for the Buffer integration functions.

function allowedOrigin(event) {
  const configured = (process.env.BUFFER_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const requestOrigin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';

  if (configured.length === 0) return '*';
  if (configured.includes(requestOrigin)) return requestOrigin;
  return null;
}

function corsHeaders(event, extraAllowedHeaders = '') {
  const origin = allowedOrigin(event);
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': `Content-Type, Authorization, X-Buffer-Token${extraAllowedHeaders ? ', ' + extraAllowedHeaders : ''}`,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return { headers, allowed: origin !== null };
}

function formatProxyError(message, extras = {}) {
  return { errors: [{ message, ...extras }] };
}

function toIntOrNull(value) {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { corsHeaders, formatProxyError, toIntOrNull, fetchWithTimeout };
