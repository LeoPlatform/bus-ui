<script lang="ts">
	import * as Icons from '$lib/components/icons';
  	import LeftNav from '$lib/components/left-nav.svelte';
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
</script>

<div class="flex h-screen w-full overflow-hidden">
	<LeftNav routes={routes} appState={appState}/>
	<main class="flex-1 overflow-auto p-4">
		<!-- <div class="debug-info">
			<p>DEBUG: Content area</p>
		</div> -->
		{@render children()}
	</main>
</div>