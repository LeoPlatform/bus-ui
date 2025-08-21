import { getSession } from '$lib/server/utils';
import type { GetSettingsRequest } from '$lib/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSettings } from '$lib/server/services/dynamoService';

export const POST: RequestHandler = async ({locals, request}) => {
    const session = await getSession(locals);

    if (session instanceof Response) {
        return session;
    }

    const requestBody: GetSettingsRequest = await request.json();

    return json({settings: await getSettings(session.aws_credentials!, requestBody.id)});
};