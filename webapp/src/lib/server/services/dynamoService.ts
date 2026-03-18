import { env } from '$env/dynamic/private';
const LEO_CRON_TABLE = () => env.LEO_CRON_TABLE ?? process.env.LEO_CRON_TABLE ?? '';
const LEO_EVENT_TABLE = () => env.LEO_EVENT_TABLE ?? process.env.LEO_EVENT_TABLE ?? '';
const LEO_STATS_TABLE = () => env.LEO_STATS_TABLE ?? process.env.LEO_STATS_TABLE ?? '';
const LEO_SYSTEM_TABLE = () => env.LEO_SYSTEM_TABLE ?? process.env.LEO_SYSTEM_TABLE ?? '';
import { createDynamoClient } from "$lib/server/aws_utils";
import { getLeoCronTable } from "$lib/server/utils";
import type { AwsCreds, BotSettings, CheckpointType, DashboardStats, DashboardStatsRequest, MergedStatsRecord, QueueSettings, StatsDynamoRecord, StatsQueryRequest, StatsRecord } from "$lib/types";
import { DynamoDBClient, QueryCommand, ReturnConsumedCapacity, type QueryOutput } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand, type NativeAttributeValue, type ScanCommandInput, type ScanCommandOutput } from "@aws-sdk/lib-dynamodb";
import { bucketsData, ranges } from "$lib/bucketUtils";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {  mergeStatsResults } from "$lib/stats/utils";
import { approximateMissingLagValues, calcChange, calculateReadQueueStats, generateQueueData, mergeDynamoRecordToDashboardStats } from "../dashboard/api-utils";
import { queueSystemReplaceRegex } from "$lib/utils";
import type { DashboardSettings } from "$lib/client/components/features/dashboard/types";

/**
 * Normalize an ID for querying the Leo stats table.
 * The stats table stores IDs with type prefixes: "bot:name", "queue:name", "system:name".
 * The LeoCron table stores bot IDs without prefix, so IDs coming from the URL or cron table
 * need to be prefixed before querying stats.
 *
 * Mirrors the behavior of leo-sdk's `ref(id, type).refId()`.
 */
function toStatsId(id: string, defaultType: 'bot' | 'queue' | 'system' = 'bot'): string {
    // Already has a type prefix — return as-is
    if (/^(bot|queue|system):/.test(id)) {
        return id;
    }
    return `${defaultType}:${id}`;
}



//TODO: will eventually need to do the parallel scan
export async function getRelationShips(creds: AwsCreds): Promise<BotSettings[]> {
    const client = createDynamoClient(creds);
    const docClient = DynamoDBDocumentClient.from(client);

    console.log("getRelationShips: using table", getLeoCronTable());

    try {
        let response: ScanCommandOutput | null = null;
        do {
            const command = new ScanCommand({
                TableName: getLeoCronTable(),
                ExclusiveStartKey: response?.LastEvaluatedKey
            });
            const response2: ScanCommandOutput = await docClient.send(command);
            if(!response) {
                response = response2
            } else {
                response.LastEvaluatedKey = response2.LastEvaluatedKey;
                response.Items = (response.Items?? []).concat(response2.Items ?? [])
            }
        } while(response.LastEvaluatedKey != null);
        console.log("getRelationShips: fetched", response.Items?.length, "items");
        return (response.Items as BotSettings[]) ?? [];
    } catch (err) {
        console.error('Failed retrieving bot information from dynamo ', err);
        return [];
    }
}


export async function getStats(creds: AwsCreds, params: StatsQueryRequest): Promise<MergedStatsRecord[]> {
    const client = createDynamoClient(creds);
    const bucketUtils = bucketsData[params.range];

    const endTime = params.endTime ? bucketUtils.value(new Date(params.endTime)) : bucketUtils.next(new Date(params.startTime), params.count);
    const startTime = bucketUtils.value(new Date(params.startTime));

    const expressionAttributeValues: Record<string, string> = {
        ":start": bucketUtils.transform(startTime),
        ":end": bucketUtils.transform(endTime)
    };

    try {

        const queries = [];
        for (const id of params.nodeIds) {
            expressionAttributeValues[":id"] = toStatsId(id);
            queries.push(new QueryCommand({
                TableName: LEO_STATS_TABLE(),
                KeyConditionExpression: "#id = :id AND #bucket BETWEEN :start AND :end",
                ExpressionAttributeNames: {
                    "#id": "id",
                    "#bucket": "bucket"
                },
                ExpressionAttributeValues: marshall(expressionAttributeValues),
            }))
        }
        // console.log("queries", JSON.stringify(queries, null, 2));
        return await parallelQuery(client, queries, mergeStatsResults);
    } catch (err) {
        throw new Error(`Failed retrieving stats information from dynamo: ${err} `);
    }

}

