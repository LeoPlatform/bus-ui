import { LEO_CRON_TABLE, LEO_STATS_TABLE } from "$env/static/private";
import { createDynamoClient } from "$lib/server/aws_utils";
import { getLeoCronTable } from "$lib/server/utils";
import { botDetailLoading, botDetailError, botDetailStore } from "$lib/stores/botDetailStore";
import { statsDetailLoading } from "$lib/stores/statsDetailStore";
import type { AwsCreds, BotSettings, CheckpointType, DashboardStats, DashboardStatsRequest, MergedStatsRecord, StatsDynamoRecord, StatsQueryRequest, StatsRecord } from "$lib/types";
import { DynamoDBClient, QueryCommand, ReturnConsumedCapacity, type QueryOutput } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand, type NativeAttributeValue, type ScanCommandInput, type ScanCommandOutput } from "@aws-sdk/lib-dynamodb";
import { bucketsData, ranges } from "$lib/bucketUtils";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {  mergeStatsResults } from "$lib/stats/utils";
import { approximateMissingLagValues, calculateReadQueueStats, generateQueueData, mergeDynamoRecordToDashboardStats } from "../dashboard/api-utils";



//TODO: will eventually need to do the parallel scan
export async function getRelationShips(creds: AwsCreds): Promise<BotSettings[]> {
    const client = createDynamoClient(creds);
    const docClient = DynamoDBDocumentClient.from(client);


    botDetailLoading.set(true);
    botDetailError.set(null);

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
            

        } while(response.LastEvaluatedKey != null)

        botDetailStore.set(response.Items as BotSettings[] || []);
        return response.Items as BotSettings[];


    } catch (err) {
        console.error('Failed retrieving bot information from dynamo ', err);
        botDetailError.set(err);
        return [];
    } finally {
        botDetailLoading.set(false);
    }
}


export function getBotById(id: string) {
    let items: BotSettings[] = [];

    botDetailStore.subscribe( value => {
        items = value
    })();

    return items.find(item => item.id === id);
}


export async function getStats(creds: AwsCreds, params: StatsQueryRequest): Promise<MergedStatsRecord[]> {
    const client = createDynamoClient(creds);
    statsDetailLoading.set(true);
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
            expressionAttributeValues[":id"] = id;
            queries.push(new QueryCommand({
                TableName: LEO_STATS_TABLE,
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
        
    } finally {
        statsDetailLoading.set(false)
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
        TableName: LEO_STATS_TABLE,
        KeyConditionExpression: "#id = :id AND #bucket BETWEEN :start AND :end",
        ExpressionAttributeNames: {
            "#id": "id",
            "#bucket": "bucket"
        },
        ExpressionAttributeValues: marshall({ ":id": params.id, ":start": formattedStartTime, ":end": formattedEndTime })
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
            TableName: LEO_STATS_TABLE,
            KeyConditionExpression: "#id = :id AND #bucket BETWEEN :start AND :end",
            ExpressionAttributeNames: {
                "#id": "id",
                "#bucket": "bucket"
            },
            ExpressionAttributeValues: marshall({ ":id": key, ":start": formattedStartTime, ":end": formattedEndTime })
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


export async function parallelQuery<T>(client: DynamoDBClient, queries: QueryCommand[], mergeFn: (res: QueryOutput) => T): Promise<T[]> {
    if (queries.length < 1) {
        throw new Error('no queries were passed in');
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
        TableName: LEO_CRON_TABLE,
        Key: { id: id.replace(/^bot:/, "") }
    });
    const response = await docClient.send(command);

    if(!response.Item) {
        throw new Error(`Bot ${id} not found in the cron table`);
    }

    return response.Item as BotSettings;
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
