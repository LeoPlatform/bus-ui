<script lang="ts">
  import type { DashboardStats, StatsRange } from "$lib/types";
  import { onDestroy, onMount, untrack } from "svelte";
  import Button from "../../ui/button/button.svelte";
  import EventsInQueueChart from "../charts/events-in-queue-chart.svelte";
  import QueueLagChart from "../charts/queue-lag-chart.svelte";
  import SquareX from '@lucide/svelte/icons/square-x';
  import EventsReadChart from "../charts/events-read-chart.svelte";

  interface Props {
    dashboardStats: DashboardStats | null;
    selectedLink: { sourceId: string; targetId: string } | null;
    visible: boolean;
    range: StatsRange;
    // direction: 'read' | 'write';
    onClose: () => void;
  }

  let { dashboardStats, selectedLink, visible, range, onClose }: Props = $props();

  type ChartType = 'events-in-queue' | 'queue-lag' | 'events-read' | 'events-written' | 'execution-count' | 'error-count' | 'execution-time';

  let chartsToRender: ChartType[] = $state([]);
  let lastSelectedLinkId = $state<string>('');

  // Make selectedLink reactive
  let reactiveSelectedLink = $derived(selectedLink);
  
  // Need the following charts
  // 1. Events in Queue -> source is queue, target is bot
  // 2. Events Read -> source is queue, target is bot
  // 3. Lag -> source is queue, target is bot || source is bot, target is queue
  // 4. Events Written -> source is bot, target is queue
  // 5. Execution Count -> source is system, target is bot
  // 6. Error Count -> source is system, target is bot
  // 7. Execution Time -> source is system, target is bot
  function pickTheCharts() {
    if (!reactiveSelectedLink?.sourceId) {
      chartsToRender = [];
      return;
    }
    
    const currentLinkId = `${reactiveSelectedLink.sourceId}-${reactiveSelectedLink.targetId}`;
    
    // Only update if the link actually changed
    if (currentLinkId === lastSelectedLinkId) {
      return;
    }
    
    console.log('Picking charts for:', reactiveSelectedLink);
    
    if(reactiveSelectedLink.sourceId.startsWith("queue:")) {
      chartsToRender = ['events-in-queue', 'events-read', 'queue-lag'];
    } else if (reactiveSelectedLink.sourceId.startsWith("system:")) {
      chartsToRender = ['execution-count', 'error-count', 'execution-time'];
    } else {
      chartsToRender = ['events-written', 'queue-lag'];
    }
    
    lastSelectedLinkId = currentLinkId;
  }

  // Effect to update charts when selectedLink changes
  $effect(() => {
    // Only run if we have a valid selectedLink and it's different from last time
    if (reactiveSelectedLink && reactiveSelectedLink.sourceId && reactiveSelectedLink.targetId) {
      const currentLinkId = `${reactiveSelectedLink.sourceId}-${reactiveSelectedLink.targetId}`;
      
      // Only update if the link actually changed
      if (currentLinkId !== lastSelectedLinkId) {
        untrack(() => {
          pickTheCharts();
        });
      }
    } else if (chartsToRender.length > 0) {
      // Clear charts when no valid selection
      untrack(() => {
        chartsToRender = [];
        lastSelectedLinkId = '';
      });
    }
  });

  onMount(() => {
    if (reactiveSelectedLink && reactiveSelectedLink.sourceId) {
      pickTheCharts();
    }
  });
  
  onDestroy(() => {
    chartsToRender = [];
    lastSelectedLinkId = '';
  })
</script>

{#snippet ChartContainer(type: ChartType)}
  <div class="flex-1 bg-white rounded-lg p-4 shadow-sm border border-gray-200 overflow-hidden">
    <div class="h-full overflow-hidden">
      {#if type === 'events-in-queue'}
        <EventsInQueueChart data={dashboardStats} queueId={selectedLink?.sourceId || ''} range={range} />
      {:else if type === 'queue-lag'}
        <QueueLagChart data={dashboardStats} queueId={selectedLink?.sourceId || ''} />
      {:else if type === 'events-read'}
        <EventsReadChart data={dashboardStats} queueId={selectedLink?.sourceId || ''} range={range} />
      <!-- {:else if type === 'events-written'}
        <EventsWrittenChart data={dashboardStats} queueId={selectedLink?.sourceId || ''} />
      {:else if type === 'execution-count'}
        <ExecutionCountChart data={dashboardStats} queueId={selectedLink?.sourceId || ''} />
      {:else if type === 'error-count'}
        <ErrorCountChart data={dashboardStats} queueId={selectedLink?.sourceId || ''} />
      {:else if type === 'execution-time'} -->
        <!-- <ExecutionTimeChart data={dashboardStats} queueId={selectedLink?.sourceId || ''} /> -->
      {/if}
    </div>
  </div>
{/snippet}


{#if visible && dashboardStats}
  <div class="fixed bottom-0 left-16 right-0 h-80 bg-gray-50 border-t border-gray-200 shadow-lg z-50">
    <div class="flex justify-between items-center px-4 py-3 border-b border-gray-200 bg-white">
      <h3 class="text-lg font-semibold text-gray-900 m-0">Relationship Details</h3>
      <Button 
        variant="ghost"
        size="icon"
        onclick={onClose}
      >
        <SquareX class="w-full h-full"/>
      </Button>
    </div>
      <div class="flex h-64 p-4 gap-4 overflow-hidden">
        {#each chartsToRender as chart}
          {@render ChartContainer(chart)}
        {/each}
    </div>
  </div>
{/if}

 