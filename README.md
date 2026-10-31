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
Connect Buffer → Inspect coverage → Plan a gap → Send to Buffer
```

### 📅 Calendar
Month, week and agenda views of confirmed Buffer posts alongside date-only planning notes, to-do actions and Content Bank target dates (labelled “not scheduled”). With a connected, fresh queue, days are labelled scheduled, gap or non-posting day according to your rhythm. Share a read-only snapshot link without requiring a PostIQ account.

### Your Pace

Open Queue Health from Workspace (or the Calendar shortcut) to set a per-channel
posting rhythm, check period coverage, mark intentional days off, or plan a lighter
period. Your Pace uses confirmed scheduled posts and labels incomplete or stale
queue data. These local planning changes do not move, cancel, publish, or delete
Buffer posts.

### 🧭 Take a tour
The tour is PostIQ's onboarding. Five steps (calendar, planning context, Queue Health, Your Pace, Content Bank) open once on someone's first visit to the app, whether they preview first or sign in first, and can be restarted from **Take a tour** in the sidebar, Calendar header, or mobile More menu (or a link with `?tour=1`). It is skippable, closes on Escape or when you navigate elsewhere, never performs Buffer writes, and skips steps for disabled workspaces. Disconnected visitors are offered **Sign in with Buffer** on the last step. Once closed it is recorded as seen, and the `tour=1` flag is removed on load, so it does not reopen on refresh or after Buffer sign-in. Visitors from before the tour existed are not interrupted.

### 🎛️ Custom Workspaces
Turn the Calendar, Compose, Content Bank, and Approvals workspaces on or off from Customize settings so the sidebar matches your workflow. Choose from five themes: PostIQ, Classic, After Dark, Studio, and Evergreen. Workspace and theme preferences are saved locally in your browser.

### 🧠 Content Pillars
Define your repeatable content themes with seed ideas and tone angles. The Pillar Plan Builder walks you through 6 questions and generates a full pillar system — 5 content pillars, trust layer tags, seed ideas, hooks, and series starters. Hit Start on any seed to drop a post starter directly into Compose.

### ✍️ Compose
Focused writing workspace with local draft autosave, a distraction-free mode, rich text formatting, media attachment (URL, upload, or Unsplash), and searchable writing tools. Pull in Content Bank items, saved or proven hooks, hashtag sets, templates, pillars, and AI Assist without leaving the draft. Send to Buffer as a draft, queue it, or schedule it for a specific time. Nothing publishes until you choose a Buffer action.

### 💡 Content Bank
Three tools in one tab:
- **Saved content** — search existing references, source text, and independent channel versions. Identify undated items and plan local target dates separately from confirmed Buffer scheduling. Pin any card above your Compose editor as a writing reference.
- **Trending** — browse Reddit, Hacker News, and Product Hunt for timely ideas. Click any story to compose from it.
- **Templates** — save and reuse your best hooks, CTAs, announcements, and engagement questions.

### ✅ Approvals *(beta)*
Generate a shareable reviewer link for any Buffer draft. Your client reads the post, leaves feedback, and approves or requests changes — no PostIQ account needed. Publishing unlocks after approval.

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
js/features/             # Calendar, composer, media, templates, approvals, pillars
js/*.js                  # Standalone modules (AI Assist, Library, Pulse, onboarding)
manifest.json            # PWA manifest
sw.js                    # Service worker and app-shell cache manifest
netlify/functions/       # Buffer proxy, token exchange, approvals, trending, config
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
