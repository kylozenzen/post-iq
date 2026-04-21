<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PostIQ — Buffer Companion</title>
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#1a1a2e" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="PostIQ" />
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
  <meta name="description" content="PostIQ is the planning and approval layer for Buffer. Plan your queue, draft posts, get sign-off before publishing." />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Bricolage+Grotesque:wght@400;500;600;700;800&family=Lato:wght@400;500&display=swap" rel="stylesheet">

  <style>
    /* ═══════════════════════════════════════════
       DESIGN TOKENS
       ═══════════════════════════════════════════ */
    :root {
      --bg:        #f5f6fa;
      --surface:   #ffffff;
      --surface2:  #f9fafc;
      --surface3:  #f0f2f8;
      --border:    #e8eaf2;
      --border2:   #d8dce8;
      --text:      #14162a;
      --muted:     #5a6080;
      --subtle:    #9298b0;
      --ink:       #2c3050;

      /* Brand — deep indigo + coral accent */
      --brand:     #3a3fff;
      --brand-dim: rgba(58,63,255,.08);
      --brand-glow:rgba(58,63,255,.2);
      --accent:    #ff4f6a;
      --accent-dim:rgba(255,79,106,.08);
      --green:     #0fa672;
      --green-dim: rgba(15,166,114,.09);
      --amber:     #f59e0b;
      --red:       #e04040;

      --r:   12px;
      --r2:  8px;
      --sidebar: 248px;

      --shadow-sm: 0 1px 3px rgba(20,22,42,.06), 0 1px 2px rgba(20,22,42,.04);
      --shadow:    0 4px 16px rgba(20,22,42,.08), 0 1px 4px rgba(20,22,42,.04);
      --shadow-lg: 0 12px 40px rgba(20,22,42,.12), 0 4px 12px rgba(20,22,42,.06);
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html { -webkit-text-size-adjust: 100%; }

    body {
      font-family: 'Lato', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      line-height: 1.5;
      min-height: 100vh;
    }

    /* ── LAYOUT ── */
    .app { display: grid; grid-template-columns: var(--sidebar) 1fr; min-height: 100vh; }
    .main { overflow: auto; min-width: 0; }
    .view { display: none; padding: 28px 32px 40px; max-width: 1080px; }
    /* Views using view-content: reset outer padding and use view-content */
    #calendarView, #approvalsView, #templatesView { padding: 28px 0 40px; }
    #calendarView .page-hdr, #approvalsView .page-hdr, #templatesView .page-hdr { margin-left: 32px; margin-right: 32px; }
    .view.active { display: block; animation: vEnter .18s ease; }
    @keyframes vEnter { from { opacity:.5; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }

    /* ── SIDEBAR ── */
    .side {
      background: var(--text);
      display: flex;
      flex-direction: column;
      height: 100vh;
      position: sticky;
      top: 0;
      overflow: hidden;
    }

    .side-logo {
      padding: 20px 18px 16px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo-mark {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-weight: 800;
      font-size: 17px;
      color: #fff;
      letter-spacing: -.3px;
      display: flex;
      align-items: center;
      gap: 9px;
    }

    .logo-beta {
      font-family: 'DM Mono', monospace;
      font-size: 9px;
      font-weight: 500;
      letter-spacing: .08em;
      text-transform: uppercase;
      background: var(--brand);
      color: #fff;
      padding: 3px 7px;
      border-radius: 4px;
    }

    /* Connection status */
    .side-connection {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255,255,255,.07);
    }

    .conn-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .conn-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: rgba(255,255,255,.2);
      flex-shrink: 0;
      transition: background .3s;
    }
    .conn-dot.on {
      background: var(--green);
      box-shadow: 0 0 0 3px rgba(15,166,114,.25);
      animation: dotPulse 3s ease-in-out infinite;
    }
    @keyframes dotPulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(15,166,114,.4); }
      50%      { box-shadow: 0 0 0 5px rgba(15,166,114,0); }
    }

    .conn-label {
      font-size: 11px;
      font-family: 'DM Mono', monospace;
      color: rgba(255,255,255,.45);
      letter-spacing: .04em;
    }

    .conn-token-preview {
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      color: rgba(255,255,255,.3);
      margin-bottom: 8px;
    }

    .conn-actions { display: flex; gap: 6px; }

    /* Sync row */
    .side-sync {
      padding: 10px 16px 12px;
      border-bottom: 1px solid rgba(255,255,255,.07);
    }

    #syncBtn {
      width: 100%;
      justify-content: center;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.12);
      color: rgba(255,255,255,.7);
      font-size: 12px;
    }
    #syncBtn:hover { background: rgba(255,255,255,.1); color: #fff; border-color: rgba(255,255,255,.2); }

    .sync-meta {
      margin-top: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sync-meta span {
      font-size: 10px;
      font-family: 'DM Mono', monospace;
      color: rgba(255,255,255,.28);
      line-height: 1.4;
    }

    /* Nav */
    .side-nav {
      flex: 1;
      padding: 16px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow-y: auto;
    }

    .nav-section-label {
      font-size: 9px;
      font-family: 'DM Mono', monospace;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: rgba(255,255,255,.22);
      padding: 0 8px;
      margin: 10px 0 5px;
    }
    .nav-section-label:first-child { margin-top: 0; }

    .nav-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: rgba(255,255,255,.45);
      font-size: 13px;
      font-family: 'Lato', sans-serif;
      font-weight: 500;
      cursor: pointer;
      width: 100%;
      text-align: left;
      transition: background .12s, color .12s;
      position: relative;
    }
    .nav-btn:hover { background: rgba(255,255,255,.07); color: rgba(255,255,255,.8); }
    .nav-btn.active {
      background: rgba(58,63,255,.2);
      color: #fff;
      border: 1px solid rgba(58,63,255,.35);
    }
    .nav-btn.active .nav-icon { color: var(--brand); opacity: 1; }

    .nav-icon {
      width: 16px; height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      opacity: .6;
      flex-shrink: 0;
    }
    .nav-icon svg {
      width: 100%; height: 100%;
      stroke: currentColor; fill: none;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .nav-text { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .nav-tag {
      font-size: 9px;
      font-family: 'DM Mono', monospace;
      padding: 2px 6px;
      border-radius: 3px;
      letter-spacing: .04em;
      flex-shrink: 0;
    }
    .nav-tag.needs { background: rgba(255,79,106,.15); color: var(--accent); }
    .nav-tag.free { background: rgba(15,166,114,.15); color: var(--green); }

    /* Bottom of sidebar */
    .side-bottom {
      padding: 10px 10px 14px;
      border-top: 1px solid rgba(255,255,255,.07);
    }
    .side-bottom .nav-btn { font-size: 12px; color: rgba(255,255,255,.3); }
    .side-bottom .nav-btn:hover { color: rgba(255,255,255,.6); }

    /* ════════════════════════════════════
       SHARED COMPONENTS
       ════════════════════════════════════ */

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 0 14px;
      height: 34px;
      border-radius: var(--r2);
      border: 1px solid var(--border2);
      background: var(--surface);
      color: var(--text);
      font-size: 13px;
      font-weight: 500;
      font-family: 'Lato', sans-serif;
      cursor: pointer;
      text-decoration: none;
      white-space: nowrap;
      transition: all .12s;
      box-shadow: var(--shadow-sm);
    }
    .btn:hover { border-color: var(--brand); color: var(--brand); background: var(--brand-dim); }
    .btn.primary {
      background: var(--brand);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 2px 8px rgba(58,63,255,.25);
      font-weight: 600;
    }
    .btn.primary:hover { background: #2a2fff; box-shadow: 0 4px 16px rgba(58,63,255,.35); color: #fff; }
    .btn.danger { background: var(--red); color: #fff; border-color: transparent; }
    .btn.success { background: var(--green); color: #fff; border-color: transparent; font-weight: 600; }
    .btn.success:hover { background: #0b8f62; color: #fff; }
    .btn.ghost { background: transparent; border-color: transparent; box-shadow: none; color: var(--muted); }
    .btn.ghost:hover { background: var(--surface3); color: var(--text); border-color: transparent; }
    .btn.sm { height: 28px; padding: 0 10px; font-size: 12px; border-radius: 6px; }
    .btn.lg { height: 40px; padding: 0 20px; font-size: 14px; font-weight: 600; }
    .btn:active { transform: scale(.97); }
    .btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

    /* Inputs */
    .input, textarea, select {
      width: 100%;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border2);
      border-radius: var(--r2);
      padding: 8px 12px;
      font-family: 'Lato', sans-serif;
      font-size: 13px;
      line-height: 1.5;
      transition: border-color .12s, box-shadow .12s;
    }
    .input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--brand);
      box-shadow: 0 0 0 3px var(--brand-dim);
    }
    textarea { resize: vertical; min-height: 120px; line-height: 1.65; }
    select {
      cursor: pointer;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239298b0'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 30px;
    }

    /* Cards */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--r);
      padding: 18px;
      box-shadow: var(--shadow-sm);
    }

    /* Page headers */
    .page-hdr {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }
    .page-hdr-left { display: flex; flex-direction: column; gap: 4px; }
    .page-title {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-weight: 700;
      font-size: 22px;
      letter-spacing: -.3px;
      color: var(--ink);
    }
    .page-desc { font-size: 13px; color: var(--muted); line-height: 1.55; margin-top: 2px; }
    .page-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }

    /* Status pill */
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      font-family: 'DM Mono', monospace;
      font-weight: 500;
      letter-spacing: .04em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid var(--border2);
      color: var(--subtle);
    }
    .status-pill::before {
      content: '';
      width: 5px; height: 5px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }
    .status-pill.connected { color: var(--green); background: var(--green-dim); border-color: rgba(15,166,114,.2); }
    .status-pill.needs { color: var(--accent); background: var(--accent-dim); border-color: rgba(255,79,106,.2); }
    .status-pill.free { color: var(--brand); background: var(--brand-dim); border-color: var(--brand-glow); }

    /* Section header */
    .section-hdr {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }
    .section-title {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-weight: 700;
      font-size: 15px;
      color: var(--ink);
    }

    /* Chips */
    .chip {
      display: inline-flex;
      align-items: center;
      height: 20px;
      padding: 0 7px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      font-family: 'DM Mono', monospace;
      letter-spacing: .03em;
      text-transform: uppercase;
      border: 1px solid var(--border2);
      color: var(--subtle);
    }
    .chip.brand { background: var(--brand-dim); border-color: var(--brand-glow); color: var(--brand); }
    .chip.green { background: var(--green-dim); border-color: rgba(15,166,114,.2); color: var(--green); }

    /* Empty state */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 20px;
      border: 1px dashed var(--border2);
      border-radius: var(--r);
      text-align: center;
    }
    .empty-icon { font-size: 28px; opacity: .5; }
    .empty-title { font-weight: 600; font-size: 14px; color: var(--ink); }
    .empty-desc { font-size: 12px; color: var(--muted); line-height: 1.6; max-width: 50ch; }

    /* Toast */
    .toast-wrap {
      position: fixed; right: 16px; bottom: 16px;
      display: flex; flex-direction: column; gap: 6px;
      z-index: 80; pointer-events: none;
    }
    .toast {
      background: var(--ink);
      color: #fff;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: var(--shadow-lg);
      animation: toastIn .2s ease;
      max-width: 320px;
      line-height: 1.4;
      border-left: 3px solid var(--brand);
    }
    .toast.success { border-left-color: var(--green); }
    .toast.error   { border-left-color: var(--red); }
    .toast.out { animation: toastOut .2s ease forwards; }
    @keyframes toastIn  { from { opacity:0; transform:translateX(10px); } to { opacity:1; transform:none; } }
    @keyframes toastOut { to   { opacity:0; transform:translateX(10px); } }

    /* Modal */
    .modal {
      position: fixed; inset: 0;
      background: rgba(20,22,42,.55);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      z-index: 50;
    }
    .modal.open { display: flex; }
    .modal-card {
      max-width: 520px; width: 100%;
      background: var(--surface);
      border: 1px solid var(--border2);
      border-radius: 16px;
      padding: 22px;
      max-height: 88vh;
      overflow-y: auto;
      box-shadow: var(--shadow-lg);
      animation: mIn .2s cubic-bezier(.34,1.2,.64,1);
    }
    .modal-card.lg { max-width: 660px; }
    @keyframes mIn { from { opacity:0; transform:scale(.95) translateY(8px); } to { opacity:1; transform:none; } }
    .modal-hdr {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
    }
    .modal-title {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-weight: 700;
      font-size: 16px;
      color: var(--ink);
    }

    /* Field label */
    .field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
    .label {
      font-size: 11px;
      font-weight: 600;
      font-family: 'DM Mono', monospace;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--muted);
    }

    /* Divider */
    .divider { height: 1px; background: var(--border); margin: 14px 0; }

    /* Utility */
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .mt8 { margin-top: 8px; }
    .mt12 { margin-top: 12px; }
    .mt16 { margin-top: 16px; }
    .mb8 { margin-bottom: 8px; }
    .hidden { display: none !important; }
    .grow { flex: 1; min-width: 0; }
    .mono { font-family: 'DM Mono', monospace; }

    /* Scrollbars */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
    ::selection { background: var(--brand-dim); }

    /* Desktop view content padding */
    .view-content { padding: 0 32px 40px; }
    /* Composer layout not wrapped in view-content on desktop */
    #composerView .composer-layout { padding: 0; }

    /* ════════════════════════════════════
       VIEW: CALENDAR (Plan)
       ════════════════════════════════════ */
    .cal-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }
    .cal-month-label {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-weight: 700;
      font-size: 20px;
      letter-spacing: -.3px;
      color: var(--ink);
      flex: 1;
    }

    .cal-dow {
      display: grid;
      grid-template-columns: repeat(7,1fr);
      gap: 4px;
      margin-bottom: 4px;
    }
    .dow-cell {
      text-align: center;
      font-size: 10px;
      font-family: 'DM Mono', monospace;
      font-weight: 600;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: var(--subtle);
      padding: 4px 0 6px;
    }

    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7,1fr);
      gap: 4px;
    }

    .cal-day {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px;
      min-height: 92px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 3px;
      transition: border-color .12s, background .12s;
      position: relative;
      overflow: hidden;
    }
    .cal-day:hover { border-color: var(--brand-glow); background: #fdfdff; }
    .cal-day.today { border-color: var(--brand); background: #fdfdff; }
    .cal-day.today .day-num { color: var(--brand); font-weight: 700; }
    .cal-day.other-month { opacity: .32; }
    .cal-day.has-posts { border-color: var(--border2); }
    .cal-day.has-gap { border-color: rgba(245,158,11,.4); background: rgba(245,158,11,.03); }

    .day-num {
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      color: var(--subtle);
      flex-shrink: 0;
    }
    .day-count {
      position: absolute;
      top: 7px; right: 7px;
      font-size: 9px;
      font-family: 'DM Mono', monospace;
      background: var(--brand-dim);
      color: var(--brand);
      border: 1px solid var(--brand-glow);
      padding: 1px 5px;
      border-radius: 3px;
    }
    .day-post-pill {
      font-size: 10px;
      line-height: 1.35;
      padding: 2px 5px;
      border-radius: 4px;
      background: var(--brand-dim);
      border: 1px solid var(--brand-glow);
      color: var(--brand);
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .day-note-pill {
      font-size: 10px;
      line-height: 1.35;
      padding: 2px 5px;
      border-radius: 4px;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .day-note-pill.gold   { background: rgba(245,158,11,.1); border: 1px solid rgba(245,158,11,.2); color: #92600a; }
    .day-note-pill.blue   { background: var(--brand-dim); border: 1px solid var(--brand-glow); color: var(--brand); }
    .day-note-pill.green  { background: var(--green-dim); border: 1px solid rgba(15,166,114,.2); color: var(--green); }
    .day-note-pill.violet { background: rgba(124,58,237,.08); border: 1px solid rgba(124,58,237,.18); color: #7c3aed; }

    .day-gap-indicator {
      font-size: 9px;
      font-family: 'DM Mono', monospace;
      color: var(--amber);
      margin-top: auto;
    }
    .more-indicator { font-size: 9px; color: var(--subtle); font-family: 'DM Mono', monospace; margin-top: auto; }

    /* Queue gaps panel */
    .gaps-panel {
      background: linear-gradient(135deg, rgba(245,158,11,.06), rgba(245,158,11,.02));
      border: 1px solid rgba(245,158,11,.2);
      border-radius: var(--r);
      padding: 16px;
      margin-bottom: 20px;
    }
    .gaps-panel-hdr {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .gaps-title {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-weight: 700;
      font-size: 14px;
      color: var(--amber);
    }
    .gaps-list {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .gap-chip {
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid rgba(245,158,11,.25);
      background: rgba(245,158,11,.08);
      font-size: 11px;
      font-family: 'DM Mono', monospace;
      color: #92600a;
      cursor: pointer;
      transition: all .12s;
    }
    .gap-chip:hover { background: rgba(245,158,11,.15); border-color: rgba(245,158,11,.4); }

    /* ════════════════════════════════════
       VIEW: COMPOSER (Draft)
       ════════════════════════════════════ */
    .composer-layout {
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 18px;
      align-items: start;
    }

    /* Editor */
    .editor-wrap {
      background: var(--surface);
      border: 1px solid var(--border2);
      border-radius: var(--r);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }
    .editor-toolbar {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 8px 10px;
      border-bottom: 1px solid var(--border);
      background: var(--surface2);
      flex-wrap: wrap;
    }
    .tb-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px; height: 28px;
      border-radius: 5px;
      border: none;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: 12px;
      font-family: 'DM Mono', monospace;
      transition: all .1s;
    }
    .tb-btn:hover { background: var(--surface3); color: var(--text); }
    .tb-sep { width: 1px; height: 16px; background: var(--border2); margin: 0 4px; flex-shrink: 0; }

    .rich-editor {
      min-height: 220px;
      padding: 16px;
      outline: none;
      font-size: 14px;
      line-height: 1.7;
      color: var(--text);
      caret-color: var(--brand);
      font-family: 'Lato', sans-serif;
    }
    .rich-editor:empty::before {
      content: attr(data-placeholder);
      color: var(--subtle);
      font-style: italic;
      pointer-events: none;
    }

    .editor-footer {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-top: 1px solid var(--border);
      background: var(--surface2);
      flex-wrap: wrap;
    }
    .char-count {
      font-size: 11px;
      font-family: 'DM Mono', monospace;
      color: var(--subtle);
      margin-left: auto;
      transition: color .2s;
    }
    .char-count.warn { color: var(--amber); }
    .char-count.over { color: var(--red); font-weight: 600; }

    /* Composer sidebar panel */
    .composer-panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .panel-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--r);
      padding: 16px;
      box-shadow: var(--shadow-sm);
    }
    .panel-card-title {
      font-size: 11px;
      font-family: 'DM Mono', monospace;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--muted);
      margin-bottom: 12px;
    }

    /* Send actions */
    .send-actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .send-actions .btn { width: 100%; justify-content: center; }

    /* Schedule row */
    .schedule-row {
      display: none;
      flex-direction: column;
      gap: 6px;
      padding: 10px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--r2);
      margin-top: 6px;
    }
    .schedule-row.open { display: flex; }

    /* Approval checkbox */
    .approval-check-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--r2);
      cursor: pointer;
      transition: border-color .12s;
    }
    .approval-check-row:hover { border-color: var(--brand-glow); }
    .approval-check-row input[type="checkbox"] {
      accent-color: var(--brand);
      width: 14px; height: 14px;
      flex-shrink: 0;
    }
    .approval-check-label {
      font-size: 12px;
      color: var(--muted);
      cursor: pointer;
      user-select: none;
      line-height: 1.35;
    }

    /* Media toggle */
    .media-toggle-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
      border-radius: var(--r2);
      border: 1px solid var(--border2);
      background: transparent;
      color: var(--muted);
      font-size: 12px;
      font-family: 'Lato', sans-serif;
      cursor: pointer;
      transition: all .12s;
      width: 100%;
    }
    .media-toggle-btn:hover { border-color: var(--brand-glow); color: var(--brand); background: var(--brand-dim); }
    .media-toggle-btn.has-media { border-color: var(--brand-glow); color: var(--brand); background: var(--brand-dim); }

    /* Media panel */
    .media-panel { display: none; margin-top: 8px; }
    .media-panel.open { display: block; }
    .media-tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
      margin-bottom: 12px;
    }
    .media-tab {
      padding: 7px 12px;
      border: none;
      background: transparent;
      color: var(--muted);
      font-size: 12px;
      font-family: 'Lato', sans-serif;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: all .12s;
    }
    .media-tab:hover { color: var(--text); }
    .media-tab.active { color: var(--brand); border-bottom-color: var(--brand); }
    .media-tab-panel { display: none; }
    .media-tab-panel.active { display: block; }

    /* Templates panel */
    .template-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 280px;
      overflow-y: auto;
    }
    .template-item {
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: var(--r2);
      cursor: pointer;
      transition: all .1s;
      background: var(--surface);
    }
    .template-item:hover { border-color: var(--brand-glow); background: var(--brand-dim); }
    .template-item-title {
      font-weight: 600;
      font-size: 12px;
      color: var(--ink);
      margin-bottom: 2px;
    }
    .template-item-preview {
      font-size: 11px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ════════════════════════════════════
       VIEW: APPROVALS (Approve)
       ════════════════════════════════════ */
    .approvals-filter-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 18px;
      align-items: center;
    }
    .filter-label {
      font-size: 10px;
      font-family: 'DM Mono', monospace;
      color: var(--subtle);
      text-transform: uppercase;
      letter-spacing: .06em;
      margin-right: 2px;
    }
    .filter-pill {
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px solid var(--border2);
      background: var(--surface);
      color: var(--muted);
      font-size: 12px;
      font-family: 'DM Mono', monospace;
      cursor: pointer;
      transition: all .12s;
      box-shadow: var(--shadow-sm);
    }
    .filter-pill:hover { border-color: var(--brand-glow); color: var(--brand); }
    .filter-pill.active { background: var(--brand-dim); border-color: var(--brand-glow); color: var(--brand); font-weight: 600; }

    /* Approval card */
    .approval-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--r);
      margin-bottom: 14px;
      overflow: hidden;
      box-shadow: var(--shadow-sm);
      transition: box-shadow .15s;
    }
    .approval-card:hover { box-shadow: var(--shadow); }
    .approval-card-status-bar {
      height: 3px;
      background: var(--border);
    }
    .approval-card-status-bar.pending   { background: var(--amber); }
    .approval-card-status-bar.approved  { background: var(--green); }
    .approval-card-status-bar.changes   { background: var(--accent); }

    .approval-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--surface2);
    }
    .approval-card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .approval-status-badge {
      display: inline-flex;
      align-items: center;
      height: 22px;
      padding: 0 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      font-family: 'DM Mono', monospace;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .approval-status-badge.pending  { background: rgba(245,158,11,.12); color: var(--amber); }
    .approval-status-badge.approved { background: var(--green-dim); color: var(--green); }
    .approval-status-badge.changes  { background: var(--accent-dim); color: var(--accent); }

    .approval-card-body { padding: 16px; }
    .approval-content-text {
      font-size: 14px;
      line-height: 1.7;
      color: var(--text);
      white-space: pre-wrap;
      word-break: break-word;
      padding: 12px 14px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--r2);
      margin-bottom: 12px;
    }

    .approval-link-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: var(--r2);
      margin-bottom: 10px;
    }
    .approval-link-url {
      flex: 1;
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      color: var(--brand);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .approval-comments { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
    .approval-comment {
      padding: 10px 12px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--r2);
      margin-bottom: 6px;
    }
    .approval-comment-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
    .approval-comment-author { font-weight: 600; font-size: 12px; }
    .approval-comment-time { font-size: 10px; color: var(--subtle); font-family: 'DM Mono', monospace; }
    .approval-comment-action { font-size: 10px; font-weight: 700; font-family: 'DM Mono', monospace; padding: 1px 6px; border-radius: 3px; text-transform: uppercase; letter-spacing: .04em; }
    .approval-comment-action.approved { background: var(--green-dim); color: var(--green); }
    .approval-comment-action.changes  { background: var(--accent-dim); color: var(--accent); }
    .approval-comment-text { font-size: 13px; color: var(--text); line-height: 1.5; }

    .approval-footer {
      padding: 14px 16px;
      border-top: 1px solid var(--border);
      background: var(--surface2);
    }

    /* Reviewer page */
    #reviewerPage { display: none; min-height: 100vh; background: var(--bg); }
    #reviewerPage.active { display: block; }
    .reviewer-wrap { max-width: 620px; margin: 0 auto; padding: 40px 20px 80px; }
    .reviewer-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 32px;
      font-family: 'Bricolage Grotesque', sans-serif;
      font-weight: 800;
      font-size: 20px;
      color: var(--ink);
    }
    .reviewer-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 16px;
      box-shadow: var(--shadow);
    }
    .reviewer-form-label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      font-family: 'DM Mono', monospace;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .reviewer-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .reviewer-btn {
      flex: 1;
      min-width: 130px;
      padding: 13px 20px;
      border-radius: 10px;
      border: none;
      font-family: 'Lato', sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s;
    }
    .reviewer-btn.approve { background: var(--green); color: #fff; }
    .reviewer-btn.approve:hover { background: #0b8f62; transform: translateY(-1px); }
    .reviewer-btn.changes { background: var(--surface); border: 1.5px solid var(--border2); color: var(--text); }
    .reviewer-btn.changes:hover { border-color: var(--accent); color: var(--accent); }
    .reviewer-btn:disabled { opacity: .5; cursor: not-allowed; transform: none !important; }

    /* Templates view */
    .templates-layout {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 18px;
      align-items: start;
    }
    .templates-sidebar {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--r);
      padding: 10px;
      position: sticky;
      top: 0;
      box-shadow: var(--shadow-sm);
    }
    .type-filter-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      text-align: left;
      padding: 7px 10px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--muted);
      font-size: 12px;
      font-family: 'Lato', sans-serif;
      cursor: pointer;
      transition: all .1s;
    }
    .type-filter-btn:hover { background: var(--surface2); color: var(--text); }
    .type-filter-btn.active { background: var(--brand-dim); color: var(--brand); font-weight: 600; }
    .type-filter-count { font-size: 10px; font-family: 'DM Mono', monospace; opacity: .55; }

    .templates-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px,1fr));
      gap: 10px;
    }
    .template-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--r);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: var(--shadow-sm);
      transition: border-color .12s, box-shadow .12s, transform .1s;
    }
    .template-card:hover { border-color: var(--brand-glow); box-shadow: var(--shadow); transform: translateY(-1px); }
    .template-card-hdr { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .template-card-title { font-weight: 700; font-size: 13px; color: var(--ink); line-height: 1.3; }
    .template-card-body { font-size: 12px; color: var(--muted); line-height: 1.6; white-space: pre-wrap; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
    .template-card-tags { font-size: 10px; color: var(--subtle); font-family: 'DM Mono', monospace; }
    .template-card-actions { display: flex; gap: 5px; padding-top: 6px; border-top: 1px solid var(--border); }

    /* Settings modal tabs */
    .settings-tabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
    .settings-tab {
      padding: 8px 14px;
      border: none;
      background: transparent;
      color: var(--muted);
      font-size: 13px;
      font-weight: 500;
      font-family: 'Lato', sans-serif;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: all .12s;
    }
    .settings-tab.active { color: var(--brand); border-bottom-color: var(--brand); }
    .settings-panel { display: none; }
    .settings-panel.active { display: block; }

    /* Mobile bottom nav */
    .mobile-tabs { display: none; }

    /* Mobile view header (replaces page-hdr on small screens) */
    .mob-view-hdr { display: none; }

    /* Mobile drawer */
    .mob-backdrop { position: fixed; inset: 0; background: rgba(20,22,42,.5); z-index: 98; display: none; }
    .mob-backdrop.open { display: block; }
    .mob-drawer {
      position: fixed;
      bottom: 60px; left: 0; right: 0;
      max-height: 80vh;
      overflow-y: auto;
      background: var(--surface);
      border-top: 1px solid var(--border2);
      border-radius: 20px 20px 0 0;
      z-index: 99;
      padding: 8px 18px 24px;
      box-shadow: 0 -12px 40px rgba(20,22,42,.18);
      display: none;
    }
    .mob-drawer.open { display: block; animation: drawerUp .25s cubic-bezier(.34,1.1,.64,1); }
    @keyframes drawerUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .mob-drawer-handle {
      width: 36px; height: 4px;
      background: var(--border2);
      border-radius: 2px;
      margin: 10px auto 18px;
    }
    .mob-drawer-title {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-weight: 700;
      font-size: 17px;
      color: var(--ink);
      margin-bottom: 14px;
    }

    /* ── MOBILE ── */
    @media (max-width: 768px) {

      /* ── Core layout ── */
      .side { display: none; }
      .app { grid-template-columns: 1fr; }
      .view { padding: 0 0 72px; max-width: 100%; }
      .page-hdr { display: none !important; }

      /* ── Mobile view header ── */
      .mob-view-hdr {
        display: flex !important;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px 12px;
        border-bottom: 1px solid var(--border);
        background: var(--surface);
        position: sticky;
        top: 0;
        z-index: 5;
        margin-bottom: 0;
      }
      .mob-view-title {
        font-family: 'Bricolage Grotesque', sans-serif;
        font-weight: 700;
        font-size: 19px;
        color: var(--ink);
        letter-spacing: -.2px;
      }
      .mob-view-actions { display: flex; gap: 6px; align-items: center; }

      /* ── View content areas ── */
      .view-content { padding: 14px 16px; }
      .cal-header { padding: 0; }
      .gaps-panel { margin-bottom: 14px; }

      /* ── Calendar ── */
      .cal-grid { display: none; }
      .cal-dow  { display: none; }
      .cal-agenda { display: block !important; }

      /* ── Composer ── */
      #composerView { padding: 0 0 72px !important; max-width: 100%; }
      .composer-layout { display: flex; flex-direction: column; gap: 0; }
      /* Editor full-width, no side padding */
      .editor-wrap { border-radius: 0; border-left: none; border-right: none; }
      .rich-editor { min-height: 160px; font-size: 15px; padding: 14px 16px; }
      .editor-toolbar { padding: 8px 10px; gap: 3px; flex-wrap: wrap; }
      .editor-footer { padding: 8px 14px; flex-wrap: wrap; gap: 6px; }
      /* Media controls — padded since they sit below full-width editor */
      .media-toggle-btn, #mediaToggleOff {
        margin: 8px 16px 0;
        width: calc(100% - 32px) !important;
      }
      #mediaSummary    { margin: 8px 16px 0; }
      #composerStatus  { padding: 0 16px; font-size: 12px; }
      #refPin          { margin: 0 16px 14px; }
      /* Right-panel card becomes a section below the editor */
      .composer-panel  { padding: 14px 16px 0; display: flex; flex-direction: column; gap: 12px; }
      .send-actions    { display: flex; flex-direction: column; gap: 8px; }
      .send-actions .btn { height: 44px; font-size: 15px; justify-content: center; }

      /* ── Templates ── */
      .templates-layout { display: flex; flex-direction: column; gap: 0; }
      .templates-sidebar {
        position: static;
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        padding: 0 0 12px;
        background: transparent;
        border: none;
        border-radius: 0;
        border-bottom: 1px solid var(--border);
        margin-bottom: 12px;
        box-shadow: none;
      }
      .type-filter-btn {
        width: auto;
        padding: 5px 12px;
        border-radius: 20px;
        border: 1px solid var(--border2);
        background: var(--surface);
        font-size: 12px;
        justify-content: center;
      }
      .type-filter-btn .type-filter-count { display: none; }
      .templates-grid { grid-template-columns: 1fr; }

      /* ── Approvals ── */
      .approval-card {
        border-radius: 0;
        border-left: none;
        border-right: none;
        margin-bottom: 8px;
      }

      /* ── Misc ── */
      .cols2 { grid-template-columns: 1fr; }

      /* ── Bottom nav ── */
      .mobile-tabs {
        display: flex;
        position: fixed;
        bottom: 0; left: 0; right: 0;
        height: 60px;
        background: var(--surface);
        border-top: 1px solid var(--border);
        z-index: 100;
        align-items: stretch;
        padding-bottom: env(safe-area-inset-bottom);
        box-shadow: 0 -2px 12px rgba(20,22,42,.06);
      }
      .mob-tab {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        background: transparent;
        border: none;
        color: var(--subtle);
        font-size: 10px;
        font-family: 'DM Mono', monospace;
        cursor: pointer;
        letter-spacing: .04em;
        text-transform: uppercase;
        transition: color .12s;
        -webkit-tap-highlight-color: transparent;
        position: relative;
      }
      .mob-tab.active { color: var(--brand); }
      .mob-tab.active::before {
        content: '';
        position: absolute;
        top: 5px; left: 50%;
        transform: translateX(-50%);
        width: 4px; height: 4px;
        border-radius: 50%;
        background: var(--brand);
      }
      .mob-tab svg {
        width: 18px; height: 18px;
        stroke: currentColor; fill: none;
        stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round;
      }

      /* ── Modals sheet up ── */
      .modal { align-items: flex-end; padding: 0; }
      .modal-card {
        max-width: 100%; width: 100%;
        border-radius: 20px 20px 0 0;
        max-height: 88vh;
        padding: 20px 16px 40px;
        animation: sheetUp .28s cubic-bezier(.34,1.1,.64,1);
      }
      @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

      /* Prevent iOS zoom */
      input, select, textarea { font-size: 16px !important; }
    }

    @media (max-width: 960px) {
      :root { --sidebar: 220px; }
      .composer-layout { grid-template-columns: 1fr; }
    }

    /* ══════════════════════════════════════
       ZEN MODE
       ══════════════════════════════════════ */
    .zen-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px; height: 28px;
      border-radius: 5px;
      border: none;
      background: transparent;
      color: var(--subtle);
      cursor: pointer;
      font-size: 13px;
      transition: all .12s;
      margin-left: auto;
    }
    .zen-btn:hover { background: var(--surface3); color: var(--brand); }
    .zen-btn svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

    /* Zen overlay */
    body.zen-active {
      background: radial-gradient(circle at top, rgba(58,63,255,.08), transparent 35%), #0f0f12;
    }
    body.zen-active .side,
    body.zen-active .mobile-tabs,
    body.zen-active #composerModeTabs,
    body.zen-active #splitModePanel,
    body.zen-active .page-hdr,
    body.zen-active .mob-view-hdr,
    body.zen-active .composer-panel,
    body.zen-active #refPin,
    body.zen-active .media-toggle-btn,
    body.zen-active #mediaToggleOff,
    body.zen-active #mediaSummary,
    body.zen-active #composerStatus,
    body.zen-active .editor-toolbar { opacity: 0; pointer-events: none; transition: opacity .3s ease; }

    body.zen-active .app { grid-template-columns: 1fr; }
    body.zen-active .main { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    body.zen-active #composerView {
      width: min(760px, 92vw);
      padding: 0 0 40px !important;
      margin: 0 auto;
    }
    body.zen-active .editor-wrap {
      border: none;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
    body.zen-active .rich-editor {
      min-height: 55vh;
      background: transparent;
      color: #e8e6e0;
      caret-color: var(--brand);
      font-size: 18px;
      line-height: 1.85;
      padding: 32px 0;
      font-family: 'Lato', sans-serif;
      letter-spacing: .01em;
    }
    body.zen-active .rich-editor:empty::before { color: rgba(255,255,255,.18); font-style: italic; }
    body.zen-active .editor-footer {
      background: transparent;
      border-top: 1px solid rgba(255,255,255,.06);
      padding: 10px 0;
    }
    body.zen-active .editor-footer select,
    body.zen-active .editor-footer #composerNoChannels { display: none; }
    body.zen-active .char-count { color: rgba(255,255,255,.22); }
    body.zen-active .char-count.warn { color: rgba(245,158,11,.6); }
    body.zen-active .char-count.over { color: rgba(224,64,64,.8); }

    /* Zen exit button — floats bottom-right */
    #zenExit {
      position: fixed;
      bottom: 28px; right: 28px;
      z-index: 200;
      display: none;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.06);
      color: rgba(255,255,255,.35);
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      letter-spacing: .06em;
      text-transform: uppercase;
      cursor: pointer;
      transition: all .2s;
      backdrop-filter: blur(8px);
    }
    #zenExit:hover { color: rgba(255,255,255,.7); background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.2); }
    body.zen-active #zenExit { display: flex; }

    /* Zen send actions — appear inline below editor on zen mode */
    #zenActions {
      display: none;
      gap: 8px;
      flex-wrap: wrap;
      padding: 12px 0 0;
    }
    body.zen-active #zenActions { display: flex; }
    #zenActions .btn { height: 36px; font-size: 13px; }
    #zenActions .btn.primary { background: var(--brand); color: #fff; border-color: transparent; }
    #zenActions select {
      height: 36px;
      padding: 0 28px 0 10px;
      font-size: 13px;
      background: rgba(255,255,255,.07);
      border: 1px solid rgba(255,255,255,.12);
      color: rgba(255,255,255,.6);
      border-radius: var(--r2);
    }

    @media (max-width: 768px) {
      #zenExit { bottom: 72px; right: 16px; }
    }
  </style>
