'use strict';

// ── VIEW NAVIGATION ──────────────────────────────────
function activateView(viewId, source = 'navigation') {
  if (viewId === 'contentBankView') viewId = 'ideasView';
  if (viewId === 'homeView') viewId = 'calendarView'; // legacy saved view
  const requestedFeature = getFeatureForView(viewId);
  if (requestedFeature && !isFeatureEnabled(requestedFeature)) {
    viewId = getSafeFeatureFallbackView();
  }
  const requestedWorkspace = getWorkspaceForView(viewId);
  if (requestedWorkspace && !workspacePreferences[requestedWorkspace]) {
    viewId = WORKSPACE_VIEWS[getFirstEnabledWorkspace(workspacePreferences)];
  }
  if (currentViewId === 'calendarView' && viewId !== 'calendarView') window.CalendarExperience?.remember();
  if (document.body.dataset.gaReady) safeTrack(() => GA4_System.viewChanged(viewId, source));
  safeTrack(() => {
    if (viewId === 'composerView') GA4_Composer.composerOpened(source);
    if (viewId === 'calendarView') GA4_Calendar.calendarOpened();
    if (viewId === 'ideasView') GA4_Ideas.ideasOpened();
  });
  if (viewId === 'libraryView' && isFeatureEnabled('library') && window.PostIQLibrary) window.PostIQLibrary.activate();
  document.body.dataset.gaReady = '1';
  currentViewId = viewId;
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x.dataset.view === viewId));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === viewId));
  document.querySelectorAll('.mob-tab[data-view]').forEach(t => t.classList.toggle('active', t.dataset.view === viewId));
  // Shelf is one place across two views (past posts and ideas): keep its nav lit and its tabs in step.
  const onShelf = viewId === 'libraryView' || viewId === 'ideasView';
  document.querySelectorAll('[data-shelf-nav]').forEach(x => x.classList.toggle('active', onShelf));
  document.querySelectorAll('[data-shelf-tab]').forEach(tab => { const on = tab.dataset.shelfTab === viewId; tab.classList.toggle('active', on); tab.setAttribute('aria-selected', String(on)); });
  if (viewId === 'ideasView') setIdeasTab(currentIdeasTab || 'notebook');
  window.dispatchEvent(new CustomEvent('postiq:view-changed', { detail: { viewId, source } }));
}
window.activateView = activateView;

function setIdeasTab(tabId = 'notebook') {
  if (tabId === 'trending' && !getFeatureFlag('trending')) { showFeaturePaused('trending'); tabId = 'notebook'; }
  const tab = ['notebook', 'templates'].includes(tabId) ? tabId : 'notebook';
  currentIdeasTab = tab;
  const resources=document.getElementById('bankResources');
  if(resources) {resources.open=false;document.getElementById('bankResourcesSummary').textContent=tab==='notebook'?'Resources':`Resources · ${document.querySelector(`[data-ideas-tab="${tab}"]`)?.textContent || tab}`;}
  safeTrack(() => GA4_Ideas.tabSwitched(tab));
  document.querySelectorAll('.ideas-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ideasTab === tab);
  });
  document.querySelectorAll('[data-ideas-panel]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.ideasPanel === tab);
  });
}

// ── SCHEDULE PICKERS ──────────────────────────────────
function buildTimePickers() {
  const h = qs('scheduleHour'), m = qs('scheduleMin'), ap = qs('scheduleAmpm');
  if (!h || !m || !ap) return;
  for (let i = 1; i <= 12; i++) { const o = document.createElement('option'); o.value = i; o.textContent = String(i).padStart(2, '0'); h.appendChild(o); }
  for (let i = 0; i < 60; i += 5) { const o = document.createElement('option'); o.value = i; o.textContent = String(i).padStart(2, '0'); m.appendChild(o); }
  ['AM','PM'].forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; ap.appendChild(o); });
  const now = new Date(); h.value = (now.getHours() % 12) || 12; m.value = 0; ap.value = now.getHours() >= 12 ? 'PM' : 'AM';
}

function syncComposerWhen() {
  const dateEl = qs('scheduleDate'), hourEl = qs('scheduleHour'), minEl = qs('scheduleMin'), ampmEl = qs('scheduleAmpm'), whenEl = qs('composerWhen');
  if (!dateEl || !hourEl || !minEl || !ampmEl || !whenEl) return;
  const d = dateEl.value; if (!d) { whenEl.value = ''; return; }
  let h = parseInt(hourEl.value); const m = parseInt(minEl.value); const ap = ampmEl.value;
  if (ap === 'PM' && h !== 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
  whenEl.value = localWallClockToISO(d, h, m);
}

document.addEventListener('click', event => {
  const tab = event.target.closest('[data-shelf-tab]');
  if (tab) activateView(tab.dataset.shelfTab, 'shelf_tab');
});
