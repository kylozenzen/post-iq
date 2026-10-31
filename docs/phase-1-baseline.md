# Phase 1 baseline

Starting commit: ea82b6513381a7054e61f254102c01ad714038be.

Already present at that commit: month/week calendars, scheduled and published
post cards, date-only multi-note storage with custom types, snapshots, global
posting-day settings and seven-day queue gaps, per-channel daily runway and
queue health, logical content items with channel versions, optional workspaces,
composer autosave, OAuth refresh and reconnect handling.

These features predate this change. No contest attribution or creation-date
claim is made; commit history must be checked against the contest dates before
making one.

## Implementation and migration

Coverage is evaluated per channel and date in the displayed browser IANA timezone.
Scheduled instants use that timezone; note keys remain literal dates. Cadence
arithmetic advances calendar dates rather than 24-hour intervals. Channel health
and runway count required posting opportunities from tomorrow, skipping off days.
The account runway is the minimum across channels. The optional Home percentage
counts confirmed scheduled channel-days divided by required channel-days.

The existing planning storage key and global postingDays remain intact. Missing
channelPostingDays entries inherit the global cadence; channel-specific arrays
are saved in the same object. Empty arrays mean intentional nonposting. No notes,
drafts, OAuth keys, or workspace settings are renamed or deleted.

Scheduled sync retains up to four pages/200 posts, without filtering to the visible
month. A remaining next page, missing pagination metadata, invalid dates, or a
repeated cursor leaves completeness false. There is no guaranteed chronological
API ordering, so a capped result cannot establish an empty date range. Cached
coverage without metadata is conservatively unknown. Evidence older than 15
minutes is stale. Reconnect errors retain synced context and local drafts.

Composer blocks simultaneous sends and requires a concrete success post ID.
Draft edits made during a request are retained. An accepted post followed by a
local update failure is reported as accepted, with a warning to check Buffer.
Network failures can still have ambiguous remote outcomes: there is no server
idempotency contract, so users should verify Buffer before retrying an uncertain
request. No real content was sent during validation.

Validation: lockfile-based npm ci, project checker, DOM smoke (navigation and
specific post selection), coverage/DST/cadence tests, pagination and partial-error
tests, duplicate-send/draft-retention test. Full suite: 19 passing files, one
pre-existing AI Assist copy assertion failure reproduced from the starting commit.
No environment dependency blockers remain. No merge, deployment, or publication.
