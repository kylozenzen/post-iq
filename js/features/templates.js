'use strict';

// ── TEMPLATES ──────────────────────────────────────
function loadTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    if (!raw) { state.templates = []; return; }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) { state.templates = []; return; }
    state.templates = parsed.map((s, i) => ({
      id: String(s.id || `${Date.now()}-${i}`),
      title: String(s.title || 'Untitled'),
      type: TEMPLATE_TYPES.includes(s.type) ? s.type : 'Hooks',
      platform: TEMPLATE_PLATFORMS.includes(s.platform) ? s.platform : 'Universal',
      tags: normTags(s.tags),
      body: String(s.body || ''),
      createdAt: String(s.createdAt || new Date().toISOString()),
      updatedAt: String(s.updatedAt || new Date().toISOString()),
    }));
  } catch { state.templates = []; }
}
function persistTemplates() { try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(state.templates)); } catch {} }

function filteredTemplates(search = state.templateSearch, type = state.templateType, platform = state.templatePlatform) {
  const q = search.trim().toLowerCase();
  return state.templates.filter(s => {
    const typeOk = type === 'All' || s.type === type;
    const platOk = platform === 'All Platforms' || s.platform === platform;
    const txt = `${s.title} ${s.body} ${(s.tags || []).join(' ')}`.toLowerCase();
    return typeOk && platOk && (!q || txt.includes(q));
  });
}

function renderTemplateTypeFilters() {
  const rail = qs('templateTypeFilters'); rail.innerHTML = '';
  TEMPLATE_TYPES.forEach(type => {
    const count = type === 'All' ? state.templates.length : state.templates.filter(s => s.type === type).length;
    const b = document.createElement('button');
    b.className = `type-filter-btn ${state.templateType === type ? 'active' : ''}`;
    b.innerHTML = `<span>${type}</span><span class="type-filter-count">${count || ''}</span>`;
    b.onclick = () => { state.templateType = type; renderTemplates(); };
    rail.appendChild(b);
  });
}

function renderTemplates() {
  renderTemplateTypeFilters();
  const list = filteredTemplates();
  const grid = qs('templatesGrid');
  qs('templatesEmpty').style.display = list.length ? 'none' : 'flex';
  grid.innerHTML = '';
  list.forEach(s => {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `
      <div class="template-card-hdr">
        <div class="template-card-title">${safeText(s.title)}</div>
        <div style="display:flex;gap:3px;flex-shrink:0;">
          <span class="chip">${safeText(s.type)}</span>
          <span class="chip">${safeText(s.platform)}</span>
        </div>
      </div>
      <div class="template-card-body">${safeText(s.body)}</div>
      ${s.tags?.length ? `<div class="template-card-tags">${safeText(s.tags.join(' · '))}</div>` : ''}
      <div class="template-card-actions">
        <button class="btn sm" type="button" data-template-action="copy" data-template-id="${safeText(s.id)}">Copy</button>
        <button class="btn sm primary" type="button" data-template-action="use" data-template-id="${safeText(s.id)}">→ Compose</button>
        <button class="btn sm ghost" type="button" data-template-action="edit" data-template-id="${safeText(s.id)}" style="margin-left:auto;">✏️</button>
        <button class="btn sm ghost" type="button" data-template-action="delete" data-template-id="${safeText(s.id)}">🗑</button>
      </div>`;
    grid.appendChild(card);
  });
  renderComposerTemplateSidebar();
}

function renderComposerTemplateSidebar() {
  const list = qs('composerTemplateList'); if (!list) return;
  const items = state.templates.slice(0, 8);
  if (!items.length) { list.innerHTML = "<div style=\"font-size:12px;color:var(--subtle);padding:8px 0;font-family:'DM Mono',monospace;\">No templates yet.</div>"; return; }
  list.innerHTML = '';
  items.forEach(s => {
    const el = document.createElement('div');
    el.className = 'template-item';
    el.innerHTML = `<div class="template-item-title">${safeText(s.title)}</div><div class="template-item-preview">${safeText(compact(s.body, 70))}</div>`;
    el.onclick = () => useTemplateInEditor(s);
    list.appendChild(el);
  });
}


