'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { loadApp } = require('../scripts/smoke-browser');
const plain = x => JSON.parse(JSON.stringify(x));
const tick = () => new Promise(r => setTimeout(r, 15));
async function app(fn) {
  const dom = await loadApp();
  try {
    const w = dom.window;
    const server = { id: 'p', channelId: 'a', text: 'Latest Buffer copy', status: 'scheduled', dueAt: '2027-01-10T14:30:00.000Z', assets: [], metadata: null };
    const edits = [];
    w.eval(`getBufferConnectionState=()=>({connected:true});state.channels=[{id:'a',displayName:'Ben',service:'linkedin'}];state.scheduled=[{id:'p',channelId:'a',text:'Old cached copy',dueAt:'2027-01-10T14:30:00.000Z'}];createPost=()=>{throw new Error('Must not create a new post')};syncBuffer=async()=>{};`);
    w.readBufferPostForEdit = async () => plain(server);
    w.callBuffer = async (query, vars) => {
      assert.match(query, /mutation EditPost/);
      const input = plain(vars.input); edits.push(input);
      Object.assign(server, input.text === undefined ? {} : { text: input.text });
      if (input.dueAt) server.dueAt = input.dueAt;
      if (input.saveToDraft) server.status = 'draft';
      if (input.mode === 'shareNow') server.status = 'sent';
      return { data: { editPost: { __typename: 'PostActionSuccess', post: plain(server) } } };
    };
    w.eval(`openCalendarDayDetails(new Date('2027-01-10T12:00:00'))`);
    const root = w.document.querySelector('#sharedDayBody');
    const open = async () => { root.querySelector('[data-edit-scheduled]').click(); await tick(); return root.querySelector('[data-scheduled-editor]'); };
    await fn({ w, server, edits, root, open });
  } finally { dom.window.close(); }
}

test('edit loads fresh text, changes the existing post, and leaves its media/settings and new composer draft alone', () => app(async ({ w, server, edits, open }) => {
  server.assets = [{ __typename: 'ImageAsset', source: 'https://example.com/photo.jpg', thumbnail: 'https://example.com/photo.jpg', image: { altText: 'Tour' } }];
  w.document.querySelector('#composerEditor').textContent = 'Unfinished new post';
  w.localStorage.setItem('postiq_composer_draft_v1', '{"html":"Unfinished new post"}');
  const box = await open();
  assert.equal(box.querySelector('textarea').value, server.text);
  box.querySelector('textarea').value = 'Revised copy';
  box.querySelector('[data-edit-action="save"]').click(); await tick();
  assert.deepEqual(edits, [{ id: 'p', text: 'Revised copy' }]);
  assert.equal(w.eval('state.scheduled[0].text'), 'Revised copy');
  assert.equal(w.document.querySelector('#composerEditor').textContent, 'Unfinished new post');
  assert.equal(w.localStorage.getItem('postiq_composer_draft_v1'), '{"html":"Unfinished new post"}');
}));

test('reschedule changes time on the existing post without sending unchanged text or metadata', () => app(async ({ w, edits, open }) => {
  const box = await open();
  box.querySelector('[data-edit-when]').value = '2027-01-12T11:45';
  box.querySelector('[data-edit-action="save"]').click(); await tick();
  assert.deepEqual(edits, [{ id: 'p', mode: 'customScheduled', dueAt: new Date('2027-01-12T11:45').toISOString() }]);
  assert.equal(w.eval('state.scheduled[0].dueAt'), edits[0].dueAt);
}));

test('move to drafts removes the same post from the scheduled calendar', () => app(async ({ w, edits, open }) => {
  const box = await open(); box.querySelector('[data-edit-action="draft"]').click(); await tick();
  assert.deepEqual(edits, [{ id: 'p', saveToDraft: true }]);
  assert.equal(w.eval('state.scheduled.length'), 0);
}));

test('publish now requires confirmation and submits once', () => app(async ({ w, edits, open }) => {
  const box = await open(); box.querySelector('[data-edit-action="publish"]').click(); await tick();
  assert.equal(edits.length, 0);
  assert.equal(box.querySelector('[data-publish-confirm]').hidden, false);
  box.querySelector('[data-edit-action="keep"]').click();
  assert.equal(box.querySelector('[data-publish-confirm]').hidden, true);
  box.querySelector('[data-edit-action="publish"]').click();
  const button = box.querySelector('[data-edit-action="confirm-publish"]'); button.click(); button.click(); await tick();
  assert.deepEqual(edits, [{ id: 'p', mode: 'shareNow' }]);
  assert.equal(w.eval('state.scheduled.length'), 0);
}));

test('changed remote content stops a save and preserves the user edits', () => app(async ({ server, edits, open }) => {
  const box = await open(); box.querySelector('textarea').value = 'My unsaved changes'; server.text = 'Edited by someone else';
  box.querySelector('[data-edit-action="save"]').click(); await tick();
  assert.equal(edits.length, 0); assert.equal(box.querySelector('textarea').value, 'My unsaved changes');
  assert.match(box.querySelector('[data-edit-status]').textContent, /changed in Buffer/);
}));

test('mutation failure keeps the editor and schedule intact', () => app(async ({ w, open }) => {
  w.callBuffer = async () => ({ data: { editPost: { __typename: 'LimitReachedError', message: 'Channel limit reached' } } });
  const box = await open(); box.querySelector('textarea').value = 'Keep my changes';
  box.querySelector('[data-edit-action="save"]').click(); await tick();
  assert.equal(box.hidden, false); assert.match(box.querySelector('[data-edit-status]').textContent, /Channel limit/);
  assert.equal(box.querySelector('textarea').value, 'Keep my changes');
  assert.equal(w.eval('state.scheduled[0].dueAt'), '2027-01-10T14:30:00.000Z');
}));

test('threads keep their text read-only but can still be rescheduled', () => app(async ({ server, edits, open }) => {
  server.metadata = { threadCount: 2, thread: [{ text: 'First' }, { text: 'Second' }] };
  const box = await open(); assert.equal(box.querySelector('textarea').disabled, true);
  box.querySelector('[data-edit-when]').value = '2027-01-12T11:45';
  box.querySelector('[data-edit-action="save"]').click(); await tick();
  assert.equal(edits.length, 1); assert.equal('text' in edits[0], false); assert.equal('metadata' in edits[0], false);
}));

test('shared snapshots and published posts do not offer editing', () => app(async ({ w, root }) => {
  w.eval(`openSharedDayDetails('2027-01-10',{posts:[{id:'p',text:'Snapshot',dueAt:'2027-01-10T14:30:00Z'}]})`);
  assert.equal(root.querySelector('[data-edit-scheduled]'), null);
  w.eval(`openCalendarPostDetails('2027-01-10',[{id:'p',text:'Published',status:'sent',sentAt:'2027-01-10T14:30:00Z'}])`);
  assert.equal(root.querySelector('[data-edit-scheduled]'), null);
}));

test('connection changes during a read prevent mutations', () => app(async ({ w, edits, open }) => {
  const box = await open(); box.querySelector('textarea').value = 'My edit';
  w.readBufferPostForEdit = async () => { w.eval('bufferConnectionGeneration++'); return {}; };
  box.querySelector('[data-edit-action="save"]').click(); await tick();
  assert.equal(edits.length, 0); assert.match(box.querySelector('[data-edit-status]').textContent, /connection changed/);
}));
