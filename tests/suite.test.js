const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadApp}=require('../scripts/smoke-browser');

// Puts the app in a connected, fully synced state with one channel.
function connect(w, extra = '') {
  w.eval(`
    getBufferConnectionState = () => ({ connected: true });
    state.channels = [{ id: 'c1', name: 'Alpha', service: 'instagram' }];
    state.scheduled = [];
    state.published = [];
    state.scheduledCoverage = { ts: Date.now(), complete: true };
    ${extra}
  `);
}

test('Suite is reachable from the sidebar and the calendar header, and goes back',async()=>{
 const dom=await loadApp('');
 try{
  const w=dom.window, d=w.document;
  assert.ok(d.querySelector('.side-nav [data-view="suiteView"]'),'sidebar entry');
  assert.ok(d.getElementById('calSuiteBtn'),'calendar header icon');
  w.eval("activateView('suiteView')");
  assert.ok(d.getElementById('suiteView').classList.contains('active'));
  assert.ok(!d.getElementById('calendarView').classList.contains('active'));
  d.getElementById('suiteBackBtn').click();
  assert.ok(d.getElementById('calendarView').classList.contains('active'),'back link returns to calendar');
  d.getElementById('calSuiteBtn').click();
  assert.ok(d.getElementById('suiteView').classList.contains('active'),'header icon opens Suite');
 }finally{dom.window.close();}
});

test('channel list reports days until a channel runs out',async()=>{
 const dom=await loadApp('');
 try{
  const w=dom.window, d=w.document;
  connect(w);
  w.eval("PostIQSuite.render()");
  const text=d.getElementById('suiteChannels').textContent;
  assert.match(text,/Alpha/);
  assert.match(text,/Today is open|Covered for \d+ days?/,'nothing queued, so the channel runs out soon');
  assert.match(text,/Queue a post to get ahead|Next open day/);
  assert.match(d.getElementById('paceSummary').textContent,/Alpha needs a post today|Alpha runs out/,'summary line names who needs something');
  // Queue posts on every day for 10 days: the runway should move out to day 10.
  const today=w.PostIQCoverage.dayKey(new Date());
  const posts=[];
  for(let i=0;i<10;i++) posts.push({id:'p'+i,channelId:'c1',status:'scheduled',dueAt:w.PostIQCoverage.addDays(today,i)+'T15:00:00Z'});
  w.eval(`state.scheduled = ${JSON.stringify(posts)}; PostIQSuite.render();`);
  const later=d.getElementById('suiteChannels').textContent.match(/Covered for (\d+) days?/);
  assert.ok(later && Number(later[1])>=9,'runway moves out once posts are queued');
 }finally{dom.window.close();}
});

test('break planner counts queued and missing posts week by week',async()=>{
 const dom=await loadApp('');
 try{
  const w=dom.window;
  connect(w);
  const r=w.eval(`(() => {
    const rows = [
      { date:'2030-01-07', channelId:'c1', target:1, confirmedCount:1, missingCount:0 },
      { date:'2030-01-08', channelId:'c1', target:1, confirmedCount:0, missingCount:1 },
      { date:'2030-01-14', channelId:'c1', target:0, confirmedCount:0, missingCount:0 },
      { date:'2030-01-15', channelId:'c1', target:1, confirmedCount:1, missingCount:0 }
    ];
    return PostIQSuite.breakPlan(rows, '2030-01-07', '2030-01-15');
  })()`);
  assert.equal(r.weeks.length,2,'9 days split into two weeks');
  assert.equal(r.lines[0].cells[0].covered,1);
  assert.equal(r.lines[0].cells[0].planned,2);
  assert.equal(r.lines[0].cells[1].planned,1,'off days are not planned');
  assert.equal(r.missingTotal,1);
  assert.equal(r.channelsShort,1);
 }finally{dom.window.close();}
});

test('break planner says so when a break is fully covered',async()=>{
 const dom=await loadApp('');
 try{
  const w=dom.window, d=w.document;
  connect(w);
  w.eval("PostIQSuite.render()");
  const today=w.PostIQCoverage.dayKey(new Date());
  const posts=[];
  for(let i=1;i<=3;i++) posts.push({id:'b'+i,channelId:'c1',status:'scheduled',dueAt:w.PostIQCoverage.addDays(today,i)+'T15:00:00Z'});
  w.eval(`state.scheduled = ${JSON.stringify(posts)};`);
  d.getElementById('suiteBreakStart').value=w.PostIQCoverage.addDays(today,1);
  d.getElementById('suiteBreakEnd').value=w.PostIQCoverage.addDays(today,3);
  w.eval("PostIQSuite.render()");
  assert.match(d.getElementById('suiteBreakSummary').textContent,/stays covered/);
  assert.ok(d.querySelector('#suiteBreakGrid .suite-cell-ok'));
 }finally{dom.window.close();}
});

