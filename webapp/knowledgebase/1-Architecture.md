# Architecture

Botmon is a web app that visualizes the LEO platform — a serverless ETL and microservices framework built on AWS. It shows the health and state of the bots, queues, and systems that make up a **bus** (a single deployment of the LEO infrastructure).

The webapp in this directory is a **SvelteKit 5** rewrite of the legacy React Botmon at `../old_ui/`. Both apps coexist today, each deployed independently; the SvelteKit version will replace the old one once it reaches feature parity.

## Domain model

| Term | Definition |
|---|---|
| **Bot** | A logical process registered with the LEO platform. Most are AWS Lambdas, but anything that writes checkpoints is a bot. |
| **Queue** | A stream of events processed by bots. LEO queues are backed by Kinesis + DynamoDB. |
| **System** | A data source outside LEO (DynamoDB table, Postgres DB, external API, etc.) that bots connect to. |
| **Event** | A single unit of data flowing through a queue or produced by a bot. |
| **Bus** | A whole deployment — all the bots, queues, and systems together. Backed by a fixed set of DynamoDB tables (`LeoCron`, `LeoEvent`, `LeoStream`, `LeoSystem`, `LeoStats`) and an S3 bucket (`LeoS3`). |

Every bus-ui deployment connects to exactly one bus. Stage names encode which: `test-cup`, `staging-chub`, `prod-stream`, etc.

