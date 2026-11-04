'use strict';
// Phase 2 "delight": quick add, drag to reschedule, Today strip + one-tap fill, holidays.
const test = require('node:test'), assert = require('node:assert/strict');
const { loadApp } = require('../scripts/smoke-browser');
async function app(fn, setup) { const dom = await loadApp('', setup); try { await fn(dom.window); } finally { dom.window.close(); } }
const TUE = 'new Date(2026,10,3,10,0)'; // Tue Nov 3 2026, 10:00 local

test('quick add understands everyday date phrases', async () => app(w => {
  const p = (text, fallback) => w.eval(`JSON.stringify(PostIQQuickAdd.parse(${JSON.stringify(text)}, ${TUE}, ${fallback ? JSON.stringify(fallback) : 'null'}))`);
  const cases = [
    ['today: post the recap', '2026-11-03', 'post the recap'],
    ['tomorrow - film B-roll', '2026-11-04', 'film B-roll'],
    ['Fri: reshare press release', '2026-11-06', 'reshare press release'],
    ['tue: same-day plan', '2026-11-03', 'same-day plan'],
    ['next fri: launch teaser', '2026-11-13', 'launch teaser'],
    ['next mon kickoff', '2026-11-09', 'kickoff'],
    ['Nov 12: webinar promo', '2026-11-12', 'webinar promo'],
    ['12 December holiday hours', '2026-12-12', 'holiday hours'],
    ['11/20 – sale reminder', '2026-11-20', 'sale reminder'],
    ['in 3 days: check analytics', '2026-11-06', 'check analytics'],
    ['Jan 2: new year post', '2027-01-02', 'new year post'],
  ];
  for (const [input, dateKey, text] of cases) {
    const r = JSON.parse(p(input));
    assert.equal(r.dateKey, dateKey, input);
    assert.equal(r.text, text, input);
    assert.equal(r.explicitDate, true, input);
  }
  const plain = JSON.parse(p('Reshare the press release', '2026-11-10'));
  assert.equal(plain.dateKey, '2026-11-10', 'no date → the selected day');
  assert.equal(plain.text, 'Reshare the press release', 'words that only look like days stay in the text');
  assert.equal(JSON.parse(p('Money tips thread')).dateKey, '2026-11-03', '"Mon…" inside a word is not Monday');
  assert.equal(JSON.parse(p('todo fri: film the tour')).kind, 'action');
  assert.equal(JSON.parse(p('fri: [ ] film the tour')).kind, 'action');
  assert.equal(JSON.parse(p('fri: just a note')).kind, 'note');
}));

test('quick add finds a holiday by name', async () => app(w => {
  w.eval(`localStorage.setItem('postiq_holidays_v1', JSON.stringify({country:'US',cache:{'US-2026':{ts:Date.now(),list:[{date:'2026-11-26',name:'Thanksgiving Day'}]},'US-2027':{ts:Date.now(),list:[]}}}))`);
  const r = JSON.parse(w.eval(`JSON.stringify(PostIQQuickAdd.parse('Thanksgiving: gratitude post', ${TUE}))`));
  assert.equal(r.dateKey, '2026-11-26');
  assert.equal(r.text, 'gratitude post');
  assert.equal(r.holiday, 'Thanksgiving Day');
}));

test('quick add saves a plan on the parsed day from the + Add popover', async () => app(w => {
  const d = w.document;
  d.querySelector('#calendarAddBtn').click();
  const input = d.querySelector('#quickAddInput');
  input.value = 'todo tomorrow: film the tour'; input.dispatchEvent(new w.Event('input'));
  assert.match(d.querySelector('#quickAddPreview').textContent, /To-do on/);
  input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  const tomorrow = w.eval('(()=>{const x=new Date();x.setDate(x.getDate()+1);return fmtDate(x)})()');
  const saved = w.eval(`JSON.stringify(getNotesForDate('${tomorrow}'))`);
  assert.match(saved, /film the tour/);
  assert.match(saved, /"typeId":"action"/);
  assert.equal(d.querySelector('#quickAddPop').hidden, false, 'stays open for the next one');
  input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(d.querySelector('#quickAddPop').hidden, true);
}));

test('dragging a plan moves it, and Undo puts it back', async () => app(w => {
  const today = w.eval('fmtDate(new Date())');
  const later = w.eval('(()=>{const x=new Date();x.setDate(x.getDate()+2);return fmtDate(x)})()');
  const id = w.eval(`addNoteForDateKey('${today}','Reshare press release','action').id`);
  w.eval(`PostIQDrag.dropNote('${id}','${today}','${later}')`);
  assert.equal(w.eval(`getNotesForDate('${today}').length`), 0);
  assert.match(w.eval(`JSON.stringify(getNotesForDate('${later}'))`), new RegExp(`"date":"${later}"`));
  w.document.querySelector('.toast-action-btn').click();
  assert.equal(w.eval(`getNotesForDate('${today}').length`), 1);
}));

