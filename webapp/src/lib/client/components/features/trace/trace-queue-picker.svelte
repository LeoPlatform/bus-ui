<script lang="ts">
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';
    import { onDestroy, tick } from 'svelte';
    import * as Table from '$lib/client/components/ui/table/index';
    import { Input } from '$lib/client/components/ui/input/index';
    import { Button } from '$lib/client/components/ui/button/index';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Search from '@lucide/svelte/icons/search';
    import Zap from '@lucide/svelte/icons/zap';
    import X from '@lucide/svelte/icons/x';
    import {
        buildZTokenFromUtcMs,
        calendarFormat,
        filterSearchPathSegment,
    } from '$lib/client/event-viewer/event-search-utils';

    type SearchItem = { id: string; name?: string; type: string };

    type StreamEvent = {
        eid?: string;
        timestamp?: number;
        event_source_timestamp?: number;
    };

    // ── Queue search state ──────────────────────────────────────────────────
    let allQueues = $state<SearchItem[]>([]);
    let queuesLoading = $state(true);
    let queuesError = $state<string | null>(null);

    let queueFilter = $state('');
    let selectedQueue = $state<SearchItem | null>(null);
    let dropdownOpen = $state(false);

    const filteredQueues = $derived(
        allQueues.filter((q) => {
            const f = queueFilter.toLowerCase();
            return !f || q.id.toLowerCase().includes(f) || (q.name ?? '').toLowerCase().includes(f);
        }),
    );

    // ── Event list state ────────────────────────────────────────────────────
    let events = $state<StreamEvent[]>([]);
    let eventsLoading = $state(false);
    let eventsError = $state<string | null>(null);
    let resumptionToken = $state<string | null>(null);
    let activeIndex = $state(-1);
    let tableContainer: HTMLElement | undefined = $state();

    // ── Fetch queue list on mount ───────────────────────────────────────────
    (async () => {
        try {
            const res = await fetch(`${base}/api/resources`, { credentials: 'include' });
            const json = (await res.json()) as { items: SearchItem[] };
            allQueues = (json.items ?? []).filter((i) => i.type === 'queue').sort((a, b) =>
                (a.name ?? a.id).localeCompare(b.name ?? b.id),
            );
        } catch (e) {
            queuesError = e instanceof Error ? e.message : String(e);
        } finally {
            queuesLoading = false;
        }
    })();

    // ── Fetch recent events when a queue is selected ────────────────────────
    let eventAbort: AbortController | null = null;

    async function loadEvents(queueId: string, token: string, reset: boolean) {
        eventAbort?.abort();
        eventAbort = new AbortController();
        const signal = eventAbort.signal;

        eventsLoading = true;
        if (reset) {
            events = [];
            resumptionToken = null;
            eventsError = null;
        }

        try {
            let list = reset ? [] : [...events];
            let tok = token;
            let attempts = 0;

            while (!signal.aborted && attempts < 6 && list.length < 40) {
                attempts++;
                const u = new URL(`${base}/api/queue/event-search`, window.location.origin);
                u.searchParams.set('serverId', queueId);
                u.searchParams.set('token', tok);
                u.searchParams.set('search', filterSearchPathSegment('', tok));
                const res = await fetch(u.toString(), { signal, credentials: 'include' });
                const data = (await res.json()) as {
                    results?: StreamEvent[];
                    resumptionToken?: string | null;
                };
                list = list.concat(data.results ?? []);
                tok = data.resumptionToken ?? '';
                if (!tok) break;
            }

            events = list;
            resumptionToken = tok || null;
            if (reset && list.length > 0) {
                activeIndex = 0;
                await tick();
                tableContainer?.focus();
            }
        } catch (e) {
            if (signal.aborted) return;
            eventsError = e instanceof Error ? e.message : String(e);
        } finally {
            if (!signal.aborted) eventsLoading = false;
        }
    }

    function selectQueue(q: SearchItem) {
        selectedQueue = q;
        queueFilter = q.name ?? q.id;
        dropdownOpen = false;
        activeIndex = -1;
        const token = buildZTokenFromUtcMs(Date.now() - 5 * 60_000);
        void loadEvents(q.id, token, true);
    }

    function clearQueue() {
        selectedQueue = null;
        queueFilter = '';
        events = [];
        eventsError = null;
        resumptionToken = null;
        activeIndex = -1;
    }

    function openTrace(ev: StreamEvent) {
        if (!selectedQueue || !ev.eid) return;
        void goto(
            `${base}/trace?queue=${encodeURIComponent(selectedQueue.id)}&eid=${encodeURIComponent(ev.eid)}`,
        );
    }

    function handleQueueInput(e: Event) {
        const val = (e.target as HTMLInputElement).value;
        queueFilter = val;
        if (val !== (selectedQueue?.name ?? selectedQueue?.id ?? '')) {
            selectedQueue = null;
            events = [];
        }
        dropdownOpen = true;
    }

    function handleQueueKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            dropdownOpen = false;
        }
    }

    function scrollActiveIntoView(idx: number) {
        document.getElementById(`picker-event-${idx}`)?.scrollIntoView({ block: 'nearest' });
    }

    function handleTableKeydown(e: KeyboardEvent) {
        if (events.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, events.length - 1);
            scrollActiveIntoView(activeIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            scrollActiveIntoView(activeIndex);
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            openTrace(events[activeIndex]);
        }
    }

    onDestroy(() => eventAbort?.abort());
