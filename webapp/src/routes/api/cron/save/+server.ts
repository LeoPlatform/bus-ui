import { getSession } from '$lib/server/utils';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { saveCron } from '$lib/server/services/dynamoService';

export const POST: RequestHandler = async ({ locals, request }) => {
    const session = await getSession(locals);

    if (session instanceof Response) {
        return session;
    }

    const body = await request.json();
    const { id, executeNow, executeNowClear, checkpoint } = body as {
        id: string;
        executeNow?: boolean;
        executeNowClear?: boolean;
        checkpoint?: Record<string, string>;
    };

    if (!id) {
        return json({ error: 'id is required' }, { status: 400 });
    }

    await saveCron(session.aws_credentials!, {
        id,
        executeNow,
        executeNowClear,
        checkpoint,
    });

    return json({ success: true });
};
