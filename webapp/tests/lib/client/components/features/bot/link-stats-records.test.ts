import { describe, it, expect } from 'vitest';
import { initializeLinkStats } from '$comps/features/bot/tree-utils.svelte';
import type { LinkStats } from '$comps/features/bot/types';
import type { MergedStatsRecord } from '$lib/types';

/**
 * Stats records invert their key shape by record type, and the workflow view fetches BOTH
 * (`visibleIds` carries queue ids for non-bot nodes). Shapes below are copied from real
 * LeoStats rows on the cup test bus (ES-4142):
 *
 *   id: "queue:modified-order"
 *     current.read  → { "bot:order-test-modified-order-to-dim": … }
 *     current.write → { "bot:order-test-order_changes-to-modified-order": … }
 *
 * A bot record is the mirror image: its maps are keyed by queue. Treating every record as a
 * bot record filed the queue's checkpoint under the writer bot's name (so the caught-up test
 * could never resolve) and put read entries on the write edge's key.
 */

const NOW = 1_756_000_000_000;
const CP_OLD = 'z/2026/08/28/14/00/1756000000000-0000001';
const CP_NEW = 'z/2026/08/28/15/00/1756003600000-0000009';

function rw(checkpoint: string, units = 100, ts = NOW) {
  return { checkpoint, units, timestamp: ts, source_timestamp: ts };
}

/** Key convention: read edges `${bot}-${queue}`, write edges `${queue}-${bot}`. */
function keysOf(map: Map<string, LinkStats>) {
  return [...map.keys()].sort();
}

describe('initializeLinkStats — bot records', () => {
  it('keys read edges bot-first and write edges queue-first', () => {
    const linkStats = new Map<string, LinkStats>();
    initializeLinkStats(
      [
        {
          id: 'bot:my-bot',
          read: { 'queue:in': rw(CP_OLD) },
          write: { 'queue:out': rw(CP_NEW) },
        } as unknown as MergedStatsRecord,
      ],
      linkStats
    );

    expect(keysOf(linkStats)).toEqual(['my-bot-in', 'out-my-bot']);
    expect(linkStats.get('my-bot-in')?.linkType).toBe('read');
    expect(linkStats.get('out-my-bot')?.linkType).toBe('write');
  });
});

describe('initializeLinkStats — queue records (inverted shape)', () => {
  const queueRecord = {
    id: 'queue:modified-order',
    read: { 'bot:order-test-modified-order-to-dim': rw(CP_NEW) },
    write: { 'bot:order-test-order_changes-to-modified-order': rw(CP_NEW) },
  } as unknown as MergedStatsRecord;

  it('keys a queue record read entry as the reading bot, not the queue', () => {
    const linkStats = new Map<string, LinkStats>();
    initializeLinkStats([queueRecord], linkStats);

    const readKey = 'order-test-modified-order-to-dim-modified-order';
    expect(linkStats.get(readKey)?.linkType).toBe('read');
  });

  it('keys a queue record write entry as the queue, not the writing bot', () => {
    const linkStats = new Map<string, LinkStats>();
    initializeLinkStats([queueRecord], linkStats);

    const writeKey = 'modified-order-order-test-order_changes-to-modified-order';
    expect(linkStats.get(writeKey)?.linkType).toBe('write');
  });

  it("records the queue's newest checkpoint under the queue, not under the writer bot", () => {
    const linkStats = new Map<string, LinkStats>();
    const latest = initializeLinkStats([queueRecord], linkStats);

    expect(latest.get('modified-order')).toBe(CP_NEW);
    expect(latest.has('order-test-order_changes-to-modified-order')).toBe(false);
  });

  it('resolves caught-up from a queue record alone', () => {
    // The reader is at the queue's newest checkpoint, so it has zero lag however long
    // ago it ran. Before the fix the latest checkpoint was filed under the writer bot,
    // so this could never resolve and the edge reported the raw event age as lag.
    const linkStats = new Map<string, LinkStats>();
    initializeLinkStats([queueRecord], linkStats);

    expect(linkStats.get('order-test-modified-order-to-dim-modified-order')?.caughtUp).toBe(true);
  });

  it('leaves a reader behind the queue head not caught up', () => {
    const linkStats = new Map<string, LinkStats>();
    initializeLinkStats(
      [
        {
          id: 'queue:modified-order',
          read: { 'bot:slow-reader': rw(CP_OLD) },
          write: { 'bot:writer': rw(CP_NEW) },
        } as unknown as MergedStatsRecord,
      ],
      linkStats
    );

    expect(linkStats.get('slow-reader-modified-order')?.caughtUp).toBe(false);
  });
});

describe('initializeLinkStats — a bot that both reads and writes one queue', () => {
  it('keeps the two edges on separate keys across both record shapes', () => {
    // The collision case: the queue record's read entry for `requeue` and the bot record's
    // write entry for the same pair both used to land on `${queue}-${bot}`, so whichever
    // record came last won and a write edge could render a read label.
    const linkStats = new Map<string, LinkStats>();
    initializeLinkStats(
      [
        {
          id: 'bot:requeue',
          read: { 'queue:q': rw(CP_OLD) },
          write: { 'queue:q': rw(CP_NEW) },
        } as unknown as MergedStatsRecord,
        {
          id: 'queue:q',
          read: { 'bot:requeue': rw(CP_OLD) },
          write: { 'bot:requeue': rw(CP_NEW) },
        } as unknown as MergedStatsRecord,
      ],
      linkStats
    );

    expect(linkStats.get('requeue-q')?.linkType).toBe('read');
    expect(linkStats.get('q-requeue')?.linkType).toBe('write');
    expect(keysOf(linkStats)).toEqual(['q-requeue', 'requeue-q']);
  });
});
