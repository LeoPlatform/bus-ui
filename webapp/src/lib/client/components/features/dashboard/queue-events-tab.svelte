<script lang="ts">
    import { getContext } from "svelte";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/client/components/ui/card/index";

    let { id }: { id: string } = $props();
    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;
    
    let settings = $derived(compState.settings);
</script>

<div class="space-y-4">
    <Card>
        <CardHeader>
            <CardTitle>Event Viewer</CardTitle>
            <CardDescription>View and search events in this queue.</CardDescription>
        </CardHeader>
        <CardContent>
            <div class="flex items-center justify-center p-8 border rounded-md bg-muted/50">
                <p class="text-muted-foreground">Event viewer functionality coming soon...</p>
            </div>
        </CardContent>
    </Card>
</div>
