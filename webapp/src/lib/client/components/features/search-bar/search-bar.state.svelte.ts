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
			keys: ['id'],
			shouldSort: true,
			// includeScore: true,
			threshold: 0.2,
	    };

	#debounceTimer: undefined | ReturnType<typeof setTimeout> = undefined;
	#debounceDelay: number = 300;

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

	// set showClearButton(val: boolean) {
	// 	this.#showClearButton = val;
	// }

	get searchResults() {
		return this.#searchResults;
	}

	private set searchResults(val: SearchItem[]) {
		this.#searchResults = val;
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
		// console.log('performing search');
        const results = this.searchItems();
		// console.log('search results', results.length);
        this.#searchResults = results;
        this.#selectedIndex = -1;
        // this.isOpen = results.length > 0;
    }

	clearSearch = () => {

		if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = undefined;
        }

		this.#searchQuery = '';
		// this.isOpen = false;
		this.#searchResults = [];
	}

	async getSearchResources() {
		// console.log('fetching search resources');
		const resources = await this.#fetch('/api/resources');
		const data = (await resources.json()) as ResourcesApiResponse;
		this.#items = data.items;
		this.fuse = new Fuse(this.#items, this.fuseOptions);
	}

	setDebounceDelay(delay: number) {
		this.#debounceDelay = delay;
	}
}

