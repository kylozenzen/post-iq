'use strict';

// ── COMPOSER ──────────────────────────────────────
function editorToText(html) {
  const root = document.createElement('div'); root.innerHTML = html;
  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    const tag = (node.tagName || '').toLowerCase();
    if (tag === 'br') return '\n';
    if (tag === 'strong' || tag === 'b') return `**${[...node.childNodes].map(walk).join('')}**`;
    if (tag === 'em' || tag === 'i') return `*${[...node.childNodes].map(walk).join('')}*`;
    if (tag === 'li') return [...node.childNodes].map(walk).join('');
    if (tag === 'ul') return [...node.children].map(li => `• ${walk(li)}`).join('\n') + '\n';
    if (tag === 'ol') return [...node.children].map((li, i) => `${i+1}. ${walk(li)}`).join('\n') + '\n';
    const inner = [...node.childNodes].map(walk).join('');
    if (['p','div'].includes(tag)) return inner + '\n';
    return inner;
  };
  return [...root.childNodes].map(walk).join('').replace(/\n{3,}/g, '\n\n').trim();
}

function composerFormat(cmd) {
  const sel = window.getSelection(); if (!sel?.rangeCount) return;
  if (cmd === 'bold' || cmd === 'italic') document.execCommand(cmd, false, null);
  else if (cmd === 'ul') document.execCommand('insertUnorderedList', false, null);
  else if (cmd === 'ol') document.execCommand('insertOrderedList', false, null);
  else if (cmd === 'clear') document.execCommand('removeFormat', false, null);
}

const COMPOSER_DRAFT_KEY = 'postiq_composer_draft_v1';
const COMPOSER_DRAFT_DELAY = 500;
const COMPOSER_DRAFT_ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'p', 'div', 'br']);
const COMPOSER_DRAFT_BLOCKED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'img', 'svg']);
let composerDraftSaveTimer = null;
let composerWorkspaceInitialized = false;
let composerResourceReturnFocus = null;

function sanitizeComposerDraftHtml(value) {
  const template = document.createElement('template');
  template.innerHTML = String(value || '');
  template.content.querySelectorAll('*').forEach(node => {
    const tag = node.tagName.toLowerCase();
    if (COMPOSER_DRAFT_BLOCKED_TAGS.has(tag)) {
      node.remove();
      return;
    }
    if (!COMPOSER_DRAFT_ALLOWED_TAGS.has(tag)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    [...node.attributes].forEach(attribute => node.removeAttribute(attribute.name));
  });
  return template.innerHTML.trim();
}

function formatComposerDraftTime(value) {
  const date = new Date(Number(value || 0));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function updateComposerDraftStatus(stateName = 'empty', savedAt = null) {
  const messages = {
    empty: 'Draft autosaves locally',
    saving: 'Saving draft…',
    saved: `Saved locally${savedAt ? ` · ${formatComposerDraftTime(savedAt)}` : ''}`,
    restored: `Restored local draft${savedAt ? ` · ${formatComposerDraftTime(savedAt)}` : ''}`,
    error: 'Autosave unavailable',
  };
  document.querySelectorAll('[data-composer-draft-status]').forEach(element => {
    element.dataset.state = stateName;
    element.textContent = messages[stateName] || messages.empty;
  });
}

function readStoredComposerDraft() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPOSER_DRAFT_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const html = sanitizeComposerDraftHtml(parsed.html);
    if (!html) return null;
    return {
      html,
      channelId: String(parsed.channelId || ''),
      updatedAt: Number(parsed.updatedAt || 0),
    };
  } catch {
    try { localStorage.removeItem(COMPOSER_DRAFT_KEY); } catch {}
    return null;
  }
}

function clearStoredComposerDraft() {
  if (composerDraftSaveTimer) {
    clearTimeout(composerDraftSaveTimer);
    composerDraftSaveTimer = null;
  }
  try { localStorage.removeItem(COMPOSER_DRAFT_KEY); } catch {}
  updateComposerDraftStatus('empty');
}

function getComposerEditorText(editor) {
  return String(editor?.innerText ?? editor?.textContent ?? '').trim();
}

function persistComposerDraft(editor) {
  if (!editor || !getComposerEditorText(editor)) {
    clearStoredComposerDraft();
    return;
  }
  const updatedAt = Date.now();
  const payload = {
    html: sanitizeComposerDraftHtml(editor.innerHTML),
    channelId: qs('composerChannel')?.value || '',
    updatedAt,
  };
  try {
    localStorage.setItem(COMPOSER_DRAFT_KEY, JSON.stringify(payload));
    updateComposerDraftStatus('saved', updatedAt);
  } catch {
    updateComposerDraftStatus('error');
  }
}

function scheduleComposerDraftSave(editor) {
  if (!editor || !getComposerEditorText(editor)) {
    clearStoredComposerDraft();
    return;
  }
  updateComposerDraftStatus('saving');
  if (composerDraftSaveTimer) clearTimeout(composerDraftSaveTimer);
  composerDraftSaveTimer = setTimeout(() => {
    composerDraftSaveTimer = null;
    persistComposerDraft(editor);
  }, COMPOSER_DRAFT_DELAY);
}

