/* ═══════════════════════════════════════════
   POSTIQ ONBOARDING v2
   onboarding.js — drop in after app.js
   ═══════════════════════════════════════════ */

'use strict';

window.PostIQOnboarding = (() => {

  // ── Storage keys ──────────────────────────
  const KEYS = {
    dismissed: 'postiq_ob_dismissed',
    synced:    'postiq_ob_synced',
    composed:  'postiq_ob_composed',
    tipPrefix: 'postiq_ob_tip_',
  };

  // ── Step definitions ──────────────────────
  const STEPS = [
    {
      id: 'connect',
      label: 'Connect Buffer',
      desc: 'Sign in so PostIQ can see your channels and queue',
      action: 'Sign in →',
      doneAction: 'Connected',
      isDone: isConnected,
    },
    {
      id: 'sync',
      label: 'Load your queue',
      desc: 'Pull in your scheduled posts and channels',
      action: 'Sync now →',
      doneAction: 'Loaded',
      isDone: isSynced,
    },
    {
      id: 'compose',
      label: 'Send your first post',
      desc: 'Draft, queue, or schedule something through Buffer',
      action: 'Go to Compose →',
      doneAction: 'Done',
      isDone: isComposed,
    },
  ];

  // ── Tooltip definitions ───────────────────
  // Only shown AFTER the banner is dismissed.
  const VIEW_TIPS = {
    calendarView: {
      icon: '📅',
      title: 'Your Buffer queue as a calendar',
      body: 'Scheduled posts appear here automatically after syncing. <strong>Click any day</strong> to add planning notes, draft content, or spot gaps in your queue.',
      anchor: '.cal-toolbar',
    },
    composerView: {
      icon: '✍️',
      title: 'Write here — publish through Buffer',
      body: 'Compose posts, attach media, and choose a Buffer action. <strong>Nothing goes live</strong> until you hit Draft, Queue, or Schedule.',
      anchor: '.editor-wrap',
    },
    ideasView: {
      icon: '💡',
      title: 'Where content ideas live',
      body: 'Build content pillars, save reusable templates, browse trending topics, and capture raw ideas. <strong>Hit Start</strong> on any seed to send a starter to Compose.',
      anchor: '.ideas-tabs',
    },
    approvalsView: {
      icon: '✅',
      title: 'Get sign-off before publishing',
      body: 'Generate a shareable reviewer link for any Buffer draft. Your client approves or requests changes — <strong>no PostIQ account needed</strong> on their end.',
      anchor: '.approvals-filter-row',
    },
  };

  // ── State helpers ─────────────────────────
  const store = (key, val) => { try { localStorage.setItem(key, val); } catch {} };
  const read  = key => { try { return localStorage.getItem(key); } catch { return null; } };

  const isBannerDismissed = () => read(KEYS.dismissed) === '1';
  const isTipSeen  = id => read(KEYS.tipPrefix + id) === '1';
  const markTipSeen = id => store(KEYS.tipPrefix + id, '1');

  function isConnected() {
    try {
      return !!(
        localStorage.getItem('postiq_buffer_access_token') ||
        sessionStorage.getItem('postiq_buffer_access_token') ||
        localStorage.getItem('postiq_buffer_token') ||
        sessionStorage.getItem('postiq_buffer_token')
      );
    } catch { return false; }
  }
  function isSynced()   { return read(KEYS.synced)   === '1'; }
  function isComposed() { return read(KEYS.composed)  === '1'; }

  // ── Banner ────────────────────────────────
  let bannerEl = null;

  function buildBanner() {
    const el = document.createElement('div');
    el.className = 'onboarding-banner';
    el.id = 'obBanner';
    document.body.appendChild(el);
    bannerEl = el;
    renderBanner();
    avoidGlobalStatusBanner();
  }

  function avoidGlobalStatusBanner() {
    if (!bannerEl) return;
    const globalBanner = document.getElementById('globalStatusBanner');
    if (globalBanner && !globalBanner.classList.contains('hidden')) {
      // Push onboarding banner below the global status banner
      const h = globalBanner.getBoundingClientRect().bottom;
      bannerEl.style.top = (h + 8) + 'px';
    } else {
      bannerEl.style.top = '';
    }
  }

  function renderBanner() {
    if (!bannerEl) return;

    const firstIncomplete = STEPS.findIndex(s => !s.isDone());
    const doneCount = STEPS.filter(s => s.isDone()).length;
    const allDone   = doneCount === STEPS.length;
    const pct       = Math.round((doneCount / STEPS.length) * 100);
    const current   = firstIncomplete >= 0 ? STEPS[firstIncomplete] : null;

    bannerEl.innerHTML = `
      <div class="ob-inner">
        <div class="ob-header">
          <div class="ob-title-group">
            <span class="ob-eyebrow">Getting started</span>
            <span class="ob-title">${allDone
              ? 'You\'re set — explore the app'
              : 'PostIQ is your planning layer for Buffer'
            }</span>
            ${allDone ? '' : '<span class="ob-subtitle">Connect Buffer, load your queue, then start planning and publishing from one place.</span>'}
          </div>
          <button class="ob-dismiss" id="obDismissBtn" aria-label="Dismiss">×</button>
        </div>

        <div class="ob-steps">
          ${STEPS.map((step, i) => {
            const done   = step.isDone();
            const active = !done && firstIncomplete === i;
            return `
              <div class="ob-step ${done ? 'ob-step-done' : ''} ${active ? 'ob-step-active' : ''}">
                <div class="ob-step-num">${done ? '✓' : i + 1}</div>
                <div class="ob-step-body">
                  <div class="ob-step-label">${step.label}</div>
                  <div class="ob-step-desc">${step.desc}</div>
                </div>
                ${active ? `<div class="ob-step-arrow">›</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <div class="ob-footer">
          <div class="ob-progress">
            <div class="ob-progress-bar-wrap">
              <div class="ob-progress-bar" style="width:${pct}%"></div>
            </div>
            <span class="ob-progress-label">${doneCount} of ${STEPS.length} done</span>
          </div>
          ${allDone
            ? `<button class="ob-cta ob-cta-done" id="obCtaBtn">Dismiss</button>`
            : current
              ? `<button class="ob-cta" id="obCtaBtn" data-step="${current.id}">${current.action}</button>`
              : ''
          }
        </div>
      </div>
    `;

    bannerEl.querySelector('#obDismissBtn')?.addEventListener('click', dismissBanner);

    const ctaBtn = bannerEl.querySelector('#obCtaBtn');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', () => {
        if (allDone) { dismissBanner(); return; }
        handleStepCTA(ctaBtn.dataset.step);
      });
    }
  }

  function handleStepCTA(stepId) {
    if (stepId === 'connect') {
      if (typeof window.selectSettingsTab === 'function') window.selectSettingsTab('connection');
      if (typeof window.openModal === 'function') window.openModal('settingsModal');
    } else if (stepId === 'sync') {
      const btn = document.getElementById('syncBtn');
      if (btn) btn.click();
    } else if (stepId === 'compose') {
      if (typeof window.activateView === 'function') window.activateView('composerView');
    }
  }

  function dismissBanner() {
    if (!bannerEl) return;
    store(KEYS.dismissed, '1');
    bannerEl.classList.add('ob-dismissing');
    setTimeout(() => { bannerEl?.remove(); bannerEl = null; }, 300);
  }

  function refreshBanner() {
    if (!bannerEl) return;
    renderBanner();
    // Auto-dismiss 2s after all steps complete
    if (STEPS.every(s => s.isDone())) {
      setTimeout(dismissBanner, 2000);
    }
  }

  // ── Tooltips ──────────────────────────────
  // Only shown after the banner is dismissed.
  let activeTip = null;
  let activeTipView = null;

  function showViewTooltip(viewId) {
    // Block tooltips until banner is done
    if (!isBannerDismissed()) return;
    if (isTipSeen(viewId)) return;
    const def = VIEW_TIPS[viewId];
    if (!def) return;

    setTimeout(() => {
      if (activeTip) removeTooltip(true);

      const anchor = document.querySelector(def.anchor);
      if (!anchor) { markTipSeen(viewId); return; }

      const tip = document.createElement('div');
      tip.className = 'ob-tooltip';
      tip.id = 'obActiveTip';

      tip.innerHTML = `
        <div class="ob-tip-header">
          <span class="ob-tip-icon">${def.icon}</span>
          <span class="ob-tip-title">${def.title}</span>
          <button class="ob-tip-close" aria-label="Dismiss">×</button>
        </div>
        <div class="ob-tip-body">${def.body}</div>
      `;

      positionTooltip(tip, anchor);
      document.body.appendChild(tip);
      activeTip = tip;
      activeTipView = viewId;

      tip.querySelector('.ob-tip-close').addEventListener('click', () => {
        markTipSeen(viewId);
        removeTooltip(false);
      });

      // Auto-dismiss after 10s
      let autoTimer = setTimeout(() => { markTipSeen(viewId); removeTooltip(false); }, 10000);
      tip.addEventListener('mouseenter', () => clearTimeout(autoTimer));
      tip.addEventListener('mouseleave', () => {
        autoTimer = setTimeout(() => { markTipSeen(viewId); removeTooltip(false); }, 4000);
      });

    }, 350);
  }

  function positionTooltip(tip, anchor) {
    if (window.innerWidth <= 768) {
      tip.style.cssText = 'position:fixed;left:16px;right:16px;bottom:76px;width:auto;';
      return;
    }
    tip.style.position = 'fixed';
    const r = anchor.getBoundingClientRect();
    tip.style.top  = (r.bottom + 10) + 'px';
    tip.style.left = Math.max(260, r.left) + 'px'; // always right of sidebar

    // Clamp right edge after paint
    requestAnimationFrame(() => {
      if (!tip.isConnected) return;
      const tr = tip.getBoundingClientRect();
      if (tr.right > window.innerWidth - 16) {
        tip.style.left = Math.max(260, window.innerWidth - tr.width - 16) + 'px';
      }
    });
  }

  function removeTooltip(immediate) {
    if (!activeTip) return;
    const tip = activeTip;
    activeTip = null;
    activeTipView = null;
    if (immediate) { tip.remove(); return; }
    tip.classList.add('ob-tip-dismissing');
    setTimeout(() => tip.remove(), 220);
  }

  // ── Events ────────────────────────────────
  function bindEvents() {
    // Re-check position whenever global status banner is dismissed
    const globalDismiss = document.getElementById('globalStatusDismiss');
    if (globalDismiss) {
      globalDismiss.addEventListener('click', () => {
        setTimeout(avoidGlobalStatusBanner, 350);
      });
    }

    // Also re-check after the auto-hide timeout (global banner hides after ~5-7s)
    setTimeout(avoidGlobalStatusBanner, 7500);

    window.addEventListener('postiq:synced', () => {
      store(KEYS.synced, '1');
      refreshBanner();
    });

    window.addEventListener('postiq:post_sent', () => {
      store(KEYS.composed, '1');
      refreshBanner();
    });

    // Poll for Buffer connection state (no event fired on connect)
    if (!isConnected()) {
      const poll = setInterval(() => {
        if (isConnected()) { clearInterval(poll); refreshBanner(); }
      }, 2000);
      setTimeout(() => clearInterval(poll), 300000);
    }

    // Patch activateView to show per-view tooltips
    const origActivate = window.activateView;
    if (typeof origActivate === 'function') {
      window.activateView = function(viewId, ...args) {
        origActivate.call(this, viewId, ...args);
        if (bannerEl) bannerEl.classList.toggle('ob-compose-mode', viewId === 'composerView');
        showViewTooltip(viewId);
      };
    }

    // Click outside dismisses active tooltip
    document.addEventListener('click', e => {
      if (activeTip && !activeTip.contains(e.target)) {
        if (activeTipView) markTipSeen(activeTipView);
        removeTooltip(false);
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && activeTip) {
        if (activeTipView) markTipSeen(activeTipView);
        removeTooltip(false);
      }
    });
  }

  // ── Init ──────────────────────────────────
  function init() {
    bindEvents();

    // If the user is already connected, they are not new.
    // Skip the banner entirely — just run tooltips as they explore.
    if (isConnected()) {
      // Mark banner dismissed so tooltips are unblocked
      store(KEYS.dismissed, '1');
      return;
    }

    if (!isBannerDismissed()) {
      buildBanner();
      // If app launches directly into composerView, position accordingly
      const activeView = document.querySelector('.view.active');
      if (activeView && activeView.id === 'composerView' && bannerEl) {
        bannerEl.classList.add('ob-compose-mode');
      }
    }
    // Tooltips only fire after banner dismissed — no initial tooltip on load
  }

  return { init, refresh: refreshBanner, dismiss: dismissBanner };

})();

// Auto-init after app.js has run
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', PostIQOnboarding.init);
} else {
  setTimeout(PostIQOnboarding.init, 400);
}

// Patch showToast to detect successful post sends
(function() {
  const orig = window.showToast;
  if (typeof orig !== 'function') return;
  const phrases = ['Buffer draft saved', 'Added to queue', 'Scheduled'];
  window.showToast = function(msg, type, ...rest) {
    orig.call(this, msg, type, ...rest);
    if (type === 'success' && phrases.some(p => String(msg || '').includes(p))) {
      window.dispatchEvent(new Event('postiq:post_sent'));
    }
  };
})();
