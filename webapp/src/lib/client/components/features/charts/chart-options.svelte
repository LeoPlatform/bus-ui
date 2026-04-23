<script lang="ts">
  import type { ChartOptions } from "../chart-details-pane/types";
  import * as Menubar from "../../ui/menubar";
  import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
  import { Switch } from "../../ui/switch";
  import  {type RegressionOptions, type RegressionType, regressionTypes } from "./regression";

  interface ChartOptionsProps {
    chartOptions: ChartOptions;
    logSwitch?: boolean;
    regressionType?: RegressionType;
    bestFit?: boolean;
    // lagEstimation: boolean;
    // lagEstimationType: 'linear' | 'exponential';
  }

  let { chartOptions, logSwitch = $bindable(), regressionType = $bindable(), bestFit = $bindable() }: ChartOptionsProps = $props();

  function selectRegressionType(type: RegressionType) {
    regressionType = type;
    bestFit = false;
  }

  // Handle mutual exclusivity when bestFit changes
  $effect(() => {
    if (bestFit) {
      regressionType = undefined;
    }
  });

  // Handle mutual exclusivity when regressionType changes
  $effect(() => {
    if (regressionType !== undefined) {
      bestFit = false;
    }
  });
</script>

<Menubar.Root>
  <Menubar.Menu>
    <Menubar.Trigger><SlidersHorizontal class="w-4 h-4" /></Menubar.Trigger>
    <Menubar.Content>
      {#if chartOptions.logSwitchEnabled}
        <Menubar.Item class="flex flex-row items-center gap-2 justify-between">
          <!-- <Menubar.Label>Log Scaling</Menubar.Label> -->
          <Menubar.CheckboxItem bind:checked={logSwitch}>Log Scaling</Menubar.CheckboxItem>
          <!-- <Switch
            id="logarithmic-switch"
            bind:checked={logSwitch}
          /> -->
        </Menubar.Item>
      {/if}
      {#if chartOptions.trendLineEnabled}
      <Menubar.Sub>
        <Menubar.SubTrigger>Trend Line</Menubar.SubTrigger>
        <Menubar.SubContent>
            {#each regressionTypes as r}
                <Menubar.CheckboxItem 
                  value={r} 
                  checked={r === regressionType && !bestFit} 
                  onclick={() => selectRegressionType(r)}
                >
                  {r.charAt(0).toLocaleUpperCase() + r.slice(1)}
                </Menubar.CheckboxItem>
            {/each}
          <!-- <Menubar.CheckboxItem checked={chartOptions.trendLineOptions?.type === 'linear'}>Linear</Menubar.CheckboxItem>
          <Menubar.CheckboxItem checked={chartOptions.trendLineOptions?.type === 'exponential'}>Exponential</Menubar.CheckboxItem>
          <Menubar.CheckboxItem checked={chartOptions.trendLineOptions?.type === 'polynomial'}>Polynomial</Menubar.CheckboxItem>
          <Menubar.CheckboxItem checked={chartOptions.trendLineOptions?.type === 'power'}>Power</Menubar.CheckboxItem>
          <Menubar.CheckboxItem checked={chartOptions.trendLineOptions?.type === 'logarithmic'}>Logarithmic</Menubar.CheckboxItem> -->
          <Menubar.CheckboxItem 
            bind:checked={bestFit}
          >
            Best Fit
          </Menubar.CheckboxItem>
        </Menubar.SubContent>
      </Menubar.Sub>
        <!-- <Menubar.Item> -->

          <!-- <Menubar.Label>Trend Line</Menubar.Label> -->
          <!-- TODO: possibly make this a submenu with a whole bunch of other options -->
          <!-- <Switch id="trend-line-switch" bind:checked={trendLine} /> -->
        <!-- </Menubar.Item> -->
      {/if}
    </Menubar.Content>
  </Menubar.Menu>
</Menubar.Root>
