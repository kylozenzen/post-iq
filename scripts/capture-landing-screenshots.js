'use strict';
// Captures the landing-page product screenshots from the real app shell.
// The account, channels, posts and notes are fictional sample data seeded into
// browser storage. All remote requests are blocked; nothing is sent to Buffer.
// Usage: CHROMIUM_PATH=/path/to/chromium node scripts/capture-landing-screenshots.js
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'images', 'product');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404).end(); }
});

// Monday 9 November 2026, 9:00 in the sample account's timezone.
const NOW = new Date('2026-11-09T15:00:00Z');

function seed({ nowIso }) {
  const now = new Date(nowIso);
  const day = offset => { const d = new Date(now); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };
  const at = (offset, hour) => `${day(offset)}T${String(hour).padStart(2, '0')}:00:00Z`;
  const channels = [
    { id: 'sample-ig', displayName: 'Sample Studio', name: 'Sample Studio', service: 'instagram' },
    { id: 'sample-li', displayName: 'Sample Newsletter', name: 'Sample Newsletter', service: 'linkedin' },
  ];
  const post = (id, channelId, offset, hour, text) => ({ id, channelId, dueAt: at(offset, hour), text, status: 'scheduled' });
  const scheduled = [
    post('s1', 'sample-ig', 0, 15, 'Behind the scenes: how this week’s collection came together.'),
    post('s2', 'sample-li', 0, 16, 'Three lessons from our autumn launch.'),
    post('s3', 'sample-ig', 2, 15, 'Studio tour, part two.'),
    post('s4', 'sample-li', 4, 14, 'Newsletter preview: what we are reading.'),
    post('s5', 'sample-ig', 7, 15, 'Customer spotlight: a reader’s workspace.'),
    post('s6', 'sample-li', 9, 14, 'Planning for a quieter December.'),
    post('s7', 'sample-ig', 11, 15, 'Holiday hours and how to reach us.'),
    post('s8', 'sample-ig', -3, 15, 'Weekend reading list.'),
    post('s9', 'sample-li', -5, 14, 'October recap.'),
  ];
  const ts = now.getTime();
  const cache = {
    orgId: { value: 'sample-org', ts },
    channels: { value: channels, ts },
    scheduled: { value: scheduled, ts, coverage: { complete: true, ts, count: scheduled.length } },
    published: { value: [], ts },
  };
  const note = (date, id, text, typeId, label, color, extra = {}) => ({ id, date, text, typeId, label, color, createdAt: now.toISOString(), updatedAt: now.toISOString(), ...extra });
  const notes = {
    [day(1)]: [note(day(1), 'n1', 'Shoot product flat-lays', 'action', 'Planned action', '#0ea5e9')],
    [day(3)]: [note(day(3), 'n2', 'Campaign idea: winter workspace series', 'idea', 'Idea', '#22c55e')],
    [day(8)]: [note(day(8), 'n3', 'Confirm December newsletter topic', 'action', 'Planned action', '#0ea5e9', { completedAt: now.toISOString() })],
    [day(14)]: [note(day(14), 'n4', 'Out of office — keep the queue light', 'reminder', 'Reminder', '#f59e0b')],
  };
  const settings = {
    showQueueGaps: true,
    postingDays: ['MON', 'WED', 'FRI'],
    channelPostingDays: { 'sample-ig': ['MON', 'WED', 'FRI'], 'sample-li': ['MON', 'THU'] },
    channelTargets: { 'sample-ig': 1, 'sample-li': 1 },
    daysOff: [{ channelId: '*', start: day(25), end: day(29) }],
  };
  const notebook = [
    { id: 'bank-1', title: 'Winter workspace series', sourceText: 'A four-part series on how readers set up their desks for winter.', createdAt: now.toISOString(), updatedAt: now.toISOString(), variants: [] },
    { id: 'bank-2', title: 'Year-in-review outline', sourceText: 'Highlights, numbers we are comfortable sharing, and thank-yous.', targetDate: day(10), createdAt: now.toISOString(), updatedAt: now.toISOString(), variants: [] },
    { id: 'bank-3', title: 'Reader questions roundup', sourceText: 'Collect the five most common questions from this month.', createdAt: now.toISOString(), updatedAt: now.toISOString(), variants: [] },
  ];
  const set = (key, value) => localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  set('postiq_buffer_access_token', 'sample-token');
  set('postiq_buffer_token_expires_at', String(ts + 30 * 86400000));
  set('postiq_buffer_cache_v1', cache);
  set('postiq_calendar_notes_v2', notes);
  set('postiqPlanningSettings', settings);
  set('postiq_ob_dismissed', '1');
  set('postiq_ob_complete', '1');
  set('postiq_tour_seen', '1');
  set('postiq_beta_banner_seen_persist', '1');
  sessionStorage.setItem('postiq_beta_banner_seen', '1');
  if (!localStorage.getItem('postiq_notebook_v1')) set('postiq_notebook_v1', notebook);
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const shots = [
    { name: 'calendar-desktop', width: 1440, height: 900, view: 'calendarView' },
    { name: 'queue-health-desktop', width: 1440, height: 1100, view: 'queueHealthView', pace: true },
    { name: 'content-bank-desktop', width: 1440, height: 900, view: 'ideasView' },
    { name: 'calendar-mobile', width: 390, height: 844, view: 'calendarView' },
  ];
  try {
    for (const shot of shots) {
      const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height }, timezoneId: 'UTC', serviceWorkers: 'block' });
      const writes = [];
      await page.clock.install({ time: NOW });
      await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        // Trending is a read-only POST, as in the other browser checks.
        if (request.method() !== 'GET' && url.pathname !== '/.netlify/functions/trending') writes.push(url.pathname);
        if (url.origin !== base) return route.abort();
        if (url.pathname.startsWith('/.netlify/')) return route.fulfill({ json: {} });
        return route.continue();
      });
      await page.addInitScript(seed, { nowIso: NOW.toISOString() });
      await page.goto(`${base}/app.html?view=${shot.view}`);
      await page.waitForFunction(() => window.YourPace && document.getElementById('paceStart').value);
      await page.evaluate(() => document.querySelectorAll('#globalStatusBanner,.beta-banner').forEach(el => el.classList.add('hidden')));
      if (shot.pace) {
        await page.evaluate(() => {
          const C = PostIQCoverage, today = C.dayKey(new Date());
          document.getElementById('paceStart').value = today;
          document.getElementById('paceEnd').value = C.addDays(today, 13);
        });
        await page.locator('#paceCheck').click();
        await page.evaluate(() => { document.activeElement?.blur(); document.querySelectorAll('.main,.view').forEach(el => { el.scrollTop = 0; }); window.scrollTo(0, 0); });
      }
      await page.waitForTimeout(400);
      const file = path.join(outDir, `${shot.name}.png`);
      await page.screenshot({ animations: 'disabled', path: file });
      if (writes.length) throw new Error(`${shot.name}: unexpected network writes ${writes.join(', ')}`);
      console.log(`Wrote ${path.relative(root, file)}`);
      await page.close();
    }
    await captureShareImage(browser, base);
  } finally { await browser.close(); }
}

