'use strict';

// ── REVIEWER PAGE ──────────────────────────────────
async function renderReviewerPage(uuid) {
  document.getElementById('app')?.style.setProperty('display','none');
  document.querySelector('.mobile-tabs')?.style.setProperty('display','none');
  const page = qs('reviewerPage'); if (!page) return;
  page.classList.add('active');
  const loading = qs('reviewerLoading'), content = qs('reviewerContent'), confirmed = qs('reviewerConfirmed'), error = qs('reviewerError');
  loading.style.display = 'block'; content.style.display = 'none'; confirmed.style.display = 'none'; error.style.display = 'none';
  try {
    const res = await fetch('/.netlify/functions/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get', id: uuid }) });
    const record = await res.json();
    loading.style.display = 'none';
    if (record.error) { error.style.display = 'block'; qs('reviewerErrorMsg').textContent = 'This review link could not be found. It may have expired or been removed.'; return; }
    content.style.display = 'block';
    const { platform, content: postContent, image_url: imageUrl } = record.post || {};
    const comments = record.comments || [];
    const dmMono = 'DM Mono';
    content.innerHTML = `
      <div class="reviewer-card">
        ${platform ? `<div style="font-size:10px;font-family:'${dmMono}',monospace;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px;border:1px solid var(--border2);border-radius:4px;color:var(--subtle);display:inline-flex;margin-bottom:16px;">${safeText(platform)}</div>` : ''}
        <div style="font-size:15px;line-height:1.75;color:var(--text);white-space:pre-wrap;word-break:break-word;">${safeText(postContent || '')}</div>
        ${imageUrl ? `<img src="${safeText(imageUrl)}" style="width:100%;max-height:360px;object-fit:cover;border-radius:10px;border:1px solid var(--border);margin-top:16px;" />` : ''}
      </div>
      ${comments.length ? `
        <div class="reviewer-card">
          <div style="font-size:11px;font-weight:600;font-family:'${dmMono}',monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:14px;">Previous comments</div>
          ${comments.map(c => `<div style="padding:12px;background:var(--surface2);border-radius:8px;margin-bottom:8px;"><div style="font-weight:600;font-size:13px;margin-bottom:2px;">${safeText(c.author || 'Anonymous')}</div><div style="font-size:14px;color:var(--muted);line-height:1.55;">${safeText(c.text || '')}</div></div>`).join('')}
        </div>` : ''}
      <div class="reviewer-card">
        <div style="margin-bottom:18px;">
          <label class="reviewer-form-label" for="reviewerAuthor">Your name</label>
          <input id="reviewerAuthor" class="input" placeholder="Enter your name…" style="background:var(--surface2);border-color:var(--border2);" />
        </div>
        <div style="margin-bottom:22px;">
          <label class="reviewer-form-label" for="reviewerComment">Notes (optional)</label>
          <textarea id="reviewerComment" class="input" placeholder="Leave feedback or approval notes…" style="background:var(--surface2);border-color:var(--border2);min-height:90px;"></textarea>
        </div>
        <div class="reviewer-actions">
          <button class="reviewer-btn approve" id="reviewerApproveBtn" onclick="submitReview('${safeText(uuid)}','approved')">✓ Approve</button>
          <button class="reviewer-btn changes" id="reviewerChangesBtn" onclick="submitReview('${safeText(uuid)}','changes_requested')">✎ Request Changes</button>
        </div>
        <div id="reviewerStatus" style="font-size:13px;color:var(--muted);text-align:center;margin-top:12px;min-height:20px;"></div>
      </div>`;
  } catch (e) {
    loading.style.display = 'none'; error.style.display = 'block';
    qs('reviewerErrorMsg').textContent = 'Failed to load the review. Please try again.';
  }
}

window.submitReview = async function (uuid, action) {
  const author = (qs('reviewerAuthor')?.value || '').trim() || 'Anonymous';
  const comment = (qs('reviewerComment')?.value || '').trim();
  const approveBtn = qs('reviewerApproveBtn'), changesBtn = qs('reviewerChangesBtn'), statusEl = qs('reviewerStatus');
  if (approveBtn) approveBtn.disabled = true; if (changesBtn) changesBtn.disabled = true;
  if (statusEl) statusEl.textContent = 'Submitting…';
  try {
    const res = await fetch('/.netlify/functions/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: uuid, status: action, author, comment: comment || (action === 'approved' ? 'Approved.' : 'Changes requested.') }) });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    qs('reviewerContent').style.display = 'none'; qs('reviewerConfirmed').style.display = 'block';
    const isApproved = action === 'approved';
    qs('reviewerConfirmIcon').textContent = isApproved ? '✅' : '📝';
    qs('reviewerConfirmTitle').textContent = isApproved ? 'Approved!' : 'Feedback Sent';
    safeTrack(() => GA4_Approvals.approvalReviewed(isApproved ? 'approved' : 'changes_requested'));
    qs('reviewerConfirmDesc').textContent = isApproved
      ? 'Approval recorded. The author can now publish.'
      : 'Feedback sent. The author will make revisions and share a new link if needed.';
  } catch (e) {
    if (approveBtn) approveBtn.disabled = false; if (changesBtn) changesBtn.disabled = false;
    if (statusEl) statusEl.textContent = 'Error: ' + e.message;
  }
};
