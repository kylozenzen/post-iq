// netlify/functions/approval.js
// Approval workflow backend — reads/writes Upstash Redis.
// Credentials never leave the server; the client only gets UUIDs back.

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
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Approval service not configured — set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Netlify env vars." }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Invalid request body" }),
    };
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
    const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
    return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${(Math.floor(Math.random()*4)+8).toString(16)}${hex().slice(1)}-${hex()}${hex()}${hex()}`;
  }

  const TTL = 60 * 60 * 24 * 30; // 30 days in seconds

  try {
    const { action } = payload;

    // ── CREATE ──────────────────────────────────────────────────────────────
    if (action === "create") {
      const { post } = payload;
      if (!post || !post.content) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ error: "post.content is required" }),
        };
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

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ id: uuid, url: approvalUrl }),
      };
    }

    // ── GET ─────────────────────────────────────────────────────────────────
    if (action === "get") {
      const { id } = payload;
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Invalid or missing id" }),
        };
      }

      const result = await redisCmd(["GET", `approval:${id}`]);
      if (!result.result) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Not found" }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: result.result, // already JSON-stringified
      };
    }

    // ── SNAPSHOT CREATE ─────────────────────────────────────────────────────
    // Reuses the approval Redis connection for static Snapshot records. These
    // records intentionally contain only prebuilt calendar data and never Buffer
    // tokens, so public Snapshot links do not call Buffer.
    if (action === "create_snapshot") {
      const { snapshot } = payload;
      if (!snapshot || !Array.isArray(snapshot.posts)) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ error: "snapshot.posts is required" }),
        };
      }

      const uuid = generateUUID();
      const record = {
        id: uuid,
        createdAt: String(snapshot.createdAt || new Date().toISOString()).slice(0, 80),
        rangeType: snapshot.rangeType === "week" ? "week" : "month",
        rangeStart: String(snapshot.rangeStart || "").slice(0, 20),
        rangeEnd: String(snapshot.rangeEnd || "").slice(0, 20),
        recipientName: snapshot.recipientName ? String(snapshot.recipientName).slice(0, 100) : "",
        message: snapshot.message ? String(snapshot.message).slice(0, 1200) : "",
        includeNotes: !!snapshot.includeNotes,
        includeMedia: snapshot.includeMedia !== false,
        posts: snapshot.posts.slice(0, 250).map((post) => ({
          id: post.id ? String(post.id).slice(0, 120) : "",
          text: post.text ? String(post.text).slice(0, 5000) : "",
          scheduledAt: post.scheduledAt ? String(post.scheduledAt).slice(0, 80) : "",
          dueAt: post.dueAt ? String(post.dueAt).slice(0, 80) : "",
          channelLabel: post.channelLabel ? String(post.channelLabel).slice(0, 120) : "",
          channelId: post.channelId ? String(post.channelId).slice(0, 120) : "",
          status: post.status ? String(post.status).slice(0, 80) : "",
          mediaThumbnailUrl: post.mediaThumbnailUrl ? String(post.mediaThumbnailUrl).slice(0, 2000) : "",
          notes: snapshot.includeNotes && post.notes ? String(post.notes).slice(0, 2000) : "",
        })),
        dayNotes: snapshot.includeNotes && Array.isArray(snapshot.dayNotes)
          ? snapshot.dayNotes.slice(0, 120).map((note) => ({
              date: note.date ? String(note.date).slice(0, 20) : "",
              text: note.text ? String(note.text).slice(0, 2000) : "",
              tag: note.tag ? String(note.tag).slice(0, 30) : "gold",
              label: note.label ? String(note.label).slice(0, 80) : "Note",
            }))
          : [],
        summary: snapshot.summary || {},
      };

      await redisCmd(["SET", `snapshot:${uuid}`, JSON.stringify(record), "EX", TTL]);

      const host =
        process.env.URL ||
        process.env.DEPLOY_URL ||
        (event.headers && (event.headers["x-forwarded-host"] || event.headers["host"])) ||
        "https://postiq.netlify.app";
      const snapshotUrl = `${host.replace(/\/$/, "")}/?snapshot=${uuid}`;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ id: uuid, url: snapshotUrl }),
      };
    }

    // ── SNAPSHOT GET ────────────────────────────────────────────────────────
    if (action === "get_snapshot") {
      const { id } = payload;
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Invalid or missing id" }),
        };
      }

      const result = await redisCmd(["GET", `snapshot:${id}`]);
      if (!result.result) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Not found" }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: result.result,
      };
    }

    // ── UPDATE ──────────────────────────────────────────────────────────────
    if (action === "update") {
      const { id, status, author, comment } = payload;
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Invalid or missing id" }),
        };
      }

      const getResult = await redisCmd(["GET", `approval:${id}`]);
      if (!getResult.result) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Not found" }),
        };
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

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, status: record.status, comments: record.comments }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Unknown action: ${payload.action}` }),
    };
  } catch (err) {
    console.error("[PostIQ approval]", err);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || "Internal error" }),
    };
  }
};
