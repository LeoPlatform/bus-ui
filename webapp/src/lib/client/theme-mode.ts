export const THEME_STORAGE_KEY = 'botmon-theme';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeRoot {
	classList: { toggle(token: string, force?: boolean): boolean };
	style: { colorScheme: string };
}

export function parseThemePreference(raw: unknown): ThemePreference {
	return THEME_PREFERENCES.includes(raw as ThemePreference) ? (raw as ThemePreference) : 'system';
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
	if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
	return preference;
}

export function applyResolvedTheme(root: ThemeRoot, resolved: ResolvedTheme): void {
	root.classList.toggle('dark', resolved === 'dark');
	root.style.colorScheme = resolved;
}
