import { AppState } from '$lib/client/appstate.svelte';
import type { UserData } from '$lib/types';

// Disable SSR for authed pages — AppState is a reactive class that can't be
// serialized by devalue, causing the load function to run on both server and
// client (doubling all API calls).  Auth-gated dashboard pages have no SSR benefit.
export const ssr = false;

export async function load({data, fetch}): Promise<{appState: AppState}> {
    const appState = new AppState(fetch, data as UserData);

    // Don't block page render — kick off the data fetch and let the UI show
    // a loading state immediately. On large buses (8000+ items, 4MB response)
    // this avoids an 11+ second blank screen.
    appState.botState.fetchBotSettings().then(() => {
        appState.searchBarState.populateFromCatalog(
            appState.botState.catalogRows.map((r) => ({ id: r.id, name: r.name, type: r.kind })),
        );
    }).catch(() => {});

    return {appState};
}