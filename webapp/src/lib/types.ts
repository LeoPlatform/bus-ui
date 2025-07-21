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
  lambdaName?: string;
  paused?: boolean;
  tags?: string;
  trigger?: number;
  triggers?: string[];
  type?: string;
  health?: BotHealth;
  // New status fields
  status?: BotStatus;
  isAlarmed?: boolean;
  alarms?: BotAlarms;
  rogue?: boolean;
  alarmed?: boolean; // Keep for compatibility
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
  checkpoint?: string | number;
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


export interface StatsDynamoRecord {
  id: string,
  bucket?: string,
  current?: Stats,
  period?: StatsRange,
  previous?: Stats,
  start_eid?: string,
  time?: number
}

// export interface Stats {
//   execution?: ExecutionStats,
//   read?: Record<string, ReadWriteStats>,
//   write?: Record<string, ReadWriteStats>,
// }

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
  source_timestamp: number,
  timestamp: number,
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
}

export interface SystemSettings {
  id: string,
  icon?: string,
  label?: string,
  settings?: {
    system: string
  }
}