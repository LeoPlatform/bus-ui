# Features

The SvelteKit webapp is an in-progress rewrite of the legacy React Botmon (`../old_ui/`). This document tracks **what's shipped** vs **what's still in the old UI**. For the always-current parity audit see the ES-2951 task file in the genie workspace.

## Out of scope (intentionally not ported)

- **Logs tab** — replaced by CloudWatch Insights / per-bot log links
- **Code editor tab** — retired
- **SDK page** — was never finished in the old UI

## Global shell

| Feature | Status |
|---|---|
| Left nav (Dashboard, Workflows, Catalog, Trace, Saved Searches) | ✅ |
| Top bar search (catalog-wide Fuse.js index) | ✅ |
| Alarm badge on nav icon | ✅ (currently on Workflows; old UI was on Dashboard) |
| Docs link | ❌ (placeholder) |
| Theme switcher | ❌ (dark-only for now; full design-token system in place for future reskin) |
| Mobile responsive | Partial — desktop-first |

## Home / catalog

The home page (`(authed)/+page.svelte`) shows a paginated, sortable, filterable table of all bots in the bus.

| Feature | Status |
|---|---|
| Virtualized bot table with TanStack | ✅ |
| Multi-column sort | ✅ |
| Fuse.js search with prefix matching on `id` + `name` | ✅ |
| Status filter chips (healthy / danger / paused / archived) | ✅ |
| Saved searches | ❌ (stub at `/saved_searches`) |

## Workflows

The workflows page (`/workflows`) lists bots and renders the upstream/downstream relationship tree for any selected bot/queue.

| Feature | Status |
|---|---|
| Relationship tree (semantic shapes, status colors) | ✅ |
| Time range control on tree | ✅ |
| Saved workflows popover | ❌ |

## Bot dashboard (`/dashboard/{botId}`)

| Tab | Status |
|---|---|
| Dashboard (metrics, charts, time range) | ✅ |
| Settings (health overrides, archive/unarchive) | ✅ |
| Code | Out of scope |
| Logs | Out of scope |
| **Checksum** (ChecksumBot variant) | ❌ (TBD if product needs it) |

Bot actions: ✅ checkpoint, ✅ force-run, ✅ force-run-really, ✅ change-checkpoint-and-force-run, ❌ create/duplicate bot, ❌ reset stream, ❌ manage access, ❌ delete (old UI emphasizes archive)

## Queue dashboard (`/dashboard/queue:{name}`)

| Tab | Status |
|---|---|
| Dashboard (sortable bot table per queue, sparklines, summary charts) | ✅ |
| Events (native Leo Bus search, AJV validation, diff view, time-range pagination) | ✅ |
| Settings (name, tags, min_kinesis_number, archive) | ✅ |
| Schema (JSON schema load/save) | ✅ |

Queue event actions: ✅ search (via native Leo Bus `fromLeo` reader), ❌ trace (disabled — old UI had event lineage), ❌ replay (stub)

## System dashboard (`/dashboard/system:{name}`)

| Tab | Status |
|---|---|
| Settings (label, icon URL, system type) | ✅ |
| **Dashboard** | ❌ — big gap |
| **Events** | ❌ |
| **Checksum** | ❌ |
| **Cron** | ❌ |
| **Webhooks** | ❌ |

The system node has the same shape as a queue in the old UI; most of these tabs are near-copies of the queue equivalents.

## Data layer

| Feature | Status |
|---|---|
| Stats aggregation (bots, queues, systems — real-time + historical) | ✅ |
| Alarm detection (source lag, health overrides, pause state) | ✅ |
| `LeoStats` read with `bot:` / `queue:` / `system:` prefix handling | ✅ |
| Checkpoint lookup + save | ✅ |
| AWS creds on demand (`/api/aws-creds`) | ✅ |

## Trace

| Feature | Status |
|---|---|
| `/trace` page | ❌ (stub: `UnderConstruction`) |
| Event lineage visualization | ❌ |

## Infrastructure / operational

| Feature | Status |
|---|---|
| SST deploy to AWS (9 stages: test/staging/prod × cup/chub/stream) | ✅ |
| CloudFront + S3 static assets | ✅ |
| API Gateway v1 REST API | ✅ |
| On-demand CloudFront URL SSM caching | ✅ |
| DSCO auth integration | ✅ |
| Local dev with LOCAL=true mock auth | ✅ |
| Playwright E2E smoke tests | ❌ (nice-to-have) |

## Performance wins vs old UI

Already shipped:

- Projection-expression scans (catalog 13MB → 4MB)
- Parallel scan with 4 segments (4.4s → 1.5s)
- Batched `parallelQuery` at 25 concurrent
- Visibility-gated stats fetching (30 visible bots + alarmed-only polling on 8000+ bot fleets)
- On-demand AWS cred minting (not on every SSR)
- Stale-time cache on `BotState`
- Non-blocking layout load with skeleton table
- SSR disabled for authed pages (avoids double-fetch on hydration)

See [1-Architecture.md](./1-Architecture.md#performance-principles) for the full rule set.
