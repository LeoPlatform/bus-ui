<script lang="ts">
    import { calendarFormat } from '$lib/client/event-viewer/event-search-utils';

    type TraceNode = Record<string, unknown>;

    let { node }: { node: TraceNode } = $props();

    const UNSET_TIME_LABELS = new Set(['unspecified', 'invalid date', 'n/a', '']);

    function nodeTitle(n: TraceNode): string {
        return String(n.label ?? n.id ?? n.server_id ?? '');
    }

    function nodeType(n: TraceNode): string {
        return String(n.type ?? '').toLowerCase();
    }

    function eventTime(n: TraceNode): string {
        const ts = n.timestamp as number | undefined;
        if (ts == null) return '';
        const formatted = calendarFormat(ts);
        return UNSET_TIME_LABELS.has(formatted.toLowerCase()) ? '' : formatted;
    }

    function nodeEid(n: TraceNode): string | null {
        for (const key of ['eid', 'kinesis_number'] as const) {
            const v = n[key];
            if (v != null && v !== '' && typeof v !== 'object') return String(v);
        }
        const cp = n.checkpoint;
        if (cp == null || cp === '') return null;
        if (typeof cp === 'object') {
            const inner = (cp as Record<string, unknown>).checkpoint;
            if (inner != null && inner !== '' && typeof inner !== 'object') return String(inner);
            return null;
        }
        return String(cp) || null;
    }

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

    function lagPillClass(lag: unknown): string {
        const ms = typeof lag === 'number' ? lag : Number(lag);
        if (isNaN(ms)) return '';
        const abs = Math.abs(ms);
        if (abs < 30_000) return 'bg-green-500/15 text-[#00B315] ring-green-600/30 dark:bg-green-500/20 dark:ring-green-400/30';
        if (abs < 300_000) return 'bg-amber-500/15 text-amber-800 ring-amber-600/30 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-400/30';
        return 'bg-red-500/15 text-[#FF1424] ring-red-600/30 dark:bg-red-500/20 dark:ring-red-400/30';
    }

    function nodeDetail(n: TraceNode): { label: string; data: unknown } | null {
        if (n.payload != null && typeof n.payload === 'object') return { label: 'Payload', data: n.payload };
        if (n.event != null && typeof n.event === 'object') return { label: 'Queue event', data: n.event };
        if (n.checkpoint != null && typeof n.checkpoint === 'object' && Object.keys(n.checkpoint as object).length > 0) return { label: 'Checkpoint', data: n.checkpoint };
        return null;
    }

    const eid = $derived(nodeEid(node));
    const time = $derived(eventTime(node));
    const detail = $derived(nodeDetail(node));
    const detailPreview = $derived.by(() => {
        if (!detail) return null;
        const json = JSON.stringify(detail.data, null, 2);
        const lines = json.split('\n');
        return { label: detail.label, preview: lines.slice(0, 18).join('\n'), truncated: lines.length > 18 };
    });
</script>

<div class="min-w-0 max-w-72 space-y-1.5 text-xs">
    <!-- Title + type + status -->
    <div class="flex flex-wrap items-center gap-1.5">
        <span class="font-semibold leading-snug">{nodeTitle(node)}</span>
        <span class="rounded bg-muted px-1 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{nodeType(node)}</span>
    </div>
    {#if node.has_processed === false}
        <div class="text-amber-600 dark:text-amber-400">✗ Did not process</div>
    {:else if node.has_processed === true}
        <div class="text-green-600 dark:text-green-400">✓ Processed</div>
    {/if}

    <!-- Timestamp -->
    {#if time}
        <div class="text-muted-foreground">{time}</div>
    {/if}

    <!-- EID -->
    {#if eid}
        <div class="break-all font-mono text-[10px] text-muted-foreground">{eid}</div>
    {/if}

    <!-- Lag -->
    {#if node.lag !== undefined && node.lag !== null && node.lag !== ''}
        <div>
            <span class="rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 {lagPillClass(node.lag)}">{fmtLag(node.lag)}</span>
        </div>
    {/if}

    <!-- Payload preview (T3) -->
    {#if detailPreview}
        <div class="border-t border-border pt-1.5">
            <div class="mb-1 font-semibold text-muted-foreground">{detailPreview.label}</div>
            <pre class="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-1.5 font-mono text-[10px] leading-relaxed ring-1 ring-border">{detailPreview.preview}{detailPreview.truncated ? '\n…' : ''}</pre>
        </div>
    {/if}

</div>
