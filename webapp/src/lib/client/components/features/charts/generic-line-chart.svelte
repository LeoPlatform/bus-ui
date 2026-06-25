<script lang="ts">
  import { browser } from "$app/environment";
  import type { Component } from "svelte";
  import type { DashboardStatsValue } from "$lib/types";
  import HelpTooltip from "../../help-tooltip.svelte";
  import { Separator } from "../../ui/separator";
  import { humanize } from "$lib/utils";
  import type { ChartOptions } from "../chart-details-pane/types";
  import ChartOptionsMenu from "./chart-options.svelte";

  interface Props {
    data: DashboardStatsValue[];
    dataSetLabel: string;
    tooltipLabel: string;
    helpText: string;
    dataIsTimeBased?: boolean;
    includeFullCount?: boolean;
    includeCurrentValue?: boolean;
    chartOptions?: ChartOptions;
  }

  let {
    data,
    dataSetLabel,
    tooltipLabel,
    helpText,
    dataIsTimeBased = false,
    includeFullCount = false,
    includeCurrentValue = false,
    chartOptions,
  }: Props = $props();

  let showLogarithmic = $state(false);

  const fullCount = $derived(
    includeFullCount ? data.reduce((acc, d) => acc + (d.value || 0), 0) : undefined
  );
  const currentValue = $derived(
    includeCurrentValue ? data[data.length - 1]?.value : undefined
  );

  // LayerChart renders client-side only; lazy-load the inner chart behind a browser guard.
  let GenericLineChartInner: Component<{
    data: DashboardStatsValue[];
    dataSetLabel: string;
    tooltipLabel: string;
    dataIsTimeBased?: boolean;
    showLogarithmic?: boolean;
  }> | null = $state(null);

  $effect(() => {
    if (browser && !GenericLineChartInner) {
      import("./generic-line-chart-inner.svelte").then((mod) => {
        GenericLineChartInner = mod.default;
      });
    }
  });
</script>

<div class="flex flex-col h-full">
  <div class="flex flex-row justify-between">
    <h2 class="text-xl font-semibold text-foreground mb-2">{dataSetLabel}</h2>
    {#if chartOptions}
      <ChartOptionsMenu chartOptions={chartOptions} bind:logSwitch={showLogarithmic} />
    {/if}
  </div>
  <div class="flex flex-row bg-muted/20 rounded-md w-full h-full overflow-hidden">
    {#if includeFullCount || includeCurrentValue}
      <div class="p-2 shadow-sm w-1/4 h-full overflow-hidden">
        <div class="flex flex-col gap-2 justify-between h-full">
          <div class="flex items-center justify-center gap-2 h-full">
            {#if dataIsTimeBased}
              <div class="text-lg text-blue-500 font-bold">{humanize(includeFullCount ? fullCount || 0 : currentValue || 0)}</div>
            {:else}
              <div class="text-lg font-bold">{includeFullCount ? fullCount : currentValue}</div>
            {/if}
            <HelpTooltip helpText={helpText} info={true} />
          </div>
        </div>
      </div>
      <Separator orientation="vertical" class="h-full" />
    {/if}
    <div class="p-2 shadow-sm w-{includeFullCount || includeCurrentValue ? '3/4' : 'full'} h-full overflow-hidden">
      {#if GenericLineChartInner}
        <GenericLineChartInner {data} {dataSetLabel} {tooltipLabel} {dataIsTimeBased} {showLogarithmic} />
      {/if}
    </div>
  </div>
</div>
