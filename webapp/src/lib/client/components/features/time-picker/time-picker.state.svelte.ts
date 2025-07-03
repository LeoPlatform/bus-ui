import { StatsRange, type StatsQueryRequest } from "$lib/types";
import type { PickerDate } from "./types";
import { bucketsData, ranges } from "$lib/bucketUtils";
import { CalendarDateTime, getLocalTimeZone, now, toCalendarDateTime } from "@internationalized/date";


type GlobalFetch = typeof globalThis.fetch;

export class TimePickerState {
    #fetch: GlobalFetch;
    #range: StatsRange = $state<StatsRange>(StatsRange.Minute15);
    #count: number = $state<number>(1);
    #startTime: number = $state<number>(Date.now());
    #endTime: number | undefined = $state<number | undefined>();
    #selectedDate: CalendarDateTime | undefined = $state<CalendarDateTime>();
    #selectedRange: StatsRange = $state<StatsRange>(StatsRange.Minute15);
    #dateSelectorExpanded: boolean = $state<boolean>(false);
    #isExpanded: boolean = $state<boolean>(false);
    bucketUtils = $derived(bucketsData[this.#range]);
    #timeRangeString = $derived.by(() => {
        console.log('hit time range string derive')
        const startTime = this.startTime;
        const endTime = this.endTime;

        return this.formatTimeRange();
    })


    constructor(fetch: GlobalFetch) {
        this.#fetch = fetch;
        const {range, count} = this.calculateCountAndRange(undefined);
        this.#range = range;
        this.#count = count;
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
        this.#endTime = val;
    }

    set range(val: StatsRange) {
        console.log('hit the range set | ', val);
        this.selectedRange = val;
        const {range, count} = this.calculateCountAndRange(val);
        console.log('resulting range', range);
        this.#range = range;
        this.#count = count;
    }

    set simplified(val: boolean) {
        this.#isExpanded = val;
    }

    set selectedDate(val: CalendarDateTime) {
        console.log('selected date set', val);
        this.#selectedDate = val;
    }

    nextDateRange() {
        this.startTime = this.bucketUtils.next(new Date(this.startTime, this.count)).getTime();
        if(this.endTime) {
            this.endTime = this.bucketUtils.next(new Date(this.endTime, this.count)).getTime();
        }
    }

    prevDateRange() {
        this.startTime = this.bucketUtils.prev(new Date(this.startTime), this.count).getTime();
        if(this.endTime) {
            this.endTime = this.bucketUtils.prev(new Date(this.endTime), this.count).getTime();
        }
    }


    calculateCountAndRange(range?: StatsRange) {
        switch (range) {
            case StatsRange.Minute:
                return {range: StatsRange.Minute, count: 1};;
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
                hour12: false
            })}`;
    }

    formatTimeRange(): string {
        const start = this.formatDisplayTime(this.startTime);
        const end = this.endTime ? this.formatDisplayTime(this.endTime) : 'Now';
        return `${start} - ${end}`;
    }
}