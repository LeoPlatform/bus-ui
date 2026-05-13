<script lang="ts">
    /**
     * Legacy Botmon event trace: D3 tree like `tree.jsx`, centered on the first trace entry by default,
     * with click + keyboard navigation and zoom/pan.
     */
    import { calendarFormat } from '$lib/client/event-viewer/event-search-utils';
    import * as d3 from 'd3';
    import { onMount } from 'svelte';
    import GitBranch from '@lucide/svelte/icons/git-branch';

    type TraceNode = Record<string, unknown>;

    type GraphNode = TraceNode & {
        id: string;
        is_root?: boolean;
        parents?: GraphNode[];
        kids?: GraphNode[];
    };

    let {
        parents = [],
        event = null,
        children = {},
    }: {
        parents?: TraceNode[];
        event?: TraceNode | null;
        children?: Record<string, TraceNode>;
    } = $props();

    /** Defensive: `trace` returns an array; normalize if a keyed object slips through. */
    const parentsArray = $derived(
        Array.isArray(parents)
            ? parents
            : parents && typeof parents === 'object'
              ? (Object.values(parents as Record<string, TraceNode>) as TraceNode[])
              : [],
    );

    let wrapEl = $state<HTMLDivElement | undefined>(undefined);
    let ro: ResizeObserver | undefined;

    const BRANCH_X = 220;
    const NODE_R = 14;
    const ROOT_R = 22;
    const INITIAL_SCALE = 1.45;

    /** First table row = upstream-most parent, else the selected event. */
    function firstEntryId(par: TraceNode[], ev: TraceNode): string {
        if (par.length) return String(par[0]!.id ?? 'p-0');
        return String(ev.id ?? ev.eid ?? 'event');
    }

    const traceKey = $derived(
        `${String(event?.eid ?? event?.id ?? '')}|${parentsArray.length}|${Object.keys(children ?? {}).join(',')}`,
    );

    let focusNodeId = $state('');
    let prevTraceKey = $state('');
    /** Last traceKey passed through draw — used to reset zoom vs preserve pan. */
    let lastDrawTraceKey = '';

    $effect(() => {
        traceKey;
        if (!event) return;
        if (traceKey !== prevTraceKey) {
            prevTraceKey = traceKey;
            focusNodeId = firstEntryId(parentsArray, event);
        }
    });

    function nodeTitle(n: TraceNode): string {
        return String(n.label ?? n.id ?? n.server_id ?? '');
    }

    function nodeType(n: TraceNode): string {
        return String(n.type ?? '').toLowerCase();
    }

    function fmtLag(lag: unknown): string {
        if (lag === null || lag === undefined || lag === '') return '';
        if (typeof lag === 'number') return formatLagSeconds(lag);
        return String(lag);
    }

    function formatLagSeconds(ms: number): string {
        if (!Number.isFinite(ms) || ms < 0) return '';
        const s = ms / 1000;
        if (s < 60) return `${s >= 10 ? s.toFixed(0) : s.toFixed(1)}s`;
        const m = Math.floor(s / 60);
        const r = s - m * 60;
        return `${m}m${r < 10 ? '0' : ''}${r.toFixed(0)}s`;
    }

    function eventTime(n: TraceNode): string {
        const ts = n.timestamp as number | undefined;
        return calendarFormat(ts);
    }

    function buildGraphRoot(ev: TraceNode, flatParents: TraceNode[], down: Record<string, TraceNode>): GraphNode {
        const evtId = String(ev.id ?? ev.eid ?? 'event');
        const wrapped: GraphNode[] = [];
        for (let i = 0; i < flatParents.length; i++) {
            const p = flatParents[i]!;
            wrapped.push({
                ...(p as object),
                id: String(p.id ?? `p-${i}`),
                parents: i === 0 ? [] : [wrapped[i - 1]!],
            } as GraphNode);
        }
        const kids = buildKids(down);
        return {
            ...(ev as object),
            id: evtId,
            is_root: true,
            parents: wrapped.length ? [wrapped[wrapped.length - 1]!] : [],
            kids,
        } as GraphNode;
    }

    function buildKids(rec: Record<string, TraceNode>): GraphNode[] {
        return Object.entries(rec).map(([cid, c]) => {
            const sub =
                c.children && typeof c.children === 'object'
                    ? buildKids(c.children as Record<string, TraceNode>)
                    : [];
            const { children: _ignore, ...rest } = c as TraceNode & { children?: unknown };
            return {
                ...(rest as object),
                id: String(c.id ?? cid),
                parents: [],
                kids: sub,
            } as GraphNode;
        });
    }

    function navOrderIds(rootData: GraphNode, flatParents: TraceNode[]): string[] {
        const out: string[] = [];
        for (let i = 0; i < flatParents.length; i++) {
            out.push(String(flatParents[i]!.id ?? `p-${i}`));
        }
        out.push(rootData.id);
        function walk(kids: GraphNode[]) {
            for (const k of kids) {
                out.push(k.id);
                if (k.kids?.length) walk(k.kids);
            }
        }
        walk(rootData.kids ?? []);
        return out;
    }

    function buildParentMap(root: GraphNode, flatParents: TraceNode[]): Map<string, string | null> {
        const m = new Map<string, string | null>();
        for (let i = 0; i < flatParents.length; i++) {
            const id = String(flatParents[i]!.id ?? `p-${i}`);
            m.set(id, i === 0 ? null : String(flatParents[i - 1]!.id ?? `p-${i - 1}`));
        }
        const inner =
            flatParents.length > 0
                ? String(flatParents[flatParents.length - 1]!.id ?? `p-${flatParents.length - 1}`)
                : null;
        m.set(root.id, inner);
        function walk(parentId: string, kids: GraphNode[]) {
            for (const k of kids) {
                m.set(k.id, parentId);
                if (k.kids?.length) walk(k.id, k.kids);
            }
        }
        walk(root.id, root.kids ?? []);
        return m;
    }

    function buildChildrenMap(root: GraphNode): Map<string, string[]> {
        const m = new Map<string, string[]>();
        m.set(root.id, (root.kids ?? []).map((k) => k.id));
        function walk(kids: GraphNode[]) {
            for (const k of kids) {
                m.set(k.id, (k.kids ?? []).map((c) => c.id));
                if (k.kids?.length) walk(k.kids);
            }
        }
        walk(root.kids ?? []);
        return m;
    }

    function normalizeTreePositions(root: d3.HierarchyNode<GraphNode>, innerH: number) {
        const pt = root as d3.HierarchyPointNode<GraphNode>;
        let offset = 0;
        pt.eachBefore((d) => {
            if (d.depth === 0) offset = innerH / 2 - d.x;
        });
        pt.each((d) => {
            if (d.depth === 0) d.x = innerH / 2;
            else d.x += offset;
            d.y = d.depth * BRANCH_X;
        });
    }

    function toScreen(
        d: d3.HierarchyNode<GraphNode>,
        flip: number,
        rootX: number,
    ): { px: number; py: number } {
        const n = d as d3.HierarchyPointNode<GraphNode>;
        return { px: flip * n.y, py: n.x - rootX };
    }

    function linkPath(
        s: d3.HierarchyNode<GraphNode>,
        t: d3.HierarchyNode<GraphNode>,
        flip: number,
        rootX: number,
    ): string {
        const a = toScreen(s, flip, rootX);
        const b = toScreen(t, flip, rootX);
        const mx = (a.px + b.px) / 2;
        return `M${a.px},${a.py}C${mx},${a.py} ${mx},${b.py} ${b.px},${b.py}`;
    }

    function findWorldPos(
        id: string,
        leftRoot: d3.HierarchyNode<GraphNode>,
        rightRoot: d3.HierarchyNode<GraphNode>,
        rootXLeft: number,
        rootXRight: number,
    ): { x: number; y: number } | null {
        const FLIP_L = -1;
        const FLIP_R = 1;
        for (const [root, flip, rx] of [
            [leftRoot, FLIP_L, rootXLeft],
            [rightRoot, FLIP_R, rootXRight],
        ] as const) {
            for (const d of root.descendants()) {
                if (d.data.id === id) {
                    return toScreen(d, flip, rx);
                }
            }
        }
        return null;
    }

    function draw() {
        const el = wrapEl;
        if (!el || !event) return;

        const rect = el.getBoundingClientRect();
        const W = Math.max(rect.width || 640, 400);
        const H = Math.max(rect.height || 480, 400);

        const svg = d3.select(el).select<SVGSVGElement>('svg');
        const svgNodeBefore = svg.node();
        const prevTf = svgNodeBefore ? d3.zoomTransform(svgNodeBefore) : null;
        const traceChanged = lastDrawTraceKey !== traceKey;
        lastDrawTraceKey = traceKey;

        svg.on('.zoom', null);
        svg.selectAll('*').remove();
        svg.attr('width', W).attr('height', H).attr('role', 'img').attr('aria-label', 'D3 event trace tree');

        const rootData = buildGraphRoot(event, parentsArray, children ?? {});
        const parentMap = buildParentMap(rootData, parentsArray);
        const childrenMap = buildChildrenMap(rootData);
        const navIds = navOrderIds(rootData, parentsArray);

        const leftRoot = d3.hierarchy<GraphNode>(rootData, (d) => d.parents ?? []);
        const rightRoot = d3.hierarchy<GraphNode>(rootData, (d) => d.kids ?? []);
        const innerH = Math.max(
            360,
            Math.max(leftRoot.descendants().length, rightRoot.descendants().length) * 46,
        );

        d3.tree<GraphNode>().size([innerH, Math.max(leftRoot.height, 1) * BRANCH_X])(leftRoot);
        normalizeTreePositions(leftRoot, innerH);
        const rootXLeft = (leftRoot as d3.HierarchyPointNode<GraphNode>).x;

        d3.tree<GraphNode>().size([innerH, Math.max(rightRoot.height, 1) * BRANCH_X])(rightRoot);
        normalizeTreePositions(rightRoot, innerH);
        const rootXRight = (rightRoot as d3.HierarchyPointNode<GraphNode>).x;

        const FLIP_L = -1;
        const FLIP_R = 1;

        const strokeEdge = 'var(--muted-foreground)';
        const strokeEdgeSoft = 'var(--ring)';

        const zoomG = svg.append('g').attr('class', 'trace-zoom-layer');
        const graphG = zoomG.append('g').attr('class', 'trace-graph');

        const nodeG = graphG.append('g').attr('class', 'trace-nodes');

        function drawNodes(
            hier: d3.HierarchyNode<GraphNode>,
            flip: number,
            rootX: number,
            classPrefix: string,
        ) {
            const hierPt = hier as d3.HierarchyPointNode<GraphNode>;
            const sel = nodeG
                .selectAll<SVGGElement, d3.HierarchyPointNode<GraphNode>>(`g.${classPrefix}-node`)
                .data(hierPt.descendants())
                .join('g')
                .attr('class', (d) => {
                    const focused = d.data.id === focusNodeId ? ' is-focused' : '';
                    return `${classPrefix}-node trace-node${d.data.is_root ? ' is-root' : ''}${focused}`;
                })
                .attr('transform', (d) => {
                    const { px, py } = toScreen(d, flip, rootX);
                    return `translate(${px},${py})`;
                })
                .style('cursor', 'pointer')
                .on('click', (_ev, d) => {
                    focusNodeId = d.data.id;
                });

            sel.append('circle')
                .attr('r', (d) => (d.data.is_root ? ROOT_R : NODE_R))
                .attr('fill', (d) => (d.data.is_root ? 'var(--secondary)' : 'var(--card)'))
                .attr('stroke', (d) => {
                    if (d.data.id === focusNodeId) return 'var(--primary)';
                    return d.data.is_root ? 'var(--primary)' : strokeEdgeSoft;
                })
                .attr('stroke-width', (d) => {
                    if (d.data.id === focusNodeId) return 3.5;
                    return d.data.is_root ? 3 : 2;
                });

            sel.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', (d) => (d.data.is_root ? 5 : 4))
                .attr('fill', 'var(--foreground)')
                .attr('font-size', 10)
                .attr('font-weight', 600)
                .attr('class', 'pointer-events-none select-none')
                .text((d) => (nodeType(d.data) === 'bot' ? 'B' : 'Q'));

            sel.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', (d) => (d.data.is_root ? ROOT_R + 14 : NODE_R + 12))
                .attr('fill', 'var(--foreground)')
                .attr('font-size', 10)
                .attr('font-weight', 500)
                .attr('class', 'pointer-events-none select-none')
                .each(function (d) {
                    const label = nodeTitle(d.data);
                    const max = 18;
                    const short = label.length > max ? `${label.slice(0, max - 1)}…` : label;
                    d3.select(this).text(short);
                });

            sel.filter((d) => d.data.is_root === true)
                .append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', ROOT_R + 28)
                .attr('fill', 'var(--muted-foreground)')
                .attr('font-size', 9)
                .attr('class', 'pointer-events-none select-none')
                .text((d) => eventTime(d.data));

            sel.filter((d) => d.depth > 0 && nodeType(d.data) === 'queue')
                .append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', NODE_R + 24)
                .attr('fill', 'var(--muted-foreground)')
                .attr('font-size', 8)
                .attr('class', 'pointer-events-none select-none')
                .text((d) => eventTime(d.data) || '');

            sel.filter((d) => d.depth > 0 && nodeType(d.data) === 'bot')
                .append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', NODE_R + 24)
                .attr('fill', 'var(--muted-foreground)')
                .attr('font-size', 8)
                .attr('class', 'pointer-events-none select-none')
                .text((d) =>
                    d.data.has_processed === true
                        ? 'Processed'
                        : d.data.has_processed === false
                          ? 'Not processed'
                          : '',
                );
        }

        drawNodes(leftRoot, FLIP_L, rootXLeft, 'left');
        drawNodes(rightRoot, FLIP_R, rootXRight, 'right');
        nodeG.selectAll('g.left-node.is-root').remove();

        const leftLinks = leftRoot.links();
        const rightLinks = rightRoot.links();

        const linkG = graphG.append('g').attr('class', 'trace-links');
        linkG
            .selectAll('path.trace-link-left')
            .data(leftLinks)
            .join('path')
            .attr('fill', 'none')
            .attr('stroke', strokeEdge)
            .attr('stroke-width', 2.25)
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.92)
            .attr('d', (d) => linkPath(d.source, d.target, FLIP_L, rootXLeft));

        linkG
            .selectAll('path.trace-link-right')
            .data(rightLinks)
            .join('path')
            .attr('fill', 'none')
            .attr('stroke', strokeEdge)
            .attr('stroke-width', 2.25)
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.92)
            .attr('d', (d) => linkPath(d.source, d.target, FLIP_R, rootXRight));

        linkG
            .selectAll('text.trace-lag-left')
            .data(
                leftLinks.filter((l) => {
                    const lag = l.target.data.lag;
                    return lag !== undefined && lag !== '' && lag !== null;
                }),
            )
            .join('text')
            .attr('fill', 'var(--foreground)')
            .attr('font-family', 'ui-monospace, monospace')
            .attr('font-size', 10)
            .attr('text-anchor', 'middle')
            .attr('dy', -6)
            .attr('transform', (l) => {
                const a = toScreen(l.source, FLIP_L, rootXLeft);
                const b = toScreen(l.target, FLIP_L, rootXLeft);
                return `translate(${(a.px + b.px) / 2},${(a.py + b.py) / 2})`;
            })
            .text((l) => fmtLag(l.target.data.lag));

        const zoomBehavior = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.35, 3])
            .on('zoom', (ev) => {
                zoomG.attr('transform', ev.transform.toString());
            });

        svg.call(zoomBehavior);

        const fid = navIds.includes(focusNodeId) ? focusNodeId : rootData.id;
        if (fid !== focusNodeId) focusNodeId = fid;

        const focusPos = findWorldPos(focusNodeId, leftRoot, rightRoot, rootXLeft, rootXRight) ?? { x: 0, y: 0 };

        let targetTf: d3.ZoomTransform;
        if (traceChanged) {
            targetTf = d3.zoomIdentity
                .translate(W / 2, H / 2)
                .scale(INITIAL_SCALE)
                .translate(-focusPos.x, -focusPos.y);
        } else if (prevTf) {
            const k = prevTf.k;
            targetTf = d3.zoomIdentity
                .translate(W / 2, H / 2)
                .scale(k)
                .translate(-focusPos.x, -focusPos.y);
        } else {
            targetTf = d3.zoomIdentity
                .translate(W / 2, H / 2)
                .scale(INITIAL_SCALE)
                .translate(-focusPos.x, -focusPos.y);
        }
        svg.call(zoomBehavior.transform as never, targetTf);

        svg.on('mousedown', () => {
            (el as HTMLElement).focus({ preventScroll: true });
        });

        const moveLinear = (delta: number) => {
            const i = navIds.indexOf(focusNodeId);
            if (i < 0) return;
            focusNodeId = navIds[Math.max(0, Math.min(navIds.length - 1, i + delta))]!;
        };

        const goParent = () => {
            const p = parentMap.get(focusNodeId);
            if (p != null) focusNodeId = p;
        };

        const goFirstChild = () => {
            const ch = childrenMap.get(focusNodeId);
            if (ch?.length) focusNodeId = ch[0]!;
        };

        const prevKey = (el as HTMLElement & { __traceKeydown?: (e: KeyboardEvent) => void }).__traceKeydown;
        if (prevKey) el.removeEventListener('keydown', prevKey);

        const keyfn = (e: KeyboardEvent) => {
            if (!el.contains(document.activeElement) && document.activeElement !== el) return;
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    moveLinear(-1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    moveLinear(1);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    goParent();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    goFirstChild();
                    break;
                case 'Home':
                    e.preventDefault();
                    if (navIds.length) focusNodeId = navIds[0]!;
                    break;
                case 'End':
                    e.preventDefault();
                    if (navIds.length) focusNodeId = navIds[navIds.length - 1]!;
                    break;
                default:
                    break;
            }
        };
        (el as HTMLElement & { __traceKeydown?: (e: KeyboardEvent) => void }).__traceKeydown = keyfn;
        el.addEventListener('keydown', keyfn);
    }

    $effect(() => {
        traceKey;
        parentsArray;
        event;
        children;
        focusNodeId;
        if (!wrapEl || !event) return;
        queueMicrotask(() => draw());
    });

    onMount(() => {
        const el = wrapEl;
        if (!el) return;
        ro = new ResizeObserver(() => {
            if (event) queueMicrotask(() => draw());
        });
        ro.observe(el);
        return () => {
            ro?.disconnect();
            const prevKey = (el as HTMLElement & { __traceKeydown?: (e: KeyboardEvent) => void }).__traceKeydown;
            if (prevKey) el.removeEventListener('keydown', prevKey);
        };
    });
