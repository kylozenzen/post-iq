'use strict';

// AI Assist is intentionally isolated from Buffer authentication and app state.
window.AIAssist = (() => {
  const KEYS = {
    unlocked: 'postiq_ai_assist_beta_unlocked',
    unlockedAt: 'postiq_ai_assist_beta_unlocked_at',
    apiKey: 'postiq_openai_api_key',
    model: 'postiq_ai_model',
    voice: 'postiq_ai_voice_settings',
  };
  const DEFAULT_MODEL = 'gpt-4.1-mini';
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

  async function callOpenAI({ draft, action, apiKey, model, voice }) {
    const config = ACTIONS[action];
    const platformRule = action === 'platforms' ? ` Use these labels exactly: ${PLATFORM_LABELS.join(', ')}.` : '';
    const system = `You are an expert social media strategist and editor. Preserve the user's core idea. Avoid generic, overly corporate language, excessive emojis, and hashtags unless the original uses them or platform versions benefit from them. Keep the tone clear, useful, and human. Return only valid JSON with a top-level "results" array. Each item must have "label" and "text" strings. Do not add explanations or markdown tables.${voicePrompt(voice)}`;
    const user = `${config.instruction}${platformRule} Return exactly ${config.count} results.\n\nDraft:\n${draft}`;
    let response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0.8, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
    } catch (_) {
      throw new Error('AI Assist could not reach OpenAI. Check your connection and try again.');
    }
    if (response.status === 401) throw new Error('That OpenAI API key was not accepted. Check it in AI Settings.');
    if (!response.ok) throw new Error('OpenAI could not generate results right now. Please try again.');
    const data = await response.json();
    try {
      const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
      if (!Array.isArray(parsed.results) || parsed.results.length < config.count) throw new Error();
      const cleaned = parsed.results.slice(0, config.count).map((item, index) => ({
        label: action === 'platforms' ? PLATFORM_LABELS[index] : (item.label || `${config.label} ${index + 1}`),
        text: String(item.text || '').trim(),
      })).filter(item => item.text);
      if (cleaned.length !== config.count) throw new Error();
      return cleaned;
    } catch (_) {
      throw new Error('OpenAI returned an unexpected result. Please try that action again.');
    }
  }

  async function testConnection(apiKey, model) {
    if (!apiKey) throw new Error('Add an OpenAI API key first.');
    let response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || DEFAULT_MODEL, max_completion_tokens: 1, messages: [{ role: 'user', content: 'Reply OK.' }] }),
      });
    } catch (_) {
      throw new Error('That key didn’t work. Check your OpenAI API key and try again.');
    }
    if (!response.ok) throw new Error('That key didn’t work. Check your OpenAI API key and try again.');
    return true;
  }

  function setStatus(id, message, type = '') {
    const node = el(id); if (!node) return;
    node.textContent = message; node.className = `ai-status${type ? ` ${type}` : ''}`;
  }

  function renderAccess() {
    const unlocked = isUnlocked();
    el('aiAssistGate')?.toggleAttribute('hidden', unlocked);
    el('aiAssistPanel')?.toggleAttribute('hidden', !unlocked);
    el('aiSettingsLocked')?.toggleAttribute('hidden', unlocked);
    el('aiSettingsUnlocked')?.toggleAttribute('hidden', !unlocked);
    if (unlocked) renderSettings();
  }

  function renderSettings() {
    const key = read(KEYS.apiKey);
    const keyInput = el('aiApiKey');
    if (keyInput) { keyInput.value = ''; keyInput.placeholder = key ? `Saved ••••${key.slice(-4)}` : 'sk-…'; }
    if (el('aiModel')) el('aiModel').value = read(KEYS.model) || DEFAULT_MODEL;
    const voice = getVoiceSettings();
    Object.entries({ aiVoiceName: 'name', aiVoiceTone: 'tone', aiVoiceAudience: 'audience', aiVoiceAvoid: 'avoid', aiVoiceNotes: 'notes' }).forEach(([id, keyName]) => { if (el(id)) el(id).value = voice[keyName] || ''; });
  }

  function renderResults() {
    const container = el('aiAssistResults'); if (!container) return;
    container.innerHTML = results.map((result, index) => `<article class="ai-result-card"><div class="ai-result-label">${escapeHtml(result.label)}</div><div class="ai-result-text">${escapeHtml(result.text)}</div><div class="ai-result-actions"><button class="btn sm primary" type="button" data-ai-result="replace" data-index="${index}">Replace</button><button class="btn sm" type="button" data-ai-result="insert" data-index="${index}">Insert below</button><button class="btn sm ghost" type="button" data-ai-result="copy" data-index="${index}">Copy</button><button class="btn sm ghost" type="button" data-ai-result="draft" data-index="${index}">Save Buffer draft</button></div></article>`).join('');
  }

  async function runAction(action) {
    if (generating) return;
    const draft = getDraft();
    const apiKey = read(KEYS.apiKey);
    if (!draft) return setStatus('aiAssistStatus', 'Add a rough draft first, then AI Assist can help improve it.', 'error');
    if (!apiKey) return setStatus('aiAssistStatus', 'Add your OpenAI API key in AI Settings to use AI Assist.', 'error');
    generating = true;
    document.querySelectorAll('[data-ai-action]').forEach(button => { button.disabled = true; });
    setStatus('aiAssistStatus', `${ACTIONS[action].label} in progress…`, 'loading');
    try {
      results = await callOpenAI({ draft, action, apiKey, model: read(KEYS.model) || DEFAULT_MODEL, voice: getVoiceSettings() });
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
    el('aiSaveKey')?.addEventListener('click', () => {
      const input = el('aiApiKey'); const key = input?.value.trim();
      if (!key) return setStatus('aiSettingsStatus', 'Enter an OpenAI API key first.', 'error');
      if (!write(KEYS.apiKey, key)) return setStatus('aiSettingsStatus', 'Could not save the OpenAI API key. Check browser storage settings and try again.', 'error');
      input.value = ''; renderSettings(); setStatus('aiSettingsStatus', 'OpenAI API key saved locally.', 'success');
    });
    el('aiClearKey')?.addEventListener('click', () => {
      if (!remove(KEYS.apiKey)) return setStatus('aiSettingsStatus', 'Could not clear the OpenAI API key. Check browser storage settings and try again.', 'error');
      renderSettings(); setStatus('aiSettingsStatus', 'OpenAI API key cleared.', 'success');
    });
    el('aiTestKey')?.addEventListener('click', async () => {
      const button = el('aiTestKey'); button.disabled = true; setStatus('aiSettingsStatus', 'Testing connection…', 'loading');
      try { await testConnection(read(KEYS.apiKey), el('aiModel')?.value || DEFAULT_MODEL); setStatus('aiSettingsStatus', 'OpenAI connection looks good.', 'success'); }
      catch (error) { setStatus('aiSettingsStatus', error.message, 'error'); }
      finally { button.disabled = false; }
    });
    el('aiModel')?.addEventListener('change', event => write(KEYS.model, event.target.value));
    el('aiSettingsOpenCompose')?.addEventListener('click', () => { if (typeof window.closeModal === 'function') window.closeModal('settingsModal'); if (typeof window.activateView === 'function') window.activateView('composerView'); });
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
    el('openAISettings')?.addEventListener('click', () => { if (typeof window.selectSettingsTab === 'function') window.selectSettingsTab('ai'); if (typeof window.openModal === 'function') window.openModal('settingsModal'); });
  }

  function init() {
    bindGate(); bindSettings(); bindPanel(); renderAccess();
    window.addEventListener('storage', event => { if ([KEYS.unlocked, KEYS.apiKey, KEYS.model, KEYS.voice].includes(event.key)) renderAccess(); });
  }
  return { init, isUnlocked, unlock, lock, validateInvite, callOpenAI, testConnection, KEYS };
})();