test('Pace is the visible name, and Posting schedule opens it',async()=>{
 const dom=await loadApp('');
 try{
  const d=dom.window.document, w=dom.window;
  assert.match(d.querySelector('.side-nav [data-view="suiteView"]').textContent,/Pace/);
  assert.equal(d.getElementById('suiteTitle').textContent,'Pace');
  w.eval('YourPace.open()');
  assert.ok(d.getElementById('suiteView').classList.contains('active'),'one home for schedules');
  assert.ok(!d.getElementById('scheduleModal').classList.contains('open'));
 }finally{dom.window.close();}
});

test('each channel shows its Buffer connection health',async()=>{
 const dom=await loadApp('');
 try{
  const w=dom.window, d=w.document;
  connect(w, `state.channels=[{id:'c1',name:'Alpha',service:'threads'},{id:'c2',name:'Beta',service:'linkedin',isDisconnected:true},{id:'c3',name:'Gamma',service:'bluesky',isLocked:true}];`);
  w.eval("PostIQSuite.render()");
  const rows=[...d.querySelectorAll('#suiteChannels .suite-channel')];
  assert.match(rows[0].textContent,/Connected/);
  assert.match(rows[1].textContent,/Disconnected in Buffer/);
  assert.ok(rows[1].querySelector('.suite-fix'),'links out to fix it');
  assert.ok(rows[1].classList.contains('suite-tone-warn'));
  assert.match(rows[2].textContent,/Locked in Buffer/);
 }finally{dom.window.close();}
});

test('stale data shows a Sync button in the notice',async()=>{
 const dom=await loadApp('');
 try{
  const w=dom.window, d=w.document;
  connect(w, `state.scheduledCoverage={ts:Date.now()-60*60*1000,complete:true};`);
  w.eval("PostIQSuite.render()");
  assert.ok(!d.getElementById('suiteNotice').hidden);
  assert.ok(d.querySelector('#suiteNotice [data-suite-sync]'));
 }finally{dom.window.close();}
});

test('posting days, target and reshare are edited inline and saved to planning settings',async()=>{
 const dom=await loadApp('');
 try{
  const w=dom.window, d=w.document;
  connect(w);
  w.eval("PostIQSuite.render()");
  const row=()=>d.querySelector('#suiteChannels [data-suite-channel="c1"]');
  assert.ok(row().querySelector('.suite-default-hint'),'starts on the default days');
  const sat=row().querySelector('[data-suite-day="SAT"]');
  const wasOn=sat.getAttribute('aria-pressed')==='true';
  sat.click();
  assert.equal(w.eval("getPlanningSettings().channelPostingDays.c1.includes('SAT')"),!wasOn);
  assert.equal(row().querySelector('[data-suite-day="SAT"]').getAttribute('aria-pressed'),String(!wasOn));
  const input=row().querySelector('[data-suite-target]');
  input.value='2'; input.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(w.eval("getPlanningSettings().channelTargets.c1"),2);
  input.value='99'; input.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(w.eval("getPlanningSettings().channelTargets.c1"),2,'out-of-range values are ignored');
  const box=row().querySelector('[data-suite-reshare]');
  box.checked=true; box.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(w.eval("getPlanningSettings().channelReshare.c1"),true);
 }finally{dom.window.close();}
});

test('break fill plans one reshare per missing post on the exact empty day, and only after confirming',async()=>{
 const dom=await loadApp('');
 try{
  const w=dom.window, d=w.document;
  connect(w, `state.channels=[{ id: 'c1', name: 'Alpha', service: 'linkedin' }];
    localStorage.setItem('postiq_library_starred_v1',JSON.stringify(['s1','s2','s3','s4','s5','s6','s7','s8']));
    localStorage.setItem('postiq_library_cache_v3',JSON.stringify({posts:['one','two','three','four','five','six','seven','eight'].map((n,i)=>({id:'s'+(i+1),text:'Evergreen '+n,channelId:'c1'}))}));`);
  const today=w.PostIQCoverage.dayKey(new Date());
  const start=w.PostIQCoverage.addDays(today,2), end=w.PostIQCoverage.addDays(today,8);
  w.eval(`setPlanningSettings({...getPlanningSettings(),postingDays:['SUN','MON','TUE','WED','THU','FRI','SAT'],channelPostingDays:{c1:['SUN','MON','TUE','WED','THU','FRI','SAT']},channelTargets:{c1:1},channelReshare:{c1:false}})`);
  d.getElementById('suiteBreakStart').value=start; d.getElementById('suiteBreakEnd').value=end;
  w.eval("PostIQSuite.render()");
  assert.match(d.getElementById('suiteFill').textContent,/Turn on “Fill gaps from Shelf”/,'off by default');
  w.eval(`setPlanningSettings({...getPlanningSettings(),channelReshare:{c1:true}});PostIQSuite.render()`);
  const plan=w.eval(`PostIQSuite.planBreakFill('${start}','${end}')`);
  assert.equal(plan.items.length,7,'one per empty day');
  assert.ok(plan.items.every(i=>w.PostIQCoverage.dayKey(new Date(i.dueAt))===i.date),'each lands on its own day');
  assert.equal(new Set(plan.items.map(i=>i.text)).size,7,'each kept post goes out once per channel');
  const calls=[];
  w.eval(`createPost=async p=>{window.__calls=(window.__calls||[]);window.__calls.push(p);return {post:{id:'n'+window.__calls.length,channelId:p.channelId,text:p.text,dueAt:p.dueAt,status:'scheduled'}}}`);
  assert.equal(w.eval('(window.__calls||[]).length'),0,'nothing written before confirming');
  d.getElementById('suiteFillBtn').click();
  await new Promise(r=>setTimeout(r,50));
  const made=w.eval('window.__calls');
  assert.equal(made.length,7);
  assert.ok(made.every(p=>p.mode==='customScheduled'&&p.dueAt),'exact times, not next queue slot');
  assert.match(d.getElementById('suiteBreakSummary').textContent,/stays covered/,'the break is covered afterwards');
 }finally{dom.window.close();}
});

