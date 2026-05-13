<script lang="ts">
    import { calendarFormat } from '$lib/client/event-viewer/event-search-utils';
    import * as Tabs from '$lib/client/components/ui/tabs/index';
    import * as Table from '$lib/client/components/ui/table/index';
    import TraceLineage from '$lib/client/components/features/trace/trace-lineage.svelte';
    import TraceFanoutTree from '$lib/client/components/features/trace/trace-fanout-tree.svelte';
    import TraceReactTreeSvgShell from '$lib/client/components/features/trace/trace-react-tree-svg-shell.svelte';
    import Cpu from '@lucide/svelte/icons/cpu';
    import Inbox from '@lucide/svelte/icons/inbox';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';

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

    let tab = $state('1-swimlane');

    function nodeTitle(n: TraceNode): string {
        return String(n.label ?? n.id ?? n.server_id ?? '');
    }

    function nodeType(n: TraceNode): string {
        return String(n.type ?? '').toLowerCase();
    }

    function fmtLag(lag: unknown): string {
        if (lag === null || lag === undefined || lag === '') return '—';
        if (typeof lag === 'number') return `${lag} ms`;
        return String(lag);
    }

    /** Depth-first list of downstream nodes (prototype ordering). */
    function downstreamPreorder(nodes: Record<string, TraceNode>): TraceNode[] {
        const acc: TraceNode[] = [];
        function walk(rec: Record<string, TraceNode>) {
            for (const n of Object.values(rec)) {
                acc.push(n);
                if (n.children && typeof n.children === 'object') {
                    walk(n.children as Record<string, TraceNode>);
                }
            }
        }
        walk(nodes);
        return acc;
    }

    type TableRow = {
        phase: string;
        depth: number;
        type: string;
        label: string;
        lag: string;
        checkpoint: string;
    };

    function buildTableRows(): TableRow[] {
        const rows: TableRow[] = [];
        let step = 0;
        const par = parents ?? [];
        for (let i = 0; i < par.length; i++) {
            const p = par[i]!;
            rows.push({
                phase: `Upstream ${++step}`,
                depth: i,
                type: String(p.type ?? ''),
                label: nodeTitle(p),
                lag: fmtLag(p.lag),
                checkpoint: String(p.eid ?? p.kinesis_number ?? p.checkpoint ?? ''),
            });
        }
        if (event) {
            rows.push({
                phase: 'Selected event',
                depth: par.length,
                type: String(event.type ?? 'queue'),
                label: nodeTitle(event),
                lag: fmtLag(event.lag),
                checkpoint: String(event.eid ?? event.kinesis_number ?? event.checkpoint ?? ''),
            });
        }
        function walkDown(rec: Record<string, TraceNode>, depth: number) {
            for (const n of Object.values(rec)) {
                rows.push({
                    phase: `Downstream ${++step}`,
                    depth,
                    type: String(n.type ?? ''),
                    label: nodeTitle(n),
                    lag: fmtLag(n.lag),
                    checkpoint: String(n.eid ?? n.kinesis_number ?? n.checkpoint ?? ''),
                });
                if (n.children && typeof n.children === 'object') {
                    walkDown(n.children as Record<string, TraceNode>, depth + 1);
                }
            }
        }
        walkDown(children ?? {}, par.length + 1);
        return rows;
    }

    const flatDown = $derived(downstreamPreorder(children ?? {}));
    const tableRows = $derived(buildTableRows());

    /** Sankey-ish layout metrics */
    const sankey = $derived.by(() => {
        const par = parents ?? [];
        const ev = event;
        const down = flatDown;
        const ROW = 32;
        const GAP = 8;
        const leftW = 112;
        const midW = 160;
        const rightW = 112;
        const leftN = Math.max(par.length, 1);
        const rightN = Math.max(down.length, 1);
        const leftH = leftN * ROW + (leftN - 1) * GAP;
        const rightH = rightN * ROW + (rightN - 1) * GAP;
        const h = Math.max(leftH, rightH, 120) + 48;
        const w = 32 + leftW + 80 + midW + 80 + rightW + 32;
        const midY = h / 2 - ROW / 2;
        const midX = 32 + leftW + 80;
        const rightX = midX + midW + 80;

        type Box = { x: number; y: number; w: number; h: number; label: string; sub: string };
        const leftBoxes: Box[] = [];
        if (par.length === 0) {
            leftBoxes.push({ x: 16, y: midY, w: leftW, h: ROW, label: '(no upstream)', sub: '' });
        } else {
            const startY = (h - (par.length * ROW + (par.length - 1) * GAP)) / 2;
            par.forEach((p, i) => {
                leftBoxes.push({
                    x: 16,
                    y: startY + i * (ROW + GAP),
                    w: leftW,
                    h: ROW,
                    label: truncate(nodeTitle(p), 18),
                    sub: String(p.type ?? ''),
                });
            });
        }

        const midBox: Box = {
            x: midX,
            y: midY,
            w: midW,
            h: ROW + 8,
            label: ev ? truncate(nodeTitle(ev), 22) : '(event)',
            sub: ev ? String(ev.type ?? '') : '',
        };

        const rightBoxes: Box[] = [];
        if (down.length === 0) {
            rightBoxes.push({ x: rightX, y: midY, w: rightW, h: ROW, label: '(no downstream)', sub: '' });
        } else {
            const startY = (h - (down.length * ROW + (down.length - 1) * GAP)) / 2;
            down.forEach((n, i) => {
                rightBoxes.push({
                    x: rightX,
                    y: startY + i * (ROW + GAP),
                    w: rightW,
                    h: ROW,
                    label: truncate(nodeTitle(n), 18),
                    sub: String(n.type ?? ''),
                });
            });
        }

        const paths: string[] = [];
        const cx = midBox.x;
        const cmid = midBox.y + midBox.h / 2;
        for (const b of leftBoxes) {
            const sx = b.x + b.w;
            const sy = b.y + b.h / 2;
            paths.push(`M ${sx} ${sy} C ${sx + 40} ${sy}, ${cx - 40} ${cmid}, ${cx} ${cmid}`);
        }
        const ex = midBox.x + midBox.w;
        for (const b of rightBoxes) {
            const tx = b.x;
            const ty = b.y + b.h / 2;
            paths.push(`M ${ex} ${cmid} C ${ex + 40} ${cmid}, ${tx - 40} ${ty}, ${tx} ${ty}`);
        }

        return { w, h, leftBoxes, midBox, rightBoxes, paths };
    });

    function truncate(s: string, max: number): string {
        if (s.length <= max) return s;
        return s.slice(0, max - 1) + '…';
    }