</script>

<div class="trace-botmon-d3 flex min-w-0 max-w-full flex-col gap-2 text-sm" role="region" aria-label="Event trace D3 tree">
    <div
        class="mb-1 flex min-w-0 items-start gap-2 rounded-md border border-dashed border-muted-foreground/25 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
    >
        <GitBranch class="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden="true" />
        <span
            ><strong class="text-foreground">D3 tree</strong> — opens on the <strong class="text-foreground">first trace entry</strong> (upstream oldest, else the event). Click a node or use the panel + <strong class="text-foreground">↑↓</strong> linear order, <strong class="text-foreground">←→</strong> parent / first child, <strong class="text-foreground">Home</strong>/<strong class="text-foreground">End</strong> first/last. Wheel zoom, drag pan.</span
        >
    </div>

    <div
        bind:this={wrapEl}
        tabindex="0"
        role="application"
        aria-label="Trace graph. Use arrow keys to navigate nodes."
        class="min-h-[min(72vh,560px)] w-full min-w-0 rounded-lg border bg-muted/10 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
        {#if event}
            <svg class="block h-full min-h-[min(72vh,560px)] w-full touch-none"></svg>
        {:else}
            <p class="p-6 text-sm text-muted-foreground">No event loaded.</p>
        {/if}
    </div>
</div>