// Social preview (postiq-og.png, 1200×630) built from the calendar screenshot.
async function captureShareImage(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.setContent(`<!doctype html><html><head><base href="${base}/"><style>
    *{box-sizing:border-box;margin:0}
    body{width:1200px;height:630px;overflow:hidden;background:#f2efe6;font-family:Lato,system-ui,sans-serif;color:#171713;position:relative;
      background-image:linear-gradient(#ded7c7 1px,transparent 1px),linear-gradient(90deg,#ded7c7 1px,transparent 1px);background-size:50px 50px}
    .copy{position:absolute;left:64px;top:72px;width:470px}
    .eyebrow{font:500 15px 'DM Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:#b52c20;margin-bottom:26px}
    h1{font:800 64px/1 Georgia,serif;letter-spacing:-.045em;margin-bottom:26px}
    h1 em{font-style:normal;color:#b52c20;display:block}
    p{font-size:22px;line-height:1.45;color:#4f4a40}
    .brand{position:absolute;left:64px;bottom:56px;display:flex;align-items:center;gap:12px;font:800 26px system-ui,sans-serif}
    .brand span{font:500 12px monospace;letter-spacing:.08em;background:#b52c20;color:#fff;padding:4px 8px;border-radius:2px}
    .brand small{font:400 16px monospace;color:#696356;margin-left:8px}
    .shot{position:absolute;left:580px;top:64px;width:760px;border:1px solid #c8beaa;border-radius:4px;overflow:hidden;box-shadow:10px 10px 0 rgba(23,23,19,.12);background:#fffdf7}
    .shot img{display:block;width:100%}
    .tag{position:absolute;left:600px;bottom:40px;font:500 13px monospace;letter-spacing:.08em;text-transform:uppercase;color:#9a6212;background:#fffdf7;border:1px solid rgba(154,98,18,.4);padding:5px 10px;border-radius:2px}
  </style></head><body>
    <div class="copy"><div class="eyebrow">Calendar companion for Buffer</div>
    <h1>Your Buffer calendar, <em>with room to think.</em></h1>
    <p>Scheduled posts beside your notes. Gaps against your rhythm. Coverage before time away.</p></div>
    <div class="brand">PostIQ <span>BETA</span><small>postiq.netlify.app</small></div>
    <div class="shot"><img src="images/product/calendar-desktop.png" alt=""></div>
    <div class="tag">Sample data · independent of Buffer</div>
  </body></html>`);
  await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth));
  const file = path.join(root, 'postiq-og.png');
  await page.screenshot({ path: file });
  console.log(`Wrote ${path.relative(root, file)}`);
  await page.close();
}

run().then(() => server.close()).catch(error => { console.error(error); server.close(); process.exitCode = 1; });
