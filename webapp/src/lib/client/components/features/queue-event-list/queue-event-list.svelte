<script lang="ts">
    import { onDestroy, untrack } from "svelte";
    import { base } from "$app/paths";
    import { Button } from "$lib/client/components/ui/button/index";
    import { Input } from "$lib/client/components/ui/input/index";
    import * as Table from "$lib/client/components/ui/table/index";
    import { Switch } from "$lib/client/components/ui/switch/index";
    import * as Dialog from "$lib/client/components/ui/dialog/index";
    import Ajv from "ajv";
    import addFormats from "ajv-formats";
    import X from "@lucide/svelte/icons/x";
    import ChevronsRight from "@lucide/svelte/icons/chevrons-right";
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

    export type StreamEvent = {
        id?: string;
        eid?: string;
        timestamp?: number;
        event_source_timestamp?: number;
        event?: string;
        payload?: Record<string, unknown>;
        version?: string;
        correlation_id?: string;
        is_valid?: boolean | null;
        validation_errors?: string[];
        [key: string]: unknown; // preserve extra fields (e.g. errorMessage on DLQ events)
    };

    type QueueEventListProps = {
        queueId: string;
        initialEid?: string;
        /** Right edge of the search time window (ms). Changing this triggers a re-fetch. Defaults to Date.now(). */
        searchAnchorTime?: number;
        /** Optional schema fetcher for AJV payload validation. */
        getSchemaFn?: (id: string) => Promise<Record<string, unknown> | null>;
        /** EID of the most recent event — enables "Jump to latest" button. */
        latestEid?: string;
        /** Timestamp (ms) of the most recent write — fallback for "Jump to latest". */
        latestWriteMs?: number;
        /** Called when user clicks the trace (⚡) button. If omitted, trace button is hidden. */
        onTrace?: (ev: StreamEvent) => void;
        /** Called when user clicks the replay button. If omitted, a stub dialog is shown. */
        onReplay?: (ev: StreamEvent) => void;
        /** Called when a row is selected (clicked or arrow-key navigated). */
        onEventSelect?: (ev: StreamEvent, index: number) => void;
        /** Returns the URL to copy for the share button. If omitted, share button is hidden. */
        shareUrlFn?: (eid: string) => string;
        /** Show the copy-EID button per row. Defaults to true. */
        showCopyEid?: boolean;
        /** Show the replay button per row. Defaults to true. */
        showReplay?: boolean;
        /** Focus the list region on mount (e.g. after queue selection). Defaults to false. */
        autofocus?: boolean;
    };

    let {
        queueId,
        initialEid,
        searchAnchorTime,
        getSchemaFn,
        latestEid,
        latestWriteMs,
        onTrace,
        onReplay,
        onEventSelect,
        shareUrlFn,
        showCopyEid = true,
        showReplay = true,
        autofocus = false,
    }: QueueEventListProps = $props();

    let rootEl = $state<HTMLElement>();

    $effect(() => {
        if (autofocus && rootEl) rootEl.focus();
    });

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
    let stubReplayOpen = $state(false);
    let stubReplayDetail = $state<StreamEvent | null>(null);
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
        if (!shareUrlFn) return;
        navigator.clipboard.writeText(shareUrlFn(eid));
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
        if (!q || !getSchemaFn) return;

        let cancelled = false;
        (async () => {
            try {
                const s = await getSchemaFn(q);
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

        return () => { cancelled = true; };
    });

    async function fetchSearchPage(token: string, pathSearch: string, agg: unknown, signal: AbortSignal) {
        const u = new URL(`${base}/api/queue/event-search`, window.location.origin);
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

                if (attempts >= 6) { resumptionToken = nextTok; isSearching = false; break; }
                if (returnedInBatch >= 40) { resumptionToken = nextTok; isSearching = false; break; }
                if (!nextTok) { resumptionToken = null; isSearching = false; break; }

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

    function anchorMs(): number {
        return searchAnchorTime ?? Date.now();
    }

    function tokenFromTimeFrame(): string {
        return buildZTokenFromUtcMs(anchorMs() - DURATION_MS[activeTimeFrame]);
    }

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

    function jumpToMostRecent() {
        if (latestEid) {
            const parts = latestEid.split('/');
            const ts = parts.length >= 7 ? parseInt(parts[6].split('-')[0], 10) : NaN;
            if (!isNaN(ts)) {
                startPayloadSearch(buildZTokenFromUtcMs(ts - DURATION_MS[activeTimeFrame]));
                return;
            }
        }
        if (latestWriteMs) {
            startPayloadSearch(buildZTokenFromUtcMs(latestWriteMs - DURATION_MS[activeTimeFrame]));
        }
    }

    function onSearchKeydown(e: KeyboardEvent) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const raw = searchText.trim();
        const m = raw.match(/(z\/.*?)(?:$|\s)/);
        if (m) {
            const tok = trimEidToken(normalizeIsoZToken(m[1].replace(/\s/g, "")));
            startPayloadSearch(tok);
        } else {
            startPayloadSearch();
        }
    }

    function onTableKeydown(e: KeyboardEvent) {
        if (!events.length) return;
        const root = e.currentTarget as HTMLElement;
        if (e.key === "ArrowUp") {
            e.preventDefault();
            selectRow(Math.max(0, eventIndex - 1));
            root.focus();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            selectRow(Math.min(events.length - 1, eventIndex + 1));
            root.focus();
        } else if (e.key === "Enter") {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "TEXTAREA") return;
            e.preventDefault();
            const ev = events[eventIndex];
            if (ev) onTrace?.(ev);
        }
    }

    function selectRow(index: number) {
        eventIndex = index;
        const ev = events[index];
        if (ev) onEventSelect?.(ev, index);
    }

    function handleReplay(detail: StreamEvent) {
        if (onReplay) {
            onReplay(detail);
        } else {
            stubReplayDetail = detail;
            stubReplayOpen = true;
        }
    }

    function openValidate(detail: StreamEvent) {
        if (!payloadValidate) return;
        if (detail.is_valid == null) validateEventsInPlace([detail]);
        const ok = detail.is_valid === true;
        validateTone = ok ? "info" : "error";
        validateTitle = `${ok ? "Valid" : "Errors"} — ${detail.eid ?? "event"}`;
        validateBody = ok ? "No validation errors" : (detail.validation_errors ?? []).join("\n");
        validateDialogOpen = true;
    }

    let selected = $derived(events[eventIndex] ?? null);

    let payloadPretty = $derived.by(() => {
        if (!selected) return "";
        try { return JSON.stringify(selected, null, 4); } catch { return String(selected); }
    });

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
        for (const m of payloadPretty.matchAll(/s3:\/\/(.*?)\/(.*?\/z\/[^\s"]+)/g)) addLink(m[1], m[2], m[0]);
        for (const m of payloadPretty.matchAll(/"[Bb]ucket":\s*"(.*?)",\s*"[Kk]ey":\s*"(.*?\/z\/.*?)"/g)) addLink(m[1], m[2], `s3://${m[1]}/${m[2]}`);
        return found;
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

    let aggDisplay = $derived.by((): [string, unknown][] | null => {
        if (aggState == null || typeof aggState !== 'object') return null;
        const entries = Object.entries(aggState as Record<string, unknown>);
        return entries.length > 0 ? entries : null;
    });

    let statusLine = $derived.by(() => {
        if (!(resumptionToken || isSearching) || !searchEndTime) return "";
        const t = new Date(searchEndTime).toLocaleString(undefined, {
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit",
        });
        return `Looked through ${searchedEventsCount} events until ${t}`;
    });

    // Re-fetch when queueId or searchAnchorTime changes.
    $effect(() => {
        const id = queueId;
        if (!id) return;

        // Reactive dep: caller-controlled time anchor (e.g. dashboard time picker).
        void searchAnchorTime;

        cancelSearch();
        abortCtrl = new AbortController();
        const signal = abortCtrl.signal;

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
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div bind:this={rootEl} class="flex flex-col gap-4 flex-1 min-h-0 outline-none" onkeydown={onTableKeydown} tabindex="0" role="region">
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
                                onclick={() => selectRow(index)}
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
                                            {#if showCopyEid}
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
                                            {/if}
                                            {#if shareUrlFn}
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
                                            {#if onTrace}
                                                <button
                                                    type="button"
                                                    class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                                    title="Trace event lineage"
                                                    onclick={(e) => { e.stopPropagation(); onTrace(detail); }}
                                                >
                                                    <Zap class="h-4 w-4" />
                                                </button>
                                            {/if}
                                        {/if}
                                        {#if showReplay}
                                            <button
                                                type="button"
                                                class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                                title="Replay"
                                                onclick={(e) => { e.stopPropagation(); handleReplay(detail); }}
                                            >
                                                <RotateCcw class="h-4 w-4" />
                                            </button>
                                        {/if}
                                        {#if payloadValidate}
                                            <button
                                                type="button"
                                                class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                                title="Validate"
                                                onclick={(e) => { e.stopPropagation(); openValidate(detail); }}
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
                                        {#if statusLine}{statusLine}<span> and </span>{/if}
                                        searching <Loader2 class="h-4 w-4 animate-spin" />
                                    </span>
                                {:else if resumptionToken}
                                    {#if statusLine}<div class="mb-2">{statusLine}</div>{/if}
                                    <Button variant="secondary" size="sm" onclick={() => resumeSearch()}>Continue</Button>
                                {:else if events.length}
                                    <div>No more events found</div>
                                {:else}
                                    <div>No events found</div>
                                    {#if latestEid || latestWriteMs}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="mt-2 text-xs px-2 gap-1"
                                            title="Jump to most recent events"
                                            onclick={jumpToMostRecent}
                                        >
                                            <ChevronsRight class="h-3 w-3" />
                                            Jump to latest events
                                        </Button>
                                    {/if}
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
            <div class="flex flex-col flex-1 overflow-auto p-3 min-h-0 gap-3">
                {#if selected}
                    {#if oldNewPair}
                        <div class="flex items-center gap-2 text-sm shrink-0">
                            <Switch bind:checked={showOldNewDiff} id="old-new-diff" />
                            <label for="old-new-diff" class="cursor-pointer">Old / new diff</label>
                        </div>
                    {/if}
                    {#if showOldNewDiff && oldNewPair}
                        <DiffCodeView oldObj={oldNewPair.old} newObj={oldNewPair.new} />
                    {:else}
                        <CodeView code={payloadPretty} lang="json" />
                    {/if}
                    {#if s3Links.length > 0}
                        <div class="shrink-0 border-t border-border pt-2">
                            <p class="mb-1 text-xs font-semibold text-muted-foreground">S3 References</p>
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
                {:else}
                    <p class="text-sm text-muted-foreground">Select an event row.</p>
                {/if}
            </div>
        </div>
    </div>
</div>

<!-- Stub replay dialog (shown when no onReplay callback is provided) -->
<Dialog.Root bind:open={stubReplayOpen}>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title>Replay</Dialog.Title>
            <Dialog.Description>Event replay is not implemented in this app yet.</Dialog.Description>
        </Dialog.Header>
        {#if stubReplayDetail}
            <pre class="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs font-mono">{JSON.stringify(stubReplayDetail, null, 2)}</pre>
        {/if}
        <Dialog.Footer>
            <Button variant="secondary" onclick={() => (stubReplayOpen = false)}>Close</Button>
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
