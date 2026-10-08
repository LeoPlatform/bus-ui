import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	applyResolvedTheme,
	parseThemePreference,
	resolveTheme,
	THEME_STORAGE_KEY,
	type ThemeRoot
} from '$lib/client/theme-mode';
import { ThemeModeState, type ThemeEnv } from '$lib/client/theme-mode.state.svelte';

function fakeRoot() {
	const classes = new Set<string>();
	const root: ThemeRoot = {
		classList: {
			toggle(token: string, force?: boolean) {
				const on = force ?? !classes.has(token);
				if (on) classes.add(token);
				else classes.delete(token);
				return on;
			}
		},
		style: { colorScheme: '' }
	};
	return { root, classes };
}

class FakeMediaQueryList extends EventTarget {
	matches: boolean;
	listeners = new Set<EventListenerOrEventListenerObject>();

	constructor(matches: boolean) {
		super();
		this.matches = matches;
	}

	addEventListener(...args: Parameters<EventTarget['addEventListener']>) {
		if (args[1]) this.listeners.add(args[1]);
		super.addEventListener(...args);
	}

	removeEventListener(...args: Parameters<EventTarget['removeEventListener']>) {
		if (args[1]) this.listeners.delete(args[1]);
		super.removeEventListener(...args);
	}

	setMatches(next: boolean) {
		this.matches = next;
		this.dispatchEvent(new Event('change'));
	}
}

function fakeStorage(seed: Record<string, string> = {}) {
	const data = new Map(Object.entries(seed));
	return {
		data,
		storage: {
			getItem: (key: string) => data.get(key) ?? null,
			setItem: (key: string, value: string) => void data.set(key, value)
		}
	};
}

function buildEnv(opts: { systemDark?: boolean; stored?: string } = {}) {
	const { root, classes } = fakeRoot();
	const media = new FakeMediaQueryList(opts.systemDark ?? false);
	const store = fakeStorage(opts.stored ? { [THEME_STORAGE_KEY]: opts.stored } : {});
	const env: ThemeEnv = { storage: store.storage, media, root };
	return { env, root, classes, media, store };
}

describe('parseThemePreference', () => {
	it('accepts the three known preferences', () => {
		expect(parseThemePreference('light')).toBe('light');
		expect(parseThemePreference('dark')).toBe('dark');
		expect(parseThemePreference('system')).toBe('system');
	});

	it.each([null, undefined, '', 'DARK', 'auto', 42])('falls back to system for %p', (raw) => {
		expect(parseThemePreference(raw)).toBe('system');
	});
});

describe('resolveTheme', () => {
	it('follows the system when the preference is system', () => {
		expect(resolveTheme('system', true)).toBe('dark');
		expect(resolveTheme('system', false)).toBe('light');
	});

	it('ignores the system when the preference is explicit', () => {
		expect(resolveTheme('light', true)).toBe('light');
		expect(resolveTheme('dark', false)).toBe('dark');
	});
});

describe('applyResolvedTheme', () => {
	it('sets the dark class and color-scheme for dark', () => {
		const { root, classes } = fakeRoot();
		applyResolvedTheme(root, 'dark');
		expect(classes.has('dark')).toBe(true);
		expect(root.style.colorScheme).toBe('dark');
	});

	it('removes the dark class for light', () => {
		const { root, classes } = fakeRoot();
		applyResolvedTheme(root, 'dark');
		applyResolvedTheme(root, 'light');
		expect(classes.has('dark')).toBe(false);
		expect(root.style.colorScheme).toBe('light');
	});
});

