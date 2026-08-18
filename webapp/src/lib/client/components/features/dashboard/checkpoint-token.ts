/**
 * Helpers for building LeoBus read-checkpoint "z-tokens" of the form
 * `z/YYYY/MM/DD/HH/mm/ss/` (all fields UTC).
 *
 * Kept free of Svelte and @internationalized/date so it can be unit-tested in a
 * plain node environment and reused by the checkpoint action bar.
 */

/** Sentinel token meaning "from the beginning of time". */
export const BEGINNING_CHECKPOINT_TOKEN = 'z/';

const pad = (n: number) => String(n).padStart(2, '0');

export interface CheckpointTokenParts {
    /** Full year, e.g. 2026. */
    year: number;
    /** Month 1-12. */
    month: number;
    /** Day of month 1-31. */
    day: number;
    hour: number;
    minute: number;
    second: number;
}

/** Build a `z/YYYY/MM/DD/HH/mm/ss/` token from explicit (UTC) parts. */
export function buildCheckpointToken(parts: CheckpointTokenParts): string {
    return (
        `z/${parts.year}/${pad(parts.month)}/${pad(parts.day)}/` +
        `${pad(parts.hour)}/${pad(parts.minute)}/${pad(parts.second)}/`
    );
}

/** The current time as a checkpoint token (UTC). */
export function nowCheckpointToken(date: Date = new Date()): string {
    return buildCheckpointToken({
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
    });
}

/**
 * Parse an `<input type="time">` value (`HH:mm` or `HH:mm:ss`) into numeric parts.
 * Seconds default to 0 when omitted. Returns null if the value is malformed or
 * out of range.
 */
export function parseTimeInput(time: string): { hour: number; minute: number; second: number } | null {
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = match[3] !== undefined ? Number(match[3]) : 0;

    if (hour > 23 || minute > 59 || second > 59) return null;
    return { hour, minute, second };
}

/** A calendar date's year / month (1-based) / day — matches @internationalized/date's CalendarDate. */
export interface CalendarDateParts {
    year: number;
    month: number;
    day: number;
}

/**
 * Build a checkpoint token from a picked calendar date and a time string,
 * interpreting both as UTC. Returns null when either input is missing/invalid so
 * the caller can surface a validation error.
 */
export function checkpointTokenFromDateTime(
    date: CalendarDateParts | null | undefined,
    time: string,
): string | null {
    if (!date) return null;
    const parsed = parseTimeInput(time);
    if (!parsed) return null;
    return buildCheckpointToken({
        year: date.year,
        month: date.month,
        day: date.day,
        hour: parsed.hour,
        minute: parsed.minute,
        second: parsed.second,
    });
}
