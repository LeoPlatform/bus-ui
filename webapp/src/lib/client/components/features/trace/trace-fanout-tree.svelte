<script lang="ts">
    /**
     * Legacy Botmon event trace: D3 tree like `tree.jsx`, centered on the first trace entry by default,
     * with click + keyboard navigation and zoom/pan.
     */
    import { calendarFormat } from '$lib/client/event-viewer/event-search-utils';
    import { base } from '$app/paths';
    import * as d3 from 'd3';
    import { onMount } from 'svelte';
    import GitBranch from '@lucide/svelte/icons/git-branch';
    import TraceNodeTooltip from './trace-node-tooltip.svelte';

    function nodeImageHref(n: TraceNode): string {
        const t = nodeType(n);
        if (t === 'queue') return `${base}/queue.png`;
        if (t === 'system') return `${base}/system.png`;
        return `${base}/bot.png`;
    }

    type TraceNode = Record<string, unknown>;

    type GraphNode = TraceNode & {
        id: string;
        is_root?: boolean;
        parents?: GraphNode[];
        kids?: GraphNode[];
        _rawKidsCount?: number;
        _isCollapsed?: boolean;
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
    const NODE_R = 22;
    const ROOT_R = 22;
    const INITIAL_SCALE = 1.45;

    /** Always focus the selected event node so it appears centered on load. */
    function firstEntryId(_par: TraceNode[], ev: TraceNode): string {
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

    function dashboardHref(n: TraceNode): string | null {
        const id = n.id ?? n.server_id;
        return id != null && id !== '' ? `${base}/dashboard/${String(id)}` : null;
    }

    let tooltipNode = $state<GraphNode | null>(null);
    let tooltipPos = $state<{ x: number; y: number } | null>(null);

    let collapsedDownstream = $state(new Set<string>());
    /** Set to true by toggleCollapse so draw() knows to preserve the current pan/zoom. */
    let collapseToggled = false;

    function toggleCollapse(nodeId: string) {
        const next = new Set(collapsedDownstream);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        collapseToggled = true;
        collapsedDownstream = next;
    }

    function collectAutoCollapsedFromRaw(down: Record<string, TraceNode>): Set<string> {
        const out = new Set<string>();
        function walk(rec: Record<string, TraceNode>) {
            for (const [cid, c] of Object.entries(rec)) {
                const nodeId = String(c.id ?? cid);
                const rawKids = c.children as Record<string, TraceNode> | undefined;
                const kidsCount = rawKids ? Object.keys(rawKids).length : 0;
                if (kidsCount > 0) {
                    const didNotProcess = nodeType(c) === 'bot' && c.has_processed === false;
                    if (kidsCount > 2 || didNotProcess) {
                        out.add(nodeId);
                    } else {
                        walk(rawKids!);
                    }
                }
            }
        }
        walk(down);
        return out;
    }

    function buildGraphRoot(ev: TraceNode, flatParents: TraceNode[], down: Record<string, TraceNode>, collapsed: Set<string>): GraphNode {
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
        const kids = buildKids(down, collapsed);
        return {
            ...(ev as object),
            id: evtId,
            is_root: true,
            parents: wrapped.length ? [wrapped[wrapped.length - 1]!] : [],
            kids,
        } as GraphNode;
    }

    function buildKids(rec: Record<string, TraceNode>, collapsed: Set<string>): GraphNode[] {
        return Object.entries(rec).map(([cid, c]) => {
            const nodeId = String(c.id ?? cid);
            const rawKids = c.children as Record<string, TraceNode> | undefined;
            const rawKidsCount = rawKids ? Object.keys(rawKids).length : 0;
            const isCollapsed = collapsed.has(nodeId);
            const sub =
                !isCollapsed && rawKids && typeof rawKids === 'object'
                    ? buildKids(rawKids, collapsed)
                    : [];
            const { children: _ignore, ...rest } = c as TraceNode & { children?: unknown };
            return {
                ...(rest as object),
                id: nodeId,
                parents: [],
                kids: sub,
                _rawKidsCount: rawKidsCount,
                _isCollapsed: isCollapsed,
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

    /**
     * Like linkPath but stops before the target node's circle edge so an
     * arrowhead marker sits cleanly at the circle boundary instead of inside it.
     */
    function linkPathRight(
        s: d3.HierarchyNode<GraphNode>,
        t: d3.HierarchyNode<GraphNode>,
        flip: number,
        rootX: number,
    ): string {
        const a = toScreen(s, flip, rootX);
        const b = toScreen(t, flip, rootX);
        const rTgt = (t.data as GraphNode).is_root ? ROOT_R : NODE_R;
        const bx = b.px - rTgt - 5;
        const mx = (a.px + bx) / 2;
        return `M${a.px},${a.py}C${mx},${a.py} ${mx},${b.py} ${bx},${b.py}`;
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
                    // toScreen returns { px, py } — map to { x, y } to match return type.
                    const { px, py } = toScreen(d, flip, rx);
                    return { x: px, y: py };
                }
            }
        }
        return null;
    }

    function draw() {
        tooltipNode = null;
        tooltipPos = null;
        const el = wrapEl;
        if (!el || !event) return;

        const rect = el.getBoundingClientRect();
        // Guard: layout hasn't settled yet — defer until next frame so CSS dimensions are available.
        if (rect.width === 0 || rect.height === 0) {
            requestAnimationFrame(() => draw());
            return;
        }
        const W = Math.max(rect.width, 400);
        const H = Math.max(rect.height, 400);

        const svg = d3.select(el).select<SVGSVGElement>('svg');
        const svgNodeBefore = svg.node();
        const prevTf = svgNodeBefore ? d3.zoomTransform(svgNodeBefore) : null;
        const traceChanged = lastDrawTraceKey !== traceKey;
        lastDrawTraceKey = traceKey;

        // On new trace data, reset to auto-collapsed state and re-enter draw().
        if (traceChanged) {
            const autoCollapsed = collectAutoCollapsedFromRaw(children ?? {});
            if (autoCollapsed.size !== 0 || collapsedDownstream.size !== 0) {
                collapsedDownstream = autoCollapsed;
                return; // effect will schedule draw() with new collapsed state
            }
        }

        svg.on('.zoom', null);
        svg.selectAll('*').remove();
        // Set width/height to the container's stable CSS dimensions. The container now has an
        // explicit height (h-[min(72vh,560px)]) so these values are fixed — no feedback loop.
        svg.attr('width', W).attr('height', H);
        svg.attr('role', 'img').attr('aria-label', 'D3 event trace tree');

        // Arrowhead marker for downstream directed links
        const defs = svg.append('defs');
        defs.append('marker')
            .attr('id', 'trace-arr')
            .attr('viewBox', '0 -4 8 8')
            .attr('refX', 8)
            .attr('refY', 0)
            .attr('markerWidth', 8)
            .attr('markerHeight', 8)
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-4L8,0L0,4Z')
            .attr('fill', 'var(--muted-foreground)')
            .attr('opacity', 0.65);

        const rootData = buildGraphRoot(event, parentsArray, children ?? {}, collapsedDownstream);
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
                // Use pointerdown + stopPropagation instead of click. D3 zoom v7 calls
                // setPointerCapture on pointerdown which redirects the click event to the
                // SVG element, so click handlers on child nodes never fire. Stopping
                // propagation here prevents zoom from capturing, while background drags work.
                .on('pointerdown', (ev, d) => {
                    ev.stopPropagation();
                    focusNodeId = d.data.id;
                });

            sel.append('circle')
                .attr('r', (d) => (d.data.is_root ? ROOT_R : NODE_R))
                .attr('fill', (d) => {
                    if (d.data.is_root) return 'var(--primary)';
                    return nodeType(d.data) === 'bot' ? 'var(--muted)' : 'var(--card)';
                })
                .attr('stroke', (d) => {
                    if (d.data.id === focusNodeId) return 'var(--primary)';
                    if (d.data.is_root) return 'var(--primary)';
                    return nodeType(d.data) === 'bot' ? 'var(--muted-foreground)' : strokeEdgeSoft;
                })
                .attr('stroke-width', (d) => {
                    if (d.data.id === focusNodeId) return 3.5;
                    return d.data.is_root ? 3 : 2;
                });

            sel.each(function (d) {
                const size = d.data.is_root ? 38 : 34;
                d3.select(this)
                    .append('image')
                    .attr('class', 'node-icon pointer-events-none')
                    .attr('href', nodeImageHref(d.data))
                    .attr('x', -size / 2)
                    .attr('y', -size / 2)
                    .attr('width', size)
                    .attr('height', size);
            });

            sel.on('mouseenter', (ev: MouseEvent, d) => {
                tooltipNode = d.data;
                tooltipPos = { x: ev.clientX, y: ev.clientY };
            }).on('mousemove', (ev: MouseEvent) => {
                tooltipPos = { x: ev.clientX, y: ev.clientY };
            }).on('mouseleave', () => {
                tooltipNode = null;
                tooltipPos = null;
            });

            sel.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', (d) => (d.data.is_root ? ROOT_R + 14 : NODE_R + 12))
                .attr('fill', 'var(--foreground)')
                .attr('font-size', 10)
                .attr('font-weight', 500)
                .attr('class', 'pointer-events-none select-none')
                .each(function (d) {
                    const label = nodeTitle(d.data);
                    const max = 22;
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

            // Collapse/expand badge — right side only, non-root nodes with children
            if (classPrefix === 'right') {
                sel.filter((d) => !d.data.is_root && (d.data._rawKidsCount ?? 0) > 0)
                    .each(function (d) {
                        const badgeG = d3
                            .select(this)
                            .append('g')
                            .attr('class', 'collapse-badge')
                            .attr('transform', `translate(${NODE_R - 1},${-(NODE_R - 1)})`)
                            .style('cursor', 'pointer');

                        const r = 7;
                        badgeG
                            .append('circle')
                            .attr('r', r)
                            .attr('fill', 'var(--background)')
                            .attr('stroke', d.data._isCollapsed ? 'var(--primary)' : 'var(--border)')
                            .attr('stroke-width', 1.5);

                        badgeG
                            .append('text')
                            .attr('text-anchor', 'middle')
                            .attr('dominant-baseline', 'central')
                            .attr('font-size', 9)
                            .attr('font-weight', 700)
                            .attr('fill', d.data._isCollapsed ? 'var(--primary)' : 'var(--muted-foreground)')
                            .attr('class', 'pointer-events-none select-none')
                            .text(d.data._isCollapsed ? '+' : '−');

                        badgeG.on('pointerdown', (ev: PointerEvent) => {
                            ev.stopPropagation();
                            toggleCollapse(d.data.id);
                        });
                    });
            }
        }

        drawNodes(leftRoot, FLIP_L, rootXLeft, 'left');
        drawNodes(rightRoot, FLIP_R, rootXRight, 'right');
        nodeG.selectAll('g.left-node.is-root').remove();

        const leftLinks = leftRoot.links();
        const rightLinks = rightRoot.links();

        const linkG = graphG.append('g').attr('class', 'trace-links');

        // Upstream links — subtler, dashed to indicate "history"
        linkG
            .selectAll('path.trace-link-left')
            .data(leftLinks)
            .join('path')
            .attr('fill', 'none')
            .attr('stroke', strokeEdgeSoft)
            .attr('stroke-width', 1.75)
            .attr('stroke-dasharray', '6 3')
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.7)
            .attr('d', (d) => linkPath(d.source, d.target, FLIP_L, rootXLeft));

        // Downstream links — solid + arrowhead to show directed flow
        linkG
            .selectAll('path.trace-link-right')
            .data(rightLinks)
            .join('path')
            .attr('fill', 'none')
            .attr('stroke', strokeEdge)
            .attr('stroke-width', 2.25)
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.92)
            .attr('marker-end', 'url(#trace-arr)')
            .attr('d', (d) => linkPathRight(d.source, d.target, FLIP_R, rootXRight));

        // Lag labels on upstream links
        linkG
            .selectAll('text.trace-lag-left')
            .data(
                leftLinks.filter((l) => {
                    const lag = l.target.data.lag;
                    return lag !== undefined && lag !== '' && lag !== null;
                }),
            )
            .join('text')
            .attr('class', 'trace-lag-left')
            .attr('fill', 'var(--muted-foreground)')
            .attr('font-family', 'ui-monospace, monospace')
            .attr('font-size', 9)
            .attr('text-anchor', 'middle')
            .attr('dy', -5)
            .attr('transform', (l) => {
                const a = toScreen(l.source, FLIP_L, rootXLeft);
                const b = toScreen(l.target, FLIP_L, rootXLeft);
                return `translate(${(a.px + b.px) / 2},${(a.py + b.py) / 2})`;
            })
            .text((l) => fmtLag(l.target.data.lag));

        // Lag labels on downstream links
        linkG
            .selectAll('text.trace-lag-right')
            .data(
                rightLinks.filter((l) => {
                    const lag = l.target.data.lag;
                    return lag !== undefined && lag !== '' && lag !== null;
                }),
            )
            .join('text')
            .attr('class', 'trace-lag-right')
            .attr('fill', 'var(--muted-foreground)')
            .attr('font-family', 'ui-monospace, monospace')
            .attr('font-size', 9)
            .attr('text-anchor', 'middle')
            .attr('dy', -5)
            .attr('transform', (l) => {
                const a = toScreen(l.source, FLIP_R, rootXRight);
                const b = toScreen(l.target, FLIP_R, rootXRight);
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

        const wasCollapseToggle = collapseToggled;
        collapseToggled = false;

        let targetTf: d3.ZoomTransform;
        if (traceChanged) {
            targetTf = d3.zoomIdentity
                .translate(W / 2, H / 2)
                .scale(INITIAL_SCALE)
                .translate(-focusPos.x, -focusPos.y);
        } else if (wasCollapseToggle && prevTf) {
            // Preserve exact pan/zoom — don't snap back to focused node on collapse/expand.
            targetTf = prevTf;
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

        // Zone orientation labels — fixed in the SVG viewport, outside zoom layer
        const labelStyle = {
            fill: 'var(--muted-foreground)',
            'font-size': '11',
            'font-family': 'ui-sans-serif, system-ui, sans-serif',
            opacity: '0.45',
            'pointer-events': 'none',
        } as const;
        svg.append('text')
            .attr('x', 14)
            .attr('y', H - 14)
            .attr('text-anchor', 'start')
            .call((t) => Object.entries(labelStyle).forEach(([k, v]) => t.attr(k, v)))
            .text('← upstream');
        svg.append('text')
            .attr('x', W - 14)
            .attr('y', H - 14)
            .attr('text-anchor', 'end')
            .call((t) => Object.entries(labelStyle).forEach(([k, v]) => t.attr(k, v)))
            .text('downstream →');

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
        collapsedDownstream; // track collapse state changes
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

<div class="trace-botmon-d3 relative flex min-w-0 max-w-full flex-col gap-2 text-sm" role="region" aria-label="Event trace D3 tree">
    <div
        class="mb-1 flex min-w-0 items-start gap-2 rounded-md border border-dashed border-muted-foreground/25 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
    >
        <GitBranch class="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden="true" />
        <span
            ><strong class="text-foreground">D3 tree</strong> — opens on the <strong class="text-foreground">first trace entry</strong> (upstream oldest, else the event). Click a node to focus; click the <strong class="text-foreground">+/−</strong> badge on a downstream node to collapse/expand its children. <strong class="text-foreground">↑↓</strong> linear order, <strong class="text-foreground">←→</strong> parent / first child, <strong class="text-foreground">Home</strong>/<strong class="text-foreground">End</strong> first/last. Wheel zoom, drag pan.</span
        >
    </div>

    <div
        bind:this={wrapEl}
        tabindex="0"
        role="application"
        aria-label="Trace graph. Use arrow keys to navigate nodes."
        class="h-[min(88vh,900px)] w-full min-w-0 rounded-lg border bg-muted/10 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
        {#if event}
            <svg class="block h-full w-full touch-none"></svg>
        {:else}
            <p class="p-6 text-sm text-muted-foreground">No event loaded.</p>
        {/if}
    </div>

    {#if tooltipNode && tooltipPos}
        <div
            class="pointer-events-none fixed z-[200] rounded-lg border bg-popover p-3 shadow-md"
            style="left: {tooltipPos.x + 16}px; top: {tooltipPos.y - 8}px; max-width: 18rem;"
        >
            <TraceNodeTooltip node={tooltipNode} dashHref={dashboardHref(tooltipNode)} />
        </div>
    {/if}
</div>
