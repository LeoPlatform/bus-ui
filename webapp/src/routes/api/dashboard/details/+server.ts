import { getDashboardStats, getQueueDashboardStats } from '$lib/server/services/dynamoService';
import { getSession } from '$lib/server/utils';
import type { DashboardStatsApiResponse, DashboardStatsRequest } from '$lib/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({locals, request}) => {
    const session = await getSession(locals);

    if (session instanceof Response) {
        return session;
    }

    const requestBody: DashboardStatsRequest = await request.json();

    if (requestBody.id.startsWith('queue:') || requestBody.id.startsWith('system:')) {
        return json({ dashStats: await getQueueDashboardStats(session.aws_credentials!, requestBody) });
    }

    return json({dashStats: await getDashboardStats(session.aws_credentials!, requestBody)} as DashboardStatsApiResponse);
};
