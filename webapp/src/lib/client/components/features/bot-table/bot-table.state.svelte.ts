type GlobalFetch = typeof globalThis.fetch;

export class BotTableState {
    #fetch: GlobalFetch;
    #selectedBotId: null | string = $state(null);

    constructor(fetch: GlobalFetch) {
        this.#fetch = fetch;
    }

    get selectedBotId() {
        return this.#selectedBotId;
    }

    set selectedBotId(id: null | string) {
        this.#selectedBotId = id;
    }
}