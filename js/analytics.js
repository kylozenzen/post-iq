'use strict';

/**
 * PostIQ GA4 enhancement helpers.
 *
 * This module intentionally accepts only aggregate values, booleans, bounded
 * numbers, and known enum-like strings. It never sends post/template/note
 * content, URLs, tokens, user contact details, or error messages/stacks.
 */
(function initializePostIQAnalytics(window) {
  const MAX_ENUM_LENGTH = 64;
  const BLOCKED_KEY = /^(content|body|text|message|stack|token|access_token|refresh_token|email|user_name|url|comment|comments|note|title|description)$/i;

  function safeEnum(value, fallback = 'unknown') {
    if (typeof value !== 'string') return fallback;
    const normalized = value.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    return normalized ? normalized.slice(0, MAX_ENUM_LENGTH) : fallback;
  }

  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
  }

  function safeParams(params = {}) {
    return Object.entries(params).reduce((result, [key, value]) => {
      if (BLOCKED_KEY.test(key) || value === undefined || value === null) return result;
      if (typeof value === 'boolean') result[key] = value;
      else if (typeof value === 'number') result[key] = safeNumber(value);
      else if (typeof value === 'string') result[key] = safeEnum(value);
      return result;
    }, {});
  }

  function errorType(error) {
    const status = Number(error?.response?.status || error?.status || 0);
    const message = String(error?.message || '').toLowerCase();
    if (status === 400) return 'validation_error';
    if (status === 401 || status === 403) return 'auth_error';
    if (status === 404) return 'not_found';
    if (status === 429) return 'rate_limit';
    if (status >= 500) return 'server_error';
    if (message.includes('network') || message.includes('failed to fetch')) return 'network_error';
    return 'unknown';
  }

  function track(eventName, params = {}) {
    try {
      if (typeof window.gtag !== 'function') return false;
      window.gtag('event', safeEnum(eventName), safeParams(params));
      return true;
    } catch (error) {
      console.warn('GA4 tracking skipped:', error);
      return false;
    }
  }

  const GA4 = {
    isReady: () => typeof window.gtag === 'function',
    track,
    getErrorType: errorType,
    setUserIdentity(organizationId, properties = {}) {
      try {
        if (typeof window.gtag !== 'function') return false;
        const userId = safeEnum(String(organizationId || 'unknown'));
        window.gtag('set', 'user_properties', safeParams(properties));
        window.gtag('config', 'G-5RV57M7J0K', { user_id: userId });
        return true;
      } catch (error) {
        console.warn('GA4 identity tracking skipped:', error);
        return false;
      }
    },
    clearUserIdentity() {
      try {
        if (typeof window.gtag !== 'function') return false;
        window.gtag('config', 'G-5RV57M7J0K', { user_id: null });
        return true;
      } catch (error) {
        console.warn('GA4 identity clearing skipped:', error);
        return false;
      }
    },
  };

  const GA4_Auth = {
    signInStarted: () => track('sign_in_started'),
    signInSuccess: data => track('sign_in_success', {
      channel_count: data?.channelCount,
      has_scheduled: data?.hasScheduled,
      queue_depth: data?.queueDepth,
      has_approvals: data?.hasApprovals,
    }),
    signInFailed: reason => track('sign_in_failed', { reason }),
    signedOut: () => track('signed_out'),
    tokenRefreshed: method => track('token_refreshed', { method }),
    tokenRefreshFailed: () => track('token_refresh_failed'),
    connectionStatusChecked: connected => track('connection_status_checked', { connected: !!connected }),
    syncStarted: () => track('buffer_sync_started'),
    syncComplete: data => track('buffer_sync_complete', {
      post_count: data?.postCount,
      channel_count: data?.channelCount,
      sync_time_ms: data?.syncTimeMs,
      used_cache: data?.usedCache,
    }),
    syncFailed: type => track('buffer_sync_failed', { error_type: type }),
  };

  const GA4_Composer = {
    composerOpened: source => track('composer_opened', { source }),
    contentStarted: () => track('composer_content_started'),
    contentLengthMilestone: milestone => track('content_length_milestone', { milestone }),
    mediaAttached: (mediaType, source) => track('composer_media_attached', { media_type: mediaType, source }),
    composerCleared: () => track('composer_cleared'),
    templateInserted: type => track('composer_template_inserted', { template_type: type }),
    postSent: data => track('post_sent', {
      action: data?.action,
      char_count: data?.charCount,
      has_media: data?.hasMedia,
      media_type: data?.mediaType,
      channel_count: data?.channelCount,
      is_thread: data?.isThread,
      thread_part_count: data?.threadPartCount,
      needs_approval: data?.needsApproval,
      days_ahead: data?.daysAhead,
    }),
    postSendFailed: type => track('post_send_failed', { error_type: type }),
    threadSplit: partCount => track('thread_split', { part_count: partCount }),
    threadPartCopied: partIndex => track('thread_part_copied', { part_index: partIndex }),
  };

  const GA4_Calendar = {
    calendarOpened: () => track('calendar_opened'),
    viewModeChanged: mode => track('calendar_view_mode_changed', { mode }),
    gapDetected: consecutiveGapDays => track('calendar_gap_detected', { consecutive_gap_days: consecutiveGapDays }),
    noteAdded: noteType => track('calendar_note_added', { note_type: noteType }),
    snapshotCreated: data => track('snapshot_created', {
      range: data?.range,
      channel_count: data?.channelCount,
      post_count: data?.postCount,
    }),
    snapshotLinkCopied: () => track('snapshot_link_copied'),
    snapshotShared: method => track('snapshot_shared', { method }),
  };

  const GA4_Ideas = {
    ideasOpened: () => track('ideas_opened'),
    tabSwitched: tab => track('ideas_tab_switched', { tab }),
    notebookCardAdded: () => track('notebook_card_added'),
    notebookCardUsed: () => track('notebook_card_used'),
  };

  const GA4_Pillars = {
    builderOpened: () => track('pillar_builder_opened'),
    ssmQuestionnairStarted: () => track('ssm_questionnaire_started'),
    ssmQuestionnaireComplete: data => track('ssm_questionnaire_complete', {
      industry: data?.industry,
      tone: data?.tone,
      goal: data?.goal,
    }),
    ssmGenerationStarted: () => track('ssm_generation_started'),
    ssmGenerationComplete: count => track('ssm_generation_complete', { pillar_count: count }),
    ssmGenerationFailed: type => track('ssm_generation_failed', { error_type: type }),
    pillarCreated: data => track('pillar_created', {
      icon: data?.icon,
      seeds: data?.seeds,
      trust_layer: data?.trustLayer,
    }),
    pillarEdited: seedCount => track('pillar_edited', { seed_count: seedCount }),
    seedIdeaStarted: () => track('pillar_seed_idea_started'),
    pillarHealthChecked: data => track('pillar_health_checked', safeParams(data)),
  };
  GA4_Pillars.ssmQuestionnaireStarted = GA4_Pillars.ssmQuestionnairStarted.bind(GA4_Pillars);

  const GA4_Templates = {
    templateCreated: type => track('template_created', { template_type: type }),
    templateEdited: () => track('template_edited'),
    templateDeleted: () => track('template_deleted'),
    templateUsed: type => track('template_used', { template_type: type }),
    templateSearched: queryState => track('template_searched', { query_state: queryState }),
  };

  const GA4_Trending = {
    trendingOpened: () => track('trending_opened'),
    trendingSourceSwitched: source => track('trending_source_switched', { source }),
    trendingStoriesLoaded: (source, durationMs) => track('trending_stories_loaded', { source, duration_ms: durationMs }),
    trendingStoryViewed: source => track('trending_story_viewed', { source }),
    trendingStorySaved: source => track('trending_story_saved', { source }),
    trendingStoryUsedInCompose: source => track('trending_story_used_in_compose', { source }),
    redditSubredditBrowsed: subreddit => track('reddit_subreddit_browsed', { subreddit }),
    trendingLoadFailed: source => track('trending_load_failed', { source }),
  };

  const GA4_Approvals = {
    approvalsOpened: () => track('approvals_opened'),
    approvalLinkGenerated: data => track('approval_link_generated', {
      reviewer_count: data?.reviewerCount,
      is_team: data?.isTeam,
    }),
    approvalLinkCopied: () => track('approval_link_copied'),
    approvalLinkShared: method => track('approval_link_shared', { method }),
    approvalReviewed: status => track('approval_reviewed', { status }),
    approvalPublished: () => track('approval_published'),
    approvalArchived: () => track('approval_archived'),
  };

  const GA4_Discord = {
    discordModeOpened: () => track('discord_mode_opened'),
    discordAnnouncementSent: timing => track('discord_announcement_sent', { timing }),
    discordAnnouncementScheduled: data => track('discord_announcement_scheduled', { minutes_ahead: data?.minutesAhead }),
    discordSendFailed: type => track('discord_send_failed', { error_type: type }),
  };

  const GA4_Media = {
    uploadStarted: type => track('media_upload_started', { media_type: type }),
    uploadComplete: data => track('media_upload_complete', {
      media_type: data?.type,
      size_bytes: data?.sizeBytes,
      duration_ms: data?.durationMs,
    }),
    uploadFailed: type => track('media_upload_failed', { error_type: type }),
    unsplashSearched: (queryState, resultCount) => track('unsplash_searched', { query_state: queryState, result_count: resultCount }),
    unsplashImageSelected: () => track('unsplash_image_selected'),
    unsplashLoadFailed: () => track('unsplash_load_failed'),
  };

  const GA4_System = {
    appInitialized: data => track('app_initialized', {
      is_returning: data?.isReturning,
      has_token: data?.hasToken,
      has_data: data?.hasData,
    }),
    viewChanged: (view, source) => track('view_changed', { view, source }),
    featureFlagChecked: (feature, enabled) => track('feature_flag_checked', { feature, enabled: !!enabled }),
    pausedFeatureAttempted: feature => track('paused_feature_attempted', { feature }),
    settingChanged: (setting, value) => track('setting_changed', { setting, value }),
    performanceMetric: (metric, milliseconds) => track('performance_metric', { metric, milliseconds }),
    applicationError: (error, context) => track('application_error', { error_type: errorType(error), context }),
  };

  window.GA4 = GA4;
  window.GA4_Auth = GA4_Auth;
  window.GA4_Composer = GA4_Composer;
  window.GA4_Calendar = GA4_Calendar;
  window.GA4_Ideas = GA4_Ideas;
  window.GA4_Pillars = GA4_Pillars;
  window.GA4_Templates = GA4_Templates;
  window.GA4_Trending = GA4_Trending;
  window.GA4_Approvals = GA4_Approvals;
  window.GA4_Discord = GA4_Discord;
  window.GA4_Media = GA4_Media;
  window.GA4_System = GA4_System;
})(window);
