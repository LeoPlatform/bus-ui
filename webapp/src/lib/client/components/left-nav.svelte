<script lang="ts">
  import type { Route } from "$lib/types";
  import * as Tooltip from '$lib/client/components/ui/tooltip/index';
  import { Button } from "$lib/client/components/ui/button";
  import { page } from '$app/state';

  const currentRoute = $derived(page.url.pathname ? page.url.pathname : '/');

  type Props = {
    routes: Route[];
    appState?: any;
  }

  let { routes, appState } = $props();

  // Mock data for demonstration - you can replace with real data
  const mockBadgeCount = 142;
</script>

<div class="h-screen w-16 bg-lime-600 flex flex-col shadow-lg">
  <!-- Navigation Items -->
  <div class="flex-1 flex flex-col space-y-1 px-2 items-center">
    {#each routes as route, index}
      {@const isActive = currentRoute.includes(route.route)}
      
      <div class="relative">
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger>
              <a href={route.route} class="block w-12">
                <div class={`
                  w-12 h-12 rounded-lg flex items-center justify-center
                  transition-all duration-200 ease-in-out mt-3
                  ${isActive 
                    ? 'bg-gray-50/20 shadow-lg transform scale-105' 
                    : 'bg-lime-600 hover:bg-slate-600'
                  }
                  hover:transform hover:scale-105 hover:shadow-lg
                  group relative
                `}>
                  {#if route.icon}
                    <route.icon 
                      class={`w-6 h-6 transition-colors ${isActive ? 'text-white' : 'text-white/90'}`}
                      aria-hidden="true" 
                    />
                  {/if}
                  
                  <!-- Badge for first route (you can customize this logic) -->
                  {#if index === 0 && mockBadgeCount > 0}
                    <div class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-md">
                      {mockBadgeCount > 99 ? '99+' : mockBadgeCount}
                    </div>
                  {/if}
                  
                  <!-- Active indicator -->
                  {#if isActive}
                    <div class="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-white rounded-r-full"></div>
                  {/if}
                </div>
              </a>
            </Tooltip.Trigger>
            <Tooltip.Content side="right" class="flex items-center gap-4 bg-gray-900 text-white border-gray-700">
              <span class="font-medium">{route.label}</span>
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
    {/each}
  </div>

  <!-- Bottom Section (optional) -->
<!-- TODO: this should route to the help documentation -->
  <div class="p-2">
    <div class="w-full h-12 bg-green-800/60 rounded-lg flex items-center justify-center hover:bg-green-700/60 transition-colors cursor-pointer">
      <svg class="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  </div>
</div>
