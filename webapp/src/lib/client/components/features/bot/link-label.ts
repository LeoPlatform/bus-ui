import { humanize } from '$lib/utils';
import type { LinkStats } from './types';

/**
 * Text under a workflow-graph edge, ported from legacy (`stores/dataStore.js` display switch,
 * `lib/stats.js` lag math). Three rules that are easy to get wrong:
 *
 *  - Read lag is `compare − source_timestamp`, the age of the newest event consumed — not the
 *    time since the bot last ran.
 *  - A reader at the queue's newest checkpoint has zero lag whatever the timestamps say.
 *  - `compare` is the end of the viewed window, not `Date.now()`; wall clock inflates lag on a
 *    historical window by however long ago it was.
 */
export function getLinkLabel(stat: LinkStats, compare: number): string {
  if (stat.linkType === 'read') {
    if (stat.lastRead == null) return 'N/A';
    const lag = readLagMs(stat, compare);
    // Legacy's threshold: under 100ms of lag reads as caught up.
    return lag < 100 ? '-' : `lag: ${humanize(lag)}`;
  }

  if (stat.lastWrite == null) return 'N/A';
  return `${humanize(Math.max(0, compare - stat.lastWrite))} ago`;
}

/** Event-source lag for a read link: zero when caught up, else the age of the newest event read. */
export function readLagMs(stat: LinkStats, compare: number): number {
  if (stat.caughtUp) return 0;
  if (!stat.sourceTimestamp) return 0;
  return Math.max(0, compare - stat.sourceTimestamp);
}
