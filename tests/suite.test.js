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
  assert.match(text,/Runs out (today|in \d+ days?)/,'nothing queued, so the channel runs out soon');
  assert.match(text,/First empty posting day/);
  // Queue posts on every day for 10 days: the runway should move out to day 10.
  const today=w.PostIQCoverage.dayKey(new Date());
  const posts=[];
  for(let i=0;i<10;i++) posts.push({id:'p'+i,channelId:'c1',status:'scheduled',dueAt:w.PostIQCoverage.addDays(today,i)+'T15:00:00Z'});
  w.eval(`state.scheduled = ${JSON.stringify(posts)}; PostIQSuite.render();`);
  const later=d.getElementById('suiteChannels').textContent.match(/Runs out in (\d+) days?/);
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
