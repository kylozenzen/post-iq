(function(global){
  const toIso = (value) => {
    if (!value) return undefined;
    if (typeof value === 'number') return new Date(value * 1000).toISOString();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  };
  const normalizeItem = (item) => ({
    id: String(item.id || item.url || item.title || Math.random().toString(36).slice(2)),
    source: item.source || 'rss',
    title: String(item.title || '').trim(),
    url: String(item.url || ''),
    author: item.author ? String(item.author) : undefined,
    score: Number.isFinite(Number(item.score)) ? Number(item.score) : undefined,
    comments: Number.isFinite(Number(item.comments)) ? Number(item.comments) : undefined,
    publishedAt: toIso(item.publishedAt || item.time || item.created_utc),
    excerpt: item.excerpt ? String(item.excerpt).trim() : undefined,
    tags: Array.isArray(item.tags) ? item.tags.filter(Boolean).map(String) : undefined,
    raw: item.raw || undefined,
  });
  const dedupeAndRank = (items, sourceOrder = {}) => {
    const seen = new Set();
    const cleaned = items.filter((item) => item && item.title).map(normalizeItem).filter((item) => item.title && item.url);
    const deduped = cleaned.filter((item) => {
      const key = item.url ? item.url.toLowerCase() : item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return deduped.sort((a, b) => {
      const pa = sourceOrder[a.source] ?? 999;
      const pb = sourceOrder[b.source] ?? 999;
      if (pa !== pb) return pa - pb;
      return (b.score || 0) - (a.score || 0) || String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''));
    });
  };
  global.PostIQTrendingNormalize = { normalizeItem, dedupeAndRank };
})(window);
