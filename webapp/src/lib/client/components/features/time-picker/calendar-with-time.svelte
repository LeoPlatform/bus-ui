<script lang="ts">
	import Calendar from "$lib/client/components/ui/calendar/calendar.svelte";
	import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
	import * as Card from "$lib/client/components/ui/card/index.js";
	import { Label } from "$lib/client/components/ui/label/index.js";
	import { Input } from "$lib/client/components/ui/input/index.js";
	import Clock2Icon from "@lucide/svelte/icons/clock-2";
  import type { TimePickerState } from "./time-picker.state.svelte";
  import { getContext } from "svelte";
  import type { AppState } from "$lib/client/appstate.svelte";

	let componentState: TimePickerState = getContext<AppState>("appState").timePickerState;


</script>

<Card.Root class="w-fit py-4">
	<Card.Content class="px-4">
		<Calendar type="single" 
			bind:value={componentState.selectedDate} 
			class="bg-transparent p-0"
			onValueChange={() => {
				//TODO Might need to adjust this so that it closes when the user clicks outside the calendar
				componentState.dateSelectorExpanded = false;
			}} 
			captionLayout="label"
			maxValue={today(getLocalTimeZone())}
		/>
	</Card.Content>
	<Card.Footer class="flex flex-col gap-6 border-t px-4 !pt-4">
		<div class="flex w-full flex-col gap-3">
			<!-- <Label for="time-from">Start Time</Label> -->
			<div class="relative flex w-full items-center gap-2">
				<Clock2Icon
					class="text-muted-foreground pointer-events-none absolute left-2.5 size-4 select-none"
				/>
				<Input
					type="time"
					step="1"
					bind:value={componentState.customTime}
					class="appearance-none pl-8 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
				/>
			</div>
		</div>
		<!-- <div class="flex w-full flex-col gap-3">
			<Label for="time-to">End Time</Label>
			<div class="relative flex w-full items-center gap-2">
				<Clock2Icon
					class="text-muted-foreground pointer-events-none absolute left-2.5 size-4 select-none"
				/>
				<Input
					id="time-to"
					type="time"
					step="1"
					value="12:30:00"
					class="appearance-none pl-8 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
				/>
			</div>
		</div> -->
	</Card.Footer>
</Card.Root>