</script>

<div class="flex min-h-0 min-w-0 flex-col gap-3">
    <p class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
        <strong>Prototype</strong> — seven layout ideas (0–6). Same API payload. <strong>4 · Tree (Botmon)</strong> uses <strong>D3</strong> (<code class="rounded bg-muted px-1 font-mono">d3.tree</code>) with focus + keyboard navigation. <strong>6 · React SVG shell</strong> is the static scaffold from legacy <code class="rounded bg-muted px-1 font-mono">tree.jsx</code> (empty <code class="rounded bg-muted px-1 font-mono">g.left-side</code> / <code class="rounded bg-muted px-1 font-mono">g.right-side</code>); with a trace loaded it no longer covers the canvas with the empty-state card (use tab 4 for the live tree). Sankey is a simplified single-event sketch, not full flow volumes.
    </p>

    <Tabs.Root bind:value={tab} class="flex min-h-0 min-w-0 flex-col gap-3">
        <Tabs.List class="flex w-full min-w-0 flex-wrap gap-1">
            <Tabs.Trigger value="0-rail" class="text-xs sm:text-sm">0 · Rail (original)</Tabs.Trigger>
            <Tabs.Trigger value="1-swimlane" class="text-xs sm:text-sm">1 · Swimlane</Tabs.Trigger>
            <Tabs.Trigger value="2-timeline" class="text-xs sm:text-sm">2 · Timeline</Tabs.Trigger>
            <Tabs.Trigger value="3-sankey" class="text-xs sm:text-sm">3 · Sankey sketch</Tabs.Trigger>
            <Tabs.Trigger value="4-fanout" class="text-xs sm:text-sm">4 · Tree (Botmon)</Tabs.Trigger>
            <Tabs.Trigger value="5-table" class="text-xs sm:text-sm">5 · Table</Tabs.Trigger>
            <Tabs.Trigger value="6-react-svg" class="text-xs sm:text-sm">6 · React SVG shell</Tabs.Trigger>
        </Tabs.List>

        <!-- 0 · Original rail + corner lineage -->
        <Tabs.Content value="0-rail" class="min-h-0 min-w-0">
            <TraceLineage {parents} {event} {children} hideExplainer />
        </Tabs.Content>

        <!-- 1 · Horizontal swimlane -->
        <Tabs.Content value="1-swimlane" class="min-h-0 min-w-0">
            <div class="overflow-x-auto rounded-lg border bg-muted/20 p-4">
                <div class="flex min-w-max flex-nowrap items-center gap-2 py-2">
                    {#each parents ?? [] as p, i (i)}
                        {#if i > 0}
                            <ChevronRight class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        {/if}
                        <div class="flex w-44 shrink-0 flex-col gap-1 rounded-lg border bg-card p-3 shadow-sm">
                            <div class="flex items-center gap-2">
                                <span class="text-muted-foreground">
                                    {#if nodeType(p) === 'bot'}
                                        <Cpu class="size-4" />
                                    {:else}
                                        <Inbox class="size-4" />
                                    {/if}
                                </span>
                                <span class="text-[10px] font-semibold uppercase text-muted-foreground">{String(p.type ?? '')}</span>
                            </div>
                            <div class="line-clamp-3 text-sm font-medium leading-snug">{nodeTitle(p)}</div>
                            <div class="text-xs text-muted-foreground">lag {fmtLag(p.lag)}</div>
                        </div>
                    {/each}
                    {#if (parents?.length ?? 0) > 0 && event}
                        <ChevronRight class="size-5 shrink-0 text-primary" aria-hidden="true" />
                    {/if}
                    {#if event}
                        <div class="flex w-52 shrink-0 flex-col gap-1 rounded-lg border-2 border-primary bg-primary/5 p-3 shadow-md ring-1 ring-primary/20">
                            <div class="text-[10px] font-bold uppercase text-primary">Selected event</div>
                            <div class="line-clamp-3 text-sm font-semibold leading-snug">{nodeTitle(event)}</div>
                            <div class="text-xs text-muted-foreground">{calendarFormat(event.timestamp as number)}</div>
                        </div>
                    {/if}
                    {#if Object.keys(children ?? {}).length > 0}
                        <ChevronRight class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div class="flex shrink-0 flex-nowrap items-start gap-2">
                            {#each Object.entries(children ?? {}) as [id, n] (id)}
                                <div class="flex w-40 shrink-0 flex-col gap-1 rounded-lg border bg-card p-2 shadow-sm">
                                    <div class="flex items-center gap-1">
                                        <span class="text-muted-foreground">
                                            {#if nodeType(n) === 'bot'}
                                                <Cpu class="size-4" />
                                            {:else}
                                                <Inbox class="size-4" />
                                            {/if}
                                        </span>
                                        <span class="text-[10px] font-semibold uppercase text-muted-foreground">{String(n.type ?? '')}</span>
                                    </div>
                                    <div class="line-clamp-4 text-xs font-medium leading-snug">{nodeTitle(n)}</div>
                                    <div class="text-[10px] text-muted-foreground">{fmtLag(n.lag)}</div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
                <p class="mt-3 text-xs text-muted-foreground">
                    First downstream <strong>hop</strong> only (top-level bots/queues). Deeper nesting is omitted in this strip.
                </p>
            </div>
        </Tabs.Content>

        <!-- 2 · Vertical timeline -->
        <Tabs.Content value="2-timeline" class="min-h-0 min-w-0">
            <div class="overflow-x-auto rounded-lg border p-4">
                <ol class="relative m-0 list-none space-y-0 p-0">
                    {#each parents ?? [] as p, i (i)}
                        <li class="relative flex gap-4 pb-6 pl-2">
                            <div class="flex w-8 shrink-0 flex-col items-center">
                                <span class="z-10 flex size-3 rounded-full border-2 border-muted-foreground/50 bg-background"></span>
                                <span class="absolute top-3 bottom-0 left-[15px] w-px bg-border"></span>
                            </div>
                            <div class="min-w-0 flex-1 rounded-md border bg-card p-3 shadow-sm">
                                <div class="text-[10px] font-semibold uppercase text-muted-foreground">Upstream · step {i + 1}</div>
                                <div class="mt-1 flex flex-wrap items-center gap-2">
                                    {#if nodeType(p) === 'bot'}
                                        <Cpu class="size-4 text-muted-foreground" />
                                    {:else}
                                        <Inbox class="size-4 text-muted-foreground" />
                                    {/if}
                                    <span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase">{String(p.type ?? '')}</span>
                                    <span class="font-medium leading-snug break-words">{nodeTitle(p)}</span>
                                </div>
                                <div class="mt-1 text-xs text-muted-foreground">lag {fmtLag(p.lag)}</div>
                            </div>
                        </li>
                    {/each}
                    {#if event}
                        <li class="relative flex gap-4 pb-6 pl-2">
                            <div class="flex w-8 shrink-0 flex-col items-center">
                                <span class="z-10 flex size-4 rounded-full border-2 border-primary bg-primary/20"></span>
                                {#if Object.keys(children ?? {}).length > 0}
                                    <span class="absolute top-4 bottom-0 left-[15px] w-px bg-border"></span>
                                {/if}
                            </div>
                            <div class="min-w-0 flex-1 rounded-lg border-2 border-primary bg-primary/5 p-3 shadow-sm">
                                <div class="text-[10px] font-bold uppercase text-primary">Selected event</div>
                                <div class="mt-1 font-semibold leading-snug break-words">{nodeTitle(event)}</div>
                                <div class="mt-1 text-xs text-muted-foreground">{calendarFormat(event.timestamp as number)}</div>
                            </div>
                        </li>
                    {/if}
                    {#each flatDown as n, j (j)}
                        <li class="relative flex gap-4 pb-6 pl-2 last:pb-0">
                            <div class="flex w-8 shrink-0 flex-col items-center">
                                <span class="z-10 flex size-3 rounded-full border-2 border-muted-foreground/40 bg-background"></span>
                                {#if j < flatDown.length - 1}
                                    <span class="absolute top-3 bottom-0 left-[15px] w-px bg-border"></span>
                                {/if}
                            </div>
                            <div class="min-w-0 flex-1 rounded-md border bg-muted/30 p-3">
                                <div class="text-[10px] font-semibold uppercase text-muted-foreground">Downstream · hop</div>
                                <div class="mt-1 flex flex-wrap items-center gap-2">
                                    {#if nodeType(n) === 'bot'}
                                        <Cpu class="size-4 text-muted-foreground" />
                                    {:else}
                                        <Inbox class="size-4 text-muted-foreground" />
                                    {/if}
                                    <span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase">{String(n.type ?? '')}</span>
                                    <span class="font-medium leading-snug break-words">{nodeTitle(n)}</span>
                                </div>
                                <div class="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    <span>lag {fmtLag(n.lag)}</span>
                                    {#if n.has_processed === true}<span class="text-green-600">processed</span>{:else if n.has_processed === false}<span class="text-amber-600">pending</span>{/if}
                                </div>
                            </div>
                        </li>
                    {/each}
                </ol>
            </div>
        </Tabs.Content>

        <!-- 3 · Sankey sketch (SVG) -->
        <Tabs.Content value="3-sankey" class="min-h-0 min-w-0 overflow-x-auto">
            <div class="inline-block rounded-lg border bg-muted/10 p-4">
                <svg
                    width={sankey.w}
                    height={sankey.h}
                    class="text-muted-foreground"
                    role="img"
                    aria-label="Sankey-style sketch of trace flow"
                >
                    {#each sankey.paths as pathStr, pi (pi)}
                        <path
                            d={pathStr}
                            fill="none"
                            stroke="currentColor"
                            stroke-opacity="0.45"
                            stroke-width="1.5"
                        ></path>
                    {/each}
                    {#each sankey.leftBoxes as b, li (li)}
                        <rect
                            x={b.x}
                            y={b.y}
                            width={b.w}
                            height={b.h}
                            rx="6"
                            class="fill-card stroke-border"
                            stroke-width="1"
                        ></rect>
                        <text x={b.x + 8} y={b.y + 14} class="fill-foreground text-[9px] font-semibold">{b.sub}</text>
                        <text x={b.x + 8} y={b.y + 26} class="fill-foreground text-[10px]">{b.label}</text>
                    {/each}
                    <rect
                        x={sankey.midBox.x}
                        y={sankey.midBox.y}
                        width={sankey.midBox.w}
                        height={sankey.midBox.h}
                        rx="8"
                        class="fill-primary/10 stroke-primary"
                        stroke-width="2"
                    ></rect>
                    <text x={sankey.midBox.x + 10} y={sankey.midBox.y + 18} class="fill-primary text-[9px] font-bold">EVENT</text>
                    <text x={sankey.midBox.x + 10} y={sankey.midBox.y + 32} class="fill-foreground text-[11px] font-medium">{sankey.midBox.label}</text>
                    {#each sankey.rightBoxes as b, ri (ri)}
                        <rect
                            x={b.x}
                            y={b.y}
                            width={b.w}
                            height={b.h}
                            rx="6"
                            class="fill-card stroke-border"
                            stroke-width="1"
                        ></rect>
                        <text x={b.x + 8} y={b.y + 14} class="fill-foreground text-[9px] font-semibold">{b.sub}</text>
                        <text x={b.x + 8} y={b.y + 26} class="fill-foreground text-[10px]">{b.label}</text>
                    {/each}
                </svg>
                <p class="mt-2 max-w-[56rem] text-xs text-muted-foreground">
                    Curves are illustrative links from each upstream box to the event, then to each downstream node (flat list). Band width does not encode volume.
                </p>
            </div>
        </Tabs.Content>

        <!-- 4 · Fan-out tree (parallel downstream as columns) -->
        <Tabs.Content value="4-fanout" class="min-h-0 min-w-0">
            <TraceFanoutTree {parents} {event} {children} />
        </Tabs.Content>

        <!-- 6 · Legacy tree.jsx SVG scaffold (static) -->
        <Tabs.Content value="6-react-svg" class="min-h-0 min-w-0">
            <TraceReactTreeSvgShell {parents} {event} {children} />
        </Tabs.Content>

        <!-- 5 · Table -->
        <Tabs.Content value="5-table" class="min-h-0 min-w-0 overflow-x-auto">
            <Table.Root>
                <Table.Header>
                    <Table.Row>
                        <Table.Head class="whitespace-nowrap">Phase</Table.Head>
                        <Table.Head class="w-14 text-center">Depth</Table.Head>
                        <Table.Head>Type</Table.Head>
                        <Table.Head>Label</Table.Head>
                        <Table.Head>Lag</Table.Head>
                        <Table.Head class="min-w-[8rem]">Checkpoint / EID</Table.Head>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {#each tableRows as row, i (i)}
                        <Table.Row class={row.phase === 'Selected event' ? 'bg-primary/5' : ''}>
                            <Table.Cell class="whitespace-nowrap text-xs font-medium">{row.phase}</Table.Cell>
                            <Table.Cell class="text-center text-xs text-muted-foreground">{row.depth}</Table.Cell>
                            <Table.Cell class="text-xs uppercase text-muted-foreground">{row.type}</Table.Cell>
                            <Table.Cell class="max-w-[16rem] text-sm font-medium break-words">{row.label}</Table.Cell>
                            <Table.Cell class="text-xs text-muted-foreground">{row.lag}</Table.Cell>
                            <Table.Cell class="max-w-[20rem] font-mono text-[11px] break-all">{row.checkpoint}</Table.Cell>
                        </Table.Row>
                    {/each}
                </Table.Body>
            </Table.Root>
        </Tabs.Content>
    </Tabs.Root>
</div>
