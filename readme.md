# PostIQ — Lightweight Buffer Companion

PostIQ is a free, no-login companion app for Buffer users who want a cleaner creation workflow.

It started as personal workflow tooling, then evolved into a public companion app so other creators can explore and use the same process for free.

PostIQ is intentionally focused on one connected flow:

1. **Compose** (draft faster)
2. **Split** (turn long-form into thread-ready parts)
3. **Repurpose** (pull recent LinkedIn source posts into the workflow)
4. **Publish** (send draft, queue, or scheduled posts to Buffer)

It does **not** try to replace Buffer. It sits beside Buffer and helps you move from idea to publish-ready copy with less friction.

---

## Product direction (current)

PostIQ has been condensed into stronger, connected workflows instead of a pile of disconnected tools.

- Composer, Splitter, and Repurpose now work as a unified writing pipeline.
- Calendar remains lightweight for visibility and planning notes.
- Legacy/extra surfaces were reduced so the core workflow stays fast and usable.

---

## No-login model

PostIQ does not require a PostIQ account.

- No sign-in
- No Firebase auth
- No Firestore user storage
- No server-side token storage

You can paste your Buffer token directly in the app and choose how to store it in the browser:

Get your token in Buffer settings: https://publish.buffer.com/settings/api

- **This session only** (`sessionStorage`)
- **Save on this device** (`localStorage`)

The token is only sent when making requests to the Netlify proxy, which forwards requests to Buffer's API.

---

## Features

## 🧵 Thread Splitter
- Paste long-form content
- Split into thread-sized chunks
- Edit each chunk
- Copy all chunks or save as a Buffer draft

## 📅 Content Calendar
- Load scheduled posts from Buffer
- View posts in monthly calendar layout
- Add planning notes per day from a day-note modal
- Apply color-coded note tags
- Send note content directly into Post Composer
- Notes are stored locally in browser storage

## ✍️ Post Composer
- Draft text-first posts with a lightweight formatting toolbar (bold, italic, bullet/numbered lists, clear formatting)
- Use **Word Help** (Datamuse-powered) directly inside Composer for quick wording assistance
- Save as Buffer draft
- Add to Buffer queue
- Schedule for a specific date/time

### 🧠 Word Help (Datamuse-powered)
Word Help lives in the **Composer** panel as a compact tool near the writing controls.

It is built to support writing *inside* the main workflow (not as a separate product area):

- **Related** suggestions (meaning-like terms)
- **Stronger** wording options (synonym-style alternatives)
- **Autocomplete** suggestions
- **Sounds like** suggestions (helpful for naming/phrasing checks)

Usage is intentionally lightweight:

1. Type or select a word/phrase in Composer
2. Open **Word Help**
3. Run a suggestion mode
4. Click a suggestion to replace the current selection (if present) and copy it

Word Help uses Datamuse endpoints:
- `https://api.datamuse.com/words`
- `https://api.datamuse.com/sug`

**Media workflow:**
If your post needs images or video, save it as a draft in PostIQ, then open Buffer to attach media and schedule or publish it there.

## 🔗 Shareable read-only month view
- Generate a no-login snapshot link for the current month
- Choose whether to include planning notes
- Shared view clearly shows read-only status and whether notes are included

### Snapshot limitation
Month sharing is snapshot-based, not live collaboration. Recipients view the captured month state from the generated link.

---

## Repo structure

```txt
postiq/
├── index.html
├── netlify.toml
├── netlify/
│   └── functions/
│       └── buffer-proxy.js
└── readme.md
```

---

## Local run

```bash
npm install -g netlify-cli
netlify dev
```

---

## Privacy notes

- PostIQ does not store Buffer tokens remotely
- Token storage is local to your browser (`sessionStorage` or `localStorage`)
- Notes are stored locally in browser storage
- The Netlify proxy forwards Buffer requests and responses

---

## License

Business Source License 1.1.
