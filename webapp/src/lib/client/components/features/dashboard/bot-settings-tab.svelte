<script lang="ts">
    import { getContext } from "svelte";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "$lib/client/components/ui/card/index";
    import { Label } from "$lib/client/components/ui/label/index";
    import { Input } from "$lib/client/components/ui/input/index";
    import { Button } from "$lib/client/components/ui/button/index";

    let { id }: { id: string } = $props();
    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;

    let settings = $derived(compState.settings);

    // Local editable state for health overrides
    let sourceLag = $state<string>('');
    let writeLag = $state<string>('');
    let errorLimit = $state<string>('');
    let consecutiveErrors = $state<string>('');

    let saving = $state(false);
    let saveError = $state<string | null>(null);
    let saveSuccess = $state(false);

    $effect(() => {
        if (settings?.health) {
            sourceLag = settings.health.source_lag != null ? String(settings.health.source_lag / 60 / 1000) : '';
            writeLag = settings.health.write_lag != null ? String(settings.health.write_lag / 60 / 1000) : '';
            errorLimit = settings.health.error_limit != null ? String(settings.health.error_limit * 100) : '';
            consecutiveErrors = settings.health.consecutive_errors != null ? String(settings.health.consecutive_errors) : '';
        }
    });

    function parseHealthValue(val: string): number | null {
        const n = parseFloat(val);
        return isNaN(n) ? null : n;
    }

    async function saveOverrides() {
        saving = true;
        saveError = null;
        saveSuccess = false;
        try {
            const sourceLagMs = sourceLag ? parseHealthValue(sourceLag)! * 60 * 1000 : null;
            const writeLagMs = writeLag ? parseHealthValue(writeLag)! * 60 * 1000 : null;
            const errorLimitFrac = errorLimit ? parseHealthValue(errorLimit)! / 100 : null;
            const consecErr = consecutiveErrors ? parseHealthValue(consecutiveErrors) : null;

            await compState.saveSettings({
                health: {
                    ...(sourceLagMs !== null ? { source_lag: sourceLagMs } : {}),
                    ...(writeLagMs !== null ? { write_lag: writeLagMs } : {}),
                    ...(errorLimitFrac !== null ? { error_limit: errorLimitFrac } : {}),
                    ...(consecErr !== null ? { consecutive_errors: consecErr } : {}),
                }
            });
            saveSuccess = true;
            setTimeout(() => { saveSuccess = false; }, 3000);
        } catch (e: any) {
            saveError = e.message ?? 'Save failed';
        } finally {
            saving = false;
        }
    }

    function resetOverrides() {
        sourceLag = '';
        writeLag = '';
        errorLimit = '';
        consecutiveErrors = '';
    }

    async function toggleArchive() {
        saving = true;
        saveError = null;
        try {
            const archived = !settings?.archived;
            await compState.saveSettings({ archived, paused: archived });
        } catch (e: any) {
            saveError = e.message ?? 'Archive failed';
        } finally {
            saving = false;
        }
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
            {#if saveError}
                <p class="text-sm text-destructive">{saveError}</p>
            {/if}
            {#if saveSuccess}
                <p class="text-sm text-green-500">Settings saved.</p>
            {/if}
        </CardContent>
        <CardFooter class="flex justify-end gap-2">
            <Button variant="outline" onclick={resetOverrides} disabled={saving}>Reset</Button>
            <Button onclick={saveOverrides} disabled={saving}>
                {saving ? 'Saving…' : 'Save Overrides'}
            </Button>
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
                    <Label>{settings?.archived ? 'Unarchive Bot' : 'Archive Bot'}</Label>
                    <p class="text-sm text-muted-foreground">
                        {settings?.archived
                            ? 'This bot is currently archived. Unarchive to restore it to the active view.'
                            : 'Archiving a bot hides it from the default view and pauses it.'}
                    </p>
                </div>
                <Button
                    variant={settings?.archived ? "default" : "destructive"}
                    onclick={toggleArchive}
                    disabled={saving}
                >
                    {settings?.archived ? 'Unarchive' : 'Archive'}
                </Button>
            </div>
        </CardContent>
    </Card>
</div>
