<script lang="ts">
  import type { AppState } from "$lib/client/appstate.svelte";

  import BotRelationshipTree from "$lib/client/components/features/bot/bot-relationship-tree.svelte";
  import { getContext } from "svelte";

  const appState = getContext<AppState>("appState");
  const { data } = $props();

  // One-time script body does not re-run on client navigations between workflow IDs; keep URL and bot state in sync.
  if (data.id) {
    appState.botState.selectedBotId = data.id;
  }

  $effect(() => {
    const id = data.id;
    if (id) {
      appState.botState.selectedBotId = id;
    }
  });
</script>

<div class="flex min-h-0 w-full flex-1 flex-col">
  <div class="flex min-h-0 w-full flex-1 flex-col px-3 sm:px-4">
    <div class="min-h-0 flex-1 overflow-hidden pb-4 pt-3">
      <BotRelationshipTree />
    </div>
  </div>
</div>
