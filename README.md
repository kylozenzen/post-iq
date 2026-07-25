# PostIQ

PostIQ is a modular shelf of focused tools for Buffer users. People can enable
only the utilities they want while keeping one shared Buffer connection and
consistent app shell.

## Current tools

- Post Composer
- Thread Splitter
- Content Calendar
- Trending
- Snippets
- Approvals

Open **Tools & Settings → My Tools** to enable or hide utilities. Preferences
are stored locally in the browser under `postiq_enabled_tools_v1`.

## Local development

Use the Netlify CLI so the serverless functions are available:

```bash
npx netlify dev
```

The static pages can also be previewed with any local server, but Buffer,
approval, and Unsplash requests require the functions.

## Environment variables

Configure these in Netlify:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `UNSPLASH_ACCESS_KEY`

The Buffer token is supplied by each user. It passes transiently through the
Buffer proxy and is not persisted by the function.

## Validation

```bash
npm run check
```
