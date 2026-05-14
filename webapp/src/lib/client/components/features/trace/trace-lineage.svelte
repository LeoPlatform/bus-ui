<script lang="ts">
    import { calendarFormat } from '$lib/client/event-viewer/event-search-utils';
    import CornerDownRight from '@lucide/svelte/icons/corner-down-right';
    import Cpu from '@lucide/svelte/icons/cpu';
    import Inbox from '@lucide/svelte/icons/inbox';
    import GitBranch from '@lucide/svelte/icons/git-branch';
    import Copy from '@lucide/svelte/icons/copy';
    import Check from '@lucide/svelte/icons/check';
    import X from '@lucide/svelte/icons/x';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import { base } from '$app/paths';
    import * as Tooltip from '$lib/client/components/ui/tooltip/index';

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

    /** Key of the node whose copy button is currently showing a checkmark. */
    let copiedKey = $state<string | null>(null);

    function fmtLag(lag: unknown): string {
        if (lag === null || lag === undefined || lag === '') return '';
        const ms = typeof lag === 'number' ? lag : Number(lag);
        if (isNaN(ms)) return String(lag);
        const abs = Math.abs(ms);
        const prefix = ms < 0 ? '-' : '';
        if (abs < 1000) return `${prefix}${abs}ms`;
        if (abs < 60_000) return `${prefix}${(abs / 1000).toFixed(1)}s`;
        if (abs < 3_600_000) {
            const m = Math.floor(abs / 60_000);
            const s = Math.floor((abs % 60_000) / 1000);
            return `${prefix}${m}m ${s}s`;
        }
        const h = Math.floor(abs / 3_600_000);
        const m = Math.floor((abs % 3_600_000) / 60_000);
        return `${prefix}${h}h ${m}m`;
    }

    /** CSS classes for the lag pill based on magnitude. */
    function lagPillClass(lag: unknown): string {
        if (lag === null || lag === undefined || lag === '') return '';
        const ms = typeof lag === 'number' ? lag : Number(lag);
        if (isNaN(ms)) return '';
        const abs = Math.abs(ms);
        if (abs < 30_000) return 'bg-green-500/15 text-[#00B315] ring-green-600/30 dark:bg-green-500/20 dark:ring-green-400/30';
        if (abs < 300_000) return 'bg-amber-500/15 text-amber-800 ring-amber-600/30 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-400/30';
        return 'bg-red-500/15 text-[#FF1424] ring-red-600/30 dark:bg-red-500/20 dark:ring-red-400/30';
    }

    function nodeTitle(n: TraceNode): string {
        return String(n.label ?? n.id ?? n.server_id ?? '');
    }

    const UNSET_TIME_LABELS = new Set(['unspecified', 'invalid date', 'n/a', '']);

    function eventTime(n: TraceNode): string {
        const ts = n.timestamp as number | undefined;
        if (ts == null) return '';
        const formatted = calendarFormat(ts);
        return UNSET_TIME_LABELS.has(formatted.toLowerCase()) ? '' : formatted;
    }

    function nodeType(n: TraceNode): string {
        return String(n.type ?? '').toLowerCase();
    }

    /** Returns the dashboard href for a node, or null if no id is available. */
    function dashboardHref(n: TraceNode): string | null {
        const id = n.id ?? n.server_id;
        return id != null && id !== '' ? `${base}/dashboard/${String(id)}` : null;
    }

    /** Returns the EID/checkpoint string for a node, or null if absent. */
    function nodeEid(n: TraceNode): string | null {
        // Prefer a flat primitive identifier first.
        for (const key of ['eid', 'kinesis_number'] as const) {
            const v = n[key];
            if (v != null && v !== '' && typeof v !== 'object') return String(v);
        }
        // checkpoint may be the string ID itself, or an object with a nested .checkpoint string.
        const cp = n.checkpoint;
        if (cp == null || cp === '') return null;
        if (typeof cp === 'object') {
            const inner = (cp as Record<string, unknown>).checkpoint;
            if (inner != null && inner !== '' && typeof inner !== 'object') return String(inner);
            return null;
        }
        return String(cp) || null;
    }

    /** Returns true when a bot node explicitly did not process the event. */
    function didNotProcess(n: TraceNode): boolean {
        return nodeType(n) === 'bot' && n.has_processed === false;
    }

    /**
     * Returns the best available detail object for a node and a label for it,
     * or null if there is nothing worth showing.
     *
     * Priority: payload > event (non-null object) > checkpoint (object)
     * The Leo SDK sets queue node `event` to null and bot nodes carry a
     * `checkpoint` object — so for downstream children checkpoint is typically
     * the only detail available.
     */
    function nodeDetail(n: TraceNode): { label: string; data: unknown } | null {
        if (n.payload != null && typeof n.payload === 'object') {
            return { label: 'Payload', data: n.payload };
        }
        if (n.event != null && typeof n.event === 'object') {
            return { label: 'Queue event', data: n.event };
        }
        if (n.checkpoint != null && typeof n.checkpoint === 'object' && Object.keys(n.checkpoint as object).length > 0) {
            return { label: 'Checkpoint', data: n.checkpoint };
        }
        return null;
    }

    function copyText(key: string, text: string) {
        navigator.clipboard.writeText(text).catch(() => {});
        copiedKey = key;
        setTimeout(() => {
            if (copiedKey === key) copiedKey = null;
        }, 2000);
    }

    // ── R8: split-pane detail panel ──────────────────────────────────────────
    type PanelNode = { key: string; node: TraceNode };
    let panelNode = $state<PanelNode | null>(null);
    let panelWidth = $state(288); // px — matches w-72 default

    const PANEL_MIN = 200;
    const PANEL_MAX = 600;

    function selectNode(key: string, node: TraceNode) {
        panelNode = panelNode?.key === key ? null : { key, node };
    }

    // ── R12: collapse individual downstream steps ─────────────────────────────
    /**
     * Walks the children tree and collects nodeKeys for bot nodes that did not
     * process and have their own children (auto-collapsed on load).
     */
    function collectAutoCollapsed(
        nodes: Record<string, TraceNode>,
        parentKey: string,
        acc: Set<string>,
    ) {
        for (const [key, n] of Object.entries(nodes)) {
            const nodeKey = `${parentKey}-${key}`;
            const kids = n.children != null && typeof n.children === 'object'
                ? n.children as Record<string, TraceNode>
                : null;
            const kidCount = kids ? Object.keys(kids).length : 0;
            if (kidCount > 0 && (didNotProcess(n) || kidCount > 2)) acc.add(nodeKey);
            if (kids) collectAutoCollapsed(kids, nodeKey, acc);
        }
    }

    let collapsedNodes = $state<Set<string>>((() => {
        const s = new Set<string>();
        if (children) collectAutoCollapsed(children, 'root', s);
        return s;
    })());

    function toggleCollapse(key: string) {
        const next = new Set(collapsedNodes);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        collapsedNodes = next;
    }

    function onHandlePointerDown(e: PointerEvent) {
        const handle = e.currentTarget as HTMLElement;
        handle.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const startW = panelWidth;

        function onMove(ev: PointerEvent) {
            // Dragging left widens the panel (handle is on its left edge).
            const delta = startX - ev.clientX;
            panelWidth = Math.min(PANEL_MAX, Math.max(PANEL_MIN, startW + delta));
        }
        function onUp() {
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onUp);
        }
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
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
                >Read <strong class="text-foreground">top → bottom</strong>. Upstream and the selected event share the rail at left. Downstream rows use a <strong class="text-foreground">corner icon</strong> (┘) to show they extend from the parent above. Click any node to inspect its data in the side panel.</span
            >
        </div>
    {/if}

    <div class="flex min-h-0 gap-3">
        <!-- Rail (left, scrollable) -->
        <div class="min-w-0 flex-1 overflow-x-auto">
            <div class="inline-block min-w-0 align-top">
                <ol class="m-0 list-none space-y-0 py-0">
                    {#each parents ?? [] as step, i (i)}
                        {@const stepEid = nodeEid(step)}
                        {@const stepKey = `parent-${i}`}
                        {@const stepDashHref = dashboardHref(step)}
                        {@const isSelected = panelNode?.key === stepKey}
                        <li role="treeitem" aria-level={i + 1} aria-selected={isSelected} class="py-1">
                            <div class="space-y-0.5 pr-2">
                                <!-- Main row: click area opens panel; link sits inline -->
                                <div
                                    role="button"
                                    tabindex="0"
                                    aria-pressed={isSelected}
                                    class="w-full rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/50 {isSelected
                                        ? 'bg-muted ring-1 ring-ring'
                                        : ''}"
                                    onclick={() => selectNode(stepKey, step)}
                                    onkeydown={(e) => e.key === 'Enter' && selectNode(stepKey, step)}
                                >
                                    <!-- Row 1: icon · type · name · lag · dashboard -->
                                    <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
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
                                        {#if step.lag !== undefined && step.lag !== '' && step.lag !== null}
                                            <span class="rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 {lagPillClass(step.lag)}">{fmtLag(step.lag)}</span>
                                        {/if}
                                        {#if stepDashHref}
                                            <Tooltip.Provider>
                                                <Tooltip.Root delayDuration={300}>
                                                    <Tooltip.Trigger>
                                                        <a
                                                            href={stepDashHref}
                                                            class="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-foreground"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onclick={(e) => e.stopPropagation()}
                                                            aria-label="Open in dashboard"
                                                        ><ExternalLink class="size-3" aria-hidden="true" /></a>
                                                    </Tooltip.Trigger>
                                                    <Tooltip.Content>Dashboard</Tooltip.Content>
                                                </Tooltip.Root>
                                            </Tooltip.Provider>
                                        {/if}
                                    </div>
                                    <!-- Row 2: timestamp · EID + copy -->
                                    {#if eventTime(step) || stepEid}
                                        <div class="flex flex-wrap items-center gap-x-3 gap-y-0 pl-9 text-xs text-muted-foreground">
                                            {#if eventTime(step)}
                                                <span>{eventTime(step)}</span>
                                            {/if}
                                            {#if stepEid}
                                                <span class="flex items-center gap-1 font-mono">
                                                    <span class="max-w-[18ch] truncate">{stepEid}</span>
                                                    <button
                                                        type="button"
                                                        class="rounded p-0.5 hover:bg-muted"
                                                        title="Copy EID"
                                                        onclick={(e) => { e.stopPropagation(); copyText(stepKey, stepEid); }}
                                                        aria-label="Copy EID"
                                                    >
                                                        {#if copiedKey === stepKey}
                                                            <Check class="size-3 text-green-500" aria-hidden="true" />
                                                        {:else}
                                                            <Copy class="size-3" aria-hidden="true" />
                                                        {/if}
                                                    </button>
                                                </span>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </li>
                    {/each}

                    {#if event}
                        {@const eventEid = nodeEid(event)}
                        {@const isSelected = panelNode?.key === 'event'}
                        <li
                            class="relative py-2"
                            role="treeitem"
                            aria-level={(parents?.length ?? 0) + 1}
                            aria-selected={isSelected}
                            aria-current="true"
                        >
                            <span
                                class="absolute -left-[9px] top-6 size-2 rounded-full border-2 border-primary bg-primary/20"
                                aria-hidden="true"
                            ></span>
                            <!-- Outer card: clicking opens panel; copy button lives outside the clickable area -->
                            <div
                                class="cursor-pointer rounded-lg border-2 py-3 pr-3 pl-2 shadow-sm ring-1 transition-colors {isSelected
                                    ? 'border-primary bg-primary/10 ring-primary/30'
                                    : 'border-primary/40 bg-primary/5 ring-primary/15 hover:bg-primary/10'}"
                                role="button"
                                tabindex="0"
                                aria-pressed={isSelected}
                                onclick={() => selectNode('event', event)}
                                onkeydown={(e) => e.key === 'Enter' && selectNode('event', event)}
                            >
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
                                        <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                            <span>{eventTime(event)}</span>
                                            {#if eventEid}
                                                <span class="font-mono break-all">{eventEid}</span>
                                            {/if}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- EID copy sits outside the clickable card to avoid nesting issues -->
                            {#if eventEid}
                                <div class="mt-1 flex items-center gap-1 pl-9 text-xs text-muted-foreground">
                                    <button
                                        type="button"
                                        class="flex items-center gap-1 rounded p-0.5 hover:bg-muted font-mono"
                                        title="Copy EID"
                                        onclick={() => copyText('event-eid', eventEid)}
                                        aria-label="Copy EID"
                                    >
                                        {#if copiedKey === 'event-eid'}
                                            <Check class="size-3 text-green-500" aria-hidden="true" />
                                        {:else}
                                            <Copy class="size-3" aria-hidden="true" />
                                        {/if}
                                        <span class="text-[10px]">copy EID</span>
                                    </button>
                                </div>
                            {/if}
                        </li>
                    {/if}
                </ol>

                {#if children && Object.keys(children).length}
                    <div class="mt-4 min-w-0 border-t border-border pt-4">
                        <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Downstream</div>

                        {#snippet branch(nodes: Record<string, TraceNode>, depth: number, parentKey: string)}
                            <ul
                                class="m-0 mt-0.5 list-none space-y-0 py-0 {depth > 0 ? 'ml-4' : ''}"
                                role="group"
                            >
                                {#each Object.entries(nodes) as [key, n] (key)}
                                    {@const nodeKey = `${parentKey}-${key}`}
                                    {@const nEid = nodeEid(n)}
                                    {@const notProcessed = didNotProcess(n)}
                                    {@const nDashHref = dashboardHref(n)}
                                    {@const isSelected = panelNode?.key === nodeKey}
                                    {@const hasKids = n.children != null && typeof n.children === 'object' && Object.keys(n.children as object).length > 0}
                                    {@const isCollapsed = collapsedNodes.has(nodeKey)}
                                    <li role="treeitem" aria-level={(parents?.length ?? 0) + 2 + depth} aria-selected={isSelected} aria-expanded={hasKids ? !isCollapsed : undefined}>
                                        <div class="flex items-start gap-1">
                                            <div class="flex w-5 shrink-0 items-center justify-end pt-5">
                                                {#if hasKids}
                                                    <button
                                                        type="button"
                                                        class="rounded p-0.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                                                        onclick={(e) => { e.stopPropagation(); toggleCollapse(nodeKey); }}
                                                        aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                                                    >
                                                        {#if isCollapsed}
                                                            <ChevronRight class="size-4" strokeWidth={2.25} aria-hidden="true" />
                                                        {:else}
                                                            <ChevronDown class="size-4" strokeWidth={2.25} aria-hidden="true" />
                                                        {/if}
                                                    </button>
                                                {:else}
                                                    <span class="p-0.5 text-muted-foreground/85" aria-hidden="true">
                                                        <CornerDownRight class="size-4" strokeWidth={2.25} />
                                                    </span>
                                                {/if}
                                            </div>
                                            <div class="min-w-0 flex-1">
                                                <!-- Click target: row 1 + row 2 together open the panel -->
                                                <div
                                                    role="button"
                                                    tabindex="0"
                                                    aria-pressed={isSelected}
                                                    class="w-full rounded-md border-b border-border/55 py-1 pr-1 text-left transition-colors {isSelected
                                                        ? 'bg-muted ring-1 ring-ring'
                                                        : notProcessed
                                                          ? 'border-l-2 border-amber-500/70 pl-2 hover:bg-muted/40'
                                                          : 'hover:bg-muted/40'}"
                                                    onclick={() => selectNode(nodeKey, n)}
                                                    onkeydown={(e) => e.key === 'Enter' && selectNode(nodeKey, n)}
                                                >
                                                    <!-- Row 1: icon · type · name · badges · lag · dashboard -->
                                                    <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                        <span
                                                            class="flex size-7 shrink-0 items-center justify-center rounded-md border {notProcessed
                                                                ? 'border-amber-400/60 bg-background text-amber-600 dark:text-amber-400'
                                                                : 'bg-background text-muted-foreground'} shadow-sm"
                                                            title={nodeType(n)}
                                                        >
                                                            {#if nodeType(n) === 'bot'}
                                                                <Cpu class="size-4" aria-hidden="true" />
                                                            {:else}
                                                                <Inbox class="size-4" aria-hidden="true" />
                                                            {/if}
                                                        </span>
                                                        <span
                                                            class="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide {notProcessed
                                                                ? 'bg-muted text-amber-600 dark:text-amber-400'
                                                                : 'bg-muted text-muted-foreground'}"
                                                            >{String(n.type ?? '')}</span
                                                        >
                                                        <span class="min-w-0 font-medium leading-snug break-words">{nodeTitle(n)}</span>
                                                        {#if notProcessed}
                                                            <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-400/40 dark:text-amber-400"
                                                                >Did not process</span
                                                            >
                                                        {:else if n.has_processed === true}
                                                            <span class="text-xs text-green-600 dark:text-green-400">✓ processed</span>
                                                        {/if}
                                                        {#if n.lag !== undefined && n.lag !== '' && n.lag !== null}
                                                            <span class="rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 {lagPillClass(n.lag)}">{fmtLag(n.lag)}</span>
                                                        {/if}
                                                        {#if nDashHref}
                                                            <Tooltip.Provider>
                                                                <Tooltip.Root delayDuration={300}>
                                                                    <Tooltip.Trigger>
                                                                        <a
                                                                            href={nDashHref}
                                                                            class="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-foreground"
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            onclick={(e) => e.stopPropagation()}
                                                                            aria-label="Open in dashboard"
                                                                        ><ExternalLink class="size-3" aria-hidden="true" /></a>
                                                                    </Tooltip.Trigger>
                                                                    <Tooltip.Content>Dashboard</Tooltip.Content>
                                                                </Tooltip.Root>
                                                            </Tooltip.Provider>
                                                        {/if}
                                                    </div>
                                                    <!-- Row 2: timestamp · EID + copy -->
                                                    {#if eventTime(n) || nEid}
                                                        <div class="flex flex-wrap items-center gap-x-3 gap-y-0 pl-9 text-xs text-muted-foreground">
                                                            {#if eventTime(n)}
                                                                <span>{eventTime(n)}</span>
                                                            {/if}
                                                            {#if nEid}
                                                                <span class="flex items-center gap-1 font-mono">
                                                                    <span class="max-w-[18ch] truncate">{nEid}</span>
                                                                    <button
                                                                        type="button"
                                                                        class="rounded p-0.5 hover:bg-muted"
                                                                        title="Copy EID"
                                                                        onclick={(e) => { e.stopPropagation(); copyText(nodeKey, nEid); }}
                                                                        aria-label="Copy EID"
                                                                    >
                                                                        {#if copiedKey === nodeKey}
                                                                            <Check class="size-3 text-green-500" aria-hidden="true" />
                                                                        {:else}
                                                                            <Copy class="size-3" aria-hidden="true" />
                                                                        {/if}
                                                                    </button>
                                                                </span>
                                                            {/if}
                                                        </div>
                                                    {/if}
                                                </div>
                                                {#if hasKids && !isCollapsed}
                                                    {@render branch(n.children as Record<string, TraceNode>, depth + 1, nodeKey)}
                                                {/if}
                                            </div>
                                        </div>
                                    </li>
                                {/each}
                            </ul>
                        {/snippet}
                        {@render branch(children, 0, 'root')}
                    </div>
                {/if}
            </div>
        </div>

        <!-- R8: Side detail panel — sticky so it follows scroll position -->
        {#if panelNode}
            <!-- Drag handle -->
            <div
                class="w-1.5 shrink-0 cursor-col-resize self-stretch rounded-full bg-border transition-colors hover:bg-muted-foreground/40 active:bg-muted-foreground/60"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize detail panel"
                onpointerdown={onHandlePointerDown}
            ></div>

            {@const pn = panelNode.node}
            {@const pDetail = nodeDetail(pn)}
            {@const pDashHref = dashboardHref(pn)}
            <div class="sticky top-4 flex shrink-0 self-start flex-col gap-3 rounded-lg border bg-muted/20 p-3 text-xs" style="width: {panelWidth}px">
                <!-- Panel header -->
                <div class="flex items-start gap-2">
                    <span class="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm">
                        {#if nodeType(pn) === 'bot'}
                            <Cpu class="size-4" aria-hidden="true" />
                        {:else}
                            <Inbox class="size-4" aria-hidden="true" />
                        {/if}
                    </span>
                    <div class="min-w-0 flex-1">
                        <div class="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{String(pn.type ?? '')}</div>
                        <div class="mt-0.5 font-medium leading-snug break-words">{nodeTitle(pn)}</div>
                    </div>
                    <div class="flex shrink-0 items-center gap-1">
                        {#if pDashHref}
                            <Tooltip.Provider>
                                <Tooltip.Root delayDuration={300}>
                                    <Tooltip.Trigger>
                                        <a
                                            href={pDashHref}
                                            class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label="Open in dashboard"
                                        >
                                            <ExternalLink class="size-3.5" aria-hidden="true" />
                                        </a>
                                    </Tooltip.Trigger>
                                    <Tooltip.Content>Dashboard</Tooltip.Content>
                                </Tooltip.Root>
                            </Tooltip.Provider>
                        {/if}
                        <button
                            type="button"
                            class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onclick={() => (panelNode = null)}
                            aria-label="Close detail panel"
                        >
                            <X class="size-3.5" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <!-- Key metadata -->
                <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border pt-3">
                    {#if eventTime(pn)}
                        <dt class="text-muted-foreground">Time</dt>
                        <dd class="break-words">{eventTime(pn)}</dd>
                    {/if}
                    {#if nodeEid(pn)}
                        <dt class="text-muted-foreground">EID</dt>
                        <dd class="flex items-center gap-1 font-mono">
                            <span class="min-w-0 break-all">{nodeEid(pn)}</span>
                            <button
                                type="button"
                                class="shrink-0 rounded p-0.5 hover:bg-muted"
                                title="Copy EID"
                                onclick={() => { const e = nodeEid(pn); if (e) copyText('panel-eid', e); }}
                                aria-label="Copy EID"
                            >
                                {#if copiedKey === 'panel-eid'}
                                    <Check class="size-3 text-green-500" aria-hidden="true" />
                                {:else}
                                    <Copy class="size-3" aria-hidden="true" />
                                {/if}
                            </button>
                        </dd>
                    {/if}
                    {#if pn.lag !== undefined && pn.lag !== null && pn.lag !== ''}
                        <dt class="text-muted-foreground">Lag</dt>
                        <dd><span class="rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 {lagPillClass(pn.lag)}">{fmtLag(pn.lag)}</span></dd>
                    {/if}
                    {#if pn.has_processed !== undefined}
                        <dt class="text-muted-foreground">Processed</dt>
                        <dd class="{pn.has_processed ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}">{pn.has_processed ? '✓ yes' : '✗ no'}</dd>
                    {/if}
                </dl>

                <!-- Detail data (payload / event / checkpoint) -->
                {#if pDetail}
                    <div class="border-t border-border pt-3">
                        <div class="mb-1.5 flex items-center justify-between">
                            <span class="font-semibold text-muted-foreground">{pDetail.label}</span>
                            <button
                                type="button"
                                class="rounded p-0.5 hover:bg-muted"
                                title="Copy {pDetail.label}"
                                onclick={() => copyText('panel-detail', JSON.stringify(pDetail.data, null, 2))}
                                aria-label="Copy {pDetail.label}"
                            >
                                {#if copiedKey === 'panel-detail'}
                                    <Check class="size-3 text-green-500" aria-hidden="true" />
                                {:else}
                                    <Copy class="size-3" aria-hidden="true" />
                                {/if}
                            </button>
                        </div>
                        <pre class="max-h-64 overflow-auto rounded-md bg-background p-2 font-mono text-[10px] leading-relaxed ring-1 ring-border">{JSON.stringify(pDetail.data, null, 2)}</pre>
                    </div>
                {:else}
                    <p class="border-t border-border pt-3 text-muted-foreground">No payload data available for this node.</p>
                {/if}
            </div>
        {/if}
    </div>
</div>
