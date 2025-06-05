<script lang="ts">
  import type { AppState } from "$lib/client/appstate.svelte";

  import BotRelationshipTree from "$lib/client/components/features/bot/bot-relationship-tree.svelte";
  import { getContext } from "svelte";

  const appState = getContext<AppState>("appState");
  const { data } = $props();

  console.log('bot id', data.id);

  appState.botState.selectedBotId = data.id!;
</script>

<BotRelationshipTree />
