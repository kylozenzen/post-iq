'use strict';

// Optional, user-started product tour. It only moves between views and points
// at controls that are already visible; it never clicks them, opens Buffer, or
// writes anything other than its own "seen" flag. The popover is non-modal, so
// the app stays usable while it is open.
window.PostIQTour = (() => {
  const SEEN_KEY = 'postiq_tour_seen';
  const MOBILE_QUERY = '(max-width: 768px)';

  const STEPS = [
    {
      id: 'calendar',
      view: 'calendarView',
      targets: ['#calGrid', '#calWeek', '#calAgenda .calendar-agenda-day', '#calAgenda'],
      title: 'Your Buffer calendar',
      body: () => isConnected()
        ? 'Confirmed Buffer posts sit beside your planning notes and actions. Gap labels follow the posting rhythm you choose.'
        : 'After you sign in with Buffer, confirmed scheduled posts appear here beside your planning notes and actions. Until then, the calendar holds local notes only.',
    },
    {
      id: 'context',
      view: 'calendarView',
      targets: ['#calendarAddBtn'],
      title: 'Add planning context',
      body: () => 'Use Add, or the + on any day, for a date-only note, a planned action, or a draft. Notes stay in PostIQ and are never treated as scheduled posts.',
    },
    {
      id: 'health',
      view: 'queueHealthView',
      targets: ['#planHealthStrip', '.queue-health-header'],
      title: 'Queue Health',
      body: () => isConnected()
        ? 'See which channels have confirmed coverage and how many posting days your queue covers. Sync first if your data is stale.'
        : 'Once Buffer is connected and synced, this shows each channel’s coverage and runway. Without sign-in it has nothing to measure.',
    },
    {
      id: 'pace',
      view: 'queueHealthView',
      targets: ['#yourPace .pace-period', '#yourPace'],
      title: 'Your Pace',
      body: () => 'Choose posting days and a target per channel, then check a period. Mark intentional days off or a lighter stretch before you take time away. These are local planning choices; Buffer posts stay as scheduled.',
    },
    {
      id: 'bank',
      view: 'ideasView',
      targets: ['.content-bank-filters', '#notebookList', '#ideasView .page-title'],
      title: 'Content Bank',
      body: () => 'Saved material lives here. Plan a target date to put an item on the calendar as a dated plan. It becomes scheduled only after you send it to Buffer.',
    },
  ];

  let active = false;
  let steps = [];
  let index = 0;
  let pop = null;
  let ring = null;
  let target = null;
  let returnFocus = null;
  let navigating = false;
  let frame = 0;

  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const markSeen = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch {} };
  const isMobile = () => window.matchMedia?.(MOBILE_QUERY).matches;

  function isConnected() {
    try { return !!(typeof getBufferConnectionState === 'function' && getBufferConnectionState().connected); }
    catch { return false; }
  }

  function viewAvailable(viewId) {
    const view = document.getElementById(viewId);
    if (!view || !view.classList.contains('view')) return false;
    try {
      const feature = typeof getFeatureForView === 'function' ? getFeatureForView(viewId) : null;
      if (feature && typeof isFeatureEnabled === 'function' && !isFeatureEnabled(feature)) return false;
      const workspace = typeof getWorkspaceForView === 'function' ? getWorkspaceForView(viewId) : null;
      if (workspace && typeof workspacePreferences === 'object' && workspacePreferences && workspacePreferences[workspace] === false) return false;
    } catch {}
    return true;
  }

  function isVisible(el) {
    if (!el || !el.getClientRects().length) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  }

  function findTarget(step) {
    for (const selector of step.targets) {
      const el = document.querySelector(selector);
      if (isVisible(el)) return el;
    }
    return null;
  }

  function build() {
    ring = document.createElement('div');
    ring.className = 'tour-ring';
    ring.setAttribute('aria-hidden', 'true');
    pop = document.createElement('div');
    pop.className = 'tour-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'false');
    pop.setAttribute('aria-labelledby', 'tourTitle');
    pop.setAttribute('aria-describedby', 'tourBody');
    pop.innerHTML = `
      <div class="tour-head">
        <span class="tour-count" id="tourCount"></span>
        <button class="tour-close" type="button" data-tour="close" aria-label="Close tour">×</button>
      </div>
      <h2 class="tour-title" id="tourTitle" tabindex="-1"></h2>
      <p class="tour-body" id="tourBody"></p>
      <div class="tour-actions">
        <button class="btn sm ghost tour-skip" type="button" data-tour="close">Skip tour</button>
        <span class="tour-nav">
          <button class="btn sm ghost" type="button" data-tour="back">Back</button>
          <button class="btn sm primary" type="button" data-tour="next">Next</button>
        </span>
      </div>`;
    pop.addEventListener('click', event => {
      const action = event.target.closest('[data-tour]')?.dataset.tour;
      if (action === 'close') stop();
      if (action === 'back') go(index - 1);
      if (action === 'next') index >= steps.length - 1 ? stop({ finished: true }) : go(index + 1);
    });
    document.body.append(ring, pop);
  }

  function place() {
    frame = 0;
    if (!active || !pop) return;
    if (!target || !target.isConnected) { ring.hidden = true; return; }
    const rect = target.getBoundingClientRect();
    const pad = 6;
    const top = Math.max(rect.top - pad, 4);
    const left = Math.max(rect.left - pad, 4);
    const right = Math.min(rect.right + pad, window.innerWidth - 4);
    const bottom = Math.min(rect.bottom + pad, window.innerHeight - 4);
    ring.hidden = bottom <= top || right <= left;
    Object.assign(ring.style, { top: `${top}px`, left: `${left}px`, width: `${right - left}px`, height: `${bottom - top}px` });

    if (isMobile()) {
      pop.classList.add('is-docked');
      pop.style.top = pop.style.left = '';
      return;
    }
    pop.classList.remove('is-docked');
    const box = pop.getBoundingClientRect();
    const gap = 12;
    let y = rect.bottom + gap;
    if (y + box.height > window.innerHeight - 12) y = rect.top - box.height - gap;
    if (y < 12) y = Math.max(12, window.innerHeight - box.height - 12);
    let x = rect.left;
    x = Math.min(Math.max(12, x), window.innerWidth - box.width - 12);
    pop.style.top = `${Math.round(y)}px`;
    pop.style.left = `${Math.round(x)}px`;
  }

  function schedulePlace() { if (active && !frame) frame = requestAnimationFrame(place); }

  function showView(viewId) {
    if (document.getElementById(viewId)?.classList.contains('active')) return true;
    navigating = true;
    try { window.activateView?.(viewId, 'tour'); } finally { navigating = false; }
    return !!document.getElementById(viewId)?.classList.contains('active');
  }

  function go(next) {
    if (!active) return;
    const direction = next < index ? -1 : 1;
    // Adapt to the current layout: a step whose view or control is unavailable is skipped.
    for (let i = next; i >= 0 && i < steps.length; i += direction) {
      const step = steps[i];
      if (!showView(step.view)) continue;
      const el = findTarget(step);
      if (!el) continue;
      index = i;
      target = el;
      render(step);
      return;
    }
    if (direction > 0) stop({ finished: true });
  }

  function render(step) {
    pop.querySelector('#tourCount').textContent = `Step ${index + 1} of ${steps.length}`;
    pop.querySelector('#tourTitle').textContent = step.title;
    pop.querySelector('#tourBody').textContent = step.body();
    const back = pop.querySelector('[data-tour="back"]');
    back.hidden = index === 0;
    pop.querySelector('[data-tour="next"]').textContent = index === steps.length - 1 ? 'Finish' : 'Next';
    // Instant scroll keeps the ring aligned; on phones, centre the control so
    // neither the sticky header nor the docked popover covers it.
    target.scrollIntoView({ block: isMobile() ? 'center' : 'nearest', behavior: 'auto' });
    place();
    setTimeout(schedulePlace, 350);
    pop.querySelector('#tourTitle').focus({ preventScroll: true });
    try { window.gtag?.('event', 'tour_step_viewed', { step: step.id, position: index + 1 }); } catch {}
  }

  function onKey(event) {
    if (event.key === 'Escape' && active && !document.querySelector('.modal.open')) {
      stop();
    }
  }

  function onViewChanged(event) {
    // The person moved elsewhere on their own; get out of the way.
    if (active && !navigating && event.detail?.source !== 'tour') stop();
  }

  function start(options = {}) {
    if (active) return;
    steps = STEPS.filter(step => viewAvailable(step.view));
    if (!steps.length) {
      if (typeof showToast === 'function') showToast('The tour needs the Calendar or Content Bank workspace. Turn one on in Settings.', 'info');
      return;
    }
    returnFocus = options.returnFocus || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    active = true;
    document.body.classList.add('tour-active');
    document.querySelectorAll('.ob-tooltip').forEach(el => el.remove());
    build();
    window.addEventListener('resize', schedulePlace);
    document.addEventListener('scroll', schedulePlace, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('postiq:view-changed', onViewChanged);
    try { window.gtag?.('event', 'tour_started', { source: options.source || 'button' }); } catch {}
    index = 0;
    go(0);
  }

  function stop({ finished = false } = {}) {
    if (!active) return;
    active = false;
    markSeen();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    window.removeEventListener('resize', schedulePlace);
    document.removeEventListener('scroll', schedulePlace, true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('postiq:view-changed', onViewChanged);
    pop?.remove(); ring?.remove();
    pop = ring = target = null;
    document.body.classList.remove('tour-active');
    try { window.gtag?.('event', finished ? 'tour_completed' : 'tour_dismissed', { step: steps[index]?.id || '' }); } catch {}
    if (returnFocus?.isConnected && isVisible(returnFocus)) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }

  function init() {
    document.querySelectorAll('[data-tour-start]').forEach(button => {
      button.addEventListener('click', () => {
        if (button.closest('#mobDrawer')) {
          ['mobDrawer', 'mobBackdrop'].forEach(id => document.getElementById(id)?.classList.remove('open'));
          document.body.style.overflow = '';
        }
        start({ source: button.dataset.tourStart || 'button', returnFocus: button });
      });
    });
    // A landing-page link can ask for the tour once. The flag is removed right
    // away, so refreshing, bookmarking, or returning from Buffer sign-in does not
    // reopen it.
    const params = new URLSearchParams(location.search);
    if (params.get('tour') === '1') {
      params.delete('tour');
      history.replaceState(history.state, document.title, `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`);
      // Wait for app startup; reviewer and shared-snapshot pages hide the app shell.
      setTimeout(() => { if (!document.getElementById('app')?.classList.contains('hidden')) start({ source: 'landing' }); }, 600);
    }
  }

  return { init, start, stop, isActive: () => active, hasSeen: () => read(SEEN_KEY) === '1', steps: STEPS };
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(window.PostIQTour.init, 0));
else setTimeout(window.PostIQTour.init, 0);
