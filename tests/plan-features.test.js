'use strict';

// Structural checks for the Plan/Compose additions. Behaviour that depends on
// the DOM is covered by the browser smoke script; these fail fast if wiring
// is removed from app.html or the built-in note types drift.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const html = fs.readFileSync('app.html', 'utf8');
const runtime = fs.readFileSync('js/core/runtime.js', 'utf8');
const calendar = fs.readFileSync('js/features/calendar.js', 'utf8');
const composer = fs.readFileSync('js/features/composer-resources.js', 'utf8');

test('health strip lives in its own Queue Health tool', () => {
  const view = html.slice(html.indexOf('id="queueHealthView"'), html.indexOf('<!-- ══════════ COMPOSE'));
  assert.match(view, /id="planHealthStrip"/);
});

test('runway and plan-health scripts load after calendar.js and before composer', () => {
  const cal = html.indexOf('js/features/calendar.js');
  const runway = html.indexOf('js/features/runway.js');
  const health = html.indexOf('js/features/plan-health.js');
  const compose = html.indexOf('js/features/composer.js');
  assert.ok(cal > 0 && runway > cal && health > runway && compose > health);
});

test('plan-health stylesheet is linked', () => {
  assert.match(html, /css\/app\/plan-health\.css/);
});

test('inspiration and planned-action note types exist as built-ins', () => {
  assert.match(runtime, /id: 'inspiration'/);
  assert.match(runtime, /id: 'action'/);
  assert.match(runtime, /BUILTIN_NOTE_TYPE_IDS = \['inspiration', 'action'\]/);
});

test('built-in note types are merged once for saved lists', () => {
  assert.match(calendar, /NOTE_TYPES_BUILTINS_FLAG/);
  assert.match(calendar, /function ensureBuiltinNoteTypes/);
});

test('planned actions expose draft and done controls only for action notes', () => {
  assert.match(calendar, /const isAction = isActionNote\(n\)/);
  assert.match(calendar, /data-draft-note=/);
  assert.match(calendar, /data-toggle-done=/);
});

test('Compose reads today\'s calendar notes and can insert them', () => {
  assert.match(composer, /function readTodayNotes/);
  assert.match(composer, /insert-day-note/);
});

test('Notebook cards can be saved to a date as inspiration', () => {
  assert.match(composer, /save-notebook-to-date/);
  assert.match(composer, /addNoteForDateKey\(dateKey, text, 'inspiration'\)/);
});

test('thread splitter is fully removed from the composer', () => {
  const bootstrap = fs.readFileSync('js/core/bootstrap.js', 'utf8');
  assert.doesNotMatch(html, /splitModePanel|data-cmode="split"|threadInput|Thread Splitter/);
  assert.doesNotMatch(bootstrap, /THREAD SPLITTER|initSplitMode|splitThreadText/);
});

test('today\'s notes mount sits above the editor, not inside the drawer', () => {
  const mount = html.indexOf('id="composerDayNotes"');
  const editor = html.indexOf('id="composerEditor"');
  assert.ok(mount > 0 && mount < editor, 'mount must precede the editor');
  assert.match(composer, /function renderDayNotes/);
  assert.match(composer, /refreshDayNotes/);
});

test('calendar edits refresh the composer notes strip', () => {
  assert.match(calendar, /PostIQComposerResources\?\.refreshDayNotes/);
});

test('health panel is collapsible and remembers its state per browser', () => {
  const health = fs.readFileSync('js/features/plan-health.js', 'utf8');
  assert.match(health, /data-health-toggle/);
  assert.match(health, /aria-expanded/);
  assert.match(health, /postiqPlanHealthOpen/);
});
