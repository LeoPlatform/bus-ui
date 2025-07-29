<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Chart, ChartConfiguration } from 'chart.js/auto';
  import type { DashboardStats, DashboardStatsValue } from '$lib/types';
  import  annotationPlugin  from 'chartjs-plugin-annotation';
  import HelpTooltip from '../../help-tooltip.svelte';

  interface Props {
    data: DashboardStats | null;
    queueId: string;
    lastReadTimestamp?: number;
    width?: number;
    height?: number;
  }

  let { data, queueId, lastReadTimestamp, width = 400, height = 200 }: Props = $props();

  console.log('EventsInQueueChart - Component initialized');
  console.log('EventsInQueueChart - data prop:', data);
  console.log('EventsInQueueChart - data type:', typeof data);
  console.log('EventsInQueueChart - data keys:', data ? Object.keys(data) : 'null');

  let canvas: HTMLCanvasElement;
  let chart = $state<Chart | null>(null);
  let lastRead = $derived(data?.queues?.read?.[queueId]?.last_read_event_timestamp || 0);
  let totalEvents = $state<number>(0);

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
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#3b82f6'
        }]
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
    console.log('EventsInQueueChart - processChartData called');
    console.log('EventsInQueueChart - processing chart data', dashboardStats);
    if (!dashboardStats || !dashboardStats.queues) {
        console.log('EventsInQueueChart - no dashboard stats or queues bailing');
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
      console.log('EventsInQueueChart - importing Chart.js');
      // Import Chart.js dynamically to avoid SSR issues
      const { Chart } = await import('chart.js/auto');
      Chart.register(annotationPlugin);
      
      console.log('EventsInQueueChart - creating chart config');
      const config = createChartConfig();
      console.log('EventsInQueueChart - creating chart instance');
      chart = new Chart(canvas, config);
      console.log('EventsInQueueChart - chart created successfully');
      console.log('EventsInQueueChart - chart variable after assignment:', !!chart);
    } catch (error) {
      console.error('EventsInQueueChart - Failed to initialize chart:', error);
    }
  }

  // Update chart data
  function updateChart() {
    console.log('EventsInQueueChart - updateChart called');
    if (!chart) {
      console.log('EventsInQueueChart - no chart instance, returning');
      return;
    }

    console.log('EventsInQueueChart - calling processChartData');
    const chartData = processChartData(data);
    totalEvents = chartData.reduce((acc, point) => {
      if(point.time >= lastRead) {
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
         <div class="text-lg text-black mt-2 font-bold w-1/4 flex items-center justify-center gap-2">
           <div>{totalEvents.toLocaleString()}</div>
           <HelpTooltip helpText="The approximate total number of events in the queue remaining to be processed." info={true} side="bottom"/>
         </div>
         <div class="p-2 shadow-sm w-3/4 h-full overflow-hidden">
           <canvas bind:this={canvas} class="w-full h-full max-w-full max-h-full"></canvas>
         </div>
     </div>
 </div>

