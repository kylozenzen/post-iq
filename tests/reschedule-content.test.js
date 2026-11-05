'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { loadApp } = require('../scripts/smoke-browser');
const original = '2027-01-10T14:30:00.000Z', moved = '2027-01-12T14:30:00.000Z';
const plain = value => JSON.parse(JSON.stringify(value));
async function setup(fn) {
  const dom = await loadApp();
  try { await fn(dom.window); } finally { dom.window.close(); }
}
function fakeBuffer(w, current, failure = 'InvalidInputError') {
  const calls = [];
  w.callBuffer = async (query, variables) => {
    calls.push({ query, variables: plain(variables) });
    if (query.includes('query RescheduleSource')) {
      if (current instanceof Error) throw current;
      return { data: { post: current } };
    }
    if (calls.length === 1) return { data: { editPost: { __typename: failure, message: failure === 'InvalidInputError' ? 'Post needs text or media' : 'Try later' } } };
    return { data: { editPost: { __typename: 'PostActionSuccess', post: { id: 'p', dueAt: variables.input.dueAt } } } };
  };
  return calls;
}

test('minimal reschedule remains minimal when Buffer accepts it', () => setup(async w => {
  const calls = [];
  w.callBuffer = async (query, variables) => { calls.push(plain(variables.input)); return { data: { editPost: { __typename: 'PostActionSuccess', post: { id: 'p', dueAt: moved } } } }; };
  await w.rescheduleBufferPost('p', moved, original);
  assert.deepEqual(calls, [{ id: 'p', mode: 'customScheduled', dueAt: moved }]);
}));

test('empty-content rejection reads fresh text and retries once without touching media or service settings', () => setup(async w => {
  const calls = fakeBuffer(w, { id: 'p', status: 'scheduled', dueAt: original, text: 'Latest copy edited in Buffer', assets: [{ __typename: 'VideoAsset' }] });
  await w.rescheduleBufferPost('p', moved, original);
  assert.equal(calls.length, 3);
  assert.match(calls[1].query, /post\(input:\{id:\$id\}\)/);
  assert.deepEqual(calls[2].variables.input, { id: 'p', mode: 'customScheduled', dueAt: moved, text: 'Latest copy edited in Buffer' });
}));

test('media-only retry preserves all asset order, alt text, user tags and video frame without video thumbnailUrl', () => setup(async w => {
  const assets = [
    { __typename: 'ImageAsset', source: 'https://example.com/a.jpg', thumbnail: 'https://example.com/a-small.jpg', image: { altText: 'An otter', userTags: [{ handle: 'ben', x: 0.2, y: 0.4 }] } },
    { __typename: 'VideoAsset', source: 'https://example.com/v.mp4', thumbnail: 'https://example.com/v.jpg', video: { title: 'Tour', thumbnailOffset: 1400 } },
    { __typename: 'DocumentAsset', source: 'https://example.com/d.pdf', thumbnail: 'https://example.com/d.jpg', document: { title: 'Guide' } }
  ];
  const calls = fakeBuffer(w, { id: 'p', status: 'scheduled', dueAt: original, text: '', assets });
  await w.rescheduleBufferPost('p', moved, original);
  assert.deepEqual(calls[2].variables.input.assets, [
    { image: { url: assets[0].source, thumbnailUrl: assets[0].thumbnail, metadata: assets[0].image } },
    { video: { url: assets[1].source, metadata: assets[1].video } },
    { document: { url: assets[2].source, thumbnailUrl: assets[2].thumbnail, title: 'Guide' } }
  ]);
  assert.equal('metadata' in calls[2].variables.input, false);
}));

test('rate limits, stale schedules, changed status, missing content and unsupported media do not trigger unsafe retries', () => setup(async w => {
  const cases = [
    [null, 'LimitReachedError'],
    [{ id: 'p', status: 'sent', dueAt: original, text: 'Published' }],
    [{ id: 'p', status: 'scheduled', dueAt: moved, text: 'Changed schedule' }],
    [{ id: 'p', status: 'scheduled', dueAt: original, text: '', assets: [] }],
    [{ id: 'p', status: 'scheduled', dueAt: original, text: '', assets: [{ __typename: 'UnknownAsset', source: 'https://example.com/x' }] }],
    [new Error('Read failed')]
  ];
  for (const [current, error] of cases) {
    const calls = fakeBuffer(w, current, error);
    await assert.rejects(w.rescheduleBufferPost('p', moved, original));
    assert.equal(calls.filter(c => c.query.includes('mutation EditPost')).length, 1);
  }
}));

test('drag fallback and Undo each read current content; failed reads restore the original calendar date', () => setup(async w => {
  w.eval(`state.scheduled=[{id:'p',channelId:'a',text:'Cached copy',dueAt:'${original}'}];state.channels=[{id:'a',service:'linkedin'}]`);
  let serverDue = original, reads = 0;
  const edits = [];
  w.callBuffer = async (query, variables) => {
    if (query.includes('query RescheduleSource')) return { data: { post: { id: 'p', status: 'scheduled', dueAt: serverDue, text: 'Fresh ' + (++reads) } } };
    const input = plain(variables.input); edits.push(input);
    if (!input.text) return { data: { editPost: { __typename: 'InvalidInputError', message: 'Needs text or media' } } };
    serverDue = input.dueAt;
    return { data: { editPost: { __typename: 'PostActionSuccess', post: { id: 'p', dueAt: serverDue } } } };
  };
  await w.PostIQDrag.dropPost('p', '2027-01-10', '2027-01-12');
  assert.equal(edits[1].text, 'Fresh 1');
  w.document.querySelector('.toast-action-btn').click();
  for (let i = 0; i < 10 && reads < 2; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(edits[3].text, 'Fresh 2');
  assert.equal(serverDue, original);
  fakeBuffer(w, new Error('Read failed'));
  await w.PostIQDrag.dropPost('p', '2027-01-10', '2027-01-12');
  assert.equal(w.eval('state.scheduled[0].dueAt'), original);
  assert.equal(w.eval('!!state.scheduled[0]._moving'), false);
}));
