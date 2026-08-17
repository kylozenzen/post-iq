'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initThemePicker();
  // Sidebar collapse toggle
  const appEl = document.getElementById('app');
  const sidebarToggleBtn = document.getElementById('sidebarToggle');
  if (appEl && sidebarToggleBtn) {
    const COLLAPSED_KEY = 'sidebar_collapsed';
    const applyCollapsed = (collapsed) => {
      appEl.classList.toggle('sidebar-collapsed', collapsed);
      sidebarToggleBtn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
      sidebarToggleBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    };
    applyCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
    sidebarToggleBtn.addEventListener('click', () => {
      const next = !appEl.classList.contains('sidebar-collapsed');
      applyCollapsed(next);
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    });
  }

  bindGlobalStatusDismiss();
  bindGlobalErrorHandlers();
  bindModalActionDelegates();
  document.addEventListener('click', handlePausedFeatureEvent, true);
  document.addEventListener('pointerdown', handlePausedFeatureEvent, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') handlePausedFeatureEvent(event);
  }, true);
  loadPostiqConfig();
  console.info('[PostIQ] Modal targets', {
    settingsButton: !!document.getElementById('openSettings'),
    mobileSettingsButton: !!document.getElementById('mobOpenSettings'),
    settingsModal: !!document.getElementById('settingsModal'),
    templateModal: !!document.getElementById('templateModal'),
    templatesGrid: !!document.getElementById('templatesGrid'),
    newTemplateBtn: !!document.getElementById('newTemplateBtn'),
    saveTemplateBtn: !!document.getElementById('saveTemplateBtn')
  });

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-view]');
    if (!trigger || !trigger.dataset.view) return;
    if (trigger.tagName === 'A' && trigger.hasAttribute('href')) return;
    e.preventDefault();
    if (typeof window.activateView === 'function') window.activateView(trigger.dataset.view);
    if (trigger.dataset.view === 'ideasView' && typeof setIdeasTab === 'function' && trigger.dataset.ideasTab) {
      setIdeasTab(trigger.dataset.ideasTab);
    }
  });

  try { init(); applyFeatureFlags(); } catch (e) { console.error('[PostIQ] init() crashed:', e); showGlobalErrorBanner(); }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(error => console.warn('[PostIQ] Service worker registration failed:', error));
  }
});
