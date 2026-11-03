'use strict';
// Phase 1 "calm calendar": one row of controls, two layers per day, gaps as open slots, one Shelf.
const test = require('node:test'), assert = require('node:assert/strict');
const { loadApp } = require('../scripts/smoke-browser');
async function app(fn, setup) { const dom = await loadApp('', setup); try { await fn(dom.window); } finally { dom.window.close(); } }
const todayKey = w => w.eval('fmtDate(new Date())');

test('toolbar keeps only page-turning, zoom and add in view; the rest sits in the ⋯ menu', async () => app(w => {
  const d = w.document, bar = d.querySelector('#calendarView .calm-toolbar');
  assert.ok(bar, 'calm toolbar present');
  const menu = d.querySelector('#calendarFilters');
  for (const id of ['openScheduleBtn', 'shareMonthBtn', 'calendarViewAgendaBtn', 'calendarChannelFilter', 'calendarFilter', 'calendarPostsModeBtn']) {
    assert.ok(menu.contains(d.getElementById(id)), `${id} lives in the ⋯ menu`);
  }
  assert.ok(menu.querySelector('[data-tour-start]'), 'tour can be restarted from the menu');
  assert.equal(d.querySelectorAll('#calendarView .calm-toolbar .cal-view-toggle [data-calendar-view]').length, 2, 'Month and Week only');
  assert.equal(d.querySelector('#calendarView .page-hdr'), null, 'no second header row above the calendar');
  assert.equal(d.querySelector('.calendar-legend'), null, 'no symbol legend');
}));

test('Today hides while you are looking at today, and returns when you page away', async () => app(w => {
  const d = w.document;
  w.eval("state.month=new Date();setCalendarView('month')");
  assert.equal(d.querySelector('#todayMonth').hidden, true);
  d.querySelector('#nextMonth').click();
  assert.equal(d.querySelector('#todayMonth').hidden, false);
  d.querySelector('#todayMonth').click();
  assert.equal(d.querySelector('#todayMonth').hidden, true);
}));

test('a day shows three items, then one "+N more", posts before plans', async () => app(w => {
  const d = w.document, key = todayKey(w);
  w.eval(`state.channels=[{id:'a',displayName:'A',service:'linkedin'}];
    state.scheduled=[1,2,3].map(i=>({id:'p'+i,channelId:'a',service:'linkedin',text:'Post '+i,dueAt:new Date().toISOString()}));
    addNoteForDateKey('${key}','Plan one','note');addNoteForDateKey('${key}','Plan two','action');
    state.month=new Date();setCalendarView('month')`);
  const cell = d.querySelector(`#calGrid [data-calendar-date="${key}"]`);
  const items = cell.querySelectorAll('.day-post-pill, .day-note-pill');
  assert.equal(items.length, 3);
  assert.ok([...items].every(el => el.classList.contains('day-post-pill')), 'posts come first');
  assert.match(cell.querySelector('.more-indicator').textContent, /\+2 more/);
  assert.equal(cell.querySelector('.day-count'), null, 'no separate post counter');
  assert.doesNotMatch(cell.textContent, /◷/, 'scheduled is the default; no clock glyph');
}));

test('plans are outlined in their colour and to-dos get a check circle instead of a glyph', async () => app(w => {
  const d = w.document, key = todayKey(w);
  w.eval(`addNoteForDateKey('${key}','Reshare the press release','action');state.month=new Date();setCalendarView('month')`);
  const pill = d.querySelector(`#calGrid [data-calendar-date="${key}"] .day-note-pill`);
  assert.match(pill.getAttribute('style'), /--note-color:/);
  assert.doesNotMatch(pill.getAttribute('style'), /background:/, 'plans are not filled');
  assert.ok(pill.querySelector('.note-check'));
  assert.doesNotMatch(pill.textContent, /□|✎/);
  assert.match(pill.querySelector('.sr-only').textContent, /To do/);
}));

test('gaps render as a quiet open slot on future days only', async () => app(w => {
  const d = w.document;
  w.eval(`window.dayGapCount=()=>2;state.month=new Date();setCalendarView('month')`);
  const today = d.querySelector(`#calGrid [data-calendar-date="${todayKey(w)}"]`);
  assert.match(today.querySelector('.day-gap-slot').textContent, /2 open slots/);
  const past = w.eval('(()=>{const x=new Date();x.setDate(x.getDate()-1);return fmtDate(x)})()');
  const pastCell = d.querySelector(`#calGrid [data-calendar-date="${past}"]`);
  if (pastCell) assert.equal(pastCell.querySelector('.day-gap-slot'), null);
  assert.equal(d.querySelector('.day-gap-alert'), null, 'no ▲ warning');
}));

test('the agenda says "Nothing planned" once, quietly, for an empty day', async () => app(w => {
  const d = w.document;
  w.eval(`state.scheduled=[];window.dayGapCount=()=>0;state.month=new Date();renderAgenda()`);
  const empty = d.querySelector('#calAgenda .calendar-agenda-day.is-empty');
  assert.ok(empty);
  assert.equal(empty.querySelector('.calendar-agenda-empty').textContent, 'Nothing planned');
  assert.doesNotMatch(d.querySelector('#calAgenda').textContent, /No loaded items match/);
}));

test('Shelf is one nav entry; its tabs move between past posts and ideas', async () => app(w => {
  const d = w.document;
  assert.equal(d.querySelectorAll('.side-nav [data-view="ideasView"], #mobileTabs [data-view="ideasView"]').length, 0, 'no separate Content Bank entry');
  w.eval("workspacePreferences.ideas=true;renderWorkspacePreferences();activateView('libraryView')");
  assert.ok(d.querySelector('.side-nav [data-shelf-nav]').classList.contains('active'));
  d.querySelector('#libraryView [data-shelf-tab="ideasView"]').click();
  assert.ok(d.querySelector('#ideasView').classList.contains('active'));
  assert.ok(d.querySelector('.side-nav [data-shelf-nav]').classList.contains('active'), 'Shelf stays lit on the ideas tab');
  assert.equal(d.querySelector('#ideasView [data-shelf-tab="ideasView"]').getAttribute('aria-selected'), 'true');
  assert.equal(d.body.textContent.includes('Content Bank'), false, 'one name throughout the app');
}));
