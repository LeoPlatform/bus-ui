import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  const provider = locals.authProvider;
  if (!user || !provider?.getAwsCredentials) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }
  const creds = await provider.getAwsCredentials(user);
  if (!creds) {
    return json({ error: 'no credentials', requiresReauth: true }, { status: 403 });
  }
  return json({
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
    expiration: creds.expiration.toISOString(),
  });
};
