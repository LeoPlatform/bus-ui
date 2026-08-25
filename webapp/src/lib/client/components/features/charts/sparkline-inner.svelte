<script lang="ts">
  import * as Chart from "$lib/client/components/ui/chart/index";
  import { AnnotationLine, AreaChart } from "layerchart";
  import { scaleTime, scaleLinear } from "d3-scale";

  interface Props {
    chartData: { time: Date; value: number }[];
    color: string;
    label: string;
    /** Read-checkpoint timestamp. When set, draws the red "read cutoff" vertical line at it;
     * without it (e.g. write-side sparklines, which can't lag) no line is drawn. */
    lastRead?: number;
  }

  let { chartData, color, label, lastRead }: Props = $props();

  /** The read-cutoff timestamp, snapped to the data point at or just before lastRead. */
  const lineDate = $derived.by(() => {
    if (lastRead && lastRead > 0 && chartData.length > 0) {
      let cutoffTime = chartData[0].time.getTime();
      for (const d of chartData) {
        const t = d.time.getTime();
        if (t <= lastRead) {
          cutoffTime = t;
        }
      }
      return new Date(cutoffTime);
    }
    return null;
  });

  const xDomain = $derived.by(() => {
    if (!chartData.length) return undefined;
    let minMs = Infinity;
    let maxMs = -Infinity;
    for (const d of chartData) {
      const t = d.time.getTime();
      if (t < minMs) minMs = t;
      if (t > maxMs) maxMs = t;
    }
    // Extend domain to include the line position
    if (lineDate) maxMs = Math.max(maxMs, lineDate.getTime());
    return [new Date(minMs), new Date(maxMs)] as [Date, Date];
  });

  const config = $derived({
    value: { label, color },
  } satisfies Chart.ChartConfig);
</script>

<Chart.Container {config} class="h-full w-full">
  <AreaChart
    data={chartData}
    x="time"
    xScale={scaleTime()}
    xDomain={xDomain}
    y="value"
    yScale={scaleLinear()}
    yNice
    axis={false}
    grid={false}
    rule={false}
    series={[{ key: "value", color }]}
    props={{
      area: { opacity: 0.3 },
    }}
  >
    {#snippet aboveMarks()}
      {#if lineDate}
        <AnnotationLine
          x={lineDate}
          props={{
            line: { style: "stroke: #ef4444; stroke-width: 1.4;" },
          }}
        />
      {/if}
    {/snippet}
    {#snippet tooltip()}
      <Chart.Tooltip hideLabel hideIndicator />
    {/snippet}
  </AreaChart>
</Chart.Container>
