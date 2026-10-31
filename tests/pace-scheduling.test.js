'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadApp}=require('../scripts/smoke-browser');
async function scenario(fn){const dom=await loadApp();try{
 const w=dom.window;
 w.eval("state.channels=[{id:'a',displayName:'A',service:'linkedin'}];state.scheduled=[];getBufferConnectionState=()=>({connected:true});state.scheduledCoverage={complete:true,ts:Date.now()};renderChannelSelects()");
 w.Discord=null;w.document.querySelector('#composerEditor').innerHTML='A test draft that must not be sent to real Buffer.';
 await fn(w);
}finally{dom.window.close();}}
test('scheduled coverage changes only after a successful Buffer post response',async()=>scenario(async w=>{
 let resolve;w.callBuffer=()=>new Promise(done=>{resolve=done;});
 const request=w.composerSend('queue');await Promise.resolve();
 assert.equal(w.eval('state.scheduled.length'),0);
 const date=w.PostIQCoverage.addDays(w.PostIQCoverage.dayKey(new Date()),1);
 resolve({data:{createPost:{__typename:'PostActionSuccess',post:{id:'confirmed',channelId:'a',dueAt:date+'T18:00:00Z',text:'Server confirmed'}}}});
 await request;assert.equal(w.eval('state.scheduled.length'),1);
 const coverage=w.PostIQCoverage.calculate({posts:w.eval('state.scheduled'),channels:['a'],now:date,days:1,meta:{complete:true,ts:Date.now()}});
 assert.equal(coverage.rows[0].status,'scheduled');
}));
test('Buffer rejection leaves queue coverage and source draft unchanged',async()=>scenario(async w=>{
 w.callBuffer=async()=>({data:{createPost:{__typename:'InvalidInputError',message:'Rejected by Buffer'}}});
 await w.composerSend('queue');assert.equal(w.eval('state.scheduled.length'),0);
 assert.match(w.document.querySelector('#composerEditor').textContent,/A test draft/);
 assert.match(w.document.querySelector('#composerStatus').textContent,/Rejected by Buffer/);
}));
test('a saved Buffer draft does not become scheduled coverage even if a response contains a date',async()=>scenario(async w=>{
 w.callBuffer=async()=>({data:{createPost:{__typename:'PostActionSuccess',post:{id:'draft-only',channelId:'a',dueAt:new Date().toISOString()}}}});
 await w.composerSend('draft');assert.equal(w.eval('state.scheduled.length'),0);
}));
test('a successful queue response without a confirmed date leaves dated coverage incomplete',async()=>scenario(async w=>{
 w.callBuffer=async()=>({data:{createPost:{__typename:'PostActionSuccess',post:{id:'queued-no-date',channelId:'a'}}}});
 await w.composerSend('queue');assert.equal(w.eval('state.scheduled.length'),0);assert.equal(w.eval('state.scheduledCoverage.complete'),false);
 assert.match(w.document.querySelector('#composerStatus').textContent,/Added to queue/);
}));
