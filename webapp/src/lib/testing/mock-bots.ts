/**
 * mock-bots — the canonical, injectable botmon test fixture (ES-3461).
 *
 * During ES-3461 we discovered several botmon status bugs (rogue detection, the no-stats
 * short-circuit, stale checkpoints after save) that only a live "mock bus" harness surfaced.
 * That harness used to be ad-hoc and was thrown away. This module is the PERMANENT
 * reconstruction: a small set of deterministic bot/stats fixtures that describe every UI
 * state we care about, in one place, fully typed against `$lib/types`.
 *
 * It is framework-free on purpose — NO svelte/browser imports — so it can be imported from:
 *   - the server mock data-service (`$lib/server/services/mock/mock-dynamo-service`) that
 *     backs `npm run dev:mock`,
 *   - the node-environment logic test (`tests/.../bot-status.presets.test.ts`),
 *   - the Storybook state stories (`bot-table-name-cell.stories.svelte`).
 *
 * To add a new state: add a preset factory + (if it needs stats) an entry in
 * MOCK_STATS_BY_ID, then add it to a story and, if it belongs in the home catalog, to
 * MOCK_BOTS. See `src/lib/testing/README.md`.
 */
import type {
  BotSettings,
  Checkpoints,
  ExecutionStats,
  MergedStatsRecord,
  ReadWriteStats,
} from '$lib/types';

/** A real z-token, shaped exactly like a live Leo checkpoint, for the checkpoint picker. */
export const MOCK_CHECKPOINT_TOKEN = 'z/2026/07/09/08/07/00/';

/** Queue id the mock bots read from — used as the key in stats/checkpoint records. */
export const MOCK_SOURCE_QUEUE = 'queue:mock-source';

const MINUTE = 60 * 1000;

/**
 * Build a fully-typed mock bot. `id` defaults to "mock-bot"; name/lambdaName derive from
 * the id unless overridden. Everything else defaults to a healthy, running bot.
 */
export function makeMockBot(overrides: Partial<BotSettings> = {}): BotSettings {
  const id = overrides.id ?? 'mock-bot';
  return {
    id,
    name: id,
    tags: 'app:mock,workflow:verify',
    errorCount: 0,
    paused: false,
    archived: false,
    checkpoints: { read: {}, write: {} },
    health: {},
    lambdaName: `${id}-lambda`,
    ...overrides,
  };
}

/**
 * Build a merged stats record. Empty read/write by default (no errors, no lag). Pass a
 * partial to override — see makeErrorStats / makeAlarmStats for the interesting shapes.
 */
export function makeMockStats(overrides: Partial<MergedStatsRecord> = {}): MergedStatsRecord {
  return { id: 'mock-bot', read: {}, write: {}, ...overrides };
}

/** A single read-stat entry keyed at "now" so it contributes no lag by default. */
function readStat(overrides: Partial<ReadWriteStats> = {}): ReadWriteStats {
  const now = Date.now();
  return {
    checkpoint: MOCK_CHECKPOINT_TOKEN,
    timestamp: now,
    source_timestamp: now,
    units: 1000,
    ...overrides,
  };
}

/**
 * An execution-stat entry — the ONLY place the Leo stats table records errors
 * (current.execution.errors). Mirrors the real record shape so fixtures can't
 * re-teach status code to read errors off read/write entries (ES-4034).
 */
function executionStat(overrides: Partial<ExecutionStats> = {}): ExecutionStats {
  return {
    completions: 1000,
    duration: 1000,
    errors: 0,
    max_duration: 10,
    min_duration: 1,
    units: 1000,
    ...overrides,
  };
}

/**
 * Stats that carry current-window errors but a LOW error-rate — drives BLOCKED
 * (hasCurrentErrors) without tripping the error-rate alarm (which would escalate to danger).
 * Errors live on the execution record, matching the live bus shape.
 */
export function makeErrorStats(id: string, errors = 5, units = 1000): MergedStatsRecord {
  return makeMockStats({
    id,
    execution: executionStat({ errors, units, completions: units - errors }),
    read: { [MOCK_SOURCE_QUEUE]: readStat({ units }) },
  });
}

