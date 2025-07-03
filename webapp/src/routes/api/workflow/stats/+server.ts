import { getStats } from "$lib/server/services/dynamoService";
import type { StatsApiResponse, StatsQueryRequest } from "$lib/types";
import { json, type RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ locals, request }) => {
  const session = await locals.auth();

  if (!session?.user || !session.aws_credentials) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
    });
  }

  const requestBody: StatsQueryRequest  = await request.json();

  if (!requestBody.nodeIds) {
    return new Response(JSON.stringify({ error: "node_ids are required to get stats" }), {
      status: 400,
    });
  }

  console.log("requestBody", requestBody);

  return json({stats: await getStats(session.aws_credentials, requestBody)} as StatsApiResponse);
};
