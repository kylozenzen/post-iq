'use strict';

// ── MEDIA ──────────────────────────────────────────
function applyMedia(url, source, thumbUrl = '') {
  const type = isVideo(url) ? 'video' : 'image';
  mediaState.url = url; mediaState.type = type; mediaState.source = source; mediaState.videoThumbUrl = thumbUrl;
  if (source === 'url') safeTrack(() => GA4_Composer.mediaAttached(type, 'url'));
  const ton = qs('mediaToggleBtn'), toff = qs('mediaToggleOff'), tthumb = qs('mediaThumbPreview'), tlabel = qs('mediaToggleLabel');
  if (url) {
    ton.style.display = 'none'; toff.style.display = 'flex';
    tlabel.textContent = type === 'video' ? '🎬 Video attached' : '🖼 Image attached';
    if (tthumb) { tthumb.src = type === 'image' ? url : ''; tthumb.style.display = type === 'image' ? 'inline' : 'none'; }
    const ms = qs('mediaSummary'); if (ms) ms.style.display = 'flex';
    const mst = qs('mediaSummaryThumb'); if (mst) { mst.src = type === 'image' ? url : ''; mst.style.display = type === 'image' ? 'block' : 'none'; }
    const mstype = qs('mediaSummaryType'); if (mstype) mstype.textContent = type === 'video' ? '🎬 Video' : '🖼 Image';
    const msurl = qs('mediaSummaryUrl'); if (msurl) msurl.textContent = url;
  } else { clearMedia(); }
}

function clearMedia() {
  mediaState.url = ''; mediaState.type = ''; mediaState.source = ''; mediaState.videoThumbUrl = '';
  qs('mediaToggleBtn').style.display = 'flex'; qs('mediaToggleOff').style.display = 'none';
  const ms = qs('mediaSummary'); if (ms) ms.style.display = 'none';
  const inp = qs('mediaUrlInput'); if (inp) inp.value = '';
  resetUploadTab();
}

function resetUploadTab() {
  qs('uploadZone').style.display = 'block'; qs('uploadResult').style.display = 'none';
  const fi = qs('uploadFileInput'); if (fi) fi.value = '';
  const st = qs('uploadStatus'); if (st) { st.textContent = ''; }
}

async function imgurUpload(file) {
  const fd = new FormData(); fd.append('image', file);
  const res = await fetch('https://api.imgur.com/3/image', { method: 'POST', headers: { Authorization: `Client-ID ${IMGUR_KEY}` }, body: fd });
  const data = await res.json();
  if (!data.success) throw new Error(data.data?.error || 'Upload failed');
  return data.data.link;
}

function logLocalModuleError(scope, err, details = {}) {
  console.error(`[PostIQ:${scope}]`, { message: getErrorMessage(err), details, error: err });
}

async function handleUploadFile(file) {
  const uploadStartTime = Date.now();
  const trackedMediaType = file?.type?.startsWith('video/') ? 'video' : 'image';
  safeTrack(() => GA4_Media.uploadStarted(trackedMediaType));
  const st = qs('uploadStatus');
  const zone = qs('uploadZone');
  try {
    if (!st || !zone) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { st.textContent = 'Unsupported type.'; return; }
    if (file.type.startsWith('video/')) {
      st.textContent = 'For video, use the URL tab with a hosted video link.';
      switchMediaTab('url'); return;
    }
    zone.style.display = 'none'; st.textContent = 'Uploading…';
    const url = await imgurUpload(file);
    qs('uploadResult').style.display = 'flex';
    qs('uploadThumb').src = url; qs('uploadResultName').textContent = file.name || 'uploaded image'; qs('uploadResultUrl').textContent = url;
    st.textContent = ''; applyMedia(url, 'upload'); showToast('Image uploaded', 'success');
    safeTrack(() => GA4_Media.uploadComplete({ type: trackedMediaType, sizeBytes: file.size, durationMs: Date.now() - uploadStartTime }));
    safeTrack(() => GA4_Composer.mediaAttached(trackedMediaType, 'upload'));
  } catch (err) {
    if (zone) zone.style.display = 'block';
    if (st) st.textContent = 'Unable to upload image. Please try again.';
    logLocalModuleError('upload', err, { fileName: file?.name, fileType: file?.type, fileSize: file?.size });
    safeTrack(() => GA4_Media.uploadFailed(getErrorType(err)));
    safeTrack(() => GA4_System.applicationError(err, 'media_upload'));
    return;
  }
}

function switchMediaTab(id) {
  if (id === 'upload' && !getFeatureFlag('uploads')) { showFeaturePaused('uploads'); return; }
  if (id === 'unsplash' && !getFeatureFlag('unsplash')) { showFeaturePaused('unsplash'); return; }
  document.querySelectorAll('.media-tab').forEach(t => t.classList.toggle('active', t.dataset.mtab === id));
  document.querySelectorAll('.media-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.mtabpanel === id));
}

let _unsplashLast = '';
async function runUnsplashSearch() {
  const queryInput = qs('unsplashQuery');
  const grid = qs('unsplashGrid');
  const status = qs('unsplashStatus');
  try {
    if (!queryInput || !grid || !status) return;
    const q = queryInput.value.trim(); if (!q) return;
    if (q === _unsplashLast) return; _unsplashLast = q;
    status.textContent = 'Searching…'; grid.innerHTML = '';
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=9&orientation=landscape`, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } });
    if (!res.ok) throw new Error(res.status === 403 ? 'Rate limit' : `HTTP ${res.status}`);
    const data = await res.json();
    if (!data.results?.length) { status.textContent = `No results for "${q}".`; return; }
    status.textContent = `${data.total.toLocaleString()} results`;
    safeTrack(() => GA4_Media.unsplashSearched(q ? 'has_query' : 'empty', (data.results || []).length));
    data.results.forEach(photo => {
      const item = document.createElement('div');
      item.style.cssText = 'position:relative;border-radius:6px;overflow:hidden;border:2px solid transparent;cursor:pointer;aspect-ratio:4/3;background:var(--surface2);transition:border-color .12s;';
      const img = document.createElement('img');
      img.src = toSafeExternalUrl(photo?.urls?.small);
      img.alt = '';
      img.loading = 'lazy';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      item.appendChild(img);
      item.title = `Photo by ${photo.user.name}`;
      item.onmouseenter = () => { item.style.borderColor = 'var(--brand)'; };
      item.onmouseleave = () => { item.style.borderColor = 'transparent'; };
      item.onclick = () => { const mediaUrl = toSafeExternalUrl(photo?.urls?.regular); if (!mediaUrl) return; applyMedia(mediaUrl, 'unsplash'); safeTrack(() => GA4_Media.unsplashImageSelected()); safeTrack(() => GA4_Composer.mediaAttached('image', 'unsplash')); closeMediaPanel(); showToast(`Photo by ${photo.user.name} added`, 'success'); };
      grid.appendChild(item);
    });
  } catch (err) {
    if (status) status.textContent = 'Unable to fetch images. Please try again.';
    logLocalModuleError('unsplash-search', err, { query: queryInput?.value?.trim() || '' });
    safeTrack(() => GA4_Media.unsplashLoadFailed());
    safeTrack(() => GA4_System.applicationError(err, 'media_upload'));
    return;
  }
}

function openMediaPanel() { qs('mediaPanel')?.classList.add('open'); }
function closeMediaPanel() { qs('mediaPanel')?.classList.remove('open'); }
