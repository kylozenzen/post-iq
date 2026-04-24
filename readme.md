# PostIQ — Buffer Companion

PostIQ is a no-login planning, ideas, and drafting layer for Buffer users.

It helps creators, social media managers, and small teams see what’s scheduled, spot content gaps, organize reusable ideas, and turn those ideas into Buffer-ready drafts.

PostIQ keeps the product intentionally narrow:

1. **Plan** your scheduled queue in a calendar
2. **Organize ideas** with Content Pillars, Templates, and Trending
3. **Draft** posts or split long text into thread parts
4. **Approve** content through shareable approval links
5. **Send to Buffer** as drafts, queued posts, or scheduled posts without storing user tokens on a server

---

## Product Architecture

PostIQ is organized as a **single-page app with serverless API adapters**.

The app is designed around a simple workflow:

```txt
Plan → Ideas → Draft → Approve → Buffer
```

Buffer remains the publishing home. PostIQ is the planning and preparation layer around it.

---

## Core Product Areas

### 1. Plan

The Plan view gives users a calendar-based view of their scheduled Buffer queue.

It helps users:

* See scheduled posts by month
* Spot content gaps
* Add local planning notes
* Understand what is coming up before drafting more content

The calendar reads scheduled content from Buffer, while notes remain local to PostIQ.

---

### 2. Ideas

The Ideas Library groups PostIQ’s content strategy tools into one section.

Ideas currently includes three areas:

* **Content Pillars**
* **Templates**
* **Trending**

This keeps reusable strategy, post structures, and inspiration in one place instead of scattering them across separate sidebar tools.

#### Content Pillars

Content Pillars help users organize recurring content themes, buckets, and seed prompts.

Seed prompts live inside Content Pillars and are used to quickly start a draft from a reusable idea.

Example workflow:

```txt
Choose a pillar → pick a seed prompt → start a draft
```

#### Templates

Templates are reusable post structures saved locally in the browser.

Users can:

* Create templates
* Edit templates
* Copy templates
* Insert templates into the composer

Templates are useful for recurring formats like announcements, launches, educational posts, engagement prompts, and calls to action.

#### Trending

Trending provides lightweight inspiration and content prompts.

The goal is not to replace strategy, but to give users a place to find sparks when they need ideas.

---

### 3. Draft

The Draft view is where users turn ideas into Buffer-ready content.

It includes:

* Rich text composer
* Character count
* Channel selector
* Media attachment UI
* Draft/queue/schedule actions
* Thread splitting mode for longer text

Users can write from scratch, use a template, or start from a Content Pillar seed prompt.

Supported Buffer send modes include:

* Save as draft
* Add to queue
* Schedule for a specific date/time

---

### 4. Approve

The Approve workflow supports shareable approval links for content review.

Approvals are intentionally separated from Buffer publishing.

This allows content to be reviewed before it is sent to Buffer or finalized by the user.

Approval status can include:

* Pending
* Approved
* Changes requested

Approval records are stored through a serverless approval function backed by Upstash Redis.

---

## Front-End Architecture

Primary front-end files:

```txt
app.html      # Main product UI shell
app.css       # App styling and responsive behavior
app.js        # Product logic, state, Buffer calls, local persistence
index.html    # Public marketing / landing page
```

### `index.html`

The public landing page explains the product and routes users into the app.

It is separate from the main app experience.

### `app.html`

The app shell contains the main product views:

* Plan
* Ideas
* Draft
* Approve
* Settings / Help

### `app.css`

Contains styling for:

* App shell
* Sidebar navigation
* Mobile navigation
* Calendar
* Composer
* Ideas Library
* Templates
* Content Pillars
* Trending
* Approval UI
* Modals and utility components

### `app.js`

Handles:

* App state
* View switching
* Buffer token handling
* Buffer API calls
* Calendar rendering
* Composer behavior
* Content Pillars
* Templates
* Trending
* Approval metadata
* Local browser persistence
* Mobile interactions

---

## Repository Layout

```txt
post-iq/
├── app.html                    # Main app UI shell
├── app.css                     # Styling
├── app.js                      # Product logic, state, and API orchestration
├── index.html                  # Marketing / landing page
├── manifest.json               # PWA metadata
├── sw.js                       # Service worker
├── netlify.toml                # Netlify config
├── netlify/
│   └── functions/
│       ├── buffer-proxy.js     # Buffer API adapter
│       └── approval.js         # Approval workflow API
└── README.md
```

---

## Buffer API Strategy

PostIQ is designed to use the Buffer API carefully and intentionally.

The app avoids unnecessary API calls by:

* Fetching organization/channel data only when needed
* Caching stable data with TTLs
* Keeping scheduled post queries narrow
* Using manual sync instead of constant background polling
* Routing Buffer API calls through one proxy/helper path
* Avoiding unnecessary refetches after every UI action when possible

The goal is to support a useful planning workflow while respecting API limits and avoiding wasteful sync behavior.

Tiny API diet. Very professional.

---

## Buffer API Implementation

### 1. Token capture and storage

Users provide their own Buffer API token inside the app.

PostIQ supports two storage modes:

* **Session only** using `sessionStorage`
* **Persist on this device** using `localStorage`

The token is never stored by PostIQ’s serverless functions.

The token is only sent to PostIQ’s Buffer proxy when making a request to Buffer.

If auth-related errors indicate that a token is invalid or expired, the app clears the bad token state and prompts the user to reconnect.

