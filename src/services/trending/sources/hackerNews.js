(function(global){
  async function fetchHN({ feed = 'topstories', limit = 20, fetcher = fetch, timeoutMs = 8000 }) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const idsRes = await fetcher(`https://hacker-news.firebaseio.com/v0/${feed}.json`, { signal: ctrl.signal });
      if (!idsRes.ok) throw new Error(`HN IDs HTTP ${idsRes.status}`);
      const ids = await idsRes.json();
      const items = await Promise.all((ids || []).slice(0, Math.min(limit, 30)).map(async (id) => {
        const r = await fetcher(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: ctrl.signal });
        if (!r.ok) return null;
        const x = await r.json();
        if (!x || x.deleted || x.dead || !x.title) return null;
        return { id: String(x.id), source: 'hacker-news', title: x.title, url: x.url || `https://news.ycombinator.com/item?id=${x.id}`, author: x.by, score: x.score, comments: x.descendants, publishedAt: x.time, raw: x };
      }));
      return items.filter(Boolean);
    } finally { clearTimeout(t); }
  }
  global.PostIQTrendingSources = global.PostIQTrendingSources || {};
  global.PostIQTrendingSources.hn = { fetchHN };
})(window);
