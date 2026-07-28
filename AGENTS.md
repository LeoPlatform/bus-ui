# bus-ui AGENTS.md

## Overview

SvelteKit 2 + Svelte 5 webapp that monitors LEO Platform (serverless ETL). Deployed to AWS Lambda via SST v3 in four parallel instances: `botmonAlpha` (cup bus), `botmonAlphaChub` (chub bus), `botmonAlphaStreams` (stream bus), and `botmonAlphaPlayground` (ad-hoc training bus, test env only). All instances are the same codebase — the stage name (`test-cup`, `prod-stream`, etc.) controls which DynamoDB tables and S3 bucket are targeted.

## Tech Stack

- **Frontend**: SvelteKit 2.55, Svelte 5 runes (`$state`/`$derived`/`$effect`), TypeScript 5 strict
- **Styling**: Tailwind CSS 4.1, shadcn-svelte (bits-ui), Lucide icons (`@lucide/svelte`)
- **Charts**: Chart.js + LayerChart, D3.js (relationship tree SVG)
- **Auth**: `@auth/sveltekit` (OAuth mode) + custom DSCO/LOCAL providers
- **AWS**: SDK v3, Leo SDK 7.1.18, Cognito Identity Pool for client credential minting
- **Deploy**: SST v3 → Lambda (arm64, 1GB, 30s) + CloudFront + API Gateway v1

## Application version (SvelteKit Botmon)

**Source of truth:** `webapp/package.json` → `version` (semver **4.x.y**). That is the **new** Botmon (`webapp/`). The **repo root** `package.json` version (3.x) is the **legacy** webpack Botmon — bump it only when you change the old UI bundle, not for SvelteKit-only work.

**Agents must bump `webapp` version on every PR** that changes anything that ships in the deployed SvelteKit app (features, bug fixes, deploy-facing config, security patches). Do not merge behavior changes with an unchanged `webapp` version — it is how operators and support correlate builds to tickets.

1. `cd webapp`
2. Choose semver bump (default is patch):
   - **Patch** — fixes, small UX, internal refactors that deploy:  
     `npm version patch --no-git-tag-version`
   - **Minor** — new user-visible capability, backward-compatible API:  
     `npm version minor --no-git-tag-version`
   - **Major** — rare; breaking operator/auth/API contract:  
     `npm version major --no-git-tag-version`
3. Commit the updated `package.json` and `package-lock.json` in the **same PR** as the code (same commit or the next commit on that branch).

`--no-git-tag-version` skips creating a `git tag` locally (CI or release process may tag after merge).

## Architecture

All app code is under `webapp/src/`:

```
routes/
  (authed)/             # Auth-gated pages: catalog, dashboard/[...id], workflows
  api/                  # Server-only endpoints (dashboard, workflow, queue/event-search, cron)
  signin/ auth/         # Public auth pages + DSCO exchange endpoints
lib/
  client/
    components/features/  # Domain components: bot-table, search-bar, dashboard, bot-relationship-tree
    components/ui/        # Headless primitives (bits-ui based)
    appstate.svelte.ts    # Top-level state holder; passed via context as 'appState'
  server/
    auth/                 # Pluggable AuthProvider: local / oauth / dsco
    services/             # DynamoDB + S3 wrappers
    rstreams.ts           # Leo Bus stream reader
  types.ts               # Shared API response and domain types
```

**State pattern**: All reactive state lives in `.svelte.ts` class files using private `#field = $state(...)` with getters/setters. Classes are instantiated once and passed via Svelte context. Components read state via getters and mutate via setters or methods — never access `#private` fields directly.

**Routing**: LEO IDs contain slashes → use `[...id]` rest params (not `[id]`). Example: `/dashboard/bot:stream/1000041146/proc`.

**Auth modes** (controlled by env):
- `LOCAL=true` → mock user, use `default` AWS profile creds (day-to-day dev)
- OAuth → `@auth/sveltekit` with `providers.config.json`
- DSCO → prod stages; cannot test locally (CORS allowlist is `dsco.io` only)

## Build & Test

```bash
cd webapp
npm install
npm run dev         # Vite dev server (localhost:5173)
npm run check       # svelte-check type check
npm run lint        # ESLint
npm test            # Vitest
```

Setup: `cp providers.config.example.json providers.config.json` then `npm run create-env-test-cup` to generate `.env.local`.

## Key Patterns

### 1. Server API handler shape
```typescript
export const POST: RequestHandler = async ({locals, request}) => {
    const session = await getSession(locals);
    if (session instanceof Response) return session; // auth failed → redirect
    const body = await request.json();
    // ...
    return json(result);
};
```

### 2. Svelte 5 state class
```typescript
export class FooState {
    #value = $state<string>('');
    get value() { return this.#value; }
    set value(v: string) { this.#value = v; }
}
```

### 3. D3 + Lucide icons in SVG
Lucide icons embedded in D3 SVGs via `createLucideIconFromComponent`. Icons use `stroke: currentColor` — on light-background chips, explicitly set dark ink with `styleLucideOnLightChip(selection)` (in `bot-relationship-tree.svelte`) or the icon is invisible.

### 4. DynamoDB fan-out limit
All parallel DynamoDB reads use `parallelQuery(queries, { concurrency: 25 })`. Never use unbounded fan-out — 8000+ bot fleets will exhaust sockets.

### 5. Leo event search tokens
`/api/queue/event-search` reads the Leo Bus stream via `streams.fromLeo()`. Start tokens are either EID strings (trimmed via `trimEidToken`) or Z-tokens (built via `buildZTokenFromUtcMs`).

## Domain Context

- **Bot**: Lambda (or other process) registered with LEO; reads/writes event queues
- **Queue**: LEO event stream with DynamoDB checkpoint tracking
- **System**: External data source (DynamoDB, Postgres, API)
- **bus**: A full LEO deployment — independent DynamoDB tables (`LeoCron`, `LeoEvent`, `LeoStats`, etc.) and S3 bucket. Stage `test-cup` → cup bus, `prod-stream` → stream bus.

## Gotchas

- **`npm run check` needs `npx svelte-kit sync` first** if `.svelte-kit/` is absent; use `npx svelte-kit sync && npx svelte-check` if the script fails.
- **46 pre-existing TypeScript errors** exist in the codebase (unrelated to botmon fixes). Don't let them block CI.
- **API Gateway v1 strips base path**: `lambda-handler-v1.mjs` re-prepends `SVELTE_BASE_PATH` so SvelteKit routing works. Don't replace with the default SST handler.
- **CSS `transition: all` conflicts with D3 transitions**: Never apply `transition: all` to D3-managed SVG elements — use specific property transitions or let D3 own the animation.
- **`toLocaleTimeString` returns AM/PM**: Avoid using it to initialize time inputs; use explicit `padStart` zero-padding with `getHours()`/`getMinutes()`/`getSeconds()`.
- **`.env.local` is never committed**: Regenerate with `npm run create-env-*` after AWS secret rotation.
- **Auth secret in SSM**: `AUTH_SECRET` persists across deploys via SSM SecureString. Don't delete the parameter — it invalidates all user sessions.
