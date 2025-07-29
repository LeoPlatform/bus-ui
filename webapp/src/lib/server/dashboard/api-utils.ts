import type { BotSettings, CheckpointDetail, CheckpointType, DashboardStats, DashboardStatsQueueReadWrite, ReadWriteStats, StatsDynamoRecord } from "$lib/types";
import type { QueryOutput } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

export interface MergeDynamoRecordToDashboardStatsParams {
    buckets: number[];
    startTime: Date;
    endTime: Date;
    currentBucketTimestamp: number;
    prevBucketTimestamp: number;
    bucketArrayIndex: Record<string, number>;
    timestamp: number;
    botState: BotSettings;
}


export function mergeDynamoRecordToDashboardStats(items: StatsDynamoRecord[], params: MergeDynamoRecordToDashboardStatsParams ): DashboardStats {
    if(!items) {
        throw new Error('No items were returned from the query');
    }

    const { buckets, startTime, endTime, currentBucketTimestamp, prevBucketTimestamp } = params;

    const botDashboardStats: DashboardStats = {
        executions: buckets.map((time) => ({ value: 0, time })),
        errors: buckets.map((time) => ({ value: 0, time })),
        duration: buckets.map((time) => ({ value: 0, time, total: 0, min: 0, max: 0 })),
        queues: { read: {}, write: {} },
        compare: {
            executions: { prev: 0, current: 0, change: "0%" },
            errors: { prev: 0, current: 0, change: "0%" },
            duration: { prev: 0, current: 0, change: "0%" },
        },
        kinesis_number: "",
        start: startTime.valueOf(),
        end: endTime.valueOf(),
        buckets: buckets,
    }


    items.map(stat => {
        const index = params.bucketArrayIndex[stat.time!];

        if (stat.current?.execution) {
            let exec = stat.current.execution;
            if(!botDashboardStats.executions[index]) console.log(botDashboardStats.executions[index], index, stat.time);
            botDashboardStats.executions[index].value = exec.units;
            botDashboardStats.errors[index].value = exec.errors; //Math.max(exec.errors, exec.units - exec.completions);
            botDashboardStats.duration[index] = {
                value: exec.duration / exec.units,
                total: exec.duration,
                max: exec.max_duration,
                min: exec.min_duration,
                time: stat.time!
            };
            if (stat.time! >= params.prevBucketTimestamp && stat.time! < params.currentBucketTimestamp) {
                botDashboardStats.compare.executions.prev += botDashboardStats.executions[index].value;
                botDashboardStats.compare.errors.prev += botDashboardStats.errors[index].value;
                botDashboardStats.compare.duration.prev += botDashboardStats.duration[index].total;
            } else if (stat.time! >= params.currentBucketTimestamp) {
                botDashboardStats.compare.executions.current += botDashboardStats.executions[index].value;
                botDashboardStats.compare.errors.current += botDashboardStats.errors[index].value;
                botDashboardStats.compare.duration.current += botDashboardStats.duration[index].total;
            }
        }
        ["read", "write"].map(type => {
            if (stat.current && stat.current[type as CheckpointType]) {
                const record = stat.current[type as CheckpointType]!;
                Object.keys(record).forEach((key, k) => {
                    const link = record[key];
                    const checkpoint = link.checkpoint && link.checkpoint.split(/\//).pop()?.split(/\-/)[0] || "0";

                    if (!(key in botDashboardStats.queues[type as CheckpointType]!)) {
                        botDashboardStats.queues[type as CheckpointType]![key] = generateQueueData(key, type as CheckpointType, link, params.timestamp, buckets);
                    }
                    const queue = botDashboardStats.queues[type as CheckpointType]![key];
                    let botCurrentCheckpoint = params.botState.checkpoints?.read?.[key] || {};

                    queue.source_lags[index].value += (link.timestamp - link.source_timestamp) || 0; // source lag
                    queue.queue_lags[index].value += (getTimestampFromCheckpoint(link.checkpoint, botCurrentCheckpoint) - link.timestamp) || 0;

                    if (type === "write") {
                        queue.values[index].value += link.units;
                    } else {
                        queue.reads![index].value += link.units;
                    }

                    if (stat.time! >= params.prevBucketTimestamp && stat.time! < params.currentBucketTimestamp) {
                        if(type === "write"){
                            queue.compare.writes!.prev += link.units;
                            queue.compare.write_lag!.prev += (link.timestamp - link.source_timestamp) || 0;
                            queue.compare.write_lag!.prevCount++;

                        } else {
                            queue.compare.reads!.prev += link.units;
                            queue.compare.read_lag!.prev += (link.timestamp - link.source_timestamp) || 0;
                            queue.compare.read_lag!.prevCount++;
                        }
                    } else if (stat.time! >= params.currentBucketTimestamp) {
                        if(type === "write"){
                            queue.compare.writes!.current += link.units;
                            queue.compare.write_lag!.current += (link.timestamp - link.source_timestamp) || 0;
                            queue.compare.write_lag!.currentCount++;
                        } else {
                            queue.compare.reads!.current += link.units;
                            queue.compare.read_lag!.current += (link.timestamp - link.source_timestamp) || 0;
                            queue.compare.read_lag!.currentCount++;
                        }
                    }

                    if(type === "write"){
                        queue.last_write = link.timestamp;
                        queue.last_write_event_timestamp = parseInt(checkpoint);
                        queue.last_write_lag = params.timestamp - link.timestamp;

                    } else {
                        queue.last_read = link.timestamp;
                        queue.last_read_event_timestamp = parseInt(checkpoint);
                        queue.last_read_lag = params.timestamp - link.timestamp;
                    }

                    queue.last_event_source_timestamp = link.source_timestamp;
                    queue.last_event_source_timestamp_lag = params.timestamp - link.source_timestamp;

                    queue.checkpoint = link.checkpoint;
                    queue.timestamp = parseInt(checkpoint);
                })
            }
        });

        if (botDashboardStats.compare.executions.current) {
            botDashboardStats.compare.duration.current /= botDashboardStats.compare.executions.current;
        }
        if (botDashboardStats.compare.executions.prev) {
            botDashboardStats.compare.duration.prev /= botDashboardStats.compare.executions.prev;
        }
        botDashboardStats.compare.executions.change = calcChange(botDashboardStats.compare.executions.current, botDashboardStats.compare.executions.prev);
        botDashboardStats.compare.errors.change = calcChange(botDashboardStats.compare.errors.current, botDashboardStats.compare.errors.prev);
        botDashboardStats.compare.duration.change = calcChange(botDashboardStats.compare.duration.current, botDashboardStats.compare.duration.prev);

        ["read", "write"].map(type => {
            var typeS = `${type}s`;
            Object.keys(botDashboardStats.queues[type as CheckpointType]!).map(key => {
                let link = botDashboardStats.queues[type as CheckpointType]![key];
                if (type === 'write') {
                    if (link.compare.write_lag?.currentCount) {
                        link.compare.write_lag.current /= link.compare.write_lag.currentCount;
                    }
                    if (link.compare.write_lag?.prevCount) {
                        link.compare.write_lag.prev /= link.compare.write_lag.prevCount;
                    }
    
                    link.compare.write_lag!.change = calcChange(link.compare.write_lag!.current, link.compare.write_lag!.prev);
                    link.compare.writes!.change = calcChange(link.compare.writes!.current, link.compare.writes!.prev);

                } else {
                    if (link.compare.read_lag?.currentCount) {
                        link.compare.read_lag.current /= link.compare.read_lag.currentCount;
                    }
                    if (link.compare.read_lag?.prevCount) {
                        link.compare.read_lag.prev /= link.compare.read_lag.prevCount;
                    }

                    link.compare.read_lag!.change = calcChange(link.compare.read_lag!.current, link.compare.read_lag!.prev);
                    link.compare.reads!.change = calcChange(link.compare.reads!.current, link.compare.reads!.prev);
                }

            });
        });
    })

    return botDashboardStats;
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
      source_lags: buckets.map((time) => ({
        value: 0,
        time: time,
      })),
      queue_lags: buckets.map((time) => ({
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

export function calculateReadQueueStats(readQueueStats: QueryOutput, dashStats: DashboardStats, params: MergeDynamoRecordToDashboardStatsParams) {
    const readQueueItems = readQueueStats.Items?.map(item => unmarshall(item) as StatsDynamoRecord);
    if (!readQueueItems) {
        throw new Error(`No stats found for read queues`);
    }

    let isBehind = false;
    let isBehindOnFirst = false;
    let isBehindOnLast = false;

    readQueueItems.map(stat => {
        let time = stat.time || new Date(stat.bucket!.replace(/^.*_/, "")).valueOf();
        let index = params.bucketArrayIndex[time];
        let queue = dashStats.queues.read![stat.id];

        Object.keys(stat.current?.write || {}).map(key => {
            let link = stat.current?.write![key]!;
            queue.values[index].value += link.units;
            queue.latestWriteCheckpoint = maxString(queue.latestWriteCheckpoint || '', link.checkpoint || '');
            if (link.timestamp > queue.last_read_event_timestamp! || link.checkpoint && queue.checkpoint! < link.checkpoint) {
                queue.lagEvents += link.units;
                if (!isBehind) { //Then we found our first one that is behind
                    queue.values[index].marked = true;
                }
                isBehind = true;
                if (index == 0) {
                    isBehindOnFirst = true;
                } else if (index == params.buckets.length) {
                    isBehindOnLast = true;
                }
            }

            if(!queue.compare.writes) {
                queue.compare.writes = {
                    prev: 0,
                    current: 0,
                    change: "0%"
                };
            }

            if(stat.time! >= params.prevBucketTimestamp && stat.time! < params.currentBucketTimestamp) {
                queue.compare.writes!.prev += link.units;
            } else if(stat.time! >= params.currentBucketTimestamp) {
                queue.compare.writes!.current += link.units;
            }
        });
    })

    
}

function maxString(...args: string[]) {
	let max = args[0]
	for (let i = 1; i < args.length; ++i) {
        if (args[i]) {
            max = max > args[i] ? max : args[i];
        }
	}
	return max;
}

function getTimestampFromCheckpoint(checkpoint: string, botCheckpoint: CheckpointDetail): number {
    let now = new Date().valueOf();
    if (checkpoint.match(/^(?:[0-9]+[a-z]|[a-z]+[0-9])[a-z0-9-]*$/)) {
        // Not a time-based checkpoint
        return 0;
    } else if (checkpoint.match(/^(\d{13})(?:\W|$)/)) {
        let ts = parseInt(checkpoint.match(/^(\d{13})(?:\W|$)/)![1]);
        return ts;
    } else if (botCheckpoint.ended_timestamp) {
        return botCheckpoint.ended_timestamp;
    } else {
        return 0;
    }
}


// Getting the bot dashboard stats look as follows:
// 1. get all the comparison dates for the current and previous bucket. 
// 2. generate the buckets and buckatsArrayIndex
// 3. query the stats table for all the stats related to the bot within the current time range
// 4. take the results and map them to the DashboardStats object
// 5. grab the bot settings from the cron table
// 6. do 4 and 5 in parallel 
// 7. take the results from 6 and snag the stats for all the connected read queues within the same time range as the bot stats. 
//      i. merge the queue stats into the DashboardStats object
//      ii. generate the source and kinesis number
//      iii. add other queues that the bot checkpointed against but hasn't had any stats for.