import { NodeType } from "$lib/types";
import type { TimePickerState } from "../time-picker/time-picker.state.svelte";
import type { DashboardSettings } from "./types";

type GlobalFetch = typeof globalThis.fetch;

export class DashboardState {
    #fetch: GlobalFetch;
    #dashType: NodeType = $state(NodeType.Bot);
    #settings: DashboardSettings | undefined = $state(undefined);
    #timePickerState: TimePickerState | null = null;
    #id: string = $state('');
    #isPaused: boolean | undefined = $derived(this.#settings?.paused);

    constructor(fetch: GlobalFetch) {
        this.#fetch = fetch;
    }

    get settings() {
        return this.#settings;
    }

    get dashType() {
        return this.#dashType;
    }

    set dashType(dashType: NodeType) {
        this.#dashType = dashType;
    }

    get id() {
        return this.#id;
    }

    set id(id: string) {
        this.#id = id;
        // Clear settings when ID changes to prevent stale data
        this.#settings = undefined;
    }

    get isPaused() {
        return this.#isPaused;
    }

    setTimePickerState(timePickerState: TimePickerState) {
        this.#timePickerState = timePickerState;
    }

    async getSettings() {
        if(!this.#id) {
            throw new Error('No ID set');
        }

        const id = this.#id;
        
        try {

            const res = await this.#fetch("/api/dashboard/settings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({id})
            });

            if(!res.ok) {
                const errorMessage = `Failed to get settings for ${id}: ${res.status} ${res.statusText}`;
                throw new Error(errorMessage);
            }

            const data = await res.json();
            
            // The API returns {settings: ...} so we need to extract the settings
            if (data && typeof data === 'object' && 'settings' in data) {
                this.#settings = data.settings;
            } else {
                console.error('Unexpected API response structure:', data);
                throw new Error('Invalid API response structure');
            }
        } catch (error) {
            throw error;
        }
    }

    async getDashStats() {
        if(!this.#id) {
            throw new Error('No ID set');
        }
        
        // TODO: Implement dashboard stats fetching
    }

    async togglePause() {
        // If we don't have a paused state that is fine just don't do anything
        if(this.#isPaused !== undefined) {
            this.#isPaused = !this.#isPaused;
            //TODO: Update the settings with the new paused state
        }
    }

    async changeCheckpoint() {
        // TODO: Implement checkpoint changing
        // Fetch the settings again after changing the checkpoint
    }

    async forceRun() {
        // TODO: Implement force run
    }

    async forceRunReally() {
        // TODO: Implement force run really
    }

    // Method to clear state when component unmounts
    clearState() {
        this.#settings = undefined;
    }
}