'use strict';
// Channel identity helpers. Every place a channel is named should show which
// platform it is — "Ben Campbell" alone doesn't say LinkedIn vs Threads, and two
// channels can share a display name. A small branded letter-chip solves it
// reliably across every platform (and both themes) without shipping a dozen
// brand SVGs; same-name channels also get a handle suffix.
window.PostIQChannelIcons = (() => {
  // label = short mark, bg = brand color. Kept intentionally small/maintainable.
  const MAP = {
    twitter:        { l: 'X',  bg: '#000000' },
    x:              { l: 'X',  bg: '#000000' },
    linkedin:       { l: 'in', bg: '#0A66C2' },
    facebook:       { l: 'f',  bg: '#1877F2' },
    facebookpage:   { l: 'f',  bg: '#1877F2' },
    facebookgroup:  { l: 'f',  bg: '#1877F2' },
    instagram:      { l: 'IG', bg: '#E4405F' },
    threads:        { l: '@',  bg: '#000000' },
    bluesky:        { l: 'bs', bg: '#1185FE' },
    mastodon:       { l: 'm',  bg: '#6364FF' },
    tiktok:         { l: 'TT', bg: '#111111' },
    youtube:        { l: 'YT', bg: '#FF0000' },
    pinterest:      { l: 'P',  bg: '#E60023' },
    googlebusiness: { l: 'G',  bg: '#4285F4' },
    google:         { l: 'G',  bg: '#4285F4' },
  };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

  function meta(service) { return MAP[norm(service)] || null; }

  // A small platform chip. title shows the service name on hover.
  function badge(service) {
    const m = meta(service);
    const label = m ? m.l : (norm(service).charAt(0).toUpperCase() || '•');
    const bg = m ? m.bg : 'var(--muted)';
    return `<span class="ch-badge" style="background:${bg}" title="${esc(service || 'channel')}" aria-hidden="true">${esc(label)}</span>`;
  }

  function resolve(channel) {
    const list = (typeof state !== 'undefined' && Array.isArray(state.channels)) ? state.channels : [];
    if (channel && typeof channel === 'object') return channel;
    return list.find(c => String(c.id) === String(channel)) || null;
  }

  // Display names that appear on more than one channel — those need a handle.
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

  // icon + name, with @handle appended when the name collides with another channel.
  function label(channel, { dups } = {}) {
    const c = resolve(channel);
    if (!c) { const t = esc(displayName(channel)); return `<span class="ch-label">${t}</span>`; }
    const name = esc(c.displayName || c.name || String(c.id));
    const set = dups || duplicateNames();
    const collides = set.has((c.displayName || c.name || '').toLowerCase());
    const handle = collides && c.name && c.name !== c.displayName ? ` <span class="ch-handle">@${esc(c.name)}</span>` : (collides ? ` <span class="ch-handle">${esc(c.service || '')}</span>` : '');
    return `<span class="ch-label">${badge(c.service)}<span class="ch-name">${name}</span>${handle}</span>`;
  }

  return { badge, label, displayName, duplicateNames, meta };
})();
