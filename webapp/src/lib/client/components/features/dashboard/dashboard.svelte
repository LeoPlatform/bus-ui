<script lang="ts">
    import { getContext } from "svelte";
  import type { AppState } from "$lib/client/appstate.svelte";
  import { NodeType } from "$lib/types";
  import { type DashboardTab, DashboardTabType, parseDashboardTags } from "./types";
  import DashHeader from "./dash-header.svelte";
  import * as Tabs from "$lib/client/components/ui/tabs/index";
  import BotDashboardTab from "./bot-dashboard-tab.svelte";
  import BotSettingsTab from "./bot-settings-tab.svelte";
  import QueueDashboardTab from "./queue-dashboard-tab.svelte";
  import QueueEventsTab from "./queue-events-tab.svelte";
  import QueueSchemaTab from "./queue-schema-tab.svelte";
  import QueueSettingsTab from "./queue-settings-tab.svelte";
  import SystemSettingsTab from "./system-settings-tab.svelte";
  import TimePicker from "../time-picker/time-picker.svelte";
  import { Skeleton } from "$lib/client/components/ui/skeleton/index";

    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;
    compState.setTimePickerState(appState.timePickerState);

    type DashboardProps = {
        id: string;
    }

    let {id}: DashboardProps = $props();

    let settings = $derived(compState.settings);
    let name = $derived(settings?.name);

    let dashType = $derived(compState.dashType);

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
                {label: DashboardTabType.Settings},
                {label: DashboardTabType.Schema},
            ];
        case NodeType.System:
            return [
                {label: DashboardTabType.Settings},
            ];
        default:
            return [
                {label: DashboardTabType.Dashboard},
            ];
       }
    }

    // React to id changes — update dash type, set state, and re-fetch data
    $effect(() => {
        let dashTypeVal: NodeType = NodeType.Bot;
        if (id.startsWith('queue:')) {
            dashTypeVal = NodeType.Queue;
        } else if (id.startsWith('system:')) {
            dashTypeVal = NodeType.System;
        }
        compState.dashType = dashTypeVal;
        compState.id = id;

        // Fetch settings and stats whenever the id changes
        Promise.all([
            compState.getSettings(),
            compState.getDashStats()
        ]).catch((error) => {
            console.error('Failed to load dashboard data:', error);
        });
    });

    /** Keep charts aligned with wall clock: stats only loaded on id/range change otherwise, while the “now” line was advancing every 30s. */
    $effect(() => {
        const currentId = id;
        if (!currentId) return;
        const t = setInterval(() => {
            compState.getDashStats().catch((err) => {
                console.error('Dashboard stats refresh failed:', err);
            });
        }, 45_000);
        return () => clearInterval(t);
    });

</script>

<div class="flex flex-col h-full p-4 lg:p-6">
    <!-- Header Section -->
    <div class="flex flex-row justify-between items-center w-full"> 
        <DashHeader name={name || id} id={id} type={dashType} currentCheckpoint={currentCheckpoint} lambdaName={lambdaName} lambdaRegion={lambdaRegion} tags={tags} />
    </div>
    
    {#if !compState.settings || !compState.stats}
        <!-- Skeleton loading state -->
        <div class="flex-1 mt-4 space-y-4">
            <div class="flex gap-2">
                <Skeleton class="h-9 w-24" />
                <Skeleton class="h-9 w-24" />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton class="h-48 rounded-lg" />
                <Skeleton class="h-48 rounded-lg" />
                <Skeleton class="h-48 rounded-lg" />
            </div>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Skeleton class="h-64 rounded-lg" />
                <Skeleton class="h-64 rounded-lg" />
            </div>
        </div>
    {:else}
    <div class="flex-1 mt-4 flex flex-col min-h-0">
        <Tabs.Root value={tabs[0].label} class="w-full flex-1 flex flex-col min-h-0">
            <div class="flex flex-row justify-between items-center mb-4">
                <Tabs.List>
                    {#each tabs as tab}
                        <Tabs.Trigger value={tab.label}>{tab.label}</Tabs.Trigger>
                    {/each}
                </Tabs.List>
                <div class="flex items-center">
                    <TimePicker />
                </div>
            </div>
            
            <Tabs.Content value={DashboardTabType.Dashboard} class="flex-1 flex flex-col min-h-0">
                <div class="mt-4 flex-1 flex flex-col min-h-0">
                    {#if dashType === NodeType.Bot}
                        <BotDashboardTab />
                    {:else if dashType === NodeType.Queue}
                        <QueueDashboardTab />
                    {:else}
                        <div class="p-4 border rounded-md">
                            <h2 class="text-xl font-semibold mb-4">Dashboard</h2>
                            <p class="text-muted-foreground">Dashboard content coming soon...</p>
                        </div>
                    {/if}
                </div>
            </Tabs.Content>
            
            <Tabs.Content value={DashboardTabType.Settings}>
                <div class="mt-4">
                    {#if dashType === NodeType.Bot}
                        <BotSettingsTab id={id} />
                    {:else if dashType === NodeType.Queue}
                        <QueueSettingsTab id={id} />
                    {:else if dashType === NodeType.System}
                        <SystemSettingsTab id={id} />
                    {:else}
                        <div class="p-4 border rounded-md">
                            <h2 class="text-xl font-semibold mb-4">Settings</h2>
                            <p class="text-muted-foreground">Settings content coming soon...</p>
                        </div>
                    {/if}
                </div>
            </Tabs.Content>
            
            <Tabs.Content value={DashboardTabType.Events}>
                <div class="mt-4">
                    {#if dashType === NodeType.Queue}
                        <QueueEventsTab id={id} />
                    {:else}
                        <div class="p-4 border rounded-md">
                            <h2 class="text-xl font-semibold mb-4">Events</h2>
                            <p class="text-muted-foreground">Events content coming soon...</p>
                        </div>
                    {/if}
                </div>
            </Tabs.Content>
            
            <Tabs.Content value={DashboardTabType.Schema}>
                <div class="mt-4">
                    {#if dashType === NodeType.Queue}
                        <QueueSchemaTab id={id} />
                    {:else}
                        <div class="p-4 border rounded-md">
                            <h2 class="text-xl font-semibold mb-4">Schema</h2>
                            <p class="text-muted-foreground">Schema content coming soon...</p>
                        </div>
                    {/if}
                </div>
            </Tabs.Content>
        </Tabs.Root>
    </div>
    {/if}
</div>