<script lang="ts">
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';
    import { onDestroy } from 'svelte';
    import { Input } from '$lib/client/components/ui/input/index';
    import { Button } from '$lib/client/components/ui/button/index';
    import { Switch } from '$lib/client/components/ui/switch/index';
    import { SplitPane } from '$ui/split-pane';
    import { CodeView, DiffCodeView } from '$ui/code-view';
    import { QueueEventList, type StreamEvent } from '$lib/client/components/features/queue-event-list';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Search from '@lucide/svelte/icons/search';
    import X from '@lucide/svelte/icons/x';
    import Copy from '@lucide/svelte/icons/copy';
    import Check from '@lucide/svelte/icons/check';

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

    // ── Selected event state (for payload panel) ────────────────────────────
    let selectedEvent = $state<StreamEvent | null>(null);
    let showOldNewDiff = $state(false);
    let copied = $state(false);

    const payloadPretty = $derived.by(() => {
        if (!selectedEvent) return '';
        try { return JSON.stringify(selectedEvent, null, 4); } catch { return String(selectedEvent); }
    });

    const oldNewPair = $derived.by(() => {
        const p = selectedEvent?.payload;
        if (!p || typeof p !== 'object') return null;
        if (!('old' in p) && !('new' in p)) return null;
        return {
            old: (p.old ?? {}) as Record<string, unknown>,
            new: (p.new ?? {}) as Record<string, unknown>,
        };
    });

    // Detect s3:// and "Bucket"/"Key" patterns in the payload JSON.
    // Returns unique S3 console links found.
    const s3Links = $derived.by((): { href: string; label: string }[] => {
        if (!payloadPretty) return [];
        const found: { href: string; label: string }[] = [];
        const seen = new Set<string>();

        const addLink = (bucket: string, key: string, raw: string) => {
            const href = `https://console.aws.amazon.com/s3/buckets/${bucket}/${key}/details?region=us-west-2&tab=overview`;
            if (!seen.has(href)) {
                seen.add(href);
                found.push({ href, label: raw.length > 80 ? raw.slice(0, 77) + '…' : raw });
            }
        };

        // Pattern 1: s3://bucket/key/z/...
        for (const m of payloadPretty.matchAll(/s3:\/\/(.*?)\/(.*?\/z\/[^\s"]+)/g)) {
            addLink(m[1], m[2], m[0]);
        }

        // Pattern 2: "Bucket": "...", "Key": ".../z/..."
        for (const m of payloadPretty.matchAll(/"[Bb]ucket":\s*"(.*?)",\s*"[Kk]ey":\s*"(.*?\/z\/.*?)"/g)) {
            addLink(m[1], m[2], `s3://${m[1]}/${m[2]}`);
        }

        return found;
    });

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
        selectedEvent = null;
        showOldNewDiff = false;
    }

    function clearQueue() {
        selectedQueue = null;
        queueFilter = '';
        selectedEvent = null;
        showOldNewDiff = false;
    }

    function handleTrace(ev: StreamEvent) {
        if (!selectedQueue || !ev.eid) return;
        void goto(
            `${base}/trace?queue=${encodeURIComponent(selectedQueue.id)}&eid=${encodeURIComponent(ev.eid)}`,
        );
    }

    function handleEventSelect(ev: StreamEvent) {
        selectedEvent = ev;
        showOldNewDiff = false;
    }

    function copyPayload() {
        if (!payloadPretty) return;
        navigator.clipboard.writeText(payloadPretty);
        copied = true;
        setTimeout(() => { copied = false; }, 2000);
    }

    function handleQueueInput(e: Event) {
        const val = (e.target as HTMLInputElement).value;
        queueFilter = val;
        if (val !== (selectedQueue?.name ?? selectedQueue?.id ?? '')) {
            selectedQueue = null;
            selectedEvent = null;
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

    <!-- Event list + payload panel -->
    {#if selectedQueue}
        <div class="flex-1 min-h-0">
        <SplitPane open={selectedEvent !== null} defaultWidth={360} minWidth={240} maxWidth={700}>
            {#snippet left()}
                <QueueEventList
                    queueId={selectedQueue!.id}
                    onTrace={handleTrace}
                    onEventSelect={handleEventSelect}
                />
            {/snippet}
            {#snippet right()}
                <div class="flex w-full flex-col gap-3 rounded-lg border bg-muted/20 p-3 text-xs">
                    <!-- Header -->
                    <div class="flex items-center justify-between gap-2">
                        <span class="min-w-0 truncate font-mono text-[10px] text-muted-foreground">
                            {selectedEvent?.eid ?? ''}
                        </span>
                        <button
                            type="button"
                            class="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Copy payload"
                            onclick={copyPayload}
                            aria-label="Copy payload"
                        >
                            {#if copied}
                                <Check class="size-3.5 text-green-500" />
                            {:else}
                                <Copy class="size-3.5" />
                            {/if}
                        </button>
                    </div>

                    <!-- Old/new diff toggle -->
                    {#if oldNewPair}
                        <div class="flex items-center gap-2 border-t border-border pt-2">
                            <Switch bind:checked={showOldNewDiff} id="picker-diff" />
                            <label for="picker-diff" class="cursor-pointer text-xs">Old / new diff</label>
                        </div>
                    {/if}

                    <!-- Payload viewer -->
                    <div class="min-h-0 overflow-auto">
                        {#if showOldNewDiff && oldNewPair}
                            <DiffCodeView oldObj={oldNewPair.old} newObj={oldNewPair.new} />
                        {:else}
                            <CodeView code={payloadPretty} lang="json" />
                        {/if}
                    </div>

                    <!-- S3 links -->
                    {#if s3Links.length > 0}
                        <div class="border-t border-border pt-2">
                            <p class="mb-1 font-semibold text-muted-foreground">S3 References</p>
                            <ul class="flex flex-col gap-0.5">
                                {#each s3Links as link (link.href)}
                                    <li>
                                        <a
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="break-all font-mono text-[10px] text-blue-600 hover:underline dark:text-blue-400"
                                        >{link.label}</a>
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    {/if}
                </div>
            {/snippet}
        </SplitPane>
        </div>
    {/if}
</div>
