import { describe, it, expect } from 'vitest';
import { catalogRowFromBot } from '$comps/features/bot/bot.state.svelte';
import type { BotSettings } from '$lib/types';

/**
 * What the catalog's Errors column means (ES-4034, AD-012).
 *
 * It shows the PERSISTED consecutive-error count from the bot's cron record — the same
 * counter that drives rogue — not errors summed over the currently-viewed stats window.
 *
 * The window-derived count is the wrong source here, and wrong in the worst place: leo-cron
 * stops scheduling a rogue bot, so a rogue bot has no executions in the window at all. A
 * window-derived column therefore reads 0 for exactly the bots whose error count matters
 * most, which is how the catalog came to disagree with the same bot's dashboard header.
 *
 * Lag columns are the opposite case and stay window-derived — they describe the viewed
 * range, not a persisted counter.
 */

/** A bot as it reaches rebuildCatalog: persisted fields, plus `computed*` from the window. */
function bot(persisted: Partial<BotSettings>, computed: Record<string, number> = {}): BotSettings {
  return Object.assign(
    { id: 'a-bot', archived: false, paused: false, ...persisted } as BotSettings,
    computed
  );
}

describe('catalogRowFromBot — Errors column', () => {
  it('shows the persisted count for a rogue bot with no stats in the window', () => {
    // The regression: `computedErrorCount ?? errorCount` let a windowed 0 — which is not
    // nullish — beat the persisted 25, so the row read 0 while the bot was rogue.
    const row = catalogRowFromBot(bot({ errorCount: 25 }, { computedErrorCount: 0 }));
    expect(row.errorCount).toBe(25);
  });

  it('shows the persisted count even when the window recorded errors of its own', () => {
    const row = catalogRowFromBot(bot({ errorCount: 3 }, { computedErrorCount: 40 }));
    expect(row.errorCount).toBe(3);
  });

  it('reads 0 for a healthy bot rather than undefined', () => {
    const row = catalogRowFromBot(bot({ errorCount: 0 }, { computedErrorCount: 0 }));
    expect(row.errorCount).toBe(0);
  });

  it('agrees with what the dashboard header derives from the same record', () => {
    // Both surfaces must read the persisted counter, or they contradict each other on the
    // same bot — the original ES-4034 defect 6.
    const b = bot({ errorCount: 25 }, { computedErrorCount: 0 });
    expect(catalogRowFromBot(b).errorCount).toBe(b.errorCount);
  });
});

describe('catalogRowFromBot — lag columns stay window-derived', () => {
  it('prefers the computed lag over the persisted health config', () => {
    const row = catalogRowFromBot(
      bot({ health: { source_lag: 1_000, write_lag: 2_000 } }, { computedSourceLag: 55_000, computedWriteLag: 66_000 })
    );
    expect(row.health?.source_lag).toBe(55_000);
    expect(row.health?.write_lag).toBe(66_000);
  });

  it('falls back to the configured lag when the window produced none', () => {
    const row = catalogRowFromBot(bot({ health: { source_lag: 1_000, write_lag: 2_000 } }));
    expect(row.health?.source_lag).toBe(1_000);
    expect(row.health?.write_lag).toBe(2_000);
  });
});
