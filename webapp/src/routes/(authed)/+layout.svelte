<script lang="ts">
    import { onDestroy, setContext } from 'svelte';
    import type { LayoutData } from './$types';
    import type { AppState } from '$lib/client/appstate.svelte';
    import { alarmedBotNavCount } from '$lib/client/shell-badge';
    import SearchBar from '$lib/client/components/features/search-bar/search-bar.svelte';

    interface Props {
        data: {
            appState: AppState;
        },
        children: any;
    }

    let { children, data }: Props = $props();

    const appState = data.appState;

    setContext('appState', appState);

    $effect(() => {
        void appState.botState.botSettings;
        alarmedBotNavCount.set(appState.botState.alarmedBotCount);
    });

    onDestroy(() => alarmedBotNavCount.set(0));
</script>

<header
    class="sticky top-0 z-20 border-b border-border/50 bg-background/95 px-3 py-2 backdrop-blur sm:px-4 supports-[backdrop-filter]:bg-background/80"
>
    <div class="w-full max-w-7xl">
        <div class="max-w-md">
            <SearchBar />
        </div>
    </div>
</header>

{@render children()}
