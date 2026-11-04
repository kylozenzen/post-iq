'use strict';
// Public ICS feeds ONLY. Private/secret subscription URLs are credentials.
// This is deliberately not a generic URL proxy or a private calendar connector.
const { URL } = require('node:url');
const MAX_BYTES = 400_000;
const MAX_BODY_BYTES = 2200;
const MAX_EVENTS = 250;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_CALLS_PER_WINDOW = 12;
// This per-instance throttle is only defense-in-depth on serverless. Add durable
// edge/provider rate limits before broad public rollout.
const rateWindow = new Map();
const headers = {
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff'
};
const send = (statusCode, body) => ({ statusCode, headers, body:JSON.stringify(body) });

function feedUrl(input) {
  if (typeof input !== 'string' || input.length > 1800) throw Error('Invalid feed URL.');
  let url;
  try { url = new URL(input); } catch { throw Error('Paste a full HTTPS public ICS address.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || url.search) {
    throw Error('Use a public HTTPS ICS address without credentials or query tokens.');
  }
  const host = url.hostname.toLowerCase();
  // Google public/basic.ics links are specifically intended for published calendars.
  // Google private/basic.ics and secret/basic.ics are bearers and MUST be rejected.
  if (!['calendar.google.com','www.google.com'].includes(host) ||
      !/^\/calendar\/ical\/[^/]+\/public\/basic\.ics$/i.test(url.pathname)) {
    throw Error('For this beta, only Google Calendar PUBLIC iCal links are supported. Private/secret ICS links are blocked.');
  }
  return url.href;
}
function unfolded(raw) { return raw.replace(/\r\n/g,'\n').replace(/\n[ \t]/g,''); }
function parseDate(line) {
  const raw = String(line || '').split(':').slice(1).join(':');
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
  const dt = new Date(Date.UTC(year,month-1,day));
  return dt.getUTCFullYear()===year && dt.getUTCMonth()===month-1 && dt.getUTCDate()===day
    ? m[1]+'-'+m[2]+'-'+m[3] : null;
}
function unescapeIcs(value) {
  return String(value||'').replace(/\\[nN]/g,' ').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\').trim();
}
function parseIcs(raw) {
  if (!/BEGIN:VCALENDAR/i.test(raw)) throw Error('This URL did not return an ICS calendar.');
  const lines=unfolded(raw).split('\n');
  const events=[]; let item=null;
  for(const line of lines) {
    if(line.trim()==='BEGIN:VEVENT') { item={}; continue; }
    if(line.trim()==='END:VEVENT') {
      if(item?.date && item?.title && item.status!=='CANCELLED')events.push(item);
      item=null;
      if(events.length>=MAX_EVENTS)break;
      continue;
    }
    if(!item)continue;
    const index=line.indexOf(':');if(index<0)continue;
    const field=line.slice(0,index).split(';')[0].toUpperCase(),value=line.slice(index+1);
    if(field==='DTSTART')item.date=parseDate(line);
    if(field==='SUMMARY')item.title=unescapeIcs(value).slice(0,150);
    if(field==='UID')item.uid=unescapeIcs(value).slice(0,180);
    if(field==='RRULE')item.recurring=true;
    if(field==='STATUS')item.status=value.trim().toUpperCase();
  }
  return events;
}
function sameSite(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  const host = event.headers?.host || event.headers?.Host;
  const fetchSite = event.headers?.['sec-fetch-site'] || event.headers?.['Sec-Fetch-Site'];
  if(fetchSite && !['same-origin','none'].includes(fetchSite))return false;
  // Browser request must originate on the same HTTPS site; this is not
  // authentication and does not defend against scripted calls by itself.
  if(!origin || !host)return false;
  try {const parsed=new URL(origin);return parsed.protocol==='https:' && parsed.host.toLowerCase()===String(host).toLowerCase();}catch{return false;}
}
function throttled(event) {
  const ip = event.headers?.['x-nf-client-connection-ip'] || event.requestContext?.identity?.sourceIp || 'unknown';
  const key=String(ip).slice(0,120),now=Date.now();
  for(const [id,entry] of rateWindow)if(now-entry.started>WINDOW_MS)rateWindow.delete(id);
  const current=rateWindow.get(key);
  if(!current){rateWindow.set(key,{started:now,count:1});return false;}
  current.count+=1;
  return current.count>MAX_CALLS_PER_WINDOW;
}
async function getFeed(url) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
  try {
    const response=await fetch(url,{signal:controller.signal,redirect:'error',headers:{Accept:'text/calendar'}});
    if(!response.ok)throw Error('Calendar feed is unavailable. Confirm that it is publicly shared.');
    const declared=Number(response.headers.get('content-length')||0);
    if(declared>MAX_BYTES)throw Error('This calendar feed is too large for the beta importer.');
    const type=response.headers.get('content-type')||'';
    if(type && !/text\/calendar|text\/plain|application\/octet-stream/i.test(type)){
      throw Error('Calendar provider did not return an ICS feed.');
    }
    if(!response.body)throw Error('Calendar provider returned no data.');
    const reader=response.body.getReader();let total=0;const parts=[];
    try {
      while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;
        if(total>MAX_BYTES)throw Error('This calendar feed is too large for the beta importer.');
        parts.push(Buffer.from(value));
      }
    }finally{reader.releaseLock();}
    return Buffer.concat(parts).toString('utf8');
  }finally{clearTimeout(timer);}
}
exports.handler=async event=>{
  if(event.httpMethod!=='POST')return send(405,{error:'Method not allowed'});
  if(!sameSite(event))return send(403,{error:'Calendar imports must be requested from PostIQ.'});
  if(throttled(event))return send(429,{error:'Too many refreshes. Try again later.'});
  if(Buffer.byteLength(event.body||'','utf8')>MAX_BODY_BYTES)return send(413,{error:'Request too large.'});
  let input;
  try{input=JSON.parse(event.body||'{}');}catch{return send(400,{error:'Invalid request.'});}
  let url;
  try{url=feedUrl(input.url);}catch(e){return send(400,{error:e.message});}
  try {
    const text=await getFeed(url),events=parseIcs(text);
    return send(200,{events,recurringSkipped:events.some(e=>e.recurring),
      note:'Read-only public calendar. Recurrence is not expanded.'});
  }catch(e){
    // Never reflect arbitrary remote errors or the supplied URL.
    return send(502,{error:e.name==='AbortError'?'Calendar provider timed out.':
      /^Calendar feed|^This calendar feed|^Calendar provider/.test(e.message)?e.message:'Unable to read this public ICS feed.'});
  }
};
exports._test={feedUrl,parseIcs,parseDate,sameSite,throttled};
