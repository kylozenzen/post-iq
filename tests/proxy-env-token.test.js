const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const proxyPath = path.resolve(__dirname, '../netlify/functions/buffer-proxy.js');
function freshProxy() { delete require.cache[proxyPath]; return require(proxyPath); }
const event = { httpMethod: 'POST', headers: { origin: 'https://postiq.netlify.app' }, body: JSON.stringify({ query: '{ account { id } }' }) };

test('a deployed proxy never falls back to a personal Buffer key', async () => {
  const saved = { ...process.env };
  const realFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; return { ok: true, status: 200, json: async () => ({ data: {} }), text: async () => '{}' }; };
  try {
    for (const context of ['production', 'deploy-preview', 'branch-deploy', undefined]) {
      process.env.BUFFER_API_KEY = 'owner-key';
      if (context) process.env.CONTEXT = context; else delete process.env.CONTEXT;
      const res = await freshProxy().handler(event);
      assert.equal(res.statusCode, 401, `refused with CONTEXT=${context}`);
    }
    assert.equal(called, false, 'Buffer was never called with the owner key');
    process.env.CONTEXT = 'dev';
    const dev = await freshProxy().handler(event);
    assert.notEqual(dev.statusCode, 401, 'netlify dev can still use a local key');
  } finally {
    global.fetch = realFetch;
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});
