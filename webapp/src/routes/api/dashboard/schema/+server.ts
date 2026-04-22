import { getSession } from '$lib/server/utils';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getQueueSchema, saveQueueSchema } from '$lib/server/services/schemaService';

export const POST: RequestHandler = async ({ locals, request }) => {
    const session = await getSession(locals);
    if (session instanceof Response) return session;

    const { id } = await request.json() as { id: string };
    if (!id) return json({ error: 'id is required' }, { status: 400 });

    try {
        const schema = await getQueueSchema(session.aws_credentials!, id);
        return json({ schema });
    } catch (e: any) {
        if (e.name === 'NoSuchKey') {
            return json({ schema: null });
        }
        return json({ error: e.message }, { status: 500 });
    }
};

export const PUT: RequestHandler = async ({ locals, request }) => {
    const session = await getSession(locals);
    if (session instanceof Response) return session;

    const { id, schema } = await request.json() as { id: string; schema: Record<string, any> };
    if (!id) return json({ error: 'id is required' }, { status: 400 });

    await saveQueueSchema(session.aws_credentials!, id, schema);
    return json({ success: true });
};
