'use strict';
// Drag to reschedule. Plans move locally; Buffer posts move with editPost
// through the reschedule helper, including its live content-validation fallback.
// Every move gets an Undo. Published posts and past days don't move.
window.PostIQDrag = (() => {
  let dragging = null; // { kind:'post'|'note', id, fromKey }

  // ── Toast with an action button ──────────────────────────
  function actionToast(message, { label = 'Undo', onAction, type = 'success', ms = 6000 } = {}) {
    const wrap = document.getElementById('toastWrap');
    if (!wrap) return;
    const t = document.createElement('div');
    t.className = `toast toast-action ${type}`;
    t.setAttribute('role', 'status');
    const text = document.createElement('span'); text.textContent = message;
    t.appendChild(text);
    let timer;
    const dismiss = () => { clearTimeout(timer); t.classList.add('out'); setTimeout(() => t.remove(), 250); };
    if (onAction) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'toast-action-btn'; btn.textContent = label;
      btn.addEventListener('click', () => { dismiss(); onAction(); });
      t.appendChild(btn);
    }
    wrap.appendChild(t);
    timer = setTimeout(dismiss, ms);
  }

  const dayLabel = key => new Date(key + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const todayKey = () => fmtDate(new Date());

  // ── Plans ───────────────────────────────────────────────
  function moveNote(noteId, fromKey, toKey) {
    if (fromKey === toKey) return false;
    const notes = getNotes();
    const list = getNotesForDate(fromKey, notes);
    const index = list.findIndex(n => n.id === noteId);
    if (index === -1) return false;
    const [note] = list.splice(index, 1);
    note.date = toKey; note.updatedAt = new Date().toISOString();
    if (list.length) notes[fromKey] = list; else delete notes[fromKey];
    notes[toKey] = [...getNotesForDate(toKey, notes), note];
    setNotes(notes);
    window.dispatchEvent(new Event('postiq:planning-changed'));
    renderCalendar();
    return true;
  }
  function dropNote(noteId, fromKey, toKey) {
    if (!moveNote(noteId, fromKey, toKey)) return;
    actionToast(`Moved to ${dayLabel(toKey)}`, { onAction: () => { moveNote(noteId, toKey, fromKey); showToast(`Moved back to ${dayLabel(fromKey)}`); } });
  }

  // ── Buffer posts ────────────────────────────────────────
  function findPost(id) { return (state.scheduled || []).find(p => String(p.id) === String(id)); }
  function sameTimeOn(dueAt, toKey) {
    const from = new Date(dueAt);
    const [y, m, d] = toKey.split('-').map(Number);
    return new Date(y, m - 1, d, from.getHours(), from.getMinutes(), 0, 0);
  }
  function persistScheduled() {
    try { cache.scheduled = { value: state.scheduled, ts: Date.now(), coverage: state.scheduledCoverage }; saveCacheState(); } catch {}
    window.dispatchEvent(new Event('postiq:scheduled-updated'));
    renderCalendar();
  }
  async function setPostTime(post, when) {
    const previous = post.dueAt;
    post.dueAt = when.toISOString(); post._moving = true;
    persistScheduled();
    try {
      const result = await rescheduleBufferPost(post.id, when.toISOString(), previous);
      if (result?.post?.dueAt) post.dueAt = result.post.dueAt;
      return true;
    } catch (error) {
      post.dueAt = previous;
      showToast(error?.message ? `Couldn't move it: ${error.message}` : 'Buffer didn’t accept that move. The post is back where it was.', 'error');
      return false;
    } finally {
      delete post._moving;
      persistScheduled();
    }
  }
  async function dropPost(postId, fromKey, toKey) {
    const post = findPost(postId);
    if (!post || post._moving || isPublishedPost(post) || fromKey === toKey) return;
    const original = post.dueAt;
    const when = sameTimeOn(original, toKey);
    if (when <= new Date()) { showToast('That time has already passed — pick a later day.', 'error'); return; }
    if (!(await setPostTime(post, when))) return;
    const time = when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    actionToast(`Moved to ${dayLabel(toKey)}, ${time} in Buffer`, {
      onAction: async () => {
        const back = new Date(original);
        if (back <= new Date()) { showToast('The original time has passed, so it stays on the new day.', 'error'); return; }
        if (await setPostTime(post, back)) showToast(`Moved back to ${dayLabel(fromKey)}`);
      },
    });
  }

  // ── Wiring (delegated, so re-renders need no rebinding) ──
  function canMovePost(id) {
    const post = findPost(id);
    return !!post && !isPublishedPost(post) && !post._moving && new Date(post.dueAt) > new Date();
  }
  function onDragStart(e) {
    const pill = e.target.closest?.('[data-post-id], [data-note-detail], [data-week-note]');
    const cell = pill?.closest('[data-calendar-date]');
    if (!pill || !cell) return;
    if (pill.dataset.postId) {
      if (!canMovePost(pill.dataset.postId)) { e.preventDefault(); return; }
      dragging = { kind: 'post', id: pill.dataset.postId, fromKey: cell.dataset.calendarDate };
    } else {
      dragging = { kind: 'note', id: pill.dataset.noteDetail || pill.dataset.weekNote, fromKey: cell.dataset.calendarDate };
    }
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragging.id); } catch {}
    pill.classList.add('is-dragging');
    document.getElementById('calendarView')?.classList.add('is-dragging-item');
  }
  function targetCell(e) {
    const cell = e.target.closest?.('[data-calendar-date]');
    if (!cell || !dragging) return null;
    if (cell.dataset.calendarDate < todayKey() && dragging.kind === 'post') return null;
    return cell;
  }
  function onDragOver(e) {
    const cell = targetCell(e);
    if (!cell) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.is-drop-target').forEach(c => c !== cell && c.classList.remove('is-drop-target'));
    cell.classList.add('is-drop-target');
  }
  function clear() {
    document.querySelectorAll('.is-drop-target, .is-dragging').forEach(el => el.classList.remove('is-drop-target', 'is-dragging'));
    document.getElementById('calendarView')?.classList.remove('is-dragging-item');
  }
  function onDrop(e) {
    const cell = targetCell(e);
    const job = dragging; dragging = null; clear();
    if (!cell || !job) return;
    e.preventDefault();
    const toKey = cell.dataset.calendarDate;
    if (job.kind === 'note') dropNote(job.id, job.fromKey, toKey);
    else dropPost(job.id, job.fromKey, toKey);
  }

  function init() {
    const root = document.getElementById('calendarView');
    if (!root) return;
    root.addEventListener('dragstart', onDragStart);
    root.addEventListener('dragover', onDragOver);
    root.addEventListener('drop', onDrop);
    root.addEventListener('dragend', () => { dragging = null; clear(); });
    root.addEventListener('dragleave', e => { if (!root.contains(e.relatedTarget)) clear(); });
  }

  return { init, moveNote, dropNote, dropPost, actionToast, canMovePost };
})();

document.addEventListener('DOMContentLoaded', () => { try { window.PostIQDrag.init(); } catch (e) { console.warn('[PostIQ drag]', e); } });
