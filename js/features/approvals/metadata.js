'use strict';

// ── APPROVAL METADATA (localStorage) ──────────────
function getApprovalMeta(draftId) {
  try { const r = localStorage.getItem(APPROVAL_PREFIX + draftId); return r ? JSON.parse(r) : null; } catch { return null; }
}
function setApprovalMeta(draftId, data) { try { localStorage.setItem(APPROVAL_PREFIX + draftId, JSON.stringify(data)); } catch {} }
function clearApprovalMeta(draftId) { try { localStorage.removeItem(APPROVAL_PREFIX + draftId); } catch {} }
function getAllApprovalMetas() {
  const result = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(APPROVAL_PREFIX)) {
        const draftId = key.slice(APPROVAL_PREFIX.length);
        const meta = getApprovalMeta(draftId);
        if (meta && meta.needs_approval) result.push({ draftId, ...meta });
      }
    }
  } catch {}
  return result;
}
