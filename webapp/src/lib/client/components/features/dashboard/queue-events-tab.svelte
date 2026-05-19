<script lang="ts">
    import { goto } from "$app/navigation";
    import { getContext } from "svelte";
    import { base } from "$app/paths";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { QueueEventList, type StreamEvent } from "$lib/client/components/features/queue-event-list";

    let { id: queueId, initialEid }: { id: string; initialEid?: string } = $props();

    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;
    const timePicker = appState.timePickerState;

    let settings = $derived(compState.settings as { latest_write?: number; max_eid?: string } | undefined);

    function shareUrl(eid: string): string {
        const url = new URL(window.location.href);
        url.search = "";
        url.searchParams.set("tab", "events");
        url.searchParams.set("eid", eid);
        return url.toString();
    }

    function handleTrace(detail: StreamEvent) {
        if (!detail.eid) return;
        void goto(`${base}/trace?queue=${encodeURIComponent(queueId)}&eid=${encodeURIComponent(detail.eid)}`);
    }
</script>

<QueueEventList
    {queueId}
    {initialEid}
    searchAnchorTime={timePicker.endTime ?? undefined}
    getSchemaFn={(id) => compState.getSchema(id)}
    latestEid={settings?.max_eid}
    latestWriteMs={settings?.latest_write}
    onTrace={handleTrace}
    shareUrlFn={shareUrl}
/>
