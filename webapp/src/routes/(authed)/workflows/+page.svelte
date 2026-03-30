<script lang="ts">
    import { getContext } from "svelte";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { Button } from "$lib/client/components/ui/button/index";
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle,
    } from "$lib/client/components/ui/card/index";
    import GitBranch from "@lucide/svelte/icons/git-branch";
    import ListTree from "@lucide/svelte/icons/list-tree";

    const appState = getContext<AppState>("appState");

    let bots = $derived(
        appState.botState.botSettings.filter((b) => !b.archived),
    );

    /** Match `AppState.navigateToRelationshipView` (slashes in id become extra path segments for `[...botId]`). */
    function workflowHref(botId: string): string {
        return `/workflows/${botId}`;
    }
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:max-w-5xl">
    <div class="flex items-center gap-3">
        <GitBranch class="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <div>
            <h1 class="text-2xl font-semibold tracking-tight">Workflows</h1>
            <p class="text-muted-foreground text-sm">
                Open the relationship view for a bot. You can also start from the home bot table.
            </p>
        </div>
    </div>

    <Card>
        <CardHeader>
            <CardTitle>Quick start</CardTitle>
            <CardDescription>Jump to the dashboard bot list, then use the tree icon on a row.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button href="/" variant="default">Go to home / bot table</Button>
        </CardContent>
    </Card>

    <Card>
        <CardHeader>
            <CardTitle>Recent bots</CardTitle>
            <CardDescription>Non-archived bots from the last relationship scan (same data as search).</CardDescription>
        </CardHeader>
        <CardContent>
            {#if bots.length === 0}
                <p class="text-sm text-muted-foreground">No bots loaded yet. Open home first or refresh.</p>
            {:else}
                <ul class="space-y-2">
                    {#each bots.slice(0, 25) as bot (bot.id)}
                        <li class="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
                            <span class="font-mono text-sm truncate" title={bot.id}>{bot.name ?? bot.id}</span>
                            <Button href={workflowHref(bot.id)} variant="outline" size="sm" class="shrink-0 gap-1">
                                <ListTree class="h-4 w-4" aria-hidden="true" />
                                Open workflow
                            </Button>
                        </li>
                    {/each}
                </ul>
                {#if bots.length > 25}
                    <p class="text-xs text-muted-foreground mt-3">Showing 25 of {bots.length}. Filter from home.</p>
                {/if}
            {/if}
        </CardContent>
    </Card>
</div>
