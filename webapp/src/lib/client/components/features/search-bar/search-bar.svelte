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
      let {class: className} = $props();
    // function searchItems() {
    //   componentState.searchItems();
    // }

    function handleInputChange(event: Event) {
      componentState.searchQuery = (event.target as HTMLInputElement).value;
      componentState.performSearch();
    }


</script>

<div class="relative w-full">
  <div class="relative">
    <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
			<Search class="h-4 w-4" />
		</div>

    <Input
      placeholder="Search..."
      class={cn(
				'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border pl-10 pr-10 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className
			)}
      bind:value={componentState.searchQuery}
      oninput={handleInputChange}
      aria-expanded={componentState.isOpen}
    />

    {#if componentState.showClearButton && componentState.searchQuery}
        <Button
          variant="ghost"
          size="icon"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
          onclick={componentState.clearSearch}
        >
          <X class="h-4 w-4" />
        </Button>
    {/if}
  </div>

  <!--RESULTS DROPDOWN-->
  {#if componentState.isOpen}
  <div 
    data-fuzzy-dropdown
    class={cn(
      'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md'
    )}
  >
      {#each componentState.searchResults as result, index}
        <SearchResult item={result} />
      {/each}
  </div>
  {/if}
</div>

