<script lang="ts">
	import * as Card from "$lib/client/components/ui/card";
	import Button from "$lib/client/components/ui/button/button.svelte";
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import Construction from '@lucide/svelte/icons/construction';

	interface Props {
		/** The title of the page under construction */
		title?: string;
		/** A description of what this page will contain */
		description?: string;
		/** Custom message to display */
		message?: string;
		/** Whether to show the back button */
		showBackButton?: boolean;
		/** Custom back button text */
		backButtonText?: string;
		/** Expected completion date/timeframe */
		expectedCompletion?: string;
		/** Contact information for questions */
		contactInfo?: string;
	}

	let {
		title = "Page Under Construction",
		description = "This page is currently being developed and will be available soon.",
		message,
		showBackButton = true,
		backButtonText = "Go Back",
		expectedCompletion,
		contactInfo
	}: Props = $props();

	function handleGoBack() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
		} else {
			window.location.href = `${base}/`;
		}
	}
</script>

<div class="min-h-screen bg-background flex items-center justify-center p-4">
	<div class="w-full max-w-2xl">
		<Card.Root class="text-center">
			<Card.Header class="pb-4">
				<!-- Construction Icon -->
				<div class="mx-auto mb-6 relative">
					<div class="w-24 h-24 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
						<Construction size="70"/>
					</div>
					<!-- Animated dots -->
					<div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
						<div class="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style="animation-delay: 0ms;"></div>
						<div class="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style="animation-delay: 150ms;"></div>
						<div class="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style="animation-delay: 300ms;"></div>
					</div>
				</div>

				<Card.Title class="text-3xl font-bold text-foreground mb-2">
					{title}
				</Card.Title>
				
				<Card.Description class="text-lg text-muted-foreground">
					{description}
				</Card.Description>
			</Card.Header>

			<Card.Content class="space-y-6">
				{#if message}
					<div class="bg-muted/50 rounded-lg p-4 border-l-4 border-amber-400">
						<p class="text-muted-foreground">
							{message}
						</p>
					</div>
				{/if}

				{#if expectedCompletion}
					<div class="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span>Expected completion: {expectedCompletion}</span>
					</div>
				{/if}

				{#if contactInfo}
					<div class="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span>Questions? Contact: {contactInfo}</span>
					</div>
				{/if}

				<!-- Progress indicator -->
				<div class="space-y-2">
					<div class="flex justify-between text-sm text-muted-foreground">
						<span>Development Progress</span>
						<span class="animate-pulse">In Progress...</span>
					</div>
					<div class="w-full bg-muted rounded-full h-2">
						<div class="bg-gradient-to-r from-amber-400 to-amber-600 h-2 rounded-full animate-pulse" style="width: 35%;"></div>
					</div>
				</div>

				{#if showBackButton}
					<div class="pt-4">
						<Button 
							variant="outline" 
							onclick={handleGoBack}
							class="w-full sm:w-auto"
						>
							<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
							</svg>
							{backButtonText}
						</Button>
					</div>
				{/if}

				<!-- Current page info for debugging -->
				{#if page.url.pathname !== '/'}
					<div class="pt-4 border-t border-border">
						<p class="text-xs text-muted-foreground">
							Current path: <code class="bg-muted px-1 py-0.5 rounded text-xs">{page.url.pathname}</code>
						</p>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>

<style>
	@keyframes bounce {
		0%, 20%, 53%, 80%, 100% {
			transform: translate3d(0,0,0);
		}
		40%, 43% {
			transform: translate3d(0, -8px, 0);
		}
		70% {
			transform: translate3d(0, -4px, 0);
		}
		90% {
			transform: translate3d(0, -2px, 0);
		}
	}
</style>
