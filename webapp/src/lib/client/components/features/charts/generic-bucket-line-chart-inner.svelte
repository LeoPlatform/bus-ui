<script lang="ts">
  import * as Chart from "$lib/client/components/ui/chart/index";
  import { AnnotationLine, AreaChart } from "layerchart";
  import { scaleTime, scaleLinear, scaleLog } from "d3-scale";
  import { onMount } from "svelte";
  import type { DashboardStatsValue } from "$lib/types";
  import { chartYBaseline, logClamp, logFloor } from "./y-axis";

  interface Props {
    data: DashboardStatsValue[];
    chartLabel: string;
    /** Start of the current stats bucket. */
    start: number;
    /** End of the query window. */
    end: number;
    /** Start of the previous bucket. */
    lastBucket: number;
    /** Start of the query window (aligned with API stats window). */
    rangeStart: number;
    checkPointValue?: number;
    showLogarithmic?: boolean;
  }

  let { data, chartLabel, start, end, lastBucket, rangeStart, checkPointValue, showLogarithmic = false }: Props = $props();

  /** If wall clock is far past the query end, don't stretch the x-axis to "now". */
  const STALE_QUERY_MS = 90_000;

  // Refresh the "now" line periodically while mounted (matches prior Chart.js behavior).
  let now = $state(new Date());
  onMount(() => {
    const id = setInterval(() => (now = new Date()), 30_000);
    return () => clearInterval(id);
  });

  // Merge the three datasets into one row-per-timestamp array so a single
  // AreaChart can render total / current-bucket / previous-bucket as series.
  // Each bucket series carries the boundary point from the adjacent bucket so
  // the filled area reaches the transition with no visual gap.
  type Row = { time: Date; total: number | null; current: number | null; previous: number | null };

  const rows = $derived.by<Row[]>(() => {
    const sorted = [...data].sort((a, b) => a.time - b.time);
    const lastBeforeCurrent = sorted.filter((p) => p.time < start).at(-1);
    const lastBeforePrev = sorted.filter((p) => p.time < lastBucket).at(-1);
    const floor = logFloor(sorted.map((p) => p.value));
    return sorted.map((p) => {
      const v = logClamp(p.value || 0, showLogarithmic, floor);
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

  const queryStale = $derived(now.getTime() > end + STALE_QUERY_MS);

  const xDomain = $derived.by(() => {
    if (!data.length) return undefined;
    const times = data.map((d) => d.time);
    const minMs = Math.min(...times, rangeStart, lastBucket, start);
    const maxMs = queryStale ? Math.max(...times, end) : Math.max(...times, end, now.getTime());
    return [new Date(minMs), new Date(maxMs)] as [Date, Date];
  });

  const config = $derived({
    total: { label: chartLabel, color: "#3b82f6" },
    previous: { label: "Previous Bucket", color: "#F47D4A" },
    current: { label: "Current Bucket", color: "#88a550" },
  } satisfies Chart.ChartConfig);

  const formatTime = (value: Date | number) =>
    new Date(value).toLocaleTimeString(undefined, { hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
  const formatValue = (value: number) => value.toLocaleString();
</script>

<Chart.Container {config} class="h-full w-full">
  <AreaChart
    data={rows}
    x="time"
    xScale={scaleTime()}
    {xDomain}
    yScale={showLogarithmic ? scaleLog() : scaleLinear()}
    yNice
    yBaseline={chartYBaseline(showLogarithmic)}
    series={[
      { key: "total", label: chartLabel, color: "#3b82f6" },
      { key: "previous", label: "Previous Bucket", color: "#F47D4A" },
      { key: "current", label: "Current Bucket", color: "#88a550" },
    ]}
    props={{
      area: { opacity: 0.5 },
      xAxis: { format: (v: Date) => formatTime(v), ticks: 7 },
      yAxis: { format: (v: number) => formatValue(v) },
      grid: { class: "stroke-border/40" },
    }}
  >
    {#snippet aboveMarks()}
      {#if !queryStale}
        <AnnotationLine x={now} props={{ line: { style: "stroke: rgba(239, 68, 68, 0.95); stroke-width: 2;" } }} />
      {/if}
      {#if checkPointValue != null && Number.isFinite(checkPointValue)}
        <AnnotationLine
          x={new Date(checkPointValue)}
          props={{ line: { style: "stroke: rgba(248, 113, 113, 0.7); stroke-width: 1; stroke-dasharray: 4 4;" } }}
        />
      {/if}
    {/snippet}
    {#snippet tooltip()}
      <Chart.Tooltip
        labelFormatter={(_v, payload) =>
          formatTime((payload?.[0]?.payload as { time?: Date } | undefined)?.time ?? new Date())}
        hideIndicator
      >
        {#snippet formatter({ value, item })}
          <!-- Show only the "total" series (like the prior Chart.js tooltip, which
               returned "" for the current/previous datasets). Guard null so gap
               points — including non-positive values dropped on a log axis — don't
               throw on `null.toLocaleString()`. -->
          {#if item.key === "total" && value != null}
            <span>{chartLabel}: {formatValue(value as number)}</span>
          {/if}
        {/snippet}
      </Chart.Tooltip>
    {/snippet}
  </AreaChart>
</Chart.Container>