</head>

<body>

<!-- SVG icons -->
<svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">
  <defs>
    <symbol id="i-cal" viewBox="0 0 24 24"><path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></symbol>
    <symbol id="i-compose" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></symbol>
    <symbol id="i-templates" viewBox="0 0 24 24"><path d="M8 6h11M8 12h8M8 18h10M3 6h.01M3 12h.01M3 18h.01"/></symbol>
    <symbol id="i-buffer" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></symbol>
    <symbol id="i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></symbol>
    <symbol id="i-img" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></symbol>
    <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></symbol>
    <symbol id="i-trending" viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 7-8"/><path d="M14 7h6v6"/></symbol>
    <symbol id="i-thread" viewBox="0 0 24 24"><path d="M21 12c0 4-3 7-7 7s-7-3-7-7 3-7 7-7c3.5 0 6 2.3 6 5.5S17.5 16 14 16c-2.5 0-4-1.5-4-3.5S11.5 9 14 9h3"/></symbol>
    <symbol id="i-unsplash" viewBox="0 0 24 24"><path d="M7.5 6.75V0h9v6.75h-9zm9 3.75H24V24H0V10.5h7.5v6.75h9V10.5z"/></symbol>
  </defs>
</svg>

<!-- ── MOBILE TABS ── -->
<nav class="mobile-tabs" id="mobileTabs">
  <button class="mob-tab active" data-view="calendarView">
    <svg><use href="#i-cal"/></svg>Plan
  </button>
  <button class="mob-tab" data-view="composerView">
    <svg><use href="#i-compose"/></svg>Draft
  </button>
  <button class="mob-tab" data-view="contentBucketsView">
    <svg><use href="#i-templates"/></svg>Buckets
  </button>
  <button class="mob-tab" data-view="approvalsView">
    <svg><use href="#i-check"/></svg>Approve
  </button>
  <button class="mob-tab" id="mobMoreBtn">
    <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
    More
  </button>
</nav>

