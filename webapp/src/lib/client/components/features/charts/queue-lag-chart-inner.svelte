<script lang="ts">
  import * as Chart from "$lib/client/components/ui/chart/index";
  import { LineChart } from "layerchart";
  import { scaleTime, scaleLinear, scaleLog } from "d3-scale";
  import { humanize } from "$lib/utils";
  import type { DashboardStatsValue } from "$lib/types";
  import { createRegressionSeries, type RegressionType } from "./regression";
  import { logClamp, logFloor } from "./y-axis";

  interface Props {
    sourceLagData: DashboardStatsValue[];
    queueLagData: DashboardStatsValue[];
    showLogarithmic?: boolean;
    trendLineType?: RegressionType;
    bestFit?: boolean;
    trendLineLabel?: string;
  }

  let { sourceLagData, queueLagData, showLogarithmic = false, trendLineType, bestFit = false, trendLineLabel }: Props = $props();

  const showTrend = $derived(Boolean(trendLineType) || bestFit);

  type Row = { time: Date; source: number | null; queue: number | null; trend: number | null };

  const rows = $derived.by<Row[]>(() => {
    const map = new Map<number, { source: number | null; queue: number | null }>();
    for (const d of sourceLagData) {
      const e = map.get(d.time) ?? { source: null, queue: null };
      e.source = d.value || 0;
      map.set(d.time, e);
    }
    for (const d of queueLagData) {
      const e = map.get(d.time) ?? { source: null, queue: null };
      e.queue = d.value || 0;
      map.set(d.time, e);
    }

    // Trend keyed by timestamp. Use the fitted regression `points` (windowed to
    // the last 10 samples via offset: -10), NOT predict() across the whole axis —
    // the prior Chart.js chart plotted only those windowed points, so the trend
    // should cover the same recent segment, not extrapolate over the full range.
    let trendByTime: Map<number, number> | null = null;
    if (showTrend && sourceLagData.length > 1) {
      try {
        // bestFit and an explicit type are mutually exclusive; prefer bestFit when set.
        const series = createRegressionSeries({
          data: sourceLagData,
          offset: -10,
          type: bestFit ? undefined : trendLineType,
          bestFit: bestFit || undefined,
          label: trendLineLabel,
        });
        trendByTime = new Map(series.points.map((p) => [p.x, p.y]));
      } catch (error) {
        console.warn("queue-lag trend line failed:", error);
      }
    }

    // Shared floor across both series (one y-axis) for clamping 0s on a log scale.
    const floor = logFloor([...sourceLagData.map((d) => d.value), ...queueLagData.map((d) => d.value)]);

    return [...map.keys()]
      .sort((a, b) => a - b)
      .map((t) => ({
        time: new Date(t),
        source: logClamp(map.get(t)!.source, showLogarithmic, floor),
        queue: logClamp(map.get(t)!.queue, showLogarithmic, floor),
        trend: logClamp(trendByTime?.get(t) ?? null, showLogarithmic, floor),
      }));
  });

  const series = $derived([
    { key: "source", label: "Source Lag", color: "#3b82f6" },
    { key: "queue", label: "Queue Lag", color: "#ef4444" },
    ...(showTrend
      ? [
          {
            key: "trend",
            label: trendLineLabel ?? "Trend",
            color: "#16a34a",
            // Dashed to match the prior Chart.js trend line (borderDash).
            props: { style: "stroke-dasharray: 6 4;" },
          },
        ]
      : []),
  ]);

  const config = $derived({
    source: { label: "Source Lag", color: "#3b82f6" },
    queue: { label: "Queue Lag", color: "#ef4444" },
    trend: { label: trendLineLabel ?? "Trend", color: "#16a34a" },
  } satisfies Chart.ChartConfig);

  const formatTime = (value: Date | number) =>
    new Date(value).toLocaleTimeString(undefined, { hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
</script>

<Chart.Container {config} class="h-full w-full">
  <!--
    yBaseline={null}: fit the y-axis to the data range, never to 0. The prior
    Chart.js queue-lag chart had `beginAtZero` commented out; lag values sit far
    above zero, so pinning the baseline at 0 flattens the variation. (Unlike
    generic-line, which used beginAtZero:true, and the bucket area charts, which
    fill to origin — those keep the 0 baseline via chartYBaseline.)
  -->
  <LineChart
    data={rows}
    x="time"
    xScale={scaleTime()}
    y="source"
    yScale={showLogarithmic ? scaleLog() : scaleLinear()}
    yNice
    yBaseline={null}
    {series}
    legend
    props={{
      spline: { class: "stroke-2" },
      xAxis: { format: (v: Date) => formatTime(v), ticks: 10 },
      yAxis: { format: (v: number) => humanize(v) },
      grid: { class: "stroke-border/40" },
    }}
  >
    {#snippet tooltip()}
      <Chart.Tooltip
        labelFormatter={(_v, payload) =>
          formatTime((payload?.[0]?.payload as { time?: Date } | undefined)?.time ?? new Date())}
      >
        {#snippet formatter({ value, name })}
          {#if value != null}
            <span>{name}: {humanize(value as number)}</span>
          {/if}
        {/snippet}
      </Chart.Tooltip>
    {/snippet}
  </LineChart>
</Chart.Container>
