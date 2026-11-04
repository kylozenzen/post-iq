'use strict';
// Public external calendars only. URLs are public ICS addresses, not credentials.
// Event contents remain in memory rather than persistent browser storage.
window.PostIQExternalCalendars = (() => {
  const STORAGE = 'postiq_public_calendar_feeds_v2';
  const LEGACY = 'postiq_external_calendars_v1';
  const MAX_FEEDS = 5, TTL = 60*60*1000;
  let feeds=[], eventsByDate=new Map(), busy=false;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const allowed = input => {
    try {
      const url = new URL(input);
      return url.protocol==='https:' && ['calendar.google.com','www.google.com'].includes(url.hostname.toLowerCase()) &&
        !url.port && !url.username && !url.password && !url.search && !url.hash &&
        /^\/calendar\/ical\/[^/]+\/public\/basic\.ics$/i.test(url.pathname);
    } catch { return false; }
  };
  function load() {
    // Purge any private URLs/events saved by an earlier preview version.
    try { localStorage.removeItem(LEGACY); } catch {}
    try {
      const stored=JSON.parse(localStorage.getItem(STORAGE)||'[]');
      feeds=Array.isArray(stored) ? stored.filter(f=>allowed(f.url))
        .slice(0,MAX_FEEDS).map(f=>({id:String(f.id),name:String(f.name||'Public calendar').slice(0,60),url:f.url,events:[],updated:0,error:''})) : [];
    } catch { feeds=[]; }
    save(); rebuild();
  }
  function save() {
    // Only persist public URLs and labels; not event titles, contents or failed URL traces.
    try { localStorage.setItem(STORAGE,JSON.stringify(feeds.map(({id,name,url})=>({id,name,url})))); } catch {}
  }
  function rebuild() {
    eventsByDate=new Map();
    for (const feed of feeds) for(const event of feed.events) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date||''))continue;
      const entries=eventsByDate.get(event.date)||[];
      entries.push({...event,feedName:feed.name,sourceId:feed.id});
      eventsByDate.set(event.date,entries);
    }
  }
  function cellHtml(key) {
    const events=eventsByDate.get(key)||[];
    if(!events.length)return '';
    return '<div class="external-calendar-items">'+events.slice(0,2).map(e=>
      '<div class="external-calendar-pill" title="'+esc(e.feedName+': '+e.title)+'"><span aria-hidden="true">◷</span> '+esc(e.title)+'</div>').join('')+
      (events.length>2?'<span class="external-calendar-more">+'+(events.length-2)+' events</span>':'')+'</div>';
  }
  function dayHtml(key) {
    const events=eventsByDate.get(key)||[];
    if(!events.length)return '';
    return '<section class="external-calendar-day"><h3>Other calendars</h3>'+events.map(e=>
      '<div class="external-calendar-entry"><strong>'+esc(e.title)+'</strong><small>'+esc(e.feedName)+' · Read-only</small></div>').join('')+'</section>';
  }
  function setStatus(message,problem=false) {
    const el=$('externalCalendarStatus');
    if(el){el.textContent=message;el.classList.toggle('is-error',problem);}
  }
  async function fetchFeed(feed) {
    const response=await fetch('/.netlify/functions/calendar-feed',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({url:feed.url})
    });
    let data={};
    try{data=await response.json();}catch{throw Error('The calendar server returned an unexpected response.');}
    if(!response.ok)throw Error(data.error||'Could not load the public calendar.');
    return {events:(Array.isArray(data.events)?data.events:[]).filter(e=>e.date&&e.title).slice(0,250),recurringSkipped:!!data.recurringSkipped};
  }
  async function refresh(force=false) {
    if(busy || !feeds.length)return;
    busy=true;setStatus('Refreshing public calendar feeds…');
    let errors=0;
    try {
      for (const feed of feeds) {
        if(!force && Date.now()-feed.updated<TTL)continue;
        try {
          const data=await fetchFeed(feed);
          // A feed may have been removed while a request was in flight.
          if(!feeds.includes(feed))continue;
          feed.events=data.events;
          feed.updated=Date.now();
          feed.recurringSkipped=data.recurringSkipped;
          feed.error='';
        } catch(e) {
          if(feeds.includes(feed))feed.error=e.message;
          errors++;
        }
      }
      rebuild();renderList();
      if(typeof renderCalendar==='function')renderCalendar();
      setStatus(errors?errors+' calendar(s) could not refresh. Open the feed manager for details.':'Calendars updated.',errors>0);
    } finally {busy=false;}
  }
  async function add() {
    const name=$('externalCalendarName')?.value.trim()||'Public calendar';
    const url=$('externalCalendarUrl')?.value.trim()||'';
    if(!allowed(url)){setStatus('Only public Google Calendar ICS links are accepted. Do not paste a secret iCal address.',true);return;}
    if(feeds.some(f=>f.url===url)){setStatus('This calendar is already connected.',true);return;}
    if(feeds.length>=MAX_FEEDS){setStatus('Five feeds maximum. Remove one first.',true);return;}
    if(busy)return;
    busy=true;setStatus('Checking public calendar…');
    try {
      const candidate={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),name:name.slice(0,60),url,events:[],updated:0,error:''};
      // Validate at the server before storing anything.
      const data=await fetchFeed(candidate);
      candidate.events=data.events;candidate.updated=Date.now();candidate.recurringSkipped=data.recurringSkipped;
      feeds.push(candidate);save();rebuild();renderList();
      $('externalCalendarName').value='';$('externalCalendarUrl').value='';
      if(typeof renderCalendar==='function')renderCalendar();
      setStatus('Public calendar added.');
    }catch(e){setStatus(e.message||'Could not add calendar.',true);}
    finally{busy=false;}
  }
  function remove(id) {
    feeds=feeds.filter(f=>f.id!==id);
    save();rebuild();renderList();
    if(typeof renderCalendar==='function')renderCalendar();
    setStatus('Calendar link and loaded events removed from this browser.');
  }
  function clearAll() {
    feeds=[];eventsByDate.clear();
    try{localStorage.removeItem(STORAGE);localStorage.removeItem(LEGACY);}catch{}
    renderList();
    if(typeof renderCalendar==='function')renderCalendar();
    setStatus('All external calendar data cleared from this browser.');
  }
  function renderList() {
    const el=$('externalCalendarList');if(!el)return;
    el.innerHTML=feeds.length?feeds.map(f=>
      '<li><div><strong>'+esc(f.name)+'</strong><small>'+esc(f.error||((f.events||[]).length+' events loaded')+
      (f.recurringSkipped?' · Recurring dates may be incomplete':''))+'</small></div>'+
      '<button type="button" class="btn sm ghost" data-feed-remove="'+esc(f.id)+'">Remove</button></li>').join(''):
      '<li class="external-calendar-none">No public feeds connected.</li>';
    el.querySelectorAll('[data-feed-remove]').forEach(b=>b.addEventListener('click',()=>remove(b.dataset.feedRemove)));
    const clear=$('externalCalendarClearAll');if(clear)clear.hidden=!feeds.length;
  }
  function open() {
    renderList();
    const dialog=$('externalCalendarDialog');
    if(dialog&&!dialog.open)dialog.showModal();
  }
  function init() {
    load();
    $('calendarFeedsBtn')?.addEventListener('click',()=>{$('calendarFilters')?.removeAttribute('open');open();});
    $('externalCalendarClose')?.addEventListener('click',()=>$('externalCalendarDialog')?.close());
    $('externalCalendarAdd')?.addEventListener('click',add);
    $('externalCalendarRefresh')?.addEventListener('click',()=>refresh(true));
    $('externalCalendarClearAll')?.addEventListener('click',clearAll);
    $('externalCalendarDialog')?.addEventListener('click',event=>{
      if(event.target.id==='externalCalendarDialog')event.target.close();
    });
    // Only request public calendar events after the app is ready; no background process.
    refresh(false);
  }
  return {init,open,refresh,cellHtml,dayHtml,eventsForDate:key=>eventsByDate.get(key)||[]};
})();
document.addEventListener('DOMContentLoaded',()=>window.PostIQExternalCalendars.init());
