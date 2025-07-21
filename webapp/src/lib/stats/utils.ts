import type {
    CheckpointType,
  DashboardStatsQueueReadWrite,
  ExecutionStats,
  MergedStatsRecord,
  ReadWriteStats,
  StatsDynamoRecord,
} from "$lib/types";
import type { QueryOutput } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

export function mergeStatsResults(stats: QueryOutput): MergedStatsRecord {
  if (!stats.Items) {
    throw new Error("no items were returned from query");
  }
  const defaultReadWriteStat: ReadWriteStats = {
    checkpoint: "",
    source_timestamp: 0,
    timestamp: 0,
    units: 0,
  };

  const defaultExecutionStat: ExecutionStats = {
    completions: 0,
    duration: 0,
    errors: 0,
    max_duration: 0,
    min_duration: 0,
    units: 0,
  };

  let mergedStats: MergedStatsRecord = {
    id: "",
    execution: defaultExecutionStat,
    read: {},
    write: {},
  };

//   console.log("stats.Items", stats.Items);

  stats.Items.map((item) => {
    const stat = unmarshall(item) as StatsDynamoRecord;
    if(!mergedStats.id) {
        mergedStats.id = stat.id;
    }

    if (stat.current) {
        if(stat.current.execution) {
            mergedStats.execution = mergeExecutionStats(
              mergedStats.execution!,
              stat.current.execution
            );

        }
        ['read', 'write'].map((type: CheckpointType) => {
            Object.entries(stat.current![type as CheckpointType])
                .map(([queueId, rwStat]: [string, ReadWriteStats]) => {
                    if(!mergedStats[type][queueId]) {
                        mergedStats[type][queueId] = defaultReadWriteStat;
                    }
                    mergedStats[type][queueId] = mergeReadWriteStats(mergedStats[type][queueId], rwStat)
                    
            })
        });
    }
    
  });

  return mergedStats;
}

function mergeExecutionStats(
  a: ExecutionStats,
  b: ExecutionStats
): ExecutionStats {
    a.completions = a.completions + b.completions;
    a.units = a.units + b.units;
    a.duration = a.duration + b.duration;
    a.max_duration = Math.max(a.max_duration, b.max_duration);
    if (b.min_duration > 0) {
        a.min_duration = Math.min(a.min_duration, b.min_duration);
    }

    a.errors = a.errors + b.errors;
    return a;
}

function mergeReadWriteStats(
    a: ReadWriteStats,
    b: ReadWriteStats,
): ReadWriteStats {
    a.source_timestamp = Math.max(a.source_timestamp, b.source_timestamp);
    a.timestamp = Math.max(a.timestamp, b.timestamp);
    a.units = a.units + b.units;
    a.checkpoint = b.checkpoint || a.checkpoint;

    return a;
}


export function generateQueueData(queueId: string, type: CheckpointType, link: ReadWriteStats, request_timestamp: number, buckets: number[]): DashboardStatsQueueReadWrite {
  const checkpoint = link.checkpoint && link.checkpoint.split(/\//).pop()?.split(/\-/)[0];
  
  return {
    type: type,
    id: queueId,
    event: queueId,
    label: queueId,
    [`last_${type}`]: link.timestamp,
    [`last_${type}_event_timestamp`]: checkpoint ? parseInt(checkpoint) : 0,
    last_event_source_timestamp: link.source_timestamp,
    [`last_${type}_lag`]: request_timestamp - link.timestamp,
    last_event_source_timestamp_lag: request_timestamp - link.source_timestamp,
    values: buckets.map((time) => ({
      value: 0,
      time: time,
    })),
    lags: buckets.map((time) => ({
      value: 0,
      time: time,
    })),
    [`${type}s`]: type === 'read' && buckets.map((time) => ({
      value: 0,
      time: time,
    })) || undefined,
    compare: {
      [`${type}s`]: {
        prev: 0,
        current: 0,
        change: 0,
      },
      [`${type}_lag`]: {
        prev: 0,
        current: 0,
        prevCount: 0,
        currentCount: 0,
      },
    },
    lagEvents: 0,
    checkpoint: link.checkpoint,
    timestamp: checkpoint ? parseInt(checkpoint) : 0,
  }
}

export function calcChange(current: number, prev: number) {
	if (current) {
		if (prev) {
			return Math.round(((current - prev) / prev) * 100) + '%';
		} else {
			return "100%";
		}
	} else if (prev) {
		return "-100%";
	} else {
		return "0%";
	}
}
// function max(a, b) {
//   if (typeof a === "number") {
//     return Math.max(a, b);
//   } else if (typeof a === "string") {
//     return a.localeCompare(b) >= 1 ? a : b;
//   } else {
//     return b;
//   }
// }

// function min(a, b) {
//   if (typeof a === "number") {
//     return Math.min(a, b);
//   } else if (typeof a === "string") {
//     return a.localeCompare(b) >= 1 ? b : a;
//   } else {
//     return b;
//   }
// }

// function sum(a, b, defaultValue) {
//   return (a || defaultValue || 0) + (b || defaultValue || 0);
// }

// function safeNumber(number) {
//   if (isNaN(number) || !number) {
//     return 0;
//   } else {
//     return number;
//   }
// }
