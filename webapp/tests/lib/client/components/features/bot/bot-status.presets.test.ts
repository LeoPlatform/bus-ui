/**
 * bot-status.presets.test — pins evaluateBotStatus against the committed mock-bot presets.
 *
 * This is the logic half of the ES-3461 test infrastructure: every named preset in
 * `$lib/testing/mock-bots` must evaluate to the status the UI (and the Storybook state
 * stories) expect. If a preset and the status logic ever drift, this fails first — before
 * anyone has to launch the mock bus by hand.
 */
import { describe, it, expect } from 'vitest';
import { evaluateBotStatus } from '$comps/features/bot/bot-status.utils';
import {
  mockHealthy,
  mockRogue,
  mockRoguePaused,
  mockPaused,
  mockArchivedRogue,
  mockBlocked,
  mockDanger,
  mockCheckpoint,
  mockStatsFor,
} from '$lib/testing/mock-bots';

describe('mock-bot presets → evaluateBotStatus', () => {
  it('mockHealthy → running, not rogue', () => {
    const bot = mockHealthy();
    const result = evaluateBotStatus(bot, mockStatsFor(bot.id));
    expect(result.status).toBe('running');
    expect(result.rogue).toBe(false);
  });

  it('mockBlocked + error stats → blocked', () => {
    const bot = mockBlocked();
    const stats = mockStatsFor(bot.id);
    expect(stats).toBeDefined(); // blocked REQUIRES current-window errors
    const result = evaluateBotStatus(bot, stats);
    expect(result.status).toBe('blocked');
    expect(result.rogue).toBe(false);
  });

  it('mockDanger + alarm stats → danger', () => {
    const bot = mockDanger();
    const stats = mockStatsFor(bot.id);
    expect(stats).toBeDefined(); // danger REQUIRES a lag alarm
    const result = evaluateBotStatus(bot, stats);
    expect(result.status).toBe('danger');
    expect(result.isAlarmed).toBe(true);
    expect(result.rogue).toBe(false);
  });

  it('mockCheckpoint → running (carries a real checkpoint token)', () => {
    const bot = mockCheckpoint();
    const result = evaluateBotStatus(bot, mockStatsFor(bot.id));
    expect(result.status).toBe('running');
    expect(bot.checkpoints?.read?.['queue:mock-source']?.checkpoint).toBe('z/2026/07/09/08/07/00/');
  });

  // The ES-3461 gap: rogue/paused/archived must be derived from the record alone when the
  // bot has NO stats in the window. The live playground was the only thing that caught the
  // original short-circuit-to-running bug; this block pins it so it can't regress silently.
  describe('no-stats path (stats = undefined) — the ES-3461 gap', () => {
    it('mockRogue with no stats → rogue', () => {
      const bot = mockRogue();
      expect(mockStatsFor(bot.id)).toBeUndefined(); // intentionally no stats
      const result = evaluateBotStatus(bot, undefined);
      expect(result.status).toBe('rogue');
      expect(result.rogue).toBe(true);
    });

    it('mockRoguePaused with no stats → rogue (rogue wins over paused)', () => {
      const bot = mockRoguePaused();
      const result = evaluateBotStatus(bot, undefined);
      expect(result.status).toBe('rogue');
      expect(result.rogue).toBe(true);
    });

    it('mockPaused with no stats → paused', () => {
      const bot = mockPaused();
      const result = evaluateBotStatus(bot, undefined);
      expect(result.status).toBe('paused');
    });

    it('mockArchivedRogue with no stats → archived (archived wins over rogue)', () => {
      const bot = mockArchivedRogue();
      const result = evaluateBotStatus(bot, undefined);
      expect(result.status).toBe('archived');
    });
  });
});
