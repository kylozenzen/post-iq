/* ═══════════════════════════════════════════
   POSTIQ ONBOARDING
   onboarding.js — drop in after app.js
   ═══════════════════════════════════════════ */

'use strict';

window.PostIQOnboarding = (() => {

  // ── Storage keys ──────────────────────────
  const KEYS = {
    dismissed:    'postiq_ob_dismissed',       // banner permanently dismissed
    connected:    'postiq_ob_connected',        // user connected Buffer
    synced:       'postiq_ob_synced',           // user synced at least once
    composed:     'postiq_ob_composed',         // user sent at least one post/draft
    tipPrefix:    'postiq_ob_tip_',             // + viewId = tooltip seen
  };

  // ── Step definitions ──────────────────────
  const STEPS = [
    {
      id: 'connect',
      label: 'Connect Buffer',
      desc: 'Sign in to load your channels and queue',
      action: '→ Sign in',
      doneAction: '✓ Connected',
      isDone: () => isConnected(),
    },
    {
      id: 'sync',
      label: 'Sync your queue',
      desc: 'Pull in your Buffer posts and channels',
      action: '→ Sync now',
      doneAction: '✓ Synced',
      isDone: () => isSynced(),
    },
    {
      id: 'compose',
      label: 'Write your first post',
      desc: 'Draft, queue, or schedule through Buffer',
      action: '→ Compose',
      doneAction: '✓ Done',
      isDone: () => isComposed(),
    },
  ];

  // ── View tooltip definitions ───────────────
  // Each view gets one tooltip, shown the first time the user lands there.
  const VIEW_TIPS = {
    calendarView: {
      icon: '📅',
      title: 'This is your planning layer',
      body: 'Your Buffer queue lives here as a monthly calendar. <strong>Gaps surface automatically</strong> — click any day to add a note, draft content, or plan ahead.',
      badge: 'Plan view',
      anchor: '.cal-toolbar',
      position: 'below',
    },
    composerView: {
      icon: '✍️',
      title: 'Write here, send to Buffer',
      body: 'Compose your post, attach media, and choose a Buffer action when ready. <strong>Nothing publishes</strong> until you pick Draft, Queue, or Schedule.',
      badge: 'Compose view',
      anchor: '.editor-wrap',
      position: 'below',
    },
    ideasView: {
      icon: '💡',
      title: 'Your idea engine',
      body: 'Build content pillars, save templates, browse trending topics, and capture notebook ideas. <strong>Hit Start</strong> on any seed idea to drop a starter straight into Compose.',
      badge: 'Ideas view',
      anchor: '.ideas-tabs',
      position: 'below',
    },
    approvalsView: {
      icon: '✅',
      title: 'Client sign-off, simplified',
      body: 'Generate a reviewer link for any Buffer draft. Your client approves or requests changes — <strong>no PostIQ account</strong> needed on their end.',
      badge: 'Approve view',
      anchor: '.approvals-filter-row',
      position: 'below',
    },
  };

  // ── State helpers ─────────────────────────
  const store = (key, val) => { try { localStorage.setItem(key, val); } catch {} };
  const read  = key => { try { return localStorage.getItem(key); } catch { return null; } };

  const isBannerDismissed = () => read(KEYS.dismissed) === '1';
  const isConnected = () => {
    try {
      const hasOAuth  = !!(localStorage.getItem('postiq_buffer_access_token') || sessionStorage.getItem('postiq_buffer_access_token'));
      const hasManual = !!(localStorage.getItem('postiq_buffer_token') || sessionStorage.getItem('postiq_buffer_token'));
      return hasOAuth || hasManual;
    } catch { return false; }
  };
  const isSynced   = () => read(KEYS.synced)   === '1';
  const isComposed = () => read(KEYS.composed)  === '1';
  const isTipSeen  = viewId => read(KEYS.tipPrefix + viewId) === '1';
  const markTipSeen = viewId => store(KEYS.tipPrefix + viewId, '1');

  // ── Banner DOM ────────────────────────────
  let bannerEl = null;

  function buildBanner() {
    const el = document.createElement('div');
    el.className = 'onboarding-banner';
    el.id = 'obBanner';
    el.setAttribute('role', 'complementary');
    el.setAttribute('aria-label', 'Getting started with PostIQ');
    document.body.appendChild(el);
    bannerEl = el;
    renderBanner();
  }

  function renderBanner() {
    if (!bannerEl) return;

    const steps = STEPS;
    const firstIncomplete = steps.findIndex(s => !s.isDone());
    const doneCount = steps.filter(s => s.isDone()).length;
    const allDone   = doneCount === steps.length;
    const pct = Math.round((doneCount / steps.length) * 100);

    // CTA target
    const currentStep = firstIncomplete >= 0 ? steps[firstIncomplete] : null;

    bannerEl.innerHTML = `
      <div class="ob-inner">
        <div class="ob-header">
          <div class="ob-title-group">
            <span class="ob-eyebrow">Getting started</span>
            <span class="ob-title">${allDone ? 'You\'re all set 🎉' : 'Set up PostIQ in 3 steps'}</span>
          </div>
          <button class="ob-dismiss" id="obDismissBtn" aria-label="Dismiss getting started guide" title="Dismiss">×</button>
        </div>

        <div class="ob-steps">
          ${steps.map((step, i) => {
            const done   = step.isDone();
            const active = !done && (firstIncomplete === i);
            return `
              <div class="ob-step ${done ? 'ob-step-done' : ''} ${active ? 'ob-step-active' : ''}">
                <div class="ob-step-num">${done ? '✓' : i + 1}</div>
                <div class="ob-step-body">
                  <div class="ob-step-label">${step.label}</div>
                  <div class="ob-step-desc">${step.desc}</div>
                </div>
                <div class="ob-step-action">${done ? step.doneAction : (active ? step.action : '')}</div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="ob-footer">
          <div class="ob-progress">
            <div class="ob-progress-bar-wrap">
              <div class="ob-progress-bar" style="width:${pct}%"></div>
            </div>
            <span class="ob-progress-label">${doneCount}/${steps.length} done</span>
          </div>
          ${allDone
            ? `<button class="ob-cta ob-cta-done" id="obCtaBtn">All set — dismiss</button>`
            : currentStep
              ? `<button class="ob-cta" id="obCtaBtn" data-step="${currentStep.id}">${currentStep.action}</button>`
              : ''
          }
        </div>
      </div>
    `;

    // Bind dismiss
    bannerEl.querySelector('#obDismissBtn')?.addEventListener('click', dismissBanner);

    // Bind CTA
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
      // Open connection settings
      if (typeof window.openConnectionSettings === 'function') {
        window.openConnectionSettings();
      } else if (typeof window.openModal === 'function') {
        if (typeof window.selectSettingsTab === 'function') window.selectSettingsTab('connection');
        window.openModal('settingsModal');
      }
    } else if (stepId === 'sync') {
      // Trigger sync
      const syncBtn = document.getElementById('syncBtn');
      if (syncBtn) syncBtn.click();
    } else if (stepId === 'compose') {
      // Navigate to compose
      if (typeof window.activateView === 'function') window.activateView('composerView');
    }
  }

  function dismissBanner() {
    if (!bannerEl) return;
    store(KEYS.dismissed, '1');
    bannerEl.classList.add('ob-dismissing');
    setTimeout(() => {
      bannerEl?.remove();
      bannerEl = null;
    }, 300);
  }

  function refreshBanner() {
    if (!bannerEl) return;
    // Re-check if all done — auto-collapse after final step
    const allDone = STEPS.every(s => s.isDone());
    renderBanner();
    if (allDone) {
      // Give them a moment to see the completion state, then offer to dismiss
      // (don't auto-dismiss — let them read it)
    }
  }

  // ── Tooltip DOM ───────────────────────────
  let activeTooltip = null;
  let activeTooltipView = null;

  function showViewTooltip(viewId) {
    // Already seen this view's tip
    if (isTipSeen(viewId)) return;
    const tipDef = VIEW_TIPS[viewId];
    if (!tipDef) return;

    // Small delay so the view transition completes first
    setTimeout(() => {
      // If another tip is showing, remove it
      if (activeTooltip) removeTooltip(true);

      // Find anchor element
      const anchorEl = document.querySelector(tipDef.anchor);
      if (!anchorEl) {
        // Anchor not found — mark seen and skip silently
        markTipSeen(viewId);
        return;
      }

      const tip = document.createElement('div');
      tip.className = `ob-tooltip${tipDef.position === 'below' ? ' ob-tip-below' : ''}`;
      tip.id = 'obActiveTip';
      tip.setAttribute('role', 'tooltip');

      tip.innerHTML = `
        <div class="ob-tip-header">
          <span class="ob-tip-icon">${tipDef.icon}</span>
          <span class="ob-tip-title">${tipDef.title}</span>
          <button class="ob-tip-close" id="obTipClose" aria-label="Dismiss tip">×</button>
        </div>
        <div class="ob-tip-body">${tipDef.body}</div>
        <div class="ob-tip-badge">PostIQ tip · ${tipDef.badge}</div>
      `;

      // Position relative to anchor
      positionTooltip(tip, anchorEl, tipDef.position || 'above');

      document.body.appendChild(tip);
      activeTooltip = tip;
      activeTooltipView = viewId;

      tip.querySelector('#obTipClose')?.addEventListener('click', () => {
        markTipSeen(viewId);
        removeTooltip(false);
      });

      // Auto-dismiss after 12 seconds
      const autoTimer = setTimeout(() => {
        if (activeTooltipView === viewId) {
          markTipSeen(viewId);
          removeTooltip(false);
        }
      }, 12000);

      // Cancel auto-dismiss on hover
      tip.addEventListener('mouseenter', () => clearTimeout(autoTimer));

    }, 320);
  }

  function positionTooltip(tip, anchor, position) {
    // On mobile: fixed bottom positioning handled by CSS
    if (window.innerWidth <= 768) {
      tip.style.position = 'fixed';
      return;
    }

    // Desktop: position relative to anchor element
    tip.style.position = 'fixed';
    const rect = anchor.getBoundingClientRect();

    if (position === 'below') {
      tip.style.top  = (rect.bottom + 12) + 'px';
      tip.style.left = Math.max(16, rect.left) + 'px';
    } else {
      // above
      tip.style.bottom = (window.innerHeight - rect.top + 12) + 'px';
      tip.style.left   = Math.max(16, rect.left) + 'px';
    }

    // Clamp so it doesn't overflow the right edge
    requestAnimationFrame(() => {
      if (!tip.isConnected) return;
      const tipRect = tip.getBoundingClientRect();
      if (tipRect.right > window.innerWidth - 16) {
        tip.style.left = Math.max(16, window.innerWidth - tipRect.width - 16) + 'px';
      }
    });
  }

  function removeTooltip(immediate = false) {
    if (!activeTooltip) return;
    const tip = activeTooltip;
    activeTooltip = null;
    activeTooltipView = null;
    if (immediate) {
      tip.remove();
    } else {
      tip.classList.add('ob-tip-dismissing');
      setTimeout(() => tip.remove(), 220);
    }
  }

  // ── Event listeners ───────────────────────

  function bindEvents() {
    // Listen for Buffer sync completion — mark synced + refresh banner
    window.addEventListener('postiq:synced', () => {
      store(KEYS.synced, '1');
      refreshBanner();
    });

    // Listen for successful post send — mark composed
    // We hook into the existing composerSend flow via a custom event
    window.addEventListener('postiq:post_sent', () => {
      store(KEYS.composed, '1');
      refreshBanner();
    });

    // Watch for connection state changes via polling
    // (PostIQ doesn't fire an event on connect, so we poll briefly after init)
    if (isConnected()) {
      store(KEYS.connected, '1');
    } else {
      const connPoller = setInterval(() => {
        if (isConnected()) {
          store(KEYS.connected, '1');
          clearInterval(connPoller);
          refreshBanner();
        }
      }, 2000);
      // Stop polling after 5 min
      setTimeout(() => clearInterval(connPoller), 300000);
    }

    // View change hook — show tooltip when switching views
    // We patch activateView to intercept view changes
    const originalActivateView = window.activateView;
    if (typeof originalActivateView === 'function') {
      window.activateView = function(viewId, ...args) {
        originalActivateView.call(this, viewId, ...args);
        // Show tooltip for this view if not yet seen
        showViewTooltip(viewId);
      };
    }

    // Click outside tooltip to dismiss
    document.addEventListener('click', (e) => {
      if (activeTooltip && !activeTooltip.contains(e.target)) {
        if (activeTooltipView) markTipSeen(activeTooltipView);
        removeTooltip(false);
      }
    }, { capture: false });

    // Escape key to dismiss both
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (activeTooltip) {
          if (activeTooltipView) markTipSeen(activeTooltipView);
          removeTooltip(false);
        }
      }
    });
  }

  // ── Fire first-view tooltip on load ──────
  // The app starts on calendarView — show that tip if not yet seen.
  function maybeShowInitialTooltip() {
    // Small delay so the banner animates in first
    setTimeout(() => {
      showViewTooltip('calendarView');
    }, 1200);
  }

  // ── Init ──────────────────────────────────
  function init() {
    // Don't show onboarding if user is clearly not new
    // (has previously dismissed, or has all steps done)
    const allDone = STEPS.every(s => s.isDone());
    if (isBannerDismissed() && allDone) {
      // No banner, but still fire view tooltips
      bindEvents();
      maybeShowInitialTooltip();
      return;
    }

    if (!isBannerDismissed()) {
      buildBanner();
    }

    bindEvents();

    if (!isBannerDismissed()) {
      maybeShowInitialTooltip();
    }
  }

  // Expose for external refresh (e.g. after Buffer connect callback)
  return { init, refresh: refreshBanner, dismissBanner };

})();

// ── Auto-init after DOM is ready ──────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', PostIQOnboarding.init);
} else {
  // DOMContentLoaded already fired (e.g. script loaded async)
  // Wait for app.js init to complete first
  setTimeout(PostIQOnboarding.init, 400);
}

// ── Dispatch postiq:post_sent when a post is sent ──
// Patch the global composerSend signal — hook into app.js toast pattern
// since composerSend isn't exposed. We watch for the success toast instead.
(function patchPostSentSignal() {
  const origShowToast = window.showToast;
  if (typeof origShowToast !== 'function') return;
  const sentPhrases = ['Buffer draft saved', 'Added to queue', 'Scheduled'];
  window.showToast = function(msg, type, ...rest) {
    origShowToast.call(this, msg, type, ...rest);
    if (type === 'success' && sentPhrases.some(p => String(msg || '').includes(p))) {
      window.dispatchEvent(new Event('postiq:post_sent'));
    }
  };
})();
