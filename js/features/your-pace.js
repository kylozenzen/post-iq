'use strict';
// A view over the existing planning settings and shared coverage model. No Buffer writes.
window.YourPace = (() => {
  const C=window.PostIQCoverage;
  const el=id=>document.getElementById(id);
  let initialized=false;
  const today=()=>C.dayKey(new Date());
  const channelName=id=>state.channels.find(channel=>String(channel.id)===String(id))?.displayName || state.channels.find(channel=>String(channel.id)===String(id))?.name || id;
  function message(text) { el('paceStatus').textContent=text; }
  function validDate(key) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return false;
    const date=new Date(key+'T12:00:00Z');
    return Number.isFinite(+date) && date.toISOString().slice(0,10)===key;
  }
  function period(futureOnly=false) {
    const start=el('paceStart').value, end=el('paceEnd').value;
    const days=Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000)+1;
    if(!validDate(start) || !validDate(end) || days<1 || days>92) throw new Error('Choose a valid period of 1–92 days.');
    if(futureOnly && start<today()) throw new Error('Future planning changes must start today or later.');
    return {start,end,days};
  }
  function target(id) {
    const raw=el(id).value;
    if(raw==='' || !Number.isInteger(Number(raw)) || Number(raw)<0 || Number(raw)>10) throw new Error('Choose a whole-number target from 0 to 10 posts per selected day.');
    return Number(raw);
  }
  function selectedChannel() {
    const id=el('paceChannel').value;
    if(!id) throw new Error('Connect Buffer and sync to load a channel first.');
    return id;
  }
  function save(settings,text) {
    try {
      setPlanningSettings(settings);
      renderPlanningSettings(); renderCalendar();
      window.PostIQPlanHealth?.render();
      refresh(true); message(text+' Existing Buffer posts have not changed.');
    } catch(error) { message('Planning changes could not be saved: '+error.message); }
  }
  function saveRhythm() {
    try {
      const id=selectedChannel(), settings=getPlanningSettings();
      const days=[...el('paceDays').querySelectorAll('input:checked')].map(input=>input.value);
      save({...settings,channelPostingDays:{...settings.channelPostingDays,[id]:days},channelTargets:{...settings.channelTargets,[id]:target('paceTarget')}},'Rhythm saved.');
    } catch(error) {message(error.message);}
  }
  function savePeriodTarget() {
    try {
      const id=selectedChannel(), dates=period(true), settings=getPlanningSettings();
      const entry={id:'target_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),channelId:id,start:dates.start,end:dates.end,target:target('pacePeriodTarget')};
      save({...settings,targetOverrides:[...(settings.targetOverrides || []),entry]},'Future period target saved.');
    } catch(error) {message(error.message);}
  }
  function saveDaysOff() {
    try {
      const dates=period(true), settings=getPlanningSettings();
      const id=el('paceOffScope').value==='*'?'*':selectedChannel();
      const entry={id:'off_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),channelId:id,start:dates.start,end:dates.end};
      save({...settings,daysOff:[...(settings.daysOff || []),entry]},'Intentional days off saved.');
    } catch(error) {message(error.message);}
  }
  function loadRhythm() {
    const settings=getPlanningSettings(), id=el('paceChannel').value;
    const days=settings.channelPostingDays?.[id] ?? settings.postingDays;
    el('paceDays').innerHTML=DAY_CODES.map((code,index)=>`<label><input type="checkbox" value="${code}" ${!id?'disabled':''} ${days.includes(code)?'checked':''}>${DAY_LABELS[index].slice(0,3)}</label>`).join('');
    el('paceTarget').value=Number.isInteger(settings.channelTargets?.[id])?settings.channelTargets[id]:1;
  }
  function renderExceptions() {
    const settings=getPlanningSettings(), mount=el('paceExceptions');
    mount.innerHTML='<h3>Saved planning changes</h3>';
    let count=0;
    for(const kind of ['daysOff','targetOverrides']) {
      (settings[kind] || []).forEach((entry,index)=>{
        const row=document.createElement('div'); row.className='pace-exception';
        const label=document.createElement('span');
        label.textContent=`${entry.channelId==='*'?'All channels':channelName(entry.channelId)} · ${entry.start}–${entry.end} · ${kind==='daysOff'?'intentional days off':entry.target+' posts per selected day'}`;
        const button=document.createElement('button');button.className='btn sm ghost';button.type='button';button.textContent='Remove';button.setAttribute('aria-label','Remove '+label.textContent);
        button.onclick=()=>{const next=getPlanningSettings();next[kind]=(next[kind]||[]).filter((item,i)=>entry.id?item.id!==entry.id:i!==index);save(next,'Planning change removed.');};
        row.append(label,button);mount.appendChild(row);count++;
      });
    }
    mount.hidden=count===0;
  }
  function check() {
    try {
      const dates=period(), settings=getPlanningSettings();
      const connection=getBufferConnectionState();
      const meta=state.scheduledCoverage?{...state.scheduledCoverage,complete:state.scheduledCoverage.complete && state.syncState!=='failed'}:undefined;
      const result=C.calculate({posts:state.scheduled,channels:state.channels,settings,now:dates.start,days:dates.days,connected:connection.connected,meta});
      const summary=C.summarize(result);
      el('paceCoverageSummary').textContent=!state.channels.length?'No channels loaded. Connect Buffer and sync to check your rhythm.'
        : !summary.planned?'No posting slots are planned in this period. Days off and non-posting days are excluded.'
        : summary.fullyCovered?`All ${summary.planned} planned slots are covered by confirmed scheduled posts.`
        : `${summary.covered} of ${summary.planned} planned slots have loaded scheduled posts. ${summary.uncovered} ${summary.complete?'uncovered':'not confirmed from the available data'}.`;
      const checkedAt=new Date().toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',timeZone:result.timezone});
      el('paceCoverageMeta').textContent=`${result.timezone} · checked ${checkedAt}`;
      el('paceDataNote').textContent=(!connection.connected?'Buffer is disconnected; coverage cannot be verified.'
        :result.stale?'Queue data is stale. Sync before relying on this check.'
        :!result.complete?'Queue data is incomplete or the last sync failed. This is a limited check, not a fully covered result.'
        :'All scheduled pages are loaded and fresh. Counts are calculated separately for each channel and posting date.');
      const list=el('paceSlots');list.innerHTML='';
      result.rows.filter(row=>row.target>0 && row.missingCount>0).forEach(row=>{
        const item=document.createElement('li'), copy=document.createElement('span'), button=document.createElement('button');
        copy.textContent=`${channelName(row.channelId)} · ${row.date} · ${row.missingCount} slot${row.missingCount===1?'':'s'} ${result.complete?'uncovered':'not confirmed'} (${row.confirmedCount}/${row.target} loaded)`;
        button.type='button';button.className='btn sm';button.textContent='Plan this slot';
        button.setAttribute('aria-label',`Plan ${row.date} for ${channelName(row.channelId)}`);
        button.onclick=()=>planSlot(row.channelId,row.date);
        item.append(copy,button);list.appendChild(item);
      });
      return {result,summary};
    } catch(error) {message(error.message);el('paceCoverageSummary').textContent='Coverage could not be checked for this period.';el('paceDataNote').textContent='';el('paceCoverageMeta').textContent='';el('paceSlots').innerHTML='';return null;}
  }
  function planSlot(channelId,date) {
    if(!workspacePreferences.planning || !isFeatureEnabled('calendar')) {message('Enable the Planning workspace to open this calendar slot.');return;}
    state.calendarChannel=String(channelId);state.month=new Date(date+'T12:00:00');state.calendarFilter='all';
    setContentCalendarMode('posts');activateView('calendarView','pace_slot');renderCalendar();
    const day=[...document.querySelectorAll('[data-calendar-date]')].find(node=>node.dataset.calendarDate===date && node.getClientRects().length);
    const focus=day || el('calendarAddBtn');focus.scrollIntoView?.({block:'center'});focus.focus({preventScroll:true});
    window.CalendarExperience.add(date);
  }
  function refresh(forceRhythm=false) {
    if(!initialized) return;
    const select=el('paceChannel'), previous=select.value;
    select.innerHTML=(state.channels.length?'':'<option value="">No channels loaded</option>')+(state.channels || []).map(channel=>`<option value="${safeText(channel.id)}">${safeText(channel.displayName || channel.name || channel.id)}</option>`).join('');
    if([...select.options].some(option=>option.value===previous))select.value=previous;
    for(const id of ['paceSave','pacePeriodSave','paceChannel','paceTarget','pacePeriodTarget']) el(id).disabled=!select.value;
    el('paceChannelHint').hidden=!!select.value;
    el('paceOffScope').querySelector('[value="selected"]').disabled=!select.value;
    if(forceRhythm || select.value!==previous)loadRhythm();
    renderExceptions();check();
  }
  function init() {
    if(initialized || !el('yourPace')) return;
    initialized=true;
    el('paceStart').value=today();el('paceEnd').value=C.addDays(today(),13);
    el('paceCheck').onclick=()=>check();el('paceChannel').onchange=loadRhythm;
    for(const id of ['paceStart','paceEnd']) el(id).addEventListener('input',()=>{el('paceCoverageSummary').textContent='Dates changed. Check this period to refresh coverage.';el('paceDataNote').textContent='';el('paceCoverageMeta').textContent='';el('paceSlots').innerHTML='';});
    el('paceSave').onclick=saveRhythm;el('pacePeriodSave').onclick=savePeriodTarget;el('paceOffSave').onclick=saveDaysOff;
    window.addEventListener('postiq:synced',()=>refresh());
    window.addEventListener('postiq:scheduled-updated',()=>check());
    window.addEventListener('postiq:planning-changed',()=>refresh(true));
    refresh(true);
  }
  return {init,refresh,check,planSlot};
})();
