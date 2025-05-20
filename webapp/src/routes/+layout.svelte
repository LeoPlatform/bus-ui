<script lang="ts">
	import * as Icons from '$lib/components/icons';
  	import LeftNav from '$lib/components/left-nav.svelte';
	import '../app.pcss';
	import { auth } from '$lib/stores/auth';
	
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
<div class="flex h-screen w-full overflow-hidden">
	<LeftNav routes={routes} appState={appState}/>
	<main class="flex-1 overflow-auto p-4">
		{@render children()}
	</main>
</div>
	<!-- {:else}
		<main class="w-full">
			{@render children()}
		</main>
	{/if} -->
<!-- </AuthProvider> -->
