# Changelog

## Phase 2: delight

### Added

- **Today card** above the calendar (when you're viewing the current month or
  week): what's going out today, today's to-dos with checkboxes, and the next
  open slot in the coming week.
- **One-tap fill.** Open slots (in the Today card or by clicking a dashed slot)
  suggest a starred evergreen post, same channel or platform first, and say the
  exact day and time ("Reshare Thu at 11:15 AM") before queuing it in Buffer at
  that channel's usual time. "Another" cycles suggestions; "Write new" opens
  Compose on that day and channel. With nothing starred, it points to the Shelf.
- **Quick add.** "+ Add" (or N) opens a single input that reads plain English:
  "Fri: …", "next Fri", "tomorrow", "Nov 12", "11/20", "in 3 days",
  "todo …", and holiday names ("Thanksgiving: …"), with a live preview.
  "More options" still opens the full day panel.
- **Drag to reschedule** with Undo. Posts move in Buffer via `editPost`
  (id, `customScheduled`, `dueAt` only, so text and media are untouched) and
  keep their time of day; plans move locally. A rejected move snaps back.
- **Holidays** under the date (Nager.Date via a cached Netlify function), with
  a country picker and Off in the ⋯ menu.
- **Backup, restore and .ics export** in the ⋯ menu. Backups exclude Buffer
  tokens and Discord webhook URLs.

### Changed

- Empty week-view days no longer say "No loaded posts".

## Phase 1: calm calendar

### Changed

- **One row of controls.** The calendar header is now just `‹ Month ›`,
  Month/Week and **+ Add**. Filters, List view, Posting schedule, Share, tour,
  Help and Open Buffer moved into a single **⋯ menu**. **Today** only appears
  when you've paged away from today; the alerts bell only appears when
  something needs you; the status line only speaks when something is wrong.
- **Two layers in a day.** Buffer posts are solid cards with the platform icon
  (the ◷ glyph is gone). Your own plans are outlined in their colour, and to-dos
  get a small check circle. No more symbol legend. A day shows three items,
  then one "+N more".
- **Gaps are open slots.** A dashed "Open slot" / "2 open slots" replaces the
  ▲ gap warning.
- **Filters stay honest.** When a filter is on, a dot shows on ⋯ and a
  "Filtered · Clear" chip appears in the toolbar.
- **Shelf.** Content Bank and Library are now one place, the **Shelf**, with
  **Past posts** and **Ideas** tabs, and one entry in the sidebar and phone tab
  bar. Help articles use the same name.
- Turning on **Ideas on the Shelf** in Settings now says where it went
  ("Ideas now appear as a tab on your Shelf") and briefly highlights the
  Shelf in the sidebar. The Shelf stays visible whenever either half (past
  posts or ideas) is available, instead of depending on the Library switch.
- **Phones.** The toolbar sticks to the top, the week label is short
  ("Nov 1–7"), the ⋯ menu opens as a sheet, empty days are a quiet
  "Nothing planned" line, and Shelf is in the tab bar.
- Week view drops its duplicate prev/next header.
- Tour copy points at the ⋯ menu and describes the two layers.

## Phase 0 cleanup

### Fixed

- **Offline app shell.** The service worker precached 11 files that no longer
  exist, so `cache.addAll()` failed and the offline shell never installed. The
  list now mirrors `app.html`, and `scripts/check-project.js` keeps it in sync.

### Security

- **Unsplash search** now goes through `/.netlify/functions/unsplash-search`
  instead of calling Unsplash from the browser with a hardcoded key. Needs the
  `UNSPLASH_ACCESS_KEY` environment variable in Netlify.

### Removed

- The hidden Home dashboard (view, navigation, helpers and styles). The app
  opens on the calendar; old links to Home land there too.
- The unused "mobile coming soon" screen.
- The unused `assets/` prototype, the deployed `archive/` folder, and the
  `buffer-pulse` and `approval` functions. Retired code is kept on the
  `archive/retired-features` branch.

## Calendar-first simplification

A pass to make PostIQ easier for newer creators: the calendar is the planning
spine and Compose is the writing tool; everything else supports that loop.

### Added

- **Content runway** on the calendar: per channel, "Covered for N days — new
  content needed by DATE", counting non-posting days. Calm when healthy, no
  alarm colors.
- **Posting schedule** modal (opened from the calendar): days + target per
  channel, plan time off, and **evergreen reshares** that queue starred Library
  posts into Buffer to keep a streak alive during a break.
- Connection/health strip on the calendar (connect / reconnect, token expiring,
  stale data) with a "you're well ahead — a break is fine" nudge.

### Changed

- **Queue Health** is no longer a separate page — its runway and connection
  signals now live on the calendar; the runway number shows in one unit.
- **Library** drops performance metrics and becomes a reuse/evergreen tool
  (star, Reshare, Rewrite); it no longer runs the heavy metrics probe.
- **Trending** moved from Content Bank into a Compose writing-tools tab and is
  loaded only when opened (no fetch on every app start).
- New accounts start with Calendar + Compose; Content Bank is opt-in. Tour
  trimmed to three steps (calendar, schedule, Compose).

### Removed

- **Pulse**, **Content Pillars**, and **Approvals** retired from the app
  (moved to `archive/`). Approvals' reviewer flow is retired with it.

## Calendar-first landing and tour

### Added

- Five-step product tour (calendar, planning context, Queue Health, Your Pace, Content Bank) as the single onboarding: opens once on a first visit, skippable, and restartable
- “Take a tour” entry points in the sidebar, Calendar header and mobile More menu
- Two-column hero with an animated, illustrated calendar; illustrated Queue Health and Content Bank mockups labelled as sample data
- Share image built from a real-app screenshot with sample data

### Changed

- Landing page leads with the calendar: “Your Buffer calendar, with room to think.”
- Primary CTA “Sign in with Buffer” returns to the calendar; secondary “Preview the calendar” opens it without sign-in
- Help Center, README, manifest and social metadata describe the current product

### Removed

- Thread splitter demo and messaging (no longer in the app); “first companion app” claim
- Getting-started banner and per-view tips (replaced by the tour)

## Focused Writing Space

### Added

- Distraction-free Focus Mode for Compose
- Local draft autosave and safe restoration after refresh
- Collapsible writing-tools rail on desktop
- Writing-tools bottom sheet and sticky Buffer actions on mobile
- Searchable Notebook, Hooks, Hashtags, Templates, Pillars, and AI Assist tabs
- One-click Notebook pinning or note insertion inside Compose
- Saved hooks plus openings from starred and top-performing Library posts
- Reusable hashtag sets that append directly to the active draft

### Improved

- Larger, calmer editor dimensions across screen sizes
- Mobile toolbar scrolling and keyboard-safe use of dynamic viewport units
- Accessible writing-tool state, focus return, and Escape-key behavior
- Live resource counts and automatic updates when Notebook, Template, or Library data changes

## Public Beta Launch Prep

### Added

- Buffer sign-in flow
- Calendar planning view
- Composer workspace
- Thread splitting
- Ideas / Content Pillars workflow
- Snapshot sharing
- Feature flags through Netlify config
- Global error/status banner

### Improved

- Snapshot shared views
- OAuth routing from landing page
- SEO and social sharing metadata
- Privacy/trust copy
- Settings layout and About section
- App stability and error handling

### Known Beta Notes

- Some features may change as Buffer’s API evolves.
- Snapshot links are static copies and anyone with the link can view included content.
- Media previews depend on available post data.
- Optional tools may be paused with feature flags during beta.
