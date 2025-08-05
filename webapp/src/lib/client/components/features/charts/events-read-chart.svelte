<script lang="ts">
  import type { DashboardStats, DashboardStatsValue, StatsRange } from "$lib/types";
  import type { ChartConfiguration, Chart } from "chart.js/auto";
  import { onDestroy, onMount } from "svelte";
  import { Separator } from "../../ui/separator";
  import { bucketsData, getStartAndEndOfBucket, ranges } from "$lib/bucketUtils";
  import HelpTooltip from "../../help-tooltip.svelte";

  interface Props {
    data: DashboardStats | null;
    queueId: string;
    range: StatsRange;
    start: number;
    end: number;
  }

  let { data, queueId, range, start, end }: Props = $props();

  let canvas: HTMLCanvasElement;
  let chart = $state<Chart | null>(null);
  let eventsReadInBucket = $state<number>(0);
  let lastDataHash = $state<string>('');

  let rangeData = $derived(ranges[range].rolling ? ranges[range].rolling! : ranges[range]);
  let bucket = $derived(bucketsData[rangeData.period]);

  let lastBucket = $derived(bucket.prev(new Date(start), rangeData.count).valueOf());

  function createChartConfig(): ChartConfiguration<"line"> {
    return {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Events Read",
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
          mode: 'index'
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: 'white',
            bodyColor: 'white',
            borderColor: '#3b82f6',
            borderWidth: 1,
            callbacks: {
              title: function(context) {
                const timestamp = context[0].parsed.x;
                return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
              },
              label: function(context) {
                return `Events: ${context.parsed.y.toLocaleString()}`;
              }
            }
          },
        },
        scales: {
          x: {
            type: 'linear',
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
              color: '#6b7280',
              maxTicksLimit: 10,
              callback: function(value) {
                return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
              }
            },
            offset: false,
          },
          y: {
            type: 'linear',
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
              color: '#6b7280',
              callback: function(value) {
                return value.toLocaleString();
              }
            }
          }
        },
      },
    };
  }

  function processChartData(dashboardStats: DashboardStats | null): { chartData: DashboardStatsValue[], bucketCount: number } {
    if (!dashboardStats || !dashboardStats.queues) {
      return { chartData: [], bucketCount: 0 };
    }

    console.log('start', start);
    console.log('end', end);

    const eventsRead: DashboardStatsValue[] = [];
    let bucketCount = 0;

    if(dashboardStats.queues.read && dashboardStats.queues.read[queueId] && dashboardStats.queues.read[queueId].reads) {
        for (const readValue of dashboardStats.queues.read[queueId].reads) {
            eventsRead.push(readValue);
            if(readValue.time >= start) {
                bucketCount += readValue.value;
            }
        }
    }

    return { 
      chartData: eventsRead.sort((a, b) => a.time - b.time),
      bucketCount 
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

    const { chartData, bucketCount } = processChartData(data);
    
    // Update chart data
    chart.data.labels = chartData.map((d: DashboardStatsValue) => d.time);
    chart.data.datasets[0].data = chartData.map((d: DashboardStatsValue) => d.value || 0);
    chart.update('active');
    
    // Update bucket count
    eventsReadInBucket = bucketCount;
  }

  $effect(() => {
    if(chart && data) {
      // Create a hash of the data to check if it actually changed
      const dataHash = JSON.stringify({ data, queueId, range });
      if (dataHash !== lastDataHash) {
        lastDataHash = dataHash;
        updateChart();
      }
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
    <h2 class="text-xl font-semibold text-gray-700 mb-2">Events Read</h2>
    <div class="flex flex-row bg-slate-100 w-full h-full overflow-hidden">
        <div class="p-2 shadow-sm w-1/4 h-full overflow-hidden">
            <div class="flex flex-col gap-2 justify-between h-full">
                <div class="flex items-center justify-center gap-2 h-full">
                    <div class="text-lg font-bold">{eventsReadInBucket}</div>
                    <HelpTooltip helpText="The number of events read from the queue in the current time bucket." info={true}/>
                </div>
            </div>
            <!-- <div class="flex flex-col gap-2 justify-between h-full">
                <div class="flex items-center justify-center gap-2 h-full">
                    <div class="text-lg font-bold">Source Lag</div>
                    <div class="text-lg text-blue-500 font-bold">{humanize(currentSourceLag)}</div>
                    <HelpTooltip helpText="The lag between the source and the queue." help={true}/>
                </div>
                <Separator/>
                <div class="flex items-center justify-center gap-2 h-full">
                    <div class="text-lg font-bold">Queue Lag</div>
                    <div class="text-lg text-red-500 font-bold">{humanize(currentQueueLag)}</div>
                    <HelpTooltip helpText="The lag within the queue processing." help={true}/>
                </div>
            </div> -->
        </div>
        <Separator orientation="vertical" class="h-full"/>
        <div class="p-2 shadow-sm w-3/4 h-full overflow-hidden">
          <canvas bind:this={canvas} class="w-full h-full max-w-full max-h-full"></canvas>
        </div>
    </div>
</div>