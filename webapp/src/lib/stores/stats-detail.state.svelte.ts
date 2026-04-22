/**
 * Stats detail state (runes). Replaces legacy statsDetailStore.
 * Client-only; server returns data via API and client updates this state.
 */

import type { StatsDynamoRecord } from '$lib/types';

export class StatsDetailState {
	#list = $state<StatsDynamoRecord[]>([]);
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

	setList(list: StatsDynamoRecord[]) {
		this.#list = Array.isArray(list) ? list : [];
		this.#error = null;
	}
	setLoading(loading: boolean) {
		this.#loading = loading;
	}
	setError(err: unknown) {
		this.#error = err;
	}
}

export const statsDetailState = new StatsDetailState();
