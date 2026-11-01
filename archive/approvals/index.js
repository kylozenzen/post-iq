'use strict';

// ── APPROVALS ──────────────────────────────────────
const appState = { loading: false };

async function loadApprovals() {
  if (!getFeatureFlag('approvals')) { showFeaturePaused('approvals'); return; }
  if (appState.loading) return; appState.loading = true;
  const listEl = qs('approvalsList'), emptyEl = qs('approvalsEmpty');
  if (!listEl) { appState.loading = false; return; }
  listEl.innerHTML = '';
  if (emptyEl) emptyEl.style.display = 'none';
  try {
    const metas = getAllApprovalMetas();
    if (!metas.length) { if (emptyEl) emptyEl.style.display = 'flex'; appState.loading = false; return; }
    for (const meta of metas) {
      if (meta.link_generated && meta.approval_uuid) {
        try {
          const r = await fetch('/.netlify/functions/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get', id: meta.approval_uuid }) });
          const d = await r.json();
          if (!d.error) {
            const updated = { ...meta, status: d.status || meta.status, comments: d.comments || meta.comments };
            if (d.status === 'changes_requested') { updated.link_generated = false; updated.locked = false; }
            setApprovalMeta(meta.draftId, updated); Object.assign(meta, updated);
          }
        } catch {}
      }
    }
    metas.forEach(meta => renderApprovalCard(meta));
  } catch (e) { console.error('[PostIQ] loadApprovals:', e); }
  finally { appState.loading = false; }
}

function renderApprovalCard(meta) {
  const listEl = qs('approvalsList');
  const safeId = meta.draftId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const statusClass = meta.status === 'approved' ? 'approved' : meta.status === 'changes_requested' ? 'changes' : 'pending';
  const statusLabel = meta.status === 'approved' ? 'Approved' : meta.status === 'changes_requested' ? 'Changes Requested' : 'Pending';
  const platformBadge = meta.platform ? `<span class="chip">${safeText(meta.platform)}</span>` : '';
  const pubDisabled = meta.status === 'pending' && meta.link_generated;
  const dmMono = 'DM Mono';

  const card = document.createElement('div');
  card.className = 'approval-card';
  card.dataset.draftId = meta.draftId;
  card.dataset.safeId = safeId;

  card.innerHTML = `
    <div class="approval-card-status-bar ${statusClass}"></div>
    <div class="approval-card-header">
      <div class="approval-card-meta">
        <span class="approval-status-badge ${statusClass}">${statusLabel}</span>
        ${platformBadge}
        <span style="font-size:10px;font-family:'${dmMono}',monospace;color:var(--subtle);">${meta.created_at ? new Date(meta.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : ''}</span>
      </div>
      <button class="btn sm ghost" onclick="approvalRemove('${safeId}')">✕ Remove</button>
    </div>
    <div class="approval-card-body">
      ${meta.image_url ? `<img src="${safeText(meta.image_url)}" alt="Media" style="width:100%;max-height:240px;object-fit:cover;border-radius:8px;border:1px solid var(--border);margin-bottom:12px;display:block;" />` : ''}
      <div class="approval-content-text">${safeText(meta.content || '')}</div>
      ${meta.comments?.length ? `
        <div class="approval-comments">
          <div style="font-size:10px;font-family:'${dmMono}',monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">Reviewer feedback</div>
          ${meta.comments.map(c => `
            <div class="approval-comment">
              <div class="approval-comment-meta">
                <span class="approval-comment-author">${safeText(c.author || 'Anonymous')}</span>
                <span class="approval-comment-time">${c.timestamp ? new Date(c.timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : ''}</span>
                ${c.action ? `<span class="approval-comment-action ${c.action === 'approved' ? 'approved' : 'changes'}">${c.action === 'approved' ? 'Approved' : 'Changes'}</span>` : ''}
              </div>
              <div class="approval-comment-text">${safeText(c.text || '')}</div>
            </div>`).join('')}
        </div>` : ''}
    </div>
    <div class="approval-footer">
      ${!meta.link_generated ? `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:12px;font-weight:600;margin-bottom:2px;">Share for approval</div>
            <div style="font-size:11px;color:var(--muted);">Generate a link to send to your reviewer.</div>
          </div>
          <button class="btn primary" id="approval-gen-${safeId}" onclick="approvalGenerateLink('${safeId}')">🔗 Generate Link</button>
        </div>` : `
        <div style="margin-bottom:12px;">
          <div class="label mb8">Approval link</div>
          <div class="approval-link-row">
            <span class="approval-link-url">${safeText(meta.approval_url || '')}</span>
            <button class="btn sm" onclick="approvalCopyLink('${safeId}')">Copy</button>
          </div>
        </div>
        <div style="${pubDisabled ? 'opacity:.45;pointer-events:none;' : ''}">
          ${pubDisabled ? `<div style="font-size:11px;font-family:'${dmMono}',monospace;color:var(--subtle);margin-bottom:10px;">Publishing unlocks once reviewer responds.</div>` : ''}
          <div class="label mb8">Publish to</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <select id="approval-ch-${safeId}" class="input" style="flex:1;min-width:160px;font-size:13px;"></select>
            <button class="btn sm" onclick="approvalPublish('${safeId}','draft')">Draft</button>
            <button class="btn sm success" onclick="approvalPublish('${safeId}','queue')">Queue</button>
            <button class="btn sm primary" onclick="approvalToggleSchedule('${safeId}')">📅 Schedule</button>
          </div>
          <div id="approval-sched-${safeId}" style="display:none;margin-top:8px;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <input type="date" id="approval-date-${safeId}" class="input" style="flex:1;" />
              <input type="time" id="approval-time-${safeId}" class="input" style="max-width:120px;" value="09:00" />
              <button class="btn sm primary" onclick="approvalPublish('${safeId}','schedule')">Send</button>
              <button class="btn sm ghost" onclick="document.getElementById('approval-sched-${safeId}').style.display='none'">✕</button>
            </div>
          </div>
        </div>`}
      <div id="approval-status-${safeId}" style="font-size:12px;color:var(--muted);margin-top:8px;font-family:'${dmMono}',monospace;min-height:16px;"></div>
    </div>`;

  setTimeout(() => {
    const sel = document.getElementById(`approval-ch-${safeId}`);
    if (sel) {
      sel.innerHTML = '';
      if (state.channels.length) {
        state.channels.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.displayName || c.name} (${c.service})`; if (c.id === meta.channel_id) o.selected = true; sel.appendChild(o); });
      } else { const o = document.createElement('option'); o.value = ''; o.textContent = '↻ Load channels from Buffer first'; sel.appendChild(o); }
    }
    const di = document.getElementById(`approval-date-${safeId}`); if (di) di.value = new Date().toISOString().slice(0,10);
  }, 0);

  listEl.appendChild(card);
}

function getApprovalDraftId(safeId) {
  const card = document.querySelector(`.approval-card[data-safe-id="${CSS.escape(safeId)}"]`);
  return card?.dataset?.draftId || safeId;
}

window.approvalGenerateLink = async function (safeId) {
  const draftId = getApprovalDraftId(safeId);
  const meta = getApprovalMeta(draftId); if (!meta) { showToast('Record not found', 'error'); return; }
  const btn = document.getElementById(`approval-gen-${safeId}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
  try {
    const res = await fetch('/.netlify/functions/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', post: { content: meta.content || '', platform: meta.platform || null, image_url: meta.image_url || null } }) });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    setApprovalMeta(draftId, { ...meta, link_generated: true, locked: true, approval_uuid: data.id, approval_url: data.url });
    showToast('Approval link generated!', 'success');
    safeTrack(() => GA4_Approvals.approvalLinkGenerated({ reviewerCount: 1, isTeam: false }));
    loadApprovals();
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🔗 Generate Link'; }
    safeTrack(() => GA4_System.applicationError(e, 'approvals'));
  }
};

