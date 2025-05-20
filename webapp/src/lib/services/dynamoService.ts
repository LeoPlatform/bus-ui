import { page } from "$app/state";
import { createDynamoClient } from "$lib/server/aws_utils";
import { getLeoCronTable } from "$lib/server/utils";
import { botDetailLoading, botDetailError, botDetailStore } from "$lib/stores/botDetailStore";
import type { AwsCreds, BotSettings } from "$lib/types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, type ScanCommandOutput } from "@aws-sdk/lib-dynamodb";



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