/**
 * bus-data — the SINGLE seam between the SvelteKit API routes and the bus data layer.
 *
 * Every API route imports its data functions from HERE (not from dynamoService directly).
 * At runtime this delegates to the real DynamoDB-backed dynamoService, unless the dev-only
 * mock bus is active, in which case it delegates to the in-memory mock-dynamo-service.
 *
 * PROD-EXCLUSION GUARANTEE
 * ------------------------
 * `dev` comes from `$app/environment`, which SvelteKit statically inlines to `false` in a
 * production build. `useMock` therefore folds to `false` at build time, the mock branch
 * becomes dead code, and the dynamic `import('./mock/...')` is never reachable — so the mock
 * data-service can NEVER activate in a deployed build, regardless of the MOCK_BUS env var.
 * The mock is only ever pulled in via `vite dev` with `MOCK_BUS=1` (see `npm run dev:mock`).
 */
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import * as real from './dynamoService';
import type { ScanOpts } from './dynamoService';
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

const useMock = dev && env.MOCK_BUS === '1';

type MockModule = typeof import('./mock/mock-dynamo-service');
let mockPromise: Promise<MockModule> | null = null;
/** Load the mock module lazily and only when the dev gate is open (keeps it out of prod). */
function loadMock(): Promise<MockModule> {
  if (!mockPromise) mockPromise = import('./mock/mock-dynamo-service');
  return mockPromise;
}

export async function getRelationShips(creds: AwsCreds): Promise<BotSettings[]> {
  if (useMock) return (await loadMock()).getRelationShips(creds);
  return real.getRelationShips(creds);
}

export async function scanLeoEventQueues(creds: AwsCreds): Promise<QueueSettings[]> {
  if (useMock) return (await loadMock()).scanLeoEventQueues(creds);
  return real.scanLeoEventQueues(creds);
}

export async function scanLeoSystems(creds: AwsCreds): Promise<SystemSettings[]> {
  if (useMock) return (await loadMock()).scanLeoSystems(creds);
  return real.scanLeoSystems(creds);
}

export async function getStats(
  creds: AwsCreds,
  params: StatsQueryRequest,
): Promise<MergedStatsRecord[]> {
  if (useMock) return (await loadMock()).getStats(creds, params);
  return real.getStats(creds, params);
}

export async function getDashboardStats(
  creds: AwsCreds,
  params: DashboardStatsRequest,
): Promise<DashboardStats> {
  if (useMock) return (await loadMock()).getDashboardStats(creds, params);
  return real.getDashboardStats(creds, params);
}

export async function getQueueDashboardStats(
  creds: AwsCreds,
  params: DashboardStatsRequest,
): ReturnType<typeof real.getQueueDashboardStats> {
  if (useMock) return (await loadMock()).getQueueDashboardStats(creds, params);
  return real.getQueueDashboardStats(creds, params);
}

export async function getSettings(creds: AwsCreds, id: string): Promise<DashboardSettings> {
  if (useMock) return (await loadMock()).getSettings(creds, id);
  return real.getSettings(creds, id);
}

export async function saveBotSettings(
  creds: AwsCreds,
  id: string,
  updates: Record<string, any>,
): Promise<void> {
  if (useMock) return (await loadMock()).saveBotSettings(creds, id, updates);
  return real.saveBotSettings(creds, id, updates);
}

export async function saveQueueSettings(
  creds: AwsCreds,
  id: string,
  updates: Record<string, any>,
): Promise<void> {
  if (useMock) return (await loadMock()).saveQueueSettings(creds, id, updates);
  return real.saveQueueSettings(creds, id, updates);
}

export async function saveSystemSettings(
  creds: AwsCreds,
  id: string,
  updates: Record<string, any>,
): Promise<void> {
  if (useMock) return (await loadMock()).saveSystemSettings(creds, id, updates);
  return real.saveSystemSettings(creds, id, updates);
}

export async function saveCron(
  creds: AwsCreds,
  params: {
    id: string;
    executeNow?: boolean;
    executeNowClear?: boolean;
    checkpoint?: Record<string, string>;
  },
): Promise<void> {
  if (useMock) return (await loadMock()).saveCron(creds, params);
  return real.saveCron(creds, params);
}

/**
 * Generic table scan used by the /api/resources search route. Under the mock bus it returns
 * an empty result (no AWS); otherwise it delegates to the real parallel scan.
 */
export async function parallelScan<T>(
  client: DynamoDBClient,
  opts: ScanOpts,
  segments: number,
): Promise<T[]> {
  if (useMock) return (await loadMock()).parallelScan<T>(client, opts, segments);
  return real.parallelScan<T>(client, opts, segments);
}
