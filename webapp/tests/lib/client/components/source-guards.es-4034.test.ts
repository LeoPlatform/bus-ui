import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Source-shape guards for ES-4034. These pin fixes that live inside Svelte component
 * markup, where no node-level unit seam exists. They are literal source matches — deletion
 * tripwires, not behavioral proofs: a rename or an equivalent rewrite walks past them.
 *
 *  1. Chart annotation lines must mark the READ CHECKPOINT, never wall clock.
 *     Legacy botmon draws its red read-cutoff line only on charts that can lag;
 *     an `x={now}` AnnotationLine regressed that into a meaningless "now" line
 *     on every chart.
 *
 *  2. The dashboard's refresh timer must re-read the page's own settings record, which is
 *     what the header's ROGUE badge derives its error count from.
 *
 *  3. Static PNG assets must use the `assets || base` prefix. In deployed stages
 *     `base` routes through API Gateway into the SvelteKit Lambda (no static
 *     routes → 404 → broken image); assets are served from CloudFront via the
 *     `assets` path (see svelte.config.js / sst.config.ts).
 */

const SRC = path.join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(svelte|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('ES-4034 source guards', () => {
  it('no chart draws an AnnotationLine at wall-clock now', () => {
    const chartFiles = walk(path.join(SRC, 'lib/client/components/features/charts'));
    const offenders = chartFiles.filter((f) => readFileSync(f, 'utf8').includes('x={now}'));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('the dashboard refresh timer re-reads the page settings record', () => {
    // The header's ROGUE badge reads errorCount off `compState.settings`, which only the
    // id-change effect populates. Refreshing the shared catalog instead does not reach it
    // (the header prefers the page record), so dropping getSettings() from the timer
    // freezes the badge at page-load state. Pinning the call is a tripwire, not a proof:
    // it catches deletion, not a rename of the method.
    const src = readFileSync(
      path.join(SRC, 'lib/client/components/features/dashboard/dashboard.svelte'),
      'utf8'
    );
    const timerBody = src.slice(src.indexOf('setInterval('), src.indexOf('}, 45_000)'));
    expect(timerBody).toContain('getSettings()');
  });

  it('no component builds a PNG asset URL from the bare `base` path', () => {
    const offenders = walk(SRC).filter((f) =>
      /\$\{base\}\/[\w./-]*\.png/.test(readFileSync(f, 'utf8'))
    );
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
