import { getSession } from '$lib/server/utils';
import { json } from '@sveltejs/kit';
import { createLeoStreams, getRStreamsEnv } from '$lib/server/rstreams';
import type { RequestHandler } from './$types';
import { perf } from '$lib/server/perf';

/**
 * Native event search using leo-sdk's `fromLeo` stream reader.
 *
 * Replaces the legacy proxy to Botmon's `/api/search/…` endpoint.
 * Reads events directly from the Leo Bus queue via DynamoDB + S3,
 * using the requesting user's AWS credentials.
 *
 * Features enabled:
 *   - fast_s3_read: concurrent S3 file pre-fetching for performance
 *
 * Query params:
 *   serverId  — queue ID (required)
 *   token     — resumption token / start position (z/YYYY/MM/DD/HH/mm/ms format)
 *   search    — payload filter (regex matched against JSON-stringified payload)
 *   agg       — aggregation state (JSON string, passed through to caller)
 */
export const GET: RequestHandler = async ({ locals, url }) => {
    const session = await getSession(locals);
    if (session instanceof Response) return session;

    const serverId = url.searchParams.get('serverId') ?? '';
    if (!serverId) {
        return json({ error: 'serverId is required' }, { status: 400 });
    }

    const endPerf = perf.start(`GET /api/queue/event-search ${serverId}`);

    const startToken = url.searchParams.get('token') ?? '';
    const searchText = url.searchParams.get('search') ?? '';
    const aggParam = url.searchParams.get('agg');

    let rstreamsEnv;
    try {
        rstreamsEnv = getRStreamsEnv();
    } catch (e: any) {
        return json({
            results: [],
            count: 0,
            resumptionToken: null,
            last_time: null,
            configured: false,
            error: e?.message,
        });
    }

    let streams;
    try {
        ({ streams } = createLeoStreams(session.aws_credentials, rstreamsEnv));
    } catch (e: any) {
        return json(
            { error: `Failed to initialize RStreams: ${e?.message}`, configured: true },
            { status: 500 },
        );
    }

    perf.log('event-search', `raw search: ${JSON.stringify(searchText)}`);

    // Parse the search string into text filter + optional script filter.
    // Script search is triggered by $ or $$ variables (e.g. $.new.sku = "ABC").
    // Format: [text filter] [$ or $$ expression]
    // Both must match for an event to be included (same as legacy searchQueue Lambda).
    let textSearch = searchText;
    let scriptFilter: ((payload: any, event: any, agg: any) => boolean) | null = null;

    const scriptMatch = searchText.match(/[(!]*\${1,3}\./);
    if (scriptMatch) {
        const scriptExpr = searchText.substring(scriptMatch.index!);
        textSearch = searchText.substring(0, scriptMatch.index!).trim();

        // Normalize equality operators (same rules as legacy Lambda):
        // = → ==, but preserve =>, <=, >=, !=, +=, -=, :=
        // Normalize equality: convert standalone = to == for convenience,
        // but preserve compound operators (<=, >=, !=, +=, -=, =>, ===).
        // Skip normalization entirely when $$$ (aggregation) is used,
        // since aggregation expressions need real assignments.
        const normalized = scriptExpr.includes('$$$')
            ? scriptExpr
            : scriptExpr.replace(/(?<![<>!=+\-:])=(?!=|>)/g, '==');

        try {
            scriptFilter = new Function('$', '$$', '$$$',
                `try { return ${normalized}; } catch(e) { return false; }`
            ) as (payload: any, event: any, agg: any) => boolean;
        } catch (e: any) {
            return json({ error: `Invalid filter expression: ${e?.message}` }, { status: 400 });
        }

        // Optimization: if there's no explicit text search and the script uses $
        // (payload) with string literals, use the longest literal as a text pre-filter.
        // This dramatically speeds up script search on high-volume queues by narrowing
        // with a fast regex before evaluating the script on each event.
        // Skip when using $$ (full event) since the text filter only searches the payload.
        if (!textSearch && !scriptExpr.includes('$$')) {
            const strLiterals = scriptExpr.match(/["']([^"']+)["']/g);
            if (strLiterals && strLiterals.length > 0) {
                const candidates = strLiterals.map(s => s.slice(1, -1)).sort((a, b) => b.length - a.length);
                textSearch = candidates[0];
            }
        }
    }

    // Build the text filter (regex, same as legacy searchQueue Lambda)
    let payloadFilter: RegExp | null = null;
    if (textSearch) {
        try {
            payloadFilter = new RegExp(textSearch, 'i');
        } catch {
            return json({ error: `Invalid search regex: ${textSearch}` }, { status: 400 });
        }
    }

    if (scriptFilter || payloadFilter) {
        perf.log('event-search', `textFilter: ${payloadFilter}, scriptFilter: ${!!scriptFilter}`);
    }

    // Parse aggregation state from caller (pass-through)
    let agg: Record<string, unknown> = {};
    if (aggParam) {
        try {
            agg = JSON.parse(aggParam);
        } catch {
            // Ignore parse errors — start with empty agg
        }
    }

    const requestedCount = 40;

    const response: {
        results: Record<string, unknown>[];
        resumptionToken: string | null;
        last_time: number | null;
        count: number;
        agg: Record<string, unknown>;
        configured: boolean;
    } = {
        results: [],
        resumptionToken: null,
        last_time: null,
        count: 0,
        agg,
        configured: true,
    };

    try {
        const readable = streams.fromLeo('event-search', serverId, {
            start: startToken || undefined,
            fast_s3_read: true,
            runTime: { milliseconds: 10_000 },
        });

        await new Promise<void>((resolve) => {
            let exiting = false;
            let size = 0;
            let settled = false;

            function settle() {
                if (settled) return;
                settled = true;
                resolve();
            }

            // Hard timeout — always stop after 10s
            const fullTimeout = setTimeout(() => {
                exiting = true;
                try { readable.destroy(); } catch { /* ignore */ }
                settle();
            }, 10_000);

            readable.on('data', (obj: any) => {
                if (exiting) return;

                response.resumptionToken = obj.eid ?? null;
                response.last_time = obj.timestamp ?? null;
                response.count++;

                // Apply both filters — text (regex on stringified event) AND script ($ expression).
                // Both must pass for the event to be included (same as legacy Lambda).
                // Text filter matches against the full event (same as legacy Lambda)
                const textMatches =
                    payloadFilter === null || payloadFilter.test(JSON.stringify(obj));
                const scriptMatches =
                    scriptFilter === null || scriptFilter(obj.payload, obj, response.agg);
                const matches = textMatches && scriptMatches;

                if (matches) {
                    response.results.push({
                        eid: obj.eid,
                        timestamp: obj.timestamp,
                        event_source_timestamp: obj.event_source_timestamp,
                        event: obj.event,
                        payload: obj.payload,
                        version: obj.version,
                        correlation_id: obj.correlation_id,
                    });

                    size += obj.size || Buffer.byteLength(JSON.stringify(obj));

                    // Stop if we hit the requested count or 16MB
                    if (response.results.length >= requestedCount || size >= 16 * 1024 * 1024) {
                        exiting = true;
                        clearTimeout(fullTimeout);
                        try { readable.destroy(); } catch { /* ignore */ }
                        settle();
                    }
                }
            });

            readable.on('end', () => { clearTimeout(fullTimeout); settle(); });
            readable.on('close', () => { clearTimeout(fullTimeout); settle(); });
            readable.on('error', () => { clearTimeout(fullTimeout); settle(); });
        });
    } catch (e: any) {
        // If we collected some results before the error, return them
        if (response.results.length === 0) {
            endPerf();
            return json(
                { error: e?.message ?? 'Event search failed', configured: true },
                { status: 500 },
            );
        }
    }

    endPerf();
    return json(response);
};
