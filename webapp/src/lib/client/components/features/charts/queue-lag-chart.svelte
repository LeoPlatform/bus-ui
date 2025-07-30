<script lang="ts">
  import type { DashboardStats, DashboardStatsValue, StatsRange } from "$lib/types";
  import { humanize } from "$lib/utils";
  import type { ChartConfiguration } from "chart.js/auto";
  import Chart from "chart.js/auto";
  import { onDestroy, onMount } from "svelte";
  import { Separator } from "../../ui/separator";
  import HelpTooltip from "../../help-tooltip.svelte";


    interface Props {
        data: DashboardStats | null;
        queueId: string;
    }

    let { data, queueId }: Props = $props();

    let canvas: HTMLCanvasElement;
    let chart = $state<Chart | null>(null);
    let currentSourceLag = $state<number>(0);
    let currentQueueLag = $state<number>(0);

    function createChartConfig(): ChartConfiguration<'line'> {
        return {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Source Lag',
                        data: [],
                        fill: false,
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        tension: 0.1,
                        pointStyle: false,
                    },
                    {
                        label: 'Queue Lag',
                        data: [],
                        fill: false,
                        borderColor: '#ef4444',
                        borderWidth: 1,
                        tension: 0.1,
                        pointStyle: false,
                    }
                ]
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
                        display: true
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
                                return `${humanize(context.parsed.y)}`;
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
                        type: 'linear',
                        // beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6b7280',
                            callback: function(value) {
                                return humanize(value as number);
                            }
                        }
                    }
                }
            }
        }
    }

    function processChartData(dashboardStats: DashboardStats | null): { sourceLagData: DashboardStatsValue[], queueLagData: DashboardStatsValue[] } {
        if(!dashboardStats || !dashboardStats.queues.read || !dashboardStats.queues.read?.[queueId] || (!dashboardStats.queues.read?.[queueId]?.source_lags && !dashboardStats.queues.read?.[queueId]?.queue_lags)) {
            return { sourceLagData: [], queueLagData: [] };
        }

        // const queueLagData = dashboardStats.queues.read[queueId].lags;
        const sourceLagData = dashboardStats.queues.read[queueId].source_lags.sort((a, b) => a.time - b.time);
        const queueLagData = dashboardStats.queues.read[queueId].queue_lags.sort((a, b) => a.time - b.time);

        currentSourceLag = sourceLagData[sourceLagData.length - 1].value;
        currentQueueLag = queueLagData[queueLagData.length - 1].value;
        
        return { sourceLagData, queueLagData };
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
            return
        }

        const chartData = processChartData(data);
        chart.data.labels = chartData.sourceLagData.map((d: DashboardStatsValue) => d.time);
        chart.data.datasets[0].data = chartData.sourceLagData.map((d: DashboardStatsValue) => d.value || 0);
        chart.data.datasets[1].data = chartData.queueLagData.map((d: DashboardStatsValue) => d.value || 0);
        chart.update('active');
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
    <h2 class="text-xl font-semibold text-gray-700 mb-2">Queue and Source Lag</h2>
    <div class="flex flex-row bg-slate-100 w-full h-full overflow-hidden">
        <div class="p-2 shadow-sm w-1/4 h-full overflow-hidden">
            <div class="flex flex-col gap-2 justify-between h-full">
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
            </div>
        </div>
        <Separator orientation="vertical" class="h-full"/>
        <div class="p-2 shadow-sm w-3/4 h-full overflow-hidden">
          <canvas bind:this={canvas} class="w-full h-full max-w-full max-h-full"></canvas>
        </div>
    </div>
</div>