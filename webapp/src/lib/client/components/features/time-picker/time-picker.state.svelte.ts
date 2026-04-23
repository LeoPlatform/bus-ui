import { StatsRange, type StatsQueryRequest } from "$lib/types";
import type { PickerDate } from "./types";
import { bucketsData, getStartAndEndOfBucket, ranges } from "$lib/bucketUtils";
import { CalendarDateTime, getLocalTimeZone, now, toCalendarDateTime, toLocalTimeZone, type AnyTime } from "@internationalized/date";

type GlobalFetch = typeof globalThis.fetch;

export class TimePickerState {
    #fetch: GlobalFetch;
    #range: StatsRange = $state<StatsRange>(StatsRange.Minute15);
    rangeData = $derived(ranges[this.#range].rolling ? ranges[this.#range].rolling! : ranges[this.#range]);
    get bucketUtils() {
        if (this.#range === StatsRange.Hour6) {
            return bucketsData['hour'];
        }
        return bucketsData[this.#range] || bucketsData[this.rangeData.period];
    }
    #count: number = $state<number>(1);
    #startTime: number = $state<number>(Date.now());
    #endTime: number | undefined = $state<number | undefined>();
    #selectedDate: CalendarDateTime | undefined = $state<CalendarDateTime>();
    #customTime: string = $state(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
    #dateSelectorExpanded: boolean = $state<boolean>(false);
    #isExpanded: boolean = $state<boolean>(false);
    #onTimeRangeChange: ((state: TimePickerState) => void) | undefined = undefined;
    
    
    #timeRangeString = $derived.by(() => {
        const range = this.#range;
        const startTime = this.#startTime;
        const endTime = this.#endTime;

        return this.formatTimeRange();
    });

    constructor(fetch: GlobalFetch) {
        this.#fetch = fetch;
        this.#range = StatsRange.Minute15;
        this.#count = 1;
        let {start, end} = getStartAndEndOfBucket(this.bucketUtils, this.#startTime);
        this.#startTime = start;
        this.endTime = end;
    }
    
    get count() {
        return this.#count;
    }

    get startTime() {
        return this.#startTime;
    }

    get endTime() {
        return this.#endTime;
    }

    get range() {
        return this.#range;
    }

    get isExpanded() {
        return this.#isExpanded;
    }

    get dateSelectorExpanded() {
        return this.#dateSelectorExpanded;
    }

    get selectedDate() {
        return this.#selectedDate ?? toCalendarDateTime(now(getLocalTimeZone()));
    }
    

    get timeRangeString() {
        return this.#timeRangeString;
    }

    get customTime() {
        return this.#customTime;
    }


    set isExpanded(val: boolean) {
        this.#isExpanded = val;
    }

    set dateSelectorExpanded(val: boolean) {
        this.#dateSelectorExpanded = val;
    }

    set startTime(val: number) {
        this.#startTime = val;
        this.updateTimeRangeForSelectedRange();
    }

    set endTime(val: number | undefined) {
        if (val) {
            const now = Date.now();
            this.#endTime = val > now ? undefined : val;
        } else {
            this.#endTime = val;
        }
    }

    set range(val: StatsRange) {
        this.#range = val;
        // Update the time range when the range changes
        this.updateTimeRangeForSelectedRange();

        this.triggerTimeRangeChange();
    }

    set selectedDate(val: CalendarDateTime) {
        this.#selectedDate = val;

    }

    set customTime(val: string) {
        this.#customTime = val;
    }

    submitDateChanges() {
        this.updateSelectedDateWithTime();
        this.dateSelectorExpanded = false;
        this.triggerTimeRangeChange();
    }

    /**
     * Combine the current selectedDate with the customTime to create a complete DateTime
     * and update the startTime accordingly
     */
    updateSelectedDateWithTime() {
        const currentDate = this.selectedDate;
        const timeValue = this.customTime;
        
        if (currentDate && timeValue) {
            try {
                // Parse the time string (format: "HH:MM" or "HH:MM:SS")
                const [hours, minutes, seconds = 0] = timeValue.split(':').map(Number);
                
                // Validate the time values
                if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
                    console.warn('Invalid time values:', { hours, minutes, seconds });
                    return;
                }
                
                // Create a new CalendarDateTime with the updated time
                const updatedDate = currentDate.set({
                    hour: hours,
                    minute: minutes,
                    second: seconds
                });
                
                // Update the internal selectedDate and corresponding start time
                this.selectedDate = updatedDate;

                this.updateTimeForSelectedDate(this.selectedDate);
                
            } catch (error) {
                console.error('Error parsing time:', error);
            }
        }
    }

    /**
     * Manually trigger the time range change callback
     */
    private triggerTimeRangeChange() {
        if (this.#onTimeRangeChange) {
            this.#onTimeRangeChange(this);
    }
}

    /**
     * Set a callback function that will be called whenever the time range changes
     */
    setOnTimeRangeChangeCallback(callback: (state: TimePickerState) => void) {
        this.#onTimeRangeChange = callback;
    }

    /**
     * Remove the time range change callback
     */
    clearOnTimeRangeChangeCallback() {
        this.#onTimeRangeChange = undefined;
    }

    /**
     * Update the start and end times based on the selected date
     */
    private updateTimeForSelectedDate(calendarDate: CalendarDateTime) {
        const jsDate = new Date(
            calendarDate.year,
            calendarDate.month - 1, // CalendarDateTime months are 1-based, JS Date months are 0-based
            calendarDate.day,
            calendarDate.hour,
            calendarDate.minute,
            calendarDate.second
        );

        // Set the start time to the selected date and time
        this.startTime = jsDate.getTime();

        // this.calculateEndTimeForRange()
        
        // Keep the end time unchanged - don't recalculate it
        // This preserves "Now" or whatever end time was previously set
    }

    /**
     * Update the time range to reflect the currently selected range duration
     */
    private updateTimeRangeForSelectedRange() {
        // Special handling for hour_6 since it doesn't have its own bucket entry
        const count = this.#range === StatsRange.Hour6 ? 6 : undefined;
        let {start, end} = getStartAndEndOfBucket(this.bucketUtils, this.#startTime, count);
        this.#startTime = start;
        this.endTime = end;

    }

    nextDateRange() {
        // Special handling for hour_6 since it doesn't have its own bucket entry
        const count = this.#range === StatsRange.Hour6 ? 6 : this.#count;
        this.startTime = this.bucketUtils.value(this.bucketUtils.next(new Date(this.#startTime), count)).getTime();
        this.triggerTimeRangeChange()
    }

    prevDateRange() {
        // Special handling for hour_6 since it doesn't have its own bucket entry
        const count = this.#range === StatsRange.Hour6 ? 6 : this.#count;
        this.startTime = this.bucketUtils.value(this.bucketUtils.prev(new Date(this.#startTime), count)).getTime();
        this.triggerTimeRangeChange();
    }

    createStatsQueryRequest(ids: string[]): StatsQueryRequest {
        return {
            range: this.rangeData.period as StatsRange,
            count: this.rangeData.count,
            startTime: this.startTime,
            endTime: this.endTime,
            nodeIds: ids
        }
    }

    minifyStatsRange(val?: StatsRange): string {
        switch (val || this.range) {
            case StatsRange.Minute:
                return "1m";
            case StatsRange.Minute1:
                return "1m";
            case StatsRange.Minute15:
                return "15m";
            case StatsRange.Hour:
                return "1h";
            case StatsRange.Hour6:
                return "6h";
            case StatsRange.Day:
                return "1d";
            case StatsRange.Week:
                return "1w";
            default:
                throw new Error('Unable to minify a non-existent range');
        }
    }

    getAvailableRanges(): PickerDate[] {
        return [
            { value: StatsRange.Minute15, label: "15 minutes", short: "15m" },
            { value: StatsRange.Hour, label: "1 hour", short: "1hr" },
            { value: StatsRange.Hour6, label: "6 hours", short: "6hr" },
            { value: StatsRange.Day, label: "1 day", short: "1d" },
            { value: StatsRange.Week, label: "1 week", short: "1w" }
        ];
    }

    formatDisplayTime(timestamp: number): string {
        const date = new Date(timestamp);
        
        return `${date.toLocaleTimeString('en-US', { 
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false,
            })}`;
    }

    formatTimeRange(): string {
        const start = this.formatDisplayTime(this.startTime);
        const end = this.endTime ? this.formatDisplayTime(this.endTime) : 'Now';
        return `${start} - ${end}`;
    }

    bucketToNow() {
        
        this.#startTime = Date.now();
        this.updateTimeRangeForSelectedRange();
        this.triggerTimeRangeChange();
    }   
}