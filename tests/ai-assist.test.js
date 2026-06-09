'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

async function testInviteFunction() {
  const original = process.env.AI_ASSIST_INVITE_CODES;
  process.env.AI_ASSIST_INVITE_CODES = ' ALPHA-one, Beta-Two ';
  const { handler } = require('../netlify/functions/validate-ai-invite.js');

  let result = await handler({ httpMethod: 'POST', body: JSON.stringify({ code: 'alpha-ONE' }) });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), { valid: true, message: 'AI Assist unlocked.' });
  assert.doesNotMatch(result.body, /Beta-Two/);

  result = await handler({ httpMethod: 'POST', body: JSON.stringify({ code: 'nope' }) });
  assert.deepEqual(JSON.parse(result.body), { valid: false, message: 'Invalid invite code.' });

  result = await handler({ httpMethod: 'POST', body: '{}' });
  assert.equal(result.statusCode, 400);
  assert.equal(JSON.parse(result.body).message, 'Enter an invite code.');

  result = await handler({ httpMethod: 'GET', body: '' });
  assert.equal(result.statusCode, 405);

  result = await handler({ httpMethod: 'OPTIONS', body: '' });
  assert.equal(result.statusCode, 204);

  delete process.env.AI_ASSIST_INVITE_CODES;
  result = await handler({ httpMethod: 'POST', body: JSON.stringify({ code: 'anything' }) });
  assert.equal(result.statusCode, 500);
  assert.equal(JSON.parse(result.body).message, 'AI Assist beta access is not configured yet.');

  if (original === undefined) delete process.env.AI_ASSIST_INVITE_CODES;
  else process.env.AI_ASSIST_INVITE_CODES = original;
}

function testStaticIntegration() {
  const html = fs.readFileSync('app.html', 'utf8');
  const js = fs.readFileSync('ai-assist.js', 'utf8');
  const toml = fs.readFileSync('netlify.toml', 'utf8');
  assert.match(html, /id="aiAssistGate"[\s\S]*AI Assist Private Beta/);
  assert.match(html, /id="aiAssistPanel"[^>]*hidden/);
  assert.match(html, /id="settingsTabAI"[^>]*hidden/);
  assert.match(html, /name="ai-assist-waitlist"[\s\S]*data-netlify="true"/);
  assert.match(js, /postiq_ai_assist_beta_unlocked/);
  assert.match(js, /postiq_openai_api_key/);
  assert.match(js, /AI_ASSIST_INVITE_CODES|validate-ai-invite/);
  assert.doesNotMatch(js, /POSTIQ-AI-BETA|BEN-TEST-01|POSTIQ-FIRST-10/);
  assert.match(toml, /connect-src 'self' https:\/\/api\.openai\.com/);
}

(async () => {
  await testInviteFunction();
  testStaticIntegration();
  console.log('AI Assist tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
