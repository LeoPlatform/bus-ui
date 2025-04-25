<script lang="ts">
  import type { ComponentProps } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import ArrowUp from "@lucide/svelte/icons/arrow-up-down";
  import ArrowAZ from "@lucide/svelte/icons/arrow-down-a-z";
  import ArrowZA from "@lucide/svelte/icons/arrow-down-z-a";
  import type { Column } from "@tanstack/table-core";
  import type { BotSettings } from "$lib/types";

  let {
    column,
    variant = "ghost",
    headerName,
    ...restProps
  }: ComponentProps<typeof Button> & {
    column: Column<BotSettings>;
    headerName: string;
  } = $props();
  //   console.log("sort button");
</script>

<Button
  {variant}
  {...restProps}
>
  {headerName}
  {#if column.getIsSorted() === "asc"}
    <ArrowAZ class="ml-2" />
  {:else if column.getIsSorted() === "desc"}
    <ArrowZA class="ml-2" />
  {:else}
    <ArrowUp class="ml-2" />
  {/if}
</Button>
