# PostIQ — Lightweight Buffer Companion

PostIQ is a no-login companion for Buffer users.

It helps text-first teams move faster with four focused workflows:
- Thread Splitter
- Post Composer
- Content Calendar
- Snippets

PostIQ is **not** a Buffer replacement. It helps you plan better, draft faster, and move reusable copy into Buffer-ready posts.

---

## No-login model

PostIQ does not require a PostIQ account.

- No sign-in
- No Firebase auth
- No Firestore user storage
- No server-side token storage

Paste your Buffer token into the app and choose where it is stored:

- **This session only** (`sessionStorage`)
- **Save on this device** (`localStorage`)

Get your token in Buffer settings: https://publish.buffer.com/settings/api

The token is only sent when making requests to the Netlify proxy, which forwards requests to Buffer's API.

---

## Features

## 🧵 Thread Splitter
- Paste long-form content
- Split into thread-sized chunks
- Edit each chunk
- Add opener/ending snippets
- Copy or send to Buffer draft/queue/schedule

## ✍️ Post Composer
- Draft text-first posts with lightweight formatting
- Insert snippets into drafts
- Save selected composer text as a snippet
- Save as draft, queue, or schedule in Buffer

## 📅 Content Calendar
- Load scheduled posts from Buffer
- View posts month-by-month
- Add color-tagged planning notes per day
- Send note text to Composer
- Generate read-only month snapshots

## 📚 Snippets
- Store reusable content blocks in localStorage
- Types: Hook, CTA, Hashtag Set, First Comment, Thread Opener
- Platform tags: Universal, LinkedIn, X, Threads, Instagram
- Search/filter snippets and reuse in Composer + Thread Splitter

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
- Snippets and calendar notes are stored locally in browser storage
- The Netlify proxy forwards Buffer requests/responses

---

## License

Business Source License 1.1.
