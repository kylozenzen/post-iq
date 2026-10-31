const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadApp}=require('../scripts/smoke-browser');
async function withApp(search,fn,setup){const dom=await loadApp(search,setup);try{await fn(dom.window);}finally{dom.window.close();}}
test('normal entry, explicit destinations and disabled Planning preferences',async()=>{
 await withApp('',w=>assert.ok(w.document.querySelector('#calendarView.active')));
 await withApp('?view=composerView&connected=buffer',w=>assert.ok(w.document.querySelector('#composerView.active')));
 await withApp('?view=queueHealthView',w=>assert.ok(w.document.querySelector('#queueHealthView.active')));
 await withApp('?view=not-a-view',w=>assert.ok(w.document.querySelector('#calendarView.active')));
 await withApp('',w=>assert.ok(w.document.querySelector('#composerView.active')),w=>w.localStorage.setItem('postiq.workspacePreferences',JSON.stringify({planning:false,create:true,ideas:true,approvals:true})));
});
test('Agenda exact selection, draft date/channel and return preserve context',async()=>withApp('',w=>{
 const d=w.document;
 w.eval(`state.channels=[{id:'a',displayName:'A',service:'instagram'},{id:'b',displayName:'B',service:'linkedin'}];renderChannelSelects(); state.calendarChannel='b';setCalendarView('agenda'); state.scheduled=[{id:'a-post',text:'Wrong channel',channelId:'a',dueAt:new Date().toISOString()},{id:'b-post',text:'Selected channel post',channelId:'b',dueAt:new Date().toISOString()}];renderCalendar();`);
 assert.equal(d.querySelectorAll('#calAgenda [data-post-id="a-post"]').length,0);
 const post=d.querySelector('#calAgenda [data-post-id="b-post"]');assert.ok(post);post.focus();post.click();
 assert.match(d.querySelector('#sharedDayBody').textContent,/Selected channel post/);
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(d.querySelector('#sharedDayModal').classList.contains('open'),false);
 assert.equal(d.activeElement,post);
 const priorSchedule=d.querySelector('#composerWhen').value;
 d.querySelector('#calendarAddBtn').click();d.querySelector('[data-start-draft]').click();
 assert.ok(d.querySelector('#composerView.active'));assert.equal(d.querySelector('#composerChannel').value,'b');
 assert.equal(d.querySelector('#composerWhen').value,priorSchedule); // selected date never silently schedules
 d.querySelector('#composerReturnCalendar').click();
 assert.ok(d.querySelector('#calendarView.active'));assert.equal(w.eval('state.calendarView'),'agenda');assert.equal(w.eval('state.calendarChannel'),'b');
 assert.equal(d.querySelectorAll('#calAgenda > [data-calendar-date]').length,7);
}));
test('mobile keeps Agenda preference and Queue Health is a separate tool',async()=>withApp('',w=>{
 w.matchMedia=()=>({matches:true}); w.eval("setCalendarView('week')");
 assert.ok(w.document.querySelector('#calendarView.is-agenda-view'));
 assert.equal(w.localStorage.getItem('postiq_calendar_view'),'week');
 assert.equal(w.document.querySelector('#calendarView #planHealthStrip'),null);
 assert.equal(w.document.querySelector('#calendarHealthToggle'),null);
 w.document.querySelector('#mobDrawer [data-view="queueHealthView"]').click();
 assert.ok(w.document.querySelector('#queueHealthView.active'));
 assert.ok(w.document.querySelector('#queueHealthView #planHealthStrip'));
 w.eval("activateView('calendarView')");assert.equal(w.eval('state.calendarView'),'week');
}));
test('saved calendar view/filter/date is restored after OAuth return',async()=>withApp('?connected=buffer&view=calendarView',w=>{
 assert.equal(w.eval('state.calendarView'),'week');assert.equal(w.eval('state.calendarFilter'),'notes');assert.equal(w.eval('fmtDate(state.month)'),'2026-10-20');
 assert.ok(w.document.querySelector('#calendarView.active'));
},w=>w.sessionStorage.setItem('postiq_calendar_context_v2',JSON.stringify({month:'2026-10-20',selected:'2026-10-22',view:'week',filter:'notes',channel:''}))));
test('target dates open existing content editor in drawer and return focus',async()=>withApp('',w=>{
 const d=w.document;
 const target={id:'target-1',title:'Unscheduled launch idea',sourceText:'An idea that is still a plan',targetDate:w.eval('fmtDate(new Date())'),variants:[]};
 const oldGet=w.Notebook.getCards,oldCard=w.Notebook.getCard;
 w.Notebook.getCards=()=>[target];w.Notebook.getCard=id=>id===target.id?target:oldCard(id);
 try{
   w.eval('renderCalendar()');
   const pill=d.querySelector('#calGrid [data-calendar-content="target-1"]');assert.ok(pill);assert.match(pill.textContent,/Target · not scheduled/);
   pill.focus();pill.click();assert.ok(d.querySelector('#contentDetailDrawer.open'));
   assert.ok(d.querySelector('#contentDetailDrawer #contentDetailView'));assert.ok(d.querySelector('#calendarView.active'));
   d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
   assert.equal(d.querySelector('#contentDetailView').parentElement.tagName,'MAIN');assert.equal(d.activeElement,pill);
 }finally{w.Notebook.getCards=oldGet;w.Notebook.getCard=oldCard;}
}));
test('notes retain literal dates and planned actions can be completed in drawer',async()=>withApp('',w=>{
 const d=w.document;
 w.eval("addNoteForDateKey('2026-11-01','Review draft','action');state.month=new Date('2026-11-01T12:00:00');renderCalendar();openEditNoteForDate(new Date('2026-11-01T12:00:00'),getNotesForDate('2026-11-01')[0].id)");
 assert.ok(d.querySelector('#noteModal.open'));assert.equal(d.querySelector('#calendarNoteDone').hidden,false);
 d.querySelector('#calendarNoteDone').click();assert.ok(w.eval("getNotesForDate('2026-11-01')[0].completedAt"));
 assert.match(d.querySelector('#noteCompletionStatus').textContent,/Done/);
 assert.match(d.querySelector('#calGrid .day-note-pill.is-done').textContent,/Done/);
 assert.match(d.querySelector('#calWeek .day-note-pill.is-done').textContent,/Done/);
 assert.match(d.querySelector('#calAgenda .day-note-pill.is-done').textContent,/Done/);
 w.eval("state.calendarFilter='tasks-open';renderCalendar()");assert.equal(d.querySelectorAll('#calAgenda .day-note-pill').length,0);
 w.eval("state.calendarFilter='tasks-done';renderCalendar()");assert.equal(d.querySelectorAll('#calAgenda .day-note-pill.is-done').length,1);
 d.querySelector('#calendarNoteDone').click();assert.equal(w.eval("!!getNotesForDate('2026-11-01')[0].completedAt"),false);
 assert.match(d.querySelector('#noteCompletionStatus').textContent,/To do/);
 assert.equal(w.eval("getNotesForDate('2026-11-01')[0].date"),'2026-11-01');
 w.eval("closeModal('noteModal')");
}));
test('nested confirmations sit above the drawer and Escape closes only the top layer',async()=>withApp('',w=>{
 w.eval('openCalendarDayDetails(new Date());openModal("bufferDraftConfirm")');
 const d=w.document;
 assert.ok(Number(d.querySelector('#bufferDraftConfirm').style.zIndex)>Number(d.querySelector('#sharedDayModal').style.zIndex));
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.ok(d.querySelector('#sharedDayModal.open'));assert.equal(d.querySelector('#bufferDraftConfirm').classList.contains('open'),false);
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(d.querySelector('#sharedDayModal').classList.contains('open'),false);
}));
