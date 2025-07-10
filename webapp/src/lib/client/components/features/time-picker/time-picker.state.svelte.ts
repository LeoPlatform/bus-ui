import { StatsRange, type StatsQueryRequest } from "$lib/types";
import type { PickerDate } from "./types";
import { bucketsData, ranges } from "$lib/bucketUtils";
import { CalendarDateTime, getLocalTimeZone, now, toCalendarDateTime, toLocalTimeZone, type AnyTime } from "@internationalized/date";

type GlobalFetch = typeof globalThis.fetch;

export class TimePickerState {
    #fetch: GlobalFetch;
    #range: StatsRange = $state<StatsRange>(StatsRange.Minute15);
    #count: number = $state<number>(1);
    #startTime: number = $state<number>(Date.now());
    #endTime: number | undefined = $state<number | undefined>();
    #selectedDate: CalendarDateTime | undefined = $state<CalendarDateTime>();
    #customTime: string = $state(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
    #selectedRange: StatsRange = $state<StatsRange>(StatsRange.Minute15);
    #dateSelectorExpanded: boolean = $state<boolean>(false);
    #isExpanded: boolean = $state<boolean>(false);
    #onTimeRangeChange: ((state: TimePickerState) => void) | undefined = undefined;
    
    bucketUtils = $derived(bucketsData[this.#range]);
    
    #timeRangeString = $derived.by(() => {
        console.log('hit time range string derive');
        return this.formatTimeRange();
    });

    constructor(fetch: GlobalFetch) {
        this.#fetch = fetch;
        this.#range = StatsRange.Minute15;
        this.#count = 1;
        this.updateTimeRangeForSelectedRange();

        // Set up effect to watch for time range changes and trigger callback
        $effect(() => {
            // Track all the time-related state that should trigger a refetch
            const startTime = this.#startTime;
            const endTime = this.#endTime;
            const range = this.#range;
            const count = this.#count;
            
            // Call the callback if it's set (skip initial call during construction)
            if (this.#onTimeRangeChange) {
                console.log('TimePickerState: Time range changed, triggering callback');
                this.#onTimeRangeChange(this);
            }
        });
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

    get simplified() {
        return this.#isExpanded;
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
    
    get selectedRange() {
        return this.#selectedRange;
    }

    get timeRangeString() {
        return this.#timeRangeString;
    }

    get customTime() {
        return this.#customTime;
    }

    set selectedRange(val: StatsRange) {
        this.#selectedRange = val;
    }

    set isExpanded(val: boolean) {
        this.#isExpanded = val;
    }

    set dateSelectorExpanded(val: boolean) {
        this.#dateSelectorExpanded = val;
    }

    set startTime(val: number) {
        this.#startTime = val;
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
        let rangeData = ranges[val];
        console.log('hit the range set | ', val);
        this.selectedRange = val;
        this.#range = rangeData.period as StatsRange;
        this.#count = rangeData.count;
        
        // Update the time range when the range changes
        this.updateTimeRangeForSelectedRange();
    }

    set simplified(val: boolean) {
        this.#isExpanded = val;
    }

    set selectedDate(val: CalendarDateTime) {
        console.log('selected date set', val);
        this.#selectedDate = val;
        
        // Update the start time when a date is selected
        // this.updateTimeForSelectedDate(val);
    }

    set customTime(val: string) {
        this.#customTime = val;
    }

    submitDateChanges() {
        this.updateSelectedDateWithTime();
        this.dateSelectorExpanded = false;
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
                
                // console.log('Updated selectedDate with time:', updatedDate);
            } catch (error) {
                console.error('Error parsing time:', error);
            }
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
        this.#startTime = jsDate.getTime();

        this.calculateEndTimeForRange()
        
        // Keep the end time unchanged - don't recalculate it
        // This preserves "Now" or whatever end time was previously set
    }

    /**
     * Update the time range to reflect the currently selected range duration
     */
    private updateTimeRangeForSelectedRange() {
        // Align the current start time to the selected range
        this.#startTime = this.alignTimeToRange(this.#startTime);
        
        // Calculate the appropriate end time
        this.calculateEndTimeForRange();
    }

    /**
     * Align a timestamp to the appropriate boundary for the current range
     */
    private alignTimeToRange(timestamp: number): number {
        const date = new Date(timestamp);
        const bucketUtil = bucketsData[this.#range];
        
        if (bucketUtil) {
            return bucketUtil.value(date).getTime();
        }
        
        return timestamp;
    }

    /**
     * Calculate the end time based on the current range and count
     */
    private calculateEndTimeForRange() {
        const bucketUtil = bucketsData[this.#range];
        if (!bucketUtil) {
            this.#endTime = undefined;
            return;
        }

        const startDate = new Date(this.#startTime);
        let potentialEndDate = bucketUtil.next(startDate, this.#count).getTime();
        this.endTime = potentialEndDate;
    }

    nextDateRange() {
        const bucketUtil = bucketsData[this.#range];
        if (bucketUtil) {
            this.#startTime = bucketUtil.next(new Date(this.#startTime), this.#count).getTime();
            if (!this.#endTime) {
                this.endTime = bucketUtil.next(new Date(this.#startTime), this.#count).getTime();
            } else {
                this.endTime = bucketUtil.next(new Date(this.#endTime), this.#count).getTime();
            }
        }
    }

    prevDateRange() {
        const bucketUtil = bucketsData[this.#range];
        if (bucketUtil) {
            this.#startTime = bucketUtil.prev(new Date(this.#startTime), this.#count).getTime();
            if (!this.#endTime) {
                this.endTime = bucketUtil.next(new Date(this.#startTime), this.#count).getTime();
            } else {
                this.endTime = bucketUtil.prev(new Date(this.#endTime), this.#count).getTime();
            }
        }
    }

    calculateCountAndRange(range?: StatsRange) {
        switch (range) {
            case StatsRange.Minute:
                return {range: StatsRange.Minute, count: 1};
            case StatsRange.Minute1:
                return {range: StatsRange.Minute, count: 1};
            case StatsRange.Minute15:
                return {range: StatsRange.Minute15, count: 1};
            case StatsRange.Hour:
                return {range: StatsRange.Minute15, count: 4};
            case StatsRange.Hour6:
                return {range: StatsRange.Hour, count: 6};
            case StatsRange.Day:
                return {range: StatsRange.Hour6, count: 4};
            case StatsRange.Week:
                return {range: StatsRange.Day, count: 7};
            default:
                return {range: StatsRange.Minute15, count: 1};
        }
    }

    createStatsQueryRequest(ids: string[]): StatsQueryRequest {
        return {
            range: this.range,
            count: this.count,
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
        const bucketUtil = bucketsData[this.#range];
        
        if (bucketUtil) {
            this.#startTime = bucketUtil.value(new Date()).getTime();
            this.endTime = undefined;
        }
    }
}