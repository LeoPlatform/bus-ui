/**
 * A drop-in, in-memory replacement for dynamoService.
 *
 * Exposes the SAME function names the SvelteKit API routes import, backed by the committed
 * mock-bots fixture plus a module-level store. That store is what makes read-after-write
 * work: saveCron / saveBotSettings mutate it and the next read reflects the change, matching
 * the real ConsistentRead path without AWS.
 *
 * Every function takes the same `creds` first argument as dynamoService and ignores it.
 * This module is only ever loaded through `bus-data.ts` behind the `dev && MOCK_BUS=1` gate,
 * so it never ships in a production bundle.
 */
import type {
  AwsCreds,
  BotSettings,
  DashboardStats,
  DashboardStatsRequest,
  MergedStatsRecord,
  QueueSettings,
  StatsQueryRequest,
  SystemSettings,
} from '$lib/types';
import type { DashboardSettings } from '$lib/client/components/features/dashboard/types';
import type * as Real from '../dynamoService';
import { MOCK_BOTS, makeMockBot, mockStatsFor } from '$lib/testing/mock-bots';

// ---------------------------------------------------------------------------
// In-memory stores (survive for the lifetime of the dev server process).
// Seeded from the fixture; mutated by the save* functions.
// ---------------------------------------------------------------------------
const botStore = new Map<string, BotSettings>();
for (const bot of MOCK_BOTS) botStore.set(bot.id, structuredClone(bot));

const queueStore = new Map<string, QueueSettings>();
const systemStore = new Map<string, SystemSettings>();

/** Strip a bot:/queue:/system: type prefix to get the raw store key. */
function rawId(id: string): string {
  return id.replace(/^(bot|queue|system):/, '');
}

function emptyCompareValue() {
  return { prev: 0, current: 0, change: '0%' };
}

/** A minimal, valid, empty DashboardStats — enough for the dashboard to render nothing. */
function emptyDashboardStats(): DashboardStats {
  return {
    executions: [],
    errors: [],
    duration: [],
    queues: { read: {}, write: {} },
    compare: {
      executions: emptyCompareValue(),
      errors: emptyCompareValue(),
      duration: emptyCompareValue(),
    },
    start: 0,
    end: 0,
    buckets: [],
  };
}

export async function getRelationShips(_creds: AwsCreds): Promise<BotSettings[]> {
  return structuredClone([...botStore.values()]);
}

export async function scanLeoEventQueues(_creds: AwsCreds): Promise<QueueSettings[]> {
  return structuredClone([...queueStore.values()]);
}

export async function scanLeoSystems(_creds: AwsCreds): Promise<SystemSettings[]> {
  return structuredClone([...systemStore.values()]);
}

export async function getStats(
  _creds: AwsCreds,
  params: StatsQueryRequest,
): Promise<MergedStatsRecord[]> {
  const out: MergedStatsRecord[] = [];
  for (const nodeId of params.nodeIds ?? []) {
    const stats = mockStatsFor(rawId(nodeId));
    if (stats) out.push({ ...structuredClone(stats), id: nodeId });
  }
  return out;
}

export async function getDashboardStats(
  _creds: AwsCreds,
  _params: DashboardStatsRequest,
): Promise<DashboardStats> {
  return emptyDashboardStats();
}

// Return type mirrors the real (inferred) queue-dashboard shape so the seam stays typed.
type QueueDashboardStats = Awaited<ReturnType<typeof Real.getQueueDashboardStats>>;
export async function getQueueDashboardStats(
  _creds: AwsCreds,
  _params: DashboardStatsRequest,
): Promise<QueueDashboardStats> {
  return emptyDashboardStats() as unknown as QueueDashboardStats;
}

export async function getSettings(_creds: AwsCreds, id: string): Promise<DashboardSettings> {
  const raw = rawId(id);
  if (id.startsWith('queue:')) {
    return (queueStore.get(raw) ?? { event: raw }) as DashboardSettings;
  }
  if (id.startsWith('system:')) {
    return (systemStore.get(raw) ?? { id: raw }) as DashboardSettings;
  }
  const bot = botStore.get(raw) ?? makeMockBot({ id: raw });
  return structuredClone(bot) as DashboardSettings;
}

export async function saveBotSettings(
  _creds: AwsCreds,
  id: string,
  updates: Record<string, any>,
): Promise<void> {
  const raw = rawId(id);
  const bot = botStore.get(raw) ?? makeMockBot({ id: raw });
  const merged: BotSettings = { ...bot, ...updates };
  if (updates.health) merged.health = { ...(bot.health ?? {}), ...updates.health };
  botStore.set(raw, merged);
}

export async function saveQueueSettings(
  _creds: AwsCreds,
  id: string,
  updates: Record<string, any>,
): Promise<void> {
  const raw = rawId(id);
  const existing = queueStore.get(raw) ?? ({ event: raw } as QueueSettings);
  queueStore.set(raw, { ...existing, ...updates, event: raw });
}

export async function saveSystemSettings(
  _creds: AwsCreds,
  id: string,
  updates: Record<string, any>,
): Promise<void> {
  const raw = rawId(id);
  const existing = systemStore.get(raw) ?? ({ id: raw } as SystemSettings);
  systemStore.set(raw, { ...existing, ...updates, id: raw });
}

export async function saveCron(
  _creds: AwsCreds,
  params: {
    id: string;
    executeNow?: boolean;
    executeNowClear?: boolean;
    checkpoint?: Record<string, string>;
  },
): Promise<void> {
  const raw = rawId(params.id);
  const bot = botStore.get(raw) ?? makeMockBot({ id: raw });
  const updated = structuredClone(bot);

  if (params.executeNow) {
    updated.trigger = Date.now();
    updated.errorCount = 0;
  }

  // Write the checkpoint into the store so the next getSettings/getRelationShips shows it
  // immediately — the read-after-write guarantee the real path gets via ConsistentRead.
  if (params.checkpoint) {
    updated.checkpoints = updated.checkpoints ?? { read: {}, write: {} };
    updated.checkpoints.read = updated.checkpoints.read ?? {};
    for (const [queueId, checkpointValue] of Object.entries(params.checkpoint)) {
      updated.checkpoints.read[queueId] = {
        ...(updated.checkpoints.read[queueId] ?? {}),
        checkpoint: checkpointValue,
      };
    }
  }

  botStore.set(raw, updated);
}

/**
 * Generic table scan used by the /api/resources search route. The mock has no tables to
 * scan, so it returns an empty result — search is simply empty under the mock bus.
 */
export async function parallelScan<T>(
  _client: unknown,
  _opts: unknown,
  _segments: number,
): Promise<T[]> {
  return [] as T[];
}
