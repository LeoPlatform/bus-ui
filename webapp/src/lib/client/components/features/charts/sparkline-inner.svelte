<script lang="ts">
  import * as Chart from "$lib/client/components/ui/chart/index";
  import { AreaChart } from "layerchart";
  import { scaleTime, scaleLinear } from "d3-scale";
  import { onMount } from "svelte";

  interface Props {
    chartData: { time: Date; value: number }[];
    color: string;
    label: string;
  }

  let { chartData, color, label }: Props = $props();

  let now = $state(new Date());

  onMount(() => {
    const id = setInterval(() => {
      now = new Date();
    }, 30_000);
    return () => clearInterval(id);
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
    maxMs = Math.max(maxMs, now.getTime());
    return [new Date(minMs), new Date(maxMs)] as [Date, Date];
  });

  const annotations = $derived([
    {
      type: "line" as const,
      x: now,
      layer: "above" as const,
      class: "stroke-red-500",
    },
  ]);

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
    annotations={annotations}
    series={[{ key: "value", color }]}
    props={{
      area: { opacity: 0.15 },
    }}
  >
    {#snippet tooltip()}
      <Chart.Tooltip hideLabel hideIndicator />
    {/snippet}
  </AreaChart>
</Chart.Container>
