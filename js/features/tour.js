'use strict';

// PostIQ's onboarding: a short product tour. It opens once on someone's first
// visit to the app and can be restarted from any "Take a tour" button. It only
// moves between views and points at controls that are already visible; it never
// clicks them or writes to Buffer. Sign-in starts only from its own button. The
// popover is non-modal, so the app stays usable while it is open.
window.PostIQTour = (() => {
  const SEEN_KEY = 'postiq_tour_seen';
  const CONNECTED_SEEN_KEY = 'postiq_tour_connected_seen';
  // Read before startup marks the app as visited, so only a first visit qualifies.
  const FIRST_VISIT = (() => { try { return localStorage.getItem('postiq_app_visited') !== '1'; } catch { return false; } })();
  const MOBILE_QUERY = '(max-width: 768px)';
  let welcome = null;
  let welcomeReturnFocus = null;

  // Four quick moments: why the calendar, how to plan, where to write,
  // and how to turn on the optional Ideas tab within Shelf.
  const STEPS = [
    {
      id: 'calendar',
      view: 'calendarView',
      targets: ['#todayStrip', '#calGrid', '#calWeek', '#calAgenda'],
      title: 'One calendar. A clearer plan.',
      body: () => isConnected()
        ? 'Solid cards are your scheduled Buffer posts. Outlined cards are plans still taking shape. See what is ready, and what needs your attention.'
        : 'This is your planning calendar. You can explore without Buffer. Connect when you want to see your real scheduled posts alongside your plans.',
    },
    {
      id: 'plan',
      view: 'calendarView',
      targets: ['#calendarAddBtn', '#todayStrip', '#calGrid', '#calWeek', '#calAgenda'],
      title: 'Give an idea a date',
      body: () => 'Use + Add or pick a day to save a note, reminder, or idea. A plan is not a scheduled post. It is room to figure things out first.',
    },
    {
      id: 'compose',
      view: 'composerView',
      targets: ['#composerEditor', '#composerView .page-title'],
      title: 'Write when you are ready',
      body: () => isConnected()
        ? 'Compose is where a plan becomes a post. Write, choose your channels, then send a draft or schedule it in Buffer when you decide.'
        : 'Compose is your writing space. Explore the editor now; connect Buffer when you want to send drafts or schedule real posts.',
    },
    {
      id: 'shelf',
      view: 'calendarView',
      targets: ['#openSettings', '#calGrid', '#todayStrip'],
      title: 'Keep ideas close',
      body: () => 'Shelf keeps useful posts nearby. Want a dedicated place for new ideas too? Go to Settings → Customize and turn on “Ideas on the Shelf.” You can change it anytime.',
      actionLabel: 'Show me that setting',
    },
  ];

  function relevantSteps() {
    return STEPS;
  }

  let active = false;
  let steps = [];
  let index = 0;
  let pop = null;
  let ring = null;
  let target = null;
  let returnFocus = null;
  let navigating = false;
  let frame = 0;
  let dayObserver = null;

  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const markSeen = () => { try { localStorage.setItem(isConnected() ? CONNECTED_SEEN_KEY : SEEN_KEY, '1'); } catch {} };
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
    // If someone opens a day while learning to plan, guide the action *inside*
    // the drawer instead of highlighting a calendar hidden behind it.
    if (step.id === 'plan' && document.querySelector('#sharedDayModal.open')) {
      const action = document.querySelector('#sharedDayModal.open [data-add-note]');
      if (isVisible(action)) return action;
    }
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
      <div class="tour-connect" hidden>
        <button class="btn sm primary" type="button" data-tour="connect">Connect Buffer</button>
        <span>to see your real scheduled posts.</span>
      </div>
      <button class="btn sm ghost tour-extra-action" type="button" data-tour="setting" hidden></button>
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
      if (action === 'setting') {
        stop({ finished: true });
        if (typeof openModal === 'function') openModal('settingsModal');
        window.selectSettingsTab?.('customize');
        document.querySelector('[data-workspace-toggle="ideas"]')?.focus({ preventScroll: true });
      }
      if (action === 'connect') {
        // Return to the calendar after Buffer sign-in.
        stop({ finished: true });
        window.activateView?.('calendarView', 'tour');
        if (typeof goToBufferConnect === 'function') goToBufferConnect();
      }
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

  function schedulePlace() {
    if (!active) return;
    if (steps[index]?.id === 'plan') target = findTarget(steps[index]) || target;
    if (!frame) frame = requestAnimationFrame(place);
  }

  function showView(viewId) {
    if (document.getElementById(viewId)?.classList.contains('active')) return true;
    navigating = true;
    try { window.activateView?.(viewId, 'tour'); } finally { navigating = false; }
    return !!document.getElementById(viewId)?.classList.contains('active');
  }

  function go(next) {
    if (!active) return;
    // Finishing the day explanation restores the underlying calendar, so the
    // subsequent Compose/Shelf steps never sit behind an open day drawer.
    if (steps[index]?.id === 'plan' && next > index && document.querySelector('#sharedDayModal.open')) {
      closeModal?.('sharedDayModal');
    }
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
    const action = pop.querySelector('[data-tour="setting"]');
    action.hidden = !step.actionLabel;
    if (step.actionLabel) action.textContent = step.actionLabel;
    const back = pop.querySelector('[data-tour="back"]');
    back.hidden = index === 0;
    const last = index === steps.length - 1;
    pop.querySelector('[data-tour="next"]').textContent = last ? 'Finish' : 'Next';
    pop.querySelector('[data-tour="next"]').classList.toggle('primary', !(last && !isConnected()));
    pop.querySelector('.tour-connect').hidden = isConnected() || !last;
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

  function closeWelcome({ remember = true } = {}) {
    if (!welcome) return;
    if (remember) markSeen();
    welcome.remove(); welcome = null;
    document.body.classList.remove('postiq-welcome-open');
    if (welcomeReturnFocus?.isConnected) welcomeReturnFocus.focus({ preventScroll: true });
    welcomeReturnFocus = null;
  }

  function showWelcome(options = {}) {
    if (welcome || active) return;
    welcomeReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    welcome = document.createElement('div');
    welcome.className = 'postiq-welcome-backdrop';
    welcome.innerHTML = `<section class="postiq-welcome" role="dialog" aria-modal="true" aria-labelledby="postiqWelcomeTitle" aria-describedby="postiqWelcomeDesc">
      <span class="postiq-welcome-eyebrow">WELCOME TO POSTIQ</span>
      <h2 id="postiqWelcomeTitle">Your content has a calendar.<br><em>Let's give it a plan.</em></h2>
      <p id="postiqWelcomeDesc">Buffer handles publishing. PostIQ helps you see what is coming, spot open days, and make a plan before a post is ready. Compose works alongside your calendar, and Shelf and the writing tools turn on when you write your first draft.</p>
      <div class="postiq-welcome-actions">
        <button type="button" class="btn primary" data-welcome="tour">Take the tour <span aria-hidden="true">→</span></button>
        <button type="button" class="btn ghost" data-welcome="explore">Look around</button>
      </div>
      <p class="postiq-welcome-footnote">${isConnected() ? 'Your Buffer account is connected. Your calendar is ready to explore.' : 'No Buffer account required to look around. Connect when you want to bring in your real posts.'}</p>
    </section>`;
    welcome.addEventListener('click', event => {
      const choice = event.target.closest('[data-welcome]')?.dataset.welcome;
      if (!choice) return;
      closeWelcome();
      if (choice === 'tour') start({ source: options.source || 'welcome' });
    });
    welcome.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); closeWelcome(); }
      if (event.key === 'Tab') {
        const buttons = [...welcome.querySelectorAll('button')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    document.body.append(welcome);
    document.body.classList.add('postiq-welcome-open');
    welcome.querySelector('[data-welcome="tour"]')?.focus();
  }

  function start(options = {}) {
    if (active) return;
    steps = relevantSteps().filter(step => viewAvailable(step.view));
    if (!steps.length) {
      if (typeof showToast === 'function') showToast('The tour needs the Calendar. Turn it on in Settings.', 'info');
      return;
    }
    returnFocus = options.returnFocus || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    active = true;
    document.body.classList.add('tour-active');
    build();
    window.addEventListener('resize', schedulePlace);
    document.addEventListener('scroll', schedulePlace, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('postiq:view-changed', onViewChanged);
    const dayDrawer = document.getElementById('sharedDayModal');
    if (dayDrawer && typeof MutationObserver !== 'undefined') {
      dayObserver = new MutationObserver(schedulePlace);
      dayObserver.observe(dayDrawer, { attributes:true, attributeFilter:['class'] });
    }
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
    dayObserver?.disconnect(); dayObserver = null;
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
    // Offers a welcome choice once: on a first visit, or when a link asks with
    // ?tour=1. The flag is removed right away and closing the tour records it as
    // seen, so refreshing, bookmarking, or returning from Buffer sign-in does not
    // reopen it.
    const params = new URLSearchParams(location.search);
    const requested = params.get('tour') === '1' || params.get('welcome') === '1';
    if (requested) {
      params.delete('tour');
      params.delete('welcome');
      history.replaceState(history.state, document.title, `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`);
    }
    if (requested || (FIRST_VISIT && read(SEEN_KEY) !== '1') || (isConnected() && read(CONNECTED_SEEN_KEY) !== '1')) {
      // Reviewer and shared-snapshot pages should never show onboarding.
      setTimeout(() => { if (!document.getElementById('app')?.classList.contains('hidden')) showWelcome({ source: requested ? 'link' : 'first_visit' }); }, 600);
    }
  }

  return { init, start, stop, showWelcome, isActive: () => active, hasSeen: () => read(isConnected() ? CONNECTED_SEEN_KEY : SEEN_KEY) === '1', steps: STEPS };
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(window.PostIQTour.init, 0));
else setTimeout(window.PostIQTour.init, 0);
