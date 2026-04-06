<script lang="ts">
    import { getContext, onDestroy, untrack } from "svelte";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { Button } from "$lib/client/components/ui/button/index";
    import { Input } from "$lib/client/components/ui/input/index";
    import * as Table from "$lib/client/components/ui/table/index";
    import { Switch } from "$lib/client/components/ui/switch/index";
    import * as Dialog from "$lib/client/components/ui/dialog/index";
    import Ajv from "ajv";
    import addFormats from "ajv-formats";
    import X from "@lucide/svelte/icons/x";
    import Zap from "@lucide/svelte/icons/zap";
    import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
    import CircleCheck from "@lucide/svelte/icons/circle-check";
    import CircleAlert from "@lucide/svelte/icons/circle-alert";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import Copy from "@lucide/svelte/icons/copy";
    import Check from "@lucide/svelte/icons/check";
    import Share2 from "@lucide/svelte/icons/share-2";
    import { CodeView, DiffCodeView } from "$ui/code-view";
    import {
        buildZTokenFromUtcMs,
        trimEidToken,
        filterSearchPathSegment,
        normalizeIsoZToken,
        calendarFormat,
    } from "$lib/client/event-viewer/event-search-utils";

    type StreamEvent = {
        eid?: string;
        timestamp?: number;
        event_source_timestamp?: number;
        event?: string;
        payload?: Record<string, unknown>;
        version?: string;
        correlation_id?: string;
        is_valid?: boolean | null;
        validation_errors?: string[];
    };

    let { id: queueId, initialEid }: { id: string; initialEid?: string } = $props();

    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;

    let settings = $derived(compState.settings as { latest_write?: number; max_eid?: string } | undefined);

    const TIME_FRAMES = ['30s', '1m', '5m', '1hr', '6hr', '1d', '1w'] as const;
    type TimeFrame = (typeof TIME_FRAMES)[number];
    const DURATION_MS: Record<TimeFrame, number> = {
        '30s': 30_000,
        '1m': 60_000,
        '5m': 5 * 60_000,
        '1hr': 60 * 60_000,
        '6hr': 6 * 60 * 60_000,
        '1d': 24 * 60 * 60_000,
        '1w': 7 * 24 * 60 * 60_000,
    };

    let searchText = $state("");
    let activeTimeFrame = $state<TimeFrame>("5m");

    let events = $state<StreamEvent[]>([]);
    let eventIndex = $state(0);
    let resumptionToken = $state<string | null>(null);
    let aggState = $state<unknown>(undefined);
    let isSearching = $state(false);
    let searchedEventsCount = $state(0);
    let searchEndTime = $state<number | undefined>(undefined);
    let searchConfigured = $state<boolean | null>(null);
    let searchError = $state<string | null>(null);

    let showOldNewDiff = $state(false);
    let replayOpen = $state(false);
    let replayDetail = $state<StreamEvent | null>(null);
    let validateDialogOpen = $state(false);
    let validateTitle = $state("");
    let validateBody = $state("");
    let validateTone = $state<"info" | "error">("info");
    let copied = $state(false);
    let copiedEid = $state<string | null>(null);
    let sharedEid = $state<string | null>(null);

    function copyEid(eid: string) {
        navigator.clipboard.writeText(eid);
        copiedEid = eid;
        setTimeout(() => { copiedEid = null; }, 2000);
    }

    function shareEvent(eid: string) {
        const url = new URL(window.location.href);
        url.search = "";
        url.searchParams.set("tab", "events");
        url.searchParams.set("eid", eid);
        navigator.clipboard.writeText(url.toString());
        sharedEid = eid;
        setTimeout(() => { sharedEid = null; }, 2000);
    }

    let queueSchema: Record<string, unknown> | null = null;
    let payloadValidate = $state<ReturnType<Ajv["compile"]> | null>(null);

    let abortCtrl: AbortController | null = null;
    let chainRunning = false;
    let initialEidConsumed = false;

    function ensurePayloadValidator() {
        if (!queueSchema || payloadValidate) return;
        try {
            const ajv = new Ajv({ allErrors: true, strict: false });
            addFormats(ajv);
            payloadValidate = ajv.compile(queueSchema);
        } catch {
            payloadValidate = null;
        }
    }

    function validateEventsInPlace(list: StreamEvent[]) {
        if (!payloadValidate) return;
        for (const ev of list) {
            if (ev.is_valid != null) continue;
            const payload = ev.payload;
            if (!payload || typeof payload !== "object") {
                ev.is_valid = false;
                ev.validation_errors = ["Missing payload"];
                continue;
            }
            const ok = payloadValidate(payload);
            const syncOk = typeof ok === "boolean" ? ok : false;
            ev.is_valid = syncOk;
            if (!syncOk && payloadValidate.errors) {
                ev.validation_errors = payloadValidate.errors.map(
                    (e) => `payload${e.instancePath || ""} ${e.message ?? ""}`.trim(),
                );
            }
        }
    }

    // Fetch schema whenever queue changes
    $effect(() => {
        const q = queueId;
        if (!q) return;

        let cancelled = false;
        (async () => {
            try {
                const s = await compState.getSchema(q);
                if (cancelled || q !== queueId) return;
                queueSchema = s;
                payloadValidate = null;
                ensurePayloadValidator();
                const list = untrack(() => [...events]);
                validateEventsInPlace(list);
                events = list;
            } catch {
                if (!cancelled) {
                    queueSchema = null;
                    payloadValidate = null;
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    });

    async function fetchSearchPage(token: string, pathSearch: string, agg: unknown, signal: AbortSignal) {
        const u = new URL("/api/queue/event-search", window.location.origin);
        u.searchParams.set("serverId", queueId);
        u.searchParams.set("token", token);
        u.searchParams.set("search", pathSearch);
        if (agg !== undefined && agg !== null) {
            u.searchParams.set("agg", typeof agg === "string" ? agg : JSON.stringify(agg));
        }

        const res = await fetch(u.toString(), { signal, credentials: "include" });
        const text = await res.text();
        if (!res.ok) {
            throw new Error(text || `${res.status} ${res.statusText}`);
        }
        return JSON.parse(text) as {
            results?: StreamEvent[];
            count?: number;
            resumptionToken?: string | null;
            last_time?: number | null;
            agg?: unknown;
            configured?: boolean;
        };
    }

    /**
     * Paginate until 40 hits, 6 attempts, or no resumption token.
     * Matches legacy PayloadSearch behavior (recursive fetch with attempt limit).
     */
    async function runPayloadSearchChain(
        startToken: string,
        resetList: boolean,
        signal: AbortSignal,
    ): Promise<void> {
        if (!queueId || chainRunning) return;
        chainRunning = true;

        try {
            let token = startToken;
            try {
                token = normalizeIsoZToken(token);
            } catch (e: any) {
                searchError = e?.message ?? String(e);
                isSearching = false;
                return;
            }

            if (resetList) {
                events = [];
                searchedEventsCount = 0;
                searchEndTime = undefined;
                resumptionToken = null;
                aggState = undefined;
                eventIndex = 0;
            }

            isSearching = true;
            searchError = null;

            let list = resetList ? [] : [...events];
            let searched = resetList ? 0 : searchedEventsCount;
            let returnedInBatch = 0;
            let attempts = 0;
            let agg = aggState;

            while (!signal.aborted) {
                attempts++;
                const pathSeg = filterSearchPathSegment(searchText, token);
                const result = await fetchSearchPage(token, pathSeg, agg, signal);

                if (result.configured === false) {
                    searchConfigured = false;
                } else if (result.configured === true) {
                    searchConfigured = true;
                }

                const chunk = result.results ?? [];
                list = list.concat(chunk);
                searched += result.count ?? 0;
                returnedInBatch += chunk.length;
                if (result.last_time != null) {
                    searchEndTime = result.last_time ?? undefined;
                }
                if (result.agg !== undefined) {
                    agg = result.agg;
                }

                events = list;
                searchedEventsCount = searched;
                aggState = agg;
                validateEventsInPlace(chunk);

                const nextTok = result.resumptionToken ?? null;

                if (attempts >= 6) {
                    resumptionToken = nextTok;
                    isSearching = false;
                    break;
                }
                if (returnedInBatch >= 40) {
                    resumptionToken = nextTok;
                    isSearching = false;
                    break;
                }
                if (!nextTok) {
                    resumptionToken = null;
                    isSearching = false;
                    break;
                }

                token = nextTok;
                try {
                    token = normalizeIsoZToken(token);
                } catch (e: any) {
                    searchError = e?.message ?? String(e);
                    resumptionToken = nextTok;
                    isSearching = false;
                    break;
                }
            }
        } catch (e: any) {
            if (e?.name === "AbortError") return;
            searchError = e?.message ?? "Search failed";
            isSearching = false;
        } finally {
            chainRunning = false;
        }
    }

    function cancelSearch() {
        abortCtrl?.abort();
        abortCtrl = null;
        chainRunning = false;
    }

    function tokenFromTimeFrame(): string {
        return buildZTokenFromUtcMs(Date.now() - DURATION_MS[activeTimeFrame]);
    }

    /** User-initiated search (Enter key in search bar). */
    function startPayloadSearch(overrideToken?: string) {
        cancelSearch();
        abortCtrl = new AbortController();
        const token = overrideToken ?? tokenFromTimeFrame();
        void runPayloadSearchChain(token, true, abortCtrl.signal);
    }

    function selectTimeFrame(tf: TimeFrame) {
        activeTimeFrame = tf;
        startPayloadSearch();
    }

    function resumeSearch() {
        if (!resumptionToken || isSearching) return;
        cancelSearch();
        abortCtrl = new AbortController();
        void runPayloadSearchChain(resumptionToken, false, abortCtrl.signal);
    }

    function clearSearch() {
        searchText = "";
        cancelSearch();
        startPayloadSearch();
    }

    function onSearchKeydown(e: KeyboardEvent) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const raw = searchText.trim();
        const m = raw.match(/(z\/.*?)(?:$|\s)/);
        if (m) {
            // User pasted a z-token — use it as the start position
            const tok = trimEidToken(normalizeIsoZToken(m[1].replace(/\s/g, "")));
            startPayloadSearch(tok);
        } else {
            startPayloadSearch();
        }
    }

    function onTableKeydown(e: KeyboardEvent) {
        if (!events.length) return;
        if (e.key === "ArrowUp") {
            e.preventDefault();
            eventIndex = Math.max(0, eventIndex - 1);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            eventIndex = Math.min(events.length - 1, eventIndex + 1);
        }
    }

    function openReplay(detail: StreamEvent) {
        replayDetail = detail;
        replayOpen = true;
    }

    function openValidate(detail: StreamEvent) {
        if (!payloadValidate) return;
        if (detail.is_valid == null) {
            validateEventsInPlace([detail]);
        }
        const ok = detail.is_valid === true;
        validateTone = ok ? "info" : "error";
        validateTitle = `${ok ? "Valid" : "Errors"} — ${detail.eid ?? "event"}`;
        validateBody = ok ? "No validation errors" : (detail.validation_errors ?? []).join("\n");
        validateDialogOpen = true;
    }

    let selected = $derived(events[eventIndex] ?? null);

    let payloadPretty = $derived.by(() => {
        if (!selected) return "";
        try {
            return JSON.stringify(selected, null, 4);
        } catch {
            return String(selected);
        }
    });

    let oldNewPair = $derived.by(() => {
        const p = selected?.payload;
        if (!p || typeof p !== "object") return null;
        if (!("old" in p) && !("new" in p)) return null;
        return {
            old: (p.old ?? {}) as Record<string, unknown>,
            new: (p.new ?? {}) as Record<string, unknown>,
        };
    });

    // Show aggregation state when it has user-defined keys (strip internal empty object)
    let aggDisplay = $derived.by((): [string, unknown][] | null => {
        if (aggState == null || typeof aggState !== 'object') return null;
        const entries = Object.entries(aggState as Record<string, unknown>);
        return entries.length > 0 ? entries : null;
    });

    let statusLine = $derived.by(() => {
        const parts: string[] = [];
        if ((resumptionToken || isSearching) && searchEndTime) {
            const t = new Date(searchEndTime).toLocaleString(undefined, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            });
            parts.push(`Looked through ${searchedEventsCount} events until ${t}`);
        }
        return parts.join(" ");
    });

    /**
     * Re-fetch events when the queue ID or time picker changes.
     * Tracks startTime + endTime so we re-run on bucket navigation and live/historical toggle.
     * searchText is read inside runPayloadSearchChain but via untrack so it
     * doesn't cause this effect to re-fire on every keystroke.
     */
    $effect(() => {
        const id = queueId;
        if (!id) return;

        cancelSearch();
        abortCtrl = new AbortController();
        const signal = abortCtrl.signal;

        // If an initialEid was provided via URL (?eid=z/...), use it on first load
        let token: string;
        if (initialEid && !initialEidConsumed) {
            token = trimEidToken(normalizeIsoZToken(initialEid));
            initialEidConsumed = true;
        } else {
            token = tokenFromTimeFrame();
        }

        untrack(() => {
            eventIndex = 0;
            void runPayloadSearchChain(token, true, signal);
        });

        return () => cancelSearch();
    });

    onDestroy(() => cancelSearch());
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="flex flex-col gap-4 flex-1 min-h-0" onkeydown={onTableKeydown} tabindex="-1" role="region">
    <div class="flex items-center gap-2 shrink-0">
        <Input
            class="flex-1 font-mono text-sm"
            placeholder="Search: text, z/… token, or $.field = &quot;value&quot;"
            bind:value={searchText}
            onkeydown={onSearchKeydown}
            autocomplete="off"
        />
        {#if searchText}
            <Button variant="ghost" size="icon" class="shrink-0" onclick={() => clearSearch()} aria-label="Clear search">
                <X class="h-4 w-4" />
            </Button>
        {/if}
        <div class="flex gap-1 shrink-0">
            {#each TIME_FRAMES as tf}
                <Button
                    variant={activeTimeFrame === tf ? "default" : "outline"}
                    size="sm"
                    class="text-xs px-2"
                    onclick={() => selectTimeFrame(tf)}
                >
                    {tf}
                </Button>
            {/each}
        </div>
    </div>

    {#if searchConfigured === false}
        <p class="shrink-0 text-sm text-amber-700 dark:text-amber-400 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
            Event search is not configured. The server is missing required Leo Bus environment variables
            (<code class="font-mono">LEO_EVENT_TABLE</code>, <code class="font-mono">LEO_CRON_TABLE</code>, <code class="font-mono">LEO_S3</code>).
        </p>
    {/if}

    {#if searchError}
        <div class="shrink-0 flex items-center gap-3 text-sm text-destructive">
            <p class="flex-1">{searchError}</p>
            <Button variant="outline" size="sm" onclick={() => startPayloadSearch()}>Retry</Button>
        </div>
    {/if}

    {#if aggDisplay}
        <div class="shrink-0 flex flex-wrap items-center gap-3 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-mono">
            {#each aggDisplay as [key, value]}
                <span class="text-muted-foreground">{key}:</span>
                <span class="font-bold">{typeof value === 'number' ? value.toLocaleString() : JSON.stringify(value)}</span>
            {/each}
        </div>
    {/if}

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 flex-1 min-h-0">
        <div class="flex flex-col rounded-md border min-w-0 min-h-0">
            <div class="flex-1 overflow-auto">
                <Table.Root class="text-sm">
                    <Table.Header class="sticky top-0 z-10 bg-background shadow-sm">
                        <Table.Row>
                            <Table.Head class="w-[36%] font-mono text-xs">Event Id</Table.Head>
                            <Table.Head class="text-xs">Event Created</Table.Head>
                            <Table.Head class="text-xs">Source Time</Table.Head>
                            <Table.Head class="w-36 text-right text-xs"> </Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {#each events as detail, index (detail.eid ?? index)}
                            <Table.Row
                                class="cursor-pointer {eventIndex === index ? 'bg-muted/80' : ''}"
                                onclick={() => (eventIndex = index)}
                            >
                                <Table.Cell class="font-mono text-sm align-middle">{detail.eid ?? "Unspecified"}</Table.Cell>
                                <Table.Cell class="text-sm align-middle whitespace-nowrap">
                                    {calendarFormat(detail.timestamp)}
                                </Table.Cell>
                                <Table.Cell class="text-sm align-middle whitespace-nowrap">
                                    {calendarFormat(detail.event_source_timestamp)}
                                </Table.Cell>
                                <Table.Cell class="text-right align-middle">
                                    <div class="flex justify-end gap-1">
                                        {#if detail.eid}
                                            <button
                                                type="button"
                                                class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                                title="Copy event ID"
                                                onclick={(e) => { e.stopPropagation(); copyEid(detail.eid!); }}
                                            >
                                                {#if copiedEid === detail.eid}
                                                    <Check class="h-4 w-4 text-green-500" />
                                                {:else}
                                                    <Copy class="h-4 w-4" />
                                                {/if}
                                            </button>
                                            <button
                                                type="button"
                                                class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                                title="Copy share link"
                                                onclick={(e) => { e.stopPropagation(); shareEvent(detail.eid!); }}
                                            >
                                                {#if sharedEid === detail.eid}
                                                    <Check class="h-4 w-4 text-green-500" />
                                                {:else}
                                                    <Share2 class="h-4 w-4" />
                                                {/if}
                                            </button>
                                        {/if}
                                        <button
                                            type="button"
                                            class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                            title="Trace — not wired in this app (legacy GET /trace/…)"
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                searchError =
                                                    "Trace is not available in this app yet. Use legacy Botmon or add a trace proxy API.";
                                            }}
                                        >
                                            <Zap class="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                            title="Replay"
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                openReplay(detail);
                                            }}
                                        >
                                            <RotateCcw class="h-4 w-4" />
                                        </button>
                                        {#if payloadValidate}
                                            <button
                                                type="button"
                                                class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                                title="Validate"
                                                onclick={(e) => {
                                                    e.stopPropagation();
                                                    openValidate(detail);
                                                }}
                                            >
                                                {#if detail.is_valid === true}
                                                    <CircleCheck class="h-4 w-4 text-green-600" />
                                                {:else if detail.is_valid === false}
                                                    <CircleAlert class="h-4 w-4 text-destructive" />
                                                {:else}
                                                    <CircleAlert class="h-4 w-4 text-muted-foreground" />
                                                {/if}
                                            </button>
                                        {/if}
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        {/each}
                        <Table.Row>
                            <Table.Cell colspan={4} class="text-center text-sm text-muted-foreground py-3">
                                {#if isSearching}
                                    <span class="inline-flex items-center gap-2 justify-center">
                                        {#if statusLine}{statusLine}
                                            <span> and </span>{/if}
                                        searching
                                        <Loader2 class="h-4 w-4 animate-spin" />
                                    </span>
                                {:else if resumptionToken}
                                    {#if statusLine}<div class="mb-2">{statusLine}</div>{/if}
                                    <Button variant="secondary" size="sm" onclick={() => resumeSearch()}>Continue</Button>
                                {:else if events.length}
                                    <div>No more events found</div>
                                {:else}
                                    <div>No events found</div>
                                {/if}
                            </Table.Cell>
                        </Table.Row>
                    </Table.Body>
                </Table.Root>
            </div>
        </div>

        <div class="flex min-w-0 flex-col rounded-md border min-h-0">
            <div class="flex items-center justify-between border-b px-3 py-2">
                <span class="text-sm font-medium">Payload</span>
                {#if selected}
                    <button
                        type="button"
                        class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Copy to clipboard"
                        onclick={() => {
                            navigator.clipboard.writeText(payloadPretty);
                            copied = true;
                            setTimeout(() => { copied = false; }, 2000);
                        }}
                    >
                        {#if copied}
                            <Check class="h-3.5 w-3.5 text-green-500" />
                        {:else}
                            <Copy class="h-3.5 w-3.5" />
                        {/if}
                    </button>
                {/if}
            </div>
            <div class="flex-1 overflow-auto p-3 min-h-0">
                {#if selected}
                    {#if oldNewPair}
                        <div class="flex items-center gap-2 text-sm mb-2">
                            <Switch bind:checked={showOldNewDiff} id="old-new-diff" />
                            <label for="old-new-diff" class="cursor-pointer">Old / new diff</label>
                        </div>
                    {/if}
                    {#if showOldNewDiff && oldNewPair}
                        <DiffCodeView oldObj={oldNewPair.old} newObj={oldNewPair.new} />
                    {:else}
                        <CodeView code={payloadPretty} lang="json" />
                    {/if}
                {:else}
                    <p class="text-sm text-muted-foreground">Select an event row.</p>
                {/if}
            </div>
        </div>
    </div>
</div>

<Dialog.Root bind:open={replayOpen}>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title>Replay</Dialog.Title>
            <Dialog.Description>Event replay is not implemented in this app yet.</Dialog.Description>
        </Dialog.Header>
        {#if replayDetail}
            <pre class="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs font-mono">{JSON.stringify(
                    replayDetail,
                    null,
                    2,
                )}</pre>
        {/if}
        <Dialog.Footer>
            <Button variant="secondary" onclick={() => (replayOpen = false)}>Close</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={validateDialogOpen}>
    <Dialog.Content class="sm:max-w-lg">
        <Dialog.Header>
            <Dialog.Title class={validateTone === "error" ? "text-destructive" : ""}>{validateTitle}</Dialog.Title>
        </Dialog.Header>
        <pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{validateBody}</pre>
        <Dialog.Footer>
            <Button variant="secondary" onclick={() => (validateDialogOpen = false)}>Close</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