test('dragging a Buffer post keeps its time and sends only id, mode and dueAt', async () => app(async w => {
  w.eval(`getBufferConnectionState=()=>({connected:true});
    window.__edits=[];editPost=async input=>{__edits.push(input);return {post:{id:input.id,dueAt:input.dueAt}}};
    const at=new Date();at.setDate(at.getDate()+1);at.setHours(14,30,0,0);
    state.channels=[{id:'a',displayName:'A',service:'linkedin'}];
    state.scheduled=[{id:'p1',channelId:'a',text:'Hello',dueAt:at.toISOString()}];`);
  const from = w.eval('fmtDate(new Date(state.scheduled[0].dueAt))');
  const to = w.eval('(()=>{const x=new Date();x.setDate(x.getDate()+4);return fmtDate(x)})()');
  await w.eval(`PostIQDrag.dropPost('p1','${from}','${to}')`);
  const edit = JSON.parse(w.eval('JSON.stringify(__edits[0])'));
  assert.deepEqual(Object.keys(edit).sort(), ['dueAt', 'id', 'mode']);
  assert.equal(edit.mode, 'customScheduled');
  const moved = new w.Date(edit.dueAt);
  assert.equal(w.eval(`fmtDate(new Date(${JSON.stringify(edit.dueAt)}))`), to);
  assert.equal(moved.getHours(), 14); assert.equal(moved.getMinutes(), 30);
  // Undo sends it back
  w.document.querySelector('.toast-action-btn').click();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(w.eval(`fmtDate(new Date(__edits[1].dueAt))`), from);
}));

test('a rejected move snaps back; published and past posts do not move', async () => app(async w => {
  w.eval(`editPost=async()=>{throw new Error('Instagram posts need a type')};
    const at=new Date();at.setDate(at.getDate()+1);at.setHours(9,0,0,0);
    state.scheduled=[{id:'p1',channelId:'a',text:'x',dueAt:at.toISOString()},{id:'old',channelId:'a',text:'y',status:'sent',dueAt:at.toISOString()}];`);
  const before = w.eval('state.scheduled[0].dueAt');
  const from = w.eval('fmtDate(new Date(state.scheduled[0].dueAt))');
  const to = w.eval('(()=>{const x=new Date();x.setDate(x.getDate()+3);return fmtDate(x)})()');
  await w.eval(`PostIQDrag.dropPost('p1','${from}','${to}')`);
  assert.equal(w.eval('state.scheduled[0].dueAt'), before);
  assert.equal(w.eval("PostIQDrag.canMovePost('old')"), false);
}));

test('Today strip offers a starred reshare for the next open slot, and queues it on that exact day', async () => app(async w => {
  const d = w.document;
  w.eval(`getBufferConnectionState=()=>({connected:true});
    state.channels=[{id:'th',displayName:'bensoup',service:'threads'}];
    const at=new Date();at.setDate(at.getDate()-7);at.setHours(11,15,0,0);
    state.published=[{id:'old1',channelId:'th',text:'Evergreen gem',status:'sent',sentAt:at.toISOString()}];
    state.scheduled=[];
    localStorage.setItem('postiq_library_starred_v1',JSON.stringify(['old1']));
    localStorage.setItem('postiq_library_cache_v3',JSON.stringify({posts:[{id:'old1',channelId:'th',text:'Evergreen gem'}],ts:Date.now()}));
    const target=new Date();target.setDate(target.getDate()+2);window.__gapKey=fmtDate(target);
    dayCoverageRows=date=>fmtDate(date)===__gapKey?[{channelId:'th',status:'gap'}]:[];
    scheduledPlanningChannels=()=>state.channels;
    window.__created=[];createPost=async input=>{__created.push(input);return {post:{id:'new',channelId:input.channelId,text:input.text,dueAt:input.dueAt}}};
    state.month=new Date();setCalendarView('month');`);
  const strip = d.querySelector('#todayStrip');
  assert.equal(strip.hidden, false);
  assert.match(strip.textContent, /Evergreen gem/);
  const btn = strip.querySelector('[data-fill-queue]');
  assert.match(btn.textContent, /Reshare .* at 11:15/);
  btn.click();
  await new Promise(r => setTimeout(r, 0));
  const created = JSON.parse(w.eval('JSON.stringify(__created[0])'));
  assert.equal(created.mode, 'customScheduled');
  assert.equal(created.channelId, 'th');
  assert.equal(w.eval(`fmtDate(new Date(${JSON.stringify(created.dueAt)}))`), w.eval('__gapKey'));
}));

