# Phase 4: Calendar-first landing page and tour

Built on `bc19646`, the merge of Phase 3. No AGENTS.md files exist in the
repository. The static architecture, classic-script load order, OAuth routes,
GA hooks, feature flags and workspace preferences are unchanged.

## Positioning

PostIQ is presented as an independent calendar companion for Buffer users:
“Your Buffer calendar, with room to think.” The landing page leads with
scheduled posts beside planning notes/actions, gaps against the user's rhythm,
saved content that becomes a dated plan, and coverage before time away.
Connected features are stated as requiring Buffer sign-in; the preview's limits
are explained in a dedicated “Preview vs. connected” section rather than the hero.

Removed as obsolete or unsupported: the live thread-splitter demo (the app no
longer has a thread splitter), the “first companion app built on Buffer's API”
and “Buffer just opened their API” claims, and the old funnel/tool-tab mockups.
Built by Ben keeps only the existing 6M+ followers fact from the README. No
testimonials, usage numbers or outcomes were added.

## Calls to action

- **Sign in with Buffer** → `/auth/connect.html?return=/app.html?view=calendarView`
  (encoded). `connect.js`/`callback.js` already accept same-origin paths with a
  query, so sign-in returns to the calendar with `connected=buffer`.
- **Preview the calendar** → `/app.html?view=calendarView` (existing `view` route).
- “Take the 5-step tour” → `/app.html?view=calendarView&tour=1`.

The existing returning-visitor redirect from `/` to `/app.html` is retained.

## Product preview

`scripts/capture-landing-screenshots.js` renders the real app with fictional
sample data seeded into browser storage (frozen clock, all remote requests
blocked, write requests rejected) and writes `images/product/*.png` plus the
1200×630 `postiq-og.png`. Every preview is labelled “Sample data”.

## Tour

`js/features/tour.js` + `css/app/tour.css`. Five steps: calendar, Add (planning
context), Queue Health, Your Pace, Content Bank.

- Started only by the person: Take a tour in the sidebar, Calendar header,
  mobile More menu, the getting-started banner, or the landing link. The
  `tour=1` flag is removed on load, so refresh, bookmarks and OAuth return
  (which only carries `view`) do not reopen it.
- Non-modal dialog without a scrim; the highlight ring ignores pointer events.
  Skip, ×, Escape, Finish, or navigating elsewhere closes it. Focus moves to the
  step title and returns to the trigger. Back/Next are available.
- Steps whose view is disabled by feature flag or workspace preference, or whose
  control is not visible in the current layout, are skipped. Mobile uses agenda
  targets and a docked popover above the tab bar.
- Only calls `activateView`; no Buffer requests or clicks on app controls.
  `postiq_tour_seen` is recorded for analytics/state only.
- Onboarding banner and per-view tips are hidden while the tour runs.

The getting-started banner now follows connect → check coverage (visiting
Queue Health) → plan a gap and send to Buffer, and offers Take a tour.

## Copy updates

Help Center (Queue Health/Your Pace guide, calendar guide, getting started, tour;
`write-split-send-posts` slug kept for existing links), README, CHANGELOG,
manifest, app description, About Ben, and social metadata. The service-worker
cache is bumped and includes the tour assets.

## Validation

```sh
npm ci
node scripts/check-project.js
node scripts/smoke-browser.js
node --test tests/*.test.js
CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/check-calendar-browser.js
CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/check-planning-tools-browser.js
CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/check-landing-tour-browser.js
```

`check-landing-tour-browser.js` (390/768/1440px): local link/asset/anchor
resolution, alt text, single h1, CTA targets, OG metadata, FAQ `aria-expanded`,
support-dialog Escape/focus return, section order, no horizontal overflow,
preview CTA landing on the calendar; tour steps, popover on-screen, single-use
flag, no reopen on reload, restart from header/mobile menu, Back, Escape, end on
navigation, disabled Content Bank skip, banner interplay, OAuth return path,
no runtime errors and no write requests. Screenshots: `/tmp/postiq-phase4-*.png`.

Not verified here: live Buffer OAuth/sync, production deploy, the external
headshot and Google Fonts (blocked in the sandbox), and screen-reader output
beyond the DOM semantics above. The full suite retains the pre-existing AI Assist
private-beta copy assertion failure.
