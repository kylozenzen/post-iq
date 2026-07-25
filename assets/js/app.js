const STORE_KEY='postiq_buffer_token';
const NOTE_KEY='postiq_calendar_notes_v2';
const SNIPPET_KEY='postiq_snippets_v1';
const APPROVAL_META_PREFIX='postiq_approval_';
const GA_MEASUREMENT_ID = 'G-5RV57M7J0K'; // Replace with your real GA4 Measurement ID.
const snippetTypes=['All','Hooks','CTAs','Hashtag Sets','First Comments','Thread Openers'];
const snippetPlatforms=['All Platforms','LinkedIn','X','Threads','Instagram','Universal'];
let bufferToken='';
let tokenInputVisible=false;
let tokenPanelOpen=false;
let threadParts=[];
let currentViewId='';
let hasTrackedBufferConnected=false;
let modalOpenCount=0;
let setThreadTab=()=>{};
const state={
  channels:[],
  scheduled:[],
  month:new Date(),
  agendaView:'day',
  selectedDate:null,
  syncState:'idle',
  snippets:[],
  snippetType:'All',
  snippetPlatform:'All Platforms',
  snippetSearch:'',
  editingSnippetId:null,
  pickerMode:'composer',
  // LinkedIn posts integration
  linkedInLoaded:false,
  linkedInPosts:[],
  linkedInCursor:null,
  linkedInHasNext:false,
  linkedInPhase:'idle',
  linkedInError:'',
  activeComposerTab:'write',
  organizationId:null,
  // Thread numbering toggle for thread splitter
  numbering:false
};
const noteTags={gold:'Idea',blue:'Draft',green:'Campaign',violet:'Priority'};

function qs(id){return document.getElementById(id)}
function fmtDate(d){return d.toISOString().slice(0,10)}
function monthLabel(d){return d.toLocaleDateString(undefined,{month:'long',year:'numeric'})}
function monthStart(d){return new Date(d.getFullYear(),d.getMonth(),1)}
function maskToken(t){if(!t)return '—';if(t.length<=8)return '••••';return `${t.slice(0,4)}••••${t.slice(-4)}`;}
function clearBufferTokenStorage(){localStorage.removeItem(STORE_KEY);sessionStorage.removeItem(STORE_KEY);}
function clearBufferTokenForAuthFailure(message='Buffer token expired or invalid. Please reconnect.') {
  bufferToken='';
  hasTrackedBufferConnected=false;
  clearBufferTokenStorage();
  clearSyncedData();
  refreshTokenUI();
  setSyncStatus('failed',message);
}
function isAuthFailureError(err){
  const code=String(err?.code||'').toUpperCase();
  const status=Number(err?.status||0);
  const msg=String(err?.message||'');
  return code==='AUTH_ERROR'
    || status===401
    || status===403
    || /unauthorized|invalid token|token.*expired|forbidden|auth/i.test(msg);
}
function isAnalyticsEnabled(){return !!(GA_MEASUREMENT_ID && GA_MEASUREMENT_ID !== 'G-XXXXXXXXXX');}
function initAnalytics(){
  if(!isAnalyticsEnabled() || window.__postiqGAInitialized) return;
  window.__postiqGAInitialized = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
  const s=document.createElement('script');
  s.async=true;
  s.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  s.onerror=()=>console.warn('[PostIQ] GA4 script failed to load');
  document.head.appendChild(s);
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
}
function trackEvent(name,params={}){
  if(!isAnalyticsEnabled() || typeof window.gtag!=='function') return;
  window.gtag('event', name, params);
}
function trackPageView(view){
  if(!isAnalyticsEnabled()) return;
  trackEvent('page_view',{page_title:`PostIQ · ${view}`,page_path:`/${view}`});
}
function syncBodyScrollLock(){
  document.body.style.overflow = modalOpenCount > 0 ? 'hidden' : '';
}
function getOpenModals(){return [...document.querySelectorAll('.modal.open')];}
function openModal(id){
  const modal=qs(id);
  if(!modal || modal.classList.contains('open')) return;
  modal.classList.add('open');
  modalOpenCount += 1;
  syncBodyScrollLock();
}
function closeModal(id){
  const modal=qs(id);
  if(!modal || !modal.classList.contains('open')) return;
  modal.classList.remove('open');
  modalOpenCount = Math.max(0, modalOpenCount - 1);
  syncBodyScrollLock();
}
function showToast(msg, type=''){
  const wrap=qs('toastWrap');if(!wrap)return;
  const t=document.createElement('div');
  t.className='toast'+(type?' toast-'+type:'');
  t.textContent=msg;
  wrap.appendChild(t);
  const delay=msg.length>40?3800:2800;
  setTimeout(()=>{
    t.classList.add('toast-out');
    setTimeout(()=>t.remove(),230);
  },delay);
}
function safeText(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function compactText(v,max=84){const t=(v||'').replace(/\s+/g,' ').trim();return t.length>max?`${t.slice(0,max-1)}…`:t}
function slug(v){return String(v||'').toLowerCase()}
function normalizeTags(v){if(Array.isArray(v))return v.map(x=>String(x).trim()).filter(Boolean);return String(v||'').split(',').map(x=>x.trim()).filter(Boolean)}
function isToolEnabled(id){return !window.PostIQTools||window.PostIQTools.isEnabled(id)}

// ── APPROVAL METADATA (localStorage) ──
function getApprovalMeta(draftId){try{const r=localStorage.getItem(APPROVAL_META_PREFIX+draftId);return r?JSON.parse(r):null;}catch{return null;}}
function setApprovalMeta(draftId,data){try{localStorage.setItem(APPROVAL_META_PREFIX+draftId,JSON.stringify(data));}catch{}}
function clearApprovalMeta(draftId){try{localStorage.removeItem(APPROVAL_META_PREFIX+draftId);}catch{}}
function getAllApprovalMetas(){
  const result=[];
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key&&key.startsWith(APPROVAL_META_PREFIX)){
        const draftId=key.slice(APPROVAL_META_PREFIX.length);
        const meta=getApprovalMeta(draftId);
        if(meta&&meta.needs_approval)result.push({draftId,...meta});
      }
    }
  }catch{}
  return result;
}

// ── SNIPPETS ──

// ── LINKEDIN POSTS / REPURPOSE ──
const LINKEDIN_MIN_REPURPOSE_LENGTH = 80;
const LINKEDIN_PREVIEW_LENGTH = 320;

function getLinkedInPostKey(post,idx=0){
  if(post?.id!=null && String(post.id).trim()!=='') return String(post.id);
  const fallback=[post?.externalLink,post?.sentAt,post?.createdAt,post?.text,idx].map(v=>String(v||'')).join('|');
  return `li-${btoa(unescape(encodeURIComponent(fallback))).replace(/=+$/,'')}`;
}

