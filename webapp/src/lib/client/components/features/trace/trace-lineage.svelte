<script lang="ts">
    import { calendarFormat } from '$lib/client/event-viewer/event-search-utils';
    import CornerDownRight from '@lucide/svelte/icons/corner-down-right';
    import Cpu from '@lucide/svelte/icons/cpu';
    import Inbox from '@lucide/svelte/icons/inbox';
    import GitBranch from '@lucide/svelte/icons/git-branch';

    type TraceNode = Record<string, unknown>;

    let {
        parents = [],
        event = null,
        children = {},
        hideExplainer = false,
    }: {
        parents?: TraceNode[];
        event?: TraceNode | null;
        children?: Record<string, TraceNode>;
        /** When embedded (e.g. prototype tabs), hide the long rail/corner explainer. */
        hideExplainer?: boolean;
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
  Connected tree: shared left rail (border) shows ancestry; each downstream nest
  indents with the same rail so parent/child is spatially obvious. Horizontal
  overflow scrolls inside the panel (see +page wrapper + min-w-0).
-->
<div class="trace-lineage min-w-0 max-w-full text-sm" role="tree" aria-label="Event trace lineage">
    {#if !hideExplainer}
        <div
            class="mb-4 flex min-w-0 items-center gap-2 rounded-md border border-dashed border-muted-foreground/25 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
        >
            <GitBranch class="size-4 shrink-0 opacity-70" aria-hidden="true" />
            <span
                >Read <strong class="text-foreground">top → bottom</strong>. Upstream and the selected event share the rail at left. Downstream rows use a <strong class="text-foreground">corner icon</strong> (┘) to show they extend from the parent above. Scroll horizontally if the tree is wider than the panel.</span
            >
        </div>
    {/if}

    <div class="min-w-0 overflow-x-auto">
        <div class="inline-block min-w-0 align-top">
            <ol class="relative m-0 ml-1 list-none space-y-0 border-l-2 border-muted-foreground/30 py-1 pl-4">
                {#each parents ?? [] as step, i (i)}
                    <li role="treeitem" aria-level={i + 1} class="relative py-2">
                        <span
                            class="absolute -left-[9px] top-1/2 size-2 -translate-y-1/2 rounded-full border-2 border-muted-foreground/40 bg-background"
                            aria-hidden="true"
                        ></span>
                        <div class="flex flex-wrap items-center gap-2 pr-2">
                            <span
                                class="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm"
                                title={nodeType(step)}
                            >
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
                    <li
                        class="relative py-2"
                        role="treeitem"
                        aria-level={(parents?.length ?? 0) + 1}
                        aria-current="true"
                    >
                        <span
                            class="absolute -left-[9px] top-6 size-2 rounded-full border-2 border-primary bg-primary/20"
                            aria-hidden="true"
                        ></span>
                        <div class="rounded-lg border-2 border-primary/40 bg-primary/5 py-3 pr-3 pl-2 shadow-sm ring-1 ring-primary/15">
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
                                            <summary
                                                class="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground"
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
                <div class="mt-4 min-w-0 border-t border-border pt-4">
                    <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Downstream</div>

                    {#snippet branch(nodes: Record<string, TraceNode>, depth: number)}
                        <ul
                            class="m-0 mt-1 list-none space-y-1.5 border-l-2 border-muted-foreground/30 py-1 pl-2 {depth > 0 ? 'ml-2' : ''}"
                            role="group"
                        >
                            {#each Object.entries(nodes) as [key, n] (key)}
                                <li role="treeitem" aria-level={(parents?.length ?? 0) + 2 + depth}>
                                    <div class="flex items-start gap-1">
                                        <div
                                            class="mt-1 flex w-5 shrink-0 justify-end text-muted-foreground/85"
                                            aria-hidden="true"
                                            title="Child of row above"
                                        >
                                            <CornerDownRight class="size-4" strokeWidth={2.25} />
                                        </div>
                                        <div class="min-w-0 flex-1 space-y-1">
                                            <div class="flex flex-wrap items-center gap-2 rounded-md py-1 pr-1 hover:bg-muted/40">
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
                                                <details class="mb-1 ml-1">
                                                    <summary
                                                        class="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
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
                                        </div>
                                    </div>
                                </li>
                            {/each}
                        </ul>
                    {/snippet}
                    {@render branch(children, 0)}
                </div>
            {/if}
        </div>
    </div>
</div>
