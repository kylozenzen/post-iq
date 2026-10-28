'use strict';

// ── QUEUE RUNWAY ─────────────────────────────────────
// Pure helpers: no DOM, no globals. Loaded as a classic script in the browser
// and required directly by tests/runway.test.js.
//
// Definition: runway is the number of consecutive local calendar days, starting
// tomorrow, that each have at least one scheduled post. The count stops at the
// first empty day. Today's posts are not counted, because "tomorrow onward" is
// what a person would need to cover before taking a break.
//
// Dates use the browser's local calendar (the same convention as calendar.js).
// Buffer's account timezone is not used here; if it is ever exposed to the
// client, pass it through and replace localDayKey.
(function (root) {
  const RUNWAY_BREAK_THRESHOLD_DAYS = 14;
  const RUNWAY_LOW_THRESHOLD_DAYS = 3;
  const RUNWAY_HORIZON_DAYS = 90;

  function localDayKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function postDate(post) {
    const raw = post?.due_at || post?.dueAt || post?.scheduled_at || post?.scheduledAt;
    const d = raw ? new Date(raw) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  }

  function postChannelKey(post) {
    return String(post?.channel_id || post?.channelId || post?.channel?.id || post?.service || post?.channel_service || 'unknown');
  }

  // Returns a Set of day keys that have at least one post matching the filter.
  function coveredDays(posts, filter = () => true) {
    const days = new Set();
    (Array.isArray(posts) ? posts : []).forEach(post => {
      if (!filter(post)) return;
      const d = postDate(post);
      if (d) days.add(localDayKey(d));
    });
    return days;
  }

  function runwayFromDays(covered, now, horizon = RUNWAY_HORIZON_DAYS) {
    let count = 0;
    for (let i = 1; i <= horizon; i++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (!covered.has(localDayKey(day))) break;
      count += 1;
    }
    return count;
  }

  // Runway across all channels: a day counts if any channel has a post on it.
  function computeRunway(posts, { now = new Date(), horizon = RUNWAY_HORIZON_DAYS } = {}) {
    return runwayFromDays(coveredDays(posts), now, horizon);
  }

  // Runway for each channel id. Channels with no posts report 0.
  function computeChannelRunways(posts, channelIds = [], { now = new Date(), horizon = RUNWAY_HORIZON_DAYS } = {}) {
    const result = {};
    (channelIds || []).forEach(id => {
      const key = String(id);
      const covered = coveredDays(posts, post => postChannelKey(post) === key);
      result[key] = runwayFromDays(covered, now, horizon);
    });
    return result;
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