<!-- ── APP SHELL ── -->
<section id="app" class="app">

  <!-- SIDEBAR -->
  <aside class="side">
    <div class="side-logo">
      <div class="logo-mark">
        PostIQ <span class="logo-beta">Beta</span>
      </div>
    </div>

    <!-- Connection -->
    <div class="side-connection">
      <div class="conn-row">
        <div class="conn-dot" id="connDot"></div>
        <span class="conn-label" id="connLabel">Not connected</span>
      </div>
      <div class="conn-token-preview" id="connTokenPreview">—</div>
      <div class="conn-actions">
        <button class="btn sm" id="manageTokenBtn">Manage token</button>
        <button class="btn sm ghost" id="revealTokenBtn">Reveal</button>
      </div>
      <!-- Token panel (toggles open) -->
      <div id="tokenPanel" style="display:none; margin-top:10px;">
        <div class="field">
          <label class="label">Buffer API token</label>
          <input id="tokenInput" class="input mono" type="password" placeholder="Paste token…" />
        </div>
        <div class="row mb8" style="gap:14px;">
          <label style="font-size:11px;color:rgba(255,255,255,.5);cursor:pointer;"><input type="radio" name="tokenMode" value="session" checked /> Session</label>
          <label style="font-size:11px;color:rgba(255,255,255,.5);cursor:pointer;"><input type="radio" name="tokenMode" value="local" /> Save locally</label>
        </div>
        <div class="row">
          <button class="btn sm primary" id="saveTokenBtn">Save</button>
          <button class="btn sm ghost" id="clearTokenBtn" style="color:rgba(255,255,255,.4);">Remove</button>
        </div>
        <div id="tokenMsg" style="font-size:11px;color:rgba(255,255,255,.35);margin-top:6px;font-family:'DM Mono',monospace;"></div>
      </div>
    </div>

    <!-- Sync -->
    <div class="side-sync">
      <button class="btn" id="syncBtn">↻ Load from Buffer</button>
      <div class="sync-meta">
        <span id="syncStatus">Not synced.</span>
        <span id="lastSynced"></span>
      </div>
    </div>

    <!-- Nav -->
    <nav class="side-nav">
      <div class="nav-section-label">Workflow</div>
      <button class="nav-btn active" data-view="calendarView">
        <span class="nav-icon"><svg><use href="#i-cal"/></svg></span>
        <span class="nav-text">Plan</span>
        <span class="nav-tag needs" id="calNavTag">Needs key</span>
      </button>
      <button class="nav-btn" data-view="composerView">
        <span class="nav-icon"><svg><use href="#i-compose"/></svg></span>
        <span class="nav-text">Draft</span>
      </button>
      <button class="nav-btn" data-view="approvalsView">
        <span class="nav-icon"><svg><use href="#i-check"/></svg></span>
        <span class="nav-text">Approve</span>
        <span class="nav-tag needs" id="appNavTag">Needs key</span>
      </button>
      <div class="nav-section-label">Tools</div>
      <button class="nav-btn" data-view="contentBucketsView">
        <span class="nav-icon"><svg><use href="#i-templates"/></svg></span>
        <span class="nav-text">Content Buckets</span>
        <span class="nav-tag free">Free</span>
      </button>
      <button class="nav-btn" data-view="trendingView">
        <span class="nav-icon"><svg><use href="#i-trending"/></svg></span>
        <span class="nav-text">Trending</span>
        <span class="nav-tag free">Free</span>
      </button>
      <button class="nav-btn" data-view="templatesView">
        <span class="nav-icon"><svg><use href="#i-templates"/></svg></span>
        <span class="nav-text">Templates</span>
        <span class="nav-tag free">Free</span>
      </button>
    </nav>

    <div class="side-bottom">
      <a class="nav-btn" href="https://publish.buffer.com/" target="_blank" rel="noopener">
        <span class="nav-icon" style="opacity:.5;"><svg><use href="#i-buffer"/></svg></span>
        <span class="nav-text">Open Buffer</span>
      </a>
      <button class="nav-btn" id="openSettings">
        <span class="nav-icon" style="opacity:.5;"><svg><use href="#i-settings"/></svg></span>
        <span class="nav-text">Settings &amp; Help</span>
      </button>
    </div>
  </aside>

  <!-- MAIN CONTENT -->
  <main class="main">

    <!-- ══════════ PLAN (Calendar) ══════════ -->
    <section id="calendarView" class="view active">
      <!-- Mobile header -->
      <div class="mob-view-hdr">
        <span class="mob-view-title">📅 Plan</span>
        <div class="mob-view-actions">
          <button class="btn sm" id="shareMonthBtnMob">Share</button>
          <button class="btn sm ghost" id="mobMenuBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
        </div>
      </div>

      <!-- Desktop header -->
      <div class="page-hdr">
        <div class="page-hdr-left">
          <h1 class="page-title">Plan</h1>
          <p class="page-desc" id="calDesc">Your Buffer queue in a monthly view. Spot gaps and add planning notes before you draft.</p>
        </div>
        <div class="page-actions">
          <button class="btn" id="shareMonthBtn">Share snapshot</button>
          <a class="btn ghost" href="https://publish.buffer.com/" target="_blank" rel="noopener">Open Buffer ↗</a>
        </div>
      </div>

      <div class="view-content">

      <!-- Queue gaps (shown when connected + gaps found) -->
      <div class="gaps-panel" id="gapsPanel" style="display:none;">
        <div class="gaps-panel-hdr">
          <span style="font-size:16px;">⚠️</span>
          <span class="gaps-title">Queue gaps this week</span>
          <span style="font-size:12px;color:var(--muted);margin-left:auto;">Click a day to add a note or draft content</span>
        </div>
        <div class="gaps-list" id="gapsList"></div>
      </div>

      <!-- Calendar header -->
      <div class="cal-header">
        <button class="btn sm ghost" id="prevMonth">‹</button>
        <div class="cal-month-label" id="monthLabel"></div>
        <button class="btn sm ghost" id="nextMonth">›</button>
        <button class="btn sm ghost" id="todayMonth">Today</button>
      </div>

      <!-- Day-of-week labels -->
      <div class="cal-dow">
        <div class="dow-cell">Sun</div><div class="dow-cell">Mon</div>
        <div class="dow-cell">Tue</div><div class="dow-cell">Wed</div>
        <div class="dow-cell">Thu</div><div class="dow-cell">Fri</div>
        <div class="dow-cell">Sat</div>
      </div>

      <!-- Calendar grid (desktop) -->
      <div class="cal-grid" id="calGrid"></div>

      <!-- Agenda view (mobile) -->
      <div class="cal-agenda" id="calAgenda" style="display:none;"></div>

      <div id="calEmptyHint" class="mt16" style="display:none;">
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <div class="empty-title">No scheduled posts loaded</div>
          <div class="empty-desc">Connect your Buffer token and click "Load from Buffer" to see your queue in this calendar.</div>
        </div>
      </div>
      </div><!-- /view-content -->
    </section>

    <!-- ══════════ DRAFT (Composer) ══════════ -->
    <section id="composerView" class="view">
      <!-- Mobile header -->
      <div class="mob-view-hdr">
        <span class="mob-view-title">✍️ Draft</span>
        <div class="mob-view-actions">
          <button class="btn sm ghost" id="composerClearBtnMob" style="display:none;">Clear ✕</button>
          <button class="btn sm ghost" id="mobMenuBtnDraft">
            <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
        </div>
      </div>
      <!-- Desktop header -->
      <div class="page-hdr">
        <div class="page-hdr-left">
          <h1 class="page-title">Draft</h1>
          <p class="page-desc" id="composerDesc">Write, organize bucket ideas, attach media, then send to Buffer as a draft, queued post, or scheduled post.</p>
        </div>
        <div class="page-actions">
          <button class="btn ghost" id="composerClearBtn" style="display:none;">Clear ✕</button>
          <a class="btn ghost" href="https://publish.buffer.com/" target="_blank" rel="noopener">Open Buffer ↗</a>
        </div>
      </div>

      <div class="composer-layout">

        <!-- Mode tabs: Compose / Split -->
        <div id="composerModeTabs" style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:16px;grid-column:1/-1;">
          <button class="composer-mode-tab active" data-cmode="compose" style="padding:9px 20px;border:none;background:transparent;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;font-family:'Lato',sans-serif;transition:all .12s;">Compose</button>
          <button class="composer-mode-tab" data-cmode="split" style="padding:9px 20px;border:none;background:transparent;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;font-family:'Lato',sans-serif;transition:all .12s;">Split into thread</button>
        </div>

        <!-- ── COMPOSE MODE ── -->
        <div id="composeModePanel" style="display:contents;">

        <!-- Editor column -->
        <div>
          <!-- Trending reference pin (hidden until pinned from Trending) -->
          <div id="refPin" style="display:none;background:var(--surface);border:1px solid var(--border2);border-left:3px solid var(--brand);border-radius:var(--r);padding:12px 14px;margin-bottom:14px;position:relative;">
            <div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--brand);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Writing from</div>
            <div id="refPinTitle" style="font-size:13px;font-weight:600;color:var(--ink);margin-bottom:3px;"></div>
            <div id="refPinBody" style="font-size:12px;color:var(--muted);line-height:1.5;"></div>
            <button id="refPinDismiss" style="position:absolute;top:8px;right:10px;background:none;border:none;color:var(--subtle);cursor:pointer;font-size:16px;" title="Dismiss">×</button>
          </div>

          <div class="editor-wrap">
            <div class="editor-toolbar">
              <button class="tb-btn" data-cmd="bold" title="Bold"><strong>B</strong></button>
              <button class="tb-btn" data-cmd="italic" title="Italic"><em>I</em></button>
              <div class="tb-sep"></div>
              <button class="tb-btn" data-cmd="ul" title="Bullet list">• List</button>
              <button class="tb-btn" data-cmd="ol" title="Numbered list">1. List</button>
              <div class="tb-sep"></div>
              <button class="tb-btn" id="insertTemplateBtn" title="Insert template" style="width:auto;padding:0 8px;font-size:11px;font-family:'DM Mono',monospace;">Templates</button>
              <button class="tb-btn" id="saveAsTemplateBtn" title="Save selection as template" style="width:auto;padding:0 8px;font-size:11px;font-family:'DM Mono',monospace;">+ Save</button>
              <div class="tb-sep"></div>
              <button class="tb-btn" data-cmd="clear" title="Clear formatting" style="font-size:11px;font-family:'DM Mono',monospace;">Clear</button>
              <button class="zen-btn" id="zenToggleBtn" title="Zen mode — distraction-free writing">
                <svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
              </button>
            </div>
            <div id="composerEditor" class="rich-editor" contenteditable="true" data-placeholder="Write your post here…"></div>
            <div class="editor-footer">
              <select id="composerChannel" class="input" style="flex:1;max-width:280px;height:30px;padding:0 30px 0 10px;font-size:12px;"></select>
              <span id="composerNoChannels" style="font-size:12px;color:var(--subtle);display:none;">↻ Load from Buffer to see channels</span>
              <span class="char-count" id="charCount">0 chars</span>
            </div>
          </div>

          <!-- Zen inline send actions (only visible in zen mode) -->
          <div id="zenActions">
            <select id="zenChannel" class="input"></select>
            <button class="btn" id="zenDraft">Save draft</button>
            <button class="btn success" id="zenQueue">Add to queue</button>
            <button class="btn primary" id="zenSchedule">📅 Schedule…</button>
          </div>

          <!-- Media toggle -->
          <div class="mt8">
            <button class="media-toggle-btn" id="mediaToggleBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><use href="#i-img"/></svg>
              Add media
            </button>
            <button class="media-toggle-btn has-media" id="mediaToggleOff" style="display:none;">
              <img id="mediaThumbPreview" src="" style="width:16px;height:16px;border-radius:2px;object-fit:cover;display:none;" alt=""/>
              <span id="mediaToggleLabel">🖼 Media attached</span>
            </button>

            <div class="media-panel" id="mediaPanel">
              <div class="card mt8" style="padding:14px;">
                <div class="media-tabs">
                  <button class="media-tab active" data-mtab="upload">Upload</button>
                  <button class="media-tab" data-mtab="url">URL</button>
                  <button class="media-tab" data-mtab="unsplash">Unsplash</button>
                </div>

                <!-- Upload tab -->
                <div class="media-tab-panel active" data-mtabpanel="upload">
                  <input type="file" id="uploadFileInput" accept="image/*,video/*" style="display:none;"/>
                  <div id="uploadZone" style="border:2px dashed var(--border2);border-radius:8px;padding:24px 16px;text-align:center;cursor:pointer;transition:all .2s;">
                    <div style="font-size:24px;margin-bottom:8px;">📎</div>
                    <div style="font-size:13px;color:var(--muted);">Drop image or <button class="btn sm ghost" id="uploadBrowseBtn" style="display:inline-flex;height:auto;padding:2px 6px;">browse</button></div>
                    <div style="font-size:11px;color:var(--subtle);margin-top:4px;font-family:'DM Mono',monospace;">JPG, PNG, GIF, WEBP · paste to upload</div>
                  </div>
                  <div id="uploadResult" style="display:none;align-items:center;gap:12px;padding:10px 0;">
                    <img id="uploadThumb" src="" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid var(--border2);flex-shrink:0;"/>
                    <div style="flex:1;min-width:0;">
                      <div id="uploadResultName" style="font-size:12px;font-weight:600;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
                      <div id="uploadResultUrl" style="font-size:11px;color:var(--green);font-family:'DM Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
                      <div style="display:flex;gap:6px;margin-top:6px;">
                        <button class="btn sm ghost" id="uploadReplaceBtn">↺ Replace</button>
                        <button class="btn sm ghost" id="uploadClearBtn">✕</button>
                      </div>
                    </div>
                  </div>
                  <div id="uploadStatus" style="font-size:11px;color:var(--muted);margin-top:6px;font-family:'DM Mono',monospace;"></div>
                </div>

                <!-- URL tab -->
                <div class="media-tab-panel" data-mtabpanel="url">
                  <div class="row mt8">
                    <input id="mediaUrlInput" class="input grow" placeholder="https://… (image or video URL)" />
                    <button class="btn sm ghost" id="mediaUrlClear" style="display:none;">✕</button>
                  </div>
                  <div id="urlPreview" style="display:none;align-items:center;gap:10px;margin-top:10px;">
                    <img id="urlPreviewImg" src="" alt="" style="width:72px;height:48px;object-fit:cover;border-radius:6px;border:1px solid var(--border2);flex-shrink:0;"/>
                    <div id="urlPreviewType" style="font-size:11px;font-family:'DM Mono',monospace;color:var(--muted);"></div>
                  </div>
                  <div id="videoThumbSection" style="display:none;margin-top:10px;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;">
                    <div class="label mb8">Custom thumbnail (optional)</div>
                    <input id="videoThumbUrl" class="input" placeholder="Thumbnail image URL…" />
                  </div>
                </div>

                <!-- Unsplash tab -->
                <div class="media-tab-panel" data-mtabpanel="unsplash">
                  <div class="row mt8">
                    <input id="unsplashQuery" class="input grow" placeholder="Search free photos…" />
                    <button class="btn sm" id="unsplashSearchBtn">Search</button>
                  </div>
                  <div id="unsplashStatus" style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;margin-top:6px;min-height:16px;"></div>
                  <div id="unsplashGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px;"></div>
                </div>
              </div>
            </div>

            <div id="mediaSummary" style="display:none;align-items:center;gap:10px;padding:8px 12px;background:var(--surface);border:1px solid var(--border2);border-radius:8px;margin-top:8px;">
              <img id="mediaSummaryThumb" src="" alt="" style="width:36px;height:24px;object-fit:cover;border-radius:4px;border:1px solid var(--border2);display:none;"/>
              <div style="flex:1;min-width:0;">
                <div id="mediaSummaryType" style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);text-transform:uppercase;"></div>
                <div id="mediaSummaryUrl" style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
              </div>
              <button class="btn sm ghost" id="mediaSummaryClear">✕ Remove</button>
            </div>
          </div>

          <div id="composerStatus" style="font-size:12px;color:var(--muted);margin-top:8px;font-family:'DM Mono',monospace;min-height:18px;"></div>
        </div>

        <!-- Right panel -->
        <div class="composer-panel">
          <!-- Send to Buffer -->
          <div class="panel-card">
            <div class="panel-card-title">Send to Buffer</div>
            <div class="send-actions">
              <button class="btn" id="composerDraft">Save draft</button>
              <button class="btn success" id="composerQueue">Add to queue</button>
              <button class="btn primary" id="composerScheduleToggle">📅 Schedule…</button>
            </div>
            <div class="schedule-row" id="schedulePanel">
              <div class="field" style="margin-bottom:8px;">
                <label class="label">Date</label>
                <input type="date" id="scheduleDate" class="input" />
              </div>
              <div class="cols2" style="gap:8px;">
                <div class="field" style="margin-bottom:0;">
                  <label class="label">Hour</label>
                  <select id="scheduleHour" class="input"></select>
                </div>
                <div class="field" style="margin-bottom:0;">
                  <label class="label">Min</label>
                  <select id="scheduleMin" class="input"></select>
                </div>
              </div>
              <div class="row">
                <select id="scheduleAmpm" class="input" style="max-width:80px;flex-shrink:0;"></select>
                <button class="btn primary grow" id="composerScheduleSend">Send</button>
                <button class="btn ghost" id="scheduleCancel">✕</button>
              </div>
            </div>
            <input type="hidden" id="composerWhen" />
          </div>

          <!-- Needs approval -->
          <div class="panel-card" id="approvalCheckPanel">
            <div class="panel-card-title">Sign-off</div>
            <label class="approval-check-row">
              <input type="checkbox" id="needsApprovalCheck" />
              <span class="approval-check-label">Needs approval before publishing</span>
            </label>
            <div style="font-size:11px;color:var(--subtle);margin-top:8px;line-height:1.55;">Save as draft first — then generate an approval link from the Approve tab.</div>
          </div>

          <!-- Content buckets quick-pick -->
          <div class="panel-card">
            <div class="panel-card-title" style="margin-bottom:8px;">Content buckets</div>
            <div id="composerBucketsList" style="display:flex;flex-direction:column;gap:6px;">
              <div style="font-size:12px;color:var(--subtle);padding:8px 0;font-family:'DM Mono',monospace;">Build your first buckets in the Tools section.</div>
            </div>
            <div class="row" style="margin-top:8px;">
              <button class="btn sm" style="flex:1;justify-content:center;" id="composerOpenBucketsBtn">Open builder</button>
              <button class="btn sm ghost" style="flex:1;justify-content:center;" id="composerInsertBucketsBtn">→ Draft ideas</button>
            </div>
          </div>

          <!-- Templates quick-pick -->
          <div class="panel-card">
            <div class="panel-card-title" style="margin-bottom:8px;">Templates</div>
            <div class="template-list" id="composerTemplateList">
              <div style="font-size:12px;color:var(--subtle);padding:8px 0;font-family:'DM Mono',monospace;">No templates yet.</div>
            </div>
            <button class="btn sm ghost" style="width:100%;margin-top:8px;justify-content:center;" onclick="activateView('templatesView')">Manage templates →</button>
          </div>
        </div>

        </div><!-- /composeModePanel -->

        <!-- ── SPLIT MODE (Thread Splitter) ── -->
        <div id="splitModePanel" style="display:none;grid-column:1/-1;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;" id="splitGrid">
            <!-- Source -->
            <div>
              <div class="card">
                <div style="font-size:11px;font-family:'DM Mono',monospace;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:10px;">Source text</div>
                <textarea id="threadInput" placeholder="Paste long-form content, notes, or a rough draft…" style="min-height:200px;"></textarea>
                <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                  <button class="btn primary" id="splitBtn">Split thread</button>
                  <button class="btn ghost" id="splitSampleBtn">Sample</button>
                  <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);margin-left:auto;cursor:pointer;">
                    <input type="checkbox" id="threadNumberToggle" style="accent-color:var(--brand);" /> Number parts
                  </label>
                </div>
              </div>
            </div>
            <!-- Output -->
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
                <div style="font-size:11px;font-family:'DM Mono',monospace;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);">Thread parts</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                  <button class="btn sm ghost" id="copyAllPartsBtn">Copy all</button>
                  <select id="threadChannel" class="input" style="max-width:180px;height:30px;padding:0 28px 0 10px;font-size:12px;"></select>
                </div>
              </div>
              <div id="threadEmpty" class="empty-state">
                <div class="empty-icon">✂️</div>
                <div class="empty-title">Nothing split yet</div>
                <div class="empty-desc">Paste content on the left and hit Split thread.</div>
              </div>
              <div id="threadOut" style="display:flex;flex-direction:column;gap:8px;"></div>
              <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;" id="threadActions" style="display:none;">
                <button class="btn" id="draftThreadBtn">Save draft</button>
                <button class="btn success" id="queueThreadBtn">Add to queue</button>
                <button class="btn primary" id="scheduleThreadBtn">📅 Schedule…</button>
              </div>
              <div id="threadWhenRow" style="display:none;margin-top:8px;">
                <input type="datetime-local" id="threadWhen" class="input" />
              </div>
              <div id="threadStatus" style="font-size:12px;color:var(--muted);margin-top:8px;font-family:'DM Mono',monospace;min-height:16px;"></div>
            </div>
          </div>
          <!-- Mobile: stacked -->
          <style>@media(max-width:768px){#splitGrid{grid-template-columns:1fr;}}</style>
        </div>

      </div><!-- /composer-layout -->
    </section>

    <!-- ══════════ APPROVE (Approvals) ══════════ -->
    <section id="approvalsView" class="view">
      <!-- Mobile header -->
      <div class="mob-view-hdr">
        <span class="mob-view-title">✅ Approve</span>
        <div class="mob-view-actions">
          <button class="btn sm ghost" id="approvalsRefreshBtnMob">↻</button>
          <button class="btn sm ghost" id="mobMenuBtnApprovals">
            <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
        </div>
      </div>
      <!-- Desktop header -->
      <div class="page-hdr">
        <div class="page-hdr-left">
          <h1 class="page-title">Approve</h1>
          <p class="page-desc">Route content through sign-off before it goes live. Generate a reviewer link, collect feedback, then publish when approved.</p>
        </div>
        <div class="page-actions">
          <button class="btn" id="approvalsRefreshBtn">↻ Refresh</button>
        </div>
      </div>

      <div class="view-content">
      <div class="approvals-filter-row">
        <span class="filter-label">Filter:</span>
        <button class="filter-pill active" data-afilter="all">All</button>
        <button class="filter-pill" data-afilter="pending">⏳ Pending</button>
        <button class="filter-pill" data-afilter="approved">✓ Approved</button>
        <button class="filter-pill" data-afilter="changes">✎ Changes</button>
      </div>

      <div id="approvalsEmpty" class="empty-state" style="display:none;">
        <div class="empty-icon">✅</div>
        <div class="empty-title">No pending approvals</div>
        <div class="empty-desc">Save a draft with "Needs approval" checked in the Draft tab, then come here to generate a reviewer link.</div>
      </div>
      <div id="approvalsList"></div>
      </div><!-- /view-content -->
    </section>

    <!-- ══════════ CONTENT BUCKETS ══════════ -->
    <section id="contentBucketsView" class="view">
      <div class="mob-view-hdr">
        <span class="mob-view-title">🧠 Content Buckets</span>
        <div class="mob-view-actions">
          <button class="btn sm ghost" id="contentBucketsResetMob">Reset</button>
        </div>
      </div>
      <div class="page-hdr">
        <div class="page-hdr-left">
          <h1 class="page-title">Content Buckets</h1>
          <p class="page-desc">Find repeatable content lanes, save them locally, then pull ideas straight into Draft. This tool works without a Buffer key.</p>
        </div>
        <div class="page-actions">
          <span class="status-pill free">No key required</span>
          <button class="btn ghost" id="contentBucketsResetBtn">Reset</button>
        </div>
      </div>
      <div class="view-content">
        <div class="card" style="margin-bottom:16px;">
          <div class="cols2">
            <div class="field">
              <label class="label">Role / lens</label>
              <select id="bucketRoleSelect" class="input"></select>
            </div>
            <div class="field">
              <label class="label">Audience</label>
              <input id="bucketAudienceInput" class="input" placeholder="Who are you trying to help or reach?" />
            </div>
          </div>
          <div style="font-size:13px;color:var(--muted);line-height:1.65;">Start with five simple content types: <strong>Teach</strong>, <strong>Share</strong>, <strong>Show</strong>, <strong>Tell</strong>, and <strong>Prove</strong>. Use the examples below to name your own buckets and save starter ideas.</div>
        </div>

        <div id="bucketCards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;"></div>

        <div class="card mt16">
          <div class="section-hdr">
            <div class="section-title">Your saved lanes</div>
            <div class="row">
              <button class="btn sm" id="bucketComposeAllBtn">→ Send all to Draft</button>
              <button class="btn sm ghost" id="bucketCopyPromptBtn">Copy AI prompt</button>
            </div>
          </div>
          <div id="bucketSavedSummary" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>
      </div>
    </section>

    <!-- ══════════ TEMPLATES ══════════ -->
    <section id="templatesView" class="view">
      <!-- Mobile header -->
      <div class="mob-view-hdr">
        <span class="mob-view-title">⚡ Templates</span>
        <div class="mob-view-actions">
          <button class="btn sm primary" id="newTemplateBtnMob">+ New</button>
        </div>
      </div>
      <!-- Desktop header -->
      <div class="page-hdr">
        <div class="page-hdr-left">
          <h1 class="page-title">Templates</h1>
          <p class="page-desc">Reusable draft starters — hooks, CTAs, announcements. Insert into Draft with one click.</p>
        </div>
        <div class="page-actions">
          <button class="btn primary" id="newTemplateBtn">+ New Template</button>
        </div>
      </div>

      <div class="view-content">
      <div class="templates-layout">
        <div class="templates-sidebar" id="templateTypeFilters"></div>
        <div>
          <div class="row mb8">
            <input id="templateSearch" class="input grow" placeholder="Search templates…" />
            <select id="templatePlatformFilter" class="input" style="max-width:160px;"></select>
          </div>
          <div id="templatesEmpty" class="empty-state" style="display:none;">
            <div class="empty-icon">⚡</div>
            <div class="empty-title">No templates yet</div>
            <div class="empty-desc">Create your first template to reuse hooks, CTAs, and openers across every post you write.</div>
          </div>
          <div class="templates-grid" id="templatesGrid"></div>
        </div>
      </div>
      </div><!-- /view-content -->
    </section>

    <!-- ══════════ TRENDING ══════════ -->
    <section id="trendingView" class="view">
      <div class="mob-view-hdr">
        <span class="mob-view-title">📈 Trending</span>
        <div class="mob-view-actions">
          <button class="btn sm ghost" id="trendingRefreshMob">↻</button>
        </div>
      </div>
      <div class="page-hdr">
        <div class="page-hdr-left">
          <h1 class="page-title">Trending</h1>
          <p class="page-desc">What's hot on Reddit and Hacker News right now. Click any story to open it in Draft.</p>
        </div>
        <div class="page-actions">
          <button class="btn ghost" id="trendingRefreshBtn">↻ Refresh</button>
        </div>
      </div>
      <div class="view-content">

        <!-- Source tabs -->
        <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:16px;">
          <button class="trending-src-tab active" data-tsrc="reddit" style="padding:8px 18px;border:none;background:transparent;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;font-family:'Lato',sans-serif;transition:all .12s;">Reddit</button>
          <button class="trending-src-tab" data-tsrc="hn" style="padding:8px 18px;border:none;background:transparent;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;font-family:'Lato',sans-serif;transition:all .12s;">Hacker News</button>
        </div>

        <!-- Reddit panel -->
        <div id="trendingRedditPanel">
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
            <div id="trendingSubPills" style="display:flex;gap:5px;flex-wrap:wrap;flex:1;"></div>
            <div style="display:flex;gap:6px;">
              <input id="trendingCustomSub" class="input" placeholder="r/custom" style="width:130px;" />
              <button class="btn sm" id="trendingGoSub">Go</button>
              <button class="btn sm ghost" id="trendingRefreshReddit">↻</button>
            </div>
          </div>
          <div id="trendingRedditStatus" style="font-size:12px;color:var(--muted);font-family:'DM Mono',monospace;margin-bottom:10px;min-height:16px;"></div>
          <div id="trendingRedditList" style="display:flex;flex-direction:column;gap:6px;"></div>
        </div>

        <!-- HN panel -->
        <div id="trendingHNPanel" style="display:none;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
            <div style="display:flex;gap:5px;">
              <button class="trending-hn-tab active" data-hn="topstories" style="padding:5px 12px;border-radius:20px;border:1px solid var(--border2);background:var(--brand-dim);color:var(--brand);font-size:12px;font-family:'DM Mono',monospace;cursor:pointer;">Top</button>
              <button class="trending-hn-tab" data-hn="newstories" style="padding:5px 12px;border-radius:20px;border:1px solid var(--border2);background:var(--surface);color:var(--muted);font-size:12px;font-family:'DM Mono',monospace;cursor:pointer;">New</button>
              <button class="trending-hn-tab" data-hn="beststories" style="padding:5px 12px;border-radius:20px;border:1px solid var(--border2);background:var(--surface);color:var(--muted);font-size:12px;font-family:'DM Mono',monospace;cursor:pointer;">Best</button>
            </div>
            <button class="btn sm ghost" id="trendingRefreshHN" style="margin-left:auto;">↻</button>
          </div>
          <div id="trendingHNStatus" style="font-size:12px;color:var(--muted);font-family:'DM Mono',monospace;margin-bottom:10px;min-height:16px;"></div>
          <div id="trendingHNList" style="display:flex;flex-direction:column;gap:6px;"></div>
        </div>

      </div><!-- /view-content -->
    </section>

  </main>
</section>

<!-- ── MODALS ── -->

<!-- Settings modal -->
<div id="settingsModal" class="modal">
  <div class="modal-card" style="max-width:580px;">
    <div class="modal-hdr">
      <span class="modal-title">Settings &amp; Help</span>
      <button class="btn sm ghost" id="closeSettings">Close</button>
    </div>
    <div class="settings-tabs">
      <button class="settings-tab active" data-stab="guide">Guide</button>
      <button class="settings-tab" data-stab="about">About</button>
    </div>
    <div id="settingsPanelGuide" class="settings-panel active">
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div>
          <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:14px;margin-bottom:6px;">📅 Plan</div>
          <p style="font-size:13px;color:var(--muted);line-height:1.65;">See your Buffer queue in a monthly calendar. Click any day to add a color-tagged planning note. The gap detector highlights days with nothing scheduled so you know where to focus your drafting sessions.</p>
        </div>
        <div>
          <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:14px;margin-bottom:6px;">✍️ Draft</div>
          <p style="font-size:13px;color:var(--muted);line-height:1.65;">Write posts in a focused editor, pull in a template, attach media via upload or URL, then send to Buffer as a draft, queued post, or scheduled post. Check "Needs approval" before saving a draft to route it through sign-off.</p>
        </div>
        <div>
          <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:14px;margin-bottom:6px;">✅ Approve</div>
          <p style="font-size:13px;color:var(--muted);line-height:1.65;">Generate a shareable reviewer link for any pending draft. The reviewer opens the link, reads the content, leaves a comment, and approves or requests changes. Once approved, you publish directly to Buffer from here.</p>
        </div>
        <div>
          <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:14px;margin-bottom:6px;">⚡ Templates</div>
          <p style="font-size:13px;color:var(--muted);line-height:1.65;">Save reusable draft starters — product announcement formats, engagement questions, stat callouts. Insert any template into the Draft editor with one click. Select text in the editor and hit "+ Save" to create a template from it.</p>
        </div>
        <div>
          <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:14px;margin-bottom:6px;">🔑 Connecting Buffer</div>
          <p style="font-size:13px;color:var(--muted);line-height:1.65;">Get your token at buffer.com/developers. Paste it in the token panel — choose Session (clears on close) or Local (persists between visits). Hit "Load from Buffer" to sync your channels and scheduled posts. Your token never leaves your device.</p>
        </div>
      </div>
    </div>
    <div id="settingsPanelAbout" class="settings-panel">
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:14px;">
        <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:16px;margin-bottom:8px;color:var(--ink);">PostIQ — Buffer Companion</div>
        <p style="font-size:13px;color:var(--muted);line-height:1.65;margin-bottom:12px;">The planning and approval layer for Buffer. Plan your queue, draft posts with templates, get sign-off before publishing.</p>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:16px;">
        <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:15px;margin-bottom:4px;color:var(--ink);">Built by Ben Campbell</div>
        <p style="font-size:13px;color:var(--muted);line-height:1.65;margin-bottom:12px;">Social strategist and content builder. Grew a social account to 6M+ followers. Now building tools for serious Buffer users.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a href="https://bencampbell.netlify.app/" target="_blank" rel="noopener" class="btn primary">My work</a>
          <a href="https://www.linkedin.com/in/bencampbell8/" target="_blank" rel="noopener" class="btn">LinkedIn</a>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Day note modal -->
<div id="noteModal" class="modal">
  <div class="modal-card">
    <div class="modal-hdr">
      <span class="modal-title" id="noteDateLabel">—</span>
      <button class="btn sm ghost" id="closeNote">Close</button>
    </div>
    <div id="dayPostPreview" class="mb8"></div>
    <div class="field">
      <label class="label">Planning note</label>
      <textarea id="noteText" placeholder="What do you want to post on this day?" style="min-height:80px;"></textarea>
    </div>
    <div class="field">
      <label class="label">Tag</label>
      <select id="noteTag" class="input">
        <option value="gold|Idea">💛 Idea</option>
        <option value="blue|Draft">💙 Draft</option>
        <option value="green|Campaign">💚 Campaign</option>
        <option value="violet|Priority">💜 Priority</option>
      </select>
    </div>
    <div class="row">
      <button class="btn primary" id="saveNoteBtn">Save note</button>
      <button class="btn" id="sendNoteToDraftBtn">Use in Draft</button>
      <button class="btn ghost" id="deleteNoteBtn">Delete</button>
    </div>
    <div id="noteStatus" style="font-size:12px;color:var(--muted);margin-top:8px;font-family:'DM Mono',monospace;min-height:16px;"></div>
  </div>
</div>

<!-- Template modal -->
<div id="templateModal" class="modal">
  <div class="modal-card lg">
    <div class="modal-hdr">
      <span class="modal-title" id="templateModalTitle">New Template</span>
      <button class="btn sm ghost" id="closeTemplateModal">Close</button>
    </div>
    <div class="field">
      <label class="label">Title</label>
      <input id="templateTitle" class="input" placeholder="e.g. Product announcement hook" />
    </div>
    <div class="cols2">
      <div class="field">
        <label class="label">Type</label>
        <select id="templateType" class="input"></select>
      </div>
      <div class="field">
        <label class="label">Platform</label>
        <select id="templatePlatform" class="input"></select>
      </div>
    </div>
    <div class="field">
      <label class="label">Tags (comma-separated)</label>
      <input id="templateTags" class="input" placeholder="launch, b2b, hook" />
    </div>
    <div class="field">
      <label class="label">Content</label>
      <textarea id="templateBody" placeholder="Write your reusable template content…" style="min-height:140px;"></textarea>
    </div>
    <div class="row">
      <button class="btn primary" id="saveTemplateBtn">Save template</button>
      <button class="btn ghost" id="cancelTemplateBtn">Cancel</button>
    </div>
  </div>
</div>

<!-- Template picker modal -->
<div id="templatePickerModal" class="modal">
  <div class="modal-card lg">
    <div class="modal-hdr">
      <span class="modal-title">Insert template</span>
      <button class="btn sm ghost" id="closeTemplatePicker">Close</button>
    </div>
    <div class="row mb8">
      <input id="pickerSearch" class="input grow" placeholder="Search templates…" />
      <select id="pickerType" class="input" style="max-width:140px;"></select>
    </div>
    <div id="pickerList" style="display:flex;flex-direction:column;gap:6px;max-height:55vh;overflow-y:auto;"></div>
    <div id="pickerEmpty" class="empty-state" style="display:none;margin-top:16px;">
      <div class="empty-icon">⚡</div>
      <div class="empty-title">No templates found</div>
    </div>
  </div>
</div>

<!-- Share modal -->
<div id="shareModal" class="modal">
  <div class="modal-card">
    <div class="modal-hdr">
      <span class="modal-title">Share read-only snapshot</span>
      <button class="btn sm ghost" id="closeShare">Close</button>
    </div>
    <div class="card mb8">
      <div style="font-size:13px;color:var(--muted);">Month: <strong style="color:var(--text)" id="shareMonthName"></strong></div>
      <div style="font-size:13px;color:var(--muted);margin-top:6px;">Posts: <strong style="color:var(--text)" id="sharePostCount">0</strong></div>
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer;font-size:13px;color:var(--muted);">
        <input type="checkbox" id="includeNotes" checked /> Include planning notes
      </label>
      <div style="font-size:12px;color:var(--subtle);margin-top:8px;line-height:1.55;">Shared snapshots now carry the full post text and full planning notes. Recipients can click a day to open the details.</div>
    </div>
    <div class="row mt8">
      <button class="btn primary" id="generateShare">Generate link</button>
      <button class="btn" id="copyShare">Copy link</button>
    </div>
    <input id="shareLink" class="input mt8 mono" readonly placeholder="Link will appear here…" style="font-size:11px;" />
  </div>
</div>

<!-- ── MOBILE DRAWER (token + sync) ── -->
<div class="mob-backdrop" id="mobBackdrop"></div>
<div class="mob-drawer" id="mobDrawer">
  <div class="mob-drawer-handle"></div>
  <div class="mob-drawer-title">PostIQ <span class="logo-beta">Beta</span></div>

  <!-- Connection status -->
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
    <div class="conn-dot" id="mobConnDot"></div>
    <span style="font-size:13px;color:var(--muted);font-family:'DM Mono',monospace;" id="mobConnLabel">Not connected</span>
  </div>

  <!-- Sync button -->
  <button class="btn" id="mobSyncBtn" style="width:100%;justify-content:center;margin-bottom:6px;">↻ Load from Buffer</button>
  <div id="mobSyncStatus" style="font-size:11px;color:var(--subtle);font-family:'DM Mono',monospace;margin-bottom:14px;min-height:14px;"></div>

  <div style="height:1px;background:var(--border);margin-bottom:14px;"></div>

  <!-- Token management -->
  <div style="margin-bottom:4px;">
    <button class="btn ghost" id="mobManageTokenBtn" style="width:100%;justify-content:flex-start;font-size:13px;color:var(--muted);">🔑 Manage Buffer token</button>
  </div>
  <div id="mobTokenPanel" style="display:none;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);margin-top:8px;">
    <div class="field">
      <label class="label">Buffer API token</label>
      <input id="mobTokenInput" class="input mono" type="password" placeholder="Paste token…" />
    </div>
    <div style="display:flex;gap:14px;margin-bottom:10px;">
      <label style="font-size:12px;color:var(--muted);cursor:pointer;display:flex;align-items:center;gap:4px;"><input type="radio" name="mobTokenMode" value="session" checked /> Session</label>
      <label style="font-size:12px;color:var(--muted);cursor:pointer;display:flex;align-items:center;gap:4px;"><input type="radio" name="mobTokenMode" value="local" /> Save locally</label>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn sm primary" id="mobSaveTokenBtn">Save</button>
      <button class="btn sm ghost" id="mobClearTokenBtn">Remove</button>
    </div>
    <div id="mobTokenMsg" style="font-size:11px;color:var(--muted);margin-top:6px;font-family:'DM Mono',monospace;min-height:14px;"></div>
  </div>

  <div style="height:1px;background:var(--border);margin:14px 0;"></div>

  <!-- Quick links -->
  <a class="btn ghost" href="https://publish.buffer.com/" target="_blank" rel="noopener" style="width:100%;justify-content:flex-start;font-size:13px;color:var(--muted);margin-bottom:4px;">↗ Open Buffer</a>
  <button class="btn ghost" data-view="contentBucketsView" id="mobDrawerBucketsBtn" style="width:100%;justify-content:flex-start;font-size:13px;color:var(--muted);margin-bottom:4px;">🧠 Content Buckets</button>
  <button class="btn ghost" data-view="trendingView" id="mobDrawerTrendingBtn" style="width:100%;justify-content:flex-start;font-size:13px;color:var(--muted);margin-bottom:4px;">📈 Trending</button>
  <button class="btn ghost" data-view="templatesView" id="mobDrawerTemplatesBtn" style="width:100%;justify-content:flex-start;font-size:13px;color:var(--muted);margin-bottom:4px;">⚡ Templates</button>
  <button class="btn ghost" id="mobOpenSettings" style="width:100%;justify-content:flex-start;font-size:13px;color:var(--muted);">⚙ Settings &amp; Help</button>
</div>

<!-- Zen exit button (floats bottom-right when zen is active) -->
<button id="zenExit">Esc · Exit zen</button>

<!-- Toast container -->
<div id="toastWrap" class="toast-wrap" aria-live="polite"></div>

<!-- Shared view (read-only snapshot) -->
<section id="sharedView" class="hidden" style="max-width:980px;margin:0 auto;padding:28px;">
  <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:22px;margin-bottom:20px;color:var(--ink);">PostIQ</div>
  <div id="sharedBanner" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:12px 16px;font-size:13px;color:var(--muted);margin-bottom:20px;"></div>
  <h2 id="sharedMonthTitle" style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:22px;margin-bottom:16px;"></h2>
  <p style="font-size:12px;color:var(--muted);margin-bottom:16px;">Read-only planning snapshot. Click any shared day to open the full post text and notes.</p>
  <div class="cal-dow">
    <div class="dow-cell">Sun</div><div class="dow-cell">Mon</div><div class="dow-cell">Tue</div>
    <div class="dow-cell">Wed</div><div class="dow-cell">Thu</div><div class="dow-cell">Fri</div><div class="dow-cell">Sat</div>
  </div>
  <div id="sharedGrid" class="cal-grid" style="margin-top:4px;"></div>
</section>

<div id="sharedDayModal" class="modal">
  <div class="modal-card lg">
    <div class="modal-hdr">
      <span class="modal-title" id="sharedDayTitle">Snapshot details</span>
      <button class="btn sm ghost" id="closeSharedDay">Close</button>
    </div>
    <div id="sharedDayBody" style="display:flex;flex-direction:column;gap:10px;"></div>
  </div>
</div>

<!-- Reviewer page -->
<div id="reviewerPage">
  <div class="reviewer-wrap">
    <div class="reviewer-brand">
      PostIQ <span class="logo-beta">Review</span>
    </div>
    <div id="reviewerLoading" class="reviewer-card" style="text-align:center;padding:48px 20px;color:var(--subtle);font-family:'DM Mono',monospace;font-size:13px;">
      Loading review request…
    </div>
    <div id="reviewerContent" style="display:none;"></div>
    <div id="reviewerConfirmed" style="display:none;">
      <div class="reviewer-card" style="text-align:center;padding:48px 20px;">
        <div id="reviewerConfirmIcon" style="font-size:48px;margin-bottom:16px;"></div>
        <div id="reviewerConfirmTitle" style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:24px;margin-bottom:10px;"></div>
        <p id="reviewerConfirmDesc" style="font-size:15px;color:var(--muted);line-height:1.6;max-width:400px;margin:0 auto;"></p>
      </div>
    </div>
    <div id="reviewerError" style="display:none;">
      <div class="reviewer-card" style="text-align:center;padding:48px 20px;">
        <div style="font-size:40px;margin-bottom:16px;">🔍</div>
        <div id="reviewerErrorMsg" style="font-size:14px;color:var(--muted);line-height:1.6;"></div>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════
     JAVASCRIPT
     ══════════════════════════════════ -->
<script>
'use strict';

// ── CONSTANTS ──────────────────────────────────────
const STORE_KEY       = 'postiq_buffer_token';
const NOTE_KEY        = 'postiq_calendar_notes_v2';
const TEMPLATE_KEY    = 'postiq_templates_v1';
const BUCKET_KEY      = 'postiq_content_buckets_v1';
const CACHE_KEY       = 'postiq_buffer_cache_v1';
const APPROVAL_PREFIX = 'postiq_approval_';

const IMGUR_KEY    = '546c25a59c58ad7';
const UNSPLASH_KEY = 'tBuaYCO5p-pJPjgF29hR2yJGtlQaG4d5HqdVivV0lbQ';

const TEMPLATE_TYPES     = ['All','Hooks','CTAs','Announcements','Engagement','Hashtag Sets'];
const TEMPLATE_PLATFORMS = ['All Platforms','LinkedIn','X','Threads','Instagram','Universal'];

// ── STATE ──────────────────────────────────────────
let bufferToken = '';
let currentViewId = 'calendarView';
let tokenPanelOpen = false;
let modalCount = 0;

const state = {
  channels: [],
  scheduled: [],
  month: new Date(),
  selectedDate: null,
  syncState: 'idle',
  templates: [],
  templateType: 'All',
  templatePlatform: 'All Platforms',
  templateSearch: '',
  editingTemplateId: null,
  organizationId: null,
  bucketRole: 'creator',
  bucketAudience: '',
  contentBuckets: [],
};

const mediaState = { url: '', type: '', videoThumbUrl: '', source: '' };

// Cache layer
const cache = {
  orgId:     { value: null, ts: 0 },
  channels:  { value: [], ts: 0 },
  scheduled: { value: [], ts: 0 },
};
const CACHE_TTL = { orgId: 86400000, channels: 86400000, scheduled: 600000 };

// ── UTILITIES ──────────────────────────────────────
const qs = id => document.getElementById(id);
const fmtDate = d => d.toISOString().slice(0, 10);
const monthLabel = d => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const monthStart = d => new Date(d.getFullYear(), d.getMonth(), 1);
const safeText = v => String(v || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const compact = (v, max = 80) => { const t = String(v || '').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; };
const normTags = v => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : String(v || '').split(',').map(x => x.trim()).filter(Boolean);
const isVideo = url => /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(String(url || ''));
const maskToken = t => !t ? '—' : t.length <= 8 ? '••••' : `${t.slice(0,4)}••••${t.slice(-4)}`;


function safeGetStorage(kind) {
  try { return kind === 'session' ? window.sessionStorage : window.localStorage; }
  catch { return null; }
}
function lsGet(key){ const s=safeGetStorage('local'); try { return s ? s.getItem(key) : null; } catch { return null; } }
function lsSet(key,val){ const s=safeGetStorage('local'); try { if (s) s.setItem(key,val); } catch {} }
function lsRemove(key){ const s=safeGetStorage('local'); try { if (s) s.removeItem(key); } catch {} }
function lsKey(i){ const s=safeGetStorage('local'); try { return s ? s.key(i) : null; } catch { return null; } }
function lsLength(){ const s=safeGetStorage('local'); try { return s ? s.length : 0; } catch { return 0; } }
function ssGet(key){ const s=safeGetStorage('session'); try { return s ? s.getItem(key) : null; } catch { return null; } }
function ssSet(key,val){ const s=safeGetStorage('session'); try { if (s) s.setItem(key,val); } catch {} }
function ssRemove(key){ const s=safeGetStorage('session'); try { if (s) s.removeItem(key); } catch {} }

function showToast(msg, type = '') {
  const wrap = qs('toastWrap'); if (!wrap) return;
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  wrap.appendChild(t);
  const delay = msg.length > 40 ? 3800 : 2600;
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, delay);
}

function openModal(id) {
  const el = qs(id); if (!el || el.classList.contains('open')) return;
  el.classList.add('open'); modalCount++;
  if (modalCount > 0) document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  const el = qs(id); if (!el || !el.classList.contains('open')) return;
  el.classList.remove('open'); modalCount = Math.max(0, modalCount - 1);
  if (modalCount === 0) document.body.style.overflow = '';
}

// ── APPROVAL METADATA (localStorage) ──────────────
function getApprovalMeta(draftId) {
  try { const r = lsGet(APPROVAL_PREFIX + draftId); return r ? JSON.parse(r) : null; } catch { return null; }
}
function setApprovalMeta(draftId, data) { try { lsSet(APPROVAL_PREFIX + draftId, JSON.stringify(data)); } catch {} }
function clearApprovalMeta(draftId) { try { lsRemove(APPROVAL_PREFIX + draftId); } catch {} }
function getAllApprovalMetas() {
  const result = [];
  try {
    for (let i = 0; i < lsLength(); i++) {
      const key = lsKey(i);
      if (key && key.startsWith(APPROVAL_PREFIX)) {
        const draftId = key.slice(APPROVAL_PREFIX.length);
        const meta = getApprovalMeta(draftId);
        if (meta && meta.needs_approval) result.push({ draftId, ...meta });
      }
    }
  } catch {}
  return result;
}

// ── TEMPLATES ──────────────────────────────────────
function loadTemplates() {
  try {
    const raw = lsGet(TEMPLATE_KEY);
    if (!raw) { state.templates = []; return; }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) { state.templates = []; return; }
    state.templates = parsed.map((s, i) => ({
      id: String(s.id || `${Date.now()}-${i}`),
      title: String(s.title || 'Untitled'),
      type: TEMPLATE_TYPES.includes(s.type) ? s.type : 'Hooks',
      platform: TEMPLATE_PLATFORMS.includes(s.platform) ? s.platform : 'Universal',
      tags: normTags(s.tags),
      body: String(s.body || ''),
      createdAt: String(s.createdAt || new Date().toISOString()),
      updatedAt: String(s.updatedAt || new Date().toISOString()),
    }));
  } catch { state.templates = []; }
}
function persistTemplates() { try { lsSet(TEMPLATE_KEY, JSON.stringify(state.templates)); } catch {} }

