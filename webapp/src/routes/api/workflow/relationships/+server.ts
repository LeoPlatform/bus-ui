import { getRelationShips } from "$lib/server/services/dynamoService";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/utils";

export const GET: RequestHandler = async ({ locals }) => {
  const session = await getSession(locals);

  if (session instanceof Response) {
    return session;
  }

  const relationship = await getRelationShips(session.aws_credentials!);

  return json({ botData: relationship });
};
