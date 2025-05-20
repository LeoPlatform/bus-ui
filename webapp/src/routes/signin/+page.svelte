<script lang="ts">
	import { SignIn } from '@auth/sveltekit/components';
    import type { PageData } from './$types';
    // import { providerMap } from "../../auth";
    let { session } = $props();
    import { fade } from 'svelte/transition';

    import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { page } from '$app/state';


  let loading = $state(false);

  let redirectTo = page.url.searchParams.get('redirectTo') || '/';
  let error = page.url.searchParams.get('error');

    // console.log(session.user);
</script>


<div class="flex min-h-screen items-center justify-center bg-background px-4 py-12">
  <div class="w-full max-w-md space-y-6">
          <div in:fade={{ duration: 300 }}>
              <Card.Root>
                  <Card.Header class="space-y-1">
                      <Card.Title class="text-2xl text-center">Welcome back</Card.Title>
                      <Card.Description class="text-center">
                          Click below to sign in to your account
                      </Card.Description>
                  </Card.Header>
                  <Card.Content>
                        <div class="grid gap-6">
                            <SignIn provider={'cognito'} className="w-full" options={{
                              redirectTo,
                            }}>
                              <Button slot="submitButton" variant="outline">Sign in Via Cognito</Button>
                            </SignIn>
                            <SignIn provider={'google'} className="w-full" options={{
                              redirectTo,
                            }}>
                              <Button slot="submitButton" variant="outline">Sign in Via Google</Button>
                            </SignIn>
                            <SignIn provider={'github'} className="w-full" options={{
                              redirectTo,
                            }}>
                              <Button slot="submitButton" variant="outline">Sign in Via GitHub</Button>
                            </SignIn>
                            <SignIn provider={'custom'} className="w-full" options={{
                              redirectTo,
                            }}>
                              <Button slot="submitButton" variant="outline">Sign in Via Tools</Button>
                            </SignIn>
                        </div>
                  </Card.Content>
              </Card.Root>
          </div>
  </div>
</div>
