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
  There is no separate tour link; the tour opens on a first visit.

The existing returning-visitor redirect from `/` to `/app.html` is retained.

## Product visuals

The hero is two columns, with an illustrated calendar to the right of the copy.
The calendar, Queue Health/Your Pace and Content Bank are drawn in HTML/CSS in
the previous landing page's style: window chrome, a stat strip, floating
status pills, a dotted grid texture, and small animations. Gaps pulse, one gap
turns into a planned draft, the coverage bar fills, and the arrow from a dated
item to the calendar moves. Motion is disabled under `prefers-reduced-motion`.
Every mockup is labelled “Sample data”. Its numbers are consistent with a
Mon/Wed/Fri + Mon/Thu rhythm: 10 slots, 8 covered, 2 gaps, and Nov 23–27
marked off. Mockups show only Calendar, Queue Health and Content Bank.

`scripts/capture-landing-screenshots.js` renders the real app with fictional
sample data. It uses a frozen clock, blocks remote requests, and rejects write
requests. Approvals, Library and Pulse are switched off through the app-config
response. It writes `images/product/calendar-desktop.png` and the 1200×630
`postiq-og.png` built from it.

## Onboarding: the tour

`js/features/tour.js` + `css/app/tour.css` replace the old getting-started
banner and per-view tips (`js/onboarding.js`, `css/onboarding.css`, removed).
Five steps: calendar, Add (planning context), Queue Health, Your Pace, Content Bank.

- Opens once automatically on a first visit to the app (no `postiq_app_visited`
  before this load), whether the person previewed first or signed in first.
  Visitors from before the tour existed are not interrupted.
- Restart: Take a tour in the sidebar, Calendar header, or mobile More menu,
  or a link with `?tour=1`. The flag is removed on load. Closing records
  `postiq_tour_seen`, so refresh, bookmarks and OAuth return (which only
  carries `view`) do not reopen it.
- Non-modal dialog without a scrim; the highlight ring ignores pointer events.
  Skip, ×, Escape, Finish, or navigating elsewhere closes it. Focus moves to the
  step title and returns to the trigger.
- Steps whose view is disabled by feature flag or workspace preference, or whose
  control is not visible in the current layout, are skipped. Mobile uses agenda
  targets and a popover docked above the tab bar.
- Disconnected visitors are offered **Sign in with Buffer** on the last step.
  That button is the only way the tour leaves the page: it returns to the
  calendar and starts the normal sign-in. The tour never performs Buffer writes
  or clicks app controls.

## Gap detection

Gap detection is unchanged from Phases 1–3 and appears in three places. All
three use the shared `PostIQCoverage` calculation:

1. Calendar day labels: scheduled, gap, or non-posting day.
2. Queue Health's channel health/runway and its “Coverage this week” gap chips.
3. Your Pace's period check, which lists every uncovered slot.

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
preview CTA landing on the calendar with the tour open; tour steps, popover on-screen, single-use
flag, no reopen on reload, restart from header/mobile menu, Back, Escape, end on
navigation, disabled Content Bank skip, first-visit open, returning visitors, last-step sign-in offer, OAuth return path,
no runtime errors and no write requests. Screenshots: `/tmp/postiq-phase4-*.png`.

Not verified here: live Buffer OAuth/sync, production deploy, the external
headshot and Google Fonts (blocked in the sandbox), and screen-reader output
beyond the DOM semantics above. The full suite retains the pre-existing AI Assist
private-beta copy assertion failure.
