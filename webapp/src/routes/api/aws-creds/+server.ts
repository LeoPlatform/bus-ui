import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSession } from '$lib/server/utils.js';

export const GET: RequestHandler = async ({ locals }) => {
    const result = await getSession(locals);

    // getSession returns a Response on error
    if (result instanceof Response) {
        return result;
    }

    const { aws_credentials: creds } = result;
    return json({
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
        expiration: creds.expiration instanceof Date
            ? creds.expiration.toISOString()
            : creds.expiration,
    });
};
