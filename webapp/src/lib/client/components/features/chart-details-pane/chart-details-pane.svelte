<script lang="ts">
  import type { DashboardStats, DashboardStatsValue, StatsRange } from "$lib/types";
  import Button from "../../ui/button/button.svelte";
  import EventsInQueueChart from "../charts/events-in-queue-chart.svelte";
  import QueueLagChart from "../charts/queue-lag-chart.svelte";
  import SquareX from '@lucide/svelte/icons/square-x';
  import EventsReadChart from "../charts/events-read-chart.svelte";
  import GenericLineChart from "../charts/generic-line-chart.svelte";
  import type { Chart, ChartTab } from "./types";
  import { Skeleton } from "../../ui/skeleton";
  import type { AppState } from "$lib/client/appstate.svelte";
  import { getContext } from "svelte";
  import { bucketsData, ranges } from "$lib/bucketUtils";
  import GenericBucketLineChart from "../charts/generic-bucket-line-chart.svelte";
  const labelReplaceRegex = /queue:|system:/g;

  let compState = getContext<AppState>('appState').timePickerState;

  interface Props {
    dashboardStats: DashboardStats | null;
    selectedLink: { sourceId: string; targetId: string } | null;
    visible: boolean;

    onClose: () => void;
  }

  let { dashboardStats, selectedLink, visible, onClose }: Props = $props();


  let tabs: ChartTab[] = $state([]);
  let selectedTab: ChartTab | null = $state(null);

  let range = $derived(compState?.range);
  let lastSelectedLinkId = $state<string>('');
  let lastDashboardStatsId = $state<string>('');
  let start = $derived(compState?.startTime);
  let end = $derived.by(() => {
    const _ = compState;
    let rangeData = ranges[range].rolling ? ranges[range].rolling! : ranges[range];
    let bucket = bucketsData[rangeData.period];
    return bucket.next(new Date(start), rangeData.count).valueOf();
  });

  // Need the following charts
  // 1. Events in Queue -> source is queue, target is bot
  // 2. Events Read -> source is queue, target is bot
  // 3. Read Lag -> source is queue, target is bot
  // 4. Write Lag -> source is bot, target is queue
  // 5. Events Written -> source is bot, target is queue
  // 6. Execution Count -> source is system, target is bot
  // 7. Error Count -> source is system, target is bot
  // 8. Execution Time -> source is system, target is bot
  function pickTheCharts() {
    console.log('hit pick the charts');
    
    // Store the current selection to try to preserve it
    const currentSelectedLabel = selectedTab?.label;
    
    // Clear existing tabs first
    tabs = [];
    
    if(dashboardStats && selectedLink){
      // If we have executions, errors, and execution time we can add a bot-details tab
      if(dashboardStats.executions.length > 0 && dashboardStats.errors.length > 0 && dashboardStats.duration.length > 0){
        const label = !selectedLink.sourceId.startsWith("system:") && !selectedLink.sourceId.startsWith("queue:") ? selectedLink.sourceId : selectedLink.targetId;
        tabs.push({
          type: 'bot-details',
          label,
          charts: [
            {
              type: 'execution-count',
              data: dashboardStats.executions,
              dataSetLabel: 'Execution Count',
              tooltipLabel: 'Executions',
              helpText: 'The total number of executions in the graph',
              includeFullCount: true,
            },
            {
              type: 'error-count',
              data: dashboardStats.errors,
              dataSetLabel: 'Error Count',
              tooltipLabel: 'Errors',
              helpText: 'The total number of errors in the graph',
              includeFullCount: true,
            },
            {
              type: 'execution-time',
              data: dashboardStats.duration,
              dataSetLabel: 'Execution Time',
              tooltipLabel: 'Execution Time',
              helpText: 'The execution time of the last run',
              includeCurrentValue: true,
              dataIsTimeBased: true,
            }
          ]
        });
      }

      // if we have queues.read then we need to create events in queue, events read and queue-source-lag charts per queue
      if(dashboardStats.queues.read){
        Object.keys(dashboardStats.queues.read).forEach(queueId => {
          tabs.push({
            type: 'read',
            label: queueId.replaceAll(labelReplaceRegex, ""),
            charts: [
              {
                type: 'events-in-queue',
                data: dashboardStats.queues.read![queueId].values,
                dataSetLabel: 'Events In Queue',
                checkPointValue: dashboardStats.queues.read![queueId].last_read_event_timestamp || 0, 
                range,
                start,
                end,  
                chartOptions: {
                  logSwitchEnabled: true,
                },
              },
              {
                type: 'events-read',
                data: dashboardStats.queues.read![queueId].reads!,
                dataSetLabel: 'Events Read',
                queueId,
                range,
                start,
                end,
              }, {
                type: 'queue-lag',
                data: dashboardStats,
                queueId,
                chartOptions: {
                  logSwitchEnabled: true,
                  trendLineEnabled: true,
                  trendLineLabel: 'Source Lag Trend',
                }
              }
            ]
          });
        });
      }

      // if we have queues.write then we need to create events written and write lag charts per queue
      if(dashboardStats.queues.write){
        Object.keys(dashboardStats.queues.write).forEach(queueId => {
          tabs.push({
            type: 'write',
            label: queueId.replaceAll(labelReplaceRegex, ""),
            charts: [
              {
                type: 'events-written',
                data: dashboardStats.queues.write?.[queueId]?.values || [],
                dataSetLabel: 'Events Written',
                tooltipLabel: 'Events Written',
                helpText: 'The total number of events written in the graph',
                includeFullCount: true,
              },
              {
                type: 'write-lag',
                data: dashboardStats.queues.write?.[queueId]?.source_lags || [], //FIXME: this may be incorrect
                dataSetLabel: 'Write Lag',
                tooltipLabel: 'Lag',
                helpText: 'The current lag between when the last event was created and when it was written to the queue',
                includeCurrentValue: true,
                dataIsTimeBased: true,
              }
            ]
          });
        });
      }
      
      // Try to preserve the current selection, otherwise select the first tab
      if (tabs.length > 0) {
        if (currentSelectedLabel) {
          // Try to find the previously selected tab
          const previouslySelectedTab = tabs.find(tab => tab.label === currentSelectedLabel);
          selectedTab = previouslySelectedTab || tabs[0];
        } else {
          // No previous selection, select the first tab
          selectedTab = tabs[0];
        }
      } else {
        selectedTab = null;
      }
    } else {
      selectedTab = null;
    }
  }

  function handleTabClick(tab: ChartTab) {
    selectedTab = tab;
  }

  // Effect to update charts when dashboardStats or selectedLink changes
  $effect(() => {
    if (dashboardStats && selectedLink) {
      const currentLinkId = `${selectedLink.sourceId}-${selectedLink.targetId}`;
      const currentStatsId = JSON.stringify(dashboardStats); // Simple way to detect changes
      
      // Only update if either the link or dashboardStats changed
      if (currentLinkId !== lastSelectedLinkId || currentStatsId !== lastDashboardStatsId) {
        lastSelectedLinkId = currentLinkId;
        lastDashboardStatsId = currentStatsId;
        pickTheCharts();
      }
    } else {
      // Clear everything when no valid data
      tabs = [];
      selectedTab = null;
      lastSelectedLinkId = '';
      lastDashboardStatsId = '';
    }
  });
