import type { BotSettings } from "$lib/types";
import { writable, type Writable} from "svelte/store";

export const botDetailStore: Writable<BotSettings[]> = writable([]);

export const botDetailLoading = writable(false);

export const botDetailError: Writable<null | unknown> = writable(null)
