import type { UserData } from "$lib/types";
import { BotTableState } from "./components/features/bot-table/bot-table.state.svelte";
import { BotState } from "./components/features/bot/bot.state.svelte";
import { DashboardState } from "./components/features/dashboard/dashboard.state.svelte";
import { SearchBarState } from "./components/features/search-bar/search-bar.state.svelte";
import { TimePickerState } from "./components/features/time-picker/time-picker.state.svelte";
import { browser } from "$app/environment";
import { base } from "$app/paths";
import { goto } from "$app/navigation";
type GlobalFetch = typeof globalThis.fetch;

/**
 * Wrap fetch to prepend the base path to absolute URLs starting with '/'.
 * SvelteKit's client-side fetch does not auto-prepend paths.base for
 * absolute paths, so requests like fetch("/api/...") go to the wrong URL
 * when deployed behind a path prefix (e.g., /botmonAlpha).
 */
function withBasePath(fetch: GlobalFetch): GlobalFetch {
    if (!base) return fetch;
    return (input, init?) => {
        if (typeof input === 'string' && input.startsWith('/') && !input.startsWith(base)) {
            input = `${base}${input}`;
        }
        return fetch(input, init);
    };
}

export class AppState {
    #fetch: GlobalFetch;
    #botState: BotState | undefined;
    #botTableState: BotTableState | undefined;
    #userData: UserData;
    #timePickerState: TimePickerState | undefined;
    #searchBarState: SearchBarState | undefined;
    #isLocal: boolean;
    #dashboardState: DashboardState | undefined;

    constructor(fetch: GlobalFetch, userData: UserData) {
        this.#fetch = withBasePath(fetch);
        this.#userData = userData;
        this.#isLocal = browser && (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'));
    }
   
    get userData() {
        return this.#userData;
    }

    get isLocal() {
        return this.#isLocal;
    }

    get botState() {
        if(!this.#botState) {
            this.#botState = new BotState(this.#fetch);

            this.#botState.setTimePickerState(this.timePickerState);
        }
        return this.#botState;
    }

    get botTableState() {
        if(!this.#botTableState) {
            this.#botTableState = new BotTableState(this.#fetch);
        }
        return this.#botTableState;
    }

    get timePickerState() {
        if(!this.#timePickerState) {
            this.#timePickerState = new TimePickerState(this.#fetch);
        }
        return this.#timePickerState;
    }

    get searchBarState() {
        if(!this.#searchBarState) {
            this.#searchBarState = new SearchBarState(this.#fetch);
        }
        return this.#searchBarState;
    }

    get dashboardState() {
        if(!this.#dashboardState) {
            this.#dashboardState = new DashboardState(this.#fetch);
            this.#dashboardState.setTimePickerState(this.timePickerState);
        }
        return this.#dashboardState;
    }

    navigateToRelationshipView(id: string) {
        if (browser) {
            this.botState.selectedBotId = id;
            void goto(`/workflows/${id}`);
        }
    }

    navigateToDashboardView(id: string) {
        if (browser) {
            void goto(`/dashboard/${id}`);
        }
    }
}