'use strict';

// AI Assist is intentionally isolated from Buffer authentication and app state.
window.AIAssist = (() => {
  const KEYS = {
    unlocked: 'postiq_ai_assist_beta_unlocked',
    unlockedAt: 'postiq_ai_assist_beta_unlocked_at',
    apiKey: 'postiq_gemini_api_key',
    model: 'postiq_gemini_model',
    voice: 'postiq_ai_voice_settings',
  };
  const DEFAULT_MODEL = 'gemini-2.5-flash';
  const ACTIONS = {
    rewrite: { label: 'Rewrite', instruction: 'Improve clarity, flow, and impact while keeping the same overall meaning.', count: 3 },
    shorter: { label: 'Make shorter', instruction: 'Condense the post while preserving the strongest idea.', count: 3 },
    punchier: { label: 'Make punchier', instruction: 'Strengthen the hook, sharpen the wording, and make the post feel more scroll-stopping.', count: 3 },
    human: { label: 'Make more human', instruction: 'Remove stiff, corporate, robotic, or obviously AI-sounding phrasing. Make it natural and conversational.', count: 3 },
    hooks: { label: 'Generate hooks', instruction: 'Create short, distinct opening hooks based on the draft that are usable as opening lines.', count: 5 },
    platforms: { label: 'Create platform versions', instruction: 'Create clearly labeled versions for LinkedIn, X/Twitter, Threads, and Instagram caption.', count: 4 },
  };
  const PLATFORM_LABELS = ['LinkedIn', 'X/Twitter', 'Threads', 'Instagram caption'];
  let results = [];
  let generating = false;

  const el = id => document.getElementById(id);
  const read = key => { try { return localStorage.getItem(key) || ''; } catch (_) { return ''; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); return true; } catch (_) { return false; } };
  const remove = key => { try { localStorage.removeItem(key); return true; } catch (_) { return false; } };
  const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

  function isDevEnabled() {
    const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const queryEnabled = new URLSearchParams(location.search).get('enable_ai_assist_dev') === 'true';
    const viteStyleFlag = window.__POSTIQ_ENV__?.VITE_ENABLE_AI_ASSIST_DEV === 'true';
    return localHost && (queryEnabled || viteStyleFlag);
  }

  function isUnlocked() {
    return read(KEYS.unlocked) === 'true' || isDevEnabled();
  }

  function unlock() {
    const saved = write(KEYS.unlocked, 'true');
    if (saved) write(KEYS.unlockedAt, new Date().toISOString());
    renderAccess();
    if (saved) window.dispatchEvent(new CustomEvent('postiq:ai-assist-unlocked'));
    return saved;
  }

  function lock() {
    remove(KEYS.unlocked);
    remove(KEYS.unlockedAt);
    renderAccess();
  }

  async function validateInvite(code) {
    let response;
    try {
      response = await fetch('/.netlify/functions/validate-ai-invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok && response.status >= 500) throw new Error(data.message || 'Invite validation is unavailable.');
      return data;
    } catch (_) {
      throw new Error('We could not check that invite code right now. Please try again.');
    }
  }

  function getVoiceSettings() {
    try { return JSON.parse(read(KEYS.voice) || '{}'); } catch (_) { return {}; }
  }

  function getDraft() {
    const editor = el('composerEditor');
    if (!editor) return '';
    return typeof window.editorToText === 'function' ? window.editorToText(editor.innerHTML) : editor.innerText.trim();
  }

  function setDraft(text, append = false) {
    const editor = el('composerEditor');
    if (!editor) return;
    const current = getDraft();
    editor.innerText = append && current ? `${current}\n\n${text}` : text;
    editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    editor.focus();
  }

  function voicePrompt(voice) {
    const labels = { name: 'Voice name', tone: 'Tone', audience: 'Audience', avoid: 'Avoid phrases', notes: 'Writing style notes' };
    const lines = Object.entries(voice).filter(([, value]) => String(value || '').trim()).map(([key, value]) => `${labels[key]}: ${value}`);
    return lines.length ? `\nUse these optional voice settings:\n${lines.join('\n')}` : '';
  }

  function geminiEndpoint(model, apiKey) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  }

  async function requestGemini({ apiKey, model, prompt, temperature = 0.7 }) {
    let response;
    try {
      response = await fetch(geminiEndpoint(model, apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature },
        }),
      });
    } catch (_) {
      throw new Error('AI Assist could not reach Gemini. Check your connection and try again.');
    }
    if (!response.ok) throw new Error('Gemini could not complete that request. Check your API key and model access.');
    let data;
    try { data = await response.json(); } catch (_) { throw new Error('Gemini returned an unexpected result. Please try again.'); }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!String(text || '').trim()) throw new Error('Gemini returned an unexpected result. Please try again.');
    return String(text).trim();
  }

  function parseResults(text, action) {
    const config = ACTIONS[action];
    try {
      const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed.results) || parsed.results.length < config.count) throw new Error();
      const cleaned = parsed.results.slice(0, config.count).map((item, index) => ({
        label: action === 'platforms' ? PLATFORM_LABELS[index] : (item.label || `${config.label} ${index + 1}`),
        text: String(item.text || '').trim(),
      })).filter(item => item.text);
      if (cleaned.length !== config.count) throw new Error();
      return cleaned;
    } catch (_) {
      throw new Error('Gemini returned an unexpected result. Please try that action again.');
    }
  }

  async function callGemini({ draft, action, apiKey, model, voice }) {
    const config = ACTIONS[action];
    const platformRule = action === 'platforms' ? ` Use these labels exactly and in this order: ${PLATFORM_LABELS.join(', ')}.` : '';
    const prompt = `You are an expert social media strategist and editor.

Global rules:
- Preserve the user's core idea.
- Avoid sounding generic or overly corporate.
- Avoid excessive emojis.
- Avoid hashtags unless the original draft uses them or the action asks for platform versions.
- Keep the tone clear, useful, and human.
- Return only the requested results.
- Do not include explanations before or after the results.
- Do not include markdown tables.
- Return valid JSON only, with a top-level "results" array. Each item must have "label" and "text" strings.${voicePrompt(voice)}

Selected action: ${config.label}
Editor instruction: ${config.instruction}${platformRule}
Return exactly ${config.count} results.

User's draft:
${draft}`;
    return parseResults(await requestGemini({ apiKey, model, prompt }), action);
  }

  async function generatePlatformDrafts({ source, platforms, apiKey, model, voice }) {
    const requested = [...new Set((platforms || []).map(service => window.PlatformGuidance.key(service)))];
    if (!requested.length) return [];
    const definitions = requested.map(key => ({ key, ...window.PlatformGuidance.get(key) }));
    const instructions = definitions.map(platform => `\n${platform.key} (${platform.label}):\n- ${platform.guidance.join('\n- ')}`).join('\n');
    const prompt = `You are an expert social media editor. Adapt the source into exactly one genuinely platform-specific draft for every requested platform.
Preserve the core idea and author's natural voice. Do not schedule or publish anything. Do not invent extra platforms. Return valid JSON only as {"results":[{"platform":"platform-key","text":"draft"}]}.
Requested platform keys, each required exactly once:${instructions}

Source:
${source}`;
    const raw = await requestGemini({ apiKey, model: model || DEFAULT_MODEL, prompt });
    let parsed;
    try { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()); } catch (_) { throw new Error('Gemini returned an unexpected platform remix. Please try again.'); }
    if (!Array.isArray(parsed.results) || parsed.results.length !== requested.length) throw new Error('Gemini did not return every selected platform. Please try again.');
    const byPlatform = new Map(parsed.results.map(item => [window.PlatformGuidance.key(item.platform), String(item.text || '').trim()]));
    if (byPlatform.size !== requested.length || requested.some(key => !byPlatform.get(key))) throw new Error('Gemini did not return every selected platform. Please try again.');
    return requested.map(key => ({ platform: key, label: window.PlatformGuidance.label(key), text: byPlatform.get(key) }));
  }

  async function developJSON({ content, task, answer = '', apiKey, model, voice }) {
    const prompt = `You are PostIQ's creative thinking assistant. Help develop an idea before it becomes social posts. Never write a finished post. Return valid JSON only.${voicePrompt(voice || {})}
Task: ${task}
For "question", return {"question":"one useful question"}. Choose what is missing; do not use a fixed sequence.
For "classify", return {"target":"coreThought|tension|whyItMatters|audience|proof|notes|angle","value":"the user's answer, lightly cleaned"}.
For "angles", return {"angles":[3-5 objects with "type","title","description"]}; treatments must be genuinely different.
Idea context: ${JSON.stringify(content)}
${answer ? `User answer: ${answer}` : ''}`;
    const raw = await requestGemini({ apiKey, model: model || DEFAULT_MODEL, prompt });
    try { return JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()); }
    catch (_) { throw new Error('Gemini returned an unexpected development suggestion. Please try again.'); }
  }

  async function testConnection(apiKey, model) {
    if (!apiKey) throw new Error('That Gemini key did not work. Check your API key and model access.');
    try {
      await requestGemini({ apiKey, model: model || DEFAULT_MODEL, prompt: 'Reply with OK.', temperature: 0 });
      return true;
    } catch (_) {
      throw new Error('That Gemini key did not work. Check your API key and model access.');
    }
  }

  function setStatus(id, message, type = '') {
    const node = el(id); if (!node) return;
    node.textContent = message; node.className = `ai-status${type ? ` ${type}` : ''}`;
  }

  function renderAccess() {
    const unlocked = isUnlocked();
    const hasApiKey = !!read(KEYS.apiKey);
    el('aiAssistGate')?.toggleAttribute('hidden', unlocked);
    el('aiAssistMissingKey')?.toggleAttribute('hidden', !unlocked || hasApiKey);
    el('aiAssistPanel')?.toggleAttribute('hidden', !unlocked || !hasApiKey);
    el('aiSettingsLocked')?.toggleAttribute('hidden', unlocked);
    el('aiSettingsUnlocked')?.toggleAttribute('hidden', !unlocked);
    el('aiSettingsFallbackLocked')?.toggleAttribute('hidden', unlocked);
    el('aiSettingsFallbackUnlocked')?.toggleAttribute('hidden', !unlocked);
    if (unlocked) renderSettings();
  }

  function renderSettings() {
    const key = read(KEYS.apiKey);
    ['aiApiKey', 'aiApiKeyFallback'].forEach(id => {
      const keyInput = el(id);
      if (keyInput) { keyInput.value = ''; keyInput.placeholder = key ? `Saved ••••${key.slice(-4)}` : 'Paste Gemini API key…'; }
    });
    ['aiModel', 'aiModelFallback'].forEach(id => { if (el(id)) el(id).value = read(KEYS.model) || DEFAULT_MODEL; });
    const voice = getVoiceSettings();
    Object.entries({ aiVoiceName: 'name', aiVoiceTone: 'tone', aiVoiceAudience: 'audience', aiVoiceAvoid: 'avoid', aiVoiceNotes: 'notes' }).forEach(([id, keyName]) => { if (el(id)) el(id).value = voice[keyName] || ''; });
  }

  function renderResults() {
    const container = el('aiAssistResults'); if (!container) return;
    container.innerHTML = results.map((result, index) => `<article class="ai-result-card"><div class="ai-result-label">${escapeHtml(result.label)}</div><div class="ai-result-text">${escapeHtml(result.text)}</div><div class="ai-result-actions"><button class="btn sm primary" type="button" data-ai-result="replace" data-index="${index}">Replace</button><button class="btn sm" type="button" data-ai-result="insert" data-index="${index}">Insert below</button><button class="btn sm ghost" type="button" data-ai-result="copy" data-index="${index}">Copy</button><button class="btn sm ghost" type="button" data-ai-result="draft" data-index="${index}">Save as Draft</button></div></article>`).join('');
  }

  async function runAction(action) {
    if (generating) return;
    const draft = getDraft();
    const apiKey = read(KEYS.apiKey);
    if (!draft) return setStatus('aiAssistStatus', 'Add a rough draft first, then AI Assist can help improve it.', 'error');
    if (!apiKey) return setStatus('aiAssistStatus', 'Add your Gemini API key in AI Settings to use AI Assist.', 'error');
    generating = true;
    document.querySelectorAll('[data-ai-action]').forEach(button => { button.disabled = true; });
    setStatus('aiAssistStatus', `${ACTIONS[action].label} in progress…`, 'loading');
    try {
      results = await callGemini({ draft, action, apiKey, model: read(KEYS.model) || DEFAULT_MODEL, voice: getVoiceSettings() });
      renderResults(); setStatus('aiAssistStatus', `${results.length} results ready.`, 'success');
    } catch (error) { setStatus('aiAssistStatus', error.message, 'error'); }
    finally { generating = false; document.querySelectorAll('[data-ai-action]').forEach(button => { button.disabled = false; }); }
  }

  function bindGate() {
    el('aiInviteUnlock')?.addEventListener('click', async () => {
      const input = el('aiInviteCode'); const code = input?.value.trim();
      if (!code) return setStatus('aiInviteStatus', 'Enter an invite code first.', 'error');
      const button = el('aiInviteUnlock'); button.disabled = true; button.textContent = 'Checking…'; setStatus('aiInviteStatus', 'Checking your invite…', 'loading');
      try {
        const result = await validateInvite(code);
        if (!result.valid) return setStatus('aiInviteStatus', 'That invite code didn’t work. Check it and try again.', 'error');
        input.value = '';
        if (!unlock()) return setStatus('aiInviteStatus', 'AI Assist could not save unlock access in this browser. Check browser storage settings and try again.', 'error');
        setStatus('aiInviteStatus', 'AI Assist unlocked.', 'success');
      } catch (error) { setStatus('aiInviteStatus', error.message, 'error'); }
      finally { button.disabled = false; button.textContent = 'Unlock AI Assist'; }
    });
    el('aiWaitlistToggle')?.addEventListener('click', () => { const form = el('aiWaitlistForm'); if (form) form.hidden = !form.hidden; });
  }

  function bindSettings() {
    const saveKey = (inputId, statusId) => {
      const input = el(inputId); const key = input?.value.trim();
      if (!key) return setStatus(statusId, 'Enter a Gemini API key first.', 'error');
      if (!write(KEYS.apiKey, key)) return setStatus(statusId, 'Could not save the Gemini API key. Check browser storage settings and try again.', 'error');
      input.value = ''; renderAccess(); setStatus(statusId, 'Gemini API key saved locally.', 'success');
    };
    const clearKey = statusId => {
      if (!remove(KEYS.apiKey)) return setStatus(statusId, 'Could not clear the Gemini API key. Check browser storage settings and try again.', 'error');
      renderAccess(); setStatus(statusId, 'Gemini API key cleared.', 'success');
    };
    const testKey = async (buttonId, modelId, statusId) => {
      const button = el(buttonId); button.disabled = true; setStatus(statusId, 'Testing connection…', 'loading');
      try { await testConnection(read(KEYS.apiKey), el(modelId)?.value || DEFAULT_MODEL); setStatus(statusId, 'Gemini connection looks good.', 'success'); }
      catch (error) { setStatus(statusId, error.message, 'error'); }
      finally { button.disabled = false; }
    };
    el('aiSaveKey')?.addEventListener('click', () => saveKey('aiApiKey', 'aiSettingsStatus'));
    el('aiSaveKeyFallback')?.addEventListener('click', () => saveKey('aiApiKeyFallback', 'aiSettingsFallbackStatus'));
    el('aiClearKey')?.addEventListener('click', () => clearKey('aiSettingsStatus'));
    el('aiClearKeyFallback')?.addEventListener('click', () => clearKey('aiSettingsFallbackStatus'));
    el('aiTestKey')?.addEventListener('click', () => testKey('aiTestKey', 'aiModel', 'aiSettingsStatus'));
    el('aiTestKeyFallback')?.addEventListener('click', () => testKey('aiTestKeyFallback', 'aiModelFallback', 'aiSettingsFallbackStatus'));
    ['aiModel', 'aiModelFallback'].forEach(id => el(id)?.addEventListener('change', event => { write(KEYS.model, event.target.value); renderSettings(); }));
    ['aiSettingsOpenCompose', 'aiSettingsFallbackOpenCompose'].forEach(id => el(id)?.addEventListener('click', () => { if (typeof window.closeModal === 'function') window.closeModal('settingsModal'); if (typeof window.activateView === 'function') window.activateView('composerView'); }));
    el('aiSaveVoice')?.addEventListener('click', () => {
      const voice = { name: el('aiVoiceName')?.value.trim(), tone: el('aiVoiceTone')?.value.trim(), audience: el('aiVoiceAudience')?.value.trim(), avoid: el('aiVoiceAvoid')?.value.trim(), notes: el('aiVoiceNotes')?.value.trim() };
      write(KEYS.voice, JSON.stringify(voice)); setStatus('aiSettingsStatus', 'Voice settings saved.', 'success');
    });
  }

  function bindPanel() {
    document.querySelectorAll('[data-ai-action]').forEach(button => button.addEventListener('click', () => runAction(button.dataset.aiAction)));
    el('aiAssistResults')?.addEventListener('click', async event => {
      const button = event.target.closest('[data-ai-result]'); if (!button) return;
      const result = results[Number(button.dataset.index)]; if (!result) return;
      if (button.dataset.aiResult === 'replace') { setDraft(result.text); setStatus('aiAssistStatus', 'Caption replaced.', 'success'); }
      if (button.dataset.aiResult === 'insert') { setDraft(result.text, true); setStatus('aiAssistStatus', 'Result inserted below.', 'success'); }
      if (button.dataset.aiResult === 'copy') { await navigator.clipboard.writeText(result.text); setStatus('aiAssistStatus', 'Result copied.', 'success'); }
      if (button.dataset.aiResult === 'draft') { setDraft(result.text); el('composerDraft')?.click(); }
    });
    ['openAISettings', 'openAISettingsMissingKey'].forEach(id => el(id)?.addEventListener('click', () => { if (typeof window.selectSettingsTab === 'function') window.selectSettingsTab('ai'); if (typeof window.openModal === 'function') window.openModal('settingsModal'); }));
  }

  function init() {
    bindGate(); bindSettings(); bindPanel(); renderAccess();
    window.addEventListener('storage', event => { if ([KEYS.unlocked, KEYS.apiKey, KEYS.model, KEYS.voice].includes(event.key)) renderAccess(); });
  }
  return { init, isUnlocked, unlock, lock, validateInvite, callGemini, generatePlatformDrafts, developJSON, getVoiceSettings, testConnection, KEYS };
})();
