# Phase 3: Your Pace and Content Bank

## Baseline and product clarification

Built on `523c102`, the merge of the completed Phase 2 branch (`2a3bd70`).
The initial inspection used the Phase 2 branch while the merge propagated; the
Phase 3 branch was then advanced to the merged main commit without changing
its source tree.

The user's clarification takes precedence over the original sidebar proposal:
**Queue Health and Your Pace remain one standalone tool**. Your Pace is not in a
calendar sidebar. Calendar has a shortcut beside Help/Open Buffer (and a mobile
header shortcut). All sidebar tools are under the existing Workspace heading.

## Your Pace

- Uses Phase 1's `PostIQCoverage.calculate` for channel/date coverage, including
  per-channel cadence, targets, intentional days off and period overrides.
- A target means **posts per selected posting day**, from 0 to 10. For example,
  Monday/Wednesday/Friday with target 1 means three planned slots per week;
  Tuesday/Thursday do not become gaps. Multiple posts are counted independently,
  duplicate API post IDs are counted once, and draft/local/published records
  do not contribute to the scheduled queue.
- Check an inclusive period of 1–92 days. Missing slots are listed separately by
  channel and date. Plan this slot selects that date/channel in Calendar and
  opens the existing date detail workflow; it never submits to Buffer.
- Mark a single date or range as intentionally off, for one channel or all
  channels. Save a future period target for a lighter period. These settings
  change planning calculations, not scheduled posts. They can be removed to
  restore the inherited rhythm. The latest matching target override wins;
  intentional days off take precedence over targets.
- Existing global posting days remain the fallback for channels without an
  override. No preferences are erased or globally rewritten on startup.
- A confident fully-covered result requires a connected account, complete queue
  pagination metadata, a fresh timestamp (15 minutes), and a successful last
  sync. Even if loaded posts cover every planned slot, incomplete data cannot
  produce that result. The check displays its timezone and time. Empty rhythm
  periods say no slots are planned, rather than claiming full coverage.
- Calendar gaps, Queue Health and runway consume the same extended coverage
  calculation. Existing posting-day settings remain compatible.

The new fields live under the existing `postiqPlanningSettings` object:
`channelTargets` (channel → target), `daysOff` (inclusive channel/date ranges),
and `targetOverrides` (inclusive channel/date/target ranges). Existing fields
are retained. No migration, separate content store, credentials, or new service
is required. Changes are local to the existing browser storage.

## Content Bank

- Keeps `ideasView`, `data-workspace-*="ideas"`, `postiq_notebook_v1`, the
  `window.Notebook` interface, card IDs, source text, independent variants,
  Buffer relationships, and workflow/lifecycle functions. `contentBankView` is
  an additional route alias; the legacy Ideas route and help article slugs work.
- Existing cards can be searched by title, source text, URL and channel-version
  text/name. Filters distinguish no target, local targets, confirmed scheduling,
  no confirmed scheduling, and existing lifecycle stages.
- Plan/change/clear a target through the existing updateCard API. A target is
  labeled planning-only. This action does not call Buffer or modify variants.
- Last-confirmed Buffer scheduling is displayed independently, with channel and
  timezone. It uses API-linked variants or matching posts in the loaded queue,
  not arbitrary local dates. Legacy API-linked dated variants without a status
  retain compatibility unless marked as drafts. Sync remains necessary to
  refresh older Buffer relationships; these labels are not a live server poll.
- Develop and Quick compose reuse the existing workflows. Templates, Content
  Pillars and Trending remain under Resources; Composer resource labels and
  relevant help text use Content Bank. Source storage is unchanged.
- Fixed an existing variant-editing issue: reviewing a version no longer clears
  scheduling dates/modes on every version. Editing one version preserves the
  others and their Buffer metadata.

## Calendar refinements

The existing channel/item controls and legend are inside a native Filters
popover. Its active-filter count, reset, Escape behavior and labels preserve
access to the controls without the default toolbar width/height cost. Date
navigation, Month/Week/Agenda, Add and Share remain immediately available.
The header description is shorter; stale/incomplete/disconnected warnings remain
visible outside the collapsed filter area.

## Confirmation boundary

Composer still submits only after the user chooses an explicit Buffer action.
Coverage updates from an actual success response with a post ID and scheduled
date, not optimistically while a request is pending. Rejections retain the local
draft. A successful queue response without a confirmed date marks dated queue
coverage incomplete until a sync provides the date. Saved Buffer drafts do not become scheduled coverage even if their API
response includes a date. Target/rhythm/day-off editing makes no Buffer calls.

## Validation and limits

```sh
npm ci
node scripts/check-project.js
node scripts/smoke-browser.js
node --test tests/*.test.js
CHROMIUM_PATH=/usr/bin/chromium node scripts/check-calendar-browser.js
CHROMIUM_PATH=/usr/bin/chromium node scripts/check-planning-tools-browser.js
```

New tests cover M/W/F cadence, multiple targets, per-channel gaps, days off,
latest overlapping targets, incomplete/stale data, legacy card and variant
preservation, independent version editing, old/new routes, compact filters,
slot context, API rejection/pending/success and saved-draft exclusion.

Chromium checks exercise 390, 768 and 1440px layouts, the combined Queue Health /
Your Pace tool, coverage checks, days off, slot navigation, Content Bank date
planning, Resources and preservation, with no horizontal page overflow.
Screenshots are written to `/tmp/postiq-phase3-{calendar,pace,bank}-<width>.png`.
All remote traffic is intercepted; the pre-existing read-only Trending POST is
stubbed. No real content is published, scheduled, moved, canceled or deleted.

The existing 200-post/four-page fetch cap remains. Capped data stays incomplete.
Live Buffer/OAuth operations and production deployment are not verified here.
The full suite retains the pre-existing AI Assist private-beta copy assertion
failure; other regression test files pass. No merge or deployment is performed.

## Queue Health layout refinement

Period coverage is a bounded, full-width card above compact rhythm controls.
Lighter-period and day-off settings use native collapsible sections. The slot
list scrolls without truncating its actions and supports keyboard scrolling.
Disconnected channel controls show a placeholder and disable channel-specific
editing; global days-off planning remains available. Calculation details remain
accessible in a disclosure, while connection/data warnings stay visible.
