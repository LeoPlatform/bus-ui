import { describe, it, expect } from 'vitest';
import {
  calculateRelationshipImportance,
  filterRelationshipsByImportance,
  initializeLinkStats,
  linkStatsKey
} from '$comps/features/bot/tree-utils.svelte';
import type { LinkStats } from '$comps/features/bot/types';
import { DEFAULT_FILTER_OPTIONS } from '$comps/features/bot/types';
import type { MergedStatsRecord, RelationshipTree } from '$lib/types';

/**
 * Link-stats key direction (ES-4034).
 *
 * `initializeLinkStats` keys every link DOWNSTREAM-FIRST. Two call sites look those keys
 * back up — the edge labels in bot-relationship-tree and the importance scoring here — and
 * they each used to build the key by hand. The scorer built it upstream-first in both
 * directions, so every lookup missed: eventCount fell to 0, `now - undefined` produced NaN
 * scores, and with `includeInactive` off the activity filter dropped every relationship.
 *
 * These tests build the map with the real writer and read it back with the real key
 * builder, so a future edit to either convention fails here instead of silently emptying
 * the tree.
 */

// Recency is scored against wall clock, so anchor the fixtures to it.
const NOW = Date.now();
const MINUTE = 60_000;

const BOT = 'bot:my-bot';
const SOURCE_QUEUE = 'queue:source';
const DEST_QUEUE = 'queue:dest';

/** One bot record: reads from SOURCE_QUEUE, writes to DEST_QUEUE. */
function botStats(): MergedStatsRecord[] {
  return [
    {
      id: BOT,
      read: {
        [SOURCE_QUEUE]: {
          checkpoint: 'z/2026/08/25/00/00/0000000001',
          source_timestamp: NOW - 3 * MINUTE,
          timestamp: NOW - 2 * MINUTE,
          units: 120
        }
      },
      write: {
        [DEST_QUEUE]: {
          checkpoint: 'z/2026/08/25/00/00/0000000002',
          source_timestamp: NOW - 3 * MINUTE,
          timestamp: NOW - MINUTE,
          units: 45
        }
      }
    }
  ];
}

function node(id: string): RelationshipTree {
  return { id, children: [], parents: [] };
}

describe('linkStatsKey', () => {
  it('keys the child first on the children side, the parent first on the parents side', () => {
    expect(linkStatsKey('my-bot', 'dest', 'children')).toBe('dest-my-bot');
    expect(linkStatsKey('my-bot', 'source', 'parents')).toBe('my-bot-source');
  });

  it('strips bot:/queue:/system: prefixes, which the keys never carry', () => {
    expect(linkStatsKey(BOT, DEST_QUEUE, 'children')).toBe('dest-my-bot');
    expect(linkStatsKey('system:leo', 'bot:my-bot', 'parents')).toBe('leo-my-bot');
  });

  it('matches the keys initializeLinkStats actually wrote, in both directions', () => {
    const linkStats = new Map<string, LinkStats>();
    initializeLinkStats(botStats(), linkStats);

    // Downstream edge: the bot writes into DEST_QUEUE.
    expect(linkStats.get(linkStatsKey(BOT, DEST_QUEUE, 'children'))).toMatchObject({
      eventCount: 45,
      linkType: 'write'
    });
    // Upstream edge: the bot reads from SOURCE_QUEUE.
    expect(linkStats.get(linkStatsKey(BOT, SOURCE_QUEUE, 'parents'))).toMatchObject({
      eventCount: 120,
      linkType: 'read'
    });
  });
});

describe('calculateRelationshipImportance', () => {
  const linkStats = new Map<string, LinkStats>();
  initializeLinkStats(botStats(), linkStats);

  it('finds the event count for a downstream (children) relationship', () => {
    const score = calculateRelationshipImportance(node(DEST_QUEUE), linkStats, BOT, 'children');
    expect(score.eventCount).toBe(45);
    expect(score.isRecent).toBe(true);
    expect(Number.isFinite(score.score)).toBe(true);
    expect(score.lastActivity).toBeGreaterThan(0);
  });

  it('finds the event count for an upstream (parents) relationship', () => {
    const score = calculateRelationshipImportance(node(SOURCE_QUEUE), linkStats, BOT, 'parents');
    expect(score.eventCount).toBe(120);
    expect(score.isRecent).toBe(true);
    expect(Number.isFinite(score.score)).toBe(true);
  });

  it('still returns a finite score when the link genuinely has no stats', () => {
    const score = calculateRelationshipImportance(node('queue:unknown'), linkStats, BOT, 'children');
    expect(score.eventCount).toBe(0);
    expect(score.isRecent).toBe(false);
    // NaN here would silently break every sort comparator that touches it.
    expect(Number.isFinite(score.score)).toBe(true);
  });
});

describe('filterRelationshipsByImportance', () => {
  const linkStats = new Map<string, LinkStats>();
  initializeLinkStats(botStats(), linkStats);

  it('keeps active relationships when inactive ones are filtered out', () => {
    const kept = filterRelationshipsByImportance(
      [node(DEST_QUEUE)],
      linkStats,
      BOT,
      'children',
      { ...DEFAULT_FILTER_OPTIONS, includeInactive: false }
    );
    expect(kept.map((r) => r.id)).toEqual([DEST_QUEUE]);
  });

  it('drops relationships that really have no activity', () => {
    const kept = filterRelationshipsByImportance(
      [node('queue:unknown')],
      linkStats,
      BOT,
      'children',
      { ...DEFAULT_FILTER_OPTIONS, includeInactive: false }
    );
    expect(kept).toEqual([]);
  });

  it('orders by real activity when sorting by event count', () => {
    const stats = botStats();
    stats[0].write!['queue:busier'] = {
      checkpoint: 'z/2026/08/25/00/00/0000000003',
      source_timestamp: NOW - 3 * MINUTE,
      timestamp: NOW - MINUTE,
      units: 900
    };
    const map = new Map<string, LinkStats>();
    initializeLinkStats(stats, map);

    const sorted = filterRelationshipsByImportance(
      [node(DEST_QUEUE), node('queue:busier')],
      map,
      BOT,
      'children',
      { ...DEFAULT_FILTER_OPTIONS, sortBy: 'activity' }
    );
    expect(sorted.map((r) => r.id)).toEqual(['queue:busier', DEST_QUEUE]);
  });
});
