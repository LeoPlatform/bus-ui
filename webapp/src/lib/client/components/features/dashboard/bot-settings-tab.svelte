<script lang="ts">
    import { getContext } from "svelte";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "$lib/client/components/ui/card/index";
    import { Label } from "$lib/client/components/ui/label/index";
    import { Input } from "$lib/client/components/ui/input/index";
    import { Button } from "$lib/client/components/ui/button/index";
    import { Switch } from "$lib/client/components/ui/switch/index";

    let { id }: { id: string } = $props();
    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;
    
    let settings = $derived(compState.settings);

    // Local state for overrides
    let sourceLag = $state<string>('');
    let writeLag = $state<string>('');
    let errorLimit = $state<string>('');
    let consecutiveErrors = $state<string>('');
    let isArchived = $state<boolean>(false);

    $effect(() => {
        if (settings?.health) {
            sourceLag = settings.health.source_lag ? String(settings.health.source_lag / 60 / 1000) : '';
            writeLag = settings.health.write_lag ? String(settings.health.write_lag / 60 / 1000) : '';
            errorLimit = settings.health.error_limit ? String(settings.health.error_limit * 100) : '';
            consecutiveErrors = settings.health.consecutive_errors ? String(settings.health.consecutive_errors) : '';
        }
        if (settings?.archived !== undefined) {
            isArchived = settings.archived;
        }
    });

    function saveOverrides() {
        // TODO: Implement save logic
        console.log('Saving overrides', { sourceLag, writeLag, errorLimit, consecutiveErrors });
    }

    function toggleArchive() {
        // TODO: Implement archive logic
        isArchived = !isArchived;
        console.log('Toggling archive', { isArchived });
    }
</script>

<div class="space-y-4">
    <Card>
        <CardHeader>
            <CardTitle>Health Overrides</CardTitle>
            <CardDescription>Override default health check thresholds for this bot.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
            <div class="grid gap-2">
                <Label for="sourceLag">Source Lag (minutes)</Label>
                <Input id="sourceLag" type="number" bind:value={sourceLag} placeholder="Default" />
            </div>
            <div class="grid gap-2">
                <Label for="writeLag">Write Lag (minutes)</Label>
                <Input id="writeLag" type="number" bind:value={writeLag} placeholder="Default" />
            </div>
            <div class="grid gap-2">
                <Label for="errorLimit">Error Limit (%)</Label>
                <Input id="errorLimit" type="number" bind:value={errorLimit} placeholder="Default" />
            </div>
            <div class="grid gap-2">
                <Label for="consecutiveErrors">Consecutive Errors</Label>
                <Input id="consecutiveErrors" type="number" bind:value={consecutiveErrors} placeholder="Default" />
            </div>
        </CardContent>
        <CardFooter class="flex justify-end gap-2">
            <Button variant="outline" on:click={() => {
                sourceLag = '';
                writeLag = '';
                errorLimit = '';
                consecutiveErrors = '';
            }}>Reset</Button>
            <Button on:click={saveOverrides}>Save Overrides</Button>
        </CardFooter>
    </Card>

    <Card class="border-destructive">
        <CardHeader>
            <CardTitle class="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Destructive actions for this bot.</CardDescription>
        </CardHeader>
        <CardContent>
            <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                    <Label>Archive Bot</Label>
                    <p class="text-sm text-muted-foreground">
                        Archiving a bot hides it from the default view.
                    </p>
                </div>
                <Button variant={isArchived ? "default" : "destructive"} on:click={toggleArchive}>
                    {isArchived ? 'Unarchive Bot' : 'Archive Bot'}
                </Button>
            </div>
        </CardContent>
    </Card>
</div>
