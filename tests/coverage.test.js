const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/features/coverage');
const base = {now:new Date('2026-10-30T12:00Z'), zone:'America/Chicago', channels:[{id:'a'},{id:'b'}], days:4, meta:{complete:true,ts:Date.now()},settings:{postingDays:['FRI','MON'],channelPostingDays:{b:[]}}};
test('custom cadence and intentional nonposting days remain distinct',()=>{
 const {rows}=C.calculate(base);
 assert.equal(rows.find(r=>r.date==='2026-10-31'&&r.channelId==='a').status,'off');
 assert.equal(rows.find(r=>r.channelId==='b').status,'off');
 assert.equal(rows[0].status,'gap');
});
test('one channel cannot cover another',()=>{
 const {rows}=C.calculate({...base,settings:{postingDays:['FRI']},posts:[{channelId:'a',dueAt:'2026-10-30T14:00Z'}]});
 assert.equal(rows[0].status,'scheduled'); assert.equal(rows[1].status,'gap');
});
test('midnight, DST and date-only notes',()=>{
 assert.equal(C.dayKey('2026-11-01T04:30Z','America/Chicago'),'2026-10-31');
 assert.equal(C.dayKey('2026-11-01T07:30Z','America/Chicago'),'2026-11-01');
 assert.equal(C.dayKey('2026-11-01','America/Chicago'),'2026-11-01');
 assert.equal(C.addDays('2026-11-01',1),'2026-11-02');
});
test('unknown and stale data never imply gaps',()=>{
 assert.equal(C.calculate({...base,meta:{complete:false,ts:Date.now()}}).rows[0].status,'incomplete');
 assert.equal(C.calculate({...base,meta:{complete:true,ts:1}}).rows[0].status,'stale');
 assert.equal(C.calculate({...base,connected:false}).rows[0].status,'disconnected');
});
test('runway skips off days but stops at unknown days',()=>{
 const rows=['scheduled','off','scheduled','incomplete'].map(status=>({channelId:'a',status}));
 assert.equal(C.runway(rows,'a'),1);
});