function filteredTemplates(search = state.templateSearch, type = state.templateType, platform = state.templatePlatform) {
  const q = search.trim().toLowerCase();
  return state.templates.filter(s => {
    const typeOk = type === 'All' || s.type === type;
    const platOk = platform === 'All Platforms' || s.platform === platform;
    const txt = `${s.title} ${s.body} ${(s.tags || []).join(' ')}`.toLowerCase();
    return typeOk && platOk && (!q || txt.includes(q));
  });
}

function renderTemplateTypeFilters() {
  const rail = qs('templateTypeFilters'); rail.innerHTML = '';
  TEMPLATE_TYPES.forEach(type => {
    const count = type === 'All' ? state.templates.length : state.templates.filter(s => s.type === type).length;
    const b = document.createElement('button');
    b.className = `type-filter-btn ${state.templateType === type ? 'active' : ''}`;
    b.innerHTML = `<span>${type}</span><span class="type-filter-count">${count || ''}</span>`;
    b.onclick = () => { state.templateType = type; renderTemplates(); };
    rail.appendChild(b);
  });
}

function renderTemplates() {
  renderTemplateTypeFilters();
  const list = filteredTemplates();
  const grid = qs('templatesGrid');
  qs('templatesEmpty').style.display = list.length ? 'none' : 'flex';
  grid.innerHTML = '';
  list.forEach(s => {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `
      <div class="template-card-hdr">
        <div class="template-card-title">${safeText(s.title)}</div>
        <div style="display:flex;gap:3px;flex-shrink:0;">
          <span class="chip">${safeText(s.type)}</span>
          <span class="chip">${safeText(s.platform)}</span>
        </div>
      </div>
      <div class="template-card-body">${safeText(s.body)}</div>
      ${s.tags?.length ? `<div class="template-card-tags">${safeText(s.tags.join(' · '))}</div>` : ''}
      <div class="template-card-actions">
        <button class="btn sm" data-act="copy">Copy</button>
        <button class="btn sm primary" data-act="use">→ Draft</button>
        <button class="btn sm ghost" data-act="edit" style="margin-left:auto;">✏️</button>
        <button class="btn sm ghost" data-act="del">🗑</button>
      </div>`;
    card.querySelector('[data-act="copy"]').onclick = () => { navigator.clipboard.writeText(s.body || ''); showToast('Copied'); };
    card.querySelector('[data-act="use"]').onclick  = () => { activateView('composerView'); useTemplateInEditor(s); };
    card.querySelector('[data-act="edit"]').onclick = () => openTemplateModal(s.id);
    card.querySelector('[data-act="del"]').onclick  = () => deleteTemplate(s.id);
    grid.appendChild(card);
  });
  renderComposerTemplateSidebar();
}

function renderComposerTemplateSidebar() {
  const list = qs('composerTemplateList'); if (!list) return;
  const items = state.templates.slice(0, 8);
  if (!items.length) { list.innerHTML = '<div style="font-size:12px;color:var(--subtle);padding:8px 0;font-family:\'DM Mono\',monospace;">No templates yet.</div>'; return; }
  list.innerHTML = '';
  items.forEach(s => {
    const el = document.createElement('div');
    el.className = 'template-item';
    el.innerHTML = `<div class="template-item-title">${safeText(s.title)}</div><div class="template-item-preview">${safeText(compact(s.body, 70))}</div>`;
    el.onclick = () => useTemplateInEditor(s);
    list.appendChild(el);
  });
}

function useTemplateInEditor(template) {
  const editor = qs('composerEditor'); if (!editor) return;
  const body = template.body || '';
  try {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      sel.deleteFromDocument();
      sel.getRangeAt(0).insertNode(document.createTextNode(body));
    } else {
      editor.innerText = editor.innerText ? `${editor.innerText}

${body}` : body;
    }
  } catch { editor.innerText = editor.innerText ? `${editor.innerText}

${body}` : body; }
  editor.dispatchEvent(new Event('input'));
  editor.focus();
  showToast('Template inserted', 'success');
}



