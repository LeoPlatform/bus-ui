<script lang="ts">
    import { calendarFormat } from '$lib/client/event-viewer/event-search-utils';

    type TraceNode = Record<string, unknown>;

    let {
        parents = [],
        event = null,
        children = {},
    }: {
        parents?: TraceNode[];
        event?: TraceNode | null;
        children?: Record<string, TraceNode>;
    } = $props();

    function fmtLag(lag: unknown): string {
        if (lag === null || lag === undefined || lag === '') return '';
        if (typeof lag === 'number') return `${lag} ms`;
        return String(lag);
    }

    function nodeTitle(n: TraceNode): string {
        return String(n.label ?? n.id ?? n.server_id ?? '');
    }

    function eventTime(n: TraceNode): string {
        const ts = n.timestamp as number | undefined;
        return calendarFormat(ts);
    }
</script>

{#if parents?.length}
    <section class="mb-8" aria-labelledby="trace-upstream-heading">
        <h2 id="trace-upstream-heading" class="mb-3 text-sm font-semibold text-muted-foreground">Upstream</h2>
        <ol class="ml-1 space-y-2 border-l-2 border-muted pl-4">
            {#each parents as step, i (i)}
                <li class="text-sm">
                    <span
                        class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs uppercase text-muted-foreground"
                        >{String(step.type ?? '')}</span
                    >
                    <span class="ml-2 font-medium">{nodeTitle(step)}</span>
                    {#if step.lag !== undefined && step.lag !== ''}
                        <span class="ml-2 text-muted-foreground">lag {fmtLag(step.lag)}</span>
                    {/if}
                </li>
            {/each}
        </ol>
    </section>
{/if}

{#if event}
    <section class="mb-8 rounded-lg border bg-card p-4 shadow-sm" aria-labelledby="trace-event-heading">
        <h2 id="trace-event-heading" class="mb-3 text-sm font-semibold text-muted-foreground">Event</h2>
        <dl class="grid gap-2 text-sm sm:grid-cols-2">
            <div>
                <dt class="text-muted-foreground">Queue</dt>
                <dd class="font-mono text-xs">{nodeTitle(event)}</dd>
            </div>
            <div>
                <dt class="text-muted-foreground">Created</dt>
                <dd>{eventTime(event)}</dd>
            </div>
            <div class="sm:col-span-2">
                <dt class="text-muted-foreground">Checkpoint / EID</dt>
                <dd class="break-all font-mono text-xs">
                    {String(event.eid ?? event.kinesis_number ?? event.checkpoint ?? '')}
                </dd>
            </div>
        </dl>
        {#if event.payload != null && typeof event.payload === 'object'}
            <details class="mt-4">
                <summary class="cursor-pointer text-sm font-medium text-muted-foreground">Payload</summary>
                <pre
                    class="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">{JSON.stringify(
                        event.payload,
                        null,
                        2,
                    )}</pre>
            </details>
        {/if}
    </section>
{/if}

{#if children && Object.keys(children).length}
    <section aria-labelledby="trace-downstream-heading">
        <h2 id="trace-downstream-heading" class="mb-3 text-sm font-semibold text-muted-foreground">Downstream</h2>
        {#snippet walk(nodes: Record<string, TraceNode>, depth: number)}
            {#each Object.entries(nodes) as [key, n] (key)}
                <div class="mb-2 border-l border-border py-1" style="padding-left: {12 + depth * 14}px">
                    <div class="text-sm">
                        <span
                            class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs uppercase text-muted-foreground"
                            >{String(n.type ?? '')}</span
                        >
                        <span class="ml-2 font-medium">{nodeTitle(n)}</span>
                        {#if n.has_processed === true}
                            <span class="ml-2 text-xs text-green-600">processed</span>
                        {:else if n.has_processed === false}
                            <span class="ml-2 text-xs text-amber-600">pending</span>
                        {/if}
                        {#if n.lag !== undefined && n.lag !== '' && n.lag !== null}
                            <span class="ml-2 text-muted-foreground">lag {fmtLag(n.lag)}</span>
                        {/if}
                    </div>
                    {#if n.event && typeof n.event === 'object'}
                        <pre
                            class="mt-1 max-h-40 overflow-auto rounded bg-muted/50 p-2 font-mono text-[11px]">{JSON.stringify(
                                n.event,
                                null,
                                2,
                            )}</pre>
                    {/if}
                    {#if n.children && typeof n.children === 'object'}
                        {@const next = n.children as Record<string, TraceNode>}
                        {#if Object.keys(next).length}
                            {@render walk(next, depth + 1)}
                        {/if}
                    {/if}
                </div>
            {/each}
        {/snippet}
        {@render walk(children, 0)}
    </section>
{/if}
