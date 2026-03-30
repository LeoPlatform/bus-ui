<script lang="ts">
    import ListTree from "@lucide/svelte/icons/list-tree";
    import Button from "$lib/client/components/ui/button/button.svelte";
    import { Badge } from "$lib/client/components/ui/badge/index";
    import * as Tooltip from "$lib/client/components/ui/tooltip/index";
    import { getContext } from "svelte";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { NodeType, type CatalogNodeKind } from "$lib/types";
    import { getNodeTypeLink } from "$lib/utils";

    type CellProps = {
        id: string;
        name: string;
        tags?: string;
        kind: CatalogNodeKind;
    };

    let appState = getContext<AppState>("appState");
    let { id, name, tags, kind }: CellProps = $props();

    let tagsArr = $derived(
        tags
            ?.split(",")
            .map((t) => t.trim())
            .filter(Boolean) ?? [],
    );

    let iconSrc = $derived(
        getNodeTypeLink(
            kind === "queue"
                ? NodeType.Queue
                : kind === "system"
                  ? NodeType.System
                  : NodeType.Bot,
        ),
    );

    function goToRelationshipView(botId: string) {
        appState.navigateToRelationshipView(botId);
    }

    function goToDashboardView(logicalId: string) {
        appState.navigateToDashboardView(logicalId);
    }

    function callTriggerClick(props: Record<string, unknown>, e: MouseEvent) {
        const fn = props["onclick"];
        if (typeof fn === "function") {
            fn.call(e.currentTarget, e);
        }
    }
</script>

<div class="flex h-full min-h-0 min-w-0 items-stretch gap-3">
    <Tooltip.Provider>
        <Tooltip.Root>
            <Tooltip.Trigger>
                {#snippet child({ props })}
                    <Button
                        variant="ghost"
                        class="hover:bg-muted/80 flex h-full min-h-11 w-14 shrink-0 items-center justify-center rounded-md p-1 sm:w-16"
                        {...props}
                        aria-label="Open dashboard for {name || id}"
                        onclick={(e) => {
                            callTriggerClick(props as Record<string, unknown>, e);
                            goToDashboardView(id);
                        }}
                    >
                        <img src={iconSrc} alt="" class="max-h-full min-h-0 w-full object-contain" />
                    </Button>
                {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content side="top">dashboard</Tooltip.Content>
        </Tooltip.Root>
    </Tooltip.Provider>
    <div class="min-w-0 flex-1 flex flex-col gap-1">
        <div class="flex items-center justify-between gap-2 min-w-0">
            <div class="font-medium leading-tight truncate" title={id}>{name || id}</div>
            {#if kind === "bot"}
                <Tooltip.Provider>
                    <Tooltip.Root>
                        <Tooltip.Trigger>
                            {#snippet child({ props })}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    class="shrink-0 text-muted-foreground"
                                    {...props}
                                    aria-label="Open workflow tree"
                                    onclick={(e) => {
                                        callTriggerClick(props as Record<string, unknown>, e);
                                        goToRelationshipView(id);
                                    }}
                                >
                                    <ListTree class="size-5" />
                                </Button>
                            {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content side="top">relationship</Tooltip.Content>
                    </Tooltip.Root>
                </Tooltip.Provider>
            {/if}
        </div>
        {#if tagsArr.length > 0}
            <div class="flex flex-wrap gap-1">
                {#each tagsArr as tag (tag)}
                    <Badge variant="outline" class="text-[11px] font-normal leading-tight max-w-full truncate border-border/80 text-foreground/90">{tag}</Badge>
                {/each}
            </div>
        {/if}
    </div>
</div>
