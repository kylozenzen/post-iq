# PostIQ — The Planning Layer for Buffer

Buffer just opened their API. PostIQ is the first companion app built on it.

PostIQ is a free public beta workspace for Buffer users. It gives your content workflow a planning layer to clean up your pre-content creation workflow — calendar planning, composing, thread splitting, content pillars, client approvals, and clean snapshot sharing. Buffer stays your publishing home. PostIQ is everything before the publish button.

→ **[Open PostIQ](https://postiq.netlify.app)**

---

## Why this exists

I've spent years running social media for brands — including growing a single account to 6M+ followers and 470M+ impressions. The one thing that never got easier was the planning layer.

Buffer is great at publishing. It was never built to answer "what should I post, and is my queue healthy this week?" That's the gap PostIQ fills. When Buffer opened their API, I connected the internal tools I'd been using into something other creators and teams can actually use.

It's independently built. Not affiliated with Buffer. Just someone who needed this badly enough to build it.

— Ben Campbell · [bencampbell.netlify.app](https://bencampbell.netlify.app)

---

## What it does

```
Ideas → Plan → Compose → Review → Buffer
```

### 📅 Plan
Monthly and weekly calendar views of your Buffer activity, combining recently published posts with the upcoming queue. Queue gaps surface automatically so you always know where the holes are. Add color-coded planning notes to any day — ideas, reminders, revision flags, campaign markers. Share a read-only snapshot link with your team or client without requiring a PostIQ account.

### 🎛️ Custom Workspaces
Turn the Planning, Create, Ideas, and Approvals hubs on or off from Customize settings so the sidebar matches your workflow. Choose from the original PostIQ look plus four distinct themes: After Dark, Editorial, Studio, and Evergreen. Workspace and theme preferences are saved locally in your browser.

### 🧠 Content Pillars
Define your repeatable content themes with seed ideas and tone angles. The Pillar Plan Builder walks you through 6 questions and generates a full pillar system — 5 content pillars, trust layer tags, seed ideas, hooks, and series starters. Hit Start on any seed to drop a post starter directly into Compose.

### ✍️ Compose
Focused writing workspace with local draft autosave, a distraction-free mode, rich text formatting, media attachment (URL, upload, or Unsplash), and searchable writing tools. Pull in Notebook cards, saved or proven hooks, hashtag sets, templates, pillars, and AI Assist without leaving the draft. Send to Buffer as a draft, queue it, or schedule it for a specific time. Nothing publishes until you choose a Buffer action.

### ✂️ Thread Splitter
Paste any long-form content. PostIQ splits it into 280-character thread parts. Edit each part, then queue the whole thread to Buffer natively.

### 💡 Ideas Library
Three tools in one tab:
- **Notebook** — save raw references, angles, and inspiration cards. Pin any card above your Compose editor as a writing reference.
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
Sign in with Buffer → Sync channels + queue → Plan → Compose → Send to Buffer
```

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
