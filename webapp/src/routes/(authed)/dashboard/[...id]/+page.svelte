<script lang="ts">
  import type { AppState } from "$lib/client/appstate.svelte";
  import Dashboard from "$lib/client/components/features/dashboard/dashboard.svelte";
  import UnderConstruction from "$lib/client/components/under-construction.svelte";
  import { getContext } from "svelte";

  let { data }: { data: { id: string } } = $props();

  const appState = getContext<AppState>("appState");
</script>

<div class="flex flex-col h-full">
  <Dashboard id={data.id} />
</div>
