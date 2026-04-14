<script lang="ts">
    import { getContext } from "svelte";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/client/components/ui/card/index";
    import * as Table from "$lib/client/components/ui/table/index";
    import SparklineChart from "../charts/sparkline-chart.svelte";
    import GenericBucketLineChart from "../charts/generic-bucket-line-chart.svelte";
    import Input from "$lib/client/components/ui/input/input.svelte";
    import { Button } from "$lib/client/components/ui/button/index";
    import { humanize, getNodeTypeLink } from "$lib/utils";
    import { NodeType, type StatsRange, type DashboardStatsQueueReadWrite } from "$lib/types";
    import ArrowUpDown from "@lucide/svelte/icons/arrow-up-down";
    import ArrowUp from "@lucide/svelte/icons/arrow-up";
    import ArrowDown from "@lucide/svelte/icons/arrow-down";
    import ChevronLeft from "@lucide/svelte/icons/chevron-left";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";

    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;

    let data = $derived(compState.stats);
    let statsRange = $derived(compState.range as StatsRange);

    // Search state
    let readSearch = $state("");
    let writeSearch = $state("");

    // Sort state
    type SortDir = "asc" | "desc";
    let readSortCol = $state<string | null>(null);
    let readSortDir = $state<SortDir>("desc");
    let writeSortCol = $state<string | null>(null);
    let writeSortDir = $state<SortDir>("desc");

    // Pagination state
    const PAGE_SIZE = 10;
    let readPage = $state(0);
    let writePage = $state(0);

    function toggleSort(current: string | null, currentDir: SortDir, col: string): { col: string | null; dir: SortDir } {
        if (current === col) {
            if (currentDir === "desc") return { col, dir: "asc" };
            return { col: null, dir: "desc" };
        }
        return { col, dir: "desc" };
    }

    function totalEvents(q: DashboardStatsQueueReadWrite): number {
        return q.values?.reduce((acc, curr) => acc + (curr.value || 0), 0) ?? 0;
    }

    function sortQueues(queues: [string, DashboardStatsQueueReadWrite][], col: string | null, dir: SortDir): [string, DashboardStatsQueueReadWrite][] {
        if (!col) return queues;
        const mult = dir === "asc" ? 1 : -1;
        return [...queues].sort(([, a], [, b]) => {
            switch (col) {
                case "name": return mult * (a.label || a.id).localeCompare(b.label || b.id);
                case "events": return mult * (totalEvents(a) - totalEvents(b));
                case "last_read": return mult * ((a.last_read_lag ?? 0) - (b.last_read_lag ?? 0));
                case "lag_time": return mult * ((a.last_event_source_timestamp_lag ?? 0) - (b.last_event_source_timestamp_lag ?? 0));
                case "lag_events": return mult * ((a.lagEvents ?? 0) - (b.lagEvents ?? 0));
                case "last_write": return mult * ((a.last_write_lag ?? 0) - (b.last_write_lag ?? 0));
                default: return 0;
            }
        });
    }

    const isArchived = (id: string) => /_archive$|_snapshot$/.test(id);

    let allReadQueues = $derived(
        data?.queues?.read
            ? (Object.entries(data.queues.read) as [string, DashboardStatsQueueReadWrite][]).filter(([id]) => !isArchived(id))
            : []
    );
    let allWriteQueues = $derived(
        data?.queues?.write
            ? (Object.entries(data.queues.write) as [string, DashboardStatsQueueReadWrite][]).filter(([id]) => !isArchived(id))
            : []
    );

    let filteredReadQueues = $derived(
        readSearch
            ? allReadQueues.filter(([, q]) => (q.label || q.id).toLowerCase().includes(readSearch.toLowerCase()))
            : allReadQueues
    );
    let filteredWriteQueues = $derived(
        writeSearch
            ? allWriteQueues.filter(([, q]) => (q.label || q.id).toLowerCase().includes(writeSearch.toLowerCase()))
            : allWriteQueues
    );

    let sortedReadQueues = $derived(sortQueues(filteredReadQueues, readSortCol, readSortDir));
    let sortedWriteQueues = $derived(sortQueues(filteredWriteQueues, writeSortCol, writeSortDir));

    // Paginated slices — only these rows render sparklines
    let readQueues = $derived(sortedReadQueues.slice(readPage * PAGE_SIZE, (readPage + 1) * PAGE_SIZE));
    let writeQueues = $derived(sortedWriteQueues.slice(writePage * PAGE_SIZE, (writePage + 1) * PAGE_SIZE));
    let readTotalPages = $derived(Math.ceil(sortedReadQueues.length / PAGE_SIZE));
    let writeTotalPages = $derived(Math.ceil(sortedWriteQueues.length / PAGE_SIZE));

    // Reset page when search changes
    $effect(() => { void readSearch; readPage = 0; });
    $effect(() => { void writeSearch; writePage = 0; });

    function formatLag(ms: number | undefined) {
        if (!ms) return '';
        return humanize(ms) + ' ago';
    }

    function parseQueueLabel(raw: string): { name: string; icon: string } {
        if (raw.startsWith('system:')) return { name: raw.slice(7), icon: getNodeTypeLink(NodeType.System) };
        if (raw.startsWith('queue:')) return { name: raw.slice(6), icon: getNodeTypeLink(NodeType.Queue) };
        return { name: raw, icon: getNodeTypeLink(NodeType.Queue) };
    }
