'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadApp}=require('../scripts/smoke-browser');
async function app(fn,setup){const dom=await loadApp('',setup);try{await fn(dom.window);}finally{dom.window.close();}}
function nextMonday(w){const C=w.PostIQCoverage,today=C.dayKey(new Date()),weekday=new Date(today+'T12:00:00Z').getUTCDay();return C.addDays(today,(8-weekday)%7);}
test('Your Pace remains in Queue Health, saves inherited cadence and local exceptions without touching Buffer',async()=>app(w=>{
 const d=w.document,C=w.PostIQCoverage,start=nextMonday(w),end=C.addDays(start,6);
 w.eval("state.channels=[{id:'a',displayName:'A'}];state.scheduled=[];getBufferConnectionState=()=>({connected:true});state.scheduledCoverage={complete:true,ts:Date.now()};YourPace.refresh(true)");
 assert.equal(d.querySelector('#calendarView #yourPace'),null);assert.ok(d.querySelector('#queueHealthView #yourPace'));
 assert.equal(d.querySelectorAll('.side-nav .nav-section-label').length,1);
 d.querySelector('#paceStart').value=start;d.querySelector('#paceEnd').value=end;
 let check=w.YourPace.check();assert.equal(check.summary.planned,3);
 const posts=[{id:'scheduled',channelId:'a',dueAt:start+'T18:00:00Z'}];w.eval(`state.scheduled=${JSON.stringify(posts)}`);
 const snapshot=w.eval('JSON.stringify(state.scheduled)');
 d.querySelector('#paceTarget').value='2';d.querySelector('#paceSave').click();
 assert.equal(w.eval('getPlanningSettings().channelTargets.a'),2);assert.equal(w.eval('getPlanningSettings().legacyOption'),'keep');
 d.querySelector('#paceStart').value=C.addDays(start,2);d.querySelector('#paceEnd').value=C.addDays(start,3);d.querySelector('#paceOffScope').value='selected';d.querySelector('#paceOffSave').click();
 check=w.YourPace.check();assert.equal(check.summary.planned,0);
 d.querySelector('#paceStart').value=start;d.querySelector('#paceEnd').value=end;d.querySelector('#pacePeriodTarget').value='0';d.querySelector('#pacePeriodSave').click();
 assert.equal(w.YourPace.check().summary.planned,0);assert.equal(w.eval('JSON.stringify(state.scheduled)'),snapshot);
 assert.match(d.querySelector('#paceStatus').textContent,/Existing Buffer posts have not changed/);
},w=>w.localStorage.setItem('postiqPlanningSettings',JSON.stringify({postingDays:['MON','WED','FRI'],legacyOption:'keep'}))));
test('uncertain period checks never say fully covered; Plan slot preserves date/channel and requires explicit scheduling',async()=>app(w=>{
 const d=w.document,start=nextMonday(w);
 w.eval("state.channels=[{id:'a',displayName:'A'}];state.scheduled=[];getBufferConnectionState=()=>({connected:true});state.scheduledCoverage={complete:false,ts:Date.now()};YourPace.refresh(true);renderChannelSelects()");
 d.querySelector('#paceStart').value=start;d.querySelector('#paceEnd').value=start;
 w.YourPace.check();assert.match(d.querySelector('#paceDataNote').textContent,/incomplete/);
 assert.doesNotMatch(d.querySelector('#paceCoverageSummary').textContent,/All .*covered/);
 d.querySelector('#paceSlots button').click();assert.ok(d.querySelector('#calendarView.active'));assert.equal(w.eval('state.calendarChannel'),'a');assert.equal(w.eval('fmtDate(state.month)'),start);
 const previous=d.querySelector('#composerWhen').value;
 d.querySelector('[data-start-draft]').click();assert.equal(d.querySelector('#composerChannel').value,'a');assert.equal(d.querySelector('#composerWhen').value,previous);
 assert.match(d.querySelector('#composerCalendarDate').textContent,/choose Queue or Schedule explicitly/);
}));
test('Content Bank keeps legacy items and independent variants while searching, filtering and planning a date',async()=>app(w=>{
 const d=w.document,card=w.Notebook.getCard('legacy');assert.ok(card);
 const original=JSON.stringify({sourceText:card.sourceText,variants:card.variants,buffer:card.buffer,id:card.id,custom:card.custom});
 w.activateView('ideasView');
 assert.match(d.querySelector('#ideasView h1').textContent,/Content Bank/);
 d.querySelector('#contentBankSearch').value='Second independent';d.querySelector('#contentBankSearch').dispatchEvent(new w.Event('input'));
 assert.equal(d.querySelectorAll('#notebookList [data-content-open]').length,1);
 d.querySelector('#contentBankSearch').value='No matching phrase';d.querySelector('#contentBankSearch').dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('#notebookList [data-content-open]').length,0);
 d.querySelector('#contentBankSearch').value='';d.querySelector('#contentBankSearch').dispatchEvent(new w.Event('input'));
 d.querySelector('#contentBankFilter').value='undated';d.querySelector('#contentBankFilter').dispatchEvent(new w.Event('change'));
 const plan=d.querySelector('[data-content-plan="legacy"]');assert.ok(plan);plan.focus();plan.click();
 d.querySelector('#contentBankPlanDate').value='2027-04-07';d.querySelector('#contentBankPlanSave').click();
 const after=w.Notebook.getCard('legacy');assert.equal(after.targetDate,'2027-04-07');
 assert.equal(JSON.stringify({sourceText:after.sourceText,variants:after.variants,buffer:after.buffer,id:after.id,custom:after.custom}),original);
 assert.equal(d.querySelectorAll('#notebookList [data-content-open]').length,0);
 d.querySelector('#contentBankFilter').value='all';d.querySelector('#contentBankFilter').dispatchEvent(new w.Event('change'));
 assert.match(d.querySelector('#notebookList').textContent,/Local target: 2027-04-07 · planning only/);
 assert.match(d.querySelector('#notebookList').textContent,/No confirmed Buffer scheduling/);
 assert.ok(JSON.parse(w.localStorage.getItem('postiq_notebook_v1')).find(item=>item.id==='legacy'));
 w.activateView('contentBankView');assert.ok(d.querySelector('#ideasView.active'));
},w=>w.localStorage.setItem('postiq_notebook_v1',JSON.stringify([{id:'legacy',title:'Saved source',sourceText:'Original source untouched',custom:'retained',variants:[{channelId:'a',text:'First independent',mode:'draft'},{channelId:'b',text:'Second independent',mode:'draft',dueAt:'2027-01-01T12:00Z'}],buffer:{contentItemId:'item-1'}}]))));
test('confirmed scheduling is separate from local dates and Buffer drafts',async()=>app(w=>{
 const M=w.ContentModel;
 const local={targetDate:'2027-01-01',variants:[{channelId:'a',dueAt:'2027-01-02T12:00Z',mode:'draft',postId:'draft',buffer:{status:'draft'}}]};
 assert.equal(M.confirmedScheduling(local).length,0);assert.equal(M.calendarEntry(local).date,'2027-01-01');
 const queue=[{id:'draft',channelId:'a',dueAt:'2027-01-03T12:00Z',status:'scheduled'}];
 assert.equal(M.confirmedScheduling(local,queue).length,1);assert.equal(M.calendarEntry(local,queue).date,'2027-01-03');
 assert.equal(M.matches(local,{filter:'scheduled'}),false);assert.equal(M.matches(local,{filter:'scheduled'},queue),true);
}));
test('calendar filters are collapsed, remain functional, and reset without losing controls',async()=>app(w=>{
 const d=w.document;assert.equal(d.querySelector('#calendarFilters').open,false);
 d.querySelector('#calendarFilters').open=true;d.querySelector('#calendarFilter').value='notes';d.querySelector('#calendarFilter').dispatchEvent(new w.Event('change'));
 assert.match(d.querySelector('#calendarFilterSummary').textContent,/1/);
 d.querySelector('#calendarFiltersReset').click();assert.equal(w.eval('state.calendarFilter'),'all');
 d.querySelector('#calendarFilters').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(d.querySelector('#calendarFilters').open,false);
}));
test('editing one channel version preserves the others and their Buffer scheduling metadata',async()=>app(w=>{
 const card=w.Notebook.addCard({id:'independent',title:'Versions',sourceText:'Source remains',variants:[{channelId:'a',text:'Version A',mode:'schedule',dueAt:'2027-04-01T12:00:00Z',postId:'p-a',buffer:{postId:'p-a',status:'scheduled'}},{channelId:'b',text:'Version B',mode:'draft',dueAt:'',buffer:{postId:'p-b',status:'draft'}}]});
 w.eval("state.channels=[{id:'a',name:'A',service:'linkedin'},{id:'b',name:'B',service:'instagram'}]");
 const before=JSON.stringify(card.variants[1]);w.Notebook.openRemix(card);
 const input=w.document.querySelector('[data-variant-text="0"]');input.value='Edited A only';input.dispatchEvent(new w.Event('input',{bubbles:true}));
 const after=w.Notebook.getCard('independent');assert.equal(after.variants[0].text,'Edited A only');assert.equal(after.variants[0].dueAt,'2027-04-01T12:00:00Z');assert.equal(after.variants[0].buffer.status,'scheduled');
 assert.equal(JSON.stringify(after.variants[1]),before);assert.equal(after.sourceText,'Source remains');
}));
test('legacy Ideas and Content Bank alias routes both preserve the existing workspace',async()=>{
 for(const route of ['?view=ideasView','?view=contentBankView']) {const dom=await loadApp(route);try{assert.ok(dom.window.document.querySelector('#ideasView.active'));}finally{dom.window.close();}}
});
test('Queue Health also qualifies loaded coverage when pagination is incomplete or sync failed',async()=>app(w=>{
 w.eval("state.channels=[{id:'a',displayName:'A'}];getBufferConnectionState=()=>({connected:true});state.scheduled=Array.from({length:92},(_,i)=>({id:String(i),channelId:'a',dueAt:PostIQCoverage.addDays(PostIQCoverage.dayKey(new Date()),i)+'T18:00:00Z'}));state.scheduledCoverage={complete:false,ts:Date.now()};PostIQPlanHealth.render()");
 assert.match(w.document.querySelector('#planHealthStrip').textContent,/Coverage uncertain/);assert.doesNotMatch(w.document.querySelector('#planHealthStrip').textContent,/All channels covered/);
 w.eval("state.scheduledCoverage.complete=true;state.syncState='failed'");assert.equal(w.eval('getQueueCoverage().complete'),false);
}));
