'use strict';

// Compatibility facade over the shared per-channel coverage model.
(function (root) {
  const RUNWAY_BREAK_THRESHOLD_DAYS = 14;
  const RUNWAY_LOW_THRESHOLD_DAYS = 3;
  const RUNWAY_HORIZON_DAYS = 90;

  const coverage = root.PostIQCoverage || require('./coverage.js');
  const localDayKey = coverage.dayKey;
  function computeChannelRunways(posts, channelIds = [], options = {}) {
    const result = typeof getQueueCoverage === 'function' ? getQueueCoverage((options.horizon || RUNWAY_HORIZON_DAYS)+1) : coverage.calculate({posts, channels:channelIds, now:options.now || new Date(), days:(options.horizon || RUNWAY_HORIZON_DAYS)+1, settings:options.settings, meta:options.meta || {complete:true,ts:Date.now()}, zone:options.zone});
    return Object.fromEntries(channelIds.map(id=>[id,coverage.runway(result.rows,id)]));
  }
  function computeRunway(posts, options = {}) {
    const ids = options.channelIds || [...new Set(posts.map(p=>String(p.channelId || p.channel_id || 'unknown')))];
    const counts = Object.values(computeChannelRunways(posts,ids,options));
    return counts.length ? Math.min(...counts) : 0;
  }

  // Maps a runway number to a status the UI can render.
  function classifyRunway(days) {
    if (!days) return 'empty';
    if (days < RUNWAY_LOW_THRESHOLD_DAYS) return 'low';
    return 'healthy';
  }

  const api = {
    RUNWAY_BREAK_THRESHOLD_DAYS,
    RUNWAY_LOW_THRESHOLD_DAYS,
    localDayKey,
    computeRunway,
    computeChannelRunways,
    classifyRunway,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PostIQRunway = api;
})(typeof window !== 'undefined' ? window : globalThis);
