'use strict';

// ── INIT ──────────────────────────────────────────────
function renderPlanningSettings() {
  const show = qs('showQueueGapsSetting');
  const daysWrap = qs('postingDaysSettings');
  if (!show || !daysWrap) return;
  const settings = getPlanningSettings();
  show.checked = settings.showQueueGaps;
  daysWrap.innerHTML = DAY_CODES.map((code, idx) => `<label class="settings-check"><input type="checkbox" data-posting-day="${code}" ${settings.postingDays.includes(code) ? 'checked' : ''} /> ${DAY_LABELS[idx]}</label>`).join('');
}
function savePlanningSettingsFromUI() {
  const show = qs('showQueueGapsSetting');
  const postingDays = [...document.querySelectorAll('[data-posting-day]')].filter(i => i.checked).map(i => i.dataset.postingDay);
  const next = { showQueueGaps: !!show?.checked, postingDays: postingDays.length ? postingDays : DEFAULT_PLANNING_SETTINGS.postingDays };
  setPlanningSettings(next);
  detectQueueGaps();
}
function renderNoteTypesSettings() {
  const wrap = qs('noteTypesSettings'); if (!wrap) return;
  const types = getNoteTypes();
  wrap.innerHTML = types.map((t, idx) => `
    <div class="note-type-row" data-note-type-row="${safeText(t.id)}">
      <input type="color" value="${safeText(t.color)}" data-note-type-color="${safeText(t.id)}" aria-label="${safeText(t.label)} color" />
      <input class="input" value="${safeText(t.label)}" data-note-type-label="${safeText(t.id)}" maxlength="40" />
      <button class="btn sm ghost" type="button" data-delete-note-type="${safeText(t.id)}" ${DEFAULT_NOTE_TYPES.some(d => d.id === t.id) ? 'disabled title="Default types cannot be deleted"' : ''}>Delete</button>
    </div>`).join('');
  renderNoteTypeOptions(qs('noteTag')?.value);
}
function saveNoteTypesFromSettings() {
  const current = getNoteTypes();
  const next = current.map(t => {
    const label = document.querySelector(`[data-note-type-label="${CSS.escape(t.id)}"]`)?.value.trim() || t.label;
    const color = document.querySelector(`[data-note-type-color="${CSS.escape(t.id)}"]`)?.value || t.color;
    return { ...t, label, color };
  });
  setNoteTypes(next);
  renderCalendar();
  renderNoteTypeOptions(qs('noteTag')?.value);
}
function addNoteType() {
  const types = getNoteTypes();
  const id = `custom_${Date.now().toString(36)}`;
  types.push({ id, label: 'New type', color: '#6366f1' });
  setNoteTypes(types);
  renderNoteTypesSettings();
}
function deleteNoteType(id) {
  if (DEFAULT_NOTE_TYPES.some(t => t.id === id)) return;
  const notes = getNotes();
  const inUse = Object.values(notes).some(list => (Array.isArray(list) ? list : [list]).some(n => (n.typeId || n.type || n.id) === id));
  if (inUse) { showToast('This note type is used by existing notes.', 'error'); return; }
  setNoteTypes(getNoteTypes().filter(t => t.id !== id));
  renderNoteTypesSettings();
  renderCalendar();
}

