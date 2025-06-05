<script lang="ts">
  import type { Route } from "$lib/types";
  import { Separator } from "$lib/client/components/ui/separator";
  import * as Tooltip from '$lib/client/components/ui/tooltip/index';
  import {Button} from "$lib/client/components/ui/button";
  import { page } from '$app/state';

  const currentRoute = $derived(page.url.pathname ? page.url.pathname : '/');

    type Props = {
        // workflows: any;//TODO: make this a type
        // searches: any; //TODO: make this a type
        // dispatch: any;//TODO: make this a type
        routes: Route[];
    }

    let {routes} = $props();

    let hover = $state()

</script>

<div class="h-screen w-32 flex flex-col">
    <Button 
        href='/'
        variant="ghost"
        size="icon"
        aria-disabled={currentRoute === '/'}
    >
        <img src="//cdnleo.s3.amazonaws.com/logos/leo_icon.png" alt="Leo Logo" />
    </Button>
    <!-- <div class="h-64 w-64">
        <a href="/"><img src="//cdnleo.s3.amazonaws.com/logos/leo_icon.png" alt="Leo Logo" /></a>
    </div> -->
    <!-- <Separator orientation="horizontal"/> -->
    {#each routes as route}
    <Tooltip.Provider>
        <Tooltip.Root>
            <Tooltip.Trigger>
                <a href={route.route} class="inline-block">
                    <Button
                     variant={"ghost"}
                     size="icon"
                     aria-disabled={route.route === currentRoute}
                    >
                    {#if route.icon}
                        <route.icon aria-hidden="true" />
                    {/if}
                    </Button>
                </a>
            </Tooltip.Trigger>
            <Tooltip.Content side="right" class="flex items-center gap-4">
                {route.label}
            </Tooltip.Content>

        </Tooltip.Root>
    </Tooltip.Provider>
    {/each}
</div>
