'use strict';
// Real rendering checks. No remote requests or Buffer writes are permitted.
// CHROMIUM_PATH selects an installed Chromium executable; artifacts go to /tmp.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json' };
const server = http.createServer((req,res) => {
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  try {res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream'});res.end(fs.readFileSync(file));}
  catch {res.writeHead(404).end();}
});
async function run() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    for(const width of [390,768,1440]) {
      const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==base) return route.abort();
        if(url.pathname.startsWith('/.netlify/')) return route.fulfill({json:{}});
        return route.continue();
      });
      await page.addInitScript(()=>{localStorage.setItem('postiq_tour_seen','1');});
      await page.goto(base+'/app.html');
      await page.waitForFunction(()=>window.CalendarExperience && document.querySelector('#calendarView.active'));
      await page.evaluate(()=>{
        state.channels=[{id:'a',displayName:'Studio',service:'instagram'},{id:'b',displayName:'News',service:'linkedin'}];
        state.scheduled=[{id:'first',channelId:'a',text:'First confirmed post.',dueAt:new Date().toISOString()},{id:'second',channelId:'a',text:'Exact second post.',dueAt:new Date().toISOString()},{id:'other-channel',channelId:'b',text:'Other channel.',dueAt:new Date().toISOString()}];
        addNoteForDateKey(fmtDate(new Date()),'Review launch copy','action');
        renderChannelSelects();state.calendarChannel='a';setCalendarView('week');renderCalendar();
      });
      const noOverflow=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
      assert.ok(await noOverflow(),`${width}: Calendar overflow`);
      assert.equal(await page.locator('#calAgenda').isVisible(),width<=768);
      await page.screenshot({animations:'disabled',path:`/tmp/postiq-phase2-${width}.png`});
      const post=page.locator('[data-post-id="second"]').filter({visible:true}).first();
      await post.scrollIntoViewIfNeeded();await post.focus();
      const scroll=await page.evaluate(()=>document.querySelector('.main').scrollTop);
      const windowScroll=await page.evaluate(()=>window.scrollY);
      await post.click();
      assert.match(await page.locator('#sharedDayBody').innerText(),/Exact second post/);
      assert.doesNotMatch(await page.locator('#sharedDayBody').innerText(),/First confirmed|Other channel/);
      assert.ok(await noOverflow(),`${width}: post drawer overflow`);
      const last=page.locator('#sharedDayModal button').last();await last.focus();await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'closeSharedDay');
      await page.screenshot({animations:'disabled',path:`/tmp/postiq-phase2-drawer-${width}.png`});
      await page.keyboard.press('Escape');
      assert.equal(await post.evaluate(el=>el===document.activeElement),true);
      assert.equal(await page.evaluate(()=>document.querySelector('.main').scrollTop),scroll);
      assert.equal(await page.evaluate(()=>window.scrollY),windowScroll);
      await page.evaluate(()=>activateView('composerView','calendar_context_check'));
      await page.evaluate(()=>activateView('calendarView','calendar_context_check'));
      assert.equal(await page.evaluate(()=>window.scrollY),windowScroll);
      await page.locator('#calendarAddBtn').click();await page.locator('[data-add-note]').click();
      await page.locator('#noteText').fill('Local test planning note');await page.locator('#saveNoteBtn').click();
      assert.equal(await page.evaluate(()=>getNotesForDate(fmtDate(new Date())).some(n=>n.text==='Local test planning note')),true);
      await page.locator('#calendarAddBtn').click();await page.locator('[data-start-draft]').click();
      assert.equal(await page.locator('#composerChannel').inputValue(),'a');
      assert.match(await page.locator('#composerCalendarContext').innerText(),/choose Queue or Schedule explicitly/);
      assert.ok(await noOverflow(),`${width}: Compose overflow`);
      await page.locator('#composerReturnCalendar').click();
      assert.equal(await page.evaluate(()=>state.calendarView),'week');
      assert.equal(await page.evaluate(()=>state.calendarChannel),'a');
      await page.evaluate(()=>{window.fixtureConnection=getBufferConnectionState;getBufferConnectionState=()=>({connected:true});state.scheduledCoverage={complete:true,ts:Date.now()};activateView('queueHealthView');});
      assert.ok(await page.locator('#queueHealthView').isVisible());
      assert.ok(await page.locator('#queueHealthView #planHealthStrip').isVisible());
      assert.ok(await noOverflow(),`${width}: Queue Health overflow`);
      await page.screenshot({animations:'disabled',path:`/tmp/postiq-health-${width}.png`});
      await page.evaluate(()=>{getBufferConnectionState=window.fixtureConnection;activateView('calendarView');});
      await page.evaluate(()=>{const key=fmtDate(new Date()),note=getNotesForDate(key).find(n=>n.typeId==='action');toggleNoteDone(key,note.id);renderCalendar();});
      const done=page.locator('.day-note-pill.is-done').filter({visible:true}).first();
      assert.match(await done.innerText(),/Done/);
      await done.scrollIntoViewIfNeeded();
      await page.screenshot({animations:'disabled',path:`/tmp/postiq-completed-${width}.png`});
      await page.evaluate(()=>{
        const target={id:'target-check',title:'Campaign target',sourceText:'An unscheduled content idea for a future campaign.',targetDate:fmtDate(new Date()),variants:[{channelId:'a'}]};
        const get=window.Notebook.getCard;
        window.Notebook.getCards=()=>[target];window.Notebook.getCard=id=>id===target.id?target:get(id);
        renderCalendar();
      });
      const target=page.locator('[data-calendar-content="target-check"]').filter({visible:true}).first();
      assert.match(await target.innerText(),/Target · not scheduled/i);await target.click();
      assert.ok(await page.locator('#contentDetailDrawer').isVisible());
      assert.ok(await noOverflow(),`${width}: content drawer overflow`);
      await page.screenshot({animations:'disabled',path:`/tmp/postiq-phase2-content-${width}.png`});
      await page.keyboard.press('Escape');
      assert.ok(await page.locator('#calendarView.active').isVisible());
      assert.deepEqual(errors,[],`${width}: browser errors`);
      console.log(`${width}px: week/Agenda, exact post, focus trap/restore, scroll, note, draft return and overflow checks passed.`);
      await page.close();
    }
  } finally {await browser.close();}
}
run().then(()=>server.close()).catch(error=>{console.error(error);server.close();process.exitCode=1;});
