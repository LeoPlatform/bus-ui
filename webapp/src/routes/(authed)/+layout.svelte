<script lang="ts">
    import { onDestroy, onMount, setContext } from 'svelte';
    import type { AppState } from '$lib/client/appstate.svelte';
    import { alarmedBotNavCount } from '$lib/client/shell-badge';
    import SearchBar from '$lib/client/components/features/search-bar/search-bar.svelte';
    import TimePicker from '$lib/client/components/features/time-picker/time-picker.svelte';

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

    onMount(() => {
        appState.timePickerState.isExpanded = true;
    });
</script>

<div class="flex h-full min-h-0 w-full flex-col">
    <header
        class="sticky top-0 z-20 shrink-0 border-b border-border/50 bg-background/95 px-3 py-2 backdrop-blur sm:px-4 supports-[backdrop-filter]:bg-background/80"
    >
        <div
            class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        >
            <div class="w-full min-w-0 sm:min-w-[12rem] sm:flex-1">
                <SearchBar />
            </div>
            <div
                class="flex min-w-0 w-full justify-end overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] sm:w-auto sm:shrink-0 sm:justify-end sm:pb-0 sm:overflow-visible"
            >
                <TimePicker />
            </div>
        </div>
    </header>

    <div class="flex min-h-0 flex-1 flex-col overflow-auto">
        {@render children()}
    </div>
</div>
