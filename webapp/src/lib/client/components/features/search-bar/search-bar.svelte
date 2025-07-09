<script lang="ts">
  import type { AppState } from "$lib/client/appstate.svelte";
  import { getContext } from "svelte";
  import Search from "@lucide/svelte/icons/search";
  import Input from "../../ui/input/input.svelte";
  import { cn } from "$lib/utils";
  import Button from "../../ui/button/button.svelte";
  import X from "@lucide/svelte/icons/x";
  import SearchResult from "./search-result.svelte";

  const componentState = getContext<AppState>('appState').searchBarState!;

  type SearchProps = {
    class?: string
  };
  let {class: className}: SearchProps = $props();

  function handleInputChange(event: Event) {
    componentState.searchQuery = (event.target as HTMLInputElement).value;
    // console.log('searchQuery:', componentState.searchQuery);
    // console.log('showClearButton:', componentState.showClearButton);
    // componentState.performSearch();
  }
</script>

<div class="relative w-full max-w-md">
  <div class="relative">
    <!-- Search icon -->
    <div class="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 z-10">
      <Search class="h-5 w-5" />
    </div>

    <!-- Input field -->
    <Input
      placeholder="Search..."
      class={cn(
        'border-input bg-slate-700 placeholder:text-white/50 flex h-10 w-full rounded-md border text-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'pl-10', // Left padding for search icon
        componentState.showClearButton ? 'pr-10' : 'pr-3', // Right padding for clear button
        className
      )}
      bind:value={componentState.searchQuery}
      oninput={handleInputChange}
      aria-expanded={componentState.isOpen}
    />

    <!-- Clear button -->
    {#if componentState.showClearButton}
      <Button
        variant="ghost"
        size="icon"
        class="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-white/50 hover:text-white hover:bg-white/10 z-10"
        aria-label="Clear search"
        onclick={componentState.clearSearch}
      >
        <X class="h-5 w-5" />
      </Button>
    {/if}
  </div>

  <!-- Search results dropdown -->
  {#if componentState.isOpen}
    <div 
      data-fuzzy-dropdown
      class={cn(
        'absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-slate-600 bg-slate-800 shadow-lg',
        'max-h-60 overflow-y-auto'
      )}
    >
      {#if componentState.searchResults.length === 0}
        <div class="p-3 text-sm text-white/50">
          No results found
        </div>
      {:else}
        {#each componentState.searchResults as result, index}
          <SearchResult item={result} />
        {/each}
      {/if}
    </div>
  {/if}
</div>