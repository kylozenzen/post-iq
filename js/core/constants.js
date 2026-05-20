export const STORE_KEY       = 'postiq_buffer_token';
export const OAUTH_ACCESS_TOKEN_KEY = 'postiq_buffer_access_token';
export const OAUTH_REFRESH_TOKEN_KEY = 'postiq_buffer_refresh_token';
export const OAUTH_EXPIRES_AT_KEY = 'postiq_buffer_token_expires_at';
export const OAUTH_TOKEN_TYPE_KEY = 'postiq_buffer_token_type';
export const OAUTH_SCOPE_KEY = 'postiq_buffer_token_scope';
export const OAUTH_RECONNECT_NEEDED_KEY = 'postiq_buffer_reconnect_needed';
export const NOTE_KEY        = 'postiq_calendar_notes_v2';
export const NOTE_TYPES_KEY  = 'postiqNoteTypes';
export const PLANNING_KEY    = 'postiqPlanningSettings';
export const TEMPLATE_KEY    = 'postiq_templates_v1';
export const CACHE_KEY       = 'postiq_buffer_cache_v1';
export const APPROVAL_PREFIX = 'postiq_approval_';

export const IMGUR_KEY    = '546c25a59c58ad7';
export const UNSPLASH_KEY = 'tBuaYCO5p-pJPjgF29hR2yJGtlQaG4d5HqdVivV0lbQ';

export const TEMPLATE_TYPES     = ['All','Hooks','CTAs','Announcements','Engagement','Hashtag Sets'];
export const TEMPLATE_PLATFORMS = ['All Platforms','LinkedIn','X','Threads','Instagram','Universal'];
export const DAY_CODES = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
export const DAY_LABELS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const DEFAULT_PLANNING_SETTINGS = { showQueueGaps: true, postingDays: ['MON','TUE','WED','THU','FRI'] };
export const DEFAULT_NOTE_TYPES = [
  { id: 'note', label: 'Note', color: '#6366f1' },
  { id: 'idea', label: 'Idea', color: '#22c55e' },
  { id: 'reminder', label: 'Reminder', color: '#f59e0b' },
  { id: 'revision', label: 'Needs Revision', color: '#ef4444' }
];
export const DEFAULT_POSTIQ_CONFIG = {
  betaMessage: 'PostIQ is in public beta. Some tools may change as Buffer’s API evolves.',
  features: {
    calendar: true, composer: true, ideas: true, contentPillars: true, trending: true,
    approvals: true, snapshots: true, uploads: true, unsplash: true, zenMode: true
  },
  notices: { approvals: '', trending: '', uploads: '', snapshots: '' }
};
export const BETA_BANNER_SESSION_KEY = 'postiq_beta_banner_seen';
export const LEGACY_NOTE_TYPES = {
  gold: { id: 'idea', label: 'Idea', color: '#f59e0b' },
  blue: { id: 'draft', label: 'Draft', color: '#3a3fff' },
  green: { id: 'campaign', label: 'Campaign', color: '#0fa672' },
  violet: { id: 'priority', label: 'Priority', color: '#7c3aed' }
};

export const SNAP_ADJECTIVES = ['amber','brisk','cobalt','clever','cosmic','crisp','electric','golden','lively','lunar','mint','neon','quiet','rapid','silver','sunny','tidy','vivid'];
export const SNAP_NOUNS = ['atlas','beacon','canvas','comet','draft','ember','grove','harbor','kite','lane','maple','orbit','pencil','quill','signal','spark','studio','thread'];

export const BUFFER_AUTHORIZATION_ENDPOINT = 'https://auth.buffer.com/auth';
export const BUFFER_OAUTH_SCOPE = 'posts:write posts:read account:read offline_access';
export const BUFFER_OAUTH_DEBUG_KEY = 'postiq_oauth_debug';
