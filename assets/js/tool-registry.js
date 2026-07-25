(() => {
  'use strict';

  const STORAGE_KEY = 'postiq_enabled_tools_v1';
  const tools = Object.freeze([
    {
      id: 'composer',
      viewId: 'composerView',
      name: 'Post Composer',
      mark: 'PC',
      description: 'Draft, format, add media, and send posts to Buffer.'
    },
    {
      id: 'threads',
      viewId: 'threadView',
      name: 'Thread Splitter',
      mark: 'TS',
      description: 'Turn long-form copy into editable X or Threads posts.'
    },
    {
      id: 'calendar',
      viewId: 'calendarView',
      name: 'Content Calendar',
      mark: 'CC',
      description: 'See scheduled posts and add lightweight planning notes.'
    },
    {
      id: 'trending',
      viewId: 'trendingView',
      name: 'Trending',
      mark: 'TR',
      description: 'Find current Reddit and Hacker News conversation starters.'
    },
    {
      id: 'snippets',
      viewId: 'snippetsView',
      name: 'Snippets',
      mark: 'SN',
      description: 'Save reusable hooks, CTAs, first comments, and hashtag sets.'
    },
    {
      id: 'approvals',
      viewId: 'approvalsView',
      name: 'Approvals',
      mark: 'AP',
      description: 'Create review links and track client feedback before publishing.'
    }
  ]);

  const toolById = new Map(tools.map(tool => [tool.id, tool]));
  const toolByView = new Map(tools.map(tool => [tool.viewId, tool]));

  function allEnabled() {
    return Object.fromEntries(tools.map(tool => [tool.id, true]));
  }

  function readPreferences() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return allEnabled();
      const normalized = Object.fromEntries(
        tools.map(tool => [tool.id, raw[tool.id] !== false])
      );
      if (!Object.values(normalized).some(Boolean)) normalized.composer = true;
      return normalized;
    } catch {
      return allEnabled();
    }
  }

  let enabled = readPreferences();

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
    } catch {
      // Storage can be blocked; the current session still behaves correctly.
    }
  }

  function isEnabled(id) {
    return toolById.has(id) && enabled[id] !== false;
  }

  function isViewEnabled(viewId) {
    const tool = toolByView.get(viewId);
    return !tool || isEnabled(tool.id);
  }

  function getFirstEnabledView() {
    return tools.find(tool => isEnabled(tool.id))?.viewId || 'composerView';
  }

  function markAvailability() {
    tools.forEach(tool => {
      const available = isEnabled(tool.id);
      document.querySelectorAll(`[data-view="${tool.viewId}"]`).forEach(element => {
        element.dataset.toolHidden = available ? 'false' : 'true';
        element.setAttribute('aria-hidden', String(!available));
      });
      const view = document.getElementById(tool.viewId);
      if (view) {
        view.dataset.toolHidden = available ? 'false' : 'true';
        view.setAttribute('aria-hidden', String(!available));
      }
      document.querySelectorAll(`[data-tool-guide="${tool.id}"]`).forEach(element => {
        element.dataset.toolHidden = available ? 'false' : 'true';
      });
      document.querySelectorAll(`[data-tool-shortcut="${tool.id}"]`).forEach(element => {
        element.dataset.toolHidden = available ? 'false' : 'true';
      });
    });
  }

  function renderManager() {
    const list = document.getElementById('toolManagerList');
    if (!list) return;

    const enabledCount = tools.filter(tool => isEnabled(tool.id)).length;
    list.innerHTML = tools.map(tool => {
      const checked = isEnabled(tool.id);
      const mustRemain = checked && enabledCount === 1;
      return `
        <label class="tool-toggle${checked ? '' : ' is-disabled'}">
          <span class="tool-toggle-icon" aria-hidden="true">${tool.mark}</span>
          <span class="tool-toggle-copy">
            <span class="tool-toggle-title">${tool.name}</span>
            <span class="tool-toggle-desc">${tool.description}</span>
          </span>
          <span class="tool-switch">
            <input
              type="checkbox"
              data-tool-toggle="${tool.id}"
              ${checked ? 'checked' : ''}
              ${mustRemain ? 'disabled' : ''}
              aria-label="${checked ? 'Disable' : 'Enable'} ${tool.name}"
            />
            <span class="tool-switch-track" aria-hidden="true"></span>
          </span>
        </label>
      `;
    }).join('');

    list.querySelectorAll('[data-tool-toggle]').forEach(input => {
      input.addEventListener('change', () => setEnabled(input.dataset.toolToggle, input.checked));
    });

    const summary = document.getElementById('toolManagerSummary');
    if (summary) {
      summary.textContent = `${enabledCount} of ${tools.length} tools enabled · saved on this device`;
    }
  }

  function ensureActiveView() {
    const activeView = document.querySelector('.view.active');
    if (!activeView || isViewEnabled(activeView.id)) return;
    const fallback = getFirstEnabledView();
    if (typeof window.activateView === 'function') window.activateView(fallback);
  }

  function apply({ ensureActive = false } = {}) {
    markAvailability();
    renderManager();
    if (ensureActive) ensureActiveView();
  }

  function setEnabled(id, value) {
    if (!toolById.has(id)) return;
    const next = { ...enabled, [id]: Boolean(value) };
    if (!Object.values(next).some(Boolean)) return;
    enabled = next;
    persist();
    apply({ ensureActive: true });
    window.dispatchEvent(new CustomEvent('postiq:tools-changed', {
      detail: { id, enabled: Boolean(value), preferences: { ...enabled } }
    }));
  }

  function enableAll() {
    enabled = allEnabled();
    persist();
    apply({ ensureActive: true });
    window.dispatchEvent(new CustomEvent('postiq:tools-changed', {
      detail: { id: 'all', enabled: true, preferences: { ...enabled } }
    }));
  }

  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.getElementById('resetEnabledTools')?.addEventListener('click', enableAll);
  });

  window.PostIQTools = Object.freeze({
    list: () => tools.map(tool => ({ ...tool, enabled: isEnabled(tool.id) })),
    isEnabled,
    isViewEnabled,
    getFirstEnabledView,
    setEnabled,
    enableAll,
    apply
  });
})();
