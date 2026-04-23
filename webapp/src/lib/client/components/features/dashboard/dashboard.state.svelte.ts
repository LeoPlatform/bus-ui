import { NodeType } from "$lib/types";
import type { TimePickerState } from "../time-picker/time-picker.state.svelte";
import type { DashboardSettings } from "./types";

type GlobalFetch = typeof globalThis.fetch;

export class DashboardState {
    #fetch: GlobalFetch;
    #dashType: NodeType = $state(NodeType.Bot);
    #settings: DashboardSettings | undefined = $state(undefined);
    #stats: any | undefined = $state(undefined);
    #range: string = $state('minute_15');
    #timePickerState: TimePickerState | null = null;
    #id: string = $state('');
    #isPaused: boolean | undefined = $derived(this.#settings?.paused);
    #loading: boolean = $state(false);

    constructor(fetch: GlobalFetch) {
        this.#fetch = fetch;
    }

    get settings() {
        return this.#settings;
    }

    get stats() {
        return this.#stats;
    }

    get range() {
        return this.#range;
    }

    set range(r: string) {
        this.#range = r;
        this.getDashStats();
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
        if (this.#id === id) return;
        this.#id = id;
        // Don't clear settings/stats here — clearing triggers the skeleton which
        // unmounts and remounts tab components, causing doubled API calls.
        // The fetch in dashboard.svelte replaces data atomically.
        this.#loading = true;
    }

    get isPaused() {
        return this.#isPaused;
    }

    get loading() {
        return this.#loading;
    }

    setTimePickerState(timePickerState: TimePickerState) {
        this.#timePickerState = timePickerState;
        this.#timePickerState.setOnTimeRangeChangeCallback((state) => {
            this.range = state.range;
        });
    }

    async getSettings() {
        if(!this.#id) {
            throw new Error('No ID set');
        }

        const id = this.#id;
        this.#loading = true;

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
        } finally {
            this.#loading = false;
        }
    }

    async getDashStats() {
        if(!this.#id) {
            throw new Error('No ID set');
        }

        this.#loading = true;

        try {
            const timestamp = this.#timePickerState?.endTime ?? Date.now();

            const res = await this.#fetch(`/api/dashboard/details`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: this.#id,
                    range: this.#range,
                    timestamp
                })
            });

            if(!res.ok) {
                console.error(`Failed to get stats for ${this.#id}: ${res.status} ${res.statusText}`);
                return;
            }

            const data = await res.json();
            if (data && data.dashStats) {
                this.#stats = data.dashStats;
            } else {
                this.#stats = data;
            }
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            this.#loading = false;
        }
    }

    async saveSettings(updates: Record<string, any>): Promise<void> {
        if (!this.#id) {
            throw new Error('No ID set');
        }

        const res = await this.#fetch('/api/dashboard/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: this.#id, updates }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to save settings: ${res.status} ${text}`);
        }

        // Refresh settings from server so UI reflects saved values
        await this.getSettings();
    }

    async togglePause() {
        const newPaused = !this.#isPaused;
        await this.saveSettings({ paused: newPaused });
    }

    async changeCheckpoint(checkpoint: Record<string, string>) {
        if (!this.#id) throw new Error('No ID set');

        const res = await this.#fetch('/api/cron/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: this.#id, checkpoint }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to change checkpoint: ${res.status} ${text}`);
        }

        await this.getSettings();
    }

    async forceRun() {
        if (!this.#id) throw new Error('No ID set');

        const res = await this.#fetch('/api/cron/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: this.#id, executeNow: true }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to force run: ${res.status} ${text}`);
        }

        await this.getSettings();
    }

    async forceRunReally() {
        if (!this.#id) throw new Error('No ID set');

        const res = await this.#fetch('/api/cron/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: this.#id, executeNow: true, executeNowClear: true }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to force run (really): ${res.status} ${text}`);
        }

        await this.getSettings();
    }

    async changeCheckpointAndForceRun(checkpoint: Record<string, string>) {
        if (!this.#id) throw new Error('No ID set');

        const res = await this.#fetch('/api/cron/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: this.#id, checkpoint, executeNow: true }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to change checkpoint and force run: ${res.status} ${text}`);
        }

        await this.getSettings();
    }

    /** Pass `forId` when the UI route id may update before `this.id` syncs (e.g. queue schema tab). */
    async getSchema(forId?: string): Promise<Record<string, any> | null> {
        const sid = forId ?? this.#id;
        if (!sid) return null;

        const res = await this.#fetch('/api/dashboard/schema', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: sid }),
        });

        if (!res.ok) return null;
        const data = await res.json();
        return data.schema ?? null;
    }

    async saveSchema(schema: Record<string, any>): Promise<void> {
        if (!this.#id) throw new Error('No ID set');

        const res = await this.#fetch('/api/dashboard/schema', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: this.#id, schema }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to save schema: ${res.status} ${text}`);
        }
    }

    // Method to clear state when component unmounts
    clearState() {
        this.#settings = undefined;
    }
}