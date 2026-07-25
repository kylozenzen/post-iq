# PostIQ modular architecture

## What changed in this pass

The original single-file prototype mixed 2,900+ lines of CSS, application
logic, tool-specific logic, and markup in `app.html`. It has been separated
into:

- `app.html`: app shell, views, and dialogs
- `assets/css/app.css`: existing application styles
- `assets/css/tool-manager.css`: tool shelf preferences
- `assets/js/app.js`: shared state and current feature behavior
- `assets/js/tool-registry.js`: tool metadata, preferences, and availability
- `assets/js/tools/trending-view.js`: the first extracted tool view
- `netlify/functions/*`: Buffer, approval, and image-search boundaries

The user-facing tool registry is the migration seam. A tool is identified by a
stable `id` and `viewId`; navigation, views, and guide content are all filtered
from that single definition.

## Next code-splitting target

The next pass should move one tool at a time from `assets/js/app.js` into a
module with this shape:

```js
export default {
  id: 'snippets',
  viewId: 'snippetsView',
  async mount(context) {},
  async activate(context) {},
  async deactivate(context) {},
  destroy() {}
};
```

`context` should expose only stable shared services:

- `buffer.query(document, variables)`
- `storage.get/set/remove`
- `ui.toast/openModal/activateView`
- `events.on/emit`
- read-only channel and organization state

That keeps a new mini-tool from reaching into every global variable in the
app. Disabled modules can then be loaded with dynamic `import()` only when a
user enables or opens them.

## Recommended extraction order

1. Snippets — local-only and low risk.
2. Trending — already has a separate view builder and limited shared state.
3. Calendar — mostly reads shared scheduled-post state.
4. Approvals — define a dedicated approval store before extraction.
5. Thread Splitter — share a small content-drafting service with Composer.
6. Composer — keep last because it currently owns the most cross-tool behavior.

## Product rules

- Default all existing tools to enabled so current users lose nothing.
- Require at least one enabled tool.
- Keep settings, Buffer connection, and account state in the shell.
- Give each new tool a direct URL such as `app.html?view=threadView`.
- Treat disabled as a preference, not deletion; local data remains intact.
- A tool must declare dependencies instead of silently assuming another view is
  enabled.

## Data migration

Keep existing local-storage keys stable during extraction:

- `postiq_buffer_token`
- `postiq_calendar_notes_v2`
- `postiq_snippets_v1`
- `postiq_approval_*`

Version new schemas and migrate on read. Do not clear stored content when a
tool is disabled.
