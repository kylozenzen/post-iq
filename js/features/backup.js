'use strict';
// Safety net while plans live in the browser: download a backup, restore it, or
// export plans as a calendar file. Buffer posts are not included — they live in Buffer.
window.PostIQBackup = (() => {
  const FORMAT = 'postiq-backup';
  const VERSION = 1;
  // Everything a person made in PostIQ. Tokens and caches of Buffer data are deliberately left out.
  const KEYS = [
    'postiq_calendar_notes_v2', 'postiqNoteTypes', 'postiqPlanningSettings', 'postiq_campaigns_v1',
    'postiq_library_starred_v1', 'postiq_notebook_v1', 'postiq_templates_v1', 'postiq_composer_draft_v1',
    'postiq.workspacePreferences', 'postiq.theme', 'postiq_holidays_v1', 'postiq.discord.scheduled.v1',
  ];

  function snapshot() {
    const data = {};
    KEYS.forEach(k => { const v = localStorage.getItem(k); if (v !== null) data[k] = v; });
    return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), data };
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportBackup() {
    const snap = snapshot();
    download(`postiq-backup-${fmtDate(new Date())}.json`, JSON.stringify(snap, null, 2), 'application/json');
    const notes = Object.values(JSON.parse(snap.data.postiq_calendar_notes_v2 || '{}')).flat().length;
    showToast(`Backup downloaded · ${notes} plan${notes === 1 ? '' : 's'}`, 'success');
  }

  function validate(parsed) {
    if (!parsed || parsed.format !== FORMAT || typeof parsed.data !== 'object') throw new Error('That file isn’t a PostIQ backup.');
    if (parsed.version > VERSION) throw new Error('That backup came from a newer PostIQ. Refresh and try again.');
    const entries = Object.entries(parsed.data).filter(([k, v]) => KEYS.includes(k) && typeof v === 'string');
    entries.forEach(([k, v]) => { try { JSON.parse(v); } catch { if (k !== 'postiq.theme') throw new Error('Part of that backup is damaged, so nothing was restored.'); } });
    return entries;
  }
  function restore(text) {
    const entries = validate(JSON.parse(text));
    entries.forEach(([k, v]) => localStorage.setItem(k, v));
    return entries.length;
  }
  function pickAndRestore() {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json,.json' });
    input.addEventListener('change', async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        const text = await file.text();
        validate(JSON.parse(text));
        if (!window.confirm('Restore this backup? It replaces the plans, schedule and settings saved in this browser. Your Buffer posts are not touched.')) return;
        restore(text);
        showToast('Backup restored. Reloading…', 'success');
        setTimeout(() => location.reload(), 600);
      } catch (error) {
        showToast(error instanceof SyntaxError ? 'That file isn’t a PostIQ backup.' : error.message, 'error');
      }
    });
    input.click();
  }

  // ── .ics export: plans as all-day events ────────────────
  const icsEscape = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m);
  const icsDate = key => key.replace(/-/g, '');
  const nextDay = key => { const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + 1); return fmtDate(d); };
  // Lines over 75 octets are folded per RFC 5545.
  const fold = line => line.length <= 74 ? line : line.match(/.{1,73}/g).join('\r\n ');
  function buildIcs(notes, campaigns = [], now = new Date()) {
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nobody Creative//PostIQ//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:PostIQ plans'];
    Object.entries(notes).forEach(([key, list]) => (list || []).forEach(note => {
      const todo = ['action', 'task'].includes(note.typeId);
      lines.push('BEGIN:VEVENT', `UID:${note.id}@postiq`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDate(key)}`, `DTEND;VALUE=DATE:${icsDate(nextDay(key))}`,
        fold(`SUMMARY:${icsEscape((todo ? (note.completedAt ? '✓ ' : '☐ ') : '') + note.text)}`), `CATEGORIES:${icsEscape(note.label || note.typeId || 'Note')}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
    }));
    campaigns.forEach(c => {
      if (!c?.start || !c?.end) return;
      lines.push('BEGIN:VEVENT', `UID:${c.id || c.start}@postiq-campaign`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDate(c.start)}`, `DTEND;VALUE=DATE:${icsDate(nextDay(c.end))}`,
        fold(`SUMMARY:${icsEscape(c.name || c.title || 'Campaign')}`), 'CATEGORIES:Campaign', 'TRANSP:TRANSPARENT', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }
  function exportIcs() {
    const notes = getNotes();
    let campaigns = [];
    try { campaigns = JSON.parse(localStorage.getItem('postiq_campaigns_v1') || '[]'); } catch {}
    const count = Object.values(notes).flat().length + campaigns.length;
    if (!count) { showToast('No plans to export yet — add a note or campaign first.', 'error'); return; }
    download('postiq-plans.ics', buildIcs(notes, campaigns), 'text/calendar');
    showToast(`Exported ${count} plan${count === 1 ? '' : 's'} — open the file to add them to your calendar app`, 'success');
  }

  function init() {
    document.getElementById('backupDownloadBtn')?.addEventListener('click', exportBackup);
    document.getElementById('backupRestoreBtn')?.addEventListener('click', pickAndRestore);
    document.getElementById('icsExportBtn')?.addEventListener('click', exportIcs);
  }
  return { init, snapshot, restore, validate, buildIcs, exportBackup, exportIcs, KEYS };
})();

document.addEventListener('DOMContentLoaded', () => { try { window.PostIQBackup.init(); } catch (e) { console.warn('[PostIQ backup]', e); } });
