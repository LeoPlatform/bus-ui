import type { DashboardStats, DashboardStatsValue, StatsRange } from "$lib/types";

export type ChartType = 'events-in-queue' | 'queue-lag' | 'events-read' | 'events-written' | 'execution-count' | 'error-count' | 'execution-time' | 'write-lag';
export interface Chart {
    type: ChartType;
    data: DashboardStatsValue[] | DashboardStats;
    dataSetLabel?: string;
    tooltipLabel?: string;
    helpText?: string;
    dataIsTimeBased?: boolean;
    includeFullCount?: boolean;
    includeCurrentValue?: boolean;
    queueId?: string;
    botId?: string;
    range?: StatsRange;
}

// Different type of tabs
// 1. Bot Details -> Execution Count, Error Count, Execution Time
// 2. Queue Read -> Events In Queue, Events Read, Queue & Source Lag
// 3. Queue Write -> Events Written, Write Lag

export interface ChartTab {
    type: 'read' | 'write' | 'bot-details';
    label: string;
    charts: Chart[];
}