# Server API routes

All server endpoints live under `src/routes/api/`. They read from the Leo Bus DynamoDB tables and S3 bucket using the credentials minted by the active `AuthProvider`.

## Auth + session

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/providers` | GET | Lists enabled OAuth providers for the signin page |
| `/api/auth/[...nextauth]` | GET / POST | `@auth/sveltekit` OAuth endpoints |
| `/api/aws-creds` | GET | Mints a fresh Cognito Identity Pool credentials object for client-side AWS SDK calls. See [../AUTH.md#aws-credentials-on-demand](../AUTH.md#aws-credentials-on-demand) |
| `/auth/client-auth`, `/auth/exchange` | (DSCO only) | DSCO `dw-auth-token` → LEO_AUTH → Cognito flow |

## Dashboard

| Route | Method | Purpose |
|---|---|---|
| `/api/dashboard/details` | GET | Metadata for a bot / queue / system: settings, history, checkpoint state |
| `/api/dashboard/settings` | PUT | Deep-merge save of bot/queue/system settings. Handles `other.tags`, `min_kinesis_number`, `icon`, health overrides, archive flag. |
| `/api/dashboard/schema` | GET / PUT | JSON schema for a queue (load / save) |

## Stats + workflow

| Route | Method | Purpose |
|---|---|---|
| `/api/workflow/stats` | GET / POST | Aggregated stats for a set of bots/queues over a time range. Server-side fan-out with `parallelLimit(25)`. |
| `/api/workflow/relationships` | GET | Upstream/downstream relationship graph for the tree view |

## Queue events

| Route | Method | Purpose |
|---|---|---|
| `/api/queue/event-search` | POST | Native Leo Bus search (reads from `fromLeo` stream). Supports JS filter functions, time frames, resumption-token pagination, S3 payload extraction. Replaces the legacy `searchQueue` Lambda. |

## Actions

| Route | Method | Purpose |
|---|---|---|
| `/api/cron/save` | POST | Combined endpoint for checkpoint change + force-run + force-run-really. `{ executeNow, executeNowClear, checkpoint: { queueId: value } }` — equivalent to old UI's `POST /cron/save` |
| `/api/resources` | GET | Low-level DynamoDB passthrough for cron/settings lookups |

## Server-only helpers

These aren't routes but are worth knowing about:

- **`$lib/server/utils.ts`** — `getSession(locals)` returns `{ user, aws_credentials }` or a `Response` on error. All API routes use this instead of touching `locals.user` directly.
- **`$lib/server/services/dynamoService.ts`** — thin wrappers around DynamoDB DocClient. Stateless: takes creds, returns data. `parallelQuery(queries, concurrency)` gracefully handles empty input.
- **`$lib/server/dashboard/api-utils.ts`** — fan-out helpers that batch DynamoDB reads with projection expressions. Shared by the `stats`, `details`, and `relationships` endpoints.
- **`$lib/server/cookies.ts`** — AES-GCM encrypted cookie serialization (`bu`, `das`, `did`). See [../AUTH.md#cookies](../AUTH.md#cookies).
- **`$lib/server/perf.ts`** — `PERF_TIMING=1` gated `start()` / `time()` / `log()` utility for server-side timing logs.
- **`$lib/server/rstreams.ts`** — direct Leo Bus stream reader (used by event search).

## Client types

Response shapes live in `src/lib/types.ts` (e.g. `StatsResponse`, `DashboardDetails`, `QueueEventSearchResult`). Keep these in sync when you change a server endpoint — they're the contract between `api-utils.ts` and the runes state classes.
