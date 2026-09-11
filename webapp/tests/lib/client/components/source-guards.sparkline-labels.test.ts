import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Sparkline labels must name the series each table actually plots. `values` means different
 * things on the two dashboards: on a bot's READ rows the server fills it from the source
 * queue's own write stats (api-utils.ts calculateReadQueueStats), so it is events in the
 * queue, while the bot's reads live in `reads` and are what the Events Read column sums. On
 * the queue dashboard `values` is the bot's own read/write units, so "Reads"/"Writes" are
 * correct there. These are literal source matches — deletion tripwires, not behavioural
 * proofs; an equivalent rewrite walks past them.
 */

const SRC = path.join(process.cwd(), 'src', 'lib/client/components/features/dashboard');

function sparklineLines(file: string): string[] {
  return readFileSync(path.join(SRC, file), 'utf8')
    .split('\n')
    .filter((line) => line.includes('<SparklineChart'));
}

describe('sparkline series labels', () => {
  it('the bot dashboard read table does not call queue events "Reads"', () => {
    const [readLine, writeLine] = sparklineLines('bot-dashboard-tab.svelte');

    expect(readLine).toContain('label="Events"');
    expect(readLine).toContain('lastRead=');
    expect(writeLine).toContain('label="Writes"');
  });

  it('the queue dashboard keeps its per-bot Writes and Reads labels', () => {
    const [writeLine, readLine] = sparklineLines('queue-dashboard-tab.svelte');

    expect(writeLine).toContain('label="Writes"');
    expect(readLine).toContain('label="Reads"');
    expect(readLine).toContain('lastRead=');
  });
});
