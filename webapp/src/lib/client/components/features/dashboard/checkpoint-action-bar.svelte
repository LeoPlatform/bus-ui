<script lang="ts">
    import { Button } from "$ui/button";
    import { Badge } from "$ui/badge";
    import {
        Play,
        Pause,
        Zap,
        SlidersHorizontal
    } from "@lucide/svelte";
    import { getContext } from "svelte";
    import type { AppState } from "$client/appstate.svelte";
    import * as Menubar from "$ui/menubar";
    import * as Dialog from "$ui/dialog";
    import * as Select from "$ui/select";
    import { Label } from "$ui/label";
    import Input from "$ui/input/input.svelte";
    import CopyButton from "$comps/copy-button.svelte";

    type CheckpointActionBarProps = {
        currentCheckpoint?: string;
        isPaused?: boolean;
        disabled?: boolean;
    }
    const compState = getContext<AppState>("appState").dashboardState;

    let {currentCheckpoint, isPaused, disabled}: CheckpointActionBarProps = $props();

    // Force run state
    let forceRunning = $state(false);
    let forceRunError = $state<string | null>(null);

    // Checkpoint dialog state
    let checkpointDialogOpen = $state(false);
    let checkpointForceRun = $state(false);
    let checkpointSaving = $state(false);
    let checkpointError = $state<string | null>(null);

    // Checkpoint form state
    let selectedQueue = $state<string>("");
    let checkpointPreset = $state<string>("now");
    let customCheckpoint = $state("");

    // Read queues from settings for the source queue selector
    let readQueues = $derived.by(() => {
        const checkpoints = compState.settings?.checkpoints?.read;
        if (!checkpoints || typeof checkpoints !== 'object') return [];
        return Object.keys(checkpoints);
    });

    // Auto-select the first (or only) source queue
    $effect(() => {
        if (readQueues.length > 0 && !selectedQueue) {
            selectedQueue = readQueues[0];
        }
    });

    function handleTogglePause() {
        compState.togglePause();
    }

    function computeCheckpointValue(): string {
        switch (checkpointPreset) {
            case "now": {
                const d = new Date();
                const pad = (n: number) => String(n).padStart(2, '0');
                return `z/${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${pad(d.getUTCHours())}/${pad(d.getUTCMinutes())}/${pad(d.getUTCSeconds())}/`;
            }
            case "beginning":
                return "z/";
            case "custom":
                return customCheckpoint;
            default:
                return "";
        }
    }

    async function handleForceRun() {
        forceRunError = null;
        forceRunning = true;
        try {
            await compState.forceRun();
        } catch (e: any) {
            forceRunError = e.message;
        } finally {
            forceRunning = false;
        }
    }

    async function handleForceRunReally() {
        forceRunError = null;
        forceRunning = true;
        try {
            await compState.forceRunReally();
        } catch (e: any) {
            forceRunError = e.message;
        } finally {
            forceRunning = false;
        }
    }

    function openCheckpointDialog(withForceRun: boolean) {
        checkpointForceRun = withForceRun;
        checkpointError = null;
        checkpointSaving = false;
        checkpointPreset = "now";
        customCheckpoint = "";
        // Re-select first queue if none selected
        if (!selectedQueue && readQueues.length > 0) {
            selectedQueue = readQueues[0];
        }
        checkpointDialogOpen = true;
    }

    async function handleSaveCheckpoint() {
        if (!selectedQueue) {
            checkpointError = "Please select a source queue";
            return;
        }
        const value = computeCheckpointValue();
        if (checkpointPreset === "custom" && !value) {
            checkpointError = "Please enter a checkpoint value";
            return;
        }

        checkpointError = null;
        checkpointSaving = true;
        try {
            const checkpoint = { [selectedQueue]: value };
            if (checkpointForceRun) {
                await compState.changeCheckpointAndForceRun(checkpoint);
            } else {
                await compState.changeCheckpoint(checkpoint);
            }
            checkpointDialogOpen = false;
        } catch (e: any) {
            checkpointError = e.message;
        } finally {
            checkpointSaving = false;
        }
    }
</script>

