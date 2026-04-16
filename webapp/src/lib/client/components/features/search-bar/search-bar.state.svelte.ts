import type { ResourcesApiResponse, SearchItem } from "./types";
import Fuse, { type IFuseOptions } from "fuse.js";

type GlobalFetch = typeof globalThis.fetch;

export class SearchBarState {
    #fetch: GlobalFetch;
    #searchQuery = $state('');
    #maxResults: number = $state(0);
    #selectedIndex: number = $state(-1);
    isOpen: boolean = $derived(this.searchResults.length > 0);
    #searchResults: SearchItem[] = $state([]);
	#showClearButton: boolean = $derived(this.#searchQuery.length > 0);

    #items = $state<SearchItem[]>([]);
	fuse: Fuse<SearchItem>;
	fuseOptions: IFuseOptions<SearchItem> = {
			keys: ['id', 'name'],
			shouldSort: true,
			threshold: 0.3,
			ignoreLocation: true,
			minMatchCharLength: 2,
	    };

	#debounceTimer: undefined | ReturnType<typeof setTimeout> = undefined;
	#debounceDelay: number = 300;
	#resourcesFetchedAt: number = 0;
	#staleTime: number = 30_000;

    constructor(fetch: GlobalFetch, maxResults?: number) {
        this.#fetch = fetch;
		
        this.#maxResults = maxResults || 5;

		this.fuse = new Fuse(this.#items, this.fuseOptions);
    }

	get searchQuery() {
		return this.#searchQuery;
	}

	set searchQuery(val: string) {
		this.#searchQuery = val;

		this.debouncedSearch();
	}

	get showClearButton() {
		return this.#showClearButton;
	}

	get searchResults() {
		return this.#searchResults;
	}

	private set searchResults(val: SearchItem[]) {
		this.#searchResults = val;
	}

	get selectedIndex() {
		return this.#selectedIndex;
	}

	set selectedIndex(value: number) {
		this.#selectedIndex = value;
	}

	get selectedItem(): SearchItem | null {
		if (this.#selectedIndex >= 0 && this.#selectedIndex < this.#searchResults.length) {
			return this.#searchResults[this.#selectedIndex];
		}
		return null;
	}

	navigateUp() {
		if (this.#searchResults.length === 0) return;
		
		this.#selectedIndex = this.#selectedIndex <= 0 
			? this.#searchResults.length - 1 
			: this.#selectedIndex - 1;
	}

	navigateDown() {
		if (this.#searchResults.length === 0) return;
		
		this.#selectedIndex = this.#selectedIndex >= this.#searchResults.length - 1 
			? 0 
			: this.#selectedIndex + 1;
	}

	resetSelection() {
		this.#selectedIndex = -1;
	}

	private debouncedSearch() {
		if(this.#debounceTimer) {
			clearTimeout(this.#debounceTimer)
		}

		this.#debounceTimer = setTimeout(() => {
			this.performSearch();
		}, this.#debounceDelay);
	}

    searchItems(): SearchItem[] {
		if (!this.#searchQuery || this.#searchQuery.length < 1) {
			return [];
		}

		return this.fuse.search(this.#searchQuery).map(result => result.item);
	}

    performSearch() {
        const results = this.searchItems();
        this.#searchResults = results;
        this.#selectedIndex = -1;
    }

	clearSearch = () => {
		if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = undefined;
        }

		this.#searchQuery = '';
		this.#searchResults = [];
		this.#selectedIndex = -1;
	}

	/**
	 * Populate search index from already-loaded catalog data instead of making
	 * a separate API call that does three more full DynamoDB table scans.
	 * Fuse.js indexing is deferred so it doesn't block the initial render.
	 */
	populateFromCatalog(items: SearchItem[]) {
		this.#items = items;
		this.#resourcesFetchedAt = Date.now();
		// Defer Fuse index build — on 8000+ items this takes ~100-200ms
		// and would block the first paint if done synchronously.
		setTimeout(() => {
			this.fuse = new Fuse(this.#items, this.fuseOptions);
		}, 0);
	}

	async getSearchResources(force = false) {
		if (!force && this.#resourcesFetchedAt > 0 && Date.now() - this.#resourcesFetchedAt < this.#staleTime) {
			return;
		}

		const resources = await this.#fetch('/api/resources');
		const data = (await resources.json()) as ResourcesApiResponse;
		this.#items = data.items;
		this.fuse = new Fuse(this.#items, this.fuseOptions);
		this.#resourcesFetchedAt = Date.now();
	}

	setDebounceDelay(delay: number) {
		this.#debounceDelay = delay;
	}
}