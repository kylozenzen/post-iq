// netlify/functions/buffer-proxy.js
// Accepts the Buffer token from the client request body.
// The token is never stored — it's forwarded directly to Buffer's API.

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
    return { statusCode: 200, headers: corsHeaders, body: "" };
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

  if (!query) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify(formatProxyError("No query provided", { code: "BAD_REQUEST", status: 400, retryable: false })),
    };
  }

  if (!token) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify(formatProxyError("No Buffer token provided", { code: "MISSING_TOKEN", status: 401, retryable: false })),
    };
  }

  try {
    const res = await fetch("https://api.buffer.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables: variables || {} }),
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
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify(
        formatProxyError(err.message || "Proxy error", {
          code: "PROXY_NETWORK_ERROR",
          status: 502,
          retryable: true,
        })
      ),
    };
  }
};
