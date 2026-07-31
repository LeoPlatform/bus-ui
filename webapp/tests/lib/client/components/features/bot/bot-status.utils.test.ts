import { describe, it, expect } from 'vitest';
import { evaluateBotStatus } from '$comps/features/bot/bot-status.utils';
import { BOT_STATUS_DEFAULTS } from '$comps/features/bot/bot-status.constants';
import type { BotSettings, MergedStatsRecord, ReadWriteStats } from '$lib/types';

const NOW = Date.now();

/** Build a minimal read-stat with the given (window) error count and enough units to keep the rate low. */
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

/** Stats with `errors` errors in the current window (drives BLOCKED, not ROGUE). */
function statsWithReadErrors(errors: number, units = 1000): MergedStatsRecord {
    return { id: 'my-bot', read: { 'queue:source': readStat(errors, units) } } as MergedStatsRecord;
}

describe('evaluateBotStatus', () => {
    const ROGUE = BOT_STATUS_DEFAULTS.ROGUE_ERROR_THRESHOLD; // 10

    describe('rogue is driven by the persisted errorCount (matches legacy bus-ui)', () => {
        it('reports rogue when the persisted errorCount exceeds the threshold', () => {
            const result = evaluateBotStatus(bot({ errorCount: ROGUE + 1 }), statsWithReadErrors(0));
            expect(result.rogue).toBe(true);
            expect(result.status).toBe('rogue');
        });

        it('stays rogue even when the current window has zero errors', () => {
            // The whole point of using the persisted counter: a narrow/quiet time window
            // must not clear a rogue bot.
            const result = evaluateBotStatus(bot({ errorCount: 25 }), statsWithReadErrors(0));
            expect(result.status).toBe('rogue');
        });

        it('is NOT rogue when only the window has many errors but the persisted count is low', () => {
            // 15 window errors but persisted errorCount 0 → blocked (current errors), not rogue.
            const result = evaluateBotStatus(bot({ errorCount: 0 }), statsWithReadErrors(15));
            expect(result.rogue).toBe(false);
            expect(result.status).toBe('blocked');
        });
    });

    describe('rogue vs blocked precedence (ES-3461 issue 3)', () => {
        it('reports rogue (not blocked) when a rogue bot also has current window errors', () => {
            // Regression: the BLOCKED branch used to clobber status back to 'blocked'.
            const result = evaluateBotStatus(bot({ errorCount: ROGUE + 1 }), statsWithReadErrors(3));
            expect(result.status).toBe('rogue');
        });

        it('still reports blocked when there are current errors but the bot is not rogue', () => {
            const result = evaluateBotStatus(bot({ errorCount: 0 }), statsWithReadErrors(3));
            expect(result.status).toBe('blocked');
        });
    });

    describe('manual-state precedence', () => {
        it('rogue wins over paused (a paused bot that went rogue still shows rogue)', () => {
            const result = evaluateBotStatus(bot({ paused: true, errorCount: ROGUE + 5 }), statsWithReadErrors(0));
            expect(result.status).toBe('rogue');
            expect(result.rogue).toBe(true);
        });

        it('paused wins when the bot is not rogue', () => {
            const result = evaluateBotStatus(bot({ paused: true, errorCount: 0 }), statsWithReadErrors(0));
            expect(result.status).toBe('paused');
        });

        it('archived overrides rogue', () => {
            const result = evaluateBotStatus(bot({ archived: true, errorCount: ROGUE + 5 }), statsWithReadErrors(0));
            expect(result.status).toBe('archived');
        });
    });

    describe('non-error statuses', () => {
        it('reports running when there are no errors', () => {
            const result = evaluateBotStatus(bot({ errorCount: 0 }), statsWithReadErrors(0));
            expect(result.status).toBe('running');
        });
    });

    // Regression for the bug the playground pass caught: a rogue bot with NO stats in the
    // window used to short-circuit to 'running'. Rogue/paused/archived must be derived from
    // the record even when there are no window stats.
    describe('no-stats path derives status from the record', () => {
        it('reports rogue from the persisted count when there are no stats', () => {
            const result = evaluateBotStatus(bot({ errorCount: 25 }), undefined);
            expect(result.rogue).toBe(true);
            expect(result.status).toBe('rogue');
        });

        it('rogue wins over paused with no stats', () => {
            const result = evaluateBotStatus(bot({ paused: true, errorCount: 25 }), undefined);
            expect(result.status).toBe('rogue');
        });

        it('reports paused (not running) for a non-rogue paused bot with no stats', () => {
            const result = evaluateBotStatus(bot({ paused: true, errorCount: 0 }), undefined);
            expect(result.status).toBe('paused');
        });

        it('reports archived with no stats', () => {
            const result = evaluateBotStatus(bot({ archived: true, errorCount: 25 }), undefined);
            expect(result.status).toBe('archived');
        });

        it('reports running defaults for a healthy bot with no stats', () => {
            const result = evaluateBotStatus(bot({ errorCount: 0 }), undefined);
            expect(result.status).toBe('running');
            expect(result.rogue).toBe(false);
            expect(result.errorCount).toBe(0);
        });
    });
});
