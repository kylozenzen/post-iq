'use strict';
// External events are contextual calendar items, never scheduled Buffer posts.
window.PostIQExternalCalendars = (() => {
  const STORAGE='postiq_external_calendars_v1';
  const MAX_FEEDS=5, TTL=60*60*1000;
  let feeds=[], eventsByDate=new Map(), requestBusy=false;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function load() {
    try { const v=JSON.parse(localStorage.getItem(STORAGE)||'[]'); feeds=Array.isArray(v)?v.filter(x=>typeof x.url==='string').slice(0,MAX_FEEDS):[]; } catch {feeds=[];}
    feeds=feeds.map(x=>({...x,events:Array.isArray(x.events)?x.events.slice(0,400):[]}));
    rebuild();
  }
  function save() { try { localStorage.setItem(STORAGE,JSON.stringify(feeds)); } catch {} }
  function rebuild() {
    eventsByDate=new Map();
    for(const feed of feeds) for(const event of feed.events||[]) {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(event.date||''))continue;
      const list=eventsByDate.get(event.date)||[];
      list.push({...event,feedName:feed.name,sourceId:feed.id});
      eventsByDate.set(event.date,list);
    }
  }
  function cellHtml(key) {
    const list=eventsByDate.get(key)||[];
    if(!list.length)return '';
    return '<div class="external-calendar-items">'+list.slice(0,2).map(e=>'<div class="external-calendar-pill" title="'+esc(e.feedName+': '+e.title)+'"><span aria-hidden="true">◷</span> '+esc(e.title)+'</div>').join('')+(list.length>2?'<span class="external-calendar-more">+'+(list.length-2)+' events</span>':'')+'</div>';
  }
  function dayHtml(key) {
    const list=eventsByDate.get(key)||[];
    if(!list.length)return '';
    return '<section class="external-calendar-day"><h3>Other calendars</h3>'+list.map(e=>'<div class="external-calendar-entry"><strong>'+esc(e.title)+'</strong><small>'+esc(e.feedName)+' · Read-only</small></div>').join('')+'</section>';
  }
  function setStatus(message,problem=false) {const el=$('externalCalendarStatus');if(el){el.textContent=message;el.classList.toggle('is-error',problem);}}
  async function refreshOne(feed,force=false) {
    if(!force && feed.updated && Date.now()-feed.updated<TTL)return;
    const res=await fetch('/.netlify/functions/calendar-feed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:feed.url})});
    const data=await res.json();
    if(!res.ok)throw Error(data.error||'Unable to load calendar feed');
    feed.events=(data.events||[]).filter(e=>e.date&&e.title).slice(0,400);
    feed.updated=Date.now();
    feed.error='';
    feed.recurringSkipped=!!data.recurringSkipped;
  }
  async function refresh(force=false) {
    if(requestBusy||!feeds.length)return;
    requestBusy=true;
    setStatus('Refreshing calendar feeds…');
    let failed=0;
    for(const feed of feeds) {
      try{await refreshOne(feed,force);}catch(e){feed.error=e.message;failed++;}
    }
    save();rebuild();renderList();
    if(typeof renderCalendar==='function')renderCalendar();
    setStatus(failed?failed+' feed(s) could not refresh. Check the source link.':'Calendars updated.',failed>0);
    requestBusy=false;
  }
  async function add() {
    const url=$('externalCalendarUrl')?.value.trim(),name=$('externalCalendarName')?.value.trim()||'External calendar';
    if(!url){setStatus('Paste an ICS calendar URL first.',true);return;}
    if(feeds.length>=MAX_FEEDS){setStatus('Maximum of five feeds. Remove one first.',true);return;}
    if(feeds.some(f=>f.url===url)){setStatus('This feed has already been added.',true);return;}
    try{
      const parsed=new URL(url);
      if(parsed.protocol!=='https:')throw Error();
    }catch{setStatus('Use a complete HTTPS feed URL.',true);return;}
    const feed={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),name:name.slice(0,60),url,events:[]};
    feeds.push(feed);save();renderList();
    $('externalCalendarUrl').value='';
    $('externalCalendarName').value='';
    await refresh(true);
  }
  function remove(id) {
    feeds=feeds.filter(f=>f.id!==id);save();rebuild();renderList();
    if(typeof renderCalendar==='function')renderCalendar();
    setStatus('Calendar removed.');
  }
  function renderList() {
    const list=$('externalCalendarList');if(!list)return;
    list.innerHTML=feeds.length?feeds.map(f=>'<li><div><strong>'+esc(f.name)+'</strong><small>'+esc(f.error||((f.events||[]).length+' events loaded')+(f.recurringSkipped?' · Repeating dates may be incomplete':''))+'</small></div><button type="button" class="btn sm ghost" data-feed-remove="'+esc(f.id)+'">Remove</button></li>').join(''):'<li class="external-calendar-none">No feeds connected yet.</li>';
    list.querySelectorAll('[data-feed-remove]').forEach(b=>b.addEventListener('click',()=>remove(b.dataset.feedRemove)));
  }
  function open() {renderList();const dlg=$('externalCalendarDialog');if(dlg&&!dlg.open)dlg.showModal();}
  function init(){
    load();
    $('calendarFeedsBtn')?.addEventListener('click',()=>{$('calendarFilters')?.removeAttribute('open');open();});
    $('externalCalendarClose')?.addEventListener('click',()=>$('externalCalendarDialog')?.close());
    $('externalCalendarAdd')?.addEventListener('click',add);
    $('externalCalendarRefresh')?.addEventListener('click',()=>refresh(true));
    $('externalCalendarDialog')?.addEventListener('click',e=>{if(e.target.id==='externalCalendarDialog')e.target.close();});
    refresh(false);
  }
  return {init,open,refresh,cellHtml,dayHtml,eventsForDate:key=>eventsByDate.get(key)||[]};
})();
document.addEventListener('DOMContentLoaded',()=>window.PostIQExternalCalendars.init());
