# PostIQ application architecture

PostIQ is a static HTML/CSS/JavaScript application with Netlify Functions. It
does not require a frontend build step. `app.html` is the source of truth for
the active stylesheets and scripts, and loads them in dependency order.

## Active frontend layout

```text
app.html
├── css/app/                 shared tokens plus workspace-specific styles
├── css/onboarding.css       onboarding flow
├── js/core/                 state, utilities, navigation, bootstrap, startup
├── js/integrations/         Buffer OAuth, API access, and post creation
├── js/features/             product workspaces and feature behavior
│   └── approvals/           approval metadata, owner UI, reviewer UI
└── js/*.js                  independently maintained feature modules
```

The old root `app.js` and `app.css` bundles were split without changing their
source order. Each resulting JavaScript file remains a classic deferred script
and starts in strict mode. This preserves the current shared global bindings
while making ownership and future extraction clearer.

## JavaScript load order

1. `js/ai-assist.js`
2. `js/core/runtime.js`
3. Buffer auth and approval metadata
4. templates and Buffer connection/API services
5. calendar, composer, media, post creation, and approvals
6. navigation and bootstrap bindings
7. content pillars and startup
8. Discord, Library, Pulse, and onboarding modules

Do not alphabetize these tags. Earlier files provide bindings consumed by later
files, and `js/core/startup.js` registers the main `DOMContentLoaded` handler.

## CSS order

`css/app/tokens-layout.css` defines design tokens and the shell first. Component
and workspace styles follow, then responsive rules, polish/overrides, and the
Library and Pulse additions. The order in `app.html` matches the former bundle
exactly, so the cascade remains unchanged.

## Responsibilities

- `js/core/runtime.js`: constants, shared state, storage helpers, UI utilities,
  workspace preferences, feature configuration, and common error handling.
- `js/integrations/`: communication with Buffer and normalization of Buffer
  payloads.
- `js/features/`: behavior owned by a visible PostIQ workspace or feature.
- `js/core/bootstrap.js`: DOM wiring that still crosses multiple workspaces.
  New feature behavior should not be added here when it can live with its owner.
- `js/core/startup.js`: final startup registration only.

## Modular product behavior

The product-level modular foundation already exists. Planning, Create, Ideas,
and Approvals are user-configurable workspaces, and internal feature flags can
pause individual capabilities. Keep these concerns separate:

- Workspace preferences control what the user chooses to see.
- Feature flags control rollout and operational availability.
- Neither should delete browser-stored user data when disabled.

## Guardrails

Run `node scripts/check-project.js` after changing frontend assets. It verifies:

- every local JavaScript and CSS reference in `app.html` exists;
- every referenced JavaScript file parses;
- expected workspace views remain in the shell;
- the removed root bundles are not reintroduced; and
- active JavaScript/CSS files stay below 80 KB.

Focused regression tests live in `tests/`. When moving code again, update a test
to read the owning module instead of recreating a combined bundle.

## Next extraction seam

This organization pass intentionally preserves classic scripts and behavior.
Future passes can move one responsibility at a time behind explicit interfaces
or ES modules. Start with low-coupling areas such as templates or media, then
reduce the cross-workspace DOM wiring in `js/core/bootstrap.js`. Keep local
storage keys and Buffer payload contracts stable during those migrations.

The `assets/` tree is not loaded by the current `app.html`; it is retained as a
legacy modular prototype until it can be audited and removed in a dedicated
cleanup.
