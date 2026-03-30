<script lang="ts">
  import type { ComponentProps } from "svelte";
  import Button from '$lib/client/components/ui/button/button.svelte';
  import ArrowUp from "@lucide/svelte/icons/arrow-up-down";
  import ArrowAZ from "@lucide/svelte/icons/arrow-down-a-z";
  import ArrowZA from "@lucide/svelte/icons/arrow-down-z-a";
  import type { Column } from "@tanstack/table-core";
  import type { CatalogRow } from "$lib/types";
  import { cn } from "$lib/utils.js";

  let {
    column,
    variant = "ghost",
    headerName,
    align = "start",
    class: className,
    ...restProps
  }: ComponentProps<typeof Button> & {
    column: Column<CatalogRow, unknown>;
    headerName: string;
    /** Metric columns: center label + sort control in the cell */
    align?: "start" | "center";
  } = $props();
</script>

<Button
  {variant}
  {...restProps}
  class={cn(
    "inline-flex h-auto min-h-9 items-center gap-2 px-2 py-1.5 whitespace-nowrap [&_svg]:shrink-0",
    align === "center" && "w-full justify-center text-center",
    align === "start" && "justify-start text-left",
    className,
  )}
>
  <span>{headerName}</span>
  {#if column.getIsSorted() === "asc"}
    <ArrowAZ class="size-4 shrink-0" />
  {:else if column.getIsSorted() === "desc"}
    <ArrowZA class="size-4 shrink-0" />
  {:else}
    <ArrowUp class="size-4 shrink-0" />
  {/if}
</Button>