const BUCKET_GUIDES = {
  creator: {
    label: 'Creator',
    examples: {
      Teach: ['How you approach content planning without burning out','Mistakes creators make when they only chase trends','Simple ways to turn one idea into a week of posts'],
      Share: ['Platform shifts you are noticing','What content is getting ignored that deserves more love','Resources or tools you actually use'],
      Show: ['How you capture ideas before they disappear','Your rough drafting workflow','Behind the scenes of building content'],
      Tell: ['A lesson you learned from a post that flopped','Why you create in the first place','A hot take about creator culture'],
      Prove: ['A win you are proud of','Feedback from a client or community member','Numbers or outcomes that show your work matters']
    }
  },
  founder: {
    label: 'Founder',
    examples: {
      Teach: ['What customers misunderstand about your product category','Lessons from building in public','How you make decisions with limited time'],
      Share: ['Patterns you are seeing in your market','Useful resources for early builders','What people should know before buying'],
      Show: ['What shipping a feature actually looks like','Your weekly planning process','How you capture customer feedback'],
      Tell: ['Why you started the company','A mistake that changed your thinking','What building while uncertain feels like'],
      Prove: ['Customer wins','Product traction moments','Testimonials, screenshots, or milestones']
    }
  },
  small_business_owner: {
    label: 'Small Business Owner',
    examples: {
      Teach: ['What customers should know before hiring you','Common mistakes in your industry','Small tips that save people time or money'],
      Share: ['Seasonal reminders','Helpful local info','What customers often overlook'],
      Show: ['Behind the scenes of a normal workday','What goes into your service','Prep, tools, and routines'],
      Tell: ['Why you started the business','What quality means to you','A memorable customer story'],
      Prove: ['Reviews and testimonials','Before-and-after stories','Wins you are proud of']
    }
  },
  freelancer: {
    label: 'Freelancer / Consultant',
    examples: {
      Teach: ['Mistakes clients make before hiring help','How good strategy actually works','What you wish more people knew before a project starts'],
      Share: ['Trends in your niche','Helpful tools and frameworks','Questions clients should ask sooner'],
      Show: ['Your workflow from kickoff to delivery','How you organize projects','What your week actually looks like'],
      Tell: ['Why you chose freelance life','Lessons learned the hard way','A project that changed how you work'],
      Prove: ['Case-study style results','Client praise','Repeat business and outcomes']
    }
  },
  nurse: {
    label: 'Nurse',
    examples: {
      Teach: ['What patients should know before appointments','Common health myths','Questions people should ask more often'],
      Share: ['Helpful resources families miss','What people misunderstand about healthcare','Trends you notice in patient care'],
      Show: ['What a shift really looks like','Tools and routines that keep you organized','What people never see behind the scenes'],
      Tell: ['Why you became a nurse','A lesson the job taught you','A moment that changed your perspective'],
      Prove: ['Skills and certifications','Positive feedback','Moments where your care made a difference']
    }
  }
};
const BUCKET_TYPES = [
  { key:'Teach', desc:'What can you help people understand or do better?', prompt:'What do people ask you about all the time?' },
  { key:'Share', desc:'What should people know, notice, or pay attention to?', prompt:'What trends, resources, or reminders do you keep coming back to?' },
  { key:'Show', desc:'What does your work or process actually look like?', prompt:'What does your behind-the-scenes reality look like?' },
  { key:'Tell', desc:'What stories, opinions, or lessons can you share?', prompt:'What experience shaped how you do things now?' },
  { key:'Prove', desc:'What builds trust and shows your work matters?', prompt:'What results, reviews, or wins can you point to?' }
];

function loadBuckets() {
  try {
    const raw = lsGet(BUCKET_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.role) state.bucketRole = parsed.role;
    if (parsed?.audience) state.bucketAudience = parsed.audience;
    if (Array.isArray(parsed?.buckets)) state.contentBuckets = parsed.buckets;
  } catch {}
}
function persistBuckets() {
  try { lsSet(BUCKET_KEY, JSON.stringify({ role: state.bucketRole, audience: state.bucketAudience, buckets: state.contentBuckets })); } catch {}
}
function defaultBucketsForRole(role) {
  const guide = BUCKET_GUIDES[role] || BUCKET_GUIDES.creator;
  return BUCKET_TYPES.map(t => ({
    type: t.key,
    title: t.key,
    ideas: (guide.examples[t.key] || []).slice(0,3),
    notes: ''
  }));
}
function ensureBuckets() {
  if (!state.contentBuckets.length) state.contentBuckets = defaultBucketsForRole(state.bucketRole);
}
function populateBucketRoleSelect() {
  const sel = qs('bucketRoleSelect'); if (!sel) return;
  sel.innerHTML = '';
  Object.entries(BUCKET_GUIDES).forEach(([key,val]) => {
    const o=document.createElement('option'); o.value=key; o.textContent=val.label; if (state.bucketRole===key) o.selected=true; sel.appendChild(o);
  });
  const aud = qs('bucketAudienceInput'); if (aud) aud.value = state.bucketAudience || '';
}
function buildBucketPrompt() {
  ensureBuckets();
  const roleLabel = BUCKET_GUIDES[state.bucketRole]?.label || state.bucketRole;
  return `I'm building content buckets for my brand.

My role: ${roleLabel}
My audience: ${state.bucketAudience || 'General audience'}

Here are my current buckets:
${state.contentBuckets.map(b => `- ${b.title}: ${(b.ideas||[]).join('; ') || 'No starter ideas yet'}`).join('\n')}

Using the five content types Teach, Share, Show, Tell, and Prove, help me refine these into stronger repeatable content lanes. Give me 5 fresh ideas per bucket. Keep them specific, practical, and not overly corporate.`;
}
function bucketIdeasToText(bucket) {
  return `${bucket.title}
${(bucket.ideas||[]).map((idea,i)=>`${i+1}. ${idea}`).join('\n')}`;
}
function sendBucketsToComposer(which='all') {
  ensureBuckets();
  const editor = qs('composerEditor'); if (!editor) return;
  const buckets = which==='all' ? state.contentBuckets : state.contentBuckets.filter(b => b.type===which || b.title===which);
  const block = buckets.map(bucketIdeasToText).join('\n\n');
  if (!block.trim()) { showToast('No bucket ideas yet', 'error'); return; }
  const existing = editorToText(editor.innerHTML);
  editor.innerText = existing ? `${existing}

${block}` : block;
  editor.dispatchEvent(new Event('input'));
  activateView('composerView');
  showToast(which==='all' ? 'Buckets sent to Draft' : 'Bucket sent to Draft', 'success');
}
function renderBuckets() {
  ensureBuckets();
  populateBucketRoleSelect();
  const wrap = qs('bucketCards'); if (!wrap) return;
  const guide = BUCKET_GUIDES[state.bucketRole] || BUCKET_GUIDES.creator;
  wrap.innerHTML = '';
  state.contentBuckets.forEach((bucket, idx) => {
    const meta = BUCKET_TYPES.find(t => t.key === bucket.type) || BUCKET_TYPES[idx];
    const examples = (guide.examples[bucket.type] || []).slice(0,5);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <div>
          <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:16px;color:var(--ink);">${safeText(bucket.type)}</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.55;">${safeText(meta?.desc || '')}</div>
        </div>
        <span class="chip brand">Free</span>
      </div>
      <div class="field" style="margin-bottom:10px;">
        <label class="label">Your bucket name</label>
        <input class="input" data-bucket-title="${idx}" value="${safeText(bucket.title)}" placeholder="Rename this lane…" />
      </div>
      <div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Ask yourself</div>
      <div style="font-size:12px;color:var(--text);line-height:1.6;margin-bottom:10px;">${safeText(meta?.prompt || '')}</div>
      <div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Example ideas for ${safeText(guide.label)}</div>
      <ul style="padding-left:18px;margin:0 0 10px;color:var(--muted);font-size:12px;line-height:1.65;">${examples.map(x=>`<li>${safeText(x)}</li>`).join('')}</ul>
      <div class="field" style="margin-bottom:10px;">
        <label class="label">Starter ideas</label>
        <textarea data-bucket-ideas="${idx}" style="min-height:120px;">${safeText((bucket.ideas||[]).join('\n'))}</textarea>
      </div>
      <div class="row">
        <button class="btn sm" data-bucket-send="${idx}">→ Draft</button>
        <button class="btn sm ghost" data-bucket-copy="${idx}">Copy AI prompt</button>
      </div>`;
    wrap.appendChild(card);
  });
  wrap.querySelectorAll('[data-bucket-title]').forEach(inp => inp.addEventListener('input', e => { state.contentBuckets[+e.target.dataset.bucketTitle].title = e.target.value; persistBuckets(); renderBucketSummary(); renderComposerBuckets(); }));
  wrap.querySelectorAll('[data-bucket-ideas]').forEach(inp => inp.addEventListener('input', e => { state.contentBuckets[+e.target.dataset.bucketIdeas].ideas = e.target.value.split('\n').map(x=>x.trim()).filter(Boolean); persistBuckets(); renderBucketSummary(); renderComposerBuckets(); }));
  wrap.querySelectorAll('[data-bucket-send]').forEach(btn => btn.onclick = () => sendBucketsToComposer(state.contentBuckets[+btn.dataset.bucketSend].title));
  wrap.querySelectorAll('[data-bucket-copy]').forEach(btn => btn.onclick = () => {
    const bucket = state.contentBuckets[+btn.dataset.bucketCopy];
    const roleLabel = BUCKET_GUIDES[state.bucketRole]?.label || state.bucketRole;
    const prompt = `I'm building content around this bucket.

My role: ${roleLabel}
My audience: ${state.bucketAudience || 'General audience'}
Bucket name: ${bucket.title}
Current ideas:
${(bucket.ideas||[]).map(x=>`- ${x}`).join('\n')}

Give me 15 more practical social post ideas for this bucket. Mix educational, story-driven, opinion-based, and proof-driven angles. Avoid generic advice.`;
    navigator.clipboard.writeText(prompt); showToast('AI prompt copied', 'success');
  });
}
function renderBucketSummary() {
  const wrap = qs('bucketSavedSummary'); if (!wrap) return;
  ensureBuckets();
  wrap.innerHTML = '';
  state.contentBuckets.forEach(bucket => {
    const row = document.createElement('div');
    row.style.cssText='padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);';
    row.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;"><strong style="font-size:13px;color:var(--ink);">${safeText(bucket.title)}</strong><button class="btn sm ghost" data-saved-send="${safeText(bucket.title)}">→ Draft</button></div><div style="font-size:12px;color:var(--muted);line-height:1.6;">${safeText(compact((bucket.ideas||[]).join(' • '), 180) || 'No starter ideas yet.')}</div>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('[data-saved-send]').forEach(btn => btn.onclick = () => sendBucketsToComposer(btn.dataset.savedSend));
}
function renderComposerBuckets() {
  const wrap = qs('composerBucketsList'); if (!wrap) return;
  ensureBuckets();
  wrap.innerHTML = '';
  state.contentBuckets.slice(0,4).forEach(bucket => {
    const item = document.createElement('div');
    item.className = 'template-item';
    item.innerHTML = `<div class="template-item-title">${safeText(bucket.title)}</div><div class="template-item-preview">${safeText(compact((bucket.ideas||[]).join(' • '), 110) || 'No ideas yet.')}</div>`;
    item.onclick = () => sendBucketsToComposer(bucket.title);
    wrap.appendChild(item);
  });
  if (!state.contentBuckets.length) wrap.innerHTML = `<div style="font-size:12px;color:var(--subtle);padding:8px 0;font-family:'DM Mono',monospace;">Build your first buckets in the Tools section.</div>`;
}
function resetBuckets() {
  state.contentBuckets = defaultBucketsForRole(state.bucketRole);
  persistBuckets();
  renderBuckets();
  renderBucketSummary();
  renderComposerBuckets();
  showToast('Buckets reset');
}
function openTemplateModal(id = null) {
  state.editingTemplateId = id;
  const s = id ? state.templates.find(x => x.id === id) : null;
  qs('templateModalTitle').textContent = s ? 'Edit Template' : 'New Template';
  qs('templateTitle').value = s?.title || '';
  qs('templateType').value = s?.type || 'Hooks';
  qs('templatePlatform').value = s?.platform || 'Universal';
  qs('templateTags').value = (s?.tags || []).join(', ');
  qs('templateBody').value = s?.body || '';
  openModal('templateModal');
}

function saveTemplate() {
  const title = qs('templateTitle').value.trim();
  const body  = qs('templateBody').value.trim();
  if (!title || !body) { showToast('Title and body required', 'error'); return; }
  const now = new Date().toISOString();
  const payload = {
    id: state.editingTemplateId || `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    title, type: qs('templateType').value, platform: qs('templatePlatform').value,
    tags: normTags(qs('templateTags').value), body, createdAt: now, updatedAt: now,
  };
  if (state.editingTemplateId) {
    const prev = state.templates.find(s => s.id === state.editingTemplateId);
    payload.createdAt = prev?.createdAt || now;
    state.templates = state.templates.map(s => s.id === state.editingTemplateId ? payload : s);
  } else {
    state.templates = [payload, ...state.templates];
  }
  persistTemplates(); closeModal('templateModal'); renderTemplates(); showToast('Template saved', 'success');
}

function deleteTemplate(id) {
  if (!confirm('Delete this template?')) return;
  state.templates = state.templates.filter(s => s.id !== id);
  persistTemplates(); renderTemplates(); showToast('Deleted');
}

function renderTemplatePicker() {
  const list = qs('pickerList');
  const items = filteredTemplates(qs('pickerSearch').value, qs('pickerType').value, 'All Platforms');
  qs('pickerEmpty').style.display = items.length ? 'none' : 'flex';
  list.innerHTML = '';
  items.forEach(s => {
    const el = document.createElement('div');
    el.style.cssText = 'padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--surface);transition:all .1s;';
    el.innerHTML = `<strong style="font-size:13px;">${safeText(s.title)}</strong><div style="font-size:12px;color:var(--muted);margin-top:3px;">${safeText(compact(s.body, 150))}</div>`;
    el.onmouseenter = () => { el.style.borderColor = 'var(--brand-glow)'; el.style.background = 'var(--brand-dim)'; };
    el.onmouseleave = () => { el.style.borderColor = 'var(--border)'; el.style.background = 'var(--surface)'; };
    el.onclick = () => { useTemplateInEditor(s); closeModal('templatePickerModal'); };
    list.appendChild(el);
  });
}

function initTemplateSelectors() {
  ['templatePlatform', 'templatePlatformFilter'].forEach(id => {
    const sel = qs(id); if (!sel) return;
    sel.innerHTML = '';
    TEMPLATE_PLATFORMS.forEach((p, i) => {
      if (id === 'templatePlatformFilter' && i === 0) return; // skip "All" for modal selector
      const o = document.createElement('option'); o.value = p; o.textContent = p; sel.appendChild(o);
    });
    if (id === 'templatePlatformFilter') {
      const allOpt = document.createElement('option'); allOpt.value = 'All Platforms'; allOpt.textContent = 'All Platforms';
      sel.prepend(allOpt); sel.value = 'All Platforms';
    }
  });
  ['templateType', 'pickerType'].forEach(id => {
    const sel = qs(id); if (!sel) return;
    sel.innerHTML = '';
    TEMPLATE_TYPES.forEach((t, i) => {
      if (id === 'templateType' && i === 0) return;
      const o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o);
    });
  });
}

// ── TOKEN ──────────────────────────────────────────
function maskPreview(t) { return t ? maskToken(t) : 'Not connected'; }

function refreshTokenUI() {
  const connected = !!bufferToken;
  qs('connDot').classList.toggle('on', connected);
  qs('connLabel').textContent = connected ? 'Connected' : 'Not connected';
  qs('connTokenPreview').textContent = maskPreview(bufferToken);
  updateNavTags();
}

function updateNavTags() {
  const connected = !!bufferToken;
  ['calNavTag','appNavTag'].forEach(id => {
    const el = qs(id); if (!el) return;
    el.style.display = connected ? 'none' : '';
  });
  const calDesc = qs('calDesc');
  if (calDesc) calDesc.textContent = connected
    ? 'Your Buffer queue in a monthly view. Spot gaps and add planning notes before you draft.'
    : 'Connect your Buffer token to load your scheduled posts and spot queue gaps.';
  const composerDesc = qs('composerDesc');
  if (composerDesc) composerDesc.textContent = connected
    ? 'Write your post, attach media, then send to Buffer as a draft, queued post, or scheduled post.'
    : 'Write here now — connect Buffer to unlock drafting, queueing, and scheduling.';
  updateComposerButtonStates();
  qs('calEmptyHint').style.display = connected ? 'none' : 'block';
}

function updateComposerButtonStates() {
  const connected = !!bufferToken;
  const hasChannel = !!qs('composerChannel')?.value;
  const ready = connected && hasChannel;
  ['composerDraft','composerQueue','composerScheduleToggle'].forEach(id => {
    const btn = qs(id); if (!btn) return;
    btn.disabled = !ready;
    btn.style.opacity = ready ? '1' : '.45';
    btn.style.cursor = ready ? 'pointer' : 'not-allowed';
    btn.title = !connected ? 'Add your Buffer token first' : !hasChannel ? 'Load channels from Buffer first' : '';
  });
}

function setBufferToken(token, { mode = 'session', messageEl = null } = {}) {
  lsRemove(STORE_KEY);
  ssRemove(STORE_KEY);
  const clean = String(token || '').trim();
  if (!clean) {
    bufferToken = '';
    clearSyncedData();
    if (messageEl) messageEl.textContent = 'Token removed.';
    refreshTokenUI();
    showToast('Token removed');
    return false;
  }
  if (mode === 'local') lsSet(STORE_KEY, clean);
  else ssSet(STORE_KEY, clean);
  bufferToken = clean;
  if (messageEl) messageEl.textContent = mode === 'local' ? 'Saved locally.' : 'Saved for session.';
  refreshTokenUI();
  showToast('Token saved', 'success');
  return true;
}

function loadStoredToken() {
  bufferToken = ssGet(STORE_KEY) || lsGet(STORE_KEY) || '';
  if (bufferToken) {
    const inp = qs('tokenInput'); if (inp) inp.value = bufferToken;
    loadCacheState();
    hydrateFromCache();
  }
  refreshTokenUI();
}

function saveToken() {
  const token = qs('tokenInput').value.trim();
  const mode = [...document.querySelectorAll('input[name="tokenMode"]')].find(r => r.checked)?.value || 'session';
  const ok = setBufferToken(token, { mode, messageEl: qs('tokenMsg') });
  if (ok) syncBuffer({ force: true });
}

// ── CACHE ──────────────────────────────────────────
function loadCacheState() {
  try {
    const raw = lsGet(CACHE_KEY); if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.keys(cache).forEach(key => {
      if (parsed[key]?.ts) cache[key] = { value: parsed[key].value, ts: parsed[key].ts };
    });
  } catch {}
}
function saveCacheState() { try { lsSet(CACHE_KEY, JSON.stringify(cache)); } catch {} }
function isCacheFresh(key) { return !!cache[key]?.ts && (Date.now() - cache[key].ts) < CACHE_TTL[key]; }
function hydrateFromCache() {
  if (cache.orgId.value) state.organizationId = cache.orgId.value;
  if (Array.isArray(cache.channels.value) && cache.channels.value.length) state.channels = cache.channels.value;
  if (Array.isArray(cache.scheduled.value) && cache.scheduled.value.length) state.scheduled = cache.scheduled.value;
}
function clearSyncedData() {
  state.channels = []; state.scheduled = []; state.organizationId = null;
  Object.keys(cache).forEach(k => { cache[k] = { value: Array.isArray(cache[k]?.value) ? [] : null, ts: 0 }; });
  try { lsRemove(CACHE_KEY); } catch {}
  renderChannelSelects(); renderCalendar();
}

