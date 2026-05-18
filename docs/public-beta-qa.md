# PostIQ Public Beta QA Checklist

Use this checklist before sharing PostIQ publicly. Mark each item after testing in a clean browser session and again in a connected Buffer session where possible.

## Landing page

- [ ] `index.html` loads.
- [ ] Hero CTA works.
- [ ] Sign in with Buffer goes to `/auth/connect.html?return=/app.html`.
- [ ] Explore/Open PostIQ goes to `/app.html`.
- [ ] Social share metadata exists.
- [ ] Homepage bio is not duplicated.
- [ ] Headshot loads.

## Auth

- [ ] Connect page loads.
- [ ] Buffer OAuth starts.
- [ ] Callback works.
- [ ] App shows connected state.
- [ ] Refresh behavior works.
- [ ] Disconnect works.

## App

- [ ] App loads signed out.
- [ ] App loads signed in.
- [ ] Global error banner does not appear on normal load.
- [ ] Feature flags do not crash the app.
- [ ] Disabled features show helpful messages.

## Settings

- [ ] Settings opens on desktop.
- [ ] Settings opens on mobile.
- [ ] All settings tabs have consistent sizing.
- [ ] About section loads.
- [ ] Portfolio link works.

## Calendar/Snapshot

- [ ] Calendar renders.
- [ ] Notes render.
- [ ] Month Snapshot works.
- [ ] Week Snapshot works.
- [ ] Empty Snapshot works.
- [ ] Invalid Snapshot hash shows friendly error.
- [ ] Copy link works.
- [ ] Shared link works on mobile.

## Composer

- [ ] Editor loads.
- [ ] Channel select handles no channels.
- [ ] Draft/queue/schedule buttons are disabled when not connected.
- [ ] Thread split works.
- [ ] Templates/snippets still work.

## Privacy/SEO

- [ ] `privacy.html` loads.
- [ ] `robots.txt` loads.
- [ ] `sitemap.xml` loads.
- [ ] App/auth pages noindex.
- [ ] Index page has OG/Twitter metadata.
