<script lang="ts">
    import * as Tabs from '$lib/client/components/ui/tabs/index';
    import TraceLineage from '$lib/client/components/features/trace/trace-lineage.svelte';
    import TraceFanoutTree from '$lib/client/components/features/trace/trace-fanout-tree.svelte';

    type TraceNode = Record<string, unknown>;

    let {
        parents = [],
        event = null,
        children = {},
    }: {
        parents?: TraceNode[];
        event?: TraceNode | null;
        children?: Record<string, TraceNode>;
    } = $props();

    let tab = $state('tree');
</script>

<div class="flex min-h-0 min-w-0 flex-col gap-3">
    <Tabs.Root bind:value={tab} class="flex min-h-0 min-w-0 flex-col gap-3">
        <Tabs.List>
            <Tabs.Trigger value="tree">Tree</Tabs.Trigger>
            <Tabs.Trigger value="rail">Rail</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="tree" class="min-h-0 min-w-0">
            <TraceFanoutTree {parents} {event} {children} />
        </Tabs.Content>

        <Tabs.Content value="rail" class="min-h-0 min-w-0">
            <TraceLineage {parents} {event} {children} hideExplainer />
        </Tabs.Content>
    </Tabs.Root>
</div>
