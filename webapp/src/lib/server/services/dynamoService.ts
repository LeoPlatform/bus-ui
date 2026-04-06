import { env } from '$env/dynamic/private';
const LEO_CRON_TABLE = () => env.LEO_CRON_TABLE ?? process.env.LEO_CRON_TABLE ?? '';
const LEO_EVENT_TABLE = () => env.LEO_EVENT_TABLE ?? process.env.LEO_EVENT_TABLE ?? '';
const LEO_STATS_TABLE = () => env.LEO_STATS_TABLE ?? process.env.LEO_STATS_TABLE ?? '';
const LEO_SYSTEM_TABLE = () => env.LEO_SYSTEM_TABLE ?? process.env.LEO_SYSTEM_TABLE ?? '';
import { createDynamoClient } from "$lib/server/aws_utils";
import { getLeoCronTable } from "$lib/server/utils";
import type { AwsCreds, BotSettings, CheckpointType, DashboardStats, DashboardStatsRequest, MergedStatsRecord, QueueSettings, StatsDynamoRecord, StatsQueryRequest, StatsRecord, SystemSettings } from "$lib/types";
import { DynamoDBClient, QueryCommand, ReturnConsumedCapacity, type QueryOutput } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, type NativeAttributeValue, type ScanCommandInput, type ScanCommandOutput } from "@aws-sdk/lib-dynamodb";
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
const CRON_SCAN_SEGMENTS = 4;

// Only fetch the fields the client actually reads — reduces 13MB → ~2-3MB for 8000+ bots.
// 'name' and 'status' are DynamoDB reserved words so they need expression attribute names.
const BOT_PROJECTION = 'id, #n, lambdaName, tags, archived, #h, checkpoints, paused, errorCount, #s, isAlarmed, alarms, rogue, alarmed, latest_write';
const BOT_PROJECTION_NAMES: Record<string, string> = {
    '#n': 'name',
    '#h': 'health',
    '#s': 'status',
};

export async function getRelationShips(creds: AwsCreds): Promise<BotSettings[]> {
    const client = createDynamoClient(creds);
    const table = getLeoCronTable();
    console.log("getRelationShips: using table", table);

    try {
        const items = await parallelScan<BotSettings>(client, {
            tableName: table,
            projectionExpression: BOT_PROJECTION,
            expressionAttributeNames: BOT_PROJECTION_NAMES,
        }, CRON_SCAN_SEGMENTS);
        console.log("getRelationShips: fetched", items.length, "items");

        // Strip checkpoint values — the client only needs the queue ID keys
        // to build the relationship tree, not the full checkpoint objects.
        // This can cut the payload by 50%+ on large buses.
        for (const bot of items) {
            if (bot.checkpoints) {
                for (const type of ['read', 'write'] as const) {
                    const cp = bot.checkpoints[type];
                    if (cp && typeof cp === 'object') {
                        const slim: Record<string, boolean> = {};
                        for (const key of Object.keys(cp)) {
                            slim[key] = true;
                        }
                        (bot.checkpoints as any)[type] = slim;
                    }
                }
            }
        }

        return items;
    } catch (err) {
        console.error('Failed retrieving bot information from dynamo ', err);
        return [];
    }
}

async function scanTableAllItems(
    docClient: DynamoDBDocumentClient,
    tableName: string,
    projectionExpression?: string,
    expressionAttributeNames?: Record<string, string>,
): Promise<Record<string, unknown>[]> {
    if (!tableName) return [];
    const items: Record<string, unknown>[] = [];
    let lek: Record<string, NativeAttributeValue> | undefined;
    do {
        const input: any = {
            TableName: tableName,
            ExclusiveStartKey: lek,
        };
        if (projectionExpression) input.ProjectionExpression = projectionExpression;
        if (expressionAttributeNames) input.ExpressionAttributeNames = expressionAttributeNames;
        const out = await docClient.send(new ScanCommand(input));
        items.push(...((out.Items ?? []) as Record<string, unknown>[]));
        lek = out.LastEvaluatedKey;
    } while (lek);
    return items;
}

/** Full Leo event table scan for catalog (queues). Only fetch fields the client reads. */
export async function scanLeoEventQueues(creds: AwsCreds): Promise<QueueSettings[]> {
    const client = createDynamoClient(creds);
    const docClient = DynamoDBDocumentClient.from(client);
    const table = LEO_EVENT_TABLE();
    try {
        const rows = await scanTableAllItems(
            docClient, table,
            'event, #n, archived, #o',
            { '#n': 'name', '#o': 'other' },
        );
        return rows as QueueSettings[];
    } catch (err) {
        console.error("scanLeoEventQueues failed", err);
        return [];
    }
}

