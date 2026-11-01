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

test('campaigns render as a dated range with a start pill and an end marker', async () => {
  const dom = await loadApp('', seed);
  const w = dom.window;
  try {
    w.eval('state.month = new Date(); renderCalendar();');
    assert.ok(w.document.querySelectorAll('.cal-day.has-campaign').length >= 2, 'range days are tinted');
    assert.match(w.document.querySelector('.campaign-pill.is-start .campaign-pill-label').textContent, /Issue 14/);
    assert.ok(w.document.querySelector('.campaign-pill.is-end'), 'end marker present');
    assert.match(w.document.querySelector('.campaign-pill.is-start .campaign-pill-tag').textContent, /1\/2/, 'stage progress shown');
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
