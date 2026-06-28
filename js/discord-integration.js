(function () {
  const DISCORD_KEY = 'postiq_discord_webhooks';
  const DISCORD_SCHEDULE_KEY = 'postiq.discord.scheduled.v1';
  const DEFAULT_CONFIG = {
    workspaces: [],
    activeWorkspaceId: null,
    announcementsEnabled: true,
    announceBufferActions: false,
    sendOnQueue: true,
    sendOnPublish: true,
  };

  let config = { ...DEFAULT_CONFIG, workspaces: [] };
  let scheduleTimer = null;

  const dqs = (id) => document.getElementById(id);
  const isValidWebhookUrl = (url) => /^https:\/\/discord\.com\/api\/webhooks\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+/.test(String(url || ''));
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const track = (callback) => { try { if (typeof callback === 'function') callback(); } catch (error) { console.warn('GA4 tracking skipped:', error); } };
  const errorType = (error) => window.GA4?.getErrorType?.(error) || 'unknown';
  const status = (msg) => { const el = dqs('discordComposerStatus'); if (el) el.textContent = msg || ''; };
  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const safeAttr = escapeHtml;
  const openDiscordSettings = () => {
    if (typeof window.selectSettingsTab === 'function') window.selectSettingsTab('discord');
    if (typeof window.openModal === 'function') window.openModal('settingsModal');
    const panel = dqs('settingsPanelDiscord');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    dqs('discordWebhookUrl')?.focus();
  };

  function save() { localStorage.setItem(DISCORD_KEY, JSON.stringify(config)); }
  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DISCORD_KEY) || '{}');
      config = { ...DEFAULT_CONFIG, ...parsed, workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [] };
    } catch { config = { ...DEFAULT_CONFIG, workspaces: [] }; }
  }
  function getSchedules() {
    try { const v = JSON.parse(localStorage.getItem(DISCORD_SCHEDULE_KEY) || '[]'); return Array.isArray(v) ? v : []; }
    catch { return []; }
  }
  function saveSchedules(items) { localStorage.setItem(DISCORD_SCHEDULE_KEY, JSON.stringify(items)); }
  function getWorkspaceById(id) { return (config.workspaces || []).find(w => w.id === id) || null; }
  function getActiveWorkspace() { return getWorkspaceById(config.activeWorkspaceId) || (config.workspaces || [])[0] || null; }

  async function proxySend(payload) {
    const res = await fetch('/.netlify/functions/discord-webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Discord send failed');
    return data;
  }

  function renderDiscordSettings() {
    const panel = dqs('settingsPanelDiscord'); if (!panel) return;
    const ws = Array.isArray(config.workspaces) ? config.workspaces : [];
    const active = getActiveWorkspace();
    panel.innerHTML = `<div class="settings-section"><div class="settings-section-title">Discord destinations</div><p class="settings-copy">Saved locally in your browser only.</p>
      <div style="border:1px solid var(--border2);border-radius:10px;background:var(--surface);padding:10px 12px;margin:10px 0 14px;">
        <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px;">How to connect Discord</div>
        <ol style="margin:0;padding-left:18px;font-size:12px;color:var(--muted);line-height:1.55;">
          <li>In Discord, open your server.</li>
          <li>Go to Server Settings → Integrations → Webhooks.</li>
          <li>Click New Webhook.</li>
          <li>Choose the Discord channel you want PostIQ to post in.</li>
          <li>Copy the webhook URL.</li>
          <li>Come back to PostIQ and paste it below as a Discord destination.</li>
        </ol>
        <p style="margin:8px 0 0;font-size:11px;color:var(--subtle);">Tip: Create a private #postiq-test channel first so you can test without posting to your whole server.</p>
        <p style="margin:8px 0 0;font-size:11px;color:var(--amber);">Treat your Discord webhook URL like a password. Anyone with the URL may be able to post into that Discord channel.</p>
      </div>
      <div class="field"><label class="label" for="discordWorkspaceName">Destination name</label><input id="discordWorkspaceName" class="input" placeholder="Product updates" /></div>
      <div class="field"><label class="label" for="discordWebhookUrl">Webhook URL</label><input id="discordWebhookUrl" class="input mono" placeholder="https://discord.com/api/webhooks/..." /></div>
      <div class="row"><button class="btn sm primary" id="discordAddWebhookBtn" type="button">Save destination</button></div>
      <div id="discordHookStatus" style="font-size:12px;color:var(--muted);margin-top:8px;font-family:'DM Mono',monospace;min-height:16px;"></div>
      <div id="discordWebhookList" class="mt12"></div></div>`;
    dqs('discordWebhookList').innerHTML = ws.length ? ws.map((w) => `<div class="row" style="justify-content:space-between;border:1px solid var(--border2);padding:8px;border-radius:8px;margin-bottom:8px;"><span style="font-size:12px;">${escapeHtml(w.name)}${active?.id===w.id?' (default)':''}</span><div style="display:flex;gap:6px;"><button class="btn sm ghost" data-dset="${safeAttr(w.id)}">Set default</button><button class="btn sm ghost" data-ddel="${safeAttr(w.id)}">Delete</button></div></div>`).join('') : '<div style="font-size:12px;color:var(--subtle);">No Discord destinations saved.</div>';
    dqs('discordAddWebhookBtn')?.addEventListener('click', () => {
      const name = (dqs('discordWorkspaceName')?.value || '').trim(); const webhookUrl = (dqs('discordWebhookUrl')?.value || '').trim(); const st = dqs('discordHookStatus');
      if (!name || !webhookUrl) return st && (st.textContent = 'Enter destination name + webhook URL.');
      if (!isValidWebhookUrl(webhookUrl)) return st && (st.textContent = 'Invalid Discord webhook URL.');
      const entry = { id: uid('ws'), name, webhookUrl, createdAt: new Date().toISOString() };
      config.workspaces = [...ws, entry]; if (!config.activeWorkspaceId) config.activeWorkspaceId = entry.id; save(); renderDiscordSettings(); renderDiscordDestinationSelect();
    });
    panel.querySelectorAll('[data-ddel]').forEach((btn) => btn.addEventListener('click', () => { const id = btn.getAttribute('data-ddel'); config.workspaces = ws.filter(w => w.id !== id); if (config.activeWorkspaceId === id) config.activeWorkspaceId = config.workspaces[0]?.id || null; save(); renderDiscordSettings(); renderDiscordDestinationSelect(); }));
    panel.querySelectorAll('[data-dset]').forEach((btn) => btn.addEventListener('click', () => { config.activeWorkspaceId = btn.getAttribute('data-dset'); save(); renderDiscordSettings(); renderDiscordDestinationSelect(); }));
  }

  function renderDiscordDestinationSelect() {
    const select = dqs('discordComposerDestination'); if (!select) return;
    const ws = Array.isArray(config.workspaces) ? config.workspaces : [];
    select.innerHTML = '';
    if (!ws.length) {
      select.innerHTML = '<option value="" disabled selected>No Discord destination connected</option>';
      status('No Discord destination connected yet. Get started by adding a Discord webhook in Settings.');
      const start = dqs('discordComposerGetStarted');
      if (start) start.style.display = 'inline-flex';
      return;
    }
    const activeId = ws.some(w => w.id === config.activeWorkspaceId) ? config.activeWorkspaceId : ws[0].id;
    if (activeId !== config.activeWorkspaceId) { config.activeWorkspaceId = activeId; save(); }
    select.innerHTML = ws.map(w => `<option value="${safeAttr(w.id)}">${escapeHtml(w.name)}</option>`).join('');
    select.value = activeId;
    const start = dqs('discordComposerGetStarted');
    if (start) start.style.display = 'none';
    select.onchange = () => { config.activeWorkspaceId = select.value; save(); status(''); };
  }

  function initDiscordComposerMode() {
    const now = dqs('discordSendNowMode'); const later = dqs('discordScheduleMode');
    const sendBtn = dqs('discordComposerSendBtn'); const schedBtn = dqs('discordComposerScheduleBtn'); const controls = dqs('discordScheduleControls');
    const apply = () => { const scheduleMode = !!later?.checked; if (controls) controls.style.display = scheduleMode ? 'block' : 'none'; if (sendBtn) sendBtn.style.display = scheduleMode ? 'none' : 'inline-flex'; if (schedBtn) schedBtn.style.display = scheduleMode ? 'inline-flex' : 'none'; };
    if (now) now.checked = true;
    now?.addEventListener('change', apply); later?.addEventListener('change', apply); apply();
  }

  async function sendDiscordComposerMessage() {
    const destinationId = dqs('discordComposerDestination')?.value;
    const ws = getWorkspaceById(destinationId);
    const message = (dqs('discordComposerText')?.value || '').trim();
    if (!ws || !isValidWebhookUrl(ws.webhookUrl)) return status('Select a valid Discord destination.');
    if (!message) return status('Write a Discord announcement first.');
    status('Posting to Discord...');
    try {
      await proxySend({ webhookUrl: ws.webhookUrl, content: message, workspace: ws.name });
      status('Posted to Discord.');
      if (dqs('discordComposerText')) dqs('discordComposerText').value = '';
      renderScheduledDiscordList();
      track(() => window.GA4_Discord.discordAnnouncementSent('now'));
      setTimeout(() => status(''), 2200);
    } catch (e) { track(() => window.GA4_Discord.discordSendFailed(errorType(e))); track(() => window.GA4_System.applicationError(e, 'discord')); status(`Failed to post: ${e.message || 'Unknown error'}`); }
  }

  function scheduleDiscordAnnouncement() {
    const destinationId = dqs('discordComposerDestination')?.value;
    const ws = getWorkspaceById(destinationId);
    const message = (dqs('discordComposerText')?.value || '').trim();
    const date = dqs('discordScheduleDate')?.value; const time = dqs('discordScheduleTime')?.value;
    if (!ws || !isValidWebhookUrl(ws.webhookUrl)) return status('Select a valid Discord destination.');
    if (!message) return status('Write a Discord announcement first.');
    if (!date || !time) return status('Choose date and time.');
    const scheduledAt = new Date(`${date}T${time}`);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) return status('Choose a future time.');
    const items = getSchedules();
    items.push({ id: uid('sched'), destinationId: ws.id, destinationName: ws.name, webhookUrl: ws.webhookUrl, message, scheduledAt: scheduledAt.toISOString(), createdAt: new Date().toISOString(), status: 'scheduled' });
    saveSchedules(items);
    status('Discord announcement scheduled.');
    dqs('discordComposerText').value = ''; dqs('discordScheduleDate').value = ''; dqs('discordScheduleTime').value = '';
    renderScheduledDiscordList();
    track(() => window.GA4_Discord.discordAnnouncementScheduled({ minutesAhead: Math.max(0, Math.round((scheduledAt.getTime() - Date.now()) / 60000)) }));
  }

  function renderScheduledDiscordList() {
    const el = dqs('discordScheduledList'); if (!el) return;
    const pending = getSchedules().filter(i => i.status === 'scheduled').sort((a,b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    if (!pending.length) { el.innerHTML = '<div class="discord-scheduled-empty">No scheduled Discord announcements.</div>'; return; }
    el.innerHTML = pending.map(i => `<div class="discord-scheduled-item" data-sid="${safeAttr(i.id)}"><div class="discord-scheduled-meta"><strong>${escapeHtml(i.destinationName)}</strong> · ${escapeHtml(new Date(i.scheduledAt).toLocaleString())}</div><div class="discord-scheduled-msg">${escapeHtml(i.message.slice(0, 180))}</div><div class="row"><button class="btn sm" data-send-now="${safeAttr(i.id)}" type="button">Send now</button><button class="btn sm ghost" data-cancel="${safeAttr(i.id)}" type="button">Cancel</button></div></div>`).join('');
    el.querySelectorAll('[data-send-now]').forEach(btn => btn.addEventListener('click', async () => { const id = btn.getAttribute('data-send-now'); await sendScheduledNow(id); }));
    el.querySelectorAll('[data-cancel]').forEach(btn => btn.addEventListener('click', () => { const id = btn.getAttribute('data-cancel'); saveSchedules(getSchedules().filter(i => i.id !== id)); renderScheduledDiscordList(); status('Scheduled announcement canceled.'); }));
  }

  async function sendScheduledNow(id) {
    const items = getSchedules(); const item = items.find(i => i.id === id); if (!item) return;
    try { await proxySend({ webhookUrl: item.webhookUrl, content: item.message, workspace: item.destinationName }); item.status = 'sent'; status('Scheduled announcement sent.'); }
    catch (e) { item.status = 'failed'; status(`Failed scheduled send: ${e.message || 'Unknown error'}`); }
    saveSchedules(items); renderScheduledDiscordList();
  }

  async function checkScheduledDiscordAnnouncements() {
    const items = getSchedules();
    const due = items.filter(i => i.status === 'scheduled' && new Date(i.scheduledAt) <= new Date());
    if (!due.length) return;
    let sentCount = 0;
    for (const item of due) {
      try { await proxySend({ webhookUrl: item.webhookUrl, content: item.message, workspace: item.destinationName }); item.status = 'sent'; sentCount += 1; }
      catch { item.status = 'failed'; }
    }
    saveSchedules(items); renderScheduledDiscordList();
    if (sentCount > 0) status(`${sentCount} scheduled Discord announcement(s) sent.`);
  }

  function startScheduleChecker() { if (scheduleTimer) return; scheduleTimer = setInterval(checkScheduledDiscordAnnouncements, 60000); checkScheduledDiscordAnnouncements(); }

  function renderComposerToggle() {
    const row = dqs('discordSendRow');
    if (!row) return;
    row.innerHTML = '';
  }

  async function onComposerSent() {
    return;
  }

  function renderComposer() { renderDiscordDestinationSelect(); renderScheduledDiscordList(); initDiscordComposerMode(); }

  function init() {
    load();
    renderComposer();
    renderComposerToggle();
    startScheduleChecker();
    dqs('discordComposerSendBtn')?.addEventListener('click', sendDiscordComposerMessage);
    dqs('discordComposerScheduleBtn')?.addEventListener('click', scheduleDiscordAnnouncement);
    dqs('discordComposerClearBtn')?.addEventListener('click', () => { if (dqs('discordComposerText')) dqs('discordComposerText').value = ''; status(''); });
    dqs('discordComposerGetStarted')?.addEventListener('click', (e) => { e.preventDefault(); openDiscordSettings(); });
  }

  window.Discord = { init, renderSettings: renderDiscordSettings, renderComposer, renderDestinationSelect: renderDiscordDestinationSelect, renderScheduledList: renderScheduledDiscordList, checkScheduledAnnouncements: checkScheduledDiscordAnnouncements, initDiscordComposerMode, onComposerSent, renderComposerToggle };
})();
