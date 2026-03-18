import type { SearchItem } from '$lib/client/components/features/search-bar/types';
import { createDynamoClient } from '$lib/server/aws_utils';
import { getSession } from '$lib/server/utils';
import { type SystemSettings, type AwsCreds, type BotSettings, type QueueSettings } from '$lib/types';
import type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { RequestHandler } from './$types';
import * as async from 'async';
import { parallelScan } from '$lib/server/services/dynamoService';
import { env } from '$env/dynamic/private';
const LEO_CRON_TABLE = () => env.LEO_CRON_TABLE ?? process.env.LEO_CRON_TABLE ?? '';
const LEO_EVENT_TABLE = () => env.LEO_EVENT_TABLE ?? process.env.LEO_EVENT_TABLE ?? '';
const LEO_SYSTEM_TABLE = () => env.LEO_SYSTEM_TABLE ?? process.env.LEO_SYSTEM_TABLE ?? '';
import { json } from '@sveltejs/kit';
import { promisify } from 'util';

const parallelAsync = promisify(async.parallel);

export const GET: RequestHandler = async ({locals}) => {
 const session = await getSession(locals);

  if (session instanceof Response) {
    return session;
  }

  let searchItems = await getResources(session.aws_credentials!);
  // console.log('search items', searchItems.length);

  return json({items: searchItems})
  
};

async function getResources(creds: AwsCreds): Promise<SearchItem[]> {
  const client = createDynamoClient(creds);
  
  return new Promise((resolve, reject) => {
    async.parallel<SearchItem[], Error>({
      systems: async () => fetchSystemData(client),
      queues: async () => fetchQueueData(client),
      bots: async () => fetchBotData(client),
    }, (err, results) => {
      if (err) {
        console.error('Error fetching data:', err);
        reject(err);
        return;
      }

      // console.log('results.systems', results.systems?.length);
      // console.log('results.queues', results.queues?.length);
      // console.log('results.bots', results.bots?.length);

      // Fix: Use spread operator to concatenate arrays
      const arr: SearchItem[] = [
        ...(Array.isArray(results.systems) ? results.systems : []),
        ...(Array.isArray(results.queues) ? results.queues : []),
        ...(Array.isArray(results.bots) ? results.bots : [])
      ];

      let newArr = arr.filter((res) => {
        if(!(res.id.match(/\/_archive$/g) || res.id.match(/\/_snapshot$/g))) {
          return res;
        }
      })
      
      // console.log('arr', arr.length);
      resolve(newArr);
    });
  });
}

async function fetchSystemData(client: DynamoDBClient): Promise<SearchItem[]> {
  return parallelScan<SystemSettings>(
    client,
    {
      tableName: LEO_SYSTEM_TABLE(),
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
        tableName: LEO_CRON_TABLE(),
        returnConsumedCapacity: "TOTAL",
      },
      100
    ).then(data => data.filter(val => !val.archived).map((val) => {
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
        tableName: LEO_EVENT_TABLE(),
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