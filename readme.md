# PostIQ — Buffer Recycler & Thread Splitter

> Built by Ben Campbell - https://github.com/kylozenzen) · Licensed under [Business Source License 1.1](#license)

A free community tool for Buffer users. Surface your best evergreen posts, edit and re-queue them in seconds, and split long-form content into structured threads — all powered by your own Buffer API token. No accounts. No data stored. Nothing leaves your browser except direct calls to Buffer's API.

---

## Features

### ♻️ Post Recycler
- Pulls your last 100 sent posts from Buffer
- Ranks them by an **Evergreen Score** — a blend of post age, engagement rate, and content signals
- Gmail-style master/detail layout — click any post to open it in the edit pane
- Edit the copy, pick a channel, then **Add to queue** or **Schedule for later** in one click
- Animated confirmation when a post is sent — the card slides out so you can move to the next one

### 🧵 Thread Splitter
- Paste any long-form content — a LinkedIn post, blog intro, idea dump, anything
- Smart splitter breaks it into properly-sized parts (≤280 chars each) with sentence-boundary awareness
- Each part is labeled **Part X / Y** with a role badge: **Hook**, **Bridge**, or **CTA**
- Live tips panel flags weak hooks, missing CTAs, parts over the character limit, and short threads
- Edit each part inline, pick a channel, and queue or schedule the whole thread to Buffer in one go

---

## Getting Started

### 1. Deploy to Netlify

The fastest way — click the button and it's live in under a minute:

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/YOUR_USERNAME/postiq)

> **Replace `YOUR_USERNAME`** with your GitHub username before sharing this link.

Or deploy manually:
1. Fork this repo
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
3. Connect GitHub and select the `postiq` repo
4. Build settings are auto-detected from `netlify.toml` — no changes needed
5. Hit **Deploy site**

### 2. Get your Buffer Access Token

1. Go to [publish.buffer.com/app-password](https://publish.buffer.com/app-password)
2. Create a new app password or copy your existing access token
3. Paste it into PostIQ when prompted — stored in `sessionStorage` only, clears when you close the tab

### 3. Load your posts

Click **Load from Buffer** in the sidebar. PostIQ pulls your channels and last 100 sent posts and scores them instantly.

---

## Repo Structure

```
postiq/
├── index.html                    # The entire app — single file, no build step
├── netlify.toml                  # Tells Netlify where to find the function
├── netlify/
│   └── functions/
│       └── buffer-proxy.js       # Serverless proxy — forwards API calls to Buffer
└── README.md
```

**Why a proxy function?** Buffer's API blocks direct browser requests from third-party domains (CORS). The Netlify function acts as a passthrough — it receives your token from the browser, forwards it to Buffer's GraphQL API server-side, and returns the response. The token is never logged or stored.

---

## Running Locally

No build step needed. Serve with the Netlify CLI to get the function running too:

```bash
npm install -g netlify-cli
netlify dev
```

---

## Privacy & Security

- Your Buffer token is **never stored server-side**
- The proxy receives the token, forwards it to Buffer, returns the response — nothing else
- `sessionStorage` means your token clears when you close the tab
- No analytics, no tracking, no third-party scripts

---

## Roadmap

- [ ] Media re-attachment when recycling (drag-and-drop images/video)
- [ ] Multi-org support
- [ ] Engagement statistics in the post list (pending Buffer API support)
- [ ] Dark mode

---

## License

**Business Source License 1.1**

Copyright © 2025 Nobody Studios

This software is free to use for **personal and non-commercial purposes**. You may use, copy, modify, and distribute it for any non-commercial purpose.

**Commercial use** — including integrating this code into a paid product, SaaS, or commercial service — requires a separate written license from Nobody Studios.

For commercial licensing inquiries, open an issue or reach out directly.

On **January 1, 2029**, this software will automatically convert to the MIT License and become fully open source.

> Full license text: [Business Source License 1.1](https://mariadb.com/bsl11/)

---

## Contributing

Issues and PRs welcome. If you're a Buffer community member testing this — thank you. Bug reports, UX feedback, and feature ideas all go in [Issues](../../issues).

---

*Built by Ben · [Nobody Studios](https://github.com/nobodystudios) · San Antonio, TX*
