<script lang="ts" generics="TData, TValue">
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
  import type { BotSettings } from "$lib/types";
  import { getContext } from "svelte";
  import type { AppState } from "$lib/client/appstate.svelte";

  let appState = getContext<AppState>('appState');

  let data: BotSettings[] = appState.botState.botSettings;

  let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 30 });
  let sorting = $state<SortingState>([]);
  let columnFilters = $state<ColumnFiltersState>([]);
  let columnVisibility = $state<VisibilityState>({});

  const columns: ColumnDef<BotSettings>[] = [
    {
        // accessorKey: 'name',
        accessorFn: row => {
            return row.name ?? row.lambdaName ?? "unknown";
        },
        header: ({ column }) => {

            return renderComponent(BotTableHeaderSort, {
                onclick: () => column.toggleSorting(),
                headerName: "Bot Name",
                column,
            })
        },
        id: 'botName',
        // cell: info => info.getValue(),
        cell: ({cell}) => {
            return renderComponent(BotTableNameCell, {
                id: cell.row.original.id,
                tags: cell.row.original.tags,
            })
        },
        enableHiding: false,
    },
    {
        accessorFn: row => {
           return row.health?.source_lag ?? 0;
        },
        id: "sourceLag",
        header: ({ column }) => {

            return renderComponent(BotTableHeaderSort, {
                onclick: () => column.toggleSorting(),
                headerName: "Source Lag",
                column,
            })
        },
        cell: info => info.getValue()
    },
    {
        // accessorKey: 'health.write_lag',
        id: "writeLag",
        header: ({ column }) => {

            return renderComponent(BotTableHeaderSort, {
                onclick: () => column.toggleSorting(),
                headerName: "Write Lag",
                column,
            })
        },
        accessorFn: row => {
            return row.health?.write_lag ?? 0;
        },
        cell: info => info.getValue()
    },
    {
        accessorFn: row => {
            return row.errorCount ?? 0;
        },
        id: "errors",
        header: ({ column }) => {

            return renderComponent(BotTableHeaderSort, {
                onclick: () => column.toggleSorting(),
                headerName: "Errors",
                column,
            })
        },
        cell: info => info.getValue()
    }, 
    {
        accessorKey: 'lambdaName',
        header: 'Lambda Name',
        cell: info => info.getValue()
    }
]

  const table = createSvelteTable({
    data,
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

<div>
  <div class="flex items-center justify-end space-x-2 py-4">
    <Input 
      placeholder="Filter Bots..."
      value={(table.getColumn("botName")?.getFilterValue() as string) ?? ""}
      onchange={(e) => {
        // console.log(typeof e);
        table.getColumn("botName")?.setFilterValue(e.currentTarget.value);
      }}
      oninput={(e) => {
        table.getColumn("botName")?.setFilterValue(e.currentTarget.value);
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
  <div class="rounded-md border">
    <Table.Root>
      <Table.Header>
        {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
          <Table.Row>
            {#each headerGroup.headers as header (header.id)}
              <Table.Head>
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
              <Table.Cell>
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
