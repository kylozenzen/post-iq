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
      variants: Array.isArray(card.variants) ? card.variants.map(variant => ({ ...variant, buffer: variant.buffer && typeof variant.buffer === 'object' ? { ...variant.buffer } : (variant.postId ? { postId: variant.postId } : {}) })) : [],
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
  const platform = service => window.PlatformGuidance?.get?.(service) || { label: String(service || 'Platform'), tip: '', guidance: [] };

  function updateCard(id, patch, options = {}) {
    const index = cards.findIndex(card => card.id === id);
    if (index < 0) return null;
    cards[index] = normalizeIdea({ ...cards[index], ...patch }); save(); if (!options.silent) render(); return cards[index];
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
    if (!contentEnabled()) return showToast?.('Buffer source sync is paused. Your source is saved locally.', 'error');
    if (!connected()) return showToast?.('Sign in with Buffer to sync this source.', 'error');
    track('content_item_draft_sync_attempted', { update: !!card.buffer?.contentItemId });
    let result;
    try {
      if (card.buffer?.contentItemId && card.buffer?.state !== 'posts') {
        const fullDraft = draftInput(card);
        result = await ContentItems.updateContentItemDraft({ id: card.buffer.contentItemId, draft: fullDraft.draft });
        result = await ContentItems.updateContentItem({ id: card.buffer.contentItemId, title: card.title, targetDate: card.targetDate || null });
      } else if (!card.buffer?.contentItemId) result = await ContentItems.createContentItemDraft(draftInput(card));
      else return showToast?.('This Buffer content is already channel-specific. Your source edits remain safe in PostIQ.', 'error');
      const attemptedAt = new Date().toISOString();
      updateCard(card.id, { buffer: { ...card.buffer, contentItemId: result.id, state: result.state || 'draft', syncAttemptedAt: attemptedAt, syncedAt: attemptedAt, verified: false } });
      await ContentItems.getContentItem(result.id);
      updateCard(card.id, { buffer: { ...getCard(card.id).buffer, verified: true, syncedAt: new Date().toISOString() } });
      track('content_item_draft_sync_succeeded', { update: !!card.buffer?.contentItemId }); showToast?.('Synced to Buffer API', 'success');
    } catch (error) {
      if (result?.id) {
        track('content_item_draft_sync_unverified', { update: !!card.buffer?.contentItemId });
        console.error('[PostIQ] Buffer Content Item read-back failed.', error);
        return showToast?.('Buffer sync could not be verified. Your PostIQ source is safe.', 'error');
      }
      if (error.code === 'CONTENT_ITEM_STATE_ERROR') updateCard(card.id, { buffer: { ...card.buffer, state: 'posts', syncedAt: new Date().toISOString() } });
      track('content_item_draft_sync_failed', { error_type: GA4?.getErrorType?.(error) || 'schema_error' });
      console.error('[PostIQ] Buffer Content Items draft sync failed.', error);
      showToast?.(error.code === 'CONTENT_ITEM_STATE_ERROR' ? 'Buffer has already turned this into platform versions. Your source edits are still saved here.' : 'Buffer sync is temporarily unavailable. Your PostIQ source is safe.', 'error');
    }
  }

  function channelLabel(channel) { return channel.displayName || channel.name || 'Buffer channel'; }
  function openRemix(card) {
    remixId = card.id; el('remixSource').textContent = card.sourceText || 'No source content yet.';
    el('remixChannels').innerHTML = (state.channels || []).map(channel => { const exists = card.variants.some(v => v.channelId === channel.id); return `<label class="remix-channel"><input type="checkbox" value="${safeText(channel.id)}" ${exists ? 'disabled' : ''}><span><strong>${safeText(platform(channel.service).label)}</strong><small>${safeText(channelLabel(channel))}${exists ? ' · already prepared' : ''}</small></span></label>`; }).join('') || '<p>Sync Buffer to load platforms.</p>';
    renderVariants(card); el('remixModal')?.classList.add('open'); track('remix_opened', { existing_variants: card.variants.length });
  }
  function renderVariants(card) {
    el('remixVariants').innerHTML = card.variants.map((variant, index) => { const info = platform(variant.service); return `<div class="remix-variant" data-variant-index="${index}"><div class="remix-variant-title">${safeText(info.label)} draft <small>${safeText(variant.channelName || '')}</small></div><span class="adaptation-status">${variant.adaptationStatus === 'adapted' ? 'Platform-adapted' : 'Source copied — edit for this platform'}</span><textarea class="input" data-variant-text="${index}">${safeText(variant.text)}</textarea><details class="platform-tips"><summary>Platform tips</summary><div>${safeText(info.tip)}</div><ul>${info.guidance.slice(0, 4).map(tip => `<li>${safeText(tip)}</li>`).join('')}</ul></details><div class="variant-error">${safeText(variant.error || '')}</div></div>`; }).join('');
  }
  function persistVariantEdits(card) {
    const variants = card.variants.map((variant, index) => ({ ...variant, text: el('remixVariants')?.querySelector(`[data-variant-text="${index}"]`)?.value ?? variant.text, mode: 'draft', dueAt: '' }));
    return updateCard(card.id, { variants });
  }
  async function generateVariants() {
    let card = getCard(remixId); if (!card) return;
    card = persistVariantEdits(card); const selected = [...el('remixChannels').querySelectorAll('input:checked')].map(input => input.value);
    const existing = new Map(card.variants.map(variant => [variant.channelId, variant]));
    const selectedChannels = selected.map(channelId => state.channels.find(item => item.id === channelId) || {}).filter(channel => channel.id);
    const services = selectedChannels.map(channel => channel.service || '');
    let aiVersions = []; let aiSucceeded = false;
    const status = el('remixStatus'); const button = el('remixGenerate');
    if (status) status.textContent = `Tailoring for ${services.map(service => platform(service).label).join(', ').replace(/, ([^,]*)$/, ' and $1')}…`;
    if (button) button.disabled = true;
    try {
      const apiKey = localStorage.getItem(window.AIAssist?.KEYS?.apiKey || 'postiq_gemini_api_key');
      if (apiKey && window.AIAssist?.isUnlocked?.()) { aiVersions = await window.AIAssist.generatePlatformDrafts({ source: card.sourceText, platforms: services, apiKey, model: localStorage.getItem(window.AIAssist.KEYS.model) || undefined }); aiSucceeded = true; }
    } catch (error) { console.warn('[PostIQ] AI remix unavailable; editable source copies were created instead.', error); }
    finally { if (button) button.disabled = false; }
    const findAIText = channel => aiVersions.find(version => version.platform === window.PlatformGuidance.key(channel.service))?.text || '';
    const additions = selected.filter(channelId => !existing.has(channelId)).map(channelId => { const channel = state.channels.find(item => item.id === channelId) || {}; const adapted = findAIText(channel); return { channelId, service: channel.service || '', channelName: channelLabel(channel), text: adapted || card.sourceText, adaptationStatus: adapted ? 'adapted' : 'source-copy', dueAt: '', mode: 'draft', postId: null, buffer: {} }; });
    const variants = [...card.variants.map(variant => ({ ...variant })), ...additions];
    updateCard(card.id, { variants, status: variants.length ? 'ready' : card.status }); renderVariants(getCard(card.id));
    if (status) status.textContent = aiSucceeded ? `${additions.length} platform draft${additions.length === 1 ? '' : 's'} ready` : `${additions.length} source ${additions.length === 1 ? 'copy' : 'copies'} ready — edit for each platform`;
    track('remix_channels_selected', { channel_count: selected.length }); track('variants_generated', { channel_count: variants.length });
  }
  async function promote() {
    let card = getCard(remixId); if (!card) return; card = persistVariantEdits(card);
    if (!card.buffer?.contentItemId || card.buffer.state === 'posts') return showToast?.('Save this source to Buffer as a draft before sending channel versions.', 'error');
    if (!card.variants.length) return showToast?.('Choose channels and generate versions first.', 'error');
    track('content_item_promotion_attempted', { channel_count: card.variants.length });
    try {
      const result = await ContentItems.promoteContentItemDraft({ id: card.buffer.contentItemId, posts: card.variants.map(variant => ContentItems.draftPromotionPost(variant)) });
      if (!ContentItems.promotionPostsAreDrafts(result.posts)) {
        console.error('[PostIQ] Buffer Content Item promotion returned non-draft Posts.', result.posts);
        track('content_item_promotion_unexpected_state', { channel_count: result.posts.length });
        showToast?.('Buffer returned an unexpected post state. Check Buffer before continuing.', 'error');
        return;
      }
      const byChannel = new Map(result.posts.map(post => [post.channelId, post]));
      updateCard(card.id, { buffer: { ...card.buffer, state: 'posts', syncedAt: new Date().toISOString(), postIds: result.posts.map(post => post.id) }, variants: card.variants.map(variant => { const post = byChannel.get(variant.channelId); return { ...variant, mode: 'draft', dueAt: '', postId: post?.id || null, buffer: { ...variant.buffer, postId: post?.id || null, status: 'draft' }, error: '' }; }) });
      renderVariants(getCard(card.id)); window.dispatchEvent(new Event('postiq:content-promoted')); track('content_item_promotion_succeeded', { channel_count: result.posts.length }); showToast?.('Buffer drafts created', 'success');
    } catch (error) {
      const failures = new Map((error.validationErrors || []).map(item => [item.channelId, item.message]));
      updateCard(card.id, { variants: card.variants.map(variant => ({ ...variant, error: failures.get(variant.channelId) || '' })) }); renderVariants(getCard(card.id));
      track('content_item_promotion_failed', { channel_count: card.variants.length }); showToast?.(`Nothing was sent. ${error.message}`, 'error');
    }
  }

  function openPromotionConfirmation() {
    const modal = el('bufferDraftConfirm');
    modal?.classList.add('open');
    if (modal) { modal.hidden = false; modal.setAttribute('aria-hidden', 'false'); }
  }
  function closePromotionConfirmation() {
    const modal = el('bufferDraftConfirm');
    modal?.classList.remove('open');
    if (modal) { modal.hidden = true; modal.setAttribute('aria-hidden', 'true'); }
  }

  function render() {
    const list = el('notebookList'), empty = el('notebookEmpty'); if (!list || !empty) return; empty.style.display = cards.length ? 'none' : 'block';
    list.innerHTML = cards.map(card => { const lifecycle = window.ContentModel?.lifecycle(card) || card.status; const sync = card.buffer?.contentItemId ? (card.buffer.verified ? 'Synced to Buffer API · Channel-less Content Item' : 'Buffer API sync unverified') : 'Local source'; return `<article class="notebook-card content-source-card" data-content-open="${safeText(card.id)}" tabindex="0"><div class="notebook-card-meta"><span class="content-status status-${safeText(lifecycle)}">${safeText(lifecycle)}</span><span class="buffer-synced">${safeText(sync)}</span></div><div class="notebook-card-body"><div class="notebook-card-title">${safeText(card.title)}</div><div class="content-target">${card.targetDate ? safeText(card.targetDate) : 'No target date'}${card.pillarId ? ' · Content pillar' : ''}</div><div class="content-target">${card.variants.length} platform draft${card.variants.length === 1 ? '' : 's'} · saved locally</div></div><div class="notebook-card-footer"><button class="btn sm primary" data-content-detail="${safeText(card.id)}">Develop</button><button class="btn sm ghost" data-notebook-compose="${safeText(card.id)}">Quick compose</button><button class="btn sm ghost" data-notebook-delete="${safeText(card.id)}">Delete</button></div></article>`; }).join('');
    list.querySelectorAll('[data-content-detail]').forEach(button => button.onclick = event => { event.stopPropagation(); window.ContentDetail?.open(button.dataset.contentDetail, 'ideasView'); });
    list.querySelectorAll('[data-content-open]').forEach(card => { card.onclick = event => { if (!event.target.closest('button,a')) window.ContentDetail?.open(card.dataset.contentOpen, 'ideasView'); }; card.onkeydown = event => { if (event.key === 'Enter') window.ContentDetail?.open(card.dataset.contentOpen, 'ideasView'); }; });
    list.querySelectorAll('[data-content-sync]').forEach(button => button.onclick = () => syncDraft(getCard(button.dataset.contentSync)));
    list.querySelectorAll('[data-content-remix]').forEach(button => button.onclick = () => openRemix(getCard(button.dataset.contentRemix)));
    list.querySelectorAll('[data-notebook-delete]').forEach(button => button.onclick = () => removeCard(button.dataset.notebookDelete));
    list.querySelectorAll('[data-notebook-compose]').forEach(button => button.onclick = () => { const card = getCard(button.dataset.notebookCompose); window.pinReferenceToComposer?.({ title: card.title, body: card.sourceText, url: card.url }); window.activateView?.('composerView'); });
  }

  function init() {
    load(); if (initialized) return render(); initialized = true;
    el('newNotecardBtn')?.addEventListener('click', () => openModal()); el('closeNotecardModal')?.addEventListener('click', closeModal); el('cancelNotecardBtn')?.addEventListener('click', closeModal); el('saveNotecardBtn')?.addEventListener('click', saveModal);
    el('remixClose')?.addEventListener('click', () => el('remixModal')?.classList.remove('open')); el('remixGenerate')?.addEventListener('click', generateVariants);
    el('remixPromote')?.addEventListener('click', openPromotionConfirmation);
    el('cancelBufferDrafts')?.addEventListener('click', closePromotionConfirmation);
    el('confirmBufferDrafts')?.addEventListener('click', () => { closePromotionConfirmation(); promote(); });
    // Persist review edits before any Buffer call (and as the user types), so a
    // failed request or closed modal never costs independently edited variants.
    el('remixVariants')?.addEventListener('input', () => { const card = getCard(remixId); if (card) persistVariantEdits(card); });
    el('remixVariants')?.addEventListener('change', () => { const card = getCard(remixId); if (card) persistVariantEdits(card); });
    render(); window.ContentDetail?.init?.();
  }
  function saveFromTrending(item = {}) { return addCard({ title: item.title || 'Untitled', sourceText: item.tagline || item.selftext || '', url: item.url || item.permalink || '', type: item.source === 'reddit' ? 'reddit' : item.source === 'hn' ? 'hn' : 'idea' }); }
  window.Notebook = { init, render, addCard, normalizeIdea, updateCard, getCard, getCards: () => cards.map(card => normalizeIdea(card)), openModal, openRemix, syncDraft, saveFromTrending, channelLabel, generateVariants: (card, channels) => channels.map(channel => ({ channelId: channel.id, service: channel.service || '', channelName: channelLabel(channel), text: card.sourceText, adaptationStatus: 'source-copy', dueAt: '', mode: 'draft', buffer: {} })) };
})(window);
