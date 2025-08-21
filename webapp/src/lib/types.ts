import * as Icons from "$lib/client/components/icons";
import type { BotStatus, BotAlarms, BotHealthConfig } from "$lib/client/components/features/bot/bot-status.constants";


export interface AwsCreds {
	accessKeyId: string;
	secretAccessKey: string;
	sessionToken: string;
	expiration: Date;
}


export type Route = {
  title: string;
  label: string;
  icon: (typeof Icons)[keyof typeof Icons];
  route: string;
  forServicesNotDevs: boolean;
};

export interface BotSettings {
  id: string;
  archived?: boolean;
  checkpoints?: Checkpoints;
  description?: string;
  errorCount?: number;
  name?: string;
  lambda?: BotLambda;
  lambdaName?: string;
  paused?: boolean;
  tags?: string;
  trigger?: number;
  triggers?: string[] | null;
  type?: string;
  health?: BotHealth;
  // New status fields
  status?: BotStatus;
  isAlarmed?: boolean;
  alarms?: BotAlarms;
  rogue?: boolean;
  alarmed?: boolean; // Keep for compatibility
  // Additional fields from DynamoDB
  scheduledTrigger?: number;
  instances?: Record<string, any>;
  invocationType?: string;
  invokeTime?: number;
  message?: string | null;
  progress?: Record<string, any>;
  requested_kinesis?: Record<string, string>;
  time?: string;
  token?: number;
  executionType?: string;
  templateId?: string;
}

export interface BotLambda { 
  settings: LambdaSettings[];
}

export interface LambdaSettings {
  source?: string;
  botNumber: number;
  queue?: string;
  prefix?: string;
}

export interface BotSettingsApiResponse {
  botData: BotSettings[];
}

export interface BotHealth {
  write_lag?: number;
  source_lag?: number;
  consecutive_errors?: number;
  error_limit?: number;
}

export type CheckpointRecord = Record<string, CheckpointDetail>;
export type CheckpointType = "read" | "write";

export type Checkpoints = {
  [key in CheckpointType]?: CheckpointRecord;
}

export interface CheckpointDetail {
  checkpoint?: string;
  records?: number;
  ended_timestamp?: number;
  source_timestamp?: number;
}

export interface RelationshipTree {
  id: string;
  name?: string;
  paused?: boolean;
  alarmed?: boolean;
  rogue?: boolean;
  archived?: boolean;
  // New status fields
  status?: BotStatus;
  isAlarmed?: boolean;
  alarms?: BotAlarms;
  children: RelationshipTree[];
  parents: RelationshipTree[];
}

export interface TreeNode {
  id: string;
  originalId?: string;
  name?: string;
  type: "bot" | "queue" | "system" | "virtual";
  paused?: boolean;
  alarmed?: boolean;
  rogue?: boolean;
  archived?: boolean;
  // New status fields
  status?: BotStatus;
  isAlarmed?: boolean;
  alarms?: BotAlarms;
  parent?: TreeNode;
  depth: number;
  direction: "left" | "right";
  children: TreeNode[];
  _children: TreeNode[];
  isVirtual?: boolean;
}

export interface StatsQueryParams {
  /**
   * The Bucket of time to be queried
   */
  range: StatsRange;
  /**
   * The number of chunks within the bucket
   */
  count: number;
  /**
   * The URL-encoded timestamp for when the call was made.
   */
  timestamp: string;
}

export interface StatsQueryRequest {
  range: StatsRange,
  count: number,
  startTime: number,
  endTime?: number,
  nodeIds: string[],
}

export enum StatsRange {
  Minute = "minute",
  Minute1 = "minute_1",
  Minute15 = "minute_15",
  Hour = "hour",
  Hour6 = "hour_6",
  Day = "day",
  Week = "week",
}

export enum NodeType {
  Bot = "bot",
  Queue = "queue",
  System = "system",
}

export type TimeRange = {
  start: number;
  end: number;
  period: string;
};

export type BotCounts = {
  count: number;
  events: number;
  last_read?: number | null;
  last_read_lag?: number | null;
  last_write?: number | null;
  last_write_lag?: number | null;
  last_source?: number | null;
  last_source_lag?: number | null;
};

export type LinkItem = {
  id: string;
  type: string;
  units: number;
  event_source_lag?: number | null;
  last_read_lag?: number | null;
  last_write_lag?: number | null;
  last_read?: number;
  last_write?: number;
  last_event_source_timestamp?: number;
  checkpoint?: string;
};

export type Links = {
  parent: Record<string, LinkItem>;
  children: Record<string, LinkItem>;
};

export type Logs = {
  errors: any[];
  notices: any[];
};

// Base node type with common properties
export type BaseNode = {
    id: string;
    type: string;
    label: string;
    queue: string;
    subqueues?: any[];
    tags: string;
    bots?: {
      read: BotCounts;
      write: BotCounts;
    };
    link_to: Links;
    logs: Logs;
    checksums?: boolean;
    checksum?: boolean;
    alarms?: Record<string, any>;
  };

