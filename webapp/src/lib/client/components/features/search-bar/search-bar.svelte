<script lang="ts">
  import type { AppState } from "$lib/client/appstate.svelte";
  import { getContext, onMount } from "svelte";
  import Search from "@lucide/svelte/icons/search";
  import Input from "../../ui/input/input.svelte";
  import { cn, getLogicalId } from "$lib/utils";
  import Button from "../../ui/button/button.svelte";
  import X from "@lucide/svelte/icons/x";
  import SearchResult from "./search-result.svelte";

  const appState = getContext<AppState>('appState');
  const componentState = appState.searchBarState!;

  type SearchProps = {
    class?: string
  };
  let {class: className}: SearchProps = $props();

  let inputElement: HTMLInputElement;

  function handleInputChange(event: Event) {
    componentState.searchQuery = (event.target as HTMLInputElement).value;
  }

  function focusInput() {
    if (inputElement) {
      inputElement.focus();
    }
  }

  function isTypableCharacter(key: string): boolean {
    // Check if it's a single character (letters, numbers, symbols, etc.)
    return key.length === 1 && !key.match(/[\x00-\x1F\x7F]/);
  }

  function isInputFocused(): boolean {
    const activeElement = document.activeElement;
    return activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    );
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    // Handle arrow keys and Enter when search is open
    if (componentState.isOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        componentState.navigateDown();
        return;
      }
      
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        componentState.navigateUp();
        return;
      }
      
      if (event.key === 'Enter') {
        event.preventDefault();
        const selectedItem = componentState.selectedItem;
        if (selectedItem) {
          appState.navigateToRelationshipView(getLogicalId(selectedItem));
          componentState.clearSearch();
        }
        return;
      }
    }

    // Don't interfere if user is already typing in an input field (except for our search input)
    if (isInputFocused() && document.activeElement !== inputElement) {
      return;
    }

    // Don't interfere with modifier key combinations
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    // Handle special keys
    if (event.key === 'Escape') {
      componentState.clearSearch();
      if (inputElement) {
        inputElement.blur();
      }
      return;
    }

    // Handle slash key for search focus (common pattern)
    if (event.key === '/') {
      event.preventDefault();
      focusInput();
      return;
    }

    // Handle backspace to clear search
    if (event.key === 'Backspace' && componentState.searchQuery.length > 0) {
      event.preventDefault();
      componentState.searchQuery = componentState.searchQuery.slice(0, -1);
      focusInput();
      return;
    }

    // Handle typable characters
    if (isTypableCharacter(event.key)) {
      event.preventDefault();
      componentState.searchQuery += event.key;
      focusInput();
    }
  }

  onMount(() => {
    // Add global keydown listener
    document.addEventListener('keydown', handleGlobalKeydown);

    // Cleanup function
    return () => {
      document.removeEventListener('keydown', handleGlobalKeydown);
    };
  });
</script>

<div class="relative w-full max-w-md">
  <div class="relative">
    <!-- Search icon -->
    <div class="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 z-10">
      <Search class="h-5 w-5" />
    </div>

    <!-- Input field -->
    <Input
      bind:this={inputElement}
      placeholder="Search... (or just start typing)"
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
      role="listbox"
      aria-label="Search results"
    >
      {#if componentState.searchResults.length === 0}
        <div class="p-3 text-sm text-white/50">
          No results found
        </div>
      {:else}
        {#each componentState.searchResults as result, index}
          <SearchResult 
            item={result} 
            isSelected={index === componentState.selectedIndex}
            {index}
          />
        {/each}
      {/if}
    </div>
  {/if}
</div>