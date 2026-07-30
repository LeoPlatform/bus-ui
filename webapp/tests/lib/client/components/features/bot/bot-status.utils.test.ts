import { describe, it, expect } from 'vitest';
import { evaluateBotStatus } from '$comps/features/bot/bot-status.utils';
import { BOT_STATUS_DEFAULTS } from '$comps/features/bot/bot-status.constants';
import type { BotSettings, MergedStatsRecord, ReadWriteStats } from '$lib/types';

const NOW = Date.now();

/** Build a minimal read-stat with the given error count and enough units to keep the error RATE low. */
function readStat(errors: number, units = 1000): ReadWriteStats {
    return {
        checkpoint: 'z/2026/07/30/00/00/00/',
        // Keep timestamps at "now" so lag alarms don't fire and confound the status.
        timestamp: NOW,
        source_timestamp: NOW,
        units,
        errors,
    };
}

function bot(overrides: Partial<BotSettings> = {}): BotSettings {
    return { id: 'my-bot', archived: false, paused: false, ...overrides };
}

function statsWithReadErrors(errors: number, units = 1000): MergedStatsRecord {
    return { id: 'my-bot', read: { 'queue:source': readStat(errors, units) } } as MergedStatsRecord;
}

describe('evaluateBotStatus', () => {
    const ROGUE = BOT_STATUS_DEFAULTS.ROGUE_ERROR_THRESHOLD; // 10

    describe('rogue vs blocked precedence (ES-3461 issue 3)', () => {
        it('reports rogue (not blocked) when error count exceeds the rogue threshold', () => {
            const result = evaluateBotStatus(bot(), statsWithReadErrors(ROGUE + 1));
            expect(result.rogue).toBe(true);
            // Regression: a rogue bot always has errors > 0, so the BLOCKED branch used to
            // clobber status back to 'blocked'. Rogue must win.
            expect(result.status).toBe('rogue');
        });

        it('still reports blocked when there are current errors but below the rogue threshold', () => {
            const result = evaluateBotStatus(bot(), statsWithReadErrors(3));
            expect(result.rogue).toBe(false);
            expect(result.status).toBe('blocked');
        });

        it('reports rogue at a high error count regardless of a low error rate', () => {
            // 50 errors out of 100k units → 0.05% error rate (well under the 50% alarm),
            // but still far past the rogue threshold.
            const result = evaluateBotStatus(bot(), statsWithReadErrors(50, 100_000));
            expect(result.status).toBe('rogue');
        });
    });

    describe('non-error statuses are unaffected', () => {
        it('reports running when there are no errors', () => {
            const result = evaluateBotStatus(bot(), statsWithReadErrors(0));
            expect(result.status).toBe('running');
        });

        it('paused overrides rogue', () => {
            const result = evaluateBotStatus(bot({ paused: true }), statsWithReadErrors(ROGUE + 5));
            expect(result.status).toBe('paused');
            // rogue flag is still surfaced for downstream badges/tooltips
            expect(result.rogue).toBe(true);
        });

        it('archived overrides rogue', () => {
            const result = evaluateBotStatus(bot({ archived: true }), statsWithReadErrors(ROGUE + 5));
            expect(result.status).toBe('archived');
        });

        it('returns running defaults when there are no stats', () => {
            const result = evaluateBotStatus(bot(), undefined);
            expect(result.status).toBe('running');
            expect(result.rogue).toBe(false);
            expect(result.errorCount).toBe(0);
        });
    });
});
