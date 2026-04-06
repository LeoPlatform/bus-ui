<script lang="ts">
  import Dashboard from "$lib/client/components/features/dashboard/dashboard.svelte";
  import { page } from "$app/state";

  let { data }: { data: { id: string } } = $props();

  // Read query params client-side so they work with ssr=false
  let initialTab = $derived(page.url?.searchParams.get("tab") ?? undefined);
  let initialEid = $derived(page.url?.searchParams.get("eid") ?? undefined);
</script>

<div class="flex flex-col h-full">
  <Dashboard id={data.id} {initialTab} {initialEid} />
</div>
