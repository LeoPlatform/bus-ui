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

    navigateToRelationshipView() {
        console.log('going to workflow', this.#selectedBotId);
        
        window.location.href = `/workflows/${this.#selectedBotId}`;
    }

    navigateToDashboardView() {
        console.log('going to dashboard', this.#selectedBotId);
        window.location.href = `/dashboard/${this.#selectedBotId}`;
    }
}