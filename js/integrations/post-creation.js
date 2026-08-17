'use strict';

// ── POST CREATION ──────────────────────────────────
async function createPost(input) {
  const mutation = `mutation CreatePost($input:CreatePostInput!){createPost(input:$input){__typename ... on PostActionSuccess{post{id dueAt text channelId}} ... on MutationError{message}}}`;
  const normalizedInput = normalizeBufferPostInput(input);
  const res = await callBuffer(mutation, { input: normalizedInput });
  const result = res?.data?.createPost;
  if (!result) throw new Error('Empty mutation response.');
  if (result.__typename === 'MutationError') throw new Error(result.message || 'Buffer rejected this post.');
  if (result.__typename !== 'PostActionSuccess') throw Object.assign(new Error(result.message || `Unexpected result: ${result.__typename}`), { code: 'MUTATION_ERROR' });
  return result;
}

async function editPost(input, options = {}) {
  const mutation = `mutation EditPost($input:EditPostInput!){editPost(input:$input){__typename ... on PostActionSuccess{post{id dueAt text channelId}} ... on MutationError{message}}}`;
  const normalizedInput = normalizeBufferPostInput(input, { clearAssets: !!options.clearAssets });
  const res = await callBuffer(mutation, { input: normalizedInput });
  const result = res?.data?.editPost;
  if (!result) throw new Error('Empty mutation response.');
  if (result.__typename === 'MutationError') throw new Error(result.message || 'Buffer rejected this post.');
  if (result.__typename !== 'PostActionSuccess') throw Object.assign(new Error(result.message || `Unexpected result: ${result.__typename}`), { code: 'MUTATION_ERROR' });
  return result;
}

function appendScheduled(post, sourceInput = {}) {
  const id = post?.id; if (!id) return;
  if (state.scheduled.some(p => p.id === id)) return;
  const channel = state.channels.find(c => c.id === (post.channelId || sourceInput.channelId));
  state.scheduled = [...state.scheduled, {
    id, text: post.text || sourceInput.text || '', dueAt: post.dueAt || sourceInput.dueAt, channelId: post.channelId || sourceInput.channelId,
    channelName: channel?.displayName || channel?.name || '', platform: channel?.service || '', status: 'scheduled',
    mediaUrls: mediaUrlsFromAssets(sourceInput.assets)
  }];
  cache.scheduled = { value: state.scheduled, ts: Date.now() }; saveCacheState();
}

async function composerSend(action) {
  const text = editorToText(qs('composerEditor').innerHTML);
  if (!text) { showToast('Write something first', 'error'); return; }
  const connection = getBufferConnectionState();
  const oauthToken = getStoredOAuthToken();
  if (!connection.connected && !oauthToken?.accessToken && !oauthToken?.refreshToken) { showToast(connection.reconnectNeeded ? 'Reconnect Buffer first' : 'Connect Buffer first', 'error'); return; }
  const channelId = qs('composerChannel').value;
  if (!channelId) { showToast('Load channels first', 'error'); return; }
  const needsApproval = qs('needsApprovalCheck')?.checked || false;
  const when = qs('composerWhen').value;
  const input = { channelId, text, schedulingType: 'automatic' };
  if (action === 'draft') { input.mode = 'addToQueue'; input.saveToDraft = true; }
  if (action === 'queue') { input.mode = 'addToQueue'; }
  if (action === 'schedule') {
    if (!when) { qs('composerStatus').textContent = 'Pick a date/time first.'; return; }
    input.mode = 'customScheduled'; input.dueAt = when;
  }
  const imgUrl = mediaState.url || '';
  if (imgUrl) {
    if (isVideo(imgUrl)) {
      const entry = { url: imgUrl };
      if (mediaState.videoThumbUrl) entry.thumbnailUrl = mediaState.videoThumbUrl;
      input.assets = [{ video: entry }];
    } else {
      input.assets = [{ image: { url: imgUrl } }];
    }
  }
  qs('composerStatus').textContent = 'Sending…';
  try {
    const created = await createPost(input);
    const draftId = created?.post?.id;
    if (action === 'draft' && needsApproval && draftId) {
      const ch = state.channels.find(c => c.id === channelId);
      setApprovalMeta(draftId, {
        needs_approval: true, status: 'pending', comments: [], link_generated: false, locked: false,
        content: text, platform: ch?.service || null, image_url: imgUrl || null, channel_id: channelId, created_at: Date.now(),
      });
    }
    const msg = action === 'draft' ? 'Buffer draft saved.' : action === 'queue' ? 'Added to queue.' : 'Scheduled.';
    qs('composerStatus').textContent = msg; showToast(msg, 'success');
    safeTrack(() => GA4_Composer.postSent({ action, charCount: text.length, hasMedia: !!imgUrl, mediaType: mediaState.type || 'none', channelCount: 1, isThread: false, threadPartCount: 1, needsApproval, daysAhead: 0 }));
    composerContentStartedTracked = false;
    composerMilestonesTracked.clear();

    // Discord integration
    if (window.Discord) {
      const channel = state.channels.find(c => c.id === channelId);
      window.Discord.onComposerSent(text, action, {
        platform: channel?.service || '',
        channelName: channel?.displayName || channel?.name || '',
        dueAt: action === 'schedule' ? when : '',
      });
    }
    if (created?.post?.dueAt) { appendScheduled(created.post, input); renderCalendar(); }
    qs('composerEditor').innerHTML = '';
    qs('composerEditor').dispatchEvent(new Event('input'));
    qs('composerWhen').value = '';
    if (qs('needsApprovalCheck')) qs('needsApprovalCheck').checked = false;
    clearMedia(); closeMediaPanel();
    qs('schedulePanel').classList.remove('open');
    qs('composerScheduleToggle').style.display = 'inline-flex';
  } catch (e) {
    const msg = getErrorMessage(e, 'Failed to send.');
    if (isAuthError(e)) handleAuthFailure(msg);
    qs('composerStatus').textContent = `Failed: ${msg}`;
    showToast('Failed: ' + msg, 'error');
    safeTrack(() => GA4_Composer.postSendFailed(getErrorType(e)));
    safeTrack(() => GA4_System.applicationError(e, 'composer'));
  }
}
