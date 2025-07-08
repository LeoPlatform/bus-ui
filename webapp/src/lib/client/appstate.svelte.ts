import type { UserData } from "$lib/types";
import { BotTableState } from "./components/features/bot-table/bot-table.state.svelte";
import { BotState } from "./components/features/bot/bot.state.svelte";
import { SearchBarState } from "./components/features/search-bar/search-bar.state.svelte";
import { TimePickerState } from "./components/features/time-picker/time-picker.state.svelte";
type GlobalFetch = typeof globalThis.fetch;

export class AppState {
    #fetch: GlobalFetch;
    #botState: BotState | undefined;
    #botTableState: BotTableState | undefined;
    #userData: UserData;
    #timePickerState: TimePickerState | undefined;
    #searchBarState: SearchBarState | undefined;

    constructor(fetch: GlobalFetch, userData: UserData) {
        this.#fetch = fetch;
        this.#userData = userData;

    }
   
    get userData() {
        return this.#userData;
    }

    get botState() {
        if(!this.#botState) {
            this.#botState = new BotState(this.#fetch);
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

    navigateToRelationshipView(id: string) {
        console.log('going to workflow', id);
        window.location.href = `/workflows/${id}`;
    }

    navigateToDashboardView(id: string) {
        console.log('going to dashboard', id);
        window.location.href = `/dashboard/${id}`;
    }
}