function initComposerAutosave(editor) {
  const storedDraft = readStoredComposerDraft();
  if (storedDraft && !getComposerEditorText(editor)) {
    editor.innerHTML = storedDraft.html;
    const channel = qs('composerChannel');
    if (channel && storedDraft.channelId && [...channel.options].some(option => option.value === storedDraft.channelId)) {
      channel.value = storedDraft.channelId;
    }
    updateComposerDraftStatus('restored', storedDraft.updatedAt);
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertFromPaste' }));
  } else {
    updateComposerDraftStatus(getComposerEditorText(editor) ? 'saved' : 'empty', storedDraft?.updatedAt);
  }

  editor.addEventListener('input', () => scheduleComposerDraftSave(editor));
  qs('composerChannel')?.addEventListener('change', () => scheduleComposerDraftSave(editor));
  window.addEventListener('beforeunload', () => persistComposerDraft(editor));
}

function updateComposerResourceToggles(open) {
  document.querySelectorAll('[data-composer-resources-toggle]').forEach(button => {
    button.setAttribute('aria-expanded', String(open));
  });
}

function setComposerResourcesOpen(open, trigger = null) {
  const drawer = qs('composerSupportSection');
  if (!drawer) return;
  const shouldOpen = !!open;
  if (shouldOpen) {
    const composeMode = document.querySelector('[data-cmode="compose"]');
    if (composeMode && !composeMode.classList.contains('active')) composeMode.click();
    composerResourceReturnFocus = trigger || document.activeElement;
  }
  document.body.classList.toggle('composer-resources-open', shouldOpen);
  drawer.classList.toggle('open', shouldOpen);
  drawer.setAttribute('aria-hidden', String(!shouldOpen));
  if (shouldOpen) drawer.removeAttribute('inert');
  else drawer.setAttribute('inert', '');
  updateComposerResourceToggles(shouldOpen);

  if (shouldOpen) {
    requestAnimationFrame(() => qs('composerResourcesClose')?.focus());
  } else if (composerResourceReturnFocus && document.contains(composerResourceReturnFocus)) {
    composerResourceReturnFocus.focus();
    composerResourceReturnFocus = null;
  }
}

function setComposerFocusMode(active, returnFocus = true) {
  const shouldFocus = !!active;
  const focusBar = qs('composerFocusBar');
  if (shouldFocus) {
    const composeMode = document.querySelector('[data-cmode="compose"]');
    if (composeMode && !composeMode.classList.contains('active')) composeMode.click();
  }
  document.body.classList.toggle('composer-focus-mode', shouldFocus);
  if (focusBar) focusBar.hidden = !shouldFocus;
  document.querySelectorAll('[data-composer-focus-toggle]').forEach(button => {
    button.setAttribute('aria-pressed', String(shouldFocus));
    button.setAttribute('aria-label', shouldFocus ? 'Exit focus mode' : 'Enter focus mode');
    const label = button.querySelector('.composer-focus-label');
    if (label) label.textContent = shouldFocus ? 'Exit focus' : (button.closest('.mob-view-hdr') ? 'Focus' : 'Focus mode');
  });
  if (shouldFocus) {
    requestAnimationFrame(() => qs('composerEditor')?.focus());
  } else if (returnFocus) {
    const visibleToggle = [...document.querySelectorAll('#composerView [data-composer-focus-toggle]')]
      .find(button => !button.closest('.composer-focus-bar') && button.offsetParent !== null);
    visibleToggle?.focus();
  }
}

function initComposerWorkspace(editor) {
  if (composerWorkspaceInitialized || !editor) return;
  composerWorkspaceInitialized = true;
  initComposerAutosave(editor);

  document.querySelectorAll('[data-composer-resources-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const drawer = qs('composerSupportSection');
      setComposerResourcesOpen(!drawer?.classList.contains('open'), button);
    });
  });
  qs('composerResourcesClose')?.addEventListener('click', () => setComposerResourcesOpen(false));
  qs('composerResourceBackdrop')?.addEventListener('click', () => setComposerResourcesOpen(false));

  document.querySelectorAll('[data-composer-focus-toggle]').forEach(button => {
    button.addEventListener('click', () => setComposerFocusMode(!document.body.classList.contains('composer-focus-mode')));
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (document.body.classList.contains('composer-resources-open')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setComposerResourcesOpen(false);
      return;
    }
    if (document.body.classList.contains('composer-focus-mode')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setComposerFocusMode(false);
    }
  });

  window.addEventListener('postiq:view-changed', event => {
    if (event.detail?.viewId === 'composerView') return;
    composerResourceReturnFocus = null;
    setComposerResourcesOpen(false);
    setComposerFocusMode(false, false);
  });
}
