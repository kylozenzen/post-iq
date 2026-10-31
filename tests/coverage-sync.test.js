const test=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm'),fs=require('node:fs');
function api(pages){let calls=0;const ctx={console,Date,Set,Map,bufferConnectionGeneration:0, state:{scheduled:[]}, cache:{scheduled:{}},isCacheFresh:()=>false, saveCacheState:()=>{},callBuffer:async()=>pages[Math.min(calls++,pages.length-1)]}; vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/integrations/buffer-api.js','utf8'),ctx);ctx.realCallBuffer=ctx.callBuffer;ctx.callBuffer=async()=>pages[Math.min(calls++,pages.length-1)];ctx.getOrgId=async()=> 'org';ctx.getScheduledBounds=()=>({});return ctx;}
test('cap and repeated cursor remain incomplete, no infinite requests',async()=>{
 const edges=Array.from({length:50},(_,i)=>({node:{id:String(i),dueAt:'2027-01-01T12:00Z'}}));
 const ctx=api([{data:{posts:{edges,pageInfo:{hasNextPage:true,endCursor:'same'}}}}]);
 await ctx.getScheduledPosts({force:true});assert.equal(ctx.state.scheduledCoverage.complete,false); assert.equal(ctx.state.scheduled.length,50);
});
test('complete pagination retains distant dates instead of filtering to visible month',async()=>{
 const ctx=api([{data:{posts:{edges:[{node:{id:'far',dueAt:'2029-01-01T12:00Z'}}],pageInfo:{hasNextPage:false}}}}]);
 await ctx.getScheduledPosts({force:true});assert.equal(ctx.state.scheduledCoverage.complete,true);assert.equal(ctx.state.scheduled[0].id,'far');
});
test('partial GraphQL errors cannot be accepted as successful mutations',async()=>{
 const ctx=api([]);ctx.getActiveBufferToken=async()=>({token:'test',source:'manual'});ctx.fetch=async()=>({ok:true,json:async()=>({data:{createPost:null},errors:[{message:'partial failure'}]})});
 await assert.rejects(ctx.realCallBuffer('mutation {}'),/partial failure/);
});
