'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { handler } = require('../netlify/functions/holidays');

test('holidays function validates input and keeps only nationwide holidays', async () => {
  assert.equal((await handler({ httpMethod: 'GET', queryStringParameters: { country: 'USA', year: '2026' } })).statusCode, 400);
  assert.equal((await handler({ httpMethod: 'GET', queryStringParameters: { country: 'US', year: '1900' } })).statusCode, 400);
  assert.equal((await handler({ httpMethod: 'POST', queryStringParameters: {} })).statusCode, 405);
  const realFetch = global.fetch;
  global.fetch = async url => {
    assert.equal(String(url), 'https://date.nager.at/api/v3/PublicHolidays/2026/US');
    return { ok: true, status: 200, json: async () => [
      { date: '2026-11-26', name: 'Thanksgiving Day', localName: 'Thanksgiving Day', global: true },
      { date: '2026-03-02', name: 'Texas Independence Day', localName: 'x', global: false },
    ] };
  };
  try {
    const res = await handler({ httpMethod: 'GET', queryStringParameters: { country: 'us', year: '2026' } });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepEqual(body.holidays.map(h => h.name), ['Thanksgiving Day']);
    assert.match(res.headers['Cache-Control'], /max-age=86400/);
  } finally { global.fetch = realFetch; }
});
