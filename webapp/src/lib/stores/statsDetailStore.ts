import type { StatsDynamoRecord } from "$lib/types";
import { writable, type Writable} from "svelte/store";

export const statsDetailStore: Writable<StatsDynamoRecord[]> = writable([]);

export const statsDetailLoading = writable(false);

export const statsDetailError: Writable<null | unknown> = writable(null)