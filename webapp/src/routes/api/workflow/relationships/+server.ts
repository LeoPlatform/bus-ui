import {
  getRelationShips,
  scanLeoEventQueues,
  scanLeoSystems,
} from "$lib/server/services/dynamoService";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/utils";

export const GET: RequestHandler = async ({ locals }) => {
  const session = await getSession(locals);

  if (session instanceof Response) {
    return session;
  }

  const creds = session.aws_credentials!;
  const [botData, queueData, systemData] = await Promise.all([
    getRelationShips(creds),
    scanLeoEventQueues(creds),
    scanLeoSystems(creds),
  ]);

  return json({ botData, queueData, systemData });
};
