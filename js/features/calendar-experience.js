'use strict';
// Presentation and context only. Notes, content items and Buffer posts keep their owners.
window.CalendarExperience = (() => {
  const CONTEXT_KEY = 'postiq_calendar_context_v2';
  let context = null, returnFocus = new Map(), initialized = false;
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
    if (window.scrollTo && context?.windowScroll) window.scrollTo(0,context.windowScroll);
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
      : 'Buffer posts are confirmed. Notes, tasks and target dates are local plans, not scheduled posts.';
  }
  function renderChannelFilter() {
    const select=qs('calendarChannelFilter'); if(!select) return;
    const value=state.calendarChannel || '';
    select.innerHTML='<option value="">All channels</option>'+(state.channels || []).map(c=>`<option value="${safeText(c.id)}">${safeText(c.displayName || c.name || c.id)}</option>`).join('');
    if(value && ![...select.options].some(o=>o.value===value)) {
      const option=document.createElement('option'); option.value=value; option.textContent='Selected channel (not loaded)'; select.appendChild(option);
    }
    select.value=value;
  }
  function updateHealthToggle() {
    const button=qs('calendarHealthToggle'); if(!button) return;
    button.setAttribute('aria-controls',narrow()?'calendarHealthSheet':'calendarInsights');
    button.setAttribute('aria-expanded',String(narrow()?qs('calendarHealthSheet').classList.contains('open'):!qs('calendarInsights').hidden));
  }
  function showHealth() {
    if(narrow()) {
      qs('calendarInsights').hidden=false;
      qs('calendarHealthSheetBody').appendChild(qs('calendarInsights'));
      openModal('calendarHealthSheet');
    } else {
      const visible=qs('calendarInsights').hidden;
      qs('calendarInsights').hidden=!visible;
      qs('calendarHealthToggle').setAttribute('aria-expanded',String(visible));
      document.querySelector('.calendar-layout').classList.toggle('insights-collapsed',!visible);
      localStorage.setItem('postiq_calendar_insights',visible?'open':'closed');
    }
    updateHealthToggle();
  }
  function compose(date=selectedKey(), channel=state.calendarChannel || '') {
    if(!workspacePreferences.create || !isFeatureEnabled('composer')) { showToast('Enable the Create workspace to start a draft.','error'); return; }
    remember(date);
    document.querySelectorAll('.calendar-drawer.open').forEach(modal=>closeModal(modal.id));
    activateView('composerView','calendar_quick_add');
    const select=qs('composerChannel'); if(channel && [...select.options].some(o=>o.value===channel)) select.value=channel;
    const banner=qs('composerCalendarContext'); banner.hidden=false;
    qs('composerCalendarDate').textContent=`Planning for ${formatDateOnly(date)}${channel ? ' · '+(state.channels.find(c=>String(c.id)===channel)?.displayName || channel) : ''}. This is a draft; choose Queue or Schedule explicitly to send to Buffer.`;
    banner.dataset.date=date;
    updateComposerButtonStates();
    qs('composerEditor').focus({preventScroll:true});
  }
  function add(date=selectedKey()) {
    remember(date);
    openCalendarDayDetails(new Date(date+'T12:00:00'));
  }
  function onOpen(id) {
    const modal=qs(id); if(!modal?.classList.contains('calendar-drawer')) return;
    if(!returnFocus.has(id)) returnFocus.set(id,document.activeElement);
    modal.querySelector('.modal-card')?.setAttribute('tabindex','-1');
    (modal.querySelector('button, input, textarea, [tabindex="0"]') || modal.querySelector('.modal-card'))?.focus({preventScroll:true});
  }
  function onClose(id) {
    if(!qs(id)?.classList.contains('calendar-drawer')) return;
    if(id==='contentDetailDrawer') window.ContentDetail?.restoreCalendarDrawer?.();
    if(id==='calendarHealthSheet') { document.querySelector('.calendar-layout')?.appendChild(qs('calendarInsights')); qs('calendarInsights').hidden=localStorage.getItem('postiq_calendar_insights')==='closed'; }
    const target=returnFocus.get(id); returnFocus.delete(id);
    const fallback=context?.selected && [...document.querySelectorAll(`[data-calendar-date="${context.selected}"]`)].find(day=>day.getClientRects().length);
    if(target?.isConnected) target.focus({preventScroll:true});
    else (fallback || qs('calendarAddBtn'))?.focus({preventScroll:true});
    if(qs(id)?.classList.contains('calendar-drawer')) restoreScroll();
    updateHealthToggle();
  }
  function init() {
    if(initialized || !qs('calendarView') || new URLSearchParams(location.search).has('approve') || location.hash.startsWith('#share=')) return;
    initialized=true; restore(); renderCalendar(); renderChannelFilter(); status();
    const insights=qs('calendarInsights');
    if(localStorage.getItem('postiq_calendar_insights')==='closed' && !narrow()) { insights.hidden=true; document.querySelector('.calendar-layout').classList.add('insights-collapsed'); qs('calendarHealthToggle').setAttribute('aria-expanded','false'); }
    updateHealthToggle();
    qs('calendarHealthToggle').onclick=showHealth;
    qs('calendarHealthClose').onclick=()=>{ if(qs('calendarHealthSheet').classList.contains('open')) closeModal('calendarHealthSheet'); else showHealth(); };
    qs('calendarHealthSheet').querySelector('[data-close-modal]').onclick=()=>closeModal('calendarHealthSheet');
    qs('calendarViewAgendaBtn').onclick=()=>setCalendarView('agenda');
    qs('calendarChannelFilter').onchange=e=>{state.calendarChannel=e.target.value;remember();renderCalendar();};
    qs('calendarAddBtn').onclick=()=>add();
    qs('calendarFilter').addEventListener('change',()=>remember());
    const banner=document.createElement('div'); banner.id='composerCalendarContext'; banner.hidden=true;
    banner.innerHTML='<span id="composerCalendarDate"></span><button type="button" class="btn sm" id="composerReturnCalendar">Back to Calendar</button><button type="button" class="btn sm ghost" id="composerUseCalendarDate">Use date in schedule picker</button>';
    qs('composerView').prepend(banner);
    qs('composerReturnCalendar').onclick=()=>{activateView('calendarView','calendar_return');restoreScroll();};
    qs('composerUseCalendarDate').onclick=()=>{qs('scheduleDate').value=banner.dataset.date; qs('schedulePanel').classList.add('open'); syncComposerWhen();};
    document.addEventListener('keydown',event=>{
      const modal=getTopOpenModal();
      if(!modal?.classList.contains('calendar-drawer')) return;
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
    window.addEventListener('resize',()=>{updateCalendarViewUI();updateHealthToggle();});
    qs('calendarView').addEventListener('click',event=>{
      const cell=event.target.closest('[data-calendar-date]'); if(cell) remember(cell.dataset.calendarDate);
    },true);
    restoreScroll();
  }
  return {init,remember,compose,add,onOpen,onClose,status,renderChannelFilter,narrow,highlight};
})();
