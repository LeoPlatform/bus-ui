<script lang="ts">
  import * as Chart from "$lib/client/components/ui/chart/index";
  import { AnnotationLine, AreaChart } from "layerchart";
  import { scaleTime, scaleLinear } from "d3-scale";
  import type { DashboardStatsValue } from "$lib/types";

  interface Props {
    values: DashboardStatsValue[];
    lastRead: number;
    /** Start of the current bucket. */
    start: number;
    /** End of the query window. */
    end: number;
    /** Start of the previous bucket. */
    lastBucket: number;
  }

  let { values, lastRead, start, end, lastBucket }: Props = $props();

  // Merge the three datasets into one row-per-timestamp array so a single
  // AreaChart can render total / current-bucket / previous-bucket as series.
  // Each bucket series carries the boundary point from the adjacent bucket so
  // the filled area reaches the transition with no visual gap.
  type Row = { time: Date; total: number | null; current: number | null; previous: number | null };

  const rows = $derived.by<Row[]>(() => {
    const sorted = [...values].sort((a, b) => a.time - b.time);
    const lastBeforeCurrent = sorted.filter((p) => p.time < start).at(-1);
    const lastBeforePrev = sorted.filter((p) => p.time < lastBucket).at(-1);
    return sorted.map((p) => {
      const v = p.value || 0;
      const inCurrent = p.time >= start && p.time <= end;
      const inPrev = p.time >= lastBucket && p.time < start;
      return {
        time: new Date(p.time),
        total: v,
        current: inCurrent || p === lastBeforeCurrent ? v : null,
        previous: inPrev || p === lastBeforePrev ? v : null,
      };
    });
  });

  const config = {
    total: { label: "Events In Queue", color: "#3b82f6" },
    previous: { label: "Previous Bucket", color: "#F47D4A" },
    current: { label: "Current Bucket", color: "#88a550" },
  } satisfies Chart.ChartConfig;

  const formatTime = (value: Date | number) =>
    new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
</script>

<Chart.Container {config} class="h-full w-full">
  <AreaChart
    data={rows}
    x="time"
    xScale={scaleTime()}
    yScale={scaleLinear()}
    yNice
    series={[
      { key: "total", label: "Events In Queue", color: "#3b82f6" },
      { key: "previous", label: "Previous Bucket", color: "#F47D4A" },
      { key: "current", label: "Current Bucket", color: "#88a550" },
    ]}
    props={{
      area: { opacity: 0.5 },
      xAxis: { format: (v: Date) => formatTime(v), ticks: 10 },
      yAxis: { format: (v: number) => v.toLocaleString() },
      grid: { class: "stroke-border/40" },
    }}
  >
    {#snippet aboveMarks()}
      {#if lastRead}
        <AnnotationLine x={new Date(lastRead)} props={{ line: { style: "stroke: red; stroke-width: 1;" } }} />
      {/if}
    {/snippet}
    {#snippet tooltip()}
      <Chart.Tooltip
        labelFormatter={(_v, payload) =>
          formatTime((payload?.[0]?.payload as { time?: Date } | undefined)?.time ?? new Date())}
        hideIndicator
      />
    {/snippet}
  </AreaChart>
</Chart.Container>
