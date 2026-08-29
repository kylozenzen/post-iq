'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

let requestBody;
const window = { addEventListener() {} };
const sandbox = {
  window, location: { hostname: 'postiq.test', search: '' }, URLSearchParams,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { getElementById: () => null, querySelectorAll: () => [] },
  fetch: async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ results: [
      { platform: 'linkedin', text: 'LinkedIn result' }, { platform: 'threads', text: 'Threads result' }, { platform: 'bluesky', text: 'Bluesky result' }
    ] }) }] } }] }) };
  }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/features/platform-guidance.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('js/ai-assist.js', 'utf8'), sandbox);

(async () => {
  const result = await window.AIAssist.generatePlatformDrafts({ source: 'One source', platforms: ['linkedin', 'threads', 'bluesky'], apiKey: 'key' });
  assert.deepEqual([...result].map(item => item.platform), ['linkedin', 'threads', 'bluesky']);
  const prompt = requestBody.contents[0].parts[0].text;
  assert.match(prompt, /Bluesky/); assert.doesNotMatch(prompt, /Instagram/); assert.doesNotMatch(prompt, /Facebook/);
  assert.equal(window.PlatformGuidance.label('linkedin'), 'LinkedIn');
  assert.equal(window.PlatformGuidance.label('bluesky'), 'Bluesky');
  assert.notEqual(window.PlatformGuidance.label('linkedin'), window.PlatformGuidance.label('bluesky'), 'identical account names remain platform-distinguishable');
  const detail = fs.readFileSync('js/features/content-detail.js', 'utf8');
  assert.match(detail, /Platform tips/); assert.match(detail, /Source copied — edit for this platform/); assert.match(detail, /Platform-adapted/);
  console.log('Content Flow selected-platform remix, Bluesky, labels, fallback, and tips tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
