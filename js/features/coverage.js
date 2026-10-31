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
  function targetFor(settings, channelId, date) {
    const raw=settings.channelTargets?.[channelId];
    let target=Number.isInteger(raw) && raw>=0 && raw<=10 ? raw : 1;
    (Array.isArray(settings.targetOverrides)?settings.targetOverrides:[]).forEach(period=>{
      if(String(period.channelId)===channelId && date>=period.start && date<=period.end && Number.isInteger(period.target) && period.target>=0 && period.target<=10) target=period.target;
    });
    return target;
  }
  function calculate({posts=[], channels=[], settings={}, now=new Date(), days=90, connected=true, meta, zone=timezone}={}) {
    const today=dayKey(now,zone), rows=[], counts=new Map(), seen=new Set();
    const timestamp=Number(meta?.ts);
    const stale=!!meta && (!Number.isFinite(timestamp) || Date.now()-timestamp>15*60*1000);
    const complete=connected && meta?.complete===true && !stale;
    // Only the synchronized queue belongs here, never local targets or channel drafts.
    (Array.isArray(posts)?posts:[]).forEach(post=>{
      if(['draft','failed','local','target','sent','published'].includes(String(post.status || '').toLowerCase())) return;
      if(post.id && seen.has(String(post.id))) return;
      if(post.id) seen.add(String(post.id));
      const key=dayKey(post.dueAt || post.due_at,zone);
      if(!key) return;
      const id=String(post.channelId ?? post.channel_id ?? post.channel?.id);
      const bucket=id+'|'+key; counts.set(bucket,(counts.get(bucket)||0)+1);
    });
    for(let i=0;i<days;i++) {
      const date=addDays(today,i), weekday=codes[new Date(date+'T12:00:00Z').getUTCDay()];
      for(const channel of channels) {
        const id=String(channel.id ?? channel);
        const cadence=settings.channelPostingDays?.[id] ?? settings.postingDays ?? codes;
        const away=(Array.isArray(settings.daysOff)?settings.daysOff:[]).some(period=>(period.channelId==='*' || String(period.channelId)===id) && date>=period.start && date<=period.end);
        const target=away || !cadence.includes(weekday) ? 0 : targetFor(settings,id,date);
        const confirmedCount=counts.get(id+'|'+date)||0;
        const missingCount=Math.max(0,target-confirmedCount);
        const status=target===0?'off': !connected?'disconnected':stale?'stale':missingCount===0?'scheduled':!meta?.complete?'incomplete':'gap';
        rows.push({date,channelId:id,status,scheduled:confirmedCount>0,target,confirmedCount,missingCount,offReason:away?'intentional day off':!cadence.includes(weekday)?'non-posting day':target===0?'zero planning target':null});
      }
    }
    return {rows,timezone:zone,stale,complete};
  }
  function summarize(result) {
    const required=result.rows.filter(row=>row.target>0);
    const planned=required.reduce((n,row)=>n+row.target,0);
    const covered=required.reduce((n,row)=>n+Math.min(row.target,row.confirmedCount),0);
    return {planned,covered,uncovered:planned-covered,fullyCovered:result.complete && planned>0 && planned===covered,complete:result.complete};
  }
  function runway(rows,id) {let count=0; for(const r of rows.filter(r=>r.channelId===String(id)).slice(1)) {if(r.status==='off')continue; if(r.status!=='scheduled')break; count++;} return count;}
  const api={dayKey,addDays,calculate,runway,timezone,targetFor,summarize}; root.PostIQCoverage=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
