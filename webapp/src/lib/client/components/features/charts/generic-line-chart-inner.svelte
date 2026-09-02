<script lang="ts">
  import * as Chart from "$lib/client/components/ui/chart/index";
  import { LineChart } from "layerchart";
  import { scaleTime, scaleLinear, scaleLog } from "d3-scale";
  import { onMount } from "svelte";
  import { humanize } from "$lib/utils";
  import type { DashboardStatsValue } from "$lib/types";
  import { chartYBaseline, logClamp, logFloor } from "./y-axis";

  interface Props {
    data: DashboardStatsValue[];
    dataSetLabel: string;
    tooltipLabel: string;
    dataIsTimeBased?: boolean;
    showLogarithmic?: boolean;
  }

  // No checkpoint line: this chart backs execution count, error count, execution time,
  // events written and write lag, none of which can lag behind a read checkpoint. Legacy
  // draws its read-cutoff line only on Events In Queue and the read-side sparklines.
  let { data, dataSetLabel, tooltipLabel, dataIsTimeBased = false, showLogarithmic = false }: Props = $props();

  // Refresh wall clock every 30s so the x-domain keeps tracking a live window.
  let now = $state(new Date());
  onMount(() => {
    const id = setInterval(() => (now = new Date()), 30_000);
    return () => clearInterval(id);
  });

  const chartData = $derived.by(() => {
    const floor = logFloor(data.map((d) => d.value));
    return data.map((d) => ({ time: new Date(d.time), value: logClamp(d.value || 0, showLogarithmic, floor) }));
  });

  // Extend the x domain to "now" so a live window renders up to the current moment.
  const xDomain = $derived.by(() => {
    if (!chartData.length) return undefined;
    let minMs = Infinity;
    let maxMs = -Infinity;
    for (const d of chartData) {
      const t = d.time.getTime();
      if (t < minMs) minMs = t;
      if (t > maxMs) maxMs = t;
    }
    maxMs = Math.max(maxMs, now.getTime());
    return [new Date(minMs), new Date(maxMs)] as [Date, Date];
  });

  const config = $derived({
    value: { label: dataSetLabel, color: "#3b82f6" },
  } satisfies Chart.ChartConfig);

  const formatTime = (value: Date | number) =>
    new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const formatValue = (value: number) =>
    dataIsTimeBased ? humanize(value) : value.toLocaleString();
</script>

<Chart.Container {config} class="h-full w-full">
  <LineChart
    data={chartData}
    x="time"
    xScale={scaleTime()}
    {xDomain}
    y="value"
    yScale={showLogarithmic ? scaleLog() : scaleLinear()}
    yNice
    yBaseline={chartYBaseline(showLogarithmic)}
    series={[{ key: "value", label: dataSetLabel, color: "#3b82f6" }]}
    props={{
      spline: { class: "stroke-2" },
      xAxis: { format: (v: Date) => formatTime(v), ticks: 10 },
      yAxis: { format: (v: number) => formatValue(v) },
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
          {#if value != null}
            <span>{tooltipLabel}: {formatValue(value as number)}</span>
          {/if}
        {/snippet}
      </Chart.Tooltip>
    {/snippet}
  </LineChart>
</Chart.Container>
