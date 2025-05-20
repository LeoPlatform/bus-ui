import * as Icons from "$lib/components/icons";
export interface AppState {
  // TODO
}

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
}

export interface BotHealth {
  write_lag?: number;
  source_lag?: number;
  consecutive_errors?: number;
  error_limit?: number;
}

export interface Checkpoints {
  read?: Record<string, CheckpointDetail>;
  write?: Record<string, CheckpointDetail>;
}

export interface CheckpointDetail {
  checkpoint?: string | number;
  records?: number;
}

export interface RelationshipTree {
  id: string;
  children: RelationshipTree[];
  parents: RelationshipTree[];
}

export interface TreeNode {
  id: string;
  name?: string;
  type: "bot" | "queue" | "system";
  size: number;
  parent?: TreeNode;
  depth: number;
  direction: "left" | "right";
  children: TreeNode[];
  _children: TreeNode[];
}

export interface StatsQueryParams {
  /**
   * The Bucket of time to be queried
   */
  range: StatsRange;
  /**
   * The number of chunks within the bucker
   */
  count: number;
  /**
   * The URL-encoded timestamp for when the call was made.
   */
  timestamp: string;
}

export enum StatsRange {
  Minute = "minute",
  Hour = "hour",
  Day = "day",
  Minute1 = "minute_1",
  Minute15 = "minute_15",
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
