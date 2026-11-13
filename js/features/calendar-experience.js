'use strict';
// Presentation and context only. Notes, content items and Buffer posts keep their owners.
window.CalendarExperience = (() => {
  const CONTEXT_KEY = 'postiq_calendar_context_v2';
  let context = null, returnFocus = new Map(), bankScroll = null, initialized = false;
  const narrow = () => window.matchMedia?.('(max-width: 768px)').matches || false;
  const selectedKey = () => context?.selected || fmtDate(state.month);
  function remember(date) {
    context = { ...(context || {}), selected:date || context?.selected || fmtDate(state.month), month:fmtDate(state.month),
      view:state.calendarView, channel:state.calendarChannel || '', filter:state.calendarFilter,
      mainScroll:document.querySelector('.main')?.scrollTop || 0, windowScroll:window.scrollY || 0 };
    try { sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context)); } catch {}
    highlight();
  }
  function highlight() {
    document.querySelectorAll('[data-calendar-date]').forEach(day=>day.classList.toggle('is-selected',day.dataset.calendarDate===context?.selected));
  }
  function restoreScroll() {
    const main = document.querySelector('.main');
    if (main) main.scrollTop = context?.mainScroll || 0;
    if (window.scrollTo && Number.isFinite(context?.windowScroll) && window.scrollY!==context.windowScroll) window.scrollTo(0,context.windowScroll);
  }
  function restore() {
    try { context = JSON.parse(sessionStorage.getItem(CONTEXT_KEY) || 'null'); } catch {}
    if (!context) return;
    if (/^\d{4}-\d{2}-\d{2}$/.test(context.month || '')) state.month = new Date(context.month+'T12:00:00');
    if (['month','week','agenda'].includes(context.view)) state.calendarView=context.view;
    if (typeof context.channel==='string') state.calendarChannel=context.channel;
    if (typeof context.filter==='string') state.calendarFilter=context.filter;
  }
  function status() {
    const el=qs('calendarState'); if(!el) return;
    const connection=getBufferConnectionState();
    if(qs('calEmptyHint') && (state.scheduled.length || state.published.length)) qs('calEmptyHint').style.display='none';
    el.textContent = state.syncState==='syncing' ? 'Loading Buffer posts. Your local notes and drafts are safe.'
      : !connection.connected ? (connection.reconnectNeeded ? 'Reconnect Buffer to refresh your plan. Saved context and local notes are retained.' : 'Connect Buffer to see confirmed posts. You can still add notes and plan drafts.')
      : state.syncState==='failed' ? 'Sync failed. Showing the last loaded posts; missing dates are not confirmed gaps.'
      : !state.scheduledCoverage?.complete ? 'Partial or unrefreshed Buffer data. Unloaded dates are unknown, not empty.'
      : Date.now()-state.scheduledCoverage.ts>15*60*1000 ? 'Stale Buffer data. Sync before making decisions about gaps.'
      : '';
    el.hidden=!el.textContent;
  }
  function updateFilterSummary() {
    const summary=qs('calendarFilterSummary');if(!summary)return;
    const count=Number(!!state.calendarChannel)+Number(isContentCalendarMode() || (state.calendarFilter || 'all')!=='all');
    const described=`${qs('calendarChannelFilter')?.selectedOptions[0]?.textContent || 'All channels'} · ${qs('calendarFilter')?.selectedOptions[0]?.textContent || 'All items'}`;
    // Filters live in the ⋯ menu; when one is on, say so in the toolbar so an emptier calendar never looks like lost posts.
    const dot=summary.querySelector('.cal-more-dot'); if(dot) dot.hidden=!count;
    summary.setAttribute('aria-label',count?`More calendar options (${count} filter${count===1?'':'s'} on)`:'More calendar options');
    summary.title=count?described:'More';
    const chip=qs('calFilterChip'); if(chip){chip.hidden=!count; chip.title=described;}
  }
  function renderChannelFilter() {
    const select=qs('calendarChannelFilter'); if(!select) return;
    const value=state.calendarChannel || '';
    select.innerHTML='<option value="">All channels</option>'+(state.channels || []).map(c=>`<option value="${safeText(c.id)}">${safeText(c.displayName || c.name || c.id)}</option>`).join('');
    if(value && ![...select.options].some(o=>o.value===value)) {
      const option=document.createElement('option'); option.value=value; option.textContent='Selected channel (not loaded)'; select.appendChild(option);
    }
    select.value=value;
    updateFilterSummary();
  }
  function compose(date=selectedKey(), channel=state.calendarChannel || '') {
    if(!workspacePreferences.create || !isFeatureEnabled('composer')) { showToast('Enable the Create workspace to start a draft.','error'); return; }
    remember(date);
    document.querySelectorAll('.calendar-drawer.open').forEach(modal=>closeModal(modal.id));
    activateView('composerView','calendar_quick_add');
    const select=qs('composerChannel'); if(channel && [...select.options].some(o=>o.value===channel)) select.value=channel;
    const chosen=channel || select.value;
    const ch=(state.channels || []).find(c=>String(c.id)===String(channel));
    const chName=ch ? (window.PostIQChannelIcons?.plainName?.(ch) || ch.displayName || ch.name) : '';
    // Point the schedule picker at the day you came from, at the channel's
    // usual time, so Schedule lands the post where the gap was.
    const set=prefillSchedule(date, chosen);
    const banner=qs('composerCalendarContext'); banner.hidden=false;
    qs('composerCalendarDate').textContent=`Writing for ${formatDateOnly(date)}${chName ? ' · '+chName : ''}. ${set ? 'The schedule is set to that day; nothing goes to Buffer until you press Schedule.' : 'That day has passed, so pick a new date before you schedule.'}`;
    banner.dataset.date=date;
    updateComposerButtonStates();
    qs('composerEditor').focus({preventScroll:true});
  }
  function prefillSchedule(date, channelId) {
    const dateEl=qs('scheduleDate'), hourEl=qs('scheduleHour'), minEl=qs('scheduleMin'), ampmEl=qs('scheduleAmpm');
    if(!dateEl || !hourEl || !minEl || !ampmEl || !date || date < fmtDate(new Date())) return false;
    const T=window.PostIQToday;
    let when=channelId && T?.slotTime ? T.slotTime(date, channelId) : null;
    if(!when) {
      const usual=channelId && T?.usualTime ? T.usualTime(channelId) : { h: 9, m: 0 };
      when=new Date(date+'T00:00:00'); when.setHours(usual.h, usual.m, 0, 0);
      if(when < new Date(Date.now()+20*60*1000)) return false;
    }
    dateEl.value=date;
    const h=when.getHours(), m=when.getMinutes();
    hourEl.value=String((h % 12) || 12);
    const mins=[...minEl.options].map(o=>Number(o.value));
    const nearest=mins.reduce((best, v)=>Math.abs(v-m) < Math.abs(best-m) ? v : best, mins[0] ?? 0);
    minEl.value=String(nearest);
    ampmEl.value=h >= 12 ? 'PM' : 'AM';
    qs('schedulePanel')?.classList.add('open');
    const toggle=qs('composerScheduleToggle'); if(toggle) toggle.style.display='none';
    syncComposerWhen();
    return true;
  }
  function clearComposeContext() {
    const banner=qs('composerCalendarContext'); if(!banner) return;
    banner.hidden=true; delete banner.dataset.date;
  }
  function add(date=selectedKey()) {
    remember(date);
    openCalendarDayDetails(new Date(date+'T12:00:00'));
  }
  function onOpen(id) {
    const modal=qs(id); if(!modal || (!modal.classList.contains('calendar-drawer') && modal.id !== 'settingsModal')) return;
    if(!returnFocus.has(id)) returnFocus.set(id,document.activeElement);
    if(id==='contentBankPlanModal') bankScroll={main:document.querySelector('.main')?.scrollTop || 0,window:window.scrollY || 0};
    modal.querySelector('.modal-card')?.setAttribute('tabindex','-1');
    (modal.querySelector('button, input, textarea, [tabindex="0"]') || modal.querySelector('.modal-card'))?.focus({preventScroll:true});
  }
  function onClose(id) {
    if(!qs(id)?.classList.contains('calendar-drawer') && id !== 'settingsModal') return;
    if(id==='contentDetailDrawer') window.ContentDetail?.restoreCalendarDrawer?.();
    const target=returnFocus.get(id); returnFocus.delete(id);
    if(id==='contentBankPlanModal') {
      const replacement=[...document.querySelectorAll('[data-content-plan]')].find(button=>button.dataset.contentPlan===qs(id).dataset.contentId);
      (target?.isConnected?target:replacement || qs('contentBankSearch'))?.focus({preventScroll:true});
      if(bankScroll) {document.querySelector('.main').scrollTop=bankScroll.main;if(window.scrollY!==bankScroll.window)window.scrollTo(0,bankScroll.window);}
      return;
    }
    const fallback=context?.selected && [...document.querySelectorAll(`[data-calendar-date="${context.selected}"]`)].find(day=>day.getClientRects().length);
    if(target?.isConnected) target.focus({preventScroll:true});
    else (fallback || qs('calendarAddBtn'))?.focus({preventScroll:true});
    if(qs(id)?.classList.contains('calendar-drawer')) restoreScroll();
  }
  function init() {
    if(initialized || !qs('calendarView') || new URLSearchParams(location.search).has('approve') || location.hash.startsWith('#share=')) return;
    initialized=true; restore(); renderCalendar(); renderChannelFilter(); status();
    { const qh=qs('queueHealthSync'); if(qh) qh.onclick=()=>getBufferConnectionState().connected ? syncBuffer({force:true}) : goToBufferConnect(); }
    qs('calendarViewAgendaBtn').onclick=()=>setCalendarView('agenda');
    qs('calendarChannelFilter').onchange=e=>{state.calendarChannel=e.target.value;remember();renderCalendar();};
    qs('calendarAddBtn').onclick=()=>add();
    qs('calendarFilter').addEventListener('change',()=>{remember();updateFilterSummary();});
    const resetFilters=()=>{state.calendarChannel='';state.calendarFilter='all';const sel=qs('calendarFilter');if(sel)sel.value='all';setContentCalendarMode('posts');renderChannelFilter();renderCalendar();remember();updateFilterSummary();};
    qs('calendarFiltersReset').onclick=resetFilters;
    qs('calFilterChip')?.addEventListener('click',resetFilters);
    // Menu actions close the menu; the selects and Show toggle keep it open so you can adjust several at once.
    qs('calendarFilters').querySelectorAll('.more-item').forEach(item=>item.addEventListener('click',()=>{qs('calendarFilters').open=false;}));
    document.addEventListener('click',event=>{if(!qs('calendarFilters').contains(event.target))qs('calendarFilters').open=false;});
    qs('calendarFilters').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();qs('calendarFilters').open=false;qs('calendarFilterSummary').focus();}});
    const banner=document.createElement('div'); banner.id='composerCalendarContext'; banner.hidden=true;
    banner.innerHTML='<span id="composerCalendarDate"></span><button type="button" class="btn sm" id="composerReturnCalendar">Back to Calendar</button><button type="button" class="btn sm ghost" id="composerDismissCalendarDate" aria-label="Stop writing for this date">Not for this day</button>';
    qs('composerView').prepend(banner);
    qs('composerReturnCalendar').onclick=()=>{activateView('calendarView','calendar_return');restoreScroll();};
    qs('composerDismissCalendarDate').onclick=()=>clearComposeContext();
    document.addEventListener('keydown',event=>{
      const modal=getTopOpenModal();
      if(!modal || (!modal.classList.contains('calendar-drawer') && modal.id !== 'settingsModal')) return;
      if(event.key==='Escape') {event.preventDefault();event.stopImmediatePropagation();closeModal(modal.id);return;}
      if(event.key!=='Tab') return;
      const focusable=[...modal.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el=>!el.disabled && !el.hidden && el.getAttribute('aria-hidden')!=='true' && el.getClientRects().length);
      if(!focusable.length){event.preventDefault();modal.querySelector('.modal-card')?.focus();return;}
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey && (document.activeElement===first || !modal.contains(document.activeElement))) {event.preventDefault();last.focus();}
      else if(!event.shiftKey && (document.activeElement===last || !modal.contains(document.activeElement))) {event.preventDefault();first.focus();}
    },true);
    window.addEventListener('postiq:view-changed',event=>{
      if(event.detail.viewId!=='calendarView' && qs('contentDetailDrawer')?.classList.contains('open')) closeModal('contentDetailDrawer');
      if(event.detail.viewId==='calendarView') restoreScroll();
    });
    window.addEventListener('postiq:synced',()=>{renderChannelFilter();status();});
    window.addEventListener('resize',()=>{updateCalendarViewUI();});
    qs('calendarView').addEventListener('click',event=>{
      const cell=event.target.closest('[data-calendar-date]'); if(cell) remember(cell.dataset.calendarDate);
    },true);
    restoreScroll();
  }
  return {init,remember,compose,clearComposeContext,prefillSchedule,add,onOpen,onClose,status,renderChannelFilter,narrow,highlight,updateFilterSummary};
})();
