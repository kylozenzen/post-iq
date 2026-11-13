'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../scripts/smoke-browser');

function seed(w) {
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const d = x => { const t = new Date(now); t.setDate(now.getDate() + x); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); };
  w.localStorage.setItem('postiq_campaigns_v1', JSON.stringify([
    { id: 'c1', type: 'newsletter', title: 'Issue 14', start: d(2), end: d(6), color: '#6366f1', stages: [{ label: 'Plan', done: true }, { label: 'Publish', done: false }] },
  ]));
}

test('campaigns render as one band: solid first and last day, quiet tint between', async () => {
  const dom = await loadApp('', seed);
  const w = dom.window;
  try {
    w.eval('state.month = new Date(); renderCalendar();');
    const d = w.document;
    assert.match(d.querySelector('.camp-band.is-start .camp-band-label').textContent, /Issue 14/);
    assert.match(d.querySelector('.camp-band.is-start .camp-band-tag').textContent, /1\/2/, 'stage progress shown');
    assert.match(d.querySelector('.camp-band.is-end').textContent, /Sends/, 'newsletter end reads as the send day');
    assert.equal(d.querySelectorAll('.camp-band.is-mid').length, 3, 'every day between is covered');
    assert.ok([...d.querySelectorAll('.camp-band.is-mid')].every(b => !b.querySelector('.camp-band-label') || b.classList.contains('is-row-start')), 'middle days stay unlabelled unless a week row starts there');
    assert.match(d.querySelector('.camp-band.is-start').getAttribute('aria-label'), /first day.*next: Publish/);
  } finally { dom.window.close(); }
});

test('overlapping ranges keep their lane, and week view, drawer and agenda show them too', async () => {
  const dom = await loadApp('', w => {
    const pad = n => String(n).padStart(2, '0');
    const d = x => { const t = new Date(); t.setDate(t.getDate() + x); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); };
    w.localStorage.setItem('postiq_campaigns_v1', JSON.stringify([
      { id: 'a', type: 'campaign', title: 'Launch', start: d(0), end: d(4), stages: [] },
      { id: 'b', type: 'newsletter', title: 'Issue 15', start: d(2), end: d(3), stages: [{ label: 'Draft', done: false }] },
      { id: 'c', type: 'campaign', title: 'Later', start: d(5), end: d(6), stages: [] },
    ]));
  });
  const w = dom.window, d = w.document;
  try {
    w.eval('state.month = new Date(); renderCalendar();');
    const lanes = w.PostIQCampaigns.lanes();
    assert.equal(lanes.get('a'), 0); assert.equal(lanes.get('b'), 1); assert.equal(lanes.get('c'), 0, 'a freed lane is reused');
    const key = w.eval('fmtDate(new Date(Date.now()+2*864e5))');
    const cell = d.querySelector(`[data-calendar-date="${key}"]`) || [...d.querySelectorAll('.cal-day')].find(c => c.querySelector('[data-campaign="b"].is-start'));
    const bands = [...cell.querySelectorAll('.camp-band')].map(b => b.dataset.campaign);
    assert.deepEqual(bands, ['a', 'b'], 'Launch stays on top while Issue 15 runs');
    w.eval("setCalendarView('week')");
    assert.ok(d.querySelector('#calWeek .camp-band[data-campaign="a"]'), 'week view shows the band');
    w.eval(`openCalendarDayDetails(new Date('${key}T12:00:00'))`);
    const drawer = d.getElementById('sharedDayBody').textContent;
    assert.match(drawer, /Launch/); assert.match(drawer, /Issue 15/); assert.match(drawer, /Day 1 of 2 · sends .* · 0\/1 · next: Draft/); assert.doesNotMatch(drawer, /No plans yet/);
  } finally { dom.window.close(); }
});

test('campaign data is local only and exposes a coverage API; no Buffer writes', async () => {
  const dom = await loadApp('', seed);
  const w = dom.window;
  try {
    assert.equal(w.PostIQCampaigns.list().length, 1);
    const key = w.PostIQCampaigns.list()[0].start;
    assert.equal(w.PostIQCampaigns.forDate(key).length, 1);
    assert.equal(w.PostIQCampaigns.covers(key), true);
    // The module never calls Buffer.
    const src = require('fs').readFileSync('js/features/campaigns.js', 'utf8');
    assert.doesNotMatch(src, /createPost|buffer-proxy|fetch\(/);
  } finally { dom.window.close(); }
});
