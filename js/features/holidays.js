'use strict';
// Holiday layer: public holidays for one country, shown as a quiet line under the
// date number. Cached in the browser per country and year. Off is a real option.
window.PostIQHolidays = (() => {
  const KEY = 'postiq_holidays_v1';
  const TTL = 30 * 24 * 60 * 60 * 1000;
  const COUNTRIES = [
    ['US', 'United States'], ['CA', 'Canada'], ['GB', 'United Kingdom'], ['IE', 'Ireland'], ['AU', 'Australia'],
    ['NZ', 'New Zealand'], ['MX', 'Mexico'], ['BR', 'Brazil'], ['DE', 'Germany'], ['FR', 'France'], ['ES', 'Spain'],
    ['IT', 'Italy'], ['NL', 'Netherlands'], ['SE', 'Sweden'], ['ZA', 'South Africa'], ['JP', 'Japan'], ['PH', 'Philippines'],
  ];
  const pending = new Map();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } }
  function write(store) { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} }

  function guessCountry() {
    const tag = (navigator.languages && navigator.languages[0]) || navigator.language || 'en-US';
    const region = String(tag).split('-')[1]?.toUpperCase();
    return COUNTRIES.some(([code]) => code === region) ? region : 'US';
  }
  function country() {
    const saved = read().country;
    return saved === 'off' ? 'off' : (COUNTRIES.some(([c]) => c === saved) ? saved : guessCountry());
  }
  function setCountry(code) {
    const store = read(); store.country = code === 'off' ? 'off' : String(code || '').toUpperCase(); write(store);
    renderSelect(); refresh();
  }

  function listFor(year, code = country()) {
    if (code === 'off') return [];
    const entry = read().cache?.[`${code}-${year}`];
    return Array.isArray(entry?.list) ? entry.list : [];
  }
  async function ensure(year, code = country()) {
    if (code === 'off') return [];
    const id = `${code}-${year}`;
    const store = read();
    const entry = store.cache?.[id];
    if (entry && Date.now() - entry.ts < TTL) return entry.list;
    if (pending.has(id)) return pending.get(id);
    const job = (async () => {
      try {
        const res = await fetch(`/.netlify/functions/holidays?country=${code}&year=${year}`, { headers: { Accept: 'application/json' } });
        if (!res.ok) return entry?.list || [];
        const data = await res.json();
        const list = Array.isArray(data?.holidays) ? data.holidays : [];
        const next = read(); next.cache = { ...(next.cache || {}), [id]: { ts: Date.now(), list } }; write(next);
        return list;
      } catch { return entry?.list || []; } finally { pending.delete(id); }
    })();
    pending.set(id, job);
    return job;
  }

  function forDate(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return [];
    return listFor(Number(key.slice(0, 4))).filter(h => h.date === key);
  }
  function cellHtml(key) {
    const list = forDate(key);
    if (!list.length) return '';
    const names = list.map(h => h.name).join(' · ');
    return `<div class="day-holiday" title="${esc(names)}">${esc(names)}</div>`;
  }
  // "Thanksgiving: gratitude post" → the next Thanksgiving on or after today.
  function findByName(text, from = new Date()) {
    const needle = String(text || '').toLowerCase().replace(/['’]s\b/g, '').replace(/\s+day$/, '').trim();
    if (needle.length < 4) return null;
    const today = fmtDate(from);
    const years = [from.getFullYear(), from.getFullYear() + 1];
    for (const y of years) {
      const hit = listFor(y).filter(h => h.date >= today).find(h => {
        const name = h.name.toLowerCase().replace(/['’]s\b/g, '');
        return name === needle || name.replace(/\s+day$/, '') === needle || name.startsWith(needle + ' ');
      });
      if (hit) return hit;
    }
    return null;
  }

  // Make sure the months on screen (and next year, for quick add) are loaded, then redraw once.
  async function refresh() {
    if (country() === 'off') { if (typeof renderCalendar === 'function') renderCalendar(); return; }
    const month = (typeof state !== 'undefined' && state.month) ? state.month : new Date();
    const years = new Set([month.getFullYear(), new Date().getFullYear(), new Date().getFullYear() + 1]);
    const before = JSON.stringify([...years].map(y => listFor(y).length));
    await Promise.all([...years].map(y => ensure(y)));
    const after = JSON.stringify([...years].map(y => listFor(y).length));
    if (before !== after && typeof renderCalendar === 'function') renderCalendar();
  }

  function renderSelect() {
    const select = document.getElementById('calendarHolidayCountry');
    if (!select) return;
    if (!select.options.length) {
      select.innerHTML = '<option value="off">Off</option>' + COUNTRIES.map(([code, name]) => `<option value="${code}">${esc(name)}</option>`).join('');
      select.addEventListener('change', () => setCountry(select.value));
    }
    select.value = country();
  }

  function init() {
    renderSelect();
    refresh();
    // Paging into a new year loads that year's holidays.
    ['prevMonth', 'nextMonth', 'todayMonth'].forEach(id => document.getElementById(id)?.addEventListener('click', () => setTimeout(refresh, 0)));
  }

  return { init, country, setCountry, ensure, listFor, forDate, cellHtml, findByName, refresh, COUNTRIES };
})();

document.addEventListener('DOMContentLoaded', () => { try { window.PostIQHolidays.init(); } catch (e) { console.warn('[PostIQ holidays]', e); } });
