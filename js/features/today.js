'use strict';
// Today strip + one-tap gap fill.
// Shows what's going out today, today's to-dos, and the next open slot with a
// ready-to-queue evergreen reshare. Every write says exactly what it will do first.
window.PostIQToday = (() => {
  const LOOKAHEAD_DAYS = 7;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = new Map(); // `${dateKey}|${channelId}` → offset into candidates
  let busy = false;

  const dayLabel = (key, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => new Date(key + 'T12:00:00').toLocaleDateString(undefined, opts);
  const relativeDay = key => {
    const today = fmtDate(new Date());
    const tomorrow = fmtDate(new Date(Date.now() + 864e5));
    return key === today ? 'Today' : key === tomorrow ? 'Tomorrow' : dayLabel(key, { weekday: 'long' });
  };
  const channelById = id => (state.channels || []).find(c => String(c.id) === String(id));
  const serviceOf = c => String(c?.service || c?.platform || '').toLowerCase();
  const icon = idOrChannel => {
    const c = typeof idOrChannel === 'object' ? idOrChannel : channelById(idOrChannel);
    return window.PostIQChannelIcons?.badge?.(serviceOf(c) || c?.displayName) || '';
  };
  const channelName = id => { const c = channelById(id); return c?.displayName || c?.name || 'Channel'; };

  // ── Evergreen candidates: starred past posts, same platform first ──
  function evergreen() {
    try {
      const starred = new Set(JSON.parse(localStorage.getItem('postiq_library_starred_v1') || '[]'));
      const cache = JSON.parse(localStorage.getItem('postiq_library_cache_v3') || '{}');
      return (Array.isArray(cache.posts) ? cache.posts : [])
        .filter(p => starred.has(p.id) && String(p.text || '').trim())
        .map(p => ({ id: p.id, text: String(p.text).trim(), channelId: String(p.channelId || ''), service: serviceOf(channelById(p.channelId)) || String(p.service || '').toLowerCase() }));
    } catch { return []; }
  }
  function suggestionFor(dateKey, channelId) {
    const target = channelById(channelId);
    const pool = evergreen();
    if (!pool.length) return null;
    // Don't suggest something already queued on this channel.
    const queued = new Set((state.scheduled || []).filter(p => String(p.channelId) === String(channelId)).map(p => String(p.text || '').trim()));
    const fresh = pool.filter(p => !queued.has(p.text));
    const list = fresh.length ? fresh : pool;
    const ranked = [...list.filter(p => p.channelId === String(channelId)), ...list.filter(p => p.channelId !== String(channelId) && p.service === serviceOf(target)), ...list.filter(p => p.channelId !== String(channelId) && p.service !== serviceOf(target))];
    const offset = shuffle.get(`${dateKey}|${channelId}`) || 0;
    return { post: ranked[offset % ranked.length], total: ranked.length };
  }
  // The channel's usual posting time, from its own posts; 9:00 AM if it has none.
  function usualTime(channelId) {
    const hours = {};
    [...(state.scheduled || []), ...(state.published || [])]
      .filter(p => String(p.channelId) === String(channelId))
      .forEach(p => { const at = new Date(getPostPlanningAt(p)); if (!isNaN(at)) { const k = `${at.getHours()}:${at.getMinutes()}`; hours[k] = (hours[k] || 0) + 1; } });
    const best = Object.entries(hours).sort((a, b) => b[1] - a[1])[0]?.[0] || '9:0';
    const [h, m] = best.split(':').map(Number);
    return { h, m };
  }
  function slotTime(dateKey, channelId) {
    const { h, m } = usualTime(channelId);
    const [y, mo, d] = dateKey.split('-').map(Number);
    let when = new Date(y, mo - 1, d, h, m, 0, 0);
    const soon = new Date(Date.now() + 20 * 60 * 1000);
    if (when < soon) { when = new Date(soon); when.setMinutes(Math.ceil(when.getMinutes() / 15) * 15, 0, 0); }
    // Too late today → this day can't be filled; caller skips it.
    return fmtDate(when) === dateKey ? when : null;
  }

  function openSlots(fromKey = fmtDate(new Date()), days = LOOKAHEAD_DAYS) {
    if (typeof dayCoverageRows !== 'function') return [];
    const out = [];
    const start = new Date(fromKey + 'T12:00:00');
    for (let i = 0; i < days; i++) {
      const date = new Date(start); date.setDate(start.getDate() + i);
      const key = fmtDate(date);
      let rows = [];
      try { rows = dayCoverageRows(date).filter(r => r.status === 'gap'); } catch {}
      rows.forEach(r => { if (slotTime(key, r.channelId)) out.push({ dateKey: key, channelId: String(r.channelId) }); });
    }
    return out;
  }

  // ── Fill: one decision, clearly worded ───────────────────
  function fillCardHtml(slot, { compact = false } = {}) {
    const s = suggestionFor(slot.dateKey, slot.channelId);
    const when = slotTime(slot.dateKey, slot.channelId);
    const time = when?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) || '';
    const head = `<div class="fill-head">${icon(slot.channelId)}<span><strong>${esc(relativeDay(slot.dateKey))}</strong> · ${esc(channelName(slot.channelId))} has an open slot</span></div>`;
    if (!s) {
      return `<div class="fill-card${compact ? ' is-compact' : ''}">${head}
        <p class="fill-empty">Star a past post on your Shelf and you can fill slots like this in one tap.</p>
        <div class="fill-actions"><button type="button" class="btn sm primary" data-fill-write="${slot.dateKey}|${slot.channelId}">Write a post</button><button type="button" class="btn sm ghost" data-fill-shelf>Open Shelf</button></div></div>`;
    }
    return `<div class="fill-card${compact ? ' is-compact' : ''}">${head}
      <blockquote class="fill-quote">${esc(compactText(s.post.text, compact ? 90 : 140))}</blockquote>
      <div class="fill-actions">
        <button type="button" class="btn sm primary" data-fill-queue="${slot.dateKey}|${slot.channelId}">Reshare ${esc(dayLabel(slot.dateKey, { weekday: 'short' }))} at ${esc(time)}</button>
        ${s.total > 1 ? `<button type="button" class="btn sm ghost" data-fill-next="${slot.dateKey}|${slot.channelId}" aria-label="Suggest a different post">Another</button>` : ''}
        <button type="button" class="btn sm ghost" data-fill-write="${slot.dateKey}|${slot.channelId}">Write new</button>
      </div></div>`;
  }
  function compactText(text, n) { const t = String(text).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; }

  async function queue(dateKey, channelId, button) {
    if (busy) return;
    const s = suggestionFor(dateKey, channelId);
    const when = slotTime(dateKey, channelId);
    if (!s || !when) { showToast('That slot can’t be filled anymore — try another day.', 'error'); render(); return; }
    busy = true;
    if (button) { button.disabled = true; button.textContent = 'Queuing…'; }
    try {
      const created = await createPost({ channelId, text: s.post.text, mode: 'customScheduled', dueAt: when.toISOString(), schedulingType: 'automatic' });
      if (typeof appendScheduled === 'function') appendScheduled(created.post, { channelId, text: s.post.text, dueAt: when.toISOString() });
      shuffle.delete(`${dateKey}|${channelId}`);
      showToast(`Queued in Buffer for ${dayLabel(dateKey)} at ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`, 'success');
      closePopover();
      renderCalendar();
    } catch (error) {
      showToast(error?.message || 'Buffer didn’t accept that post.', 'error');
      if (button) { button.disabled = false; button.textContent = 'Try again'; }
    } finally { busy = false; }
  }

  // ── Popover from a day's open slot ───────────────────────
  let pop = null;
  function closePopover() { if (pop) { pop.remove(); pop = null; } }
  function openPopover(dateKey, anchor) {
    closePopover();
    const slots = openSlots(dateKey, 1);
    if (!slots.length) { window.CalendarExperience?.add(dateKey); return; }
    pop = document.createElement('div');
    pop.className = 'fill-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', `Fill open slots on ${dayLabel(dateKey)}`);
    pop.innerHTML = `<div class="fill-pop-title">${esc(dayLabel(dateKey, { weekday: 'long', month: 'short', day: 'numeric' }))}<button type="button" class="fill-pop-close" aria-label="Close">×</button></div>${slots.map(s => fillCardHtml(s, { compact: true })).join('')}<button type="button" class="more-link" data-fill-day="${dateKey}">Open the day</button>`;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const w = Math.min(340, window.innerWidth - 24);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12)) + 'px';
    const below = r.bottom + 8, height = pop.offsetHeight;
    pop.style.top = (below + height < window.innerHeight - 12 ? below : Math.max(12, r.top - height - 8)) + window.scrollY + 'px';
    pop.querySelector('.fill-pop-close').addEventListener('click', closePopover);
    pop.querySelector('button[data-fill-queue], button[data-fill-write]')?.focus();
  }

  // ── Today strip ──────────────────────────────────────────
  function viewingToday() {
    const now = new Date();
    if (state.calendarView === 'month' && !window.CalendarExperience?.narrow()) return state.month.getFullYear() === now.getFullYear() && state.month.getMonth() === now.getMonth();
    const s = weekStart(state.month), e = new Date(s); e.setDate(s.getDate() + 6);
    const k = fmtDate(now); return k >= fmtDate(s) && k <= fmtDate(e);
  }
  function render() {
    const box = document.getElementById('todayStrip');
    if (!box) return;
    if (isContentCalendarMode?.() || !viewingToday()) { box.hidden = true; return; }
    const key = fmtDate(new Date());
    const connected = getBufferConnectionState().connected;
    const posts = connected ? postsForDateKey(key).filter(p => !isPublishedPost(p)).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)) : [];
    const upcoming = posts.filter(p => new Date(p.dueAt) > new Date());
    const todos = getNotesForDate(key).filter(n => isActionNote(n));
    const slots = connected ? openSlots() : [];

    let going;
    if (!connected) going = `<span class="today-muted">Connect Buffer to see what’s going out.</span>`;
    else if (!posts.length) going = `<span class="today-muted">Nothing going out today.</span>`;
    else if (!upcoming.length) going = `<span>All ${posts.length} of today’s posts are out.</span>`;
    else {
      const next = upcoming[0], t = new Date(next.dueAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      going = `<span><strong>${upcoming.length}</strong> going out · next at ${esc(t)}</span><span class="today-icons">${upcoming.slice(0, 4).map(p => icon(p.channelId)).join('')}</span>`;
    }
    const todoHtml = todos.length
      ? `<ul class="today-todos">${todos.slice(0, 3).map(n => `<li><label><input type="checkbox" data-today-done="${esc(n.id)}" ${n.completedAt ? 'checked' : ''}><span>${esc(compactText(n.text, 60))}</span></label></li>`).join('')}${todos.length > 3 ? `<li class="today-muted">+${todos.length - 3} more</li>` : ''}</ul>`
      : '';
    let right;
    if (slots.length) right = fillCardHtml(slots[0]);
    else if (connected && scheduledPlanningChannels?.().length) right = `<div class="today-calm"><strong>You’re covered this week.</strong><span>No open slots in the next ${LOOKAHEAD_DAYS} days.</span></div>`;
    else if (connected) right = `<div class="today-calm"><span>Set a posting schedule and open slots show up here, ready to fill.</span><button type="button" class="more-link" data-open-schedule="today">Set posting schedule</button></div>`;
    else right = '';

    box.innerHTML = `<div class="today-left"><div class="today-kicker">Today</div><div class="today-date">${esc(dayLabel(key, { weekday: 'long', month: 'long', day: 'numeric' }))}</div><div class="today-going">${going}</div>${todoHtml}</div>${right ? `<div class="today-right">${right}</div>` : ''}`;
    box.hidden = false;
    box.querySelectorAll('[data-open-schedule]').forEach(b => b.addEventListener('click', () => window.YourPace?.open?.()));
  }

  function onClick(e) {
    const q = e.target.closest('[data-fill-queue]');
    if (q) { const [k, c] = q.dataset.fillQueue.split('|'); queue(k, c, q); return; }
    const n = e.target.closest('[data-fill-next]');
    if (n) {
      const id = n.dataset.fillNext; shuffle.set(id, (shuffle.get(id) || 0) + 1);
      if (pop && pop.contains(n)) { const [k] = id.split('|'); const anchor = document.querySelector(`[data-calendar-date="${k}"] .day-gap-slot`) || n; openPopover(k, anchor); }
      else render();
      return;
    }
    const w = e.target.closest('[data-fill-write]');
    if (w) { const [k, c] = w.dataset.fillWrite.split('|'); closePopover(); window.CalendarExperience?.compose(k, c); return; }
    if (e.target.closest('[data-fill-shelf]')) { closePopover(); activateView('libraryView', 'fill'); return; }
    const d = e.target.closest('[data-fill-day]');
    if (d) { closePopover(); window.CalendarExperience?.add(d.dataset.fillDay); return; }
    const slot = e.target.closest('.day-gap-slot');
    if (slot) {
      e.stopPropagation();
      const cell = slot.closest('[data-calendar-date]');
      if (cell) openPopover(cell.dataset.calendarDate, slot);
      return;
    }
    if (pop && !pop.contains(e.target)) closePopover();
  }
  function onChange(e) {
    const box = e.target.closest('[data-today-done]');
    if (!box) return;
    toggleNoteDone(fmtDate(new Date()), box.dataset.todayDone);
    window.dispatchEvent(new Event('postiq:planning-changed'));
    renderCalendar();
  }

  function init() {
    const main = document.querySelector('#calendarView .calendar-main');
    if (!main || document.getElementById('todayStrip')) return;
    const strip = document.createElement('section');
    strip.id = 'todayStrip'; strip.className = 'today-strip'; strip.hidden = true; strip.setAttribute('aria-label', 'Today');
    const anchor = document.getElementById('calendarState');
    anchor ? anchor.after(strip) : main.prepend(strip);
    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop) { closePopover(); } });
    ['postiq:synced', 'postiq:scheduled-updated', 'postiq:planning-changed', 'postiq:library-changed'].forEach(ev => window.addEventListener(ev, render));
    render();
  }

  return { init, render, openSlots, suggestionFor, slotTime, usualTime, openPopover, queue, fillCardHtml };
})();

document.addEventListener('DOMContentLoaded', () => { try { window.PostIQToday.init(); } catch (e) { console.warn('[PostIQ today]', e); } });
