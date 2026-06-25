<script lang="ts">
  import { browser } from "$app/environment";
  import type { Component } from "svelte";
  import type { DashboardStats, DashboardStatsValue } from "$lib/types";
  import { humanize } from "$lib/utils";
  import { Separator } from "../../ui/separator";
  import HelpTooltip from "../../help-tooltip.svelte";
  import type { ChartOptions } from "../chart-details-pane/types";
  import ChartOptionsMenu from "./chart-options.svelte";
  import type { RegressionType } from "./regression";

  interface Props {
    data: DashboardStats | null;
    queueId: string;
    chartOptions?: ChartOptions;
  }

  let { data, queueId, chartOptions }: Props = $props();

  let showLogarithmic = $state<boolean>(false);
  let trendLineType = $state<RegressionType | undefined>("linear");
  let bestFit = $state<boolean>(false);

  const lagData = $derived.by(() => {
    const read = data?.queues?.read?.[queueId];
    if (!read || (!read.source_lags && !read.queue_lags)) {
      return { sourceLagData: [] as DashboardStatsValue[], queueLagData: [] as DashboardStatsValue[] };
    }
    return {
      sourceLagData: [...read.source_lags].sort((a, b) => a.time - b.time),
      queueLagData: [...read.queue_lags].sort((a, b) => a.time - b.time),
    };
  });

  const currentSourceLag = $derived(
    [...lagData.sourceLagData].reverse().find((d) => d.value !== 0)?.value ?? 0
  );
  const currentQueueLag = $derived(
    [...lagData.queueLagData].reverse().find((d) => d.value !== 0)?.value ?? 0
  );

  // LayerChart renders client-side only; lazy-load the inner chart behind a browser guard.
  let QueueLagChartInner: Component<{
    sourceLagData: DashboardStatsValue[];
    queueLagData: DashboardStatsValue[];
    showLogarithmic?: boolean;
    trendLineType?: RegressionType;
    bestFit?: boolean;
    trendLineLabel?: string;
  }> | null = $state(null);

  $effect(() => {
    if (browser && !QueueLagChartInner) {
      import("./queue-lag-chart-inner.svelte").then((mod) => {
        QueueLagChartInner = mod.default;
      });
    }
  });
</script>

<div class="flex flex-col h-full">
  <div class="flex flex-row justify-between">
    <h2 class="text-xl font-semibold text-foreground mb-2">Queue and Source Lag</h2>
    {#if chartOptions}
      <ChartOptionsMenu chartOptions={chartOptions} bind:logSwitch={showLogarithmic} bind:regressionType={trendLineType} bind:bestFit={bestFit} />
    {/if}
  </div>
  <div class="flex flex-row bg-muted/20 rounded-md w-full h-full overflow-hidden">
    <div class="p-2 shadow-sm w-1/4 h-full overflow-hidden">
      <div class="flex flex-col gap-2 justify-between h-full">
        <div class="flex items-center justify-center gap-2 h-full">
          <div class="text-md font-bold">Source Lag</div>
          <div class="text-md text-blue-500 font-bold">{humanize(currentSourceLag)}</div>
          <HelpTooltip helpText="The lag between the source and the queue." help={true} />
        </div>
        <Separator />
        <div class="flex items-center justify-center gap-2 h-full">
          <div class="text-md font-bold">Queue Lag</div>
          <div class="text-md text-red-500 font-bold">{humanize(currentQueueLag)}</div>
          <HelpTooltip helpText="The lag within the queue processing." help={true} />
        </div>
      </div>
    </div>
    <Separator orientation="vertical" class="h-full" />
    <div class="p-2 shadow-sm w-3/4 h-full overflow-hidden">
      {#if QueueLagChartInner}
        <QueueLagChartInner
          sourceLagData={lagData.sourceLagData}
          queueLagData={lagData.queueLagData}
          {showLogarithmic}
          {trendLineType}
          {bestFit}
          trendLineLabel={chartOptions?.trendLineLabel}
        />
      {/if}
    </div>
  </div>
</div>
