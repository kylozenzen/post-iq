(function(global){
  const parseRss = (xml) => {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    return Array.from(doc.querySelectorAll('item')).map((item) => ({
      title: item.querySelector('title')?.textContent || '',
      url: item.querySelector('link')?.textContent || '',
      author: item.querySelector('creator, author')?.textContent || '',
      publishedAt: item.querySelector('pubDate')?.textContent || '',
      excerpt: item.querySelector('description')?.textContent || '',
    }));
  };
  async function fetchRSS({ url, limit = 20, fetcher = fetch, timeoutMs = 8000 }) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetcher(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
      const text = await res.text();
      return parseRss(text).slice(0, limit).map((x, i) => ({ ...x, id: `${url}:${i}`, source: 'rss', raw: x }));
    } finally { clearTimeout(t); }
  }
  global.PostIQTrendingSources = global.PostIQTrendingSources || {};
  global.PostIQTrendingSources.rss = { fetchRSS };
})(window);
