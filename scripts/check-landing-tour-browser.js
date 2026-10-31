'use strict';
// Landing page and product tour checks in a real browser. Remote requests are
// blocked and no Buffer writes are permitted. CHROMIUM_PATH selects Chromium;
// screenshots go to /tmp/postiq-phase4-*.png.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json' };
const server = http.createServer((req, res) => {
  let pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404).end(); }
});

async function openPage(browser, base, width, init) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== 'GET' && url.pathname !== '/.netlify/functions/trending') writes.push(url.pathname);
    if (url.origin !== base) return route.abort();
    if (url.pathname.startsWith('/.netlify/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  if (init) await page.addInitScript(init);
  return { page, errors, writes };
}

const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

async function checkLanding(browser, base, width) {
  const { page, errors } = await openPage(browser, base, width);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base + '/');
  assert.equal(await page.locator('h1').innerText().then(t => t.replace(/\s+/g, ' ').trim()), 'Your Buffer calendar, with room to think.');
  assert.equal(await page.locator('h1').count(), 1);
  // Every image has alt text; every local link and asset resolves.
  assert.equal(await page.locator('img:not([alt])').count(), 0, 'images need alt text');
  const hrefs = await page.$$eval('a[href], img[src], source[srcset], link[rel="icon"], link[rel="apple-touch-icon"]', els => els.map(el => el.getAttribute('href') || el.getAttribute('src') || el.getAttribute('srcset')));
  for (const href of new Set(hrefs)) {
    if (/^(https?:|mailto:)/.test(href) || href.startsWith('#')) {
      if (href.startsWith('#') && href.length > 1) assert.ok(await page.locator(href).count(), `missing anchor ${href}`);
      continue;
    }
    const status = await page.evaluate(async url => (await fetch(url)).status, href);
    assert.equal(status, 200, `${href} returned ${status}`);
  }
  const meta = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"]')].map(m => [m.getAttribute('property') || m.name, m.content])));
  assert.match(meta['og:title'], /room to think/);
  assert.equal(meta['og:image'], 'https://postiq.netlify.app/postiq-og.png');
  assert.doesNotMatch(await page.content(), /thread splitter|first companion app/i);
  // CTAs: primary signs in and returns to the calendar; secondary previews it.
  const primary = page.locator('.hero-ctas a.primary');
  assert.equal(await primary.innerText(), 'Sign in with Buffer');
  const returnTo = new URL(await primary.getAttribute('href'), base).searchParams.get('return');
  assert.equal(returnTo, '/app.html?view=calendarView');
  assert.equal(await page.locator('.hero-ctas a.ghost').getAttribute('href'), '/app.html?view=calendarView');
  assert.match(await page.locator('.hero-note').innerText(), /need Buffer sign-in/);
  assert.ok(await page.locator('.sample-tag').first().isVisible(), 'preview must be labelled as sample data');
  // FAQ disclosure state and the support dialog are keyboard-friendly.
  const faq = page.locator('.faq-q').first();
  await faq.click();
  assert.equal(await faq.getAttribute('aria-expanded'), 'true');
  assert.ok(await page.locator('#faq1').isVisible());
  await page.locator('#openSupportBtn').click();
  assert.ok(await page.locator('#supportModal').isVisible());
  await page.keyboard.press('Escape');
  assert.ok(!(await page.locator('#supportModal').isVisible()));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'openSupportBtn');
  assert.ok(await noOverflow(page), `${width}: landing overflow`);
  // Toolkit sits below the primary calendar story.
  const order = await page.evaluate(() => ['calendar', 'workflow', 'access', 'toolkit'].map(id => document.getElementById(id).getBoundingClientRect().top + scrollY));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  await page.screenshot({ fullPage: true, path: `/tmp/postiq-phase4-landing-${width}.png` });
  assert.equal(await page.locator('a[href*="tour=1"]').count(), 0, 'no separate tour link next to the preview CTA');
  // The preview CTA lands on the calendar without signing in, and a first
  // visit opens the tour there.
  await page.locator('.hero-ctas a.ghost').click();
  await page.waitForURL(/\/app\.html\?view=calendarView/);
  await page.waitForFunction(() => document.getElementById('calendarView')?.classList.contains('active'));
  await page.waitForSelector('.tour-pop');
  assert.equal(await page.locator('#tourTitle').innerText(), 'Your Buffer calendar');
  assert.deepEqual(errors, [], `${width}: landing errors`);
  await page.close();
}

