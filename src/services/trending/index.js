(function(global){
  const SOURCES = [
    { id:'hacker-news', label:'Hacker News', type:'hn', enabled:true, defaultFeed:'topstories', limit:20 },
    { id:'reddit-socialmedia', label:'Reddit: social media', type:'reddit', enabled:true, subreddit:'socialmedia', sort:'hot', limit:20 },
    { id:'reddit-marketing', label:'Reddit: marketing', type:'reddit', enabled:true, subreddit:'marketing', sort:'hot', limit:20 },
    { id:'devto', label:'DEV Community', type:'rss', enabled:false, url:'https://dev.to/feed', limit:20 },
  ];
  async function fetchSource(source) {
    if (source.type === 'hn') return global.PostIQTrendingSources.hn.fetchHN({ feed: source.defaultFeed, limit: source.limit });
    if (source.type === 'reddit') {
      try { return await global.PostIQTrendingSources.reddit.fetchReddit(source); }
      catch {
        const rssItems = await global.PostIQTrendingSources.rss.fetchRSS({ url:`https://www.reddit.com/r/${source.subreddit}/.rss`, limit: source.limit });
        return rssItems.map((x) => ({ ...x, source:'reddit', tags:[`r/${source.subreddit}`] }));
      }
    }
    if (source.type === 'rss') return global.PostIQTrendingSources.rss.fetchRSS(source);
    return [];
  }
  global.PostIQTrending = { SOURCES, fetchSource };
})(window);