// ── BUFFER API ──────────────────────────────────────
async function callBuffer(query, variables = {}) {
  if (!bufferToken) throw Object.assign(new Error('No Buffer token'), { code: 'MISSING_TOKEN' });
  let res;
  try { res = await fetch('/.netlify/functions/buffer-proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: bufferToken, query, variables }) }); }
  catch (err) { throw Object.assign(new Error('Network error'), { code: 'PROXY_NETWORK_ERROR', retryable: true, cause: err }); }
  let data;
  try { data = await res.json(); } catch { throw Object.assign(new Error('Invalid proxy response'), { code: 'PROXY_BAD_RESPONSE' }); }
  if (data.errors?.length && !data.data) {
    const first = data.errors[0] || {};
    throw Object.assign(new Error(first.message || 'Buffer request failed'), { code: first.code || 'BUFFER_ERROR', status: first.status, retryable: !!first.retryable, retryAfter: first.retryAfter });
  }
  return data;
}

function getErrorMessage(err, fallback = 'Request failed. Please try again.') {
  const code = String(err?.code || '').toUpperCase();
  const msg  = String(err?.message || '');
  if (code === 'MISSING_TOKEN') return 'Add your Buffer token first.';
  if (code === 'RATE_LIMIT' || err?.status === 429) return `Buffer rate limit hit.${err?.retryAfter ? ` Retry in ${err.retryAfter}s.` : ''}`;
  if (code === 'AUTH_ERROR' || /unauthorized|invalid|forbidden|expired/i.test(msg)) return 'Token appears invalid or expired. Reconnect Buffer.';
  if (code === 'PROXY_NETWORK_ERROR') return 'Network issue reaching Buffer. Check connection and retry.';
  return msg || fallback;
}

function isAuthError(err) {
  return ['AUTH_ERROR'].includes(String(err?.code || '').toUpperCase())
    || err?.status === 401 || err?.status === 403
    || /unauthorized|invalid token|forbidden|expired/i.test(String(err?.message || ''));
}

function handleAuthFailure(msg) {
  bufferToken = '';
  lsRemove(STORE_KEY); ssRemove(STORE_KEY);
  clearSyncedData(); refreshTokenUI();
  setSyncStatus('failed', msg);
}

// ── SYNC ──────────────────────────────────────────
function setSyncStatus(state_, msg) {
  state.syncState = state_;
  const el = qs('syncStatus'); if (!el) return;
  el.textContent = msg;
  const lastEl = qs('lastSynced');
  if (state_ === 'success' && lastEl) lastEl.textContent = `Synced at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

async function getOrgId({ force = false } = {}) {
  if (!force && state.organizationId && isCacheFresh('orgId')) return state.organizationId;
  const acc = await callBuffer('query { account { organizations { id name } } }');
  const orgId = acc?.data?.account?.organizations?.[0]?.id || null;
  if (orgId) { state.organizationId = orgId; cache.orgId = { value: orgId, ts: Date.now() }; }
  return orgId;
}

async function getChannels({ force = false } = {}) {
  if (!force && state.channels.length && isCacheFresh('channels')) return state.channels;
  const orgId = await getOrgId({ force });
  if (!orgId) return [];
  const q = 'query C($organizationId: OrganizationId!) { channels(input:{organizationId:$organizationId}){ id displayName name service } }';
  const ch = await callBuffer(q, { organizationId: orgId });
  state.channels = ch?.data?.channels || [];
  cache.channels = { value: state.channels, ts: Date.now() };
  return state.channels;
}

async function getScheduledPosts({ force = false } = {}) {
  if (!force && state.scheduled.length && isCacheFresh('scheduled')) return state.scheduled;
  const orgId = await getOrgId({ force });
  if (!orgId) return [];
  const bounds = getScheduledBounds();
  let all = [], after = null, hasNext = true, fetched = 0;
  const seen = new Set();
  const q = 'query P($organizationId: OrganizationId!, $after: String, $first: Int!) { posts(first:$first,after:$after,input:{organizationId:$organizationId,filter:{status:[scheduled]}}){edges{node{id text dueAt channelId}} pageInfo{hasNextPage endCursor} } }';
  while (hasNext && fetched < 200 && all.length < 200) {
    const page = await callBuffer(q, { organizationId: orgId, after, first: 50 });
    const block = page?.data?.posts;
    (block?.edges || []).forEach(e => {
      const post = e?.node;
      if (!post?.id || seen.has(post.id)) return;
      const due = new Date(post.dueAt);
      if (due >= bounds.start && due <= bounds.end) { seen.add(post.id); all.push(post); }
    });
    hasNext = !!block?.pageInfo?.hasNextPage; after = block?.pageInfo?.endCursor || null; fetched += (block?.edges || []).length;
    if (!block?.pageInfo) break;
  }
  all.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  state.scheduled = all;
  cache.scheduled = { value: all, ts: Date.now() };
  saveCacheState();
  return all;
}

function getScheduledBounds() {
  const m = state.month;
  const start = new Date(m.getFullYear(), m.getMonth(), 1); start.setDate(start.getDate() - 7);
  const end = new Date(m.getFullYear(), m.getMonth() + 1, 0); end.setDate(end.getDate() + 60);
  return { start, end };
}

async function syncBuffer({ force = false } = {}) {
  if (!bufferToken) { setSyncStatus('failed', 'Add your Buffer token first.'); return; }
  setSyncStatus('syncing', 'Syncing…');
  const btn = qs('syncBtn'); const orig = btn.innerHTML;
  btn.innerHTML = '↻ Syncing…'; btn.disabled = true;
  try {
    const orgId = await getOrgId({ force });
    if (!orgId) { clearSyncedData(); setSyncStatus('failed', 'No organization found.'); return; }
    await getChannels({ force });
    const posts = await getScheduledPosts({ force });
    renderChannelSelects();
    renderCalendar();
    detectQueueGaps();
    setSyncStatus('success', `${posts.length} scheduled posts loaded.`);
    showToast(`Loaded ${posts.length} posts`, 'success');
    window.dispatchEvent(new Event('postiq:synced'));
  } catch (e) {
    const msg = getErrorMessage(e, 'Sync failed.');
    if (isAuthError(e)) handleAuthFailure(msg);
    else setSyncStatus('failed', msg);
    showToast(msg, 'error');
  } finally { btn.innerHTML = orig; btn.disabled = false; }
}

// ── CHANNEL SELECTS ──────────────────────────────────
function renderChannelSelects() {
  const sel = qs('composerChannel'); if (!sel) return;
  sel.innerHTML = '';
  if (state.channels.length) {
    state.channels.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = `${c.displayName || c.name} (${c.service})`; sel.appendChild(o);
    });
    qs('composerNoChannels').style.display = 'none'; sel.style.display = '';
  } else {
    qs('composerNoChannels').style.display = 'block'; sel.style.display = 'none';
  }
  updateComposerButtonStates();
}

// ── CALENDAR ──────────────────────────────────────
function getNotes() { try { return JSON.parse(lsGet(NOTE_KEY) || '{}'); } catch { return {}; } }
function setNotes(v) { lsSet(NOTE_KEY, JSON.stringify(v)); }

function renderCalendar() {
  qs('monthLabel').textContent = monthLabel(state.month);
  const grid = qs('calGrid'); grid.innerHTML = '';
  const first = monthStart(state.month);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const notes = getNotes();
  const today = fmtDate(new Date());
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = fmtDate(d);
    const inMonth = d.getMonth() === state.month.getMonth();
    const dayPosts = state.scheduled.filter(p => fmtDate(new Date(p.dueAt)) === key);
    const note = notes[key];
    const isToday = key === today;
    const hasGap = inMonth && !dayPosts.length && [1,2,3,4,5].includes(d.getDay()); // weekday gap indicator

    const day = document.createElement('div');
    let cls = 'cal-day';
    if (!inMonth) cls += ' other-month';
    if (isToday) cls += ' today';
    if (dayPosts.length) cls += ' has-posts';
    day.className = cls;

    let html = `<div class="day-num">${d.getDate()}</div>`;
    if (dayPosts.length) html += `<div class="day-count">${dayPosts.length}</div>`;
    if (dayPosts[0]) html += `<div class="day-post-pill">${safeText(compact(dayPosts[0].text, 60))}</div>`;
    if (dayPosts[1]) html += `<div class="day-post-pill">${safeText(compact(dayPosts[1].text, 60))}</div>`;
    if (dayPosts.length > 2) html += `<div class="more-indicator">+${dayPosts.length - 2} more</div>`;
    if (note) html += `<div class="day-note-pill ${note.tag || 'gold'}">${safeText(compact(note.text, 50))}</div>`;
    day.innerHTML = html;
    day.onclick = () => openDayNote(d);
    grid.appendChild(day);
  }
  renderAgenda();
}

function detectQueueGaps() {
  const panel = qs('gapsPanel'); const list = qs('gapsList');
  if (!panel || !list || !bufferToken) { if (panel) panel.style.display = 'none'; return; }
  const today = new Date(); today.setHours(0,0,0,0);
  const gaps = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    if ([0,6].includes(d.getDay())) continue; // skip weekends
    const key = fmtDate(d);
    const hasPosts = state.scheduled.some(p => fmtDate(new Date(p.dueAt)) === key);
    if (!hasPosts) gaps.push(d);
  }
  if (!gaps.length) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  list.innerHTML = '';
  gaps.forEach(d => {
    const chip = document.createElement('button');
    chip.className = 'gap-chip';
    chip.textContent = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    chip.onclick = () => openDayNote(d);
    list.appendChild(chip);
  });
}

function openDayNote(date) {
  state.selectedDate = date;
  const key = fmtDate(date);
  const note = getNotes()[key] || { text: '', tag: 'gold', label: 'Idea' };
  qs('noteDateLabel').textContent = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  qs('noteText').value = note.text || '';
  qs('noteTag').value = `${note.tag || 'gold'}|${note.label || 'Idea'}`;
  const dayPosts = state.scheduled.filter(p => fmtDate(new Date(p.dueAt)) === key);
  qs('dayPostPreview').innerHTML = dayPosts.length
    ? `<div style="font-size:11px;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px;">${dayPosts.length} scheduled post${dayPosts.length > 1 ? 's' : ''}</div>${dayPosts.map(p => `<div style="font-size:12px;padding:6px 8px;background:var(--brand-dim);border:1px solid var(--brand-glow);border-radius:5px;color:var(--brand);margin-bottom:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${safeText(p.text || '(no text)')}</div>`).join('')}`
    : `<div style="font-size:12px;color:var(--subtle);margin-bottom:8px;">No posts scheduled on this day.</div>`;
  qs('noteStatus').textContent = '';
  openModal('noteModal');
}

function saveNote() {
  if (!state.selectedDate) return;
  const key = fmtDate(state.selectedDate);
  const text = qs('noteText').value.trim();
  const [tag, label] = qs('noteTag').value.split('|');
  const notes = getNotes();
  if (!text) { delete notes[key]; setNotes(notes); qs('noteStatus').textContent = 'Note removed.'; renderCalendar(); return; }
  notes[key] = { text, tag, label };
  setNotes(notes); qs('noteStatus').textContent = 'Saved.'; renderCalendar();
  showToast('Note saved', 'success');
}

function deleteNote() {
  if (!state.selectedDate) return;
  const notes = getNotes(); delete notes[fmtDate(state.selectedDate)];
  setNotes(notes); qs('noteText').value = ''; qs('noteStatus').textContent = 'Deleted.'; renderCalendar();
  showToast('Note deleted');
}

function sendNoteToDraft() {
  if (!state.selectedDate) return;
  const text = qs('noteText').value.trim();
  if (!text) { qs('noteStatus').textContent = 'Add a note first.'; return; }
  const [, label] = qs('noteTag').value.split('|');
  const editor = qs('composerEditor');
  const payload = `[${label}] ${fmtDate(state.selectedDate)}
${text}`;
  editor.innerText = editor.innerText ? `${editor.innerText}

${payload}` : payload;
  editor.dispatchEvent(new Event('input'));
  closeModal('noteModal'); activateView('composerView');
  showToast('Note sent to Draft');
}

function renderAgenda() {
  const agenda = qs('calAgenda'); if (!agenda) return;
  const notes = getNotes(); const today = fmtDate(new Date());
  agenda.innerHTML = '';
  const nav = document.createElement('div'); nav.className = 'cal-header';
  nav.innerHTML = `<div class="cal-month-label" style="font-size:18px;">${monthLabel(state.month)}</div>`;
  agenda.appendChild(nav);
  const map = {};
  state.scheduled.forEach(p => { const k = fmtDate(new Date(p.dueAt)); if (!map[k]) map[k] = { posts: [], note: null }; map[k].posts.push(p); });
  Object.entries(notes).forEach(([k, n]) => {
    if (!map[k]) map[k] = { posts: [], note: null }; map[k].note = n;
  });
  const days = [];
  const ms = monthStart(state.month);
  for (let i = 0; i < 35; i++) { const d = new Date(ms.getFullYear(), ms.getMonth(), i + 1); if (d.getMonth() !== ms.getMonth()) break; days.push(fmtDate(d)); }
  days.forEach(key => {
    const data = map[key]; if (!data) return;
    const isToday = key === today;
    const date = new Date(key + 'T00:00:00');
    const dayEl = document.createElement('div');
    dayEl.style.cssText = `border:1px solid ${isToday ? 'var(--brand)' : 'var(--border)'};border-radius:10px;padding:12px;margin-bottom:8px;background:var(--surface);cursor:pointer;`;
    const dateLabel = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;"><span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:600;color:${isToday ? 'var(--brand)' : 'var(--muted)'};">${dateLabel}</span>${data.posts.length ? `<span style="font-size:9px;font-family:'DM Mono',monospace;background:var(--brand-dim);color:var(--brand);border:1px solid var(--brand-glow);padding:1px 5px;border-radius:3px;">${data.posts.length} post${data.posts.length > 1 ? 's' : ''}</span>` : ''}</div>`;
    data.posts.slice(0, 2).forEach(p => { html += `<div style="font-size:12px;padding:6px 8px;background:var(--brand-dim);border:1px solid var(--brand-glow);border-radius:5px;color:var(--brand);margin-bottom:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${safeText(compact(p.text, 80))}</div>`; });
    if (data.posts.length > 2) html += `<div style="font-size:10px;color:var(--subtle);margin-bottom:4px;">+${data.posts.length - 2} more</div>`;
    if (data.note) html += `<div class="day-note-pill ${data.note.tag || 'gold'}" style="display:block;border-radius:5px;margin-top:4px;">${safeText(compact(data.note.text, 60))}</div>`;
    dayEl.innerHTML = html; dayEl.onclick = () => openDayNote(date);
    agenda.appendChild(dayEl);
  });
  if (!Object.keys(map).length) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.innerHTML = '<div class="empty-icon">📅</div><div class="empty-title">Nothing scheduled</div><div class="empty-desc">Connect Buffer and sync to load your upcoming posts.</div>';
    agenda.appendChild(empty);
  }
}

// Calendar snapshot share
function shareSnapshot() {
  const include = qs('includeNotes').checked;
  const posts = state.scheduled.filter(p => { const d = new Date(p.dueAt); return d.getFullYear() === state.month.getFullYear() && d.getMonth() === state.month.getMonth(); });
  const allNotes = getNotes();
  const monthNotes = Object.entries(allNotes).filter(([k]) => { const d = new Date(k + 'T00:00:00'); return d.getFullYear() === state.month.getFullYear() && d.getMonth() === state.month.getMonth(); }).map(([date, val]) => ({ date, ...val }));
  qs('shareMonthName').textContent = monthLabel(state.month);
  qs('sharePostCount').textContent = posts.length;
  const payload = { month: monthLabel(state.month), includeNotes: include, posts: posts.map(p => ({ dueAt: p.dueAt, text: p.text, noteText: p.note || '', channelName: p.channelName || p.channel || '' })), notes: include ? monthNotes : [] };
  qs('shareLink').value = location.origin + location.pathname + '#share=' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function renderSharedFromHash() {
  if (!location.hash.startsWith('#share=')) return false;
  try {
    const snap = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(7)))));
    qs('app').classList.add('hidden'); qs('sharedView').classList.remove('hidden');
    qs('sharedMonthTitle').textContent = snap.month;
    qs('sharedBanner').textContent = `Read-only snapshot · ${snap.posts.length} scheduled posts · Notes ${snap.includeNotes ? 'included' : 'excluded'}`;
    const grid = qs('sharedGrid'); grid.innerHTML = '';
    const map = {};
    snap.posts.forEach(p => { const k = p.dueAt.slice(0, 10); if (!map[k]) map[k] = { posts: [], notes: [] }; map[k].posts.push(p); });
    (snap.notes || []).forEach(n => { if (!map[n.date]) map[n.date] = { posts: [], notes: [] }; map[n.date].notes.push(n); });
    Object.keys(map).sort().forEach(k => {
      const d = document.createElement('div'); d.className = 'cal-day'; d.style.cursor = 'pointer';
      const data = map[k];
      let html = `<div class="day-num">${k.slice(8)}</div>`;
      if (data.posts.length) html += `<div class="day-count">${data.posts.length}</div>`;
      data.posts.slice(0, 2).forEach(p => { html += `<div class="day-post-pill">${safeText(compact(p.text || p, 60))}</div>`; });
      data.notes.slice(0, 1).forEach(n => { html += `<div class="day-note-pill ${n.tag || 'gold'}">${safeText(compact(n.text, 50))}</div>`; });
      d.innerHTML = html;
      d.onclick = () => openSharedDay(k, data);
      grid.appendChild(d);
    });
    return true;
  } catch { return false; }
}

function openSharedDay(key, data) {
  qs('sharedDayTitle').textContent = new Date(key + 'T00:00:00').toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' });
  const body = qs('sharedDayBody');
  body.innerHTML = '';
  if (data.posts?.length) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div style="font-size:11px;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:8px;">Scheduled posts</div>` + data.posts.map((p, i) => `<div style="padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);margin-bottom:8px;"><div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--brand);margin-bottom:6px;">Post ${i+1}${p.channelName ? ' · ' + safeText(p.channelName) : ''}</div><div style="white-space:pre-wrap;font-size:13px;line-height:1.65;color:var(--text);">${safeText(p.text || p)}</div>${p.noteText ? `<div style="margin-top:8px;font-size:12px;color:var(--muted);white-space:pre-wrap;">Notes: ${safeText(p.noteText)}</div>` : ''}</div>`).join('');
    body.appendChild(card);
  }
  if (data.notes?.length) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div style="font-size:11px;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:8px;">Planning notes</div>` + data.notes.map(n => `<div class="day-note-pill ${n.tag || 'gold'}" style="display:block;margin-bottom:8px;padding:10px 12px;border-radius:8px;white-space:pre-wrap;">${safeText(n.text)}</div>`).join('');
    body.appendChild(card);
  }
  openModal('sharedDayModal');
}

// ── COMPOSER ──────────────────────────────────────
function editorToText(html) {
  const root = document.createElement('div'); root.innerHTML = html;
  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    const tag = (node.tagName || '').toLowerCase();
    if (tag === 'br') return '\n';
    if (tag === 'strong' || tag === 'b') return `**${[...node.childNodes].map(walk).join('')}**`;
    if (tag === 'em' || tag === 'i') return `*${[...node.childNodes].map(walk).join('')}*`;
    if (tag === 'li') return [...node.childNodes].map(walk).join('');
    if (tag === 'ul') return [...node.children].map(li => `• ${walk(li)}`).join('\n') + '\n';
    if (tag === 'ol') return [...node.children].map((li, i) => `${i+1}. ${walk(li)}`).join('\n') + '\n';
    const inner = [...node.childNodes].map(walk).join('');
    if (['p','div'].includes(tag)) return inner + '\n';
    return inner;
  };
  return [...root.childNodes].map(walk).join('').replace(/\n{3,}/g, '\n\n').trim();
}

function composerFormat(cmd) {
  const sel = window.getSelection(); if (!sel?.rangeCount) return;
  if (cmd === 'bold' || cmd === 'italic') document.execCommand(cmd, false, null);
  else if (cmd === 'ul') document.execCommand('insertUnorderedList', false, null);
  else if (cmd === 'ol') document.execCommand('insertOrderedList', false, null);
  else if (cmd === 'clear') document.execCommand('removeFormat', false, null);
}

// ── MEDIA ──────────────────────────────────────────
function applyMedia(url, source, thumbUrl = '') {
  const type = isVideo(url) ? 'video' : 'image';
  mediaState.url = url; mediaState.type = type; mediaState.source = source; mediaState.videoThumbUrl = thumbUrl;
  const ton = qs('mediaToggleBtn'), toff = qs('mediaToggleOff'), tthumb = qs('mediaThumbPreview'), tlabel = qs('mediaToggleLabel');
  if (url) {
    ton.style.display = 'none'; toff.style.display = 'flex';
    tlabel.textContent = type === 'video' ? '🎬 Video attached' : '🖼 Image attached';
    if (tthumb) { tthumb.src = type === 'image' ? url : ''; tthumb.style.display = type === 'image' ? 'inline' : 'none'; }
    const ms = qs('mediaSummary'); if (ms) ms.style.display = 'flex';
    const mst = qs('mediaSummaryThumb'); if (mst) { mst.src = type === 'image' ? url : ''; mst.style.display = type === 'image' ? 'block' : 'none'; }
    const mstype = qs('mediaSummaryType'); if (mstype) mstype.textContent = type === 'video' ? '🎬 Video' : '🖼 Image';
    const msurl = qs('mediaSummaryUrl'); if (msurl) msurl.textContent = url;
  } else { clearMedia(); }
}

function clearMedia() {
  mediaState.url = ''; mediaState.type = ''; mediaState.source = ''; mediaState.videoThumbUrl = '';
  qs('mediaToggleBtn').style.display = 'flex'; qs('mediaToggleOff').style.display = 'none';
  const ms = qs('mediaSummary'); if (ms) ms.style.display = 'none';
  const inp = qs('mediaUrlInput'); if (inp) inp.value = '';
  resetUploadTab();
}

function resetUploadTab() {
  qs('uploadZone').style.display = 'block'; qs('uploadResult').style.display = 'none';
  const fi = qs('uploadFileInput'); if (fi) fi.value = '';
  const st = qs('uploadStatus'); if (st) { st.textContent = ''; }
}

async function imgurUpload(file) {
  const fd = new FormData(); fd.append('image', file);
  const res = await fetch('https://api.imgur.com/3/image', { method: 'POST', headers: { Authorization: `Client-ID ${IMGUR_KEY}` }, body: fd });
  const data = await res.json();
  if (!data.success) throw new Error(data.data?.error || 'Upload failed');
  return data.data.link;
}

async function handleUploadFile(file) {
  const st = qs('uploadStatus');
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { st.textContent = 'Unsupported type.'; return; }
  if (file.type.startsWith('video/')) {
    st.textContent = 'For video, use the URL tab with a hosted video link.';
    switchMediaTab('url'); return;
  }
  qs('uploadZone').style.display = 'none'; st.textContent = 'Uploading…';
  try {
    const url = await imgurUpload(file);
    qs('uploadResult').style.display = 'flex';
    qs('uploadThumb').src = url; qs('uploadResultName').textContent = file.name || 'uploaded image'; qs('uploadResultUrl').textContent = url;
    st.textContent = ''; applyMedia(url, 'upload'); showToast('Image uploaded', 'success');
  } catch (err) {
    qs('uploadZone').style.display = 'block'; st.textContent = 'Upload failed: ' + err.message;
  }
}

function switchMediaTab(id) {
  document.querySelectorAll('.media-tab').forEach(t => t.classList.toggle('active', t.dataset.mtab === id));
  document.querySelectorAll('.media-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.mtabpanel === id));
}

let _unsplashLast = '';
async function runUnsplashSearch() {
  const q = qs('unsplashQuery').value.trim(); if (!q) return;
  if (q === _unsplashLast) return; _unsplashLast = q;
  const grid = qs('unsplashGrid'), status = qs('unsplashStatus');
  status.textContent = 'Searching…'; grid.innerHTML = '';
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=9&orientation=landscape`, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } });
    if (!res.ok) throw new Error(res.status === 403 ? 'Rate limit' : `HTTP ${res.status}`);
    const data = await res.json();
    if (!data.results?.length) { status.textContent = `No results for "${q}".`; return; }
    status.textContent = `${data.total.toLocaleString()} results`;
    data.results.forEach(photo => {
      const item = document.createElement('div');
      item.style.cssText = 'position:relative;border-radius:6px;overflow:hidden;border:2px solid transparent;cursor:pointer;aspect-ratio:4/3;background:var(--surface2);transition:border-color .12s;';
      item.innerHTML = `<img src="${photo.urls.small}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy"/>`;
      item.title = `Photo by ${photo.user.name}`;
      item.onmouseenter = () => { item.style.borderColor = 'var(--brand)'; };
      item.onmouseleave = () => { item.style.borderColor = 'transparent'; };
      item.onclick = () => { applyMedia(photo.urls.regular, 'unsplash'); closeMediaPanel(); showToast(`Photo by ${photo.user.name} added`, 'success'); };
      grid.appendChild(item);
    });
  } catch (err) { status.textContent = 'Search failed: ' + err.message; }
}

function openMediaPanel() { qs('mediaPanel').classList.add('open'); }
function closeMediaPanel() { qs('mediaPanel').classList.remove('open'); }

// ── POST CREATION ──────────────────────────────────
async function createPost(input) {
  const mutation = `mutation CreatePost($input:CreatePostInput!){createPost(input:$input){__typename ... on PostActionSuccess{post{id dueAt text channelId}} ... on MutationError{message}}}`;
  const res = await callBuffer(mutation, { input });
  const result = res?.data?.createPost;
  if (!result) throw new Error('Empty mutation response.');
  if (result.__typename === 'MutationError') throw new Error(result.message || 'Buffer rejected this post.');
  if (result.__typename !== 'PostActionSuccess') throw Object.assign(new Error(result.message || `Unexpected result: ${result.__typename}`), { code: 'MUTATION_ERROR' });
  return result;
}

function appendScheduled(post) {
  const id = post?.id; if (!id) return;
  if (state.scheduled.some(p => p.id === id)) return;
  state.scheduled = [...state.scheduled, { id, text: post.text || '', dueAt: post.dueAt, channelId: post.channelId }];
  cache.scheduled = { value: state.scheduled, ts: Date.now() }; saveCacheState();
}

async function composerSend(action) {
  const text = editorToText(qs('composerEditor').innerHTML);
  if (!text) { showToast('Write something first', 'error'); return; }
  if (!bufferToken) { showToast('Connect Buffer first', 'error'); return; }
  const channelId = qs('composerChannel').value;
  if (!channelId) { showToast('Load channels first', 'error'); return; }
  const needsApproval = qs('needsApprovalCheck')?.checked || false;
  const when = qs('composerWhen').value;
  const input = { channelId, text, schedulingType: 'automatic' };
  if (action === 'draft') { input.mode = 'addToQueue'; input.saveToDraft = true; }
  if (action === 'queue') { input.mode = 'addToQueue'; }
  if (action === 'schedule') {
    if (!when) { qs('composerStatus').textContent = 'Pick a date/time first.'; return; }
    input.mode = 'customScheduled'; input.dueAt = when;
  }
  // Attach media
  const imgUrl = mediaState.url || '';
  if (imgUrl) {
    if (isVideo(imgUrl)) {
      const entry = { url: imgUrl };
      if (mediaState.videoThumbUrl) entry.thumbnailUrl = mediaState.videoThumbUrl;
      input.assets = { videos: [entry] };
    } else {
      input.assets = { images: [{ url: imgUrl }] };
    }
  }
  qs('composerStatus').textContent = 'Sending…';
  try {
    const created = await createPost(input);
    const draftId = created?.post?.id;
    if (action === 'draft' && needsApproval && draftId) {
      const ch = state.channels.find(c => c.id === channelId);
      setApprovalMeta(draftId, {
        needs_approval: true, status: 'pending', comments: [], link_generated: false, locked: false,
        content: text, platform: ch?.service || null, image_url: imgUrl || null, channel_id: channelId, created_at: Date.now(),
      });
    }
    const msg = action === 'draft' ? 'Draft saved.' : action === 'queue' ? 'Added to queue.' : 'Scheduled.';
    qs('composerStatus').textContent = msg; showToast(msg, 'success');
    if (created?.post?.dueAt) { appendScheduled(created.post); renderCalendar(); }
    // Clear
    qs('composerEditor').innerHTML = '';
    qs('composerEditor').dispatchEvent(new Event('input'));
    qs('composerWhen').value = '';
    if (qs('needsApprovalCheck')) qs('needsApprovalCheck').checked = false;
    clearMedia(); closeMediaPanel();
    qs('schedulePanel').classList.remove('open');
    qs('composerScheduleToggle').style.display = 'inline-flex';
  } catch (e) {
    const msg = getErrorMessage(e, 'Failed to send.');
    if (isAuthError(e)) handleAuthFailure(msg);
    qs('composerStatus').textContent = `Failed: ${msg}`;
    showToast('Failed: ' + msg, 'error');
  }
}

