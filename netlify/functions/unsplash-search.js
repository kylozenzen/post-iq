const UNSPLASH_API = 'https://api.unsplash.com/search/photos';
const MAX_QUERY_LENGTH = 100;
const REQUEST_TIMEOUT_MS = 10000;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return json(503, { error: 'Image search is not configured' });

  const query = String(event.queryStringParameters?.q || '').trim();
  if (!query || query.length > MAX_QUERY_LENGTH) {
    return json(400, { error: 'Enter a search between 1 and 100 characters' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = new URL(UNSPLASH_API);
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', '9');
    url.searchParams.set('orientation', 'landscape');

    const response = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        'Accept-Version': 'v1'
      },
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({ error: 'Invalid image provider response' }));
    return json(response.status, data);
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return json(timedOut ? 504 : 502, {
      error: timedOut ? 'Image search timed out' : 'Image search unavailable'
    });
  } finally {
    clearTimeout(timeout);
  }
};