test('break fill never repeats a kept post on a channel, and skips channels that need media',async()=>{
 const dom=await loadApp('');
 try{
  const w=dom.window, d=w.document;
  connect(w, `state.channels=[{ id: 'c1', name: 'Alpha', service: 'linkedin' },{ id: 'c2', name: 'Gram', service: 'instagram' }];
    state.scheduled=[{id:'q1',channelId:'c1',text:'Evergreen two',dueAt:new Date(Date.now()+30*864e5).toISOString(),status:'scheduled'}];
    localStorage.setItem('postiq_library_starred_v1',JSON.stringify(['s1','s2','s3']));
    localStorage.setItem('postiq_library_cache_v3',JSON.stringify({posts:[{id:'s1',text:'Evergreen one',channelId:'c1'},{id:'s2',text:'Evergreen two',channelId:'c1'},{id:'s3',text:'Evergreen three',channelId:'c1'}]}));`);
  const today=w.PostIQCoverage.dayKey(new Date());
  const start=w.PostIQCoverage.addDays(today,2), end=w.PostIQCoverage.addDays(today,8);
  w.eval(`setPlanningSettings({...getPlanningSettings(),postingDays:['SUN','MON','TUE','WED','THU','FRI','SAT'],channelPostingDays:{c1:['SUN','MON','TUE','WED','THU','FRI','SAT'],c2:['SUN','MON','TUE','WED','THU','FRI','SAT']},channelTargets:{c1:1,c2:1},channelReshare:{c1:true,c2:true}})`);
  const plan=JSON.parse(w.eval(`JSON.stringify(PostIQSuite.planBreakFill('${start}','${end}'))`));
  assert.deepEqual(plan.items.map(i=>i.text).sort(),['Evergreen one','Evergreen three'],'two unused kept posts, once each; the queued one is skipped');
  assert.ok(plan.items.every(i=>i.channelId==='c1'),'nothing text-only goes to Instagram');
  assert.deepEqual(plan.mediaOnly,['c2']);
  assert.equal(plan.short[0][1],5,'the rest of the week stays open and is reported');
  d.getElementById('suiteBreakStart').value=start; d.getElementById('suiteBreakEnd').value=end;
  w.eval('PostIQSuite.render()');
  const msg=d.getElementById('suiteFill').textContent;
  assert.match(msg,/once per channel/);
  assert.match(msg,/photo or video/);
 }finally{dom.window.close();}
});

test('time off can be marked and removed from Pace',async()=>{
 const dom=await loadApp('');
 try{
  const w=dom.window, d=w.document;
  connect(w);
  const today=w.PostIQCoverage.dayKey(new Date());
  d.getElementById('suiteBreakStart').value=w.PostIQCoverage.addDays(today,3);
  d.getElementById('suiteBreakEnd').value=w.PostIQCoverage.addDays(today,5);
  w.eval('PostIQSuite.render()');
  d.getElementById('paceMarkOff').click();
  const off=JSON.parse(w.eval('JSON.stringify(getPlanningSettings().daysOff)'));
  assert.equal(off.length,1); assert.equal(off[0].channelId,'*');
  assert.match(d.getElementById('paceTimeOff').textContent,/Time off/);
  assert.ok(d.getElementById('paceMarkOff').disabled,'same range can’t be marked twice');
  d.querySelector('[data-pace-off-remove]').click();
  assert.equal(JSON.parse(w.eval('JSON.stringify(getPlanningSettings().daysOff)')).length,0);
 }finally{dom.window.close();}
});