/**
 * Stats with high source-lag (well past SOURCE_LAG_THRESHOLD ~2.5min) and zero errors —
 * drives the source-lag alarm, which escalates a running bot to DANGER.
 */
export function makeAlarmStats(id: string): MergedStatsRecord {
  const now = Date.now();
  return makeMockStats({
    id,
    read: {
      [MOCK_SOURCE_QUEUE]: readStat({
        // source event is 10 minutes old → source_lag ~10min >> 2.5min threshold
        source_timestamp: now - 10 * MINUTE,
        timestamp: now,
      }),
    },
  });
}

/** Build a Checkpoints object with a read checkpoint token set for a queue. */
export function makeMockCheckpoint(
  token: string,
  queue: string = MOCK_SOURCE_QUEUE,
): Checkpoints {
  return { read: { [queue]: { checkpoint: token } }, write: {} };
}

// ---------------------------------------------------------------------------
// Named preset factories — one per UI state. Factories (not shared constants)
// so tests/stories/the mock store each get their own mutable copy.
// ---------------------------------------------------------------------------

/** Running / healthy — no errors, no stats needed. */
export const mockHealthy = (): BotSettings => makeMockBot({ id: 'mock-healthy' });

/** Rogue — persisted errorCount over the threshold (10). Rogue even with NO stats. */
export const mockRogue = (): BotSettings => makeMockBot({ id: 'mock-rogue', errorCount: 25 });

/** Rogue wins over paused — a paused bot that went rogue still shows rogue. */
export const mockRoguePaused = (): BotSettings =>
  makeMockBot({ id: 'mock-rogue-paused', errorCount: 25, paused: true });

/** Paused (non-rogue) — shows paused, no stats needed. */
export const mockPaused = (): BotSettings => makeMockBot({ id: 'mock-paused', paused: true });

/** Archived wins over rogue — shows archived, no stats needed. */
export const mockArchivedRogue = (): BotSettings =>
  makeMockBot({ id: 'mock-archived-rogue', archived: true, errorCount: 25 });

/** Blocked — not rogue, but has current-window errors (needs makeErrorStats). */
export const mockBlocked = (): BotSettings => makeMockBot({ id: 'mock-blocked', errorCount: 0 });

/** Danger — not rogue, not blocked, but alarmed via source-lag (needs makeAlarmStats). */
export const mockDanger = (): BotSettings => makeMockBot({ id: 'mock-danger', errorCount: 0 });

/** Checkpoint — carries a real z-token so the checkpoint picker has something to show. */
export const mockCheckpoint = (): BotSettings =>
  makeMockBot({
    id: 'mock-checkpoint',
    name: 'mock-checkpoint (use me for the picker)',
    checkpoints: makeMockCheckpoint(MOCK_CHECKPOINT_TOKEN),
  });

/**
 * The home / catalog fixture, matching research/ES-3461/playground-verify/01-catalog.png:
 * healthy, rogue, rogue-paused, paused, archived-rogue, checkpoint. These are the six bots
 * that render in the catalog table; each hits the no-stats path (getStats → []) so the
 * status derives from the record alone — the exact case the ES-3461 fix addressed.
 */
export const MOCK_BOTS: BotSettings[] = [
  mockHealthy(),
  mockRogue(),
  mockRoguePaused(),
  mockPaused(),
  mockArchivedRogue(),
  mockCheckpoint(),
];

/**
 * Stats keyed by bot id. Only the states that REQUIRE stats to reach their status get an
 * entry (blocked needs current errors; danger needs a lag alarm). Every other preset is
 * intentionally absent so it exercises the no-stats path.
 */
export const MOCK_STATS_BY_ID: Record<string, MergedStatsRecord> = {
  'mock-blocked': makeErrorStats('mock-blocked'),
  'mock-danger': makeAlarmStats('mock-danger'),
};

/** Stats for a bot id, or undefined (→ the no-stats path) when none are seeded. */
export function mockStatsFor(id: string): MergedStatsRecord | undefined {
  return MOCK_STATS_BY_ID[id];
}
