'use strict';
// Landing-page sample of PostIQ's planning loop. It is self-contained: Shadow DOM isolates its
// styles, all data lives in component memory, and nothing here reads storage or calls Buffer.
// Every action says it is sample-only.

const POSTING_DAYS = [1, 3, 5]; // Mon, Wed, Fri: this sample's posting schedule
const SAMPLE_POSTS = ['LinkedIn · campaign launch', 'Instagram · behind-the-scenes Reel', 'Threads · quick tip'];
const SHELF = [
  { id: 'behind', title: 'Behind-the-scenes Reel' },
  { id: 'captions', title: '3 captions that always land' },
  { id: 'founder', title: 'Founder story carousel' }
];

const SAMPLE_TEMPLATE = `<style>
:host{display:block;font-family:"Lato",system-ui,sans-serif;background:transparent;color:var(--text,#292720);font-synthesis:none}
*{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer}
button:focus-visible,input:focus-visible{outline:3px solid #1e5a78;outline-offset:3px}
main{margin:0;padding:0}h2{font-family:Georgia,serif;font-size:20px;margin:0 0 8px}
.hint{color:#696356;font-size:13px;line-height:1.5}
.panel{border:1px solid var(--border,#ded7c7);background:var(--surface,#fffdf7);padding:20px;border-radius:5px;margin:0 0 14px}
.btn{display:inline-flex;align-items:center;justify-content:center;background:#fffdf7;border:1px solid #beb4a2;border-radius:5px;color:#292720;padding:10px 14px;font-weight:700;min-height:40px}
.btn.primary{background:var(--brand,#b52c20);color:#fff;border-color:var(--brand,#b52c20)}
.btn:disabled{opacity:.45;cursor:default}
.btn.small{min-height:32px;padding:4px 8px;font-size:12px;width:100%}
.btn:hover:not(:disabled){filter:brightness(.96)}
.quick-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.quick-row input{flex:1;min-width:220px;padding:11px;border:1px solid #a69c89;border-radius:4px;background:#fff}
#parsePreview{min-height:22px;margin-top:9px}
.calendar-head{display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap;margin-bottom:8px}
#weekLabel{font-weight:800;font-size:18px}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}
.chip{font-size:12px;padding:6px 11px;border:1px solid var(--border,#ded7c7);border-radius:30px;background:#fffdf7;color:#635f55}
.chip strong{color:#292720}
.calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
.day{min-width:0;min-height:175px;background:var(--surface,#fffdf7);border:1px solid var(--border,#ded7c7);border-radius:6px;padding:9px;transition:background .12s,border-color .12s}
.day.over,.day.target{border-color:#b52c20;background:#fff2e8}
.day-head{font-size:12px;font-weight:800;margin-bottom:12px}
.item{display:block;text-align:left;width:100%;border-radius:4px;padding:8px;min-height:41px;margin-bottom:8px;font-size:12px;line-height:1.35;overflow-wrap:anywhere;border:1px solid transparent;color:inherit}
.item.post{background:#deefe4;border-color:#91b49f}
.item.plan{background:#fffdf7;border:1px dashed #a78c60}
.item:hover{filter:brightness(.96)}
.item.selected{outline:3px solid #b52c20;outline-offset:1px}
.item.fresh{animation:land .45s ease}
.open-slot{border:1px dashed #b52c20;background:#fff8f3;border-radius:4px;padding:8px;font-size:12px;color:#7a2a20;margin-bottom:8px;display:grid;gap:6px}
.open-slot strong{font-size:12px}
.empty{color:#91897a;font-size:12px;border:1px dashed #ded7c7;border-radius:4px;padding:9px}
.target-btn{margin-top:6px}
.legend{display:flex;gap:18px;flex-wrap:wrap;font-size:13px;color:#635f55;margin-top:16px}
.swatch{display:inline-block;width:13px;height:13px;vertical-align:-2px;margin-right:6px;border:1px solid #91b49f;background:#deefe4}
.swatch.plan{background:#fffdf7;border:1px dashed #a78c60}
.swatch.open{background:#fff8f3;border:1px dashed #b52c20}
.shelf{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
.shelf button{text-align:left;background:#fffdf7;border:1px solid #ded7c7;border-radius:5px;padding:12px;color:#292720;min-height:64px}
.shelf button small{display:block;color:#696356;font-size:11px;margin-top:4px}
.shelf button[aria-pressed="true"]{outline:3px solid #b52c20;outline-offset:1px;border-color:#b52c20}
#feedback{padding:12px 14px;border-radius:4px;background:#f3eadb;color:#292720;margin-top:14px;min-height:44px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
#feedback:empty{display:none}
@keyframes land{0%{transform:scale(.9);opacity:.35}60%{transform:scale(1.03);opacity:1}100%{transform:none}}
@media(max-width:850px){.calendar{grid-template-columns:repeat(4,minmax(0,1fr))}.day{min-height:130px}}
@media(max-width:530px){
  .calendar{grid-template-columns:repeat(2,minmax(0,1fr))}.day{min-height:120px}.panel{padding:14px}
  .shelf{grid-template-columns:1fr}
}
/* Compact mode (hero): the week and fill loop only; Quick Add and the Shelf live in the full sample below. */
:host([compact]) .quick-panel,:host([compact]) .shelf-panel{display:none}
:host([compact]) .panel{padding:14px}
:host([compact]) .calendar{gap:6px}
:host([compact]) .day{min-height:138px;padding:7px}
:host([compact]) .day-head{font-size:11px;margin-bottom:8px}
:host([compact]) .item{font-size:11px;padding:6px;min-height:34px;margin-bottom:6px}
:host([compact]) .open-slot{font-size:11px;padding:6px}
:host([compact]) .hint,:host([compact]) .legend{display:none}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
<main>
<section class="panel quick-panel" aria-labelledby="quickTitle">
  <h2 id="quickTitle">Add an idea in everyday language</h2>
  <p class="hint">Try “Friday: film behind-the-scenes video” or “todo tomorrow: review captions”. This makes a plan, not a published post.</p>
  <form id="quickForm" class="quick-row">
    <input id="quickInput" aria-label="Describe a plan and date" autocomplete="off" placeholder="Friday: film behind-the-scenes video" value="Friday: film behind-the-scenes video">
    <button class="btn primary" type="submit">Add to sample</button>
  </form>
  <div id="parsePreview" class="hint" aria-live="polite"></div>
</section>

<section class="panel" aria-labelledby="calendarTitle">
  <div class="calendar-head">
    <div><h2 id="calendarTitle">Your sample week</h2><div class="hint" id="weekLabel"></div></div>
    <div class="actions">
      <button class="btn" type="button" id="prev">Previous</button>
      <button class="btn" type="button" id="next">Next</button>
      <button class="btn" type="button" id="undo" disabled>Undo</button>
      <button class="btn" type="button" id="reset">Reset sample</button>
    </div>
  </div>
  <div class="summary" aria-live="polite">
    <span class="chip" id="openCount"></span>
    <span class="chip">Posting days: <strong>Mon · Wed · Fri</strong></span>
  </div>
  <p class="hint">Drag a card to another day, or select a card and choose a day. Open slots on posting days can be filled in one tap from the Shelf below.</p>
  <div class="calendar" id="calendar" aria-label="Interactive sample calendar"></div>
  <div class="legend">
    <span><i class="swatch"></i> Sample scheduled post (solid)</span>
    <span><i class="swatch plan"></i> Unscheduled plan (outlined)</span>
    <span><i class="swatch open"></i> Open slot</span>
  </div>
  <div id="feedback" role="status" aria-live="polite"></div>
</section>

<section class="panel shelf-panel" aria-labelledby="shelfTitle">
  <h2 id="shelfTitle">The Shelf: posts worth reusing</h2>
  <p class="hint">Pick a starred post, then fill an open slot with it. In the app, a fill queues a real Buffer post. Here it stays in this sample.</p>
  <div class="shelf" id="shelf"></div>
</section>
</main>`;