async function checkTour(browser, base, width) {
  // First visit: the tour is the onboarding and opens by itself.
  const { page, errors, writes } = await openPage(browser, base, width);
  await page.goto(base + '/app.html?view=calendarView');
  await page.waitForSelector('.tour-pop');
  assert.equal(await page.locator('.onboarding-banner, #obBanner, .ob-tooltip').count(), 0, 'old getting-started banner is gone');
  assert.equal(await page.locator('.tour-pop').getAttribute('role'), 'dialog');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'tourTitle');
  const seen = [];
  for (let i = 0; i < 5; i++) {
    const title = await page.locator('#tourTitle').innerText();
    seen.push(title);
    const box = await page.locator('.tour-pop').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `${width}: ${title} popover off-screen`);
    assert.ok(await noOverflow(page), `${width}: ${title} overflow`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `/tmp/postiq-phase4-tour-${i + 1}-${width}.png` });
    // The app remains usable: the ring does not intercept pointer events.
    assert.equal(await page.locator('.tour-ring').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    if (i === 4) {
      assert.ok(await page.locator('.tour-connect').isVisible(), 'disconnected people are offered Buffer sign-in at the end');
      assert.equal(await page.locator('[data-tour="connect"]').innerText(), 'Sign in with Buffer');
    } else assert.ok(!(await page.locator('.tour-connect').isVisible()));
    await page.locator('[data-tour="next"]').click();
  }
  assert.deepEqual(seen, ['Your Buffer calendar', 'Add planning context', 'Queue Health', 'Your Pace', 'Content Bank']);
  assert.equal(await page.locator('.tour-pop').count(), 0, 'Finish closes the tour');
  assert.equal(await page.evaluate(() => localStorage.getItem('postiq_tour_seen')), '1');
  // Does not reopen on reload after dismissal.
  await page.reload();
  await page.waitForFunction(() => window.PostIQTour);
  await page.waitForTimeout(900);
  assert.equal(await page.locator('.tour-pop').count(), 0, 'tour must not reopen on reload');
  // Restartable, skippable with Escape, and focus returns to the trigger.
  await page.evaluate(() => activateView('calendarView'));
  const trigger = width <= 768 ? null : page.locator('#calendarView [data-tour-start]');
  if (trigger) await trigger.click();
  else { await page.locator('#mobMoreBtn').click(); await page.locator('#mobDrawer [data-tour-start]').click(); }
  await page.waitForSelector('.tour-pop');
  assert.ok(!(await page.locator('#mobDrawer').evaluate(el => el.classList.contains('open'))));
  await page.locator('[data-tour="next"]').click();
  await page.locator('[data-tour="back"]').click();
  assert.equal(await page.locator('#tourTitle').innerText(), 'Your Buffer calendar');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.tour-pop').count(), 0);
  if (trigger) assert.equal(await page.evaluate(() => document.activeElement.dataset.tourStart), 'calendar_header');
  // Navigating elsewhere ends the tour instead of fighting the person.
  await page.evaluate(() => PostIQTour.start());
  await page.evaluate(() => activateView('composerView'));
  assert.equal(await page.locator('.tour-pop').count(), 0);
  // A link can still ask for the tour; the flag is single-use.
  await page.goto(base + '/app.html?view=calendarView&tour=1');
  await page.waitForSelector('.tour-pop');
  assert.equal(new URL(page.url()).search, '?view=calendarView', 'tour flag must be removed from the URL');
  await page.locator('[data-tour="close"]').first().click();
  // OAuth return keeps the view, never the tour flag.
  const connectUrl = await page.evaluate(() => { activateView('calendarView'); return getBufferConnectUrl(); });
  assert.equal(new URL(connectUrl, base).searchParams.get('return'), '/app.html?view=calendarView');
  assert.deepEqual(errors, [], `${width}: tour errors`);
  assert.deepEqual(writes, [], `${width}: tour must not write`);
  await page.close();

  // Disabled Content Bank workspace: the step is skipped.
  const disabled = await openPage(browser, base, width, () => {
    localStorage.setItem('postiq_tour_seen', '1');
    localStorage.setItem('postiq.workspacePreferences', JSON.stringify({ planning: true, create: true, ideas: false, approvals: true }));
  });
  await disabled.page.goto(base + '/app.html?view=calendarView');
  await disabled.page.waitForFunction(() => window.PostIQTour && window.YourPace);
  await disabled.page.evaluate(() => PostIQTour.start());
  const titles = [];
  while (await disabled.page.locator('.tour-pop').count()) {
    titles.push(await disabled.page.locator('#tourTitle').innerText());
    await disabled.page.locator('[data-tour="next"]').click();
  }
  assert.deepEqual(titles, ['Your Buffer calendar', 'Add planning context', 'Queue Health', 'Your Pace']);
  assert.match(await disabled.page.evaluate(() => document.querySelector('#tourCount')?.textContent || 'closed'), /closed/);
  assert.deepEqual(disabled.errors, []);
  await disabled.page.close();

  // Returning visitors from before the tour existed are not interrupted.
  const returning = await openPage(browser, base, width, () => localStorage.setItem('postiq_app_visited', '1'));
  await returning.page.goto(base + '/app.html');
  await returning.page.waitForFunction(() => window.PostIQTour && window.YourPace);
  await returning.page.waitForTimeout(900);
  assert.equal(await returning.page.locator('.tour-pop').count(), 0, 'returning visitors do not get the tour automatically');
  assert.deepEqual(returning.errors, []);
  await returning.page.close();
}

async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 768, 1440]) {
      await checkLanding(browser, base, width);
      await checkTour(browser, base, width);
      console.log(`${width}px: landing links, CTAs, metadata, FAQ/dialog keyboard, layout and the tour (first-visit open, steps, sign-in offer, skip, restart, single-use link, disabled workspace, returning visitors, OAuth return, no writes) passed.`);
    }
  } finally { await browser.close(); }
}
run().then(() => server.close()).catch(error => { console.error(error); server.close(); process.exitCode = 1; });
