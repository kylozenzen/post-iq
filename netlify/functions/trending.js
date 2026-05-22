'use strict';

// netlify/functions/trending.js
// Server-side proxy for trending feeds — avoids CORS and CSP issues.
// Supports: reddit, hn (Hacker News), producthunt

const DEFAULT_SUBS = ['socialmedia', 'entrepreneur', 'marketing', 'business', 'smallbusiness'];
const HN_FEED_TYPES = ['topstories', 'newstories', 'beststories'];

function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'public, max-age=300', // 5-minute cache
  };
}

function errorResponse(statusCode, message, code) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify({ error: message, code }),
  };
}

function successResponse(data) {
  return {
    statusCode: 200,
    headers: corsHeaders(),
    body: JSON.stringify(data),
  };
}

async function fetchReddit(subreddit, limit = 25) {
  const sub = String(subreddit || 'socialmedia')
    .replace(/^r\//i, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 50) || 'socialmedia';

  // Reddit JSON API — works server-side without CORS issues
  const url = `https://www.reddit.com/r/${sub}/hot.json?limit=${limit}&raw_json=1`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'PostIQ/1.0 (Buffer companion app; content planning)',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Reddit returned HTTP ${res.status} for r/${sub}`);
  }

  const data = await res.json();
  const posts = (data?.data?.children || [])
    .filter(p => p?.data && !p.data.stickied && p.data.title)
    .map(p => ({
      title: String(p.data.title || '').trim(),
      score: Number(p.data.score || 0),
      comments: Number(p.data.num_comments || 0),
      sub: `r/${p.data.subreddit || sub}`,
      url: p.data.url && !p.data.is_self
        ? String(p.data.url)
        : `https://reddit.com${p.data.permalink || ''}`,
      permalink: `https://reddit.com${p.data.permalink || ''}`,
      selftext: String(p.data.selftext || '').slice(0, 300),
      age: Math.floor(Date.now() / 1000) - Number(p.data.created_utc || 0),
      source: 'reddit',
    }));

  return { posts, subreddit: sub };
}

async function fetchHN(feedType = 'topstories', limit = 20) {
  const feed = HN_FEED_TYPES.includes(feedType) ? feedType : 'topstories';

  const idsRes = await fetch(`https://hacker-news.firebaseio.com/v0/${feed}.json`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!idsRes.ok) {
    throw new Error(`HN returned HTTP ${idsRes.status} for ${feed}`);
  }

  const ids = await idsRes.json();
  if (!Array.isArray(ids)) throw new Error('Invalid HN response — expected array of IDs');

  const topIds = ids.slice(0, Math.min(limit, 30));

  const items = await Promise.allSettled(
    topIds.map(id =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
        headers: { 'Accept': 'application/json' },
      }).then(r => r.json())
    )
  );

  const posts = items
    .filter(r => r.status === 'fulfilled' && r.value?.title)
    .map(r => r.value)
    .map(s => ({
      title: String(s.title || '').trim(),
      score: Number(s.score || 0),
      comments: Number(s.descendants || 0),
      sub: s.by ? `by ${s.by}` : 'HN',
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
      permalink: `https://news.ycombinator.com/item?id=${s.id}`,
      selftext: '',
      age: Math.floor(Date.now() / 1000) - Number(s.time || 0),
      source: 'hn',
    }));

  return { posts, feed };
}

async function fetchProductHunt(limit = 20) {
  // Product Hunt's public GraphQL API (no auth for basic today posts)
  const query = `{
    posts(first: ${limit}, order: VOTES) {
      edges {
        node {
          id
          name
          tagline
          votesCount
          commentsCount
          url
          createdAt
          topics {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch('https://api.producthunt.com/v2/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // Public API token for read-only access
      'Authorization': `Bearer ${process.env.PRODUCTHUNT_TOKEN || ''}`,
    },
    body: JSON.stringify({ query }),
  });

  // If PH API is unavailable or no token, fall back to scraping their daily page
  if (!res.ok || !process.env.PRODUCTHUNT_TOKEN) {
    return fetchProductHuntFallback(limit);
  }

  const data = await res.json();
  const edges = data?.data?.posts?.edges || [];

  const posts = edges.map(e => {
    const node = e.node;
    const topics = (node.topics?.edges || []).map(t => t.node?.name).filter(Boolean);
    return {
      title: String(node.name || '').trim(),
      tagline: String(node.tagline || '').trim(),
      score: Number(node.votesCount || 0),
      comments: Number(node.commentsCount || 0),
      sub: topics.length ? topics.slice(0, 2).join(', ') : 'Product Hunt',
      url: String(node.url || 'https://www.producthunt.com'),
      permalink: String(node.url || 'https://www.producthunt.com'),
      selftext: String(node.tagline || '').trim(),
      age: node.createdAt ? Math.floor((Date.now() - new Date(node.createdAt).getTime()) / 1000) : 0,
      source: 'producthunt',
    };
  });

  return { posts };
}

async function fetchProductHuntFallback(limit = 20) {
  // Use RSS feed as fallback — no auth required
  const res = await fetch('https://www.producthunt.com/feed?category=undefined', {
    headers: {
      'User-Agent': 'PostIQ/1.0 (Buffer companion app; content planning)',
      'Accept': 'application/rss+xml, application/xml, text/xml',
    },
  });

  if (!res.ok) {
    throw new Error(`Product Hunt RSS returned HTTP ${res.status}`);
  }

  const xml = await res.text();

  // Parse RSS items — simple regex approach (no DOM parser on server)
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const itemXml = match[1];
    const getTag = tag => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };

    const title = getTag('title');
    const link = getTag('link');
    const description = getTag('description');
    const pubDate = getTag('pubDate');

    if (title && link) {
      const ageSeconds = pubDate ? Math.floor((Date.now() - new Date(pubDate).getTime()) / 1000) : 0;
      items.push({
        title: title.slice(0, 200),
        tagline: description.replace(/<[^>]+>/g, '').slice(0, 200),
        score: 0,
        comments: 0,
        sub: 'Product Hunt',
        url: link,
        permalink: link,
        selftext: description.replace(/<[^>]+>/g, '').slice(0, 300),
        age: ageSeconds,
        source: 'producthunt',
      });
    }
  }

  if (!items.length) {
    throw new Error('Product Hunt RSS returned no parseable items');
  }

  return { posts: items };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  let params;
  try {
    if (event.httpMethod === 'POST') {
      params = JSON.parse(event.body || '{}');
    } else {
      params = Object.fromEntries(new URLSearchParams(event.queryStringParameters || {}));
    }
  } catch {
    return errorResponse(400, 'Invalid request body', 'BAD_REQUEST');
  }

  const { source, subreddit, feed, limit } = params;
  const itemLimit = Math.min(Number(limit) || 25, 50);

  try {
    if (source === 'reddit') {
      const result = await fetchReddit(subreddit || 'socialmedia', itemLimit);
      return successResponse(result);
    }

    if (source === 'hn') {
      const result = await fetchHN(feed || 'topstories', itemLimit);
      return successResponse(result);
    }

    if (source === 'producthunt') {
      const result = await fetchProductHunt(itemLimit);
      return successResponse(result);
    }

    return errorResponse(400, `Unknown source: ${source}. Use reddit, hn, or producthunt.`, 'UNKNOWN_SOURCE');
  } catch (err) {
    console.error(`[PostIQ trending] ${source} fetch failed:`, err.message);
    return errorResponse(502, err.message || 'Feed fetch failed', 'FETCH_ERROR');
  }
};
