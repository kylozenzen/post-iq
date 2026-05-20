// netlify/functions/approval.js
// Approval workflow backend — reads/writes Upstash Redis.
// Credentials never leave the server; the client only gets UUIDs back.

function response(statusCode, corsHeaders, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

exports.handler = async function (event) {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return response(503, corsHeaders, {
      error: "Approval service not configured — set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Netlify env vars.",
      code: "APPROVAL_NOT_CONFIGURED",
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return response(400, corsHeaders, { error: "Invalid request body", code: "BAD_REQUEST" });
  }

  // --- helpers ---

  async function redisCmd(cmd) {
    const res = await fetch(REDIS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cmd),
    });
    if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
    return await res.json();
  }

  function generateUUID() {
    return crypto.randomUUID();
  }

  const TTL = 60 * 60 * 24 * 30; // 30 days in seconds

  try {
    const { action } = payload;

    // ── CREATE ──────────────────────────────────────────────────────────────
    if (action === "create") {
      const { post } = payload;
      if (!post || !post.content) {
        return response(422, corsHeaders, { error: "post.content is required", code: "INVALID_POST" });
      }

      const uuid = generateUUID();
      const record = {
        id: uuid,
        post: {
          content: String(post.content).slice(0, 5000),
          platform: post.platform ? String(post.platform).slice(0, 50) : null,
          image_url: post.image_url ? String(post.image_url).slice(0, 2000) : null,
        },
        status: "pending",
        comments: [],
        created_at: Date.now(),
      };

      await redisCmd(["SET", `approval:${uuid}`, JSON.stringify(record), "EX", TTL]);

      // Detect deployment URL: prefer DEPLOY_URL (Netlify), fall back to event headers
      const host =
        process.env.URL ||
        process.env.DEPLOY_URL ||
        (event.headers && (event.headers["x-forwarded-host"] || event.headers["host"])) ||
        "https://postiq.netlify.app";
      const approvalUrl = `${host.replace(/\/$/, "")}/?approve=${uuid}`;

      return response(200, corsHeaders, { id: uuid, url: approvalUrl });
    }

    // ── GET ─────────────────────────────────────────────────────────────────
    if (action === "get") {
      const { id } = payload;
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
        return response(400, corsHeaders, { error: "Invalid or missing id", code: "BAD_REQUEST" });
      }

      const result = await redisCmd(["GET", `approval:${id}`]);
      if (!result.result) {
        return response(404, corsHeaders, { error: "Not found", code: "NOT_FOUND" });
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: result.result, // already JSON-stringified
      };
    }

    // ── UPDATE ──────────────────────────────────────────────────────────────
    if (action === "update") {
      const { id, status, author, comment } = payload;
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
        return response(400, corsHeaders, { error: "Invalid or missing id", code: "BAD_REQUEST" });
      }

      const getResult = await redisCmd(["GET", `approval:${id}`]);
      if (!getResult.result) {
        return response(404, corsHeaders, { error: "Not found", code: "NOT_FOUND" });
      }

      const record = JSON.parse(getResult.result);

      const allowedStatuses = ["pending", "approved", "changes_requested"];
      if (status && allowedStatuses.includes(status)) {
        record.status = status;
      }

      if (comment || author) {
        record.comments.push({
          author: String(author || "Anonymous").trim().slice(0, 100),
          text: String(comment || "").trim().slice(0, 2000),
          action: allowedStatuses.includes(status) ? status : null,
          timestamp: Date.now(),
        });
      }

      await redisCmd(["SET", `approval:${id}`, JSON.stringify(record), "EX", TTL]);

      return response(200, corsHeaders, { success: true, status: record.status, comments: record.comments });
    }

    return response(400, corsHeaders, { error: `Unknown action: ${payload.action}`, code: "UNKNOWN_ACTION" });
  } catch (err) {
    console.error("[PostIQ approval]", err);
    return response(500, corsHeaders, { error: err.message || "Internal error", code: "INTERNAL_ERROR" });
  }
};
