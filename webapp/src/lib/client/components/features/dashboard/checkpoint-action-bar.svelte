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
        <div class="flex items-center justify-between bg-gray-100 p-3 rounded-lg border border-gray-200 shadow-sm">
            <!-- Left Side - Pause/Play Button -->
            <div class="flex items-center space-x-3 gap-2">
                <Button 
                    variant="default" 
                    size="sm" 
                    class="bg-blue-600 hover:bg-blue-700 text-white p-2 h-10 w-10"
                    onclick={handleTogglePause}
                >
                    {#if isPaused}
                        <Play class="h-5 w-5" />
                    {:else}
                        <Pause class="h-5 w-5" />
                    {/if}
                </Button>
                
                <!-- Lightning Bolt Icon -->
                <Zap class="h-5 w-5 text-blue-600 fill-blue-600" />
                
                <!-- Checkpoint ID -->
                {#if currentCheckpoint}
                    <CopyButton>{currentCheckpoint}</CopyButton>
                    <!-- <Badge variant="outline" class="bg-white text-blue-800 border-blue-300 font-mono text-sm px-3 py-1">
                        {currentCheckpoint}
                    </Badge> -->
                {:else}
                    <Badge variant="outline" class="bg-white text-blue-800 border-blue-300 font-mono text-sm px-3 py-1">
                        No checkpoint available
                    </Badge>
                {/if}
            </div>
            <Menubar.Root class="bg-gray-100">
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