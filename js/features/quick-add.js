'use strict';
// Quick add: type "Fri: reshare press release" and press Enter.
// The parser is pure (parse(text, now)) so it can be tested; the popover only renders its result.
window.PostIQQuickAdd = (() => {
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const dayIndex = word => DAYS.findIndex(d => d.startsWith(word) && word.length >= 2 && (word.length >= 3 || ['tu', 'th', 'sa', 'su'].includes(word)));
  const monthIndex = word => MONTHS.findIndex(m => word.length >= 3 && m.startsWith(word));
  const atNoon = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
  const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Returns { date: Date|null, rest: string } for a date phrase at the start of the text.
  function takeDate(input, now) {
    const today = atNoon(now);
    const text = input.trim();
    const lower = text.toLowerCase();
    let m;
    const after = len => text.slice(len).replace(/^\s*[:\-–—,]\s*|^\s+/, '');

    if ((m = lower.match(/^(today|tonight)\b/))) return { date: today, rest: after(m[0].length) };
    if ((m = lower.match(/^(tomorrow|tmrw|tmr)\b/))) return { date: addDays(today, 1), rest: after(m[0].length) };
    if ((m = lower.match(/^in\s+(\d{1,2})\s+(day|days|week|weeks)\b/))) {
      const n = Number(m[1]) * (m[2].startsWith('week') ? 7 : 1);
      return { date: addDays(today, n), rest: after(m[0].length) };
    }
    if ((m = lower.match(/^(next|this)\s+(week)\b/))) {
      // "next week" = next Monday; "this week" = today
      const toMonday = ((8 - today.getDay()) % 7) || 7;
      return { date: m[1] === 'next' ? addDays(today, toMonday) : today, rest: after(m[0].length) };
    }
    if ((m = lower.match(/^(next\s+|this\s+|on\s+)?([a-z]{2,9})\.?(?=\b)/))) {
      const idx = dayIndex(m[2]);
      if (idx !== -1) {
        let diff = (idx - today.getDay() + 7) % 7; // "Tue" on a Tuesday means today
        if (m[1]?.trim() === 'next') {
          // "next Fri" = Friday of next week (weeks start Monday)
          const toNextMonday = ((8 - today.getDay()) % 7) || 7;
          diff = toNextMonday + ((idx + 6) % 7);
        }
        return { date: addDays(today, diff), rest: after(m[0].length) };
      }
    }
    // "Nov 12", "November 12th", "12 Nov"
    if ((m = lower.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(st|nd|rd|th)?\b/)) && monthIndex(m[1]) !== -1) {
      return { date: nextOccurrence(monthIndex(m[1]), Number(m[2]), today), rest: after(m[0].length) };
    }
    if ((m = lower.match(/^(\d{1,2})(st|nd|rd|th)?\s+([a-z]{3,9})\b/)) && monthIndex(m[3]) !== -1) {
      return { date: nextOccurrence(monthIndex(m[3]), Number(m[1]), today), rest: after(m[0].length) };
    }
    // "11/12" or "11/12/2026"
    if ((m = lower.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
      const month = Number(m[1]) - 1, day = Number(m[2]);
      const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
      const date = year ? valid(year, month, day) : nextOccurrence(month, day, today);
      if (date) return { date, rest: after(m[0].length) };
    }
    // A holiday name before the colon: "Thanksgiving: gratitude post"
    const colon = text.indexOf(':');
    if (colon > 2 && window.PostIQHolidays?.findByName) {
      const hit = window.PostIQHolidays.findByName(text.slice(0, colon), now);
      if (hit) return { date: new Date(hit.date + 'T12:00:00'), rest: text.slice(colon + 1).trim(), holiday: hit.name };
    }
    return { date: null, rest: text };
  }
  function valid(y, m, d) {
    const date = new Date(y, m, d, 12);
    return date.getMonth() === m && date.getDate() === d ? date : null;
  }
  function nextOccurrence(month, day, today) {
    const thisYear = valid(today.getFullYear(), month, day);
    if (thisYear && key(thisYear) >= key(today)) return thisYear;
    return valid(today.getFullYear() + 1, month, day);
  }

  // parse("todo fri: film b-roll") → { dateKey, text, kind: 'action'|'note', explicitDate }
  function parse(input, now = new Date(), fallbackKey = null) {
    let text = String(input || '').trim();
    let kind = 'note';
    const todo = text.match(/^(\[\s?\]|todo:?|to-?do:?|task:?)\s*/i);
    if (todo) { kind = 'action'; text = text.slice(todo[0].length); }
    const { date, rest, holiday } = takeDate(text, now);
    let body = rest;
    const todoAfter = body.match(/^(\[\s?\]|todo:?|to-?do:?|task:?)\s*/i);
    if (todoAfter) { kind = 'action'; body = body.slice(todoAfter[0].length); }
    return {
      dateKey: date ? key(date) : (fallbackKey || key(atNoon(now))),
      explicitDate: !!date,
      text: body.trim(),
      kind,
      holiday: holiday || null,
    };
  }

  // ── Popover ──────────────────────────────────────────────
  let pop = null, input = null, preview = null, contextKey = null;

  function describe(result) {
    if (!result.text) return 'Type a plan — try “Fri: reshare the press release” or “todo tomorrow: film B-roll”.';
    const d = new Date(result.dateKey + 'T12:00:00');
    const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const what = result.kind === 'action' ? 'To-do' : 'Note';
    return `${what} on ${day}${result.holiday ? ` (${result.holiday})` : ''}`;
  }
  function update() {
    const result = parse(input.value, new Date(), contextKey);
    preview.textContent = describe(result);
    preview.classList.toggle('is-ready', !!result.text);
    pop.querySelector('[data-quick-save]').disabled = !result.text;
    return result;
  }
  function open(dateKey) {
    build();
    if (!pop.hidden) { input.focus(); return; } // already open: never wipe what's typed
    contextKey = dateKey || null;
    input.value = '';
    update();
    pop.hidden = false;
    // Holiday names ("Thanksgiving: …") need the holiday list; if it's still loading, re-read when it lands.
    window.PostIQHolidays?.refresh?.().then(() => { if (pop && !pop.hidden) update(); }).catch(() => {});
    document.getElementById('calendarAddBtn')?.setAttribute('aria-expanded', 'true');
    input.focus(); // synchronously, so the first keystrokes land in the box
  }
  function close({ restoreFocus = true } = {}) {
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    const btn = document.getElementById('calendarAddBtn');
    btn?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) btn?.focus({ preventScroll: true });
  }
  function save() {
    const result = update();
    if (!result.text) return;
    const note = addNoteForDateKey(result.dateKey, result.text, result.kind === 'action' ? 'action' : 'note');
    if (!note) return;
    window.dispatchEvent(new Event('postiq:planning-changed'));
    renderCalendar();
    window.CalendarExperience?.remember(result.dateKey);
    flash(result.dateKey);
    showToast(`Added: ${describe(result)}`, 'success');
    input.value = ''; update(); input.focus();
  }
  function flash(dateKey) {
    document.querySelectorAll(`[data-calendar-date="${dateKey}"]`).forEach(cell => {
      cell.classList.remove('just-added'); void cell.offsetWidth; cell.classList.add('just-added');
      setTimeout(() => cell.classList.remove('just-added'), 1400);
    });
  }
  function build() {
    if (pop) return;
    const anchor = document.getElementById('calendarAddBtn');
    pop = document.createElement('div');
    pop.className = 'quick-add-pop'; pop.id = 'quickAddPop'; pop.hidden = true;
    pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Quick add a plan');
    pop.innerHTML = `
      <label class="sr-only" for="quickAddInput">Plan</label>
      <input id="quickAddInput" class="quick-add-input" type="text" autocomplete="off" spellcheck="true" placeholder="Fri: reshare the press release" />
      <div class="quick-add-preview" id="quickAddPreview" aria-live="polite"></div>
      <div class="quick-add-actions">
        <button type="button" class="more-link" data-quick-more>More options</button>
        <span class="quick-add-hint"><kbd>Enter</kbd> to add · <kbd>Esc</kbd> to close</span>
        <button type="button" class="btn sm primary" data-quick-save>Add</button>
      </div>`;
    anchor.parentElement.appendChild(pop);
    input = pop.querySelector('#quickAddInput'); preview = pop.querySelector('#quickAddPreview');
    input.addEventListener('input', update);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    });
    pop.querySelector('[data-quick-save]').addEventListener('click', save);
    pop.querySelector('[data-quick-more]').addEventListener('click', () => {
      const result = parse(input.value, new Date(), contextKey);
      close({ restoreFocus: false });
      window.CalendarExperience?.add(result.dateKey);
    });
    document.addEventListener('pointerdown', e => {
      if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('#calendarAddBtn')) close({ restoreFocus: false });
    });
  }

  function addText(text) {
    if (!document.getElementById('calendarView')?.classList.contains('active')) window.activateView?.('calendarView','command_quick_add');
    open(); input.value = String(text || '').replace(/^add\s+/i, ''); update(); save();
  }

  function addText(text) {
    if (!document.getElementById('calendarView')?.classList.contains('active')) window.activateView?.('calendarView','command_quick_add');
    open(); input.value = String(text || '').replace(/^add\s+/i, ''); update(); save();
  }

  function init() {
    const btn = document.getElementById('calendarAddBtn');
    if (!btn) return;
    btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
    btn.onclick = event => { event.preventDefault(); (pop && !pop.hidden) ? close() : open(); };
    // The + on a day still opens the full day panel; "N" anywhere on the calendar opens quick add.
    document.addEventListener('keydown', e => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!document.getElementById('calendarView')?.classList.contains('active')) return;
      if (document.querySelector('.modal.open, .calendar-drawer.open')) return;
      e.preventDefault(); open();
    });
  }

  return { init, parse, open, close, addText };
})();

document.addEventListener('DOMContentLoaded', () => { try { window.PostIQQuickAdd.init(); } catch (e) { console.warn('[PostIQ quick add]', e); } });
