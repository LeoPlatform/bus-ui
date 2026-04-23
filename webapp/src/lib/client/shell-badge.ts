import { writable } from "svelte/store";

/** Shown on the left nav (e.g. alarmed bots). Updated from `(authed)/+layout.svelte`. */
export const alarmedBotNavCount = writable(0);