function updateComposerClearButtonVisibility() {
  const editor = document.getElementById('composerEditor');
  const editorText = typeof getComposerEditorText === 'function'
    ? getComposerEditorText(editor)
    : String(editor?.innerText ?? editor?.textContent ?? '').trim();
  const hasContent = !!editorText;
  const ccBtn = document.getElementById('composerClearBtn');
  const ccBtnMob = document.getElementById('composerClearBtnMob');
  if (ccBtn) ccBtn.style.display = hasContent ? 'inline-flex' : 'none';
  if (ccBtnMob) ccBtnMob.style.display = hasContent ? 'inline-flex' : 'none';
}

function clearComposer() {
  const editor = document.getElementById('composerEditor');
  if (!editor) return;
  editor.focus();
  try {
    document.execCommand('selectAll', false, null);
    document.execCommand('removeFormat', false, null);
  } catch {}
  editor.innerHTML = '';
  editor.textContent = '';
  if (typeof clearStoredComposerDraft === 'function') clearStoredComposerDraft();
  editor.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'deleteContentBackward'
  }));

  // Status message
  const status = qs('composerStatus');
  if (status) status.textContent = '';

  // Schedule panel — close and reset all fields
  const schedulePanel = qs('schedulePanel');
  if (schedulePanel) schedulePanel.classList.remove('open');
  const scheduleToggle = qs('composerScheduleToggle');
  if (scheduleToggle) scheduleToggle.style.display = 'inline-flex';
  const scheduleDate = qs('scheduleDate');
  if (scheduleDate) scheduleDate.value = new Date().toISOString().slice(0, 10);
  const scheduleHour = qs('scheduleHour');
  if (scheduleHour) scheduleHour.selectedIndex = 0;
  const scheduleMin = qs('scheduleMin');
  if (scheduleMin) scheduleMin.selectedIndex = 0;
  const scheduleAmpm = qs('scheduleAmpm');
  if (scheduleAmpm) {
    const now = new Date();
    scheduleAmpm.value = now.getHours() >= 12 ? 'PM' : 'AM';
  }
  const composerWhen = qs('composerWhen');
  if (composerWhen) composerWhen.value = '';

  // Approval checkbox
  const needsApproval = qs('needsApprovalCheck');
  if (needsApproval) needsApproval.checked = false;

  // Reference pin
  const refPin = qs('refPin');
  if (refPin) refPin.style.display = 'none';
  const refPinSourceLink = qs('refPinSourceLink');
  if (refPinSourceLink) { refPinSourceLink.style.display = 'none'; refPinSourceLink.href = '#'; }

  // Media
  clearMedia();
  closeMediaPanel();

  // Draft transfer state if present
  if (typeof clearDraftTransferState === 'function') clearDraftTransferState();

  composerContentStartedTracked = false;
  composerMilestonesTracked.clear();
  safeTrack(() => GA4_Composer.composerCleared());
  updateComposerClearButtonVisibility();
}



function useTemplateInEditor(template) {
  const editor = qs('composerEditor'); if (!editor) return;
  const body = template.body || '';
  try {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      sel.deleteFromDocument();
      sel.getRangeAt(0).insertNode(document.createTextNode(body));
    } else {
      editor.innerText = editor.innerText ? `${editor.innerText}\n\n${body}` : body;
    }
  } catch { editor.innerText = editor.innerText ? `${editor.innerText}\n\n${body}` : body; }
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
  updateComposerClearButtonVisibility();
  editor.focus();
  showToast('Template inserted', 'success');
  safeTrack(() => GA4_Composer.templateInserted(template.type || 'custom'));
  safeTrack(() => GA4_Templates.templateUsed(template.type || 'custom'));
}

function openTemplateModal(id = null) {
  const templateModalTitle = qs('templateModalTitle');
  const templateTitle = qs('templateTitle');
  const templateType = qs('templateType');
  const templatePlatform = qs('templatePlatform');
  const templateTags = qs('templateTags');
  const templateBody = qs('templateBody');

  if (!templateModalTitle || !templateTitle || !templateType || !templatePlatform || !templateTags || !templateBody) {
    console.warn('[PostIQ] Template modal is missing required fields');
    showToast('Template editor is missing required fields', 'error');
    return false;
  }

  let s = null;
  if (id) {
    s = state.templates.find(x => x.id === id);
    if (!s) {
      showToast('Template not found', 'error');
      console.warn('[PostIQ] Missing template for edit:', id);
      return false;
    }
    state.editingTemplateId = id;
  } else {
    state.editingTemplateId = null;
  }

  templateModalTitle.textContent = s ? 'Edit Template' : 'New Template';
  templateTitle.value = s?.title || '';
  templateType.value = s?.type || 'Hooks';
  templatePlatform.value = s?.platform || 'Universal';
  templateTags.value = (s?.tags || []).join(', ');
  templateBody.value = s?.body || '';

  const opened = openModal('templateModal');
  if (opened) templateTitle.focus();
  return opened;
}

