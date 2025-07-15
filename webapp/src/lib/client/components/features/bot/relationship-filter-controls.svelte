<!-- RelationshipFilterControls.svelte -->
<script lang="ts">
  import Search from '@lucide/svelte/icons/search';
  import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
  import Eye from '@lucide/svelte/icons/eye';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  
  import type { FilterOptions } from './types';
  
  // shadcn-svelte components
  import { Input } from '../../ui/input';
  import { Button } from '../../ui/button';
  import { Label } from '../../ui/label';
  import { Checkbox } from '../../ui/checkbox';

  import * as Select from '../../ui/select';
  import * as Drawer from '../../ui/drawer';

  import { Separator } from '../../ui/separator';

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
    open?: boolean;
    filterChange: (filterOptions: FilterOptions) => void;
  }

  let {
    nodeId,
    direction,
    filterOptions = $bindable(),
    summary,
    open = $bindable(false),
    filterChange,
  }: Props = $props();

  let searchValue = $state(filterOptions.searchTerm);

  // Sync searchValue when filterOptions change
  $effect(() => {
    searchValue = filterOptions.searchTerm;
  });

  function handleFilterChange() {
    filterChange(filterOptions);
  }

  function handleSearchChange() {
    filterOptions.searchTerm = searchValue;
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
    searchValue = '';
    filterChange(filterOptions);
  }

  function handleSortChange(value: string) {
    filterOptions.sortBy = value as FilterOptions['sortBy'];
    handleFilterChange();
  }

  function handleRelationshipTypeChange(value: string) {
    filterOptions.relationshipType = value as FilterOptions['relationshipType'];
    handleFilterChange();
  }

  function handleShowCountChange(event: Event) {
    const target = event.target as HTMLInputElement;
    filterOptions.showCount = parseInt(target.value);
    handleFilterChange();
  }

  function handleIncludeInactiveChange(checked: boolean) {
    filterOptions.includeInactive = checked;
    handleFilterChange();
  }
</script>

<Drawer.Root bind:open onOpenChange={(newOpen) => open = newOpen}>
  <Drawer.Content>
    <div class="mx-auto w-full max-w-sm">
      <Drawer.Header>
        <Drawer.Title>Filter {direction} relationships</Drawer.Title>
        <Drawer.Description>
          Configure filtering options for {direction} relationships.
        </Drawer.Description>
      </Drawer.Header>
      
      <div class="px-4 space-y-6">
        <!-- Search -->
        <div class="space-y-2">
          <Label class="flex items-center gap-2">
            <Search class="h-4 w-4" />
            Search
          </Label>
          <Input
            type="text"
            placeholder="Search relationships..."
            bind:value={searchValue}
            oninput={handleSearchChange}
          />
        </div>

        <Separator />

        <!-- Sort options -->
        <div class="space-y-2">
          <Label class="flex items-center gap-2">
            <ArrowUpDown class="h-4 w-4" />
            Sort by
          </Label>
          <Select.Root type="single" value={filterOptions.sortBy} onValueChange={handleSortChange}>
            <Select.Trigger>
              <div class="flex items-center gap-2">
                <span class="capitalize">{filterOptions.sortBy}</span>
                <!-- <ChevronDown class="h-4 w-4 opacity-50" /> -->
              </div>
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="importance">Importance</Select.Item>
              <Select.Item value="recent">Most Recent</Select.Item>
              <Select.Item value="activity">Most Active</Select.Item>
              <Select.Item value="alphabetical">Alphabetical</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        <!-- Relationship type filter -->
        <div class="space-y-2">
          <Label>Relationship Type</Label>
          <Select.Root type="single" value={filterOptions.relationshipType} onValueChange={handleRelationshipTypeChange}>
            <Select.Trigger>
              <div class="flex items-center gap-2">
                <span class="capitalize">{filterOptions.relationshipType}</span>
                <!-- <ChevronDown class="h-4 w-4 opacity-50" /> -->
              </div>
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All</Select.Item>
              <Select.Item value="children">Children only</Select.Item>
              <Select.Item value="parents">Parents only</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        <Separator />

        <!-- Show count -->
        <div class="space-y-2">
          <Label class="flex items-center gap-2">
            <Eye class="h-4 w-4" />
            Show count: {filterOptions.showCount}
          </Label>
          <Input
            type="range"
            min="3"
            max="20"
            value={filterOptions.showCount}
            class="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider"
            onchange={handleShowCountChange}
          />
          <div class="flex justify-between text-xs text-muted-foreground">
            <span>3</span>
            <span>20</span>
          </div>
        </div>

        <!-- Include inactive -->
        <div class="flex items-center space-x-2">
          <Checkbox
            id="include-inactive"
            checked={filterOptions.includeInactive}
            onCheckedChange={handleIncludeInactiveChange}
          />
          <Label for="include-inactive" class="text-sm font-normal">
            Include inactive relationships
          </Label>
        </div>

        <!-- Show more button -->
        {#if summary.hasMore}
          <Button 
            variant="outline" 
            class="w-full"
            onclick={handleShowMore}
          >
            Show More
            <span class="ml-1 text-xs text-muted-foreground">
              (+{Math.min(5, summary.total - summary.showing)})
            </span>
          </Button>
        {/if}

        <!-- Summary info -->
        <div class="text-xs text-muted-foreground text-center pt-2 border-t">
          <div>
            {#if filterOptions.searchTerm}
              Found {summary.filtered} matches, showing {summary.showing}
            {:else}
              Showing {summary.showing} of {summary.total} relationships
            {/if}
          </div>
        </div>
      </div>

      <Drawer.Footer>
        <Button onclick={resetFilters}>
          <RotateCcw class="h-4 w-4 mr-2" />
          Reset All Filters
        </Button>
        <Drawer.Close>
          <Button variant="outline" class="w-full">Close</Button>
        </Drawer.Close>
      </Drawer.Footer>
    </div>
  </Drawer.Content>
</Drawer.Root>

<style>
  .slider::-webkit-slider-thumb {
    appearance: none;
    height: 1rem;
    width: 1rem;
    border-radius: 50%;
    background: hsl(var(--primary));
    cursor: pointer;
  }
  
  .slider::-moz-range-thumb {
    height: 1rem;
    width: 1rem;
    border-radius: 50%;
    background: hsl(var(--primary));
    cursor: pointer;
    border: none;
  }
</style>