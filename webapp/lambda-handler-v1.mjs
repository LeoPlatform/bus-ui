/**
 * API Gateway v1 (REST API) entrypoint wrapper for the SvelteKit Lambda.
 *
 * Why this exists:
 *   - API Gateway v1 BasePathMapping strips the basePath prefix
 *     (/botmonAlpha) before invoking the Lambda, but SvelteKit's router is
 *     registered with paths.base = /botmonAlpha, so a stripped path would
 *     404 against every route.
 *   - API Gateway v2 had an `overwrite:path` request parameter that
 *     restored the prefix at the API Gateway layer. v1 has no equivalent.
 *   - This wrapper re-adds the prefix to event.path before delegating to
 *     the svelte-kit-sst adapter handler. The adapter auto-detects v1 vs
 *     v2 events via its event-mapper, so no further transformation is
 *     needed.
 *
 * This file is copied into the Lambda bundle via SST's `server.copyFiles`
 * and the Lambda `handler` is set to `lambda-handler-v1.handler`.
 */

import { handler as adapterHandler } from "./lambda-handler/index.js";

const basePath = process.env.SVELTE_BASE_PATH ?? "";

export async function handler(event, context) {
    if (
        basePath &&
        typeof event?.httpMethod === "string" &&
        typeof event?.path === "string" &&
        !event.path.startsWith(basePath)
    ) {
        event.path = basePath + event.path;
    }
    return adapterHandler(event, context);
}
