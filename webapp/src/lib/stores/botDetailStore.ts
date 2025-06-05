import type { BotSettings } from "$lib/types";
import { writable, type Writable} from "svelte/store";

export const botDetailStore: Writable<BotSettings[]> = writable([]);

export const botDetailLoading = writable(false);

export const botDetailError: Writable<null | unknown> = writable(null)


interface BotSettingsStore extends Writable<BotSettings[]> {
    hydrate:(settings: BotSettings[]) => void;
}

function createBotSettingsStore(): BotSettingsStore {
    const {subscribe, set, update} = writable<BotSettings[]>([]);

    return {
        subscribe,
        hydrate(settings: BotSettings[]) {
            set(settings);
        },
        set,
        update,
    }
}

export const botSettingsStore = createBotSettingsStore();