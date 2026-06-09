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
  const elements = Object.fromEntries(['aiAssistGate', 'aiAssistMissingKey', 'aiAssistPanel', 'aiSettingsLocked', 'aiSettingsUnlocked', 'aiSettingsFallbackLocked', 'aiSettingsFallbackUnlocked', 'aiApiKey', 'aiApiKeyFallback', 'aiModel', 'aiModelFallback'].map(id => [id, {
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
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }) };
    },
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
  assert.equal(elements.aiAssistMissingKey.hidden, false);
  assert.equal(elements.aiAssistPanel.hidden, true);
  assert.equal(elements.aiSettingsLocked.hidden, true);
  assert.equal(elements.aiSettingsUnlocked.hidden, false);
  assert.equal(elements.aiSettingsFallbackLocked.hidden, true);
  assert.equal(elements.aiSettingsFallbackUnlocked.hidden, false);
  assert.equal(elements.aiModel.value, 'gemini-2.5-flash');

  stored.set('postiq_openai_api_key', 'old-key-must-be-ignored');
  context.AIAssist.init();
  assert.equal(elements.aiAssistMissingKey.hidden, false);
  assert.equal(elements.aiAssistPanel.hidden, true);

  stored.set('postiq_gemini_api_key', 'test-key-never-logged');
  context.AIAssist.init();
  assert.equal(elements.aiAssistMissingKey.hidden, true);
  assert.equal(elements.aiAssistPanel.hidden, false);
  assert.match(elements.aiApiKey.placeholder, /Saved/);
  assert.match(elements.aiApiKeyFallback.placeholder, /Saved/);

  await context.AIAssist.testConnection('test-key-never-logged', 'gemini-2.5-flash');
  assert.equal(requests[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test-key-never-logged');
  assert.deepEqual(Object.keys(requests[0].options.headers), ['Content-Type']);
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.contents[0].role, 'user');
  assert.equal(body.contents[0].parts[0].text, 'Reply with OK.');
  assert.equal(body.generationConfig.temperature, 0);

  const generated = JSON.stringify({ results: [
    { label: 'One', text: 'First rewrite' },
    { label: 'Two', text: 'Second rewrite' },
    { label: 'Three', text: 'Third rewrite' },
  ] });
  context.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: generated }] } }] }) };
  };
  const results = await context.AIAssist.callGemini({ draft: 'Rough idea', action: 'rewrite', apiKey: 'test-key-never-logged', model: 'gemini-2.5-flash', voice: { tone: 'Warm' } });
  assert.equal(results.length, 3);
  assert.equal(results[0].text, 'First rewrite');
  const generateBody = JSON.parse(requests[1].options.body);
  assert.match(generateBody.contents[0].parts[0].text, /Selected action: Rewrite/);
  assert.match(generateBody.contents[0].parts[0].text, /Tone: Warm/);
  assert.match(generateBody.contents[0].parts[0].text, /User's draft:\nRough idea/);
}

function testStaticIntegration() {
  const html = fs.readFileSync('app.html', 'utf8');
  const js = fs.readFileSync('ai-assist.js', 'utf8');
  const toml = fs.readFileSync('netlify.toml', 'utf8');
  assert.match(html, /id="aiAssistGate"[\s\S]*AI Assist Private Beta/);
  assert.match(html, /id="aiAssistMissingKey"[^>]*hidden[\s\S]*AI Assist is unlocked\. Add your Gemini API key in AI Settings\.[\s\S]*Open AI Settings/);
  assert.match(html, /id="aiAssistPanel"[^>]*hidden/);
  assert.match(html, /id="settingsTabAI"[^>]*>AI Settings<\/button>/);
  assert.doesNotMatch(html, /id="settingsTabAI"[^>]*hidden/);
  assert.match(html, /id="aiSettingsLocked"[\s\S]*Unlock status: Locked[\s\S]*AI Assist is currently in private beta\. Unlock AI Assist in Compose to add your Gemini API key\./);
  assert.match(html, /id="aiSettingsUnlocked"[^>]*hidden[\s\S]*Unlock status: Unlocked[\s\S]*id="aiApiKey"[^>]*type="password"[\s\S]*id="aiSaveKey"[\s\S]*id="aiTestKey"[\s\S]*id="aiClearKey"/);
  assert.match(html, /Create a Gemini API key in Google AI Studio, then paste it here\./);
  assert.match(html, /Your Gemini API key is stored locally in this browser and is used only to power your AI Assist requests\./);
  assert.match(html, /id="aiSettingsFallback"[\s\S]*AI Settings loaded[\s\S]*id="aiSettingsFallbackUnlocked"[^>]*hidden[\s\S]*id="aiApiKeyFallback"/);
  assert.match(html, /id="aiModel"[\s\S]*value="gemini-2\.5-flash"[\s\S]*value="gemini-2\.5-flash-lite"[\s\S]*value="gemini-2\.5-pro"/);
  assert.match(html, /name="ai-assist-waitlist"[\s\S]*data-netlify="true"/);
  assert.doesNotMatch(html, /OpenAI|openai|gpt-4/);
  assert.match(js, /postiq_ai_assist_beta_unlocked/);
  assert.match(js, /postiq_gemini_api_key/);
  assert.match(js, /postiq_gemini_model/);
  assert.doesNotMatch(js, /postiq_openai_api_key|postiq_ai_model|api\.openai\.com/);
  assert.match(js, /const DEFAULT_MODEL = 'gemini-2\.5-flash'/);
  assert.match(js, /Gemini connection looks good\./);
  assert.match(js, /That Gemini key did not work\. Check your API key and model access\./);
  assert.match(js, /candidates\?\.\[0\]\?\.content\?\.parts\?\.\[0\]\?\.text/);
  assert.match(js, /generationConfig: \{ temperature \}/);
  assert.doesNotMatch(js, /settingsTabAI'\)\?\.toggleAttribute\('hidden'/);
  assert.match(js, /AI_ASSIST_INVITE_CODES|validate-ai-invite/);
  assert.doesNotMatch(js, /POSTIQ-AI-BETA|BEN-TEST-01|POSTIQ-FIRST-10/);
  assert.match(toml, /connect-src 'self' https:\/\/generativelanguage\.googleapis\.com/);
  assert.doesNotMatch(toml, /api\.openai\.com/);
}

(async () => {
  await testInviteFunction();
  await testClientAccessState();
  testStaticIntegration();
  console.log('AI Assist tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