</script>

{#snippet sortIcon(col: string, activeCol: string | null, dir: SortDir)}
    {#if activeCol === col}
        {#if dir === "asc"}
            <ArrowUp class="size-3.5 ml-1 inline" />
        {:else}
            <ArrowDown class="size-3.5 ml-1 inline" />
        {/if}
    {:else}
        <ArrowUpDown class="size-3.5 ml-1 inline opacity-30" />
    {/if}
{/snippet}

{#snippet pager(page: number, totalPages: number, onPrev: () => void, onNext: () => void)}
    {#if totalPages > 1}
        <div class="flex items-center justify-end gap-1 pt-2">
            <span class="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" class="h-7 w-7 p-0" onclick={onPrev} disabled={page === 0}>
                <ChevronLeft class="size-4" />
            </Button>
            <Button variant="outline" size="sm" class="h-7 w-7 p-0" onclick={onNext} disabled={page >= totalPages - 1}>
                <ChevronRight class="size-4" />
            </Button>
        </div>
    {/if}
{/snippet}

<!-- Match queue dashboard: summary charts on top, detail tables below, full-height flex -->
<div class="flex flex-col gap-4 h-full min-h-0">
    <!-- Summary charts (same grid as queue dashboard) -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <Card>
            <CardHeader>
                <CardTitle>Execution Count</CardTitle>
            </CardHeader>
            <CardContent>
                <div class="h-56 w-full">
                    {#if data?.executions}
                        <GenericBucketLineChart
                            data={data.executions}
                            chartLabel="Executions"
                            range={statsRange}
                            start={data?.currentBucketStart || data?.start || 0}
                            end={data?.end || 0}
                            rangeStart={data?.start}
                            showTitle={false}
                        />
                    {:else}
                        <div class="flex items-center justify-center h-full text-muted-foreground">No data</div>
                    {/if}
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Error Count</CardTitle>
            </CardHeader>
            <CardContent>
                <div class="h-56 w-full">
                    {#if data?.errors}
                        <GenericBucketLineChart
                            data={data.errors}
                            chartLabel="Errors"
                            range={statsRange}
                            start={data?.currentBucketStart || data?.start || 0}
                            end={data?.end || 0}
                            rangeStart={data?.start}
                            showTitle={false}
                        />
                    {:else}
                        <div class="flex items-center justify-center h-full text-muted-foreground">No data</div>
                    {/if}
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Execution Time</CardTitle>
            </CardHeader>
            <CardContent>
                <div class="h-56 w-full">
                    {#if data?.duration}
                        <GenericBucketLineChart
                            data={data.duration}
                            chartLabel="Duration"
                            range={statsRange}
                            start={data?.currentBucketStart || data?.start || 0}
                            end={data?.end || 0}
                            rangeStart={data?.start}
                            showTitle={false}
                            formatTotal={(val) => humanize(val)}
                            overrideTotal={data.compare?.duration?.current || 0}
                            overrideCountInBucket={data.compare?.duration?.current || 0}
                            overrideCountInLastBucket={data.compare?.duration?.prev || 0}
                        />
                    {:else}
                        <div class="flex items-center justify-center h-full text-muted-foreground">No data</div>
                    {/if}
                </div>
            </CardContent>
        </Card>
    </div>

    <!-- Queue read/write tables -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0">
        <Card class="min-h-0 flex flex-col">
            <CardHeader class="shrink-0">
                <div class="flex items-center justify-between gap-2">
                    <div>
                        <CardTitle>Events Read by Bot</CardTitle>
                        <CardDescription>Queues this bot consumes from ({sortedReadQueues.length})</CardDescription>
                    </div>
                    {#if allReadQueues.length > PAGE_SIZE}
                        <Input
                            class="max-w-[200px] h-8 text-sm"
                            placeholder="Search queues..."
                            bind:value={readSearch}
                        />
                    {/if}
                </div>
            </CardHeader>
            <CardContent class="flex-1 min-h-0 overflow-y-auto">
                {#if sortedReadQueues.length === 0}
                    <div class="text-center py-4 text-muted-foreground">{readSearch ? 'No matches' : 'No Sources'}</div>
                {:else}
                    <Table.Root class="text-base">
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>
                                    <button class="inline-flex items-center hover:text-foreground" onclick={() => { const s = toggleSort(readSortCol, readSortDir, 'name'); readSortCol = s.col; readSortDir = s.dir; }}>
                                        Queue {@render sortIcon('name', readSortCol, readSortDir)}
                                    </button>
                                </Table.Head>
                                <Table.Head class="w-[220px]" aria-hidden="true"></Table.Head>
                                <Table.Head class="text-right">
                                    <button class="inline-flex items-center hover:text-foreground" onclick={() => { const s = toggleSort(readSortCol, readSortDir, 'events'); readSortCol = s.col; readSortDir = s.dir; }}>
                                        Events Read {@render sortIcon('events', readSortCol, readSortDir)}
                                    </button>
                                </Table.Head>
                                <Table.Head class="text-right">
                                    <button class="inline-flex items-center hover:text-foreground" onclick={() => { const s = toggleSort(readSortCol, readSortDir, 'last_read'); readSortCol = s.col; readSortDir = s.dir; }}>
                                        Last Read {@render sortIcon('last_read', readSortCol, readSortDir)}
                                    </button>
                                </Table.Head>
                                <Table.Head class="text-right">
                                    <button class="inline-flex items-center hover:text-foreground" onclick={() => { const s = toggleSort(readSortCol, readSortDir, 'lag_time'); readSortCol = s.col; readSortDir = s.dir; }}>
                                        Lag Time {@render sortIcon('lag_time', readSortCol, readSortDir)}
                                    </button>
                                </Table.Head>
                                <Table.Head class="text-right">
                                    <button class="inline-flex items-center hover:text-foreground" onclick={() => { const s = toggleSort(readSortCol, readSortDir, 'lag_events'); readSortCol = s.col; readSortDir = s.dir; }}>
                                        Lag Events {@render sortIcon('lag_events', readSortCol, readSortDir)}
                                    </button>
                                </Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {#each readQueues as [, queue]}
                                {@const parsed = parseQueueLabel(queue.label || queue.id)}
                                <Table.Row>
                                    <Table.Cell class="font-medium">
                                        <a href="/dashboard/{queue.id}" class="flex items-center gap-2 text-blue-500 hover:underline text-base">
                                            <img src={parsed.icon} alt="" class="w-5 h-5 shrink-0" />
                                            {parsed.name}
                                        </a>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div class="h-12 w-full">
                                            <SparklineChart data={queue.values || []} label="Reads" lastRead={queue.last_read_event_timestamp} />
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell class="text-right">
                                        {queue.reads?.reduce((acc: number, curr) => acc + (curr.value || 0), 0).toLocaleString() || 0}
                                    </Table.Cell>
                                    <Table.Cell class="text-right">{formatLag(queue.last_read_lag)}</Table.Cell>
                                    <Table.Cell class="text-right">{formatLag(queue.last_event_source_timestamp_lag)}</Table.Cell>
                                    <Table.Cell class="text-right">{queue.lagEvents?.toLocaleString() || 0}</Table.Cell>
                                </Table.Row>
                            {/each}
                        </Table.Body>
                    </Table.Root>
                    {@render pager(readPage, readTotalPages, () => readPage--, () => readPage++)}
                {/if}
            </CardContent>
        </Card>

        <Card class="min-h-0 flex flex-col">
            <CardHeader class="shrink-0">
                <div class="flex items-center justify-between gap-2">
                    <div>
                        <CardTitle>Events Written by Bot</CardTitle>
                        <CardDescription>Queues this bot produces to ({sortedWriteQueues.length})</CardDescription>
                    </div>
                    {#if allWriteQueues.length > PAGE_SIZE}
                        <Input
                            class="max-w-[200px] h-8 text-sm"
                            placeholder="Search queues..."
                            bind:value={writeSearch}
                        />
                    {/if}
                </div>
            </CardHeader>
            <CardContent class="flex-1 min-h-0 overflow-y-auto">
                {#if sortedWriteQueues.length === 0}
                    <div class="text-center py-4 text-muted-foreground">{writeSearch ? 'No matches' : 'No Destinations'}</div>
                {:else}
                    <Table.Root class="text-base">
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>
                                    <button class="inline-flex items-center hover:text-foreground" onclick={() => { const s = toggleSort(writeSortCol, writeSortDir, 'name'); writeSortCol = s.col; writeSortDir = s.dir; }}>
                                        Queue {@render sortIcon('name', writeSortCol, writeSortDir)}
                                    </button>
                                </Table.Head>
                                <Table.Head class="w-[220px]" aria-hidden="true"></Table.Head>
                                <Table.Head class="text-right">
                                    <button class="inline-flex items-center hover:text-foreground" onclick={() => { const s = toggleSort(writeSortCol, writeSortDir, 'events'); writeSortCol = s.col; writeSortDir = s.dir; }}>
                                        Events Written {@render sortIcon('events', writeSortCol, writeSortDir)}
                                    </button>
                                </Table.Head>
                                <Table.Head class="text-right">
                                    <button class="inline-flex items-center hover:text-foreground" onclick={() => { const s = toggleSort(writeSortCol, writeSortDir, 'last_write'); writeSortCol = s.col; writeSortDir = s.dir; }}>
                                        Last Write {@render sortIcon('last_write', writeSortCol, writeSortDir)}
                                    </button>
                                </Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {#each writeQueues as [, queue]}
                                {@const parsed = parseQueueLabel(queue.label || queue.id)}
                                <Table.Row>
                                    <Table.Cell class="font-medium">
                                        <a href="/dashboard/{queue.id}" class="flex items-center gap-2 text-blue-500 hover:underline text-base">
                                            <img src={parsed.icon} alt="" class="w-5 h-5 shrink-0" />
                                            {parsed.name}
                                        </a>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div class="h-12 w-full">
                                            <SparklineChart data={queue.values || []} color="var(--chart-2)" label="Writes" />
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell class="text-right">
                                        {queue.values?.reduce((acc: number, curr) => acc + (curr.value || 0), 0).toLocaleString() || 0}
                                    </Table.Cell>
                                    <Table.Cell class="text-right">{formatLag(queue.last_write_lag)}</Table.Cell>
                                </Table.Row>
                            {/each}
                        </Table.Body>
                    </Table.Root>
                    {@render pager(writePage, writeTotalPages, () => writePage--, () => writePage++)}
                {/if}
            </CardContent>
        </Card>
    </div>
</div>
