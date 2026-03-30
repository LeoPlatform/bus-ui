<script lang="ts">
    import { getContext } from "svelte";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/client/components/ui/card/index";
    import { Input } from "$lib/client/components/ui/input/index";
    import * as Table from "$lib/client/components/ui/table/index";
    import CopyButton from "$lib/client/components/copy-button.svelte";
    import { humanize } from "$lib/utils";
    import { type DashboardStatsQueueReadWrite } from "$lib/types";
    import ArrowUpDown from "@lucide/svelte/icons/arrow-up-down";
    import ArrowUp from "@lucide/svelte/icons/arrow-up";
    import ArrowDown from "@lucide/svelte/icons/arrow-down";

    let { id: _queueId }: { id: string } = $props();

    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;

    let settings = $derived(compState.settings as any);
    let data = $derived(compState.stats);

    let search = $state("");
    type SortDir = "asc" | "desc";
    let sortCol = $state<string | null>("lag");
    let sortDir = $state<SortDir>("desc");

    function toggleSort(col: string) {
        if (sortCol === col) {
            sortDir = sortDir === "desc" ? "asc" : "desc";
        } else {
            sortCol = col;
            sortDir = "desc";
        }
    }

    // Gather all bots (read side) that have checkpoints on this queue
    let allBots = $derived((): DashboardStatsQueueReadWrite[] => {
        const read = data?.bots?.read;
        if (!read) return [];
        return Object.values(read) as DashboardStatsQueueReadWrite[];
    });

    let filteredBots = $derived((): DashboardStatsQueueReadWrite[] => {
        const q = search.toLowerCase();
        let bots = allBots().filter(b => !q || (b.label ?? b.id).toLowerCase().includes(q));

        if (!sortCol) return bots;
        return [...bots].sort((a, b) => {
            const mult = sortDir === "asc" ? 1 : -1;
            switch (sortCol) {
                case "bot": return mult * (a.label ?? a.id).localeCompare(b.label ?? b.id);
                case "checkpoint": return mult * (a.checkpoint ?? '').localeCompare(b.checkpoint ?? '');
                case "lag": return mult * ((a.last_read_lag ?? 0) - (b.last_read_lag ?? 0));
                case "source_lag": return mult * ((a.last_event_source_timestamp_lag ?? 0) - (b.last_event_source_timestamp_lag ?? 0));
                default: return 0;
            }
        });
    });

    function lagColor(ms: number | null | undefined): string {
        if (!ms) return "text-muted-foreground";
        const mins = ms / 1000 / 60;
        if (mins > 30) return "text-destructive";
        if (mins > 5) return "text-yellow-500";
        return "text-green-500";
    }

    function botDashLink(botId: string): string {
        return `/dashboard/${botId.replace(/^bot:/, '')}`;
    }

    function eidToDate(eid: string | undefined): string {
        if (!eid) return "—";
        // EIDs encode a timestamp: zYYYYMMDDHHmmss... format
        const match = eid.match(/z(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
        if (!match) return eid;
        const [, year, month, day, hour, min, sec] = match;
        return `${year}-${month}-${day} ${hour}:${min}:${sec} UTC`;
    }
</script>

<div class="space-y-4">

    <!-- Queue Position Summary -->
    <Card>
        <CardHeader>
            <CardTitle>Queue Position</CardTitle>
            <CardDescription>Current state of this queue's event stream.</CardDescription>
        </CardHeader>
        <CardContent>
            {#if settings}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div class="space-y-1">
                        <p class="text-muted-foreground font-medium">Latest Write EID</p>
                        {#if settings.max_eid}
                            <CopyButton truncate maxLength={40}>{settings.max_eid}</CopyButton>
                            <p class="text-xs text-muted-foreground">{eidToDate(settings.max_eid)}</p>
                        {:else}
                            <p class="text-muted-foreground">—</p>
                        {/if}
                    </div>
                    <div class="space-y-1">
                        <p class="text-muted-foreground font-medium">Last Write</p>
                        <p>{settings.latest_write ? humanize(Date.now() - settings.latest_write) + ' ago' : '—'}</p>
                    </div>
                </div>
            {:else}
                <p class="text-muted-foreground text-sm">Loading…</p>
            {/if}
        </CardContent>
    </Card>

    <!-- Bot Checkpoint Positions -->
    <Card>
        <CardHeader>
            <CardTitle>Bot Checkpoints</CardTitle>
            <CardDescription>Current read positions of all bots consuming this queue.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
            <Input
                bind:value={search}
                placeholder="Filter bots…"
                class="max-w-xs"
            />
            {#if allBots().length === 0}
                <div class="flex items-center justify-center p-6 border rounded-md bg-muted/50">
                    <p class="text-muted-foreground text-sm">No bot checkpoint data available for this time range.</p>
                </div>
            {:else}
                <div class="rounded-md border overflow-x-auto">
                    <Table.Root class="text-base">
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>
                                    <button class="flex items-center gap-1 hover:text-foreground" onclick={() => toggleSort("bot")}>
                                        Bot
                                        {#if sortCol === "bot" && sortDir === "asc"}<ArrowUp class="h-3 w-3" />{:else if sortCol === "bot"}<ArrowDown class="h-3 w-3" />{:else}<ArrowUpDown class="h-3 w-3" />{/if}
                                    </button>
                                </Table.Head>
                                <Table.Head>Checkpoint EID</Table.Head>
                                <Table.Head>
                                    <button class="flex items-center gap-1 hover:text-foreground" onclick={() => toggleSort("lag")}>
                                        Read Lag
                                        {#if sortCol === "lag" && sortDir === "asc"}<ArrowUp class="h-3 w-3" />{:else if sortCol === "lag"}<ArrowDown class="h-3 w-3" />{:else}<ArrowUpDown class="h-3 w-3" />{/if}
                                    </button>
                                </Table.Head>
                                <Table.Head>
                                    <button class="flex items-center gap-1 hover:text-foreground" onclick={() => toggleSort("source_lag")}>
                                        Source Lag
                                        {#if sortCol === "source_lag" && sortDir === "asc"}<ArrowUp class="h-3 w-3" />{:else if sortCol === "source_lag"}<ArrowDown class="h-3 w-3" />{:else}<ArrowUpDown class="h-3 w-3" />{/if}
                                    </button>
                                </Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {#each filteredBots() as bot (bot.id)}
                                <Table.Row>
                                    <Table.Cell class="font-medium">
                                        <a href={botDashLink(bot.id)} class="hover:underline text-foreground">
                                            {bot.label ?? bot.id}
                                        </a>
                                    </Table.Cell>
                                    <Table.Cell class="font-mono text-xs">
                                        {#if bot.checkpoint}
                                            <CopyButton truncate maxLength={30}>{bot.checkpoint}</CopyButton>
                                            <p class="text-muted-foreground text-xs">{eidToDate(bot.checkpoint)}</p>
                                        {:else}
                                            <span class="text-muted-foreground">—</span>
                                        {/if}
                                    </Table.Cell>
                                    <Table.Cell class={lagColor(bot.last_read_lag)}>
                                        {bot.last_read_lag ? humanize(bot.last_read_lag) : '—'}
                                    </Table.Cell>
                                    <Table.Cell class={lagColor(bot.last_event_source_timestamp_lag)}>
                                        {bot.last_event_source_timestamp_lag ? humanize(bot.last_event_source_timestamp_lag) : '—'}
                                    </Table.Cell>
                                </Table.Row>
                            {/each}
                        </Table.Body>
                    </Table.Root>
                </div>
            {/if}
        </CardContent>
    </Card>

</div>
