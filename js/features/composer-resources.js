'use strict';

// ── COMPOSER WRITING RESOURCES ────────────────────
// Reads PostIQ's existing local Notebook, Templates, Pillars, and Library
// caches. No parallel data store: the drawer is a Compose-friendly view.
window.PostIQComposerResources = (() => {
  const NOTEBOOK_STORAGE_KEY = 'postiq_notebook_v1';
  const TEMPLATE_STORAGE_KEY = 'postiq_templates_v1';
  const LIBRARY_CACHE_KEY = 'postiq_library_cache_v3';
  const LIBRARY_STARRED_KEY = 'postiq_library_starred_v1';
  const LAST_TAB_KEY = 'postiq_composer_resource_tab_v1';
  const SEARCHABLE_TABS = new Set(['notebook', 'hooks', 'hashtags', 'templates']);
  const TAB_LABELS = {
    notebook: 'Notebook',
    hooks: 'hooks',
    hashtags: 'hashtag sets',
    templates: 'templates',
  };

  let initialized = false;
  let activeTab = 'notebook';
  let searchQuery = '';
  let resources = {
    notebook: [],
    hookTemplates: [],
    libraryHooks: [],
    hashtags: [],
    templates: [],
  };

  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  const compact = (value, max = 170) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  };
  const matchesSearch = (...values) => {
    if (!searchQuery) return true;
    const haystack = values.map(value => String(value || '')).join(' ').toLowerCase();
    return haystack.includes(searchQuery.toLowerCase());
  };
  const track = callback => { try { callback?.(); } catch {} };

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(String(value || ''), location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function ageLabel(timestamp) {
    const elapsed = Date.now() - Number(timestamp || 0);
    if (!Number.isFinite(elapsed) || elapsed < 0) return '';
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function extractOpening(value) {
    const text = String(value || '').replace(/\r/g, '').trim();
    if (!text) return '';
    const firstLine = text.split(/\n+/).map(line => line.trim()).find(Boolean) || text;
    if (firstLine.length <= 220) return firstLine;
    const firstSentence = firstLine.match(/^.{1,220}?[.!?](?:\s|$)/)?.[0]?.trim();
    return firstSentence || `${firstLine.slice(0, 219).trim()}…`;
  }

  function metricNumber(post, key) {
    const raw = post?.metrics?.[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) return Number(raw);
    return null;
  }

  function readTemplates() {
    const parsed = readJson(TEMPLATE_STORAGE_KEY, []);
    return (Array.isArray(parsed) ? parsed : []).filter(template => template && typeof template === 'object').map((template, index) => ({
      id: String(template.id || `template-${index}`),
      title: String(template.title || 'Untitled template'),
      type: String(template.type || 'Hooks'),
      platform: String(template.platform || 'Universal'),
      tags: Array.isArray(template.tags) ? template.tags.map(String) : [],
      body: String(template.body || ''),
    })).filter(template => template.body.trim());
  }

  function readNotebook() {
    const parsed = readJson(NOTEBOOK_STORAGE_KEY, []);
    return (Array.isArray(parsed) ? parsed : []).filter(card => card && typeof card === 'object').map((card, index) => ({
      id: String(card.id || `notebook-${index}`),
      type: String(card.type || 'idea'),
      title: String(card.title || 'Untitled idea'),
      body: String(card.body || ''),
      url: String(card.url || ''),
      createdAt: Number(card.createdAt || 0),
    }));
  }

  function readLibraryHooks() {
    const cached = readJson(LIBRARY_CACHE_KEY, {});
    const posts = Array.isArray(cached?.posts) ? cached.posts : [];
    const storedStars = readJson(LIBRARY_STARRED_KEY, []);
    const starredIds = new Set((Array.isArray(storedStars) ? storedStars : []).map(String));
    const postId = post => String(post?.id || `library-${Math.max(0, posts.indexOf(post))}`);
    const starredPosts = posts.filter(post => starredIds.has(postId(post)));
    const topPosts = posts
      .filter(post => metricNumber(post, 'engagementRate') != null)
      .sort((a, b) => metricNumber(b, 'engagementRate') - metricNumber(a, 'engagementRate'))
      .slice(0, 5);
    const combined = [];
    const seen = new Set();

    [...starredPosts, ...topPosts].forEach((post, index) => {
      const id = postId(post) || `library-${index}`;
      if (seen.has(id)) return;
      seen.add(id);
      const hook = extractOpening(post?.text);
      if (!hook) return;
      const rate = metricNumber(post, 'engagementRate');
      combined.push({
        id,
        title: String(post?.channelName || post?.profileName || post?.service || post?.network || 'Published post'),
        hook,
        fullText: String(post?.text || ''),
        url: String(post?.externalLink || ''),
        isStarred: starredIds.has(id),
        isTop: topPosts.some(candidate => postId(candidate) === id),
        engagementRate: rate,
      });
    });
    return combined.slice(0, 10);
  }

  function loadResources() {
    const templates = readTemplates();
    resources = {
      notebook: readNotebook(),
      hookTemplates: templates.filter(template => template.type === 'Hooks'),
      libraryHooks: readLibraryHooks(),
      hashtags: templates.filter(template => template.type === 'Hashtag Sets'),
      templates: templates.filter(template => !['Hooks', 'Hashtag Sets'].includes(template.type)),
    };
  }

  function emptyState(icon, title, copy, actionHtml = '') {
    return `<div class="resource-empty-state">
      <div class="resource-empty-icon" aria-hidden="true">${escapeHtml(icon)}</div>
      <div class="resource-empty-title">${escapeHtml(title)}</div>
      <div class="resource-empty-copy">${escapeHtml(copy)}</div>
      ${actionHtml ? `<div class="resource-empty-actions">${actionHtml}</div>` : ''}
    </div>`;
  }

  function renderNotebook() {
    const list = byId('composerNotebookResources');
    if (!list) return;
    const items = resources.notebook.filter(card => matchesSearch(card.title, card.body, card.type));
    if (!items.length) {
      list.innerHTML = emptyState(
        '✦',
        searchQuery ? 'No Notebook matches' : 'Your Notebook is ready when you are',
        searchQuery ? 'Try a different search.' : 'Save an idea, article, or stray thought and it will appear here.',
        searchQuery ? '' : '<button class="btn sm primary" type="button" data-resource-new-notebook>+ Add idea</button>',
      );
      return;
    }
    list.innerHTML = items.map(card => {
      const safeUrl = safeExternalUrl(card.url);
      return `<article class="composer-resource-card">
        <div class="composer-resource-meta"><span class="resource-chip">${escapeHtml(card.type)}</span>${card.createdAt ? `<span>${escapeHtml(ageLabel(card.createdAt))}</span>` : ''}</div>
        <div class="composer-resource-title">${escapeHtml(card.title)}</div>
        ${card.body ? `<div class="composer-resource-preview">${escapeHtml(compact(card.body, 220))}</div>` : ''}
        <div class="composer-resource-actions">
          <button class="btn sm primary" type="button" data-resource-action="pin-notebook" data-resource-id="${escapeHtml(card.id)}">Pin reference</button>
          <button class="btn sm" type="button" data-resource-action="insert-notebook" data-resource-id="${escapeHtml(card.id)}">Insert notes</button>
          ${safeUrl ? `<a class="btn sm ghost" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">Source ↗</a>` : ''}
        </div>
      </article>`;
    }).join('');
  }

  function hookTemplateCard(template) {
    return `<article class="composer-resource-card">
      <div class="composer-resource-meta"><span class="resource-chip">Saved hook</span><span>${escapeHtml(template.platform)}</span></div>
      <div class="composer-resource-title">${escapeHtml(template.title)}</div>
      <div class="composer-resource-quote">${escapeHtml(compact(template.body, 240))}</div>
      <div class="composer-resource-actions"><button class="btn sm primary" type="button" data-resource-action="insert-hook-template" data-resource-id="${escapeHtml(template.id)}">Use as opener</button></div>
    </article>`;
  }

  function libraryHookCard(hook) {
    const rate = hook.engagementRate != null ? `${(hook.engagementRate * 100).toFixed(1)}% engagement` : '';
    const badges = [hook.isStarred ? '★ Starred' : '', hook.isTop ? 'Top post' : ''].filter(Boolean);
    return `<article class="composer-resource-card">
      <div class="composer-resource-meta">${badges.map(label => `<span class="resource-chip${label.includes('Starred') ? ' starred' : ''}">${escapeHtml(label)}</span>`).join('')}<span>${escapeHtml(rate || hook.title)}</span></div>
      <div class="composer-resource-quote">${escapeHtml(hook.hook)}</div>
      <div class="composer-resource-actions">
        <button class="btn sm primary" type="button" data-resource-action="insert-library-hook" data-resource-id="${escapeHtml(hook.id)}">Use as opener</button>
        <button class="btn sm" type="button" data-resource-action="pin-library-post" data-resource-id="${escapeHtml(hook.id)}">Pin full post</button>
      </div>
    </article>`;
  }

  function renderHooks() {
    const list = byId('composerHookResources');
    if (!list) return;
    const saved = resources.hookTemplates.filter(template => matchesSearch(template.title, template.body, template.platform, template.tags));
    const library = resources.libraryHooks.filter(hook => matchesSearch(hook.hook, hook.fullText, hook.title));
    if (!saved.length && !library.length) {
      list.innerHTML = emptyState(
        '⚡',
        searchQuery ? 'No hooks match' : 'Save the lines that stop the scroll',
        searchQuery ? 'Try a different search.' : 'Hook templates and openings from starred or top Library posts will collect here.',
        searchQuery ? '' : '<button class="btn sm primary" type="button" data-resource-new-template="Hooks">+ Save a hook</button><button class="btn sm" type="button" data-resource-manage="library">Open Library</button>',
      );
      return;
    }
    list.innerHTML = `${saved.length ? `<div class="resource-list-label">Saved hooks</div>${saved.map(hookTemplateCard).join('')}` : ''}
      ${library.length ? `<div class="resource-list-label">From your post Library</div>${library.map(libraryHookCard).join('')}` : ''}`;
  }

  function renderHashtags() {
    const list = byId('composerHashtagResources');
    if (!list) return;
    const items = resources.hashtags.filter(template => matchesSearch(template.title, template.body, template.platform, template.tags));
    if (!items.length) {
      list.innerHTML = emptyState(
        '#',
        searchQuery ? 'No hashtag sets match' : 'No more hashtag archaeology',
        searchQuery ? 'Try a different search.' : 'Save platform or campaign sets once, then append them here.',
        searchQuery ? '' : '<button class="btn sm primary" type="button" data-resource-new-template="Hashtag Sets">+ Create a set</button>',
      );
      return;
    }
    list.innerHTML = items.map(template => `<article class="composer-resource-card">
      <div class="composer-resource-meta"><span class="resource-chip">${escapeHtml(template.platform)}</span>${template.tags.length ? `<span>${escapeHtml(template.tags.join(' · '))}</span>` : ''}</div>
      <div class="composer-resource-title">${escapeHtml(template.title)}</div>
      <div class="composer-resource-hashtags">${escapeHtml(template.body)}</div>
      <div class="composer-resource-actions"><button class="btn sm primary" type="button" data-resource-action="insert-hashtags" data-resource-id="${escapeHtml(template.id)}">Append set</button></div>
    </article>`).join('');
  }

  function renderTemplates() {
    const list = byId('composerTemplateList');
    if (!list) return;
    const items = resources.templates.filter(template => matchesSearch(template.title, template.body, template.type, template.platform, template.tags));
    if (!items.length) {
      list.innerHTML = emptyState(
        '▤',
        searchQuery ? 'No templates match' : 'No other templates yet',
        searchQuery ? 'Try a different search.' : 'Announcements, CTAs, and engagement starters will appear here.',
        searchQuery ? '' : '<button class="btn sm primary" type="button" data-resource-new-template="Announcements">+ New template</button>',
      );
      return;
    }
    list.innerHTML = items.map(template => `<article class="composer-resource-card">
      <div class="composer-resource-meta"><span class="resource-chip">${escapeHtml(template.type)}</span><span>${escapeHtml(template.platform)}</span></div>
      <div class="composer-resource-title">${escapeHtml(template.title)}</div>
      <div class="composer-resource-preview">${escapeHtml(compact(template.body, 220))}</div>
      <div class="composer-resource-actions"><button class="btn sm primary" type="button" data-resource-action="insert-template" data-resource-id="${escapeHtml(template.id)}">Insert template</button></div>
    </article>`).join('');
  }

  function pillarCount() {
    try {
      const data = window.ContentPillars?.getData?.();
      if (Array.isArray(data?.pillars)) return data.pillars.length;
    } catch {}
    const stored = readJson('postiq_pillars_v3', {});
    return Array.isArray(stored?.pillars) ? stored.pillars.length : 0;
  }

  function updateCounts() {
    const counts = {
      notebook: resources.notebook.length,
      hooks: resources.hookTemplates.length + resources.libraryHooks.length,
      hashtags: resources.hashtags.length,
      templates: resources.templates.length,
      pillars: pillarCount(),
    };
    document.querySelectorAll('[data-resource-count]').forEach(element => {
      const count = counts[element.dataset.resourceCount] || 0;
      element.textContent = count ? String(count) : '';
      element.hidden = !count;
    });
  }

  function refresh() {
    loadResources();
    renderNotebook();
    renderHooks();
    renderHashtags();
    renderTemplates();
    updateCounts();
    try { window.ContentPillars?.renderCompact?.(); } catch {}
  }

  function setActiveTab(name, focusTab = false) {
    const tabs = [...document.querySelectorAll('#composerSupportSection .support-tab')];
    const selected = tabs.find(tab => tab.dataset.stool === name) || tabs[0];
    if (!selected) return;
    activeTab = selected.dataset.stool;
    tabs.forEach(tab => {
      const active = tab === selected;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('#composerSupportSection .support-panel').forEach(panel => {
      const active = panel.dataset.stoolPanel === activeTab;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });

    const searchWrap = byId('composerResourceSearchWrap');
    const search = byId('composerResourceSearch');
    if (searchWrap) searchWrap.hidden = !SEARCHABLE_TABS.has(activeTab);
    if (search) search.placeholder = `Search ${TAB_LABELS[activeTab] || 'writing tools'}`;
    try { localStorage.setItem(LAST_TAB_KEY, activeTab); } catch {}
    refresh();
    if (focusTab) selected.focus();
  }

  function createTextFragment(value) {
    const fragment = document.createDocumentFragment();
    String(value || '').replace(/\r/g, '').split('\n').forEach((line, index) => {
      if (index) fragment.append(document.createElement('br'));
      if (line) fragment.append(document.createTextNode(line));
    });
    return fragment;
  }

  function insertText(value, placement = 'append') {
    const text = String(value || '').trim();
    const editor = byId('composerEditor');
    if (!editor || !text) return false;
    const hasContent = String(editor.innerText ?? editor.textContent ?? '').trim().length > 0;
    const fragment = createTextFragment(text);
    if (placement === 'prepend') {
      if (hasContent) fragment.append(document.createElement('br'), document.createElement('br'));
      editor.insertBefore(fragment, editor.firstChild);
    } else {
      if (hasContent) editor.append(document.createElement('br'), document.createElement('br'));
      editor.append(fragment);
    }
    const inputEvent = typeof InputEvent === 'function'
      ? new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text })
      : new Event('input', { bubbles: true });
    editor.dispatchEvent(inputEvent);
    if (typeof window.updateComposerClearButtonVisibility === 'function') window.updateComposerClearButtonVisibility();
    return true;
  }

  function finishAction(message) {
    if (typeof window.setComposerResourcesOpen === 'function') window.setComposerResourcesOpen(false);
    requestAnimationFrame(() => byId('composerEditor')?.focus());
    if (typeof window.showToast === 'function') window.showToast(message, 'success');
  }

  function navigateToResource(destination) {
    if (typeof window.setComposerResourcesOpen === 'function') window.setComposerResourcesOpen(false);
    if (destination === 'library') {
      window.activateView?.('libraryView');
      return;
    }
    window.activateView?.('ideasView');
    window.setIdeasTab?.(destination === 'notebook' ? 'notebook' : destination === 'pillars' ? 'pillars' : 'templates');
  }

  function openNewTemplate(type) {
    if (typeof window.setComposerResourcesOpen === 'function') window.setComposerResourcesOpen(false);
    requestAnimationFrame(() => {
      if (typeof window.openTemplateModal !== 'function' || !window.openTemplateModal()) return;
      const typeSelect = byId('templateType');
      if (typeSelect && [...typeSelect.options].some(option => option.value === type)) typeSelect.value = type;
    });
  }

  function handleResourceAction(button) {
    const action = button.dataset.resourceAction;
    const id = String(button.dataset.resourceId || '');
    if (action === 'pin-notebook' || action === 'insert-notebook') {
      const card = resources.notebook.find(item => item.id === id);
      if (!card) return;
      track(() => window.GA4_Ideas?.notebookCardUsed?.());
      if (action === 'pin-notebook') {
        window.pinReferenceToComposer?.({ title: card.title, body: card.body, url: card.url });
        finishAction('Notebook idea pinned beside your draft');
      } else if (insertText([card.title, card.body].filter(Boolean).join('\n\n'))) {
        finishAction('Notebook notes inserted');
      }
      return;
    }

    if (action === 'insert-hook-template') {
      const template = resources.hookTemplates.find(item => item.id === id);
      if (!template || !insertText(template.body, 'prepend')) return;
      track(() => window.GA4_Composer?.templateInserted?.('Hooks'));
      track(() => window.GA4_Templates?.templateUsed?.('Hooks'));
      finishAction('Hook added to the top of your draft');
      return;
    }

    if (action === 'insert-library-hook' || action === 'pin-library-post') {
      const hook = resources.libraryHooks.find(item => item.id === id);
      if (!hook) return;
      if (action === 'insert-library-hook' && insertText(hook.hook, 'prepend')) finishAction('Hook added to the top of your draft');
      if (action === 'pin-library-post') {
        window.pinReferenceToComposer?.({ title: hook.title, body: hook.fullText, url: hook.url });
        finishAction('Published post pinned as reference');
      }
      return;
    }

    if (action === 'insert-hashtags') {
      const template = resources.hashtags.find(item => item.id === id);
      if (!template || !insertText(template.body)) return;
      track(() => window.GA4_Composer?.templateInserted?.('Hashtag Sets'));
      track(() => window.GA4_Templates?.templateUsed?.('Hashtag Sets'));
      finishAction('Hashtag set appended');
      return;
    }

    if (action === 'insert-template') {
      const template = resources.templates.find(item => item.id === id);
      if (!template || !insertText(template.body)) return;
      track(() => window.GA4_Composer?.templateInserted?.(template.type || 'custom'));
      track(() => window.GA4_Templates?.templateUsed?.(template.type || 'custom'));
      finishAction('Template inserted');
    }
  }

  function init() {
    if (initialized) {
      refresh();
      return;
    }
    const drawer = byId('composerSupportSection');
    if (!drawer) return;
    initialized = true;

    const tabs = [...drawer.querySelectorAll('.support-tab')];
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => setActiveTab(tab.dataset.stool));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        let nextIndex = index;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        event.preventDefault();
        setActiveTab(tabs[nextIndex].dataset.stool, true);
        tabs[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
    });

    byId('composerResourceSearch')?.addEventListener('input', event => {
      searchQuery = String(event.target.value || '').trim();
      refresh();
    });

    drawer.addEventListener('click', event => {
      const actionButton = event.target.closest('[data-resource-action]');
      if (actionButton) return handleResourceAction(actionButton);
      const manageButton = event.target.closest('[data-resource-manage]');
      if (manageButton) return navigateToResource(manageButton.dataset.resourceManage);
      const templateButton = event.target.closest('[data-resource-new-template]');
      if (templateButton) return openNewTemplate(templateButton.dataset.resourceNewTemplate);
      if (event.target.closest('[data-resource-new-notebook]')) {
        if (typeof window.setComposerResourcesOpen === 'function') window.setComposerResourcesOpen(false);
        requestAnimationFrame(() => window.Notebook?.openModal?.());
      }
    });

    window.addEventListener('storage', event => {
      if ([NOTEBOOK_STORAGE_KEY, TEMPLATE_STORAGE_KEY, LIBRARY_CACHE_KEY, LIBRARY_STARRED_KEY].includes(event.key)) refresh();
    });
    ['postiq:notebook-changed', 'postiq:templates-changed', 'postiq:library-changed'].forEach(eventName => {
      window.addEventListener(eventName, refresh);
    });

    let storedTab = 'notebook';
    try { storedTab = localStorage.getItem(LAST_TAB_KEY) || storedTab; } catch {}
    setActiveTab(storedTab);
  }

  return { init, refresh, selectTab: setActiveTab, extractOpening, insertText };
})();