class PostIQSampleCalendar extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = SAMPLE_TEMPLATE;
    const parser = window.PostIQQuickAdd?.parse;
    if (!parser) {
      root.getElementById('parsePreview').textContent = 'Quick Add is temporarily unavailable.';
      return;
    }
    initSample(root, parser, this.hasAttribute('compact') ? 'hero' : 'full');
  }
}

function initSample(root, parser, variant) {
  const $ = id => root.getElementById(id);

  const dayKey = d => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  const noon = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
  const fromKey = k => new Date(k + 'T12:00:00');
  const label = k => fromKey(k).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const today = noon(new Date());

  let start = today;
  let chosen = null;
  let dragged = null;
  let nextId = 1;
  let shelfPick = SHELF[0].id;
  let items = [];
  const history = [];

  function announce(msg) { $('feedback').textContent = msg; }

  // Undo keeps a short history of whole-sample snapshots. The sample is tiny, so copying is fine.
  // One analytics event per page load, on the first real change. Sample data never leaves the page.
  let tracked = false;
  function track() {
    if (tracked || typeof window.gtag !== 'function') return;
    tracked = true;
    window.gtag('event', 'landing_sample_interaction', { variant });
  }

  function checkpoint() {
    track();
    history.push({ items: items.map(x => ({ ...x })), start: start.getTime(), nextId });
    if (history.length > 20) history.shift();
    $('undo').disabled = false;
  }
  function undo() {
    const prev = history.pop();
    if (!prev) return;
    items = prev.items;
    start = new Date(prev.start);
    nextId = prev.nextId;
    chosen = null;
    $('undo').disabled = history.length === 0;
    render();
    announce('Undone. This is a sample only; nothing changed in Buffer.');
  }

  // Seed a week with posts on every posting day except the last one, so there is an open slot to fill.
  function seed() {
    items = [];
    nextId = 1;
    const week = [0, 1, 2, 3, 4, 5, 6].map(i => plus(today, i));
    const postingDays = week.filter(d => POSTING_DAYS.includes(d.getDay()));
    postingDays.slice(0, -1).forEach((d, i) => {
      items.push({ id: nextId++, kind: 'post', date: dayKey(d), title: SAMPLE_POSTS[i % SAMPLE_POSTS.length] });
    });
    items.push({ id: nextId++, kind: 'plan', date: dayKey(plus(today, 2)), title: 'Film product B-roll' });
    items.push({ id: nextId++, kind: 'plan', date: dayKey(plus(today, 5)), title: 'Review next week’s captions' });
  }

  function reset() {
    start = today;
    chosen = null;
    dragged = null;
    history.length = 0;
    $('undo').disabled = true;
    seed();
    announce('Try dragging “Film product B-roll” to another day, or fill an open slot from the Shelf.');
    render();
  }

  function move(id, to) {
    const item = items.find(x => x.id === id);
    if (!item || !to) return;
    if (item.date === to) { chosen = null; render(); return; }
    checkpoint();
    item.date = to;
    item.fresh = true;
    chosen = null;
    announce('Moved to ' + label(to) + '. This is a sample only; nothing changed in Buffer.');
    render();
  }

  function fill(dateKey) {
    const pick = SHELF.find(s => s.id === shelfPick) || SHELF[0];
    checkpoint();
    items.push({ id: nextId++, kind: 'post', date: dateKey, title: 'Reshare · ' + pick.title, fresh: true });
    chosen = null;
    announce('Filled ' + label(dateKey) + ' with “' + pick.title + '”. Sample only; nothing was queued in Buffer.');
    render();
  }

  function renderShelf() {
    const shelf = $('shelf');
    shelf.replaceChildren();
    for (const s of SHELF) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(s.id === shelfPick));
      btn.textContent = s.title;
      const meta = document.createElement('small');
      meta.textContent = 'Kept · ready to reuse';
      btn.append(meta);
      btn.addEventListener('click', () => {
        shelfPick = s.id;
        renderShelf();
        announce('Selected “' + s.title + '”. Fill an open slot with it.');
      });
      shelf.append(btn);
    }
  }

  function isOpenSlot(date, todays) {
    return POSTING_DAYS.includes(date.getDay()) && !todays.some(x => x.kind === 'post');
  }

  function render() {
    const cal = $('calendar');
    cal.replaceChildren();
    $('weekLabel').textContent = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' – ' + plus(start, 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    let openCount = 0;
    for (let i = 0; i < 7; i++) {
      const date = plus(start, i);
      const key = dayKey(date);
      const todays = items.filter(x => x.date === key);
      const day = document.createElement('div');
      day.className = 'day';
      day.dataset.date = key;

      const head = document.createElement('div');
      head.className = 'day-head';
      head.textContent = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      day.append(head);

      for (const item of todays) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'item ' + item.kind + (chosen === item.id ? ' selected' : '') + (item.fresh ? ' fresh' : '');
        item.fresh = false;
        btn.draggable = true;
        btn.textContent = item.title;
        btn.setAttribute('aria-label', (item.kind === 'post' ? 'Sample scheduled post: ' : 'Sample plan: ') + item.title + '. Select to move.');
        btn.addEventListener('click', () => {
          chosen = chosen === item.id ? null : item.id;
          announce(chosen ? 'Now select a destination day.' : 'Selection cleared.');
          render();
        });
        btn.addEventListener('dragstart', e => {
          dragged = item.id;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(item.id));
        });
        btn.addEventListener('dragend', () => {
          dragged = null;
          root.querySelectorAll('.over').forEach(x => x.classList.remove('over'));
        });
        day.append(btn);
      }

      if (isOpenSlot(date, todays)) {
        openCount++;
        const slot = document.createElement('div');
        slot.className = 'open-slot';
        const pick = SHELF.find(s => s.id === shelfPick) || SHELF[0];
        const text = document.createElement('strong');
        text.textContent = 'Open slot';
        const fillBtn = document.createElement('button');
        fillBtn.type = 'button';
        fillBtn.className = 'btn small';
        fillBtn.textContent = 'Fill from Shelf';
        fillBtn.setAttribute('aria-label', 'Fill open slot on ' + head.textContent + ' with ' + pick.title);
        fillBtn.addEventListener('click', () => fill(key));
        slot.append(text, fillBtn);
        day.append(slot);
      } else if (!todays.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'Open day';
        day.append(empty);
      }

      if (chosen !== null) {
        const target = document.createElement('button');
        target.type = 'button';
        target.className = 'btn small target-btn';
        target.textContent = 'Move here';
        target.setAttribute('aria-label', 'Move selected card to ' + head.textContent);
        target.addEventListener('click', () => move(chosen, key));
        day.append(target);
      }

      day.addEventListener('dragover', e => {
        if (dragged === null) return;
        e.preventDefault();
        day.classList.add('over');
      });
      day.addEventListener('dragleave', () => day.classList.remove('over'));
      day.addEventListener('drop', e => {
        e.preventDefault();
        day.classList.remove('over');
        const id = Number(e.dataTransfer.getData('text/plain'));
        if (items.some(x => x.id === id)) move(id, key);
        dragged = null;
      });
      cal.append(day);
    }

    $('openCount').replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = openCount + (openCount === 1 ? ' open slot' : ' open slots');
    $('openCount').append(strong, ' this week');
  }

  function preview() {
    const r = parser($('quickInput').value, new Date());
    $('parsePreview').textContent = r.text
      ? 'Plan for ' + label(r.dateKey) + ' · ' + (r.kind === 'action' ? 'To-do' : 'Note')
      : 'Type a plan to preview its date.';
  }

  $('quickForm').addEventListener('submit', e => {
    e.preventDefault();
    const r = parser($('quickInput').value, new Date());
    if (!r.text) { announce('Type a plan before adding it.'); return; }
    checkpoint();
    items.push({ id: nextId++, kind: 'plan', date: r.dateKey, title: r.text, fresh: true });
    if (r.dateKey < dayKey(start) || r.dateKey > dayKey(plus(start, 6))) start = fromKey(r.dateKey);
    chosen = null;
    render();
    announce('Added “' + r.text + '” to ' + label(r.dateKey) + '. This is a sample planning item, not a Buffer post.');
  });
  $('quickInput').addEventListener('input', preview);
  $('prev').addEventListener('click', () => { start = plus(start, -7); chosen = null; render(); });
  $('next').addEventListener('click', () => { start = plus(start, 7); chosen = null; render(); });
  $('undo').addEventListener('click', undo);
  $('reset').addEventListener('click', reset);

  reset();
  renderShelf();
  preview();
}

customElements.define('postiq-sample-calendar', PostIQSampleCalendar);
