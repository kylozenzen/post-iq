'use strict';
// Optional setup checklist in a standalone dialog, separate from the first-run tour.
window.PostIQGettingStarted = (() => {
  const DISMISS_KEY = 'postiq_getting_started_dismissed';
  const FIRST_POST_KEY = 'postiq_first_post_sent';
  const STARRED_KEY = 'postiq_library_starred_v1';
  const el = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const read = k => { try { return localStorage.getItem(k); } catch { return null; } };

  function connected() {
    try { return !!(typeof getBufferConnectionState === 'function' && getBufferConnectionState().connected); } catch { return false; }
  }
  function hasSchedule() {
    try {
      const days = (getPlanningSettings().channelPostingDays) || {};
      return Object.values(days).some(d => Array.isArray(d) && d.length);
    } catch { return false; }
  }
  function hasEvergreen() {
    try { return (JSON.parse(read(STARRED_KEY) || '[]') || []).length > 0; } catch { return false; }
  }

  function ideasEnabled() {
    try { return !!workspacePreferences.ideas; } catch { return false; }
  }
  function steps() {
    return [
      { id: 'connect', done: connected(), label: 'Connect Buffer', desc: 'Bring your scheduled posts into PostIQ.', cta: 'Connect', act: () => { try { typeof goToBufferConnect === 'function' ? goToBufferConnect() : (window.location.href = '/auth/connect.html'); } catch {} } },
      { id: 'schedule', done: hasSchedule(), label: 'Set a posting rhythm', desc: 'Show which days you usually post.', cta: 'Set days', act: () => window.YourPace?.open?.() },
      { id: 'ideas', done: ideasEnabled(), label: 'Enable Shelf ideas', desc: 'Keep unfinished ideas next to past posts.', cta: 'Enable', act: () => { if (typeof openModal === 'function') openModal('settingsModal'); window.selectSettingsTab?.('customize'); document.querySelector('[data-workspace-toggle="ideas"]')?.focus(); } },
      { id: 'write', done: read(FIRST_POST_KEY) === '1', label: 'Create a Buffer draft', desc: 'Use Compose whenever a plan is ready.', cta: 'Compose', act: () => window.activateView?.('composerView', 'getting_started') },
      { id: 'evergreen', done: hasEvergreen(), label: 'Save something to reuse', desc: 'Star a useful past post on Shelf.', cta: 'Open Shelf', act: () => window.activateView?.('libraryView', 'getting_started') },

    ];
  }

  function render() {
    const box = el('gettingStarted');
    if (!box) return;
    // A permanent optional reference, not a competing onboarding prompt.
    // Dismissing hides the card until someone explicitly opens it again.
    // Older dismissed states should not hide help after someone opens the sidebar.
    const list = steps();
    const done = list.filter(s => s.done).length;
    // Keep the checklist available after completion so it remains useful help.

    box.hidden = false;
    box.innerHTML = `
      <div class="gs-head">
        <div>
          <strong class="gs-title">Getting started</strong>
          <span class="gs-progress">${done} of ${list.length} done</span>
        </div>
        <span class="gs-subtitle">Optional setup</span>
      </div>
      <ol class="gs-steps">
        ${list.map(s => `
          <li class="gs-step ${s.done ? 'is-done' : ''}">
            <span class="gs-check" aria-hidden="true">${s.done ? '✓' : '○'}</span>
            <span class="gs-step-body">
              <span class="gs-step-label">${esc(s.label)}</span>
              <span class="gs-step-desc">${esc(s.desc)}</span>
            </span>
            ${s.done ? '' : `<button type="button" class="btn sm" data-gs-act="${s.id}">${esc(s.cta)}</button>`}
          </li>`).join('')}
      </ol>`;


    box.querySelectorAll('[data-gs-act]').forEach(btn => btn.addEventListener('click', () => {
      const step = list.find(s => s.id === btn.dataset.gsAct);
      // Close the setup panel before navigating so the destination is visible.
      el('gettingStartedDialog')?.close();
      try { step?.act?.(); } catch {}
    }));
  }

  function init() {
    if (!el('gettingStarted')) return;
    ['postiq:synced', 'postiq:planning-changed', 'postiq:scheduled-updated', 'postiq:library-changed'].forEach(ev => window.addEventListener(ev, render));
    const dialog = el('gettingStartedDialog');
    el('openGettingStarted')?.addEventListener('click', () => {
      render();
      if (dialog && !dialog.open) dialog.showModal();
    });
    el('closeGettingStarted')?.addEventListener('click', () => dialog?.close());
    dialog?.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    render();
  }

  return { init, render };
})();
