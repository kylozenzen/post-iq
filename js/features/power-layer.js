'use strict';
// Keyboard layer for people who want to move through planning without hunting menus.
window.PostIQPower = (() => {
  const RECENT_KEY = 'postiq_recent_commands_v1';
  let palette, input, results, sheet, returnFocus = null, matches = [], active = 0, chordTimer = null;
  const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const typing = el => !!el?.closest?.('input,textarea,select,[contenteditable="true"]');
  const blocked = () => typing(document.activeElement) || !!document.querySelector('.modal.open,.calendar-drawer.open');
  const shortcut = value => /Mac|iPhone|iPad/.test(navigator.platform) ? value.replace('Ctrl','⌘') : value.replace('⌘','Ctrl');
  const onCalendar = fn => () => { activateView('calendarView','command'); fn(); };
  function commands() {
    const rows = [
      ['calendar','Go to Calendar','G C',()=>activateView('calendarView','command')],
      ['compose','Go to Compose','G O',()=>activateView('composerView','command')],
      ['shelf','Go to Shelf','G S',()=>activateView('libraryView','command')],
      ['today','Today','T',onCalendar(()=>{state.month=new Date();renderCalendar();window.CalendarExperience?.remember();})],
      ['month','Month view','M',onCalendar(()=>setCalendarView('month'))],['week','Week view','W',onCalendar(()=>setCalendarView('week'))],
      ['list','List view','L',onCalendar(()=>setCalendarView('agenda'))],
      ['previous','Previous period','←',onCalendar(()=>{shiftCalendarRange(-1);renderCalendar();})],
      ['next','Next period','→',onCalendar(()=>{shiftCalendarRange(1);renderCalendar();})],
      ['quick-add','Quick add','N',onCalendar(()=>window.PostIQQuickAdd.open())],
      ['schedule','Posting schedule','',onCalendar(()=>window.YourPace?.open?.())],
      ['share','Share snapshot','',onCalendar(()=>document.getElementById('shareMonthBtn')?.click())],
      ['ics','Export .ics','',()=>window.PostIQBackup.exportIcs()],
      ['backup','Download backup','',()=>window.PostIQBackup.exportBackup()],
      ['reset-filters','Reset filters','',onCalendar(()=>document.getElementById('calendarFiltersReset')?.click())],
      ['holidays','Toggle holidays','',onCalendar(()=>window.PostIQHolidays.setCountry(window.PostIQHolidays.country()==='off'?'US':'off'))],
      ['tour','Take the tour','',()=>window.PostIQTour.start()],
      ['help','Help','',()=>location.href='/help/?article=plan-content-calendar'],
      ['buffer','Open Buffer','',()=>window.open('https://publish.buffer.com/','_blank','noopener')],
      ['shortcuts','Keyboard shortcuts','?',()=>openSheet()],
    ];
    (state.channels || []).forEach(channel => rows.push([`channel-${channel.id}`,`Filter by ${channel.displayName || channel.name || channel.id}`,'',onCalendar(()=>{const select=document.getElementById('calendarChannelFilter');select.value=channel.id;select.dispatchEvent(new Event('change',{bubbles:true}));})]));
    return rows;
  }
  function score(query, text) {
    const q=query.toLowerCase().trim(); if(!q)return 1;
    const hay=text.toLowerCase(); if(hay.includes(q)) return 100-q.length;
    let qi=0, gaps=0;
    for(let i=0;i<hay.length&&qi<q.length;i++) if(hay[i]===q[qi]) { if(qi && i>0 && hay[i-1]!==q[qi-1]) gaps++; qi++; }
    return qi===q.length ? 50-gaps : -1;
  }
  function recent() { try{return JSON.parse(localStorage.getItem(RECENT_KEY)||'[]')}catch{return []} }
  function render() {
    const query=input.value.trim();
    const text=query.toLowerCase().startsWith('add ') ? query.slice(4) : query;
    const add = query && !/^(go to|today|month|week|list|next|previous|posting|share|export|download|filter|reset|toggle|take|help|open|keyboard)/i.test(query);
    matches=commands().map(row=>({row,score:score(text,`${row[1]} ${row[0]}`),recent:recent().indexOf(row[0])})).filter(x=>x.score>=0);
    matches.sort((a,b)=>query ? (b.score-a.score)||((a.recent<0?100:a.recent)-(b.recent<0?100:b.recent)) : ((a.recent<0?100:a.recent)-(b.recent<0?100:b.recent)));
    if(add) matches.unshift({row:['quick-add','Add “'+query+'”','Enter',()=>window.PostIQQuickAdd.addText(query)],score:1000,recent:-1});
    matches=matches.slice(0,9); active=Math.min(active,matches.length-1);
    results.innerHTML=matches.length?matches.map(({row},i)=>`<button class="power-result${i===active?' is-active':''}" role="option" aria-selected="${i===active}" data-index="${i}"><span>${esc(row[1])}</span><kbd>${esc(row[2] ? shortcut(row[2]) : shortcut('⌘K') + ' ↵')}</kbd></button>`).join(''):'<p class="power-empty">No matching commands</p>';
  }
  function close() { if(!palette||palette.hidden)return;palette.hidden=true;document.body.classList.remove('power-open');const target=returnFocus;returnFocus=null;if(target?.isConnected)target.focus({preventScroll:true}); }
  function run(index=active) { const item=matches[index];if(!item)return;const [id,,key,action]=item.row;if(id!=='quick-add') {let ids=recent().filter(x=>x!==id);ids.unshift(id);try{localStorage.setItem(RECENT_KEY,JSON.stringify(ids.slice(0,5)))}catch{}} close();action(); }
  function open() { build();if(blocked() && !palette.hidden)return;returnFocus=document.activeElement;palette.hidden=false;document.body.classList.add('power-open');input.value='';render();input.focus(); }
  function trap(event) {const nodes=[...palette.querySelectorAll('input,button')].filter(n=>!n.disabled);if(event.shiftKey&&document.activeElement===nodes[0]){event.preventDefault();nodes.at(-1).focus()}else if(!event.shiftKey&&document.activeElement===nodes.at(-1)){event.preventDefault();nodes[0].focus()}}
  function build() {
    if(palette)return;
    palette=document.createElement('div');palette.className='power-backdrop';palette.hidden=true;palette.innerHTML='<section class="power-palette" role="dialog" aria-modal="true" aria-labelledby="powerTitle"><h2 id="powerTitle" class="sr-only">Command menu</h2><input id="powerSearch" type="text" autocomplete="off" placeholder="Search or type a plan…" aria-label="Search commands" aria-controls="powerResults" aria-autocomplete="list"><div id="powerResults" class="power-results" role="listbox"></div><footer><span>↑ ↓ to move</span><span>Enter to run</span><span>Esc to close</span></footer></section>';
    document.body.appendChild(palette);input=palette.querySelector('input');results=palette.querySelector('#powerResults');
    input.addEventListener('input',()=>{active=0;render()});input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length;render()}else if(e.key==='Enter'){e.preventDefault();run()}else if(e.key==='Escape'){e.preventDefault();close()}});
    palette.addEventListener('keydown',e=>{if(e.key==='Tab')trap(e)});
    palette.addEventListener('click',e=>{if(e.target===palette)close();const btn=e.target.closest('[data-index]');if(btn)run(Number(btn.dataset.index))});
  }
  function openSheet() { if(!returnFocus) returnFocus=document.activeElement; if(sheet){sheet.hidden=false;sheet.querySelector('button').focus();return;}sheet=document.createElement('div');sheet.className='power-backdrop';sheet.innerHTML='<section class="power-sheet" role="dialog" aria-modal="true" aria-labelledby="shortcutTitle"><button type="button" aria-label="Close shortcuts">×</button><h2 id="shortcutTitle">Keyboard shortcuts</h2><dl><div><dt>Open command menu</dt><dd>⌘K / Ctrl K</dd></div><div><dt>Today</dt><dd>T</dd></div><div><dt>Previous / next period</dt><dd>← / →</dd></div><div><dt>Month / week / list</dt><dd>M / W / L</dd></div><div><dt>Quick add</dt><dd>N</dd></div><div><dt>Move between days</dt><dd>Arrow keys</dd></div><div><dt>Open focused day</dt><dd>Enter</dd></div><div><dt>Show shortcuts</dt><dd>?</dd></div></dl></section>';document.body.append(sheet);sheet.querySelector('button').onclick=()=>{sheet.hidden=true;const target=returnFocus;returnFocus=null;target?.focus?.({preventScroll:true})};sheet.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();sheet.querySelector('button').click()}else if(e.key==='Tab'){e.preventDefault();sheet.querySelector('button').focus()}});sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.querySelector('button').click()}); }
  function init() {
    build(); document.addEventListener('keydown',e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'&&document.querySelector('.modal.open,.calendar-drawer.open'))return;
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(palette.hidden)open();else close();return;}
      if(!document.getElementById('calendarView')?.classList.contains('active')||blocked()||!palette.hidden||(sheet && !sheet.hidden))return;
      const key=e.key;
      if(typing(e.target)||e.metaKey||e.ctrlKey||e.altKey)return;
      if(key==='?' ){e.preventDefault();returnFocus=document.activeElement;openSheet();return}
      if(key.toLowerCase()==='g'){clearTimeout(chordTimer);chordTimer=setTimeout(()=>{chordTimer=null},1400);return}
      if(chordTimer){clearTimeout(chordTimer);chordTimer=null;if(key.toLowerCase()==='c'){e.preventDefault();activateView('calendarView','command')}else if(key.toLowerCase()==='o'){e.preventDefault();activateView('composerView','command')}else if(key.toLowerCase()==='s'){e.preventDefault();activateView('libraryView','command')}return}
      if(key==='t'||key==='T'){e.preventDefault();state.month=new Date();renderCalendar();window.CalendarExperience?.remember();}
      else if(key==='ArrowLeft'||key==='ArrowRight'){if(e.target.closest('[data-calendar-date]')){moveDay(e.target.closest('[data-calendar-date]'),key==='ArrowLeft'?-1:1);return;}e.preventDefault();shiftCalendarRange(key==='ArrowLeft'?-1:1);renderCalendar();window.CalendarExperience?.remember();}
      else if(key==='m'||key==='M'){e.preventDefault();setCalendarView('month')}
      else if(key==='l'||key==='L'){e.preventDefault();setCalendarView('agenda')}
      else if(key==='w'||key==='W'){e.preventDefault();setCalendarView('week')}
      else if(key==='n'||key==='N'){e.preventDefault();window.PostIQQuickAdd.open()}
    });
    document.getElementById('calendarAddBtn')?.addEventListener('click',showAddHint);

    document.getElementById('shortcutSheetMenuBtn')?.addEventListener('click',()=>{returnFocus=document.activeElement;openSheet()});document.getElementById('calendarFilterSummary')?.insertAdjacentHTML('afterend','<button class="power-shortcuts-link" type="button" aria-label="Keyboard shortcuts">?</button>');document.querySelector('.power-shortcuts-link')?.addEventListener('click',()=>{returnFocus=document.activeElement;openSheet()});
  }
  function showAddHint() {
    try { if (localStorage.getItem('postiq_add_hint_seen')) return; localStorage.setItem('postiq_add_hint_seen','1'); } catch { return; }
    const hint=document.createElement('div');hint.className='power-hint';hint.setAttribute('role','note');hint.innerHTML='<span>Tip: press ⌘K for everything, N to add.</span><button type="button" aria-label="Dismiss keyboard tip">×</button>';
    hint.querySelector('button').onclick=()=>hint.remove();document.body.append(hint);
  }
  function moveDay(from,delta) {const d=new Date(from.dataset.calendarDate+'T12:00:00');d.setDate(d.getDate()+delta);const key=d.toISOString().slice(0,10);let target=[...document.querySelectorAll('#calGrid [data-calendar-date],#calWeek [data-calendar-date],#calAgenda [data-calendar-date]')].find(x=>x.dataset.calendarDate===key&&x.getClientRects().length);if(!target){state.month=d;renderCalendar();target=[...document.querySelectorAll('#calGrid [data-calendar-date],#calWeek [data-calendar-date]')].find(x=>x.dataset.calendarDate===key)}if(target){target.tabIndex=0;target.focus({preventScroll:true})}}
  return {init,open,close,openSheet,score};
})();
document.addEventListener('DOMContentLoaded',()=>{try{window.PostIQPower.init()}catch(error){console.warn('[PostIQ power]',error)}});
