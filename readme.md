# PostIQ — Cleaned Product Architecture (Buffer Companion)

PostIQ is a no-login planning and drafting layer for Buffer teams.
It keeps the product intentionally narrow:

1. **Plan** your scheduled queue in a calendar
2. **Draft** posts (or split long text into thread parts)
3. **Approve** content through shareable approval links
4. **Sync and publish** through Buffer (without storing user tokens on a server)

---

## Product Architecture (Cleaned)

PostIQ is organized as a **single-page app + serverless API adapters**.

### 1) Front-end shell (UI)
- `app.html` provides the main product UI, with workflow views:
  - `Plan` (calendar)
  - `Draft` (composer + split thread mode)
  - `Ideas`
  - `Approve`
- `app.css` contains all styling for the app shell and view components.
- `app.js` handles UI behavior, state, API calls, local persistence, and feature workflows.

### 2) Client state and local persistence
- In-memory state in `app.js` manages connected channels, scheduled posts, selected month/day, templates, and approval state.
- Browser storage is used for local-only persistence:
  - Buffer token (`sessionStorage` or `localStorage`)
  - calendar notes
  - templates
  - approval metadata
  - cached Buffer sync payloads

### 3) Serverless function layer (Netlify)
Two function endpoints isolate sensitive operations:

- `/.netlify/functions/buffer-proxy`
  - Accepts a Buffer token + GraphQL query from the client
  - Forwards request to Buffer API
  - Normalizes error shapes and retry hints
  - Does **not** persist tokens

- `/.netlify/functions/approval`
  - Handles approval link creation / retrieval / updates
  - Stores approval records in Upstash Redis
  - Keeps Redis credentials server-side only

### 4) External integrations
- **Buffer API** (GraphQL endpoint via proxy)
- **Upstash Redis** (approval workflow state)
- Optional discovery/media helpers in client experience (e.g., Unsplash lookup)

---

## Repository Layout

```txt
post-iq/
├── app.html                    # Main app UI shell
├── app.css                     # Styling
├── app.js                      # Product logic, state, and API orchestration
├── index.html                  # Marketing/landing page
├── manifest.json               # PWA metadata
├── sw.js                       # Service worker
├── netlify.toml                # Netlify build + headers config
├── netlify/
│   └── functions/
│       ├── buffer-proxy.js     # Buffer API adapter
│       └── approval.js         # Approval workflow API
└── readme.md
```

---

## Buffer API Implementation Across the App

This section documents the end-to-end Buffer flow in the cleaned architecture.

### A) Token capture and storage model
1. User pastes a Buffer API token in the app.
2. User chooses storage mode:
   - **Session only** (`sessionStorage`)
   - **Persist on this device** (`localStorage`)
3. The token is never sent anywhere except requests to PostIQ’s Netlify Buffer proxy.
4. Token is removed on explicit clear, and also cleared when auth-related proxy errors indicate invalid/expired credentials.

### B) Client API entry point: `callBuffer(...)`
All Buffer GraphQL requests in `app.js` go through a single helper:

- Verifies token exists before call
- `POST`s to `/.netlify/functions/buffer-proxy`
- Parses normalized proxy response
- Throws structured errors (`code`, `status`, `retryable`, `retryAfter`) for consistent UX

This gives every feature (sync, channel load, create post) one contract for Buffer calls.

### C) Server adapter: `buffer-proxy.js`
The proxy performs these steps:

1. Validates request body (`token`, `query`, optional `variables`)
2. Calls Buffer with `Authorization: Bearer <token>`
3. Returns raw successful GraphQL JSON payloads
4. Normalizes failure modes into app-friendly error payloads:
   - missing token
   - auth errors (401/403)
   - rate limiting (429 + optional `retry-after`)
   - upstream server errors
   - non-JSON upstream responses
   - network-level proxy failures

This isolates upstream API quirks from the UI layer.

### D) Data loading pipeline in app
When user clicks **Load from Buffer**:

1. `syncBuffer()` starts sync state
2. App resolves organization ID
3. App loads channels for that organization
4. App pages through scheduled posts
5. Results are cached with TTLs to reduce repeated requests
6. Calendar and dependent UI sections re-render from normalized state

### E) Post publishing pipeline in app
From Draft view, submitting content to Buffer uses a GraphQL `createPost` mutation through the same `callBuffer` + proxy path.

Modes supported by payload construction:
- save as draft
- queue next
- schedule at specific date/time

The mutation response is checked for success vs `MutationError`, and the UI shows actionable toasts/status messages.

### F) Error and resilience design
PostIQ maps structured errors to user-readable messages and behavior:

- missing token → prompt user to connect token
- auth failures → ask user to reconnect token; clear bad token state
- rate limit → show retry guidance (honoring retry-after when provided)
- transient network/proxy issues → retryable messaging

This ensures graceful degradation without exposing raw upstream failures.

---

## Approval API (Non-Buffer) in Architecture

Approval links are intentionally separated from Buffer publishing:

- Client calls `/.netlify/functions/approval` with actions (`create`, `get`, `update`)
- Function persists approval records in Upstash with TTL
- Shared approval URLs resolve via UUID
- Comments and status transitions (`pending`, `approved`, `changes_requested`) are tracked in Redis record state

---

## Local Development

```bash
npm install -g netlify-cli
netlify dev
```

This runs the static app and Netlify functions together for full workflow testing.

---

## Environment Variables (Netlify)

Required for approval workflow:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

No server-side Buffer token environment variable is required; user token is supplied per request from client to proxy.

---

## Privacy & Security Notes

- No PostIQ login is required.
- Buffer token storage is local to the user’s browser unless user clears it.
- Buffer token is not persisted by serverless functions.
- Redis credentials for approvals remain server-side in Netlify environment variables.

---

## License

Business Source License 1.1.
