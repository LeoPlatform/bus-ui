import { env } from '$env/dynamic/private';
import { getSession } from '$lib/server/utils';
import { createLeoStreams, getRStreamsEnv } from '$lib/server/rstreams';
import { json } from '@sveltejs/kit';
import { createRequire } from 'node:module';
import type { RequestHandler } from './$types';

const require = createRequire(import.meta.url);

function leoStatsTable(): string {
    return env.LEO_STATS_TABLE ?? process.env.LEO_STATS_TABLE ?? '';
}

/**
 * Event lineage trace (Leo SDK `trace`), same inputs as legacy `api/eventTrace` Lambda.
 *
 * Query: `queue` (server / queue id), `eid` (event id), optional `children` (comma-separated ids for correlation drill-down).
 */
export const GET: RequestHandler = async ({ locals, url }) => {
    const session = await getSession(locals);
    if (session instanceof Response) return session;

    const queue = url.searchParams.get('queue') ?? '';
    const eid = url.searchParams.get('eid') ?? '';
    const childrenParam = url.searchParams.get('children');

    if (!queue || !eid) {
        return json({ error: 'queue and eid are required' }, { status: 400 });
    }

    const statsTable = leoStatsTable();
    if (!statsTable) {
        return json({ error: 'LEO_STATS_TABLE is not configured' }, { status: 500 });
    }

    let rstreamsEnv;
    try {
        rstreamsEnv = getRStreamsEnv();
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return json({ error: msg, configured: false }, { status: 503 });
    }

    let streams: {
        dynamodb: unknown;
        configuration: unknown;
        fromLeo: unknown;
        pipe: unknown;
        write: unknown;
    };
    try {
        ({ streams } = createLeoStreams(session.aws_credentials, rstreamsEnv));
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return json({ error: `Failed to initialize Leo streams: ${msg}` }, { status: 500 });
    }

    const children =
        childrenParam && childrenParam.length > 0
            ? childrenParam
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
            : undefined;

    const traceFn = require('leo-sdk/lib/event-trace.js').trace as (
        sdk: {
            streams: typeof streams;
            aws: { dynamodb: unknown };
            configuration: unknown;
        },
        statsTableName: string,
        options: { queue: string; eid: string; children?: string[] },
    ) => Promise<unknown>;

    const sdk = {
        streams,
        aws: { dynamodb: streams.dynamodb },
        configuration: streams.configuration,
    };

    try {
        const result = await traceFn(sdk, statsTable, { queue, eid, children });
        return json(result);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[GET /api/eventTrace]', msg, e);
        return json({ error: msg }, { status: 500 });
    }
};
