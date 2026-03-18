<script lang="ts">
    import { Button } from "$ui/button";
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "$ui/dropdown-menu";
    import { Badge } from "$ui/badge";
    import { 
        Play, 
        Pause, 
        Zap, 
        Settings, 
        ChevronDown,
        Copy,
        RotateCcw,
        RotateCcwSquare,
        Calendar,

        PencilRuler,

        SlidersHorizontal


    } from "@lucide/svelte";
  import { getContext } from "svelte";
  import type { AppState } from "$client/appstate.svelte";
  import * as Menubar from "$ui/menubar";
    import CopyButton from "$comps/copy-button.svelte";

    type CheckpointActionBarProps = {
        currentCheckpoint?: string;
        isPaused?: boolean;
        disabled?: boolean;
    }
    const compState = getContext<AppState>("appState").dashboardState;

    let {currentCheckpoint, isPaused, disabled}: CheckpointActionBarProps = $props();

    let isDropdownOpen = $state(false);

    function handleTogglePause() {
       compState.togglePause();
    }

    function handleChangeCheckpoint() {
        
    }

    function handleCopyCheckpoint() {
       
    }

    function handleForceRun() {
        
    }

    function handleForceRunReally() {
        
    }
</script>

{#if !disabled}

    <div class="flex flex-col w-full">
        <!-- Header Bar -->
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
                
                <!-- Lightning Bolt Icon -->
                <Zap class="h-4 w-4 text-blue-600 fill-blue-600" />
                
                <!-- Checkpoint ID -->
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
                        <Menubar.Item>
                            Change Checkpoint
                        </Menubar.Item>
                        <Menubar.Separator />
                        <Menubar.Item>
                            Force Run
                        </Menubar.Item>
                        <Menubar.Separator />
                        <Menubar.Item>
                            Force Run Really
                        </Menubar.Item>
                        <Menubar.Separator />
                        <Menubar.Item>
                            Rerun Range of Events
                        </Menubar.Item>
                    </Menubar.Content>
                </Menubar.Menu>
    
            </Menubar.Root>
            
        </div>
    </div>
{/if}