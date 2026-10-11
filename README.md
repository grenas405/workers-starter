# Workers Starter

A production-minded Cloudflare Workers app built on web standards. The app is a single
`(Request) => Promise<Response>` function with zero runtime dependencies, so the core
runs anywhere: Workers, Deno, Bun, or Node.

## Layout

```
src/
  index.ts                 Workers entry — the ONLY file that wires Cloudflare in
  app.ts                   createApp(deps): middleware stack + routes
  types.ts                 Handler, Middleware, Ctx, Deps
  http.ts                  HttpError, json(), compose(), readJson() with byte limit
  router.ts                Tiny router with :params, 404 and 405 handling
  middleware.ts            request id, logging, security headers, errors, CSRF
  config.ts                Validates env vars once at startup
  log.ts                   JSON-line logger (indexed by Workers Logs)
  ports/notes-store.ts     Storage interface the app depends on
  adapters/
    d1-notes-store.ts      D1 implementation (Cloudflare-specific)
    memory-notes-store.ts  In-memory implementation for tests
  routes/notes.ts          Example CRUD API with validation
public/                    Static files served from the edge (+ _headers)
migrations/                D1 SQL migrations
test/                      Tests call the app directly — no server needed
```

Middleware order (outermost first): request id → logging → security headers → errors → CSRF → router.

## Getting started

```sh
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev                      # http://localhost:8787
```

## Deploying

```sh
npx wrangler login
npm run deploy    # creates the D1 database on first deploy, then applies migrations
```

The D1 database is found by `database_name`, so no `database_id` is needed in
`wrangler.jsonc`. With Cloudflare's Git integration (Workers Builds), set the
deploy command to `npm run deploy` so migrations run on every deploy.
Run `npm run cf-typegen` after config changes to regenerate types.

Set real secrets with `npx wrangler secret put NAME` (and in `.dev.vars` locally).
Never put secrets in `vars`.

## Checks

```sh
npm run check    # typecheck + tests + dry-run deploy
```

## Adding a feature

1. Define what you need from the outside world as an interface in `src/ports/`.
2. Implement it in `src/adapters/` (one for Workers, one in-memory for tests).
3. Add it to `Deps` in `types.ts` and wire it in `src/index.ts`.
4. Write routes in `src/routes/` against the interface, never the adapter.

## Moving off Workers

Write a new entry file and adapters. For example, on Deno:

```ts
import { createApp } from "./src/app.ts";
Deno.serve(createApp({ notes: new SqliteNotesStore(db), config: loadConfig(Deno.env.toObject()), log: consoleLogger }));
```

Nothing in `app.ts`, `routes/`, `middleware.ts`, or `router.ts` changes.

## Not included yet

- **Auth.** CSRF protection only covers browsers; add session or token auth before exposing writes.
- **Rate limiting.** Use Cloudflare's rate-limiting binding or WAF rules.
- **CORS.** Add a middleware if a different site's frontend calls this API.
