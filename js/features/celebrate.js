// celebrate.js — small, satisfying moments for the things that matter:
// filling a gap, covering a break, finishing a newsletter or campaign.
// Routine clicks don't get these. Everything is skipped under reduced motion.
window.PostIQCelebrate = (() => {
  const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Restart a one-shot CSS animation class on an element.
  function pulse(el, cls, ms = 900) {
    if (!el || calm()) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }

  // A little burst of paper dots from the middle of an element.
  function burst(el, { count = 12, colors } = {}) {
    if (!el || calm()) return;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const css = getComputedStyle(document.documentElement);
    const palette = colors || [css.getPropertyValue('--brand').trim() || '#b52c20', '#e0a526', '#2f6b45', '#5b5bd6', css.getPropertyValue('--ink').trim() || '#171713'];
    const layer = document.createElement('div');
    layer.className = 'celebrate-layer';
    layer.style.left = `${r.left + r.width / 2}px`;
    layer.style.top = `${r.top + r.height / 2}px`;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('i');
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 28 + Math.random() * 34;
      dot.style.setProperty('--x', `${Math.cos(angle) * dist}px`);
      dot.style.setProperty('--y', `${Math.sin(angle) * dist - 10}px`);
      dot.style.setProperty('--r', `${Math.round(Math.random() * 300 - 150)}deg`);
      dot.style.background = palette[i % palette.length];
      if (i % 3 === 0) dot.classList.add('is-bar');
      layer.append(dot);
    }
    document.body.append(layer);
    setTimeout(() => layer.remove(), 900);
  }

  // A filled gap: the new Buffer post settles onto its day with a stamp.
  function filled(dateKey, postId) {
    if (calm()) return;
    requestAnimationFrame(() => {
      const sel = postId ? `[data-calendar-date="${dateKey}"] [data-post-id="${CSS.escape(String(postId))}"]` : null;
      const pill = sel && document.querySelector(sel);
      pulse(pill, 'just-filled', 900);
      pulse(document.querySelector(`[data-calendar-date="${dateKey}"]`), 'just-added', 1400);
    });
  }

  return { pulse, burst, filled, calm };
})();
