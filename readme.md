# PostIQ — Lightweight Buffer Companion

PostIQ is a no-login, lightweight companion for Buffer users.

It helps text-first teams move faster with four focused workflows:
- Thread Splitter
- Content Calendar
- Post Composer
- Shareable read-only month snapshots

PostIQ is **not** trying to replace Buffer. It is designed to help you plan better, draft faster, and send cleaner posts to Buffer.

---

## What changed in the public app

The public app no longer includes Post Recycler / Evergreen Library in the product surface.

The focus is now:
1. Splitting long text into thread-ready parts
2. Viewing scheduled Buffer posts in a monthly calendar
3. Drafting text-first posts and sending them to Buffer
4. Sharing read-only month planning snapshots

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
- Add planning notes per day
- Notes are stored locally in browser storage

## ✍️ Post Composer
- Draft text-first posts
- Save as Buffer draft
- Add to Buffer queue
- Schedule for a specific date/time

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
