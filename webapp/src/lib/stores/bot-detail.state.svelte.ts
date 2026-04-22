/**
 * Bot detail state (runes). Replaces legacy botDetailStore / botSettingsStore.
 * Client-only; server returns data via API and client updates this state.
 */

import type { BotSettings } from '$lib/types';

export class BotDetailState {
	#list = $state<BotSettings[]>([]);
	#loading = $state(false);
	#error = $state<unknown>(null);

	get list() {
		return this.#list;
	}
	get loading() {
		return this.#loading;
	}
	get error() {
		return this.#error;
	}

	hydrate(settings: BotSettings[]) {
		this.#list = Array.isArray(settings) ? settings : [];
		this.#error = null;
	}

	setLoading(loading: boolean) {
		this.#loading = loading;
	}
	setError(err: unknown) {
		this.#error = err;
	}
}

export const botDetailState = new BotDetailState();
