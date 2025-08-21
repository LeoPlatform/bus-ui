<script lang="ts">
    import { getContext, onMount } from "svelte";
  import type { AppState } from "$lib/client/appstate.svelte";
  import { NodeType } from "$lib/types";
  import { type DashboardTab, DashboardTabType, parseDashboardTags } from "./types";
  import DashHeader from "./dash-header.svelte";

    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;

    type DashboardProps = {
        id: string;
    }

    let {id}: DashboardProps = $props();

    compState.id = id;

    let settings = $derived(compState.settings);
    let name = $derived(settings?.name);
    
    // Handle different dashboard types - only bots have checkpoints and tags
    let currentCheckpoint = $derived.by(() => {
        if (dashType === NodeType.Bot && settings?.checkpoints?.read) {
            const readCheckpoints = settings.checkpoints.read;
            if (typeof readCheckpoints === 'object') {
                // Get the first checkpoint from the record
                const firstKey = Object.keys(readCheckpoints)[0];
                if (firstKey) {
                    return readCheckpoints[firstKey]?.checkpoint;
                }
            }
        }
        return undefined;
    });
    
    // Only bots have lambda properties
    let lambdaName = $derived.by(() => {
        if (dashType === NodeType.Bot) {
            return settings?.lambdaName;
        }
        return undefined;
    });
    
    // Use default region for bots since it's not stored in settings
    let lambdaRegion = $derived.by(() => {
        if (dashType === NodeType.Bot) {
            return 'us-east-1'; // Default region
        }
        return undefined;
    });
    
    // Only bots have tags
    let tags = $derived.by(() => {
        if (dashType === NodeType.Bot && settings?.tags) {
            return parseDashboardTags(settings.tags);
        }
        return {};
    });

    let dashTypeVal: NodeType = NodeType.Bot;

    if (id.startsWith('queue:')) {
        dashTypeVal = NodeType.Queue;
    } else if (id.startsWith('system:')) {
        dashTypeVal = NodeType.System;
    }

    compState.dashType = dashTypeVal;

    let dashType = $derived(compState.dashType);
    let tabs = $derived(getTabs(dashType));

    function getTabs(dashType: NodeType): DashboardTab[] {
       switch(dashType) {
        case NodeType.Bot:
            return [
                {label: DashboardTabType.Dashboard},
                {label: DashboardTabType.Settings},
            ];
        case NodeType.Queue:
            return [
                {label: DashboardTabType.Dashboard},
                {label: DashboardTabType.Events},
                {label: DashboardTabType.Schema},
            ];
        case NodeType.System:
            return [
                {label: DashboardTabType.Dashboard},
            ];
        default:
            return [
                {label: DashboardTabType.Dashboard},
            ];
       }
    }

    onMount(async () => {
        try {
            await compState.getSettings();
        } catch (error) {
            console.error('Failed to load dashboard settings:', error);
            // Error is now handled in the state class
        }
    })

</script>

<div class="flex flex-col h-full"> 
    <!-- Header Section -->
    <div class="flex flex-row justify-between items-center w-full"> 
        <DashHeader name={name || id} id={id} type={dashType} currentCheckpoint={currentCheckpoint} lambdaName={lambdaName} lambdaRegion={lambdaRegion} tags={tags} />
    </div>
    
    <!-- Loading State -->
    <!-- {#if isLoading}
        <div class="flex items-center justify-center p-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span class="ml-2">Loading dashboard...</span>
        </div>
    {:else if error} -->
        <!-- Error State -->
        <!-- <div class="flex items-center justify-center p-8">
            <div class="text-red-600 text-center">
                <p class="font-semibold">Failed to load dashboard</p>
                <p class="text-sm text-gray-600">{error}</p>
                <button 
                    class="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    on:click={() => compState.getSettings()}
                >
                    Retry
                </button>
            </div>
        </div>
    {:else} -->
        <!-- Body Section -->
        <!-- <div class="flex-1 p-4"> -->
            <!-- Dashboard content will go here -->
            <!-- <p class="text-gray-500">Dashboard content coming soon...</p>
        </div>
    {/if} -->
</div>