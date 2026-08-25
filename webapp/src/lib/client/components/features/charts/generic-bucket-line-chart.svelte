<script lang="ts">
  import { browser } from "$app/environment";
  import type { Component } from "svelte";
  import { bucketsData, ranges } from "$lib/bucketUtils";
  import { computeBucketTotals } from "./bucket-totals";
  import type { DashboardStatsValue, StatsRange } from "$lib/types";
  import HelpTooltip from "../../help-tooltip.svelte";
  import { Separator } from "../../ui/separator";
  import type { ChartOptions } from "../chart-details-pane/types";
  import ChartOptionsMenu from "./chart-options.svelte";

  interface Props {
    data: DashboardStatsValue[] | null;
    chartLabel: string;
    range: StatsRange;
    /** Start of the *current* stats bucket (API currentBucketStart). Used for prev/current bucket splits. */
    start: number;
    /** End of the *query window* (API end / time picker end). */
    end: number;
    /**
     * Start of the *query window* (API start). When set, the blue “total” row label and sum match the stats query range.
     * If omitted, falls back to client-derived queueStartBucket (can drift from API).
     */
    rangeStart?: number;
    checkPointValue?: number;
    chartOptions?: ChartOptions;
    formatTotal?: (value: number) => string;
    overrideTotal?: number;
    overrideCountInLastBucket?: number;
    overrideCountInBucket?: number;
    /** When false, hide the chart’s own title row (e.g. card already has a title). */
    showTitle?: boolean;
  }

  let {
    data,
    range,
    start,
    end,
    chartLabel,
    rangeStart: rangeStartProp,
    checkPointValue,
    chartOptions,
    formatTotal,
    overrideTotal,
    overrideCountInLastBucket,
    overrideCountInBucket,
    showTitle = true,
  }: Props = $props();

  let rangeData = $derived(
    ranges[range].rolling ? ranges[range].rolling! : ranges[range]
  );
  let bucket = $derived(bucketsData[rangeData.period]);

  let lastBucket = $derived(
    bucket.prev(new Date(start), rangeData.count).valueOf()
  );

  let queueStartBucket = $derived(bucket.prev(new Date(lastBucket), rangeData.count).valueOf());
  /** Aligned with API stats window when rangeStartProp is passed */
  let effectiveRangeStart = $derived(
    rangeStartProp != null && Number.isFinite(rangeStartProp) ? rangeStartProp : queueStartBucket
  );

  let humanRangeStart = $derived(
    new Date(effectiveRangeStart).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
  let humanStart = $derived(new Date(start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));
  let humanEnd = $derived(new Date(end).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));
  let humanLastBucket = $derived(new Date(lastBucket).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));

  let showLogarithmic = $state<boolean>(false);

  // Aggregation for the three "total" rows. Lib-agnostic and unit-tested in
  // bucket-totals.test.ts (ES-3031) so the migration can't silently change the numbers.
  const totals = $derived(
    computeBucketTotals({
      data,
      start,
      end,
      effectiveRangeStart,
      lastBucket,
      overrideTotal,
      overrideCountInBucket,
      overrideCountInLastBucket,
    })
  );
  const countInBucket = $derived(totals.countInBucket);
  const totalCount = $derived(totals.totalCount);
  const countInLastBucket = $derived(totals.countInLastBucket);

  // LayerChart renders client-side only; lazy-load the inner chart behind a browser guard.
  let GenericBucketLineChartInner: Component<{
    data: DashboardStatsValue[];
    chartLabel: string;
    start: number;
    end: number;
    lastBucket: number;
    rangeStart: number;
    checkPointValue?: number;
    showLogarithmic?: boolean;
  }> | null = $state(null);

  $effect(() => {
    if (browser && !GenericBucketLineChartInner) {
      import("./generic-bucket-line-chart-inner.svelte").then((mod) => {
        GenericBucketLineChartInner = mod.default;
      });
    }
  });
</script>

<div class="flex flex-col h-full">
  {#if showTitle || chartOptions}
    <div class="flex flex-row justify-between">
      {#if showTitle}
        <h2 class="text-xl font-semibold text-foreground mb-2">{chartLabel}</h2>
      {:else}
        <div></div>
      {/if}
      {#if chartOptions}
        <ChartOptionsMenu chartOptions={chartOptions} bind:logSwitch={showLogarithmic} />
      {/if}
    </div>
  {/if}
  <div class="flex flex-row bg-muted/20 rounded-md w-full h-full overflow-hidden">
    <div class="p-2 shadow-sm w-1/4 h-full overflow-hidden">
      <div class="flex flex-col justify-between h-full">
        <div class="flex items-center justify-center gap-2 h-full">
          <div class="text-lg text-blue-500 font-bold">{formatTotal ? formatTotal(totalCount) : totalCount.toLocaleString()}</div>
          <HelpTooltip helpText="Total for the query window shown (start–end). On charts that can lag, the red line marks the current read checkpoint's position in time." help={true} />
        </div>
        <div class="flex items-center justify-center">
          <div class="text-[10px] text-muted-foreground font-medium">{humanRangeStart}–{humanEnd}</div>
        </div>
        <Separator />
        <div class="flex items-center justify-center gap-2 h-full">
          <div class="text-lg text-[#F47D4A] font-bold">{formatTotal ? formatTotal(countInLastBucket) : countInLastBucket.toLocaleString()}</div>
          <HelpTooltip helpText="The number of events in the last bucket." help={true} />
        </div>
        <div class="flex items-center justify-center">
          <div class="text-[10px] text-muted-foreground font-medium">{humanLastBucket}-{humanStart}</div>
        </div>
        <Separator />
        <div class="flex items-center justify-center gap-2 h-full">
          <div class="text-lg text-[#88a550] font-bold">{formatTotal ? formatTotal(countInBucket) : countInBucket.toLocaleString()}</div>
          <HelpTooltip helpText="The number of events in the current bucket." help={true} />
        </div>
        <div class="flex items-center justify-center">
          <div class="text-[10px] text-muted-foreground font-medium">{humanStart}-{humanEnd}</div>
        </div>
      </div>
    </div>
    <Separator orientation="vertical" class="h-full" />
    <div class="p-2 shadow-sm w-3/4 h-full overflow-hidden">
      {#if GenericBucketLineChartInner && data}
        <GenericBucketLineChartInner
          {data}
          {chartLabel}
          {start}
          {end}
          {lastBucket}
          rangeStart={effectiveRangeStart}
          {checkPointValue}
          {showLogarithmic}
        />
      {/if}
    </div>
  </div>
</div>
