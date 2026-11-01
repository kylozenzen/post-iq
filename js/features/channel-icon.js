'use strict';
// Channel identity helpers. Every place a channel is named should show which
// platform it is — "Ben Campbell" alone doesn't say LinkedIn vs Threads, and two
// channels can share a display name. Reuses the app's existing `.platform-logo`
// badge style (same as the calendar post pills) for one consistent look, and
// adds a handle suffix when two channels share a name.
window.PostIQChannelIcons = (() => {
  // Mirrors platformIdentity() in calendar.js so the marks/keys match the pills.
  const MAP = [
    { m: ['twitter', 'x', 'xcom'], key: 'x', label: 'X', mark: 'X' },
    { m: ['linkedin'], key: 'linkedin', label: 'LinkedIn', mark: 'in' },
    { m: ['instagram'], key: 'instagram', label: 'Instagram', mark: '◎' },
    { m: ['facebook', 'facebookpage', 'facebookgroup'], key: 'facebook', label: 'Facebook', mark: 'f' },
    { m: ['threads', 'threadsnet'], key: 'threads', label: 'Threads', mark: '@' },
    { m: ['tiktok'], key: 'tiktok', label: 'TikTok', mark: '♪' },
    { m: ['youtube', 'youtubeshorts'], key: 'youtube', label: 'YouTube', mark: '▶' },
    { m: ['pinterest'], key: 'pinterest', label: 'Pinterest', mark: 'P' },
    { m: ['bluesky'], key: 'bluesky', label: 'Bluesky', mark: '◇' },
    { m: ['mastodon'], key: 'mastodon', label: 'Mastodon', mark: 'M' },
    { m: ['googlebusiness', 'google'], key: 'google', label: 'Google', mark: 'G' },
  ];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  function identify(service) {
    const k = norm(service);
    return MAP.find(p => p.m.includes(k)) || { key: 'social', label: String(service || 'Channel'), mark: '•' };
  }

  // A platform badge in the shared .platform-logo style.
  function badge(service) {
    const p = identify(service);
    return `<span class="platform-logo platform-${p.key}" role="img" aria-label="${esc(p.label)}" title="${esc(p.label)}"><span aria-hidden="true">${esc(p.mark)}</span></span>`;
  }

  function resolve(channel) {
    const list = (typeof state !== 'undefined' && Array.isArray(state.channels)) ? state.channels : [];
    if (channel && typeof channel === 'object') return channel;
    return list.find(c => String(c.id) === String(channel)) || null;
  }

  function duplicateNames() {
    const list = (typeof state !== 'undefined' && Array.isArray(state.channels)) ? state.channels : [];
    const counts = {};
    list.forEach(c => { const n = (c.displayName || c.name || '').toLowerCase(); if (n) counts[n] = (counts[n] || 0) + 1; });
    return new Set(Object.keys(counts).filter(n => counts[n] > 1));
  }

  function displayName(channel) {
    const c = resolve(channel);
    if (!c) return typeof channel === 'string' ? channel : '';
    return c.displayName || c.name || String(c.id);
  }

  // icon + name, with a handle/service suffix when the name collides.
  function label(channel, { dups } = {}) {
    const c = resolve(channel);
    if (!c) return `<span class="ch-label">${esc(displayName(channel))}</span>`;
    const name = esc(c.displayName || c.name || String(c.id));
    const set = dups || duplicateNames();
    const collides = set.has((c.displayName || c.name || '').toLowerCase());
    const handle = collides
      ? ` <span class="ch-handle">${c.name && c.name !== c.displayName ? '@' + esc(c.name) : esc(identify(c.service).label)}</span>`
      : '';
    return `<span class="ch-label">${badge(c.service)}<span class="ch-name">${name}</span>${handle}</span>`;
  }

  // Plain-text platform tag for places that can't take HTML (option text, titles).
  function tag(service) { return identify(service).label; }

  return { badge, label, displayName, duplicateNames, identify, tag };
})();
