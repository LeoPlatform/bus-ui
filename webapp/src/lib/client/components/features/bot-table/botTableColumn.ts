import type { ColumnDef } from "@tanstack/table-core";
import type { BotSettings } from "$lib/types";
import { renderComponent } from "$lib/components/ui/data-table";
import BotTableHeaderSort from "$lib/components/bot-table-header-sort.svelte";
import BotTableNameCell from "$lib/components/bot-table-name-cell.svelte";

export const columns: ColumnDef<BotSettings>[] = [
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
                // idLinkClicked: (id: string) => 
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