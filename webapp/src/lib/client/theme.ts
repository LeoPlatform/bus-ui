/**
 * Botmon design token names for use in JS/TS (e.g. chart series colors, badges).
 * Actual values live in app.pcss (:root / .dark). Use these constants so a full
 * reskin only requires editing app.pcss.
 */

export const STATUS = {
	normal: 'var(--status-normal)',
	danger: 'var(--status-danger)',
	error: 'var(--status-error)',
	paused: 'var(--status-paused)',
	rogue: 'var(--status-rogue)',
	archived: 'var(--status-archived)',
} as const;

export const LAG = {
	ok: 'var(--lag-ok)',
	warning: 'var(--lag-warning)',
	critical: 'var(--lag-critical)',
} as const;

export const CHART_COLORS = [
	'var(--chart-1)',
	'var(--chart-2)',
	'var(--chart-3)',
	'var(--chart-4)',
	'var(--chart-5)',
	'var(--chart-6)',
	'var(--chart-7)',
	'var(--chart-8)',
] as const;
