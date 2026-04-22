import {
  getRelationShips,
  scanLeoEventQueues,
  scanLeoSystems,
} from "$lib/server/services/dynamoService";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/utils";
import { perf } from "$lib/server/perf";

export const GET: RequestHandler = async ({ locals }) => {
  const end = perf.start('GET /api/workflow/relationships');
  const session = await getSession(locals);

  if (session instanceof Response) {
    return session;
  }

  const creds = session.aws_credentials!;
  const [botData, queueData, systemData] = await Promise.all([
    perf.time('getRelationShips', () => getRelationShips(creds)),
    perf.time('scanLeoEventQueues', () => scanLeoEventQueues(creds)),
    perf.time('scanLeoSystems', () => scanLeoSystems(creds)),
  ]);

  end();
  return json({ botData, queueData, systemData });
};
