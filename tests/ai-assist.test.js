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


async function testClientAccessState() {
  const vm = require('node:vm');
  const source = fs.readFileSync('ai-assist.js', 'utf8');
  const stored = new Map();
  const elements = Object.fromEntries(['aiAssistGate', 'aiAssistPanel', 'aiSettingsLocked', 'aiSettingsUnlocked', 'aiApiKey', 'aiModel'].map(id => [id, {
    id, hidden: false, value: '', placeholder: '',
    toggleAttribute(name, force) { if (name === 'hidden') this.hidden = force; },
    addEventListener() {},
  }]));
  const requests = [];
  const context = {
    console, URLSearchParams, CustomEvent: class CustomEvent {},
    location: { hostname: 'postiq.netlify.app', search: '' },
    localStorage: {
      getItem: key => stored.has(key) ? stored.get(key) : null,
      setItem: (key, value) => stored.set(key, String(value)),
      removeItem: key => stored.delete(key),
    },
    document: { getElementById: id => elements[id] || null, querySelectorAll: () => [] },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, status: 200 }; },
  };
  context.window = context;
  context.window.addEventListener = () => {};
  context.window.dispatchEvent = () => {};
  vm.createContext(context);
  vm.runInContext(source, context);

  context.AIAssist.init();
  assert.equal(elements.aiAssistGate.hidden, false);
  assert.equal(elements.aiAssistPanel.hidden, true);
  assert.equal(elements.aiSettingsLocked.hidden, false);
  assert.equal(elements.aiSettingsUnlocked.hidden, true);

  assert.equal(context.AIAssist.unlock(), true);
  assert.equal(stored.get('postiq_ai_assist_beta_unlocked'), 'true');
  assert.ok(stored.get('postiq_ai_assist_beta_unlocked_at'));
  assert.equal(elements.aiAssistGate.hidden, true);
  assert.equal(elements.aiAssistPanel.hidden, false);
  assert.equal(elements.aiSettingsLocked.hidden, true);
  assert.equal(elements.aiSettingsUnlocked.hidden, false);
  assert.equal(elements.aiModel.value, 'gpt-4.1-mini');

  await context.AIAssist.testConnection('test-key-never-logged', 'gpt-4.1-mini');
  assert.equal(requests[0].url, 'https://api.openai.com/v1/chat/completions');
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.model, 'gpt-4.1-mini');
  assert.equal(body.max_completion_tokens, 1);
}

function testStaticIntegration() {
  const html = fs.readFileSync('app.html', 'utf8');
  const js = fs.readFileSync('ai-assist.js', 'utf8');
  const toml = fs.readFileSync('netlify.toml', 'utf8');
  assert.match(html, /id="aiAssistGate"[\s\S]*AI Assist Private Beta/);
  assert.match(html, /id="aiAssistPanel"[^>]*hidden/);
  assert.match(html, /id="settingsTabAI"[^>]*>AI Settings<\/button>/);
  assert.doesNotMatch(html, /id="settingsTabAI"[^>]*hidden/);
  assert.match(html, /id="aiSettingsLocked"[\s\S]*AI Assist is currently in private beta\. Unlock AI Assist in Compose to add your OpenAI API key\./);
  assert.match(html, /id="aiSettingsUnlocked"[^>]*hidden[\s\S]*id="aiApiKey"[\s\S]*id="aiSaveKey"[\s\S]*id="aiTestKey"[\s\S]*id="aiClearKey"/);
  assert.match(html, /id="aiModel"[\s\S]*value="gpt-4\.1-mini"[\s\S]*value="gpt-4o-mini"[\s\S]*value="gpt-4\.1"/);
  assert.match(html, /name="ai-assist-waitlist"[\s\S]*data-netlify="true"/);
  assert.match(js, /postiq_ai_assist_beta_unlocked/);
  assert.match(js, /postiq_openai_api_key/);
  assert.match(js, /const DEFAULT_MODEL = 'gpt-4\.1-mini'/);
  assert.match(js, /OpenAI connection looks good\./);
  assert.match(js, /That key didn’t work\. Check your OpenAI API key and try again\./);
  assert.match(js, /max_completion_tokens: 1/);
  assert.doesNotMatch(js, /settingsTabAI'\)\?\.toggleAttribute\('hidden'/);
  assert.match(js, /AI_ASSIST_INVITE_CODES|validate-ai-invite/);
  assert.doesNotMatch(js, /POSTIQ-AI-BETA|BEN-TEST-01|POSTIQ-FIRST-10/);
  assert.match(toml, /connect-src 'self' https:\/\/api\.openai\.com/);
}

(async () => {
  await testInviteFunction();
  await testClientAccessState();
  testStaticIntegration();
  console.log('AI Assist tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
