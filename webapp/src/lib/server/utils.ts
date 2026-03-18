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
  const user = locals.user;
  const provider = locals.authProvider;
  if (!user || !provider) {
    console.error("getSession: missing user or provider", { hasUser: !!user, hasProvider: !!provider });
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  let aws_credentials = (await locals.auth())?.aws_credentials;
  if (!aws_credentials && provider.getAwsCredentials) {
    const creds = await provider.getAwsCredentials(user);
    if (creds) aws_credentials = creds;
  }
  if (!aws_credentials) {
    console.error("getSession: missing aws_credentials");
    return new Response(JSON.stringify({ error: 'no AWS credentials' }), { status: 401 });
  }
  return { user, aws_credentials };
}
