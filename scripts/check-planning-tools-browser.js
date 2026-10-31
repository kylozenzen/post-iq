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
      const page=await browser.newPage({viewport:{width,height:1000},timezoneId:'America/Chicago',serviceWorkers:'block'});
      const errors=[], writes=[];page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>{
        const request=route.request(),url=new URL(request.url());
        if(request.method()!=='GET' && url.pathname!=='/.netlify/functions/trending') writes.push(url.pathname);
        if(url.origin!==base) return route.abort();
        if(url.pathname.startsWith('/.netlify/')) return route.fulfill({json:{}});
        return route.continue();
      });
      await page.addInitScript(()=>{localStorage.setItem('postiq_ob_dismissed','1');localStorage.setItem('postiq_ob_complete','1');});
      await page.goto(base+'/app.html');await page.waitForFunction(()=>window.YourPace && document.getElementById('paceStart').value);
      const date=await page.evaluate(()=>{
        const C=PostIQCoverage,today=C.dayKey(new Date()),weekday=new Date(today+'T12:00:00Z').getUTCDay();
        const start=C.addDays(today,(8-weekday)%7);
        state.channels=[{id:'a',displayName:'Studio',service:'instagram'},{id:'b',displayName:'Newsletter',service:'linkedin'}];
        getBufferConnectionState=()=>({connected:true});state.scheduledCoverage={complete:true,ts:Date.now()};
        state.scheduled=[{id:'queued',channelId:'a',text:'Confirmed example',dueAt:start+'T18:00:00Z',status:'scheduled'}];
        setPlanningSettings({showQueueGaps:true,postingDays:['MON','WED','FRI']});renderChannelSelects();renderCalendar();YourPace.refresh(true);
        return {start,end:C.addDays(start,6)};
      });
      const noOverflow=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
      assert.equal(await page.locator('#calendarFilters').evaluate(el=>el.open),false);
      await page.locator('#calendarFilterSummary').click();
      await page.locator('#calendarChannelFilter').selectOption('a');await page.locator('#calendarFilter').selectOption('notes');
      assert.match(await page.locator('#calendarFilterSummary').innerText(),/2/);
      assert.ok(await noOverflow(),`${width}: filter popover overflow`);
      await page.locator('#calendarFiltersReset').click();await page.keyboard.press('Escape');
      await page.screenshot({animations:'disabled',path:`/tmp/postiq-phase3-calendar-${width}.png`});
      assert.equal(await page.locator('.side-nav .nav-section-label').count(),1);
      if(width<=768){await page.locator('#mobMoreBtn').click();await page.locator('#mobDrawer [data-view="queueHealthView"]').click();}
      else await page.locator('.side-nav [data-view="queueHealthView"]').click();
      assert.ok(await page.locator('#queueHealthView #yourPace').isVisible());assert.equal(await page.locator('#calendarView #yourPace').count(),0);
      await page.locator('#paceStart').fill(date.start);await page.locator('#paceEnd').fill(date.end);await page.locator('#paceCheck').click();
      assert.equal(await page.evaluate(()=>YourPace.check().summary.planned),6);
      assert.equal(await page.evaluate(()=>YourPace.check().result.rows.filter(row=>new Date(row.date+'T12:00Z').getUTCDay()===2).every(row=>row.target===0)),true);
      await page.evaluate(()=>{state.scheduledCoverage.complete=false;});await page.locator('#paceCheck').click();
      assert.match(await page.locator('#paceDataNote').innerText(),/incomplete/);assert.doesNotMatch(await page.locator('#paceCoverageSummary').innerText(),/All .*covered/);
      const original=await page.evaluate(()=>JSON.stringify(state.scheduled));
      await page.locator('#paceOffScope').selectOption('selected');await page.locator('#paceOffSave').click();
      assert.equal(await page.evaluate(()=>JSON.stringify(state.scheduled)),original);
      assert.match(await page.locator('#paceExceptions').innerText(),/intentional days off/);
      assert.ok(await noOverflow(),`${width}: Pace overflow`);
      await page.screenshot({animations:'disabled',fullPage:true,path:`/tmp/postiq-phase3-pace-${width}.png`});
      await page.locator('#paceExceptions button').first().click();await page.locator('#paceCheck').click();
      await page.locator('#paceSlots button').first().click();assert.ok(await page.locator('#sharedDayModal').isVisible());
      const selected=await page.evaluate(()=>state.calendarChannel);assert.ok(selected);
      await page.keyboard.press('Escape');
      assert.ok(await page.evaluate(()=>!!document.activeElement.closest('#calendarView')));
      await page.evaluate(()=>{
        Notebook.addCard({id:'bank-old',title:'Existing saved campaign',sourceText:'Original source kept intact',custom:'preserved',variants:[{channelId:'a',text:'First independent version',mode:'draft'},{channelId:'b',text:'Second independent version',mode:'draft'}]});
        Notebook.addCard({id:'bank-scheduled',title:'Confirmed publication',sourceText:'Another source',targetDate:'2027-01-15',variants:[{channelId:'a',text:'API version',postId:'queued',buffer:{status:'scheduled'}}]});
        activateView('ideasView');
      });
      await page.locator('#contentBankSearch').fill('Second independent');assert.equal(await page.locator('#notebookList [data-content-open]').count(),1);
      await page.locator('#contentBankSearch').fill('');await page.locator('#contentBankFilter').selectOption('scheduled');
      assert.equal(await page.locator('#notebookList [data-content-open]').count(),1);assert.match(await page.locator('#notebookList').innerText(),/Last confirmed Buffer scheduling/);
      await page.locator('#contentBankFilter').selectOption('undated');
      const before=await page.evaluate(()=>JSON.stringify(Notebook.getCard('bank-old').variants));
      await page.locator('[data-content-plan="bank-old"]').click();await page.locator('#contentBankPlanDate').fill(date.start);await page.locator('#contentBankPlanSave').click();
      assert.equal(await page.evaluate(()=>JSON.stringify(Notebook.getCard('bank-old').variants)),before);
      await page.locator('#contentBankFilter').selectOption('all');assert.match(await page.locator('[data-content-open="bank-old"]').innerText(),/Local target: .*planning only/);
      assert.ok(await noOverflow(),`${width}: Content Bank overflow`);
      await page.screenshot({animations:'disabled',fullPage:true,path:`/tmp/postiq-phase3-bank-${width}.png`});
      await page.locator('#bankResourcesSummary').click();await page.locator('[data-ideas-tab="templates"]').click();
      assert.ok(await page.locator('#ideasTemplatesPanel').isVisible());
      assert.deepEqual(errors,[],`${width}: runtime errors`);assert.deepEqual(writes,[],`${width}: unexpected network writes`);
      console.log(`${width}px: compact filters, combined Queue Health/Your Pace tool, MWF coverage, incomplete data, intentional days off, slot navigation, Content Bank preservation and no overflow passed.`);
      await page.close();
    }
  } finally {await browser.close();}
}
run().then(()=>server.close()).catch(error=>{console.error(error);server.close();process.exitCode=1;});
