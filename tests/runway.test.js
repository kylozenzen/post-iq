'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const runway = require('../js/features/runway.js');

// Fixed "now": 2026-10-28 09:00 local. Tomorrow is 10-29.
const now = new Date(2026, 9, 28, 9, 0, 0);
const at = (dayOffset, hour = 12, channel = 'li') => ({
  due_at: new Date(2026, 9, 28 + dayOffset, hour, 0, 0).toISOString(),
  channel_id: channel,
});

test('no posts gives zero runway', () => {
  assert.equal(runway.computeRunway([], { now }), 0);
});

test('todays posts do not count toward runway', () => {
  assert.equal(runway.computeRunway([at(0, 18)], { now }), 0);
});

test('consecutive days from tomorrow, stopping at the first gap', () => {
  const posts = [1, 2, 3, 4, 5].map(d => at(d));
  assert.equal(runway.computeRunway(posts, { now }), 5);
});

test('account runway is the weakest channel, not the union', () => {
  const posts = [1, 2, 3, 4, 5].map(d => at(d, 12, 'li')).concat([at(6, 12, 'th')]);
  assert.equal(runway.computeRunway(posts, { now }), 0);
});

test('per-channel runway stops at that channels own gap', () => {
  const posts = [1, 2, 3, 4, 5].map(d => at(d, 12, 'li')).concat([at(6, 12, 'th')]);
  const per = runway.computeChannelRunways(posts, ['li', 'th', 'bs'], { now });
  assert.deepEqual(per, { li: 5, th: 0, bs: 0 });
});

test('accepts camelCase and snake_case due fields', () => {
  const posts = [{ dueAt: new Date(2026, 9, 29, 12).toISOString(), channelId: 'li' }];
  assert.equal(runway.computeRunway(posts, { now }), 1);
});

test('classifyRunway maps counts to statuses', () => {
  assert.equal(runway.classifyRunway(0), 'empty');
  assert.equal(runway.classifyRunway(2), 'low');
  assert.equal(runway.classifyRunway(3), 'healthy');
});

test('break threshold is 14 days', () => {
  assert.equal(runway.RUNWAY_BREAK_THRESHOLD_DAYS, 14);
});
