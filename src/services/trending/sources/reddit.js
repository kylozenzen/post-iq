(function(global){
  async function fetchReddit({ subreddit, sort = 'hot', limit = 20, fetcher = fetch, timeoutMs = 8000 }) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetcher(`https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`, { signal: ctrl.signal, headers: { Accept:'application/json' } });
      if (!res.ok) throw new Error(`Reddit HTTP ${res.status}`);
      const data = await res.json();
      return (data?.data?.children || []).map((p) => p.data).filter((x) => x && x.title).map((x) => ({ id: x.id, source: 'reddit', title: x.title, url: x.url_overridden_by_dest || `https://www.reddit.com${x.permalink || ''}`, author: x.author, score: x.score, comments: x.num_comments, publishedAt: x.created_utc, excerpt: x.selftext, tags:[`r/${x.subreddit}`], raw: x }));
    } finally { clearTimeout(t); }
  }
  global.PostIQTrendingSources = global.PostIQTrendingSources || {};
  global.PostIQTrendingSources.reddit = { fetchReddit };
})(window);
