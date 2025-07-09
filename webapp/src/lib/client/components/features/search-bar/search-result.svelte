<script lang="ts">
    import type { AppState } from '$lib/client/appstate.svelte';
    import { getContext } from 'svelte';
  import type { SearchItem } from './types';
  import Button from '../../ui/button/button.svelte';
  import { getLogicalId, getNodeTypeLink } from '$lib/utils';
  import Cog from '@lucide/svelte/icons/cog'

    type SearchResultProps = {
        item: SearchItem,
    }

    let appState = getContext<AppState>('appState');
    let {item}: SearchResultProps = $props();
    
    function goToRelationshipView(item: SearchItem) {
        console.log('attempting to navigate to ',item.id);
        appState.navigateToRelationshipView(getLogicalId(item));
    }

    function goToDashboardView(item: SearchItem) {
        appState.navigateToDashboardView(getLogicalId(item));
    }
    
</script>

<div class="flex-row h-full">
    <div class="flex justify-between h-14">
       
        <Button
            variant="ghost"
            class="flex-row items-center w-7/8 h-auto"
            onclick={() => goToRelationshipView(item)}
        >
            <img src={getNodeTypeLink(item.type)} class="w-1/16 mt-auto mb-auto ml-auto mr-auto" alt={item.type}/>
            <span class="w-15/16 mt-auto mb-auto text-left">{item.id}</span>
        </Button>
        <Button variant="ghost" class='w-1/8 h-auto' onclick={() => goToDashboardView(item)}>
            <Cog class='m-1/4 h-auto' />
        </Button>

    </div>
</div>
