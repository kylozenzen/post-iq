'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../scripts/smoke-browser');

const key = (window, target, value, options = {}) => target.dispatchEvent(new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options }));

test('power layer opens, filters, runs commands, and restores focus', async () => {
  const dom = await loadApp('', window => {
    window.HTMLElement.prototype.getClientRects = function () { return [{ width: 10, height: 10 }]; };
  });
  try {
    const { window } = dom, { document } = window;
    const trigger = document.getElementById('calendarAddBtn');
    trigger.focus();
    key(window, trigger, 'k', { ctrlKey: true });
    const palette = document.querySelector('.power-backdrop[aria-hidden]') || document.querySelector('.power-backdrop');
    assert.ok(palette && !palette.hidden, 'Ctrl+K opens the palette');
    assert.equal(document.activeElement.id, 'powerSearch');
    key(window, document.getElementById('powerSearch'), 'Escape');
    assert.ok(palette.hidden, 'Escape closes the palette');
    assert.equal(document.activeElement, trigger);
    key(window, trigger, 'k', { ctrlKey: true });
    const search = document.getElementById('powerSearch');
    search.value = 'wk'; search.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.match(document.getElementById('powerResults').textContent, /Week view/);
    assert.ok(window.PostIQPower.score('wk', 'Week view') >= 0, 'fuzzy matching accepts subsequences');
    search.value = 'Week view'; search.dispatchEvent(new window.Event('input', { bubbles: true }));
    key(window, search, 'Enter');
    assert.equal(window.eval('state.calendarView'), 'week', 'Enter runs the selected command');
    assert.equal(document.activeElement, trigger, 'closing the palette returns focus');
  } finally { dom.window.close(); }
});

test('power layer passes plain English into quick add and observes keyboard guards', async () => {
  const dom = await loadApp('', window => {
    window.HTMLElement.prototype.getClientRects = function () { return [{ width: 10, height: 10 }]; };
  });
  try {
    const { window } = dom, { document } = window;
    document.getElementById('calendarAddBtn').click();
    assert.ok(document.querySelector('.power-hint'), 'first + Add use shows the keyboard hint');
    document.querySelector('.power-hint button').click();
    assert.equal(window.localStorage.getItem('postiq_add_hint_seen'), '1', 'dismissing the hint is remembered');
    window.PostIQQuickAdd.close({ restoreFocus: false });
    key(window, document.body, 'k', { ctrlKey: true });
    const search = document.getElementById('powerSearch'); search.value = 'fri: power layer test plan'; search.dispatchEvent(new window.Event('input', { bubbles: true })); key(window, search, 'Enter');
    assert.ok(Object.values(window.eval('getNotes()')).flat().some(note => note.text === 'power layer test plan'), 'command text is saved as a plan');
    window.PostIQQuickAdd.close({ restoreFocus: false });
    const before = window.eval('state.month.getTime()');
    const input = document.createElement('input'); document.body.append(input); input.focus();
    key(window, input, 't');
    assert.equal(window.eval('state.month.getTime()'), before, 'calendar shortcuts do not fire in inputs');
    key(window, input, 'n');
    assert.ok(document.getElementById('quickAddPop').hidden, 'N is not intercepted while typing');
    input.remove();
    const modal = document.createElement('div'); modal.className = 'modal open'; document.body.append(modal);
    key(window, document.body, 't');
    assert.equal(window.eval('state.month.getTime()'), before, 'calendar shortcuts do not fire while a modal is open');
    modal.remove();
  } finally { dom.window.close(); }
});

test('calendar arrow keys move the visible day focus', async () => {
  const dom = await loadApp('', window => {
    window.HTMLElement.prototype.getClientRects = function () { return [{ width: 10, height: 10 }]; };
  });
  try {
    const { window } = dom, { document } = window;
    const days = [...document.querySelectorAll('#calGrid [data-calendar-date]')];
    assert.ok(days.length >= 28);
    const first = days[10], date = new Date(first.dataset.calendarDate + 'T12:00:00'); date.setDate(date.getDate() + 1);
    const expected = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    first.focus(); key(window, first, 'ArrowRight');
    assert.equal(document.activeElement.dataset.calendarDate, expected);
    key(window, document.activeElement, 'Enter');
    assert.ok(document.getElementById('sharedDayModal').classList.contains('open'), 'Enter opens the focused day');
  } finally { dom.window.close(); }
});
