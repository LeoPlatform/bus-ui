<script lang="ts">
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';
    import { Input } from '$lib/client/components/ui/input/index';
    import { QueueEventList, type StreamEvent } from '$lib/client/components/features/queue-event-list';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Search from '@lucide/svelte/icons/search';
    import X from '@lucide/svelte/icons/x';

    type SearchItem = { id: string; name?: string; type: string };

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

    // ── Fetch queue list on mount ───────────────────────────────────────────
    (async () => {
        try {
            const res = await fetch(`${base}/api/resources`, { credentials: 'include' });
            const json = (await res.json()) as { items: SearchItem[] };
            allQueues = (json.items ?? [])
                .filter((i) => i.type === 'queue')
                .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
        } catch (e) {
            queuesError = e instanceof Error ? e.message : String(e);
        } finally {
            queuesLoading = false;
        }
    })();

    function selectQueue(q: SearchItem) {
        selectedQueue = q;
        queueFilter = q.name ?? q.id;
        dropdownOpen = false;
    }

    function clearQueue() {
        selectedQueue = null;
        queueFilter = '';
    }

    function handleTrace(ev: StreamEvent) {
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
        }
        dropdownOpen = true;
    }

    function handleQueueKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') dropdownOpen = false;
    }
</script>

<div class="flex flex-col gap-4 flex-1 min-h-0">
    <!-- Queue search -->
    <div class="shrink-0 flex flex-col gap-2">
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

    <!-- Event list (with built-in payload panel) -->
    {#if selectedQueue}
        <div class="flex-1 min-h-0 flex flex-col">
            <QueueEventList
                queueId={selectedQueue.id}
                onTrace={handleTrace}
                showCopyEid={false}
                showReplay={false}
                autofocus={true}
            />
        </div>
    {/if}
</div>
