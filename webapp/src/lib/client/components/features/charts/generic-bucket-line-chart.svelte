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
    start: number;
    end: number;
    checkPointValue?: number;
    chartOptions?: ChartOptions;
  }

  let { data, range, start, end, chartLabel, checkPointValue, chartOptions }: Props = $props();
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
            tension: 0.3,
            pointStyle: false,
          },
          {
            label: "Current Bucket",
            data: [],
            borderColor: "#88a550",
            backgroundColor: "rgba(137, 165, 80, 0.6)",
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointStyle: false,
          },
          {
            label: "Previous Bucket",
            data: [],
            borderColor: "#F47D4A",
            backgroundColor: "rgba(244, 125, 74, .6)",
            borderWidth: 2,
            fill: true,
            tension: 0.3,
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
            //   color: "rgba(0, 0, 0, 0.1)",
            // },
            ticks: {
              color: "#6b7280",
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
              color: "rgba(0, 0, 0, 0.1)",
            },
            ticks: {
              color: "#6b7280",
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

    
    countInBucket = data.reduce((acc, point) => {
      if(point.time >= start) {
        acc += (point.value || 0);
      }
      return acc;
    }, 0);
    totalCount = data.reduce((acc, point) => acc + point.value, 0);
    countInLastBucket = data.reduce((acc, point) => {
      if(point.time >= lastBucket && point.time < start) {
        acc += (point.value || 0);
      }
      return acc;
    }, 0);
    // Convert to Chart.js format
    const chartJsData = data.map((point: DashboardStatsValue) => ({
      x: point.time,
      y: point.value || 0
    }));

    chart.data.labels = data.map((d: DashboardStatsValue) => d.time);
    chart.data.datasets[0].data = chartJsData;
    chart.data.datasets[1].data = chartJsData.filter((p) => p.x >= start && p.x <= end);
    chart.data.datasets[2].data = chartJsData.filter((p) => p.x >= lastBucket && p.x <= start);
    
    // Update the annotation with the new lastRead value
    if(checkPointValue) {
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
        chart.options.plugins!.annotation = {
            annotations: {
                checkPointValue: {
                    type: 'line',
                    borderColor: 'red',
                    borderWidth: 1,
                    scaleID: 'x',
                    value: checkPointValue

                }
            }
        }
        
        
    }
    chart.options!.scales!.y!.type = showLogarithmic ? 'logarithmic' : 'linear';
    chart.update('active');
  }

  // Watch for chart and data changes
  $effect(() => {
    if (chart && data) {
      // Add a small delay to ensure the chart updates properly
      setTimeout(() => {
        updateChart();
      }, 0);
    }
  });

  // Watch for logarithmic scale changes
  $effect(() => {
    if (chart && data) {
      const _showLogarithmic = showLogarithmic;
      setTimeout(() => {
        updateChart();
      }, 0);
    }
  });

  // Watch for checkPointValue changes specifically
  $effect(() => {
    if (chart && checkPointValue) {
      // Update the annotation when checkPointValue changes
      const annotations = chart.options.plugins?.annotation?.annotations as any;
      if (annotations?.checkPointValue) {
        annotations.checkPointValue.value = checkPointValue;
        chart.update('active');
      }
    }
  });

  onMount(() => {
    initChart();
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
      chart = null;
    }
  });
</script>

<div class="flex flex-col h-full">
    <div class="flex flex-row justify-between">
      <h2 class="text-xl font-semibold text-gray-700 mb-2">{chartLabel}</h2>
      {#if chartOptions}
        <ChartOptionsMenu chartOptions={chartOptions} bind:logSwitch={showLogarithmic} />
      {/if}
    </div>
    <div class="flex flex-row bg-slate-100 w-full h-full overflow-hidden">
     <div class="p-2 shadow-sm w-1/4 h-full overflow-hidden">
       <div class="flex flex-col justify-between h-full">
           <div class="flex items-center justify-center gap-2 h-full">
               <!-- <div class="text-lg font-bold">Total Events</div> -->
               <div class="text-lg text-blue-500 font-bold">{totalCount.toLocaleString()}</div>
               <HelpTooltip helpText="The total number of events in the queue for the time range displayed." help={true}/>
           </div>
           <Separator/>
           <div class="flex items-center justify-center gap-2 h-full">
             <div class="text-lg text-[#F47D4A] font-bold">{countInLastBucket.toLocaleString()}</div>
             <HelpTooltip helpText="The number of events in the last bucket." help={true}/>
           </div>
           <div class="flex items-center justify-center">
                <div class="text-xs font-bold">{humanLastBucket}-{humanStart}</div>
           </div>
           <Separator/>
           <div class="flex items-center justify-center gap-2 h-full">
               <!-- <div class="text-lg font-bold">Events In Last Bucket</div> -->
               <div class="text-lg text-[#88a550] font-bold">{countInBucket.toLocaleString()}</div>
               <HelpTooltip helpText="The number of events in the current bucket." help={true}/>
           </div>
           <div class="flex items-center justify-center">
                <div class="text-xs font-bold">{humanStart}-{humanEnd}</div>
            </div>
       </div>
   </div>
   <Separator orientation="vertical" class="h-full"/>
        <div class="p-2 shadow-sm w-3/4 h-full overflow-hidden">
          <canvas bind:this={canvas} class="w-full h-full max-w-full max-h-full"></canvas>
        </div>
    </div>
</div>
