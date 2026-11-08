const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadApp}=require('../scripts/smoke-browser');

const tour=fs.readFileSync('js/features/tour.js','utf8');

test('Shelf run-through covers each Shelf tab and never points at Settings',()=>{
 for(const id of ['shelf-notebook','shelf-snippets','shelf-past-posts','shelf-trending']) assert.match(tour,new RegExp(`id: '${id}'`));
 const shelfBlock=tour.slice(tour.indexOf('const SHELF_STEPS'),tour.indexOf('function relevantSteps'));
 assert.doesNotMatch(shelfBlock,/Settings/,'Shelf copy does not send people to Settings');
 assert.match(tour,/if \(step\.sub\) window\.setIdeasTab\?\.\(step\.sub\);/,'steps switch the Shelf tab');
 assert.match(tour,/options\.steps \|\| relevantSteps\(\)/,'start accepts a step list');
});

test('first Shelf visit offers the run-through once',async()=>{
 const dom=await loadApp('');
 try{
  const w=dom.window,d=w.document;
  w.eval("setWorkspacePreference('ideas', true); activateView('ideasView','test')");
  await new Promise(r=>setTimeout(r,800));
  const tip=d.querySelector('.shelf-tip');
  assert.ok(tip,'tip appears on first Shelf open');
  assert.match(tip.textContent,/quick run-through of Shelf/);
  tip.querySelector('[data-shelf-tip="later"]').click();
  assert.equal(d.querySelector('.shelf-tip'),null);
  assert.equal(w.localStorage.getItem('postiq_shelf_tip_seen'),'1');
  w.eval("activateView('libraryView','test')");
  await new Promise(r=>setTimeout(r,800));
  assert.equal(d.querySelector('.shelf-tip'),null,'not offered again');
 }finally{dom.window.close();}
});
