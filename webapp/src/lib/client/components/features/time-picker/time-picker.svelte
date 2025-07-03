<script lang="ts">
  import { AppState } from "$lib/client/appstate.svelte";
  import { StatsRange } from "$lib/types";
  import { getContext } from "svelte";
  import  CalendarDays from '@lucide/svelte/icons/calendar-days'
  import { RightChevron, LeftChevron } from "../../icons";
  import type { TimePickerState } from "./time-picker.state.svelte";
  import * as Popover from '$lib/client/components/ui/popover';
  import { CalendarDateTime, getLocalTimeZone, today } from "@internationalized/date";
  import Calendar from "../../ui/calendar/calendar.svelte";
  import { cn } from "$lib/utils";
  import {Button} from "$lib/client/components/ui/button";

  let componentState: TimePickerState = getContext<AppState>("appState").timePickerState;

  const availableRanges = componentState.getAvailableRanges();

  function setToNow() {
    componentState.startTime = Date.now();
    componentState.endTime = undefined;
  }

//   function expandCalendarSelection() {
//     componentState.dateSelectorExpanded(true)
//   }

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

//   function adjustTimeRange() {
//     componentState
//   }
const getContractedDisplay = $derived(() => {
    return availableRanges
      .map(r => r.short)
      .join(' ');
  });


</script>

<div class="inline-flex items-center bg-gray-800 text-white rounded-lg overflow-hidden shadow-lg">
    {#if componentState.isExpanded}
        <div class="flex items-center">
            <Button
            variant="ghost"
            size="sm"
            onclick={goToPrevious}
            class="h-8 w-8 p-0 hover:bg-gray-700 text-white"
        >
            <LeftChevron class="h-4 w-4" />
        </Button>
        <div class="px-3 py-2 text-sm font-medium min-w-[200px] text-center">
            {componentState.timeRangeString}
        </div>

        <Popover.Root bind:open={componentState.dateSelectorExpanded}>
            <Popover.Trigger>
                <!-- <div class="px-2"> -->
                {#snippet child({props})}
                    <Button
                        {...props}
                        variant="ghost"
                        size="sm"
                        class="h-8 w-8 p-0 hover:bg-gray-700 text-white"
                    >
                        <CalendarDays class="h-4 w-4 text-gray-400" />
                    </Button>
                    
                {/snippet}
                <!-- </div> -->
            </Popover.Trigger>

            <Popover.Content class="w-auto overflow-hidden p-0" align='center'>
                <Calendar
                    type="single"
                    bind:value={componentState.selectedDate}
                    class="rounded-md border shadow-sm"
                    onValueChange={()=>{
                        componentState.dateSelectorExpanded = false;
                    }}
                    captionLayout="dropdown-picker"
                    maxValue={today(getLocalTimeZone())}
                />
            </Popover.Content>
        </Popover.Root>


        <div class="flex items-center">
            <Button
                variant="ghost"
                size="sm"
                onclick={goToNext}
                class="h-8 w-8 p-0 hover:bg-gray-700 text-white"
            >
                <RightChevron class="h-4 w-4" />
            </Button>
        </div>

        <div class="flex items-center border-l border-gray-600 ml-2 pl-2">
            {#each availableRanges as range}
                <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => selectRange(range.value)}
                    class={cn(
                    "h-8 px-3 text-xs font-medium hover:bg-gray-700",
                    componentState.selectedRange === range.value 
                        ? "bg-gray-600 text-white" 
                        : "text-gray-300"
                    )}
                >
                {range.short}
            </Button>
            {/each}
            <Button
                variant="ghost"
                size="sm"
                onclick={setToNow}
                class="h-8 px-3 text-xs font-medium hover:bg-gray-700 text-gray-300 border-l border-gray-600 ml-2 pl-3"
            >
                Now
            </Button>
      </div>
    </div>
    {:else}
        <div class="flex items-center px-3 py-2">
        <span class="text-sm font-medium text-gray-300">
            {getContractedDisplay}
        </span>
        </div>
    {/if}

</div>