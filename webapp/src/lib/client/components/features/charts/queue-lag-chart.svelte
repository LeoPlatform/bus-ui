<script lang="ts">
  import type { DashboardStats, DashboardStatsValue, StatsRange } from "$lib/types";
  import { humanize } from "$lib/utils";
  import type { ChartConfiguration } from "chart.js/auto";
  import Chart from "chart.js/auto";
  import { onDestroy, onMount } from "svelte";
  import { Separator } from "../../ui/separator";
  import HelpTooltip from "../../help-tooltip.svelte";
  import type { ChartOptions } from "../chart-details-pane/types";
  import ChartOptionsMenu from "./chart-options.svelte";
  import { createDataSet, type RegressionType } from "./regression";


    interface Props {
        data: DashboardStats | null;
        queueId: string;
        chartOptions?: ChartOptions;
    }

    let { data, queueId, chartOptions }: Props = $props();

    let canvas: HTMLCanvasElement;
    let chart = $state<Chart | null>(null);
    let currentSourceLag = $state<number>(0);
    let currentQueueLag = $state<number>(0);    
    let showLogarithmic = $state<boolean>(false);
    let trendLineType = $state<RegressionType | undefined>('linear');
    let bestFit = $state<boolean>(false);
    


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
                        borderWidth: 2,
                        tension: 0.3,
                        pointStyle: false,
                        xAxisID: 'x',
                    },
                    {
                        label: 'Queue Lag',
                        data: [],
                        fill: false,
                        borderColor: '#ef4444',
                        borderWidth: 2,
                        tension: 0.3,
                        pointStyle: false,
                        xAxisID: 'x',
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
                        bounds: 'data',
                        type: 'linear',
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6b7280',
                            maxTicksLimit: 10,
                            callback: function(value) {
                                return new Date(value).toLocaleTimeString(undefined, { hourCycle: 'h23', hour: '2-digit', minute: '2-digit' });
                            },
                            minRotation: 50,
                            maxRotation: 60,
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

        currentSourceLag = [...sourceLagData].reverse().find(d => d.value !== 0)?.value ?? 0;
        currentQueueLag = [...queueLagData].reverse().find(d => d.value !== 0)?.value ?? 0;
        
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
        chart.options!.scales!.y!.type = showLogarithmic ? 'logarithmic' : 'linear';

        // Only create trend line if either trendLineType or bestFit is selected
        if (trendLineType || bestFit) {
            const datasetOptions: any = {
                data: chartData.sourceLagData,
                offset: -10,
                label: chartOptions?.trendLineLabel,
            };
            
            if (trendLineType) {
                datasetOptions.type = trendLineType;
            }
            
            if (bestFit === true) {
                datasetOptions.bestFit = true;
            }
            

            chart.data.datasets[2] = createDataSet(datasetOptions);
        } else {
            // Remove trend line dataset if neither is selected
            if (chart.data.datasets.length > 2) {
                chart.data.datasets = chart.data.datasets.slice(0, 2);
            }
        }
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
    <div class="flex flex-row justify-between">
        <h2 class="text-xl font-semibold text-gray-700 mb-2">Queue and Source Lag</h2>
        <!-- <div class="flex flex-row items-center gap-2">
            <Label for="logarithmic-switch">Log Scaling</Label>
            <Switch id="logarithmic-switch" bind:checked={showLogarithmic} on:change={updateChart} />
        </div> -->
        {#if chartOptions}
            <ChartOptionsMenu chartOptions={chartOptions} bind:logSwitch={showLogarithmic} bind:regressionType={trendLineType} bind:bestFit={bestFit}/>
        {/if}
    </div>
    <div class="flex flex-row bg-slate-100 w-full h-full overflow-hidden">
        <div class="p-2 shadow-sm w-1/4 h-full overflow-hidden">
            <div class="flex flex-col gap-2 justify-between h-full">
                <div class="flex items-center justify-center gap-2 h-full">
                    <div class="text-md font-bold">Source Lag</div>
                    <div class="text-md text-blue-500 font-bold">{humanize(currentSourceLag)}</div>
                    <HelpTooltip helpText="The lag between the source and the queue." help={true}/>
                </div>
                <Separator/>
                <div class="flex items-center justify-center gap-2 h-full">
                    <div class="text-md font-bold">Queue Lag</div>
                    <div class="text-md text-red-500 font-bold">{humanize(currentQueueLag)}</div>
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