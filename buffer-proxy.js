// netlify/functions/buffer-proxy.js
// Accepts the Buffer token from the client request body.
// The token is never stored — it's forwarded directly to Buffer's API.

export async function handler(event) {
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
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ errors: [{ message: "Invalid request body" }] }),
    };
  }

  const { token, query, variables } = payload;

  if (!token) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ errors: [{ message: "No Buffer token provided" }] }),
    };
  }

  if (!query) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ errors: [{ message: "No query provided" }] }),
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
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          errors: [{ message: `Buffer returned HTTP ${res.status} with non-JSON body: ${text.slice(0, 300)}` }]
        }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data),
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ errors: [{ message: err.message || "Proxy error" }] }),
    };
  }
}
