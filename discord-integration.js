(function () {
  const DISCORD_KEY = 'postiq_discord_webhooks';
  const DEFAULT_CONFIG = {
    workspaces: [],
    activeWorkspaceId: null,
    sendOnQueue: true,
    sendOnPublish: true,
    announcementsEnabled: true,
  };

  let config = { ...DEFAULT_CONFIG, workspaces: [] };

  function dqs(id) { return document.getElementById(id); }
  function isValidWebhookUrl(url) {
    return /^https:\/\/discord\.com\/api\/webhooks\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+/.test(String(url || ''));
  }

  function save() {
    localStorage.setItem(DISCORD_KEY, JSON.stringify(config));
  }

  function load() {
    try {
      const raw = localStorage.getItem(DISCORD_KEY);
      if (!raw) {
        config = { ...DEFAULT_CONFIG, workspaces: [] };
        return;
      }

      const parsed = JSON.parse(raw);

      config = {
        ...DEFAULT_CONFIG,
        ...parsed,
        workspaces: Array.isArray(parsed?.workspaces) ? parsed.workspaces : [],
        activeWorkspaceId: parsed?.activeWorkspaceId || null,
        sendOnQueue: !!parsed?.sendOnQueue,
        sendOnPublish: !!parsed?.sendOnPublish,
        announcementsEnabled: parsed?.announcementsEnabled !== false,
      };
    } catch (err) {
      console.warn('[PostIQ Discord] Failed to load config. Resetting Discord config.', err);
      config = { ...DEFAULT_CONFIG, workspaces: [] };
    }
  }

  function getActiveWorkspace() {
    const ws = Array.isArray(config.workspaces) ? config.workspaces : [];
    if (!ws.length) return null;
    return ws.find(w => w.id === config.activeWorkspaceId) || ws[0];
  }

  async function proxySend(payload) {
    const res = await fetch('/.netlify/functions/discord-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Discord send failed');
    return data;
  }

  function renderDiscordSettings() {
    const panel = dqs('settingsPanelDiscord');
    if (!panel) return;
    const ws = Array.isArray(config.workspaces) ? config.workspaces : [];
    const active = getActiveWorkspace();

    panel.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-title">Discord webhooks</div>
        <p class="settings-copy">Saved locally in your browser only.</p>
        <div class="field">
          <label class="label" for="discordWorkspaceName">Workspace label</label>
          <input id="discordWorkspaceName" class="input" placeholder="Team / workspace" />
        </div>
        <div class="field">
          <label class="label" for="discordWebhookUrl">Webhook URL</label>
          <input id="discordWebhookUrl" class="input mono" placeholder="https://discord.com/api/webhooks/..." />
        </div>
        <div class="row">
          <button class="btn sm primary" id="discordAddWebhookBtn" type="button">Save webhook</button>
        </div>
        <div id="discordHookStatus" style="font-size:12px;color:var(--muted);margin-top:8px;font-family:'DM Mono',monospace;min-height:16px;"></div>
        <div id="discordWebhookList" class="mt12"></div>
      </div>`;

    const list = dqs('discordWebhookList');
    list.innerHTML = ws.length
      ? ws.map((w, i) => `<div class="row" style="justify-content:space-between;border:1px solid var(--border2);padding:8px;border-radius:8px;margin-bottom:8px;"><span style="font-size:12px;">${w.name || 'Webhook ' + (i + 1)}${active?.id === w.id ? ' (active)' : ''}</span><div style="display:flex;gap:6px;"><button class="btn sm ghost" data-dset="${w.id}">Use</button><button class="btn sm ghost" data-ddel="${w.id}">Delete</button></div></div>`).join('')
      : '<div style="font-size:12px;color:var(--subtle);">No webhooks saved.</div>';

    dqs('discordAddWebhookBtn')?.addEventListener('click', () => {
      const name = (dqs('discordWorkspaceName')?.value || '').trim();
      const webhookUrl = (dqs('discordWebhookUrl')?.value || '').trim();
      const status = dqs('discordHookStatus');
      if (!name || !webhookUrl) { if (status) status.textContent = 'Enter label + webhook URL.'; return; }
      if (!isValidWebhookUrl(webhookUrl)) { if (status) status.textContent = 'Invalid Discord webhook URL.'; return; }

      const id = `ws_${Date.now().toString(36)}`;
      const nextWorkspaces = [...ws, { id, name, webhookUrl }];
      config = { ...config, workspaces: nextWorkspaces, activeWorkspaceId: config.activeWorkspaceId || id };
      save();
      if (status) status.textContent = 'Webhook saved locally.';
      renderDiscordSettings();
      renderComposerToggle();
    });

    panel.querySelectorAll('[data-ddel]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-ddel');
      const nextWorkspaces = ws.filter(w => w.id !== id);
      const nextActive = config.activeWorkspaceId === id ? (nextWorkspaces[0]?.id || null) : config.activeWorkspaceId;
      config = { ...config, workspaces: nextWorkspaces, activeWorkspaceId: nextActive };
      save();
      renderDiscordSettings();
      renderComposerToggle();
    }));

    panel.querySelectorAll('[data-dset]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-dset');
      config = { ...config, activeWorkspaceId: id };
      save();
      renderDiscordSettings();
      renderComposerToggle();
    }));
  }

  function renderComposerToggle() {
    const row = dqs('discordSendRow');
    if (!row) return;
    const ws = Array.isArray(config.workspaces) ? config.workspaces : [];
    const configured = ws.some(w => isValidWebhookUrl(w?.webhookUrl));
    row.innerHTML = configured
      ? `<div class="panel-card" style="margin-top:12px;"><div class="panel-card-title">Discord</div><label class="approval-check-row"><input type="checkbox" id="discordSendToggle" /><span class="approval-check-label">Also send successful Buffer actions to Discord</span></label><div style="font-size:11px;color:var(--subtle);margin-top:8px;">${ws.length} webhook workspace(s) saved.</div></div>`
      : '';
  }

  function getComposerDiscordState() {
    return { enabled: !!dqs('discordSendToggle')?.checked, configured: !!getActiveWorkspace() };
  }

  async function sendPostNotification(content) {
    const ws = Array.isArray(config.workspaces) ? config.workspaces : [];
    const validWorkspaces = ws.filter(w => isValidWebhookUrl(w?.webhookUrl));
    for (const workspace of validWorkspaces) {
      await proxySend({ webhookUrl: workspace.webhookUrl, content, workspace: workspace.name });
    }
  }

  async function onComposerSent(text, action, meta) {
    try {
      if (!dqs('discordSendToggle')?.checked) return;
      if (!getActiveWorkspace()) return;
      const content = `**PostIQ ${action}**\n${text}\n\nPlatform: ${meta.platform || 'Unknown'}\nChannel: ${meta.channelName || 'Unknown'}${meta.dueAt ? `\nDue: ${meta.dueAt}` : ''}`;
      await sendPostNotification(content);
    } catch (e) {
      console.error('[PostIQ] Discord.onComposerSent failed:', e);
    }
  }

  async function openAnnouncementModal() {
    const text = (dqs('composerEditor')?.innerText || '').trim();
    if (!text) return;
    await onComposerSent(text, 'announcement', { platform: '', channelName: '', dueAt: '' });
  }

  function init() {
    load();
    renderComposerToggle();

    const announceBtn = dqs('discordAnnounceBtn');
    if (announceBtn) announceBtn.onclick = openAnnouncementModal;

    window.addEventListener('postiq:synced', renderComposerToggle);
  }

  window.Discord = {
    init,
    renderSettings: renderDiscordSettings,
    renderComposerToggle,
    getComposerDiscordState,
    onComposerSent,
    openAnnouncementModal,
    sendPostNotification,
    isConfigured: () => {
      const ws = getActiveWorkspace();
      return !!(ws && isValidWebhookUrl(ws.webhookUrl));
    },
  };
})();
