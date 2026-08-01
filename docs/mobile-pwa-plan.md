# PostIQ mobile PWA plan

## Recommendation in one sentence

Ship a deliberately small **Capture → Read → Create** companion for phones: a
feed reader that saves useful items to the existing Notebook, a one-field link
capture flow, and a focused post composer that saves locally or sends a draft to
Buffer. Keep planning, approvals, analytics, and desktop power tools out of the
first mobile release.

This is not a responsive copy of the desktop product. It is the fast front door
to the same content workflow.

## What the repository already gives us

PostIQ is closer to a mobile product than the current phone experience suggests:

- `app.html` already declares PWA metadata and contains a mobile tab bar, drawer,
  mobile headers, agenda layout, and sheet-style modals.
- `app.css` contains a substantial breakpoint-specific UI, but a later rule hides
  `#app` at 768px and replaces it with the “mobile coming soon” form. The first
  delivery should remove that gate rather than start a second application.
- `manifest.json` already launches `/app.html` in standalone portrait mode and
  includes install icons.
- `sw.js` already registers an application-shell cache and navigation fallback.
- the RSS proxy already normalizes two allow-listed sources, and feed cards can
  already be saved through `window.Notebook.saveFromTrending()`.
- Notebook cards already have a stable local-storage key and contain the useful
  mobile fields: type, title, body, URL, and creation time.
- the composer already supports Buffer draft, queue, and schedule mutations.

Those are useful seams, but they should not be mistaken for release readiness.
The current mobile nav exposes seven destinations, the service worker is
network-first and caches too small a shell, local-only Notebook data does not
move between desktop and phone, and the active app uses root `app.js`/`app.css`
while architectural notes and an older check script still describe files under
`assets/`. Mobile work should follow the files actually loaded by `app.html` and
avoid expanding the existing duplication.

## Product boundary

### Version 1: exactly three jobs

1. **Read feeds**
   - Open to an “Inbox” containing the existing Buffer Blog and Social Media
     Today feeds.
   - Show source, age, title, a short summary, saved state, and a clear external
     link.
   - Pull to refresh or use a visible refresh action.
   - Save an item to Notebook without opening it.
   - Do not add arbitrary feed URLs in v1. The existing server allow-list is a
     safer, supportable starting point.

2. **Capture a link or note**
   - A persistent central **Save** action opens a bottom sheet.
   - Accept a pasted URL, optional title, and optional note. If the clipboard
     contains a URL, offer it as a suggestion rather than reading it silently.
   - Also accept text-only ideas.
   - Save immediately to the Notebook and confirm offline state clearly.
   - Use Web Share Target as a later enhancement; it needs server/route and form
     handling and should not block the first installable release.

3. **Create a quick post**
   - Provide a plain-text editor, character count, one or more Buffer channel
     choices, and two primary outcomes: **Save locally** and **Send as Buffer
     draft**.
   - Keep Queue and Schedule behind a secondary “More options” disclosure until
     usage proves they belong on the phone.
   - Allow “Use in post” from every saved card or feed item, preserving the item
     as a visible reference.
   - Autosave locally on input and restore after reload, browser eviction, or an
     OAuth round trip.

### Explicitly not in v1

- month/week planning and snapshots
- approvals
- content pillars and template management
- thread splitting, media search/upload, Discord, Library, and Pulse
- analytics dashboards or queue-health dashboards
- arbitrary RSS URLs, feed discovery, folders, tags, or full-text extraction
- background Buffer publishing

These features remain available on desktop. A small “Open full PostIQ” link can
be offered in settings, but desktop controls should not leak into the mobile
navigation.

## Mobile information architecture

Use three bottom destinations and one elevated capture action:

| Destination | Purpose | Primary action |
|---|---|---|
| **Inbox** | Read the latest feed items | Save |
| **Notebook** | Find saved links and ideas | Use in post |
| **Post** | Write or restore the current draft | Save / Send draft |
| **Capture** | Bottom sheet reachable from every destination | Add to Notebook |

Settings, Buffer connection status, refresh status, install help, offline state,
privacy, and “Open Buffer” belong in a compact profile/settings sheet—not a
fourth tab.

### Key flows

**Feed to saved idea:** Inbox → Save → brief confirmation → item remains in
place with a Saved state.

**Link capture:** Capture → paste URL → optional note → Save → Notebook detail.
This should take no more than three deliberate taps after paste.

**Idea to draft:** Notebook → Use in post → Post with reference pinned → choose
channel → Send as Buffer draft.

**Offline:** launch cached shell → read the last successful feed snapshot → save
links/notes and write a draft → reconnect → user explicitly retries the Buffer
draft. Never imply that a local post has reached Buffer.

## Interaction and visual rules

