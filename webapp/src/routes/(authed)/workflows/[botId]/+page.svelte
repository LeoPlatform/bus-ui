<script lang="ts">
  import type { AppState } from "$lib/client/appstate.svelte";

  import BotRelationshipTree from "$lib/client/components/features/bot/bot-relationship-tree.svelte";
  import SearchBarWithTimePicker from "$lib/client/components/features/search-bar-with-time-picker/search-bar-with-time-picker.svelte";
  import { getContext } from "svelte";

  const appState = getContext<AppState>("appState");
  appState.timePickerState.isExpanded = true;
  const { data } = $props();

  // console.log('bot id', data.id);

  appState.botState.selectedBotId = data.id!;
</script>

<SearchBarWithTimePicker />

<BotRelationshipTree />
