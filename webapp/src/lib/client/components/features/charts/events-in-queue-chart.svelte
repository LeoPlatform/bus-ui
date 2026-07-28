<script lang="ts">
  import { browser } from "$app/environment";
  import type { Component } from "svelte";
  import type { DashboardStatsValue, StatsRange } from "$lib/types";
  import HelpTooltip from "../../help-tooltip.svelte";
  import { bucketsData, ranges } from "$lib/bucketUtils";
  import { Separator } from "../../ui/separator";

  interface Props {
    values: DashboardStatsValue[];
    lastRead: number;
    range: StatsRange;
    start: number;
    end: number;
  }

  let { values, lastRead, range, start, end }: Props = $props();

  let rangeData = $derived(ranges[range].rolling ? ranges[range].rolling! : ranges[range]);
  let bucket = $derived(bucketsData[rangeData.period]);
  let lastBucket = $derived(bucket.prev(new Date(start), rangeData.count).valueOf());

  const totalEvents = $derived(values.reduce((acc, p) => acc + (p.value || 0), 0));
  const eventsInBucket = $derived(
    values.reduce((acc, p) => (p.time >= start ? acc + (p.value || 0) : acc), 0)
  );
  const eventsLastBucket = $derived(
    values.reduce((acc, p) => (p.time >= lastBucket && p.time < start ? acc + (p.value || 0) : acc), 0)
  );

  // LayerChart renders client-side only; lazy-load the inner chart behind a browser guard.
  let EventsInQueueChartInner: Component<{
    values: DashboardStatsValue[];
    lastRead: number;
    start: number;
    end: number;
    lastBucket: number;
  }> | null = $state(null);

  $effect(() => {
    if (browser && !EventsInQueueChartInner) {
      import("./events-in-queue-chart-inner.svelte").then((mod) => {
        EventsInQueueChartInner = mod.default;
      });
    }
  });
</script>

<div class="flex flex-col h-full">
  <h2 class="text-xl font-semibold text-foreground mb-2">Events in Queue</h2>
  <div class="flex flex-row bg-muted/20 rounded-md w-full h-full overflow-hidden">
    <div class="p-2 shadow-sm w-1/4 h-full overflow-hidden">
      <div class="flex flex-col gap-2 justify-between h-full">
        <div class="flex items-center justify-center gap-2 h-full">
          <div class="text-lg text-blue-500 font-bold">{totalEvents.toLocaleString()}</div>
          <HelpTooltip helpText="The total number of events in the queue for the time range displayed." help={true} />
        </div>
        <Separator />
        <div class="flex items-center justify-center gap-2 h-full">
          <div class="text-lg text-[#F47D4A] font-bold">{eventsLastBucket.toLocaleString()}</div>
          <HelpTooltip helpText="The number of events in the last bucket." help={true} />
        </div>
        <Separator />
        <div class="flex items-center justify-center gap-2 h-full">
          <div class="text-lg text-[#88a550] font-bold">{eventsInBucket.toLocaleString()}</div>
          <HelpTooltip helpText="The number of events in the current bucket." help={true} />
        </div>
      </div>
    </div>
    <Separator orientation="vertical" class="h-full" />
    <div class="p-2 shadow-sm w-3/4 h-full overflow-hidden">
      {#if EventsInQueueChartInner}
        <EventsInQueueChartInner {values} {lastRead} {start} {end} {lastBucket} />
      {/if}
    </div>
  </div>
</div>
