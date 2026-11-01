'use strict';
// Getting Started checklist. A calm, dismissible card on the calendar that walks
// a new creator through the core loop. Each step detects its own completion from
// real state — nothing to tick by hand. Hides itself once done or dismissed.
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

  function steps() {
    return [
      { id: 'connect', done: connected(), label: 'Connect Buffer', desc: 'Link your Buffer account so PostIQ can see your channels and queue.', cta: 'Connect', act: () => { try { typeof goToBufferConnect === 'function' ? goToBufferConnect() : (window.location.href = '/auth/connect.html'); } catch {} } },
      { id: 'schedule', done: hasSchedule(), label: 'Set your posting schedule', desc: 'Tell PostIQ which days you post, per channel — that powers your runway.', cta: 'Set schedule', act: () => window.YourPace?.open?.() },
      { id: 'write', done: read(FIRST_POST_KEY) === '1', label: 'Write your first post', desc: 'Draft in Compose and send it to Buffer as a draft, queue, or scheduled.', cta: 'Open Compose', act: () => window.activateView?.('composerView', 'getting_started') },
      { id: 'evergreen', done: hasEvergreen(), label: 'Star an evergreen post', desc: 'Mark a post in Library as evergreen so you can reshare it during a break.', cta: 'Open Library', act: () => window.activateView?.('libraryView', 'getting_started') },
    ];
  }

  function render() {
    const box = el('gettingStarted');
    if (!box) return;
    if (read(DISMISS_KEY) === '1') { box.hidden = true; box.innerHTML = ''; return; }
    const list = steps();
    const done = list.filter(s => s.done).length;
    if (done === list.length) { box.hidden = true; box.innerHTML = ''; return; } // all done — retire it

    box.hidden = false;
    box.innerHTML = `
      <div class="gs-head">
        <div>
          <strong class="gs-title">Getting started</strong>
          <span class="gs-progress">${done} of ${list.length} done</span>
        </div>
        <button type="button" class="gs-dismiss" data-gs-dismiss aria-label="Dismiss getting started">Dismiss</button>
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

    box.querySelector('[data-gs-dismiss]')?.addEventListener('click', () => { try { localStorage.setItem(DISMISS_KEY, '1'); } catch {} render(); });
    box.querySelectorAll('[data-gs-act]').forEach(btn => btn.addEventListener('click', () => {
      const step = list.find(s => s.id === btn.dataset.gsAct);
      try { step?.act?.(); } catch {}
    }));
  }

  function init() {
    if (!el('gettingStarted')) return;
    ['postiq:synced', 'postiq:planning-changed', 'postiq:scheduled-updated', 'postiq:library-changed'].forEach(ev => window.addEventListener(ev, render));
    render();
  }

  return { init, render };
})();
