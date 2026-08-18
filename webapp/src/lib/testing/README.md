# Botmon test infrastructure (ES-3461)

Committed, injectable test data for botmon UI states — the permanent replacement for the
throwaway "mock bus" harness that ES-3461 was originally verified with.

## What's here

- **`mock-bots.ts`** — framework-free fixture (no svelte/browser imports). Named preset
  factories, one per UI state:

  | Preset | Status | Needs stats? |
  |--------|--------|--------------|
  | `mockHealthy` | running | no |
  | `mockRogue` | rogue (errorCount 25) | no |
  | `mockRoguePaused` | rogue (rogue wins over paused) | no |
  | `mockPaused` | paused | no |
  | `mockArchivedRogue` | archived (archived wins over rogue) | no |
  | `mockBlocked` | blocked (current-window errors) | yes → `makeErrorStats` |
  | `mockDanger` | danger (source-lag alarm) | yes → `makeAlarmStats` |
  | `mockCheckpoint` | running, carries a real z-token | no |

  `MOCK_BOTS` is the home-catalog fixture (6 bots, matching
  `research/ES-3461/playground-verify/01-catalog.png`). `MOCK_STATS_BY_ID` / `mockStatsFor(id)`
  return stats only for the presets that need them — every other preset hits the no-stats path
  (`getStats → []`), which is the exact case the ES-3461 status fix addressed.

- **`story-appstate.svelte`** — supplies a no-op `appState` context so the name-cell component
  mounts inside Storybook.

## Where the fixture is used

1. **Node logic test** —
   `tests/lib/client/components/features/bot/bot-status.presets.test.ts` pins every preset
   against `evaluateBotStatus`, including a "no-stats path" block for the ES-3461 gap.
   Run: `npx vitest run tests/lib/client/components/features/bot/bot-status.presets.test.ts --environment node`
2. **Storybook state stories** —
   `src/lib/client/components/features/bot-table/bot-table-name-cell.stories.svelte` renders one
   story per preset and asserts the status ring in a `play` function (run as browser tests by the
   Storybook vitest project). Run: `npm test`.
3. **Whole-app dev without AWS** — `npm run dev:mock` (see below).

## Running the whole app without AWS

```
npm run dev:mock
```

This sets `MOCK_BUS=1` (plus dummy AWS/auth env vars) and starts `vite dev`. The single seam
`src/lib/server/services/bus-data.ts` then routes the DynamoDB-backed API calls to
`src/lib/server/services/mock/mock-dynamo-service.ts` instead of DynamoDB. The mock keeps an
in-memory store so settings/checkpoint saves read back immediately (ES-3461 issue 2).

**What mock mode does not cover.** The seam sits in front of `dynamoService` only, so the six
routes that read the cron/event/stats tables are mocked: `api/resources`, `api/cron/save`,
`api/dashboard/details`, `api/dashboard/settings`, `api/workflow/relationships`,
`api/workflow/stats`. Routes that bypass `dynamoService` still need real AWS: `api/eventTrace`
and `api/queue/event-search` read RStreams directly (event payloads, trace, queue search), and
`api/dashboard/schema` reads S3 through `schemaService`. Expect those pages to error under
`dev:mock`.

**The mock only works under `vite dev`.** `bus-data.ts` gates it on `dev` from
`$app/environment`, which is statically `false` in a production build, so the mock branch is
dead-code-eliminated and can never activate in a deployed build — regardless of `MOCK_BUS`.

## Adding a new state

1. Add a preset factory (and, if it needs stats to reach its status, a `MOCK_STATS_BY_ID`
   entry) in `mock-bots.ts`.
2. Add an assertion for it in `bot-status.presets.test.ts`.
3. Add a `<Story>` for it in `bot-table-name-cell.stories.svelte`.
4. If it belongs in the home catalog, add it to `MOCK_BOTS`.
