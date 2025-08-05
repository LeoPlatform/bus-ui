<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Chart, ChartConfiguration } from 'chart.js/auto';
  import type { DashboardStats, DashboardStatsValue, StatsRange } from '$lib/types';
  import  annotationPlugin  from 'chartjs-plugin-annotation';
  import HelpTooltip from '../../help-tooltip.svelte';
  import { bucketsData, ranges } from '$lib/bucketUtils';
  import { Separator } from '../../ui/separator';

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
  let lastRead = $derived(data?.queues?.read?.[queueId]?.last_read_event_timestamp || 0);
  let totalEvents = $state<number>(0);
  let eventsInBucket = $state<number>(0);
  let eventsLastBucket = $state<number>(0);
  let rangeData = $derived(ranges[range].rolling ? ranges[range].rolling! : ranges[range]);
  let bucket = $derived(bucketsData[rangeData.period]);

  let lastBucket = $derived(bucket.prev(new Date(start), rangeData.count).valueOf());

  // Chart configuration
  function createChartConfig(): ChartConfiguration<'line'> {
    return {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Events In Queue',
          data: [],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(163, 165, 153, 0.4)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointStyle: false,
        },
        {
          label: 'Current Bucket',
          data: [],
          borderColor: '#88a550',
          backgroundColor: 'rgba(137, 165, 80, 0.6)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointStyle: false,
        },
        {
          label: 'Previous Bucket',
          data: [],
          borderColor: '#F47D4A',
          backgroundColor: 'rgba(244, 125, 74, .6)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointStyle: false,
        }
      ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'nearest'
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
            position: 'nearest',
            callbacks: {
              title: function(context) {
                const timestamp = context[0].parsed.x;
                return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
              },
              label: function(context) {
                if(context.datasetIndex === 0) {
                  return `Events: ${context.parsed.y.toLocaleString()}`;
                }
                // We have to return an empty string here to avoid the tooltip from showing the default label for the other datasets
                return '';
              }
            }
          },
          annotation: {
            annotations: {
              lastRead: {
                type: 'line' as const,
                borderColor: 'red',
                borderWidth: 1,
                scaleID: 'x',
                value: lastRead
              }
            }
          }
          
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
            }
          },
          y: {
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
        elements: {
          point: {
            hoverRadius: 4
          }
        }
      }
    };
  }

  // Process data for chart - extract read data from queues
  function processChartData(dashboardStats: DashboardStats | null): DashboardStatsValue[] {
    if (!dashboardStats || !dashboardStats.queues) {
      return [];
    }

    // Look for read data in queues
    const readData: DashboardStatsValue[] = [];
    
    // Check if there are any read operations in the queues
    if (dashboardStats.queues.read) {
      Object.values(dashboardStats.queues.read).forEach((queueData) => {
        if (queueData.values && queueData.values.length > 0) {
          readData.push(...queueData.values);
        }
      });
    }

    // If no read data found, return empty array
    if (readData.length === 0) {
        console.log('EventsInQueueChart - no read data found bailing');
      return [];
    }

    // Sort by time and return
    return readData.sort((a, b) => a.time - b.time);
  }

  // Initialize chart
  async function initChart() {
    console.log('EventsInQueueChart - initChart called');
    if (!canvas) {
      console.log('EventsInQueueChart - no canvas, returning');
      return;
    }

    try {
      // Import Chart.js dynamically to avoid SSR issues
      const { Chart } = await import('chart.js/auto');
      Chart.register(annotationPlugin);
      
      const config = createChartConfig();
      chart = new Chart(canvas, config);
    } catch (error) {
      console.error('EventsInQueueChart - Failed to initialize chart:', error);
    }
  }

  // Update chart data
  function updateChart() {
    if (!chart) {
      return;
    }

    const chartData = processChartData(data);
    eventsInBucket = chartData.reduce((acc, point) => {
      if(point.time >= start) {
        acc += (point.value || 0);
      }
      return acc;
    }, 0);
    totalEvents = chartData.reduce((acc, point) => acc + point.value, 0);
    eventsLastBucket = chartData.reduce((acc, point) => {
      if(point.time >= lastBucket && point.time < start) {
        acc += (point.value || 0);
      }
      return acc;
    }, 0);
    // Convert to Chart.js format
    const chartJsData = chartData.map((point: DashboardStatsValue) => ({
      x: point.time,
      y: point.value || 0
    }));

    chart.data.labels = chartData.map((d: DashboardStatsValue) => d.time);
    chart.data.datasets[0].data = chartJsData;
    chart.data.datasets[1].data = chartJsData.filter((p) => p.x >= start && p.x <= end);
    chart.data.datasets[2].data = chartJsData.filter((p) => p.x >= lastBucket && p.x <= start);
    
    // Update the annotation with the new lastRead value
    const annotations = chart.options.plugins?.annotation?.annotations as any;
    if (annotations?.lastRead) {
      annotations.lastRead.value = lastRead;
    }
    
    chart.update('active');
  }

  // Watch for chart and data changes
  $effect(() => {
    console.log('EventsInQueueChart - effect triggered - chart:', !!chart, 'data:', !!data);
    if (chart && data) {
      console.log('EventsInQueueChart - updating chart');
      updateChart();
    }
  });

  // Watch for lastRead changes specifically
  $effect(() => {
    console.log('EventsInQueueChart - lastRead changed to:', lastRead);
    if (chart) {
      // Update the annotation when lastRead changes
      const annotations = chart.options.plugins?.annotation?.annotations as any;
      if (annotations?.lastRead) {
        annotations.lastRead.value = lastRead;
        chart.update('active');
      }
    }
  });

  onMount(() => {
    console.log('EventsInQueueChart - onMount called');
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
     <h2 class="text-xl font-semibold text-gray-700 mb-2">Events in Queue</h2>
     <div class="flex flex-row bg-slate-100 w-full h-full overflow-hidden">
      <div class="p-2 shadow-sm w-1/4 h-full overflow-hidden">
        <div class="flex flex-col gap-2 justify-between h-full">
            <div class="flex items-center justify-center gap-2 h-full">
                <!-- <div class="text-lg font-bold">Total Events</div> -->
                <div class="text-lg text-blue-500 font-bold">{totalEvents.toLocaleString()}</div>
                <HelpTooltip helpText="The total number of events in the queue for the time range displayed." help={true}/>
            </div>
            <Separator/>
            <div class="flex items-center justify-center gap-2 h-full">
              <div class="text-lg text-[#F47D4A] font-bold">{eventsLastBucket.toLocaleString()}</div>
              <HelpTooltip helpText="The number of events in the last bucket." help={true}/>
            </div>
            <Separator/>
            <div class="flex items-center justify-center gap-2 h-full">
                <!-- <div class="text-lg font-bold">Events In Last Bucket</div> -->
                <div class="text-lg text-[#88a550] font-bold">{eventsInBucket.toLocaleString()}</div>
                <HelpTooltip helpText="The number of events in the current bucket." help={true}/>
            </div>
        </div>
    </div>
    <Separator orientation="vertical" class="h-full"/>
         <div class="p-2 shadow-sm w-3/4 h-full overflow-hidden">
           <canvas bind:this={canvas} class="w-full h-full max-w-full max-h-full"></canvas>
         </div>
     </div>
 </div>

