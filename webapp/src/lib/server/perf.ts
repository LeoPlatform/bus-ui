/**
 * Lightweight server-side performance timing.
 *
 * Enable:  PERF_TIMING=1 in .env.local or environment
 * Disable: omit PERF_TIMING or set to "" / "0" / "false"
 *
 * Usage:
 *   import { perf } from '$lib/server/perf';
 *
 *   const end = perf.start('getRelationships');
 *   // ... work ...
 *   end();                       // logs: [perf] getRelationships 142ms
 *
 *   // Or wrap an async function:
 *   const data = await perf.time('scanCronTable', () => scanTable());
 */

import { env } from '$env/dynamic/private';

function isEnabled(): boolean {
    const v = env.PERF_TIMING ?? process.env.PERF_TIMING;
    return v != null && v !== '' && v !== '0' && v !== 'false';
}

function start(label: string): () => void {
    if (!isEnabled()) return () => {};
    const t0 = performance.now();
    return () => {
        const ms = (performance.now() - t0).toFixed(1);
        console.log(`[perf] ${label} ${ms}ms`);
    };
}

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (!isEnabled()) return fn();
    const t0 = performance.now();
    try {
        return await fn();
    } finally {
        const ms = (performance.now() - t0).toFixed(1);
        console.log(`[perf] ${label} ${ms}ms`);
    }
}

export const perf = { start, time };