function init() {
  const approveParam = new URLSearchParams(location.search).get('approve');
  if (approveParam) { renderReviewerPage(approveParam); return; }
  if (renderSharedFromHash()) return;

  const wasReturning = !!localStorage.getItem(BETA_BANNER_PERSIST_KEY) || !!localStorage.getItem(APP_VISITED_KEY);
  loadStoredToken();
  loadTemplates();
  safeTrack(() => GA4_System.appInitialized({ isReturning: wasReturning, hasToken: !!getStoredValue(STORE_KEY) || !!getStoredOAuthToken()?.accessToken, hasData: !!localStorage.getItem(TEMPLATE_KEY) }));
  markAppVisited();
  initTemplateSelectors();
  renderTemplates();
  buildTimePickers();
  const scheduleDate = qs('scheduleDate');
  if (scheduleDate) {
    scheduleDate.value = new Date().toISOString().slice(0, 10);
    scheduleDate.min = new Date().toISOString().slice(0, 10);
  }
  renderChannelSelects();
  renderCalendar();
  renderPlanningSettings();
  renderNoteTypesSettings();
  workspacePreferences = getWorkspacePreferences();
  renderWorkspacePreferences();
  applyInternalFeatureFlags();
  activateView(WORKSPACE_VIEWS[getFirstEnabledWorkspace(workspacePreferences)]);

  document.querySelectorAll('[data-workspace-toggle]').forEach(input => {
    input.addEventListener('change', () => setWorkspacePreference(input.dataset.workspaceToggle, input.checked));
  });
  on('resetWorkspaceBtn', 'click', resetWorkspacePreferences);

  selectSettingsTab(document.querySelector('.settings-tab.active')?.dataset.stab || 'connection');
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.onclick = () => selectSettingsTab(tab.dataset.stab);
    tab.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      const tabs = [...document.querySelectorAll('.settings-tab:not([hidden])')];
      const current = tabs.indexOf(tab);
      let next = current;
      if (e.key === 'ArrowLeft') next = Math.max(0, current - 1);
      if (e.key === 'ArrowRight') next = Math.min(tabs.length - 1, current + 1);
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = tabs.length - 1;
      e.preventDefault();
      tabs[next]?.focus();
      if (tabs[next]) selectSettingsTab(tabs[next].dataset.stab);
    });
  });

  on('closeTemplatePicker', 'click', () => closeModal('templatePickerModal'));
  on('templateSearch', 'input', e => { state.templateSearch = e.target.value; renderTemplates(); });
  on('templateSearch', 'change', e => safeTrack(() => GA4_Templates.templateSearched(e.target.value.trim() ? 'has_query' : 'empty')));
  on('templatePlatformFilter', 'change', e => { state.templatePlatform = e.target.value; renderTemplates(); });
  on('pickerSearch', 'input', renderTemplatePicker);
  on('pickerType', 'change', renderTemplatePicker);

  try {
    if (window.AIAssist?.init) window.AIAssist.init();
  } catch (e) {
    console.error('[PostIQ] AIAssist.init() failed:', e);
  }

  try {
    if (window.ContentPillars?.init) window.ContentPillars.init();
  } catch (e) {
    console.error('[PostIQ] ContentPillars.init() failed:', e);
  }

  try {
    if (window.Discord?.init) window.Discord.init();
  } catch (e) {
    console.error('[PostIQ] Discord.init() failed:', e);
  }

  try {
    if (isFeatureEnabled('library') && window.PostIQLibrary?.init) window.PostIQLibrary.init();
  } catch (e) {
    console.error('[PostIQ] PostIQLibrary.init() failed:', e);
  }

  try {
    if (isFeatureEnabled('pulse') && window.PostIQPulse?.init) window.PostIQPulse.init();
  } catch (e) {
    console.error('[PostIQ] PostIQPulse.init() failed:', e);
  }

  try {
    if (window.Notebook?.init) window.Notebook.init();
  } catch (e) {
    console.error('[PostIQ] Notebook.init() failed:', e);
  }

  try { window.Articles?.init?.(); window.Longform?.init?.(); }
  catch (e) { console.error('[PostIQ] Longform/Articles init failed:', e); }

  on('manageTokenBtn', 'click', () => {
    const connection = getBufferConnectionState();
    if (connection.connected) syncBuffer({ force: true });
    else goToBufferConnect();
  });
  on('revealTokenBtn', 'click', (e) => { e.preventDefault(); openConnectionSettings(); });
  on('saveTokenBtn', 'click', saveToken);
  on('clearTokenBtn', 'click', () => { const tokenInput = qs('tokenInput'); if (tokenInput) tokenInput.value = ''; saveToken(); });
  const connectBufferBtn = qs('connectBufferBtn'); if (connectBufferBtn) connectBufferBtn.onclick = goToBufferConnect;
  const disconnectBufferBtn = qs('disconnectBufferBtn'); if (disconnectBufferBtn) disconnectBufferBtn.onclick = disconnectBuffer;

  on('syncBtn', 'click', () => syncBuffer({ force: true }));
  const initialParams = new URLSearchParams(location.search);
  const connectedParam = initialParams.get('connected');
  if (connectedParam === 'buffer') {
    showToast('Buffer connected.', 'success');
    setSyncStatus('idle', 'Buffer connected.');
    const cleanParams = new URLSearchParams(location.search);
    cleanParams.delete('connected');
    const cleanUrl = `${location.pathname}${cleanParams.toString() ? `?${cleanParams.toString()}` : ''}${location.hash || ''}`;
    history.replaceState({}, document.title, cleanUrl);
  }
  renderConnectionUI();
  if (FEATURE_HOME_DASHBOARD) initHomeView();
  if (initialParams.get('settings') === 'connection') {
    openConnectionSettings({ advancedApi: initialParams.get('advanced') === 'api' });
  }
  checkBufferConnectionHealth().then(connection => {
    if (connection.connected) {
      const hasCachedScheduledPosts = Array.isArray(state.scheduled) && state.scheduled.length > 0;
      setSyncStatus('idle', hasCachedScheduledPosts
        ? 'Using cached Buffer data. Click Sync now to refresh.'
        : 'Connected. Click Sync now to load Buffer posts.');
    } else if (connection.reconnectNeeded) {
      setSyncStatus('failed', 'Reconnect Buffer to keep syncing.');
    }
  });

  document.querySelectorAll('[data-view]').forEach(b => {
    b.onclick = () => {
      activateView(b.dataset.view, b.classList.contains('mob-tab') ? 'mobile_tab' : 'navigation');
      if (b.dataset.view === 'ideasView' && b.dataset.ideasTab) setIdeasTab(b.dataset.ideasTab);
    };
  });
  document.querySelectorAll('[data-home-feature="true"]').forEach(el => { if (!FEATURE_HOME_DASHBOARD) el.style.display = 'none'; });
  on('calendarViewMonthBtn', 'click', () => setCalendarView('month'));
  on('calendarViewWeekBtn', 'click', () => setCalendarView('week'));
  on('calendarPostsModeBtn', 'click', () => setContentCalendarMode('posts'));
  on('calendarContentModeBtn', 'click', () => setContentCalendarMode('content'));
  document.querySelectorAll('.ideas-tab').forEach(tabBtn => {
    tabBtn.onclick = () => setIdeasTab(tabBtn.dataset.ideasTab);
  });

  on('prevMonth', 'click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCalendar(); detectQueueGaps(); });
  on('nextMonth', 'click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCalendar(); detectQueueGaps(); });
  on('todayMonth', 'click', () => { state.month = new Date(); renderCalendar(); detectQueueGaps(); });
  on('closeNote', 'click', () => { closeModal('noteModal'); resetNoteForm(); });
  const closeShared = qs('closeSharedDay'); if (closeShared) closeShared.onclick = () => closeModal('sharedDayModal');
  on('saveNoteBtn', 'click', saveNote);
  on('deleteNoteBtn', 'click', deleteNote);
  on('sendNoteToDraftBtn', 'click', sendNoteToDraft);
  on('shareMonthBtn', 'click', openShareSnapshotModal);
  on('closeShare', 'click', () => closeModal('shareModal'));
  on('includeNotes', 'change', markShareNeedsRefresh);
  const shareRangeInput = qs('shareRange'); if (shareRangeInput) shareRangeInput.onchange = markShareNeedsRefresh;
  const shareTitleInput = qs('shareCustomTitle'); if (shareTitleInput) shareTitleInput.oninput = markShareNeedsRefresh;
  const shareNoteInput = qs('shareNote'); if (shareNoteInput) shareNoteInput.oninput = markShareNeedsRefresh;
  const calendarFilter = qs('calendarFilter'); if (calendarFilter) calendarFilter.onchange = e => { state.calendarFilter = e.target.value || 'all'; renderCalendar(); };
  const showQueue = qs('showQueueGapsSetting'); if (showQueue) showQueue.onchange = savePlanningSettingsFromUI;
  const postingDays = qs('postingDaysSettings'); if (postingDays) postingDays.addEventListener('change', savePlanningSettingsFromUI);
  const noteTypesWrap = qs('noteTypesSettings'); if (noteTypesWrap) {
    noteTypesWrap.addEventListener('input', saveNoteTypesFromSettings);
    noteTypesWrap.addEventListener('click', e => { const btn = e.target.closest('[data-delete-note-type]'); if (btn) deleteNoteType(btn.dataset.deleteNoteType); });
  }
  const addNoteTypeBtn = qs('addNoteTypeBtn'); if (addNoteTypeBtn) addNoteTypeBtn.onclick = addNoteType;
  on('generateShare', 'click', shareSnapshot);
  on('copyShare', 'click', copyCurrentShareLink);

  const editor = qs('composerEditor');
  if (!editor) { applyFeatureFlags(); return; }
  editor.addEventListener('input', () => {
    const text = editorToText(editor.innerHTML);
    const ch = state.channels.find(c => c.id === qs('composerChannel')?.value);
    const svc = (ch?.service || '').toLowerCase();
    let limit = null;
    if (svc.includes('twitter') || svc.includes('x-')) limit = 280;
    else if (svc.includes('thread')) limit = 500;
    else if (svc.includes('linkedin')) limit = 3000;
    else if (svc.includes('instagram')) limit = 2200;
    const cc = qs('charCount');
    if (limit) {
      const rem = limit - text.length;
      cc.textContent = `${text.length}/${limit}`;
      cc.className = 'char-count' + (rem < 0 ? ' over' : rem < 50 ? ' warn' : '');
    } else {
      cc.textContent = `${text.length} chars`;
      cc.className = 'char-count' + (text.length > 500 ? ' warn' : '');
    }
    if (!composerContentStartedTracked && text.trim().length > 0) { safeTrack(() => GA4_Composer.contentStarted()); composerContentStartedTracked = true; }
    [100, 280, 500].forEach(milestone => { if (text.length >= milestone && !composerMilestonesTracked.has(milestone)) { safeTrack(() => GA4_Composer.contentLengthMilestone(milestone)); composerMilestonesTracked.add(milestone); } });
    updateComposerClearButtonVisibility();
  });
  const charCount = qs('charCount'); if (charCount) charCount.textContent = '0 chars';
  on('composerChannel', 'change', updateComposerButtonStates);
  initComposerWorkspace(editor);
  window.PostIQComposerResources?.init?.();

  on('composerClearBtn', 'click', clearComposer);

  document.querySelectorAll('[data-cmd]').forEach(btn => btn.onclick = () => composerFormat(btn.dataset.cmd));
  on('composerDraft', 'click', () => composerSend('draft'));
  on('composerQueue', 'click', () => composerSend('queue'));
  on('composerScheduleSend', 'click', () => composerSend('schedule'));
  on('composerScheduleToggle', 'click', () => {
    qs('schedulePanel')?.classList.add('open');
    const toggle = qs('composerScheduleToggle'); if (toggle) toggle.style.display = 'none';
  });
  on('scheduleCancel', 'click', () => {
    qs('schedulePanel')?.classList.remove('open');
    const toggle = qs('composerScheduleToggle'); if (toggle) toggle.style.display = 'inline-flex';
  });
  ['scheduleDate','scheduleHour','scheduleMin','scheduleAmpm'].forEach(id => on(id, 'change', syncComposerWhen));
  syncComposerWhen();
  updateComposerButtonStates();
  window.addEventListener('postiq:synced', updateComposerButtonStates);

  on('insertTemplateBtn', 'click', () => { renderTemplatePicker(); openModal('templatePickerModal'); });
  on('saveAsTemplateBtn', 'click', () => {
    const sel = window.getSelection(); const text = (sel?.toString() || '').trim();
    if (!text) { showToast('Select text in the editor first', 'error'); return; }
    const body = qs('templateBody'); if (body) body.value = text; openTemplateModal();
  });

  on('refPinDismiss', 'click', () => { const refPin = qs('refPin'); const link = qs('refPinSourceLink'); if (refPin) refPin.style.display = 'none'; window.PostIQActiveReference = null; if (link) { link.style.display = 'none'; link.href = '#'; } });

  on('mediaToggleBtn', 'click', () => { qs('mediaPanel')?.classList.contains('open') ? closeMediaPanel() : openMediaPanel(); });
  on('mediaToggleOff', 'click', () => { qs('mediaPanel')?.classList.contains('open') ? closeMediaPanel() : openMediaPanel(); });
  on('mediaSummaryClear', 'click', () => { clearMedia(); showToast('Media removed'); });
  document.querySelectorAll('.media-tab').forEach(t => t.onclick = () => switchMediaTab(t.dataset.mtab));

  const zone = qs('uploadZone'), fi = qs('uploadFileInput');
  if (zone && fi) {
    zone.onclick = e => { if (!getFeatureFlag('uploads')) { showFeaturePaused('uploads'); return; } if (!e.target.closest('#uploadBrowseBtn') && !e.target.closest('#uploadResult')) fi.click(); };
    on('uploadBrowseBtn', 'click', e => { e.stopPropagation(); if (!getFeatureFlag('uploads')) { showFeaturePaused('uploads'); return; } fi.click(); });
    fi.onchange = () => { if (fi.files[0]) handleUploadFile(fi.files[0]); };
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--brand)'; zone.style.background = 'var(--brand-dim)'; });
    zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) { zone.style.borderColor = 'var(--border2)'; zone.style.background = ''; } });
    zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = 'var(--border2)'; zone.style.background = ''; if (!getFeatureFlag('uploads')) { showFeaturePaused('uploads'); return; } if (e.dataTransfer.files[0]) handleUploadFile(e.dataTransfer.files[0]); });
  }
  document.addEventListener('paste', e => {
    if (!qs('mediaPanel')?.classList.contains('open')) return;
    if (!getFeatureFlag('uploads')) return;
    const active = document.querySelector('.media-tab.active')?.dataset?.mtab;
    if (active !== 'upload') return;
    const img = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
    if (img) handleUploadFile(img.getAsFile());
  });
  on('uploadReplaceBtn', 'click', e => { e.stopPropagation(); if (!fi) return; if (!getFeatureFlag('uploads')) { showFeaturePaused('uploads'); return; } resetUploadTab(); fi.click(); });
  on('uploadClearBtn', 'click', e => { e.stopPropagation(); resetUploadTab(); clearMedia(); showToast('Media removed'); });

  const urlInp = qs('mediaUrlInput'); const urlClear = qs('mediaUrlClear');
  if (urlInp && urlClear) urlInp.addEventListener('input', () => {
    const url = urlInp.value.trim();
    urlClear.style.display = url ? 'inline-flex' : 'none';
    const vts = qs('videoThumbSection'), up = qs('urlPreview'), ui = qs('urlPreviewImg'), ut = qs('urlPreviewType');
    if (url) {
      if (isVideo(url)) {
        ui.style.display = 'none'; vts.style.display = 'block';
        ut.textContent = '🎬 Video URL'; up.style.display = 'flex';
      } else {
        ui.src = url; ui.style.display = 'block'; vts.style.display = 'none';
        ut.textContent = 'Image URL'; up.style.display = 'flex';
      }
      applyMedia(url, 'url', qs('videoThumbUrl')?.value?.trim() || '');
    } else { up.style.display = 'none'; clearMedia(); }
  });
  if (urlClear && urlInp) urlClear.onclick = () => { urlInp.value = ''; urlInp.dispatchEvent(new Event('input')); };
  const vtu = qs('videoThumbUrl');
  if (vtu) vtu.addEventListener('input', () => { mediaState.videoThumbUrl = vtu.value.trim(); });

  on('unsplashSearchBtn', 'click', runUnsplashSearch);
  on('unsplashQuery', 'keydown', e => { if (e.key === 'Enter') runUnsplashSearch(); });


  on('approvalsRefreshBtn', 'click', loadApprovals);
  document.querySelectorAll('[data-afilter]').forEach(pill => {
    pill.onclick = () => {
      document.querySelectorAll('[data-afilter]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const filter = pill.dataset.afilter;
      document.querySelectorAll('#approvalsList .approval-card').forEach(card => {
        const bar = card.querySelector('.approval-card-status-bar');
        if (!bar) return;
        const status = bar.classList.contains('approved') ? 'approved' : bar.classList.contains('changes') ? 'changes' : 'pending';
        card.style.display = (filter === 'all' || status === filter) ? '' : 'none';
      });
    };
  });



  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal.id); });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.modal.open')];
    if (open.length) closeModal(open[open.length - 1].id);
  });

  function openMobDrawer() {
    const syncEl = qs('syncStatus');
    const ms = qs('mobSyncStatus'); if (ms && syncEl) ms.textContent = syncEl.textContent;
    renderConnectionUI();
  initHomeView();
    qs('mobDrawer')?.classList.add('open');
    qs('mobBackdrop')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMobDrawer() {
    qs('mobDrawer')?.classList.remove('open');
    qs('mobBackdrop')?.classList.remove('open');
    document.body.style.overflow = '';
  }
  on('mobBackdrop', 'click', closeMobDrawer);
  ['mobMenuBtn','mobMenuBtnDraft','mobMenuBtnApprovals'].forEach(id => {
    const btn = qs(id); if (btn) btn.onclick = openMobDrawer;
  });
  on('mobSyncBtn', 'click', () => { syncBuffer({ force: true }); closeMobDrawer(); });
  window.postiqMobileTokenPanelOpen = false;
  on('mobManageTokenBtn', 'click', () => {
    const connection = getBufferConnectionState();
    if (connection.connected) syncBuffer({ force: true });
    else goToBufferConnect();
    closeMobDrawer();
  });
  const mobConnectionSettingsBtn = qs('mobConnectionSettingsBtn');
  if (mobConnectionSettingsBtn) mobConnectionSettingsBtn.onclick = () => { closeMobDrawer(); openConnectionSettings(); };

  const smb = qs('shareMonthBtnMob'); if (smb) smb.onclick = openShareSnapshotModal;

  const ccbm = qs('composerClearBtnMob');
  if (ccbm) ccbm.onclick = clearComposer;

  editor.addEventListener('input', updateComposerClearButtonVisibility);
  updateComposerClearButtonVisibility();

  const arbm = qs('approvalsRefreshBtnMob'); if (arbm) arbm.onclick = loadApprovals;

  const mobMoreBtn = qs('mobMoreBtn');
  if (mobMoreBtn) mobMoreBtn.onclick = openMobDrawer;

  // ── COMPOSER MODE TABS ──
  function setComposerMode(mode) {
    if (mode !== 'compose') {
      setComposerResourcesOpen(false);
      setComposerFocusMode(false, false);
    }
    document.querySelectorAll('.composer-mode-tab').forEach(t => {
      const isActive = t.dataset.cmode === mode;
      t.style.color = isActive ? 'var(--brand)' : 'var(--muted)';
      t.style.borderBottomColor = isActive ? 'var(--brand)' : 'transparent';
    });
    const composePanel = qs('composeModePanel'); if (composePanel) composePanel.style.display = mode === 'compose' ? 'contents' : 'none';
    const splitPanel = qs('splitModePanel'); if (splitPanel) splitPanel.style.display  = mode === 'split'   ? 'block'    : 'none';
    const discordPanel = qs('discordModePanel'); if (discordPanel) discordPanel.style.display = mode === 'discord' ? 'block' : 'none';
    const support = qs('composerSupportSection');
    if (support) support.style.display = mode === 'compose' ? 'grid' : 'none';
    if (mode === 'split') initSplitMode();
    if (mode === 'discord' && window.Discord) {
      safeTrack(() => GA4_Discord.discordModeOpened());
      if (window.Discord.renderComposer) window.Discord.renderComposer();
      if (window.Discord.checkScheduledAnnouncements) window.Discord.checkScheduledAnnouncements();
    }
    const editorText = editorToText(qs('composerEditor').innerHTML);
    if (editorText) {
      const ti = qs('threadInput');
      if (ti && !ti.value.trim()) ti.value = editorText;
    }
  }
  document.querySelectorAll('.composer-mode-tab').forEach(t => {
    t.onclick = () => setComposerMode(t.dataset.cmode);
  });

  // ── THREAD SPLITTER ──
  let threadParts = [];
  let threadNumbered = false;
  let splitInited = false;

  function splitThreadText(text, max = 280) {
    const parts = []; let left = text.trim();
    while (left.length > max) {
      let cut = left.lastIndexOf('\n', max);
      if (cut < 80) cut = left.lastIndexOf(' ', max);
      if (cut < 80) cut = max;
      parts.push(left.slice(0, cut).trim()); left = left.slice(cut).trim();
    }
    if (left) parts.push(left);
    return parts;
  }

  function renderThreadParts() {
    const out = qs('threadOut'); const empty = qs('threadEmpty');
    const actions = qs('threadActions'); const whenRow = qs('threadWhenRow');
    if (!threadParts.length) {
      out.innerHTML = ''; if (empty) empty.style.display = 'flex';
      if (actions) actions.style.display = 'none';
      if (whenRow) whenRow.style.display = 'none';
      return;
    }
    if (empty) empty.style.display = 'none';
    if (actions) actions.style.display = 'flex';
    out.innerHTML = '';
    threadParts.forEach((p, i) => {
      const label = threadNumbered ? `${i+1}/${threadParts.length} ` : '';
      const full = label + p;
      const over = full.length > 280;
      const div = document.createElement('div');
      div.className = 'card';
      div.style.cssText = 'padding:12px;margin-bottom:0;';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:11px;font-family:'DM Mono',monospace;color:var(--brand);background:var(--brand-dim);border:1px solid var(--brand-glow);padding:2px 7px;border-radius:4px;">Part ${i+1}</span>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:11px;font-family:'DM Mono',monospace;color:${over?'var(--red)':'var(--subtle)'};">${full.length}/280</span>
            <button class="btn sm ghost" data-pi="${i}">Copy</button>
          </div>
        </div>
        <textarea data-ti="${i}" style="min-height:80px;font-size:13px;">${safeText(p)}</textarea>`;
      div.querySelector('[data-pi]').onclick = () => { navigator.clipboard.writeText(full); safeTrack(() => GA4_Composer.threadPartCopied(i + 1)); showToast('Part copied'); };
      div.querySelector('[data-ti]').addEventListener('input', e => {
        threadParts[+e.target.dataset.ti] = e.target.value;
        const span = e.target.closest('.card').querySelector('span[style*="DM Mono"]');
        const lbl = threadNumbered ? `${i+1}/${threadParts.length} ` : '';
        const len = (lbl + e.target.value).length;
        if (span) { span.textContent = `${len}/280`; span.style.color = len > 280 ? 'var(--red)' : 'var(--subtle)'; }
      });
      out.appendChild(div);
    });
  }

  function initSplitMode() {
    if (splitInited) return; splitInited = true;

    const tch = qs('threadChannel');
    if (tch) {
      tch.innerHTML = '';
      const xChs = state.channels.filter(c => { const s = (c.service||'').toLowerCase(); return s.includes('twitter')||s.includes('thread')||s.includes('x-'); });
      if (xChs.length) {
        xChs.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.displayName||c.name} (${c.service})`; tch.appendChild(o); });
      } else if (state.channels.length) {
        state.channels.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.displayName||c.name} (${c.service})`; tch.appendChild(o); });
      } else {
        const o = document.createElement('option'); o.value = ''; o.textContent = '↻ Load channels from Buffer'; tch.appendChild(o);
      }
    }

    qs('splitBtn').onclick = () => {
      const text = qs('threadInput').value.trim();
      if (!text) { showToast('Add some text first', 'error'); return; }
      threadParts = splitThreadText(text);
      renderThreadParts();
      showToast(`${threadParts.length} thread parts`, 'success');
      safeTrack(() => GA4_Composer.threadSplit(threadParts.length));
    };

    qs('splitSampleBtn').onclick = () => {
      qs('threadInput').value = 'PostIQ helps Buffer users move faster. Start with one big idea, split it into clear thread parts, refine each part, and send a cleaner post flow to Buffer — drafts, queued, or scheduled. The whole thing in under two minutes.';
      qs('splitBtn').click();
    };

    const toggle = qs('threadNumberToggle');
    if (toggle) toggle.onchange = e => { threadNumbered = e.target.checked; renderThreadParts(); };

    qs('copyAllPartsBtn').onclick = () => {
      if (!threadParts.length) return;
      const text = threadParts.map((p,i) => threadNumbered ? `${i+1}/${threadParts.length} ${p}` : p).join('\n\n');
      navigator.clipboard.writeText(text); showToast('All parts copied', 'success');
    };

    async function sendThread(action) {
      if (!threadParts.length) { qs('threadStatus').textContent = 'Split content first.'; return; }
      const channelId = qs('threadChannel')?.value;
      if (!channelId) { qs('threadStatus').textContent = 'Select a channel first.'; return; }
      const parts = threadParts.map((p,i) => threadNumbered ? `${i+1}/${threadParts.length} ${p}` : p);
      const when = qs('threadWhen')?.value;
      const ch = state.channels.find(c => c.id === channelId);
      const svc = (ch?.service||'').toLowerCase();
      const isThreads = svc.includes('thread');
      const metadata = parts.length > 1 ? { metadata: { [isThreads?'threads':'twitter']: isThreads ? { type:'thread', thread: parts.slice(1).map(t=>({text:t})) } : { thread: parts.slice(1).map(t=>({text:t})) } } } : {};
      const input = { channelId, text: parts[0], schedulingType: 'automatic', ...metadata };
      if (action === 'draft')    { input.mode = 'addToQueue'; input.saveToDraft = true; }
      if (action === 'queue')    { input.mode = 'addToQueue'; }
      if (action === 'schedule') {
        if (!when) { qs('threadStatus').textContent = 'Set a date/time first.'; const row = qs('threadWhenRow'); if (row) row.style.display = 'block'; return; }
        input.mode = 'customScheduled'; input.dueAt = when;
      }
      qs('threadStatus').textContent = 'Sending…';
      try {
        await createPost(input);
        const msg = action==='draft'?'Buffer draft saved.':action==='queue'?'Added to queue.':'Scheduled.';
        qs('threadStatus').textContent = msg; showToast(msg, 'success');
      } catch(e) {
        const msg = getErrorMessage(e, 'Failed.');
        if (isAuthError(e)) handleAuthFailure(msg);
        qs('threadStatus').textContent = `Failed: ${msg}`;
      }
    }

    qs('draftThreadBtn').onclick    = () => sendThread('draft');
    qs('queueThreadBtn').onclick    = () => sendThread('queue');
    qs('scheduleThreadBtn').onclick = () => { const row = qs('threadWhenRow'); if (row) row.style.display = 'block'; };

    window.addEventListener('postiq:synced', () => {
      const tch2 = qs('threadChannel'); if (!tch2) return;
      tch2.innerHTML = '';
      const xChs = state.channels.filter(c => { const s=(c.service||'').toLowerCase(); return s.includes('twitter')||s.includes('thread')||s.includes('x-'); });
      const pool = xChs.length ? xChs : state.channels;
      pool.forEach(c => { const o=document.createElement('option'); o.value=c.id; o.textContent=`${c.displayName||c.name} (${c.service})`; tch2.appendChild(o); });
    });
  }


  function pinReferenceToComposer(data = {}) {
    const refPin = qs('refPin');
    const refPinTitle = qs('refPinTitle');
    const refPinBody = qs('refPinBody');
    const refPinSourceLink = qs('refPinSourceLink');
    if (!refPin || !refPinTitle || !refPinBody) return;
    refPinTitle.textContent = data.title || '';
    refPinBody.textContent = data.body || '';
    if (refPinSourceLink) {
      const safeUrl = toSafeExternalUrl(data.url || '');
      if (safeUrl) {
        refPinSourceLink.href = safeUrl;
        refPinSourceLink.style.display = 'inline-flex';
      } else {
        refPinSourceLink.href = '#';
        refPinSourceLink.style.display = 'none';
      }
    }
    refPin.style.display = 'block';
    window.PostIQActiveReference = { ...data, body: String(data.body || '').slice(0, 6000) };
  }
  window.pinReferenceToComposer = pinReferenceToComposer;



  try {
    if (window.Notebook?.init) window.Notebook.init();
  } catch (e) {
    console.error('[PostIQ] Notebook.init() failed:', e);
  }

  // ── TRENDING (PROXY-BASED) ────────────────────────────────────────
// Replaces the direct-fetch trending section in app.js.
// All feeds route through /.netlify/functions/trending to avoid CORS + CSP issues.
// Drop this entire block in place of the existing trending state + initTrending() function.

  const trendingState = {
    src: 'reddit',
    sub: 'socialmedia',
    hn: 'topstories',
    rss: 'buffer-blog',
  };
  const RSS_SOURCES = [
    { id: 'buffer-blog', name: 'Buffer Blog', type: 'rss', url: 'https://buffer.com/resources/feed' },
    { id: 'social-media-today', name: 'Social Media Today', type: 'rss', url: 'https://www.socialmediatoday.com/feeds/news' },
  ];

  // ── Proxy fetch helper ──────────────────────────────────────────
  async function fetchTrendingFeed(params) {
    const res = await fetch('/.netlify/functions/trending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Trending feed returned HTTP ${res.status}`);
    }
    return res.json();
  }

  // ── Time-ago formatter ──────────────────────────────────────────
  function trendingTimeAgo(ageSeconds) {
    const s = Number(ageSeconds || 0);
    if (s < 3600)  return `${Math.max(1, Math.floor(s / 60))}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  // ── Render a list of feed items ─────────────────────────────────
  function renderTrendingItems(containerId, items, sourceType) {
    const list = qs(containerId);
    if (!list) return;
    list.innerHTML = '';

    if (!items || !items.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📈</div>
          <div class="empty-title">Nothing loaded</div>
          <div class="empty-desc">Try refreshing or switching to a different source.</div>
        </div>`;
      return;
    }

    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'trend-card';
      el.style.cssText = `
        display:flex;align-items:flex-start;gap:12px;
        padding:12px 14px;
        background:var(--surface);
        border:1px solid var(--border);
        border-radius:10px;
        transition:border-color .12s;
        margin-bottom:6px;
      `;

      const tagline = item.tagline || item.selftext || '';
      const subLabel = String(item.sub || '').slice(0, 40);
      const scoreLabel = item.score > 0 ? `▲ ${item.score.toLocaleString()}` : '';
      const commentLabel = item.comments > 0 ? `💬 ${item.comments}` : '';
      const ageLabel = item.age ? trendingTimeAgo(item.age) : '';
      const safeSourceUrl = toSafeExternalUrl(item.url || item.permalink || '');

      el.innerHTML = `
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--subtle);width:22px;flex-shrink:0;padding-top:2px;font-weight:600;">${i + 1}</div>
        <div style="flex:1;min-width:0;">
          <div class="trend-card-title" style="font-size:13px;font-weight:500;color:var(--text);line-height:1.4;margin-bottom:${tagline ? '4px' : '5px'};">${safeText(item.title)}</div>
          ${tagline ? `<div style="font-size:11px;color:var(--subtle);line-height:1.5;margin-bottom:5px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${safeText(tagline)}</div>` : ''}
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
            ${scoreLabel ? `<span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--amber);font-weight:700;">${safeText(scoreLabel)}</span>` : ''}
            ${commentLabel ? `<span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);">${safeText(commentLabel)}</span>` : ''}
            ${subLabel ? `<span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--brand);">${safeText(subLabel)}</span>` : ''}
            ${ageLabel ? `<span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);">${safeText(ageLabel)}</span>` : ''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn sm" style="font-size:11px;" data-inspire="${i}">→ Compose from this</button>
            ${safeSourceUrl ? `<a class=\"btn sm ghost\" href=\"${safeText(safeSourceUrl)}\" target=\"_blank\" rel=\"noopener\" style=\"font-size:11px;\">↗ Source</a>` : ''}
            <button class="btn sm ghost" style="font-size:11px;" data-save-notebook="${i}">+ Notebook</button>
          </div>
        </div>`;

      el.querySelector('a')?.addEventListener('click', () => safeTrack(() => GA4_Trending.trendingStoryViewed(sourceType)));
      el.onmouseenter = () => { el.style.borderColor = 'var(--border2)'; };
      el.onmouseleave = () => { el.style.borderColor = 'var(--border)'; };

      el.querySelector('[data-inspire]').onclick = () => {
        safeTrack(() => GA4_Trending.trendingStoryUsedInCompose(sourceType));
        safeTrack(() => GA4_Composer.composerOpened('trending'));
        pinReferenceToComposer({ title: item.title, body: tagline || '', url: safeSourceUrl });
        if (typeof window.activateView === 'function') window.activateView('composerView');
        showToast('Pinned as reference — write your take', 'success');
      };

      const saveBtn = el.querySelector('[data-save-notebook]');
      if (saveBtn) {
        saveBtn.onclick = () => {
          if (window.Notebook?.saveFromTrending) {
            window.Notebook.saveFromTrending({ ...item, source: sourceType });
            safeTrack(() => GA4_Trending.trendingStorySaved(sourceType));
            saveBtn.textContent = '✓ Saved';
            saveBtn.disabled = true;
            if (typeof showToast === 'function') showToast('Saved to Notebook', 'success');
          }
        };
      }
      list.appendChild(el);
    });
  }

  // ── Subreddit pills ─────────────────────────────────────────────
  const DEFAULT_SUBS = ['socialmedia', 'entrepreneur', 'marketing', 'business', 'smallbusiness'];

  function renderSubPills() {
    const wrap = qs('trendingSubPills');
    if (!wrap) return;
    wrap.innerHTML = '';
    DEFAULT_SUBS.forEach(sub => {
      const active = trendingState.sub === sub;
      const btn = document.createElement('button');
      btn.style.cssText = `
        padding:5px 12px;border-radius:20px;border:1px solid ${active ? 'var(--brand-glow)' : 'var(--border2)'};
        font-size:12px;font-family:'DM Mono',monospace;cursor:pointer;transition:all .12s;
        background:${active ? 'var(--brand-dim)' : 'var(--surface)'};
        color:${active ? 'var(--brand)' : 'var(--muted)'};
      `;
      btn.textContent = `r/${sub}`;
      btn.onclick = () => { trendingState.sub = sub; safeTrack(() => GA4_Trending.redditSubredditBrowsed(sub)); renderSubPills(); loadReddit(); };
      wrap.appendChild(btn);
    });
  }

  // ── Reddit ──────────────────────────────────────────────────────
  async function loadReddit() {
    const trendingStartTime = Date.now();
    const statusEl = qs('trendingRedditStatus');
    const listEl   = qs('trendingRedditList');
    if (!statusEl || !listEl) return;

    statusEl.textContent = `Loading r/${trendingState.sub}…`;
    listEl.innerHTML = '';

    try {
      const data = await fetchTrendingFeed({ source: 'reddit', subreddit: trendingState.sub });
      const posts = data.posts || [];
      statusEl.textContent = `${posts.length} posts from r/${data.subreddit || trendingState.sub}`;
      renderTrendingItems('trendingRedditList', posts, 'reddit');
      safeTrack(() => GA4_Trending.trendingStoriesLoaded('reddit', Date.now() - trendingStartTime));
    } catch (err) {
      statusEl.textContent = `Failed to load r/${trendingState.sub} — ${err.message}`;
      renderTrendingItems('trendingRedditList', [], 'reddit');
      safeTrack(() => GA4_Trending.trendingLoadFailed('reddit'));
      safeTrack(() => GA4_System.applicationError(err, 'trending'));
    }
  }

  // ── Hacker News ─────────────────────────────────────────────────
  async function loadHN() {
    const trendingStartTime = Date.now();
    const statusEl = qs('trendingHNStatus');
    const listEl   = qs('trendingHNList');
    if (!statusEl || !listEl) return;

    statusEl.textContent = 'Loading Hacker News…';
    listEl.innerHTML = '';

    try {
      const data = await fetchTrendingFeed({ source: 'hn', feed: trendingState.hn });
      const posts = data.posts || [];
      statusEl.textContent = `${posts.length} stories from Hacker News`;
      renderTrendingItems('trendingHNList', posts, 'hn');
      safeTrack(() => GA4_Trending.trendingStoriesLoaded('hn', Date.now() - trendingStartTime));
    } catch (err) {
      statusEl.textContent = `Failed to load Hacker News — ${err.message}`;
      renderTrendingItems('trendingHNList', [], 'hn');
      safeTrack(() => GA4_Trending.trendingLoadFailed('hn'));
      safeTrack(() => GA4_System.applicationError(err, 'trending'));
    }
  }

  // ── Product Hunt ────────────────────────────────────────────────
  async function loadProductHunt() {
    const trendingStartTime = Date.now();
    const statusEl = qs('trendingPHStatus');
    const listEl   = qs('trendingPHList');
    if (!statusEl || !listEl) return;

    statusEl.textContent = 'Loading Product Hunt…';
    listEl.innerHTML = '';

    try {
      const data = await fetchTrendingFeed({ source: 'producthunt' });
      const posts = data.posts || [];
      statusEl.textContent = `${posts.length} launches from Product Hunt`;
      renderTrendingItems('trendingPHList', posts, 'producthunt');
      safeTrack(() => GA4_Trending.trendingStoriesLoaded('producthunt', Date.now() - trendingStartTime));
    } catch (err) {
      statusEl.textContent = `Failed to load Product Hunt — ${err.message}`;
      renderTrendingItems('trendingPHList', [], 'producthunt');
      safeTrack(() => GA4_Trending.trendingLoadFailed('producthunt'));
      safeTrack(() => GA4_System.applicationError(err, 'trending'));
    }
  }

  async function loadRSS() {
    const trendingStartTime = Date.now();
    const statusEl = qs('trendingRSSStatus');
    const listEl   = qs('trendingRSSList');
    if (!statusEl || !listEl) return;
    const source = RSS_SOURCES.find(s => s.id === trendingState.rss) || RSS_SOURCES[0];
    statusEl.textContent = `Loading ${source.name}…`;
    listEl.innerHTML = '';
    try {
      const data = await fetchTrendingFeed({ source: 'rss', feed: source.id });
      const posts = data.posts || [];
      statusEl.textContent = `${posts.length} stories from ${source.name}`;
      renderTrendingItems('trendingRSSList', posts, 'rss');
      safeTrack(() => GA4_Trending.trendingStoriesLoaded(source.id, Date.now() - trendingStartTime));
    } catch (err) {
      statusEl.textContent = `Failed to load ${source.name} — ${err.message}`;
      renderTrendingItems('trendingRSSList', [], 'rss');
      safeTrack(() => GA4_Trending.trendingLoadFailed(source.id));
      safeTrack(() => GA4_System.applicationError(err, 'trending'));
    }
  }

  // ── initTrending ────────────────────────────────────────────────
  function initTrending() {
    renderSubPills();

    // Source tab switching
    document.querySelectorAll('.trending-src-tab').forEach(tab => {
      tab.onclick = () => {
        // Reset all tab styles
        document.querySelectorAll('.trending-src-tab').forEach(t => {
          t.style.color = 'var(--muted)';
          t.style.borderBottomColor = 'transparent';
        });
        tab.style.color = 'var(--brand)';
        tab.style.borderBottomColor = 'var(--brand)';

        trendingState.src = tab.dataset.tsrc;
        safeTrack(() => GA4_Trending.trendingSourceSwitched(trendingState.src));

        const panels = {
          reddit:       'trendingRedditPanel',
          hn:           'trendingHNPanel',
          producthunt:  'trendingPHPanel',
          rss:          'trendingRSSPanel',
        };
        Object.values(panels).forEach(id => {
          const el = qs(id);
          if (el) el.style.display = 'none';
        });
        const active = panels[trendingState.src];
        if (active) { const el = qs(active); if (el) el.style.display = 'block'; }

        if (trendingState.src === 'hn')           loadHN();
        if (trendingState.src === 'producthunt')  loadProductHunt();
        if (trendingState.src === 'rss')          loadRSS();
      };
    });

    // HN sub-tabs
    document.querySelectorAll('.trending-hn-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.trending-hn-tab').forEach(t => {
          t.style.background    = 'var(--surface)';
          t.style.color         = 'var(--muted)';
          t.style.borderColor   = 'var(--border2)';
        });
        tab.style.background  = 'var(--brand-dim)';
        tab.style.color       = 'var(--brand)';
        tab.style.borderColor = 'var(--brand-glow)';
        trendingState.hn = tab.dataset.hn;
        loadHN();
      };
    });
    document.querySelectorAll('[data-rss-feed]').forEach(btn => {
      btn.onclick = () => {
        trendingState.rss = btn.dataset.rssFeed;
        document.querySelectorAll('[data-rss-feed]').forEach(b => b.className = 'btn sm ghost');
        btn.className = 'btn sm';
        loadRSS();
      };
    });

    // Custom subreddit input
    const goSub = qs('trendingGoSub');
    const customSub = qs('trendingCustomSub');
    if (goSub && customSub) {
      goSub.onclick = () => {
        const val = customSub.value.trim().replace(/^r\//i, '').replace(/[^a-zA-Z0-9_]/g, '');
        if (!val) return;
        if (!DEFAULT_SUBS.includes(val)) DEFAULT_SUBS.push(val);
        trendingState.sub = val;
        renderSubPills();
        loadReddit();
        customSub.value = '';
      };
      customSub.addEventListener('keydown', e => { if (e.key === 'Enter') goSub.click(); });
    }

    // Refresh buttons
    const refreshHandlers = {
      trendingRefreshBtn:     () => { if (trendingState.src === 'reddit') loadReddit(); else if (trendingState.src === 'hn') loadHN(); else loadProductHunt(); },
      trendingRefreshMob:     () => { if (trendingState.src === 'reddit') loadReddit(); else if (trendingState.src === 'hn') loadHN(); else loadProductHunt(); },
      trendingRefreshReddit:  () => loadReddit(),
      trendingRefreshHN:      () => loadHN(),
      trendingRefreshPH:      () => loadProductHunt(),
      trendingRefreshRSS:     () => loadRSS(),
    };
    Object.entries(refreshHandlers).forEach(([id, handler]) => {
      const btn = qs(id);
      if (btn) btn.onclick = handler;
    });

    // Load Reddit on init
    loadReddit();
  }

  try {
    initTrending();
  } catch (e) {
    console.error('[PostIQ] initTrending() failed:', e);
  }
}
