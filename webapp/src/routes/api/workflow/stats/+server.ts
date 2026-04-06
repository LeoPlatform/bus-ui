import { getStats } from "$lib/server/services/dynamoService";
import { getSession } from "$lib/server/utils";
import type { StatsApiResponse, StatsQueryRequest } from "$lib/types";
import { json, type RequestHandler } from "@sveltejs/kit";
import { perf } from "$lib/server/perf";

export const POST: RequestHandler = async ({ locals, request }) => {
  const session = await getSession(locals);

  if (session instanceof Response) {
    return session;
  }

  const requestBody: StatsQueryRequest  = await request.json();

  if (!requestBody.nodeIds) {
    return new Response(JSON.stringify({ error: "node_ids are required to get stats" }), {
      status: 400,
    });
  }

  const stats = await perf.time(`POST /api/workflow/stats (${requestBody.nodeIds.length} ids)`, () =>
    getStats(session.aws_credentials!, requestBody)
  );

  return json({stats} as StatsApiResponse);
};
