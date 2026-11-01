'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadApp}=require('../scripts/smoke-browser');
async function app(fn,setup){const dom=await loadApp('',setup);try{await fn(dom.window);}finally{dom.window.close();}}
function nextMonday(w){const C=w.PostIQCoverage,today=C.dayKey(new Date()),weekday=new Date(today+'T12:00:00Z').getUTCDay();return C.addDays(today,(8-weekday)%7);}
test('Posting schedule modal saves cadence, target and days off without touching Buffer',async()=>app(w=>{
 const d=w.document,C=w.PostIQCoverage,start=nextMonday(w),end=C.addDays(start,6);
 w.eval("state.channels=[{id:'a',displayName:'A'}];state.scheduled=[{id:'scheduled',channelId:'a',dueAt:'"+start+"T18:00:00Z'}];getBufferConnectionState=()=>({connected:true});state.scheduledCoverage={complete:true,ts:Date.now()};YourPace.open()");
 // Queue Health view is gone; the schedule lives in a modal, runway on the calendar
 assert.equal(d.querySelector('#queueHealthView'),null);
 assert.ok(d.querySelector('#scheduleModal'));
 assert.equal(d.querySelector('#calendarView #calendarRunway')!==null,true);
 const snapshot=w.eval('JSON.stringify(state.scheduled)');
 d.querySelector('#schedChannel').value='a';w.eval('YourPace.refresh(true)');d.querySelector('#schedChannel').value='a';
 d.querySelector('#schedTarget').value='2';d.querySelector('#schedSave').click();
 assert.equal(w.eval('getPlanningSettings().channelTargets.a'),2);assert.equal(w.eval('getPlanningSettings().legacyOption'),'keep');
 d.querySelector('#schedOffStart').value=C.addDays(start,2);d.querySelector('#schedOffEnd').value=C.addDays(start,3);d.querySelector('#schedOffScope').value='selected';d.querySelector('#schedOffSave').click();
 assert.ok(w.eval('(getPlanningSettings().daysOff||[]).length>=1'));
 assert.equal(w.eval('JSON.stringify(state.scheduled)'),snapshot); // Buffer posts untouched
 assert.match(d.querySelector('#schedStatus').textContent,/Buffer posts have not changed/);
},w=>w.localStorage.setItem('postiqPlanningSettings',JSON.stringify({postingDays:['MON','WED','FRI'],legacyOption:'keep'}))));
test('incomplete queue data shows no confident runway and flags the data problem',async()=>app(w=>{
 const d=w.document;
 w.eval("state.channels=[{id:'a',displayName:'A'}];getBufferConnectionState=()=>({connected:true});state.scheduled=[];setPlanningSettings({...getPlanningSettings(),channelPostingDays:{a:['MON','TUE','WED','THU','FRI']},channelTargets:{a:1}});state.scheduledCoverage={complete:false,ts:Date.now()};renderCalendar();PostIQPlanHealth.render()");
 assert.doesNotMatch(d.querySelector('#calendarRunway').textContent,/Covered for/); // no confident number under incomplete data
 assert.match(d.querySelector('#planHealthStrip').textContent,/out of date/);
 assert.equal(w.eval('getQueueCoverage().complete'),false);
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
test('calendar health flags loaded coverage when pagination is incomplete or sync failed',async()=>app(w=>{
 w.eval("state.channels=[{id:'a',displayName:'A'}];getBufferConnectionState=()=>({connected:true});state.scheduled=Array.from({length:92},(_,i)=>({id:String(i),channelId:'a',dueAt:PostIQCoverage.addDays(PostIQCoverage.dayKey(new Date()),i)+'T18:00:00Z'}));state.scheduledCoverage={complete:false,ts:Date.now()};PostIQPlanHealth.render()");
 assert.match(w.document.querySelector('#planHealthStrip').textContent,/out of date/);assert.doesNotMatch(w.document.querySelector('#planHealthStrip').textContent,/well ahead/);
 w.eval("state.scheduledCoverage.complete=true;state.syncState='failed'");assert.equal(w.eval('getQueueCoverage().complete'),false);
}));
