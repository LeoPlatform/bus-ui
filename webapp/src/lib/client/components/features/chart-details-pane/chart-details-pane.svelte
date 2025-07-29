<script lang="ts">
  import type { DashboardStats } from "$lib/types";
  import EventsInQueueChart from "../charts/events-in-queue-chart.svelte";
  import QueueLagChart from "../charts/queue-lag-chart.svelte";

  interface Props {
    dashboardStats: DashboardStats | null;
    selectedLink: { sourceId: string; targetId: string } | null;
    visible: boolean;
    direction: 'read' | 'write';
    onClose: () => void;
  }

  let { dashboardStats, selectedLink, visible, onClose }: Props = $props();

  // Need the following charts
  // 1. Events in Queue -> source is queue, target is bot
  // 2. Events Read -> source is queue, target is bot
  // 3. Lag -> source is queue, target is bot || source is bot, target is queue
  // 4. Events Written -> source is bot, target is queue
  // 5. Execution Count -> source is system, target is bot
  // 6. Error Count -> source is system, target is bot
  // 7. Execution Time -> source is system, target is bot
</script>



{#if visible && dashboardStats}
  <div class="fixed bottom-0 left-0 right-0 h-80 bg-gray-50 border-t border-gray-200 shadow-lg z-50">
    <div class="flex justify-between items-center px-4 py-3 border-b border-gray-200 bg-white">
      <h3 class="text-lg font-semibold text-gray-900 m-0">Relationship Details</h3>
      <button 
        class="bg-transparent border-none text-2xl cursor-pointer p-1 rounded hover:bg-gray-100 transition-colors"
        onclick={onClose}
      >
        ×
      </button>
    </div>
    <div class="flex h-64 p-4 gap-4 overflow-hidden">
      <div class="flex-1 bg-white rounded-lg p-4 shadow-sm border border-gray-200 overflow-hidden">
        <div class="h-full overflow-hidden">
          <EventsInQueueChart data={dashboardStats} queueId={selectedLink?.sourceId || ''} />
        </div>
      </div>
      
      <div class="flex-1 bg-white rounded-lg p-4 shadow-sm border border-gray-200 overflow-hidden">
        <div class="h-full overflow-hidden">
          <QueueLagChart data={dashboardStats} queueId={selectedLink?.sourceId || ''} />
        </div>
      </div>
    </div>
  </div>
{/if}

 