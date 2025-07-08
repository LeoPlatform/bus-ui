<script lang="ts">
  import type { AppState } from "$lib/client/appstate.svelte";

  import BotRelationshipTree from "$lib/client/components/features/bot/bot-relationship-tree.svelte";
  import SearchBar from "$lib/client/components/features/search-bar/search-bar.svelte";
  import TimePicker from "$lib/client/components/features/time-picker/time-picker.svelte";
  import { getContext } from "svelte";

  const appState = getContext<AppState>("appState");
  appState.timePickerState.isExpanded = true;
  const { data } = $props();

  // console.log('bot id', data.id);

  appState.botState.selectedBotId = data.id!;
</script>

<div class="grid justify-items-stretch w-full">
  <SearchBar class='w-1/4'/>
  <TimePicker/>

</div>

<BotRelationshipTree />
