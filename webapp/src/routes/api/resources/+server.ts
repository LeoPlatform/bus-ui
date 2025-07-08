import type { SearchItem } from '$lib/client/components/features/search-bar/types';
import { createDynamoClient } from '$lib/server/aws_utils';
import { getSession } from '$lib/server/utils';
import { type SystemSettings, type AwsCreds, type BotSettings, type QueueSettings } from '$lib/types';
import type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { RequestHandler } from './$types';
import * as async from 'async';
import { parallelScan } from '$lib/server/services/dynamoService';
import { LEO_EVENT_TABLE, LEO_SYSTEM_TABLE } from '$env/static/private';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({locals}) => {
 const session = await getSession(locals);

  if (session instanceof Response) {
    return session;
  }

  let searchItems = await getResources(session.aws_credentials!);

  return json({items: searchItems})
  
};

async function getResources(creds: AwsCreds): Promise<SearchItem[]> {
  const client = createDynamoClient(creds);
  let arr: SearchItem[] = [];

   async.parallel<SearchItem[], Error>({
    systems: async () => fetchSystemData(client),
    queues: async () => fetchQueueData(client),
    bots: async () => fetchBotData(client),
  }, (err, results) => {
    if (err) {
      console.error('Error fetching data:', err);
      return;
    }


    arr.concat(results?.systems ?? [], results?.queues ?? [], results?.bots ?? []);
  })
  return arr;
}

async function fetchSystemData(client: DynamoDBClient): Promise<SearchItem[]> {
  return parallelScan<SystemSettings>(
    client,
    {
      tableName: LEO_SYSTEM_TABLE,
      returnConsumedCapacity: "TOTAL",
    },
    10
  ).then(data => data.map((val) => {
    let systems =  {
      id: val.id,
      name: val.label,
      type: 'system',
    };
    return systems;
  })).catch((err) => {return err})
}

async function fetchBotData(client: DynamoDBClient): Promise<SearchItem[]> {
  return parallelScan<BotSettings>(
      client,
      {
        tableName: LEO_SYSTEM_TABLE,
        returnConsumedCapacity: "TOTAL",
      },
      100
    ).then(data => data.map((val) => {
      let systems =  {
        id: val.id,
        name: val.name,
        type: 'bot',
      };
      return systems;
    })).catch((err) => {return err})
}

async function fetchQueueData(client: DynamoDBClient): Promise<SearchItem[]> {
  return parallelScan<QueueSettings>(
      client,
      {
        tableName: LEO_EVENT_TABLE,
        returnConsumedCapacity: "TOTAL",
      },
      100
    ).then(data => data.map((val) => {
      let systems =  {
        id: val.event,
        name: val.name,
        type: 'queue',
      };
      return systems;
    })).catch((err) => {return err})
}