window.approvalCopyLink = function (safeId) {
  const draftId = getApprovalDraftId(safeId); const meta = getApprovalMeta(draftId);
  if (!meta?.approval_url) { showToast('No link available', 'error'); return; }
  navigator.clipboard.writeText(meta.approval_url); showToast('Link copied!', 'success');
  safeTrack(() => GA4_Approvals.approvalLinkCopied());
  safeTrack(() => GA4_Approvals.approvalLinkShared('copy_link'));
};

window.approvalRemove = function (safeId) {
  const draftId = getApprovalDraftId(safeId);
  if (!confirm('Remove this approval entry? The Buffer draft is not deleted.')) return;
  clearApprovalMeta(draftId);
  const card = document.querySelector(`[data-draft-id="${CSS.escape(draftId)}"]`);
  if (card) card.remove(); else loadApprovals();
  showToast('Removed');
  safeTrack(() => GA4_Approvals.approvalArchived());
};

window.approvalToggleSchedule = function (safeId) {
  const panel = document.getElementById(`approval-sched-${safeId}`);
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};

window.approvalPublish = async function (safeId, action) {
  const draftId = getApprovalDraftId(safeId); const meta = getApprovalMeta(draftId);
  if (!meta) { showToast('Record not found', 'error'); return; }
  const channelId = document.getElementById(`approval-ch-${safeId}`)?.value;
  if (!channelId) { showToast('Select a channel first', 'error'); return; }
  const input = { channelId, text: meta.content || '', schedulingType: 'automatic' };
  if (action === 'draft') { input.mode = 'addToQueue'; input.saveToDraft = true; }
  if (action === 'queue') { input.mode = 'addToQueue'; }
  if (action === 'schedule') {
    const dv = document.getElementById(`approval-date-${safeId}`)?.value;
    const tv = document.getElementById(`approval-time-${safeId}`)?.value || '09:00';
    if (!dv) { showToast('Pick a date first', 'error'); return; }
    input.mode = 'customScheduled'; input.dueAt = `${dv}T${tv}:00.000Z`;
  }
  if (meta.image_url) { if (isVideo(meta.image_url)) input.assets = [{ video: { url: meta.image_url } }]; else input.assets = [{ image: { url: meta.image_url } }]; }
  const statusEl = document.getElementById(`approval-status-${safeId}`);
  if (statusEl) statusEl.textContent = 'Sending…';
  try {
    const created = await createPost(input);
    clearApprovalMeta(draftId);
    const msg = action === 'draft' ? 'Buffer draft saved.' : action === 'queue' ? 'Added to queue.' : 'Scheduled.';
    showToast(msg, 'success');
    if (created?.post?.dueAt) { appendScheduled(created.post, input); renderCalendar(); }
    const card = document.querySelector(`[data-draft-id="${CSS.escape(draftId)}"]`);
    if (card) { card.style.opacity = '.4'; card.style.pointerEvents = 'none'; setTimeout(() => card.remove(), 600); }
    safeTrack(() => GA4_Approvals.approvalPublished());
  } catch (e) {
    const msg = getErrorMessage(e, 'Failed.');
    if (isAuthError(e)) handleAuthFailure(msg);
    if (statusEl) statusEl.textContent = `Failed: ${msg}`;
    showToast('Failed: ' + msg, 'error');
  }
};