test('with nothing starred, the fill card points to the Shelf instead of guessing', async () => app(w => {
  w.eval(`getBufferConnectionState=()=>({connected:true});state.channels=[{id:'li',displayName:'Ben',service:'linkedin'}];
    localStorage.removeItem('postiq_library_starred_v1');`);
  const html = w.eval(`PostIQToday.fillCardHtml({dateKey:fmtDate(new Date(Date.now()+2*864e5)),channelId:'li'})`);
  assert.match(html, /Star a past post on your Shelf/);
  assert.doesNotMatch(html, /data-fill-queue/);
}));

test('open slots in day cells are buttons that open the fill card', async () => app(w => {
  const d = w.document;
  w.eval(`getBufferConnectionState=()=>({connected:true});state.channels=[{id:'li',displayName:'Ben',service:'linkedin'}];
    window.dayGapCount=()=>1;dayCoverageRows=()=>[{channelId:'li',status:'gap'}];
    state.month=new Date();setCalendarView('month');`);
  const key = w.eval('(()=>{const x=new Date();x.setDate(x.getDate()+1);return fmtDate(x)})()');
  const cell = d.querySelector(`#calGrid [data-calendar-date="${key}"]`);
  if (!cell) return; // tomorrow is next month on the last day; covered by other cases
  const slot = cell.querySelector('button.day-gap-slot');
  assert.ok(slot);
  slot.click();
  assert.ok(d.querySelector('.fill-pop'), 'fill card opens');
  assert.equal(d.querySelector('#sharedDayModal')?.classList.contains('open') || false, false, 'the day panel does not also open');
}));

test('holidays show under the date and can be turned off', async () => app(w => {
  const d = w.document, y = w.eval('new Date().getFullYear()');
  const key = w.eval('(()=>{const x=new Date();x.setDate(x.getDate()+1);return fmtDate(x)})()');
  w.eval(`localStorage.setItem('postiq_holidays_v1', JSON.stringify({country:'US',cache:{'US-${y}':{ts:Date.now(),list:[{date:'${key}',name:'Test Holiday'}]}}}));state.month=new Date(${JSON.stringify(key)}+'T12:00:00');setCalendarView('month')`);
  assert.match(d.querySelector(`#calGrid [data-calendar-date="${key}"] .day-holiday`).textContent, /Test Holiday/);
  w.eval("PostIQHolidays.setCountry('off')");
  assert.equal(d.querySelector(`#calGrid [data-calendar-date="${key}"] .day-holiday`), null);
  assert.equal(d.querySelector('#calendarHolidayCountry').value, 'off');
}));

test('pressing N while quick add is open keeps what you typed', async () => app(w => {
  const d = w.document;
  d.querySelector('#calendarAddBtn').click();
  const input = d.querySelector('#quickAddInput');
  assert.equal(d.activeElement, input, 'focus lands in the box immediately');
  input.value = 'Fri: draft'; input.dispatchEvent(new w.Event('input'));
  d.body.focus();
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'n', bubbles: true }));
  assert.equal(input.value, 'Fri: draft');
}));

test('backup round-trips plans and settings, leaves Buffer tokens out, and refuses other files', async () => app(w => {
  const today = w.eval('fmtDate(new Date())');
  w.eval(`addNoteForDateKey('${today}','Keep me','note');localStorage.setItem('postiq_buffer_access_token','secret');localStorage.setItem('postiq_discord_webhooks','https://hook')`);
  const snap = w.eval('JSON.stringify(PostIQBackup.snapshot())');
  assert.doesNotMatch(snap, /secret|https:\/\/hook/, 'no tokens or webhook URLs in a backup');
  w.eval(`localStorage.removeItem('postiq_calendar_notes_v2')`);
  assert.equal(w.eval(`getNotesForDate('${today}').length`), 0);
  w.eval(`PostIQBackup.restore(${JSON.stringify(snap)})`);
  assert.match(w.eval(`JSON.stringify(getNotesForDate('${today}'))`), /Keep me/);
  assert.throws(() => w.eval(`PostIQBackup.validate({format:'something-else',data:{}})`), /isn’t a PostIQ backup/);
  assert.throws(() => w.eval(`PostIQBackup.validate({format:'postiq-backup',version:1,data:{postiq_calendar_notes_v2:'{broken'}})`), /damaged/);
}));

test('.ics export writes all-day events for plans and campaigns', async () => app(w => {
  const ics = w.eval(`PostIQBackup.buildIcs({'2026-11-06':[{id:'n1',text:'Reshare, the press release',typeId:'action'}]},[{id:'c1',title:'Launch week',start:'2026-11-09',end:'2026-11-13'}],new Date('2026-11-03T12:00:00Z'))`);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261106\r\nDTEND;VALUE=DATE:20261107/);
  assert.match(ics, /SUMMARY:☐ Reshare\\, the press release/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261109\r\nDTEND;VALUE=DATE:20261114/, 'campaign end is inclusive');
  assert.match(ics, /END:VCALENDAR\r\n$/);
}));
