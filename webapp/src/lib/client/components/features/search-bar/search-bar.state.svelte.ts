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
	#showClearButton: boolean = $state(false);

    #items = $state<SearchItem[]>([]);
	fuse: Fuse<SearchItem>;
	fuseOptions: IFuseOptions<SearchItem> = {
			keys: ['name'],
			// includeScore: true,
			// threshold: 0.3,
	    };



    constructor(fetch: GlobalFetch, maxResults?: number) {
        this.#fetch = fetch;
		
        this.#maxResults = maxResults || 5;

		this.fuse = new Fuse(this.#items, this.fuseOptions);
    }

	get searchQuery() {
		return this.#searchQuery;
	}

	set searchQuery(val: string) {
		this.searchQuery = val;
	}

	get showClearButton() {
		return this.#showClearButton;
	}

	set showClearButton(val: boolean) {
		this.showClearButton = val;
	}

	get searchResults() {
		return this.#searchResults;
	}

	protected set searchResults(val: SearchItem[]) {
		this.#searchResults = val;
	}


    searchItems(): SearchItem[] {


		if (!this.#searchQuery || this.#searchQuery.length < 1) {
			return [];
		}

		return this.fuse.search(this.#searchQuery, { limit: this.#maxResults }).map(result => result.item);

		
	}

    performSearch() {
        const results = this.searchItems();
        this.#searchResults = results;
        this.#selectedIndex = -1;
        // this.isOpen = results.length > 0;
    }

	clearSearch() {
		this.#searchQuery = '';
		// this.isOpen = false;
		this.searchResults = [];
	}

	async getSearchResources() {
		const resources = await this.#fetch('/api/resources');
		const data = (await resources.json()) as ResourcesApiResponse;
		this.#items = data.items;
		this.fuse = new Fuse(this.#items, this.fuseOptions);
	}
}

