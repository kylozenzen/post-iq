# PostIQ — Your Buffer calendar, with room to think

PostIQ is an independent calendar companion for Buffer users, free during public beta. It puts scheduled Buffer posts beside planning notes and actions, flags queue gaps against the posting rhythm you choose, turns saved content into a dated plan, and shows coverage before you take time away. Buffer stays your publishing home.

Connected features (scheduled posts, Queue Health coverage, sending to Buffer) require Buffer sign-in. The calendar preview works without an account and keeps notes, Content Bank items and drafts in your browser.

→ **[Open PostIQ](https://postiq.netlify.app)**

---

## Why this exists

I've spent years running social media for brands — including growing a single account to 6M+ followers and 470M+ impressions. The one thing that never got easier was the planning layer.

Buffer is great at publishing. I wanted a calmer place to answer "is my queue covered this week, and what's missing?" When Buffer opened their API, I connected the internal tools I'd been using into something other creators and teams can actually use.

It's independently built. Not affiliated with Buffer. Just someone who needed this badly enough to build it.

— Ben Campbell · [bencampbell.netlify.app](https://bencampbell.netlify.app)

---

## What it does

```
See your runway on the calendar → write in Compose → send to Buffer
```

The calendar is the home base and Compose is where you write. Everything else supports that loop.

### 📅 Calendar — the home base
Month, week and agenda views of confirmed Buffer posts alongside date-only planning notes and to-do actions. Once you set a posting schedule, the top of the calendar shows your **content runway** per channel — "Covered for 20 days — new content needed by Nov 21", counting non-posting days — plus a calm connection/health line that tells you when you're well ahead and a break is fine. Share a read-only snapshot link without a PostIQ account.

### 🗓️ External calendar feeds (beta)
From Calendar → ⋯ → **Connect calendar feed (ICS)**, subscribe to a supported Google Calendar, Outlook, Trello, or Asana ICS feed. Events appear as a distinct read-only layer alongside Buffer posts and PostIQ plans. Feeds stay on this browser and refresh when the app is open; no OAuth or API keys are required for this first version.

**Privacy and limits:** Secret ICS URLs are effectively credentials. Feed URLs and event previews are stored in this browser; URLs are fetched through a Netlify Function restricted to known calendar-provider hosts. No arbitrary URL fetching or redirects are allowed. The importer caps feeds and events, and does not expand recurring events. You cannot modify outside calendars or schedule Buffer posts through imported events.

### ⏱️ Posting schedule
A focused modal (open it from the Calendar) where you set, per channel, which days you post and how many times — that powers the runway. Mark **time off** so a planned break doesn't show as a gap, and turn on **evergreen reshares** to keep your streak alive: PostIQ can queue your starred evergreen posts into Buffer across the days you're away. These are local planning choices; your Buffer posts never change.

### ✍️ Compose — the writing tool
Focused writing workspace with local draft autosave, distraction-free mode, rich text, media (URL, upload, or Unsplash), and searchable writing tools: saved hooks, hashtag sets, templates, **Trending** ideas (Reddit, Hacker News, Product Hunt, RSS — loaded only when you open the tab), and AI Assist, without leaving the draft. Send to Buffer as a draft, queue it, or schedule it. Nothing publishes until you choose.

### 💡 Content Bank
- **Saved content** — search references, source text, and independent channel versions; plan local target dates separately from Buffer scheduling; pin any card above your Compose editor.
- **Templates** — save and reuse your best hooks, CTAs, announcements, and engagement questions.

### 📚 Library
Your latest sent posts, for filling gaps fast. Star posts as **evergreen** to build a reuse pool; **Reshare** loads one back into Compose to send again, or **Rewrite** pins it as a reference for a fresh take.

### 🧭 Take a tour
PostIQ's onboarding — three steps (calendar & runway, posting schedule, Compose) that open once on a first visit and can be restarted from **Take a tour** in the sidebar, Calendar header, or mobile More menu (or `?tour=1`). Skippable, non-modal, never writes to Buffer.

### 🎛️ Customize
Turn the Content Bank workspace on or off so the sidebar matches your workflow (new accounts start with Calendar and Compose). Choose from five themes: PostIQ, Classic, After Dark, Studio, and Evergreen. Preferences are saved locally in your browser.

### 🔗 Snapshots
Turn any week or month of planned content into a static, shareable link. Recipients see a clean read-only calendar view with full post text. No login required.

---

## How it connects to Buffer

PostIQ uses Buffer's public API with OAuth (PKCE flow). When you sign in:

- PostIQ loads your channels, scheduled queue, and recent published posts
- You can create drafts, queue posts, or schedule content through Buffer
- Nothing publishes automatically — every Buffer action is your choice
- You can disconnect anytime from Settings → Connection

```
Sign in with Buffer → Sync channels + queue → Check coverage → Plan a gap → Send to Buffer
```

The landing page's primary CTA returns to `/app.html?view=calendarView` after sign-in; the secondary CTA opens the same calendar without signing in.

---

## Tech stack

| Layer | What |
|---|---|
| Frontend | Static HTML / CSS / JS — no build step |
| Functions | Netlify Functions (Node.js) |
| Auth | Buffer OAuth 2.0 with PKCE (public client) |
| Approvals | Upstash Redis (serverless) |
| Deployment | Netlify |
| Storage | Browser `localStorage` / `sessionStorage` |

Primary files:

```
index.html               # Public landing page
images/product/          # Real-app calendar screenshot (sample data) used for the share image
app.html                 # App shell and ordered asset entry points
css/app/                 # App styles grouped by workspace and responsibility
js/core/                 # Shared runtime, navigation, bootstrap, and startup
js/integrations/         # Buffer auth/API and post creation boundaries
js/features/             # Calendar, runway, posting schedule, composer, media, templates
js/*.js                  # Standalone modules (AI Assist, Library, trending wiring)
manifest.json            # PWA manifest
sw.js                    # Service worker and app-shell cache manifest
netlify/functions/       # Buffer proxy, token exchange, trending, config
```

---

## Running locally

No build step. Serve static files from the repo root.

```sh
# Static only (no Netlify Functions)
npx serve .

# Full stack including functions
netlify dev

# Verify local asset references, JavaScript syntax, and bundle size guardrails
node scripts/check-project.js

# Landing page links/accessibility/layout and the product tour (needs Chromium)
CHROMIUM_PATH=/path/to/chromium node scripts/check-landing-tour-browser.js

# Regenerate the share image (postiq-og.png) from the real app with sample data
CHROMIUM_PATH=/path/to/chromium node scripts/capture-landing-screenshots.js
```

---

## Environment variables

Set these in Netlify → Site configuration → Environment variables.

```env
# Approvals feature (required for approval links)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Feature flags (all default to true except uploads)
POSTIQ_FEATURE_SNAPSHOTS=true
POSTIQ_FEATURE_APPROVALS=true
POSTIQ_FEATURE_TRENDING=true
POSTIQ_FEATURE_UPLOADS=false
POSTIQ_FEATURE_UNSPLASH=true

# Beta banner message
POSTIQ_BETA_MESSAGE="PostIQ is in public beta. Some tools may change as Buffer's API evolves."
```

To pause the approvals feature cleanly (shows a user-facing notice instead of a 503):
```env
POSTIQ_FEATURE_APPROVALS=false
```

---

## Deployment

Netlify static site with Functions.

```toml
[build]
  publish = "."
  functions = "netlify/functions"
```

After changing environment variables, redeploy so Netlify Functions pick up the new config.

---

## Public beta notes

- Some features may change as Buffer's API evolves
- Snapshot links are static — anyone with the link can view included content
- Browser storage is used for local planning data, templates, and settings
- The OAuth client is public PKCE — no client secrets in the browser
- Media previews depend on available post data from Buffer

---

## Feedback

PostIQ is in public beta. If something feels off, broken, or missing:

- Use the thumbs-down flow inside the app
- Open an issue on this repo
- Or reach out directly at [bencampbell.netlify.app](https://bencampbell.netlify.app)

---

## Links

| | |
|---|---|
| App | [postiq.netlify.app/app.html](https://postiq.netlify.app/app.html) |
| Sign in | [postiq.netlify.app/auth/connect.html](https://postiq.netlify.app/auth/connect.html) |
| Help Center | [postiq.netlify.app/help/](https://postiq.netlify.app/help/) |
| Privacy | [postiq.netlify.app/privacy.html](https://postiq.netlify.app/privacy.html) |
| Portfolio | [bencampbell.netlify.app](https://bencampbell.netlify.app) |

---

*PostIQ is independently built and is not officially affiliated with or endorsed by Buffer.*