function saveTemplate() {
  const templateTitle = qs('templateTitle');
  const templateBody = qs('templateBody');
  const templateType = qs('templateType');
  const templatePlatform = qs('templatePlatform');
  const templateTags = qs('templateTags');
  if (!templateTitle || !templateBody || !templateType || !templatePlatform || !templateTags) {
    console.warn('[PostIQ] Cannot save template because fields are missing');
    showToast('Template form is missing fields', 'error');
    return;
  }

  const title = templateTitle.value.trim();
  const body = templateBody.value.trim();
  if (!title || !body) { showToast('Title and body required', 'error'); return; }
  const now = new Date().toISOString();

  const editingId = state.editingTemplateId || null;
  const prev = editingId ? state.templates.find(s => s.id === editingId) : null;
  const treatingAsNew = !!editingId && !prev;
  const id = treatingAsNew ? `${Date.now()}-${Math.random().toString(16).slice(2, 7)}` : (editingId || `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`);

  const payload = {
    id,
    title,
    type: templateType.value,
    platform: templatePlatform.value,
    tags: normTags(templateTags.value),
    body,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };

  if (editingId && prev) {
    state.templates = state.templates.map(s => s.id === editingId ? payload : s);
  } else {
    state.templates = [payload, ...state.templates];
  }
  persistTemplates(); closeModal('templateModal'); renderTemplates(); showToast('Template saved', 'success');
  safeTrack(() => editingId && prev ? GA4_Templates.templateEdited() : GA4_Templates.templateCreated(payload.type || 'custom'));
}

function deleteTemplate(id) {
  if (!confirm('Delete this template?')) return;
  state.templates = state.templates.filter(s => s.id !== id);
  persistTemplates(); renderTemplates(); showToast('Deleted');
  safeTrack(() => GA4_Templates.templateDeleted());
}

function renderTemplatePicker() {
  const list = qs('pickerList');
  const items = filteredTemplates(qs('pickerSearch').value, qs('pickerType').value, 'All Platforms');
  qs('pickerEmpty').style.display = items.length ? 'none' : 'flex';
  list.innerHTML = '';
  items.forEach(s => {
    const el = document.createElement('div');
    el.style.cssText = 'padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--surface);transition:all .1s;';
    el.innerHTML = `<strong style="font-size:13px;">${safeText(s.title)}</strong><div style="font-size:12px;color:var(--muted);margin-top:3px;">${safeText(compact(s.body, 150))}</div>`;
    el.onmouseenter = () => { el.style.borderColor = 'var(--brand-glow)'; el.style.background = 'var(--brand-dim)'; };
    el.onmouseleave = () => { el.style.borderColor = 'var(--border)'; el.style.background = 'var(--surface)'; };
    el.onclick = () => { useTemplateInEditor(s); closeModal('templatePickerModal'); };
    list.appendChild(el);
  });
}

function initTemplateSelectors() {
  ['templatePlatform', 'templatePlatformFilter'].forEach(id => {
    const sel = qs(id); if (!sel) return;
    sel.innerHTML = '';
    TEMPLATE_PLATFORMS.forEach((p, i) => {
      if (id === 'templatePlatformFilter' && i === 0) return;
      const o = document.createElement('option'); o.value = p; o.textContent = p; sel.appendChild(o);
    });
    if (id === 'templatePlatformFilter') {
      const allOpt = document.createElement('option'); allOpt.value = 'All Platforms'; allOpt.textContent = 'All Platforms';
      sel.prepend(allOpt); sel.value = 'All Platforms';
    }
  });
  ['templateType', 'pickerType'].forEach(id => {
    const sel = qs(id); if (!sel) return;
    sel.innerHTML = '';
    TEMPLATE_TYPES.forEach((t, i) => {
      if (id === 'templateType' && i === 0) return;
      const o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o);
    });
  });
}
