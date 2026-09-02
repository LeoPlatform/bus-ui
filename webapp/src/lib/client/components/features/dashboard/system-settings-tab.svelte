<script lang="ts">
    import { getContext } from "svelte";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "$lib/client/components/ui/card/index";
    import { Label } from "$lib/client/components/ui/label/index";
    import { Input } from "$lib/client/components/ui/input/index";
    import { Button } from "$lib/client/components/ui/button/index";
    import * as Select from "$lib/client/components/ui/select/index";
    import { systemSaveBlockedReason } from "./types";

    let { id }: { id: string } = $props();
    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;
    
    let settings = $derived(compState.settings);

    let systemType = $state<string>('Custom');
    let label = $state<string>('');
    let iconUrl = $state<string>('');
    let saving = $state(false);
    let saveError = $state<string | null>(null);
    let saveSuccess = $state(false);

    $effect(() => {
        if (settings) {
            label = (settings as any).label || '';
            iconUrl = (settings as any).icon || '';
            systemType = (settings as any).settings?.system || 'Custom';
        } else {
            // No settings loaded — blank the form rather than leaving the previous node's
            // values under this node's name (ES-4286). Save is blocked in this state too,
            // but the form should not misrepresent the record either way.
            label = '';
            iconUrl = '';
            systemType = 'Custom';
        }
    });

    const systemTypes = [
        { value: 'Elastic Search', label: 'Elastic Search' },
        { value: 'CSV', label: 'CSV' },
        { value: 'MongoDB', label: 'MongoDB' },
        { value: 'LeoDW', label: 'LeoDW' },
        { value: 'Custom', label: 'Custom' }
    ];

    let blockedReason = $derived(
        systemSaveBlockedReason({
            settingsError: compState.settingsError,
            systemType,
            originalType: (settings as any)?.settings?.system ?? 'Custom'
        })
    );

    async function saveSettings() {
        if (blockedReason) {
            saveError = blockedReason;
            return;
        }
        saving = true;
        saveError = null;
        saveSuccess = false;
        try {
            await compState.saveSettings({
                label,
                // An empty field means "unchanged", not "clear it" — the server skips nulls.
                icon: iconUrl.trim() || null,
                settings: { system: systemType },
            });
            saveSuccess = true;
            setTimeout(() => { saveSuccess = false; }, 3000);
        } catch (e: any) {
            saveError = e.message ?? 'Save failed';
        } finally {
            saving = false;
        }
    }

    function resetForm() {
        label = (settings as any)?.label || '';
        iconUrl = (settings as any)?.icon || '';
        systemType = (settings as any)?.settings?.system || 'Custom';
    }
</script>

<div class="space-y-4">
    <Card>
        <CardHeader>
            <CardTitle>System Settings</CardTitle>
            <CardDescription>Configure this system node.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
            <div class="grid gap-2">
                <Label for="systemType">System Type</Label>
                <Select.Root type="single" bind:value={systemType}>
                    <Select.Trigger class="w-full">
                        {systemType}
                    </Select.Trigger>
                    <Select.Content>
                        {#each systemTypes as type}
                            <Select.Item value={type.value}>{type.label}</Select.Item>
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>
            
            <div class="grid gap-2">
                <Label for="label">Label</Label>
                <Input id="label" bind:value={label} placeholder="System Label" />
            </div>

            <div class="grid gap-2">
                <Label for="iconUrl">Icon URL</Label>
                <Input id="iconUrl" bind:value={iconUrl} placeholder="Custom Icon URL" />
            </div>

            {#if blockedReason}
                <p class="text-sm text-destructive">{blockedReason}</p>
            {/if}
            {#if saveError && saveError !== blockedReason}
                <p class="text-sm text-destructive">{saveError}</p>
            {/if}
            {#if saveSuccess}
                <p class="text-sm text-green-500">Settings saved.</p>
            {/if}
        </CardContent>
        <CardFooter class="flex justify-end gap-2">
            <Button variant="outline" onclick={resetForm} disabled={saving}>Reset</Button>
            <Button onclick={saveSettings} disabled={saving || blockedReason !== null}>
                {saving ? 'Saving…' : 'Save Settings'}
            </Button>
        </CardFooter>
    </Card>
</div>
