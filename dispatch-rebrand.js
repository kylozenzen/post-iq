/* ═══════════════════════════════════════════════════
   dispatch-rebrand.js
   Add to app.html just before closing </body>:
   <script src="./dispatch-rebrand.js"></script>

   Handles all text-node swaps so app.html and app.js
   stay completely untouched.
═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── 1. PAGE TITLE ──────────────────────────────
  document.title = document.title.replace(/PostIQ/g, 'Dispatch');

  // ── 2. THEME COLOR ─────────────────────────────
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = '#07080A';

  // ── 3. LOGO / WORDMARK ─────────────────────────
  // Sidebar logo-mark
  document.querySelectorAll('.logo-mark').forEach(el => {
    el.innerHTML = 'DISPATCH';
  });

  // Any .brand link (index.html usage)
  document.querySelectorAll('.brand').forEach(el => {
    el.innerHTML = 'DISPATCH';
  });

  // Topbar / mobile drawer brand text (may contain beta span)
  document.querySelectorAll('.mob-drawer-title').forEach(el => {
    el.innerHTML = 'DISPATCH';
  });

  // ── 4. APP SHELL TEXT ──────────────────────────
  // Nav labels: keep existing labels, just remove "PostIQ" references
  // in helper text and descriptions
  const SWAP = [
    ['PostIQ is the first companion app built on it', 'Dispatch is the first companion app built on it'],
    ['PostIQ connects to your Buffer account',        'Dispatch connects to your Buffer account'],
    ['PostIQ works best when connected to Buffer',    'Dispatch works best when connected to Buffer'],
    ['PostIQ is a free public beta',                  'Dispatch is in early access'],
    ['PostIQ is in public beta',                      'Dispatch is in early access'],
    ['PostIQ public beta',                            'Dispatch early access'],
    ['Public beta',                                   'Early access'],
    ['Sign in to PostIQ',                             'Sign in to Dispatch'],
    ['Open PostIQ',                                   'Open Dispatch'],
    ['PostIQ notice',                                 'Dispatch notice'],
    ['PostIQ hit a snag',                             'Dispatch hit a snag'],
    ['PostIQ settings',                               'Dispatch settings'],
  ];

  function swapTextNodes(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      let v = node.nodeValue;
      SWAP.forEach(([from, to]) => { v = v.replace(new RegExp(from, 'g'), to); });
      if (v !== node.nodeValue) node.nodeValue = v;
    } else {
      node.childNodes.forEach(swapTextNodes);
    }
  }

  // Run on common text areas only (not scripts/styles)
  ['body'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) swapTextNodes(el);
  });

  // ── 5. SETTINGS MODAL — "About" panel ──────────
  // Patch the about copy to say Dispatch
  const aboutPanel = document.getElementById('settingsPanelAbout');
  if (aboutPanel) {
    aboutPanel.querySelectorAll('p').forEach(p => {
      p.innerHTML = p.innerHTML.replace(/PostIQ/g, 'Dispatch');
    });
  }

  // ── 6. STATUS / GLOBAL BANNER TITLE ────────────
  const gTitle = document.getElementById('globalStatusTitle');
  if (gTitle && gTitle.textContent === 'PostIQ notice') {
    gTitle.textContent = 'Dispatch notice';
  }

  // ── 7. APPLE / MANIFEST META ────────────────────
  const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleMeta) appleMeta.content = 'Dispatch';

  // ── 8. SIGNAL MARK SVG in sidebar logo ─────────
  // Prepend the Dispatch signal icon before the wordmark
  document.querySelectorAll('.logo-mark').forEach(el => {
    if (el.querySelector('svg')) return; // already done
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('viewBox', '0 0 32 32');
    svg.setAttribute('fill', 'none');
    svg.style.flexShrink = '0';
    svg.innerHTML = `
      <path d="M0 6L0 0L6 0" stroke="#E9A320" stroke-width="1.5" fill="none"/>
      <path d="M26 0L32 0L32 6" stroke="#E9A320" stroke-width="1.5" fill="none"/>
      <path d="M0 26L0 32L6 32" stroke="#E9A320" stroke-width="1.5" fill="none"/>
      <path d="M26 32L32 32L32 26" stroke="#E9A320" stroke-width="1.5" fill="none"/>
      <path d="M9 20 Q16 11 23 20" stroke="#E9A320" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".45"/>
      <circle cx="16" cy="22" r="2.2" fill="#E9A320"/>
      <line x1="16" y1="22" x2="16" y2="13" stroke="#E9A320" stroke-width="1.3"/>
    `;
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.gap = '8px';
    const text = document.createTextNode('DISPATCH');
    el.innerHTML = '';
    el.appendChild(svg);
    el.appendChild(text);
  });

  console.info('[Dispatch] Rebrand layer applied.');
})();
