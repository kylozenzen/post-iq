# PostIQ — A Smarter Planning Layer for Buffer

PostIQ is a free public beta companion workspace for Buffer users. It helps creators, marketers, and social teams plan their queue, compose posts, split threads, build content pillars, review content, and share clean snapshots before publishing.

PostIQ started as a set of internal workflow tools for my own social media work. When Buffer opened up its API, I connected those tools to Buffer and turned them into a public beta companion app for other creators and social teams.

PostIQ is independently built as a companion for Buffer users and is not officially affiliated with or endorsed by Buffer unless otherwise stated.

## Public beta note

PostIQ is in public beta. Some tools may change as Buffer’s API evolves. The goal of the beta is to keep the workflow practical, focused, and useful before content reaches Buffer.

## Core features

- **Sign in with Buffer** — connect a Buffer account through OAuth so PostIQ can load channels, show queue data, and send content when requested.
- **Plan / Calendar view** — review scheduled content, spot gaps, and add local planning notes.
- **Composer** — write posts in a focused workspace before saving, queueing, or scheduling through Buffer.
- **Split into thread** — break long copy into thread-sized parts and move from rough draft to Buffer-ready posts.
- **Ideas / Content Pillars** — organize strategy, recurring themes, and seed prompts before writing.
- **Templates / Snippets** — save reusable hooks, CTAs, post structures, and text snippets in the browser.
- **Snapshot sharing** — create clean read-only content plan links for review without requiring a login.
- **Approvals, if enabled** — share review links for sign-off workflows when the beta approval service is configured and enabled.
- **Feature flags for beta control** — pause optional beta tools without changing the public app shell.

## How PostIQ fits with Buffer

Buffer remains the publishing home. PostIQ is the planning and preparation layer around it:

```txt
Plan → Ideas → Compose → Review → Buffer
```

Use PostIQ to shape the content, check the calendar, split threads, organize reusable ideas, and share snapshots. Use Buffer to publish and manage the final queue.

## Tech stack

- Static HTML/CSS/JS
- Netlify
- Netlify Functions
- Buffer API / OAuth
- Browser `localStorage` / `sessionStorage` where applicable

Primary app files:

```txt
index.html                  # Public landing page
app.html                    # Main app UI shell
app.css                     # App styling
app.js                      # Product logic and browser state
privacy.html                # Public privacy policy
netlify.toml                # Netlify publish/functions config
netlify/functions/          # Serverless adapters and beta config
```

## Local development

PostIQ does not currently use a build step. It is a static app with Netlify Functions and can be served from the repository root.

Serve the static files locally:

```sh
npx serve .
```

Or run the site with Netlify Functions available:

```sh
netlify dev
```

## Environment variables

Feature flags and the public beta banner are exposed through the `netlify/functions/app-config.js` Netlify Function. For the public beta, use these Netlify environment variables when you want to override the defaults:

```env
POSTIQ_FEATURE_SNAPSHOTS=true
POSTIQ_FEATURE_APPROVALS=true
POSTIQ_FEATURE_TRENDING=true
POSTIQ_FEATURE_UPLOADS=false
POSTIQ_FEATURE_UNSPLASH=true
POSTIQ_BETA_MESSAGE="PostIQ is in public beta. Some tools may change as Buffer’s API evolves."
```

Approvals use Upstash Redis when the approval feature is enabled:

```env
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

The Buffer OAuth client is implemented as a public PKCE flow in the app. Do not add private OAuth client secrets to the browser.

## Deployment

PostIQ is deployed as a Netlify static site with Netlify Functions.

- **Publish directory:** `.`
- **Functions directory:** `netlify/functions`
- **Environment variables:** configure beta flags and optional approval service variables in Netlify.
- **After env var changes:** redeploy the site so Netlify Functions pick up the latest configuration.

The current Netlify config lives in `netlify.toml`.

## Known limitations

- Snapshot links are static.
- Anyone with a Snapshot link can view the included content.
- Some tools rely on Buffer API availability.
- Some beta features can be temporarily disabled.
- Browser storage is used for local planning, templates/snippets, and settings where applicable.
- OAuth token behavior should match the current implementation: tokens are handled by the browser-side Buffer OAuth flow and stored in browser storage according to the app’s current connection logic.

## Public links

- Open PostIQ: `/app.html`
- Sign in with Buffer: `/auth/connect.html?return=/app.html`
- Privacy Policy: `/privacy.html`
- Sitemap: `/sitemap.xml`
- Robots: `/robots.txt`
- Ben Campbell: `https://bencampbell.netlify.app`

## Beta QA and launch materials

- Public beta QA checklist: [`docs/public-beta-qa.md`](docs/public-beta-qa.md)
- Launch copy drafts: [`docs/launch-copy.md`](docs/launch-copy.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)
