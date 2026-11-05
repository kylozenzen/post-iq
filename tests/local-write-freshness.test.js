'use strict';
// A local drag/save must not look like a fresh Buffer read. Only a real
// sync (getScheduledPosts) may reset the cache timestamp.
const test = require('node:test'), assert = require('node:assert/strict');
const { loadApp } = require('../scripts/smoke-browser');
const original = '2027-01-10T14:30:00.000Z', moved = '2027-01-12T14:30:00.000Z';
const LAST_BUFFER_READ = 1_700_000_000_000;

async function setup(fn) {
  const dom = await loadApp();
  try { await fn(dom.window); } finally { dom.window.close(); }
}

test('dragging a post keeps the last Buffer-read timestamp', () => setup(async w => {
  w.callBuffer = async (query, variables) => ({ data: { editPost: { __typename: 'PostActionSuccess', post: { id: 'p', dueAt: variables.input.dueAt } } } });
  const coverage = { complete: true, ts: LAST_BUFFER_READ, count: 1 };
  w.eval(`state.scheduled = [{ id: 'p', text: 'Hi', dueAt: ${JSON.stringify(original)}, status: 'scheduled', channelId: 'c' }];
          state.scheduledCoverage = ${JSON.stringify(coverage)};
          cache.scheduled = { value: state.scheduled, ts: ${LAST_BUFFER_READ}, coverage: state.scheduledCoverage };`);
  await w.PostIQDrag.dropPost('p', '2027-01-10', '2027-01-12');
  assert.equal(w.eval("state.scheduled[0].dueAt") !== original, true, 'calendar shows the moved time');
  assert.equal(w.eval('cache.scheduled.ts'), LAST_BUFFER_READ, 'cache keeps the Buffer-read time');
  assert.equal(w.eval('state.scheduledCoverage ? state.scheduledCoverage.ts : null'), LAST_BUFFER_READ, 'coverage keeps the Buffer-read time');
}));
