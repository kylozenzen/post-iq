# PostIQ brand kit

Everything you need to show PostIQ somewhere else. The app and landing page don't load anything from this folder. The live icons are generated from these files into `images/`.

<img src="logo/postiq-wordmark.png" alt="PostIQ Beta wordmark" width="320">

## Name and lines

| | |
|---|---|
| Name | **PostIQ** (capital P, I, Q; one word) |
| Tagline | **Buffer publishes. PostIQ plans.** |
| One-liner | The calm calendar that sits beside your Buffer queue. |
| Short pitch | See how far ahead you are, fill the gaps, send to Buffer. |

**Always say:**
- "PostIQ is free during public beta." Never just "free", so nobody assumes Buffer is free.
- "Independent, not endorsed by Buffer." Not "not affiliated": there is a partner link.
- "Built on Buffer's public API."

**Avoid:** claiming Google Calendar sync (it's a one-way .ics export) or Zen mode (not shipped).

## Logo

| File | Use |
|---|---|
| `logo/postiq-mark.svg` | The mark: ink square, paper signal arcs, red dot. Favicons and app icons come from this one. |
| `logo/postiq-mark-paper.svg` | The mark on paper, for dark backgrounds or when the ink square feels heavy |
| `logo/postiq-mark-maskable.svg` | Full-bleed version with the mark inside the safe zone, for Android and iOS home screens |
| `logo/postiq-wordmark.svg` | Mark + "PostIQ" + Beta chip. Text uses Lato and DM Mono, so use the PNG anywhere those fonts aren't installed. |
| `logo/*.png` | 1024px exports of the mark, and the wordmark |

Keep clear space around the mark of at least its dot's diameter. Don't recolor the arcs or the dot.

## Color

| Token | Hex | Role |
|---|---|---|
| Paper | `#f2efe6` | Page background |
| Surface | `#fffdf7` | Cards |
| Ink | `#171713` | Text, the mark, rules |
| Muted | `#696356` | Secondary text |
| Border | `#ded7c7` | Card edges, grid lines |
| **Red** | `#b52c20` | The one accent: brand, the open-slot dot, emphasis |
| Red, pressed | `#8f1d13` | Hover and pressed red |
| Green | `#3f7350` | Covered, done |
| Amber | `#9a6212` | Open slots (dashed) |
| Indigo | `#6366f1` | Newsletter bands |
| Violet | `#a855f7` | Campaign bands |

Red is used sparingly: one red thing per view is the rule of thumb.

## Type

| Role | Face | Notes |
|---|---|---|
| Display | **Georgia** (bold, italic for the red echo) | "Buffer publishes. *PostIQ plans.*" Use Gelasio where Georgia isn't available; it shares its metrics. |
| Body and UI | **Lato** 400/700 | |
| Labels, dates, data | **DM Mono** 400/500 | Uppercase with wide tracking for eyebrows |

## Social

| File | Size | For |
|---|---|---|
| `social/postiq-og-1200x630.png` | 1200×630 | Link previews (same as `/postiq-og.png`) |
| `social/commit-stats-1080x1350.png` | 1080×1350 | LinkedIn feed: Buffer Commit by the numbers |
| `social/commit-stats-1080x1080.png` | 1080×1080 | Threads, Instagram |
| `social/commit-linkedin.md` | | Post drafts that go with the graphics |

Product screenshots live in `/images/product/` and are regenerated from the real app (sample data) with `scripts/capture-landing-screenshots.js`.

## Motion

See [`motion/`](motion/).

## Regenerating icons

The PNG icons in `/images/` are rendered from `logo/postiq-mark.svg` (any purpose) and `logo/postiq-mark-maskable.svg` (apple-touch and maskable). If the mark changes, re-render 16, 32, 192 and 512 from the first, and 180 and maskable 512 from the second, then bump the cache name in `sw.js`.
