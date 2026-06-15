'use strict';

// netlify/functions/trending.js
// Server-side proxy for trending feeds — avoids CORS and CSP issues.
// Hotfix: never let external feed failures take down the app UI.

const HN_FEED_TYPES = ['topstories', 'newstories', 'beststories'];
const RSS_FEEDS = {
  'buffer-blog': { id: 'buffer-blog', name: 'Buffer Blog', type: 'rss', url: 'https://buffer.com/resources/feed' },
  'social-media-today': { id: 'social-media-today', name: 'Social Media Today', type: 'rss', url: 'https://www.socialmediatoday.com/feeds/news' },
};

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function cleanFeedText(value, max = 300) {
  const decoded = decodeHtmlEntities(String(value || ''));
  return decoded
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'public, max-age=300',
  };
}

function successResponse(data) {
  return {
    statusCode: 200,
    headers: corsHeaders(),
    body: JSON.stringify(data),
  };
}

function errorResponse(statusCode, message, code) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify({ error: message, code }),
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackPosts(source = 'trending', reason = '') {
  const label = source === 'reddit'
    ? 'Trending fallback'
    : source === 'hn'
      ? 'Hacker News fallback'
      : source === 'rss'
        ? 'RSS fallback'
        : 'Content fallback';

  return {
    posts: [
      {
        title: 'Trending feed is temporarily unavailable',
        tagline: 'The source did not respond, but PostIQ is still working.',
        score: 0,
        comments: 0,
        sub: label,
        url: 'https://buffer.com/resources/',
        permalink: 'https://buffer.com/resources/',
        selftext: reason ? `Feed fallback: ${reason}` : 'Try refreshing again in a minute.',
        age: 0,
        source,
        fallback: true,
      },
      {
        title: 'Content idea: turn a recent win into a teaching post',
        tagline: 'Fallback prompt while live trend sources recover.',
        score: 0,
        comments: 0,
        sub: 'PostIQ idea',
        url: 'https://buffer.com/resources/',
        permalink: 'https://buffer.com/resources/',
        selftext: 'What worked, why it worked, and what others can borrow from it.',
        age: 0,
        source,
        fallback: true,
      },
    ],
    fallback: true,
    warning: reason || 'Feed unavailable',
  };
}

function parseFeedXml(xml, sourceName, sourceId, limit = 20) {
  const posts = [];
  const parseItem = (chunk, mode) => {
    const getTag = tag => {
      const m = chunk.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      return m ? (m[1] || m[2] || '').trim() : '';
    };

    const title = getTag('title');
    const link = mode === 'atom'
      ? ((chunk.match(/<link[^>]+href="([^"]+)"/i) || [])[1] || getTag('id'))
      : getTag('link');
    const description = getTag('description') || getTag('summary') || getTag('content');
    const pubDate = getTag('pubDate') || getTag('updated') || getTag('published');

    if (!title || !link) return;

    posts.push({
      title: cleanFeedText(title, 250),
      tagline: cleanFeedText(description, 200),
      score: 0,
      comments: 0,
      sub: sourceName,
      url: link,
      permalink: link,
      selftext: cleanFeedText(description, 300),
      age: pubDate ? Math.max(0, Math.floor((Date.now() - new Date(pubDate).getTime()) / 1000)) : 0,
      source: sourceId,
    });
  };

  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && posts.length < limit) parseItem(match[1], 'rss');
  while ((match = entryRegex.exec(xml)) !== null && posts.length < limit) parseItem(match[1], 'atom');

  return posts;
}

async function fetchReddit(subreddit, limit = 25) {
  const sub = String(subreddit || 'socialmedia')
    .replace(/^r\//i, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 50) || 'socialmedia';

  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; PostIQBot/1.0; +https://postiq.netlify.app)',
    'Accept': 'application/json, application/rss+xml, application/xml, text/xml',
  };

  try {
    const res = await fetchWithTimeout(`https://www.reddit.com/r/${sub}/hot.json?limit=${limit}&raw_json=1`, { headers });
    if (res.ok) {
      const data = await res.json();
      const posts = (data?.data?.children || [])
        .filter(p => p?.data && !p.data.stickied && p.data.title)
        .map(p => ({
          title: String(p.data.title || '').trim(),
          score: Number(p.data.score || 0),
          comments: Number(p.data.num_comments || 0),
          sub: `r/${p.data.subreddit || sub}`,
          url: p.data.url && !p.data.is_self ? String(p.data.url) : `https://reddit.com${p.data.permalink || ''}`,
          permalink: `https://reddit.com${p.data.permalink || ''}`,
          selftext: String(p.data.selftext || '').slice(0, 300),
          age: Math.floor(Date.now() / 1000) - Number(p.data.created_utc || 0),
          source: 'reddit',
        }));
      if (posts.length) return { posts, subreddit: sub };
    }

    const rss = await fetchWithTimeout(`https://www.reddit.com/r/${sub}/hot.rss?limit=${limit}`, { headers });
    if (!rss.ok) throw new Error(`Reddit returned HTTP ${res.status}/${rss.status} for r/${sub}`);
    const xml = await rss.text();
    const posts = parseFeedXml(xml, `r/${sub}`, 'reddit', limit).map(post => ({ ...post, sub: `r/${sub}` }));
    if (posts.length) return { posts, subreddit: sub, fallback: 'rss' };
    throw new Error(`Reddit returned no parseable posts for r/${sub}`);
  } catch (err) {
    console.warn('[PostIQ trending] reddit fallback used:', err.message);
    return fallbackPosts('reddit', err.message);
  }
}

