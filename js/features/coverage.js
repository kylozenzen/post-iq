'use strict';
(function(root) {
  const codes = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  function dayKey(value, zone = timezone) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (!Number.isFinite(+date)) return '';
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:zone, year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function addDays(key, n) { const d = new Date(key+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
  function calculate({posts=[], channels=[], settings={}, now=new Date(), days=90, connected=true, meta, zone=timezone}={}) {
    const today=dayKey(now,zone), rows=[];
    const stale=meta && Date.now()-meta.ts>15*60*1000;
    for(let i=0;i<days;i++) {
      const date=addDays(today,i), weekday=codes[new Date(date+'T12:00:00Z').getUTCDay()];
      for(const channel of channels) {
        const id=String(channel.id ?? channel);
        const cadence=settings.channelPostingDays?.[id] ?? settings.postingDays ?? codes;
        const covered=posts.some(p=>String(p.channelId ?? p.channel_id ?? p.channel?.id)===id && dayKey(p.dueAt || p.due_at,zone)===date);
        const status=!connected?'disconnected': !cadence.includes(weekday)?'off': stale?'stale':covered?'scheduled': !meta || !meta.complete?'incomplete':stale?'stale':'gap';
        rows.push({date,channelId:id,status,scheduled:covered});
      }
    }
    return {rows,timezone:zone, stale:!!stale};
  }
  function runway(rows,id) {let count=0; for(const r of rows.filter(r=>r.channelId===String(id)).slice(1)) {if(r.status==='off')continue; if(r.status!=='scheduled')break; count++;} return count;}
  const api={dayKey,addDays,calculate,runway,timezone}; root.PostIQCoverage=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
