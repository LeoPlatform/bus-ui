import type { UserData } from "$lib/types";
import { BotTableState } from "./components/features/bot-table/bot-table.state.svelte";
import { BotState } from "./components/features/bot/bot.state.svelte";
type GlobalFetch = typeof globalThis.fetch;

export class AppState {
    #fetch: GlobalFetch;
    #botState: BotState | undefined;
    #botTableState: BotTableState | undefined;
    #userData: UserData;

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
}