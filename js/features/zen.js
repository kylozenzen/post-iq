'use strict';
// Zen / wall display mode. Hides the sidebar and page chrome so the calendar
// fills the screen — for putting on a monitor or clean screen recordings.
// Display-only: it never changes data or becomes a writing workspace.
window.PostIQZen = (() => {
  let active = false, exitBtn = null;
  const onKey = e => { if (e.key === 'Escape') exit(); };
  function enter() {
    if (active) return; active = true;
    try { window.activateView?.('calendarView', 'zen'); } catch {}
    document.body.classList.add('zen-mode');
    try { document.documentElement.requestFullscreen?.(); } catch {}
    exitBtn = document.createElement('button');
    exitBtn.className = 'zen-exit'; exitBtn.type = 'button'; exitBtn.textContent = 'Exit zen (Esc)';
    exitBtn.addEventListener('click', exit);
    document.body.appendChild(exitBtn);
    document.addEventListener('keydown', onKey);
  }
  function exit() {
    if (!active) return; active = false;
    document.body.classList.remove('zen-mode');
    try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch {}
    exitBtn?.remove(); exitBtn = null;
    document.removeEventListener('keydown', onKey);
  }
  function toggle() { active ? exit() : enter(); }
  function init() { document.getElementById('zenToggle')?.addEventListener('click', toggle); }
  return { init, enter, exit, toggle };
})();
