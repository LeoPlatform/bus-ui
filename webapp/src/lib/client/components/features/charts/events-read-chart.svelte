<script lang="ts">
  import { browser } from "$app/environment";
  import type { Component } from "svelte";
  import type { DashboardStats, DashboardStatsValue, StatsRange } from "$lib/types";
  import { Separator } from "../../ui/separator";
  import HelpTooltip from "../../help-tooltip.svelte";

  interface Props {
    data: DashboardStats | null;
    queueId: string;
    range: StatsRange;
    start: number;
    end: number;
  }

  let { data, queueId, start }: Props = $props();

  const processed = $derived.by(() => {
    const reads = data?.queues?.read?.[queueId]?.reads;
    if (!reads) return { chartData: [] as DashboardStatsValue[], bucketCount: 0 };
    let bucketCount = 0;
    for (const r of reads) {
      if (r.time >= start) bucketCount += r.value;
    }
    return { chartData: [...reads].sort((a, b) => a.time - b.time), bucketCount };
  });

  // LayerChart renders client-side only; lazy-load the inner chart behind a browser guard.
  let EventsReadChartInner: Component<{ chartData: DashboardStatsValue[] }> | null = $state(null);

  $effect(() => {
    if (browser && !EventsReadChartInner) {
      import("./events-read-chart-inner.svelte").then((mod) => {
        EventsReadChartInner = mod.default;
      });
    }
  });
</script>

<div class="flex flex-col h-full">
  <h2 class="text-xl font-semibold text-foreground mb-2">Events Read</h2>
  <div class="flex flex-row bg-muted/20 rounded-md w-full h-full overflow-hidden">
    <div class="p-2 shadow-sm w-1/4 h-full overflow-hidden">
      <div class="flex flex-col gap-2 justify-between h-full">
        <div class="flex items-center justify-center gap-2 h-full">
          <div class="text-lg font-bold">{processed.bucketCount}</div>
          <HelpTooltip helpText="The number of events read from the queue in the current time bucket." info={true} />
        </div>
      </div>
    </div>
    <Separator orientation="vertical" class="h-full" />
    <div class="p-2 shadow-sm w-3/4 h-full overflow-hidden">
      {#if EventsReadChartInner}
        <EventsReadChartInner chartData={processed.chartData} />
      {/if}
    </div>
  </div>
</div>
