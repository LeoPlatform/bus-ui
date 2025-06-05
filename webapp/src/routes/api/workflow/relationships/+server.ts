import { getRelationShips } from "$lib/server/services/dynamoService";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const session = await locals.auth();

  if (!session?.user || !session.aws_credentials) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
    });
  }

  const relationship = await getRelationShips(session.aws_credentials!);

  return json({ botData: relationship });
};
