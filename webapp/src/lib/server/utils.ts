import { env } from '$env/dynamic/private';


export function getLeoCronTable(): string {

    const result = env.LEO_CRON_TABLE ?? process.env.LEO_CRON_TABLE;
    if (!result) {
        throw new Error(`process.env.LEO_CRON_TABLE is not set`);
    } else {
        return result;
    }
}

export async function getSession(locals: App.Locals) {
    const session = await locals.auth();

  if (!session?.user || !session.aws_credentials) {
    // throw new Error('unauthorized');
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
    });
  }

  return session;
}
