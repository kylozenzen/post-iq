# Quality-of-life pass — October 31, 2026

Reviewed main at `719581ed0fea64d8079761818235d82add2c077f`.

## Changes

- Settings uses one scrolling body, a fixed header and wrapping sticky tabs. The dialog is wider on desktop and fits short phone screens.
- Settings receives keyboard focus when opened, traps Tab, closes with Escape, and restores focus to its opener.
- Customize explains automatic browser-local saving; channel posting-day controls have consistent rows and accessible labels. Manual API-key storage controls reflect the saved mode.
- Sign out is available in the desktop connection card, mobile More menu and Settings → Connection. It clears OAuth credentials, manual Buffer keys in both storage types, authorization-transaction remnants and synced Buffer data. Local notes, drafts, Content Bank and preferences remain. Optional Gemini/Discord settings remain. Buffer.com sign-in and existing scheduled posts are unaffected.
- OAuth callbacks already saved credentials persistently. This pass migrates older session-only OAuth grants without replacing a newer persistent grant. Manually chosen session-only API keys retain that behavior.
- Parallel refreshes share a request. Rate limits, timeouts, server failures and incomplete successful token responses preserve credentials for retry. Sign-out invalidates pending refresh and API responses, preventing late results from restoring access or cached data. Duplicate sync clicks are ignored while syncing. Signing out also updates other open tabs and invalidates their pending refreshes.
- Help has searchable guides, current Sync now labels, a settings/sign-out guide and explicit storage/persistence explanations. Service-worker cache revision bumped.
- Restored missing AI unlock-status labels and corrected a stale test requiring a removed duplicate AI settings panel.

## Validation

Passed `node scripts/check-project.js`, all 80 tests with `node --test tests/*.test.js`, and `git diff --check`.
Session lifecycle tests exercise legacy-grant migration, refresh deduplication/rotation, transient errors, revoked grants and sign-out during refresh. UI tests cover settings focus/Escape and help search.

Browser QA uses the current static app at desktop, phone (390px) and tablet (768px) widths. External Buffer OAuth, live API behavior and Netlify deployment require deployed-environment verification; no live publishing was performed.
