const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('concurrent composer sends submit once and failure preserves draft',async()=>{
 const elements={composerEditor:{innerHTML:'Retain this draft'},composerChannel:{value:'channel'},composerWhen:{value:''},composerStatus:{textContent:''}};
 let rejectSend, calls=0;
 const ctx={console,qs:id=>elements[id],editorToText:s=>s,getBufferConnectionState:()=>({connected:true}),getStoredOAuthToken:()=>null,mediaState:{},showToast:()=>{},getErrorMessage:e=>e.message,isAuthError:()=>false,safeTrack:()=>{}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/integrations/post-creation.js','utf8'),ctx);
 ctx.createPost=()=>{calls++;return new Promise((_,reject)=>{rejectSend=reject;});};
 const first=ctx.composerSend('queue');await ctx.composerSend('queue');assert.equal(calls,1);
 rejectSend(new Error('offline'));await first;
 assert.equal(elements.composerEditor.innerHTML,'Retain this draft');assert.match(elements.composerStatus.textContent,/Failed: offline/);
});
