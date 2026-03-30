import { AppState } from '$lib/client/appstate.svelte';
import type { UserData } from '$lib/types';

export async function load({data, fetch}): Promise<{appState: AppState}> {
    const appState = new AppState(fetch, data as UserData);

    await Promise.all([appState.botState.fetchBotSettings(), appState.searchBarState?.getSearchResources()]);

    try {
        const ids = appState.botState.botSettings
            .filter((b) => !b.archived)
            .map((b) => b.id);
        if (ids.length > 0) {
            appState.botState.visibleIds = ids;
            await appState.botState.fetchBotStats();
        }
    } catch {
        // Stats optional for SSR / flaky API; alarm badge stays 0 until client refresh
    }

    return {appState};
}