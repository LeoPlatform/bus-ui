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

/**
 * System types legacy required connection settings for before it would save
 * (host/database, `ui/js/components/tabs/systemSettings.jsx`). The botmonAlpha tab has no
 * inputs for them.
 */
export const TYPES_NEEDING_CONNECTION_SETTINGS = ['Elastic Search', 'MongoDB'];

/**
 * Why the System Settings form must refuse to save, or null when saving is safe (ES-4286).
 *
 * Two ways a save destroys a record. Saving after a failed load writes whatever the form
 * happens to hold — historically the previously viewed node's values — over the real item.
 * And setting a type that needs connection settings this tab cannot supply leaves a system
 * configured for a backend it has no host or database for.
 *
 * Changing away from such a type is fine, and so is editing the label or icon of a system
 * already set to one; only a change INTO one is blocked.
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