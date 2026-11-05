'use strict';
// Existing Buffer posts have their own editor so editing never creates a copy
// or overwrites an unfinished new-post composer draft.
window.PostIQPostEditor = (() => {
  const sessions = new WeakMap();
  const esc = value => safeText(String(value ?? ''));
  const scheduled = post => post && ['scheduled', 'buffer'].includes(String(post.status).toLowerCase());
  const localTime = value => {
    const date = new Date(value);
    if (!Number.isFinite(+date)) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  const identity = () => bufferConnectionGeneration;
  const fingerprint = post => JSON.stringify([post.text, post.dueAt, post.status, post.assets, post.metadata]);
  function assertSession(session) {
    if (session.generation !== identity() || !getBufferConnectionState().connected) throw new Error('Buffer connection changed. Reconnect and reopen this post.');
  }
  function status(box, message) { const el = box.querySelector('[data-edit-status]'); if (el) el.textContent = message; }
  function setBusy(box, busy) { box.querySelectorAll('button, input, textarea').forEach(el => { el.disabled = busy || (el.tagName === 'TEXTAREA' && el.dataset.thread === 'true'); }); }
  async function open(button) {
    const box = button.closest('.snap-modal-post').querySelector('[data-scheduled-editor]');
    if (!box.hidden) { box.querySelector('textarea')?.focus(); return; }
    const generation = identity();
    box.hidden = false;
    box.innerHTML = '<p role="status">Loading the latest post from Buffer…</p>';
    button.disabled = true;
    try {
      if (!getBufferConnectionState().connected) throw new Error('Connect Buffer to edit this post.');
      const post = await readBufferPostForEdit(button.dataset.editScheduled);
      if (generation !== identity()) throw new Error('Buffer connection changed. Reopen this post.');
      if (!scheduled(post) || String(post.id) !== button.dataset.editScheduled) throw new Error('This post is no longer scheduled. Sync Buffer to refresh the calendar.');
      const threaded = (post.metadata?.thread?.length || 0) > 0 || post.metadata?.threadCount > 0;
      const session = { post, generation, busy: false, threaded };
      sessions.set(box, session);
      box.innerHTML = `<form data-buffer-edit-form>
        <div class="post-detail-label">Edit scheduled post</div>
        <label class="label">Post text<textarea class="input" rows="6" data-edit-text data-thread="${threaded}" ${threaded ? 'disabled' : ''}>${esc(post.text)}</textarea></label>
        ${threaded ? '<p class="calendar-state">Thread text is edited in Buffer. You can reschedule, move to drafts, or publish the complete thread here.</p>' : ''}
        <p class="calendar-state">Existing media and channel settings stay attached.</p>
        ${mediaPreviewHtml(post)}
        <label class="label">Publish date and time · ${esc(window.PostIQCoverage.timezone)}<input type="datetime-local" class="input" data-edit-when value="${esc(localTime(post.dueAt))}" required></label>
        <div class="scheduled-edit-actions">
          <button type="submit" class="btn primary" data-edit-action="save">Save changes</button>
          <button type="button" class="btn" data-edit-action="draft">Move to drafts</button>
          <button type="button" class="btn" data-edit-action="publish">Publish now</button>
          <button type="button" class="btn ghost" data-edit-action="cancel">Cancel</button>
        </div>
        <div data-publish-confirm hidden><p>Send this post to Buffer for publishing immediately?</p><button type="button" class="btn primary" data-edit-action="confirm-publish">Confirm publish now</button><button type="button" class="btn ghost" data-edit-action="keep">Keep scheduled</button></div>
        <p data-edit-status role="status" aria-live="polite">Change the date to reschedule, then save.</p>
      </form>`;
      box.querySelector('form').addEventListener('submit', e => { e.preventDefault(); save(box, 'save'); });
      box.querySelectorAll('[data-edit-action]').forEach(btn => btn.addEventListener('click', () => {
        const action = btn.dataset.editAction;
        if (action === 'save') return; // form submit handles keyboard and clicks
        if (action === 'cancel') { box.hidden = true; sessions.delete(box); button.focus(); }
        else if (action === 'publish' || action === 'keep') box.querySelector('[data-publish-confirm]').hidden = action === 'keep';
        else save(box, action === 'confirm-publish' ? 'now' : action);
      }));
      box.querySelector('textarea:not([disabled]), input')?.focus();
    } catch (error) {
      box.innerHTML = `<p role="status">${esc(error.message || 'Could not load this post.')}</p><button type="button" class="btn sm" data-edit-dismiss>Close</button>`;
      box.querySelector('[data-edit-dismiss]').onclick = () => { box.hidden = true; button.focus(); };
    } finally { button.disabled = false; }
  }
  async function save(box, action) {
    const session = sessions.get(box);
    if (!session || session.busy || !['save', 'draft', 'now'].includes(action)) return;
    const text = box.querySelector('[data-edit-text]').value;
    const when = box.querySelector('[data-edit-when]').value;
    const textChanged = !session.threaded && text !== (session.post.text || '');
    const timeChanged = when !== localTime(session.post.dueAt);
    const parsedWhen = Date.parse(when);
    const dueAt = timeChanged && Number.isFinite(parsedWhen) ? new Date(parsedWhen).toISOString() : session.post.dueAt;
    if (action === 'save' && (!when || !Number.isFinite(parsedWhen) || Date.parse(dueAt) <= Date.now())) { status(box, 'Choose a future publish date and time.'); return; }
    if (textChanged && !text.trim() && !(session.post.assets || []).length) { status(box, 'Keep text or media on this post.'); return; }
    if (action === 'save' && !textChanged && !timeChanged) { status(box, 'No changes to save.'); return; }
    session.busy = true; setBusy(box, true); status(box, 'Saving in Buffer…');
    let accepted = false;
    try {
      assertSession(session);
      const current = await readBufferPostForEdit(session.post.id);
      assertSession(session);
      if (!scheduled(current) || fingerprint(current) !== fingerprint(session.post)) throw new Error('This post changed in Buffer. Cancel and reopen it to load the latest version. Your edits are still here.');
      const input = { id: current.id };
      if (textChanged) input.text = text;
      if (action === 'save' && timeChanged) { input.mode = 'customScheduled'; input.dueAt = dueAt; }
      if (action === 'draft') input.saveToDraft = true;
      if (action === 'now') input.mode = 'shareNow';
      const result = await editBufferPostPreservingContent(input, current.dueAt);
      accepted = true;
      assertSession(session);
      const index = state.scheduled.findIndex(post => String(post.id) === String(current.id));
      if (action === 'save') {
        if (index >= 0) state.scheduled[index] = { ...state.scheduled[index], text: textChanged ? text : current.text, dueAt: result.post.dueAt || dueAt };
      } else {
        state.scheduled = state.scheduled.filter(post => String(post.id) !== String(current.id));
        if (action === 'now') state.scheduledCoverage = { ...state.scheduledCoverage, complete: false };
      }
      persistLocalScheduled();
      window.dispatchEvent(new Event('postiq:scheduled-updated'));
      closeModal('sharedDayModal'); renderCalendar();
      showToast(action === 'draft' ? 'Moved to Buffer drafts.' : action === 'now' ? 'Sent to Buffer for publishing now.' : 'Changes saved in Buffer.', 'success');
      sessions.delete(box);
      if (action !== 'save') syncBuffer({ force: true });
    } catch (error) {
      status(box, accepted ? 'Buffer accepted the change. Sync the calendar before taking another action.' : (error.message || 'Buffer could not save this change.'));
      if (accepted) sessions.delete(box);
    } finally { session.busy = false; setBusy(box, false); }
  }
  function bind(root) {
    root.querySelectorAll('[data-edit-scheduled]').forEach(button => {
      button.addEventListener('click', () => open(button));
    });
  }
  return { bind };
})();