</script>

{#snippet ChartContainer(chart: Chart )}
  <div class="flex-1 bg-white rounded-lg p-4 shadow-sm border border-gray-200 overflow-hidden">
    <div class="h-full overflow-hidden">
      {#if chart.type === 'events-in-queue'}
      <GenericBucketLineChart data={chart.data as DashboardStatsValue[]} chartLabel={chart.dataSetLabel!} checkPointValue={chart.checkPointValue} range={range} start={chart.start || end} end={chart.end || end} chartOptions={chart.chartOptions}/>
        <!-- <EventsInQueueChart data={chart.data as DashboardStats} queueId={chart.queueId || ''} range={chart.range || range} start={start} end={end} /> -->
      {:else if chart.type === 'queue-lag'}
        <QueueLagChart data={chart.data as DashboardStats} queueId={chart.queueId || ''} chartOptions={chart.chartOptions}/>
      {:else if chart.type === 'events-read'}
        <GenericBucketLineChart data={chart.data as DashboardStatsValue[]} chartLabel={chart.dataSetLabel!} range={chart.range || range} start={chart.start || start} end={chart.end || end} chartOptions={chart.chartOptions}/>
        <!-- <EventsReadChart data={chart.data as DashboardStats} queueId={chart.queueId || ''} range={chart.range || range} start={start} end={end} /> -->
      {:else if chart.type === 'execution-count' || chart.type === 'error-count' || chart.type === 'execution-time' || chart.type === 'events-written' || chart.type === 'write-lag'}
        <GenericLineChart data={chart.data as DashboardStatsValue[]} dataSetLabel={chart.dataSetLabel!} tooltipLabel={chart.tooltipLabel!} helpText={chart.helpText!} includeFullCount={chart.includeFullCount} includeCurrentValue={chart.includeCurrentValue} dataIsTimeBased={chart.dataIsTimeBased} chartOptions={chart.chartOptions}/>
      {/if}
    </div>
  </div>
{/snippet}


{#if visible}
  <div class="fixed bottom-0 left-16 right-0 h-80 bg-gray-50 border-t border-gray-200 shadow-lg z-50">
    <div class="flex justify-between items-center px-2 border-b border-gray-200 bg-gray-100">
      <!-- Add a section for the tabs -->
      <!-- <h3 class="text-lg font-semibold text-gray-900 m-0">Relationship Details</h3> -->
      <div class="flex pl-2 gap-2 overflow-y-hidden w-full">
        {#if dashboardStats}
          {#each tabs as tab}
            {@const isActive = tab === selectedTab}
            <div class="relative">
              <button 
                onclick={() => handleTabClick(tab)}
                disabled={isActive}
                class={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg
                  transition-all duration-200 ease-in-out
                  ${isActive 
                    ? 'bg-gray-50/20 shadow-lg transform scale-105' 
                    : 'bg-gray-100 hover:bg-gray-300'
                  }
                  hover:transform hover:scale-105 hover:shadow-lg
                  group relative
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <img src={`/${tab.type == 'bot-details' ? 'bot' : tab.type}.png`} alt={tab.label} class="w-10 h-10" />
                <span class={`
                  transition-colors ${isActive ? 'text-gray-900 font-semibold' : 'text-gray-700'}
                `}>
                  {tab.label}
                </span>
                
                <!-- Active indicator bar -->
                {#if isActive}
                  <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-lime-600 rounded-b-lg"></div>
                {/if}
              </button>
            </div>
          {/each}
        {:else}
          <div class="flex items-center gap-2 px-3 py-1.5">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
            <span class="text-gray-600 text-sm">Loading...</span>
          </div>
        {/if}
      </div>
      <Button 
      variant="ghost"
      size="icon"
      onclick={onClose}
    >
      <SquareX class="w-full h-full"/>
    </Button>
    </div>
      <div class="flex h-68 p-4 gap-4 overflow-hidden">
        {#if dashboardStats && selectedTab}
          {#each selectedTab.charts as chart}
            {@render ChartContainer(chart)}
          {/each}
        {:else}
          <Skeleton class="w-1/3 h-full rounded-lg bg-slate-300" />
          <Skeleton class="w-1/3 h-full rounded-lg bg-slate-300" />
          <Skeleton class="w-1/3 h-full rounded-lg bg-slate-300" />
        {/if}

    </div>
  </div>
{/if}

 