<script lang="ts">
    import { browser } from '$app/environment';
    import { base } from '$app/paths';
    import { page } from '$app/state';
    import TraceLineage from '$lib/client/components/features/trace/trace-lineage.svelte';
    import { Button } from '$lib/client/components/ui/button/index';
    import Loader2 from '@lucide/svelte/icons/loader-2';

    type TracePayload = {
        parents?: Record<string, unknown>[];
        event?: Record<string, unknown> | null;
        children?: Record<string, Record<string, unknown>>;
    };

    let traceData = $state<TracePayload | null>(null);
    let loading = $state(false);
    let error = $state<string | null>(null);

    const queue = $derived(page.url.searchParams.get('queue') ?? '');
    const eid = $derived(page.url.searchParams.get('eid') ?? '');

    $effect(() => {
        if (!browser) return;

        const q = queue;
        const e = eid;

        if (!q || !e) {
            traceData = null;
            error = null;
            loading = false;
            return;
        }

        const ac = new AbortController();
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
                if (ac.signal.aborted) return;
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
                if (err instanceof DOMException && err.name === 'AbortError') return;
                error = err instanceof Error ? err.message : String(err);
            } finally {
                if (!ac.signal.aborted) loading = false;
            }
        })();

        return () => ac.abort();
    });
</script>

<div class="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
    <header class="shrink-0">
        <h1 class="text-xl font-semibold tracking-tight">Trace</h1>
        <p class="mt-1 text-sm text-muted-foreground">
            Event lineage across queues and bots. Open from the dashboard queue <strong>Events</strong> tab (trace
            action) or append
            <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">?queue=…&amp;eid=…</code> to this URL.
        </p>
        {#if queue && eid}
            <p class="mt-2 font-mono text-xs text-muted-foreground break-all">
                <span class="text-foreground/80">queue</span> {queue}
                <span class="mx-2 text-foreground/40">·</span>
                <span class="text-foreground/80">eid</span> {eid}
            </p>
        {/if}
    </header>

    <div class="min-h-0 min-w-0 flex-1 overflow-x-auto rounded-lg border bg-background p-4 md:p-6">
        {#if !queue || !eid}
            <p class="text-sm text-muted-foreground">Select an event and use <strong>Trace</strong> from the queue events tab, or pass query parameters.</p>
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
            <TraceLineage
                parents={traceData.parents ?? []}
                event={traceData.event ?? null}
                children={traceData.children ?? {}}
            />
        {/if}
    </div>
</div>
