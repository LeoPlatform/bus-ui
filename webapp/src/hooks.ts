import type { Reroute } from '@sveltejs/kit';
import { base } from '$app/paths';

/**
 * When deployed behind an API Gateway custom domain mapping (e.g.,
 * test-apps.dsco.io/botmonAlpha), API Gateway strips the mapping key
 * prefix before forwarding to Lambda. But SvelteKit's paths.base is
 * set to /botmonAlpha, so it expects all routes under that prefix.
 *
 * This reroute hook prepends the base path to incoming requests when
 * it's missing, so SvelteKit can match its routes correctly.
 *
 * In local dev (no base path), this is a no-op.
 */
export const reroute: Reroute = ({ url }) => {
    if (!base) return url.pathname;

    // If the path already starts with the base, no rewrite needed
    if (url.pathname.startsWith(base)) return url.pathname;

    // Don't rewrite internal SvelteKit asset/data paths
    if (url.pathname.startsWith('/_app/') || url.pathname.startsWith('/__data')) {
        return url.pathname;
    }

    // Prepend the base path so SvelteKit matches its routes
    return `${base}${url.pathname}`;
};
