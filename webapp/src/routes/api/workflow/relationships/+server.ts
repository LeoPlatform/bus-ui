import { getRelationShips } from "$lib/server/services/dynamoService";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/utils";

export const GET: RequestHandler = async ({ locals }) => {
  console.log("/api/workflow/relationships GET called");
  const session = await getSession(locals);

  if (session instanceof Response) {
    console.log("/api/workflow/relationships GET returning session response", session.status);
    return session;
  }

  console.log("/api/workflow/relationships GET calling getRelationShips");
  const relationship = await getRelationShips(session.aws_credentials!);

  return json({ botData: relationship });
};
