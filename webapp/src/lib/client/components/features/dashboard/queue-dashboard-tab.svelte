<script lang="ts">
    import { getContext } from "svelte";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/client/components/ui/card/index";
    import * as Table from "$lib/client/components/ui/table/index";
    import SparklineChart from "../charts/sparkline-chart.svelte";
    import GenericBucketLineChart from "../charts/generic-bucket-line-chart.svelte";
    import Input from "$lib/client/components/ui/input/input.svelte";
    import { humanize, getNodeTypeLink } from "$lib/utils";
    import { NodeType, type DashboardStatsQueueReadWrite, type StatsRange } from "$lib/types";
    import ArrowUpDown from "@lucide/svelte/icons/arrow-up-down";
    import ArrowUp from "@lucide/svelte/icons/arrow-up";
    import ArrowDown from "@lucide/svelte/icons/arrow-down";

    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;

    let data = $derived(compState.stats);
    let statsRange = $derived(compState.range as StatsRange);

    let writeSearch = $state("");
    let readSearch = $state("");

    // Sort state: [column, direction]
    type SortDir = "asc" | "desc";
    let writeSortCol = $state<string | null>(null);
    let writeSortDir = $state<SortDir>("desc");
    let readSortCol = $state<string | null>(null);
    let readSortDir = $state<SortDir>("desc");

    function toggleSort(current: string | null, currentDir: SortDir, col: string): { col: string | null; dir: SortDir } {
        if (current === col) {
            if (currentDir === "desc") return { col, dir: "asc" };
            return { col: null, dir: "desc" }; // reset
        }
        return { col, dir: "desc" };
    }

    function totalEvents(bot: DashboardStatsQueueReadWrite): number {
        return bot.values?.reduce((acc, curr) => acc + (curr.value || 0), 0) ?? 0;
    }

    function sortBots(bots: [string, DashboardStatsQueueReadWrite][], col: string | null, dir: SortDir): [string, DashboardStatsQueueReadWrite][] {
        if (!col) return bots;
        const mult = dir === "asc" ? 1 : -1;
        return [...bots].sort(([, a], [, b]) => {
            switch (col) {
                case "name": return mult * (a.label || a.id).localeCompare(b.label || b.id);
                case "events": return mult * (totalEvents(a) - totalEvents(b));
                case "last_read": return mult * ((a.last_read_lag ?? 0) - (b.last_read_lag ?? 0));
                case "lag_time": return mult * ((a.last_event_source_timestamp_lag ?? 0) - (b.last_event_source_timestamp_lag ?? 0));
                case "lag_events": return mult * ((a.lagEvents ?? 0) - (b.lagEvents ?? 0));
                default: return 0;
            }
        });
    }

    let allWriteBots = $derived(
        data?.bots?.write
            ? (Object.entries(data.bots.write) as [string, DashboardStatsQueueReadWrite][])
            : []
    );
    let allReadBots = $derived(
        data?.bots?.read
            ? (Object.entries(data.bots.read) as [string, DashboardStatsQueueReadWrite][])
            : []
    );

    let filteredWriteBots = $derived(
        writeSearch
            ? allWriteBots.filter(([, bot]) => (bot.label || bot.id).toLowerCase().includes(writeSearch.toLowerCase()))
            : allWriteBots
    );
    let filteredReadBots = $derived(
        readSearch
            ? allReadBots.filter(([, bot]) => (bot.label || bot.id).toLowerCase().includes(readSearch.toLowerCase()))
            : allReadBots
    );

    let writeBots = $derived(sortBots(filteredWriteBots, writeSortCol, writeSortDir));
    let readBots = $derived(sortBots(filteredReadBots, readSortCol, readSortDir));

    const botIcon = getNodeTypeLink(NodeType.Bot);

    function formatLag(ms: number | undefined) {
        if (!ms) return '';
        return humanize(ms) + ' ago';
    }

    function displayName(raw: string): string {
        return raw.startsWith('bot:') ? raw.slice(4) : raw;
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

<div class="flex flex-col gap-4 h-full min-h-0">
    <!-- Summary Charts -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <Card>
            <CardHeader>
                <CardTitle>Events Written</CardTitle>
            </CardHeader>
            <CardContent>
                <div class="h-56 w-full">
                    {#if data?.writes}
                        <GenericBucketLineChart
                            data={data.writes}
                            chartLabel="Writes"
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
                <CardTitle>Events Read</CardTitle>
            </CardHeader>
            <CardContent>
                <div class="h-56 w-full">
                    {#if data?.reads}
                        <GenericBucketLineChart
                            data={data.reads}
                            chartLabel="Reads"
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
                <CardTitle>Read Lag</CardTitle>
            </CardHeader>
            <CardContent>
                <div class="h-56 w-full">
                    {#if data?.read_lag}
                        <GenericBucketLineChart
                            data={data.read_lag}
                            chartLabel="Read Lag"
                            range={statsRange}
                            start={data?.currentBucketStart || data?.start || 0}
                            end={data?.end || 0}
                            rangeStart={data?.start}
                            showTitle={false}
                            formatTotal={(val) => humanize(val)}
                        />
                    {:else}
                        <div class="flex items-center justify-center h-full text-muted-foreground">No data</div>
                    {/if}
                </div>
            </CardContent>
        </Card>
    </div>

    <!-- Bot Tables — fills remaining space -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0">
        <!-- Writers -->
        <Card class="min-h-0">
            <CardHeader class="shrink-0">
                <div class="flex items-center justify-between">
                    <div>
                        <CardTitle>Events Written by a Bot to this Queue</CardTitle>
                        <CardDescription>
                            {allWriteBots.length} producer{allWriteBots.length !== 1 ? 's' : ''}
                        </CardDescription>
                    </div>
                </div>
                {#if allWriteBots.length > 3}
                    <Input
                        placeholder="Search producers..."
                        class="h-8 text-sm max-w-xs"
                        bind:value={writeSearch}
                    />
                {/if}
            </CardHeader>
            <CardContent class="flex-1 min-h-0 overflow-y-auto">
                {#if writeBots.length === 0}
                    <div class="text-center py-4 text-muted-foreground">
                        {writeSearch ? 'No matching producers' : 'No Sources'}
                    </div>
                {:else}
                    <Table.Root class="text-base">
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>
                                    <button class="inline-flex items-center hover:text-foreground" onclick={() => { const s = toggleSort(writeSortCol, writeSortDir, "name"); writeSortCol = s.col; writeSortDir = s.dir; }}>
                                        Bot {@render sortIcon("name", writeSortCol, writeSortDir)}
                                    </button>
                                </Table.Head>
                                <Table.Head class="w-[140px]"></Table.Head>
                                <Table.Head class="text-right">
                                    <button class="inline-flex items-center hover:text-foreground ml-auto" onclick={() => { const s = toggleSort(writeSortCol, writeSortDir, "events"); writeSortCol = s.col; writeSortDir = s.dir; }}>
                                        Events Written {@render sortIcon("events", writeSortCol, writeSortDir)}
                                    </button>
                                </Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {#each writeBots as [, bot]}
                                <Table.Row>
                                    <Table.Cell>
                                        <a href="/dashboard/{bot.id}" class="flex items-center gap-2 text-blue-500 hover:underline text-base">
                                            <img src={botIcon} alt="" class="w-5 h-5 shrink-0" />
                                            <span class="truncate">{displayName(bot.label || bot.id)}</span>
                                        </a>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div class="h-8 w-full">
                                            <SparklineChart data={bot.values || []} color="var(--chart-2)" label="Writes" />
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell class="text-right tabular-nums">
                                        {totalEvents(bot).toLocaleString()}
                                    </Table.Cell>
                                </Table.Row>
                            {/each}
                        </Table.Body>
                    </Table.Root>
                {/if}
            </CardContent>
        </Card>

        <!-- Readers -->
        <Card class="min-h-0">
            <CardHeader class="shrink-0">
                <div class="flex items-center justify-between">
                    <div>
                        <CardTitle>Events Read by a Bot from this Queue</CardTitle>
                        <CardDescription>
                            {allReadBots.length} consumer{allReadBots.length !== 1 ? 's' : ''}
                        </CardDescription>
                    </div>
                </div>
                {#if allReadBots.length > 3}
                    <Input
                        placeholder="Search consumers..."
                        class="h-8 text-sm max-w-xs"
                        bind:value={readSearch}
                    />
                {/if}
            </CardHeader>
            <CardContent class="flex-1 min-h-0 overflow-y-auto">
                {#if readBots.length === 0}
                    <div class="text-center py-4 text-muted-foreground">
                        {readSearch ? 'No matching consumers' : 'No Destinations'}
                    </div>
                {:else}
                    <Table.Root class="text-base">
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>
                                    <button class="inline-flex items-center hover:text-foreground" onclick={() => { const s = toggleSort(readSortCol, readSortDir, "name"); readSortCol = s.col; readSortDir = s.dir; }}>
                                        Bot {@render sortIcon("name", readSortCol, readSortDir)}
                                    </button>
                                </Table.Head>
                                <Table.Head class="w-[140px]"></Table.Head>
                                <Table.Head class="text-right">
                                    <button class="inline-flex items-center hover:text-foreground ml-auto" onclick={() => { const s = toggleSort(readSortCol, readSortDir, "events"); readSortCol = s.col; readSortDir = s.dir; }}>
                                        Events Read {@render sortIcon("events", readSortCol, readSortDir)}
                                    </button>
                                </Table.Head>
                                <Table.Head class="text-right">
                                    <button class="inline-flex items-center hover:text-foreground ml-auto" onclick={() => { const s = toggleSort(readSortCol, readSortDir, "last_read"); readSortCol = s.col; readSortDir = s.dir; }}>
                                        Last Read {@render sortIcon("last_read", readSortCol, readSortDir)}
                                    </button>
                                </Table.Head>
                                <Table.Head class="text-right">
                                    <button class="inline-flex items-center hover:text-foreground ml-auto" onclick={() => { const s = toggleSort(readSortCol, readSortDir, "lag_time"); readSortCol = s.col; readSortDir = s.dir; }}>
                                        Lag Time {@render sortIcon("lag_time", readSortCol, readSortDir)}
                                    </button>
                                </Table.Head>
                                <Table.Head class="text-right">
                                    <button class="inline-flex items-center hover:text-foreground ml-auto" onclick={() => { const s = toggleSort(readSortCol, readSortDir, "lag_events"); readSortCol = s.col; readSortDir = s.dir; }}>
                                        Lag Events {@render sortIcon("lag_events", readSortCol, readSortDir)}
                                    </button>
                                </Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {#each readBots as [, bot]}
                                <Table.Row>
                                    <Table.Cell>
                                        <a href="/dashboard/{bot.id}" class="flex items-center gap-2 text-blue-500 hover:underline text-base">
                                            <img src={botIcon} alt="" class="w-5 h-5 shrink-0" />
                                            <span class="truncate">{displayName(bot.label || bot.id)}</span>
                                        </a>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div class="h-8 w-full">
                                            <SparklineChart data={bot.values || []} label="Reads" />
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell class="text-right tabular-nums">
                                        {totalEvents(bot).toLocaleString()}
                                    </Table.Cell>
                                    <Table.Cell class="text-right">{formatLag(bot.last_read_lag)}</Table.Cell>
                                    <Table.Cell class="text-right">{formatLag(bot.last_event_source_timestamp_lag)}</Table.Cell>
                                    <Table.Cell class="text-right tabular-nums">{bot.lagEvents?.toLocaleString() || 0}</Table.Cell>
                                </Table.Row>
                            {/each}
                        </Table.Body>
                    </Table.Root>
                {/if}
            </CardContent>
        </Card>
    </div>
</div>
