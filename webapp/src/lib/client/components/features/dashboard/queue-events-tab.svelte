<script lang="ts">
    import { getContext, onDestroy, untrack } from "svelte";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { Button } from "$lib/client/components/ui/button/index";
    import { Input } from "$lib/client/components/ui/input/index";
    import * as Table from "$lib/client/components/ui/table/index";
    import { Switch } from "$lib/client/components/ui/switch/index";
    import * as Dialog from "$lib/client/components/ui/dialog/index";
    import CopyButton from "$lib/client/components/copy-button.svelte";
    import { diffJson } from "diff";
    import Ajv from "ajv";
    import addFormats from "ajv-formats";
    import X from "@lucide/svelte/icons/x";
    import Zap from "@lucide/svelte/icons/zap";
    import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
    import CircleCheck from "@lucide/svelte/icons/circle-check";
    import CircleAlert from "@lucide/svelte/icons/circle-alert";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import {
        TIME_FRAMES,
        type TimeFrame,
        buildZTokenFromUtcMs,
        initialResumptionToken,
        filterSearchPathSegment,
        normalizeIsoZToken,
        calendarFormat,
        linkifyS3Segments,
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

    let { id: queueId }: { id: string } = $props();

    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;

    let settings = $derived(compState.settings as { latest_write?: number; max_eid?: string } | undefined);

    let searchText = $state("");
    let timeFrame = $state<TimeFrame | "">("5m");
    let timestampOverride = $state("");

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

    let customDateTime = $state("");

    let queueSchema: Record<string, unknown> | null = null;
    let payloadValidate = $state<ReturnType<Ajv["compile"]> | null>(null);

    let abortCtrl: AbortController | null = null;
    let chainRunning = false;

    function staleLastWriteToken(lastWriteMs: number): string {
        const d = new Date(lastWriteMs);
        const p = (n: number) => String(n).padStart(2, "0");
        const prefix = `z/${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}/${p(d.getUTCHours())}/${p(d.getUTCMinutes())}/`;
        return prefix + Date.now();
    }

    function deriveInitialFrame(lastWrite: number | undefined): { timeFrame: TimeFrame | ""; timestamp: string } {
        if (!lastWrite) {
            return { timeFrame: "5m", timestamp: "" };
        }
        const age = Date.now() - lastWrite;
        if (age > 7 * 60 * 60 * 1000) {
            return { timeFrame: "", timestamp: staleLastWriteToken(lastWrite) };
        }
        if (age > 24 * 60 * 60 * 1000) return { timeFrame: "1w", timestamp: "" };
        if (age > 6 * 60 * 60 * 1000) return { timeFrame: "1d", timestamp: "" };
        if (age > 60 * 60 * 1000) return { timeFrame: "6hr", timestamp: "" };
        if (age > 5 * 60 * 1000) return { timeFrame: "1hr", timestamp: "" };
        return { timeFrame: "5m", timestamp: "" };
    }

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
     * Paginate until 30 hits, 6 attempts, or no token — matches legacy PayloadSearch.
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
                if (returnedInBatch >= 30) {
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

    function startPayloadSearch() {
        cancelSearch();
        abortCtrl = new AbortController();
        const signal = abortCtrl.signal;
        const first = initialResumptionToken(
            (timestampOverride ? "" : (timeFrame as TimeFrame)) as TimeFrame | "",
            timestampOverride,
        );
        void runPayloadSearchChain(first, true, signal);
    }

    function resumeSearch() {
        if (!resumptionToken || isSearching) return;
        cancelSearch();
        abortCtrl = new AbortController();
        void runPayloadSearchChain(resumptionToken, false, abortCtrl.signal);
    }

    function continueSearch() {
        if (resumptionToken && !isSearching) {
            resumeSearch();
        }
    }

    // Auto-scroll-continue removed: adding events to the DOM triggers scroll
    // events that re-fire the handler, causing an infinite fetch loop on active
    // queues.  Users click the "Continue" button instead.

    function selectTimeFrame(tf: TimeFrame) {
        timestampOverride = "";
        timeFrame = tf;
        startPayloadSearch();
    }

    function applyCustomDateTime() {
        if (!customDateTime) return;
        const ms = new Date(customDateTime).getTime();
        if (Number.isNaN(ms)) return;
        timestampOverride = buildZTokenFromUtcMs(ms);
        timeFrame = "";
        startPayloadSearch();
    }

    function clearSearch() {
        searchText = "";
        timestampOverride = "";
        customDateTime = "";
        cancelSearch();
        const derived = deriveInitialFrame(settings?.latest_write);
        timeFrame = derived.timeFrame;
        timestampOverride = derived.timestamp;
        startPayloadSearch();
    }

    function findMostRecent() {
        const lw = settings?.latest_write;
        if (!lw) return;
        const ms = lw - 5 * 60 * 1000;
        timestampOverride = buildZTokenFromUtcMs(ms);
        timeFrame = "";
        startPayloadSearch();
    }

    function onSearchKeydown(e: KeyboardEvent) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const raw = searchText.trim();
        const m = raw.match(/(z\/.*?)(?:$|\s)/);
        if (m) {
            const tok = m[1].replace(/\s/g, "");
            timestampOverride = tok;
            timeFrame = "";
        }
        startPayloadSearch();
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

    /** Only re-bootstrap when the queue changes; do not restart on stats/settings refresh. */
    $effect(() => {
        const id = queueId;
        if (!id) return;

        cancelSearch();
        abortCtrl = new AbortController();
        const signal = abortCtrl.signal;

        const lw = untrack(() => settings?.latest_write);
        const derived = deriveInitialFrame(lw);
        timeFrame = derived.timeFrame;
        timestampOverride = derived.timestamp;
        searchText = "";
        eventIndex = 0;

        const first = initialResumptionToken(
            (timestampOverride ? "" : (timeFrame as TimeFrame)) as TimeFrame | "",
            timestampOverride,
        );
        void runPayloadSearchChain(first, true, signal);

        return () => cancelSearch();
    });

    onDestroy(() => cancelSearch());
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="flex flex-col gap-4 min-h-[min(70vh,800px)]" onkeydown={onTableKeydown} tabindex="-1" role="region">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex flex-1 flex-col gap-2 min-w-0">
            <div class="relative flex items-center gap-2">
                <Input
                    class="flex-1 font-mono text-sm"
                    placeholder="Search (payload filter); paste z/… token + Enter"
                    bind:value={searchText}
                    onkeydown={onSearchKeydown}
                    autocomplete="off"
                />
                {#if searchText}
                    <Button variant="ghost" size="icon" class="shrink-0" onclick={() => clearSearch()} aria-label="Clear search">
                        <X class="h-4 w-4" />
                    </Button>
                {/if}
            </div>
            <div class="flex flex-wrap items-center gap-2 text-sm">
                <span class="text-muted-foreground whitespace-nowrap">Custom start (local):</span>
                <input
                    type="datetime-local"
                    class="border-input bg-background rounded-md border px-2 py-1 text-sm"
                    bind:value={customDateTime}
                />
                <Button variant="outline" size="sm" onclick={() => applyCustomDateTime()}>Apply</Button>
            </div>
        </div>
        <div class="flex flex-wrap gap-1.5 shrink-0">
            {#each TIME_FRAMES as tf}
                <Button
                    variant={timeFrame === tf && !timestampOverride ? "default" : "outline"}
                    size="sm"
                    class="text-xs"
                    onclick={() => selectTimeFrame(tf)}
                >
                    {tf}
                </Button>
            {/each}
        </div>
    </div>

    {#if searchConfigured === false}
        <p class="text-sm text-amber-700 dark:text-amber-400 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
            Event search is not configured. The server is missing required Leo Bus environment variables
            (<code class="font-mono">LEO_EVENT_TABLE</code>, <code class="font-mono">LEO_CRON_TABLE</code>, <code class="font-mono">LEO_S3</code>).
        </p>
    {/if}

    {#if searchError}
        <p class="text-sm text-destructive">{searchError}</p>
    {/if}

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 flex-1 min-h-0">
        <div class="flex min-h-[320px] flex-col rounded-md border min-w-0">
            <div class="max-h-[min(55vh,560px)] overflow-auto">
                <Table.Root class="text-sm">
                    <Table.Header class="sticky top-0 z-10 bg-background shadow-sm">
                        <Table.Row>
                            <Table.Head class="w-[36%] font-mono text-xs">Event Id</Table.Head>
                            <Table.Head class="text-xs">Event Created</Table.Head>
                            <Table.Head class="text-xs">Source Time</Table.Head>
                            <Table.Head class="w-24 text-right text-xs"> </Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {#each events as detail, index (detail.eid ?? index)}
                            <Table.Row
                                class="cursor-pointer {eventIndex === index ? 'bg-muted/80' : ''}"
                                onclick={() => (eventIndex = index)}
                            >
                                <Table.Cell class="font-mono text-xs align-top">{detail.eid ?? "Unspecified"}</Table.Cell>
                                <Table.Cell class="text-xs align-top whitespace-nowrap">
                                    {calendarFormat(detail.timestamp)}
                                </Table.Cell>
                                <Table.Cell class="text-xs align-top whitespace-nowrap">
                                    {calendarFormat(detail.event_source_timestamp)}
                                </Table.Cell>
                                <Table.Cell class="text-right align-top">
                                    <div class="flex justify-end gap-1">
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
                                {:else if settings?.latest_write}
                                    <Button variant="secondary" size="sm" onclick={() => findMostRecent()}>
                                        Find most recent events
                                    </Button>
                                {:else}
                                    <div>No events found</div>
                                {/if}
                            </Table.Cell>
                        </Table.Row>
                    </Table.Body>
                </Table.Root>
            </div>
        </div>

        <div class="flex min-h-[320px] min-w-0 flex-col rounded-md border">
            <div class="border-b px-3 py-2 text-sm font-medium">Payload</div>
            <div class="flex flex-1 flex-col gap-2 overflow-auto p-3 min-h-0">
                {#if selected}
                    {#if oldNewPair}
                        <div class="flex items-center gap-2 text-sm">
                            <Switch bind:checked={showOldNewDiff} id="old-new-diff" />
                            <label for="old-new-diff" class="cursor-pointer">Old / new diff</label>
                        </div>
                    {/if}
                    {#if showOldNewDiff && oldNewPair}
                        <div class="font-mono text-xs whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3">
                            {#each diffJson(oldNewPair.old, oldNewPair.new) as part}
                                <span
                                    class={part.added
                                        ? "text-green-600 dark:text-green-400"
                                        : part.removed
                                          ? "text-red-600 dark:text-red-400"
                                          : "text-muted-foreground"}
                                >
                                    {part.value}
                                </span>
                            {/each}
                        </div>
                        <span class="inline-flex w-fit">
                            <CopyButton truncate={false}>
                                {diffJson(oldNewPair.old, oldNewPair.new)
                                    .map((p: { value: string }) => p.value)
                                    .join("")}
                            </CopyButton>
                        </span>
                    {:else}
                        <div class="flex justify-end">
                            <span class="inline-flex w-fit">
                                <CopyButton truncate={false}>{payloadPretty}</CopyButton>
                            </span>
                        </div>
                        <pre
                            class="font-mono text-xs whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3 flex-1 overflow-auto"
                        >{#each linkifyS3Segments(payloadPretty) as seg}{#if seg.type === "link"}<a
                                    href={seg.href}
                                    class="text-primary underline"
                                    target="_blank"
                                    rel="noreferrer">{seg.label}</a
                                >{:else}{seg.value}{/if}{/each}</pre>
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
