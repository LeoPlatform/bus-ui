<script lang="ts">
    import type { AppState } from '$lib/client/appstate.svelte';
    import { getContext } from 'svelte';
  import type { SearchItem } from './types';
  import Button from '../../ui/button/button.svelte';
  import { getNodeTypeLink } from '$lib/utils';
  import Cog from '@lucide/svelte/icons/cog'

    type SearchResultProps = {
        item: SearchItem,
    }

    let appState = getContext<AppState>('appState');
    let {item}: SearchResultProps = $props();
    
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
       
        <Button
            variant="ghost"
            class="flex items-center"
            onclick={() => goToRelationshipView(item.id)}
        >
            <img src={getNodeTypeLink(item.type)} class="w-1/2 h-11" alt={item.type}/>
            <span class="w-1/2 h-11">{item.name}</span>
        </Button>
        <Button variant="ghost" onclick={() => goToDashboardView(item.id)}>
            <Cog />
        </Button>

    </div>
</div>
