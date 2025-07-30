<script lang="ts">
  import type { DashboardStatsValue } from "$lib/types";
  import type { Chart, ChartConfiguration } from "chart.js/auto";
  import { onDestroy, onMount } from "svelte";
  import HelpTooltip from "../../help-tooltip.svelte";
  import { Separator } from "../../ui/separator";
  import { humanize } from "$lib/utils";

  interface Props {
    data: DashboardStatsValue[];
    dataSetLabel: string;
    tooltipLabel: string;
    helpText: string;
    dataIsTimeBased?: boolean;
    includeFullCount?: boolean;
    includeCurrentValue?: boolean;
  }

  let { data, dataSetLabel, tooltipLabel, helpText, dataIsTimeBased = false, includeFullCount = false, includeCurrentValue = false }: Props = $props();

  let canvas: HTMLCanvasElement | null = $state(null);
  let chart = $state<Chart | null>(null);

    let fullCount: number | undefined = $state(undefined);
    let currentValue: number | undefined = $state(undefined);


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
          mode: "index",
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
    try {
        const { Chart } = await import('chart.js/auto');
        if(!canvas) {
            return;
        }

        chart = new Chart(canvas, createChartConfig());
    } catch (error) {
        console.error('Error initializing chart:', error);
    }
  }

  function updateChart() {
    if(!chart) {
        return;
    }

    chart.data.labels = data.map((d: DashboardStatsValue) => d.time);
    chart.data.datasets[0].data = data.map((d: DashboardStatsValue) => d.value || 0);
    chart.update('active');

    if(includeFullCount) {
        fullCount = data.reduce((acc, d) => acc + (d.value || 0), 0);
    }

    if(includeCurrentValue) {
        currentValue = data[data.length - 1].value;
    }
  }

  $effect(() => {
    if(chart && data) {
        updateChart();
    }
  });

  onMount(() => {
    initChart();
  });

  onDestroy(() => {
    if(chart) {
        chart.destroy();
        chart = null;
    }
  });
</script>

<div class="flex flex-col h-full">
    <h2 class="text-xl font-semibold text-gray-700 mb-2">{dataSetLabel}</h2>
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