// ── APPROVALS ──────────────────────────────────────
const appState = { loading: false };

async function loadApprovals() {
  if (appState.loading) return; appState.loading = true;
  const listEl = qs('approvalsList'), emptyEl = qs('approvalsEmpty');
  if (!listEl) { appState.loading = false; return; }
  listEl.innerHTML = '';
  emptyEl.style.display = 'none';
  try {
    const metas = getAllApprovalMetas();
    if (!metas.length) { emptyEl.style.display = 'flex'; appState.loading = false; return; }
    for (const meta of metas) {
      if (meta.link_generated && meta.approval_uuid) {
        try {
          const r = await fetch('/.netlify/functions/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get', id: meta.approval_uuid }) });
          const d = await r.json();
          if (!d.error) {
            const updated = { ...meta, status: d.status || meta.status, comments: d.comments || meta.comments };
            if (d.status === 'changes_requested') { updated.link_generated = false; updated.locked = false; }
            setApprovalMeta(meta.draftId, updated); Object.assign(meta, updated);
          }
        } catch {}
      }
    }
    metas.forEach(meta => renderApprovalCard(meta));
  } catch (e) { console.error('[PostIQ] loadApprovals:', e); }
  finally { appState.loading = false; }
}

function renderApprovalCard(meta) {
  const listEl = qs('approvalsList');
  const safeId = meta.draftId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const statusClass = meta.status === 'approved' ? 'approved' : meta.status === 'changes_requested' ? 'changes' : 'pending';
  const statusLabel = meta.status === 'approved' ? 'Approved' : meta.status === 'changes_requested' ? 'Changes Requested' : 'Pending';
  const platformBadge = meta.platform ? `<span class="chip">${safeText(meta.platform)}</span>` : '';
  const pubDisabled = meta.status === 'pending' && meta.link_generated;

  const card = document.createElement('div');
  card.className = 'approval-card';
  card.dataset.draftId = meta.draftId;
  card.dataset.safeId = safeId;

  const borderColor = meta.status === 'approved' ? 'var(--green)' : meta.status === 'changes_requested' ? 'var(--accent)' : 'var(--amber)';

  card.innerHTML = `
    <div class="approval-card-status-bar ${statusClass}"></div>
    <div class="approval-card-header">
      <div class="approval-card-meta">
        <span class="approval-status-badge ${statusClass}">${statusLabel}</span>
        ${platformBadge}
        <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);">${meta.created_at ? new Date(meta.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : ''}</span>
      </div>
      <button class="btn sm ghost" onclick="approvalRemove('${safeId}')">✕ Remove</button>
    </div>
    <div class="approval-card-body">
      ${meta.image_url ? `<img src="${safeText(meta.image_url)}" alt="Media" style="width:100%;max-height:240px;object-fit:cover;border-radius:8px;border:1px solid var(--border);margin-bottom:12px;display:block;" />` : ''}
      <div class="approval-content-text">${safeText(meta.content || '')}</div>
      ${meta.comments?.length ? `
        <div class="approval-comments">
          <div style="font-size:10px;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">Reviewer feedback</div>
          ${meta.comments.map(c => `
            <div class="approval-comment">
              <div class="approval-comment-meta">
                <span class="approval-comment-author">${safeText(c.author || 'Anonymous')}</span>
                <span class="approval-comment-time">${c.timestamp ? new Date(c.timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : ''}</span>
                ${c.action ? `<span class="approval-comment-action ${c.action === 'approved' ? 'approved' : 'changes'}">${c.action === 'approved' ? 'Approved' : 'Changes'}</span>` : ''}
              </div>
              <div class="approval-comment-text">${safeText(c.text || '')}</div>
            </div>`).join('')}
        </div>` : ''}
    </div>
    <div class="approval-footer">
      ${!meta.link_generated ? `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:12px;font-weight:600;margin-bottom:2px;">Share for approval</div>
            <div style="font-size:11px;color:var(--muted);">Generate a link to send to your reviewer.</div>
          </div>
          <button class="btn primary" id="approval-gen-${safeId}" onclick="approvalGenerateLink('${safeId}')">🔗 Generate Link</button>
        </div>` : `
        <div style="margin-bottom:12px;">
          <div class="label mb8">Approval link</div>
          <div class="approval-link-row">
            <span class="approval-link-url">${safeText(meta.approval_url || '')}</span>
            <button class="btn sm" onclick="approvalCopyLink('${safeId}')">Copy</button>
          </div>
        </div>
        <div style="${pubDisabled ? 'opacity:.45;pointer-events:none;' : ''}">
          ${pubDisabled ? `<div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--subtle);margin-bottom:10px;">Publishing unlocks once reviewer responds.</div>` : ''}
          <div class="label mb8">Publish to</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <select id="approval-ch-${safeId}" class="input" style="flex:1;min-width:160px;font-size:13px;"></select>
            <button class="btn sm" onclick="approvalPublish('${safeId}','draft')">Draft</button>
            <button class="btn sm success" onclick="approvalPublish('${safeId}','queue')">Queue</button>
            <button class="btn sm primary" onclick="approvalToggleSchedule('${safeId}')">📅 Schedule</button>
          </div>
          <div id="approval-sched-${safeId}" style="display:none;margin-top:8px;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <input type="date" id="approval-date-${safeId}" class="input" style="flex:1;" />
              <input type="time" id="approval-time-${safeId}" class="input" style="max-width:120px;" value="09:00" />
              <button class="btn sm primary" onclick="approvalPublish('${safeId}','schedule')">Send</button>
              <button class="btn sm ghost" onclick="document.getElementById('approval-sched-${safeId}').style.display='none'">✕</button>
            </div>
          </div>
        </div>`}
      <div id="approval-status-${safeId}" style="font-size:12px;color:var(--muted);margin-top:8px;font-family:'DM Mono',monospace;min-height:16px;"></div>
    </div>`;

  setTimeout(() => {
    const sel = document.getElementById(`approval-ch-${safeId}`);
    if (sel) {
      sel.innerHTML = '';
      if (state.channels.length) {
        state.channels.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.displayName || c.name} (${c.service})`; if (c.id === meta.channel_id) o.selected = true; sel.appendChild(o); });
      } else { const o = document.createElement('option'); o.value = ''; o.textContent = '↻ Load channels from Buffer first'; sel.appendChild(o); }
    }
    const di = document.getElementById(`approval-date-${safeId}`); if (di) di.value = new Date().toISOString().slice(0,10);
  }, 0);

  listEl.appendChild(card);
}

function getApprovalDraftId(safeId) {
  const card = document.querySelector(`.approval-card[data-safe-id="${CSS.escape(safeId)}"]`);
  return card?.dataset?.draftId || safeId;
}

window.approvalGenerateLink = async function (safeId) {
  const draftId = getApprovalDraftId(safeId);
  const meta = getApprovalMeta(draftId); if (!meta) { showToast('Record not found', 'error'); return; }
  const btn = document.getElementById(`approval-gen-${safeId}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
  try {
    const res = await fetch('/.netlify/functions/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', post: { content: meta.content || '', platform: meta.platform || null, image_url: meta.image_url || null } }) });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    setApprovalMeta(draftId, { ...meta, link_generated: true, locked: true, approval_uuid: data.id, approval_url: data.url });
    showToast('Approval link generated!', 'success'); loadApprovals();
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🔗 Generate Link'; }
  }
};

window.approvalCopyLink = function (safeId) {
  const draftId = getApprovalDraftId(safeId); const meta = getApprovalMeta(draftId);
  if (!meta?.approval_url) { showToast('No link available', 'error'); return; }
  navigator.clipboard.writeText(meta.approval_url); showToast('Link copied!', 'success');
};

window.approvalRemove = function (safeId) {
  const draftId = getApprovalDraftId(safeId);
  if (!confirm('Remove this approval entry? The Buffer draft is not deleted.')) return;
  clearApprovalMeta(draftId);
  const card = document.querySelector(`[data-draft-id="${CSS.escape(draftId)}"]`);
  if (card) card.remove(); else loadApprovals();
  showToast('Removed');
};

window.approvalToggleSchedule = function (safeId) {
  const panel = document.getElementById(`approval-sched-${safeId}`);
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};

window.approvalPublish = async function (safeId, action) {
  const draftId = getApprovalDraftId(safeId); const meta = getApprovalMeta(draftId);
  if (!meta) { showToast('Record not found', 'error'); return; }
  const channelId = document.getElementById(`approval-ch-${safeId}`)?.value;
  if (!channelId) { showToast('Select a channel first', 'error'); return; }
  const input = { channelId, text: meta.content || '', schedulingType: 'automatic' };
  if (action === 'draft') { input.mode = 'addToQueue'; input.saveToDraft = true; }
  if (action === 'queue') { input.mode = 'addToQueue'; }
  if (action === 'schedule') {
    const dv = document.getElementById(`approval-date-${safeId}`)?.value;
    const tv = document.getElementById(`approval-time-${safeId}`)?.value || '09:00';
    if (!dv) { showToast('Pick a date first', 'error'); return; }
    input.mode = 'customScheduled'; input.dueAt = `${dv}T${tv}:00.000Z`;
  }
  if (meta.image_url) { if (isVideo(meta.image_url)) input.assets = { videos: [{ url: meta.image_url }] }; else input.assets = { images: [{ url: meta.image_url }] }; }
  const statusEl = document.getElementById(`approval-status-${safeId}`);
  if (statusEl) statusEl.textContent = 'Sending…';
  try {
    const created = await createPost(input);
    clearApprovalMeta(draftId);
    const msg = action === 'draft' ? 'Draft saved.' : action === 'queue' ? 'Added to queue.' : 'Scheduled.';
    showToast(msg, 'success');
    if (created?.post?.dueAt) { appendScheduled(created.post); renderCalendar(); }
    const card = document.querySelector(`[data-draft-id="${CSS.escape(draftId)}"]`);
    if (card) { card.style.opacity = '.4'; card.style.pointerEvents = 'none'; setTimeout(() => card.remove(), 600); }
  } catch (e) {
    const msg = getErrorMessage(e, 'Failed.');
    if (isAuthError(e)) handleAuthFailure(msg);
    if (statusEl) statusEl.textContent = `Failed: ${msg}`;
    showToast('Failed: ' + msg, 'error');
  }
};

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
    content.innerHTML = `
      <div class="reviewer-card">
        ${platform ? `<div style="font-size:10px;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px;border:1px solid var(--border2);border-radius:4px;color:var(--subtle);display:inline-flex;margin-bottom:16px;">${safeText(platform)}</div>` : ''}
        <div style="font-size:15px;line-height:1.75;color:var(--text);white-space:pre-wrap;word-break:break-word;">${safeText(postContent || '')}</div>
        ${imageUrl ? `<img src="${safeText(imageUrl)}" style="width:100%;max-height:360px;object-fit:cover;border-radius:10px;border:1px solid var(--border);margin-top:16px;" />` : ''}
      </div>
      ${comments.length ? `
        <div class="reviewer-card">
          <div style="font-size:11px;font-weight:600;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:14px;">Previous comments</div>
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
    qs('reviewerConfirmDesc').textContent = isApproved
      ? 'Approval recorded. The author can now publish.'
      : 'Feedback sent. The author will make revisions and share a new link if needed.';
  } catch (e) {
    if (approveBtn) approveBtn.disabled = false; if (changesBtn) changesBtn.disabled = false;
    if (statusEl) statusEl.textContent = 'Error: ' + e.message;
  }
};

// ── VIEW NAVIGATION ──────────────────────────────────
function activateView(viewId) {
  currentViewId = viewId;
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x.dataset.view === viewId));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === viewId));
  document.querySelectorAll('.mob-tab[data-view]').forEach(t => t.classList.toggle('active', t.dataset.view === viewId));
  if (viewId === 'approvalsView') loadApprovals();
}

// ── SCHEDULE PICKERS ──────────────────────────────────
function buildTimePickers() {
  const h = qs('scheduleHour'), m = qs('scheduleMin'), ap = qs('scheduleAmpm');
  for (let i = 1; i <= 12; i++) { const o = document.createElement('option'); o.value = i; o.textContent = String(i).padStart(2, '0'); h.appendChild(o); }
  for (let i = 0; i < 60; i += 5) { const o = document.createElement('option'); o.value = i; o.textContent = String(i).padStart(2, '0'); m.appendChild(o); }
  ['AM','PM'].forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; ap.appendChild(o); });
  const now = new Date(); h.value = (now.getHours() % 12) || 12; m.value = 0; ap.value = now.getHours() >= 12 ? 'PM' : 'AM';
}

