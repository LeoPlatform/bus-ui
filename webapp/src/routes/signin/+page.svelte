<script lang="ts">
	import { SignIn } from '@auth/sveltekit/components';
    import type { PageData } from './$types';
    // import { providerMap } from "../../auth";
    let { session } = $props();
    import { fade } from 'svelte/transition';

    import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { initAvailableProviders, availableProviders } from '$lib/auth/auth-utils';

  // Initialize available providers
  onMount(() => {
    if (browser) {
      initAvailableProviders();
    }
  });

  // Provider metadata for UI
  const providerMeta = {
    cognito: {
      name: "AWS Cognito",
      icon: "aws-cognito",
      color: "bg-orange-600 hover:bg-orange-700" 
    },
    google: {
      name: "Google",
      icon: "google",
      color: "bg-red-500 hover:bg-red-600"
    },
    github: {
      name: "GitHub",
      icon: "github",
      color: "bg-gray-900 hover:bg-black"
    }
  };

  let loading = $state(false);

  let redirectTo = page.url.searchParams.get('redirectTo') || '/';
  let error = page.url.searchParams.get('error');


</script>

<div class="flex min-h-screen items-center justify-center p-4">

  <Card.Root class="w-full max-w-md mx-auto">
    <Card.Header>
      <Card.Title>Sign In</Card.Title>
      <Card.Description>
        Choose your preferred authentication method
      </Card.Description>
    </Card.Header>
    
    <Card.Content class="flex flex-col gap-4">
      {#if $availableProviders.length === 0}
        <div class="text-center py-4 text-muted-foreground">
          Loading available sign-in options...
        </div>
      {:else}
        {#each $availableProviders as provider}
        <SignIn provider={provider} options={{
          redirectTo,
        }}>
          <Button 
            slot="submitButton"
            variant="default" 
            class="w-full {providerMeta[provider]?.color || 'bg-primary'}"
          >
            <span class="mr-2">
              <!-- Icon based on provider type -->
              {#if provider === 'cognito'}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5l10-5l-10-5z"/><path d="M2 17l10 5l10-5"/><path d="M2 12l10 5l10-5"/></svg>
              {:else if provider === 'google'}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/><path d="M15.5 8.5L19 12l-3.5 3.5"/><path d="M8.5 15.5L5 12l3.5-3.5"/><path d="M8.5 8.5L15.5 15.5"/></svg>
              {:else if provider === 'github'}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
              {/if}
            </span>
            Sign in with {providerMeta[provider]?.name || provider}
          </Button>
  
        </SignIn>
        {/each}
      {/if}
    </Card.Content>
    
    <Card.Footer class="flex justify-center">
      <p class="text-sm text-muted-foreground">
        By signing in, you agree to our Terms of Service and Privacy Policy.
      </p>
    </Card.Footer>
  </Card.Root>
</div>
