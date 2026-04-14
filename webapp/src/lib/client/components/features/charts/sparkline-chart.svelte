<script lang="ts">
  import { browser } from "$app/environment";
  import type { DashboardStatsValue } from "$lib/types";
  import type { Component } from "svelte";

  interface Props {
    data: DashboardStatsValue[];
    color?: string;
    label?: string;
    /** When set, draws a red "read cutoff" vertical line at this timestamp instead of the "now" line. */
    lastRead?: number;
  }

  let { data, color = "var(--chart-1)", label = "value", lastRead }: Props = $props();

  let chartData = $derived(
    data.map((d) => ({ time: new Date(d.time), value: d.value || 0 }))
  );

  // Dynamic import to avoid SSR errors — LayerChart uses .svelte files that Node can't load server-side
  let SparklineInner: Component<{ chartData: any[]; color: string; label: string; lastRead?: number }> | null = $state(null);

  $effect(() => {
    if (browser && !SparklineInner) {
      import("./sparkline-inner.svelte").then((mod) => {
        SparklineInner = mod.default;
      });
    }
  });
</script>

{#if SparklineInner}
  <SparklineInner {chartData} {color} {label} {lastRead} />
{/if}
