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

/** Types legacy refuses to save without host/database; this tab has no inputs for either. */
export const TYPES_NEEDING_CONNECTION_SETTINGS = ['Elastic Search', 'MongoDB'];

/**
 * Why the System Settings form must refuse to save, or null when saving is safe.
 * Only a change INTO a connection-settings type is blocked; editing or leaving one is fine.
 */
export function systemSaveBlockedReason(args: {
    settingsError: string | null;
    systemType: string;
    originalType: string;
}): string | null {
    if (args.settingsError !== null) {
        return `This system's settings could not be loaded, so the form does not reflect the saved record. Saving now would overwrite it. (${args.settingsError})`;
    }
    if (
        args.systemType !== args.originalType &&
        TYPES_NEEDING_CONNECTION_SETTINGS.includes(args.systemType)
    ) {
        return `${args.systemType} needs connection settings (host, database) that this tab cannot edit yet. Set this type in legacy botmon instead.`;
    }
    return null;
}

/**
 * Whether the periodic refresh may re-read the page's settings record. The Settings tabs seed
 * their form fields from it in an `$effect`, so replacing it mid-edit resets the operator's
 * input. Stats keep refreshing either way.
 */
export function mayRefreshSettings(activeTab: DashboardTabType | string): boolean {
    return activeTab !== DashboardTabType.Settings;
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