import { describe, it, expect } from 'vitest';
import {
    BEGINNING_CHECKPOINT_TOKEN,
    buildCheckpointToken,
    nowCheckpointToken,
    parseTimeInput,
    checkpointTokenFromDateTime,
} from '$comps/features/dashboard/checkpoint-token';

describe('checkpoint-token helpers', () => {
    describe('buildCheckpointToken', () => {
        it('zero-pads month/day/time to two digits', () => {
            expect(
                buildCheckpointToken({ year: 2026, month: 4, day: 7, hour: 3, minute: 5, second: 9 }),
            ).toBe('z/2026/04/07/03/05/09/');
        });

        it('leaves already two-digit fields intact', () => {
            expect(
                buildCheckpointToken({ year: 2026, month: 12, day: 31, hour: 23, minute: 59, second: 45 }),
            ).toBe('z/2026/12/31/23/59/45/');
        });
    });

    describe('nowCheckpointToken', () => {
        it('formats a fixed date as a UTC token', () => {
            const d = new Date(Date.UTC(2026, 3, 14, 10, 30, 45)); // month is 0-based here
            expect(nowCheckpointToken(d)).toBe('z/2026/04/14/10/30/45/');
        });
    });

    describe('parseTimeInput', () => {
        it('parses HH:mm:ss', () => {
            expect(parseTimeInput('10:30:45')).toEqual({ hour: 10, minute: 30, second: 45 });
        });

        it('defaults seconds to 0 for HH:mm', () => {
            expect(parseTimeInput('09:05')).toEqual({ hour: 9, minute: 5, second: 0 });
        });

        it('rejects out-of-range and malformed values', () => {
            expect(parseTimeInput('24:00:00')).toBeNull();
            expect(parseTimeInput('10:60')).toBeNull();
            expect(parseTimeInput('10:30:60')).toBeNull();
            expect(parseTimeInput('not-a-time')).toBeNull();
            expect(parseTimeInput('')).toBeNull();
        });
    });

    describe('checkpointTokenFromDateTime', () => {
        it('combines a calendar date and time into a UTC token', () => {
            expect(
                checkpointTokenFromDateTime({ year: 2026, month: 4, day: 14 }, '10:30:45'),
            ).toBe('z/2026/04/14/10/30/45/');
        });

        it('returns null when the date is missing', () => {
            expect(checkpointTokenFromDateTime(null, '10:30:45')).toBeNull();
        });

        it('returns null when the time is invalid', () => {
            expect(checkpointTokenFromDateTime({ year: 2026, month: 4, day: 14 }, 'bad')).toBeNull();
        });
    });

    it('exposes the beginning-of-time sentinel', () => {
        expect(BEGINNING_CHECKPOINT_TOKEN).toBe('z/');
    });
});
