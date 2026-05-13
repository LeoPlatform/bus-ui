<script lang="ts">
    /**
     * Static SVG shell matching React `ui/js/components/elements/tree.jsx` render (lines 1318–1337).
     * The legacy app filled `<g class="left-side">` / `<g class="right-side">` with D3 at runtime — this tab shows the raw scaffold for comparison.
     *
     * When there is no selected event, the overlay mirrors legacy `noSource.jsx` (trace view). When a trace is loaded, the shell stays visible without blocking it.
     */
    import Inbox from '@lucide/svelte/icons/inbox';

    type TraceNode = Record<string, unknown>;

    let {
        event = null,
        parents = [],
        children = {},
    }: {
        event?: TraceNode | null;
        parents?: TraceNode[];
        children?: Record<string, TraceNode>;
    } = $props();

    const uid = `trace-shell-${Math.random().toString(36).slice(2, 10)}`;

    /** Matches `noSourceMessage` when `userSettings.view === 'trace'` in `ui/js/components/elements/noSource.jsx`. */
    const traceNoSource = {
        title: 'No queue selected',
        lines: ['Search for a queue to find an event to trace'] as const,
    };

    function countDownstream(rec: Record<string, TraceNode>): number {
        let n = 0;
        function walk(o: Record<string, TraceNode>) {
            for (const c of Object.values(o)) {
                n += 1;
                if (c.children && typeof c.children === 'object') {
                    walk(c.children as Record<string, TraceNode>);
                }
            }
        }
        walk(rec);
        return n;
    }

    const downstreamCount = $derived(countDownstream(children ?? {}));
</script>

<div class="trace-react-svg-shell flex min-h-0 min-w-0 flex-col gap-3 text-sm">
    <p class="rounded-md border border-dashed border-muted-foreground/25 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <strong>React tree.jsx SVG scaffold</strong> — same outer structure the old Botmon modal mounted (empty
        <code class="rounded bg-muted px-1 font-mono">left-side</code> /
        <code class="rounded bg-muted px-1 font-mono">right-side</code>
        groups; D3 injected nodes and links later). With a trace loaded, you see the empty groups only (the live D3 tree is
        <strong class="text-foreground">tab 4 · Tree (Botmon)</strong>). The centered card appears only when there is no event (same copy as legacy
        <code class="rounded bg-muted px-1 font-mono">NoSource</code> for trace view).
    </p>

    <div class="relative min-h-[min(50vh,420px)] overflow-auto rounded-lg border bg-muted/10 p-4">
        <svg
            class="block min-h-[400px] min-w-[720px] text-foreground"
            viewBox="0 0 900 600"
            role="img"
            aria-label="Legacy Botmon tree SVG shell (empty groups)"
        >
            <defs>
                <clipPath id="clipCircle30-{uid}">
                    <circle r="25" cx="0" cy="0"></circle>
                </clipPath>
                <clipPath id="clipCircle21-{uid}">
                    <circle r="16" cx="0" cy="0"></circle>
                </clipPath>
                <filter id="hoverDropshadow-{uid}" height="130%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="4"></feGaussianBlur>
                    <feOffset dx="2" dy="2" result="offsetblur"></feOffset>
                    <feMerge>
                        <feMergeNode></feMergeNode>
                        <feMergeNode in="SourceGraphic"></feMergeNode>
                    </feMerge>
                </filter>
            </defs>
            <g class="left-side"></g>
            <g class="right-side"></g>
            <g class="hoverBoard" style="display: none" filter={`url(#hoverDropshadow-${uid})`}></g>
        </svg>

        {#if !event}
            <div class="pointer-events-none absolute inset-0 flex items-center justify-center p-6 sm:p-10">
                <div
                    class="pointer-events-auto flex max-w-md flex-col items-center gap-5 rounded-xl border border-border bg-card/95 px-8 py-10 text-center shadow-sm backdrop-blur-sm"
                    role="status"
                    aria-live="polite"
                >
                    <div
                        class="flex size-[120px] shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/60 text-muted-foreground shadow-inner"
                    >
                        <Inbox class="size-14" aria-hidden="true" />
                    </div>
                    <div class="space-y-2">
                        <h3 class="text-lg font-semibold leading-tight tracking-tight text-foreground">
                            {traceNoSource.title}
                        </h3>
                        {#each traceNoSource.lines as line}
                            <p class="text-sm leading-relaxed text-muted-foreground">{line}</p>
                        {/each}
                    </div>
                </div>
            </div>
        {:else}
            <div
                class="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3"
                role="status"
                aria-live="polite"
            >
                <p
                    class="pointer-events-auto max-w-lg rounded-md border border-border bg-card/90 px-3 py-2 text-center text-xs text-muted-foreground shadow-sm backdrop-blur-sm"
                >
                    Trace loaded — <strong class="text-foreground">{parents?.length ?? 0}</strong> upstream step(s),
                    <strong class="text-foreground">{downstreamCount}</strong> downstream node(s). In Botmon, D3 filled
                    <code class="rounded bg-muted px-1 font-mono text-[10px]">left-side</code> /
                    <code class="rounded bg-muted px-1 font-mono text-[10px]">right-side</code>; use
                    <strong class="text-foreground">tab 4</strong> for the interactive tree here.
                </p>
            </div>
        {/if}
    </div>

    <details class="rounded-md border bg-muted/20 p-3 text-xs">
        <summary class="cursor-pointer font-medium text-foreground">Original JSX fragment (reference)</summary>
        <pre class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">{`<svg>
  <clipPath id="clipCircle30">…</clipPath>
  <clipPath id="clipCircle21">…</clipPath>
  <Trunk className="left-side" />
  <Trunk className="right-side" />
  <Trunk className="hoverBoard" style={{ filter: 'url(#hoverDropshadow)', display: 'none' }} />
  <filter id="hoverDropshadow" height="130%">…</filter>
  <NoSource root={…} transform="translate(…)" />
</svg>`}</pre>
    </details>
</div>
