<script lang="ts">
  import type { DashboardStatsValue } from "$lib/types";
  import type { Chart, ChartConfiguration } from "chart.js/auto";
  import annotationPlugin from "chartjs-plugin-annotation";
  import { onDestroy, onMount } from "svelte";
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

  let { data, dataSetLabel, tooltipLabel, helpText, dataIsTimeBased = false, includeFullCount = false, includeCurrentValue = false, chartOptions }: Props = $props();

  let canvas: HTMLCanvasElement | null = $state(null);
  let chart = $state<Chart | null>(null);

    let fullCount: number | undefined = $state(undefined);
    let currentValue: number | undefined = $state(undefined);
    let showTrendLine = $state(false);
    let showLogarithmic = $state(false);

  let nowRefreshInterval: ReturnType<typeof setInterval> | null = null;

  function createChartConfig(): ChartConfiguration<"line"> {
    return {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: dataSetLabel,
            data: [],
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderWidth: 2,
            fill: false,
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
            callbacks: {
              title: function (context) {
                const timestamp = context[0].parsed.x;
                return new Date(timestamp).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              },
              label: function (context) {
                return `${tooltipLabel}: ${dataIsTimeBased ? humanize(context.parsed.y) : context.parsed.y.toLocaleString()}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            bounds: 'data',
            grid: {
              color: "rgba(0, 0, 0, 0.1)",
            },
            ticks: {
              color: "#6b7280",
              maxTicksLimit: 10,
              callback: function (value) {
                return new Date(value).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              },
            },
          },
          y: {
            type: "linear",
            beginAtZero: true,
            grid: {
              color: "rgba(0, 0, 0, 0.1)",
            },
            ticks: {
              color: "#6b7280",
              callback: function (value) {
                return dataIsTimeBased ? humanize(value as number) : value.toLocaleString();
              },
            },
          },
        },
      },
    };
  }

  async function initChart() {
    if(!canvas) {
        return;
    }
    try {
        const { Chart } = await import('chart.js/auto');
        Chart.register(annotationPlugin);
        chart = new Chart(canvas, createChartConfig());
    } catch (error) {
        console.error('Error initializing chart:', error);
    }
  }

  function updateChart() {
    if (!chart) {
        return;
    }

    const xScale = chart.options!.scales!.x as { min?: number; max?: number };

    if (!data?.length) {
      chart.data.labels = [];
      chart.data.datasets[0].data = [];
      delete xScale.min;
      delete xScale.max;
      chart.options!.plugins!.annotation = { annotations: {} };
      chart.options!.scales!.y!.type = showLogarithmic ? "logarithmic" : "linear";
      chart.update("active");
      return;
    }

    const pts = data.map((d: DashboardStatsValue) => ({ x: d.time, y: d.value || 0 }));
    chart.data.labels = [];
    chart.data.datasets[0].data = pts as any;

    const nowMs = Date.now();
    const xs = pts.map((p) => p.x);
    xScale.min = Math.min(...xs, nowMs);
    xScale.max = Math.max(...xs, nowMs);

    chart.options!.plugins!.annotation = {
      annotations: {
        nowLine: {
          type: "line",
          scaleID: "x",
          value: nowMs,
          borderColor: "rgba(239, 68, 68, 0.95)",
          borderWidth: 2,
        },
      },
    };

    chart.options!.scales!.y!.type = showLogarithmic ? "logarithmic" : "linear";
    chart.update("active");

    if (includeFullCount) {
        fullCount = data.reduce((acc, d) => acc + (d.value || 0), 0);
    }

    if (includeCurrentValue) {
        currentValue = data[data.length - 1]?.value;
    }
  }

  $effect(() => {
    if(chart && data) {
        updateChart();
    }
  });

  function refreshNowLine() {
    if (!chart?.options?.plugins?.annotation) return;
    const annos = chart.options.plugins.annotation.annotations as Record<string, { value?: number }>;
    if (!annos?.nowLine) return;
    const nowMs = Date.now();
    annos.nowLine.value = nowMs;
    const xScale = chart.options.scales!.x as { min?: number; max?: number };
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
    if(chart) {
        chart.destroy();
        chart = null;
    }
  });
</script>

<div class="flex flex-col h-full">
    <div class="flex flex-row justify-between">
      <h2 class="text-xl font-semibold text-gray-700 mb-2">{dataSetLabel}</h2>
      {#if chartOptions}
        <ChartOptionsMenu chartOptions={chartOptions} bind:logSwitch={showLogarithmic} />
      {/if}
    </div>
    <div class="flex flex-row bg-slate-100 w-full h-full overflow-hidden">
        {#if includeFullCount || includeCurrentValue}
            <div class="p-2 shadow-sm w-1/4 h-full overflow-hidden">
                <div class="flex flex-col gap-2 justify-between h-full">
                    <div class="flex items-center justify-center gap-2 h-full">
                        {#if dataIsTimeBased}
                            <div class="text-lg text-blue-500 font-bold">{humanize(includeFullCount ? fullCount || 0 : currentValue || 0)}</div>
                        {:else}
                            <div class="text-lg font-bold">{includeFullCount ? fullCount : currentValue}</div>
                        {/if}
                        <HelpTooltip helpText={helpText} info={true}/>
                    </div>
                </div>
            </div>
            <Separator orientation="vertical" class="h-full"/>
        {/if}
        <div class="p-2 shadow-sm w-{includeFullCount || includeCurrentValue ? '3/4' : 'full'} h-full overflow-hidden">
          <canvas bind:this={canvas} class="w-full h-full max-w-full max-h-full"></canvas>
        </div>
    </div>
</div>