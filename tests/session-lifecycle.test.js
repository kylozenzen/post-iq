'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const connection = fs.readFileSync('js/integrations/buffer-connection.js', 'utf8');
function setup() {
  const dom = new JSDOM('<button id="connectBufferBtn"></button><button id="disconnectBufferBtn"></button><button id="signOutBufferBtn" hidden></button><button id="mobSignOutBufferBtn" hidden></button><button id="connectionSyncBtn" hidden></button><span id="lastSynced"></span>', {url:'https://postiq.test',runScripts:'outside-only'});
  const w = dom.window;
  Object.assign(w, {STORE_KEY:'manual',OAUTH_ACCESS_TOKEN_KEY:'access',OAUTH_REFRESH_TOKEN_KEY:'refresh',OAUTH_EXPIRES_AT_KEY:'expiry',OAUTH_TOKEN_TYPE_KEY:'type',OAUTH_SCOPE_KEY:'scope',OAUTH_RECONNECT_NEEDED_KEY:'reconnect',BUFFER_CLIENT_ID:'test-client',APP_VISITED_KEY:'visited',CACHE_KEY:'cache',bufferToken:'',tokenPanelOpen:false,qs:id=>w.document.getElementById(id),safeTrack:()=>{},setTokenPanelVisible:()=>{},setButtonClass:()=>{},updateNavTags:()=>{},initHomeView:()=>{},setSyncStatus:()=>{},showToast:()=>{},clearSyncedData:()=>{w.localStorage.removeItem('cache');w.cleared=true;},loadCacheState:()=>{},hydrateFromCache:()=>{}});
  vm.runInContext(connection, dom.getInternalVMContext());
  return {w,dom};
}
function grant(w) { w.localStorage.setItem('access','old'); w.localStorage.setItem('refresh','refresh-1'); }
test('OAuth survives new tabs; older session grants migrate together',()=>{
  const {w,dom}=setup();
  w.sessionStorage.setItem('access','legacy-access');w.sessionStorage.setItem('refresh','legacy-refresh');w.sessionStorage.setItem('expiry',String(Date.now()+600000));
  w.loadStoredToken();
  assert.equal(w.localStorage.getItem('access'),'legacy-access');assert.equal(w.sessionStorage.getItem('access'),null);
  w.sessionStorage.clear(); assert.equal(w.getStoredOAuthToken().refreshToken,'legacy-refresh');
  assert.equal(w.getBufferConnectionState().connected,true);dom.window.close();
});
test('parallel requests share one refresh and retain rotated grant',async()=>{
  const {w,dom}=setup();grant(w);let requests=0,finish;
  w.fetch=()=>{requests++;return new Promise(resolve=>finish=resolve);};
  const a=w.refreshBufferOAuthToken(),b=w.refreshBufferOAuthToken();assert.equal(requests,1);
  finish({ok:true,json:async()=>({access_token:'new',refresh_token:'refresh-2',expires_in:3600})});
  await Promise.all([a,b]);assert.equal(w.localStorage.getItem('access'),'new');assert.equal(w.localStorage.getItem('refresh'),'refresh-2');dom.window.close();
});
test('sign out clears both access methods and cannot be undone by a late refresh',async()=>{
  const {w,dom}=setup();grant(w);w.localStorage.setItem('manual','fallback');w.sessionStorage.setItem('manual','tab-fallback');w.localStorage.setItem('notes','keep-me');w.localStorage.setItem('cache','cached');w.localStorage.setItem('postiq_oauth_transaction','temporary');
  let finish;w.fetch=()=>new Promise(resolve=>finish=resolve);
  const refreshing=w.refreshBufferOAuthToken();w.disconnectBuffer();
  finish({ok:true,json:async()=>({access_token:'late',refresh_token:'late-refresh'})});
  await assert.rejects(refreshing,{code:'CONNECTION_CHANGED'});
  assert.equal(w.getStoredOAuthToken(),null);assert.equal(w.getManualBufferToken(),'');assert.equal(w.localStorage.getItem('notes'),'keep-me');assert.equal(w.localStorage.getItem('cache'),null);assert.equal(w.localStorage.getItem('postiq_oauth_transaction'),null);assert.equal(w.document.getElementById('signOutBufferBtn').hidden,true);dom.window.close();
});
for (const status of [429,503,408]) test(`refresh ${status} preserves connection for retry`,async()=>{
  const {w,dom}=setup();grant(w);w.fetch=async()=>({ok:false,status,json:async()=>({error:'temporarily_unavailable'})});
  await assert.rejects(w.refreshBufferOAuthToken(),{code:'REFRESH_NETWORK_ERROR'});assert.equal(w.localStorage.getItem('refresh'),'refresh-1');assert.equal(w.localStorage.getItem('access'),'old');dom.window.close();
});
test('revoked refresh grants require reconnect',async()=>{
  const {w,dom}=setup();grant(w);w.fetch=async()=>({ok:false,status:400,json:async()=>({error:'invalid_grant'})});
  await assert.rejects(w.refreshBufferOAuthToken(),{code:'AUTH_ERROR'});assert.equal(w.localStorage.getItem('access'),null);assert.equal(w.hasReconnectNeeded(),true);dom.window.close();
});
const {loadApp}=require('../scripts/smoke-browser');
test('Settings opens with focus, switches sections, and Escape returns focus',async()=>{
 const dom=await loadApp();const w=dom.window,d=w.document;
 try {
  const opener=d.getElementById('openSettings');opener.focus();opener.click();
  assert.equal(d.activeElement.id,'closeSettings');
  assert.equal(d.getElementById('settingsModal').getAttribute('role'),'dialog');
  d.getElementById('settingsTabCustomize').click();
  assert.equal(d.getElementById('settingsPanelCustomize').hidden,false);
  assert.equal(d.getElementById('settingsPanelConnection').hidden,true);
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(d.getElementById('settingsModal').hidden,true);
  assert.equal(d.activeElement,opener);
 } finally {w.close();}
});
test('help search finds sign-out guidance and handles no results',()=>{
 const html=fs.readFileSync('help/index.html','utf8');
 const dom=new JSDOM(html,{url:'https://postiq.test/help/',runScripts:'outside-only'}),w=dom.window;
 try {
  w.scrollTo=()=>{};
  vm.runInContext(fs.readFileSync('help/articles.js','utf8'),dom.getInternalVMContext());
  vm.runInContext(fs.readFileSync('help/help.js','utf8'),dom.getInternalVMContext());
  const input=w.document.getElementById('helpSearch');input.value='sign out';input.dispatchEvent(new w.Event('input'));
  assert.match(w.document.getElementById('articlesGrid').textContent,/Settings, Saved Preferences, and Sign Out/);
  input.value='zzzzzz-no-guide';input.dispatchEvent(new w.Event('input'));
  assert.match(w.document.getElementById('articlesGrid').textContent,/No guides match/);
 } finally {w.close();}
});

test('sign-out in another tab invalidates a pending refresh',async()=>{
 const {w,dom}=setup();grant(w);let finish;
 w.fetch=()=>new Promise(resolve=>finish=resolve);
 const refreshing=w.refreshBufferOAuthToken();
 w.localStorage.removeItem('access');w.localStorage.removeItem('refresh');
 w.handleBufferStorageChange(new w.StorageEvent('storage',{key:'refresh',storageArea:w.localStorage}));
 finish({ok:true,json:async()=>({access_token:'late',refresh_token:'late-refresh'})});
 await assert.rejects(refreshing,{code:'CONNECTION_CHANGED'});
 assert.equal(w.getStoredOAuthToken(),null);assert.equal(w.cleared,true);dom.window.close();
});
test('migration preserves a newer persistent OAuth grant over an old tab grant',()=>{
 const {w,dom}=setup();grant(w);w.sessionStorage.setItem('access','stale-tab');w.sessionStorage.setItem('refresh','stale-refresh');
 w.loadStoredToken();assert.equal(w.getStoredOAuthToken().accessToken,'old');assert.equal(w.sessionStorage.getItem('refresh'),null);dom.window.close();
});
