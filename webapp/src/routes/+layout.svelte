<script lang="ts">
	import * as Icons from '$lib/client/components/icons';
  	import LeftNav from '$lib/client/components/left-nav.svelte';
  import TopHeader from '$lib/client/components/top-header.svelte';
	import '../app.pcss';
	
	//TODO remove this when we actually are ready
	const routes = [
		{
			route: '/workflows',
			label: 'Workflows',
			icon: Icons.GitBranch
		},
		{
			route: '/saved_searches',
			label: 'Saved Searches',
			icon: Icons.List
		},
		{
			route: '/trace',
			label: 'Trace',
			icon: Icons.USB
		}
	]
	
	const appState = {};
	let { children } = $props();
	
	// // Skip layout for auth routes
	// $: isAuthRoute = window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/auth');
</script>

<!-- <AuthProvider> -->
	<!-- {#if $auth.isAuthenticated && !isAuthRoute} -->
<!-- <div class="flex h-screen w-full overflow-hidden"> -->
	<main class="flex-row h-screen w-full overflow-hidden">
		<div class="flex-col w-full">
			
			<TopHeader />
			<div class="flex w-full justify-items-stretch">
				<LeftNav routes={routes} appState={appState}/>
				{@render children()}
			</div>
		</div>
	</main>
<!-- </div> -->
	<!-- {:else}
		<main class="w-full">
			{@render children()}
		</main>
	{/if} -->
<!-- </AuthProvider> -->
