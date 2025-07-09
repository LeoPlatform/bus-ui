<script lang="ts">
  import SearchBar from "../search-bar/search-bar.svelte";
  import TimePicker from "../time-picker/time-picker.svelte";
</script>

<div class="grid grid-flow-col grid-rows-1 gap-4">
  <div class="col-span-1 ml-5 mt-5">
    <SearchBar />
  </div>
  
  <div class="col-span-1 col-start-4 mr-5 mt-5 mb-auto ml-auto">
    <TimePicker />
  </div>
</div>
