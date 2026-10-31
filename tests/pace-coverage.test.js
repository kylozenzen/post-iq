'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/features/coverage');
const settings={postingDays:['MON','WED','FRI'],channelPostingDays:{a:['MON','WED','FRI']}};
const meta={complete:true,ts:Date.now()};
const options={now:'2026-11-02',zone:'America/Chicago',days:7,channels:['a'],settings,meta};
const posts=['2026-11-02','2026-11-04','2026-11-06'].map((date,i)=>({id:'p'+i,channelId:'a',dueAt:date+'T18:00:00Z',status:'scheduled'}));
test('MWF rhythm excludes Tuesday/Thursday and confirms only three planned slots',()=>{
 const result=C.calculate({...options,posts});const summary=C.summarize(result);
 assert.equal(summary.planned,3);assert.equal(summary.fullyCovered,true);
 assert.equal(result.rows.find(row=>row.date==='2026-11-03').status,'off');
 assert.equal(result.rows.find(row=>row.date==='2026-11-05').missingCount,0);
});
test('incomplete data cannot confidently report fully covered even when loaded posts cover all slots',()=>{
 for(const queueMeta of [{complete:false,ts:Date.now()},{complete:true,ts:1},undefined]) {
  const result=C.calculate({...options,posts,meta:queueMeta});const summary=C.summarize(result);
  assert.equal(summary.covered,3);assert.equal(summary.fullyCovered,false);assert.equal(summary.complete,false);
 }
});
test('days off and lighter targets alter only planning, retain scheduled posts and other channels',()=>{
 const immutablePosts=posts.map(post=>Object.freeze({...post}));Object.freeze(immutablePosts);
 const changed={...settings,daysOff:[{channelId:'a',start:'2026-11-03',end:'2026-11-05'}],channelTargets:{a:2},targetOverrides:[{channelId:'a',start:'2026-11-06',end:'2026-11-08',target:0}]};
 const result=C.calculate({...options,posts:immutablePosts,channels:['a','b'],settings:changed});
 assert.equal(result.rows.find(row=>row.date==='2026-11-04'&&row.channelId==='a').target,0);
 assert.equal(result.rows.find(row=>row.date==='2026-11-04'&&row.channelId==='b').target,1);
 assert.equal(result.rows.find(row=>row.date==='2026-11-06'&&row.channelId==='a').confirmedCount,1);
 assert.equal(result.rows.find(row=>row.date==='2026-11-02'&&row.channelId==='a').missingCount,1);
 assert.deepEqual(immutablePosts,posts);
});
test('multiple targets use actual per-channel post counts and latest matching override',()=>{
 const settings={postingDays:['MON'],channelTargets:{a:3},targetOverrides:[{channelId:'a',start:'2026-11-02',end:'2026-11-08',target:2},{channelId:'a',start:'2026-11-02',end:'2026-11-02',target:1}]};
 const result=C.calculate({...options,channels:['a','b'],posts:[posts[0]],settings});
 assert.equal(result.rows[0].status,'scheduled');assert.equal(result.rows[1].status,'gap');
 assert.equal(result.rows[2].status,'off');
});
test('local draft dates and duplicate post IDs do not inflate confirmed coverage',()=>{
 const result=C.calculate({...options,settings:{...settings,channelTargets:{a:2}},posts:[posts[0],posts[0],{id:'draft',channelId:'a',dueAt:posts[0].dueAt,status:'draft'}]});
 assert.equal(result.rows[0].confirmedCount,1);assert.equal(result.rows[0].missingCount,1);
});