function syncComposerWhen() {
  const d = qs('scheduleDate').value; if (!d) { qs('composerWhen').value = ''; return; }
  let h = parseInt(qs('scheduleHour').value); const m = parseInt(qs('scheduleMin').value); const ap = qs('scheduleAmpm').value;
  if (ap === 'PM' && h !== 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
  qs('composerWhen').value = `${d}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`;
}

// ── INIT ──────────────────────────────────────────────
function init() {
  // Reviewer page check
  const approveParam = new URLSearchParams(location.search).get('approve');
  if (approveParam) { renderReviewerPage(approveParam); return; }
  if (renderSharedFromHash()) return;

  loadStoredToken();
  loadTemplates();
  loadBuckets();
  ensureBuckets();
  initTemplateSelectors();
  renderTemplates();
  buildTimePickers();
  qs('scheduleDate').value = new Date().toISOString().slice(0, 10);
  qs('scheduleDate').min = new Date().toISOString().slice(0, 10);
  renderCalendar();
  activateView('calendarView');

  // Token management
  qs('manageTokenBtn').onclick = () => {
    tokenPanelOpen = !tokenPanelOpen;
    qs('tokenPanel').style.display = tokenPanelOpen ? 'block' : 'none';
    qs('manageTokenBtn').textContent = tokenPanelOpen ? 'Done' : 'Manage token';
  };
  qs('revealTokenBtn').onclick = () => {
    tokenPanelOpen = true; qs('tokenPanel').style.display = 'block';
    qs('manageTokenBtn').textContent = 'Done';
    const inp = qs('tokenInput'); inp.type = 'text'; inp.focus();
  };
  qs('saveTokenBtn').onclick = saveToken;
  qs('clearTokenBtn').onclick = () => { qs('tokenInput').value = ''; saveToken(); };

  // Sync
  qs('syncBtn').onclick = () => syncBuffer({ force: true });
  if (bufferToken) syncBuffer();

  // Navigation
  document.querySelectorAll('[data-view]').forEach(b => {
    b.onclick = () => activateView(b.dataset.view);
  });
  populateBucketRoleSelect();
  renderBuckets();
  renderBucketSummary();
  renderComposerBuckets();
  qs('bucketRoleSelect').onchange = e => { state.bucketRole = e.target.value; state.contentBuckets = defaultBucketsForRole(state.bucketRole); persistBuckets(); renderBuckets(); renderBucketSummary(); renderComposerBuckets(); };
  qs('bucketAudienceInput').addEventListener('input', e => { state.bucketAudience = e.target.value; persistBuckets(); });
  qs('bucketComposeAllBtn').onclick = () => sendBucketsToComposer('all');
  qs('bucketCopyPromptBtn').onclick = () => { navigator.clipboard.writeText(buildBucketPrompt()); showToast('AI prompt copied', 'success'); };
  qs('contentBucketsResetBtn').onclick = resetBuckets;
  const cbrm = qs('contentBucketsResetMob'); if (cbrm) cbrm.onclick = resetBuckets;
  qs('composerOpenBucketsBtn').onclick = () => activateView('contentBucketsView');
  qs('composerInsertBucketsBtn').onclick = () => sendBucketsToComposer('all');
  qs('closeSharedDay').onclick = () => closeModal('sharedDayModal');

  // Calendar
  qs('prevMonth').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCalendar(); detectQueueGaps(); };
  qs('nextMonth').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCalendar(); detectQueueGaps(); };
  qs('todayMonth').onclick = () => { state.month = new Date(); renderCalendar(); detectQueueGaps(); };
  qs('closeNote').onclick = () => closeModal('noteModal');
  qs('saveNoteBtn').onclick = saveNote;
  qs('deleteNoteBtn').onclick = deleteNote;
  qs('sendNoteToDraftBtn').onclick = sendNoteToDraft;
  qs('shareMonthBtn').onclick = () => { shareSnapshot(); openModal('shareModal'); };
  qs('closeShare').onclick = () => closeModal('shareModal');
  qs('includeNotes').onchange = shareSnapshot;
  qs('generateShare').onclick = shareSnapshot;
  qs('copyShare').onclick = () => navigator.clipboard.writeText(qs('shareLink').value || '');

  // Composer
  const editor = qs('composerEditor');
  editor.addEventListener('input', () => {
    const text = editorToText(editor.innerHTML);
    const ch = state.channels.find(c => c.id === qs('composerChannel')?.value);
    const svc = (ch?.service || '').toLowerCase();
    let limit = null;
    if (svc.includes('twitter') || svc.includes('x-')) limit = 280;
    else if (svc.includes('thread')) limit = 500;
    else if (svc.includes('linkedin')) limit = 3000;
    else if (svc.includes('instagram')) limit = 2200;
    const cc = qs('charCount');
    if (limit) {
      const rem = limit - text.length;
      cc.textContent = `${text.length}/${limit}`;
      cc.className = 'char-count' + (rem < 0 ? ' over' : rem < 50 ? ' warn' : '');
    } else {
      cc.textContent = `${text.length} chars`;
      cc.className = 'char-count' + (text.length > 500 ? ' warn' : '');
    }
    const showClear = text.length > 0;
    const ccBtn = qs('composerClearBtn'); if (ccBtn) ccBtn.style.display = showClear ? 'inline-flex' : 'none';
  });
  qs('charCount').textContent = '0 chars';
  qs('composerChannel').addEventListener('change', updateComposerButtonStates);

  qs('composerClearBtn').onclick = () => {
    if (editorToText(editor.innerHTML) && !confirm('Clear composer?')) return;
    editor.innerHTML = ''; editor.dispatchEvent(new Event('input'));
    qs('composerStatus').textContent = ''; clearMedia();
  };

  document.querySelectorAll('[data-cmd]').forEach(btn => btn.onclick = () => composerFormat(btn.dataset.cmd));
  qs('composerDraft').onclick = () => composerSend('draft');
  qs('composerQueue').onclick = () => composerSend('queue');
  qs('composerScheduleSend').onclick = () => composerSend('schedule');
  qs('composerScheduleToggle').onclick = () => {
    qs('schedulePanel').classList.add('open');
    qs('composerScheduleToggle').style.display = 'none';
  };
  qs('scheduleCancel').onclick = () => {
    qs('schedulePanel').classList.remove('open');
    qs('composerScheduleToggle').style.display = 'inline-flex';
  };
  ['scheduleDate','scheduleHour','scheduleMin','scheduleAmpm'].forEach(id => qs(id).addEventListener('change', syncComposerWhen));
  syncComposerWhen();
  updateComposerButtonStates();
  window.addEventListener('postiq:synced', updateComposerButtonStates);

  // Template insert
  qs('insertTemplateBtn').onclick = () => { renderTemplatePicker(); openModal('templatePickerModal'); };
  qs('saveAsTemplateBtn').onclick = () => {
    const sel = window.getSelection(); const text = (sel?.toString() || '').trim();
    if (!text) { showToast('Select text in the editor first', 'error'); return; }
    qs('templateBody').value = text; openTemplateModal();
  };

  // Ref pin
  qs('refPinDismiss').onclick = () => { qs('refPin').style.display = 'none'; };

  // Media
  qs('mediaToggleBtn').onclick = () => { qs('mediaPanel').classList.contains('open') ? closeMediaPanel() : openMediaPanel(); };
  qs('mediaToggleOff').onclick = () => { qs('mediaPanel').classList.contains('open') ? closeMediaPanel() : openMediaPanel(); };
  qs('mediaSummaryClear').onclick = () => { clearMedia(); showToast('Media removed'); };
  document.querySelectorAll('.media-tab').forEach(t => t.onclick = () => switchMediaTab(t.dataset.mtab));

  // Upload
  const zone = qs('uploadZone'), fi = qs('uploadFileInput');
  zone.onclick = e => { if (!e.target.closest('#uploadBrowseBtn') && !e.target.closest('#uploadResult')) fi.click(); };
  qs('uploadBrowseBtn').onclick = e => { e.stopPropagation(); fi.click(); };
  fi.onchange = () => { if (fi.files[0]) handleUploadFile(fi.files[0]); };
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--brand)'; zone.style.background = 'var(--brand-dim)'; });
  zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) { zone.style.borderColor = 'var(--border2)'; zone.style.background = ''; } });
  zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = 'var(--border2)'; zone.style.background = ''; if (e.dataTransfer.files[0]) handleUploadFile(e.dataTransfer.files[0]); });
  document.addEventListener('paste', e => {
    if (!qs('mediaPanel').classList.contains('open')) return;
    const active = document.querySelector('.media-tab.active')?.dataset?.mtab;
    if (active !== 'upload') return;
    const img = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
    if (img) handleUploadFile(img.getAsFile());
  });
  qs('uploadReplaceBtn').onclick = e => { e.stopPropagation(); resetUploadTab(); fi.click(); };
  qs('uploadClearBtn').onclick  = e => { e.stopPropagation(); resetUploadTab(); clearMedia(); showToast('Media removed'); };

  // URL media
  const urlInp = qs('mediaUrlInput'); const urlClear = qs('mediaUrlClear');
  urlInp.addEventListener('input', () => {
    const url = urlInp.value.trim();
    urlClear.style.display = url ? 'inline-flex' : 'none';
    const vts = qs('videoThumbSection'), up = qs('urlPreview'), ui = qs('urlPreviewImg'), ut = qs('urlPreviewType');
    if (url) {
      if (isVideo(url)) {
        ui.style.display = 'none'; vts.style.display = 'block';
        ut.textContent = '🎬 Video URL'; up.style.display = 'flex';
      } else {
        ui.src = url; ui.style.display = 'block'; vts.style.display = 'none';
        ut.textContent = 'Image URL'; up.style.display = 'flex';
      }
      applyMedia(url, 'url', qs('videoThumbUrl')?.value?.trim() || '');
    } else { up.style.display = 'none'; clearMedia(); }
  });
  urlClear.onclick = () => { urlInp.value = ''; urlInp.dispatchEvent(new Event('input')); };
  const vtu = qs('videoThumbUrl');
  if (vtu) vtu.addEventListener('input', () => { mediaState.videoThumbUrl = vtu.value.trim(); });

  // Unsplash
  qs('unsplashSearchBtn').onclick = runUnsplashSearch;
  qs('unsplashQuery').addEventListener('keydown', e => { if (e.key === 'Enter') runUnsplashSearch(); });

  // Templates
  qs('newTemplateBtn').onclick = () => openTemplateModal();
  qs('closeTemplateModal').onclick = () => closeModal('templateModal');
  qs('cancelTemplateBtn').onclick = () => closeModal('templateModal');
  qs('saveTemplateBtn').onclick = saveTemplate;
  qs('closeTemplatePicker').onclick = () => closeModal('templatePickerModal');
  qs('templateSearch').addEventListener('input', e => { state.templateSearch = e.target.value; renderTemplates(); });
  qs('templatePlatformFilter').onchange = e => { state.templatePlatform = e.target.value; renderTemplates(); };
  qs('pickerSearch').addEventListener('input', renderTemplatePicker);
  qs('pickerType').onchange = renderTemplatePicker;

  // Approvals
  qs('approvalsRefreshBtn').onclick = loadApprovals;
  document.querySelectorAll('[data-afilter]').forEach(pill => {
    pill.onclick = () => {
      document.querySelectorAll('[data-afilter]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const filter = pill.dataset.afilter;
      document.querySelectorAll('#approvalsList .approval-card').forEach(card => {
        const bar = card.querySelector('.approval-card-status-bar');
        if (!bar) return;
        const status = bar.classList.contains('approved') ? 'approved' : bar.classList.contains('changes') ? 'changes' : 'pending';
        card.style.display = (filter === 'all' || status === filter) ? '' : 'none';
      });
    };
  });

  // ── ZEN MODE ──────────────────────────────────
  let zenActive = false;

  function enterZen() {
    zenActive = true;
    if (typeof setComposerMode === 'function') setComposerMode('compose');
    document.body.classList.add('zen-active');
    activateView('composerView');
    // Sync the zen channel select with the main one
    const mainSel = qs('composerChannel');
    const zenSel = qs('zenChannel');
    zenSel.innerHTML = mainSel.innerHTML;
    zenSel.value = mainSel.value;
    qs('composerEditor').focus();
    qs('zenToggleBtn').title = 'Exit zen mode';
  }

  function exitZen() {
    zenActive = false;
    document.body.classList.remove('zen-active');
    qs('zenToggleBtn').title = 'Zen mode — distraction-free writing';
  }

  qs('zenToggleBtn').onclick = () => zenActive ? exitZen() : enterZen();
  qs('zenExit').onclick = exitZen;

  // Sync zen channel back to main when changed
  qs('zenChannel').addEventListener('change', () => {
    qs('composerChannel').value = qs('zenChannel').value;
    updateComposerButtonStates();
  });

  // Zen send buttons proxy to the real composer send
  qs('zenDraft').onclick    = () => composerSend('draft');
  qs('zenQueue').onclick    = () => composerSend('queue');
  qs('zenSchedule').onclick = () => {
    exitZen();
    qs('schedulePanel').classList.add('open');
    qs('composerScheduleToggle').style.display = 'none';
  };

  // Escape key exits zen
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && zenActive) {
      // Only exit zen if no modals are open
      if (!document.querySelector('.modal.open')) { exitZen(); return; }
    }
  }, true); // capture phase so it fires before modal handler

  // Settings
  qs('openSettings').onclick = () => openModal('settingsModal');
  qs('closeSettings').onclick = () => closeModal('settingsModal');
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const panel = 'settingsPanel' + tab.dataset.stab.charAt(0).toUpperCase() + tab.dataset.stab.slice(1);
      document.querySelectorAll('.settings-panel').forEach(p => p.classList.toggle('active', p.id === panel));
    };
  });

  // Modal overlay close
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal.id); });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.modal.open')];
    if (open.length) closeModal(open[open.length - 1].id);
  });

  // Mobile drawer
  function openMobDrawer() {
    // Sync status before opening
    const syncEl = qs('syncStatus');
    const ms = qs('mobSyncStatus'); if (ms && syncEl) ms.textContent = syncEl.textContent;
    const connected = !!bufferToken;
    const md = qs('mobConnDot'); if (md) md.classList.toggle('on', connected);
    const ml = qs('mobConnLabel'); if (ml) ml.textContent = connected ? 'Connected' : 'Not connected';
    qs('mobDrawer').classList.add('open');
    qs('mobBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMobDrawer() {
    qs('mobDrawer').classList.remove('open');
    qs('mobBackdrop').classList.remove('open');
    document.body.style.overflow = '';
  }
  qs('mobBackdrop').onclick = closeMobDrawer;
  // All three "…" menu buttons on mobile view headers open the drawer
  ['mobMenuBtn','mobMenuBtnDraft','mobMenuBtnApprovals'].forEach(id => {
    const btn = qs(id); if (btn) btn.onclick = openMobDrawer;
  });
  qs('mobSyncBtn').onclick = () => { syncBuffer({ force: true }); closeMobDrawer(); };
  let mobTokenOpen = false;
  qs('mobManageTokenBtn').onclick = () => {
    mobTokenOpen = !mobTokenOpen;
    qs('mobTokenPanel').style.display = mobTokenOpen ? 'block' : 'none';
    qs('mobManageTokenBtn').textContent = mobTokenOpen ? '🔑 Done' : '🔑 Manage Buffer token';
    if (mobTokenOpen && bufferToken) qs('mobTokenInput').value = bufferToken;
  };
  qs('mobSaveTokenBtn').onclick = () => {
    const t = qs('mobTokenInput').value.trim();
    const mode = [...document.querySelectorAll('input[name="mobTokenMode"]')].find(r => r.checked)?.value || 'session';
    const ok = setBufferToken(t, { mode, messageEl: qs('mobTokenMsg') });
    if (ok) { qs('tokenInput').value = t; syncBuffer({ force: true }); closeMobDrawer(); }
  };
  qs('mobClearTokenBtn').onclick = () => { qs('mobTokenInput').value = ''; setBufferToken('', { mode: 'session', messageEl: qs('mobTokenMsg') }); };
  qs('mobOpenSettings').onclick = () => { closeMobDrawer(); openModal('settingsModal'); };

  // Mobile-only share button for calendar
  const smb = qs('shareMonthBtnMob'); if (smb) smb.onclick = () => { shareSnapshot(); openModal('shareModal'); };

  // Mobile clear button for composer
  const ccbm = qs('composerClearBtnMob');
  if (ccbm) {
    ccbm.onclick = () => {
      if (editorToText(editor.innerHTML) && !confirm('Clear composer?')) return;
      editor.innerHTML = ''; editor.dispatchEvent(new Event('input'));
      qs('composerStatus').textContent = ''; clearMedia();
    };
  }

  // Keep mob clear button visibility in sync
  editor.addEventListener('input', () => {
    const hasText = !!editorToText(editor.innerHTML);
    const ccbmBtn = qs('composerClearBtnMob'); if (ccbmBtn) ccbmBtn.style.display = hasText ? 'inline-flex' : 'none';
  });

  // Mobile approvals refresh
  const arbm = qs('approvalsRefreshBtnMob'); if (arbm) arbm.onclick = loadApprovals;
  // Mobile new template
  const ntbm = qs('newTemplateBtnMob'); if (ntbm) ntbm.onclick = () => openTemplateModal();

  // Mobile More button — opens drawer
  const mobMoreBtn = qs('mobMoreBtn');
  if (mobMoreBtn) mobMoreBtn.onclick = openMobDrawer;

  // ── COMPOSER MODE TABS (Compose / Split) ──────────────
  function setComposerMode(mode) {
    document.querySelectorAll('.composer-mode-tab').forEach(t => {
      const isActive = t.dataset.cmode === mode;
      t.style.color = isActive ? 'var(--brand)' : 'var(--muted)';
      t.style.borderBottomColor = isActive ? 'var(--brand)' : 'transparent';
    });
    qs('composeModePanel').style.display = mode === 'compose' ? 'contents' : 'none';
    qs('splitModePanel').style.display  = mode === 'split'   ? 'block'    : 'none';
    if (mode === 'split') initSplitMode();
  }
  document.querySelectorAll('.composer-mode-tab').forEach(t => {
    t.onclick = () => setComposerMode(t.dataset.cmode);
  });

  // ── THREAD SPLITTER ────────────────────────────────────
  let threadParts = [];
  let threadNumbered = false;
  let splitInited = false;

  function splitThreadText(text, max = 280) {
    const parts = []; let left = text.trim();
    while (left.length > max) {
      let cut = left.lastIndexOf('\n', max);
      if (cut < 80) cut = left.lastIndexOf(' ', max);
      if (cut < 80) cut = max;
      parts.push(left.slice(0, cut).trim()); left = left.slice(cut).trim();
    }
    if (left) parts.push(left);
    return parts;
  }

  function renderThreadParts() {
    const out = qs('threadOut'); const empty = qs('threadEmpty');
    const actions = qs('threadActions'); const whenRow = qs('threadWhenRow');
    if (!threadParts.length) {
      out.innerHTML = ''; empty.style.display = 'flex';
      if (actions) actions.style.display = 'none';
      if (whenRow) whenRow.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    if (actions) actions.style.display = 'flex';
    out.innerHTML = '';
    threadParts.forEach((p, i) => {
      const label = threadNumbered ? `${i+1}/${threadParts.length} ` : '';
      const full = label + p;
      const over = full.length > 280;
      const div = document.createElement('div');
      div.className = 'card';
      div.style.cssText = 'padding:12px;margin-bottom:0;';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:11px;font-family:'DM Mono',monospace;color:var(--brand);background:var(--brand-dim);border:1px solid var(--brand-glow);padding:2px 7px;border-radius:4px;">Part ${i+1}</span>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:11px;font-family:'DM Mono',monospace;color:${over?'var(--red)':'var(--subtle)'};">${full.length}/280</span>
            <button class="btn sm ghost" data-pi="${i}">Copy</button>
          </div>
        </div>
        <textarea data-ti="${i}" style="min-height:80px;font-size:13px;">${p}</textarea>`;
      div.querySelector('[data-pi]').onclick = () => { navigator.clipboard.writeText(full); showToast('Part copied'); };
      div.querySelector('[data-ti]').addEventListener('input', e => {
        threadParts[+e.target.dataset.ti] = e.target.value;
        const span = e.target.closest('.card').querySelector('span[style*="DM Mono"]');
        const lbl = threadNumbered ? `${i+1}/${threadParts.length} ` : '';
        const len = (lbl + e.target.value).length;
        if (span) { span.textContent = `${len}/280`; span.style.color = len > 280 ? 'var(--red)' : 'var(--subtle)'; }
      });
      out.appendChild(div);
    });
  }

  function initSplitMode() {
    if (splitInited) return; splitInited = true;

    // Populate channel selector
    const tch = qs('threadChannel');
    if (tch) {
      tch.innerHTML = '';
      const xChs = state.channels.filter(c => { const s = (c.service||'').toLowerCase(); return s.includes('twitter')||s.includes('thread')||s.includes('x-'); });
      if (xChs.length) {
        xChs.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.displayName||c.name} (${c.service})`; tch.appendChild(o); });
      } else if (state.channels.length) {
        state.channels.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.displayName||c.name} (${c.service})`; tch.appendChild(o); });
      } else {
        const o = document.createElement('option'); o.value = ''; o.textContent = '↻ Load channels from Buffer'; tch.appendChild(o);
      }
    }

    qs('splitBtn').onclick = () => {
      const text = qs('threadInput').value.trim();
      if (!text) { showToast('Add some text first', 'error'); return; }
      threadParts = splitThreadText(text);
      renderThreadParts();
      showToast(`${threadParts.length} thread parts`, 'success');
    };

    qs('splitSampleBtn').onclick = () => {
      qs('threadInput').value = 'PostIQ helps Buffer users move faster. Start with one big idea, split it into clear thread parts, refine each part, and send a cleaner post flow to Buffer — drafts, queued, or scheduled. The whole thing in under two minutes.';
      qs('splitBtn').click();
    };

    const toggle = qs('threadNumberToggle');
    if (toggle) toggle.onchange = e => { threadNumbered = e.target.checked; renderThreadParts(); };

    qs('copyAllPartsBtn').onclick = () => {
      if (!threadParts.length) return;
      const text = threadParts.map((p,i) => threadNumbered ? `${i+1}/${threadParts.length} ${p}` : p).join('\n\n');
      navigator.clipboard.writeText(text); showToast('All parts copied', 'success');
    };

    async function sendThread(action) {
      if (!threadParts.length) { qs('threadStatus').textContent = 'Split content first.'; return; }
      const channelId = qs('threadChannel')?.value;
      if (!channelId) { qs('threadStatus').textContent = 'Select a channel first.'; return; }
      const parts = threadParts.map((p,i) => threadNumbered ? `${i+1}/${threadParts.length} ${p}` : p);
      const when = qs('threadWhen')?.value;
      const ch = state.channels.find(c => c.id === channelId);
      const svc = (ch?.service||'').toLowerCase();
      const isThreads = svc.includes('thread');
      const metadata = parts.length > 1 ? { metadata: { [isThreads?'threads':'twitter']: isThreads ? { type:'thread', thread: parts.slice(1).map(t=>({text:t})) } : { thread: parts.slice(1).map(t=>({text:t})) } } } : {};
      const input = { channelId, text: parts[0], schedulingType: 'automatic', ...metadata };
      if (action === 'draft')    { input.mode = 'addToQueue'; input.saveToDraft = true; }
      if (action === 'queue')    { input.mode = 'addToQueue'; }
      if (action === 'schedule') {
        if (!when) { qs('threadStatus').textContent = 'Set a date/time first.'; qs('threadWhenRow').style.display = 'block'; return; }
        input.mode = 'customScheduled'; input.dueAt = when;
      }
      qs('threadStatus').textContent = 'Sending…';
      try {
        await createPost(input);
        const msg = action==='draft'?'Draft saved.':action==='queue'?'Added to queue.':'Scheduled.';
        qs('threadStatus').textContent = msg; showToast(msg, 'success');
      } catch(e) {
        const msg = getErrorMessage(e, 'Failed.');
        if (isAuthError(e)) handleAuthFailure(msg);
        qs('threadStatus').textContent = `Failed: ${msg}`;
      }
    }

    qs('draftThreadBtn').onclick    = () => sendThread('draft');
    qs('queueThreadBtn').onclick    = () => sendThread('queue');
    qs('scheduleThreadBtn').onclick = () => { qs('threadWhenRow').style.display = 'block'; };

    window.addEventListener('postiq:synced', () => {
      // Re-populate channels after sync
      const tch = qs('threadChannel'); if (!tch) return;
      tch.innerHTML = '';
      const xChs = state.channels.filter(c => { const s=(c.service||'').toLowerCase(); return s.includes('twitter')||s.includes('thread')||s.includes('x-'); });
      const pool = xChs.length ? xChs : state.channels;
      pool.forEach(c => { const o=document.createElement('option'); o.value=c.id; o.textContent=`${c.displayName||c.name} (${c.service})`; tch.appendChild(o); });
    });
  }

  // ── TRENDING ──────────────────────────────────────────
  const trendingState = { src: 'reddit', sub: 'socialmedia', hn: 'topstories' };
  const DEFAULT_SUBS = ['socialmedia','entrepreneur','marketing','business'];

  function renderSubPills() {
    const wrap = qs('trendingSubPills'); if (!wrap) return;
    wrap.innerHTML = '';
    DEFAULT_SUBS.forEach(sub => {
      const btn = document.createElement('button');
      btn.style.cssText = `padding:5px 12px;border-radius:20px;border:1px solid var(--border2);font-size:12px;font-family:'DM Mono',monospace;cursor:pointer;transition:all .12s;background:${trendingState.sub===sub?'var(--brand-dim)':'var(--surface)'};color:${trendingState.sub===sub?'var(--brand)':'var(--muted)'};border-color:${trendingState.sub===sub?'var(--brand-glow)':'var(--border2)'};`;
      btn.textContent = 'r/' + sub;
      btn.onclick = () => { trendingState.sub = sub; renderSubPills(); loadReddit(); };
      wrap.appendChild(btn);
    });
  }

  function timeAgo(ts) {
    const d = (Date.now() - ts) / 1000;
    if (d < 3600) return `${Math.floor(d/60)}m ago`;
    if (d < 86400) return `${Math.floor(d/3600)}h ago`;
    return `${Math.floor(d/86400)}d ago`;
  }

  function renderTrendingItems(containerId, items) {
    const list = qs(containerId); list.innerHTML = '';
    if (!items.length) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">📈</div><div class="empty-title">Nothing loaded</div><div class="empty-desc">Try refreshing or switching to a different source.</div></div>'; return; }
    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.style.cssText = 'display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;transition:border-color .12s;';
      el.innerHTML = `
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--subtle);width:22px;flex-shrink:0;padding-top:2px;font-weight:600;">${i+1}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:500;color:var(--text);line-height:1.4;margin-bottom:5px;">${safeText(item.title)}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--amber);font-weight:700;">▲ ${(item.score||0).toLocaleString()}</span>
            <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);">💬 ${item.comments||0}</span>
            <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--brand);">${safeText(item.sub||'')}</span>
            <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);">${item.age||''}</span>
          </div>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn sm" style="font-size:11px;" data-inspire="${i}">→ Draft from this</button>
            <a class="btn sm ghost" href="${safeText(item.url)}" target="_blank" rel="noopener" style="font-size:11px;">↗ Source</a>
          </div>
        </div>`;
      el.onmouseenter = () => { el.style.borderColor = 'var(--border2)'; };
      el.onmouseleave = () => { el.style.borderColor = 'var(--border)'; };
      el.querySelector('[data-inspire]').onclick = () => {
        // Pin as reference in composer
        qs('refPinTitle').textContent = item.title;
        qs('refPinBody').textContent = item.body ? item.body.slice(0,200) : '';
        qs('refPin').style.display = 'block';
        activateView('composerView');
        showToast('Pinned as reference — write your take', 'info');
      };
      list.appendChild(el);
    });
  }

  async function loadReddit() {
    const statusEl = qs('trendingRedditStatus'); const listEl = qs('trendingRedditList');
    if (!statusEl || !listEl) return;
    statusEl.textContent = 'Loading…'; listEl.innerHTML = '';
    try {
      const res = await fetch(`https://www.reddit.com/r/${trendingState.sub}/hot.json?limit=25`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const posts = (data?.data?.children||[]).filter(p => !p.data.stickied);
      statusEl.textContent = `${posts.length} posts from r/${trendingState.sub}`;
      renderTrendingItems('trendingRedditList', posts.map((p,i) => ({
        title: p.data.title, score: p.data.score, comments: p.data.num_comments,
        sub: `r/${p.data.subreddit}`, url: `https://reddit.com${p.data.permalink}`,
        body: p.data.selftext, age: timeAgo(p.data.created_utc * 1000),
      })));
    } catch(e) { statusEl.textContent = 'Failed to load — Reddit may be blocking. Try again.'; }
  }

  async function loadHN() {
    const statusEl = qs('trendingHNStatus'); const listEl = qs('trendingHNList');
    if (!statusEl || !listEl) return;
    statusEl.textContent = 'Loading…'; listEl.innerHTML = '';
    try {
      const ids = await fetch(`https://hacker-news.firebaseio.com/v0/${trendingState.hn}.json`).then(r=>r.json());
      const stories = await Promise.all(ids.slice(0,20).map(id => fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r=>r.json())));
      statusEl.textContent = `${stories.length} stories from Hacker News`;
      renderTrendingItems('trendingHNList', stories.filter(s=>s?.title).map((s,i) => ({
        title: s.title, score: s.score, comments: s.descendants||0,
        sub: s.by ? `by ${s.by}` : 'HN', url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
        age: timeAgo(s.time * 1000),
      })));
    } catch(e) { statusEl.textContent = 'Failed to load Hacker News.'; }
  }

  function initTrending() {
    renderSubPills();

    // Source tabs
    document.querySelectorAll('.trending-src-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.trending-src-tab').forEach(t => {
          t.style.color = 'var(--muted)'; t.style.borderBottomColor = 'transparent';
        });
        tab.style.color = 'var(--brand)'; tab.style.borderBottomColor = 'var(--brand)';
        trendingState.src = tab.dataset.tsrc;
        qs('trendingRedditPanel').style.display = trendingState.src==='reddit' ? 'block' : 'none';
        qs('trendingHNPanel').style.display     = trendingState.src==='hn'     ? 'block' : 'none';
        if (trendingState.src==='hn') loadHN();
      };
    });

    // HN sub tabs
    document.querySelectorAll('.trending-hn-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.trending-hn-tab').forEach(t => {
          t.style.background='var(--surface)'; t.style.color='var(--muted)'; t.style.borderColor='var(--border2)';
        });
        tab.style.background='var(--brand-dim)'; tab.style.color='var(--brand)'; tab.style.borderColor='var(--brand-glow)';
        trendingState.hn = tab.dataset.hn; loadHN();
      };
    });

    // Custom sub
    qs('trendingGoSub').onclick = () => {
      const val = qs('trendingCustomSub').value.trim().replace(/^r\//,'');
      if (!val) return;
      if (!DEFAULT_SUBS.includes(val)) DEFAULT_SUBS.push(val);
      trendingState.sub = val; renderSubPills(); loadReddit();
      qs('trendingCustomSub').value = '';
    };
    qs('trendingCustomSub').addEventListener('keydown', e => { if (e.key==='Enter') qs('trendingGoSub').click(); });

    // Refresh buttons
    ['trendingRefreshBtn','trendingRefreshMob','trendingRefreshReddit'].forEach(id => {
      const btn = qs(id); if (btn) btn.onclick = () => { if (trendingState.src==='reddit') loadReddit(); else loadHN(); };
    });
    const hnRefBtn = qs('trendingRefreshHN'); if (hnRefBtn) hnRefBtn.onclick = loadHN;

    // Load on first visit
    loadReddit();
  }

  // Init trending when view activates (lazy)
  let trendingInited = false;
  const origActivateView = activateView;
  window.activateView = function(viewId) {
    origActivateView(viewId);
    if (viewId === 'trendingView' && !trendingInited) { trendingInited = true; initTrending(); }
    if (viewId === 'contentBucketsView') { renderBuckets(); renderBucketSummary(); }
  };

  // Also update settings guide entry
  const guidePanel = qs('settingsPanelGuide');
  if (guidePanel && !guidePanel.querySelector('[data-guide-trending]')) {
    const bucketsEntry = document.createElement('div');
    bucketsEntry.innerHTML = `<div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:14px;margin-bottom:6px;">🧠 Content Buckets</div><p style="font-size:13px;color:var(--muted);line-height:1.65;">Build repeatable content lanes using the five-part framework: Teach, Share, Show, Tell, and Prove. Save your buckets locally, then push their starter ideas straight into Draft whenever you need a spark.</p>`;
    const trendingEntry = document.createElement('div');
    trendingEntry.dataset.guideTrending = '1';
    trendingEntry.innerHTML = `<div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:14px;margin-bottom:6px;">📈 Trending</div><p style="font-size:13px;color:var(--muted);line-height:1.65;">Browse hot Reddit posts by subreddit or Hacker News stories for post inspiration. Click "Draft from this" on any story to pin it as a reference above your Composer editor.</p>`;
    const threadEntry = document.createElement('div');
    threadEntry.innerHTML = `<div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:14px;margin-bottom:6px;">🧵 Split into thread</div><p style="font-size:13px;color:var(--muted);line-height:1.65;">Inside Draft, switch to the Split tab. Paste long-form content, hit Split Thread, and PostIQ breaks it into numbered parts. Edit each part, then queue or schedule the whole thread to Buffer natively.</p>`;
    guidePanel.querySelector('div').appendChild(bucketsEntry);
    guidePanel.querySelector('div').appendChild(trendingEntry);
    guidePanel.querySelector('div').appendChild(threadEntry);
  }

  // Service worker
  if ('serviceWorker' in navigator && location.hostname !== 'localhost' && !location.hostname.includes('claudeusercontent')) {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW:', e));
  }
}

document.addEventListener('DOMContentLoaded', () => { try { init(); } catch (e) { console.error('[PostIQ] init() crashed:', e); const wrap=document.body; const note=document.createElement('div'); note.style.cssText='position:fixed;left:16px;right:16px;top:16px;z-index:9999;background:#fff4f4;border:1px solid #f1b5b5;color:#8a1f1f;padding:12px 14px;border-radius:10px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.12)'; note.textContent='PostIQ hit a local preview/storage error before finishing setup. Try opening it in a browser tab or hosted preview.'; wrap.appendChild(note); } });
</script>

</body>
</html>
