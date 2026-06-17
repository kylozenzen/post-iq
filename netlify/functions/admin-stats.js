'use strict';

function authError() {
  return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) };
}

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

async function redisCommand(url, token, ...args) {
  const res = await fetch(`${url}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  const { result } = await res.json();
  return result;
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const token = process.env.POSTIQ_ADMIN_TOKEN;
  if (!token || event.headers['x-admin-token'] !== token) return authError();

  const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  const env = {
    hasRedis:       !!(REDIS_URL && REDIS_TOKEN),
    hasAdminToken:  !!process.env.POSTIQ_ADMIN_TOKEN,
    netlifyContext: process.env.CONTEXT || 'unknown',
    deployId:       process.env.DEPLOY_ID || 'unknown',
  };

  if (!REDIS_URL || !REDIS_TOKEN) {
    return json(200, { approvals: null, env });
  }

  try {
    // Scan all approval:* keys
    const keys = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await redisCommand(REDIS_URL, REDIS_TOKEN, 'SCAN', cursor, 'MATCH', 'approval:*', 'COUNT', '100');
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    const counts = { total: keys.length, pending: 0, approved: 0, changes_requested: 0, other: 0 };
    const recent = [];

    if (keys.length > 0) {
      // Fetch all values via pipeline (MGET)
      const values = await redisCommand(REDIS_URL, REDIS_TOKEN, 'MGET', ...keys);
      const items = keys.map((k, i) => {
        let parsed = null;
        try { parsed = JSON.parse(values[i]); } catch { /* skip */ }
        return { key: k, data: parsed };
      });

      for (const { data } of items) {
        if (!data) { counts.other++; continue; }
        const status = data.status || 'unknown';
        if (status === 'pending')           counts.pending++;
        else if (status === 'approved')     counts.approved++;
        else if (status === 'changes_requested') counts.changes_requested++;
        else counts.other++;
      }

      // Most recent 5 by createdAt or updatedAt
      items
        .filter(i => i.data)
        .sort((a, b) => {
          const ta = a.data.updatedAt || a.data.createdAt || '';
          const tb = b.data.updatedAt || b.data.createdAt || '';
          return tb.localeCompare(ta);
        })
        .slice(0, 5)
        .forEach(({ key, data }) => {
          recent.push({
            id: key.replace('approval:', ''),
            status:    data.status,
            title:     data.title || data.postContent?.slice(0, 60) || '(untitled)',
            updatedAt: data.updatedAt || data.createdAt || null,
          });
        });
    }

    return json(200, { approvals: { counts, recent }, env });
  } catch (err) {
    return json(200, { approvals: { error: err.message }, env });
  }
};
