<script lang="ts">
    import { getContext } from "svelte";
    import { base } from "$app/paths";
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

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 pb-8 pt-2 sm:px-4">
    <header class="border-b border-border/50 pb-6">
        <div class="flex items-start gap-3">
            <div
                class="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/40"
            >
                <GitBranch class="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <div class="min-w-0 space-y-1">
                <h1 class="text-2xl font-semibold tracking-tight text-foreground">Workflows</h1>
                <p class="text-sm text-muted-foreground">
                    Open the relationship view for a bot. You can also start from the home catalog.
                </p>
            </div>
        </div>
    </header>

    <div class="flex flex-col gap-6">
        <Card class="shadow-sm">
            <CardHeader class="space-y-1.5 pb-4">
                <CardTitle class="text-lg">Quick start</CardTitle>
                <CardDescription>
                    Jump to the home catalog, then use the <span class="font-medium text-foreground/80">relationship</span>
                    icon on a bot row.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button href="{base}/" variant="default">Go to home / catalog</Button>
            </CardContent>
        </Card>

        <Card class="shadow-sm">
            <CardHeader class="space-y-1.5 pb-4">
                <CardTitle class="text-lg">Recent bots</CardTitle>
                <CardDescription>
                    Non-archived bots from the last relationship scan (same data as global search).
                </CardDescription>
            </CardHeader>
            <CardContent>
                {#if bots.length === 0}
                    <p class="text-sm text-muted-foreground">
                        No bots loaded yet. Open home first or refresh the page.
                    </p>
                {:else}
                    <ul class="space-y-2">
                        {#each bots.slice(0, 25) as bot (bot.id)}
                            <li
                                class="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50"
                            >
                                <span class="truncate font-mono text-sm text-foreground" title={bot.id}>
                                    {bot.name ?? bot.id}
                                </span>
                                <Button
                                    href={workflowHref(bot.id)}
                                    variant="outline"
                                    size="sm"
                                    class="shrink-0 gap-1.5"
                                >
                                    <ListTree class="size-4" aria-hidden="true" />
                                    Open workflow
                                </Button>
                            </li>
                        {/each}
                    </ul>
                    {#if bots.length > 25}
                        <p class="mt-4 text-xs text-muted-foreground">
                            Showing 25 of {bots.length}. Filter or search from home.
                        </p>
                    {/if}
                {/if}
            </CardContent>
        </Card>
    </div>
</div>
