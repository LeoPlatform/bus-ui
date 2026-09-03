import { describe, it, expect } from 'vitest';
import { getLinkLabel, readLagMs } from '$comps/features/bot/link-label';
import { isCaughtUp } from '$comps/features/bot/tree-utils.svelte';
import type { LinkStats } from '$comps/features/bot/types';

/**
 * Workflow-edge labels, pinned against legacy botmon's rules (ES-4034).
 *
 * The first implementation measured read lag as "time since the bot last ran", which made
 * botmonAlpha disagree with legacy on nearly every read edge: a caught-up bot that polls
 * infrequently reported minutes of lag legacy shows as "-".
 */

const MINUTE = 60_000;
const NOW = 1_756_000_000_000;

function read(over: Partial<LinkStats> = {}): LinkStats {
  return { eventCount: 10, linkType: 'read', lastRead: NOW - 5 * MINUTE, ...over };
}
function write(over: Partial<LinkStats> = {}): LinkStats {
  return { eventCount: 10, linkType: 'write', lastWrite: NOW - 5 * MINUTE, ...over };
}

describe('getLinkLabel — write edges', () => {
  it('shows time since the last write', () => {
    expect(getLinkLabel(write({ lastWrite: NOW - 3 * MINUTE }), NOW)).toBe('3m ago');
  });

  it('shows N/A when the link has never written', () => {
    expect(getLinkLabel(write({ lastWrite: undefined }), NOW)).toBe('N/A');
  });

  it('measures against the window end, not wall clock', () => {
    // Window ended an hour ago; a write 3 minutes before that end is "3m ago", not "1h 3m ago".
    const windowEnd = NOW - 60 * MINUTE;
    expect(getLinkLabel(write({ lastWrite: windowEnd - 3 * MINUTE }), windowEnd)).toBe('3m ago');
  });

  it('never reports negative age for a write at the very end of the window', () => {
    expect(getLinkLabel(write({ lastWrite: NOW + 5000 }), NOW)).toBe('0s ago');
  });
});

describe('getLinkLabel — read edges', () => {
  it('shows "-" when the reader is caught up, however long ago it ran', () => {
    // The exact regression: caught up, but last ran 45 minutes ago.
    const stat = read({
      lastRead: NOW - 45 * MINUTE,
      sourceTimestamp: NOW - 45 * MINUTE,
      caughtUp: true,
    });
    expect(getLinkLabel(stat, NOW)).toBe('-');
  });

  it('reports lag from the event source time when behind', () => {
    const stat = read({ sourceTimestamp: NOW - 9 * MINUTE, caughtUp: false });
    expect(getLinkLabel(stat, NOW)).toBe('lag: 9m');
  });

  it('does not use the bot run time as lag', () => {
    // Ran 20 minutes ago, but the newest event it consumed is only 2 minutes old.
    const stat = read({
      lastRead: NOW - 20 * MINUTE,
      sourceTimestamp: NOW - 2 * MINUTE,
      caughtUp: false,
    });
    expect(getLinkLabel(stat, NOW)).toBe('lag: 2m');
  });

  it('shows N/A when the link has never read', () => {
    expect(getLinkLabel(read({ lastRead: undefined }), NOW)).toBe('N/A');
  });

  it('treats sub-100ms lag as caught up, like legacy', () => {
    expect(getLinkLabel(read({ sourceTimestamp: NOW - 50, caughtUp: false }), NOW)).toBe('-');
  });

  it('reports no lag when the source timestamp is missing rather than inventing one', () => {
    expect(getLinkLabel(read({ sourceTimestamp: undefined, caughtUp: false }), NOW)).toBe('-');
  });
});

describe('readLagMs', () => {
  it('is zero when caught up', () => {
    expect(readLagMs(read({ sourceTimestamp: NOW - 10 * MINUTE, caughtUp: true }), NOW)).toBe(0);
  });

  it('is the age of the newest consumed event otherwise', () => {
    expect(readLagMs(read({ sourceTimestamp: NOW - 4 * MINUTE }), NOW)).toBe(4 * MINUTE);
  });
});

describe('isCaughtUp', () => {
  const older = 'z/2026/08/27/14/00/1756000000000-0000000';
  const newer = 'z/2026/08/27/15/00/1756003600000-0000000';

  it('is true at or past the queue checkpoint', () => {
    expect(isCaughtUp(newer, newer)).toBe(true);
    expect(isCaughtUp(newer, older)).toBe(true);
  });

  it('is false behind the queue checkpoint', () => {
    expect(isCaughtUp(older, newer)).toBe(false);
  });

  it('is false when the reader has no checkpoint but the queue has writes', () => {
    expect(isCaughtUp(undefined, newer)).toBe(false);
  });

  /**
   * A quiet queue — no writes in the viewed window, or a writer that isn't in the fetched
   * set — yields no queue latest. Legacy seeds `latest_checkpoint: ''` and then tests
   * `link.checkpoint >= queue.latest_checkpoint` (lib/stats.js), so any real checkpoint
   * compares as caught up and the edge reads `-`.
   *
   * Treating an unknown latest as "behind" instead makes every such read edge report
   * `compare - source_timestamp`, which is the false lag on an infrequently-written queue
   * that this work set out to remove. The previous assertion here pinned the
   * implementation rather than legacy.
   */
  it('is true when the queue has no known latest write, as legacy does', () => {
    expect(isCaughtUp(newer, undefined)).toBe(true);
    expect(isCaughtUp(undefined, undefined)).toBe(true);
  });
});
