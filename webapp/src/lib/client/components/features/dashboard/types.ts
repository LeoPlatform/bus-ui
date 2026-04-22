import type { BotSettings, QueueSettings } from "$lib/types";

export interface DashboardTab {
    label: DashboardTabType;
}

export enum DashboardTabType {
    Dashboard = 'dashboard',
    Settings = 'settings',
    Events = 'events',
    Schema = 'schema',
}

export type DashboardTag = {
    repo?: string;
} & Record<string, string>;

/**
 * Parses a string in the format "key1:value1,key2:value2,key3:value3" into DashboardTag
 * @param tagString - String in format "app:media-service,workflow:media,component:media-video-bot"
 * @returns DashboardTag object with parsed key-value pairs
 */
export function parseDashboardTags(tagString: string): DashboardTag {
    if (!tagString || typeof tagString !== 'string') {
        return {};
    }

    const tags: DashboardTag = {};
    
    // Split by comma and then by colon for each pair
    const pairs = tagString.split(',').filter(pair => pair.trim());
    
    for (const pair of pairs) {
        const [key, ...valueParts] = pair.split(':');
        if (key && valueParts.length > 0) {
            const value = valueParts.join(':'); // Rejoin in case value contains colons
            tags[key.trim()] = value.trim();
        }
    }
    
    return tags;
}

export type DashboardSettings = BotSettings & QueueSettings;