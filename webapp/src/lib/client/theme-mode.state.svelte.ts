import {
	applyResolvedTheme,
	parseThemePreference,
	resolveTheme,
	THEME_STORAGE_KEY,
	type ResolvedTheme,
	type ThemePreference,
	type ThemeRoot
} from './theme-mode';

export interface ThemeEnv {
	storage: Pick<Storage, 'getItem' | 'setItem'> | null;
	media: Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'> | null;
	root: ThemeRoot | null;
}

function browserThemeEnv(): ThemeEnv {
	if (typeof window === 'undefined') return { storage: null, media: null, root: null };
	let storage: ThemeEnv['storage'] = null;
	try {
		storage = window.localStorage;
	} catch {
		storage = null;
	}
	return {
		storage,
		media: window.matchMedia('(prefers-color-scheme: dark)'),
		root: document.documentElement
	};
}

export class ThemeModeState {
	#env: ThemeEnv | null;
	#preference = $state<ThemePreference>('system');
	#systemDark = $state(false);

	constructor(env?: ThemeEnv) {
		this.#env = env ?? null;
	}

	get preference(): ThemePreference {
		return this.#preference;
	}

	set preference(next: ThemePreference) {
		this.#preference = parseThemePreference(next);
		try {
			this.#env?.storage?.setItem(THEME_STORAGE_KEY, this.#preference);
		} catch {
			// Storage can be blocked (private mode, site data cleared); the choice then lasts for this page only.
		}
		this.#apply();
	}

	get resolved(): ResolvedTheme {
		return resolveTheme(this.#preference, this.#systemDark);
	}

	init(): () => void {
		const env = (this.#env ??= browserThemeEnv());
		try {
			this.#preference = parseThemePreference(env.storage?.getItem(THEME_STORAGE_KEY));
		} catch {
			this.#preference = 'system';
		}
		this.#systemDark = env.media?.matches ?? false;
		this.#apply();

		const media = env.media;
		if (!media) return () => {};
		const onChange = () => {
			this.#systemDark = media.matches;
			this.#apply();
		};
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	}

	#apply(): void {
		if (this.#env?.root) applyResolvedTheme(this.#env.root, this.resolved);
	}
}
