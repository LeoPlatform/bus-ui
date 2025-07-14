<!-- RelationshipFilterControls.svelte -->
<script lang="ts">
//   import { Search, Filter, ArrowUpDown, Eye, EyeOff } from 'lucide-svelte';
    import Search from '@lucide/svelte/icons/search';
    import Filter from '@lucide/svelte/icons/list-filter';
    import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
    import Eye from '@lucide/svelte/icons/eye';
    import EyeOff from '@lucide/svelte/icons/eye-off';
  import type { FilterOptions } from './types';
  import { slide } from 'svelte/transition';
  import { Input } from '../../ui/input';
  import Button from '../../ui/button/button.svelte';
  import X from '@lucide/svelte/icons/x';

  interface Props {
    nodeId: string;
    direction: 'children' | 'parents';
    filterOptions: FilterOptions;
    summary: {
      total: number;
      showing: number;
      filtered: number;
      hasMore: boolean;
    };
    isVisible?: boolean;
    filterChange:(filterOptions: FilterOptions) => void;
    toggleVisibility:() => void
  }

  let {
    nodeId,
    direction,
    filterOptions = $bindable(),
    summary,
    isVisible = false,
    filterChange,
    toggleVisibility,
  }: Props = $props();

//   const dispatch = createEventDispatcher<{
//     'filter-change': FilterOptions;
//     'toggle-visibility': boolean;
//     'show-more': void;
//   }>();

  let showAdvancedFilters = $state(false);

  function handleFilterChange() {
    filterChange(filterOptions);
  }

  function handleShowMore() {
    filterOptions.showCount = Math.min(filterOptions.showCount + 5, summary.total);
    filterChange(filterOptions);
  }

  function resetFilters() {
    filterOptions = {
      searchTerm: '',
      relationshipType: 'all',
      sortBy: 'importance',
      showCount: 7,
      includeInactive: true
    };
    filterChange(filterOptions);
  }
</script>

{#if isVisible}
  <div class="filter-controls" transition:slide={{ duration: 200 }}>
    <div class="filter-header">
      <div class="filter-title">
        <Filter class="w-4 h-4" />
        <span>Filter {direction} ({summary.showing}/{summary.total})</span>
      </div>
      <button 
        class="toggle-advanced"
        onclick={() => showAdvancedFilters = !showAdvancedFilters}
      >
        {showAdvancedFilters ? 'Less' : 'More'}
      </button>
      <Button
        variant="ghost"
        size="icon"
        class="ml-auto"
        onclick={toggleVisibility}
      >
        <X />
      </Button>
    </div>

    <!-- Search -->
    <div class="search-container">
      <Search class="search-icon w-4 h-4" />
      <input
        type="text"
        placeholder="Search relationships..."
        bind:value={filterOptions.searchTerm}
        class="search-input"
        onkeyup={handleFilterChange}
      />
    </div>

    <!-- Quick actions -->
    <div class="quick-actions">
      <button 
        class="quick-action"
        onclick={handleShowMore}
        disabled={!summary.hasMore}
      >
        Show More ({Math.min(5, summary.total - summary.showing)} more)
      </button>
      
      <button class="quick-action" onclick={resetFilters}>
        Reset
      </button>
    </div>

    {#if showAdvancedFilters}
      <div class="advanced-filters" transition:slide={{ duration: 150 }}>
        <!-- Sort options -->
        <div class="filter-group">
          <label class="filter-label">
            <ArrowUpDown class="w-4 h-4" />
            Sort by
          </label>
          <select bind:value={filterOptions.sortBy} onchange={handleFilterChange} class="filter-select">
            <option value="importance">Importance</option>
            <option value="recent">Most Recent</option>
            <option value="activity">Most Active</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
        </div>

        <!-- Show count -->
        <div class="filter-group">
          <label class="filter-label">
            <Eye class="w-4 h-4" />
            Show count
          </label>
          <Input
            type="range"
            min="3"
            max="20"
            bind:value={filterOptions.showCount}
            onchange={handleFilterChange}
            class="filter-range"
          />
          <span class="filter-value">{filterOptions.showCount}</span>
        </div>

        <!-- Include inactive -->
        <div class="filter-group">
          <label class="filter-checkbox">
            <input
              type="checkbox"
              bind:checked={filterOptions.includeInactive}
              onchange={handleFilterChange}
            />
            Include inactive relationships
          </label>
        </div>

        <!-- Relationship type filter -->
        <div class="filter-group">
          <label class="filter-label">Type</label>
          <div class="radio-group">
            <label class="radio-label">
              <input
                type="radio"
                bind:group={filterOptions.relationshipType}
                value="all"
                onchange={handleFilterChange}
              />
              All
            </label>
            <label class="radio-label">
              <input
                type="radio"
                bind:group={filterOptions.relationshipType}
                value={direction}
                onchange={handleFilterChange}
              />
              {direction === 'children' ? 'Children only' : 'Parents only'}
            </label>
          </div>
        </div>
      </div>
    {/if}

    <!-- Summary info -->
    {#if summary.total > 10}
      <div class="summary-info">
        <div class="summary-text">
          {#if filterOptions.searchTerm}
            Found {summary.filtered} matches, showing {summary.showing}
          {:else}
            Showing top {summary.showing} of {summary.total} relationships
          {/if}
        </div>
        {#if summary.hasMore}
          <div class="has-more-indicator">
            +{summary.total - summary.showing} more available
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .filter-controls {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px;
    margin: 8px 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    font-size: 14px;
    min-width: 280px;
    max-width: 320px;
  }

  .filter-header {
    display: flex;
    justify-content: between;
    align-items: center;
    margin-bottom: 12px;
  }

  .filter-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: #374151;
  }

  .toggle-advanced {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .toggle-advanced:hover {
    background-color: #f3f4f6;
  }

  .search-container {
    position: relative;
    margin-bottom: 12px;
  }

  .search-icon {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
  }

  .search-input {
    width: 100%;
    padding: 8px 8px 8px 32px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .quick-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .quick-action {
    flex: 1;
    padding: 6px 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .quick-action:hover:not(:disabled) {
    background: #e2e8f0;
  }

  .quick-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .advanced-filters {
    border-top: 1px solid #e5e7eb;
    padding-top: 12px;
    margin-top: 12px;
  }

  .filter-group {
    margin-bottom: 12px;
  }

  .filter-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 6px;
    font-size: 13px;
  }

  .filter-select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 13px;
    background: white;
  }

  .filter-range {
    width: calc(100% - 40px);
    margin-right: 8px;
  }

  .filter-value {
    font-weight: 600;
    color: #374151;
    font-size: 13px;
    min-width: 32px;
    display: inline-block;
  }

  .filter-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #374151;
    cursor: pointer;
  }

  .radio-group {
    display: flex;
    gap: 12px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #374151;
    cursor: pointer;
  }

  .summary-info {
    border-top: 1px solid #e5e7eb;
    padding-top: 8px;
    margin-top: 8px;
  }

  .summary-text {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 4px;
  }

  .has-more-indicator {
    font-size: 11px;
    color: #9ca3af;
    font-style: italic;
  }
</style>