'use strict';

(function initializeContentFlow(window) {
  const STATUS = ['idea', 'developing', 'ready'];
  let cards = [];
  let editingId = null;
  let remixId = null;
  let initialized = false;
  const el = id => document.getElementById(id);
  const track = (event, params = {}) => { try { window.GA4?.track(event, params); } catch {} };
  const save = () => {
    try { localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(cards)); } catch {}
    window.dispatchEvent(new CustomEvent('postiq:notebook-changed'));
  };

  function normalizeIdea(card = {}) {
    const sourceText = String(card.sourceText ?? card.body ?? '');
    return {
      ...card, id: String(card.id || `nb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
      type: String(card.type || 'idea'), title: String(card.title || 'Untitled idea'),
      body: String(card.body ?? sourceText), sourceText, targetDate: card.targetDate || '',
      status: STATUS.includes(card.status) ? card.status : 'idea', pillarId: card.pillarId || '',
      aiAssisted: !!card.aiAssisted, buffer: card.buffer && typeof card.buffer === 'object' ? { ...card.buffer } : {},
      variants: Array.isArray(card.variants) ? card.variants.map(variant => ({ ...variant })) : [],
      createdAt: Number(card.createdAt || Date.now())
    };
  }
  function load() {
    try { const value = JSON.parse(localStorage.getItem(NOTEBOOK_KEY) || '[]'); cards = Array.isArray(value) ? value.map(normalizeIdea) : []; }
    catch { cards = []; }
  }
  const getCard = id => cards.find(card => card.id === id);
  const connected = () => !!window.getBufferConnectionState?.().connected;
  const contentEnabled = () => window.ContentItems?.enabled?.() !== false;
  const age = ts => { const days = Math.floor((Date.now() - Number(ts || 0)) / 86400000); return days ? `${days}d ago` : 'today'; };
  const safeUrl = value => window.toSafeExternalUrl?.(value || '') || '';

  function updateCard(id, patch) {
    const index = cards.findIndex(card => card.id === id);
    if (index < 0) return null;
    cards[index] = normalizeIdea({ ...cards[index], ...patch }); save(); render(); return cards[index];
  }
  function addCard(data = {}) {
    const card = normalizeIdea({ ...data, createdAt: Date.now() }); cards.unshift(card); save(); render();
    window.safeTrack?.(() => GA4_Ideas.notebookCardAdded()); track('source_content_created', { status: card.status }); return card;
  }
  function removeCard(id) { cards = cards.filter(card => card.id !== id); save(); render(); }

  function populatePillars(selected = '') {
    const select = el('notecardPillar'); if (!select) return;
    let pillars = [];
    try { pillars = JSON.parse(localStorage.getItem('postiq_pillars_v3') || '{}')?.pillars || []; } catch {}
    select.innerHTML = '<option value="">No pillar</option>' + pillars.map(pillar => `<option value="${safeText(pillar.id)}">${safeText(pillar.name || pillar.title)}</option>`).join('');
    select.value = selected;
  }

  function openModal(prefill = {}) {
    editingId = prefill.id || null; const card = editingId ? getCard(editingId) : normalizeIdea(prefill);
    el('notecardTitle').value = card?.title || ''; el('notecardBody').value = card?.sourceText || card?.body || '';
    el('notecardUrl').value = card?.url || ''; el('notecardType').value = card?.type || 'idea';
    if (el('notecardTargetDate')) el('notecardTargetDate').value = card?.targetDate || '';
    if (el('notecardStatus')) el('notecardStatus').value = card?.status || 'idea';
    populatePillars(card?.pillarId || ''); el('notecardModalTitle').textContent = editingId ? 'Develop content' : 'Capture an idea';
    const modal = el('notecardModal'); modal?.classList.add('open'); if (modal) { modal.hidden = false; modal.setAttribute('aria-hidden', 'false'); }
  }
  function closeModal() { const modal = el('notecardModal'); modal?.classList.remove('open'); if (modal) { modal.hidden = true; modal.setAttribute('aria-hidden', 'true'); } editingId = null; }
  function saveModal() {
    const title = String(el('notecardTitle')?.value || '').trim(); if (!title) return showToast?.('Add a title first', 'error');
    const sourceText = String(el('notecardBody')?.value || '').trim();
    const data = { title, sourceText, body: sourceText, url: el('notecardUrl')?.value || '', type: el('notecardType')?.value || 'idea', targetDate: el('notecardTargetDate')?.value || '', status: el('notecardStatus')?.value || 'idea', pillarId: el('notecardPillar')?.value || '' };
    editingId ? updateCard(editingId, data) : addCard(data); closeModal(); showToast?.('Source saved in PostIQ', 'success');
  }

  function draftInput(card) {
    return { organizationId: state.organizationId, title: card.title, targetDate: card.targetDate || null, draft: { text: card.sourceText, aiAssisted: !!card.aiAssisted, assets: [] } };
  }
  async function syncDraft(card) {
    if (!contentEnabled()) return showToast?.('Buffer draft sync is paused. Your source is saved locally.', 'error');
    if (!connected()) return showToast?.('Sign in with Buffer to save this source there.', 'error');
    track('content_item_draft_sync_attempted', { update: !!card.buffer?.contentItemId });
    try {
      let result;
      if (card.buffer?.contentItemId && card.buffer?.state !== 'posts') {
        const fullDraft = draftInput(card);
        result = await ContentItems.updateContentItemDraft({ contentItemId: card.buffer.contentItemId, draft: fullDraft.draft });
        await ContentItems.updateContentItem({ contentItemId: card.buffer.contentItemId, title: card.title, targetDate: card.targetDate || null });
      } else if (!card.buffer?.contentItemId) result = await ContentItems.createContentItemDraft(draftInput(card));
      else return showToast?.('This Buffer content is already channel-specific. Your source edits remain safe in PostIQ.', 'error');
      updateCard(card.id, { buffer: { ...card.buffer, contentItemId: result.id, state: result.state || 'draft', syncedAt: new Date().toISOString() } });
      track('content_item_draft_sync_succeeded', { update: !!card.buffer?.contentItemId }); showToast?.('Saved to Buffer', 'success');
    } catch (error) {
      if (error.code === 'CONTENT_ITEM_STATE_ERROR') updateCard(card.id, { buffer: { ...card.buffer, state: 'posts', syncedAt: new Date().toISOString() } });
      track('content_item_draft_sync_failed', { error_type: GA4?.getErrorType?.(error) || 'schema_error' });
      showToast?.(error.code === 'CONTENT_ITEM_STATE_ERROR' ? 'Buffer has already turned this into channel versions. Your source edits are still saved here.' : `Buffer draft sync unavailable: ${error.message}`, 'error');
    }
  }

  function channelLabel(channel) { return channel.displayName || channel.name || channel.service || 'Channel'; }
  function openRemix(card) {
    remixId = card.id; el('remixSource').textContent = card.sourceText || 'No source content yet.';
    el('remixChannels').innerHTML = (state.channels || []).map(channel => `<label class="remix-channel"><input type="checkbox" value="${safeText(channel.id)}" ${card.variants.some(v => v.channelId === channel.id) ? 'checked' : ''}><span>${safeText(channelLabel(channel))}</span><small>${safeText(channel.service || '')}</small></label>`).join('') || '<p>Sync Buffer to load channels.</p>';
    renderVariants(card); el('remixModal')?.classList.add('open'); track('remix_opened', { existing_variants: card.variants.length });
  }
  function renderVariants(card) {
    el('remixVariants').innerHTML = card.variants.map((variant, index) => `<div class="remix-variant" data-variant-index="${index}"><div class="remix-variant-title">${safeText(variant.channelName || variant.service || 'Channel')}</div><textarea class="input" data-variant-text="${index}">${safeText(variant.text)}</textarea><div class="remix-schedule"><select class="input" data-variant-mode="${index}"><option value="queue" ${variant.mode === 'queue' ? 'selected' : ''}>Add to queue</option><option value="schedule" ${variant.mode === 'schedule' ? 'selected' : ''}>Schedule</option><option value="draft" ${variant.mode === 'draft' ? 'selected' : ''}>Buffer draft</option></select><input class="input" type="datetime-local" data-variant-due="${index}" value="${safeText(variant.dueAt || '')}"></div><div class="variant-error">${safeText(variant.error || '')}</div></div>`).join('');
  }
  function persistVariantEdits(card) {
    const variants = card.variants.map((variant, index) => ({ ...variant, text: el('remixVariants')?.querySelector(`[data-variant-text="${index}"]`)?.value ?? variant.text, mode: el('remixVariants')?.querySelector(`[data-variant-mode="${index}"]`)?.value || variant.mode, dueAt: el('remixVariants')?.querySelector(`[data-variant-due="${index}"]`)?.value || '' }));
    return updateCard(card.id, { variants });
  }
  async function generateVariants() {
    let card = getCard(remixId); if (!card) return;
    card = persistVariantEdits(card); const selected = [...el('remixChannels').querySelectorAll('input:checked')].map(input => input.value);
    const existing = new Map(card.variants.map(variant => [variant.channelId, variant]));
    let aiVersions = [];
    try {
      const apiKey = localStorage.getItem(window.AIAssist?.KEYS?.apiKey || 'postiq_gemini_api_key');
      if (apiKey && window.AIAssist?.isUnlocked?.()) aiVersions = await window.AIAssist.callGemini({ draft: card.sourceText, action: 'platforms', apiKey, model: localStorage.getItem(window.AIAssist.KEYS.model) || undefined });
    } catch (error) { console.warn('[PostIQ] AI remix unavailable; editable source copies were created instead.', error); }
    const findAIText = channel => { const service = String(channel.service || '').toLowerCase(); const label = service.includes('linkedin') ? 'linkedin' : service.includes('thread') ? 'threads' : service.includes('instagram') ? 'instagram' : service.includes('twitter') || service === 'x' ? 'x/twitter' : ''; return label ? aiVersions.find(version => String(version.label).toLowerCase().includes(label))?.text || '' : ''; };
    const variants = selected.map(channelId => { const channel = state.channels.find(item => item.id === channelId) || {}; return { channelId, service: channel.service || '', channelName: channelLabel(channel), text: existing.get(channelId)?.text || findAIText(channel) || card.sourceText, dueAt: existing.get(channelId)?.dueAt || '', schedulingType: existing.get(channelId)?.schedulingType || 'automatic', mode: existing.get(channelId)?.mode || 'queue', postId: existing.get(channelId)?.postId || null }; });
    updateCard(card.id, { variants, status: variants.length ? 'ready' : card.status }); renderVariants(getCard(card.id));
    track('remix_channels_selected', { channel_count: selected.length }); track('variants_generated', { channel_count: variants.length });
  }
  function promotionPost(variant) {
    const post = { channelId: variant.channelId, text: variant.text, schedulingType: variant.mode === 'queue' ? 'automatic' : variant.mode === 'draft' ? 'draft' : 'scheduled' };
    if (variant.mode === 'schedule' && variant.dueAt) post.dueAt = new Date(variant.dueAt).toISOString(); return post;
  }
  async function promote() {
    let card = getCard(remixId); if (!card) return; card = persistVariantEdits(card);
    if (!card.buffer?.contentItemId || card.buffer.state === 'posts') return showToast?.('Save this source to Buffer as a draft before sending channel versions.', 'error');
    if (!card.variants.length) return showToast?.('Choose channels and generate versions first.', 'error');
    track('content_item_promotion_attempted', { channel_count: card.variants.length });
    try {
      const result = await ContentItems.promoteContentItemDraft({ contentItemId: card.buffer.contentItemId, posts: card.variants.map(promotionPost) });
      const byChannel = new Map(result.posts.map(post => [post.channelId, post]));
      updateCard(card.id, { buffer: { ...card.buffer, state: 'posts', syncedAt: new Date().toISOString(), postIds: result.posts.map(post => post.id) }, variants: card.variants.map(variant => ({ ...variant, postId: byChannel.get(variant.channelId)?.id || null, error: '' })) });
      renderVariants(getCard(card.id)); window.dispatchEvent(new Event('postiq:content-promoted')); track('content_item_promotion_succeeded', { channel_count: result.posts.length }); showToast?.('Channel versions sent to Buffer', 'success');
    } catch (error) {
      const failures = new Map((error.validationErrors || []).map(item => [item.channelId, item.message]));
      updateCard(card.id, { variants: card.variants.map(variant => ({ ...variant, error: failures.get(variant.channelId) || '' })) }); renderVariants(getCard(card.id));
      track('content_item_promotion_failed', { channel_count: card.variants.length }); showToast?.(`Nothing was sent. ${error.message}`, 'error');
    }
  }

  function render() {
    const list = el('notebookList'), empty = el('notebookEmpty'); if (!list || !empty) return; empty.style.display = cards.length ? 'none' : 'block';
    list.innerHTML = cards.map(card => `<article class="notebook-card content-source-card"><div class="notebook-card-meta"><span class="content-status status-${safeText(card.status)}">${safeText(card.status)}</span><span class="notebook-card-age">${safeText(age(card.createdAt))}</span>${card.buffer?.contentItemId ? `<span class="buffer-synced">✓ ${card.buffer.state === 'posts' ? 'Sent to channels' : 'Saved to Buffer'}</span>` : ''}</div><div class="notebook-card-body"><div class="notebook-card-title">${safeText(card.title)}</div>${card.sourceText ? `<div class="notebook-card-excerpt">${safeText(card.sourceText)}</div>` : ''}${card.targetDate ? `<div class="content-target">Target ${safeText(card.targetDate)}</div>` : ''}</div><div class="notebook-card-footer"><button class="btn sm" data-content-edit="${safeText(card.id)}">Develop</button><button class="btn sm primary" data-content-remix="${safeText(card.id)}">Remix to Channels</button>${contentEnabled() ? `<button class="btn sm ghost" data-content-sync="${safeText(card.id)}">${card.buffer?.contentItemId ? 'Update Buffer draft' : 'Save to Buffer'}</button>` : ''}<button class="btn sm ghost" data-notebook-compose="${safeText(card.id)}">Compose</button>${safeUrl(card.url) ? `<a class="notebook-card-source-link" href="${safeText(safeUrl(card.url))}" target="_blank" rel="noopener">↗ Source</a>` : ''}<button class="btn sm ghost" data-notebook-delete="${safeText(card.id)}">Delete</button></div></article>`).join('');
    list.querySelectorAll('[data-content-edit]').forEach(button => button.onclick = () => openModal(getCard(button.dataset.contentEdit)));
    list.querySelectorAll('[data-content-sync]').forEach(button => button.onclick = () => syncDraft(getCard(button.dataset.contentSync)));
    list.querySelectorAll('[data-content-remix]').forEach(button => button.onclick = () => openRemix(getCard(button.dataset.contentRemix)));
    list.querySelectorAll('[data-notebook-delete]').forEach(button => button.onclick = () => removeCard(button.dataset.notebookDelete));
    list.querySelectorAll('[data-notebook-compose]').forEach(button => button.onclick = () => { const card = getCard(button.dataset.notebookCompose); window.pinReferenceToComposer?.({ title: card.title, body: card.sourceText, url: card.url }); window.activateView?.('composerView'); });
  }

  function init() {
    load(); if (initialized) return render(); initialized = true;
    el('newNotecardBtn')?.addEventListener('click', () => openModal()); el('closeNotecardModal')?.addEventListener('click', closeModal); el('cancelNotecardBtn')?.addEventListener('click', closeModal); el('saveNotecardBtn')?.addEventListener('click', saveModal);
    el('remixClose')?.addEventListener('click', () => el('remixModal')?.classList.remove('open')); el('remixGenerate')?.addEventListener('click', generateVariants); el('remixPromote')?.addEventListener('click', promote);
    // Persist review edits before any Buffer call (and as the user types), so a
    // failed request or closed modal never costs independently edited variants.
    el('remixVariants')?.addEventListener('input', () => { const card = getCard(remixId); if (card) persistVariantEdits(card); });
    el('remixVariants')?.addEventListener('change', () => { const card = getCard(remixId); if (card) persistVariantEdits(card); });
    render();
  }
  function saveFromTrending(item = {}) { return addCard({ title: item.title || 'Untitled', sourceText: item.tagline || item.selftext || '', url: item.url || item.permalink || '', type: item.source === 'reddit' ? 'reddit' : item.source === 'hn' ? 'hn' : 'idea' }); }
  window.Notebook = { init, render, addCard, normalizeIdea, updateCard, getCards: () => cards.map(card => normalizeIdea(card)), openModal, saveFromTrending, generateVariants: (card, channels) => channels.map(channel => ({ channelId: channel.id, service: channel.service || '', channelName: channelLabel(channel), text: card.sourceText, dueAt: '', schedulingType: 'automatic', mode: 'queue' })) };
})(window);