// Specialized node types with their unique properties
export type Node = BaseNode & (
    | {
        type: "system";
        icon: string;
        settings: { system: string };
        heartbeat: Record<string, any>;
        checksums: boolean;
      }
    | {
        type: "bot";
        status: string;
        rogue: boolean;
        executions: number;
        errors: number;
        source: boolean;
        last_run: { start: number | null; end: number | null };
        expect: {
          write_lag: number;
          source_lag: number;
          error_limit: number;
          consecutive_errors: number;
        };
        templateId: string;
        queues: { read: BotCounts; write: BotCounts };
        duration: { min: number; max: number; total: number; avg: number };
        checksum: boolean;
        archived: boolean;
        frequency: null;
        triggers: any[];
        health: Record<string, any>;
        name: string;
        description: string | null;
        kinesis_number: string;
      }
    | {
        type: "queue";
        icon: string;
        latest_checkpoint: string;
        latest_write: number;
        owner: string | null;
      }
  );

export type StatsResponse = TimeRange & {
  nodes: {
    system: Record<string, Node>;
    bot: Record<string, Node>;
    queue: Record<string, Node>;
  };
};


export type MergedStatsRecord = Stats & {
  id: string,
}

export interface DashboardStatsRequest {
  id: string,
  range: StatsRange,
  numberOfBuckets?: number,
  timestamp: number,
}

export interface GetSettingsRequest {
  id: string,
}

export interface DashboardStatsValue {
  value: number,
  time: number,
  marked?: boolean,
  /**
   * Indicates whether the value is approximated. This is used visually so we can trigger different effects based on that value.
   */
  approximated?: boolean,
}

export type DashboardStatsDurationValue = DashboardStatsValue & {
  total: number,
  min: number,
  max: number,
}

export type DashboardStatsQueue =  {
  [key in CheckpointType]?: Record<string, DashboardStatsQueueReadWrite>;
  // read: Record<string, DashboardStatsQueueReadWrite>,
  // write: Record<string, DashboardStatsQueueReadWrite>,
}

export interface DashboardStatsCompareValue {
  prev: number,
  current: number,
  change: string, // percentage
}

export interface DashboardStatsQueueLagCompare {
  prev: number,
  current: number,
  prevCount: number,
  currentCount: number,
  change: string, // percentage
}

export interface DashboardStatsQueueCompare {
  reads?: DashboardStatsCompareValue,
  writes?: DashboardStatsCompareValue,
  read_lag?: DashboardStatsQueueLagCompare,
  write_lag?: DashboardStatsQueueLagCompare,
}

export type DashboardStatsQueueReadWrite = {
  type: 'read' | 'write',
  id: string,
  event: string,
  label: string,
  last_read?: number,
  last_write?: number,
  latestWriteCheckpoint?: string,
  last_read_event_timestamp?: number,
  last_write_event_timestamp?: number,
  last_event_source_timestamp?: number,
  last_event_source_timestamp_lag?: number,
  last_read_lag?: number,
  last_write_lag?: number,
  values: DashboardStatsValue[],
  source_lags: DashboardStatsValue[],
  queue_lags: DashboardStatsValue[],
  reads?: DashboardStatsValue[],
  writes?: DashboardStatsValue[],
  compare: DashboardStatsQueueCompare,
  lagEvents: number,
  checkpoint: string,
  timestamp: number,
  current_position?: number,
}

export interface DashboardStatsCompare {
  executions: DashboardStatsCompareValue,
  errors: DashboardStatsCompareValue,
  duration: DashboardStatsCompareValue,
}

export interface DashboardQueueStatsCompare {
  reads: DashboardStatsCompareValue,
  writes: DashboardStatsCompareValue,
  read_lag: DashboardStatsQueueLagCompare,
  write_lag: DashboardStatsQueueLagCompare,
}

export interface DashboardQueueStats {
  reads: DashboardStatsValue[],
  writes: DashboardStatsValue[],
  read_lag: DashboardStatsValue[],
  write_lag: DashboardStatsValue[],
  bots: DashboardStatsQueueReadWrite[],
  compare: DashboardQueueStatsCompare,
  max_read_checkpoint: string,
  max_write_checkpoint: string,
  start: number,
  end: number,
  buckets: number[],
}

export interface DashboardStats {
  executions: DashboardStatsValue[],
  errors: DashboardStatsValue[],
  duration: DashboardStatsDurationValue[],
  queues: DashboardStatsQueue,
  compare: DashboardStatsCompare,
  kinesis_number?: string,
  start: number,
  end: number,
  buckets: number[]
}

export interface DashboardStatsApiResponse {
  dashStats: DashboardStats
}


export interface StatsDynamoRecord {
  id: string,
  bucket?: string,
  current?: Stats,
  period?: StatsRange,
  previous?: Stats,
  start_eid?: string,
  time?: number
}

export type StatsRecord = Record<string, ReadWriteStats>;

export type Stats = {
  [key in CheckpointType]?: StatsRecord;
} & {execution?: ExecutionStats};

export interface ExecutionStats {
  completions: number,
  duration: number,
  errors: number,
  max_duration: number,
  min_duration: number,
  units: number
}

export interface ReadWriteStats {
  checkpoint: string,
  source_timestamp: number, // source from where and when it hit the queue
  timestamp: number, // when it happened
  units: number,
  errors?: number,
}

export interface StatsQueryResponse {
  stats: MergedStatsRecord[]
}

export interface UserData {
  sub?: string,
  name?: string,
  email?: string,
  image?: string,
}

export interface StatsApiResponse {
  stats: MergedStatsRecord[]
}

export interface QueueSettings {
  event: string,
  archived?: boolean,
  name?: string,
  paused?: boolean,
  timestamp?: number,
  max_eid?: string,
}

export interface SystemSettings {
  id: string,
  icon?: string,
  label?: string,
  settings?: {
    system: string
  }
}