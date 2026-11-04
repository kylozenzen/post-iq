// netlify/functions/holidays.js
// Public holidays for one country and year, from Nager.Date (no key needed).
// Proxied so the browser needs no extra CSP origin and responses cache at the edge.
const NAGER = 'https://date.nager.at/api/v3/PublicHolidays';
const REQUEST_TIMEOUT_MS = 8000;

function json(statusCode, body, cache = 'no-store') {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cache },
    body: JSON.stringify(body),
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  const country = String(event.queryStringParameters?.country || '').toUpperCase();
  const year = Number(event.queryStringParameters?.year);
  if (!/^[A-Z]{2}$/.test(country)) return json(400, { error: 'Use a two-letter country code' });
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return json(400, { error: 'Use a year between 2000 and 2100' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${NAGER}/${year}/${country}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (response.status === 404) return json(404, { error: 'Holidays are not available for that country' });
    if (!response.ok) return json(502, { error: 'Holiday service unavailable' });
    const data = await response.json();
    const holidays = (Array.isArray(data) ? data : [])
      .filter(h => /^\d{4}-\d{2}-\d{2}$/.test(h?.date || '') && (h.global !== false)) // skip state-only holidays
      .map(h => ({ date: h.date, name: String(h.name || h.localName || '').slice(0, 80), localName: String(h.localName || '').slice(0, 80) }));
    // Holiday lists don't change within a day; let the CDN and browser keep them.
    return json(200, { country, year, holidays }, 'public, max-age=86400, stale-while-revalidate=604800');
  } catch (error) {
    return json(error?.name === 'AbortError' ? 504 : 502, { error: 'Holiday service unavailable' });
  } finally {
    clearTimeout(timeout);
  }
};
