import { getDashboardStats, getQueueDashboardStats } from '$lib/server/services/dynamoService';
import { getSession } from '$lib/server/utils';
import type { DashboardStatsApiResponse, DashboardStatsRequest } from '$lib/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { perf } from '$lib/server/perf';

export const POST: RequestHandler = async ({locals, request}) => {
    const session = await getSession(locals);

    if (session instanceof Response) {
        return session;
    }

    const requestBody: DashboardStatsRequest = await request.json();

    if (requestBody.id.startsWith('queue:') || requestBody.id.startsWith('system:')) {
        const dashStats = await perf.time(`POST /api/dashboard/details queue/system ${requestBody.id}`, () =>
            getQueueDashboardStats(session.aws_credentials!, requestBody)
        );
        return json({ dashStats });
    }

    const dashStats = await perf.time(`POST /api/dashboard/details bot ${requestBody.id}`, () =>
        getDashboardStats(session.aws_credentials!, requestBody)
    );
    return json({dashStats} as DashboardStatsApiResponse);
};
