# External calendar feeds (ICS) — beta

PostIQ supports read-only subscriptions to calendar feeds published as ICS URLs.

## Add a calendar
1. Open **Calendar → ⋯ → Connect calendar feed (ICS)**.
2. Give the source a name and paste its published HTTPS ICS subscription URL.
3. Click **Add feed**. Read-only events appear on calendar dates and in the day drawer.
4. Use **Refresh feeds** to check for changes. Remove a feed from the same window.

Google Calendar, Outlook, Trello, and Asana URLs are supported if they point directly to an ICS file. Not every provider exposes ICS exports on every plan or workspace. A regular project URL or API key is not an ICS feed.

## Data and privacy
Secret ICS URLs grant access to potentially private calendar events. Treat them like passwords. PostIQ stores feed URLs and event previews in your current browser. The feed URL goes through a Netlify Function to retrieve events; the server permits only explicitly supported provider hosts and HTTPS, blocks redirects, limits download size, and does not intentionally log URLs. Do not enter API keys in the feed field.

Feeds refresh approximately hourly while PostIQ is open. Up to five subscriptions are supported; each fetch imports up to 400 events. Recurring events are not expanded: only explicitly dated events in a feed are displayed. Time-of-day, cross-device synchronization, bidirectional updates, attachments and project task creation are not included. Imported events never alter the Buffer queue.

## Troubleshooting
- **Unsupported feed host**: the allowlist intentionally excludes arbitrary URLs, including custom/private servers.
- **Provider returns 403/404**: verify the link is an ICS subscription URL, not a calendar webpage.
- **Events missing**: recurring events may need the provider to expand occurrences; large feeds may be truncated.
- **Old data**: click Refresh feeds. Browsers only refresh while the app is open.
