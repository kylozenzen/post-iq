'use strict';

(function initializeContentDetail(window) {
  let contentId = null; let origin = 'ideasView'; let saveTimer = null; let initialized = false;
  const el = id => document.getElementById(id);
  const track = (event, params = {}) => { try { window.GA4?.track(event, params); } catch {} };
  const label = value => String(value || '').replace(/^./, first => first.toUpperCase());
  const pillarName = id => {
    try { return JSON.parse(localStorage.getItem('postiq_pillars_v3') || '{}')?.pillars?.find(pillar => pillar.id === id)?.name || ''; } catch { return ''; }
  };
  const platform = service => window.PlatformGuidance?.get?.(service) || { label: label(service || 'Platform'), tip: '', guidance: [] };

  function render() {
    const content = window.Notebook?.getCard?.(contentId); if (!content) return close();
    const lifecycle = window.ContentModel.lifecycle(content);
    const itemCount = content.variants.length;
    el('contentDetailTitle').textContent = content.title;
    el('contentDetailBack').textContent = `← Back to ${origin === 'calendarView' ? 'Calendar' : 'Ideas'}`;
    const syncState = content.buffer?.contentItemId ? (content.buffer.verified ? 'Synced to Buffer API · Channel-less Content Item' : 'Buffer API sync unverified') : 'Local source · saved in PostIQ';
    el('contentDetailMeta').innerHTML = `<span class="content-status status-${lifecycle}">${label(lifecycle)}</span>${content.targetDate ? `<span>Target ${safeText(content.targetDate)}</span>` : ''}${content.pillarId ? `<span>${safeText(pillarName(content.pillarId) || 'Content pillar')}</span>` : ''}<span>${syncState}</span>${itemCount ? `<span>${itemCount} local platform draft${itemCount === 1 ? '' : 's'}</span>` : ''}`;
    el('contentDetailSync').textContent = 'Sync Source to Buffer';
    const variants = content.variants.map((variant, index) => {
      const info = platform(variant.service); const count = String(variant.text || '').length;
      return `<article class="content-variant" data-detail-variant="${index}"><div class="content-variant-head"><div><strong>${safeText(info.label)} draft</strong><small>${safeText(variant.channelName || '')}</small></div><span class="content-status">${variant.adaptationStatus === 'adapted' ? 'Platform-adapted' : 'Source copied — edit for this platform'}</span></div><textarea class="input content-variant-copy" data-detail-variant-text="${index}" aria-label="${safeText(info.label)} copy">${safeText(variant.text)}</textarea><details class="platform-tips"><summary>Platform tips</summary><div>${safeText(info.tip)}</div><ul>${info.guidance.slice(0, 4).map(tip => `<li>${safeText(tip)}</li>`).join('')}</ul></details><div class="variant-preflight"><span>${count} characters</span><span>Saved locally · not scheduled</span>${variant.error ? `<span class="is-warning">${safeText(variant.error)}</span>` : ''}</div></article>`;
    }).join('');
    el('contentDetailBody').innerHTML = `<section class="content-source-workspace"><div class="content-section-heading"><div><div class="content-detail-kicker">Canonical local source</div><h2>Source</h2></div><span>Always preserved in PostIQ</span></div><label class="label" for="contentSourceTitle">Title</label><input id="contentSourceTitle" class="input" value="${safeText(content.title)}"><label class="label" for="contentSourceCopy">Source copy</label><textarea id="contentSourceCopy" class="input content-source-copy">${safeText(content.sourceText)}</textarea><div class="content-source-fields"><label>Target date<input id="contentSourceDate" class="input" type="date" value="${safeText(content.targetDate)}"></label><label>Workflow intent<select id="contentWorkflowIntent" class="input"><option value="idea">Idea</option><option value="developing">Developing</option><option value="ready">Ready</option></select></label></div></section><section class="content-versions"><div class="content-section-heading"><div><div class="content-detail-kicker">Local platform executions</div><h2>Platform drafts</h2></div><span>Saved in PostIQ</span></div>${variants || `<div class="content-detail-empty"><strong>Your source is ready.</strong><p>Create an editable version tailored to each selected platform.</p><button class="btn primary" data-empty-remix type="button">Create Platform Drafts</button></div>`}${lifecycle === 'published' ? `<div class="content-published-note">This content has publishing history. Its local source and platform drafts remain here.</div>` : ''}</section>`;
    el('contentWorkflowIntent').value = content.status;
    bindEditors();
  }

  function saveSource() {
    const current = window.Notebook.getCard(contentId); if (!current) return;
    window.Notebook.updateCard(contentId, { title: el('contentSourceTitle').value, sourceText: el('contentSourceCopy').value, body: el('contentSourceCopy').value, targetDate: el('contentSourceDate').value, status: el('contentWorkflowIntent').value }, { silent: true });
    track('content_source_edited', { content_id: contentId });
  }
  function saveVariant(index, value) {
    const current = window.Notebook.getCard(contentId); const variants = current.variants.map((variant, i) => i === index ? { ...variant, text: value, editedAt: new Date().toISOString() } : { ...variant });
    window.Notebook.updateCard(contentId, { variants }, { silent: true }); track('content_variant_edited', { content_id: contentId, variant_index: index });
  }
  function bindEditors() {
    ['contentSourceTitle', 'contentSourceCopy', 'contentSourceDate', 'contentWorkflowIntent'].forEach(id => el(id)?.addEventListener('input', () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveSource, 150); }));
    el('contentDetailBody').querySelectorAll('[data-detail-variant-text]').forEach(area => area.addEventListener('input', () => saveVariant(Number(area.dataset.detailVariantText), area.value)));
    el('contentDetailBody').querySelector('[data-empty-remix]')?.addEventListener('click', remix);
  }
  function open(id, from = 'ideasView') { contentId = String(id); origin = from === 'calendarView' ? 'calendarView' : 'ideasView'; window.activateView?.('contentDetailView', 'content_flow'); render(); track('content_detail_opened', { origin }); }
  function flushSource() { if (contentId && el('contentSourceCopy')) { clearTimeout(saveTimer); saveSource(); } }
  function close() { flushSource(); contentId = null; window.activateView?.(origin, 'content_detail_back'); }
  function remix() { flushSource(); const content = window.Notebook?.getCard(contentId); if (content) { window.Notebook.openRemix(content); track('remix_opened_from_content', { existing_variants: content.variants.length }); } }
  function init() { if (initialized) return; initialized = true; el('contentDetailBack')?.addEventListener('click', close); el('contentDetailRemix')?.addEventListener('click', remix); el('contentDetailSync')?.addEventListener('click', () => { flushSource(); window.Notebook?.syncDraft?.(window.Notebook.getCard(contentId)); }); window.addEventListener('postiq:notebook-changed', () => { if (contentId && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') render(); }); }
  window.ContentDetail = { init, open, close, render, currentId: () => contentId };
})(window);
