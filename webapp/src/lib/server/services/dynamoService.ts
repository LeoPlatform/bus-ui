import { LEO_STATS_TABLE } from "$env/static/private";
import { createDynamoClient } from "$lib/server/aws_utils";
import { getLeoCronTable } from "$lib/server/utils";
import { botDetailLoading, botDetailError, botDetailStore } from "$lib/stores/botDetailStore";
import { statsDetailLoading } from "$lib/stores/statsDetailStore";
import type { AwsCreds, BotSettings, CheckpointType, DashboardStats, DashboardStatsRequest, MergedStatsRecord, StatsDynamoRecord, StatsQueryRequest, StatsRecord } from "$lib/types";
import { DynamoDBClient, QueryCommand, ReturnConsumedCapacity, type QueryOutput } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, type NativeAttributeValue, type ScanCommandInput, type ScanCommandOutput } from "@aws-sdk/lib-dynamodb";
import { bucketsData, ranges } from "$lib/bucketUtils";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { calcChange, generateQueueData, mergeStatsResults } from "$lib/stats/utils";
import { error } from "@sveltejs/kit";



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
    // const endTime = params.endTime ? bucketUtils.value(new Date(params.endTime)) : bucketUtils.next(new Date(params.startTime), params.count);
    // const startTime = params.endTime ? bucketUtils.value(new Date(params.startTime)) : bucketUtils.prev(endTime, params.count);

    // console.log("startTime", startTime, "endTime", endTime);

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
    const bucketUtils = bucketsData[params.range];
    const range = ranges[params.range];

    // current bucket of time inclusive (eg. 15minutes before ->  now)
    const currentBucketTimestamp = bucketUtils.prev(new Date(params.timestamp), 1 * range.count).valueOf();
    // previous bucket of time (eg. 30minutes before -> 15minutes before)
    const prevBucketTimestamp = bucketUtils.prev(new Date(params.timestamp), 2 * range.count).valueOf();


    const startTime = bucketUtils.prev(new Date(params.timestamp), range.count * 3);
    const endTime = bucketUtils.value(new Date(params.timestamp));

    const formattedStartTime = bucketUtils.transform(startTime);
    const formattedEndTime = bucketUtils.transform(endTime);

    console.log(`RAW: ${startTime} | ${endTime} | ${params.timestamp}`);
    console.log(`NEW: ${formattedStartTime} | ${formattedEndTime}`);

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

    const response = await client.send(comand);
    const items = response.Items?.map(item => unmarshall(item) as StatsDynamoRecord);

    if (!items) {
        throw error(400, "No stats found for the given id");
    } else {
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
            let index = bucketArrayIndex[stat.time!];

            if (stat.current?.execution) {
                let exec = stat.current.execution;
                botDashboardStats.executions[index].value = exec.units;
                botDashboardStats.errors[index].value = exec.errors;
                botDashboardStats.duration[index] = {
                    value: exec.duration / exec.units,
                    total: exec.duration,
                    min: exec.min_duration,
                    max: exec.max_duration,
                    time: stat.time!,
                };

                //TODO: check on this logic. Old ui uses a range of different timestamps rather than just using the start and end time.
                if (stat.time! >= prevBucketTimestamp && stat.time! < currentBucketTimestamp){
                    botDashboardStats.compare.executions.prev += botDashboardStats.executions[index].value;
                    botDashboardStats.compare.errors.prev += botDashboardStats.errors[index].value;
                    botDashboardStats.compare.duration.prev += botDashboardStats.duration[index].total;
                } else if (stat.time! >= currentBucketTimestamp){
                    botDashboardStats.compare.executions.current += botDashboardStats.executions[index].value;
                    botDashboardStats.compare.errors.current += botDashboardStats.errors[index].value;
                    botDashboardStats.compare.duration.current += botDashboardStats.duration[index].total;
                }
            }

            ["read", "write"].map(type => {
                if (stat.current?.[type as CheckpointType]) {
                    let statCurrent: StatsRecord = stat.current?.[type as CheckpointType]!;

                    Object.keys(statCurrent).forEach((queueId) => {
                        let link = statCurrent[queueId];
                        const checkpoint = link.checkpoint && link.checkpoint.split(/\//).pop()?.split(/\-/)[0]!;

                        if (!(queueId in botDashboardStats.queues[type as CheckpointType]!)) {
                            botDashboardStats.queues[type as CheckpointType]![queueId] = generateQueueData(queueId, type as CheckpointType, link, params.timestamp, buckets);
                        }

                        const queue = botDashboardStats.queues[type as CheckpointType]![queueId];

                        queue.lags[index].value += (link.timestamp - link.source_timestamp) || 0;
                        if (type === "write") {
                            queue.values[index].value += link.units;
                        } else {
                            queue.reads![index].value += link.units;
                        }

                        if(stat.time! >= prevBucketTimestamp && stat.time! < currentBucketTimestamp){
                            if(type === "write"){
                                queue.compare.writes!.prev += link.units
                                queue.compare.write_lag!.prev += (link.timestamp - link.source_timestamp) || 0;
                                queue.compare.write_lag!.prevCount++;
                            } else {
                                queue.compare.reads!.prev += link.units;
                                queue.compare.read_lag!.prev += (link.timestamp - link.source_timestamp) || 0;
                                queue.compare.read_lag!.prevCount++;
                            }

                        } else if(stat.time! >= currentBucketTimestamp){
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

                    })
                }
            });

            if(botDashboardStats.compare.executions.current) {
                botDashboardStats.compare.duration.current /= botDashboardStats.compare.executions.current;
            }
            if(botDashboardStats.compare.executions.prev) {
                botDashboardStats.compare.duration.prev /= botDashboardStats.compare.executions.prev;
            }
            botDashboardStats.compare.executions.change = calcChange(botDashboardStats.compare.executions.current, botDashboardStats.compare.executions.prev);
            botDashboardStats.compare.errors.change = calcChange(botDashboardStats.compare.errors.current, botDashboardStats.compare.errors.prev);
            botDashboardStats.compare.duration.change = calcChange(botDashboardStats.compare.duration.current, botDashboardStats.compare.duration.prev);

            ["read", "write"].map(type => {
                Object.keys(botDashboardStats.queues[type as CheckpointType]!).map(key => {
                    let link = botDashboardStats.queues[type as CheckpointType]![key];

                    if (type === "write"){
                        if(link.compare.write_lag!.currentCount) {
                            link.compare.write_lag!.current /= link.compare.write_lag!.currentCount;
                        }
                        if(link.compare.write_lag!.prevCount) {
                            link.compare.write_lag!.prev /= link.compare.write_lag!.prevCount;
                        }
                        link.compare.write_lag!.change = calcChange(link.compare.write_lag!.current, link.compare.write_lag!.prev);
                        link.compare.writes!.change = calcChange(link.compare.writes!.current, link.compare.writes!.prev);
                    } else {
                        if(link.compare.read_lag!.currentCount) {
                            link.compare.read_lag!.current /= link.compare.read_lag!.currentCount;
                        }
                        if(link.compare.read_lag!.prevCount) {
                            link.compare.read_lag!.prev /= link.compare.read_lag!.prevCount;
                        }
                        link.compare.read_lag!.change = calcChange(link.compare.read_lag!.current, link.compare.read_lag!.prev);
                        link.compare.reads!.change = calcChange(link.compare.reads!.current, link.compare.reads!.prev);
                    }
                })
            })

        });
        
        
        return botDashboardStats;
    }
    
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
