<script lang="ts">
  import { bucketsData, ranges } from "$lib/bucketUtils";
  import type { DashboardStatsValue, StatsRange } from "$lib/types";
  import  annotationPlugin  from 'chartjs-plugin-annotation';
  import type { ChartConfiguration } from "chart.js/auto";
  import type Chart from "chart.js/auto";
  import { onDestroy, onMount } from "svelte";
  import HelpTooltip from "../../help-tooltip.svelte";
  import { Separator } from "../../ui/separator";
  import { Label } from "../../ui/label";
  import { Switch } from "../../ui/switch";
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
  let canvas: HTMLCanvasElement;
  let chart = $state<Chart | null>(null);

  let totalCount = $state<number>(0);
  let countInBucket = $state<number>(0);
  let countInLastBucket = $state<number>(0);
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
    new Date(effectiveRangeStart).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    })
  );

  let humanStart = $derived(new Date(start).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                }));
  let humanEnd = $derived(new Date(end).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                }));
  let humanLastBucket = $derived(new Date(lastBucket).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                }));
  let showLogarithmic = $state<boolean>(false);

  /** Refresh “now” line periodically while the chart is mounted */
  let nowRefreshInterval: ReturnType<typeof setInterval> | null = null;

  /** If wall clock is far past API query end, don’t stretch the x-axis to “now” (avoids a huge empty gap when stats haven’t been refetched). */
  const STALE_QUERY_MS = 90_000;

  // Chart configuration
  function createChartConfig(): ChartConfiguration<"line"> {
    return {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: chartLabel,
            data: [],
            borderColor: "#3b82f6",
            backgroundColor: "rgba(163, 165, 153, 0.4)",
            borderWidth: 2,
            fill: true,
            tension: 0.1,
            pointStyle: false,
          },
          {
            label: "Current Bucket",
            data: [],
            borderColor: "#88a550",
            backgroundColor: "rgba(137, 165, 80, 0.6)",
            borderWidth: 2,
            fill: true,
            tension: 0.1,
            pointStyle: false,
          },
          {
            label: "Previous Bucket",
            data: [],
            borderColor: "#F47D4A",
            backgroundColor: "rgba(244, 125, 74, .6)",
            borderWidth: 2,
            fill: true,
            tension: 0.1,
            pointStyle: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: "nearest",
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            titleColor: "white",
            bodyColor: "white",
            borderColor: "#3b82f6",
            borderWidth: 1,
            position: "nearest",
            callbacks: {
              title: function (context) {
                const timestamp = context[0].parsed.x;
                return new Date(timestamp).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              },
              label: function (context) {
                if (context.datasetIndex === 0) {
                  return `Events: ${context.parsed.y.toLocaleString()}`;
                }
                // We have to return an empty string here to avoid the tooltip from showing the default label for the other datasets
                return "";
              },
            },
          },
          //   annotation: {
          //     annotations: {
          //       lastRead: {
          //         type: 'line' as const,
          //         borderColor: 'red',
          //         borderWidth: 1,
          //         scaleID: 'x',
          //         value: lastRead
          //       }
          //     }
          //   }
        },
        scales: {
          x: {
            bounds: 'data',
            type: "linear",
            // grid: {
            //   color: "rgba(128, 128, 128, 0.15)",
            // },
            ticks: {
              color: "#888888",
              maxTicksLimit: 7,
              callback: function (value) {
                return new Date(value).toLocaleTimeString(undefined, {
                  hourCycle: "h23",
                  hour: "2-digit",
                  minute: "2-digit",
                });
              },
              minRotation: 50,
              maxRotation: 60,
            },
          },
          y: {
            type: 'linear',
            grid: {
              color: "rgba(128, 128, 128, 0.15)",
            },
            ticks: {
              color: "#888888",
              callback: function (value) {
                return value.toLocaleString();
              },
            },
          },
        },
      },
    };
  }

  async function initChart() {
    if (!canvas) {
      return;
    }

    try {
      // Import Chart.js dynamically to avoid SSR issues
      const { Chart } = await import('chart.js/auto');
      Chart.register(annotationPlugin);
      
      const config = createChartConfig();
      chart = new Chart(canvas, config);
    } catch (error) {
      console.error('Failed to initialize chart:', error);
    }
  }

  function updateChart() {
    if (!chart || !data) {
      return;
    }

    
    const finiteOr = (n: number | undefined, fallback: number) =>
      typeof n === "number" && Number.isFinite(n) ? n : fallback;

    const rangeLo = effectiveRangeStart;
    const rangeHi = end;

    countInBucket = finiteOr(
      overrideCountInBucket,
      data.reduce((acc, point) => {
        if (point.time >= start && point.time <= rangeHi) {
          acc += Number(point.value) || 0;
        }
        return acc;
      }, 0)
    );
    totalCount = finiteOr(
      overrideTotal,
      data.reduce((acc, point) => {
        if (point.time >= rangeLo && point.time <= rangeHi) {
          acc += Number(point.value) || 0;
        }
        return acc;
      }, 0)
    );
    countInLastBucket = finiteOr(
      overrideCountInLastBucket,
      data.reduce((acc, point) => {
        if (point.time >= lastBucket && point.time < start) {
          acc += Number(point.value) || 0;
        }
        return acc;
      }, 0)
    );
    // Convert to Chart.js format
    const chartJsData = data.map((point: DashboardStatsValue) => ({
      x: point.time,
      y: point.value || 0
    }));

    chart.data.labels = data.map((d: DashboardStatsValue) => d.time);
    chart.data.datasets[0].data = chartJsData;

    // Each bucket dataset includes the boundary point from the adjacent bucket
    // so the filled area reaches the transition — no visual gaps.
    // Previous bucket extends back to include last point before lastBucket.
    // Current bucket extends back to include last point before start.
    // No double-overlap: previous stops strictly before start.
    const sorted = [...chartJsData].sort((a, b) => a.x - b.x);

    const lastBeforeCurrent = sorted.filter((p) => p.x < start).pop();
    const currentPoints = sorted.filter((p) => p.x >= start && p.x <= end);
    if (lastBeforeCurrent) currentPoints.unshift(lastBeforeCurrent);
    chart.data.datasets[1].data = currentPoints;

    const lastBeforePrev = sorted.filter((p) => p.x < lastBucket).pop();
    const prevPoints = sorted.filter((p) => p.x >= lastBucket && p.x < start);
    if (lastBeforePrev) prevPoints.unshift(lastBeforePrev);
    chart.data.datasets[2].data = prevPoints;

    const nowMs = Date.now();
    const xScale = chart.options.scales!.x as { min?: number; max?: number };
    const annos: Record<string, unknown> = {};
    const queryStale = nowMs > rangeHi + STALE_QUERY_MS;

    if (chartJsData.length > 0) {
      const times = chartJsData.map((p) => p.x);
      // X domain: full query window + data. Extend to “now” only while the loaded snapshot is still fresh.
      xScale.min = Math.min(...times, rangeLo, lastBucket, start);
      xScale.max = queryStale
        ? Math.max(...times, rangeHi)
        : Math.max(...times, rangeHi, nowMs);
      if (!queryStale) {
        annos.nowLine = {
          type: "line",
          scaleID: "x",
          value: nowMs,
          borderColor: "rgba(239, 68, 68, 0.95)",
          borderWidth: 2,
        };
      }
      if (checkPointValue != null && Number.isFinite(checkPointValue)) {
        annos.checkPointValue = {
          type: "line",
          borderColor: "rgba(248, 113, 113, 0.7)",
          borderWidth: 1,
          borderDash: [4, 4],
          scaleID: "x",
          value: checkPointValue,
        };
      }
    } else {
      delete xScale.min;
      delete xScale.max;
    }

    chart.options.plugins!.annotation = { annotations: annos as any };

    chart.options!.scales!.y!.type = showLogarithmic ? 'logarithmic' : 'linear';
    chart.update('active');
  }

  // Re-run when stats refresh updates API bucket boundaries (start/end/currentBucketStart) even if `data` identity is unchanged.
  $effect(() => {
    if (!chart || !data) return;
    void start;
    void end;
    void range;
    void rangeStartProp;
    void lastBucket;
    void effectiveRangeStart;
    void checkPointValue;
    void overrideTotal;
    void overrideCountInBucket;
    void overrideCountInLastBucket;
    void showLogarithmic;
    setTimeout(() => {
      updateChart();
    }, 0);
  });

  function refreshNowLine() {
    if (!chart?.options?.plugins?.annotation) return;
    const annos = chart.options.plugins.annotation.annotations as Record<string, any>;
    const nowMs = Date.now();
    const xScale = chart.options.scales!.x as { min?: number; max?: number };
    const rangeHi = end;
    const queryStale = nowMs > rangeHi + STALE_QUERY_MS;

    if (queryStale) {
      if (annos?.nowLine) delete annos.nowLine;
      const ds0 = chart.data.datasets[0]?.data as { x: number }[] | undefined;
      const times = ds0?.map((p) => p.x) ?? [];
      if (times.length > 0 && Number.isFinite(rangeHi)) {
        xScale.max = Math.max(...times, rangeHi);
      }
      chart.update("none");
      return;
    }

    if (!annos?.nowLine) {
      annos.nowLine = {
        type: "line",
        scaleID: "x",
        value: nowMs,
        borderColor: "rgba(239, 68, 68, 0.95)",
        borderWidth: 2,
      };
    } else {
      annos.nowLine.value = nowMs;
    }
    if (typeof xScale.max === "number" && nowMs > xScale.max) {
      xScale.max = nowMs;
    }
    chart.update("none");
  }

  onMount(() => {
    initChart();
    nowRefreshInterval = setInterval(refreshNowLine, 30_000);
  });

  onDestroy(() => {
    if (nowRefreshInterval) {
      clearInterval(nowRefreshInterval);
      nowRefreshInterval = null;
    }
    if (chart) {
      chart.destroy();
      chart = null;
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
               <!-- <div class="text-lg font-bold">Total Events</div> -->
               <div class="text-lg text-blue-500 font-bold">{formatTotal ? formatTotal(totalCount) : totalCount.toLocaleString()}</div>
               <HelpTooltip helpText="Total for the query window shown (start–end). The red “now” line only appears while stats are fresh; the dashboard refetches periodically so the window stays current." help={true}/>
           </div>
           <div class="flex items-center justify-center">
              <div class="text-[10px] text-muted-foreground font-medium">{humanRangeStart}–{humanEnd}</div>
            </div>
           <Separator/>
           <div class="flex items-center justify-center gap-2 h-full">
             <div class="text-lg text-[#F47D4A] font-bold">{formatTotal ? formatTotal(countInLastBucket) : countInLastBucket.toLocaleString()}</div>
             <HelpTooltip helpText="The number of events in the last bucket." help={true}/>
           </div>
           <div class="flex items-center justify-center">
                <div class="text-[10px] text-muted-foreground font-medium">{humanLastBucket}-{humanStart}</div>
           </div>
           <Separator/>
           <div class="flex items-center justify-center gap-2 h-full">
               <!-- <div class="text-lg font-bold">Events In Last Bucket</div> -->
               <div class="text-lg text-[#88a550] font-bold">{formatTotal ? formatTotal(countInBucket) : countInBucket.toLocaleString()}</div>
               <HelpTooltip helpText="The number of events in the current bucket." help={true}/>
           </div>
           <div class="flex items-center justify-center">
                <div class="text-[10px] text-muted-foreground font-medium">{humanStart}-{humanEnd}</div>
            </div>
       </div>
   </div>
   <Separator orientation="vertical" class="h-full"/>
        <div class="p-2 shadow-sm w-3/4 h-full overflow-hidden">
          <canvas bind:this={canvas} class="w-full h-full max-w-full max-h-full"></canvas>
        </div>
    </div>
</div>