// Gets the dashboard stats for the given id. If it is a bot then it will get the stats for the bot and then the stats for any dependent queues 
export async function getDashboardStats(creds: AwsCreds, params: DashboardStatsRequest): Promise<DashboardStats> {
    // Needs to grab the stats for the bot. Then needs to get the stats for each of the queues.
    const client = createDynamoClient(creds);
    //TODO: think through how we want to do this
    // const numberOfBuckets = params.numberOfBuckets ?? 1;
    const range = ranges[params.range].rolling ? ranges[params.range].rolling! : ranges[params.range];
    const bucketUtils = bucketsData[range.period];

    // current bucket of time inclusive (eg. 15minutes before ->  now)
    const currentBucketTimestamp = bucketUtils.prev(new Date(params.timestamp), 1 * range.count).valueOf();
    // previous bucket of time (eg. 30minutes before -> 15minutes before)
    const prevBucketTimestamp = bucketUtils.prev(new Date(params.timestamp), 2 * range.count).valueOf();
    const startTimeStamp = bucketUtils.prev(new Date(params.timestamp), 3 * range.count);


    const startTime = bucketUtils.value(startTimeStamp);
    const endTime = bucketUtils.value(new Date(params.timestamp));

    const formattedStartTime = bucketUtils.transform(startTime);
    const formattedEndTime = bucketUtils.transform(endTime);

    console.log(`DASHBOARD | RAW: ${startTime} | ${endTime} | ${params.timestamp}`);
    console.log(`DASHBOARD | NEW: ${formattedStartTime} | ${formattedEndTime}`);

    const buckets: number[] = [];
    let c = startTime;
    let e = endTime;
    let bucketArrayIndex: Record<string, number> = {};
    let count = 0;
    while(c <= e) {
        let t = bucketUtils.value(c).valueOf();
        buckets.push(t);
        bucketArrayIndex[t] = count++;
        c = bucketUtils.next(c, 1);
    }

    const comand = new QueryCommand({ 
        TableName: LEO_STATS_TABLE(),
        KeyConditionExpression: "#id = :id AND #bucket BETWEEN :start AND :end",
        ExpressionAttributeNames: {
            "#id": "id",
            "#bucket": "bucket"
        },
        ExpressionAttributeValues: marshall({ ":id": toStatsId(params.id, 'bot'), ":start": formattedStartTime, ":end": formattedEndTime })
    });

    // const response = await client.send(comand);
    // const items = response.Items?.map(item => unmarshall(item) as StatsDynamoRecord);

    const [botState, stats] = await Promise.all([getBotState(creds, params.id), client.send(comand)]);

    const items = stats.Items?.map(item => unmarshall(item) as StatsDynamoRecord);

    if (!items) {
        throw new Error(`No stats found for bot ${params.id} in the time range ${formattedStartTime} to ${formattedEndTime}`);
    }

    const botDashboardStats = mergeDynamoRecordToDashboardStats(items, {
        buckets,
        startTime,
        endTime,
        currentBucketTimestamp,
        prevBucketTimestamp,
        bucketArrayIndex,
        timestamp: params.timestamp,
        botState,
    });

    const readQueueQueries = Object.keys(botDashboardStats.queues.read || {}).map(key => {
        return new QueryCommand({
            TableName: LEO_STATS_TABLE(),
            KeyConditionExpression: "#id = :id AND #bucket BETWEEN :start AND :end",
            ExpressionAttributeNames: {
                "#id": "id",
                "#bucket": "bucket"
            },
            ExpressionAttributeValues: marshall({ ":id": toStatsId(key, 'queue'), ":start": formattedStartTime, ":end": formattedEndTime })
        })
    });
    // Grab all the read queues in parallel
    await parallelQuery(client, readQueueQueries, (res) => calculateReadQueueStats(res, botDashboardStats, {
        buckets,
        startTime,
        endTime,
        currentBucketTimestamp,
        prevBucketTimestamp,
        bucketArrayIndex,
        timestamp: params.timestamp,
        botState,
    }));

    let source = (botState.lambda && botState.lambda.settings && botState.lambda.settings[0] && botState.lambda.settings[0].source)!;
    botDashboardStats.kinesis_number = botState.checkpoints && botState.checkpoints.read && botState.checkpoints.read[source] && botState.checkpoints.read[source].checkpoint;
    if (!botDashboardStats.kinesis_number) {
        botDashboardStats.kinesis_number = Object.keys(botState.checkpoints && botState.checkpoints.read || {}).map(b => botState.checkpoints?.read?.[b]?.checkpoint).filter(c => !!c).sort().pop() as string;
    }

    // Add other queues that the bot checkpointed against but hasn't had any stats for
    const checkpoints = botState.checkpoints || {};

    ["read", "write"].map(type => {
        Object.keys(checkpoints[type as CheckpointType] || {}).map(key => {
            let id = key.replace(/^[seb]_/, "");
            let queue = botDashboardStats.queues[type as CheckpointType]?.[id];
            if(!queue) {
                let data = checkpoints[type as CheckpointType]?.[key];
                if(data) {
                    botDashboardStats.queues[type as CheckpointType]![id] = generateQueueData(id, type as CheckpointType, {
                        timestamp: data.ended_timestamp!,
                        checkpoint: data.checkpoint!,
                        source_timestamp: data.source_timestamp!,
                        units: 0,
                    }, params.timestamp, buckets);
                }
            }
        })
    })

    //Insert averages to missing values in the queue_lag and source_lag
    // And if the first/last entries are missing we should do a linear regresssion to approximate the values
    Object.keys(botDashboardStats.queues.read!).map(key => {
        approximateMissingLagValues(botDashboardStats.queues.read![key].source_lags);
        approximateMissingLagValues(botDashboardStats.queues.read![key].queue_lags);
    })

    return botDashboardStats;
}

