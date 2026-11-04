'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=require('../netlify/functions/calendar-feed.js')._test;
assert.match(api.feedUrl('https://calendar.google.com/calendar/ical/example/public/basic.ics'), /google/);
for(const unsafe of [
  'http://calendar.google.com/calendar/ical/example/public/basic.ics',
  'https://calendar.google.com/calendar/ical/example/private/basic.ics',
  'https://calendar.google.com/calendar/ical/example/secret/basic.ics',
  'https://calendar.google.com/calendar/ical/example/public/basic.ics?token=secret',
  'https://trello.com/calendar/example.ics',
  'https://calendar.google.com.evil.example/calendar.ics',
  'https://127.0.0.1/internal',
  'https://localhost/internal',
  'https://user:pass@calendar.google.com/basic.ics',
  'https://calendar.google.com:8080/basic.ics',
  'file:///etc/passwd'
]) assert.throws(()=>api.feedUrl(unsafe), 'must reject unsafe URL: '+unsafe);
const ics=[
'BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT',
'UID:test-1','DTSTART;VALUE=DATE:20261112','SUMMARY:Product launch',
'END:VEVENT','BEGIN:VEVENT','UID:test-2','DTSTART:20261113T100000Z','SUMMARY:Team\\, planning',
'END:VEVENT','END:VCALENDAR'].join('\r\n');
const parsed=api.parseIcs(ics);
assert.equal(parsed.length,2);
assert.equal(parsed[0].date,'2026-11-12');
assert.equal(parsed[1].title,'Team, planning');
assert.equal(api.parseDate('DTSTART:20260230'),null);
assert.equal(api.sameSite({headers:{origin:'https://postiq.netlify.app',host:'postiq.netlify.app','sec-fetch-site':'same-origin'}}),true);
assert.equal(api.sameSite({headers:{origin:'https://evil.example',host:'postiq.netlify.app'}}),false);
const app=fs.readFileSync('app.html','utf8');
const cal=fs.readFileSync('js/features/calendar.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
assert.match(app,/id="calendarFeedsBtn"/);
assert.match(app,/id="externalCalendarDialog"/);
assert.match(app,/id="externalCalendarClearAll"/);
assert.match(app,/Public address in iCal format/);
assert.match(app,/src="\.\/js\/features\/external-calendars\.js"/);
assert.match(cal,/PostIQExternalCalendars\?\.cellHtml/);
assert.match(cal,/PostIQExternalCalendars\?\.dayHtml/);
assert.match(sw,/\/js\/features\/external-calendars\.js/);
const fn=require('../netlify/functions/calendar-feed.js');
assert.equal(fn.config.rateLimit.windowLimit,10);
assert.equal(fn.config.rateLimit.windowSize,60);
assert.deepEqual(fn.config.rateLimit.aggregateBy,['ip','domain']);
console.log('External calendar URL safety, ICS parsing, and app wiring passed');
