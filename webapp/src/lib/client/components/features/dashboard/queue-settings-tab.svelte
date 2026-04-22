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

    let settings = $derived(compState.settings as Record<string, unknown> | undefined);

    let displayName = $state("");
    let tags = $state("");
    let minKinesis = $state("");
    let saving = $state(false);
    let saveError = $state<string | null>(null);
    let saveSuccess = $state(false);

    $effect(() => {
        if (!settings) return;
        displayName = (settings.name as string) || "";
        const other = settings.other as { tags?: string } | undefined;
        tags = other?.tags ?? "";
        const min = settings.min_kinesis_number;
        minKinesis = min != null ? String(min) : "";
    });

    async function saveQueueInfo() {
        saving = true;
        saveError = null;
        saveSuccess = false;
        try {
            const minVal = minKinesis.trim();
            await compState.saveSettings({
                name: displayName.trim() || undefined,
                min_kinesis_number: minVal ? minVal : null,
                other: { tags: tags.trim() || null },
            });
            saveSuccess = true;
            setTimeout(() => {
                saveSuccess = false;
            }, 3000);
        } catch (e: unknown) {
            saveError = e instanceof Error ? e.message : "Save failed";
        } finally {
            saving = false;
        }
    }

    function resetForm() {
        if (!settings) return;
        displayName = (settings.name as string) || "";
        const other = settings.other as { tags?: string } | undefined;
        tags = other?.tags ?? "";
        const min = settings.min_kinesis_number;
        minKinesis = min != null ? String(min) : "";
    }

    async function toggleArchive() {
        saving = true;
        saveError = null;
        try {
            const archived = !settings?.archived;
            await compState.saveSettings({ archived, paused: archived });
        } catch (e: unknown) {
            saveError = e instanceof Error ? e.message : "Archive failed";
        } finally {
            saving = false;
        }
    }
</script>

<div class="space-y-4">
    <Card>
        <CardHeader>
            <CardTitle>Queue settings</CardTitle>
            <CardDescription>
                Display name, tags, and minimum stream position (Leo event table). Matches legacy event settings.
            </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
            <div class="grid gap-2">
                <Label for="qname">Name</Label>
                <Input id="qname" bind:value={displayName} placeholder="Display name" />
            </div>
            <div class="grid gap-2">
                <Label for="qtags">Tags</Label>
                <Input id="qtags" bind:value={tags} placeholder="e.g. app:my-service,team:platform" />
            </div>
            <div class="grid gap-2">
                <Label for="qmin">Min (min_kinesis_number)</Label>
                <Input id="qmin" bind:value={minKinesis} placeholder="Optional stream position" />
            </div>
            <div class="grid gap-2">
                <Label>Queue id</Label>
                <p class="text-sm text-muted-foreground font-mono break-all">{id}</p>
            </div>
            {#if saveError}
                <p class="text-sm text-destructive">{saveError}</p>
            {/if}
            {#if saveSuccess}
                <p class="text-sm text-green-500">Settings saved.</p>
            {/if}
        </CardContent>
        <CardFooter class="flex justify-end gap-2">
            <Button variant="outline" onclick={resetForm} disabled={saving}>Reset</Button>
            <Button onclick={saveQueueInfo} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
            </Button>
        </CardFooter>
    </Card>

    <Card class="border-destructive">
        <CardHeader>
            <CardTitle class="text-destructive">Danger zone</CardTitle>
            <CardDescription>Archive hides the queue from default views and pauses it.</CardDescription>
        </CardHeader>
        <CardContent>
            <div class="flex items-center justify-between gap-4">
                <p class="text-sm text-muted-foreground">
                    {settings?.archived
                        ? "This queue is archived."
                        : "Archive this queue to pause and hide it from default views."}
                </p>
                <Button
                    variant={settings?.archived ? "default" : "destructive"}
                    onclick={toggleArchive}
                    disabled={saving}
                >
                    {settings?.archived ? "Unarchive" : "Archive"}
                </Button>
            </div>
        </CardContent>
    </Card>
</div>