/** Full Leo system table scan for catalog (systems). Only fetch fields the client reads. */
export async function scanLeoSystems(creds: AwsCreds): Promise<SystemSettings[]> {
    const client = createDynamoClient(creds);
    const docClient = DynamoDBDocumentClient.from(client);
    const table = LEO_SYSTEM_TABLE();
    try {
        const rows = await scanTableAllItems(
            docClient, table,
            'id, #l, archived',
            { '#l': 'label' },
        );
        return rows as SystemSettings[];
    } catch (err) {
        console.error("scanLeoSystems failed", err);
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

    const statsItems = await parallelQuery(client, [statsQuery], (res) =>
        res.Items?.map(item => unmarshall(item) as StatsDynamoRecord) ?? []
    ).then(results => results.flat());

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

    // Note: previously this did a full cron table scan (getRelationShips) to find
    // bots with checkpoints against this queue but zero stats in the time window.
    // On large buses (8000+ bots) that scan took 5+ seconds per request. Removed —
    // the queue dashboard now only shows bots that had actual activity in the window.

    return result;
}

export async function getSettings(creds: AwsCreds, id: string): Promise<DashboardSettings> {

    if (id.startsWith('queue:') || id.startsWith('system:')) {
        return await getQueueSettings(creds, id) as DashboardSettings;
    }

    return await getBotState(creds, id) as DashboardSettings;

}


const PARALLEL_LIMIT = 25;

export async function parallelQuery<T>(client: DynamoDBClient, queries: QueryCommand[], mergeFn: (res: QueryOutput) => T): Promise<T[]> {
    if (queries.length < 1) {
        return [];
    }

    const results: T[] = [];

    // Process in batches to avoid socket exhaustion on large buses
    for (let i = 0; i < queries.length; i += PARALLEL_LIMIT) {
        const batch = queries.slice(i, i + PARALLEL_LIMIT);
        const batchResults = await Promise.all(batch.map(q => client.send(q)));
        results.push(...batchResults.map(mergeFn));
    }

    return results;
}

export interface ScanOpts {
    tableName: string,
    returnConsumedCapacity?: ReturnConsumedCapacity;
    projectionExpression?: string;
    expressionAttributeNames?: Record<string, string>;
}

export async function parallelScan<T>(client: DynamoDBClient, opts: ScanOpts, segments: number) {
    const docClient = DynamoDBDocumentClient.from(client);

    const requests = [];
    for (let i = 0; i < segments; i++) {
        // Each segment gets its own input object to avoid shared-mutation bugs
        const input: ScanCommandInput = {
            TableName: opts.tableName,
            ReturnConsumedCapacity: opts.returnConsumedCapacity,
            TotalSegments: segments,
            Segment: i,
        };
        if (opts.projectionExpression) {
            input.ProjectionExpression = opts.projectionExpression;
        }
        if (opts.expressionAttributeNames) {
            input.ExpressionAttributeNames = opts.expressionAttributeNames;
        }
        requests.push(scan(docClient, input));
    }

    const data = await Promise.all(requests);
    const items: Record<string, NativeAttributeValue>[] = [];
    for (const d of data) {
        if (d.Items) items.push(...d.Items);
    }
    return items as T[];
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

/**
 * Save bot settings updates to the LeoCron table.
 * updates can include top-level fields (archived, paused) and a nested health object.
 */
export async function saveBotSettings(creds: AwsCreds, id: string, updates: Record<string, any>): Promise<void> {
    const client = createDynamoClient(creds);
    const docClient = DynamoDBDocumentClient.from(client);
    const botId = id.replace(/^bot:/, "");

    // Fetch existing item so we can merge safely (avoids conditional expression complexity)
    const existing = await docClient.send(new GetCommand({
        TableName: LEO_CRON_TABLE(),
        Key: { id: botId }
    }));

    const current = existing.Item ?? { id: botId };

    // Deep-merge: merge health sub-object if present
    const updated: Record<string, any> = { ...current };
    for (const [k, v] of Object.entries(updates)) {
        if (k === 'health' && v && typeof v === 'object') {
            updated.health = { ...(current.health ?? {}), ...v };
        } else {
            updated[k] = v;
        }
    }

    await docClient.send(new PutCommand({
        TableName: LEO_CRON_TABLE(),
        Item: updated,
    }));
}

/**
 * Save queue settings updates to the LeoEvent table.
 */
export async function saveQueueSettings(creds: AwsCreds, id: string, updates: Record<string, any>): Promise<void> {
    const client = createDynamoClient(creds);
    const docClient = DynamoDBDocumentClient.from(client);
    const queueId = id.replace(queueSystemReplaceRegex, "");

    const existing = await docClient.send(new GetCommand({
        TableName: LEO_EVENT_TABLE(),
        Key: { event: queueId }
    }));

    const current = existing.Item ?? { event: queueId };
    const updated: Record<string, any> = { ...current };
    for (const [k, v] of Object.entries(updates)) {
        if (k === 'other' && v && typeof v === 'object' && !Array.isArray(v)) {
            updated.other = { ...(current.other ?? {}), ...v };
        } else {
            updated[k] = v;
        }
    }

    await docClient.send(new PutCommand({
        TableName: LEO_EVENT_TABLE(),
        Item: updated,
    }));
}

/**
 * Save system settings updates to the LeoSystem table.
 */
export async function saveSystemSettings(creds: AwsCreds, id: string, updates: Record<string, any>): Promise<void> {
    const client = createDynamoClient(creds);
    const docClient = DynamoDBDocumentClient.from(client);
    const sysId = id.replace(/^system:/, "");

    const existing = await docClient.send(new GetCommand({
        TableName: LEO_SYSTEM_TABLE(),
        Key: { id: sysId }
    }));

    const current = existing.Item ?? { id: sysId };
    const updated: Record<string, any> = { ...current };
    for (const [k, v] of Object.entries(updates)) {
        if (k === 'settings' && v && typeof v === 'object') {
            updated.settings = { ...(current.settings ?? {}), ...v };
        } else {
            updated[k] = v;
        }
    }

    await docClient.send(new PutCommand({
        TableName: LEO_SYSTEM_TABLE(),
        Item: updated,
    }));
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
