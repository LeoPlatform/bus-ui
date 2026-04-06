<script lang="ts">
  import {
    type ColumnDef,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    type PaginationState,
    type SortingState,
    type ColumnFiltersState,
    type VisibilityState,
    type FilterFn,
  } from "@tanstack/table-core";
  import { createSvelteTable, FlexRender, renderComponent } from "$lib/client/components/ui/data-table";

  import * as Table from "$lib/client/components/ui/table";
  import { Button } from "$lib/client/components/ui/button";
  import BotTableHeaderSort from "$lib/client/components/features/bot-table/bot-table-header-sort.svelte";
  import BotTableNameCell from "$lib/client/components/features/bot-table/bot-table-name-cell.svelte";

  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Input from "$lib/client/components/ui/input/input.svelte";
  import * as DropdownMenu from "$lib/client/components/ui/dropdown-menu";
  import type { CatalogRow } from "$lib/types";
  import { getContext, untrack } from "svelte";
  import type { AppState } from "$lib/client/appstate.svelte";
  import { cn, humanize } from "$lib/utils.js";
  import { Skeleton } from "$lib/client/components/ui/skeleton";

  let appState = getContext<AppState>('appState');
  let loading = $derived(appState.botState.loading);

  // Fetch stats only for bots visible on the current page (not all 8000+).
  // Debounced to avoid spamming the API when the user types in the filter.
  let statsDebounce: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const rows = table.getRowModel().rows;
    if (!rows.length) return;

    const botIds = rows
      .map((r) => r.original)
      .filter((r) => r.kind === "bot")
      .map((r) => r.id);

    if (botIds.length === 0) return;

    clearTimeout(statsDebounce);
    statsDebounce = setTimeout(() => {
      appState.botState.visibleIds = botIds;
      appState.botState.fetchBotStats().catch(() => {});
    }, 500);

    return () => clearTimeout(statsDebounce);
  });

  let data: CatalogRow[] = $derived(
    appState.botState.catalogRows.filter((row) => !row.archived),
  );

  let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 30 });
  let sorting = $state<SortingState>([]);
  let columnFilters = $state<ColumnFiltersState>([]);
  let columnVisibility = $state<VisibilityState>({});

  const nameFilter: FilterFn<CatalogRow> = (row, _columnId, filterValue) => {
    const q = String(filterValue ?? "").trim().toLowerCase();
    if (!q) return true;
    const r = row.original;
    const hay = `${r.id} ${r.name ?? ""} ${r.lambdaName ?? ""}`.toLowerCase();
    return hay.includes(q);
  };

  const columns: ColumnDef<CatalogRow>[] = [
    {
        accessorFn: (row) => row.name ?? row.lambdaName ?? row.id,
        filterFn: nameFilter,
        header: ({ column }) => {
            return renderComponent(BotTableHeaderSort, {
                onclick: () => column.toggleSorting(),
                headerName: "Name",
                column,
            })
        },
        id: 'nodeName',
        cell: ({ cell }) => {
            const row = cell.row.original;
            return renderComponent(BotTableNameCell, {
                id: row.id,
                name: row.name ?? row.lambdaName ?? row.id,
                tags: row.tags,
                kind: row.kind,
                status: row.status,
                isAlarmed: row.isAlarmed,
            })
        },
        enableHiding: false,
    },
    {
        accessorFn: (row) =>
            row.kind === "bot" ? (row.health?.source_lag ?? 0) : -1,
        id: "sourceLag",
        header: ({ column }) => {
            return renderComponent(BotTableHeaderSort, {
                onclick: () => column.toggleSorting(),
                headerName: "Source Lag",
                column,
                align: "center",
            })
        },
        cell: ({ row }) => {
            if (row.original.kind !== "bot") return "—";
            const v = row.original.health?.source_lag ?? 0;
            return v > 0 ? humanize(v) : "0";
        },
    },
    {
        id: "writeLag",
        header: ({ column }) => {
            return renderComponent(BotTableHeaderSort, {
                onclick: () => column.toggleSorting(),
                headerName: "Write Lag",
                column,
                align: "center",
            })
        },
        accessorFn: (row) =>
            row.kind === "bot" ? (row.health?.write_lag ?? 0) : -1,
        cell: ({ row }) => {
            if (row.original.kind !== "bot") return "—";
            const v = row.original.health?.write_lag ?? 0;
            return v > 0 ? humanize(v) : "0";
        },
    },
    {
        accessorFn: (row) =>
            row.kind === "bot" ? (row.errorCount ?? 0) : -1,
        id: "errors",
        header: ({ column }) => {
            return renderComponent(BotTableHeaderSort, {
                onclick: () => column.toggleSorting(),
                headerName: "Errors",
                column,
                align: "center",
            })
        },
        cell: ({ row }) =>
            row.original.kind === "bot" ? (row.original.errorCount ?? 0) : "—",
    },
    {
        accessorFn: (row) => row.lambdaName ?? "",
        id: "lambdaName",
        header: "Lambda",
        cell: ({ row }) =>
            row.original.kind === "bot" ? (row.original.lambdaName ?? "") : "—",
    }
]

  const metricColumnIds = new Set(["sourceLag", "writeLag", "errors"]);

  function headClass(columnId: string) {
    return cn(
      "h-10 px-2 py-2 align-middle font-medium first:pl-4 last:pr-4",
      metricColumnIds.has(columnId) &&
        "w-[10rem] min-w-[10rem] text-center",
      columnId === "nodeName" && "min-w-0",
      columnId === "lambdaName" && "min-w-0 w-[22%] max-w-[20rem]",
    );
  }

  function cellClass(columnId: string) {
    return cn(
      "py-2 px-2 first:pl-4 last:pr-4 min-w-0",
      columnId === "nodeName" && "h-full align-top",
      columnId !== "nodeName" && "align-middle",
      metricColumnIds.has(columnId) &&
        "w-[10rem] min-w-[10rem] text-center tabular-nums whitespace-nowrap",
      columnId === "lambdaName" && "w-[22%] max-w-[20rem] truncate",
    );
  }

  const table = createSvelteTable<CatalogRow>({
    get data() { return data; },
    columns,
    state: {
      get pagination() {
        return pagination;
      },
      get sorting() {
        return sorting;
      },
      get columnFilters() {
        return columnFilters;
      },
      get columnVisibility() {
        return columnVisibility;
      }
    },
    onPaginationChange: (updater) => {
      if (typeof updater === "function") {
        pagination = updater(pagination);
      } else {
        pagination = updater;
      }
    },
    onSortingChange: (updater) => {
      if (typeof updater === "function") {
        sorting = updater(sorting);
      } else {
        sorting = updater;
      }
    },
    onColumnFiltersChange: (updater) => {
      if (typeof updater === "function") {
        columnFilters = updater(columnFilters);
      } else {
        columnFilters = updater;
      }
    },
    onColumnVisibilityChange: (updater) => {
      if (typeof updater === "function") {
        columnVisibility = updater(columnVisibility);
      } else {
        columnVisibility = updater;
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // debugTable: true
  });
</script>

{#if loading}
<div class="w-full min-w-0 space-y-4 py-4">
  <div class="flex justify-end">
    <Skeleton class="h-10 w-72" />
  </div>
  <div class="rounded-md border overflow-hidden">
    {#each Array(8) as _}
      <div class="flex items-center gap-4 border-b px-4 py-3">
        <Skeleton class="h-5 w-5 rounded-full shrink-0" />
        <Skeleton class="h-4 flex-1" />
        <Skeleton class="h-4 w-16" />
        <Skeleton class="h-4 w-16" />
        <Skeleton class="h-4 w-16" />
        <Skeleton class="h-4 w-32" />
      </div>
    {/each}
  </div>
</div>
{:else}
<div class="w-full min-w-0">
  <div class="flex flex-wrap items-center justify-end gap-2 py-4">
    <Input 
      placeholder="Filter by name or id…"
      value={(table.getColumn("nodeName")?.getFilterValue() as string) ?? ""}
      onchange={(e) => {
        table.getColumn("nodeName")?.setFilterValue(e.currentTarget.value);
      }}
      oninput={(e) => {
        table.getColumn("nodeName")?.setFilterValue(e.currentTarget.value);
      }}
      class="max-w-sm"
    />
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({props})}
          <Button {...props} variant="outline" class="ml-auto">Columns</Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {#each table.getAllColumns().filter((col) => col.getCanHide()) as column (column.id)}
        <DropdownMenu.CheckboxItem class="capitalize" bind:checked={
          () => column.getIsVisible(), (v) => column.toggleVisibility(!!v)
        }
        closeOnSelect={false}
        >
          {column.id}
        </DropdownMenu.CheckboxItem>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
    <Button
      variant="outline"
      size="sm"
      onclick={() => table.previousPage()}
      disabled={!table.getCanPreviousPage()}
    >
      <ChevronLeft class="size-5" aria-hidden="true" />
    </Button>
    <Button
      variant="outline"
      size="sm"
      onclick={() => table.nextPage()}
      disabled={!table.getCanNextPage()}
    >
      <ChevronRight class="size-5" aria-hidden="true" />
    </Button>
  </div>
  <div class="rounded-md border overflow-hidden">
    <Table.Root class="table-fixed w-full">
      <Table.Header>
        {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
          <Table.Row>
            {#each headerGroup.headers as header (header.id)}
              <Table.Head class={headClass(header.column.id)}>
                {#if !header.isPlaceholder}
                  <FlexRender
                    content={header.column.columnDef.header}
                    context={header.getContext()}
                  />
                {/if}
              </Table.Head>
            {/each}
          </Table.Row>
        {/each}
      </Table.Header>
      <Table.Body>
        {#each table.getRowModel().rows as row (row.id)}
          <Table.Row data-state={row.getIsSelected() && "selected"}>
            {#each row.getVisibleCells() as cell (cell.id)}
              <Table.Cell
                class={cellClass(cell.column.id)}
                title={cell.column.id === "lambdaName" &&
                row.original.kind === "bot" &&
                row.original.lambdaName
                  ? row.original.lambdaName
                  : undefined}
              >
                <FlexRender
                  content={cell.column.columnDef.cell}
                  context={cell.getContext()}
                />
              </Table.Cell>
            {/each}
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={columns.length} class="h-24 text-center">
              No results.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
</div>
{/if}
