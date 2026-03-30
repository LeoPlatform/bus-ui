import { getSession } from '$lib/server/utils';
import type { GetSettingsRequest } from '$lib/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSettings, saveBotSettings, saveQueueSettings, saveSystemSettings } from '$lib/server/services/dynamoService';

export const POST: RequestHandler = async ({locals, request}) => {
    const session = await getSession(locals);

    if (session instanceof Response) {
        return session;
    }

    const requestBody: GetSettingsRequest = await request.json();

    return json({settings: await getSettings(session.aws_credentials!, requestBody.id)});
};

export const PUT: RequestHandler = async ({locals, request}) => {
    const session = await getSession(locals);

    if (session instanceof Response) {
        return session;
    }

    const body = await request.json();
    const { id, updates } = body as { id: string; updates: Record<string, any> };

    if (!id) {
        return json({ error: 'id is required' }, { status: 400 });
    }

    if (id.startsWith('queue:')) {
        await saveQueueSettings(session.aws_credentials!, id, updates);
    } else if (id.startsWith('system:')) {
        await saveSystemSettings(session.aws_credentials!, id, updates);
    } else {
        await saveBotSettings(session.aws_credentials!, id, updates);
    }

    return json({ success: true });
};