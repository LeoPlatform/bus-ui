<script lang="ts">
  import { AppState } from "$lib/client/appstate.svelte";
  import { StatsRange } from "$lib/types";
  import { getContext } from "svelte";
  import CalendarDays from '@lucide/svelte/icons/calendar-days'
  import { RightChevron, LeftChevron } from "../../icons";
  import type { TimePickerState } from "./time-picker.state.svelte";
  import * as Popover from '$lib/client/components/ui/popover';
  import { CalendarDateTime, getLocalTimeZone, today } from "@internationalized/date";
  import Calendar from "./calendar-with-time.svelte";
  import { cn } from "$lib/utils";
  import {Button} from "$lib/client/components/ui/button";

  let componentState: TimePickerState = getContext<AppState>("appState").timePickerState;

  const availableRanges = componentState.getAvailableRanges();

  function setToNow() {
    componentState.bucketToNow();
  }

  function goToNext() { 
    componentState.nextDateRange()
  }

  function goToPrevious() {
    componentState.prevDateRange()
  }

  function selectRange(range: StatsRange) {
    console.log('selectRange', range);
    componentState.range = range;
    console.log('selected range', componentState.range);
  }

  // Handle calendar date selection
  function handleDateChange() {
    // The calendar binding automatically updates componentState.selectedDate
    // which triggers the setter in the state class to update the times
    componentState.dateSelectorExpanded = false;
  }

  const getContractedDisplay = $derived(
    availableRanges.map(r => r.short).join(' ')
  );
</script>

<div class="inline-flex items-center bg-muted/50 border border-border text-foreground rounded-lg overflow-hidden shadow-sm">
    {#if componentState.isExpanded}
        <div class="flex items-center">
            <Button
            variant="ghost"
            size="sm"
            onclick={goToPrevious}
            class="h-8 w-8 p-0 hover:bg-muted text-foreground"
        >
            <LeftChevron class="h-4 w-4" />
        </Button>
        <div class="px-3 py-2 text-sm font-medium min-w-[200px] text-center text-foreground">
            {componentState.timeRangeString}
        </div>

        <Popover.Root bind:open={componentState.dateSelectorExpanded}>
            <Popover.Trigger>
                {#snippet child({props})}
                    <Button
                        {...props}
                        variant="ghost"
                        size="sm"
                        class="h-8 w-8 p-0 hover:bg-muted text-foreground"
                    >
                        <CalendarDays class="h-4 w-4 text-muted-foreground" />
                    </Button>
                {/snippet}
            </Popover.Trigger>

            <Popover.Content class="w-auto overflow-hidden p-0" align='center'>
                <Calendar />
            </Popover.Content>
        </Popover.Root>

        <div class="flex items-center">
            <Button
                variant="ghost"
                size="sm"
                onclick={goToNext}
                class="h-8 w-8 p-0 hover:bg-muted text-foreground"
                disabled={componentState.endTime === undefined || componentState.endTime >= new Date().getTime()}
            >
                <RightChevron class="h-4 w-4" />
            </Button>
        </div>

        <div class="flex items-center border-l border-border ml-2 pl-2">
            {#each availableRanges as range}
                <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => selectRange(range.value)}
                    class={cn(
                    "h-8 px-3 text-xs font-medium hover:bg-muted hover:text-foreground",
                    componentState.range === range.value 
                        ? "bg-accent text-foreground" 
                        : "text-muted-foreground"
                    )}
                >
                {range.short}
            </Button>
            {/each}
            <Button
                variant="ghost"
                size="sm"
                onclick={setToNow}
                class="h-8 px-3 text-xs font-medium hover:bg-muted hover:text-foreground text-muted-foreground border-l border-border ml-2 pl-3"
            >
                Now
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onclick={() => componentState.isExpanded = false}
                class="h-8 px-3 hover:bg-muted text-muted-foreground text-xs font-medium tracking-wider border-l border-border ml-2 pl-3"
            >
                {getContractedDisplay}
            </Button>
      </div>
    </div>
    {:else}
        <Button
            variant="ghost"
            size="sm"
            onclick={() => componentState.isExpanded = true}
            class="h-8 px-3 hover:bg-muted text-muted-foreground text-xs font-medium tracking-wider"
        >
            {getContractedDisplay}
        </Button>
    {/if}
</div>