describe('ThemeModeState', () => {
	it('defaults to system and resolves from the OS setting', () => {
		const { env, classes } = buildEnv({ systemDark: true });
		const state = new ThemeModeState(env);
		state.init();
		expect(state.preference).toBe('system');
		expect(state.resolved).toBe('dark');
		expect(classes.has('dark')).toBe(true);
	});

	it('resolves to light when the OS prefers light', () => {
		const { env, classes } = buildEnv({ systemDark: false });
		const state = new ThemeModeState(env);
		state.init();
		expect(state.resolved).toBe('light');
		expect(classes.has('dark')).toBe(false);
	});

	it('restores a stored preference over the OS setting', () => {
		const { env, classes } = buildEnv({ systemDark: true, stored: 'light' });
		const state = new ThemeModeState(env);
		state.init();
		expect(state.preference).toBe('light');
		expect(classes.has('dark')).toBe(false);
	});

	it('treats an unrecognised stored value as system', () => {
		const { env } = buildEnv({ systemDark: true, stored: 'sepia' });
		const state = new ThemeModeState(env);
		state.init();
		expect(state.preference).toBe('system');
		expect(state.resolved).toBe('dark');
	});

	it('persists and applies a new preference', () => {
		const { env, classes, store } = buildEnv({ systemDark: false });
		const state = new ThemeModeState(env);
		state.init();
		state.preference = 'dark';
		expect(store.data.get(THEME_STORAGE_KEY)).toBe('dark');
		expect(classes.has('dark')).toBe(true);
		state.preference = 'light';
		expect(store.data.get(THEME_STORAGE_KEY)).toBe('light');
		expect(classes.has('dark')).toBe(false);
	});

	it('follows OS changes only while the preference is system', () => {
		const { env, classes, media } = buildEnv({ systemDark: false });
		const state = new ThemeModeState(env);
		state.init();
		media.setMatches(true);
		expect(state.resolved).toBe('dark');
		expect(classes.has('dark')).toBe(true);

		state.preference = 'light';
		media.setMatches(false);
		media.setMatches(true);
		expect(state.resolved).toBe('light');
		expect(classes.has('dark')).toBe(false);
	});

	it('stops listening after cleanup', () => {
		const { env, media } = buildEnv();
		const state = new ThemeModeState(env);
		const cleanup = state.init();
		expect(media.listeners.size).toBe(1);
		cleanup();
		expect(media.listeners.size).toBe(0);
	});

	it('still works when storage throws', () => {
		const { env, classes } = buildEnv({ systemDark: true });
		env.storage = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		};
		const state = new ThemeModeState(env);
		expect(() => state.init()).not.toThrow();
		expect(state.preference).toBe('system');
		expect(() => (state.preference = 'light')).not.toThrow();
		expect(state.resolved).toBe('light');
		expect(classes.has('dark')).toBe(false);
	});

	it('is inert without a browser environment', () => {
		const state = new ThemeModeState({ storage: null, media: null, root: null });
		expect(() => state.init()()).not.toThrow();
		expect(state.resolved).toBe('light');
	});
});

describe('theme wiring guards', () => {
	const appHtml = readFileSync(resolve(__dirname, '../../../src/app.html'), 'utf8');
	const appPcss = readFileSync(resolve(__dirname, '../../../src/app.pcss'), 'utf8');

	it('pre-paint script in app.html reads the same storage key as the state class', () => {
		expect(appHtml).toContain(`'${THEME_STORAGE_KEY}'`);
		expect(appHtml).toContain('prefers-color-scheme: dark');
	});

	it('pre-paint script runs before sveltekit.head injects the stylesheet', () => {
		expect(appHtml.indexOf('prefers-color-scheme')).toBeLessThan(appHtml.indexOf('%sveltekit.head%'));
	});

	it('app.pcss defines the light palette on :root exactly once so .dark is the only dark override', () => {
		expect(appPcss.match(/^:root\s*\{/gm)).toHaveLength(1);
		expect(appPcss).toMatch(/^\.dark\s*\{/m);
	});

	it('app.pcss declares color-scheme for both modes', () => {
		expect(appPcss).toMatch(/:root\s*\{[^}]*color-scheme:\s*light/);
		expect(appPcss).toMatch(/\.dark\s*\{[^}]*color-scheme:\s*dark/);
	});
});