</script>

<div class="flex flex-col gap-6">
    <!-- Queue search -->
    <div class="flex flex-col gap-2">
        <label for="queue-search" class="text-sm font-medium">Queue</label>
        <div class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <Search class="h-4 w-4 text-muted-foreground" />
            </div>
            <Input
                id="queue-search"
                class="pl-9 pr-9 font-mono text-sm"
                placeholder="Search queues…"
                autocomplete="off"
                value={queueFilter}
                oninput={handleQueueInput}
                onfocus={() => (dropdownOpen = true)}
                onkeydown={handleQueueKeydown}
                onblur={() => setTimeout(() => (dropdownOpen = false), 150)}
            />
            {#if queueFilter}
                <button
                    type="button"
                    class="absolute inset-y-0 right-2 flex items-center px-1 text-muted-foreground hover:text-foreground"
                    onclick={clearQueue}
                    aria-label="Clear"
                >
                    <X class="h-4 w-4" />
                </button>
            {/if}

            {#if dropdownOpen && (queuesLoading || queuesError || filteredQueues.length > 0)}
                <div
                    class="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md"
                    role="listbox"
                    aria-label="Queue results"
                >
                    {#if queuesLoading}
                        <div class="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                            <Loader2 class="h-4 w-4 animate-spin" />
                            Loading queues…
                        </div>
                    {:else if queuesError}
                        <div class="px-3 py-2 text-sm text-destructive">{queuesError}</div>
                    {:else}
                        {#each filteredQueues.slice(0, 50) as q (q.id)}
                            <button
                                type="button"
                                role="option"
                                aria-selected={selectedQueue?.id === q.id}
                                class="flex w-full flex-col px-3 py-2 text-left hover:bg-muted {selectedQueue?.id === q.id ? 'bg-muted/60' : ''}"
                                onclick={() => selectQueue(q)}
                            >
                                <span class="font-mono text-xs">{q.id}</span>
                                {#if q.name && q.name !== q.id}
                                    <span class="text-xs text-muted-foreground">{q.name}</span>
                                {/if}
                            </button>
                        {/each}
                        {#if filteredQueues.length === 0}
                            <div class="px-3 py-2 text-sm text-muted-foreground">No queues found</div>
                        {/if}
                    {/if}
                </div>
            {/if}
        </div>
    </div>

    <!-- Event list -->
    {#if selectedQueue}
        <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
                <p class="text-sm font-medium">Recent events <span class="text-muted-foreground">(last 5 min)</span></p>
                {#if eventsLoading}
                    <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
                {/if}
            </div>

            {#if eventsError}
                <div class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    {eventsError}
                </div>
            {:else if !eventsLoading && events.length === 0}
                <p class="text-sm text-muted-foreground">No events found in the last 5 minutes.</p>
            {:else}
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <div
                    class="rounded-md border focus:outline-none"
                    role="grid"
                    tabindex={0}
                    aria-label="Event list"
                    aria-activedescendant={activeIndex >= 0 ? `picker-event-${activeIndex}` : undefined}
                    bind:this={tableContainer}
                    onkeydown={handleTableKeydown}
                >
                    <Table.Root class="text-sm">
                        <Table.Header>
                            <Table.Row>
                                <Table.Head class="font-mono text-xs">Event ID</Table.Head>
                                <Table.Head class="text-xs">Created</Table.Head>
                                <Table.Head class="text-xs">Source Time</Table.Head>
                                <Table.Head class="w-10"></Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {#each events as ev, i (ev.eid ?? i)}
                                <Table.Row
                                    id="picker-event-{i}"
                                    class="cursor-pointer {activeIndex === i ? 'bg-muted/80' : ''}"
                                    aria-selected={activeIndex === i}
                                    onclick={() => { activeIndex = i; openTrace(ev); }}
                                >
                                    <Table.Cell class="font-mono text-xs">{ev.eid ?? '—'}</Table.Cell>
                                    <Table.Cell class="whitespace-nowrap text-xs">{calendarFormat(ev.timestamp)}</Table.Cell>
                                    <Table.Cell class="whitespace-nowrap text-xs">{calendarFormat(ev.event_source_timestamp)}</Table.Cell>
                                    <Table.Cell>
                                        {#if ev.eid}
                                            <div class="flex justify-end">
                                                <button
                                                    type="button"
                                                    class="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted"
                                                    title="Trace event lineage"
                                                    onclick={(e) => { e.stopPropagation(); openTrace(ev); }}
                                                >
                                                    <Zap class="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        {/if}
                                    </Table.Cell>
                                </Table.Row>
                            {/each}
                        </Table.Body>
                    </Table.Root>
                </div>

                {#if resumptionToken}
                    <Button
                        variant="outline"
                        size="sm"
                        class="self-start"
                        disabled={eventsLoading}
                        onclick={() => loadEvents(selectedQueue!.id, resumptionToken!, false)}
                    >
                        {#if eventsLoading}
                            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                        {/if}
                        Load more
                    </Button>
                {/if}
            {/if}
        </div>
    {/if}
</div>