async function fetchHN(feedType = 'topstories', limit = 20) {
  const feed = HN_FEED_TYPES.includes(feedType) ? feedType : 'topstories';

  try {
    const idsRes = await fetchWithTimeout(`https://hacker-news.firebaseio.com/v0/${feed}.json`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!idsRes.ok) throw new Error(`HN returned HTTP ${idsRes.status} for ${feed}`);

    const ids = await idsRes.json();
    if (!Array.isArray(ids)) throw new Error('Invalid HN response — expected array of IDs');

    const topIds = ids.slice(0, Math.min(limit, 30));
    const items = await Promise.allSettled(
      topIds.map(id =>
        fetchWithTimeout(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
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

    if (posts.length) return { posts, feed };
    throw new Error(`HN returned no posts for ${feed}`);
  } catch (err) {
    console.warn('[PostIQ trending] hn fallback used:', err.message);
    return fallbackPosts('hn', err.message);
  }
}

async function fetchProductHunt(limit = 20) {
  try {
    const rss = await fetchWithTimeout('https://www.producthunt.com/feed?category=undefined', {
      headers: {
        'User-Agent': 'PostIQ/1.0 (Buffer companion app; content planning)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });
    if (!rss.ok) throw new Error(`Product Hunt RSS returned HTTP ${rss.status}`);
    const xml = await rss.text();
    const posts = parseFeedXml(xml, 'Product Hunt', 'producthunt', limit);
    if (posts.length) return { posts };
    throw new Error('Product Hunt returned no parseable items');
  } catch (err) {
    console.warn('[PostIQ trending] producthunt fallback used:', err.message);
    return fallbackPosts('producthunt', err.message);
  }
}

async function fetchRSS(feedId, limit = 20) {
  const selected = RSS_FEEDS[String(feedId || '').trim()] || RSS_FEEDS['buffer-blog'];

  try {
    const res = await fetchWithTimeout(selected.url, {
      headers: {
        'User-Agent': 'PostIQ/1.0 (Buffer companion app; content planning)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
    });
    if (!res.ok) throw new Error(`${selected.name} returned HTTP ${res.status}`);
    const xml = await res.text();
    const posts = parseFeedXml(xml, selected.name, 'rss', limit);
    if (posts.length) return { posts, feed: selected };
    throw new Error(`${selected.name} returned no parseable items`);
  } catch (err) {
    console.warn('[PostIQ trending] rss fallback used:', err.message);
    return fallbackPosts('rss', err.message);
  }
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  let params;
  try {
    params = event.httpMethod === 'POST'
      ? JSON.parse(event.body || '{}')
      : Object.fromEntries(new URLSearchParams(event.queryStringParameters || {}));
  } catch {
    return errorResponse(400, 'Invalid request body', 'BAD_REQUEST');
  }

  const { source, subreddit, feed, limit } = params;
  const itemLimit = Math.min(Number(limit) || 25, 50);

  try {
    if (source === 'reddit') return successResponse(await fetchReddit(subreddit || 'socialmedia', itemLimit));
    if (source === 'hn') return successResponse(await fetchHN(feed || 'topstories', itemLimit));
    if (source === 'producthunt') return successResponse(await fetchProductHunt(itemLimit));
    if (source === 'rss') return successResponse(await fetchRSS(feed || 'buffer-blog', itemLimit));

    return errorResponse(400, `Unknown source: ${source}. Use reddit, hn, producthunt, or rss.`, 'UNKNOWN_SOURCE');
  } catch (err) {
    // Last-ditch safety: the app should not see a 502 because one external feed is down.
    console.error(`[PostIQ trending] unexpected ${source} failure:`, err);
    return successResponse(fallbackPosts(source || 'trending', err.message || 'Unexpected feed failure'));
  }
};
