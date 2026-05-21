<script lang="ts">
    import { browser } from '$app/environment';
    import { base } from '$app/paths';
    import { page } from '$app/state';
    import TraceViewPrototype from '$lib/client/components/features/trace/trace-view-prototype.svelte';
    import TraceQueuePicker from '$lib/client/components/features/trace/trace-queue-picker.svelte';
    import { Button } from '$lib/client/components/ui/button/index';
    import Loader2 from '@lucide/svelte/icons/loader-2';

    type TracePayload = {
        parents?: Record<string, unknown>[];
        event?: Record<string, unknown> | null;
        children?: Record<string, Record<string, unknown>>;
    };

    function normalizeParents(raw: unknown): Record<string, unknown>[] {
        if (Array.isArray(raw)) return raw as Record<string, unknown>[];
        if (raw && typeof raw === 'object') return Object.values(raw as Record<string, unknown>);
        return [];
    }

    let traceData = $state<TracePayload | null>(null);
    let loading = $state(false);
    let error = $state<string | null>(null);

    /** Stable key so the fetch effect does not re-fire on unrelated `page` identity churn. */
    const traceQueryKey = $derived(page.url.searchParams.toString());

    const queue = $derived(page.url.searchParams.get('queue') ?? '');
    const eid = $derived(page.url.searchParams.get('eid') ?? '');

    /** Bumped when a new trace fetch starts; stale async completions must not touch state. */
    let traceFetchGeneration = 0;

    $effect(() => {
        if (!browser) return;

        // Subscribe only to search params, not the whole page object.
        void traceQueryKey;

        const q = page.url.searchParams.get('queue') ?? '';
        const e = page.url.searchParams.get('eid') ?? '';

        if (!q || !e) {
            traceData = null;
            error = null;
            loading = false;
            return;
        }

        const ac = new AbortController();
        /** Monotonic id so aborted in-flight requests do not leave `loading` stuck true. */
        const requestId = ++traceFetchGeneration;
        loading = true;
        error = null;
        traceData = null;

        (async () => {
            try {
                const u = new URL(`${base}/api/eventTrace`, window.location.origin);
                u.searchParams.set('queue', q);
                u.searchParams.set('eid', e);
                const res = await fetch(u.toString(), {
                    credentials: 'include',
                    signal: ac.signal,
                });
                const text = await res.text();
                if (requestId !== traceFetchGeneration) return;
                if (!res.ok) {
                    let msg = text;
                    try {
                        const j = JSON.parse(text) as { error?: string };
                        if (j.error) msg = j.error;
                    } catch {
                        /* use raw text */
                    }
                    throw new Error(msg || `${res.status} ${res.statusText}`);
                }
                traceData = JSON.parse(text) as TracePayload;
            } catch (err) {
                if (requestId !== traceFetchGeneration) return;
                if (err instanceof DOMException && err.name === 'AbortError') return;
                error = err instanceof Error ? err.message : String(err);
            } finally {
                if (requestId === traceFetchGeneration) loading = false;
            }
        })();

        return () => ac.abort();
    });
</script>

<div class="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
    <header class="shrink-0">
        <h1 class="text-xl font-semibold tracking-tight">Trace</h1>
        <p class="mt-1 text-sm text-muted-foreground">
            Event lineage across queues and bots. Pick a queue below, then select an event to trace — or open from
            the dashboard <strong>Events</strong> tab.
        </p>
        {#if queue && eid}
            <p class="mt-2 font-mono text-xs text-muted-foreground break-all">
                <span class="text-foreground/80">queue</span> {queue}
                <span class="mx-2 text-foreground/40">·</span>
                <span class="text-foreground/80">eid</span> {eid}
            </p>
        {/if}
    </header>

    <div class="min-h-0 min-w-0 flex-1 rounded-lg border bg-background p-4 md:p-6
        {(!queue || !eid) ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}">
        {#if !queue || !eid}
            <TraceQueuePicker />
        {:else if loading}
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="h-4 w-4 animate-spin" />
                Loading trace…
            </div>
        {:else if error}
            <div class="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
            </div>
            <Button variant="secondary" class="mt-4" href="{base}/dashboard">Back to dashboard</Button>
        {:else if traceData}
            <TraceViewPrototype
                parents={normalizeParents(traceData.parents)}
                event={traceData.event ?? null}
                children={traceData.children && typeof traceData.children === 'object' ? traceData.children : {}}
            />
        {/if}
    </div>
</div>
