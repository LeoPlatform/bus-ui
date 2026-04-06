<script lang="ts">
    import { getContext } from "svelte";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/client/components/ui/card/index";
    import * as Table from "$lib/client/components/ui/table/index";
    import SparklineChart from "../charts/sparkline-chart.svelte";
    import GenericBucketLineChart from "../charts/generic-bucket-line-chart.svelte";
    import { humanize, getNodeTypeLink } from "$lib/utils";
    import { NodeType, type StatsRange, type DashboardStatsQueueReadWrite } from "$lib/types";

    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;

    let data = $derived(compState.stats);
    let statsRange = $derived(compState.range as StatsRange);

    const isArchived = (id: string) => /_archive$|_snapshot$/.test(id);
    let readQueues = $derived(
        data?.queues?.read
            ? (Object.entries(data.queues.read) as [string, DashboardStatsQueueReadWrite][]).filter(([id]) => !isArchived(id))
            : []
    );
    let writeQueues = $derived(
        data?.queues?.write
            ? (Object.entries(data.queues.write) as [string, DashboardStatsQueueReadWrite][]).filter(([id]) => !isArchived(id))
            : []
    );

    function formatLag(ms: number | undefined) {
        if (!ms) return '';
        return humanize(ms) + ' ago';
    }

    /** Strip type prefix and return display name + icon */
    function parseQueueLabel(raw: string): { name: string; icon: string } {
        if (raw.startsWith('system:')) return { name: raw.slice(7), icon: getNodeTypeLink(NodeType.System) };
        if (raw.startsWith('queue:')) return { name: raw.slice(6), icon: getNodeTypeLink(NodeType.Queue) };
        return { name: raw, icon: getNodeTypeLink(NodeType.Queue) };
    }
</script>

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

    <!-- Queue read/write tables (same grid as queue bot tables) -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0">
        <Card class="min-h-0">
            <CardHeader class="shrink-0">
                <CardTitle>Events Read by Bot</CardTitle>
                <CardDescription>Queues this bot consumes from</CardDescription>
            </CardHeader>
            <CardContent class="flex-1 min-h-0 overflow-y-auto">
                {#if readQueues.length === 0}
                    <div class="text-center py-4 text-muted-foreground">No Sources</div>
                {:else}
                    <Table.Root class="text-base">
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Queue</Table.Head>
                                <Table.Head class="w-[180px]" aria-hidden="true"></Table.Head>
                                <Table.Head class="text-right">Events Read</Table.Head>
                                <Table.Head class="text-right">Last Read</Table.Head>
                                <Table.Head class="text-right">Lag Time</Table.Head>
                                <Table.Head class="text-right">Lag Events</Table.Head>
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
                                        <div class="h-8 w-full">
                                            <SparklineChart data={queue.values || []} label="Reads" />
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
                {/if}
            </CardContent>
        </Card>

        <Card class="min-h-0">
            <CardHeader class="shrink-0">
                <CardTitle>Events Written by Bot</CardTitle>
                <CardDescription>Queues this bot produces to</CardDescription>
            </CardHeader>
            <CardContent class="flex-1 min-h-0 overflow-y-auto">
                {#if writeQueues.length === 0}
                    <div class="text-center py-4 text-muted-foreground">No Destinations</div>
                {:else}
                    <Table.Root class="text-base">
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Queue</Table.Head>
                                <Table.Head class="w-[180px]" aria-hidden="true"></Table.Head>
                                <Table.Head class="text-right">Events Written</Table.Head>
                                <Table.Head class="text-right">Last Write</Table.Head>
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
                                        <div class="h-8 w-full">
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
                {/if}
            </CardContent>
        </Card>
    </div>
</div>
