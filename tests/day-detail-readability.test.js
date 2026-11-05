const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../scripts/smoke-browser');

test('publishing on every channel clears calendar gaps, Today suggestions, and runway gaps for today', async () => {
  const dom = await loadApp();
  try {
    const w = dom.window;
    w.eval(`getBufferConnectionState=()=>({connected:true});
      state.channels=['a','b','c'].map(id=>({id,displayName:id,service:'threads'}));
      getPlanningSettings=()=>({postingDays:['SUN','MON','TUE','WED','THU','FRI','SAT'],channelPostingDays:Object.fromEntries(state.channels.map(c=>[c.id,['SUN','MON','TUE','WED','THU','FRI','SAT']]))});
      state.scheduled=[];state.syncState='idle';state.scheduledCoverage={complete:true,ts:Date.now()};
      state.published=state.channels.map(c=>({id:'sent-'+c.id,channelId:c.id,status:'sent',text:'Published',sentAt:new Date().toISOString()}));
      state.month=new Date();setCalendarView('month');`);
    assert.equal(w.eval('dayGapCount(new Date())'), 0);
    assert.equal(w.eval('getQueueCoverage(1).rows.every(r=>r.missingCount===0)'), true);
    const key = w.eval('fmtDate(new Date())');
    assert.equal(w.document.querySelector(`[data-calendar-date="${key}"] .day-gap-slot`), null);
    assert.equal(w.PostIQToday.openSlots(key, 1).length, 0);
    w.eval('state.published.pop()');
    assert.equal(w.eval('dayGapCount(new Date())'), 1);
    assert.equal(w.eval('dayGapCount(new Date(Date.now()+86400000))'), 3);
  } finally { dom.window.close(); }
});

test('day detail expands long posts independently and copies their full text', async () => {
  const dom = await loadApp();
  try {
    const w = dom.window;
    let copied;
    w.navigator.clipboard.writeText = async text => { copied = text; };
    w.eval(`openPostDetails(fmtDate(new Date()), {posts:[
      {id:'long',text:'Long post content. '.repeat(40),status:'scheduled',dueAt:new Date().toISOString()},
      {id:'short',text:'Short post',dueAt:new Date().toISOString()},
      {id:'lines',text:'One\\nTwo\\nThree\\nFour\\nFive',dueAt:new Date().toISOString()}
    ]})`);
    const cards = w.document.querySelectorAll('#sharedDayBody .snap-modal-post');
    const button = cards[0].querySelector('[data-expand-post]');
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(cards[1].querySelector('[data-expand-post]'), null);
    button.click();
    assert.equal(button.textContent, 'See less');
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    assert.equal(cards[0].querySelector('.snap-modal-post-body').classList.contains('is-collapsed'), false);
    assert.ok(cards[2].querySelector('.is-collapsed'));
    button.click();
    assert.equal(button.textContent, 'See more');
    assert.ok(cards[0].querySelector('.snap-modal-post-body').classList.contains('is-collapsed'));
    cards[0].querySelector('[data-copy]').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(copied, 'Long post content. '.repeat(40));
  } finally { dom.window.close(); }
});

test('sent posts use compact disclosures with icons; day actions precede posts and coverage', async () => {
  const dom = await loadApp();
  try {
    const w = dom.window;
    w.eval(`state.channels=[{id:'a',displayName:'Ben',service:'linkedin'}];
      state.scheduled=[{id:'next',channelId:'a',text:'Scheduled preview',dueAt:new Date().toISOString()}];
      state.published=[{id:'sent',channelId:'a',status:'sent',text:'Sent copy. '.repeat(100),sentAt:new Date().toISOString(),externalLink:'https://example.com/post'}];
      openCalendarDayDetails(new Date());`);
    const body = w.document.querySelector('#sharedDayBody');
    assert.ok(body.firstElementChild.classList.contains('day-detail-actions'));
    const cards = body.querySelectorAll('.snap-modal-post');
    assert.equal(cards.length, 2);
    for (const card of cards) assert.equal(card.querySelector('.platform-logo').getAttribute('aria-label'), 'LinkedIn');
    const sent = body.querySelector('.snap-modal-post.is-published');
    const details = sent.querySelector('details');
    assert.equal(details.open, false);
    assert.equal(sent.querySelector('[data-expand-post]'), null);
    details.querySelector('summary').click();
    assert.equal(details.open, true);
    assert.equal(details.querySelector('.snap-modal-post-body').textContent, 'Sent copy. '.repeat(100));
    assert.ok(details.querySelector('[data-copy]'));
    assert.equal(details.querySelector('a').getAttribute('href'), 'https://example.com/post');
    details.querySelector('summary').click();
    assert.equal(details.open, false);
  } finally { dom.window.close(); }
});
