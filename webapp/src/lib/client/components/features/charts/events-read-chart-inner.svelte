<script lang="ts">
  import * as Chart from "$lib/client/components/ui/chart/index";
  import { LineChart } from "layerchart";
  import { scaleTime, scaleLinear } from "d3-scale";
  import type { DashboardStatsValue } from "$lib/types";

  interface Props {
    chartData: DashboardStatsValue[];
  }

  let { chartData }: Props = $props();

  const rows = $derived(chartData.map((d) => ({ time: new Date(d.time), value: d.value || 0 })));

  const config = $derived({
    value: { label: "Events Read", color: "#3b82f6" },
  } satisfies Chart.ChartConfig);

  const formatTime = (value: Date | number) =>
    new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
</script>

<Chart.Container {config} class="h-full w-full">
  <LineChart
    data={rows}
    x="time"
    xScale={scaleTime()}
    y="value"
    yScale={scaleLinear()}
    yNice
    series={[{ key: "value", label: "Events Read", color: "#3b82f6" }]}
    props={{
      spline: { class: "stroke-2" },
      xAxis: { format: (v: Date) => formatTime(v), ticks: 10 },
      yAxis: { format: (v: number) => v.toLocaleString() },
      grid: { class: "stroke-border/40" },
    }}
  >
    {#snippet tooltip()}
      <Chart.Tooltip
        labelFormatter={(_v, payload) =>
          formatTime((payload?.[0]?.payload as { time?: Date } | undefined)?.time ?? new Date())}
        hideIndicator
      >
        {#snippet formatter({ value })}
          <span>Events: {(value as number).toLocaleString()}</span>
        {/snippet}
      </Chart.Tooltip>
    {/snippet}
  </LineChart>
</Chart.Container>
