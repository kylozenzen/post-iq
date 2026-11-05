'use strict';
// Native, self-contained landing page example. Shadow DOM isolates demo styles,
// while all data stays in component memory and never touches Buffer or storage.
class PostIQSampleCalendar extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({mode:'open'});
    root.innerHTML = `<style>
:host{display:block;font-family:"Lato",system-ui,sans-serif;background:transparent;color:var(--text,#292720);font-synthesis:none}
*{box-sizing:border-box}body{margin:0}button,input{font:inherit}button{cursor:pointer}a{color:#922b23}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #1e5a78;outline-offset:3px}
header{border-bottom:1px solid #ded7c7;background:#fffdf7}header .inner{max-width:1120px;margin:auto;padding:18px 22px;display:flex;align-items:center;gap:16px;justify-content:space-between;flex-wrap:wrap}header strong{font-size:22px;letter-spacing:-.05em}header small{display:block;color:#696356;font-weight:400;font-size:12px;letter-spacing:normal}
main{max-width:none;margin:0;padding:0}h1{font-family:Georgia,serif;font-size:clamp(30px,5vw,48px);line-height:1.04;max-width:750px;margin:12px 0}p{line-height:1.6}.intro{max-width:760px;color:#635f55}.eyebrow{font-size:11px;letter-spacing:.12em;font-weight:800;color:#a43126;text-transform:uppercase}
.actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;justify-content:center;background:#fffdf7;border:1px solid #beb4a2;border-radius:5px;color:#292720;padding:11px 14px;text-decoration:none;font-weight:700;min-height:42px}.btn.primary{background:var(--brand,#b52c20);color:white;border-color:var(--brand,#b52c20)}.btn:hover{filter:brightness(.96)}
.panel{border:1px solid var(--border,#ded7c7);background:var(--surface,#fffdf7);padding:20px;border-radius:5px;margin:0 0 14px}.panel h2{font-size:18px;margin:0 0 8px}.hint{color:#696356;font-size:13px}.quick-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.quick-row input{flex:1;min-width:220px;padding:11px;border:1px solid #a69c89;border-radius:4px;background:#fff}#parsePreview{min-height:22px;margin-top:9px}
.calendar-head{display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap;margin-bottom:12px}#weekLabel{font-weight:800;font-size:18px}.calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}.day{min-width:0;min-height:160px;background:var(--surface,#fffdf7);border:1px solid var(--border,#ded7c7);border-radius:6px;padding:9px;transition:background .12s,border-color .12s}.day.over,.day.target{border-color:#b52c20;background:#fff2e8}.day-head{font-size:12px;font-weight:800;margin-bottom:12px}.item{display:block;text-align:left;width:100%;border-radius:4px;padding:8px;min-height:41px;margin-bottom:8px;font-size:12px;line-height:1.35;overflow-wrap:anywhere}.item.post{background:#deefe4;border:1px solid #91b49f}.item.plan{background:#fffdf7;border:1px dashed #a78c60}.item.selected{outline:3px solid #b52c20;outline-offset:1px}.empty{color:#91897a;font-size:12px;border:1px dashed #ded7c7;border-radius:4px;padding:9px}
.legend{display:flex;gap:18px;flex-wrap:wrap;font-size:13px;color:#635f55;margin-top:16px}.swatch{display:inline-block;width:13px;height:13px;vertical-align:-2px;margin-right:6px;border:1px solid #91b49f;background:#deefe4}.swatch.plan{background:#fffdf7;border:1px dashed #a78c60}
#feedback{padding:12px 14px;border-radius:4px;background:#f3eadb;color:#292720;margin-top:14px;min-height:44px}#feedback:empty{display:none}.footer-cta{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:25px}.steps{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.steps span{font-size:12px;padding:7px 10px;border:1px solid #ded7c7;border-radius:30px;background:#fffdf7}
@media(max-width:850px){.calendar{grid-template-columns:repeat(4,minmax(0,1fr))}.day{min-height:130px}}
@media(max-width:530px){.calendar{grid-template-columns:repeat(2,minmax(0,1fr))}.day{min-height:120px}.panel{padding:14px}header .inner,main{padding-left:14px;padding-right:14px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style><main>

<section class="panel" aria-labelledby="quickTitle">
<h2 id="quickTitle">Add an idea in everyday language</h2>
<p class="hint">Try “Friday: film behind-the-scenes video” or “todo tomorrow: review captions”. This makes a plan, not a published post.</p>
<form id="quickForm" class="quick-row"><input id="quickInput" aria-label="Describe a plan and date" autocomplete="off" placeholder="Friday: film behind-the-scenes video" value="Friday: film behind-the-scenes video"><button class="btn primary" type="submit">Add to sample</button></form>
<div id="parsePreview" class="hint" aria-live="polite"></div>
</section>
<section class="panel" aria-labelledby="calendarTitle">
<div class="calendar-head"><div><h2 id="calendarTitle">Your sample calendar</h2><div class="hint" id="weekLabel"></div></div><div class="actions"><button class="btn" type="button" id="prev">Previous</button><button class="btn" type="button" id="next">Next</button><button class="btn" type="button" id="reset">Reset sample</button></div></div>
<p class="hint">Drag a card onto another day. Or select a card, then select a destination day. Both work without changing anything in Buffer.</p>
<div class="calendar" id="calendar" aria-label="Interactive sample calendar"></div>
<div class="legend"><span><i class="swatch"></i> Fictional scheduled post (solid)</span><span><i class="swatch plan"></i> Unscheduled planning item (outlined)</span></div>
<div id="feedback" role="status" aria-live="polite"></div>
</section>
</main>`;
    const parser = window.PostIQQuickAdd?.parse;
    if (!parser) {root.querySelector('#parsePreview').textContent='Quick Add is temporarily unavailable.';return;}
    this.initCalendar(root,parser);
  }
  initCalendar(root,parser) {
    
  'use strict';

  const dayKey = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const noon = d => new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);
  const plus = (d,n) => new Date(d.getFullYear(),d.getMonth(),d.getDate()+n,12);
  const fromKey = k => new Date(k+'T12:00:00');
  const today = noon(new Date());
  let start = today, chosen = null, dragged = null, nextId = 1;
  let items = [];
  const $ = id => root.getElementById(id);
  function announce(msg){$('feedback').textContent = msg;}
  function reset(){
    start = today;chosen = dragged = null;nextId = 1;
    items = [
      {id:nextId++,kind:'post',date:dayKey(plus(today,1)),title:'LinkedIn · campaign launch'},
      {id:nextId++,kind:'post',date:dayKey(plus(today,4)),title:'Instagram · behind-the-scenes Reel'},
      {id:nextId++,kind:'plan',date:dayKey(plus(today,2)),title:'Film product B-roll'},
      {id:nextId++,kind:'plan',date:dayKey(plus(today,5)),title:'Review next week’s captions'}
    ];
    announce('Try dragging “Film product B-roll” to another day, or select it and choose a day.');
    render();
  }
  function move(id,to){
    const item=items.find(x=>x.id===id);
    if(!item||!to)return;
    if(item.date===to){chosen=null;render();return;}
    item.date=to;chosen=null;
    announce('Moved to '+fromKey(to).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})+'. This is a sample only; nothing changed in Buffer.');
    render();
  }
  function render(){
    $('calendar').replaceChildren();
    $('weekLabel').textContent=start.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' – '+plus(start,13).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
    for(let i=0;i<14;i++){
      const date=plus(start,i), key=dayKey(date);
      const day=document.createElement('div');day.className='day';day.dataset.date=key;
      const head=document.createElement('div');head.className='day-head';head.textContent=date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});day.append(head);
      const todays=items.filter(x=>x.date===key);
      for(const item of todays){
        const btn=document.createElement('button');btn.type='button';btn.className='item '+item.kind+(chosen===item.id?' selected':'');btn.draggable=true;
        btn.textContent=item.title;btn.setAttribute('aria-label',(item.kind==='post'?'Sample scheduled post: ':'Sample plan: ')+item.title+'. Select to move.');
        btn.addEventListener('click',()=>{chosen=chosen===item.id?null:item.id;announce(chosen?'Now select a destination day below.':'Selection cleared.');render();});
        btn.addEventListener('dragstart',e=>{dragged=item.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(item.id));});
        btn.addEventListener('dragend',()=>{dragged=null;root.querySelectorAll('.over').forEach(x=>x.classList.remove('over'));});
        day.append(btn);
      }
      if(!todays.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Open day';day.append(empty);}
      if(chosen!==null){
        const target=document.createElement('button');target.type='button';target.className='btn';target.style.cssText='width:100%;font-size:12px;margin-top:6px;padding:5px';target.textContent='Move here';
        target.setAttribute('aria-label','Move selected card to '+head.textContent);
        target.addEventListener('click',()=>move(chosen,key));day.append(target);
      }
      day.addEventListener('dragover',e=>{if(dragged===null)return;e.preventDefault();day.classList.add('over');});
      day.addEventListener('dragleave',()=>day.classList.remove('over'));
      day.addEventListener('drop',e=>{e.preventDefault();day.classList.remove('over');const id=Number(e.dataTransfer.getData('text/plain'));if(items.some(x=>x.id===id))move(id,key);dragged=null;});
      $('calendar').append(day);
    }
  }
  function preview(){
    if(!parser)return;
    const r=parser($('quickInput').value,new Date());
    $('parsePreview').textContent=r.text?('Plan for '+fromKey(r.dateKey).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+' · '+(r.kind==='action'?'To-do':'Note')):'Type a plan to preview its date.';
  }
  $('quickForm').addEventListener('submit',e=>{
    e.preventDefault();
    if(!parser){announce('Quick Add is temporarily unavailable.');return;}
    const r=parser($('quickInput').value,new Date());
    if(!r.text){announce('Type a plan before adding it.');return;}
    items.push({id:nextId++,kind:'plan',date:r.dateKey,title:r.text});
    if(r.dateKey<dayKey(start)||r.dateKey>dayKey(plus(start,13)))start=fromKey(r.dateKey);
    chosen=null;render();
    announce('Added “'+r.text+'” to '+fromKey(r.dateKey).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})+'. This is a sample planning item, not a Buffer post.');
  });
  $('quickInput').addEventListener('input',preview);
  $('prev').addEventListener('click',()=>{start=plus(start,-14);chosen=null;render();});
  $('next').addEventListener('click',()=>{start=plus(start,14);chosen=null;render();});
  $('reset').addEventListener('click',reset);
  reset();preview();

  }
}
customElements.define('postiq-sample-calendar',PostIQSampleCalendar);
