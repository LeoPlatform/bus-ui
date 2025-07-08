import { AppState } from '$lib/client/appstate.svelte';
import type { UserData } from '$lib/types';

export async function load({data, fetch}): Promise<{appState: AppState}> {
    const appState = new AppState(fetch, data as UserData);

    await Promise.all([appState.botState.fetchBotSettings(), appState.searchBarState?.getSearchResources()])

    return {appState};
}