{#if !disabled}
    <div class="flex flex-col w-full">
        <div class="flex items-center justify-between bg-muted/50 p-2 rounded-lg border shadow-sm">
            <!-- Left Side - Pause/Play Button -->
            <div class="flex items-center space-x-3 gap-2">
                <Button
                    variant="default"
                    size="sm"
                    class="bg-blue-600 hover:bg-blue-700 text-white p-2 h-9 w-9"
                    onclick={handleTogglePause}
                >
                    {#if isPaused}
                        <Play class="h-4 w-4" />
                    {:else}
                        <Pause class="h-4 w-4" />
                    {/if}
                </Button>

                <Zap class="h-4 w-4 text-blue-600 fill-blue-600" />

                {#if currentCheckpoint}
                    <CopyButton truncate={true} maxLength={50}>{currentCheckpoint}</CopyButton>
                {:else}
                    <Badge variant="outline" class="bg-background text-muted-foreground border-border font-mono text-sm px-3 py-1">
                        No checkpoint available
                    </Badge>
                {/if}
            </div>

            <Menubar.Root class="bg-transparent border-0">
                <Menubar.Menu>
                    <Menubar.Trigger><SlidersHorizontal class="w-4 h-4" /></Menubar.Trigger>
                    <Menubar.Content align="end">
                        <Menubar.Item onclick={() => openCheckpointDialog(false)}>
                            Change Checkpoint
                        </Menubar.Item>
                        <Menubar.Separator />
                        <Menubar.Item onclick={handleForceRun} disabled={forceRunning}>
                            {forceRunning ? 'Running...' : 'Force Run'}
                        </Menubar.Item>
                        <Menubar.Separator />
                        <Menubar.Item onclick={handleForceRunReally} disabled={forceRunning}>
                            {forceRunning ? 'Running...' : 'Force Run Really'}
                        </Menubar.Item>
                        <Menubar.Separator />
                        <Menubar.Item onclick={() => openCheckpointDialog(true)}>
                            Change Checkpoint and Force Run
                        </Menubar.Item>
                    </Menubar.Content>
                </Menubar.Menu>
            </Menubar.Root>

            {#if forceRunError}
                <span class="text-xs text-destructive ml-2">{forceRunError}</span>
            {/if}
        </div>
    </div>

    <!-- Change Checkpoint Dialog -->
    <Dialog.Root bind:open={checkpointDialogOpen}>
        <Dialog.Content class="sm:max-w-md">
            <Dialog.Header>
                <Dialog.Title>
                    {checkpointForceRun ? 'Change Checkpoint and Force Run' : 'Change Checkpoint'}
                </Dialog.Title>
                <Dialog.Description>
                    Set the read checkpoint for a source queue.
                    {#if checkpointForceRun}
                        The bot will be force-run after saving.
                    {/if}
                </Dialog.Description>
            </Dialog.Header>

            <div class="flex flex-col gap-4 py-4">
                <!-- Source Queue Selector -->
                <div class="flex flex-col gap-2">
                    <Label>Source Queue</Label>
                    {#if readQueues.length === 0}
                        <p class="text-sm text-muted-foreground">No read queues found in checkpoints.</p>
                    {:else if readQueues.length === 1}
                        <Badge variant="outline" class="font-mono text-sm w-fit">{readQueues[0]}</Badge>
                    {:else}
                        <Select.Root type="single" bind:value={selectedQueue}>
                            <Select.Trigger class="w-full">
                                {selectedQueue || 'Select a queue...'}
                            </Select.Trigger>
                            <Select.Content>
                                {#each readQueues as queue}
                                    <Select.Item value={queue}>{queue}</Select.Item>
                                {/each}
                            </Select.Content>
                        </Select.Root>
                    {/if}
                </div>

                <!-- Checkpoint Preset -->
                <div class="flex flex-col gap-2">
                    <Label>Checkpoint</Label>
                    <Select.Root type="single" bind:value={checkpointPreset}>
                        <Select.Trigger class="w-full">
                            {#if checkpointPreset === 'now'}
                                Start from Now
                            {:else if checkpointPreset === 'beginning'}
                                From the Beginning of Time
                            {:else}
                                Custom Value
                            {/if}
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="now">Start from Now</Select.Item>
                            <Select.Item value="beginning">From the Beginning of Time</Select.Item>
                            <Select.Item value="custom">Custom Value</Select.Item>
                        </Select.Content>
                    </Select.Root>
                </div>

                <!-- Custom Checkpoint Input -->
                {#if checkpointPreset === 'custom'}
                    <div class="flex flex-col gap-2">
                        <Label>Custom Checkpoint Value</Label>
                        <Input
                            bind:value={customCheckpoint}
                            placeholder="z/2026/04/14/10/30/45/"
                            class="font-mono text-sm"
                        />
                        <p class="text-xs text-muted-foreground">
                            Format: z/YYYY/MM/DD/HH/mm/ss/ (UTC) or paste a z-token
                        </p>
                    </div>
                {/if}

                {#if checkpointError}
                    <p class="text-sm text-destructive">{checkpointError}</p>
                {/if}
            </div>

            <Dialog.Footer>
                <Button variant="outline" onclick={() => checkpointDialogOpen = false}>Cancel</Button>
                <Button onclick={handleSaveCheckpoint} disabled={checkpointSaving}>
                    {checkpointSaving ? 'Saving...' : 'Save'}
                </Button>
            </Dialog.Footer>
        </Dialog.Content>
    </Dialog.Root>
{/if}
