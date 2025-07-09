<script lang="ts">
  import { page } from "$app/state";
  import Button from "$lib/client/components/ui/button/button.svelte";
  import * as DropdownMenu from "$lib/client/components/ui/dropdown-menu/";
  import Ellipsis from '@lucide/svelte/icons/ellipsis';

 const currentRoute = $derived(page.url.pathname ? page.url.pathname : '/');
    let pageTitle = $derived(currentRoute.split('/')[1] || 'Dashboard');
</script>

<header class="flex h-16 w-screen bg-slate-900/70 text-left">
    <!-- Logo Section -->
    <div class="flex justify-between w-1/8 items-center">
        <div class="flex w-16 bg-black">
          <Button 
            href='/'
            variant="ghost"
            size="icon"
            class="w-16 h-16 hover:bg-white/10 transition-colors"
            aria-disabled={currentRoute === '/'}
          >
            <img src="//cdnleo.s3.amazonaws.com/logos/leo_icon.png" alt="Leo Logo" class="w-8 h-8" />
          </Button>

        </div>
        <p class="text-white text-22 font-bold">{pageTitle.toUpperCase()}</p>
    </div>
    <div class='grid w-full h-full justify-stretch items-center'>
        <!-- <p class='justify-self-end pr-4'>test</p> -->
        <DropdownMenu.Root>
            <DropdownMenu.Trigger>
                
                <Ellipsis color="white" class="justify-self-end pr-4 w-12"/>
                
            </DropdownMenu.Trigger>
            <DropdownMenu.Content class="w-56" align="end">
                <DropdownMenu.Item>
                    Timezone (TBD)
                </DropdownMenu.Item>
                <DropdownMenu.Item>
                    Pause Display (TBD)
                </DropdownMenu.Item>
                <DropdownMenu.Item>
                    Manage Alerts (TBD)
                </DropdownMenu.Item>
                <DropdownMenu.Item>
                    Messages (TBD)
                </DropdownMenu.Item>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    </div>
  
</header>