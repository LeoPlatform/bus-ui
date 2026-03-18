<script lang="ts">
    import { getContext } from "svelte";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "$lib/client/components/ui/card/index";
    import { Label } from "$lib/client/components/ui/label/index";
    import { Input } from "$lib/client/components/ui/input/index";
    import { Button } from "$lib/client/components/ui/button/index";
    import * as Select from "$lib/client/components/ui/select/index";

    let { id }: { id: string } = $props();
    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;
    
    let settings = $derived(compState.settings);

    let systemType = $state<string>('Custom');
    let label = $state<string>('');
    let iconUrl = $state<string>('');

    $effect(() => {
        if (settings) {
            label = settings.label || '';
            iconUrl = settings.icon || '';
            systemType = settings.settings?.system || 'Custom';
        }
    });

    const systemTypes = [
        { value: 'Elastic Search', label: 'Elastic Search' },
        { value: 'CSV', label: 'CSV' },
        { value: 'MongoDB', label: 'MongoDB' },
        { value: 'LeoDW', label: 'LeoDW' },
        { value: 'Custom', label: 'Custom' }
    ];

    function saveSettings() {
        console.log('Saving system settings', { systemType, label, iconUrl });
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
        </CardContent>
        <CardFooter class="flex justify-end gap-2">
            <Button variant="outline" on:click={() => {
                label = settings?.label || '';
                iconUrl = settings?.icon || '';
                systemType = settings?.settings?.system || 'Custom';
            }}>Reset</Button>
            <Button on:click={saveSettings}>Save Settings</Button>
        </CardFooter>
    </Card>
</div>
