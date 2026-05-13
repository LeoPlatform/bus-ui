<script lang="ts">
    import { calendarFormat } from '$lib/client/event-viewer/event-search-utils';
    import Cpu from '@lucide/svelte/icons/cpu';
    import Inbox from '@lucide/svelte/icons/inbox';
    import GitBranch from '@lucide/svelte/icons/git-branch';

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

    function nodeType(n: TraceNode): string {
        return String(n.type ?? '').toLowerCase();
    }
</script>

<!--
  Single-column lineage tree (closer to legacy EventTrace + Tree than flat sections):
  upstream chain → root event → nested downstream branches with left spine connectors.
-->
<div class="trace-lineage text-sm" role="tree" aria-label="Event trace lineage">
    <div
        class="mb-4 flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/25 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
    >
        <GitBranch class="size-4 shrink-0 opacity-70" aria-hidden="true" />
        <span
            >Flow is <strong class="text-foreground">oldest → newest</strong> above the highlighted event, then
            <strong class="text-foreground">downstream</strong> branches.</span
        >
    </div>

    <ol class="m-0 ml-1 list-none space-y-0 border-l-2 border-muted-foreground/25 py-1 pl-4">
        {#each parents ?? [] as step, i (String(step.id ?? step.server_id ?? i))}
            <li role="treeitem" aria-level={i + 1}>
                <div class="flex flex-wrap items-center gap-2 py-2.5 pr-2">
                    <span class="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm" title={nodeType(step)}>
                        {#if nodeType(step) === 'bot'}
                            <Cpu class="size-4" aria-hidden="true" />
                        {:else}
                            <Inbox class="size-4" aria-hidden="true" />
                        {/if}
                    </span>
                    <span
                        class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >{String(step.type ?? '')}</span
                    >
                    <span class="min-w-0 font-medium leading-snug break-words">{nodeTitle(step)}</span>
                    {#if step.lag !== undefined && step.lag !== ''}
                        <span class="text-xs text-muted-foreground">lag {fmtLag(step.lag)}</span>
                    {/if}
                </div>
            </li>
        {/each}

        {#if event}
            <li class="relative -ml-px border-l-2 border-primary pl-5" role="treeitem" aria-level={(parents?.length ?? 0) + 1} aria-current="true">
                <div class="rounded-r-lg border border-l-0 border-primary/30 bg-primary/5 py-3 pr-3 shadow-sm">
                    <div class="flex flex-wrap items-start gap-2">
                        <span
                            class="flex size-7 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-background text-primary shadow-sm"
                            title="Selected event"
                        >
                            <Inbox class="size-4" aria-hidden="true" />
                        </span>
                        <div class="min-w-0 flex-1">
                            <div class="text-[10px] font-semibold uppercase tracking-wide text-primary">Selected event</div>
                            <div class="mt-0.5 font-semibold leading-snug break-words">{nodeTitle(event)}</div>
                            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                <span>{eventTime(event)}</span>
                                <span class="font-mono break-all"
                                    >{String(event.eid ?? event.kinesis_number ?? event.checkpoint ?? '')}</span
                                >
                            </div>
                            {#if event.payload != null && typeof event.payload === 'object'}
                                <details class="mt-2">
                                    <summary class="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground"
                                        >Payload</summary
                                    >
                                    <pre
                                        class="mt-2 max-h-52 overflow-auto rounded-md bg-background/80 p-2 font-mono text-[11px] leading-relaxed ring-1 ring-border">{JSON.stringify(
                                            event.payload,
                                            null,
                                            2,
                                        )}</pre>
                                </details>
                            {/if}
                        </div>
                    </div>
                </div>
            </li>
        {/if}
    </ol>

    {#if children && Object.keys(children).length}
        <div class="mt-4 border-t pt-4">
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Downstream</div>
            {#snippet branch(nodes: Record<string, TraceNode>, depth: number)}
                <ul
                    class="m-0 list-none space-y-0.5 p-0 {depth > 0 ? 'ml-3 border-l border-muted-foreground/20 pl-3' : ''}"
                    role="group"
                >
                    {#each Object.entries(nodes) as [key, n] (key)}
                        <li role="treeitem" aria-level={(parents?.length ?? 0) + 2 + depth}>
                            <div
                                class="flex flex-wrap items-center gap-2 rounded-md py-2 pr-1 hover:bg-muted/40 {depth > 0
                                    ? '-ml-px border-l-2 border-transparent pl-2 hover:border-muted-foreground/25'
                                    : ''}"
                            >
                                <span
                                    class="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm"
                                    title={nodeType(n)}
                                >
                                    {#if nodeType(n) === 'bot'}
                                        <Cpu class="size-4" aria-hidden="true" />
                                    {:else}
                                        <Inbox class="size-4" aria-hidden="true" />
                                    {/if}
                                </span>
                                <span
                                    class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                                    >{String(n.type ?? '')}</span
                                >
                                <span class="min-w-0 font-medium leading-snug break-words">{nodeTitle(n)}</span>
                                {#if n.has_processed === true}
                                    <span class="text-xs text-green-600">processed</span>
                                {:else if n.has_processed === false}
                                    <span class="text-xs text-amber-600">pending</span>
                                {/if}
                                {#if n.lag !== undefined && n.lag !== '' && n.lag !== null}
                                    <span class="text-xs text-muted-foreground">lag {fmtLag(n.lag)}</span>
                                {/if}
                            </div>
                            {#if n.event && typeof n.event === 'object'}
                                <details class="mb-1 ml-9">
                                    <summary class="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                                        >Queue event</summary
                                    >
                                    <pre
                                        class="mt-1 max-h-36 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-[10px] leading-relaxed">{JSON.stringify(
                                            n.event,
                                            null,
                                            2,
                                        )}</pre>
                                </details>
                            {/if}
                            {#if n.children && typeof n.children === 'object'}
                                {@const next = n.children as Record<string, TraceNode>}
                                {#if Object.keys(next).length}
                                    {@render branch(next, depth + 1)}
                                {/if}
                            {/if}
                        </li>
                    {/each}
                </ul>
            {/snippet}
            {@render branch(children, 0)}
        </div>
    {/if}
</div>
