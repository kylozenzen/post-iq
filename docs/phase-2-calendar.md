# Calendar experience (Phase 2)

Starting point: `39e0f0f`, the merge of Phase 1 (`50fe0d5`). The existing
static app, classic-script load order, themes, feature flags, optional workspaces,
OAuth, date-only note keys, notebook cards, and Buffer payload models remain.

## Behavior

- Normal entry chooses the first enabled workspace (Calendar for new/default
  preferences). Valid explicit `?view=` destinations and OAuth return views
  take priority, subject to existing feature/workspace rules. Reviewer and
  shared-snapshot entry paths retain their special handling.
- Primary navigation uses Calendar, Content Bank (the existing Ideas workspace),
  and Compose. Approvals, Library and Pulse remain in secondary navigation and
  mobile More. Sidebar collapse and workspace customization retain their keys.
- Calendar uses one toolbar: Today, previous/next range, range label,
  Month/Week/Agenda, channel and item filters, Add, Share and Queue Health.
  The legacy content-calendar mode is accessible through “Content items” in
  the item filter. The underlying mode preference is retained.
- Desktop Week and Agenda navigate seven-day ranges; Month navigates months.
  At 768px and narrower, Agenda presents the selected week without overwriting
  the stored desktop Month/Week/Agenda preference. Mobile is no longer blocked
  by the old coming-soon screen.
- Confirmed Buffer posts, date-only notes, action notes and content targets have
  separate labels/markers. Target dates explicitly say “not scheduled”.
  Calendar content dates use the same display timezone as coverage where that
  helper is present. Existing note dates remain literal dates.
- Queue Health lives in a collapsible sidebar, or an accessible mobile drawer.
  Your Pace has a labeled reserved section with no fake controls or metrics.
- Post/day and note/action details use the existing renderers in matching
  drawers. Content targets reuse ContentDetail and the original notebook data;
  the existing view moves into a drawer for Calendar entry and returns to its
  original DOM location on close. The existing full workspace remains available
  when entered from Content Bank.
- Date quick-add supports a note or draft. Calendar-origin Compose shows the
  planning date and carries a selected channel. Only the explicit “Use date in
  schedule picker” action changes the schedule picker. Sending to Buffer still
  requires the existing Draft/Queue/Schedule action. Existing draft content is
  not replaced.

## Presentation storage

Existing keys and user data are not renamed or deleted. Additions:

- `sessionStorage.postiq_calendar_context_v2`: selected date, range anchor,
  view, item/channel filters, main/window scroll. Used for detail/Compose return
  and OAuth return in the same tab.
- `localStorage.postiq_calendar_insights`: sidebar open/closed preference.
- The existing `postiq_calendar_view` additionally accepts `agenda`; mobile
  rendering alone does not write that key.

## Ownership

`calendar-experience.js` owns presentation/context and drawer focus lifecycle.
`calendar.js` owns existing date rendering, notes and quick-add wiring.
`content-detail.js` remains the owner of content editing. Modal open/close hooks
in `buffer-connection.js` call the optional presentation lifecycle; other modal
behavior is retained. CSS extends existing theme tokens and components.

Drawers trap Tab/Shift+Tab, handle Escape, use dialog labels, and restore focus
and scroll. Date cells also support Enter/Space. The service-worker shell version
is bumped and includes both new presentation assets.

## Validation

```sh
npm ci
node scripts/check-project.js
node scripts/smoke-browser.js
node tests/calendar-experience.test.js
node --test tests/*.test.js
CHROMIUM_PATH=/usr/bin/chromium node scripts/check-calendar-browser.js
```

The browser script serves the checkout locally, blocks remote requests, and uses
local fixture posts/notes. It never submits content to Buffer. It verifies 390,
768 and 1440px layouts, week/Agenda rendering, exact-post selection, keyboard
focus trapping/restoration, scroll restoration, note creation, draft return,
mobile Queue Health and content-target drawers. Screenshots are written under
`/tmp/postiq-phase2-*.png`. An installed Chromium is required; playwright-core
is a development dependency and does not download a browser.

Project checker, DOM smoke, seven new DOM regression cases, and Chromium checks
pass. Full test suite: 20 passing test files and one pre-existing AI Assist
private-beta copy assertion failure. Live Buffer/OAuth and production snapshot
sharing were not exercised; no real content was published or scheduled.
