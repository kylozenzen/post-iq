'use strict';
// Read-only ICS subscription proxy. Explicit public calendar hosts only: never a
// general-purpose URL fetcher. Feed URLs may contain secrets; do not log them.
const { URL } = require('node:url');
const MAX_BYTES = 1_000_000;
const HOSTS = new Set([
  'calendar.google.com', 'www.google.com',
  'outlook.office365.com', 'outlook.live.com', 'outlook.office.com',
  'trello.com', 'app.asana.com', 'calendar.notion.so'
]);
const headers = { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store' };
const send = (statusCode, body) => ({ statusCode, headers, body:JSON.stringify(body) });
function feedUrl(input) {
  if (typeof input !== 'string' || input.length > 1800) throw Error('Invalid calendar URL.');
  let url;
  try { url = new URL(input); } catch { throw Error('Use a complete HTTPS calendar feed URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) throw Error('Only standard HTTPS calendar feeds are supported.');
  const host = url.hostname.toLowerCase();
  const supported = HOSTS.has(host) || /^p\d+-caldav\.icloud\.com$/.test(host);
  if (!supported) throw Error('This feed host is not supported yet. Try Google Calendar, Outlook, Trello or Asana.');
  if (url.pathname.length > 1400) throw Error('Calendar URL is too long.');
  return url.href;
}
function unfolded(raw) { return raw.replace(/\r\n/g,'\n').replace(/\n[ \t]/g,''); }
function parseDate(line) {
  const raw = String(line || '').split(':').slice(1).join(':');
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
  const dt = new Date(Date.UTC(year,month-1,day));
  return dt.getUTCFullYear()===year && dt.getUTCMonth()===month-1 && dt.getUTCDate()===day ? m[1]+'-'+m[2]+'-'+m[3] : null;
}
function unescapeIcs(value) { return String(value || '').replace(/\\[nN]/g,' ').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\').trim(); }
function parseIcs(raw) {
  if (!/BEGIN:VCALENDAR/i.test(raw)) throw Error('This URL did not return an ICS calendar.');
  const lines=unfolded(raw).split('\n');
  const events=[];
  let item=null;
  for (const line of lines) {
    if (line.trim()==='BEGIN:VEVENT') { item={}; continue; }
    if (line.trim()==='END:VEVENT') {
      if (item?.date && item?.title) events.push(item);
      item=null;
      if (events.length>=400) break;
      continue;
    }
    if (!item) continue;
    const idx=line.indexOf(':'); if(idx<0)continue;
    const field=line.slice(0,idx).split(';')[0].toUpperCase(), value=line.slice(idx+1);
    if(field==='DTSTART') item.date=parseDate(line);
    if(field==='SUMMARY') item.title=unescapeIcs(value).slice(0,150);
    if(field==='UID') item.uid=unescapeIcs(value).slice(0,180);
    if(field==='RRULE') item.recurring=true;
  }
  return events;
}
async function getFeed(url) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try {
    const res=await fetch(url,{signal:controller.signal,redirect:'error',headers:{Accept:'text/calendar, text/plain;q=0.5'}});
    if (!res.ok) throw Error('Calendar provider returned '+res.status+'. Check that the link is a public or secret ICS feed URL.');
    const declared=Number(res.headers.get('content-length')||0);
    if(declared>MAX_BYTES)throw Error('Feed is too large to import.');
    if(!res.body)throw Error('Calendar provider returned no data.');
    const reader=res.body.getReader(); let total=0, parts=[];
    try {
      while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES)throw Error('Feed is too large to import.');parts.push(value);}
    }finally{reader.releaseLock();}
    return new TextDecoder().decode(Buffer.concat(parts.map(x=>Buffer.from(x))));
  }finally{clearTimeout(timer);}
}
exports.handler=async event=>{
  if(event.httpMethod!=='POST')return send(405,{error:'Method not allowed'});
  let input;
  try { input=JSON.parse(event.body||'{}'); } catch { return send(400,{error:'Invalid request.'}); }
  let url;
  try { url=feedUrl(input.url); } catch(e){return send(400,{error:e.message});}
  try {
    const text=await getFeed(url);
    const events=parseIcs(text);
    return send(200,{events,recurringSkipped:events.some(e=>e.recurring),note:'Read-only import. Repeating events are shown only for dates explicitly included in the feed.'});
  }catch(e){
    return send(502,{error: e.name==='AbortError'?'Calendar provider timed out.':String(e.message||'Could not load feed.').slice(0,200)});
  }
};
exports._test={feedUrl,parseIcs,parseDate};
