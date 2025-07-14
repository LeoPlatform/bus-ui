<script lang="ts">
  import type { AppState } from '$lib/client/appstate.svelte';
  import { getContext } from 'svelte';
  import type { SearchItem } from './types';
  import Button from '../../ui/button/button.svelte';
  import { getLogicalId, getNodeTypeLink } from '$lib/utils';
  import Cog from '@lucide/svelte/icons/cog';

  type SearchResultProps = {
    item: SearchItem;
    isSelected?: boolean;
    index: number;
  }

  let appState = getContext<AppState>('appState');
  let {item, isSelected = false, index}: SearchResultProps = $props();
  
  function goToRelationshipView(item: SearchItem) {
    console.log('attempting to navigate to ', item.id);
    appState.navigateToRelationshipView(getLogicalId(item));
    appState.searchBarState?.clearSearch();
  }

  function goToDashboardView(item: SearchItem) {
    appState.navigateToDashboardView(getLogicalId(item));
    appState.searchBarState?.clearSearch();
  }

  function handleMouseEnter() {
    // Update selected index when hovering
    if (appState.searchBarState) {
      appState.searchBarState.selectedIndex = index;
    }
  }
</script>

<div 
  class={`border-b border-slate-700 last:border-b-0 ${isSelected ? 'bg-slate-600/50' : ''}`}
  onmouseenter={handleMouseEnter}
  role="option"
  aria-selected={isSelected}
  tabindex={isSelected ? 0 : -1}
>
  <div class="flex items-center gap-2 p-2 hover:bg-slate-700/50 transition-colors min-w-0">
    <!-- Main result button -->
    <Button
      variant="ghost"
      class={`flex-1 flex items-center gap-3 h-auto p-2 justify-start text-left hover:bg-transparent min-w-0 overflow-hidden ${isSelected ? 'bg-slate-600/30' : ''}`}
      onclick={() => goToRelationshipView(item)}
    >
      <!-- Node type icon -->
      <div class="flex-shrink-0">
        <img 
          src={getNodeTypeLink(item.type)} 
          class="w-6 h-6 rounded" 
          alt={item.type}
        />
      </div>
      
      <!-- Item details -->
      <div class="flex-1 min-w-0 overflow-hidden">
        <div class="text-sm font-medium text-white truncate">
          {item.id}
        </div>
        {#if item.name && item.name !== item.id}
          <div class="text-xs text-white/60 truncate">
            {item.name}
          </div>
        {/if}
      </div>
    </Button>

    <!-- Dashboard button -->
    <Button 
      variant="ghost" 
      size="icon"
      class={`flex-shrink-0 h-8 w-8 text-white/50 hover:text-white hover:bg-slate-600/50 ${isSelected ? 'bg-slate-600/30' : ''}`}
      onclick={() => goToDashboardView(item)}
      aria-label="Go to dashboard"
    >
      <Cog class="h-5 w-5" />
    </Button>
  </div>
</div>