import { describe, it, expect } from 'vitest';
import { evaluateBotStatus, isSameBotId, resolveHeaderBotStatus } from '$comps/features/bot/bot-status.utils';
import { BOT_STATUS_DEFAULTS } from '$comps/features/bot/bot-status.constants';
import type { BotSettings, MergedStatsRecord, ReadWriteStats } from '$lib/types';

const NOW = Date.now();

/** Build a minimal read-stat. Timestamps stay at "now" so lag alarms don't confound the status. */
function readStat(units = 1000): ReadWriteStats {
    return {
        checkpoint: 'z/2026/07/30/00/00/00/',
        timestamp: NOW,
        source_timestamp: NOW,
        units,
    };
}

function bot(overrides: Partial<BotSettings> = {}): BotSettings {
    return { id: 'my-bot', archived: false, paused: false, ...overrides };
}

/**
 * Stats with `errors` errors in the current window (drives BLOCKED, not ROGUE).
 * Errors live on the execution record — the only place the Leo stats table records
 * them (ES-4034: read/write entries carry no `errors` field on the live bus).
 */
function statsWithWindowErrors(errors: number, units = 1000): MergedStatsRecord {
    return {
        id: 'my-bot',
        execution: {
            completions: units - errors,
            duration: 1000,
            errors,
            max_duration: 10,
            min_duration: 1,
            units,
        },
        read: { 'queue:source': readStat(units) },
    } as MergedStatsRecord;
}

describe('evaluateBotStatus', () => {
    const ROGUE = BOT_STATUS_DEFAULTS.ROGUE_ERROR_THRESHOLD; // 10

    describe('rogue is driven by the persisted errorCount (matches legacy bus-ui)', () => {
        it('reports rogue when the persisted errorCount exceeds the threshold', () => {
            const result = evaluateBotStatus(bot({ errorCount: ROGUE + 1 }), statsWithWindowErrors(0));
            expect(result.rogue).toBe(true);
            expect(result.status).toBe('rogue');
        });

        it('stays rogue even when the current window has zero errors', () => {
            // The whole point of using the persisted counter: a narrow/quiet time window
            // must not clear a rogue bot.
            const result = evaluateBotStatus(bot({ errorCount: 25 }), statsWithWindowErrors(0));
            expect(result.status).toBe('rogue');
        });

        it('is NOT rogue when only the window has many errors but the persisted count is low', () => {
            // 15 window errors but persisted errorCount 0 → blocked (current errors), not rogue.
            const result = evaluateBotStatus(bot({ errorCount: 0 }), statsWithWindowErrors(15));
            expect(result.rogue).toBe(false);
            expect(result.status).toBe('blocked');
        });
    });

    describe('rogue vs blocked precedence (ES-3461 issue 3)', () => {
        it('reports rogue (not blocked) when a rogue bot also has current window errors', () => {
            // Regression: the BLOCKED branch used to clobber status back to 'blocked'.
            const result = evaluateBotStatus(bot({ errorCount: ROGUE + 1 }), statsWithWindowErrors(3));
            expect(result.status).toBe('rogue');
        });

        it('still reports blocked when there are current errors but the bot is not rogue', () => {
            const result = evaluateBotStatus(bot({ errorCount: 0 }), statsWithWindowErrors(3));
            expect(result.status).toBe('blocked');
        });
    });

    describe('window errors come from execution stats (ES-4034)', () => {
        it('reports errorCount/executions from the execution record, not read/write entries', () => {
            // The Leo stats table records errors only under current.execution; read/write
            // entries have no errors field, so summing them always yielded 0 and blocked/
            // danger never fired in production.
            const result = evaluateBotStatus(bot({ errorCount: 0 }), statsWithWindowErrors(15, 10000));
            expect(result.errorCount).toBe(15);
            expect(result.status).toBe('blocked');
        });
    });

    describe('dashboard header status (ES-4034)', () => {
        // Regression: a rogue bot showed rogue in the workflow tree but its dashboard header
        // looked healthy, because the header read ONLY the shared catalog entry.
        it('reports rogue from the page settings record when the catalog has not loaded', () => {
            const result = resolveHeaderBotStatus({ settingsErrorCount: 29, catalogEntry: undefined });
            expect(result.isRogue).toBe(true);
            expect(result.errorCount).toBe(29);
        });

        it('falls back to the catalog entry when the settings record has no count', () => {
            const result = resolveHeaderBotStatus({
                settingsErrorCount: undefined,
                catalogEntry: { errorCount: 25, status: 'rogue' },
            });
            expect(result.isRogue).toBe(true);
            expect(result.errorCount).toBe(25);
        });

        it('prefers the (fresher) settings count over a stale catalog count', () => {
            const result = resolveHeaderBotStatus({
                settingsErrorCount: 40,
                catalogEntry: { errorCount: 0, status: 'running' },
            });
            expect(result.isRogue).toBe(true);
            expect(result.errorCount).toBe(40);
        });

        it('is not rogue at or below the threshold, and never shows blocked while rogue', () => {
            expect(resolveHeaderBotStatus({ settingsErrorCount: ROGUE }).isRogue).toBe(false);
            expect(
                resolveHeaderBotStatus({ settingsErrorCount: 50, catalogEntry: { status: 'blocked' } }).isBlocked
            ).toBe(false);
        });

        it('surfaces blocked from the catalog when the bot is not rogue', () => {
            const result = resolveHeaderBotStatus({ settingsErrorCount: 0, catalogEntry: { status: 'blocked' } });
            expect(result.isRogue).toBe(false);
            expect(result.isBlocked).toBe(true);
        });

        it('matches bot ids across the optional bot: prefix', () => {
            expect(isSameBotId('bot:my-bot', 'my-bot')).toBe(true);
            expect(isSameBotId('my-bot', 'my-bot')).toBe(true);
            expect(isSameBotId('bot:my-bot', 'bot:my-bot')).toBe(true);
            expect(isSameBotId('my-bot', 'other-bot')).toBe(false);
            expect(isSameBotId(undefined, 'my-bot')).toBe(false);
        });
    });

    describe('manual-state precedence', () => {
        it('rogue wins over paused (a paused bot that went rogue still shows rogue)', () => {
            const result = evaluateBotStatus(bot({ paused: true, errorCount: ROGUE + 5 }), statsWithWindowErrors(0));
            expect(result.status).toBe('rogue');
            expect(result.rogue).toBe(true);
        });

        it('paused wins when the bot is not rogue', () => {
            const result = evaluateBotStatus(bot({ paused: true, errorCount: 0 }), statsWithWindowErrors(0));
            expect(result.status).toBe('paused');
        });

        it('archived overrides rogue', () => {
            const result = evaluateBotStatus(bot({ archived: true, errorCount: ROGUE + 5 }), statsWithWindowErrors(0));
            expect(result.status).toBe('archived');
        });
    });

    describe('non-error statuses', () => {
        it('reports running when there are no errors', () => {
            const result = evaluateBotStatus(bot({ errorCount: 0 }), statsWithWindowErrors(0));
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
