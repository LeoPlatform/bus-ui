<script lang="ts">
    import ListTree from '@lucide/svelte/icons/list-tree';
  import Button from '$lib/client/components/ui/button/button.svelte';
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/client/appstate.svelte';
  
    type CellProps = {
        id: string,
        tags?: string,
    }

    let appState = getContext<AppState>('appState');
    let {id, tags}: CellProps = $props();
    let tagsArr = tags?.split(',').filter(tag => tag !== '') ?? [];

    function goToRelationshipView(id: string) {
        console.log('attempting to navigate to ',id);
        appState.navigateToRelationshipView(id);
    }

    function goToDashboardView(id: string) {
        appState.navigateToDashboardView(id);
    }

</script>

<div class="flex-row">
    <div class="flex justify-between">
        <div class="flex items-center">
            <Button variant="ghost" class="p-1 w-11 h-11" onclick={() => goToDashboardView(id)}>
                <img src="/bot.png" alt="Bot" class="w-full h-full object-contain" />
            </Button>
            <div class="ml-2">{id}</div>
        </div>
        <Button variant="ghost" onclick={() => goToRelationshipView(id)}>
            <ListTree />
        </Button>

    </div>
    {#if tagsArr}
        <div class="flex flex-wrap px-10">
            {#each tagsArr as tag}
                <span class="ml-2 mb-1 px-2 border rounded-sm bg-slate-200" >{tag}</span>
            {/each}
        </div>
    {/if}
</div>