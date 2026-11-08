const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadApp}=require('../scripts/smoke-browser');

test('ISO week numbers match the standard calendar',async()=>{
 const dom=await loadApp('');
 try{
  const w=dom.window;
  assert.equal(w.eval('isoWeekNumber(new Date(2026,10,9))'),46); // Mon 9 Nov 2026
  assert.equal(w.eval('isoWeekNumber(new Date(2024,11,30))'),1); // Mon 30 Dec 2024 starts 2025 week 1
  assert.equal(w.eval('isoWeekNumber(new Date(2021,0,1))'),53); // Fri 1 Jan 2021 is in 2020 week 53
 }finally{dom.window.close();}
});

test('week number setting is off by default and labels the week view when on',async()=>{
 const dom=await loadApp('');
 try{
  const w=dom.window;
  w.eval("setCalendarView('week'); updateCalendarViewUI();");
  assert.doesNotMatch(w.document.querySelector('#monthLabel').textContent,/Wk \d+/);
  w.localStorage.setItem('postiqPlanningSettings',JSON.stringify({showWeekNumbers:true}));
  w.eval("updateCalendarViewUI();");
  assert.match(w.document.querySelector('#monthLabel').textContent,/· Wk \d+$/);
  w.eval("setCalendarView('month'); updateCalendarViewUI();");
  assert.doesNotMatch(w.document.querySelector('#monthLabel').textContent,/Wk \d+/,'month view has no week number');
 }finally{dom.window.close();}
});

test('settings checkbox saves and restores the week number preference',async()=>{
 const dom=await loadApp('');
 try{
  const w=dom.window, d=w.document;
  w.eval("renderPlanningSettings()");
  const box=d.querySelector('#showWeekNumbersSetting');
  assert.ok(box);assert.equal(box.checked,false);
  box.checked=true; box.dispatchEvent(new w.Event('change'));
  assert.equal(JSON.parse(w.localStorage.getItem('postiqPlanningSettings')).showWeekNumbers,true);
  w.eval("setCalendarView('week'); updateCalendarViewUI();");
  assert.match(d.querySelector('#monthLabel').textContent,/· Wk \d+$/);
 }finally{dom.window.close();}
});
