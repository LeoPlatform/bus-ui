<script lang="ts">
  import * as Chart from "$lib/client/components/ui/chart/index";
  import { AreaChart } from "layerchart";
  import { scaleTime, scaleLinear } from "d3-scale";

  interface Props {
    chartData: { time: Date; value: number }[];
    color: string;
    label: string;
  }

  let { chartData, color, label }: Props = $props();

  const config = $derived({
    value: { label, color },
  } satisfies Chart.ChartConfig);
</script>

<Chart.Container {config} class="h-full w-full">
  <AreaChart
    data={chartData}
    x="time"
    xScale={scaleTime()}
    y="value"
    yScale={scaleLinear()}
    yNice
    axis={false}
    grid={false}
    rule={false}
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