Upstream: [LeoPlatform/Nodejs](https://github.com/LeoPlatform/Nodejs) (leo-sdk), [LeoPlatform/auth-sdk](https://github.com/LeoPlatform/auth-sdk) (leo-auth — used only by `old_ui/`).

## Stack

- **SvelteKit 2.55** + **Svelte 5 runes** throughout
- **TypeScript** (strict)
- **Tailwind 4** + shadcn-svelte components
- **TanStack Table** for virtualized/filterable data tables
- **LayerChart** for visualizations (sparklines, summary charts); Chart.js remains in a few places pending migration
- **Auth**: pluggable `AuthProvider` — wraps `@auth/sveltekit` for OSS, DSCO custom flow for deployed stages. Full details: [../AUTH.md](../AUTH.md)
- **Deploy**: SST v3 (Lambda + CloudFront + S3 via API Gateway v1). Full details: [../DEPLOYMENT.md](../DEPLOYMENT.md)
- **AWS SDK v3** for all DynamoDB / S3 / Cognito calls

## High-level request flow

```
Browser
  │
  │  GET /
  ▼
Lambda (SvelteKit SSR)
  │
  │  hooks.server.ts:
  │    1. Resolve auth (LOCAL / OAuth / DSCO) → populate locals.user
  │    2. Dynamic-fetch AWS creds on demand via /api/aws-creds
  │    3. Load route server data via +layout.server.ts / +page.server.ts
  │
  ▼
Layout/page server load → calls server-only helpers in $lib/server/
  │
  │  Reads from: LeoCron, LeoStats, LeoStream, LeoEvent, LeoSystem (DynamoDB)
  │              LeoS3 (S3)
  │
  ▼
Server returns HTML + hydration JSON
  │
  ▼
Client hydrates; subsequent navigation is client-side
  │
  │  Client state:
  │    - BotState (shared runes class; source of truth for bot data)
  │    - BotDetailState / StatsDetailState (per-dashboard page)
  │    - AppState (context; config, AWS region, user info)
  │    - shell-badge store (alarm count for nav)
  │
  │  On visible-node change or poll tick:
  │    - Client calls /api/workflow/stats, /api/dashboard/details, etc.
  │    - Server aggregates DynamoDB reads with parallelLimit + projection
  │    - Client merges into BotState cache, UI re-renders via $effect
  ▼
Done
```

## State model (client)

The webapp uses **Svelte 5 runes** (`$state`, `$derived`, `$effect`) exclusively for reactive state. All stateful classes live in `.svelte.ts` files.

| Class | Purpose | Location |
|---|---|---|
| `BotState` | Global bot/queue catalog + stats cache with stale-time tracking | `src/lib/client/state/bot-state.svelte.ts` |
| `BotDetailState` | Per-bot dashboard state (time range, checkpoint, force-run UI) | `src/lib/stores/bot-detail.state.svelte.ts` |
| `StatsDetailState` | Per-bot stats drill-down (buckets, chart data) | `src/lib/stores/stats-detail.state.svelte.ts` |
| `DashboardState` | Shared state between dashboard header + tabs (id, tab, isPaused) | `src/lib/client/state/dashboard.state.svelte.ts` |
| `SearchBar` state | Fuse.js index + filter state for catalog search | `src/lib/client/components/search-bar/search-bar.state.svelte.ts` |

**Key invariants:**

- `BotState` is the only client-side source of truth for bot data. Components read from it; they don't refetch on their own.
- Stats fetch is **visibility-gated** — `BotState.fetchBotStats(ids)` is called with only the bots currently visible in the viewport + any alarmed bots (for the nav badge). On 8000+ bot fleets, this cap is essential.
- Stale-time tracking (`#staleTime`, `#fetchedStats`) prevents re-fetches within a short window even if a component re-renders.
- Real-time vs. historical mode (`#refreshOnTime`) disables polling when the time range is in the past.

## State model (server)

Server-side has no persistent state — every request rebuilds from DynamoDB. Performance wins come from batching and caching per-request:

- **Projection expressions** on all scans reduce payload size (e.g. catalog scan 13MB → 4MB)
- **Parallel scan with 4 segments** cuts catalog scan from 4.4s → 1.5s
- **`parallelQuery` with `parallelLimit(25)`** for bounded concurrency (avoids socket exhaustion)
- **`dynamoService`** is stateless — it takes a credentials object and returns data; it does not mutate any stores

See `src/lib/server/services/dynamoService.ts` and `src/lib/server/dashboard/api-utils.ts`.

## Routing

```
src/routes/
├── +layout.svelte             # shell (left nav, top bar, alarm badge)
├── signin/                    # public sign-in page
├── auth/                      # DSCO-specific auth endpoints (client-auth, exchange, etc.)
├── api/
│   ├── aws-creds/             # mints Cognito creds on demand
│   ├── auth/providers/        # lists active OAuth providers for signin UI
│   ├── dashboard/             # {details, settings, schema}
│   ├── queue/event-search/    # native Leo Bus event search
│   ├── workflow/              # {stats, relationships}
│   ├── cron/save/             # checkpoint + force-run
│   └── resources/             # cron/settings DynamoDB passthrough
└── (authed)/                  # auth-gated routes (runs under same base layout)
    ├── +layout.server.ts      # gate — redirects to /signin if no locals.user
    ├── +page.svelte           # home catalog (BotTable + SearchBar)
    ├── dashboard/[...id]/     # bot/queue/system detail
    ├── workflows/             # relationship landing + tree
    └── trace/                 # stub (pending)
```

Note the `[...id]` rest parameter — LEO IDs contain slashes (e.g. `bot:stream/1000041146/sh-inv-20260610a/processor`), so standard `[id]` breaks routing.

## Performance principles

**The old botmon had several performance anti-patterns. We avoid all of them:**

- ❌ Fetch all bot/queue stats on every render → ✅ stale-time cache + visibility gating
- ❌ Re-mint Cognito creds on every SSR → ✅ mint on demand via `/api/aws-creds`; client caches until expiration
- ❌ Repeated DynamoDB queries for the same data → ✅ server-side aggregation in `api-utils.ts`, client `BotState` cache
- ❌ Fixed-interval polling regardless of tab visibility → ✅ real-time/historical mode awareness, visibility detection
- ❌ Unbounded DynamoDB fan-out → ✅ `parallelLimit(25)` everywhere

New code MUST respect these. See ES-2951's "Performance Principles" in the task file for the full rule set.

## Deploy topology

```
/botmonAlpha        → bus-ui Lambda for {env}-cup    stage
/botmonAlphaChub    → bus-ui Lambda for {env}-chub   stage
/botmonAlphaStreams → bus-ui Lambda for {env}-stream stage
```

Each stage is an independent CloudFormation stack. They share:

- DSCO apps custom domain (`test-apps.dsco.io` / `staging-apps.dsco.io` / `apps.dsco.io`)
- LEO_AUTH user table (one per env)

They do **not** share:

- The old Botmon CloudFormation stacks (read from, not modified)
- LeoStats / LeoCron / etc. — each env-bus has its own set

Full deploy details in [../DEPLOYMENT.md](../DEPLOYMENT.md).
