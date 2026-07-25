// netlify/functions/buffer-proxy.js
// Accepts the Buffer token from the client request body.
// The token is never stored — it's forwarded directly to Buffer's API.

const BUFFER_API_URL = "https://api.buffer.com";
const MAX_BODY_BYTES = 120000;
const MAX_QUERY_LENGTH = 50000;
const REQUEST_TIMEOUT_MS = 20000;

function formatProxyError(message, extras = {}) {
  return {
    errors: [{ message, ...extras }],
  };
}

function toIntOrNull(value) {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

exports.handler = async function(event) {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify(formatProxyError("Method not allowed", { code: "METHOD_NOT_ALLOWED", status: 405, retryable: false })),
    };
  }

  if (Buffer.byteLength(event.body || "", "utf8") > MAX_BODY_BYTES) {
    return {
      statusCode: 413,
      headers: corsHeaders,
      body: JSON.stringify(formatProxyError("Request body is too large", { code: "PAYLOAD_TOO_LARGE", status: 413, retryable: false })),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify(formatProxyError("Invalid request body", { code: "BAD_REQUEST", status: 400, retryable: false })),
    };
  }

  const { token, query, variables } = payload;

  if (typeof query !== "string" || !query.trim() || query.length > MAX_QUERY_LENGTH) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify(formatProxyError("A valid Buffer query is required", { code: "BAD_REQUEST", status: 400, retryable: false })),
    };
  }

  if (!token) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify(formatProxyError("No Buffer token provided", { code: "MISSING_TOKEN", status: 401, retryable: false })),
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(BUFFER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables: variables || {} }),
      signal: controller.signal,
    });

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        statusCode: res.status >= 500 ? res.status : 502,
        headers: corsHeaders,
        body: JSON.stringify(
          formatProxyError(
            `Buffer returned HTTP ${res.status} with non-JSON body: ${text.slice(0, 300)}`,
            {
              code: "BUFFER_NON_JSON",
              status: res.status,
              retryable: res.status >= 500,
            }
          )
        ),
      };
    }

    if (!res.ok) {
      const msg = data?.errors?.[0]?.message || `Buffer returned HTTP ${res.status}`;
      let code = "BUFFER_HTTP_ERROR";
      if (res.status === 401 || res.status === 403) code = "AUTH_ERROR";
      else if (res.status === 429) code = "RATE_LIMIT";
      else if (res.status >= 500) code = "BUFFER_SERVER_ERROR";

      return {
        statusCode: res.status,
        headers: corsHeaders,
        body: JSON.stringify(
          formatProxyError(msg, {
            code,
            status: res.status,
            retryable: res.status === 429 || res.status >= 500,
            retryAfter: toIntOrNull(res.headers.get("retry-after")),
          })
        ),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data),
    };
  } catch (err) {
    const timedOut = err?.name === "AbortError";
    return {
      statusCode: timedOut ? 504 : 502,
      headers: corsHeaders,
      body: JSON.stringify(
        formatProxyError(timedOut ? "Buffer request timed out" : (err.message || "Proxy error"), {
          code: timedOut ? "PROXY_TIMEOUT" : "PROXY_NETWORK_ERROR",
          status: timedOut ? 504 : 502,
          retryable: true,
        })
      ),
    };
  } finally {
    clearTimeout(timeout);
  }
};