function getLinkedInChannels(){
  return (state.channels||[]).filter(c=>String(c.service||'').toLowerCase().includes('linkedin'));
}
function setLinkedInPhase(phase,message=''){
  state.linkedInPhase=phase;
  state.linkedInError=message||'';
}
function normalizeLinkedInPost(post,idx=0){
  if(!post||typeof post!=='object') return null;
  const text=typeof post.text==='string'?post.text.replace(/\s+/g,' ').trim():'';
  const assets=Array.isArray(post.assets)?post.assets.filter(Boolean):[];
  const externalLink=typeof post.externalLink==='string' && /^https?:\/\//i.test(post.externalLink.trim())
    ?post.externalLink.trim()
    :'';
  const createdAt=post.createdAt||null;
  const sentAt=post.sentAt||null;
  const id=(post.id!=null && String(post.id).trim()!=='')?String(post.id):null;
  return {
    id,
    text,
    createdAt,
    sentAt,
    channelId:post.channelId||null,
    externalLink,
    assets,
    _repurposeKey:getLinkedInPostKey({...post,text,externalLink,id},idx)
  };
}
function getRepurposeScore(post){
  const textLen=(post?.text||'').length;
  const lengthScore=Math.min(textLen,1200);
  const recencyScore=new Date(post?.sentAt||post?.createdAt||0).getTime()||0;
  return (lengthScore*10000000000000)+recencyScore;
}
function getLinkedInMediaAsset(post){
  const assets=Array.isArray(post?.assets)?post.assets:[];
  return assets.find(a=>a?.thumbnail)||assets.find(a=>String(a?.mimeType||'').startsWith('image/'))||assets[0]||null;
}
function formatLinkedInDate(post){
  const raw=post?.sentAt||post?.createdAt;
  if(!raw) return '';
  const d=new Date(raw);
  if(Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}
function clearLinkedInRepurposeData(){
  state.linkedInLoaded=false;
  state.linkedInPosts=[];
  state.linkedInCursor=null;
  state.linkedInHasNext=false;
  setLinkedInPhase('idle','');
}
function renderLinkedInPosts(){
  const statusEl=qs('linkedinStatus');
  const listEl=qs('linkedinList');
  const loadBtn=qs('linkedinLoadBtn');
  if(!statusEl||!listEl||!loadBtn) return;
  listEl.innerHTML='';

  if(!bufferToken){
    statusEl.innerHTML='<div class="empty-state" style="text-align:left;padding:14px 0;"><div class="empty-title">Buffer connection required</div><div class="empty-desc">Add your Buffer key and sync once to load recent sent LinkedIn posts for repurposing.</div></div>';
    loadBtn.style.display='none';
    return;
  }
  const linkedInChannels=getLinkedInChannels();
  if(!linkedInChannels.length){
    statusEl.innerHTML='<div class="empty-state" style="text-align:left;padding:14px 0;"><div class="empty-title">No LinkedIn channels detected</div><div class="empty-desc">Sync Buffer after connecting a LinkedIn channel to browse repurpose sources.</div></div>';
    loadBtn.style.display='none';
    return;
  }
  if(state.linkedInPhase==='loading'){
    statusEl.innerHTML='<div class="empty-state" style="text-align:left;padding:14px 0;"><div class="empty-title">Loading LinkedIn posts…</div><div class="empty-desc">Pulling your most recent sent content from Buffer.</div></div>';
    loadBtn.style.display='none';
    return;
  }
  if(state.linkedInPhase==='error'){
    statusEl.innerHTML=`<div class="empty-state" style="text-align:left;padding:14px 0;"><div class="empty-title">Couldn’t load LinkedIn posts</div><div class="empty-desc">${safeText(state.linkedInError||'Try syncing Buffer again.')}</div></div>`;
    loadBtn.style.display='none';
    return;
  }
  if(!state.linkedInPosts.length){
    statusEl.innerHTML='<div class="empty-state" style="text-align:left;padding:14px 0;"><div class="empty-title">No repurpose-ready posts yet</div><div class="empty-desc">We looked at your recent sent LinkedIn posts, but none had enough content to reuse. Try loading more or publishing longer source posts.</div></div>';
    loadBtn.style.display='none';
    return;
  }

  statusEl.innerHTML='<div class="status-txt" style="font-size:12px;color:var(--muted);">Showing strongest recent LinkedIn candidates first (longer posts are prioritized).</div>';
  state.linkedInPosts.forEach((rawPost,idx)=>{
    const post=rawPost&&typeof rawPost==='object'?rawPost:{};
    const postKey=post._repurposeKey||getLinkedInPostKey(post,idx);
    const text=typeof post.text==='string'?post.text:'';
    const preview=safeText(text.slice(0,LINKEDIN_PREVIEW_LENGTH));
    const dateLabel=formatLinkedInDate(post);
    const media=getLinkedInMediaAsset(post);
    const thumb=media?.thumbnail||media?.source||'';
    const externalLink=post.externalLink&&/^https?:\/\//i.test(post.externalLink)?post.externalLink:'';
    const mediaType=String(media?.mimeType||'').toLowerCase();
    const mediaLabel=thumb?'Image attached':mediaType?mediaType.split('/')[0].toUpperCase():'No media';
    const card=document.createElement('div');
    card.className='card';
    card.style.padding='12px';
    card.innerHTML=`
      <div style="display:flex;gap:12px;align-items:flex-start;">
        ${thumb?`<img src="${safeText(thumb)}" alt="LinkedIn media preview" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border2);flex-shrink:0;">`:''}
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;line-height:1.55;color:var(--text);white-space:pre-wrap;">${preview||'<span style="color:var(--subtle);">No text content available.</span>'}${text.length>LINKEDIN_PREVIEW_LENGTH?'…':''}</div>
          <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            ${dateLabel?`<span class="chip" style="font-size:10px;">Published ${safeText(dateLabel)}</span>`:''}
            <span class="chip" style="font-size:10px;">${safeText(mediaLabel)}</span>
            <span class="chip" style="font-size:10px;">${text.length} chars</span>
            ${externalLink?`<a href="${safeText(externalLink)}" target="_blank" rel="noopener" class="btn sm ghost" style="height:26px;">View post ↗</a>`:''}
          </div>
        </div>
      </div>
      <div style="margin-top:10px;display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap;">
        <button class="btn sm ghost" data-linkedin-compose="${safeText(postKey)}">Use in Composer</button>
        <button class="btn sm primary" data-linkedin-use="${safeText(postKey)}">Send to Split</button>
      </div>`;
    listEl.appendChild(card);
  });
  loadBtn.style.display=state.linkedInHasNext?'inline-flex':'none';
}

async function fetchLinkedInPostsPage(after=null){
  const orgId=state.organizationId;
  const channelIds=getLinkedInChannels().map(c=>c.id).filter(Boolean);
  if(!orgId||!channelIds.length) return {posts:[],pageInfo:{hasNextPage:false,endCursor:null}};
  const query=`query GetLast30LinkedInPosts($organizationId: OrganizationId!, $channelIds: [ChannelId!]!, $after: String) {
    posts(
      first: 30
      after: $after
      input: {
        organizationId: $organizationId
        filter: {
          status: [sent]
          channelIds: $channelIds
        }
        sort: [{ field: createdAt, direction: desc }]
      }
    ) {
      edges {
        node {
          id
          text
          createdAt
          channelId
          sentAt
          externalLink
          assets {
            thumbnail
            mimeType
            source
            ... on ImageAsset {
              image {
                altText
                width
                height
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }`;
  const res=await callBuffer(query,{organizationId:orgId,channelIds,after});
  const block=res?.data?.posts;
  return {
    posts:(block?.edges||[]).map(e=>e.node).filter(Boolean),
    pageInfo:block?.pageInfo||{hasNextPage:false,endCursor:null}
  };
}

async function loadLinkedInPosts({append=false}={}){
  const statusEl=qs('linkedinStatus');
  if(!statusEl) return;
  if(!bufferToken){
    clearLinkedInRepurposeData();
    renderLinkedInPosts();
    return;
  }
  if(!state.channels.length){
    clearLinkedInRepurposeData();
    renderLinkedInPosts();
    return;
  }
  const linkedInChannels=getLinkedInChannels();
  if(!linkedInChannels.length){
    clearLinkedInRepurposeData();
    renderLinkedInPosts();
    return;
  }

  setLinkedInPhase('loading');
  renderLinkedInPosts();
  try{
    const {posts,pageInfo}=await fetchLinkedInPostsPage(append?state.linkedInCursor:null);
    const normalized=posts.map((p,idx)=>normalizeLinkedInPost(p,idx)).filter(Boolean);
    const useful=normalized.filter(p=>p.text.length>=LINKEDIN_MIN_REPURPOSE_LENGTH);
    const merged=append?state.linkedInPosts.concat(useful):useful;
    const deduped=[];
    const seen=new Set();
    merged.forEach((p,idx)=>{
      if(!p||typeof p!=='object')return;
      const key=p._repurposeKey||getLinkedInPostKey(p,idx);
      if(seen.has(key))return;
      seen.add(key);
      deduped.push({...p,_repurposeKey:key});
    });
    deduped.sort((a,b)=>getRepurposeScore(b)-getRepurposeScore(a));
    state.linkedInPosts=deduped;
    state.linkedInCursor=pageInfo?.endCursor||null;
    state.linkedInHasNext=!!pageInfo?.hasNextPage;
    state.linkedInLoaded=true;
    setLinkedInPhase('success');
    renderLinkedInPosts();
  }catch(e){
    console.error('[PostIQ] loadLinkedInPosts error:',e);
    setLinkedInPhase('error',getActionErrorMessage(e,'Couldn’t load LinkedIn posts right now. Try syncing again.'));
    renderLinkedInPosts();
  }
}

function useLinkedInInThread(postId){
  const post=(state.linkedInPosts||[]).find((p,idx)=>String(p?._repurposeKey||getLinkedInPostKey(p,idx))===String(postId));
  if(!post) return;
  hydrateThreadFromText(post.text||'',{autoSplit:true});
  showToast('Sent to Split','success');
}

function useLinkedInInComposer(postId){
  const post=(state.linkedInPosts||[]).find((p,idx)=>String(p?._repurposeKey||getLinkedInPostKey(p,idx))===String(postId));
  if(!post) return;
  hydrateComposerFromText(post.text||'');
  showToast('Loaded into Composer','success');
}

function hydrateComposerFromText(text=''){
  activateView('composerView');
  const editor=qs('composerEditor');
  if(!editor) return;
  editor.innerText=text||'';
  editor.dispatchEvent(new Event('input'));
  editor.focus();
}

function hydrateThreadFromText(text='',{autoSplit=false}={}){
  activateView('composerView');
  setComposerTab('split');
  setThreadTab('splitter');
  const input=qs('threadInput');
  if(input){
    input.value=text||'';
    input.dispatchEvent(new Event('input'));
  }
  if(autoSplit) qs('splitBtn')?.click();
}

function loadSnippets(){
  try{
    const raw=localStorage.getItem(SNIPPET_KEY);
    if(!raw){state.snippets=[];return}
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)){state.snippets=[];return}
    state.snippets=parsed.map((s,i)=>({
      id:String(s.id||`${Date.now()}-${i}`),
      title:String(s.title||'Untitled snippet'),
      type:snippetTypes.includes(s.type)?s.type:'Hooks',
      platform:snippetPlatforms.includes(s.platform)?s.platform:'Universal',
      tags:normalizeTags(s.tags),body:String(s.body||''),
      createdAt:String(s.createdAt||new Date().toISOString()),
      updatedAt:String(s.updatedAt||new Date().toISOString())
    }));
  }catch{state.snippets=[]}
}
function persistSnippets(){try{localStorage.setItem(SNIPPET_KEY,JSON.stringify(state.snippets))}catch{}}
function filteredSnippets(search=state.snippetSearch,type=state.snippetType,platform=state.snippetPlatform){
  const q=slug(search).trim();
  return state.snippets.filter(s=>{
    const typeOk=type==='All'||s.type===type;
    const platformOk=platform==='All Platforms'||s.platform===platform;
    const text=`${s.title} ${s.body} ${(s.tags||[]).join(' ')}`.toLowerCase();
    return typeOk&&platformOk&&(!q||text.includes(q));
  });
}
function snippetBadge(text,cls=''){return `<span class="chip ${cls}">${safeText(text)}</span>`;}
function useSnippetInComposer(snippet){
  const editor=qs('composerEditor');editor.focus();
  const body=snippet.body||'';
  try{
    const sel=window.getSelection();
    if(sel&&sel.rangeCount&&editor.contains(sel.anchorNode)){sel.deleteFromDocument();sel.getRangeAt(0).insertNode(document.createTextNode(body));}
    else{editor.innerText=editor.innerText?`${editor.innerText}\n\n${body}`:body;}
  }catch{editor.innerText=editor.innerText?`${editor.innerText}\n\n${body}`:body}
  qs('composerEmpty').style.display=editorHtmlToText(editor.innerHTML)?'none':'block';
  showToast('Snippet inserted','success');
}
function useSnippetInThread(snippet,position='prepend'){
  const input=qs('threadInput');const current=input.value.trim();const body=snippet.body||'';
  input.value=position==='prepend'?(current?`${body}\n\n${current}`:body):(current?`${current}\n\n${body}`:body);
  showToast(position==='prepend'?'Opener added':'CTA added');
}
function renderSnippetFilters(){
  const rail=qs('snippetTypeFilters');rail.innerHTML='';
  const label=document.createElement('div');label.className='filter-label';label.textContent='Type';rail.appendChild(label);
  snippetTypes.forEach(type=>{
    const count=type==='All'
      ?state.snippets.length
      :state.snippets.filter(s=>s.type===type).length;
    const b=document.createElement('button');
    b.className=`filter-btn ${state.snippetType===type?'active':''}`;
    b.style.cssText='display:flex;align-items:center;justify-content:space-between;';
    b.innerHTML=`<span>${type}</span><span style="font-size:10px;font-family:'DM Mono',
      monospace;opacity:.55;margin-left:6px;">${count||''}</span>`;
    b.onclick=()=>{state.snippetType=type;renderSnippets();};
    rail.appendChild(b);
  });
}
function renderSnippets(){
  renderSnippetFilters();
  const list=filteredSnippets();
  const grid=qs('snippetGrid');
  const isCompact=grid.dataset.viewMode==='compact';
  const composerEnabled=isToolEnabled('composer');
  qs('snippetsEmpty').style.display=list.length?'none':'block';
  grid.style.gridTemplateColumns=isCompact?'1fr':'';
  grid.innerHTML='';
  list.forEach(s=>{
    const card=document.createElement('div');
    card.className='snippet-card';
    if(isCompact){
      card.style.cssText='display:flex;align-items:center;gap:12px;padding:10px 14px;';
      card.innerHTML=`
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;
                      text-overflow:ellipsis;">${safeText(s.title)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;white-space:nowrap;
                      overflow:hidden;text-overflow:ellipsis;font-family:'DM Mono',monospace;">
            ${safeText(compactText(s.body,90))}
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          ${snippetBadge(s.type)}${snippetBadge(s.platform)}
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;">
          <button class="btn sm" data-act="copy" style="padding:7px 12px;">Copy</button>
          ${composerEnabled?`<button class="btn sm primary" data-act="composer"
            title="Send to Composer" style="padding:7px 12px;">→</button>`:''}
          <button class="btn sm ghost" data-act="edit"
            style="padding:7px 10px;">✏️</button>
          <button class="btn sm ghost" data-act="delete"
            style="padding:7px 10px;">🗑</button>
        </div>`;
    } else {
      card.innerHTML=`
        <div class="snippet-card-hdr">
          <div class="snippet-title">${safeText(s.title)}</div>
          <div class="snippet-badges">${snippetBadge(s.type)}${snippetBadge(s.platform)}</div>
        </div>
        <div class="snippet-body" data-fullbody="${encodeURIComponent(s.body||'')}"
          style="${s.body&&s.body.length>200?'cursor:pointer;':''}">
          ${safeText(compactText(s.body,200))}
          ${s.body&&s.body.length>200
            ?`<span style="color:var(--blue);font-size:11px;font-family:'DM Mono',monospace;
                           margin-left:4px;" class="snippet-expand-hint">▸ more</span>`:''}
        </div>
        ${s.tags?.length?`<div class="snippet-tags">${safeText(s.tags.join(' · '))}</div>`:''}
        <div class="snippet-actions" style="gap:8px;padding-top:10px;margin-top:4px;">
          <button class="btn snippet-use-btn" data-act="copy" style="padding:8px 14px;">Copy</button>
          ${composerEnabled?`<button class="btn snippet-use-btn primary" data-act="composer"
            style="padding:8px 14px;">→ Composer</button>`:''}
          <div class="snippet-menu" style="gap:6px;margin-left:auto;">
            <button class="btn sm ghost" data-act="edit" title="Edit"
              style="padding:8px 10px;">✏️</button>
            <button class="btn sm ghost" data-act="delete" title="Delete"
              style="padding:8px 10px;">🗑</button>
          </div>
        </div>`;
      // Expand/collapse on body click
      if(s.body&&s.body.length>200){
        const bodyEl=card.querySelector('.snippet-body');
        const hint=card.querySelector('.snippet-expand-hint');
        let expanded=false;
        bodyEl.onclick=()=>{
          expanded=!expanded;
          if(expanded){
            bodyEl.textContent=decodeURIComponent(bodyEl.dataset.fullbody);
            if(hint){hint.textContent=' ▾ less';bodyEl.appendChild(hint);}
            bodyEl.style.webkitLineClamp='unset';
            bodyEl.style.display='block';
          } else {
            bodyEl.textContent=safeText(compactText(s.body,200));
            if(hint){hint.textContent=' ▸ more';bodyEl.appendChild(hint);}
            bodyEl.style.webkitLineClamp='3';
            bodyEl.style.display='-webkit-box';
          }
        };
      }
    }
    card.querySelector('[data-act="copy"]').onclick=()=>{
      navigator.clipboard.writeText(s.body||'');showToast('Copied');
    };
    const composerBtn=card.querySelector('[data-act="composer"]');
    if(composerBtn)composerBtn.onclick=()=>{
      activateView('composerView');useSnippetInComposer(s);
    };
    card.querySelector('[data-act="edit"]').onclick=()=>openSnippetModal(s.id);
    card.querySelector('[data-act="delete"]').onclick=()=>deleteSnippet(s.id);
    grid.appendChild(card);
  });
}
function syncMobileActiveTab(viewId=currentViewId){
  document.querySelectorAll('.mob-tab[data-view]').forEach(t=>t.classList.toggle('active',t.dataset.view===viewId));
}
function isComposerRepurposeActive(){
  const panel=qs('composerTabRepurpose');
  return !!panel && panel.style.display!=='none';
}
function updateComposerModeCards(){
  const connected=!!bufferToken;
  const writeMeta=qs('composerModeMetaWrite');
  const splitMeta=qs('composerModeMetaSplit');
  const repurposeMeta=qs('composerModeMetaRepurpose');
  if(writeMeta){
    writeMeta.textContent=connected?'Draft and publish to Buffer':'Needs Buffer for publishing';
  }
  if(splitMeta){
    splitMeta.textContent=connected?'Build thread-ready drafts':'Free preview mode';
  }
  if(repurposeMeta){
    repurposeMeta.textContent=connected?'Load recent LinkedIn posts':'Needs Buffer to load LinkedIn';
  }
}
function ensureRepurposeLoaded({force=false}={}){
  renderLinkedInPosts();
  if(!bufferToken) return;
  if(!state.channels.length) return;
  if(state.linkedInPhase==='loading') return;
  if(force || !state.linkedInLoaded){
    loadLinkedInPosts({append:false});
  }
}
function setComposerTab(tab='write'){
  if(tab==='split'){
    setThreadTab('splitter');
    activateView('threadView');
    return;
  }
  if(tab==='repurpose'){
    setThreadTab('linkedin');
    activateView('threadView');
    ensureRepurposeLoaded();
    return;
  }
  state.activeComposerTab=tab;
  document.querySelectorAll('.composer-tab[data-ctab]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.ctab===tab);
  });
  const show=(id,on)=>{const el=qs(id);if(el)el.style.display=on?'block':'none';};
  show('composerTabWrite',tab==='write');
  show('composerTabSplit',tab==='split');
  show('composerTabRepurpose',tab==='repurpose');
}
function activateView(viewId){
  if(window.PostIQTools && !window.PostIQTools.isViewEnabled(viewId)){
    viewId=window.PostIQTools.getFirstEnabledView();
  }
  if(!qs(viewId)) return;
  const previousView=currentViewId;
  document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===viewId));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===viewId));
  syncMobileActiveTab(viewId);
  currentViewId=viewId;
  if(previousView!==viewId){
    trackEvent('tool_view',{tool:viewId});
    trackPageView(viewId);
  }
  if(viewId==='composerView') setComposerTab('write');
  if(viewId==='approvalsView') loadApprovals();
}
function getStartupViewFromQuery(){
  const allowed=new Set(['composerView','threadView','calendarView','trendingView','snippetsView','approvalsView']);
  const fromQuery=new URLSearchParams(window.location.search).get('view');
  const preferred=allowed.has(fromQuery)?fromQuery:'composerView';
  if(window.PostIQTools && !window.PostIQTools.isViewEnabled(preferred)){
    return window.PostIQTools.getFirstEnabledView();
  }
  return preferred;
}
function openSnippetModal(id=null){
  state.editingSnippetId=id;
  const s=id?state.snippets.find(x=>x.id===id):null;
  qs('snippetModalTitle').textContent=s?'Edit Snippet':'New Snippet';
  qs('snippetTitle').value=s?.title||'';
  qs('snippetType').value=s?.type||'Hooks';
  qs('snippetPlatform').value=s?.platform||'Universal';
  qs('snippetTags').value=(s?.tags||[]).join(', ');
  qs('snippetBody').value=s?.body||'';
  openModal('snippetModal');
}
function saveSnippet(){
  const title=qs('snippetTitle').value.trim();const body=qs('snippetBody').value.trim();
  if(!title||!body){showToast('Title and body required','error');return}
  const now=new Date().toISOString();
  const payload={id:state.editingSnippetId||`${Date.now()}-${Math.random().toString(16).slice(2,7)}`,title,type:qs('snippetType').value,platform:qs('snippetPlatform').value,tags:normalizeTags(qs('snippetTags').value),body,createdAt:now,updatedAt:now};
  if(state.editingSnippetId){const prev=state.snippets.find(s=>s.id===state.editingSnippetId);payload.createdAt=prev?.createdAt||now;state.snippets=state.snippets.map(s=>s.id===state.editingSnippetId?payload:s);}
  else state.snippets=[payload,...state.snippets];
  persistSnippets();closeModal('snippetModal');renderSnippets();showToast('Snippet saved','success');
}
function deleteSnippet(id){
  if(!confirm('Delete this snippet?'))return;
  state.snippets=state.snippets.filter(s=>s.id!==id);
  persistSnippets();renderSnippets();showToast('Snippet deleted','info');
}
function renderSnippetSelectors(){
  ['snippetPlatformFilter','snippetPlatform','pickerPlatform'].forEach(id=>{
    const sel=qs(id);if(!sel)return;sel.innerHTML='';
    snippetPlatforms.forEach((p,i)=>{if(id==='snippetPlatform'&&i===0)return;const o=document.createElement('option');o.value=p;o.textContent=p;sel.appendChild(o)});
  });
  ['snippetType','pickerType'].forEach(id=>{
    const sel=qs(id);if(!sel)return;sel.innerHTML='';
    snippetTypes.forEach((t,i)=>{if(id==='snippetType'&&i===0)return;const o=document.createElement('option');o.value=t;o.textContent=t;sel.appendChild(o)});
  });
  qs('snippetPlatformFilter').value=state.snippetPlatform;
}
function openSnippetPicker(mode){
  if(!state.snippets.length){showToast('No snippets yet — create one in the Snippets tab first','error');return;}
  state.pickerMode=mode;
  qs('snippetPickerTitle').textContent=mode==='composer'?'Insert snippet into Composer':mode==='threadOpener'?'Add opener from Snippets':'Add ending CTA from Snippets';
  qs('pickerSearch').value='';qs('pickerType').value='All';qs('pickerPlatform').value='All Platforms';
  renderSnippetPicker();openModal('snippetPickerModal');
}
function renderSnippetPicker(){
  const list=filteredSnippets(qs('pickerSearch').value,qs('pickerType').value,qs('pickerPlatform').value);
  const wrap=qs('pickerList');wrap.innerHTML='';
  qs('pickerEmpty').style.display=list.length?'none':'block';
  list.forEach(s=>{
    const el=document.createElement('button');el.className='picker-item';
    el.innerHTML=`<strong style="font-size:13px;">${safeText(s.title)}</strong><div class="snippet-body mt8">${safeText(compactText(s.body,180))}</div><div class="row mt8">${snippetBadge(s.type)}${snippetBadge(s.platform)}</div>`;
    el.onclick=()=>{
      if(state.pickerMode==='composer'){activateView('composerView');useSnippetInComposer(s);}
      if(state.pickerMode==='threadOpener'){activateView('composerView');setComposerTab('split');useSnippetInThread(s,'prepend');}
      if(state.pickerMode==='threadCta'){activateView('composerView');setComposerTab('split');useSnippetInThread(s,'append');}
      closeModal('snippetPickerModal');
    };
    wrap.appendChild(el);
  });
}

// ── TOKEN ──
function showFetchLoading(container){
  if(!container) return null;
  let el=container.querySelector('.view-loading[data-loading="buffer"]');
  if(el) return el;
  el=document.createElement('div');
  el.className='view-loading';
  el.dataset.loading='buffer';
  el.textContent='Fetching from Buffer…';
  container.prepend(el);
  return el;
}
function clearFetchLoading(container){
  if(!container) return;
  container.querySelectorAll('.view-loading[data-loading="buffer"]').forEach(el=>el.remove());
}
function setSyncStatus(stateName,msg){
  state.syncState=stateName;
  const el=qs('syncStatus');
  const lastEl=qs('lastSynced');
  el.textContent=msg;
  el.style.color = stateName==='success' ? 'var(--green)' : stateName==='failed' ? 'var(--red)' : 'var(--muted)';
  if(lastEl){
    if(stateName==='success'){
      const now=new Date();
      lastEl.textContent=`Synced at ${now.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}`;
    }else if(stateName==='failed' && !state.scheduled?.length){
      lastEl.textContent='Not synced yet.';
    }
  }
}
function updateTokenUI(){
  const connected=!!bufferToken;
  qs('statusDot').classList.toggle('connected',connected);
  qs('tokenStatusLabel').textContent=connected?'Connected':'Not connected';
  qs('tokenMaskedPreview').textContent=maskToken(bufferToken);
  const sideNav=document.querySelector('.side-nav');
  if(sideNav){
    if(connected)sideNav.dataset.connected='true';
    else sideNav.removeAttribute('data-connected');
  }
  tokenInputVisible=false;qs('tokenInput').type='password';qs('toggleTokenVisibility').textContent='Show';
  updateViewStatePills();
  updateSidebarBadges();
}
function refreshTokenUI(){
  updateTokenUI();
  const mobInput=qs('mobTokenInput');
  if(mobInput){
    mobInput.value=bufferToken||'';
  }
  const connected=!!bufferToken;
  const mobDot=qs('mobStatusDot');
  const mobLabel=qs('mobTokenLabel');
  const mobSyncStatus=qs('mobSyncStatus');
  if(mobDot)mobDot.classList.toggle('connected',connected);
  if(mobLabel)mobLabel.textContent=connected?'Connected':'Not connected';
  if(mobSyncStatus&&qs('syncStatus'))mobSyncStatus.textContent=qs('syncStatus').textContent;
}
function updateSidebarBadges(){
  const connected=!!bufferToken;
  document.querySelectorAll('[data-key-badge]').forEach(el=>{el.style.display=connected?'none':'inline-flex';});
  document.querySelectorAll('[data-preview-badge]').forEach(el=>{el.style.display=connected?'none':'inline-flex';});
}

function toggleTokenPanel(){
  tokenPanelOpen=!tokenPanelOpen;
  qs('tokenPanel').classList.toggle('open',tokenPanelOpen);
  qs('manageTokenBtn').textContent=tokenPanelOpen?'Done':'Manage';
}
function openTokenManagement(){
  if(window.innerWidth<=768){
    openMobDrawer();
    mobTokenPanelOpen=true;
    qs('mobTokenPanel').style.display='block';
    qs('mobManageTokenBtn').textContent='Done';
  }else{
    tokenPanelOpen=true;
    qs('tokenPanel').classList.add('open');
    qs('manageTokenBtn').textContent='Done';
    qs('tokenInput').focus();
  }
}
function updateViewStatePills(){
  const connected=!!bufferToken;
  updateComposerModeCards();
  const set=(id,txt,cls)=>{const el=qs(id);if(!el)return;el.className=`state-pill view-state-pill ${cls}`;el.textContent=txt;};
  set('composerStatePill',connected?'Connected · ready':'Free Preview · Split mode',connected?'try':'preview');
  set('calendarStatePill',connected?'Connected · ready':'Needs Buffer key',connected?'try':'key');
  set('approvalsStatePill',connected?'Connected · ready':'Needs Buffer key',connected?'try':'key');
  set('snippetsStatePill',connected?'Connected · ready':'Free Preview',connected?'try':'preview');
  set('trendingStatePill',connected?'Connected · ready':'Free Preview',connected?'try':'preview');
  const repurposeNoKey=qs('repurposeNoKeyState');
  if(repurposeNoKey) repurposeNoKey.style.display=connected?'none':'block';
  if(isComposerRepurposeActive()) ensureRepurposeLoaded();
  const subhead=qs('composerSubhead');
  if(subhead){
    subhead.textContent=connected
      ?'Draft text-first posts, then send them to Buffer.'
      :'Write here now. Connect Buffer to unlock drafts, queueing, and scheduling.';
  }
  const emptyTitle=qs('composerEmptyTitle');
  const emptyDesc=qs('composerEmptyDesc');
  if(emptyTitle)emptyTitle.textContent=connected?'Ready to compose':'Start writing now';
  if(emptyDesc){
    emptyDesc.textContent=connected
      ?'Write your post, then send it to Buffer as a draft, queued post, or scheduled post.'
      :'Write here now. Connect Buffer to unlock drafts, queueing, and scheduling.';
  }
  const hint=qs('calendarEmptyHint'); if(hint) hint.style.display=connected?'none':'block';
}

function setBufferToken(token,{mode='session',messageEl=null,savedMessage='Token saved'}={}){
  clearBufferTokenStorage();
  const clean=String(token||'').trim();
  if(!clean){
    bufferToken='';
    hasTrackedBufferConnected=false;
    clearSyncedData();
    if(messageEl)messageEl.textContent='Token removed.';
    refreshTokenUI();
    showToast('Token removed','info');
    return false;
  }
  if(mode==='local')localStorage.setItem(STORE_KEY,clean);else sessionStorage.setItem(STORE_KEY,clean);
  bufferToken=clean;
  if(messageEl)messageEl.textContent=mode==='local'?'Saved locally.':'Saved for session.';
  refreshTokenUI();
  showToast(savedMessage,'success');
  return true;
}

function saveToken(){
  const token=qs('tokenInput').value.trim();
  const mode=[...document.querySelectorAll('input[name="tokenMode"]')].find(r=>r.checked).value;
  const ok=setBufferToken(token,{mode,messageEl:qs('tokenMsg'),savedMessage:'Token saved'});
  if(ok)syncBuffer();
}
function loadStoredToken(){
  bufferToken=sessionStorage.getItem(STORE_KEY)||localStorage.getItem(STORE_KEY)||'';
  if(bufferToken)qs('tokenInput').value=bufferToken;
  if(!bufferToken)hasTrackedBufferConnected=false;
  refreshTokenUI();
}

// ── BUFFER API ──
async function callBuffer(query,variables={}){
  if(!bufferToken)throw new Error('MISSING_TOKEN');

  let res;
  try{
    res=await fetch('/.netlify/functions/buffer-proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:bufferToken,query,variables})});
  }catch(err){
    const e=new Error('Network error while contacting Buffer proxy.');
    e.code='PROXY_NETWORK_ERROR';
    e.retryable=true;
    e.cause=err;
    throw e;
  }

  let data;
  try{
    data=await res.json();
  }catch{
    const e=new Error('Invalid proxy response. Please retry.');
    e.code='PROXY_BAD_RESPONSE';
    throw e;
  }

  if(data.errors?.length && !data.data){
    const first=data.errors[0]||{};
    const e=new Error(first.message||'Buffer request failed');
    e.code=first.code||'BUFFER_ERROR';
    e.status=first.status||null;
    e.retryable=!!first.retryable;
    e.retryAfter=first.retryAfter||null;
    throw e;
  }
  if(!res.ok){
    const first=data?.errors?.[0]||{};
    const e=new Error(first.message||`Buffer request failed with HTTP ${res.status}.`);
    e.code=first.code||'BUFFER_HTTP_ERROR';
    e.status=first.status||res.status;
    e.retryable=typeof first.retryable==='boolean' ? first.retryable : (res.status===429||res.status>=500);
    e.retryAfter=first.retryAfter||null;
    throw e;
  }
  if(data.errors?.length)console.warn('[PostIQ] GraphQL partial errors:',data.errors);
  return data;
}

function getActionErrorMessage(err,fallback='Request failed. Please try again.'){
  const code=String(err?.code||'').toUpperCase();
  const msg=String(err?.message||'');
  if(code==='MISSING_TOKEN')return 'Add your Buffer token first.';
  if(code==='MUTATION_INVALID_INPUT')return 'Post details are invalid. Check content length, media, or schedule time and retry.';
  if(code==='MUTATION_LIMIT_REACHED')return 'Buffer posting limit reached for this channel or plan. Wait and try again.';
  if(code==='RATE_LIMIT' || err?.status===429) return `Buffer rate limit hit.${err?.retryAfter?` Retry in about ${err.retryAfter}s.`:''}`;
  if(code==='AUTH_ERROR' || /unauthorized|invalid|forbidden|expired|auth/i.test(msg)) return 'Token appears invalid or expired. Reconnect Buffer and sync again.';
  if(code==='PROXY_NETWORK_ERROR') return 'Network issue reaching Buffer. Check connection and retry.';
  if(code==='BUFFER_SERVER_ERROR') return 'Buffer is temporarily unavailable. Please retry shortly.';
  return msg||fallback;
}

function clearSyncedData(){
  state.channels=[];
  state.scheduled=[];
  state.organizationId=null;
  clearLinkedInRepurposeData();
  renderChannelSelects();
  renderLinkedInPosts();
  renderCalendar();
}

function getNotes(){try{return JSON.parse(localStorage.getItem(NOTE_KEY)||'{}')}catch{return {}}}
function setNotes(v){localStorage.setItem(NOTE_KEY,JSON.stringify(v))}

async function syncBuffer(){
  if(!bufferToken){setSyncStatus('failed','Add your Buffer token first.');return;}
  setSyncStatus('syncing','Syncing…');
  showFetchLoading(qs('calGrid'));
  showFetchLoading(qs('calAgenda'));
  const syncBtn=qs('syncBtn');
  const origLabel=syncBtn.innerHTML;
  syncBtn.innerHTML='<span class="syncing-icon">↻</span> Syncing…';
  syncBtn.disabled=true;
  try{
    const acc=await callBuffer('query { account { organizations { id name } } }');
    const orgId=acc?.data?.account?.organizations?.[0]?.id;
    if(!orgId){clearSyncedData();setSyncStatus('failed','No organization found.');return;}
    state.organizationId=orgId;
    const channelsQuery='query Channels($organizationId: OrganizationId!){ channels(input:{organizationId:$organizationId}) { id displayName name service } }';
    const ch=await callBuffer(channelsQuery,{organizationId:orgId});
    state.channels=ch?.data?.channels||[];
    const cap=500;let after=null;let all=[];let hasNext=true;
    const postsQuery='query ScheduledPosts($organizationId: OrganizationId!, $after: String){ posts(first:100, after:$after, input:{organizationId:$organizationId, filter:{status:[scheduled]}}){ edges{ node{ id text dueAt channelId assets{ thumbnail mimeType source } metadata{ ... on InstagramPostMetadata{ type shouldShareToFeed firstComment } ... on FacebookPostMetadata{ type firstComment } ... on TwitterPostMetadata{ thread{ text } } ... on YoutubePostMetadata{ type title privacy category{ categoryId } license notifySubscribers embeddable madeForKids } } } } pageInfo{ hasNextPage endCursor } } }';
    while(hasNext&&all.length<cap){
      const page=await callBuffer(postsQuery,{organizationId:orgId,after});
      const block=page?.data?.posts;const edges=block?.edges||[];
      all=all.concat(edges.map(e=>e.node));
      hasNext=!!block?.pageInfo?.hasNextPage;after=block?.pageInfo?.endCursor||null;
      if(!block?.pageInfo)break;
    }
    state.scheduled=all;renderChannelSelects();renderCalendar();
    setSyncStatus('success',`${all.length} scheduled posts loaded.`);
    if(!hasTrackedBufferConnected){
      trackEvent('buffer_connected',{channel_count:state.channels.length});
      hasTrackedBufferConnected=true;
    }
    qs('syncBtn').classList.remove('sync-pulse');
    showToast(`Loaded ${all.length} posts`,'success');
    window.dispatchEvent(new Event('postiq:synced'));
    if(getLinkedInChannels().length){
      ensureRepurposeLoaded({force:true});
    }else{
      renderLinkedInPosts();
    }
  }catch(e){
    console.error('[PostIQ] syncBuffer error:', e);
    const message=getActionErrorMessage(e,'Sync failed.');
    if(isAuthFailureError(e) || /token appears invalid or expired/i.test(message)){
      clearBufferTokenForAuthFailure(message);
    }else{
      setSyncStatus('failed',message);
    }
    showToast(message,'error');
  }finally{
    clearFetchLoading(qs('calGrid'));
    clearFetchLoading(qs('calAgenda'));
    syncBtn.innerHTML=origLabel;
    syncBtn.disabled=false;
  }
}

function renderChannelSelects(){
  const threadSel=qs('threadChannel');
  const threadChannels=state.channels.filter(c=>{const s=(c.service||'').toLowerCase();return s.includes('twitter')||s.includes('x')||s.includes('thread');});
  threadSel.innerHTML='';
  if(threadChannels.length){
    threadChannels.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=`${c.displayName||c.name} (${c.service})`;threadSel.appendChild(o)});
    qs('threadNoChannels').style.display='none';threadSel.style.display='';
  }else{qs('threadNoChannels').style.display='block';threadSel.style.display='none';}
  const composerSel=qs('composerChannel');
  composerSel.innerHTML='';
  if(state.channels.length){
    state.channels.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=`${c.displayName||c.name} (${c.service})`;composerSel.appendChild(o)});
    qs('composerNoChannels').style.display='none';composerSel.style.display='';updateComposerChannelHint();
  }else{qs('composerNoChannels').style.display='block';composerSel.style.display='none';qs('composerChannelHint').style.display='none';}
}
function updateComposerChannelHint(){
  const sel=qs('composerChannel');const hint=qs('composerChannelHint');
  if(!sel||!sel.value){hint.style.display='none';return;}
  const ch=state.channels.find(c=>c.id===sel.value);
  if(ch){hint.textContent=`Posting to: ${ch.displayName||ch.name} (${ch.service})`;hint.style.display='block';}
  else{hint.style.display='none';}
}

// ── THREAD ──
function splitThreadText(text,max=280){
  const parts=[];let left=text.trim();
  while(left.length>max){
    let cut=left.lastIndexOf('\n',max);if(cut<80)cut=left.lastIndexOf(' ',max);if(cut<80)cut=max;
    parts.push(left.slice(0,cut).trim());left=left.slice(cut).trim();
  }
  if(left)parts.push(left);return parts;
}
function renderThread(){
  const out=qs('threadOut');
  if(!threadParts.length){out.innerHTML='';qs('threadEmpty').style.display='block';return;}
  qs('threadEmpty').style.display='none';out.innerHTML='';
  threadParts.forEach((p,i)=>{
    const chars=p.length;const over=chars>280;
    const d=document.createElement('div');d.className='thread-part';
    d.innerHTML=`<div class="thread-part-hdr"><span class="part-num">Part ${i+1}</span><div style="display:flex;gap:6px;align-items:center;"><span style="font-size:11px;font-family:'DM Mono',monospace;color:${over?'var(--red)':'var(--subtle)'};">${chars}/280</span><button class="btn sm ghost" data-copy="${i}">Copy</button></div></div><textarea data-i="${i}" style="min-height:80px;">${p}</textarea>`;
    out.appendChild(d);
  });
  out.querySelectorAll('textarea').forEach(t=>t.addEventListener('input',e=>{
    threadParts[+e.target.dataset.i]=e.target.value;
    const hdr=e.target.closest('.thread-part').querySelector('.thread-part-hdr span:last-of-type');
    if(hdr){const c=e.target.value.length;hdr.style.color=c>280?'var(--red)':'var(--subtle)';hdr.textContent=`${c}/280`;}
  }));
  out.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{
    const idx = +b.dataset.copy;
    const original = threadParts[idx] || '';
    const text = state.numbering ? `${idx+1}/${threadParts.length} ${original}` : original;
    navigator.clipboard.writeText(text);
    showToast('Part copied');
  });
}
function getThreadMetadata(channelId){
  const channel=state.channels.find(c=>c.id===channelId);
  const svc=(channel?.service||'').toLowerCase();
  const isThreads=svc.includes('thread');
  // If numbering toggle is enabled, prefix each part with index/total
  const parts = state.numbering
    ? threadParts.map((p,i) => `${i+1}/${threadParts.length} ${p}`)
    : threadParts.slice();
  return parts.length>1
    ? {
        metadata: {
          [isThreads ? 'threads' : 'twitter']:
            isThreads
              ? { type: 'thread', thread: parts.slice(1).map(t => ({ text: t })) }
              : { thread: parts.slice(1).map(t => ({ text: t })) }
        }
      }
    : {};
}
async function sendThread(action){
  if(!threadParts.length){qs('threadStatus').textContent='Split content first.';return;}
  const channelId=qs('threadChannel').value;if(!channelId){qs('threadStatus').textContent='Load channels first.';return;}
  // Determine parts and prefix numbering if enabled
  const parts = state.numbering
    ? threadParts.map((p,i) => `${i+1}/${threadParts.length} ${p}`)
    : threadParts.slice();
  const first = parts[0];
  const when = qs('threadWhen').value;
  const input = { channelId, text: first, schedulingType:'automatic', ...getThreadMetadata(channelId) };
  if(action==='draft'){input.mode='addToQueue';input.saveToDraft=true;}
  if(action==='queue'){input.mode='addToQueue';}
  if(action==='schedule'){if(!when){qs('threadStatus').textContent='Choose date/time first.';return;}input.mode='customScheduled';input.dueAt=when;}
  try{
    const createdPost=await createPost(input);
    const msg=action==='draft'?'Draft saved.':action==='queue'?'Added to queue.':'Scheduled.';
    qs('threadStatus').textContent=msg;showToast(msg);
    refreshCalendarAfterPostAction(action,createdPost?.post);
  }catch(e){
    const message=getActionErrorMessage(e,'Check token/channel and retry.');
    if(isAuthFailureError(e)) clearBufferTokenForAuthFailure(message);
    qs('threadStatus').textContent=`Failed: ${message}`;
  }
}

// ── CALENDAR ──
function renderCalendar(){
  qs('monthLabel').textContent=monthLabel(state.month);
  const grid=qs('calGrid');grid.innerHTML='';
  const first=monthStart(state.month);const start=new Date(first);start.setDate(1-first.getDay());
  const notes=getNotes();const today=fmtDate(new Date());
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const key=fmtDate(d);const inMonth=d.getMonth()===state.month.getMonth();
    const dayPosts=state.scheduled.filter(p=>fmtDate(new Date(p.dueAt))===key);
    const note=notes[key];const isToday=key===today;
    const day=document.createElement('div');
    let cls='cal-day';if(!inMonth)cls+=' other-month';if(isToday)cls+=' today';if(dayPosts.length)cls+=' has-posts';
    day.className=cls;
    let html=`<div class="day-num">${d.getDate()}</div>`;
    if(dayPosts.length>0)html+=`<div class="day-posts-count">${dayPosts.length}</div>`;
    if(dayPosts.length>0)html+=`<div class="day-post-pill">${safeText(compactText(dayPosts[0].text,70))}</div>`;
    if(dayPosts.length>1)html+=`<div class="day-post-pill">${safeText(compactText(dayPosts[1].text,70))}</div>`;
    if(dayPosts.length>2)html+=`<div class="more-indicator">+${dayPosts.length-2} more</div>`;
    if(note)html+=`<div class="day-note-pill ${note.tag||'gold'}"><span class="note-pill-label">${safeText(note.label||noteTags[note.tag]||'Note')}</span>${safeText(compactText(note.text,60))}</div>`;
    day.innerHTML=html;day.onclick=()=>openDayNote(d);grid.appendChild(day);
  }
}
function openDayNote(date){
  state.selectedDate=date;const key=fmtDate(date);
  const note=getNotes()[key]||{text:'',tag:'gold',label:'Idea'};
  qs('noteDateLabel').textContent=date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  qs('noteText').value=note.text||'';
  qs('noteTag').value=`${note.tag||'gold'}|${note.label||noteTags[note.tag||'gold']||'Idea'}`;
  const dayPosts=state.scheduled.filter(p=>fmtDate(new Date(p.dueAt))===key);
  qs('dayModalPostPreview').innerHTML=dayPosts.length
    ?`<div class="label mb8">Scheduled posts</div>${dayPosts.map(p=>`<div class="day-post-pill mb8" style="border-radius:6px;">${safeText(p.text||'(no text)')}</div>`).join('')}`
    :`<div class="status-txt mb8" style="font-size:12px;">No scheduled posts on this day.${!bufferToken?' <span style="color:var(--subtle);">Connect Buffer to load scheduled posts here.</span>':' <span style="color:var(--subtle);">Load from Buffer to sync posts.</span>'}</div>`;
  qs('dayModalNotePreview').innerHTML=note.text
    ?`<div class="day-note-pill ${note.tag||'gold'} mb8"><span class="note-pill-label">${safeText(note.label||noteTags[note.tag||'gold']||'Note')}</span>${safeText(note.text)}</div>`:'';
  qs('noteStatus').textContent='';openModal('noteModal');
}
function saveNoteFromModal(){
  if(!state.selectedDate)return;const key=fmtDate(state.selectedDate);
  const text=qs('noteText').value.trim();const [tag,label]=qs('noteTag').value.split('|');
  const notes=getNotes();
  if(!text){
    delete notes[key];
    setNotes(notes);
    qs('noteStatus').textContent='Note removed.';
    renderCalendar();
    renderAgenda();
    return;
  }
  notes[key]={text,tag,label};
  setNotes(notes);
  qs('noteStatus').textContent='Saved.';
  renderCalendar();
  renderAgenda();
  showToast('Note saved','success');
}
function deleteNote(){
  if(!state.selectedDate)return;const notes=getNotes();delete notes[fmtDate(state.selectedDate)];setNotes(notes);
  qs('noteText').value='';
  qs('noteStatus').textContent='Deleted.';
  renderCalendar();
  renderAgenda();
  showToast('Note deleted','info');
}
function sendNoteToComposer(){
  if(!state.selectedDate)return;const text=qs('noteText').value.trim();
  if(!text){qs('noteStatus').textContent='Add note text first.';return;}
  const [tag,label]=qs('noteTag').value.split('|');
  const editor=qs('composerEditor');
  const payload=`[${label}] ${fmtDate(state.selectedDate)}\n${text}`;
  editor.innerText=editor.innerText?`${editor.innerText}\n\n${payload}`:payload;
  closeModal('noteModal');activateView('composerView');qs('composerEmpty').style.display='none';showToast('Note sent to Composer');
}
function postsByMonth(date){
  const y=date.getFullYear(),m=date.getMonth();
  return state.scheduled.filter(p=>{const d=new Date(p.dueAt);return d.getFullYear()===y&&d.getMonth()===m});
}
function notesForMonth(date){
  const all=getNotes();const y=date.getFullYear(),m=date.getMonth();
  return Object.entries(all).filter(([k])=>{const d=new Date(k+'T00:00:00');return d.getFullYear()===y&&d.getMonth()===m}).map(([date,val])=>({date,...val}));
}
function shareSnapshot(){
  const include=qs('includeNotes').checked;
  const month=monthLabel(state.month);
  const monthPosts=postsByMonth(state.month);const monthNotes=notesForMonth(state.month);
  qs('shareMonthName').textContent=month;qs('sharePostCount').textContent=monthPosts.length;qs('shareNoteCount').textContent=include?monthNotes.length:0;
  const payload={month,includeNotes:include,posts:monthPosts.map(p=>({dueAt:p.dueAt,text:p.text})),notes:include?monthNotes:[]};
  qs('shareLink').value=location.origin+location.pathname+'#share='+btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}
function renderSharedFromHash(){
  if(!location.hash.startsWith('#share='))return false;
  try{
    const snap=JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(7)))));
    closeModal('settingsModal');qs('app').classList.add('hidden');qs('sharedView').classList.remove('hidden');
    qs('sharedMonthTitle').textContent=snap.month;
    qs('sharedBanner').textContent=`Read-only snapshot · ${snap.posts.length} scheduled posts · Notes ${snap.includeNotes?'included':'excluded'}`;
    const grid=qs('sharedGrid');grid.innerHTML='';const map={};
    snap.posts.forEach(p=>{const k=p.dueAt.slice(0,10);(map[k]||(map[k]={posts:[],notes:[]})).posts.push(p.text)});
    (snap.notes||[]).forEach(n=>{(map[n.date]||(map[n.date]={posts:[],notes:[]})).notes.push(n)});
    Object.keys(map).sort().forEach(k=>{
      const d=document.createElement('div');d.className='cal-day';d.style.cursor='default';
      const day=map[k];let html=`<div class="day-num">${k.slice(8)}</div>`;
      if(day.posts.length)html+=`<div class="day-posts-count">${day.posts.length}</div>`;
      day.posts.slice(0,2).forEach(t=>{html+=`<div class="day-post-pill">${safeText(compactText(t,70))}</div>`});
      day.notes.slice(0,2).forEach(n=>{html+=`<div class="day-note-pill ${n.tag||'gold'}"><span class="note-pill-label">${safeText(n.label||'Note')}</span>${safeText(compactText(n.text,60))}</div>`});
      d.innerHTML=html;grid.appendChild(d);
    });
    return true;
  }catch(e){console.error(e);return false}
}

// ── POSTS ──
async function createPost(input){
  const parseCreatePostResult=(result)=>{
    if(!result)throw new Error('Empty mutation response from Buffer.');
    if(result.__typename==='PostActionSuccess') return result;

    const typename=String(result.__typename||'');
    const normalized=typename.toLowerCase();
    if(typename==='MutationError'){
      const err=new Error(result.message||'Buffer rejected this post request.');
      err.code='MUTATION_ERROR';
      throw err;
    }
    if(['InvalidInputError','PostInvalidInputError','PostActionInvalidInputError'].includes(typename)
      || normalized.includes('invalid') || normalized.includes('input')){
      const err=new Error(result.message||'Buffer rejected this post due to invalid content or scheduling values.');
      err.code='MUTATION_INVALID_INPUT';
      err.typename=typename;
      throw err;
    }
    if(['LimitReachedError','PostLimitReachedError','PostActionLimitReachedError'].includes(typename)
      || normalized.includes('limit') || normalized.includes('quota') || normalized.includes('rate')){
      const err=new Error(result.message||'Posting limit reached for this channel or plan. Try again later.');
      err.code='MUTATION_LIMIT_REACHED';
      err.typename=typename;
      throw err;
    }
    const err=new Error(`Buffer returned unsupported post result type: ${typename||'unknown'}`);
    err.code='MUTATION_UNSUPPORTED_TYPE';
    err.typename=typename||null;
    throw err;
  };

  const baseMutation=`mutation CreatePost($input:CreatePostInput!){
    createPost(input:$input){
      __typename
      ... on PostActionSuccess{post{id dueAt text channelId}}
      ... on MutationError{message}
    }
  }`;
  const richMutation=`mutation CreatePost($input:CreatePostInput!){
    createPost(input:$input){
      __typename
      ... on PostActionSuccess{post{id dueAt text channelId}}
      ... on MutationError{message}
      ... on InvalidInputError{message}
      ... on LimitReachedError{message}
    }
  }`;

  try{
    const res=await callBuffer(richMutation,{input});
    return parseCreatePostResult(res?.data?.createPost);
  }catch(err){
    const msg=String(err?.message||'');
    const validationFailed=/Unknown type|Cannot query field|Fragment cannot be spread|Validation error/i.test(msg);
    if(!validationFailed) throw err;
    const res=await callBuffer(baseMutation,{input});
    return parseCreatePostResult(res?.data?.createPost);
  }
}

function appendScheduledPostToCalendar(post){
  const dueAt=post?.dueAt;
  const id=post?.id;
  if(!dueAt||!id)return false;
  if((state.scheduled||[]).some(p=>String(p?.id)===String(id))) return true;
  state.scheduled=[...state.scheduled,{id,text:post?.text||'',dueAt,channelId:post?.channelId||null}];
  return true;
}

async function refreshCalendarAfterPostAction(action,createdPost){
  const shouldAffectCalendar=action==='queue'||action==='schedule';
  if(!shouldAffectCalendar) return;
  const optimisticAdded=appendScheduledPostToCalendar(createdPost);
  if(optimisticAdded){
    renderCalendar();
    renderAgenda();
  }
  try{
    await syncBuffer();
  }catch(err){
    console.warn('[PostIQ] calendar refresh after post action failed:',err);
  }
}

function composerFormat(cmd){
  const sel=window.getSelection();if(!sel.rangeCount)return;
  if(cmd==='bold'||cmd==='italic')document.execCommand(cmd,false,null);
  else if(cmd==='ul')document.execCommand('insertUnorderedList',false,null);
  else if(cmd==='ol')document.execCommand('insertOrderedList',false,null);
  else if(cmd==='clear')document.execCommand('removeFormat',false,null);
}
function editorHtmlToText(html){
  const root=document.createElement('div');root.innerHTML=html;
  const walk=(node)=>{
    if(node.nodeType===Node.TEXT_NODE)return node.textContent;
    const tag=(node.tagName||'').toLowerCase();
    if(tag==='br')return '\n';
    if(tag==='strong'||tag==='b')return `**${[...node.childNodes].map(walk).join('')}**`;
    if(tag==='em'||tag==='i')return `*${[...node.childNodes].map(walk).join('')}*`;
    if(tag==='li')return [...node.childNodes].map(walk).join('');
    if(tag==='ul')return [...node.children].map(li=>`• ${walk(li)}`).join('\n')+'\n';
    if(tag==='ol')return [...node.children].map((li,i)=>`${i+1}. ${walk(li)}`).join('\n')+'\n';
    const inner=[...node.childNodes].map(walk).join('');
    if(['p','div'].includes(tag))return inner+'\n';
    return inner;
  };
  return [...root.childNodes].map(walk).join('').replace(/\n{3,}/g,'\n\n').trim();
}
function isVideoUrlGlobal(url){
  return /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(String(url||''));
}

// ── UNIFIED MEDIA SYSTEM ──────────────────────────────────────────────────────
const IMGUR_CLIENT_ID='546c25a59c58ad7';
const mediaState={url:'',type:'',videoThumbUrl:'',source:''};

function applyMedia(url,source,thumbUrl=''){
  const type=isVideoUrlGlobal(url)?'video':'image';
  mediaState.url=url;mediaState.type=type;mediaState.source=source;mediaState.videoThumbUrl=thumbUrl;
  const li=qs('composerImageUrl');if(li)li.value=url;
  const lt=qs('videoThumbUrl');if(lt)lt.value=thumbUrl;
  const ton=qs('composerImageToggle'),toff=qs('composerImageToggleOff'),tthumb=qs('mediaToggleThumb'),tlabel=qs('mediaToggleLabel');
  if(url){
    ton.style.display='none';toff.style.display='inline-flex';
    tlabel.textContent=type==='video'?'🎬 Video attached':'🖼 Image attached';
    if(tthumb){tthumb.src=type==='image'?url:'';tthumb.style.display=type==='image'?'inline':'none';}
    const ms=qs('mediaSummary');if(ms)ms.classList.add('visible');
    const mst=qs('mediaSummaryThumb');if(mst){mst.src=type==='image'?url:'';mst.style.display=type==='image'?'block':'none';}
    const mstype=qs('mediaSummaryType');if(mstype)mstype.textContent=type==='video'?'🎬 Video':'🖼 Image';
    const msurl=qs('mediaSummaryUrl');if(msurl)msurl.textContent=url;
  }else{clearMediaState();}
}

function clearMediaState(){
  mediaState.url='';mediaState.type='';mediaState.source='';mediaState.videoThumbUrl='';
  const li=qs('composerImageUrl');if(li)li.value='';
  const lt=qs('videoThumbUrl');if(lt)lt.value='';
  qs('composerImageToggle').style.display='inline-flex';
  qs('composerImageToggleOff').style.display='none';
  const ms=qs('mediaSummary');if(ms)ms.classList.remove('visible');
  resetUploadTab();resetUrlTab();
}

function openMediaPanel(tab){qs('composerImagePanel').classList.add('open');if(tab)switchMediaTab(tab);}
function closeMediaPanel(){qs('composerImagePanel').classList.remove('open');}

function switchMediaTab(id){
  document.querySelectorAll('.media-tab').forEach(t=>t.classList.toggle('active',t.dataset.mtab===id));
  document.querySelectorAll('.media-tab-panel').forEach(p=>p.classList.toggle('active',p.dataset.mtabpanel===id));
  if(id==='past')loadPastImages();
}

function resetUploadTab(){
  const inner=qs('uploadZoneInner'),prog=qs('uploadProgress'),result=qs('uploadResult');
  if(inner)inner.style.display='flex';
  if(prog)prog.classList.remove('visible');
  if(result)result.classList.remove('visible');
  const bar=qs('uploadProgressBar');if(bar)bar.style.width='0%';
  const pct=qs('uploadPct');if(pct)pct.textContent='0%';
  const st=qs('uploadStatus');if(st){st.textContent='';st.style.color='';}
  const fi=qs('uploadFileInput');if(fi)fi.value='';
  const vn=qs('videoNotice');if(vn)vn.classList.remove('visible');
  const vtp=qs('videoThumbPanel');if(vtp)vtp.classList.remove('visible');
  const vtu=qs('videoThumbUrl');if(vtu)vtu.value='';
  const vtprev=qs('videoThumbPreview');if(vtprev)vtprev.classList.remove('visible');
  const vtc=qs('videoThumbClear');if(vtc)vtc.style.display='none';
}

async function imgurUpload(file){
  const fd=new FormData();fd.append('image',file);
  const res=await fetch('https://api.imgur.com/3/image',{method:'POST',headers:{'Authorization':`Client-ID ${IMGUR_CLIENT_ID}`},body:fd});
  const data=await res.json();
  if(!data.success)throw new Error(data.data?.error||'Upload failed');
  return data.data.link;
}

async function handleUploadFile(file){
  const isVideo=file.type.startsWith('video/'),isImage=file.type.startsWith('image/');
  const st=qs('uploadStatus');
  if(!isVideo&&!isImage){st.textContent='Unsupported file type.';st.style.color='var(--red)';return;}
  if(isVideo){
    qs('videoNotice').classList.add('visible');
    qs('videoThumbPanel').classList.add('visible');
    st.textContent='For video files, paste your hosted URL in the URL tab.';
    switchMediaTab('url');qs('composerImageUrl').focus();return;
  }
  qs('uploadZoneInner').style.display='none';
  qs('uploadProgress').classList.add('visible');
  qs('uploadFilename').textContent=file.name||'image';
  st.textContent='';st.style.color='';
  let prog=0;
  const tick=setInterval(()=>{prog=Math.min(prog+Math.random()*18,88);qs('uploadProgressBar').style.width=prog+'%';qs('uploadPct').textContent=Math.round(prog)+'%';},180);
  try{
    const url=await imgurUpload(file);
    clearInterval(tick);
    qs('uploadProgressBar').style.width='100%';qs('uploadPct').textContent='100%';
    await new Promise(r=>setTimeout(r,250));
    qs('uploadProgress').classList.remove('visible');
    qs('uploadResult').classList.add('visible');
    qs('uploadThumb').src=url;
    qs('uploadResultName').textContent=file.name||'uploaded image';
    qs('uploadResultUrl').textContent=url;
    st.textContent='✅ Uploaded successfully.';st.style.color='var(--green)';
    applyMedia(url,'upload');showToast('Image uploaded ✓','success');
  }catch(err){
    clearInterval(tick);
    qs('uploadProgress').classList.remove('visible');
    qs('uploadZoneInner').style.display='flex';
    st.textContent='Upload failed: '+err.message;st.style.color='var(--red)';
    showToast('Upload failed','error');
  }
}

function updateVTPPreview(url){
  const prev=qs('videoThumbPreview'),img=qs('videoThumbImg'),btn=qs('videoThumbClear');
  if(url){img.src=url;prev.classList.add('visible');btn.style.display='inline-flex';}
  else{prev.classList.remove('visible');btn.style.display='none';}
}

function initUploadTab(){
  const zone=qs('uploadZone'),fi=qs('uploadFileInput');
  zone.addEventListener('click',e=>{
    if(e.target.closest('.dropzone-browse')||e.target.closest('.result-actions'))return;
    if(!qs('uploadResult').classList.contains('visible'))fi.click();
  });
  qs('uploadBrowseBtn').addEventListener('click',e=>{e.stopPropagation();fi.click();});
  fi.addEventListener('change',()=>{if(fi.files[0])handleUploadFile(fi.files[0]);});
  zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('drag-active');});
  zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('drag-active');});
  zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('drag-active');if(e.dataTransfer.files[0])handleUploadFile(e.dataTransfer.files[0]);});
  document.addEventListener('paste',e=>{
    if(!qs('composerImagePanel').classList.contains('open'))return;
    const active=document.querySelector('.media-tab.active')?.dataset.mtab;
    if(active!=='upload')return;
    const img=Array.from(e.clipboardData?.items||[]).find(i=>i.type.startsWith('image/'));
    if(img)handleUploadFile(img.getAsFile());
  });
  qs('uploadReplaceBtn').addEventListener('click',e=>{e.stopPropagation();resetUploadTab();fi.click();});
  qs('uploadClearBtn').addEventListener('click',e=>{e.stopPropagation();resetUploadTab();clearMediaState();showToast('Media removed','info');});
  qs('videoThumbUploadBtn').addEventListener('click',e=>{e.stopPropagation();qs('videoThumbFile').click();});
  qs('videoThumbFile').addEventListener('change',async()=>{
    const f=qs('videoThumbFile').files[0];if(!f)return;
    const st=qs('videoThumbStatus');st.textContent='Uploading…';
    try{const url=await imgurUpload(f);qs('videoThumbUrl').value=url;updateVTPPreview(url);mediaState.videoThumbUrl=url;st.textContent='✅ Thumbnail ready.';st.style.color='var(--green)';}
    catch(err){st.textContent='Failed: '+err.message;st.style.color='var(--red)';}
  });
  qs('videoThumbUrl').addEventListener('input',()=>{const url=qs('videoThumbUrl').value.trim();updateVTPPreview(url);mediaState.videoThumbUrl=url;});
  qs('videoThumbClear').addEventListener('click',e=>{e.stopPropagation();qs('videoThumbUrl').value='';updateVTPPreview('');mediaState.videoThumbUrl='';});
}

function resetUrlTab(){
  const inp=qs('composerImageUrl');if(inp)inp.value='';
  const pa=qs('urlPreviewArea');if(pa)pa.classList.remove('visible');
  const cb=qs('urlClearBtn');if(cb)cb.style.display='none';
  const vr=qs('urlVideoThumbRow');if(vr)vr.classList.remove('visible');
  const pi=qs('urlPreviewImg');if(pi)pi.style.display='';
}

function updateUrlPreview(url){
  const pa=qs('urlPreviewArea'),pi=qs('urlPreviewImg'),pt=qs('urlPreviewType'),pv=qs('urlPreviewValue'),cb=qs('urlClearBtn'),vr=qs('urlVideoThumbRow');
  if(!url){pa.classList.remove('visible');cb.style.display='none';vr.classList.remove('visible');return;}
  cb.style.display='inline-flex';
  if(isVideoUrlGlobal(url)){
    pi.style.display='none';vr.classList.add('visible');
    pt.textContent='🎬 Video URL';pv.textContent=url.length>80?url.slice(0,77)+'…':url;
  }else{
    pi.style.display='';pi.src=url;vr.classList.remove('visible');
    pt.textContent='Image URL';pv.textContent=url.length>80?url.slice(0,77)+'…':url;
  }
  pa.classList.add('visible');
}

function initUrlTab(){
  const inp=qs('composerImageUrl'),cb=qs('urlClearBtn');
  inp.addEventListener('input',()=>{const url=inp.value.trim();updateUrlPreview(url);if(url)applyMedia(url,'url',qs('urlVideoThumbUrl')?.value?.trim()||'');else clearMediaState();});
  inp.addEventListener('paste',()=>setTimeout(()=>{const url=inp.value.trim();updateUrlPreview(url);if(url)applyMedia(url,'url');},50));
  cb.addEventListener('click',()=>{inp.value='';updateUrlPreview('');clearMediaState();showToast('Media removed','info');});
  const uvt=qs('urlVideoThumbUrl');
  if(uvt)uvt.addEventListener('input',()=>{mediaState.videoThumbUrl=uvt.value.trim();const lt=qs('videoThumbUrl');if(lt)lt.value=uvt.value.trim();});
}

let _unsplashLast='';

function initUnsplashTab(){
  qs('unsplashSearchBtn').addEventListener('click',runUnsplashSearch);
  qs('unsplashQuery').addEventListener('keydown',e=>{if(e.key==='Enter')runUnsplashSearch();});
}

async function runUnsplashSearch(){
  const q=qs('unsplashQuery').value.trim();if(!q)return;
  if(q===_unsplashLast)return;_unsplashLast=q;
  const grid=qs('unsplashGrid'),status=qs('unsplashStatus'),attr=qs('unsplashAttribution');
  attr.style.display='none';status.textContent='Searching…';
  grid.innerHTML=Array(9).fill('<div class="unsplash-skeleton"></div>').join('');
  try{
    const res=await fetch(`/.netlify/functions/unsplash-search?q=${encodeURIComponent(q)}`);
    if(!res.ok)throw new Error(res.status===403?'Rate limit — try again shortly':`Error ${res.status}`);
    const data=await res.json();grid.innerHTML='';
    if(!data.results?.length){status.textContent=`No results for "${q}".`;return;}
    status.textContent=`${data.total.toLocaleString()} results for "${q}"`;
    attr.style.display='block';
    data.results.forEach(photo=>{
      const item=document.createElement('div');item.className='unsplash-item';
      item.innerHTML=`<img src="${photo.urls.small}" alt="${safeText(photo.alt_description||q)}" loading="lazy"/><div class="unsplash-item-overlay"><span class="unsplash-item-author">${safeText(photo.user.name)}</span></div>`;
      item.title=`Photo by ${photo.user.name}`;
      item.addEventListener('click',()=>{
        applyMedia(photo.urls.regular,'unsplash');
        document.querySelectorAll('.unsplash-item').forEach(el=>el.style.borderColor='transparent');
        item.style.borderColor='var(--amber)';
        closeMediaPanel();showToast(`Photo by ${photo.user.name} — added ✓`,'success');
      });
      grid.appendChild(item);
    });
  }catch(err){
    grid.innerHTML='';status.textContent='Search failed: '+err.message;
    showToast('Unsplash search failed','error');
  }
}

let _pastLoaded=false,_pastCache=[];

async function loadPastImages(){
  if(_pastLoaded&&_pastCache.length){renderPastImages(_pastCache);return;}
  const grid=qs('pastImagesGrid'),status=qs('pastImagesStatus'),empty=qs('pastImagesEmpty');
  grid.innerHTML='';
  empty.style.display='none';
  status.textContent='';
  showFetchLoading(grid);
  const seen=new Set(),images=[];
  (state.scheduled||[]).forEach(p=>(p.assets||[]).forEach(a=>{
    const src=a.source||a.thumbnail;
    if(src&&!seen.has(src)&&/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(src)){seen.add(src);images.push({src,thumb:a.thumbnail||src});}
  }));
  if(bufferToken){
    try{
      const acc=await callBuffer('query{account{organizations{id}}}');
      const orgId=acc?.data?.account?.organizations?.[0]?.id;
      if(orgId){
        const r=await callBuffer(`query SentPosts($organizationId:OrganizationId!){posts(first:50,input:{organizationId:$organizationId,filter:{status:[sent]}}){edges{node{assets{thumbnail mimeType source}}}}}`,{organizationId:orgId});
        (r?.data?.posts?.edges||[]).forEach(e=>(e.node?.assets||[]).forEach(a=>{
          const src=a.source||a.thumbnail;
          if(src&&!seen.has(src)&&/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(src)){seen.add(src);images.push({src,thumb:a.thumbnail||src});}
        }));
      }
    }catch(err){console.warn('[PostIQ] past images:',err);}
  }
  _pastCache=images;_pastLoaded=true;
  clearFetchLoading(grid);
  status.textContent=images.length?`${images.length} past image${images.length!==1?'s':''} — click to use`:'';
  renderPastImages(images);
}

function renderPastImages(images){
  const grid=qs('pastImagesGrid'),empty=qs('pastImagesEmpty');
  grid.innerHTML='';
  if(!images.length){empty.style.display='block';return;}
  empty.style.display='none';
  images.forEach(img=>{
    const item=document.createElement('div');item.className='past-img-item';
    if(img.src===mediaState.url)item.classList.add('selected');
    item.innerHTML=`<img src="${img.thumb}" loading="lazy" alt=""/><div class="past-img-checkmark">✓</div>`;
    item.addEventListener('click',()=>{
      document.querySelectorAll('.past-img-item').forEach(el=>el.classList.remove('selected'));
      item.classList.add('selected');
      applyMedia(img.src,'past');closeMediaPanel();showToast('Image selected ✓','success');
    });
    grid.appendChild(item);
  });
}

function initUnifiedMediaSystem(){
  qs('composerImageToggle').addEventListener('click',()=>{qs('composerImagePanel').classList.contains('open')?closeMediaPanel():openMediaPanel('upload');});
  qs('composerImageToggleOff').addEventListener('click',()=>{qs('composerImagePanel').classList.contains('open')?closeMediaPanel():openMediaPanel();});
  document.querySelectorAll('.media-tab').forEach(t=>t.addEventListener('click',()=>switchMediaTab(t.dataset.mtab)));
  qs('mediaSummaryClear').addEventListener('click',()=>{clearMediaState();showToast('Media removed','info');});
  qs('pastImagesLoadBtn').addEventListener('click',()=>{_pastLoaded=false;_pastCache=[];loadPastImages();});
  initUploadTab();initUrlTab();initUnsplashTab();
  window.openImageLibrary=()=>{openMediaPanel('past');activateView('composerView');};
}

async function composerSend(action){
  const text=editorHtmlToText(qs('composerEditor').innerHTML);
  if(!text){
    showToast('Write something first','error');
    qs('composerStatus').textContent='Add content before sending.';
    qs('composerEditor').focus();
    return;
  }
  if(!bufferToken){
    showToast('No Buffer token — add it in the sidebar','error');
    qs('composerStatus').textContent='Connect Buffer first: paste your token in the sidebar.';
    return;
  }
  const channelId=qs('composerChannel').value;
  if(!channelId){
    showToast('No channels loaded — sync Buffer first','error');
    qs('composerStatus').textContent='Hit "Load from Buffer" to fetch your channels.';
    return;
  }
  const when=qs('composerWhen').value;
  const needsApproval=qs('composerNeedsApproval')?.checked||false;
  const input={channelId,text,schedulingType:'automatic'};
  if(action==='draft'){input.mode='addToQueue';input.saveToDraft=true;}
  if(action==='queue'){input.mode='addToQueue';}
  if(action==='schedule'){if(!when){qs('composerStatus').textContent='Pick a date/time first.';return;}input.mode='customScheduled';input.dueAt=when;}
  // Attach image or video with correct asset shape
  const imgUrl=mediaState?.url||qs('composerImageUrl')?.value?.trim()||'';
  if(imgUrl){
    if(isVideoUrlGlobal(imgUrl)){
      const thumbUrl=mediaState?.videoThumbUrl||qs('videoThumbUrl')?.value?.trim()||'';
      const videoEntry={url:imgUrl};
      if(thumbUrl)videoEntry.thumbnailUrl=thumbUrl;
      input.assets={videos:[videoEntry]};
    }else{
      input.assets={images:[{url:imgUrl}]};
    }
  }
  try{
    qs('composerStatus').textContent='Sending…';
    const created=await createPost(input);
    const draftId=created?.post?.id||null;
    // If saved as draft with needs_approval, store approval metadata
    if(action==='draft'&&needsApproval&&draftId){
      const ch=state.channels.find(c=>c.id===channelId);
      setApprovalMeta(draftId,{
        needs_approval:true,
        status:'pending',
        comments:[],
        link_generated:false,
        locked:false,
        content:text,
        platform:ch?.service||null,
        image_url:imgUrl||null,
        channel_id:channelId,
        created_at:Date.now()
      });
    }
    // On queue/schedule: clear any existing approval metadata for this draft
    if(action!=='draft'&&draftId){clearApprovalMeta(draftId);}
    const msg=action==='draft'?'Draft saved.':action==='queue'?'Added to queue.':'Scheduled.';
    qs('composerStatus').textContent=msg;showToast(msg);
    if(action==='draft')trackEvent('draft_to_buffer');
    if(action==='queue')trackEvent('queue_to_buffer');
    if(action==='schedule')trackEvent('schedule_to_buffer');
    await refreshCalendarAfterPostAction(action,created?.post);
    // Clear composer
    const editor=qs('composerEditor');
    editor.innerText='';
    qs('composerEmpty').style.display='block';
    qs('composerChannel').selectedIndex=0;
    qs('composerWhen').value='';
    if(qs('composerNeedsApproval'))qs('composerNeedsApproval').checked=false;
    updateComposerChannelHint&&updateComposerChannelHint();
    // Clear media panel
    clearMediaState();
    closeMediaPanel();
  }catch(e){
    const message=getActionErrorMessage(e,'Failed to send post.');
    if(isAuthFailureError(e)) clearBufferTokenForAuthFailure(message);
    qs('composerStatus').textContent=`Failed: ${message}`;
  }
}

// ── APPROVALS TAB ──────────────────────────────────────────────────────────

const approvalsState={loading:false};

async function loadApprovals(){
  if(approvalsState.loading)return;
  approvalsState.loading=true;
  const listEl=qs('approvalsList');
  const loadingEl=qs('approvalsLoading');
  const emptyEl=qs('approvalsEmpty');
  if(!listEl)return;
  loadingEl.style.display='none';
  listEl.innerHTML='';
  showFetchLoading(listEl);
  emptyEl.style.display='none';
  try{
    const metas=getAllApprovalMetas();
    if(!metas.length){clearFetchLoading(listEl);emptyEl.style.display='block';approvalsState.loading=false;return;}
    // Fetch Buffer drafts if connected (best-effort — local data is source of truth)
    let bufferDrafts=[];
    if(bufferToken){
      try{
        const acc=await callBuffer('query { account { organizations { id } } }');
        const orgId=acc?.data?.account?.organizations?.[0]?.id;
        if(orgId){
          const dq=`query Drafts($organizationId: OrganizationId!){posts(first:100,input:{organizationId:$organizationId,filter:{status:[draft]}}){edges{node{id text channelId assets{thumbnail mimeType source}}}}}`;
          const dr=await callBuffer(dq,{organizationId:orgId});
          bufferDrafts=(dr?.data?.posts?.edges||[]).map(e=>e.node);
        }
      }catch(e){console.warn('[PostIQ] drafts fetch:',e);}
    }
    // Sync remote approval status for posts with generated links
    for(const meta of metas){
      if(meta.link_generated&&meta.approval_uuid){
        try{
          const r=await fetch('/.netlify/functions/approval',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'get',id:meta.approval_uuid})});
          const d=await r.json();
          if(!d.error){
            const updated={...meta,status:d.status||meta.status,comments:d.comments||meta.comments};
            // Changes requested → unlock so user can edit & regenerate link
            if(d.status==='changes_requested'){updated.link_generated=false;updated.locked=false;}
            setApprovalMeta(meta.draftId,updated);
            Object.assign(meta,updated);
          }
        }catch(e){console.warn('[PostIQ] approval sync:',e);}
      }
    }
    clearFetchLoading(listEl);
    if(!metas.length){emptyEl.style.display='block';}
    else{metas.forEach(meta=>{const bp=bufferDrafts.find(p=>p.id===meta.draftId)||null;renderApprovalCard(meta,bp);});}
  }catch(e){
    console.error('[PostIQ] loadApprovals:',e);
    clearFetchLoading(listEl);
    loadingEl.style.display='block';
    loadingEl.textContent='Failed to load approvals.';
  }finally{approvalsState.loading=false;}
}

function renderApprovalCard(meta,bufferPost){
  const listEl=qs('approvalsList');
  const draftId=meta.draftId;
  const content=meta.content||bufferPost?.text||'(No content)';
  const platform=meta.platform||'';
  const imageUrl=meta.image_url||'';
  const statusClass=meta.status==='approved'?'approved':meta.status==='changes_requested'?'changes_requested':'pending';
  const statusLabel=meta.status==='approved'?'Approved':meta.status==='changes_requested'?'Changes Requested':'Pending';
  const safeId=draftId.replace(/[^a-zA-Z0-9_-]/g,'_');

  const card=document.createElement('div');
  card.className='approval-card';
  card.dataset.draftId=draftId;
  card.dataset.safeId=safeId;

  const platformBadge=platform?`<span class="chip" style="text-transform:capitalize;">${safeText(platform)}</span>`:'';
  const lockBanner=meta.link_generated?`<div class="approval-locked-banner">🔒 Locked for review — content is read-only while approval link is active</div>`:'';

  let linkBox='';
  if(meta.link_generated&&meta.approval_url){
    linkBox=`<div class="approval-link-box">
      <span class="approval-link-url">${safeText(meta.approval_url)}</span>
      <button class="btn sm" onclick="approvalCopyLink('${safeId}')">Copy</button>
    </div>`;
  }
  const genBtn=!meta.link_generated?`<button class="btn primary sm" id="approval-gen-${safeId}" onclick="approvalGenerateLink('${safeId}')">🔗 Generate Approval Link</button>`:'';

  const commentsHtml=meta.comments&&meta.comments.length
    ?`<div class="approval-comments-section">
        <div style="font-size:11px;font-weight:700;font-family:'DM Mono',monospace;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Reviewer Feedback</div>
        ${meta.comments.map(c=>`<div class="approval-comment">
          <div class="approval-comment-meta">
            <span class="approval-comment-author">${safeText(c.author||'Anonymous')}</span>
            <span class="approval-comment-time">${c.timestamp?new Date(c.timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):''}</span>
            ${c.action?`<span class="approval-comment-action-chip ${c.action==='approved'?'approved':'changes_requested'}">${c.action==='approved'?'Approved':'Changes'}</span>`:''}
          </div>
          <div class="approval-comment-text">${safeText(c.text||'')}</div>
        </div>`).join('')}
      </div>`
    :'';

  const borderColor=
    meta.status==='approved'?'var(--green)':
    meta.status==='changes_requested'?'var(--red)':'var(--amber)';
  card.style.borderLeft=`3px solid ${borderColor}`;
  card.style.padding='0';
  card.style.overflow='hidden';

  const statusMessage=
    meta.status==='approved'
      ?`<span style="color:var(--green);font-size:11px;font-family:'DM Mono',monospace;font-weight:700;">✓ Approved — ready to publish</span>`
      :meta.status==='changes_requested'
      ?`<span style="color:var(--red);font-size:11px;font-family:'DM Mono',monospace;font-weight:700;">✎ Changes requested</span>`
      :`<span style="color:var(--amber);font-size:11px;font-family:'DM Mono',monospace;font-weight:700;">⏳ Pending review</span>`;

  const pubDisabled=meta.status==='pending'&&meta.link_generated;

  card.innerHTML=`
    <!-- ZONE 1: HEADER STRIP -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;
                padding:10px 16px;background:var(--surface2);border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span class="approval-status-badge ${statusClass}">${statusLabel}</span>
        ${platformBadge}
        <span style="font-size:11px;font-family:'DM Mono',monospace;color:var(--subtle);">
          ${meta.created_at?new Date(meta.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):''}
        </span>
      </div>
      <button class="btn sm ghost" onclick="approvalRemoveCard('${safeId}')" title="Remove">✕</button>
    </div>

    <!-- ZONE 2: CONTENT -->
    <div style="padding:16px;display:flex;gap:16px;align-items:flex-start;">
      <!-- If image: show it large on top, copy below. If no image: just copy. -->
      <div style="flex:1;min-width:0;">
        ${meta.link_generated?`
          <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;
            background:var(--amber-dim);border:1px solid var(--amber-glow);border-radius:6px;
            font-size:11px;font-family:'DM Mono',monospace;color:var(--amber);font-weight:600;
            margin-bottom:12px;">🔒 Locked for review</div>`:''}
        ${imageUrl?`
          <div style="margin-bottom:12px;">
            <img src="${safeText(imageUrl)}" alt="Media"
              style="width:100%;max-height:280px;object-fit:cover;border-radius:10px;
                     border:1px solid var(--border);display:block;cursor:pointer;"
              onclick="window.open('${safeText(imageUrl)}','_blank')"
              title="Click to view full size" />
          </div>`:''}
        <div style="font-size:14px;line-height:1.65;color:var(--text);white-space:pre-wrap;
                    word-break:break-word;padding:12px;background:var(--surface2);
                    border:1px solid var(--border);border-radius:8px;">
          ${safeText(content)}
        </div>
        ${statusMessage?`<div style="margin-top:8px;">${statusMessage}</div>`:''}
      </div>
    </div>

    <!-- ZONE 2b: COMMENTS (if any) -->
    ${meta.comments&&meta.comments.length?`
      <div style="padding:0 16px 12px;">
        <div style="font-size:10px;font-weight:700;font-family:'DM Mono',monospace;
                    color:var(--subtle);text-transform:uppercase;letter-spacing:.6px;
                    margin-bottom:8px;">Reviewer Feedback</div>
        ${meta.comments.map(c=>`
          <div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);
                      border-radius:8px;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
              <span style="font-weight:600;font-size:12px;">${safeText(c.author||'Anonymous')}</span>
              <span style="font-size:10px;color:var(--subtle);font-family:'DM Mono',monospace;">
                ${c.timestamp?new Date(c.timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric'}):''}
              </span>
              ${c.action==='approved'
                ?`<span style="font-size:10px;font-weight:700;font-family:'DM Mono',monospace;
                               padding:2px 7px;border-radius:4px;background:var(--green-dim);
                               color:var(--green);">Approved</span>`
                :c.action==='changes_requested'
                ?`<span style="font-size:10px;font-weight:700;font-family:'DM Mono',monospace;
                               padding:2px 7px;border-radius:4px;background:rgba(247,112,112,.10);
                               color:var(--red);">Changes</span>`:''}
            </div>
            <div style="font-size:13px;color:var(--text);line-height:1.5;">
              ${safeText(c.text||'')}
            </div>
          </div>`).join('')}
      </div>`:''}

    <!-- ZONE 3: ACTION FOOTER -->
    <div style="padding:14px 16px;border-top:1px solid var(--border);background:var(--surface2);">

      ${!meta.link_generated?`
        <!-- Generate link CTA -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:2px;">
              Share for approval
            </div>
            <div style="font-size:11px;color:var(--muted);">
              Generate a link to send to your reviewer.
            </div>
          </div>
          <button class="btn primary" id="approval-gen-${safeId}"
            onclick="approvalGenerateLink('${safeId}')">🔗 Generate Link</button>
        </div>`

      :meta.link_generated&&meta.approval_url?`
        <!-- Active link -->
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:600;font-family:'DM Mono',monospace;
                      color:var(--muted);text-transform:uppercase;letter-spacing:.5px;
                      margin-bottom:6px;">Approval link</div>
          <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;
                      background:var(--surface);border:1px solid var(--border2);border-radius:8px;">
            <span style="flex:1;font-family:'DM Mono',monospace;font-size:11px;color:var(--blue);
                         white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${safeText(meta.approval_url)}
            </span>
            <button class="btn sm" onclick="approvalCopyLink('${safeId}')">Copy</button>
          </div>
        </div>
        <!-- Publish controls -->
        <div id="approval-pub-${safeId}" style="${pubDisabled?'opacity:0.45;pointer-events:none;':''}">
          ${pubDisabled?`<div style="font-size:11px;font-family:'DM Mono',monospace;
            color:var(--subtle);margin-bottom:8px;">
            Publishing unlocks once reviewer responds.</div>`:''}
          <div style="font-size:11px;font-weight:600;font-family:'DM Mono',monospace;
                      color:var(--muted);text-transform:uppercase;letter-spacing:.5px;
                      margin-bottom:8px;">Publish to</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <select id="approval-ch-${safeId}" class="input"
              style="flex:1;min-width:160px;font-size:13px;"></select>
            <button class="btn sm" onclick="approvalPublish('${safeId}','draft')">Save draft</button>
            <button class="btn sm success" onclick="approvalPublish('${safeId}','queue')">Add to queue</button>
            <button class="btn sm primary" onclick="approvalToggleSchedule('${safeId}')">📅 Schedule</button>
          </div>
          <div id="approval-sched-${safeId}" style="display:none;margin-top:8px;">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <input type="date" id="approval-date-${safeId}" class="input"
                style="flex:1;font-size:13px;" />
              <input type="time" id="approval-time-${safeId}" class="input"
                style="max-width:130px;font-size:13px;" value="09:00" />
              <button class="btn sm primary"
                onclick="approvalPublish('${safeId}','schedule')">Send</button>
              <button class="btn sm ghost"
                onclick="document.getElementById('approval-sched-${safeId}').style.display='none'">✕</button>
            </div>
          </div>
        </div>`

      :''}

      <div id="approval-status-${safeId}" class="status-txt mt8"></div>
    </div>`;

  // Populate channel selector after DOM insert
  setTimeout(()=>{
    const sel=document.getElementById(`approval-ch-${safeId}`);
    const dateIn=document.getElementById(`approval-date-${safeId}`);
    if(sel){
      sel.innerHTML='';
      if(state.channels.length){
        state.channels.forEach(c=>{
          const o=document.createElement('option');
          o.value=c.id;o.textContent=`${c.displayName||c.name} (${c.service})`;
          if(c.id===meta.channel_id)o.selected=true;
          sel.appendChild(o);
        });
      }else{
        const o=document.createElement('option');o.value='';o.textContent='↻ Load channels from Buffer first';sel.appendChild(o);
      }
    }
    if(dateIn)dateIn.value=new Date().toISOString().slice(0,10);
  },0);

  listEl.appendChild(card);
}

function getApprovalDraftId(safeId){
  const card=document.querySelector(`.approval-card[data-safe-id="${CSS.escape(safeId)}"]`);
  return card?.dataset?.draftId||safeId;
}

window.approvalGenerateLink=async function(safeId){
  const draftId=getApprovalDraftId(safeId);
  const meta=getApprovalMeta(draftId);
  if(!meta){showToast('Approval record not found','error');return;}
  const btn=document.getElementById(`approval-gen-${safeId}`);
  if(btn){btn.disabled=true;btn.textContent='Generating…';}
  try{
    const res=await fetch('/.netlify/functions/approval',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',post:{content:meta.content||'',platform:meta.platform||null,image_url:meta.image_url||null}})});
    const data=await res.json();
    if(data.error)throw new Error(data.error);
    setApprovalMeta(draftId,{...meta,link_generated:true,locked:true,approval_uuid:data.id,approval_url:data.url});
    showToast('Approval link generated!','success');
    loadApprovals();
  }catch(e){
    showToast('Failed: '+e.message,'error');
    if(btn){btn.disabled=false;btn.textContent='🔗 Generate Approval Link';}
  }
};

window.approvalCopyLink=function(safeId){
  const draftId=getApprovalDraftId(safeId);
  const meta=getApprovalMeta(draftId);
  if(!meta?.approval_url){showToast('No link available','error');return;}
  navigator.clipboard.writeText(meta.approval_url);
  showToast('Link copied!','success');
};

window.approvalRemoveCard=function(safeId){
  const draftId=getApprovalDraftId(safeId);
  if(!confirm('Remove this approval entry? The Buffer draft will not be deleted.'))return;
  clearApprovalMeta(draftId);
  const card=document.querySelector(`[data-draft-id="${CSS.escape(draftId)}"]`);
  if(card)card.remove();
  else loadApprovals();
  showToast('Removed','info');
};

window.approvalToggleSchedule=function(safeId){
  const panel=document.getElementById(`approval-sched-${safeId}`);
  if(panel)panel.style.display=panel.style.display==='none'?'block':'none';
};

window.approvalPublish=async function(safeId,action){
  const draftId=getApprovalDraftId(safeId);
  const meta=getApprovalMeta(draftId);
  if(!meta){showToast('Approval record not found','error');return;}
  // Warn if approval link is still active
  if(meta.link_generated&&action!=='draft'){
    if(!confirm('This post has an active approval link. The reviewer may still be looking at it. Publish anyway?'))return;
  }
  const channelId=document.getElementById(`approval-ch-${safeId}`)?.value;
  if(!channelId){showToast('Select a channel first','error');return;}
  const content=meta.content||'';
  if(!content){showToast('No content to publish','error');return;}
  const input={channelId,text:content,schedulingType:'automatic'};
  if(action==='draft'){input.mode='addToQueue';input.saveToDraft=true;}
  if(action==='queue'){input.mode='addToQueue';}
  if(action==='schedule'){
    const dv=document.getElementById(`approval-date-${safeId}`)?.value;
    const tv=document.getElementById(`approval-time-${safeId}`)?.value||'09:00';
    if(!dv){showToast('Pick a date first','error');return;}
    input.mode='customScheduled';
    input.dueAt=`${dv}T${tv}:00.000Z`;
  }
  if(meta.image_url){
    if(/\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(meta.image_url)){
      input.assets={videos:[{url:meta.image_url}]};
    }else{
      input.assets={images:[{url:meta.image_url}]};
    }
  }
  const statusEl=document.getElementById(`approval-status-${safeId}`);
  if(statusEl)statusEl.textContent='Sending…';
  try{
    const created=await createPost(input);
    clearApprovalMeta(draftId);
    const msg=action==='draft'?'Draft saved.':action==='queue'?'Added to queue.':'Scheduled.';
    showToast(msg,'success');
    await refreshCalendarAfterPostAction(action,created?.post);
    const card=document.querySelector(`[data-draft-id="${CSS.escape(draftId)}"]`);
    if(card){card.style.opacity='.4';card.style.pointerEvents='none';setTimeout(()=>card.remove(),600);}
  }catch(e){
    const message=getActionErrorMessage(e,'Failed to publish approval item.');
    if(isAuthFailureError(e)) clearBufferTokenForAuthFailure(message);
    if(statusEl)statusEl.textContent=`Failed: ${message}`;
    showToast('Failed: '+message,'error');
  }
};

// ── REVIEWER PAGE ────────────────────────────────────────────────────────────

async function renderReviewerPage(uuid){
  // Hide the main app UI
  const appEl=document.getElementById('app');
  if(appEl)appEl.style.display='none';
  const mobTabs=document.querySelector('.mobile-tabs');
  if(mobTabs)mobTabs.style.display='none';
  const page=qs('reviewerPage');
  if(!page)return;
  page.classList.add('active');
  const loadingEl=qs('reviewerLoading');
  const contentEl=qs('reviewerContent');
  const confirmedEl=qs('reviewerConfirmed');
  const errorEl=qs('reviewerError');
  loadingEl.style.display='block';
  contentEl.style.display='none';
  confirmedEl.style.display='none';
  errorEl.style.display='none';
  try{
    const res=await fetch('/.netlify/functions/approval',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'get',id:uuid})});
    const record=await res.json();
    loadingEl.style.display='none';
    if(record.error){
      errorEl.style.display='block';
      qs('reviewerErrorMsg').textContent='This review link could not be found. It may have expired or been removed.';
      return;
    }
    contentEl.style.display='block';
    const platform=record.post?.platform||'';
    const content=record.post?.content||'';
    const imageUrl=record.post?.image_url||'';
    const comments=record.comments||[];
    const safeUUID=safeText(uuid);
    contentEl.innerHTML=`
      <div class="reviewer-post-card">
        ${platform?`<div class="reviewer-platform-badge">${safeText(platform)}</div>`:''}
        <div class="reviewer-content">${safeText(content)}</div>
        ${imageUrl?`<img src="${safeText(imageUrl)}" class="reviewer-post-img" alt="Post media" />`:''}
      </div>
      ${comments.length?`
        <div class="reviewer-section-card" style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;font-family:'DM Mono',monospace;color:#9aa0b8;text-transform:uppercase;letter-spacing:.7px;margin-bottom:14px;">Previous Comments</div>
          ${comments.map(c=>`
            <div class="reviewer-comment">
              <div class="reviewer-comment-author">${safeText(c.author||'Anonymous')}</div>
              <div class="reviewer-comment-time">${c.timestamp?new Date(c.timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}):''}</div>
              <div class="reviewer-comment-text">${safeText(c.text||'')}</div>
            </div>`).join('')}
        </div>`:''  }
      <div class="reviewer-section-card">
        <div style="margin-bottom:18px;">
          <label class="reviewer-form-label" for="reviewerAuthor">Your name</label>
          <input id="reviewerAuthor" class="reviewer-input" placeholder="Enter your name…" autocomplete="name" />
        </div>
        <div>
          <label class="reviewer-form-label" for="reviewerComment">Notes (optional)</label>
          <textarea id="reviewerComment" class="reviewer-textarea" placeholder="Leave feedback, suggestions, or approval notes for the author…"></textarea>
        </div>
        <div class="reviewer-actions">
          <button class="reviewer-btn approve" id="reviewerApproveBtn" onclick="submitReviewAction('${safeUUID}','approved')">✓ Approve</button>
          <button class="reviewer-btn changes" id="reviewerChangesBtn" onclick="submitReviewAction('${safeUUID}','changes_requested')">✎ Request Changes</button>
        </div>
        <div id="reviewerStatusMsg" class="reviewer-status-msg"></div>
      </div>`;
  }catch(e){
    loadingEl.style.display='none';
    errorEl.style.display='block';
    qs('reviewerErrorMsg').textContent='Failed to load the review request. Please try again later.';
    console.error('[PostIQ] reviewer page:',e);
  }
}

window.submitReviewAction=async function(uuid,action){
  const author=(qs('reviewerAuthor')?.value||'').trim()||'Anonymous';
  const comment=(qs('reviewerComment')?.value||'').trim();
  const approveBtn=qs('reviewerApproveBtn');
  const changesBtn=qs('reviewerChangesBtn');
  const statusEl=qs('reviewerStatusMsg');
  if(approveBtn)approveBtn.disabled=true;
  if(changesBtn)changesBtn.disabled=true;
  if(statusEl)statusEl.textContent='Submitting…';
  try{
    const res=await fetch('/.netlify/functions/approval',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update',id:uuid,status:action,author,comment:comment||(action==='approved'?'Approved.':'Changes requested.')})});
    const data=await res.json();
    if(data.error)throw new Error(data.error);
    qs('reviewerContent').style.display='none';
    qs('reviewerConfirmed').style.display='block';
    const isApproved=action==='approved';
    qs('reviewerConfirmIcon').textContent=isApproved?'✅':'📝';
    qs('reviewerConfirmTitle').textContent=isApproved?'Approved!':'Feedback Sent';
    qs('reviewerConfirmDesc').textContent=isApproved
      ?'Your approval has been recorded. The author has been notified and can now publish.'
      :'Your feedback has been sent. The author will make revisions and share a new link if needed.';
  }catch(e){
    if(approveBtn)approveBtn.disabled=false;
    if(changesBtn)changesBtn.disabled=false;
    if(statusEl)statusEl.textContent='Error: '+e.message;
  }
};

function init(){
  // ── REVIEWER PAGE CHECK ── (must be first — bypasses entire dashboard)
  const approveParam=new URLSearchParams(location.search).get('approve');
  if(approveParam){renderReviewerPage(approveParam);return;}

  if(renderSharedFromHash())return;
  initAnalytics();
  loadStoredToken();

  const ONBOARDING_SEEN_KEY='postiq_onboarding_seen_v1';
  function markOnboardingSeen(){
    const wasSeen=localStorage.getItem(ONBOARDING_SEEN_KEY)==='1';
    localStorage.setItem(ONBOARDING_SEEN_KEY,'1');
    if(!wasSeen)trackEvent('onboarding_completed');
  }

  // Onboarding merged into settings modal — no standalone modal
  // Onboarding now part of settings modal
  // Founder now in settings About tab

  // ── SETTINGS MODAL ──
  function openSettings(tab) {
    // Switch to specified tab or default
    const target = tab || 'guide';
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.toggle('active', t.dataset.stab === target));
    document.querySelectorAll('.settings-panel').forEach(p => p.classList.toggle('active', p.id === `settingsPanel${target.charAt(0).toUpperCase()+target.slice(1)}`));
    openModal('settingsModal');
    trackEvent('settings_open',{tab:target});
    if(localStorage.getItem(ONBOARDING_SEEN_KEY)!=='1')trackEvent('onboarding_started');
  }
  qs('openSettings').onclick = () => openSettings('guide');
  qs('closeSettings').onclick = () => { markOnboardingSeen(); trackEvent('settings_close',{method:'button'}); closeModal('settingsModal'); syncMobileActiveTab(); };
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const panel = 'settingsPanel' + tab.dataset.stab.charAt(0).toUpperCase() + tab.dataset.stab.slice(1);
      document.querySelectorAll('.settings-panel').forEach(p => p.classList.toggle('active', p.id === panel));
    };
  });
  qs('manageTokenBtn').onclick=toggleTokenPanel;
  qs('revealCompactBtn').onclick=()=>{tokenPanelOpen=true;qs('tokenPanel').classList.add('open');qs('manageTokenBtn').textContent='Done';tokenInputVisible=true;qs('tokenInput').type='text';qs('toggleTokenVisibility').textContent='Hide';};
  qs('saveTokenBtn').onclick=saveToken;
  qs('clearTokenBtn').onclick=()=>{qs('tokenInput').value='';saveToken()};
  qs('toggleTokenVisibility').onclick=()=>{tokenInputVisible=!tokenInputVisible;qs('tokenInput').type=tokenInputVisible?'text':'password';qs('toggleTokenVisibility').textContent=tokenInputVisible?'Hide':'Show';};

  document.querySelectorAll('.modal').forEach(modal=>{
    modal.addEventListener('click',e=>{
      if(e.target!==modal) return;
      if(modal.id==='settingsModal'){
        markOnboardingSeen();
        trackEvent('settings_close',{method:'overlay'});
      }
      closeModal(modal.id);
      if(modal.id==='settingsModal')syncMobileActiveTab();
    });
  });
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    const openModals=getOpenModals();
    if(!openModals.length)return;
    const top=openModals[openModals.length-1];
    if(top.id==='settingsModal'){
      markOnboardingSeen();
      trackEvent('settings_close',{method:'escape'});
    }
    closeModal(top.id);
    if(top.id==='settingsModal')syncMobileActiveTab();
  });

  qs('syncBtn').onclick=syncBuffer;
  if(bufferToken){syncBuffer();}
  else{qs('syncBtn').classList.add('sync-pulse');}

  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{
    activateView(b.dataset.view);
    if(b.dataset.view==='approvalsView')loadApprovals();
  });

  qs('splitBtn').onclick=()=>{threadParts=splitThreadText(qs('threadInput').value);renderThread();if(threadParts.length)showToast(`${threadParts.length} thread parts`,'success');};
  qs('sampleBtn').onclick=()=>{qs('threadInput').value='PostIQ helps Buffer users move faster. Start with one big idea, split it into clear thread parts, refine each part, and send a cleaner post flow to Buffer.';qs('splitBtn').click();};
  qs('copyAllBtn').onclick = () => {
    if(!threadParts || !threadParts.length) return;
    const parts = state.numbering
      ? threadParts.map((p,i) => `${i+1}/${threadParts.length} ${p}`)
      : threadParts.slice();
    navigator.clipboard.writeText(parts.join('\n\n'));
    showToast('Thread copied','success');
  };
  qs('draftThreadBtn').onclick=()=>sendThread('draft');
  qs('queueThreadBtn').onclick=()=>sendThread('queue');
  qs('scheduleThreadBtn').onclick=()=>sendThread('schedule');
  qs('threadAddOpener').onclick=()=>openSnippetPicker('threadOpener');
  qs('threadAddCta').onclick=()=>openSnippetPicker('threadCta');

  // Toggle numbering prefix for thread posts (1/n)
  const threadNumberToggle = qs('threadNumberToggle');
  if (threadNumberToggle) {
    threadNumberToggle.onchange = (e) => {
      state.numbering = !!e.target.checked;
    };
  }

  qs('prevMonth').onclick=()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()-1,1);renderCalendar()};
  qs('nextMonth').onclick=()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()+1,1);renderCalendar()};
  qs('todayMonth').onclick=()=>{state.month=new Date();renderCalendar()};
  qs('closeNote').onclick=()=>closeModal('noteModal');
  qs('saveNoteBtn').onclick=saveNoteFromModal;
  qs('deleteNoteBtn').onclick=deleteNote;
  qs('sendNoteToComposer').onclick=sendNoteToComposer;
  qs('shareMonthBtn').onclick=()=>{shareSnapshot();openModal('shareModal')};
  qs('closeShare').onclick=()=>closeModal('shareModal');
  qs('includeNotes').onchange=shareSnapshot;
  qs('generateShare').onclick=shareSnapshot;
  qs('copyShare').onclick=()=>navigator.clipboard.writeText(qs('shareLink').value||'');
  qs('openSharePreview').onclick=()=>{if(qs('shareLink').value)window.open(qs('shareLink').value,'_blank')};

  document.querySelectorAll('[data-cmd]').forEach(btn=>btn.onclick=()=>composerFormat(btn.dataset.cmd));

  qs('composerEditor').addEventListener('input',()=>{
    const text=editorHtmlToText(qs('composerEditor').innerHTML);
    const ch=state.channels.find(c=>c.id===qs('composerChannel').value);
    const svc=(ch?.service||'').toLowerCase();
    let limit=null;
    if(svc.includes('twitter')||svc.includes('x-'))limit=280;
    else if(svc.includes('thread'))limit=500;
    else if(svc.includes('linkedin'))limit=3000;
    else if(svc.includes('instagram'))limit=2200;
    else if(svc.includes('facebook'))limit=63206;
    const counter=qs('composerCharCount');
    if(limit){
      const remaining=limit-text.length;
      counter.textContent=`${text.length}/${limit}`;
      counter.style.color=remaining<0?'#f87171':remaining<50?'var(--amber)':'var(--subtle)';
    } else {
      counter.textContent=`${text.length} chars`;
      counter.style.color=text.length>500?'var(--amber)':text.length>280?'var(--muted)':'var(--subtle)';
    }
    qs('composerEmpty').style.display=text?'none':'block';
    const showClear=text.length>0;
    if(qs('composerClearBtn'))qs('composerClearBtn').style.display=showClear?'inline-flex':'none';
    if(qs('composerClearBtnMob'))qs('composerClearBtnMob').style.display=showClear?'inline-flex':'none';
  });
  // Initialize char counter immediately so it shows "0 chars" on load
  qs('composerCharCount').textContent='0 chars';
  qs('composerCharCount').style.color='var(--subtle)';

  // Re-run counter when channel changes
  qs('composerChannel').addEventListener('change',()=>{
    qs('composerEditor').dispatchEvent(new Event('input'));
    updateComposerChannelHint();
  });
  // ── COMPOSER BUTTON STATE MANAGEMENT ──
  function updateComposerButtonStates(){
    const hasToken=!!bufferToken;
    const hasChannel=!!qs('composerChannel').value;
    const ready=hasToken&&hasChannel;
    const tip=!hasToken?'Add your Buffer token first':!hasChannel?'Load channels from Buffer first':'';
    ['composerDraft','composerQueue','composerScheduleToggle'].forEach(id=>{
      const btn=qs(id);if(!btn)return;
      btn.disabled=!ready;
      btn.title=tip;
      btn.style.opacity=ready?'1':'0.45';
      btn.style.cursor=ready?'pointer':'not-allowed';
    });
  }
  updateComposerButtonStates();
  window.addEventListener('postiq:synced', updateComposerButtonStates);
  qs('composerChannel').addEventListener('change', updateComposerButtonStates);

  function clearComposer(){
    const editor=qs('composerEditor');
    const text=editorHtmlToText(editor.innerHTML);
    if(text&&!confirm('Clear the composer? This cannot be undone.'))return;
    editor.innerHTML='';
    qs('composerEmpty').style.display='block';
    qs('composerCharCount').textContent='0 chars';
    qs('composerCharCount').style.color='var(--subtle)';
    if(qs('composerClearBtn'))qs('composerClearBtn').style.display='none';
    if(qs('composerClearBtnMob'))qs('composerClearBtnMob').style.display='none';
    qs('composerStatus').textContent='';
    editor.focus();
  }
  if(qs('composerClearBtn'))qs('composerClearBtn').onclick=clearComposer;
  if(qs('composerClearBtnMob'))qs('composerClearBtnMob').onclick=clearComposer;

  qs('composerDraft').onclick=()=>composerSend('draft');
  qs('composerQueue').onclick=()=>composerSend('queue');
  qs('composerSchedule').onclick=()=>composerSend('schedule');

  // Schedule toggle
  qs('composerScheduleToggle').onclick=()=>{
    qs('composerSchedulePanel').style.display='block';
    qs('composerScheduleToggle').style.display='none';
  };
  qs('composerScheduleCancel').onclick=()=>{
    qs('composerSchedulePanel').style.display='none';
    qs('composerScheduleToggle').style.display='inline-flex';
  };

  function buildTimePickers(hourId,minId,ampmId){
    const hSel=qs(hourId),mSel=qs(minId),amSel=qs(ampmId);
    for(let h=1;h<=12;h++){const o=document.createElement('option');o.value=h;o.textContent=String(h).padStart(2,'0');hSel.appendChild(o);}
    for(let m=0;m<60;m+=5){const o=document.createElement('option');o.value=m;o.textContent=String(m).padStart(2,'0');mSel.appendChild(o);}
    ['AM','PM'].forEach(ap=>{const o=document.createElement('option');o.value=ap;o.textContent=ap;amSel.appendChild(o);});
    const now=new Date();hSel.value=(now.getHours()%12)||12;mSel.value=0;amSel.value=now.getHours()>=12?'PM':'AM';
  }
  function pickerToISO(dateId,hourId,minId,ampmId){
    const d=qs(dateId).value;if(!d)return null;
    let h=parseInt(qs(hourId).value);const m=parseInt(qs(minId).value);const ap=qs(ampmId).value;
    if(ap==='PM'&&h!==12)h+=12;if(ap==='AM'&&h===12)h=0;
    return `${d}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`;
  }
  function setDatePickerToday(dateId){const d=new Date();qs(dateId).value=d.toISOString().slice(0,10);qs(dateId).min=d.toISOString().slice(0,10);}
  buildTimePickers('composerWhenHour','composerWhenMin','composerWhenAmpm');
  setDatePickerToday('composerWhenDate');
  function syncComposerWhen(){qs('composerWhen').value=pickerToISO('composerWhenDate','composerWhenHour','composerWhenMin','composerWhenAmpm')||'';}
  ['composerWhenDate','composerWhenHour','composerWhenMin','composerWhenAmpm'].forEach(id=>qs(id).addEventListener('change',syncComposerWhen));
  syncComposerWhen();

  qs('insertSnippetBtn').onclick=()=>openSnippetPicker('composer');

  qs('saveSelectionSnippetBtn').onclick=()=>{
    const sel=window.getSelection();const text=(sel&&sel.toString?sel.toString():'').trim();
    if(!text){qs('composerStatus').textContent='Select text in Composer first.';return;}
    state.editingSnippetId=null;
    qs('snippetModalTitle').textContent='New Snippet';
    qs('snippetTitle').value='';qs('snippetType').value='Hooks';qs('snippetPlatform').value='Universal';
    qs('snippetTags').value='';qs('snippetBody').value=text;openModal('snippetModal');
  };

  // snippets
  loadSnippets();renderSnippets();
  renderSnippetSelectors();
  qs('newSnippetBtn').onclick=()=>openSnippetModal();
  qs('closeSnippetModal').onclick=()=>closeModal('snippetModal');
  qs('cancelSnippetBtn').onclick=()=>closeModal('snippetModal');
  qs('saveSnippetBtn').onclick=saveSnippet;
  qs('closeSnippetPicker').onclick=()=>closeModal('snippetPickerModal');
  qs('snippetSearch').addEventListener('input',e=>{state.snippetSearch=e.target.value;renderSnippets();});
  qs('snippetViewToggle').onclick=()=>{
    const grid=qs('snippetGrid');
    const nowCompact=grid.dataset.viewMode!=='compact';
    grid.dataset.viewMode=nowCompact?'compact':'grid';
    qs('snippetViewToggle').textContent=nowCompact?'☰ List':'⊞ Grid';
    renderSnippets();
  };
  qs('snippetPlatformFilter').onchange=e=>{state.snippetPlatform=e.target.value;renderSnippets();};
  qs('pickerSearch').addEventListener('input',renderSnippetPicker);
  qs('pickerType').onchange=renderSnippetPicker;
  qs('pickerPlatform').onchange=renderSnippetPicker;

  renderCalendar();
  updateViewStatePills();
  const startupView=getStartupViewFromQuery();
  activateView(startupView);

  // ── COMPOSER TABS ──
  document.querySelectorAll('.composer-tab[data-ctab]').forEach(tab => {
    tab.onclick = () => setComposerTab(tab.dataset.ctab);
  });
  setThreadTab = (panel) => {
    document.querySelectorAll('.composer-tab[data-ttab]').forEach(t => t.classList.toggle('active', t.dataset.ttab === panel));
    const splitter = qs('threadTabSplitter');
    const linkedin = qs('threadTabLinkedIn');
    if (splitter) splitter.style.display = panel === 'splitter' ? 'block' : 'none';
    if (linkedin) linkedin.style.display = panel === 'linkedin' ? 'block' : 'none';
    if (panel === 'linkedin' && !state.linkedInLoaded) loadLinkedInPosts({append:false});
  };
  document.querySelectorAll('.composer-tab[data-ttab]').forEach(tab => {
    tab.onclick = () => setThreadTab(tab.dataset.ttab);
  });
  setThreadTab('splitter');
  setComposerTab('write');

  const linkedInLoadBtn=qs('linkedinLoadBtn');
  if(linkedInLoadBtn){
    linkedInLoadBtn.onclick=()=>loadLinkedInPosts({append:true});
  }
  const linkedInList=qs('linkedinList');
  if(linkedInList){
    linkedInList.addEventListener('click',e=>{
      const btn=e.target.closest('[data-linkedin-use]');
      if(btn){
        useLinkedInInThread(btn.dataset.linkedinUse);
        return;
      }
      const composeBtn=e.target.closest('[data-linkedin-compose]');
      if(composeBtn) useLinkedInInComposer(composeBtn.dataset.linkedinCompose);
    });
  }
  const repurposeManageTokenBtn=qs('repurposeManageTokenBtn');
  if(repurposeManageTokenBtn) repurposeManageTokenBtn.onclick=openTokenManagement;
  const repurposeSyncBtn=qs('repurposeSyncBtn');
  if(repurposeSyncBtn) repurposeSyncBtn.onclick=syncBuffer;


  // Thumbnails tab removed — video thumbnail functionality lives inline in the media panel

  // ── MOBILE TABS & DRAWER ──
  const isMobile=()=>window.innerWidth<=768;

  document.querySelectorAll('.mob-tab[data-view]').forEach(btn=>{
    btn.onclick=()=>{
      activateView(btn.dataset.view);
    };
  });

  // The drawer is the complete mobile tool switcher.
  document.querySelectorAll('.mob-drawer .nav-btn[data-view]').forEach(btn=>{
    btn.onclick=()=>{
      activateView(btn.dataset.view);
      document.querySelectorAll('.mob-tab').forEach(t=>t.classList.remove('active'));
      if(btn.dataset.view==='approvalsView') loadApprovals();
      closeMobDrawer();
    };
  });

  // The mobile tools button opens the complete drawer.
  const mobSettingsBtn = qs('mobSettingsBtn');
  if (mobSettingsBtn) {
    mobSettingsBtn.onclick = () => {
      document.querySelectorAll('.mob-tab[data-view]').forEach(t => t.classList.remove('active'));
      mobSettingsBtn.classList.add('active');
      openMobDrawer();
    };
  }

  function openMobDrawer(){qs('mobDrawer').classList.add('open');qs('mobBackdrop').classList.add('open');syncMobDrawerUI();}
  function closeMobDrawer(){qs('mobDrawer').classList.remove('open');qs('mobBackdrop').classList.remove('open');}
  qs('mobDrawerClose').onclick=closeMobDrawer;
  qs('mobBackdrop').onclick=closeMobDrawer;

  function syncMobDrawerUI(){
    const connected=!!bufferToken;
    qs('mobStatusDot').classList.toggle('connected',connected);
    qs('mobTokenLabel').textContent=connected?'Connected':'Not connected';
    qs('mobSyncStatus').textContent=qs('syncStatus').textContent;
  }

  qs('mobSyncBtn').onclick=()=>{syncBuffer();closeMobDrawer();};

  let mobTokenPanelOpen=false;
  qs('mobManageTokenBtn').onclick=()=>{
    mobTokenPanelOpen=!mobTokenPanelOpen;
    qs('mobTokenPanel').style.display=mobTokenPanelOpen?'block':'none';
    qs('mobManageTokenBtn').textContent=mobTokenPanelOpen?'Done':'Manage token';
    if(mobTokenPanelOpen&&bufferToken)qs('mobTokenInput').value=bufferToken;
  };
  qs('mobSaveTokenBtn').onclick=()=>{
    const token=qs('mobTokenInput').value.trim();
    const mode=[...document.querySelectorAll('input[name="mobTokenMode"]')].find(r=>r.checked).value;
    const ok=setBufferToken(token,{mode,messageEl:qs('mobTokenMsg'),savedMessage:'Token saved'});
    if(ok)syncBuffer();
  };
  qs('mobClearTokenBtn').onclick=()=>{
    qs('mobTokenInput').value='';
    setBufferToken('',{mode:'session',messageEl:qs('mobTokenMsg')});
  };
  qs('mobOpenSettings').onclick=()=>{closeMobDrawer();openSettings('tools');};
  qs('mobOpenFounder').onclick=()=>{closeMobDrawer();openSettings('about');};

  // Mobile-only buttons
  if(qs('shareMonthBtnMob'))qs('shareMonthBtnMob').onclick=()=>{shareSnapshot();openModal('shareModal');};
  if(qs('newSnippetBtnMob'))qs('newSnippetBtnMob').onclick=()=>openSnippetModal();
  if(qs('approvalsRefreshBtn'))qs('approvalsRefreshBtn').onclick=loadApprovals;
  if(qs('approvalsRefreshBtnMob'))qs('approvalsRefreshBtnMob').onclick=loadApprovals;

  document.querySelectorAll('[data-afilter]').forEach(pill=>{
    pill.onclick=()=>{
      document.querySelectorAll('[data-afilter]').forEach(p=>p.classList.remove('active'));
      pill.classList.add('active');
      const filter=pill.dataset.afilter;
      document.querySelectorAll('#approvalsList .approval-card').forEach(card=>{
        const badge=card.querySelector('.approval-status-badge');
        if(!badge)return;
        const status=
          badge.classList.contains('approved')&&!badge.classList.contains('changes_requested')
            ?'approved'
            :badge.classList.contains('changes_requested')
            ?'changes_requested'
            :'pending';
        card.style.display=(filter==='all'||status===filter)?'':'none';
      });
    };
  });

  // ── CALENDAR AGENDA VIEW ──
  function renderAgenda(){
    const agenda=qs('calAgenda');if(!agenda)return;
    const notes=getNotes();const today=fmtDate(new Date());
    // Build a map of posts and notes keyed by date
    const map={};
    state.scheduled.forEach(p=>{
      const k=fmtDate(new Date(p.dueAt));
      if(!map[k])map[k]={posts:[],note:null};
      map[k].posts.push(p);
    });
    Object.entries(notes).forEach(([k,n])=>{
      if(!map[k])map[k]={posts:[],note:null};
      map[k].note=n;
    });
    // Determine which days to render: default to today, or a seven‑day window for week view
    const days=[];
    if(state.agendaView==='week'){
      const startDate=new Date();
      for(let i=0;i<7;i++){
        const d=new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()+i);
        days.push(fmtDate(d));
      }
    }else{
      days.push(today);
    }
    agenda.innerHTML='';

    // Simple header with view toggle (Day/Week)
    const nav=document.createElement('div');nav.className='cal-header';
    const toggleLabel=state.agendaView==='day'? 'Week' : 'Day';
    nav.innerHTML=`<div class="cal-month">${state.agendaView==='day'?'Today':'This Week'}</div><button class="btn sm ghost" id="agendaToggle">${toggleLabel} view</button>`;
    agenda.appendChild(nav);
    nav.querySelector('#agendaToggle').onclick=()=>{state.agendaView=state.agendaView==='day'?'week':'day';renderAgenda();};

    let hasAny=false;
    days.forEach(key=>{
      const data=map[key];const isToday=key===today;
      // Always render each day in the agenda view
      hasAny=true;
      const date=new Date(key+'T00:00:00');
      const dayEl=document.createElement('div');
      dayEl.style.cssText=`border:1px solid ${isToday?'var(--amber-glow)':'var(--border)'};border-radius:10px;padding:12px;margin-bottom:8px;background:var(--surface);cursor:pointer;`;
      const dateLabel=date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
      let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:${isToday?'var(--amber)':'var(--muted)'};">${dateLabel}</span>
        ${data?.posts?.length?`<span style="font-size:10px;font-family:'DM Mono',monospace;background:var(--blue-dim);color:var(--blue);border:1px solid rgba(107,143,247,.25);padding:1px 6px;border-radius:4px;">${data.posts.length} post${data.posts.length>1?'s':''}</span>`:''}
      </div>`;
      if(data?.posts?.length){
        data.posts.slice(0,2).forEach(p=>{
          html+=`<div style="font-size:12px;line-height:1.5;padding:8px;background:var(--blue-dim);border:1px solid rgba(107,143,247,.2);border-radius:6px;color:#a8bef9;margin-bottom:6px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${safeText(p.text||'(no text)')}</div>`;
        });
        if(data.posts.length>2)html+=`<div style="font-size:11px;color:var(--subtle);font-family:'DM Mono',monospace;">+${data.posts.length-2} more</div>`;
      }
      if(data?.note){
        html+=`<div class="day-note-pill ${data.note.tag||'gold'}" style="margin-top:6px;display:block;border-radius:6px;"><span class="note-pill-label">${safeText(data.note.label||'Note')}</span>${safeText(data.note.text)}</div>`;
      }
      if(!data?.posts?.length&&!data?.note){
        html+=`<div style="font-size:12px;color:var(--subtle);">No posts scheduled.</div>`;
      }
      dayEl.innerHTML=html;
      dayEl.onclick=()=>openDayNote(date);
      agenda.appendChild(dayEl);
    });

    if(!hasAny){
      const empty=document.createElement('div');empty.className='empty mt8';
      empty.innerHTML='<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">No posts scheduled</div><div class="empty-desc">No posts or notes yet. Connect Buffer, then sync to load your upcoming schedule.</div></div>';
      agenda.appendChild(empty);
    }
  }

  // Re-render agenda on calendar updates when on mobile
  const _origSyncBuffer=syncBuffer;
  window.addEventListener('postiq:synced',()=>{if(isMobile())renderAgenda();});

  if(isMobile())renderAgenda();

  // ── TRENDING ──
  const trendingState = { source: 'reddit', sub: 'socialmedia', hnFeed: 'topstories' };

  function initTrending() {
    const view = document.getElementById('trendingView');
    if (!view) return;

    // Source tab switching
    view.querySelectorAll('.trending-tab').forEach(tab => {
      tab.onclick = () => {
        view.querySelectorAll('.trending-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        trendingState.source = tab.dataset.src;
        document.getElementById('trendingReddit').style.display = trendingState.source === 'reddit' ? 'block' : 'none';
        document.getElementById('trendingHN').style.display = trendingState.source === 'hn' ? 'block' : 'none';
        document.getElementById('trendingTopics').style.display = trendingState.source === 'topics' ? 'block' : 'none';
        if (trendingState.source === 'topics') { renderTopicsPills(); return; }
        loadTrending();
      };
    });

    // Reddit sub pills
    view.querySelectorAll('[data-sub]').forEach(pill => {
      pill.onclick = () => {
        view.querySelectorAll('[data-sub]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        trendingState.sub = pill.dataset.sub;
        loadTrending();
      };
    });

    // HN feed pills
    view.querySelectorAll('[data-hn]').forEach(pill => {
      pill.onclick = () => {
        view.querySelectorAll('[data-hn]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        trendingState.hnFeed = pill.dataset.hn;
        loadTrending();
      };
    });

    // Custom subreddit
    document.getElementById('trendingAddSub').onclick = () => {
      const val = document.getElementById('trendingCustomSub').value.trim().replace(/^r\//,'');
      if (!val) return;
      trendingState.sub = val;
      // Add pill if not exists
      const existing = view.querySelector(`[data-sub="${val}"]`);
      if (!existing) {
        const pill = document.createElement('button');
        pill.className = 'sub-pill active';
        pill.dataset.sub = val;
        pill.textContent = `r/${val}`;
        pill.onclick = () => {
          view.querySelectorAll('[data-sub]').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          trendingState.sub = val;
          loadTrending();
        };
        view.querySelector('#trendingSubBtns').appendChild(pill);
      }
      view.querySelectorAll('[data-sub]').forEach(p => p.classList.toggle('active', p.dataset.sub === val));
      document.getElementById('trendingCustomSub').value = '';
      loadTrending();
    };
    document.getElementById('trendingCustomSub').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('trendingAddSub').click(); });

    // Refresh buttons
    document.getElementById('trendingRefresh').onclick = loadTrending;
    document.getElementById('trendingHNRefresh').onclick = loadTrending;
    const mobRefresh = document.getElementById('trendingRefreshMob');
    if (mobRefresh) mobRefresh.onclick = loadTrending;

    // Auto-load on first view activation
    loadTrending();
  }

  async function loadTrending() {
    if (trendingState.source === 'reddit') await loadReddit();
    else await loadHN();
  }

  async function loadReddit() {
    const list = document.getElementById('trendingRedditList');
    const status = document.getElementById('trendingRedditStatus');
    if (!list) return;
    status.textContent = '';
    list.innerHTML = '';
    showFetchLoading(list);
    try {
      const res = await fetch(`https://www.reddit.com/r/${trendingState.sub}/hot.json?limit=25`, {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const posts = (data?.data?.children || []).filter(p => !p.data.stickied);
      clearFetchLoading(list);
      status.textContent = `${posts.length} posts from r/${trendingState.sub}`;
      renderTrendingItems(list, posts.map((p, i) => ({
        rank: i + 1,
        title: p.data.title,
        body: p.data.selftext || null,
        isLink: p.data.is_reddit_media_domain === false && !p.data.is_self,
        linkUrl: p.data.url,
        score: p.data.score,
        comments: p.data.num_comments,
        sub: `r/${p.data.subreddit}`,
        url: `https://reddit.com${p.data.permalink}`,
        age: timeAgo(p.data.created_utc * 1000),
        type: 'reddit'
      })));
    } catch(e) {
      status.textContent = `Failed to load — Reddit may be blocking the request. Try again.`;
      clearFetchLoading(list);
      console.warn('[PostIQ] Reddit fetch failed:', e);
    }
  }

  async function loadHN() {
    const list = document.getElementById('trendingHNList');
    const status = document.getElementById('trendingHNStatus');
    if (!list) return;
    status.textContent = '';
    list.innerHTML = '';
    showFetchLoading(list);
    try {
      const idsRes = await fetch(`https://hacker-news.firebaseio.com/v0/${trendingState.hnFeed}.json`);
      const ids = await idsRes.json();
      const top = ids.slice(0, 20);
      const stories = await Promise.all(
        top.map(id => fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json()))
      );
      clearFetchLoading(list);
      status.textContent = `${stories.length} stories from Hacker News`;
      renderTrendingItems(list, stories.filter(s => s && s.title).map((s, i) => ({
        rank: i + 1,
        title: s.title,
        score: s.score,
        comments: s.descendants || 0,
        sub: s.by ? `by ${s.by}` : 'HN',
        url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
        age: timeAgo(s.time * 1000),
        type: 'hn'
      })));
    } catch(e) {
      status.textContent = 'Failed to load Hacker News.';
      clearFetchLoading(list);
      console.warn('[PostIQ] HN fetch failed:', e);
    }
  }

  function renderTrendingItems(container, items) {
    container.innerHTML = '';
    if(!items.length){
      container.innerHTML = '<div class="empty"><div class="empty-state"><div class="empty-icon">📈</div><div class="empty-title">No trending topics loaded</div><div class="empty-desc">Refresh to fetch current stories from the selected source.</div></div></div>';
      return;
    }
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'trending-item';

      // Body content — text post body or link indicator
      const hasBody = item.body && item.body.trim() && item.body !== '[deleted]' && item.body !== '[removed]';
      const bodyPreview = hasBody ? item.body.trim().slice(0, 300) + (item.body.length > 300 ? '…' : '') : null;
      const bodyFull = hasBody ? item.body.trim() : null;

      let bodyHtml = '';
      if (hasBody) {
        bodyHtml = `
          <div class="trending-body" id="tbody-${item.rank}-${item.type}">
            <div class="trending-body-preview">${safeText(bodyPreview)}</div>
            ${item.body.length > 300 ? `<button class="trending-expand-btn" data-full="${encodeURIComponent(bodyFull)}">Read more</button>` : ''}
          </div>`;
      } else if (item.isLink && item.linkUrl) {
        bodyHtml = `<div class="trending-link-hint">🔗 <a href="${item.linkUrl}" target="_blank" rel="noopener" style="color:var(--blue);font-size:12px;">${item.linkUrl.length > 60 ? item.linkUrl.slice(0,60)+'…' : item.linkUrl}</a></div>`;
      }

      const composerEnabled=isToolEnabled('composer');
      el.innerHTML = `
        <div class="trending-item-rank">${item.rank}</div>
        <div class="trending-item-body">
          <div class="trending-item-title">${safeText(item.title)}</div>
          ${bodyHtml}
          <div class="trending-item-meta" style="margin-top:6px;">
            <span class="trending-meta-pill score">▲ ${item.score?.toLocaleString()}</span>
            <span class="trending-meta-pill">💬 ${item.comments}</span>
            <span class="trending-meta-pill sub">${safeText(item.sub)}</span>
            <span class="trending-meta-pill">${item.age}</span>
          </div>
          <div class="trending-item-actions" style="margin-top:8px;">
            <button class="btn sm trending-compose-btn">${composerEnabled?'→ Compose':'Copy reference'}</button>
            <a class="btn sm ghost" href="${item.url}" target="_blank" rel="noopener">↗ Source</a>
          </div>
        </div>`;

      // Expand/collapse body
      const expandBtn = el.querySelector('.trending-expand-btn');
      if (expandBtn) {
        expandBtn.onclick = (e) => {
          e.stopPropagation();
          const preview = el.querySelector('.trending-body-preview');
          if (expandBtn.dataset.expanded === '1') {
            preview.textContent = bodyPreview;
            expandBtn.textContent = 'Read more';
            expandBtn.dataset.expanded = '0';
          } else {
            preview.textContent = decodeURIComponent(expandBtn.dataset.full);
            expandBtn.textContent = 'Show less';
            expandBtn.dataset.expanded = '1';
          }
        };
      }

      // Pin as reference instead of dumping into composer
      el.querySelector('.trending-compose-btn').onclick = () => {
        if(!composerEnabled){
          const reference=[item.title,item.url].filter(Boolean).join('\n');
          navigator.clipboard.writeText(reference);
          showToast('Reference copied','success');
          return;
        }
        pinTrendingReference({
          title: item.title,
          body: hasBody ? item.body.trim().slice(0, 300) : null,
          url: item.url,
          sub: item.sub
        });
        activateView('composerView');
        showToast('Pinned as reference — write your take','info');
      };

      container.appendChild(el);
    });
  }

  function timeAgo(ts) {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  }

  function pinTrendingReference(item) {
    const panel = qs('trendingRefPanel');
    qs('trendingRefTitle').textContent = item.title;
    qs('trendingRefBody').textContent = item.body || '';
    qs('trendingRefBody').style.display = item.body ? 'block' : 'none';
    qs('trendingRefLink').href = item.url;
    qs('trendingRefLink').textContent = `↗ ${item.sub || 'View source'}`;
    panel.classList.add('visible');
  }

  const trendingDismissBtn=qs('trendingRefDismiss');
  if(trendingDismissBtn){
    trendingDismissBtn.onclick=()=>{
      const panel=qs('trendingRefPanel');
      if(panel) panel.classList.remove('visible');
    };
  }

  // ── TOPICS ──
  const TOPICS_KEY = 'postiq_saved_topics';
  const TOPICS_MAX = 10;

  function getTopics() {
    try { return JSON.parse(localStorage.getItem(TOPICS_KEY) || '[]'); } catch { return []; }
  }

  function saveTopics(arr) {
    try { localStorage.setItem(TOPICS_KEY, JSON.stringify(arr)); } catch {}
  }

  function addTopic(term) {
    term = term.trim().toLowerCase();
    if (!term) return;
    let arr = getTopics().filter(t => t !== term);
    arr.unshift(term); // most recent first
    if (arr.length > TOPICS_MAX) arr = arr.slice(0, TOPICS_MAX); // drop oldest
    saveTopics(arr);
  }

  function removeTopic(term) {
    saveTopics(getTopics().filter(t => t !== term));
  }

  function renderTopicsPills() {
    const container = document.getElementById('topicsSavedPills');
    if (!container) return;
    const topics = getTopics();
    if (!topics.length) { container.innerHTML = '<span style="font-size:12px;color:var(--subtle);">No saved topics yet — search something above.</span>'; return; }
    container.innerHTML = topics.map(t =>
      `<button class="sub-pill" data-topic="${t}">${t}</button>`
    ).join('');
    container.querySelectorAll('[data-topic]').forEach(pill => {
      pill.onclick = () => {
        document.getElementById('topicsSearchInput').value = pill.dataset.topic;
        loadTopics(pill.dataset.topic);
      };
    });
  }

  function renderTopicsEditList() {
    const el = document.getElementById('topicsEditList');
    if (!el) return;
    const topics = getTopics();
    if (!topics.length) { el.innerHTML = '<span style="font-size:12px;color:var(--subtle);">No saved topics.</span>'; return; }
    el.innerHTML = topics.map(t =>
      `<button class="sub-pill" data-del="${t}" title="Click to remove" style="cursor:pointer;">${t} ×</button>`
    ).join('');
    el.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => { removeTopic(btn.dataset.del); renderTopicsEditList(); renderTopicsPills(); };
    });
  }

  async function loadTopics(term) {
    const list = document.getElementById('topicsList');
    const status = document.getElementById('topicsStatus');
    if (!list || !term) return;
    status.textContent = '';
    list.innerHTML = '';
    showFetchLoading(list);
    try {
      const res = await fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(term)}&sort=hot&limit=25&type=link`, {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const posts = (data?.data?.children || []).filter(p => !p.data.stickied);
      if (!posts.length) { clearFetchLoading(list); status.textContent = `No results for "${term}".`; list.innerHTML='<div class="empty"><div class="empty-state"><div class="empty-icon">📈</div><div class="empty-title">No trending topics loaded</div><div class="empty-desc">Try another keyword or refresh to fetch current posts.</div></div></div>'; return; }
      clearFetchLoading(list);
      status.textContent = `${posts.length} results for "${term}"`;
      addTopic(term);
      renderTopicsPills();
      renderTrendingItems(list, posts.map((p, i) => ({
        rank: i + 1,
        title: p.data.title,
        body: p.data.selftext || null,
        isLink: !p.data.is_self,
        linkUrl: p.data.url,
        score: p.data.score,
        comments: p.data.num_comments,
        sub: `r/${p.data.subreddit}`,
        url: `https://reddit.com${p.data.permalink}`,
        age: timeAgo(p.data.created_utc * 1000),
        type: 'topics'
      })));
    } catch(e) {
      status.textContent = `Search failed — Reddit may be blocking. Try again.`;
      clearFetchLoading(list);
      console.warn('[PostIQ] Topics search failed:', e);
    }
  }

  function initTopics() {
    const searchBtn = document.getElementById('topicsSearchBtn');
    const searchInput = document.getElementById('topicsSearchInput');
    const editBtn = document.getElementById('topicsEditBtn');
    const closeModalBtn = document.getElementById('closeTopicsModal');
    const addBtn = document.getElementById('topicsEditAddBtn');
    const addInput = document.getElementById('topicsEditAddInput');
    if (!searchBtn) return;

    searchBtn.onclick = () => loadTopics(searchInput.value.trim());
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadTopics(searchInput.value.trim()); });

    editBtn.onclick = () => { renderTopicsEditList(); openModal('topicsEditModal'); };
    if (closeModalBtn) closeModalBtn.onclick = () => closeModal('topicsEditModal');

    if (addBtn) addBtn.onclick = () => {
      const val = addInput.value.trim();
      if (!val) return;
      addTopic(val);
      addInput.value = '';
      renderTopicsEditList();
      renderTopicsPills();
    };
    if (addInput) addInput.addEventListener('keydown', e => { if (e.key === 'Enter') addBtn.click(); });

    renderTopicsPills();
  }

  initTrending();
  initTopics();

  initUnifiedMediaSystem();

  window.addEventListener('postiq:tools-changed',()=>{
    renderSnippets();
  });

  if('serviceWorker' in navigator && location.hostname !== 'localhost' && !location.hostname.includes('claudeusercontent')){
    navigator.serviceWorker.register('/sw.js').catch(e=>console.warn('SW:',e));
  }
}
document.addEventListener('DOMContentLoaded',()=>{try{init();}catch(e){console.error('[PostIQ] init() crashed:',e);}});
