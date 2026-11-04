# External calendar feeds: security-first beta

## Supported today
Only Google Calendar **public** ICS subscription links are supported. This is a read-only planning layer. It does not use your Buffer account to access Google and cannot edit calendars or Buffer posts.

## Find and add a public calendar
1. In Google Calendar on desktop, choose **Settings → Settings for my calendars → [calendar] → Integrate calendar**.
2. For a calendar you intentionally made public, copy **Public address in iCal format**, ending in `/public/basic.ics`.
3. In PostIQ, open **Calendar → ⋯ → Connect calendar feed (ICS)**.
4. Name the feed, paste the public link, and choose **Add feed**.
5. Review your imported dates, refresh manually, or remove the feed.

**Never paste “Secret address in iCal format.”** The server and client reject recognizable secret Google Calendar links. Public calendars can expose event information to anyone on the internet; check Google's sharing permissions before publishing a calendar.

Outlook, Trello, Asana, and other provider links are **not supported in this beta**, even if they offer an ICS feed. Private calendars should eventually use authenticated OAuth or encrypted server-side credential storage tied to an authenticated user.

## What is stored
- The browser stores only up to five public feed URLs and their display names.
- Imported titles and dates are kept in memory while the app runs. They are refreshed on reload, not written to persistent browser storage.
- **Remove** deletes a feed URL and its current events. **Remove all calendar data** clears all subscriptions and cached event data on this browser.
- A previous preview version's local storage key is cleared automatically.
- Events are never sent to Buffer or used as scheduled-post confirmation.

## Server safeguards and deployment limits
The Netlify function supports only a strict public Google ICS path over HTTPS, blocks redirects, limits incoming and outgoing bytes, and times out network fetches. It checks browser same-origin metadata and uses a **best-effort in-instance** request throttle; these do **not** replace authentication or a durable edge/server-side rate limit.

**Before broad public rollout:** configure provider/edge-level rate limiting and test the live Netlify deployment. The function has no user authentication; a determined direct caller can spoof request metadata. Do not promise complete abuse prevention. Review privacy policy disclosures for calendar-event processing and retention in hosting logs.

## Known functional limits
- Read-only; no write-back, project tasks, or OAuth.
- Recurring events are not expanded unless the feed includes dated instances.
- Up to five feeds and 250 events per feed; up to 400 KB response size.
- Feeds refresh approximately hourly while the app is open.
- Public calendar event details can be visible to anyone on the internet independently of PostIQ.

## Troubleshooting
- **Secret URL rejected:** copy the Public address, never the Secret address.
- **403/404 from Google:** check that the calendar has been intentionally shared publicly and is available as an ICS feed.
- **Too many requests:** wait before refreshing. Automatic refreshes do not run while PostIQ is closed.