- Design for 360–430 CSS-pixel widths first, then verify 320px and tablet.
- Respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` on sticky
  headers, sheets, and bottom navigation.
- Minimum interactive target: 44×44px; leave at least 8px between adjacent
  destructive and primary actions.
- Keep the post editor above the keyboard and do not let the bottom nav cover its
  send controls. Test both iOS visual-viewport resize and Android keyboards.
- Use skeletons only for the first load; preserve old feed results during refresh
  and announce the refresh result without moving the list.
- Open source articles in the browser with a predictable external-link label.
- Provide text plus color for Saved, Offline, Syncing, Failed, and Sent states.
- Meet WCAG 2.2 AA contrast, visible focus, reduced-motion preferences, semantic
  headings, labeled controls, and screen-reader status announcements.
- Do not request notification permission in v1. There is no user benefit that
  justifies the interruption yet.

## Technical approach

### 1. Keep one application shell

Use `app.html`, root `app.css`, and root `app.js`, because those are the assets
currently shipped. Remove the final phone-only “coming soon” override and render
a `mobile-mode` shell from the existing state and services. Do not fork into
`mobile.html`: that would duplicate OAuth handling, storage schemas, Buffer
mutations, analytics, and accessibility work.

Before feature work, extract thin services from the monolith:

- `storage`: versioned Notebook, draft, read-state, feed-snapshot, and outbox APIs
- `feeds`: calls the Netlify feed endpoint and returns normalized items
- `notebook`: list/create/delete and stable item IDs
- `composer`: local autosave plus explicit Buffer submission
- `connectivity`: online/offline state and retry notifications
- `navigation`: route/query-state to selected mobile destination

The desktop UI can continue calling compatibility wrappers during extraction.
Do not migrate every desktop tool before shipping mobile.

### 2. Define durable local records

Use IndexedDB for feed snapshots, saved items, and draft/outbox data. Retain a
small migration that imports `postiq_notebook_v1` once, preserving existing
users' cards. Suggested records:

```text
NotebookItem { id, kind, title, note, url, source, sourceItemId, createdAt, updatedAt }
QuickDraft   { id, text, channelIds, referenceId, status, createdAt, updatedAt, lastError }
FeedItem     { id, feedId, title, summary, url, publishedAt, fetchedAt }
FeedState    { feedId, etag, lastModified, lastSuccessAt, lastError }
```

Use a canonical source item ID or normalized URL to make Save idempotent. Do not
silently queue Buffer writes for automatic replay: duplicate social posts are a
high-cost failure. An offline Buffer action becomes a local draft with a visible
**Retry send** button.

Device-local Notebook data is acceptable for the first beta only if onboarding
and settings say so plainly. Cross-device sync is a separate milestone requiring
authenticated server storage, conflict behavior, deletion semantics, export,
and privacy review; local storage cannot make phone saves appear on desktop.

### 3. Harden and extend feeds conservatively

Keep feed fetching server-side. For v1, preserve the allow-listed feed IDs and
add response validation, response-size caps, conditional fetch support, a
bounded timeout, normalized stable IDs, and useful 4xx/5xx errors. Do not return
invented “fallback posts” as though they were real articles; keep the last good
snapshot in the client and label it with its refresh time instead.

If custom feeds arrive later, defend against SSRF: allow only `https`, resolve
and reject loopback/private/link-local addresses on every redirect, cap redirect
count and body size, validate content type, rate-limit requests, and cache by a
server-controlled normalized URL.

### 4. Make the PWA honestly offline-capable

Upgrade the service worker with explicit strategies:

- cache-first for versioned local JS, CSS, icons, manifest, and fonts hosted by
  PostIQ
- network-first with cached fallback for navigations
- stale-while-revalidate for allow-listed feed responses or, preferably, persist
  normalized results in IndexedDB from the page
- network-only for OAuth, Netlify mutations, analytics, and Buffer operations
- an offline response for uncached routes rather than returning the app for every
  navigation indiscriminately

Precache every file needed by the active mobile shell, including scripts in
`js/`, styles, manifest, and icons. Use a cache version tied to releases, clean
only PostIQ-owned caches, and surface “Update available” before activating a new
worker while the user has an unsaved draft.

Add manifest shortcuts for **Save link** and **New post**. Add an app ID, scope,
maskable icons with verified safe zones, screenshots, categories, and a concise
mobile description. Confirm install behavior on iOS Safari and Android Chrome;
do not make install a prerequisite for use.

### 5. Preserve security and trust

- Keep Buffer writes behind the existing proxy/OAuth boundary and require an
  explicit final tap.
- Never store an OAuth token in new feed or Notebook records, logs, analytics,
  URLs, or service-worker caches.
- Sanitize all feed and notebook text and allow only safe external URL schemes.
- Track events such as `feed_refreshed`, `item_saved`, `capture_saved`,
  `draft_saved_local`, and `buffer_draft_sent`; never send post text, note text,
  URLs, or clipboard contents to analytics.
- Add export/delete controls before calling Notebook storage durable.

## Delivery plan

### Phase 0 — foundation and evidence (2–3 days)

- Record baseline mobile load, install, and core desktop regression results.
- Confirm which root assets are authoritative and update checks/documentation so
  CI exercises the code that `app.html` loads.
- Add mobile route/state conventions and a feature flag that can restore the
  coming-soon screen without a redeploy.
- Add structured product events without content payloads.

**Exit:** the existing app still passes tests and the gated mobile shell can be
enabled for internal users.

### Phase 1 — usable shell and capture (4–6 days)

- Replace seven mobile tabs with Inbox, Notebook, and Post.
- Implement safe-area layout, settings sheet, connection/offline indicators,
  and 44px touch targets.
- Introduce IndexedDB repositories and migrate existing Notebook cards.
- Ship link/note capture, Notebook list/detail, duplicate handling, delete undo,
  and local quick-draft autosave.

**Exit:** an installed app can launch offline, capture a link or note, restore a
draft, and preserve migrated Notebook data.

### Phase 2 — focused feed reader (3–5 days)

- Extract the two RSS sources from the desktop Trending panel into Inbox.
- Add normalized IDs, last-good snapshots, refresh/error states, read/saved
  states, and save-to-Notebook.
- Harden proxy limits and remove synthetic article fallbacks from the mobile
  contract.

**Exit:** feed content survives reload/offline use, never masquerades a fallback
prompt as news, and saving the same item twice does not duplicate it.

### Phase 3 — quick Buffer draft (4–6 days)

- Reuse the existing channel query and `createPost` mutation through a narrow
  composer service.
- Add channel selection, character count, local save, explicit Buffer-draft
  confirmation, retry-after-failure, and OAuth-return restoration.
- Keep queue/schedule hidden unless validation shows strong demand.

**Exit:** a connected user can turn a saved item into a Buffer draft; offline or
failed sends remain visibly local and cannot duplicate automatically.

### Phase 4 — install and release hardening (3–5 days)

- Complete manifest/service-worker behavior and update flow.
- Test iOS Safari/Home Screen and current/previous Android Chrome, plus keyboard,
  rotation, reduced motion, screen reader, slow network, offline, OAuth expiry,
  storage denial, and feed failure.
- Run a small opt-in beta, review funnel/error telemetry, then remove the mobile
  feature flag gradually.

**Exit:** no P0/P1 defects, desktop regressions, data loss, duplicate Buffer
posts, inaccessible blockers, or stale-release traps.

An experienced developer can deliver this beta in roughly **3–4 weeks**, with
design and QA support overlapping implementation. Cross-device Notebook sync is
not included in that estimate.

## Acceptance criteria

### Capture and Notebook

- A user can save a URL or text-only note in under 10 seconds.
- A saved feed item appears once, survives reload and offline relaunch, and can be
  deleted with a short undo window.
- Existing `postiq_notebook_v1` cards migrate without loss or duplicate import.
- The UI states clearly whether data is device-only.

### Inbox

- The last good feed snapshot is readable offline with its last-refresh time.
- Refresh failure leaves existing items in place and reports an actionable error.
- Feed text cannot inject markup and unsafe URLs are not actionable.
- Saved/read state is stable across refreshes because IDs are stable.

### Post

- Draft text autosaves during typing and survives reload and OAuth return.
- Buffer submission requires a selected channel and a deliberate confirmation.
- Success includes the destination and clears only the submitted local draft.
- Failure retains all content; retry is manual and protected against double taps.

### PWA quality

- Core shell launches in airplane mode after one successful online visit.
- No app control is obscured by safe areas, browser chrome, or the software
  keyboard at supported widths.
- Lighthouse is a useful guardrail (target ≥90 for Accessibility and Best
  Practices), but physical-device task completion is the release gate.
- Existing desktop flows and Buffer OAuth continue to work.

## Measures for the first 30 days

Use a simple, privacy-safe funnel:

1. mobile app opened
2. first feed refresh succeeded
3. first item/link/note saved
4. saved item opened in Post
5. local draft saved or Buffer draft sent successfully

Recommended outcome targets for beta—not vanity install counts:

- ≥70% successful feed refreshes among users who open Inbox
- ≥30% of weekly mobile users save at least one item
- ≥20% of savers start a post from a saved item
- ≥95% Buffer-draft success excluding expired/revoked OAuth sessions
- zero confirmed data-loss or duplicate-post incidents

Review median time to capture, send failure reason, offline launch failures, and
seven-day return rate. Only promote queue/schedule or new feeds after these core
flows are smooth.

## Decisions needed before implementation

1. Is device-local Notebook data acceptable for the mobile beta, or is
   cross-device sync a launch requirement? If sync is required, schedule that
   backend/product project before promising a seamless phone-to-desktop flow.
2. Should “quick post” mean a safe Buffer draft by default? This plan strongly
   recommends yes; direct queue/schedule actions add channel, timing, retry, and
   duplicate-post risk.
3. Are the two current RSS sources sufficient to validate the reader? This plan
   recommends starting there and using observed saves—not a large catalog—to
   choose the next sources.

## First implementation ticket

Create a feature-flagged mobile shell using the existing app entry point. Remove
the hard CSS gate only when the flag is on; show three inert but accessible tabs
(Inbox, Notebook, Post), the capture sheet, offline/connection state, and current
Notebook items through a repository adapter. Include 320/375/430px visual tests,
keyboard and safe-area checks, migration tests for malformed and valid legacy
Notebook data, and desktop navigation regression tests. This delivers the
architectural seam every later mobile feature needs without prematurely wiring
Buffer publishing.
