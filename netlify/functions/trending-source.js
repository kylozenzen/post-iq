const ALLOWLIST = ['news.ycombinator.com','reddit.com','www.reddit.com','dev.to','hnrss.org','news.google.com'];

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'public, max-age=300'
};

const withTimeout = async (url, opts = {}, timeoutMs = 8000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const body = JSON.parse(event.body || '{}');
    const { type } = body;
    if (type === 'hn') {
      const feed = body.feed || 'topstories'; const limit = Math.min(Number(body.limit) || 20, 30);
      const idsRes = await withTimeout(`https://hacker-news.firebaseio.com/v0/${feed}.json`);
      if (!idsRes.ok) throw new Error(`HN HTTP ${idsRes.status}`);
      const ids = await idsRes.json();
      const items = await Promise.all((ids || []).slice(0, limit).map(async (id) => {
        const r = await withTimeout(`https://hacker-news.firebaseio.com/v0/item/${id}.json`); if (!r.ok) return null;
        const x = await r.json(); if (!x || x.deleted || x.dead || !x.title) return null;
        return { id: String(x.id), source: 'hacker-news', title: x.title, url: x.url || `https://news.ycombinator.com/item?id=${x.id}`, author: x.by, score: x.score, comments: x.descendants, publishedAt: new Date((x.time || 0) * 1000).toISOString(), raw: x };
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, source: 'hacker-news', items: items.filter(Boolean) }) };
    }
    if (type === 'reddit') return { statusCode: 400, headers, body: JSON.stringify({ ok: false, source: 'reddit', error: 'Use client-side reddit adapter with RSS fallback.' }) };
    if (type === 'rss') {
      const url = String(body.url || '');
      const host = (()=>{ try { return new URL(url).hostname; } catch { return ''; } })();
      if (!ALLOWLIST.includes(host)) return { statusCode: 403, headers, body: JSON.stringify({ ok:false, source:'rss', error:'RSS domain not allowed.' }) };
      const r = await withTimeout(url, { headers: { 'User-Agent':'PostIQ Trending Bot/1.0' } });
      if (!r.ok) throw new Error(`RSS HTTP ${r.status}`);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, source: 'rss', xml: await r.text() }) };
    }
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Unsupported source type' }) };
  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: e.message || 'Proxy error' }) };
  }
};
