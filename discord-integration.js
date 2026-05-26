(function () {
  const STORAGE_KEY = 'postiq_discord_webhooks';

  function qs(id) { return document.getElementById(id); }
  function safeParse(v, fallback) { try { return JSON.parse(v); } catch { return fallback; } }
  function getWebhooks() { return safeParse(localStorage.getItem(STORAGE_KEY), []); }
  function setWebhooks(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
  function validWebhook(url) {
    return /^https:\/\/discord\.com\/api\/webhooks\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+/.test(String(url || ''));
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

  function renderSettings() {
    const panel = qs('settingsPanelDiscord');
    if (!panel) return;
    const hooks = getWebhooks();
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

    const list = qs('discordWebhookList');
    list.innerHTML = hooks.length ? hooks.map((h, i) => `<div class="row" style="justify-content:space-between;border:1px solid var(--border2);padding:8px;border-radius:8px;margin-bottom:8px;"><span style="font-size:12px;">${h.name || 'Webhook ' + (i + 1)}</span><button class="btn sm ghost" data-drm="${i}">Delete</button></div>`).join('') : '<div style="font-size:12px;color:var(--subtle);">No webhooks saved.</div>';

    qs('discordAddWebhookBtn')?.addEventListener('click', () => {
      const name = (qs('discordWorkspaceName')?.value || '').trim();
      const url = (qs('discordWebhookUrl')?.value || '').trim();
      const status = qs('discordHookStatus');
      if (!name || !url) { if (status) status.textContent = 'Enter label + webhook URL.'; return; }
      if (!validWebhook(url)) { if (status) status.textContent = 'Invalid Discord webhook URL.'; return; }
      const next = [...hooks, { name, url }];
      setWebhooks(next);
      if (status) status.textContent = 'Webhook saved locally.';
      renderSettings();
      renderSendRow();
    });

    panel.querySelectorAll('[data-drm]').forEach(btn => btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-drm'));
      const next = getWebhooks().filter((_, i) => i !== idx);
      setWebhooks(next);
      renderSettings();
      renderSendRow();
    }));
  }

  function renderSendRow() {
    const row = qs('discordSendRow');
    if (!row) return;
    const hooks = getWebhooks();
    row.innerHTML = `<div class="panel-card" style="margin-top:12px;"><div class="panel-card-title">Discord</div><label class="approval-check-row"><input type="checkbox" id="discordSendToggle" ${hooks.length ? '' : 'disabled'} /><span class="approval-check-label">Also send successful Buffer actions to Discord</span></label><div style="font-size:11px;color:var(--subtle);margin-top:8px;">${hooks.length ? `${hooks.length} webhook workspace(s) saved.` : 'Add a webhook in Settings → Discord.'}</div></div>`;
  }

  async function onComposerSent(text, action, meta) {
    try {
      if (!qs('discordSendToggle')?.checked) return;
      const hooks = getWebhooks();
      if (!hooks.length) return;
      const content = `**PostIQ ${action}**\n${text}\n\nPlatform: ${meta.platform || 'Unknown'}\nChannel: ${meta.channelName || 'Unknown'}${meta.dueAt ? `\nDue: ${meta.dueAt}` : ''}`;
      for (const hook of hooks) {
        await proxySend({ webhookUrl: hook.url, content, workspace: hook.name });
      }
    } catch (e) {
      console.error('[PostIQ] Discord.onComposerSent failed:', e);
    }
  }

  function init() {
    renderSendRow();
    qs('discordAnnounceBtn')?.addEventListener('click', async () => {
      try {
        const text = (qs('composerEditor')?.innerText || '').trim();
        if (!text) return;
        await onComposerSent(text, 'announcement', { platform: '', channelName: '', dueAt: '' });
      } catch (e) {
        console.error('[PostIQ] Discord announcement failed:', e);
      }
    });
  }

  window.Discord = { init, renderSettings, renderSendRow, onComposerSent };
})();
