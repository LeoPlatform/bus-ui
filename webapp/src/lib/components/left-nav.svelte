<script lang="ts">
  import type { AppState, Route } from "$lib/types";
  import { Separator } from "$lib/components/ui/separator";
  import * as Tooltip from '$lib/components/ui/tooltip/index';
  import {Button} from "$lib/components/ui/button";
  import { page } from "$app/stores";

  const currentRoute = $derived($page.url.pathname ? $page.url.pathname : '/');

    type Props = {
        // workflows: any;//TODO: make this a type
        // searches: any; //TODO: make this a type
        // dispatch: any;//TODO: make this a type
        routes: Route[];
        appState: AppState;
    }

    let {routes, appState} = $props();

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