/**
 * Get dashboard stats for a queue or system node.
 * Queries the stats table for the queue/system ID, discovers which bots read/write,
 * and returns data shaped for the queue dashboard tab.
 *
 * Mirrors the old_ui's `queueDashboard()` function.
 */
export async function getQueueDashboardStats(creds: AwsCreds, params: DashboardStatsRequest) {
    const client = createDynamoClient(creds);
    const range = ranges[params.range].rolling ? ranges[params.range].rolling! : ranges[params.range];
    const bucketUtils = bucketsData[range.period];

    const currentBucketTimestamp = bucketUtils.prev(new Date(params.timestamp), 1 * range.count).valueOf();
    const prevBucketTimestamp = bucketUtils.prev(new Date(params.timestamp), 2 * range.count).valueOf();
    const startTimeStamp = bucketUtils.prev(new Date(params.timestamp), 3 * range.count);

    const startTime = bucketUtils.value(startTimeStamp);
    const endTime = bucketUtils.value(new Date(params.timestamp));
    const formattedStartTime = bucketUtils.transform(startTime);
    const formattedEndTime = bucketUtils.transform(endTime);

    const buckets: number[] = [];
    let c = startTime;
    const bucketArrayIndex: Record<string, number> = {};
    let count = 0;
    while (c <= endTime) {
        const t = bucketUtils.value(c).valueOf();
        buckets.push(t);
        bucketArrayIndex[t] = count++;
        c = bucketUtils.next(c, 1);
    }

    const statsId = toStatsId(params.id, params.id.startsWith('system:') ? 'system' : 'queue');

    const statsQuery = new QueryCommand({
        TableName: LEO_STATS_TABLE(),
        KeyConditionExpression: "#id = :id AND #bucket BETWEEN :start AND :end",
        ExpressionAttributeNames: { "#id": "id", "#bucket": "bucket" },
        ExpressionAttributeValues: marshall({ ":id": statsId, ":start": formattedStartTime, ":end": formattedEndTime }),
    });

    // Run stats query and cron scan in parallel
    const [statsItems, allBots] = await Promise.all([
        parallelQuery(client, [statsQuery], (res) =>
            res.Items?.map(item => unmarshall(item) as StatsDynamoRecord) ?? []
        ).then(results => results.flat()),
        getRelationShips(creds),
    ]);

    // Build result
    const result = {
        reads: buckets.map(time => ({ value: 0, time })),
        writes: buckets.map(time => ({ value: 0, time })),
        read_lag: buckets.map(time => ({ value: 0, time, count: 0 })),
        write_lag: buckets.map(time => ({ value: 0, time, count: 0 })),
        bots: { read: {} as Record<string, any>, write: {} as Record<string, any> },
        compare: {
            reads: { prev: 0, current: 0, change: "0%" },
            writes: { prev: 0, current: 0, change: "0%" },
        },
        start: startTime.valueOf(),
        end: endTime.valueOf(),
        currentBucketStart: currentBucketTimestamp,
        buckets,
    };

    function makeBotEntry(key: string, type: string) {
        return {
            id: key, event: params.id, label: key, type,
            values: buckets.map(time => ({ value: 0, time })),
            lagEvents: 0,
            last_read: 0, last_write: 0,
            last_read_lag: 0, last_write_lag: 0,
            last_read_event_timestamp: 0, last_write_event_timestamp: 0,
            last_event_source_timestamp: 0, last_event_source_timestamp_lag: 0,
            compare: {
                reads: { prev: 0, current: 0, change: "0%" },
                writes: { prev: 0, current: 0, change: "0%" },
            },
            checkpoint: "", timestamp: 0,
        };
    }

    // Process stats records
    for (const stat of statsItems) {
        const index = bucketArrayIndex[stat.time!];
        if (index === undefined) continue;

        for (const type of ["read", "write"] as const) {
            const typeS = `${type}s` as "reads" | "writes";
            const record = stat.current?.[type];
            if (!record) continue;

            for (const [key, link] of Object.entries(record)) {
                result[typeS][index].value += link.units;

                // Accumulate lag per bucket (average across bots in this bucket)
                const lagKey = `${type}_lag` as "read_lag" | "write_lag";
                const linkLag = (link.timestamp - link.source_timestamp) || 0;
                result[lagKey][index].value += linkLag;
                result[lagKey][index].count++;

                if (!(key in result.bots[type])) {
                    result.bots[type][key] = makeBotEntry(key, type);
                }
                const bot = result.bots[type][key];
                bot.values[index].value += link.units;

                bot[`last_${type}`] = link.timestamp;
                bot.last_event_source_timestamp = link.source_timestamp;
                bot[`last_${type}_lag`] = params.timestamp - link.timestamp;
                bot.last_event_source_timestamp_lag = params.timestamp - link.source_timestamp;

                const cpParts = link.checkpoint?.split(/\//)?.pop()?.split(/-/);
                if (cpParts?.[0]) bot[`last_${type}_event_timestamp`] = parseInt(cpParts[0]);
                bot.checkpoint = link.checkpoint;

                if (stat.time! >= prevBucketTimestamp && stat.time! < currentBucketTimestamp) {
                    bot.compare[typeS].prev += link.units;
                } else if (stat.time! >= currentBucketTimestamp) {
                    bot.compare[typeS].current += link.units;
                }
            }
        }
    }

    // Compute compare changes for bots
    for (const type of ["read", "write"] as const) {
        const typeS = `${type}s` as "reads" | "writes";
        for (const bot of Object.values(result.bots[type]) as any[]) {
            bot.compare[typeS].change = calcChange(bot.compare[typeS].current, bot.compare[typeS].prev);
        }
    }

    // Queue-level compare
    for (const entry of result.reads) {
        if (entry.time >= prevBucketTimestamp && entry.time < currentBucketTimestamp) result.compare.reads.prev += entry.value;
        else if (entry.time >= currentBucketTimestamp) result.compare.reads.current += entry.value;
    }
    for (const entry of result.writes) {
        if (entry.time >= prevBucketTimestamp && entry.time < currentBucketTimestamp) result.compare.writes.prev += entry.value;
        else if (entry.time >= currentBucketTimestamp) result.compare.writes.current += entry.value;
    }
    result.compare.reads.change = calcChange(result.compare.reads.current, result.compare.reads.prev);
    result.compare.writes.change = calcChange(result.compare.writes.current, result.compare.writes.prev);

    // Average out lag values per bucket
    for (const lagArr of [result.read_lag, result.write_lag]) {
        for (const entry of lagArr) {
            if (entry.count > 0) {
                entry.value = Math.round(entry.value / entry.count);
            }
        }
    }

    // Add bots from cron table that checkpoint against this queue but had no stats in this window
    const rawId = params.id.replace(/^(queue|system):/, "");
    for (const bot of allBots) {
        if (bot.archived) continue;
        const checkpoints = bot.checkpoints || {};
        for (const type of ["read", "write"] as const) {
            const cp = checkpoints[type as CheckpointType] || {};
            const match = cp[rawId] || cp[statsId];
            if (match && !(bot.id in result.bots[type])) {
                const entry = makeBotEntry(bot.id, type);
                if (match.ended_timestamp) {
                    entry[`last_${type}`] = match.ended_timestamp;
                    entry[`last_${type}_lag`] = params.timestamp - match.ended_timestamp;
                }
                if (match.checkpoint) entry.checkpoint = match.checkpoint;
                result.bots[type][bot.id] = entry;
            }
        }
    }

    return result;
}

export async function getSettings(creds: AwsCreds, id: string): Promise<DashboardSettings> {

    if (id.startsWith('queue:') || id.startsWith('system:')) {
        return await getQueueSettings(creds, id) as DashboardSettings;
    }

    return await getBotState(creds, id) as DashboardSettings;

}


export async function parallelQuery<T>(client: DynamoDBClient, queries: QueryCommand[], mergeFn: (res: QueryOutput) => T): Promise<T[]> {
    if (queries.length < 1) {
        return [];
    }

    let requests = [];

    for (const query of queries) {
        requests.push(client.send(query));
    }

    const results = await Promise.all(requests);
    // console.log("results", results);

    return results.map(mergeFn);

}

export interface ScanOpts {
    tableName: string,
    returnConsumedCapacity?: ReturnConsumedCapacity;
}

export async function parallelScan<T>(client: DynamoDBClient, opts: ScanOpts, segments: number) {
    const docClient = DynamoDBDocumentClient.from(client);
    const input: ScanCommandInput = {
        TableName: opts.tableName,
        ReturnConsumedCapacity: opts.returnConsumedCapacity,
    };

    let requests = [];

    for (let i = 0; i < segments; i++) {
        input.TotalSegments = segments;
        input.Segment = i;
        requests.push(scan(docClient,input));
    }

    return Promise.all(requests).then(data => {
        let response = data.reduce((all, one) => {
            all.Items = all.Items.concat(one.Items!);
            all.ScannedCount += one.ScannedCount!;
            all.Count += one.Count!;
            return all;
        }, {
            Items: [] as Record<string, NativeAttributeValue>[],
            ScannedCount: 0,
            Count: 0
        });
        return response.Items as T[];
    });


    
}

async function getBotState(creds: AwsCreds, id: string): Promise<BotSettings> {
    const client = createDynamoClient(creds);
    const docClient = DynamoDBDocumentClient.from(client);
    const command = new GetCommand({
        TableName: LEO_CRON_TABLE(),
        Key: { id: id.replace(/^bot:/, "") }
    });
    const response = await docClient.send(command);

    if(!response.Item) {
        throw new Error(`Bot ${id} not found in the cron table`);
    }

    return response.Item as BotSettings;
}

async function getQueueSettings(creds: AwsCreds, id: string): Promise<QueueSettings> {
    const client = createDynamoClient(creds);
    const docClient = DynamoDBDocumentClient.from(client);
    const command = new GetCommand({
        TableName: LEO_EVENT_TABLE(),
        Key: { event: id.replace(queueSystemReplaceRegex, "") }
    });
    const response = await docClient.send(command);

    if(!response.Item) {
        throw new Error(`Queue ${id} not found in the event table`);
    }

    return response.Item as QueueSettings;
}

async function scan(client: DynamoDBDocumentClient, input: ScanCommandInput): Promise<ScanCommandOutput> {
     try {
        let response: ScanCommandOutput | null = null;
        do {
            if(response?.LastEvaluatedKey) {
                input.ExclusiveStartKey = response.LastEvaluatedKey;
            }
            const command = new ScanCommand(input);
    
            const response2: ScanCommandOutput = await client.send(command);
            if(!response) {
                response = response2
            } else {
                response.LastEvaluatedKey = response2.LastEvaluatedKey;
                response.Items = (response.Items?? []).concat(response2.Items ?? [])
            }
            

        } while(response.LastEvaluatedKey != null)

        return response;


    } catch (err) {
        throw new Error(`scan failed for ${input.TableName}:  ${err}`);
    } 
}
