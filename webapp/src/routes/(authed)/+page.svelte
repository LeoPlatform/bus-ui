<script lang="ts">
  import type { AppState } from "$lib/client/appstate.svelte";
    import BotTable from "$lib/client/components/features/bot-table/bot-table.svelte";
  import SearchBar from "$lib/client/components/features/search-bar/search-bar.svelte";
  import { getContext } from "svelte";
   
    
</script>

<div class="flex flex-col w-full">
  <div class="w-1/4 pt-2 pl-2">
    <SearchBar/> 

  </div>
  
  <BotTable />

</div>
