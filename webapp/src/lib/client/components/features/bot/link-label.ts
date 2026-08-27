import { humanize } from '$lib/utils';
import type { LinkStats } from './types';

/**
 * Text under a workflow-graph edge — a direct port of legacy botmon's rules
 * (`stores/dataStore.js` display switch + `lib/stats.js` lag math), because legacy is the
 * behavioral reference for the workflow view.
 *
 * The two rules that are easy to get wrong, and were wrong here (ES-4034):
 *
 *  - **Read lag is not "time since the bot last ran."** It is how far the *events* are behind:
 *    `compare − source_timestamp`, the age of the newest event the bot has consumed. A bot that
 *    polls every ten minutes but is fully caught up has no lag; measuring from its run time
 *    would report ten minutes of lag that legacy does not show.
 *  - **A reader at the queue's newest checkpoint has zero lag**, whatever the timestamps say.
 *    That is the `-` legacy shows on a healthy read edge.
 *
 * `compare` is the end of the viewed window, not `Date.now()` — on a historical window legacy
 * measures lag against the window end (`lib/stats.js` `compare_timestamp`), so wall clock would
 * grow the number for every minute that has passed since.
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
