import { LEO_STATS_TABLE } from "$env/static/private";
import { createDynamoClient } from "$lib/server/aws_utils";
import { getLeoCronTable } from "$lib/server/utils";
import { botDetailLoading, botDetailError, botDetailStore } from "$lib/stores/botDetailStore";
import { statsDetailLoading } from "$lib/stores/statsDetailStore";
import type { AwsCreds, BotSettings, MergedStatsRecord, StatsQueryRequest } from "$lib/types";
import { DynamoDBClient, QueryCommand, type QueryOutput } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, type ScanCommandOutput } from "@aws-sdk/lib-dynamodb";
import { bucketsData, ranges } from "$lib/bucketUtils";
import { marshall } from "@aws-sdk/util-dynamodb";
import { mergeStatsResults } from "$lib/stats/utils";



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

    const range = ranges[params.range];
    
    const bucketUtils = bucketsData[params.range];


    const endTime = bucketUtils.next(new Date(params.timestamp), params.count);
    const startTime = bucketUtils.prev(endTime, params.count);

    const expressionAttributeValues: Record<string, string> = {
        ":start": bucketUtils.transform(startTime),
        ":end": bucketUtils.transform(endTime)
    };

    try {

        const queries = [];
        for (const id of params.node_ids) {
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