---

### 2. Client API helper

All Buffer GraphQL calls go through a shared client helper in `app.js`.

That helper:

* Verifies a token exists
* Sends requests to `/.netlify/functions/buffer-proxy`
* Parses the proxy response
* Handles normalized errors
* Surfaces user-readable messages in the UI

This gives sync, channel loading, and post creation one consistent API path.

---

### 3. Netlify Buffer proxy

The Buffer proxy lives at:

```txt
/.netlify/functions/buffer-proxy
```

It accepts:

* Buffer token
* GraphQL query
* Optional GraphQL variables

The proxy then forwards the request to Buffer using the proper authorization header.

The proxy does **not** persist Buffer tokens.

It normalizes common failure modes, including:

* Missing token
* Invalid request body
* Auth errors
* Rate limits
* Buffer server errors
* Non-JSON upstream responses
* Network-level proxy failures

Rate-limit responses preserve retry information when available.

---

### 4. Data loading pipeline

When the user clicks **Load from Buffer**, the app follows a staged sync flow:

```txt
syncBuffer()
  → resolve organization ID
  → load channels
  → load scheduled posts
  → cache useful results
  → render calendar and dependent UI
```

The app currently uses a lightweight data model for scheduled posts.

Scheduled post sync requests only ask for the fields needed for planning, such as:

* Post ID
* Post text
* Due date
* Channel ID

This keeps the calendar useful without pulling unnecessary nested data.

---

### 5. Cache behavior

PostIQ uses local caching to reduce repeated API requests.

Typical cache strategy:

* Organization ID: longer-lived cache
* Channels: longer-lived cache
* Scheduled posts: shorter-lived cache

This allows stable data to stay available while keeping scheduled content reasonably fresh.

Users can manually reload from Buffer when they need current data.

---

### 6. Post creation pipeline

From the Draft view, users can send content to Buffer through a GraphQL mutation.

Supported actions include:

* Save as draft
* Add to queue
* Schedule for a specific date/time

The mutation response is checked for success or mutation-level errors.

The UI then shows clear success or error messages.

---

## What Lives in PostIQ vs Buffer

PostIQ uses a mix of local-only workflow data and Buffer-connected data.

### Local to PostIQ

These items live in the user’s browser or PostIQ’s approval service:

* Calendar notes
* Templates
* Content Pillars
* Seed prompts
* Approval metadata
* Cached Buffer sync data
* UI state

### Connected to Buffer

These items come from or are sent to Buffer:

* Organizations
* Channels
* Scheduled posts
* Draft post creation
* Queue post creation
* Scheduled post creation

PostIQ does not currently sync local Ideas Library data into Buffer’s Ideas area.

That may be explored later if it can be done in a way that is useful, clear, and API-efficient.

---

## Ideas Library Roadmap

The Ideas Library currently organizes existing content strategy tools:

* Content Pillars
* Templates
* Trending

Future possibilities may include:

* Saved Ideas
* Optional local-only idea storage
* Optional “Send to Buffer Ideas” behavior
* Better idea-to-draft workflows
* Repurposing tools
* Prompt collections by platform or content goal

Any Buffer Ideas integration should be evaluated against API usage, rate limits, and user clarity before implementation.

The guiding question:

```txt
Should this idea live locally in PostIQ, or should it become something inside Buffer?
```

---

## Approval Workflow Architecture

Approval links are intentionally separate from Buffer publishing.

The approval API lives at:

```txt
/.netlify/functions/approval
```

The approval function handles:

* Creating approval records
* Retrieving approval records
* Updating approval status
* Capturing comments or requested changes

Approval records are stored in Upstash Redis.

Redis credentials stay server-side in Netlify environment variables.

This allows PostIQ to support simple review workflows without needing users to create PostIQ accounts.

---

## Serverless Functions

### `buffer-proxy.js`

Purpose:

* Forward user-authorized Buffer GraphQL requests
* Normalize errors
* Avoid storing Buffer tokens server-side

Used by:

* Buffer sync
* Channel loading
* Scheduled post loading
* Post creation

### `approval.js`

Purpose:

* Create and manage approval links
* Store approval workflow state in Upstash Redis
* Keep approval records separate from Buffer publishing

Used by:

* Approval link creation
* Approval page retrieval
* Approval status updates

---

## Environment Variables

Required for approval workflow:

```txt
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

No server-side Buffer token environment variable is required.

Buffer tokens are supplied by users in the browser and passed per request through the Buffer proxy.

---

## Local Development

Install Netlify CLI:

```bash
npm install -g netlify-cli
```

Run local development server:

```bash
netlify dev
```

This runs the static app and Netlify functions together for local testing.

---

## Privacy and Security Notes

* No PostIQ account is required.
* Buffer tokens are user-supplied.
* Buffer tokens can be stored for the current session or locally on the user’s device.
* Buffer tokens are not stored by Netlify functions.
* Approval records are stored separately in Upstash Redis.
* Redis credentials remain server-side.
* Local content strategy data may live in browser storage.

---

## Current Product Boundaries

PostIQ is not trying to replace Buffer.

PostIQ is designed to help users prepare better content before and around Buffer.

The current product boundary is:

```txt
PostIQ = planning, ideas, drafting, lightweight approvals
Buffer = publishing, scheduling, channel management
```

That boundary should stay clear as the product evolves.

---

## License

Business Source License 1.1
